import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { leerStreamSSE } from "../lib/stream";
import { NECESIDADES } from "../lib/datos";
import { trimestres, trimestreActual, nombreCompleto, mensajeError, TIPOS_SEGUIMIENTO } from "../lib/crm";
import Modal from "./Modal";
import Campo from "./Campo";

const FIRMA = /\n?---\n?✅ Documento completo generado por AulaIA\s*$/;

// Rellena un modelo del colegio (acta de evaluación, informe de grupo...) con los datos de la clase
export default function RellenarModeloModal({ clase, alumnos, onClose, onCreado }) {
  const [plantillas, setPlantillas] = useState(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [trim, setTrim] = useState(trimestreActual());
  const [extra, setExtra] = useState("");
  const [texto, setTexto] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("plantillas").select("id, nombre, tipo").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) setError(mensajeError(error)); setPlantillas(data || []); if (data?.[0]) setPlantillaId(data.find(p => p.tipo === "acta")?.id || data[0].id); });
  }, []);

  const generar = async () => {
    const pl = plantillas.find(p => p.id === plantillaId);
    if (!pl) { setError("Elige un modelo."); return; }
    const tri = trimestres().find(t => t.id === trim);
    setGenerando(true); setError(""); setTexto("");
    try {
      const ids = alumnos.map(a => a.id);
      const { data: seg } = ids.length ? await supabase.from("seguimiento").select("alumno_id, fecha, tipo, texto").in("alumno_id", ids) : { data: [] };
      const dentro = (seg || []).filter(s => { const f = new Date(s.fecha + "T12:00:00"); return f >= tri.desde && f <= tri.hasta; });
      const filas = alumnos.map((a, i) => {
        const nee = a.tiene_nee ? ((a.perfil_nee?.necesidades || []).map(id => NECESIDADES.find(n => n.id === id)?.label || id).join(", ") || a.perfil_nee?.tipo_texto || "NEE") : "";
        const regs = dentro.filter(s => s.alumno_id === a.id).map(s => `${TIPOS_SEGUIMIENTO[s.tipo]?.label || s.tipo}: ${s.texto}`).join(" | ");
        return `${i + 1}. ${nombreCompleto(a)}${nee ? ` — NEE: ${nee}` : ""}${regs ? ` — Seguimiento: ${regs}` : ""}`;
      }).join("\n");
      const prompt = `Rellena el modelo oficial del centro "${pl.nombre}" para el grupo ${clase.nombre} (${clase.curso || ""}, ${clase.area || ""}), ${tri.label}.

ALUMNADO (por orden alfabético de apellido):
${filas || "(sin alumnado registrado)"}

${extra ? `INDICACIONES DE LA DOCENTE: ${extra}\n` : ""}
REGLAS:
- Respeta EXACTAMENTE la estructura del modelo (apartados, orden, tablas y columnas).
- Usa solo los datos facilitados; no inventes calificaciones ni hechos. Donde falte un dato, deja _______________.
- Formato Markdown: ## para apartados, tablas con |, **negrita** cerrada siempre.
- Al terminar escribe exactamente en una línea separada:
---
✅ Documento completo generado por AulaIA`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comunidad: clase.comunidad, etapa: clase.etapa, curso: clase.curso, area: clase.area, modo: "ordinario", tipoResultado: "acta", idioma: "Castellano", promptOverride: prompt, plantillaId, accessToken: session?.access_token }),
      });
      if (!res.ok) throw new Error("api");
      let full = "";
      await leerStreamSSE(res, d => { full += d; setTexto(full); });
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ins, error } = await supabase.from("programaciones").insert({
        user_id: user.id, titulo: `${pl.nombre} — ${clase.nombre} ${clase.area || ""} — ${tri.label}`.replace(/\s+/g, " "),
        modo: "ordinario", tipo_resultado: "acta", comunidad: clase.comunidad, etapa: clase.etapa, curso: clase.curso, area: clase.area,
        contenido: full.replace(FIRMA, "").trimEnd(), compartido: false, clase_id: clase.id,
      }).select("id").single();
      if (error) throw error;
      onCreado(ins.id);
    } catch (e) {
      setError(e?.message === "api" ? "Error al generar. Inténtalo de nuevo." : mensajeError(e));
    } finally { setGenerando(false); }
  };

  return (
    <Modal titulo="📋 Rellenar modelo del colegio" onClose={generando ? () => {} : onClose} ancho={600}>
      <div className="crm-form">
        {plantillas === null ? <div className="crm-loading"><div className="lib-spinner" /></div> :
          plantillas.length === 0 ? <p className="crm-muted">Aún no has subido modelos. Ve a «📋 Modelos del colegio» en la barra lateral y sube tu acta o informe en PDF o Word.</p> : <>
            <Campo label="Modelo">
              <select className="input-tema" value={plantillaId} onChange={e => setPlantillaId(e.target.value)}>
                {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Trimestre">
              <div className="chips-grid">
                {trimestres().map(t => <button key={t.id} type="button" className={`chip chip-small ${trim === t.id ? "chip-active" : ""}`} onClick={() => setTrim(t.id)}><span className="chip-label">{t.label}</span></button>)}
              </div>
            </Campo>
            <Campo label="Indicaciones (opcional)">
              <textarea className="textarea" rows={3} value={extra} onChange={e => setExtra(e.target.value)} placeholder="Ej: añade una valoración general del grupo y propuestas de mejora" />
            </Campo>
          </>}
        {(generando || texto) && <pre className="crm-informe-live">{texto || "Leyendo el modelo y preparando el documento..."}</pre>}
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose} disabled={generando}>Cancelar</button>
          {plantillas?.length > 0 && <button className="library-new-btn" onClick={generar} disabled={generando}>{generando ? "⏳ Generando..." : "✨ Rellenar con IA"}</button>}
        </div>
      </div>
    </Modal>
  );
}
