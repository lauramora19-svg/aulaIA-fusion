-- AulaIA · Resúmenes de las sesiones de evaluación de cada grupo (v9)
-- Uno por evaluación (inicial, 1ª, 2ª, 3ª, final). La IA tiene en cuenta los
-- más recientes al generar para ese grupo. Sin nombres de alumnos: solo iniciales.
-- Se puede ejecutar más de una vez.

create table if not exists grupo_evaluaciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id    uuid not null references grupos(id) on delete cascade,
  periodo     text not null,
  resumen     text not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_grupo_eval on grupo_evaluaciones (grupo_id, created_at desc);
alter table grupo_evaluaciones enable row level security;
drop policy if exists "evaluaciones: las mias" on grupo_evaluaciones;
create policy "evaluaciones: las mias" on grupo_evaluaciones for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

select 'evaluaciones de grupo listo' as estado;
