-- ═══════════════════════════════════════════════════════════════
-- AulaIA · MÓDULO CRM (clases, alumnado, seguimiento y agenda)
-- Ejecutar en Supabase → SQL Editor → New query → pegar → Run
-- NO borra nada: solo crea tablas nuevas y añade columnas opcionales.
-- Se puede ejecutar más de una vez sin problemas.
-- ═══════════════════════════════════════════════════════════════

-- 1. CLASES ─────────────────────────────────────────────────────
create table if not exists clases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null,            -- "1º A"
  etapa       text,                     -- infantil | primaria | eso | bach | fp
  curso       text,                     -- "1º Primaria"
  area        text,                     -- "Lengua y Literatura"
  comunidad   text,
  color       text default '#f97316',
  created_at  timestamptz default now()
);
create index if not exists idx_clases_user on clases(user_id);

-- 2. ALUMNADO ───────────────────────────────────────────────────
create table if not exists alumnos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clase_id    uuid not null references clases(id) on delete cascade,
  nombre      text not null,            -- Nombre + iniciales: "Paula A. D."
  tiene_nee   boolean default false,
  perfil_nee  jsonb default '{}'::jsonb, -- { necesidades:[], medidas:"", apoyos:"" }
  notas       text,
  created_at  timestamptz default now()
);
create index if not exists idx_alumnos_clase on alumnos(clase_id);

-- 3. SUBGRUPOS ──────────────────────────────────────────────────
create table if not exists subgrupos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clase_id    uuid not null references clases(id) on delete cascade,
  nombre      text not null,
  created_at  timestamptz default now()
);
create table if not exists subgrupo_alumnos (
  subgrupo_id uuid references subgrupos(id) on delete cascade,
  alumno_id   uuid references alumnos(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (subgrupo_id, alumno_id)
);

-- 4. SEGUIMIENTO DEL ALUMNO ─────────────────────────────────────
create table if not exists seguimiento (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alumno_id   uuid not null references alumnos(id) on delete cascade,
  fecha       date default current_date,
  tipo        text default 'observacion', -- observacion | logro | dificultad
  texto       text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_seguimiento_alumno on seguimiento(alumno_id);

-- 5. AGENDA ─────────────────────────────────────────────────────
create table if not exists agenda_eventos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clase_id      uuid references clases(id) on delete cascade,
  alumno_id     uuid references alumnos(id) on delete set null,
  programacion_id uuid references programaciones(id) on delete set null,
  tipo          text default 'sesion',  -- sesion | reunion_familia | coordinacion | revision_aci | otro
  titulo        text not null,
  inicio        timestamptz not null,
  fin           timestamptz,
  notas         text,
  created_at    timestamptz default now()
);
create index if not exists idx_agenda_user_inicio on agenda_eventos(user_id, inicio);

-- 6. PROGRAMACIONES: columnas nuevas opcionales (no afecta a lo guardado)
alter table programaciones add column if not exists clase_id  uuid references clases(id)  on delete set null;
alter table programaciones add column if not exists alumno_id uuid references alumnos(id) on delete set null;
alter table programaciones add column if not exists estado    text default 'borrador'; -- borrador | revisado | aplicado
alter table programaciones add column if not exists carpeta   text;
create index if not exists idx_prog_clase  on programaciones(clase_id);
create index if not exists idx_prog_alumno on programaciones(alumno_id);

-- 7. SEGURIDAD (RLS): cada docente solo ve y modifica lo suyo ─────
do $$
declare t text;
begin
  foreach t in array array['clases','alumnos','subgrupos','subgrupo_alumnos','seguimiento','agenda_eventos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "propios_%s" on %I', t, t);
    execute format('create policy "propios_%s" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;
