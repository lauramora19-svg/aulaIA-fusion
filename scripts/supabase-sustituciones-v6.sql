-- ════════════════════════════════════════════════════════════════════════
-- AulaIA · Gestor de sustituciones (v6)
-- Solo el equipo directivo ve horarios, ausencias y el cuadro del día.
-- Cada profesor solo ve SU sustitución (aviso), nunca quién falta ni el motivo.
-- Se puede ejecutar más de una vez sin romper nada.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Cargos del equipo directivo (los asigna solo la administradora) ──
create table if not exists centro_cargos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cargo text not null check (cargo in ('direccion','pedagogica','jefatura','coordinacion')),
  etapa text check (etapa in ('inf','pri','sec')),
  updated_at timestamptz default now()
);
alter table centro_cargos enable row level security;
drop policy if exists "cargos: ver" on centro_cargos;
drop policy if exists "cargos: admin crea" on centro_cargos;
drop policy if exists "cargos: admin cambia" on centro_cargos;
drop policy if exists "cargos: admin borra" on centro_cargos;
create policy "cargos: ver" on centro_cargos for select using (user_id = auth.uid() or es_admin());
create policy "cargos: admin crea" on centro_cargos for insert with check (es_admin());
create policy "cargos: admin cambia" on centro_cargos for update using (es_admin()) with check (es_admin());
create policy "cargos: admin borra" on centro_cargos for delete using (es_admin());

-- Etapas que puede gestionar la persona conectada (vacío = ninguna)
create or replace function sust_etapas() returns text[]
language sql stable security definer set search_path = public as $$
  select case
    when es_admin() then array['inf','pri','sec']
    when exists (select 1 from centro_cargos where user_id = auth.uid() and cargo <> 'coordinacion') then array['inf','pri','sec']
    else coalesce((select array_agg(etapa) from centro_cargos where user_id = auth.uid() and cargo = 'coordinacion' and etapa is not null), array[]::text[])
  end
$$;
create or replace function sust_puede(p_etapa text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_etapa = any(sust_etapas())
$$;

-- ── 2. Profesorado del centro (lista que lleva el equipo directivo) ──
create table if not exists sust_profesores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  etapas text[] not null default '{}',
  activo boolean not null default true,
  created_at timestamptz default now()
);
alter table sust_profesores enable row level security;
drop policy if exists "sust_prof: directivos" on sust_profesores;
create policy "sust_prof: directivos" on sust_profesores for all
  using (etapas && sust_etapas()) with check (etapas && sust_etapas());

-- ── 3. Tramos horarios de cada etapa ──
create table if not exists sust_tramos (
  id uuid primary key default gen_random_uuid(),
  etapa text not null check (etapa in ('inf','pri','sec')),
  orden int not null default 0,
  inicio text not null,
  fin text not null,
  recreo boolean not null default false
);
alter table sust_tramos enable row level security;
drop policy if exists "sust_tramos: directivos" on sust_tramos;
create policy "sust_tramos: directivos" on sust_tramos for all using (sust_puede(etapa)) with check (sust_puede(etapa));

-- ── 4. Horario de cada profesor (clase, guardia, refuerzo, libre, patio) ──
create table if not exists sust_horario (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references sust_profesores(id) on delete cascade,
  tramo_id uuid not null references sust_tramos(id) on delete cascade,
  etapa text not null,
  dia int not null check (dia between 1 and 5),
  tipo text not null check (tipo in ('clase','guardia','refuerzo','libre','patio')),
  grupo text default '',
  materia text default '',
  aula text default '',
  unique (profesor_id, tramo_id, dia)
);
create index if not exists sust_horario_dia on sust_horario (etapa, dia);
alter table sust_horario enable row level security;
drop policy if exists "sust_horario: directivos" on sust_horario;
create policy "sust_horario: directivos" on sust_horario for all using (sust_puede(etapa)) with check (sust_puede(etapa));

-- ── 5. Ausencias (NO se guarda el motivo) ──
create table if not exists sust_ausencias (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references sust_profesores(id) on delete cascade,
  desde date not null,
  hasta date not null,
  indicaciones text default '',
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
alter table sust_ausencias enable row level security;
drop policy if exists "sust_aus: directivos" on sust_ausencias;
create policy "sust_aus: directivos" on sust_ausencias for all
  using (exists (select 1 from sust_profesores p where p.id = profesor_id and p.etapas && sust_etapas()))
  with check (exists (select 1 from sust_profesores p where p.id = profesor_id and p.etapas && sust_etapas()));

-- ── 6. Horas a cubrir y quién va ──
create table if not exists sust_asignaciones (
  id uuid primary key default gen_random_uuid(),
  ausencia_id uuid not null references sust_ausencias(id) on delete cascade,
  etapa text not null,
  fecha date not null,
  tramo_id uuid references sust_tramos(id) on delete set null,
  orden int default 0,
  hora text default '',
  grupo text default '',
  materia text default '',
  aula text default '',
  ausente_id uuid references sust_profesores(id) on delete set null,
  sustituto_id uuid references sust_profesores(id) on delete set null,
  tipo_sustituto text default '',
  observaciones text default '',
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmada','enviada')),
  enviada_at timestamptz,
  enterado_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists sust_asig_fecha on sust_asignaciones (fecha, etapa);
alter table sust_asignaciones enable row level security;
drop policy if exists "sust_asig: directivos" on sust_asignaciones;
create policy "sust_asig: directivos" on sust_asignaciones for all using (sust_puede(etapa)) with check (sust_puede(etapa));

-- ── 7. Aviso que recibe el profesor (sin nombre del ausente ni motivo) ──
create table if not exists sust_avisos (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid unique references sust_asignaciones(id) on delete cascade,
  etapa text not null,
  email text not null,
  nombre text default '',
  fecha date not null,
  hora text default '',
  grupo text default '',
  materia text default '',
  aula text default '',
  plan text default '',
  observaciones text default '',
  enterado_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists sust_avisos_email on sust_avisos (lower(email), fecha);
alter table sust_avisos enable row level security;
drop policy if exists "sust_avisos: ver" on sust_avisos;
drop policy if exists "sust_avisos: directivos crean" on sust_avisos;
drop policy if exists "sust_avisos: directivos cambian" on sust_avisos;
drop policy if exists "sust_avisos: directivos borran" on sust_avisos;
create policy "sust_avisos: ver" on sust_avisos for select
  using (sust_puede(etapa) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "sust_avisos: directivos crean" on sust_avisos for insert with check (sust_puede(etapa));
create policy "sust_avisos: directivos cambian" on sust_avisos for update using (sust_puede(etapa)) with check (sust_puede(etapa));
create policy "sust_avisos: directivos borran" on sust_avisos for delete using (sust_puede(etapa));

-- El profesor marca «Enterado» en su aviso (y jefatura lo ve)
create or replace function sust_enterado(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_asig uuid;
begin
  update sust_avisos set enterado_at = now()
   where id = p_id and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
   returning asignacion_id into v_asig;
  if v_asig is not null then
    update sust_asignaciones set enterado_at = now() where id = v_asig;
  end if;
end $$;

-- Qué correos del profesorado tienen cuenta en AulaIA (para saber si verán el aviso)
create or replace function sust_cuentas(p_emails text[]) returns setof text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email)::text from auth.users u
   where cardinality(sust_etapas()) > 0
     and lower(u.email) = any (select lower(x) from unnest(p_emails) x)
$$;

-- Comprobación final
select 'sustituciones listo' as estado,
       (select count(*) from centro_cargos) as cargos;
