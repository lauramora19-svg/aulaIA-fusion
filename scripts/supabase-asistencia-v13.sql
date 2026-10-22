-- AulaIA · Asistencia, comunicados de ausencia a dirección y encabezados (v13)
-- 1) Pasar lista por clase y día (solo se guardan faltas, retrasos y justificadas).
-- 2) Comunicar una ausencia del docente al equipo directivo de su centro.
-- 3) Encabezados/logos a medida para exámenes, circulares y comunicados.
-- Se puede ejecutar más de una vez.

-- 1) ASISTENCIA ────────────────────────────────────────────────────────────
create table if not exists asistencia_dias (       -- días en que se ha pasado lista
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clase_id   uuid not null references clases(id) on delete cascade,
  fecha      date not null,
  created_at timestamptz default now(),
  unique (clase_id, fecha)
);
create table if not exists asistencia (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clase_id      uuid not null references clases(id) on delete cascade,
  alumno_id     uuid not null references alumnos(id) on delete cascade,
  fecha         date not null,
  estado        text not null default 'falta' check (estado in ('falta', 'retraso', 'justificada')),
  nota          text default '',
  comunicado_at timestamptz,                         -- cuándo se preparó el comunicado a la familia
  created_at    timestamptz default now(),
  unique (clase_id, alumno_id, fecha)
);
create index if not exists idx_asistencia_clase_fecha on asistencia (clase_id, fecha);
alter table asistencia enable row level security;
alter table asistencia_dias enable row level security;
drop policy if exists "asistencia: propia" on asistencia;
create policy "asistencia: propia" on asistencia for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "asistencia_dias: propia" on asistencia_dias;
create policy "asistencia_dias: propia" on asistencia_dias for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) COMUNICAR AUSENCIA A DIRECCIÓN ───────────────────────────────────────
-- Texto del documento oficial del colegio (lo sube la administradora o quien administra el centro)
alter table centros add column if not exists plantilla_ausencia text default '';

create or replace function centro_plantilla_ausencia() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(plantilla_ausencia, '') from centros where id = mi_centro();
$$;
create or replace function centro_guardar_plantilla_ausencia(p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (es_admin() or es_admin_centro()) then raise exception 'Solo quien administra el centro puede cambiar el documento oficial'; end if;
  if mi_centro() is null then raise exception 'Tu cuenta no tiene centro asignado'; end if;
  update centros set plantilla_ausencia = left(coalesce(p_texto, ''), 30000) where id = mi_centro();
end $$;

-- Equipo directivo de mi centro (a quién puedo comunicar una ausencia)
create or replace function centro_destinatarios() returns table (id uuid, nombre text, email text, cargo text, etapa text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, coalesce(nullif(p.nombre, ''), u.email)::text, u.email::text, c.cargo, c.etapa
    from centro_cargos c
    join auth.users u on u.id = c.user_id
    left join perfiles p on p.id = u.id
   where mi_centro() is not null and c.centro_id = mi_centro() and u.id <> auth.uid()
   order by case c.cargo when 'direccion' then 1 when 'pedagogica' then 2 when 'jefatura' then 3 else 4 end, 2;
$$;

create table if not exists avisos_ausencia (
  id         uuid primary key default gen_random_uuid(),
  centro_id  uuid references centros(id) on delete cascade default mi_centro(),
  de_user    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  de_nombre  text default '',
  para_user  uuid not null references auth.users(id) on delete cascade,
  desde      date not null,
  hasta      date,
  horario    text default '',
  documento  text default '',     -- sin el motivo: ese solo va en el correo / Word
  leido_at   timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_avisos_ausencia_para on avisos_ausencia (para_user, created_at desc);
alter table avisos_ausencia enable row level security;
drop policy if exists "avisos_aus: ver" on avisos_ausencia;
create policy "avisos_aus: ver" on avisos_ausencia for select using (de_user = auth.uid() or para_user = auth.uid());
drop policy if exists "avisos_aus: crear" on avisos_ausencia;
create policy "avisos_aus: crear" on avisos_ausencia for insert
  with check (de_user = auth.uid() and centro_id = mi_centro() and centro_de(para_user) = mi_centro());
drop policy if exists "avisos_aus: leido" on avisos_ausencia;
create policy "avisos_aus: leido" on avisos_ausencia for update using (para_user = auth.uid()) with check (para_user = auth.uid());
drop policy if exists "avisos_aus: borrar el mio" on avisos_ausencia;
create policy "avisos_aus: borrar el mio" on avisos_ausencia for delete using (de_user = auth.uid());

-- 3) ENCABEZADOS / LOGOS ──────────────────────────────────────────────────
create table if not exists encabezados (
  id         uuid primary key default gen_random_uuid(),
  centro_id  uuid references centros(id) on delete cascade default mi_centro(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null,
  imagen     text not null check (length(imagen) < 1500000),   -- data:image/...;base64 (ya reducida)
  ancho      int,
  alto       int,
  created_at timestamptz default now()
);
alter table encabezados enable row level security;
drop policy if exists "encabezados: ver" on encabezados;
create policy "encabezados: ver" on encabezados for select using (user_id = auth.uid() or (centro_id is not null and centro_id = mi_centro()));
drop policy if exists "encabezados: crear" on encabezados;
create policy "encabezados: crear" on encabezados for insert with check (user_id = auth.uid() and (centro_id is null or centro_id = mi_centro()));
drop policy if exists "encabezados: cambiar" on encabezados;
create policy "encabezados: cambiar" on encabezados for update
  using (user_id = auth.uid() or es_admin() or (es_admin_centro() and centro_id = mi_centro()))
  with check (user_id = auth.uid() or es_admin() or (es_admin_centro() and centro_id = mi_centro()));
drop policy if exists "encabezados: borrar" on encabezados;
create policy "encabezados: borrar" on encabezados for delete
  using (user_id = auth.uid() or es_admin() or (es_admin_centro() and centro_id = mi_centro()));

alter table programaciones add column if not exists encabezado_id uuid references encabezados(id) on delete set null;

grant execute on function centro_plantilla_ausencia() to authenticated;
grant execute on function centro_guardar_plantilla_ausencia(text) to authenticated;
grant execute on function centro_destinatarios() to authenticated;

select 'asistencia y comunicados listos' as estado,
  (select count(*) from centro_cargos) as cargos_directivos,
  (select count(*) from encabezados) as encabezados;
