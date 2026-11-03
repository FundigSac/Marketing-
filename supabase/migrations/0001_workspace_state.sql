-- FUNDIGSAC Marketing OS: estado compartido del equipo.
-- Un documento JSON ("main") con eventos, tareas, ideas, campañas, métricas, preferencias y registro de envíos.
-- El cron del servidor (service role) lo lee para enviar avisos aunque nadie tenga el navegador abierto.
create table if not exists public.workspace_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.workspace_state enable row level security;

-- Solo usuarios autenticados del equipo. Los permisos por rol (admin, marketing, ventas, visualizador)
-- se aplican en la aplicación; para aislarlos en la base de datos habría que normalizar las tablas.
create policy "equipo lee" on public.workspace_state for select to authenticated using (true);
create policy "equipo escribe" on public.workspace_state for insert to authenticated with check (true);
create policy "equipo actualiza" on public.workspace_state for update to authenticated using (true) with check (true);
