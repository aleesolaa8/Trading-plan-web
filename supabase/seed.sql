-- =====================================================================
-- Contenido inicial editable (diagnóstico + protocolos + planes)
-- Todo esto se puede editar después desde la tabla o el panel admin,
-- sin desplegar. Tono: aconsejar, nunca juzgar. Sin lenguaje clínico.
-- PENDIENTE: revisión humana de todos los textos antes de producción.
-- =====================================================================

-- Planes: arquitectura para 4 niveles, solo Core activo.
-- El precio real se lee de Stripe (STRIPE_PRICE_CORE); price_cents es caché.
insert into public.plans (id, name, is_active, trial_days, features, sort_order) values
  ('free',    'Free',    false, 0, '{"ai_plan_generations":1,"ai_reviews_per_month":0}', 0),
  ('core',    'Core',    true,  7, '{"ai_plan_generations":5,"ai_reviews_per_month":4}', 1),
  ('pro',     'Pro',     false, 7, '{"ai_plan_generations":20,"ai_reviews_per_month":8}', 2),
  ('premium', 'Premium', false, 7, '{"ai_plan_generations":50,"ai_reviews_per_month":31}', 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Plantillas de protocolo (user_id NULL)
-- ---------------------------------------------------------------------
insert into public.protocols (slug, category, title, trigger_text, body, sort_order) values
  ('ventana_fija',        'rutina',      'Ventana fija de mercado',       'Cada día de trading',
   'Opero solo dentro de mi ventana del calendario. Fuera de ella, el gráfico se cierra.', 10),
  ('sesion_corta',        'rutina',      'Sesión corta y enfocada',       'Si tengo menos de una hora',
   'Preparo el análisis la noche anterior y uso la sesión solo para ejecutar lo que ya estaba escrito.', 11),
  ('riesgo_fijo',         'riesgo',      'Riesgo fijo por operación',     'Antes de cada entrada',
   'Calculo el tamaño con la calculadora. Nunca arriesgo más del límite escrito en mi plan.', 20),
  ('riesgo_definir',      'riesgo',      'Definir el riesgo antes de operar', 'Hasta tenerlo escrito',
   'No abro operaciones reales hasta haber fijado un % de riesgo por operación en mi plan.', 21),
  ('pausa_20',            'emociones',   'Pausa de 20 minutos tras una pérdida', 'Después de cerrar en pérdida',
   'Me levanto, bebo agua y no miro el gráfico durante 20 minutos. Luego reviso el checklist antes de volver.', 30),
  ('stop_diario',         'riesgo',      'Límite de pérdida diaria',      'Al llegar a mi pérdida diaria máxima',
   'Cierro la plataforma por hoy. Mañana es otra sesión con la cabeza limpia.', 31),
  ('no_mover_sl',         'trading',     'El stop no se toca en contra',  'Con la operación abierta',
   'El stop loss solo se mueve a favor y solo según la regla escrita en mi plan.', 40),
  ('gestion_escrita',     'trading',     'Gestión escrita de antemano',   'Antes de entrar',
   'Escribo dónde tomo beneficio parcial y cuándo muevo a break-even. Durante la operación solo ejecuto.', 41),
  ('sin_setup_fuera',     'trading',     'Sin setup, no hay operación',   'Cuando el mercado no da mi entrada',
   'Registro “no realizada” en el journal y dedico el tiempo a backtesting o formación.', 50),
  ('desconexion_hora',    'desconexion', 'Hora fija de desconexión',      'A la hora marcada en el calendario',
   'Cierro plataformas y notificaciones. El día de trading termina aquí, haya ido como haya ido.', 60),
  ('energia_check',       'sueno',       'Chequeo de energía antes de operar', 'Al empezar la sesión',
   'Si he dormido mal o estoy agotado, reduzco el riesgo a la mitad o hago solo análisis.', 70),
  ('rutina_sueno',        'sueno',       'Rutina de sueño estable',       'Cada noche',
   'Me acuesto a una hora parecida y dejo las pantallas 30 minutos antes.', 71),
  ('movimiento_diario',   'ejercicio',   'Moverme antes de la pantalla',  'Antes de la sesión',
   'Un paseo o 15 minutos de ejercicio suave antes de sentarme a operar.', 72),
  ('comida_fuera',        'comida',      'Comer lejos del gráfico',       'A la hora de comer',
   'La comida es una pausa real: sin plataforma abierta.', 73)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Preguntas
-- ---------------------------------------------------------------------
insert into public.quiz_questions (slug, position, eyebrow, prompt, helper) values
  ('tiempo_diario', 1, 'Tiempo',     '¿Cuánto tiempo real tienes al día para el trading?',
   'Cuenta el tiempo que puedes dedicar sin quitárselo al descanso ni a tu gente.'),
  ('riesgo',        2, 'Riesgo',     '¿Cuánto arriesgas hoy en cada operación?',
   'No hay respuesta buena o mala: es el punto de partida.'),
  ('tras_perdida',  3, 'Emociones',  '¿Qué sueles hacer justo después de una pérdida?',
   'Piensa en lo que haces de verdad, no en lo que te gustaría hacer.'),
  ('a_favor',       4, 'Gestión',    '¿Qué haces cuando una operación va a tu favor?', null),
  ('sin_setup',     5, 'Paciencia',  '¿Qué haces cuando el mercado no te da tu setup?', null),
  ('energia',       6, 'Energía',    '¿Cómo suele estar tu energía los días que operas?',
   'Sueño, comida y cansancio también operan contigo.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Opciones con "Por qué puede pasar" y "Cómo lo trabaja tu plan"
-- ---------------------------------------------------------------------
with q as (select id, slug from public.quiz_questions),
     p as (select id, slug from public.protocols where user_id is null)
insert into public.quiz_options (question_id, slug, position, label, why_text, plan_text, protocol_id, value)
select q.id, o.slug, o.pos, o.label, o.why, o.plan, p.id, o.val::jsonb
from (values
  -- 1. Tiempo diario
  ('tiempo_diario','menos_1h',1,'Menos de 1 hora',
   'Con poco tiempo es normal querer aprovecharlo al máximo y forzar entradas para “no perder el día”.',
   'Tu plan concentra el análisis la noche anterior y deja la sesión solo para ejecutar. Menos tiempo, más claridad.',
   'sesion_corta','{"minutes":45}'),
  ('tiempo_diario','1_2h',2,'Entre 1 y 2 horas',
   'Es un margen cómodo, pero sin límites claros una hora se convierte en tres sin darte cuenta.',
   'Tu calendario marca una ventana fija de mercado y una hora de cierre que no depende del resultado.',
   'ventana_fija','{"minutes":90}'),
  ('tiempo_diario','mas_2h',3,'Más de 2 horas',
   'Mucho tiempo delante del gráfico puede hacer que veas oportunidades donde solo hay ruido.',
   'Tu plan divide la sesión: ejecución en tu ventana y el resto para backtesting, formación o análisis.',
   'ventana_fija','{"minutes":150}'),

  -- 2. Riesgo
  ('riesgo','fijo_bajo',1,'Un % fijo, 1 % o menos',
   'Tener un número fijo ya es una base sólida: libera la cabeza para ejecutar.',
   'Tu plan lo deja por escrito y la calculadora te da el tamaño exacto en cada operación.',
   'riesgo_fijo','{"risk_pct":1}'),
  ('riesgo','fijo_alto',2,'Un % fijo, más del 1 %',
   'Cuando quieres crecer rápido, subir el riesgo parece el atajo. Suele hacer las rachas malas más pesadas.',
   'Tu plan fija un límite y la calculadora te avisa si lo superas. Tú decides el número; el plan lo protege.',
   'riesgo_fijo','{"risk_pct":2}'),
  ('riesgo','variable',3,'Depende de cómo lo vea',
   'Ajustar el riesgo según la convicción es muy humano, pero la convicción cambia con el humor del día.',
   'Tu plan propone un % fijo que eliges tú. La calculadora hace el resto para que no dependa del momento.',
   'riesgo_fijo','{}'),
  ('riesgo','no_se',4,'No lo tengo claro',
   'Muchas personas empiezan mirando el gráfico antes que el riesgo. Es el orden habitual, no un fallo.',
   'El primer paso de tu plan es definir tu % por operación antes de cualquier operación real.',
   'riesgo_definir','{}'),

  -- 3. Tras una pérdida
  ('tras_perdida','recuperar',1,'Busco recuperarla rápido',
   'Perder activa las ganas de “arreglarlo” cuanto antes. Es una reacción muy común, no un defecto.',
   'Tu plan incluye una pausa de 20 minutos tras cada pérdida y repasar el checklist antes de volver.',
   'pausa_20','{}'),
  ('tras_perdida','subo_riesgo',2,'Subo el tamaño en la siguiente',
   'Después de perder, la siguiente operación puede sentirse como la que lo compensa todo.',
   'Tu plan fija un riesgo que no cambia tras una pérdida y un límite de pérdida diaria para cerrar la sesión.',
   'stop_diario','{}'),
  ('tras_perdida','pausa',3,'Paro y lo reviso',
   'Saber parar es una de las habilidades más valiosas. Merece estar por escrito para los días difíciles.',
   'Tu plan convierte esa pausa en un protocolo fijo, para que no dependa de cómo te sientas ese día.',
   'pausa_20','{}'),
  ('tras_perdida','sigo',4,'Sigo como si nada',
   'Seguir con calma está bien, siempre que la siguiente entrada venga del plan y no de la inercia.',
   'Tu plan añade un límite de pérdida diaria para que el día tenga un final claro.',
   'stop_diario','{}'),

  -- 4. A favor
  ('a_favor','cierro_pronto',1,'Cierro pronto por miedo a que se gire',
   'Ver beneficio abierto genera tensión y cerrar alivia. Es humano querer asegurar.',
   'Tu plan define de antemano dónde tomas beneficio, para que la decisión ya esté tomada antes de entrar.',
   'gestion_escrita','{}'),
  ('a_favor','muevo_sl',2,'Muevo el stop sin una regla clara',
   'Mover el stop da sensación de control, pero sin regla suele depender de los nervios del momento.',
   'Tu plan incluye una regla: el stop solo se mueve a favor y según lo escrito.',
   'no_mover_sl','{}'),
  ('a_favor','dejo_correr',3,'La dejo correr según mi plan',
   'Dejar trabajar la operación requiere paciencia y confianza en lo que has preparado.',
   'Tu plan lo refuerza dejando la gestión escrita para los días en que dudes.',
   'gestion_escrita','{}'),

  -- 5. Sin setup
  ('sin_setup','fuerzo',1,'Acabo entrando igualmente',
   'Después de preparar la sesión, no operar puede sentirse como tiempo perdido.',
   'Tu plan cuenta “no operar” como una sesión cumplida: lo registras en el journal y pasas a backtesting.',
   'sin_setup_fuera','{}'),
  ('sin_setup','miro_mas',2,'Me quedo mirando el gráfico',
   'Quedarse “por si acaso” es habitual. Con el tiempo, el cansancio empuja a entrar.',
   'Tu calendario tiene una hora fija de desconexión. Si no hay setup, se cierra la plataforma.',
   'desconexion_hora','{}'),
  ('sin_setup','me_voy',3,'Cierro y hago otra cosa',
   'Saber irte es señal de que respetas tu proceso.',
   'Tu plan lo deja como protocolo y te propone usar ese tiempo en formación o descanso.',
   'sin_setup_fuera','{}'),

  -- 6. Energía
  ('energia','bien',1,'Bien, descansado/a',
   'Una buena base de descanso hace que todo lo demás sea más fácil.',
   'Tu calendario protege lo que ya funciona: horas de sueño, comidas y movimiento como bloques fijos.',
   'rutina_sueno','{}'),
  ('energia','variable',2,'Depende del día',
   'El trading suele convivir con trabajo, familia y otras cosas. Es lógico que la energía varíe.',
   'Tu plan incluye un chequeo de energía al empezar: si estás bajo, menos riesgo o solo análisis.',
   'energia_check','{}'),
  ('energia','cansado',3,'Suelo operar cansado/a',
   'Operar al final de un día largo es muy frecuente. El cansancio cambia cómo decidimos.',
   'Tu calendario reserva descanso y movimiento antes de la sesión, y tu plan reduce el riesgo si llegas agotado/a.',
   'movimiento_diario','{}')
) as o(q_slug, slug, pos, label, why, plan, proto_slug, val)
join q on q.slug = o.q_slug
left join p on p.slug = o.proto_slug
on conflict (question_id, slug) do nothing;
