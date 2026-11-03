# FUNDIGSAC Marketing

Dashboard para Fabrizio (marketing) con 4 secciones: **Inicio · Calendario · Ideas con IA · Mis videos**.

```bash
npm install
cp .env.example .env.local   # completa las claves que tengas
npm run dev
npm test
```

- Los datos del sistema anterior (28 pantallas) se migran solos al abrir la app: lo que no se muestra (campañas, métricas, consultas, entregables) queda guardado en `legacy` y se incluye en el respaldo (campana → Recordatorios → Descargar).
- Sin Supabase la app corre en **modo local** (datos y archivos en el navegador).
- Sin `ANTHROPIC_API_KEY` las ideas salen de plantillas marcadas como tales.
- Correo (Resend), push (VAPID) y el servicio diario (`/api/cron/reminders`) requieren sus credenciales; ver `.env.example`.
- Rutas antiguas redirigen a la sección equivalente (`next.config.ts`).
