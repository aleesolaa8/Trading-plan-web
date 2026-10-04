# Time to Trade · Plan de arquitectura

> Estado: **aprobado** (paso 1). Paso 2 terminado: auth, layout y sistema de diseño.
> Prioridad: este documento sigue el *Prompt v2*; el brief maestro, el prototipo HTML y las capturas de Gotoyou **no llegaron adjuntos** y hay que revisarlos contra este plan cuando estén.

---

## 1. Principios que guían todas las decisiones

1. **Proceso, no señales.** La app nunca dice compra/vende, no vende estrategias y no promete rentabilidad. La IA ordena y redacta solo lo que el usuario da.
2. **Nada cableado.** Precio (Stripe / tabla `plans`), textos del diagnóstico, protocolos y valores de contrato viven en datos, no en el código.
3. **Privacidad por defecto.** RLS en todas las tablas; cada fila lleva `user_id` y solo su dueño la lee o escribe.
4. **Aconsejar, no juzgar.** Toda la copia y la IA usan "puede indicar", nunca "tu problema es". Sin lenguaje clínico.
5. **Móvil primero, accesible.** Foco visible, contraste AA, `prefers-reduced-motion`, alternativas sin arrastre.

---

## 2. Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React + TypeScript** estricto | Server Components, Route Handlers para IA y Stripe |
| Estilos | **CSS Modules + tokens CSS** (`src/styles/tokens.css`) | Control total del diseño, cero dependencias de UI genéricas |
| Datos | **Supabase**: Postgres, Auth (email + magic link), Storage | RLS nativo |
| Cliente BD | `@supabase/ssr` (cookies) en servidor y navegador | Sesión segura en SSR |
| Validación | **Zod** en todos los formularios y respuestas de IA | Mismos esquemas cliente/servidor |
| Pagos | **Stripe** Checkout + Customer Portal + webhooks | Stripe Tax para IVA |
| IA | **API de Anthropic (Claude), solo en servidor** (`server-only`) | Salida estructurada con esquema JSON y guardarraíles |
| Calendario | **dnd-kit** (sensores de puntero + teclado) + flechas | Arrastre accesible; flechas para móvil |
| Gráficos | SVG propio ligero (curva de R, barras de cumplimiento) | Sin librerías pesadas |
| Tests | Vitest (lógica pura: calculadora, patrones, solapes) + Playwright (flujos) | |

---

## 3. Estructura de carpetas

```
src/
  app/
    (marketing)/            landing, precios, legal
      page.tsx
      legal/{privacidad,terminos,riesgo}/page.tsx
    (auth)/                 login, registro, callback
    (app)/                  zona privada (requiere sesión + suscripción)
      onboarding/           diagnóstico de 6 preguntas
      plan/                 plan actual, versiones, protocolos
      calendario/
      calculadora/
      checklist/
      journal/              lista, nueva entrada, patrones
      dashboard/
      revision/             revisión semanal
      ajustes/              cuenta, activos, tema, facturación
    admin/contenido/        edición de preguntas, opciones y protocolos (rol admin)
    api/
      ai/plan/route.ts      genera/reescribe el plan (servidor)
      ai/review/route.ts    revisión semanal
      stripe/checkout/route.ts
      stripe/portal/route.ts
      stripe/webhook/route.ts
  components/
    ui/                     Button, Card, Pill, Field, Tabs, Dialog, Toast
    layout/                 Header, FullscreenMenu, Ticker, StatsBand, Footer, Disclaimer
  lib/
    supabase/{server,client,middleware}.ts
    stripe.ts
    ai/{client,prompts,guardrails,schemas}.ts
    domain/
      risk.ts               cálculo de lotes (puro, testeado)
      patterns.ts           detección de patrones del journal (puro, testeado)
      calendar.ts           solapes y horas seguidas de pantalla (puro, testeado)
      access.ts             control de acceso por suscripción
  styles/tokens.css
src/proxy.ts                refresco de sesión + redirecciones (en Next 16 "middleware" pasa a llamarse "proxy")
supabase/
  migrations/0001_init.sql  esquema + RLS (incluido en este paso)
  seed.sql                  planes, diagnóstico y protocolos (incluido)
design/preview.html         vista previa del sistema de diseño (incluida)
```

