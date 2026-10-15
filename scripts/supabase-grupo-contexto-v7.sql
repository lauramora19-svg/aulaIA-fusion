-- AulaIA · Contexto de cada grupo (lo usa la IA al generar para ese grupo)
-- Sin nombres de alumnos: solo características generales del grupo.
alter table grupos add column if not exists contexto text default '';
select 'contexto de grupo listo' as estado;
