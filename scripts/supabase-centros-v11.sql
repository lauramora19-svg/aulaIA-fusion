-- AulaIA · Varios colegios en la misma plataforma (v11)
-- Cada cuenta pertenece a un centro. Las sustituciones y los cargos del equipo
-- directivo quedan separados por centro: nadie ve los de otro colegio.
-- Las clases, alumnos, documentos y agenda ya eran privados de cada docente.
-- Se puede ejecutar más de una vez.

-- 1) Centros ──────────────────────────────────────────────────────────────
create table if not exists centros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  dominio text default '',          -- p. ej. nscarmen.corazonistas.org (las cuentas con ese correo entran solas)
  created_at timestamptz default now()
);
alter table centros enable row level security;

alter table perfiles add column if not exists centro_id uuid references centros(id) on delete set null;
alter table perfiles add column if not exists admin_centro boolean not null default false;

-- Centro de una cuenta: el asignado en su perfil o, si no tiene, el del dominio de su correo
create or replace function centro_de(p_user uuid) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select centro_id from perfiles where id = p_user),
    (select c.id from centros c, auth.users u
      where u.id = p_user and coalesce(c.dominio, '') <> ''
        and lower(split_part(u.email, '@', 2)) = lower(c.dominio)
      order by c.created_at limit 1));
$$;
create or replace function mi_centro() returns uuid
language sql stable security definer set search_path = public as $$
  select centro_de(auth.uid());
$$;
create or replace function es_admin_centro() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select admin_centro from perfiles where id = auth.uid()), false) and mi_centro() is not null;
$$;

drop policy if exists "centros: ver el mio" on centros;
create policy "centros: ver el mio" on centros for select using (id = mi_centro() or es_admin());
drop policy if exists "centros: admin gestiona" on centros;
create policy "centros: admin gestiona" on centros for all using (es_admin()) with check (es_admin());

-- Nadie se cambia a sí mismo el rol, el centro, si administra el centro ni su límite
create or replace function proteger_rol() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not es_admin() then
    if tg_op = 'INSERT' then
      new.rol := 'docente'; new.centro_id := null; new.admin_centro := false; new.limite_mensual := null;
    else
      new.rol := old.rol; new.centro_id := old.centro_id; new.admin_centro := old.admin_centro; new.limite_mensual := old.limite_mensual;
    end if;
  end if;
  return new;
end $$;

-- 2) Tu colegio: el centro inicial, con todas las cuentas que ya existen ────
do $$
declare v_id uuid;
begin
  select id into v_id from centros order by created_at limit 1;
  if v_id is null then
    insert into centros (nombre, dominio) values ('Nuestra Señora del Carmen', 'nscarmen.corazonistas.org') returning id into v_id;
  end if;
  alter table perfiles disable trigger perfiles_proteger_rol;
  insert into perfiles (id, centro_id) select u.id, v_id from auth.users u
  on conflict (id) do update set centro_id = coalesce(perfiles.centro_id, excluded.centro_id);
  update perfiles set admin_centro = true where rol = 'admin';
  alter table perfiles enable trigger perfiles_proteger_rol;
  -- sustituciones y cargos que ya había → a tu colegio
  alter table centro_cargos add column if not exists centro_id uuid references centros(id) on delete cascade;
  alter table sust_profesores add column if not exists centro_id uuid references centros(id) on delete cascade;
  alter table sust_tramos add column if not exists centro_id uuid references centros(id) on delete cascade;
  alter table sust_horario add column if not exists centro_id uuid references centros(id) on delete cascade;
  alter table sust_ausencias add column if not exists centro_id uuid references centros(id) on delete cascade;
  alter table sust_asignaciones add column if not exists centro_id uuid references centros(id) on delete cascade;
  alter table sust_avisos add column if not exists centro_id uuid references centros(id) on delete cascade;
  update centro_cargos set centro_id = coalesce(centro_de(user_id), v_id) where centro_id is null;
  update sust_profesores set centro_id = v_id where centro_id is null;
  update sust_tramos set centro_id = v_id where centro_id is null;
  update sust_horario set centro_id = v_id where centro_id is null;
  update sust_ausencias set centro_id = v_id where centro_id is null;
  update sust_asignaciones set centro_id = v_id where centro_id is null;
  update sust_avisos set centro_id = v_id where centro_id is null;
end $$;

