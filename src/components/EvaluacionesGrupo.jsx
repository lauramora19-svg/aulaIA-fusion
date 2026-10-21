import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/crm";
import { tokenActual, contextoEncargo } from "../lib/equipo";
import { renderResultado } from "../lib/render";

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

const FIRMA = /\n?---\n?✅ Documento completo generado por AulaIA\s*$/;

export default function EvaluacionesGrupo({ clase, clases = [], onAbrirDoc }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState(null); // null | { id?, periodo, resumen }
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef(null);
  // Análisis de resultados (rúbricas, exámenes)
  const [analisis, setAnalisis] = useState([]);
  const [nuevoAn, setNuevoAn] = useState(null); // null | { periodo, prueba, nota, texto, docId }
  const [analizando, setAnalizando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const anRef = useRef(null);
  const idsGrupo = clases.filter(c => c.grupo_id && c.grupo_id === clase?.grupo_id).map(c => c.id);
  if (clase?.id && !idsGrupo.includes(clase.id)) idsGrupo.push(clase.id);

  const cargar = useCallback(async () => {
    if (!clase?.grupo_id) { setCargando(false); return; }
    setCargando(true);
    const { data, error: e } = await supabase.from("grupo_evaluaciones").select("*").eq("grupo_id", clase.grupo_id).order("created_at", { ascending: false });
    if (e) setError(mensajeError(e)); else setLista(data || []);
    const { data: an } = await supabase.from("programaciones").select("id, titulo, periodo, area, created_at").in("clase_id", idsGrupo).eq("tipo_resultado", "analisis_resultados").order("created_at", { ascending: false });
    setAnalisis(an || []);
    setCargando(false);
  }, [clase?.grupo_id, idsGrupo.join(",")]);
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

  // Sube la rúbrica o el examen, la IA hace el informe y se guarda en la biblioteca
  const analizar = async (file) => {
    if (!file) return;
    if (!nuevoAn?.prueba?.trim()) { setError("Escribe primero el nombre de la prueba (p. ej. «Examen tema 3»)."); if (anRef.current) anRef.current.value = ""; return; }
    setError(""); setAviso(""); setAnalizando(true);
    try {
      const archivo = await leerArchivo(file);
      if (archivo.data.length > 9_000_000) throw new Error("El archivo es demasiado grande. Prueba con uno de menos de 6 MB.");
      const res = await fetch("/api/analizar-resultados", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: await tokenActual(), archivo, grupo: clase.nombre, periodo: nuevoAn.periodo, prueba: nuevoAn.prueba.trim(), nota: nuevoAn.nota || "", area: clase.area || "", curso: clase.curso || "" }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.mensaje || "No se ha podido analizar el archivo."); }
      const { leerStreamSSE } = await import("../lib/stream");
      let txt = "";
      await leerStreamSSE(res, (d) => { txt += d; setNuevoAn(n => ({ ...n, texto: txt })); });
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ins, error: e } = await supabase.from("programaciones").insert({
        user_id: user.id, titulo: `Análisis de resultados — ${nuevoAn.prueba.trim()} — ${clase.nombre}${clase.area ? ` ${clase.area}` : ""} — ${nuevoAn.periodo}`.replace(/\s+/g, " "),
        modo: "ordinario", tipo_resultado: "analisis_resultados", periodo: nuevoAn.periodo,
        comunidad: clase.comunidad, etapa: clase.etapa, curso: clase.curso, area: clase.area,
        contenido: txt.trim(), compartido: false, clase_id: clase.id,
      }).select("id").single();
      if (e) throw e;
      setNuevoAn(n => ({ ...n, docId: ins.id }));
      setAviso("✅ Informe guardado en tu biblioteca. Eva lo usará al preparar el resumen de esta evaluación.");
      cargar();
    } catch (e) { setError(e.message || "No se ha podido analizar el archivo."); }
    setAnalizando(false);
    if (anRef.current) anRef.current.value = "";
  };

  // Eva redacta el resumen de la evaluación a partir de los informes de esa evaluación
  const prepararConEva = async () => {
    const delPeriodo = analisis.filter(a => a.periodo === editando?.periodo);
    if (!delPeriodo.length) { setError(`No hay análisis de resultados de «${editando?.periodo}». Súbelos primero en «Análisis de resultados».`); return; }
    setError(""); setPreparando(true);
    try {
      const { data: docs } = await supabase.from("programaciones").select("titulo, contenido").in("id", delPeriodo.map(a => a.id));
      const informes = (docs || []).map(d => `### ${d.titulo}\n${String(d.contenido || "").slice(0, 6000)}`).join("\n\n").slice(0, 24000);
      const prompt = `ENCARGO: redacta el resumen de la sesión de evaluación «${editando.periodo}» del grupo ${clase.nombre} a partir de los informes de resultados de abajo (de todas las asignaturas y pruebas que haya).

Usa exactamente estos apartados, con viñetas cortas y sin tablas:
Resultados generales:
Dificultades detectadas:
Acuerdos de la junta de evaluación:
Medidas y propuestas de mejora:
Alumnado con seguimiento especial (solo iniciales):

Reglas: solo iniciales, nunca nombres; no inventes datos; en «Acuerdos de la junta» propón acuerdos razonables marcados como «(propuesta)» para que la docente los confirme. Máximo unas 300 palabras.

INFORMES DE RESULTADOS:
${informes}

Al terminar escribe exactamente:
---
✅ Documento completo generado por AulaIA`;
      const res = await fetch("/api/generar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptOverride: prompt, especialistaId: "eva", contextoEncargo: await contextoEncargo(clase).catch(() => ""), accessToken: await tokenActual(), tipoResultado: "encargo", modo: "ordinario", idioma: "Castellano", comunidad: clase.comunidad, etapa: clase.etapa, curso: clase.curso, area: clase.area }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.mensaje || "No se ha podido preparar el resumen."); }
      const { leerStreamSSE } = await import("../lib/stream");
      let txt = "";
      await leerStreamSSE(res, (d) => { txt += d; setEditando(ed => ({ ...ed, resumen: txt.replace(FIRMA, "") })); });
      setEditando(ed => ({ ...ed, resumen: txt.replace(FIRMA, "").trim() }));
      setAviso("✅ Eva ha preparado el resumen. Revísalo y pulsa «Guardar».");
    } catch (e) { setError(e.message || "No se ha podido preparar el resumen."); }
    setPreparando(false);
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="crm-toolbar">
          <strong>📈 Análisis de resultados</strong>
          <span className="crm-muted">Sube la rúbrica o el examen corregido y Eva te hace un informe.</span>
          <span style={{ flex: 1 }} />
          {!nuevoAn && <button className="doc-btn" onClick={() => { setAviso(""); setError(""); setNuevoAn({ periodo: siguientePeriodo(), prueba: "", nota: "", texto: "" }); }}>＋ Analizar resultados</button>}
        </div>
        {nuevoAn && (
          <div style={{ marginTop: 8 }}>
            <div className="crm-toolbar">
              <select className="input-tema" style={{ maxWidth: 220 }} value={nuevoAn.periodo} disabled={analizando} onChange={e => setNuevoAn({ ...nuevoAn, periodo: e.target.value })}>
                {PERIODOS.map(p => <option key={p}>{p}</option>)}
              </select>
              <input className="input-tema" style={{ flex: "1 1 220px" }} placeholder="Nombre de la prueba (p. ej. Examen tema 3, Rúbrica del proyecto)" value={nuevoAn.prueba} disabled={analizando} onChange={e => setNuevoAn({ ...nuevoAn, prueba: e.target.value })} />
            </div>
            <input className="input-tema" style={{ width: "100%", marginTop: 6 }} placeholder="Qué evaluaba o en qué quieres que se fije (opcional)" value={nuevoAn.nota} disabled={analizando} onChange={e => setNuevoAn({ ...nuevoAn, nota: e.target.value })} />
            <div className="crm-toolbar" style={{ marginTop: 6 }}>
              <button className="doc-btn" onClick={() => setNuevoAn(null)} disabled={analizando}>{nuevoAn.docId ? "Cerrar" : "Cancelar"}</button>
              <span style={{ flex: 1 }} />
              {nuevoAn.docId && onAbrirDoc && <button className="doc-btn" onClick={() => onAbrirDoc(nuevoAn.docId)}>📄 Abrir el informe</button>}
              {!nuevoAn.docId && <button className="doc-btn" disabled={analizando} onClick={() => anRef.current?.click()}>{analizando ? "⏳ Analizando…" : "📎 Elegir archivo y analizar"}</button>}
              <input ref={anRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" style={{ display: "none" }} onChange={e => analizar(e.target.files?.[0])} />
            </div>
            {nuevoAn.texto && <div className="resultado-body" style={{ marginTop: 8 }}>{renderResultado(nuevoAn.texto)}</div>}
          </div>
        )}
        {analisis.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {PERIODOS.filter(p => analisis.some(a => a.periodo === p)).map(p => (
              <div key={p} style={{ marginBottom: 6 }}>
                <span className="crm-muted">{p}:</span>{" "}
                {analisis.filter(a => a.periodo === p).map(a => (
                  <button key={a.id} className="doc-btn" style={{ margin: "2px 4px 2px 0" }} onClick={() => onAbrirDoc?.(a.id)} title={a.titulo}>📄 {a.titulo.replace(/^Análisis de resultados — /, "").split(" — ")[0]}{a.area && a.area !== clase.area ? ` (${a.area})` : ""}</button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

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
            <button className="doc-btn" disabled={preparando || leyendo || !analisis.some(a => a.periodo === editando.periodo)} onClick={prepararConEva} title="Eva redacta el resumen con los análisis de resultados de esta evaluación">{preparando ? "⏳ Eva está preparando…" : `✨ Que Eva lo prepare (${analisis.filter(a => a.periodo === editando.periodo).length} análisis)`}</button>
            <button className="doc-btn" disabled={leyendo || preparando} onClick={() => fileRef.current?.click()}>{leyendo ? "⏳ Leyendo el acta…" : "📎 Resumir un acta con IA"}</button>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" style={{ display: "none" }} onChange={e => resumirActa(e.target.files?.[0])} />
          </div>
          <textarea className="input-tema" rows={14} style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} value={editando.resumen} onChange={e => setEditando({ ...editando, resumen: e.target.value })} />
          <p className="field-hint">No escribas nombres de alumnos: usa solo sus iniciales. Puedes subir el acta (PDF, Word, Excel o foto) y la IA te propone el resumen para que lo revises.</p>
          <div className="crm-toolbar">
            <button className="doc-btn" onClick={() => { setEditando(null); setError(""); }}>Cancelar</button>
            <span style={{ flex: 1 }} />
            <button className="doc-btn" disabled={guardando || leyendo || preparando} onClick={guardar}>{guardando ? "Guardando…" : "💾 Guardar"}</button>
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
