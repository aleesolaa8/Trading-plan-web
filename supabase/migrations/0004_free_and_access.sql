-- =====================================================================
-- Pasos 5–8 · Plan gratuito, acceso por plan y datos extra del journal.
-- Regla general: cada límite vive en plans.features y se comprueba en la
-- base de datos, no solo en la interfaz.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Plan que aplica: suscripción → prueba Pro (7 días sin tarjeta) → Free
-- ---------------------------------------------------------------------
create or replace function public.current_plan(uid uuid default auth.uid())
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select s.plan_id from subscriptions s
      where s.user_id = uid and s.status in ('trialing','active','past_due')
        and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')
      order by s.updated_at desc limit 1),
    (select 'pro' from profiles p, plans pl
      where p.id = uid and pl.id = 'pro'
        and p.created_at + make_interval(days => pl.trial_days) > now()),
    (select 'free' from plans where id = 'free' and is_active and uid is not null)
  );
$$;

-- Valor de un límite del plan actual (null = sin límite / no definido)
create or replace function public.plan_feature(uid uuid, p_key text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select features -> p_key from plans where id = public.current_plan(uid);
$$;

-- Todo lo que la interfaz necesita saber del acceso del usuario
create or replace function public.my_access()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_plan text;
  v_sub record;
  v_trial_end timestamptz;
begin
  if uid is null then return null; end if;
  v_plan := public.current_plan(uid);
  select s.plan_id, s.status, s.billing_interval, s.current_period_end, s.cancel_at_period_end
    into v_sub
    from subscriptions s where s.user_id = uid
   order by s.updated_at desc limit 1;
  select p.created_at + make_interval(days => pl.trial_days) into v_trial_end
    from profiles p, plans pl where p.id = uid and pl.id = 'pro';
  return jsonb_build_object(
    'plan', v_plan,
    'plan_name', (select name from plans where id = v_plan),
    'features', coalesce((select features from plans where id = v_plan), '{}'::jsonb),
    'source', case
      when v_sub.plan_id is not null and v_sub.plan_id = v_plan and v_sub.status in ('trialing','active','past_due') then 'subscription'
      when v_plan = 'pro' and v_trial_end > now() then 'trial'
      when v_plan = 'free' then 'free'
      else null end,
    'trial_ends_at', v_trial_end,
    'subscription', case when v_sub.plan_id is null then null else jsonb_build_object(
      'plan', v_sub.plan_id, 'status', v_sub.status, 'interval', v_sub.billing_interval,
      'current_period_end', v_sub.current_period_end, 'cancel_at_period_end', v_sub.cancel_at_period_end) end
  );
end;
$$;

revoke all on function public.plan_feature(uuid, text), public.my_access() from public;
grant execute on function public.my_access() to authenticated;

-- ---------------------------------------------------------------------
-- 2. IA: nuevos tipos de uso
-- ---------------------------------------------------------------------
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('plan','review','pattern','chat','screenshot'));

create or replace function public.ai_limit_key(p_kind text)
returns text language sql immutable as $$
  select case p_kind
    when 'chat' then 'copilot_messages_per_month'
    when 'plan' then 'ai_plan_generations'
    when 'review' then 'ai_reviews_per_month'
    when 'screenshot' then 'ai_screenshot_reviews_per_month'
    else null end;
$$;

-- ---------------------------------------------------------------------
-- 3. Journal: hora, resultado en dinero (fondeo) y comentario de la IA
-- ---------------------------------------------------------------------
alter table public.journal_entries
  add column if not exists trade_time    time,
  add column if not exists result_amount numeric(14,2),
  add column if not exists ai_feedback   text,
  add column if not exists checklist_run_id uuid references public.checklist_runs(id) on delete set null;

alter table public.checklist_runs
  add column if not exists labels   text[] not null default '{}',   -- checklist completo en ese momento
  add column if not exists passed   text[] not null default '{}';   -- puntos marcados

alter table public.trading_accounts
  add column if not exists initial_balance numeric(14,2) check (initial_balance > 0);

alter table public.weekly_reviews
  add column if not exists ai jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- 4. Límites que se comprueban al guardar
-- ---------------------------------------------------------------------
create or replace function public.enforce_journal_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit int := (public.plan_feature(new.user_id, 'journal_entries_per_month'))::int;
  v_used int;
begin
  if v_limit is null then return new; end if;
  select count(*) into v_used from journal_entries
   where user_id = new.user_id and created_at >= date_trunc('month', now());
  if v_used >= v_limit then
    raise exception 'journal_limit' using errcode = 'P0001', detail = v_limit::text;
  end if;
  return new;
end $$;
drop trigger if exists journal_limit on public.journal_entries;
create trigger journal_limit before insert on public.journal_entries
  for each row execute function public.enforce_journal_limit();

create or replace function public.enforce_account_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int := coalesce((public.plan_feature(new.user_id, 'max_accounts'))::int, 1);
  v_funded boolean := coalesce((public.plan_feature(new.user_id, 'funded_mode'))::boolean, false);
  v_count int;
begin
  if not new.is_archived and (tg_op = 'INSERT' or old.is_archived) then
    select count(*) into v_count from trading_accounts
     where user_id = new.user_id and not is_archived and id <> new.id;
    if v_count >= v_max then
      raise exception 'accounts_limit' using errcode = 'P0001', detail = v_max::text;
    end if;
  end if;
  if new.kind = 'fondeo' and not v_funded and (tg_op = 'INSERT' or old.kind <> 'fondeo') then
    raise exception 'funded_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists account_rules on public.trading_accounts;
create trigger account_rules before insert or update on public.trading_accounts
  for each row execute function public.enforce_account_rules();

-- ---------------------------------------------------------------------
-- 5. Resumen de un periodo (lo usan el panel, el journal y la revisión)
-- ---------------------------------------------------------------------
create or replace function public.journal_stats(p_from date, p_to date, p_account uuid default null)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'trades',        count(*) filter (where entry_type = 'trade'),
    'skipped',       count(*) filter (where entry_type = 'skipped'),
    'compliance_pct', round(100.0 * count(*) filter (where plan_compliance = 'si')
                       / nullif(count(*) filter (where entry_type = 'trade'), 0), 1),
    'total_r',       coalesce(sum(result_r) filter (where entry_type = 'trade'), 0),
    'win_pct',       round(100.0 * count(*) filter (where entry_type = 'trade' and result_r > 0)
                       / nullif(count(*) filter (where entry_type = 'trade'), 0), 1),
    'avg_r',         round(avg(result_r) filter (where entry_type = 'trade'), 2),
    'total_amount',  coalesce(sum(result_amount) filter (where entry_type = 'trade'), 0)
  )
  from journal_entries
  where user_id = auth.uid() and trade_date between p_from and p_to
    and (p_account is null or account_id = p_account);
$$;
grant execute on function public.journal_stats(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Stripe: orden de los eventos (un evento antiguo no pisa uno nuevo)
-- ---------------------------------------------------------------------
alter table public.subscriptions add column if not exists event_created bigint not null default 0;
