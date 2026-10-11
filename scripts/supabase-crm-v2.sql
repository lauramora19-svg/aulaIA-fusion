-- ═══════════════════════════════════════════════════════════════
-- AulaIA · CRM v2 — grupos compartidos, apellidos, enlace con la
-- Agenda docente y modelos del colegio.
-- NO borra datos. Se puede ejecutar más de una vez.
-- ═══════════════════════════════════════════════════════════════

-- 1. GRUPOS (1º A, 2º B...). Una clase = grupo + asignatura.
create table if not exists grupos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null,
  etapa       text,
  curso       text,
  comunidad   text,
  created_at  timestamptz default now()
);
create index if not exists idx_grupos_user on grupos(user_id);

alter table clases  add column if not exists grupo_id uuid references grupos(id) on delete set null;
alter table clases  add column if not exists agenda_class_id text;

alter table alumnos add column if not exists grupo_id uuid references grupos(id) on delete cascade;
alter table alumnos add column if not exists apellidos text default '';
alter table alumnos add column if not exists agenda_student_id text;
alter table alumnos add column if not exists agenda_snap jsonb;
alter table alumnos add column if not exists agenda_off boolean default false;
create index if not exists idx_alumnos_grupo on alumnos(grupo_id);

-- El alumnado ya no se borra al borrar una asignatura: pertenece al grupo.
alter table alumnos alter column clase_id drop not null;
alter table alumnos drop constraint if exists alumnos_clase_id_fkey;
alter table alumnos add constraint alumnos_clase_id_fkey
  foreign key (clase_id) references clases(id) on delete set null;

-- 2. MIGRACIÓN: cada clase existente pasa a tener su grupo
--    (clases con el mismo nombre de grupo comparten grupo).
do $$
declare c record; g uuid;
begin
  for c in select * from clases where grupo_id is null order by created_at loop
    select id into g from grupos
      where user_id = c.user_id and lower(trim(nombre)) = lower(trim(c.nombre)) limit 1;
    if g is null then
      insert into grupos(user_id, nombre, etapa, curso, comunidad)
      values (c.user_id, c.nombre, c.etapa, c.curso, c.comunidad) returning id into g;
    end if;
    update clases  set grupo_id = g where id = c.id;
    update alumnos set grupo_id = g where clase_id = c.id and grupo_id is null;
  end loop;
end $$;

-- Separar "Paula A. D." en nombre "Paula" y apellidos "A. D."
update alumnos
   set apellidos = trim(substring(nombre from position(' ' in nombre) + 1)),
       nombre    = split_part(nombre, ' ', 1)
 where coalesce(apellidos, '') = '' and position(' ' in trim(nombre)) > 0;

-- 3. MODELOS DEL COLEGIO (actas, informes...)
create table if not exists plantillas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre        text not null,
  tipo          text default 'informe',   -- informe | acta | otro
  archivo_path  text,
  mime          text,
  texto         text,                     -- texto extraído (Word)
  created_at    timestamptz default now()
);

-- 4. AGENDA: sesiones programadas desde AulaIA
alter table agenda_eventos add column if not exists agenda_ref jsonb;  -- { week, key } en la Agenda docente

-- 5. SEGURIDAD
do $$
declare t text;
begin
  foreach t in array array['grupos','plantillas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "propios_%s" on %I', t, t);
    execute format('create policy "propios_%s" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- 6. ARCHIVOS de los modelos (privados, cada docente en su carpeta)
insert into storage.buckets (id, name, public) values ('modelos', 'modelos', false)
on conflict (id) do nothing;
drop policy if exists "modelos_ver" on storage.objects;
drop policy if exists "modelos_subir" on storage.objects;
drop policy if exists "modelos_borrar" on storage.objects;
create policy "modelos_ver" on storage.objects for select
  using (bucket_id = 'modelos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "modelos_subir" on storage.objects for insert
  with check (bucket_id = 'modelos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "modelos_borrar" on storage.objects for delete
  using (bucket_id = 'modelos' and (storage.foldername(name))[1] = auth.uid()::text);
