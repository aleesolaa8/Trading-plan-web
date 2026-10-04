-- =====================================================================
-- Trading Plan · Esquema inicial (paso 1)
-- Postgres / Supabase. RLS activado en TODAS las tablas.
-- Convención: enumerados como text + CHECK (se pueden ampliar sin
-- migraciones de tipo), timestamps en UTC, ids uuid.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. Perfiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  role            text not null default 'user' check (role in ('user','admin')),
  timezone        text not null default 'Europe/Madrid',
  theme           text not null default 'dark' check (theme in ('dark','light','system')),
  onboarding_done boolean not null default false,
  disclaimer_accepted_at timestamptz,          -- aceptación del aviso de riesgo
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ¿Es admin el usuario actual? (para editar contenido sin desplegar)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, disclaimer_accepted_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email,'@',1)),
    -- El registro exige aceptar el aviso de riesgo; se guarda la fecha real de inserción.
    case when new.raw_user_meta_data ? 'disclaimer_accepted_at' then now() end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Planes de suscripción y Stripe
-- ---------------------------------------------------------------------
create table public.plans (
  id              text primary key,                       -- 'free','core','pro','premium'
  name            text not null,
  is_active       boolean not null default false,         -- solo 'core' activo al inicio
  stripe_price_id text,                                   -- o env STRIPE_PRICE_CORE
  price_cents     integer,                                -- caché informativa; la verdad es Stripe
  currency        text not null default 'eur',
  interval        text not null default 'month' check (interval in ('month','year')),
  trial_days      integer not null default 0 check (trial_days >= 0),
  features        jsonb not null default '{}'::jsonb,     -- límites: ai_reviews_per_month, etc.
  sort_order      integer not null default 0,
  updated_at      timestamptz not null default now()
);

create table public.stripe_customers (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

create table public.subscriptions (
  id                     text primary key,                -- sub_xxx de Stripe
  user_id                uuid not null references auth.users(id) on delete cascade,
  plan_id                text not null references public.plans(id),
  status                 text not null check (status in
                           ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  trial_end              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions(user_id);
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Idempotencia de webhooks (solo service role)
create table public.stripe_events (
  id          text primary key,            -- evt_xxx
  type        text not null,
  received_at timestamptz not null default now()
);

-- Acceso efectivo: ¿tiene el usuario una suscripción válida?
create or replace function public.has_active_access(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = uid
      and status in ('trialing','active')
      and (current_period_end is null or current_period_end > now() - interval '1 day')
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Contenido editable del diagnóstico (sin cablear en código)
-- ---------------------------------------------------------------------
-- protocols: user_id NULL = plantilla editable por admin;
--            user_id = X    = protocolo propio del usuario (copiado o creado).
create table public.protocols (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  source_id    uuid references public.protocols(id) on delete set null,  -- plantilla de origen
  slug         text,                                  -- solo plantillas
  category     text not null check (category in
                 ('trading','riesgo','emociones','sueno','rutina','comida','ejercicio','pausas','desconexion','otro')),
  title        text not null,
  body         text not null,                         -- la regla, en lenguaje de consejo
  trigger_text text,                                  -- "Cuando…" (opcional)
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint protocols_slug_template check ((user_id is null) = (slug is not null))
);
create unique index protocols_template_slug on public.protocols(slug) where user_id is null;
create index protocols_user_idx on public.protocols(user_id);
create trigger protocols_updated before update on public.protocols
  for each row execute function public.set_updated_at();

create table public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                  -- 'tiempo_diario', 'riesgo', …
  position    integer not null,
  eyebrow     text,                                  -- etiqueta pequeña en mayúsculas
  prompt      text not null,
  helper      text,
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);
create trigger quiz_questions_updated before update on public.quiz_questions
  for each row execute function public.set_updated_at();

create table public.quiz_options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.quiz_questions(id) on delete cascade,
  slug          text not null,
  position      integer not null,
  label         text not null,
  why_text      text not null,       -- "Por qué puede pasar" (humano, sin juzgar)
  plan_text     text not null,       -- "Cómo lo trabaja tu plan"
  protocol_id   uuid references public.protocols(id) on delete set null,  -- plantilla que genera
  value         jsonb not null default '{}'::jsonb,  -- datos para el generador (p. ej. {"minutes":60})
  updated_at    timestamptz not null default now(),
  unique (question_id, slug)
);
create trigger quiz_options_updated before update on public.quiz_options
  for each row execute function public.set_updated_at();

create table public.quiz_responses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  option_id   uuid not null references public.quiz_options(id) on delete cascade,
  attempt     integer not null default 1,           -- permite repetir el diagnóstico
  created_at  timestamptz not null default now(),
  unique (user_id, question_id, attempt)
);

-- ---------------------------------------------------------------------
-- 4. Plan de trading y versiones
-- ---------------------------------------------------------------------
create table public.trading_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users(id) on delete cascade,
  current_version_id uuid,                            -- FK añadida abajo
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trading_plans_updated before update on public.trading_plans
  for each row execute function public.set_updated_at();

create table public.plan_versions (
  id               uuid primary key default gen_random_uuid(),
  plan_id          uuid not null references public.trading_plans(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  version          integer not null,
  source           text not null check (source in ('ai','user','review')),
  -- Reglas que da el usuario (la IA solo redacta/ordena, no inventa):
  inputs           jsonb not null default '{}'::jsonb,
  -- Plan estructurado: secciones, horario, gestión de riesgo, checklist…
  content          jsonb not null,
  max_risk_pct     numeric(5,2) check (max_risk_pct > 0 and max_risk_pct <= 10),  -- límite del plan
  max_trades_day   integer check (max_trades_day > 0),
  max_daily_loss_r numeric(6,2),
  change_note      text,
  created_at       timestamptz not null default now(),
  unique (plan_id, version)
);
alter table public.trading_plans
  add constraint trading_plans_current_fk foreign key (current_version_id)
  references public.plan_versions(id) on delete set null;

-- ---------------------------------------------------------------------
-- 5. Calendario (bloques de vida + trading)
-- ---------------------------------------------------------------------
create table public.calendar_blocks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  block_type    text not null check (block_type in
                  ('trading','analisis','backtesting','formacion','revision','comida','ejercicio',
                   'sueno','pausa','personal','desconexion','rutina','otro')),
  content_kind  text check (content_kind in ('backtesting','formacion','analisis')),  -- contenido flexible
  start_time    time not null,                       -- hora libre
  duration_min  integer not null check (duration_min between 5 and 1440),
  days_of_week  smallint[] not null default '{1,2,3,4,5}',  -- ISO 1=lun … 7=dom
  is_screen     boolean not null default true,       -- cuenta como tiempo de pantalla
  notes         text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint days_valid check (days_of_week <@ '{1,2,3,4,5,6,7}'::smallint[])
);
create index calendar_blocks_user_idx on public.calendar_blocks(user_id);
create trigger calendar_blocks_updated before update on public.calendar_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Calculadora: mercados del usuario (cualquiera) y sus datos de contrato
-- El catálogo de la interfaz solo sugiere nombres; los valores los introduce
-- el usuario porque cambian según el bróker.
-- ---------------------------------------------------------------------
create table public.assets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 30),  -- 'XAUUSD', 'US100', 'Café'…
  category        text not null default 'otro' check (category in
                    ('indices','forex','materias_primas','cripto','acciones','futuros','otro')),
  is_traded       boolean not null default true,      -- forma parte de los mercados de su plan
  value_per_point numeric(14,6) check (value_per_point > 0),   -- por 1 lote
  min_lot         numeric(10,4) check (min_lot > 0),
  lot_step        numeric(10,4) check (lot_step > 0),
  currency        text not null default 'EUR',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, name)
);
create trigger assets_updated before update on public.assets
  for each row execute function public.set_updated_at();