---

## 4. Modelo de datos (resumen)

El SQL completo está en `supabase/migrations/0001_init.sql`. Validado en Postgres 16 con un *stub* de `auth`/`storage`, incluida una prueba de aislamiento RLS entre dos usuarios.

| Tabla | Para qué |
|---|---|
| `profiles` | Nombre, rol (`user`/`admin`), zona horaria, tema, onboarding, aceptación del aviso de riesgo |
| `plans` | Free / Core / Pro / Premium. Solo Core activo. `stripe_price_id`, `trial_days`, `features` (límites) |
| `stripe_customers`, `subscriptions`, `stripe_events` | Estado de facturación; solo el webhook escribe (service role). `stripe_events` garantiza idempotencia |
| `quiz_questions`, `quiz_options` | Diagnóstico editable: pregunta, opciones, **"Por qué puede pasar"** (`why_text`), **"Cómo lo trabaja tu plan"** (`plan_text`) y protocolo que genera |
| `quiz_responses` | Respuestas del usuario, con `attempt` para repetir el diagnóstico |
| `protocols` | `user_id NULL` = plantilla editable por admin; con `user_id` = protocolo del usuario (copiado de plantilla o propio). Categorías de trading **y de vida**: sueño, rutina, comida, ejercicio, pausas, desconexión |
| `trading_plans`, `plan_versions` | Un plan por usuario con historial de versiones (`source`: ai / user / review). `inputs` = reglas que dio el usuario; `max_risk_pct` = límite que usa la calculadora |
| `calendar_blocks` | Hora libre, duración, tipo, días de repetición, contenido flexible (Backtesting / Formación / Análisis), `is_screen` para el aviso de horas de pantalla |
| `assets`, `account_settings` | Mercados del usuario (cualquiera: catálogo o propio) con valor por punto/pip, lote mínimo y paso **introducidos por el usuario** |
| `checklist_items`, `checklist_runs` | Checklist pre-operación y su historial |
| `journal_entries` | Todos los campos pedidos + tipo `skipped` (no realizada) con motivo. Restricciones: una operación exige dirección, R y cumplimiento; una no realizada exige motivo |
| `journal_summary` (vista) | nº operaciones, cumplimiento %, R acumulado, % ganadoras, R medio, nº no realizadas. `security_invoker` → respeta RLS |
| `weekly_reviews`, `ai_usage` | Revisión semanal y control de consumo de IA por plan |
| Storage `journal` | Bucket privado; ruta `journal/{user_id}/…`, políticas por carpeta |

**Decisión:** enumerados como `text + CHECK` en lugar de `enum` de Postgres, para poder añadir valores sin migraciones complicadas.

---

## 5. Módulos y reglas de negocio

### 5.1 Diagnóstico y onboarding
- **7 preguntas** (decisión del cliente: sirve para todos los niveles) que se leen de `quiz_questions`/`quiz_options` (ver `seed.sql`):
  0. Nivel: empezando / en desarrollo / consolidado / profesional.
  1. Horas al día: hasta 2 h / de 3 a 6 h / de 6 a 10 h.
  2–6. Riesgo, reacción tras pérdida, operación a favor, sin setup, energía.
- Textos en tono de consejo y **pendientes de revisión humana**.
- Tras cada respuesta: recuadro en dos partes, **Por qué puede pasar** (azul) y **Cómo lo trabaja tu plan** (verde), más el protocolo que se añadirá.
- Al terminar, los protocolos de las opciones elegidas se copian a `protocols` del usuario (`source_id` → plantilla). El usuario puede editarlos, desactivarlos o crear los suyos.
- El aviso de riesgo se muestra y se acepta en el registro (`profiles.disclaimer_accepted_at`) y se repite en el onboarding.

