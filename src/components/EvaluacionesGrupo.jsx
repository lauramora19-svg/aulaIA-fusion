import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/crm";
import { tokenActual } from "../lib/equipo";

// Resúmenes de las sesiones de evaluación del grupo. La IA tiene en cuenta los
// más recientes al generar para este grupo. Solo iniciales, nunca nombres.
export const PERIODOS = ["Evaluación inicial", "1ª evaluación", "2ª evaluación", "3ª evaluación", "Evaluación final"];

const PLANTILLA = `Resultados generales:
-
Dificultades detectadas:
-
Acuerdos de la junta de evaluación:
-
Medidas y propuestas de mejora:
-
Alumnado con seguimiento especial (solo iniciales):
- `;

const aBase64 = (buf) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };

async function leerArchivo(file) {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".pdf")) return { tipo: "pdf", data: aBase64(await file.arrayBuffer()) };
  if (/\.(png|jpe?g|webp|gif)$/.test(nombre)) return { tipo: "imagen", mediaType: file.type || "image/jpeg", data: aBase64(await file.arrayBuffer()) };
  if (nombre.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { tipo: "texto", data: r.value.slice(0, 80000) };
  }
  if (/\.(xlsx|xls|csv|ods)$/.test(nombre)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    return { tipo: "texto", data: wb.SheetNames.map(n => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n").slice(0, 80000) };
  }
  if (nombre.endsWith(".txt")) return { tipo: "texto", data: (await file.text()).slice(0, 80000) };
  throw new Error("Ese tipo de archivo no se puede leer. Usa PDF, Word (.docx), Excel o una foto.");
}

export default function EvaluacionesGrupo({ clase }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState(null); // null | { id?, periodo, resumen }
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!clase?.grupo_id) { setCargando(false); return; }
    setCargando(true);
    const { data, error: e } = await supabase.from("grupo_evaluaciones").select("*").eq("grupo_id", clase.grupo_id).order("created_at", { ascending: false });
    if (e) setError(mensajeError(e)); else setLista(data || []);
    setCargando(false);
  }, [clase?.grupo_id]);
  useEffect(() => { cargar(); }, [cargar]);

  const siguientePeriodo = () => {
    const usados = new Set(lista.map(x => x.periodo));
    return PERIODOS.find(p => !usados.has(p)) || PERIODOS[PERIODOS.length - 1];
  };

  const resumirActa = async (file) => {
    if (!file) return;
    setError(""); setLeyendo(true);
    try {
      const archivo = await leerArchivo(file);
      if (archivo.data.length > 9_000_000) throw new Error("El archivo es demasiado grande. Prueba con uno de menos de 6 MB.");
      const res = await fetch("/api/resumir-acta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: await tokenActual(), archivo, grupo: clase.nombre, periodo: editando?.periodo || "" }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.mensaje || "No se ha podido leer el acta."); }
      const { leerStreamSSE } = await import("../lib/stream");
      let txt = "";
      setEditando(ed => ({ ...ed, resumen: "" }));
      await leerStreamSSE(res, (d) => { txt += d; setEditando(ed => ({ ...ed, resumen: txt })); });
      setAviso("✅ Resumen preparado. Revísalo y pulsa «Guardar».");
    } catch (e) { setError(e.message || "No se ha podido leer el acta."); }
    setLeyendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const guardar = async () => {
    if (!editando?.resumen?.trim()) { setError("Escribe el resumen o sube el acta."); return; }
    setGuardando(true); setError("");
    const fila = { grupo_id: clase.grupo_id, periodo: editando.periodo, resumen: editando.resumen.trim(), updated_at: new Date().toISOString() };
    const { error: e } = editando.id
      ? await supabase.from("grupo_evaluaciones").update(fila).eq("id", editando.id)
      : await supabase.from("grupo_evaluaciones").insert(fila);
    setGuardando(false);
    if (e) { setError(mensajeError(e)); return; }
    setEditando(null); setAviso("💾 Guardado. La IA lo tendrá en cuenta al generar para este grupo."); cargar();
  };

  const borrar = async (ev) => {
    if (!window.confirm(`¿Borrar el resumen de «${ev.periodo}»?`)) return;
    const { error: e } = await supabase.from("grupo_evaluaciones").delete().eq("id", ev.id);
    if (e) setError(mensajeError(e)); else cargar();
  };

  if (!clase?.grupo_id) return <p className="crm-muted">Esta clase no tiene grupo asignado. Edita la clase y elige su grupo para poder guardar evaluaciones.</p>;
  if (cargando) return <div className="crm-loading"><div className="lib-spinner" /></div>;

  return (
    <div>
      {error && <p className="error-msg">{error}</p>}
      {aviso && <p className="crm-aviso">{aviso}</p>}

      {!editando && (
        <div className="crm-toolbar">
          <span className="crm-muted">Resúmenes de las sesiones de evaluación de {clase.nombre}. La IA tiene en cuenta los más recientes al generar para este grupo.</span>
          <span style={{ flex: 1 }} />
          <button className="doc-btn" onClick={() => { setAviso(""); setEditando({ periodo: siguientePeriodo(), resumen: PLANTILLA }); }}>＋ Añadir evaluación</button>
        </div>
      )}

      {editando && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="crm-toolbar">
            <select className="input-tema" style={{ maxWidth: 260 }} value={editando.periodo} onChange={e => setEditando({ ...editando, periodo: e.target.value })}>
              {PERIODOS.map(p => <option key={p}>{p}</option>)}
            </select>
            <span style={{ flex: 1 }} />
            <button className="doc-btn" disabled={leyendo} onClick={() => fileRef.current?.click()}>{leyendo ? "⏳ Leyendo el acta…" : "📎 Resumir un acta con IA"}</button>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" style={{ display: "none" }} onChange={e => resumirActa(e.target.files?.[0])} />
          </div>
          <textarea className="input-tema" rows={14} style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} value={editando.resumen} onChange={e => setEditando({ ...editando, resumen: e.target.value })} />
          <p className="field-hint">No escribas nombres de alumnos: usa solo sus iniciales. Puedes subir el acta (PDF, Word, Excel o foto) y la IA te propone el resumen para que lo revises.</p>
          <div className="crm-toolbar">
            <button className="doc-btn" onClick={() => { setEditando(null); setError(""); }}>Cancelar</button>
            <span style={{ flex: 1 }} />
            <button className="doc-btn" disabled={guardando || leyendo} onClick={guardar}>{guardando ? "Guardando…" : "💾 Guardar"}</button>
          </div>
        </div>
      )}

      {lista.length === 0 && !editando && <p className="crm-muted">Aún no hay evaluaciones guardadas para este grupo.</p>}
      {lista.map(ev => (
        <div key={ev.id} className="card" style={{ marginBottom: 12 }}>
          <div className="crm-toolbar">
            <strong>{ev.periodo}</strong>
            <span className="crm-muted">· {new Date(ev.updated_at || ev.created_at).toLocaleDateString("es-ES")}</span>
            <span style={{ flex: 1 }} />
            <button className="doc-btn" onClick={() => { setAviso(""); setEditando({ id: ev.id, periodo: ev.periodo, resumen: ev.resumen }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>✏️ Editar</button>
            <button className="doc-btn doc-btn-del" onClick={() => borrar(ev)} title="Borrar">🗑️</button>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{ev.resumen}</div>
        </div>
      ))}
    </div>
  );
}