create table public.account_settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  account_balance numeric(14,2) check (account_balance >= 0),
  currency        text not null default 'EUR',
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Checklist pre-operación
-- ---------------------------------------------------------------------
create table public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null,
  position   integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.checklist_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  checked     uuid[] not null default '{}',
  all_passed  boolean not null,
  journal_entry_id uuid,                              -- se vincula si acaba en operación
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. Journal
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  entry_type     text not null default 'trade' check (entry_type in ('trade','skipped')),
  trade_date     date not null default current_date,
  asset_name     text not null,
  direction      text check (direction in ('long','short')),
  strategy       text,
  result_r       numeric(8,2),
  emotion_before text check (emotion_before in
                   ('tranquilo','con_prisa','ansioso','aburrido','frustrado','cansado')),
  plan_compliance text check (plan_compliance in ('si','en_parte','no')),
  main_error     text check (main_error in
                   ('ninguno','entrada_anticipada','movi_sl','mas_riesgo','cierre_anticipado','sobreopere')),
  screenshot_path text,                               -- Storage: journal/{user_id}/{uuid}.png
  lesson         text,
  skip_reason    text,                                -- solo entry_type = 'skipped'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint trade_fields check (
    entry_type = 'skipped'
    or (direction is not null and result_r is not null and plan_compliance is not null)
  ),
  constraint skipped_fields check (entry_type = 'trade' or skip_reason is not null)
);
create index journal_user_date_idx on public.journal_entries(user_id, trade_date desc);
create trigger journal_entries_updated before update on public.journal_entries
  for each row execute function public.set_updated_at();

alter table public.checklist_runs
  add constraint checklist_runs_journal_fk foreign key (journal_entry_id)
  references public.journal_entries(id) on delete set null;

