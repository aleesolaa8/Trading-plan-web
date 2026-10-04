# Time to Trade

SaaS de planificación y registro para traders: diagnóstico, plan escrito con tus reglas, calendario de vida, calculadora de riesgo, journal con patrones y revisión semanal.

> Herramienta de planificación y registro. No es asesoramiento financiero. Los CFD conllevan un riesgo elevado de perder dinero.

## Estado

| Paso | Estado |
|---|---|
| 1. Arquitectura y esquema SQL | Hecho · [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) |
| 2. Auth, layout y sistema de diseño | Hecho |
| 3. Landing, diagnóstico y onboarding | Siguiente |
| 4–8 | Pendientes |

## Arrancar en local

Necesitas Node 20.9+ y [Supabase CLI](https://supabase.com/docs/guides/cli) con Docker.

```bash
npm install
cp .env.example .env.local
supabase start            # muestra la URL y la anon key: cópialas a .env.local
supabase db reset         # aplica supabase/migrations + supabase/seed.sql
npm run dev               # http://localhost:3000
```

En local, Supabase confirma los emails automáticamente. Los correos (recuperar contraseña) se ven en el buzón de pruebas que indica `supabase start`.

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
- `src/app/panel`: zona privada protegida por sesión
- `src/proxy.ts`: refresca la sesión y protege `/panel`
- `supabase/`: esquema con RLS y contenido editable del diagnóstico
- `design/preview.html`: vista previa de la landing
- `design/demo.html`: demo usable (diagnóstico, plan, calendario, calculadora, journal y copiloto flotante con IA)
