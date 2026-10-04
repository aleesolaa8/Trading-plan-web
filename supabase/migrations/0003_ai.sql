-- =====================================================================
-- Paso 4 · IA: plan vigente del usuario y cupos de uso por plan.
-- El cupo se comprueba y se descuenta en la base de datos, de forma
-- atómica, para que nadie pueda saltárselo desde el navegador.
-- =====================================================================

-- Plan que aplica ahora: suscripción activa, o prueba de Pro (sin tarjeta) mientras dure.
create or replace function public.current_plan(uid uuid default auth.uid())
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select s.plan_id from subscriptions s
      where s.user_id = uid and s.status in ('trialing','active')
        and (s.current_period_end is null or s.current_period_end > now())
      order by s.updated_at desc limit 1),
    (select 'pro' from profiles p, plans pl
      where p.id = uid and pl.id = 'pro'
        and p.created_at + make_interval(days => pl.trial_days) > now())
  );
$$;

-- Clave de features según el tipo de uso
create or replace function public.ai_limit_key(p_kind text)
returns text language sql immutable as $$
  select case p_kind
    when 'chat' then 'copilot_messages_per_month'
    when 'plan' then 'ai_plan_generations'
    when 'review' then 'ai_reviews_per_month'
    else null end;
$$;

-- Estado del cupo del mes (para mostrarlo en la interfaz)
create or replace function public.ai_quota(p_kind text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_plan text := public.current_plan(uid);
  v_limit int;
  v_used int;
begin
  if uid is null then return jsonb_build_object('plan', null, 'used', 0, 'limit', 0); end if;
  select coalesce((features ->> public.ai_limit_key(p_kind))::int, 0) into v_limit from plans where id = v_plan;
  select count(*) into v_used from ai_usage
   where user_id = uid and kind = p_kind and created_at >= date_trunc('month', now());
  return jsonb_build_object('plan', v_plan, 'used', v_used, 'limit', coalesce(v_limit, 0));
end;
$$;

-- Comprueba y descuenta un uso. Devuelve el id del uso (para devolverlo si la llamada falla).
create or replace function public.consume_ai_quota(p_kind text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_plan text;
  v_limit int;
  v_used int;
  v_id bigint;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if public.ai_limit_key(p_kind) is null then raise exception 'unknown_kind'; end if;
  -- Un uso a la vez por usuario y tipo: evita que dos peticiones simultáneas se cuelen
  perform pg_advisory_xact_lock(hashtext(uid::text || ':' || p_kind));
  v_plan := public.current_plan(uid);
  select coalesce((features ->> public.ai_limit_key(p_kind))::int, 0) into v_limit from plans where id = v_plan;
  v_limit := coalesce(v_limit, 0);
  select count(*) into v_used from ai_usage
   where user_id = uid and kind = p_kind and created_at >= date_trunc('month', now());
  if v_plan is null or v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'plan', v_plan, 'used', v_used, 'limit', v_limit);
  end if;
  insert into ai_usage (user_id, kind) values (uid, p_kind) returning id into v_id;
  return jsonb_build_object('allowed', true, 'plan', v_plan, 'used', v_used + 1, 'limit', v_limit, 'usage_id', v_id);
end;
$$;

-- Si la llamada a la IA falla, el uso no cuenta
create or replace function public.refund_ai_quota(p_usage_id bigint)
returns void language sql volatile security definer set search_path = public as $$
  delete from ai_usage where id = p_usage_id and user_id = auth.uid();
$$;

-- Guarda los tokens consumidos (control de costes)
create or replace function public.record_ai_tokens(p_usage_id bigint, p_in int, p_out int)
returns void language sql volatile security definer set search_path = public as $$
  update ai_usage set tokens_in = p_in, tokens_out = p_out where id = p_usage_id and user_id = auth.uid();
$$;

revoke all on function public.current_plan(uuid), public.ai_quota(text), public.consume_ai_quota(text),
  public.refund_ai_quota(bigint), public.record_ai_tokens(bigint, int, int) from public;
grant execute on function public.ai_quota(text), public.consume_ai_quota(text),
  public.refund_ai_quota(bigint), public.record_ai_tokens(bigint, int, int) to authenticated;
-- current_plan solo se llama desde las funciones de arriba (como definer); no se expone

-- Un hilo de chat activo por usuario a la vez
create index if not exists chat_threads_user_updated on public.chat_threads(user_id, updated_at desc);
