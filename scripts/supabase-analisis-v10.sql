-- AulaIA · Análisis de resultados (rúbricas y exámenes) por evaluación (v10)
-- Los informes se guardan en la biblioteca (programaciones) con su evaluación.
alter table programaciones add column if not exists periodo text;
create index if not exists idx_prog_clase_tipo on programaciones (clase_id, tipo_resultado);
select 'analisis de resultados listo' as estado;
