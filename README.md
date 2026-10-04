# Time to Trade

SaaS de planificación y registro para traders: diagnóstico, plan escrito con tus reglas, calendario de vida, calculadora de riesgo, journal con patrones y revisión semanal.

> Herramienta de planificación y registro. No es asesoramiento financiero. Los CFD conllevan un riesgo elevado de perder dinero.

## Estado

| Paso | Estado |
|---|---|
| 1. Arquitectura y esquema SQL | Hecho · [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) |
| 2. Auth, layout y sistema de diseño | Hecho |
| 3. Landing, diagnóstico y onboarding | Hecho |
| 4. Plan con IA, protocolos, versiones y copiloto | Hecho |
| 5. Calendario con bloques movibles | Hecho |
| 6. Calculadora, checklist, journal con patrones, cuentas y fondeo | Hecho |
| 7. Panel de inicio, revisión semanal con IA e informe mensual | Hecho |
| 8. Plan Free, Stripe (mensual y anual) y control de acceso | Hecho |

## Arrancar en local

Necesitas Node 20.9+ y [Supabase CLI](https://supabase.com/docs/guides/cli) con Docker.

```bash
npm install
cp .env.example .env.local
supabase start            # muestra la URL y la anon key: cópialas a .env.local
supabase db reset         # aplica supabase/migrations + supabase/seed.sql
npm run dev               # http://localhost:3000
```

Para el copiloto y la redacción del plan añade `ANTHROPIC_API_KEY` a `.env.local` (opcional `ANTHROPIC_MODEL` para cambiar de modelo). Sin clave, la app funciona y el copiloto muestra que se activará pronto.

En local, Supabase confirma los emails automáticamente. Los correos (recuperar contraseña) se ven en el buzón de pruebas que indica `supabase start`.

## Pagos con Stripe (puesta en marcha)

1. En Stripe, crea dos productos (Core y Pro) con cuatro precios recurrentes en EUR, con impuesto **exclusivo** (el IVA se suma):
   Core 14,99 €/mes y 149,90 €/año · Pro 24,99 €/mes y 249,90 €/año. Copia los `price_…` a `STRIPE_PRICE_*`.
2. Activa **Stripe Tax** (IVA automático) y, en *Métodos de pago*, tarjeta, PayPal, Apple Pay y Google Pay.
3. Configura el **portal de cliente**: permitir cambiar entre los 4 precios, actualizar la tarjeta, ver facturas y cancelar al final del periodo.
4. Crea un webhook a `https://TU-DOMINIO/api/stripe/webhook` con los eventos `checkout.session.completed` y `customer.subscription.*`. Copia el secreto a `STRIPE_WEBHOOK_SECRET`.
5. Añade `SUPABASE_SERVICE_ROLE_KEY` (solo servidor): el webhook la usa para guardar las suscripciones.

Sin estas variables la web funciona: el registro da 7 días de Pro y después Free, y el botón de pago avisa de que los pagos llegan pronto.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Estructura

- `src/styles/globals.css`: sistema de diseño (paleta Terminal, tipografía, botones, formularios)
- `src/components/layout`: cabecera fija con menú a pantalla completa, cinta en bucle, franja de cifras, pie con aviso legal
- `src/components/app`: estructura del panel privado (menú lateral en escritorio, barra inferior en móvil)
- `src/app/(auth)`: registro con aceptación del aviso de riesgo, entrada, recuperar y nueva contraseña
- `src/app/(marketing)/page.tsx` + `src/components/landing`: portada (precios y diagnóstico leídos de la base de datos)
- `src/app/panel/diagnostico`: diagnóstico de 7 preguntas, reglas y creación del plan
- `src/app/panel/plan`: plan, checklist, protocolos editables y "Mi día"
- `src/lib/domain`: lógica pura y probada (reglas, checklist, semana propuesta, mercados, horas)
- `src/app/panel`: zona privada protegida por sesión
- `src/proxy.ts`: refresca la sesión y protege `/panel`
- `supabase/`: esquema con RLS y contenido editable del diagnóstico
- `design/preview.html`: vista previa de la landing
- `design/demo.html`: demo usable (diagnóstico, plan, calendario, calculadora, journal y copiloto flotante con IA)