-- Resumen del journal (respeta RLS: security_invoker)
create or replace view public.journal_summary with (security_invoker = true) as
select
  user_id,
  count(*) filter (where entry_type = 'trade')                                   as trades,
  count(*) filter (where entry_type = 'skipped')                                 as skipped,
  round(100.0 * count(*) filter (where plan_compliance = 'si')
        / nullif(count(*) filter (where entry_type = 'trade'),0), 1)            as compliance_pct,
  coalesce(sum(result_r) filter (where entry_type = 'trade'),0)                  as total_r,
  round(100.0 * count(*) filter (where result_r > 0)
        / nullif(count(*) filter (where entry_type = 'trade'),0), 1)            as win_pct,
  round(avg(result_r) filter (where entry_type = 'trade'), 2)                    as avg_r
from public.journal_entries
group by user_id;

-- ---------------------------------------------------------------------
-- 9. Revisión semanal con IA y control de uso
-- ---------------------------------------------------------------------
create table public.weekly_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,
  stats       jsonb not null default '{}'::jsonb,   -- snapshot del resumen
  ai_text     text,                                 -- propuestas ("puede indicar…")
  user_notes  text,
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.ai_usage (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('plan','review','pattern','chat')),
  tokens_in  integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 10. Copiloto 24 h (chat con IA). Solo el servidor llama al modelo.
-- ---------------------------------------------------------------------
create table public.chat_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_threads_user_idx on public.chat_threads(user_id, updated_at desc);
create trigger chat_threads_updated before update on public.chat_threads
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id         bigserial primary key,
  thread_id  uuid not null references public.chat_threads(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','assistant','help')),  -- help = recurso de ayuda mostrado
  content    text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on public.chat_messages(thread_id, id);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.plans             enable row level security;
alter table public.stripe_customers  enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.stripe_events     enable row level security;
alter table public.protocols         enable row level security;
alter table public.quiz_questions    enable row level security;
alter table public.quiz_options      enable row level security;
alter table public.quiz_responses    enable row level security;
alter table public.trading_plans     enable row level security;
alter table public.plan_versions     enable row level security;
alter table public.calendar_blocks   enable row level security;
alter table public.assets            enable row level security;
alter table public.account_settings  enable row level security;
alter table public.checklist_items   enable row level security;
alter table public.checklist_runs    enable row level security;
alter table public.journal_entries   enable row level security;
alter table public.weekly_reviews    enable row level security;
alter table public.ai_usage          enable row level security;
alter table public.chat_threads      enable row level security;
alter table public.chat_messages     enable row level security;

-- Perfil: solo el propio. El rol no se puede auto-promocionar.
create policy "perfil propio: leer" on public.profiles
  for select using (id = auth.uid());
create policy "perfil propio: editar" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- Planes: lectura pública de los activos; escritura solo admin.
create policy "planes: leer activos" on public.plans
  for select using (is_active or public.is_admin());
create policy "planes: admin" on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

-- Stripe: el usuario solo lee lo suyo; escribe únicamente el webhook (service role).
create policy "cliente stripe propio" on public.stripe_customers
  for select using (user_id = auth.uid());
create policy "suscripción propia" on public.subscriptions
  for select using (user_id = auth.uid());
-- stripe_events: sin políticas → solo service role.

-- Contenido del diagnóstico: lectura para cualquiera (landing muestra la demo),
-- edición solo admin.
create policy "quiz preguntas: leer" on public.quiz_questions
  for select using (is_active or public.is_admin());
create policy "quiz preguntas: admin" on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "quiz opciones: leer" on public.quiz_options
  for select using (true);
create policy "quiz opciones: admin" on public.quiz_options
  for all using (public.is_admin()) with check (public.is_admin());

-- Protocolos: plantillas visibles para todos los autenticados; los propios, solo su dueño.
create policy "protocolos: leer" on public.protocols
  for select using (user_id is null or user_id = auth.uid());
create policy "protocolos: crear propio" on public.protocols
  for insert with check (user_id = auth.uid());
create policy "protocolos: editar propio" on public.protocols
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "protocolos: borrar propio" on public.protocols
  for delete using (user_id = auth.uid());
create policy "protocolos: admin plantillas" on public.protocols
  for all using (user_id is null and public.is_admin())
  with check (user_id is null and public.is_admin());

-- Tablas de datos del usuario: patrón "solo lo mío" para todo.
do $$
declare t text;
begin
  foreach t in array array[
    'quiz_responses','trading_plans','plan_versions','calendar_blocks','assets',
    'account_settings','checklist_items','checklist_runs','journal_entries','weekly_reviews',
    'chat_threads','chat_messages'
  ] loop
    execute format(
      'create policy "solo propietario" on public.%I for all
         using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- ai_usage: el usuario puede leer su consumo; inserta el servidor (service role).
create policy "uso IA propio" on public.ai_usage
  for select using (user_id = auth.uid());

-- =====================================================================
-- Storage: capturas del journal (bucket privado, carpeta por usuario)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('journal', 'journal', false)
on conflict (id) do nothing;

create policy "journal: leer propias" on storage.objects
  for select using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "journal: subir propias" on storage.objects
  for insert with check (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "journal: borrar propias" on storage.objects
  for delete using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
