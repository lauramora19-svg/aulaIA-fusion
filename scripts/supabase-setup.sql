-- ═══════════════════════════════════════════════════════════════
-- SETUP DE BASE DE DATOS EN SUPABASE
-- Ejecuta este SQL en el editor SQL de tu proyecto de Supabase
-- (Panel → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- 1. TABLA PRINCIPAL DE FRAGMENTOS CURRICULARES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS curriculo_fragmentos (
  id               BIGSERIAL PRIMARY KEY,
  comunidad        TEXT NOT NULL,
  etapa            TEXT,           -- 'Primaria', 'ESO', 'Infantil'
  area             TEXT,           -- NULL = aplica a todas las áreas
  decreto          TEXT,           -- Nombre del decreto oficial
  indice_fragmento INTEGER,        -- Posición dentro del documento
  contenido        TEXT NOT NULL,  -- Texto del fragmento
  tsv_contenido    TSVECTOR,       -- Índice de búsqueda de texto completo
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ÍNDICE DE BÚSQUEDA DE TEXTO COMPLETO (español)
-- ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_curriculo_tsv
  ON curriculo_fragmentos USING GIN (tsv_contenido);

CREATE INDEX IF NOT EXISTS idx_curriculo_comunidad
  ON curriculo_fragmentos (comunidad);

CREATE INDEX IF NOT EXISTS idx_curriculo_area
  ON curriculo_fragmentos (area);

-- 3. TRIGGER: actualiza tsv_contenido automáticamente al insertar/actualizar
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actualizar_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tsv_contenido := to_tsvector('spanish', COALESCE(NEW.contenido, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_tsv ON curriculo_fragmentos;
CREATE TRIGGER trigger_actualizar_tsv
  BEFORE INSERT OR UPDATE ON curriculo_fragmentos
  FOR EACH ROW EXECUTE FUNCTION actualizar_tsv();

-- 4. FUNCIÓN DE BÚSQUEDA (llamada desde el backend)
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION buscar_curriculo(
  query_text      TEXT,
  comunidad_filter TEXT DEFAULT NULL,
  area_filter     TEXT DEFAULT NULL,
  limit_results   INTEGER DEFAULT 5
)
RETURNS TABLE (
  id        BIGINT,
  comunidad TEXT,
  etapa     TEXT,
  area      TEXT,
  decreto   TEXT,
  contenido TEXT,
  relevancia REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsquery_val TSQUERY;
BEGIN
  -- Convertir la búsqueda en tsquery (tolerante a errores)
  BEGIN
    tsquery_val := plainto_tsquery('spanish', query_text);
  EXCEPTION WHEN OTHERS THEN
    tsquery_val := plainto_tsquery('simple', query_text);
  END;

  RETURN QUERY
  SELECT
    f.id,
    f.comunidad,
    f.etapa,
    f.area,
    f.decreto,
    f.contenido,
    ts_rank(f.tsv_contenido, tsquery_val) AS relevancia
  FROM curriculo_fragmentos f
  WHERE
    f.tsv_contenido @@ tsquery_val
    AND (comunidad_filter IS NULL OR f.comunidad = comunidad_filter)
    AND (area_filter IS NULL OR f.area IS NULL OR f.area = area_filter)
  ORDER BY relevancia DESC
  LIMIT limit_results;
END;
$$;

-- 5. POLÍTICA DE SEGURIDAD (solo lectura pública, escritura solo con service key)
-- ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE curriculo_fragmentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de fragmentos"
  ON curriculo_fragmentos FOR SELECT
  USING (true);

CREATE POLICY "Solo service role puede insertar"
  ON curriculo_fragmentos FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 6. VERIFICACIÓN
-- ───────────────
-- Una vez cargados los datos, puedes probar con:
-- SELECT * FROM buscar_curriculo('matemáticas fracciones primaria', 'Andalucía', 'Matemáticas', 3);


-- ═══════════════════════════════════════════════════════════════
-- TABLA DE PROGRAMACIONES (usuarios y biblioteca)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS programaciones (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titulo          TEXT,
  modo            TEXT,           -- nee | ordinario | mixto
  tipo_resultado  TEXT,
  comunidad       TEXT,
  etapa           TEXT,
  curso           TEXT,
  area            TEXT,
  duracion        TEXT,
  necesidades     TEXT[],
  num_alumnos     INTEGER,
  objetivos       TEXT[],
  comentario      TEXT,
  contenido       TEXT NOT NULL,
  compartido      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prog_user   ON programaciones (user_id);
CREATE INDEX IF NOT EXISTS idx_prog_shared ON programaciones (compartido) WHERE compartido = TRUE;

-- Seguridad: cada usuario solo ve sus propias programaciones
ALTER TABLE programaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver propias programaciones"
  ON programaciones FOR SELECT
  USING (auth.uid() = user_id OR compartido = TRUE);

CREATE POLICY "Insertar propias programaciones"
  ON programaciones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Actualizar propias programaciones"
  ON programaciones FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Eliminar propias programaciones"
  ON programaciones FOR DELETE
  USING (auth.uid() = user_id);