### 5.2 Generador de plan con IA
- Entrada: respuestas del diagnóstico + reglas que el usuario escribe (mercado, horario, setup, gestión). **Si falta una regla, la IA pregunta; no la inventa.**
- Salida: JSON validado con Zod (`secciones`, `horario`, `riesgo`, `checklist`, `protocolos`). Se guarda como nueva `plan_version`.
- Guardarraíles en servidor: *system prompt* con las reglas innegociables + filtro posterior que rechaza y regenera si aparecen órdenes de compra/venta, cifras de rentabilidad prometidas o lenguaje de diagnóstico ("tu problema es…").
- Límite de generaciones por plan (`plans.features`) controlado con `ai_usage`.

### 5.3 Calendario (apartado propio: "Planificación")
- Sección independiente del plan. Al crear el plan se **propone una semana** según nivel, horas y sesiones (hasta dos: p. ej. Londres y Nueva York): movimiento, análisis, sesiones partidas con pausa activa cada 90 min en jornadas largas, comida lejos de la pantalla, revisión, backtesting/formación según nivel, desconexión, sueño, revisión semanal el sábado y preparación el domingo.
- El usuario la ajusta a su gusto; el apartado "Mi día" del plan **lee del calendario**, así siempre coinciden.
- Tipos de bloque: trading, análisis, backtesting, formación, revisión, comida, ejercicio, sueño, pausa, personal, desconexión, otro.
- Bloques con hora libre, duración, tipo, días de repetición y contenido flexible.
- Arrastrar y soltar (dnd-kit) en escritorio; **flechas ↑ ↓ ← →** en cada bloque para móvil y teclado (paso de 15 min / 1 día).
- Avisos no bloqueantes: solapes entre bloques y más de **N horas seguidas de pantalla** (N configurable, por defecto 3 h) sumando bloques `is_screen` contiguos.

### 5.4 Calculadora de riesgo
```
riesgo_€   = capital × riesgo_% / 100
lotes_raw  = riesgo_€ / (stop_puntos × valor_por_punto)
lotes      = floor(lotes_raw / paso) × paso        ← siempre hacia abajo
avisos:    lotes < lote_mínimo     → "no alcanza el lote mínimo"
           riesgo_% > max_risk_pct → "supera el límite de tu plan"
```
- **Cualquier mercado.** La interfaz ofrece un catálogo buscable (índices, forex, materias primas, cripto, acciones, futuros) y permite añadir uno propio. El catálogo **solo rellena el nombre**; valor por punto/pip, lote mínimo y paso los mete el usuario y se guardan por mercado en `assets`.
- **Confirmado:** el "límite del plan" es el `max_risk_pct` que cada usuario fija en su propio plan. La calculadora usa solo los datos que él introduce.
- La vista previa (`design/preview.html`) ya incluye esta lógica funcionando.

### 5.5 Journal y patrones
- Formulario con los campos exactos del prompt; las capturas suben a Storage privado.
- Patrones (`lib/domain/patterns.ts`): entre las entradas con `plan_compliance ≠ 'si'`, cualquier `emotion_before` o `main_error` (≠ ninguno) que se repita **2 o más veces** genera un recuadro **"Un patrón, sin juicio"**: observación + consejo práctico ligado a un protocolo de su plan. Textos de consejo en tabla editable; redacción siempre con "puede indicar".

### 5.6 Dashboard y revisión semanal
- Dashboard: resumen del journal, cumplimiento de la semana, próximo bloque del calendario y protocolos activos.
- Revisión semanal: snapshot de estadísticas → la IA **propone** 1–3 ajustes al plan, que el usuario acepta (crea versión `source = 'review'`) o descarta.

