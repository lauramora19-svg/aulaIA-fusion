/**
 * SCRIPT DE CARGA DE DECRETOS CURRICULARES
 * ==========================================
 * Ejecutar una sola vez para cargar los PDFs de decretos en Supabase.
 *
 * Uso:
 *   node scripts/cargar-curriculo.js
 *
 * Requisitos:
 *   npm install @supabase/supabase-js pdf-parse dotenv
 */

import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─────────────────────────────────────────────────────────────────
// CONFIGURA AQUÍ TUS PDFs
// Descarga los decretos del BOE o boletines autonómicos y ponlos
// en la carpeta scripts/decretos/
// ─────────────────────────────────────────────────────────────────
const DECRETOS = [
  {
    archivo: "scripts/decretos/andalucia-primaria.pdf",
    comunidad: "Andalucía",
    etapa: "Primaria",
    area: null, // null = aplica a todas las áreas
    decreto: "Decreto 101/2023 de la Junta de Andalucía",
  },
  {
    archivo: "scripts/decretos/andalucia-eso.pdf",
    comunidad: "Andalucía",
    etapa: "ESO",
    area: null,
    decreto: "Decreto 102/2023 de la Junta de Andalucía",
  },
  {
    archivo: "scripts/decretos/madrid-primaria.pdf",
    comunidad: "Madrid",
    etapa: "Primaria",
    area: null,
    decreto: "Decreto 84/2024 de la Comunidad de Madrid",
  },
  // Añade aquí el resto de comunidades...
];

// ─────────────────────────────────────────────────────────────────
// FUNCIÓN: Divide texto en fragmentos de ~800 palabras
// ─────────────────────────────────────────────────────────────────
function dividirEnFragmentos(texto, tamano = 800) {
  const palabras = texto.split(/\s+/);
  const fragmentos = [];
  for (let i = 0; i < palabras.length; i += tamano) {
    const fragmento = palabras.slice(i, i + tamano).join(" ");
    if (fragmento.trim().length > 50) {
      fragmentos.push(fragmento.trim());
    }
  }
  return fragmentos;
}

// ─────────────────────────────────────────────────────────────────
// FUNCIÓN: Limpia texto extraído del PDF
// ─────────────────────────────────────────────────────────────────
function limpiarTexto(texto) {
  return texto
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{3,}/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────
// PROCESO PRINCIPAL
// ─────────────────────────────────────────────────────────────────
async function cargarDecretos() {
  console.log("🚀 Iniciando carga de decretos curriculares...\n");

  let totalFragmentos = 0;
  let totalErrores = 0;

  for (const decreto of DECRETOS) {
    const rutaAbsoluta = path.resolve(decreto.archivo);

    if (!fs.existsSync(rutaAbsoluta)) {
      console.warn(`⚠️  Archivo no encontrado: ${decreto.archivo}`);
      totalErrores++;
      continue;
    }

    console.log(`📄 Procesando: ${decreto.decreto}`);

    try {
      // 1. Extraer texto del PDF
      const pdfBuffer = fs.readFileSync(rutaAbsoluta);
      const pdfData = await pdfParse(pdfBuffer);
      const textoLimpio = limpiarTexto(pdfData.text);

      console.log(`   Texto extraído: ${textoLimpio.length} caracteres`);

      // 2. Dividir en fragmentos
      const fragmentos = dividirEnFragmentos(textoLimpio);
      console.log(`   Fragmentos generados: ${fragmentos.length}`);

      // 3. Insertar en Supabase
      const registros = fragmentos.map((contenido, indice) => ({
        comunidad: decreto.comunidad,
        etapa: decreto.etapa,
        area: decreto.area,
        decreto: decreto.decreto,
        indice_fragmento: indice,
        contenido,
        // El campo tsv_contenido se genera automáticamente con un trigger en Supabase
      }));

      // Insertar en lotes de 50
      for (let i = 0; i < registros.length; i += 50) {
        const lote = registros.slice(i, i + 50);
        const { error } = await supabase
          .from("curriculo_fragmentos")
          .insert(lote);

        if (error) {
          console.error(`   ❌ Error insertando lote ${i / 50 + 1}:`, error.message);
          totalErrores++;
        } else {
          console.log(`   ✅ Lote ${i / 50 + 1} insertado (${lote.length} fragmentos)`);
          totalFragmentos += lote.length;
        }
      }
    } catch (e) {
      console.error(`   ❌ Error procesando ${decreto.archivo}:`, e.message);
      totalErrores++;
    }

    console.log();
  }

  console.log("─────────────────────────────────────");
  console.log(`✅ Carga completada`);
  console.log(`   Fragmentos insertados: ${totalFragmentos}`);
  console.log(`   Errores: ${totalErrores}`);
}

cargarDecretos().catch(console.error);