-- Lo nuevo de sustituciones se guarda siempre en el centro de quien lo crea
alter table sust_profesores alter column centro_id set default mi_centro();
alter table sust_tramos alter column centro_id set default mi_centro();
alter table sust_horario alter column centro_id set default mi_centro();
alter table sust_ausencias alter column centro_id set default mi_centro();
alter table sust_asignaciones alter column centro_id set default mi_centro();
alter table sust_avisos alter column centro_id set default mi_centro();
create index if not exists idx_sust_prof_centro on sust_profesores (centro_id);
create index if not exists idx_sust_asig_centro on sust_asignaciones (centro_id, fecha);

-- El cargo siempre queda en el centro de la persona que lo tiene
create or replace function cargo_centro() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.centro_id := centro_de(new.user_id); return new; end $$;
drop trigger if exists centro_cargos_centro on centro_cargos;
create trigger centro_cargos_centro before insert or update on centro_cargos for each row execute function cargo_centro();

-- 3) Permisos de sustituciones: además de la etapa, el centro ──────────────
create or replace function sust_etapas() returns text[]
language sql stable security definer set search_path = public as $$
  select case
    when mi_centro() is null then array[]::text[]
    when es_admin() then array['inf','pri','sec']
    when exists (select 1 from centro_cargos where user_id = auth.uid() and cargo <> 'coordinacion' and centro_id = mi_centro()) then array['inf','pri','sec']
    else coalesce((select array_agg(etapa) from centro_cargos where user_id = auth.uid() and cargo = 'coordinacion' and etapa is not null and centro_id = mi_centro()), array[]::text[])
  end
$$;

drop policy if exists "sust_prof: directivos" on sust_profesores;
create policy "sust_prof: directivos" on sust_profesores for all
  using (centro_id = mi_centro() and etapas && sust_etapas()) with check (centro_id = mi_centro() and etapas && sust_etapas());
drop policy if exists "sust_tramos: directivos" on sust_tramos;
create policy "sust_tramos: directivos" on sust_tramos for all
  using (centro_id = mi_centro() and sust_puede(etapa)) with check (centro_id = mi_centro() and sust_puede(etapa));
drop policy if exists "sust_horario: directivos" on sust_horario;
create policy "sust_horario: directivos" on sust_horario for all
  using (centro_id = mi_centro() and sust_puede(etapa)) with check (centro_id = mi_centro() and sust_puede(etapa));
drop policy if exists "sust_aus: directivos" on sust_ausencias;
create policy "sust_aus: directivos" on sust_ausencias for all
  using (centro_id = mi_centro() and exists (select 1 from sust_profesores p where p.id = profesor_id and p.etapas && sust_etapas()))
  with check (centro_id = mi_centro() and exists (select 1 from sust_profesores p where p.id = profesor_id and p.etapas && sust_etapas()));
drop policy if exists "sust_asig: directivos" on sust_asignaciones;
create policy "sust_asig: directivos" on sust_asignaciones for all
  using (centro_id = mi_centro() and sust_puede(etapa)) with check (centro_id = mi_centro() and sust_puede(etapa));
drop policy if exists "sust_avisos: ver" on sust_avisos;
create policy "sust_avisos: ver" on sust_avisos for select
  using ((centro_id = mi_centro() and sust_puede(etapa)) or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "sust_avisos: directivos crean" on sust_avisos;
create policy "sust_avisos: directivos crean" on sust_avisos for insert with check (centro_id = mi_centro() and sust_puede(etapa));
drop policy if exists "sust_avisos: directivos cambian" on sust_avisos;
create policy "sust_avisos: directivos cambian" on sust_avisos for update using (centro_id = mi_centro() and sust_puede(etapa)) with check (centro_id = mi_centro() and sust_puede(etapa));
drop policy if exists "sust_avisos: directivos borran" on sust_avisos;
create policy "sust_avisos: directivos borran" on sust_avisos for delete using (centro_id = mi_centro() and sust_puede(etapa));

-- Qué correos tienen cuenta en AulaIA… solo dentro de tu centro
create or replace function sust_cuentas(p_emails text[]) returns setof text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email)::text from auth.users u
   where cardinality(sust_etapas()) > 0
     and centro_de(u.id) = mi_centro()
     and lower(u.email) = any (select lower(x) from unnest(p_emails) x)
$$;

-- 4) Cargos: los gestiona la administradora o quien administra ese centro ───
drop policy if exists "cargos: ver" on centro_cargos;
create policy "cargos: ver" on centro_cargos for select using (user_id = auth.uid() or es_admin() or (es_admin_centro() and centro_id = mi_centro()));
drop policy if exists "cargos: admin crea" on centro_cargos;
create policy "cargos: admin crea" on centro_cargos for insert with check (es_admin() or (es_admin_centro() and centro_id = mi_centro()));
drop policy if exists "cargos: admin cambia" on centro_cargos;
create policy "cargos: admin cambia" on centro_cargos for update using (es_admin() or (es_admin_centro() and centro_id = mi_centro())) with check (es_admin() or (es_admin_centro() and centro_id = mi_centro()));
drop policy if exists "cargos: admin borra" on centro_cargos;
create policy "cargos: admin borra" on centro_cargos for delete using (es_admin() or (es_admin_centro() and centro_id = mi_centro()));

