-- AulaIA · Currículo oficial por comunidad, etapa, área y curso (v8)
-- La IA recibe los criterios de evaluación, competencias específicas y contenidos
-- reales del decreto de la comunidad para la asignatura y el curso elegidos.
-- Se puede ejecutar más de una vez.

alter table curriculo_fragmentos add column if not exists alias text[] default '{}';
alter table curriculo_fragmentos add column if not exists cursos text[];
alter table curriculo_fragmentos add column if not exists seccion text;
create index if not exists idx_curriculo_alias on curriculo_fragmentos using gin (alias);
create index if not exists idx_curriculo_cursos on curriculo_fragmentos using gin (cursos);

-- Devuelve, en orden de lectura, los fragmentos del decreto para esa asignatura y curso,
-- sin pasar de p_max caracteres. Prioridad: criterios del curso, contenidos del curso
-- (los más relacionados con el tema primero) y la presentación de competencias.
create or replace function curriculo_para(
  p_comunidad text, p_etapa text, p_area text, p_curso text,
  p_tema text default '', p_max int default 15000
) returns table (decreto text, seccion text, contenido text)
language sql stable security definer set search_path = public as $$
  with q as (
    select case when coalesce(trim(p_tema), '') = '' then null
                else nullif(replace(plainto_tsquery('spanish', p_tema)::text, '&', '|'), '')::tsquery end as tq
  ), base as (
    select f.*,
           case f.seccion when 'criterios' then 1 when 'contenidos' then 2 else 3 end as prio,
           coalesce(ts_rank(f.tsv_contenido, (select tq from q)), 0) as rel
      from curriculo_fragmentos f
     where f.comunidad = p_comunidad
       and f.etapa = p_etapa
       and p_area = any(f.alias)
       and ((f.cursos is null and f.indice_fragmento = 0) or p_curso = any(f.cursos))
  ), orden as (
    select b.*, sum(length(b.contenido)) over (order by b.prio, b.rel desc, b.area, b.indice_fragmento, b.id) as acumulado
      from base b
  )
  select o.decreto, o.seccion, o.contenido
    from orden o
   where o.acumulado <= p_max
   order by case o.seccion when 'competencias' then 1 when 'criterios' then 2 else 3 end, o.area, o.indice_fragmento;
$$;
grant execute on function curriculo_para(text, text, text, text, text, int) to anon, authenticated;

select 'curriculo v8 listo' as estado, (select count(*) from curriculo_fragmentos) as fragmentos;
