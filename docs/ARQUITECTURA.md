# Trading Plan · Plan de arquitectura (paso 1)

> Estado: **pendiente de tu OK**. No se escribe código de aplicación hasta que lo apruebes.
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
| Framework | **Next.js 15 (App Router) + React + TypeScript** estricto | Server Components, Route Handlers para IA y Stripe |
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
middleware.ts               refresco de sesión + redirecciones de acceso
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
| `assets`, `account_settings` | Activos por usuario (preset US100 / GER40 / personalizado) con valor por punto, lote mínimo y paso **introducidos por el usuario** |
| `checklist_items`, `checklist_runs` | Checklist pre-operación y su historial |
| `journal_entries` | Todos los campos pedidos + tipo `skipped` (no realizada) con motivo. Restricciones: una operación exige dirección, R y cumplimiento; una no realizada exige motivo |
| `journal_summary` (vista) | nº operaciones, cumplimiento %, R acumulado, % ganadoras, R medio, nº no realizadas. `security_invoker` → respeta RLS |
| `weekly_reviews`, `ai_usage` | Revisión semanal y control de consumo de IA por plan |
| Storage `journal` | Bucket privado; ruta `journal/{user_id}/…`, políticas por carpeta |

**Decisión:** enumerados como `text + CHECK` en lugar de `enum` de Postgres, para poder añadir valores sin migraciones complicadas.

---

## 5. Módulos y reglas de negocio

### 5.1 Diagnóstico y onboarding
- Las 6 preguntas se leen de `quiz_questions`/`quiz_options` (ver `seed.sql`, ya redactadas en tono de consejo y **pendientes de tu revisión**).
- Tras cada respuesta: recuadro en dos partes, **Por qué puede pasar** (azul) y **Cómo lo trabaja tu plan** (verde), más el protocolo que se añadirá.
- Al terminar, los protocolos de las opciones elegidas se copian a `protocols` del usuario (`source_id` → plantilla). El usuario puede editarlos, desactivarlos o crear los suyos.
- El aviso de riesgo se muestra y se acepta en el registro (`profiles.disclaimer_accepted_at`) y se repite en el onboarding.

### 5.2 Generador de plan con IA
- Entrada: respuestas del diagnóstico + reglas que el usuario escribe (mercado, horario, setup, gestión). **Si falta una regla, la IA pregunta; no la inventa.**
- Salida: JSON validado con Zod (`secciones`, `horario`, `riesgo`, `checklist`, `protocolos`). Se guarda como nueva `plan_version`.
- Guardarraíles en servidor: *system prompt* con las reglas innegociables + filtro posterior que rechaza y regenera si aparecen órdenes de compra/venta, cifras de rentabilidad prometidas o lenguaje de diagnóstico ("tu problema es…").
- Límite de generaciones por plan (`plans.features`) controlado con `ai_usage`.

### 5.3 Calendario
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
- Los presets US100 / GER40 **solo rellenan el nombre**; los valores de contrato los mete el usuario y se guardan en `assets`.
- Interpreto "límite del plan" como el `max_risk_pct` que el usuario fija en su plan de trading. Si te referías a un límite por nivel de suscripción, se añade a `plans.features`.
- La vista previa (`design/preview.html`) ya incluye esta lógica funcionando.

### 5.5 Journal y patrones
- Formulario con los campos exactos del prompt; las capturas suben a Storage privado.
- Patrones (`lib/domain/patterns.ts`): entre las entradas con `plan_compliance ≠ 'si'`, cualquier `emotion_before` o `main_error` (≠ ninguno) que se repita **2 o más veces** genera un recuadro **"Un patrón, sin juicio"**: observación + consejo práctico ligado a un protocolo de su plan. Textos de consejo en tabla editable; redacción siempre con "puede indicar".

### 5.6 Dashboard y revisión semanal
- Dashboard: resumen del journal, cumplimiento de la semana, próximo bloque del calendario y protocolos activos.
- Revisión semanal: snapshot de estadísticas → la IA **propone** 1–3 ajustes al plan, que el usuario acepta (crea versión `source = 'review'`) o descarta.

### 5.7 Stripe y acceso
- Checkout con `STRIPE_PRICE_CORE` (o `plans.stripe_price_id`), `automatic_tax` activado y prueba de `trial_days` desde `plans`.
- Webhooks: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed` → actualizan `subscriptions`. Firma verificada e idempotencia con `stripe_events`.
- `middleware.ts` + `has_active_access()` protegen la zona `(app)`; sin suscripción → página de precios.
- **IVA:** decidir en Stripe si 14,99 € es precio con impuestos incluidos (`tax_behavior = inclusive`, recomendado para B2C en la UE) o sin ellos. La landing muestra "impuestos calculados en el pago" hasta que lo confirmes.

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

**Franja de cifras reales** (sin valoraciones ni estadísticas inventadas): 6 preguntas · 1 plan versionado · 0 señales · 3 activos en la calculadora.

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

## 8. Decisiones que necesito de ti

1. **OK al esquema y a la arquitectura** para empezar el paso 2.
2. **Paleta**: ¿"Terminal" con azul (propuesta) o mantener el morado del brief?
3. **Nombre de marca y dominio**: he usado "Trading Plan" como provisional.
4. **Proveedor de IA**: propongo Claude (Anthropic). Si prefieres otro, solo cambia `lib/ai/client.ts`.
5. **IVA**: ¿14,99 € con impuestos incluidos?
6. **Duración del trial**: el seed pone 7 días en Core (editable en `plans`).
7. **Adjuntos**: reenvíame el brief maestro, el prototipo HTML y las capturas para contrastar pantallas y textos.

---

## 9. Cómo probar este paso

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

2. Auth, layout y sistema de diseño en Next.js (tokens, cinta, cabecera, menú).
3. Landing, diagnóstico explicativo y onboarding.
4. Generador de plan con IA, protocolos y versiones.
5. Calendario con bloques movibles.
6. Calculadora, checklist y journal con patrones.
7. Dashboard y revisión semanal con IA.
8. Stripe y control de acceso.
