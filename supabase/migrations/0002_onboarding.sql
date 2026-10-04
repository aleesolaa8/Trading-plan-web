-- =====================================================================
-- Paso 3 · Onboarding: guarda el diagnóstico y crea el plan de una vez.
-- SECURITY INVOKER: corre con los permisos del usuario, así que el RLS
-- sigue aplicando a cada insert. Todo ocurre en una sola transacción.
-- =====================================================================

-- Un protocolo de plantilla se copia una sola vez por usuario
create unique index if not exists protocols_user_source_uq
  on public.protocols(user_id, source_id) where user_id is not null and source_id is not null;

create or replace function public.complete_onboarding(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  v_attempt  int;
  v_plan_id  uuid;
  v_version  int;
  v_ver_id   uuid;
  v_rules    jsonb := p->'rules';
  r          jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 1. Respuestas del diagnóstico (nuevo intento cada vez)
  select coalesce(max(attempt), 0) + 1 into v_attempt from quiz_responses where user_id = uid;
  insert into quiz_responses (user_id, question_id, option_id, attempt)
  select uid, o.question_id, o.id, v_attempt
  from jsonb_array_elements_text(p->'option_ids') as x(id)
  join quiz_options o on o.id = x.id::uuid;

  -- 2. Plan y nueva versión
  insert into trading_plans (user_id) values (uid)
  on conflict (user_id) do update set updated_at = now()
  returning id into v_plan_id;

  select coalesce(max(version), 0) + 1 into v_version from plan_versions where plan_id = v_plan_id;
  insert into plan_versions (plan_id, user_id, version, source, inputs, content,
                             max_risk_pct, max_trades_day, max_daily_loss_r, change_note)
  values (v_plan_id, uid, v_version, 'user', p->'answers', p->'content',
          (v_rules->>'risk')::numeric, (v_rules->>'maxTrades')::int, (v_rules->>'maxLoss')::numeric,
          case when v_version = 1 then 'Plan inicial a partir del diagnóstico' else 'Diagnóstico o reglas actualizados' end)
  returning id into v_ver_id;
  update trading_plans set current_version_id = v_ver_id where id = v_plan_id;

  -- 3. Protocolos: copia las plantillas de las opciones elegidas (sin duplicar)
  insert into protocols (user_id, source_id, category, title, trigger_text, body, sort_order)
  select distinct on (t.id) uid, t.id, t.category, t.title, t.trigger_text, t.body, t.sort_order
  from jsonb_array_elements_text(p->'option_ids') as x(id)
  join quiz_options o on o.id = x.id::uuid
  join protocols t on t.id = o.protocol_id and t.user_id is null
  on conflict do nothing;

  -- 4. Semana propuesta (solo si se pide: la primera vez o si el usuario acepta reemplazarla)
  if coalesce((p->>'replace_calendar')::boolean, false) then
    delete from calendar_blocks where user_id = uid;
    for r in select * from jsonb_array_elements(p->'blocks') loop
      insert into calendar_blocks (user_id, title, block_type, start_time, duration_min, days_of_week, is_screen, sort_order)
      values (uid, r->>'title', r->>'type',
              make_time(((r->>'start')::int) / 60, ((r->>'start')::int) % 60, 0),
              (r->>'duration')::int,
              array(select jsonb_array_elements_text(r->'days')::smallint),
              (r->>'type') in ('trading','analisis','backtesting','formacion','revision'),
              0);
    end loop;
  end if;

  -- 5. Cuenta de trading por defecto y datos del perfil
  if not exists (select 1 from trading_accounts where user_id = uid) then
    insert into trading_accounts (user_id, name, kind) values (uid, 'Cuenta personal', 'personal');
  end if;
  update profiles
     set onboarding_done = true,
         display_name = coalesce(nullif(trim(v_rules->>'name'), ''), display_name)
   where id = uid;

  return v_ver_id;
end;
$$;

revoke all on function public.complete_onboarding(jsonb) from public;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