-- 5) Funciones para las pantallas ─────────────────────────────────────────
create or replace function mi_centro_info() returns table (centro_id uuid, nombre text, admin_centro boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre, es_admin_centro() from centros c where c.id = mi_centro();
$$;

-- Cuentas de mi centro (para quien administra el centro)
create or replace function centro_usuarios() returns table (id uuid, email text, nombre text, admin_centro boolean, alta timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, coalesce(p.nombre, ''), coalesce(p.admin_centro, false), u.created_at
    from auth.users u left join perfiles p on p.id = u.id
   where (es_admin_centro() or es_admin()) and mi_centro() is not null and centro_de(u.id) = mi_centro()
   order by coalesce(nullif(p.nombre, ''), u.email);
$$;

-- Panel de la administradora: centros con cuántas cuentas tiene cada uno
create or replace function admin_centros() returns table (id uuid, nombre text, dominio text, cuentas int, admins text)
language sql stable security definer set search_path = public, auth as $$
  select c.id, c.nombre, coalesce(c.dominio, ''),
    (select count(*)::int from auth.users u where centro_de(u.id) = c.id),
    coalesce((select string_agg(coalesce(nullif(p.nombre, ''), u.email), ', ') from perfiles p join auth.users u on u.id = p.id where p.admin_centro and centro_de(p.id) = c.id), '')
  from centros c where es_admin() order by c.created_at;
$$;
create or replace function admin_guardar_centro(p_id uuid, p_nombre text, p_dominio text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not es_admin() then raise exception 'Solo la administradora puede gestionar centros'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Pon el nombre del centro'; end if;
  if p_id is null then
    insert into centros (nombre, dominio) values (trim(p_nombre), lower(trim(coalesce(p_dominio, '')))) returning id into v;
  else
    update centros set nombre = trim(p_nombre), dominio = lower(trim(coalesce(p_dominio, ''))) where id = p_id returning id into v;
  end if;
  return v;
end $$;
create or replace function admin_usuario_centro(p_user uuid, p_centro uuid, p_admin_centro boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administradora puede cambiar el centro de una cuenta'; end if;
  insert into perfiles (id, centro_id, admin_centro) values (p_user, p_centro, coalesce(p_admin_centro, false))
  on conflict (id) do update set centro_id = excluded.centro_id, admin_centro = excluded.admin_centro, updated_at = now();
  -- si cambia de centro, su cargo de equipo directivo no viaja con ella
  delete from centro_cargos where user_id = p_user and centro_id is distinct from p_centro;
end $$;

-- admin_usuarios ahora también dice a qué centro pertenece cada cuenta
drop function if exists admin_usuarios();
create or replace function admin_usuarios() returns table (
  id uuid, email text, nombre text, rol text, limite_mensual int, limite_efectivo int,
  usados_mes int, tokens_entrada_mes bigint, tokens_salida_mes bigint, ultimo_uso timestamptz, alta timestamptz,
  centro_id uuid, centro_nombre text, admin_centro boolean
) language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, coalesce(p.nombre, ''), coalesce(p.rol, 'docente'), p.limite_mensual,
    case when p.rol = 'admin' then -1 else coalesce(p.limite_mensual, (select limite_por_defecto from ajustes_ia where id = 1), 30) end,
    coalesce(m.n, 0)::int, coalesce(m.te, 0), coalesce(m.ts, 0), m.ultimo, u.created_at,
    centro_de(u.id), (select c.nombre from centros c where c.id = centro_de(u.id)), coalesce(p.admin_centro, false)
  from auth.users u
  left join perfiles p on p.id = u.id
  left join (
    select user_id, count(*) filter (where not continuacion) n, sum(tokens_entrada) te, sum(tokens_salida) ts, max(created_at) ultimo
    from uso_ia where created_at >= date_trunc('month', now()) group by user_id
  ) m on m.user_id = u.id
  where es_admin()
  order by coalesce(m.n, 0) desc, u.created_at;
$$;

grant execute on function mi_centro_info() to authenticated;
grant execute on function centro_usuarios() to authenticated;

select 'centros listo' as estado,
  (select count(*) from centros) as centros,
  (select count(*) from perfiles where centro_id is not null) as cuentas_con_centro,
  (select count(*) from sust_profesores where centro_id is null) as profesores_sin_centro;