### 5.7 Stripe y acceso
- Checkout con `STRIPE_PRICE_CORE` (o `plans.stripe_price_id`), `automatic_tax` activado y prueba de `trial_days` desde `plans`.
- **Precios decididos: Core 14,99 € + IVA y Pro 24,99 € + IVA al mes** (`STRIPE_PRICE_CORE`, `STRIPE_PRICE_PRO`). En Stripe el precio se crea con `tax_behavior = exclusive`; Stripe Tax suma el IVA del país del cliente en el pago.
- Webhooks: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed` → actualizan `subscriptions`. Firma verificada e idempotencia con `stripe_events`.
- `middleware.ts` + `has_active_access()` protegen la zona `(app)`; sin suscripción → página de precios.

---

## 6. Sistema de diseño: propuesta de paleta **"Terminal"**

Me pediste un color más adecuado al trading. Mantengo la **estructura** de Gotoyou (tipografía, radios, cinta, franja de cifras) y cambio la **paleta**, que pasa de negro neutro a la de una terminal de trading:

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#05070a` | `#f5f7f6` | Fondo (negro con tinte frío, como una plataforma) |
| `--card` / `--card-2` | `#0d1218` / `#121922` | `#ffffff` / `#f3f6f5` | Tarjetas con degradado sutil |
| `--line` | `#1d2631` | `#e1e7e4` | Bordes |
| `--text` / `--muted` | `#eef2f6` / `#8a95a3` | `#0a1015` / `#56616b` | Texto |
| `--green` | `#1fe08c` | `#08995a` | **Alcista**: marca, CTA, resaltados |
| `--grad` | 135°: `#12d27f → #6ceaa9 → #d2f8c4` | igual | CTA principal y franja de cifras |
| `--blue` | `#4d8dff` | `#2f6fe8` | Sustituye al morado: puntos de la cinta, pestaña activa, recuadros de consejo ("Por qué puede pasar", patrones). El azul es el color de "información" de las plataformas |
| `--red` | `#ff5468` | `#d92f45` | **Bajista**: solo stop, pérdidas y avisos de riesgo |
| `--amber` | `#ffb547` | `#b86e00` | Avisos no bloqueantes (lote mínimo, solapes) |

**Textura:** rejilla de gráfico de 56 px que se desvanece hacia abajo + resplandores radiales verde y azul.

**Botones** (lo más llamativo de la página): degradado verde con halo luminoso, reflejo que recorre el botón cada ~4 s, flecha que avanza al pasar el ratón, 56–64 px de alto. El reflejo se desactiva con `prefers-reduced-motion`.

**Tipografía:** Inter 400/600/800/900; titulares 900, `letter-spacing: -0.04em`, interlineado 0.98; etiquetas en mayúsculas con 0.14–0.18em; números tabulares.

**Componentes:** tarjetas radio 28 px, botones 14 px, píldoras, listas con flecha verde, cabecera fija con desenfoque al hacer scroll, menú hamburguesa a pantalla completa con animación escalonada, cinta en bucle (`translateX(-50%)`, contenido duplicado, pausa al pasar el ratón).

**Franja de cifras reales** (sin valoraciones ni estadísticas inventadas): 6 preguntas · 1 plan versionado · 0 señales · copiloto 24 h.

Si prefieres mantener el morado `#9b83f2` del brief para los detalles, es cambiar un token.

---

