# Trading Plan

SaaS de planificación y registro para traders: diagnóstico, plan escrito con tus reglas, calendario de vida, calculadora de riesgo, journal con patrones y revisión semanal.

> Herramienta de planificación y registro. No es asesoramiento financiero. Los CFD conllevan un riesgo elevado de perder dinero.

## Estado

Paso 1 de 8: arquitectura y esquema. Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

- `supabase/migrations/0001_init.sql`: esquema completo con RLS en todas las tablas
- `supabase/seed.sql`: planes, diagnóstico de 6 preguntas y plantillas de protocolo (contenido editable)
- `design/preview.html`: vista previa del sistema de diseño (abrir en el navegador)