## 7. Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # solo servidor (webhook, ai_usage)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_CORE=                  # price_xxx de 14,99 €/mes
ANTHROPIC_API_KEY=                  # solo servidor
NEXT_PUBLIC_SITE_URL=
```

---

## 8. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Arquitectura y esquema | Aprobados |
| Paleta | "Terminal" (verde / azul / rojo solo para riesgo) |
| Marca | **Time to Trade** |
| Precio | **Core 14,99 € + IVA** y **Pro 24,99 € + IVA** al mes (Stripe `tax_behavior = exclusive`) |
| Límite de riesgo | Lo fija cada usuario en su plan |
| IA | **Claude (Anthropic)**, siempre desde el servidor |
| Trial | 7 días en Core (editable en `plans`) |

Pendiente: reenviar el brief maestro, el prototipo HTML y las capturas de Gotoyou.

## 7 bis. Planes y precios

Principio: **Core es completo** para operar con un plan. Pro suma lo que más cuesta (IA intensiva) y lo que piden quienes operan muchas horas, con fondeo o con varias cuentas.

| | **Core** | **Pro** |
|---|---|---|
| Mensual | 14,99 € + IVA | 24,99 € + IVA |
| Anual (2 meses gratis) | 149,90 € + IVA (≈ 12,49 €/mes) | 249,90 € + IVA (≈ 20,83 €/mes) |
| Diagnóstico, plan con tus reglas y versiones | Sí (3 regeneraciones con IA/mes) | Sí (20/mes) |
| Protocolos, calendario, calculadora, checklist | Sí | Sí |
| Journal ilimitado + patrones sin juicio | Sí | Sí |
| Resumen semanal de números | Sí | Sí |
| Recordatorios de sesión y de límite diario | Sí | Sí |
| Exportar tus datos (CSV) | Sí | Sí |
| Copiloto 24 h | 40 mensajes/mes | Sin límite (uso razonable: 1.500/mes) |
| Revisión semanal escrita por IA con propuestas al plan | — | Sí |
| IA que revisa capturas contra el setup escrito (sin señales) | — | Sí |
| Estadísticas avanzadas (mercado, hora, día, emoción, rachas) | — | Sí |
| Cuentas de trading (personal, fondeo, demo) + resumen conjunto | 1 | Hasta 3 |
| Modo fondeo (pérdida diaria, caída máxima, objetivo, avisos) | — | Sí |
| Informe mensual en PDF | — | Sí |

- **Cambios respecto a la primera propuesta:** recordatorios y exportar CSV pasan a Core (son baratos, ayudan a cumplir el plan y exportar los propios datos es un derecho del usuario); el copiloto de Core sube de 30 a 40 mensajes; Pro gana el informe mensual en PDF.
- 7 días de prueba con todo Pro; al terminar el usuario elige plan y, si no elige, no se cobra nada. Sin permanencia; cambio de plan con prorrateo desde el Customer Portal.
- Los límites viven en `plans.features` (JSON) y se cambian sin desplegar. Precios anuales: `STRIPE_PRICE_CORE_ANNUAL`, `STRIPE_PRICE_PRO_ANNUAL`; `subscriptions.billing_interval` guarda mes o año.
- Al agotar los mensajes del copiloto en Core, aviso amable con opción de pasar a Pro; nunca se bloquea el resto de la app.
- Cuentas: tabla `trading_accounts` (tipo personal/fondeo/demo, capital y reglas de la prueba en %). Cada entrada del journal apunta a su cuenta.

## 7 ter. Alojamiento y puesta en producción

**Formato:** plataforma web (no una landing) que funciona en el navegador del ordenador y del móvil, e **instalable como app** (PWA: icono en el escritorio o en la pantalla de inicio, sin pasar por las tiendas). Una app nativa para iOS/Android puede añadirse más adelante si hace falta; no es necesaria para empezar.

| Pieza | Servicio | Por qué | Coste orientativo |
|---|---|---|---|
| Web y servidor | **Vercel** (plan Pro) | Hecho por los creadores de Next.js; escala solo con las visitas, CDN mundial, despliegue al subir cambios | ~20 $/mes |
| Base de datos, usuarios y archivos | **Supabase** (plan Pro, región UE) | Postgres gestionado, copias diarias, datos en Europa (RGPD) | ~25 $/mes + uso |
| Pagos e IVA | **Stripe** + Stripe Tax | Cobros, facturas, IVA por país | Comisión por cobro, sin cuota fija |
| IA | **API de Anthropic** | Plan, revisiones y copiloto | Por uso; controlado por los límites de cada plan |
| Dominio y correo | Registrador + correo transaccional (Resend o similar) | timetotrade.com o similar; emails de acceso y recordatorios | ~15 €/año + ~0–20 $/mes |

- **Capacidad:** esta combinación aguanta de cero a decenas de miles de usuarios sin cambiar la arquitectura; se paga más solo si hay más uso.
- **Fiabilidad:** monitorización de errores (Sentry), copias diarias de la base de datos y entornos separados de pruebas y producción.
- **Lo que hace falta del cliente:** crear las cuentas de Vercel, Supabase, Stripe y Anthropic a su nombre (son suyas y de su empresa) y comprar el dominio. Se le guiará paso a paso.

## 8 bis. Copiloto 24 h (chat con IA)

Un **botón flotante** visible en toda la app (como la atención al cliente de una web) que abre el chat. Acompaña el **proceso**, sobre todo en momentos de agobio. Conoce el plan, el calendario de hoy y el resumen del journal del usuario. Se construye en el paso 4 y comparte guardarraíles con el generador del plan.

**Qué hace**
- Conoce el plan, los protocolos, el checklist y el journal del usuario (solo los suyos).
- Ante "no sé si entrar": no decide por él. Le devuelve a su plan: "¿Cumple tu checklist? ¿Estás dentro de tu ventana? ¿Cómo estás de energía?". Si duda, le recuerda que no operar también es cumplir.
- Ante agobio o frustración: propone su protocolo (pausa de 20 min, respiración, cerrar la plataforma), escucha y valida sin juzgar.
- Tras la conversación puede sugerir una nota para el journal.

**Qué no hace nunca**
- Decir compra, vende, entra o sal, ni opinar sobre el mercado.
- Prometer rentabilidad.
- Hacer terapia ni diagnosticar. Es apoyo y hábitos, no un psicólogo.
- **Sin avisos fijos sobre crisis** (decisión del cliente: dan mala imagen). Solo si el usuario escribe algo que indique riesgo para su vida, el chat muestra de forma discreta el 024 y el 112 dentro de la conversación.

**Técnica**
- Tablas `chat_threads` y `chat_messages` con RLS (solo el dueño), ya incluidas en el esquema.
- Respuestas en streaming desde `app/api/ai/chat/route.ts`. La clave de la IA nunca llega al navegador.
- Filtro de salida que bloquea órdenes de compra/venta y lenguaje clínico, y detector de crisis antes de llamar al modelo.
- Límite de mensajes al mes por plan (`plans.features.chat_messages_per_month`) para controlar costes.
- Aviso visible en el chat: "Copiloto de proceso. No es asesoramiento financiero ni psicológico."

## 9. Cómo probar el paso 1

**Vista previa de diseño**: abre `design/preview.html` en el navegador (móvil y escritorio). Prueba el menú, el tema claro/oscuro, una respuesta del diagnóstico y la calculadora (cambia el riesgo por encima del 1 % o sube el stop para ver los avisos).

**Esquema en Supabase**
```bash
supabase init            # si aún no existe config
supabase start           # Postgres local en Docker
supabase db reset        # aplica migrations/0001_init.sql + seed.sql
```
Comprobaciones rápidas en el SQL editor:
```sql
select count(*) from quiz_questions;   -- 6
select count(*) from quiz_options;     -- 20, todas con protocolo
select count(*) from protocols;        -- 14 plantillas
```
Para comprobar RLS: crea dos usuarios, inserta una entrada de journal con el primero y verifica que el segundo ve 0 filas.

## 10. Qué falta (siguientes pasos)

2. ~~Auth, layout y sistema de diseño~~ **hecho**.
3. Landing, diagnóstico explicativo y onboarding.
4. Generador de plan con IA, protocolos, versiones y **copiloto 24 h**.
5. Calendario con bloques movibles.
6. Calculadora, checklist y journal con patrones.
7. Dashboard y revisión semanal con IA.
8. Stripe y control de acceso.
