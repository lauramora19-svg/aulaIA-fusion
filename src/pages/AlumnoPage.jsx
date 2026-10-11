import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { NECESIDADES } from "../lib/datos";
import { leerStreamSSE } from "../lib/stream";
import { TIPOS_SEGUIMIENTO, ESTADOS_DOC, MODO_BADGE, trimestres, trimestreActual, fmtFecha, mensajeError, nombreCompleto } from "../lib/crm";
import { pedirSincronizacion } from "../lib/agenda";
import AgendaVista from "../components/AgendaVista";
import EmptyState from "../components/EmptyState";
import Campo from "../components/Campo";

const FIRMA = "✅ Documento completo generado por AulaIA";

export default function AlumnoPage({ alumnoId, claseId, clases, onVolverClase, onNuevoDocumento, onAbrirDoc }) {
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaId, setPlantillaId] = useState("");
  useEffect(() => { supabase.from("plantillas").select("id, nombre, tipo").order("created_at", { ascending: false }).then(({ data }) => { setPlantillas(data || []); const inf = (data || []).find(p => p.tipo === "informe"); if (inf) setPlantillaId(inf.id); }); }, []);
  const [alumno, setAlumno] = useState(null);
  const [docs, setDocs] = useState([]);
  const [seguimiento, setSeguimiento] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [trim, setTrim] = useState(trimestreActual());
  // Perfil NEE (edición)
  const [editPerfil, setEditPerfil] = useState(false);
  const [perfil, setPerfil] = useState({ tiene_nee: false, necesidades: [], medidas: "", apoyos: "", notas: "", nombre: "", apellidos: "", tipo_texto: "" });
  // Nuevo registro de seguimiento
  const [segTipo, setSegTipo] = useState("observacion");
  const [segTexto, setSegTexto] = useState("");
  // Informe
  const [informe, setInforme] = useState("");
  const [generando, setGenerando] = useState(false);
  const [abort, setAbort] = useState(null);

  const clasesGrupo = clases.filter(c => alumno && c.grupo_id === alumno.grupo_id);
  const clase = clasesGrupo.find(c => c.id === claseId) || clasesGrupo[0] || clases.find(c => c.id === alumno?.clase_id);
  const tri = trimestres().find(t => t.id === trim);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const { data: a, error: e1 } = await supabase.from("alumnos").select("*").eq("id", alumnoId).single();
    if (e1 || !a) { setError(mensajeError(e1) || "No se ha encontrado el alumno."); setCargando(false); return; }
    setAlumno(a);
    setPerfil({ tiene_nee: !!a.tiene_nee, necesidades: a.perfil_nee?.necesidades || [], medidas: a.perfil_nee?.medidas || "", apoyos: a.perfil_nee?.apoyos || "", notas: a.notas || "", nombre: a.nombre, apellidos: a.apellidos || "", tipo_texto: a.perfil_nee?.tipo_texto || "" });
    const [{ data: d }, { data: s }] = await Promise.all([
      supabase.from("programaciones").select("id, titulo, modo, tipo_resultado, estado, created_at").eq("alumno_id", alumnoId).order("created_at", { ascending: false }),
      supabase.from("seguimiento").select("*").eq("alumno_id", alumnoId).order("fecha", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    setDocs(d || []); setSeguimiento(s || []); setCargando(false);
  }, [alumnoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarPerfil = async () => {
    if (!perfil.nombre.trim()) { setError("El nombre no puede quedar vacío."); return; }
    const fila = {
      nombre: perfil.nombre.trim(), apellidos: perfil.apellidos.trim(), tiene_nee: perfil.tiene_nee, notas: perfil.notas.trim() || null,
      perfil_nee: perfil.tiene_nee ? { necesidades: perfil.necesidades, medidas: perfil.medidas.trim(), apoyos: perfil.apoyos.trim(), tipo_texto: perfil.tipo_texto.trim() } : {},
    };
    const { error } = await supabase.from("alumnos").update(fila).eq("id", alumnoId);
    if (error) { setError(mensajeError(error)); return; }
    setEditPerfil(false); cargar(); pedirSincronizacion();
  };

  const añadirSeguimiento = async () => {
    if (!segTexto.trim()) return;
    const { error } = await supabase.from("seguimiento").insert({ alumno_id: alumnoId, tipo: segTipo, texto: segTexto.trim() });
    if (error) { setError(mensajeError(error)); return; }
    setSegTexto(""); cargar();
  };
  const borrarSeguimiento = async (id) => {
    if (!window.confirm("¿Borrar este registro?")) return;
    await supabase.from("seguimiento").delete().eq("id", id); cargar();
  };

  const segTrimestre = seguimiento.filter(s => { const f = new Date(s.fecha + "T12:00:00"); return f >= tri.desde && f <= tri.hasta; });

  const generarInforme = async () => {
    if (!alumno || generando) return;
    const nee = alumno.tiene_nee ? (alumno.perfil_nee?.necesidades || []).map(id => NECESIDADES.find(n => n.id === id)?.desc || id).join(", ") : "";
    const registros = segTrimestre.length
      ? segTrimestre.map(s => `- [${fmtFecha(s.fecha + "T12:00:00", { day: "2-digit", month: "2-digit" })}] ${TIPOS_SEGUIMIENTO[s.tipo]?.label || s.tipo}: ${s.texto}`).join("\n")
      : "- (No hay registros de seguimiento en este trimestre. Indícalo con prudencia y propone qué observar.)";
    const documentos = docs.filter(d => d.tipo_resultado !== "informe").map(d => `- ${d.titulo} (${ESTADOS_DOC[d.estado || "borrador"].label})`).join("\n") || "- Ninguno";
    const prompt = `Redacta el INFORME DE SEGUIMIENTO del ${tri.label} (${fmtFecha(tri.desde, { day: "numeric", month: "long" })} – ${fmtFecha(tri.hasta, { day: "numeric", month: "long", year: "numeric" })}) del alumno/a ${nombreCompleto(alumno)}.

DATOS:
- Clase: ${clase?.nombre || ""} · ${clase?.curso || ""} · ${clase?.area || ""} · ${clase?.comunidad || ""}
${alumno.tiene_nee ? `- Necesidades educativas: ${nee || "no especificadas"}
- Medidas aplicadas: ${alumno.perfil_nee?.medidas || "no especificadas"}
- Apoyos: ${alumno.perfil_nee?.apoyos || "no especificados"}` : "- Alumno/a sin necesidades educativas específicas registradas"}${alumno.perfil_nee?.tipo_texto ? `\n- Descripción: ${alumno.perfil_nee.tipo_texto}` : ""}

REGISTROS DE SEGUIMIENTO DEL TRIMESTRE:
${registros}

DOCUMENTOS DE INTERVENCIÓN VINCULADOS:
${documentos}

ESTRUCTURA:
# Informe de seguimiento — ${tri.label}
## 1. Datos de identificación
## 2. Valoración general del trimestre
## 3. Logros y puntos fuertes
## 4. Dificultades y aspectos a mejorar
## 5. Medidas aplicadas y su eficacia
## 6. Propuestas para el próximo trimestre
## 7. Orientaciones para la familia

REGLAS:
- Basa TODO en los registros; no inventes hechos concretos que no aparezcan.
- Tono profesional, positivo y respetuoso; válido para el expediente y para compartir con la familia.
- Nomenclatura LOMLOE. No incluyas diagnósticos clínicos.
- Usa **negrita** solo para ideas clave y cierra siempre los **.
- Al terminar escribe exactamente en una línea separada:
---
${FIRMA}`;

    const controller = new AbortController();
    setAbort(controller); setGenerando(true); setInforme(""); setError("");
    try {
      const res = await fetch("/api/generar", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ comunidad: clase?.comunidad, etapa: clase?.etapa, curso: clase?.curso, area: clase?.area, modo: alumno.tiene_nee ? "nee" : "ordinario", tipoResultado: "informe", idioma: "Castellano", promptOverride: plantillaId ? prompt.replace(/ESTRUCTURA:[\s\S]*?REGLAS:/, "ESTRUCTURA: la del MODELO OFICIAL DEL CENTRO adjunto.\n\nREGLAS:") : prompt, plantillaId: plantillaId || null, accessToken: (await supabase.auth.getSession()).data.session?.access_token }),
      });
      if (!res.ok) throw new Error("api");
      let full = "";
      await leerStreamSSE(res, (d) => { full += d; setInforme(full); }, controller.signal);
      if (controller.signal.aborted || !full) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ins, error } = await supabase.from("programaciones").insert({
        user_id: user.id, titulo: `Informe ${tri.label} — ${nombreCompleto(alumno)}`,
        modo: alumno.tiene_nee ? "nee" : "ordinario", tipo_resultado: "informe",
        comunidad: clase?.comunidad, etapa: clase?.etapa, curso: clase?.curso, area: clase?.area,
        contenido: full.replace(/\n?---\n?✅ Documento completo generado por AulaIA\s*$/, "").trimEnd(),
        compartido: false, clase_id: clase?.id || null, alumno_id: alumno.id,
      }).select("id").single();
      if (error) throw error;
      setInforme(""); onAbrirDoc(ins.id);
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message === "api" ? "Error al generar el informe. Inténtalo de nuevo." : mensajeError(e));
    } finally { setGenerando(false); setAbort(null); }
  };

  if (cargando && !alumno) return <div className="crm-loading"><div className="lib-spinner" /></div>;
  if (!alumno) return <EmptyState icono="🔎" texto={error || "No se ha encontrado el alumno."} />;

  const toggleNee = (id) => setPerfil(p => ({ ...p, necesidades: p.necesidades.includes(id) ? p.necesidades.filter(x => x !== id) : [...p.necesidades, id] }));
  const informes = docs.filter(d => d.tipo_resultado === "informe");
  const otrosDocs = docs.filter(d => d.tipo_resultado !== "informe");

  return (
    <div className="crm-page">
      {clase && <button className="btn-back-sm" onClick={() => onVolverClase(clase.id)}>← {clase.nombre}{clase.area ? ` · ${clase.area}` : ""}</button>}

      <div className="card crm-clase-header">
        <div className="crm-alumno-id">
          <span className="crm-avatar" style={{ background: clase?.color || "#f97316" }}>{(alumno.nombre || "?")[0]?.toUpperCase()}</span>
          <div>
            <h1 className="library-title">{nombreCompleto(alumno)} {alumno.tiene_nee && <span className="doc-badge crm-badge-nee">NEE</span>}</h1>
            <p className="library-sub">{[clase?.curso, clase?.nombre].filter(Boolean).join(" · ")}{clasesGrupo.length ? ` · ${clasesGrupo.map(c => c.area).filter(Boolean).join(", ")}` : ""}</p>
          </div>
        </div>
        <div className="crm-header-actions">
          <button className="doc-btn" onClick={() => onNuevoDocumento(clase, alumno)}>📄 Generar documento</button>
          {plantillas.length > 0 && (
            <select className="input-tema crm-select" value={plantillaId} onChange={e => setPlantillaId(e.target.value)} title="Modelo de informe">
              <option value="">Informe estándar de AulaIA</option>
              {plantillas.map(p => <option key={p.id} value={p.id}>📋 {p.nombre}</option>)}
            </select>
          )}
          <button className="library-new-btn" onClick={generarInforme} disabled={generando}>{generando ? "⏳ Generando informe..." : "📊 Generar informe"}</button>
        </div>
      </div>

      <div className="chips-grid crm-tabs">
        {trimestres().map(t => (
          <button key={t.id} className={`chip chip-small ${trim === t.id ? "chip-active" : ""}`} onClick={() => setTrim(t.id)}>
            <span className="chip-label">{t.label}</span>
          </button>
        ))}
        <span className="crm-muted crm-trim-rango">{fmtFecha(tri.desde, { day: "2-digit", month: "short" })} – {fmtFecha(tri.hasta, { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {(generando || informe) && (
        <div className="card">
          <div className="crm-section-head">
            <strong>📊 Informe del {tri.label}</strong>
            {generando && abort && <button className="doc-btn doc-btn-del" onClick={() => abort.abort()}>⏹ Cancelar</button>}
          </div>
          <pre className="crm-informe-live">{informe || "Preparando el informe..."}</pre>
          <p className="field-hint">Al terminar se guardará automáticamente y se abrirá para que puedas revisarlo y descargarlo en Word.</p>
        </div>
      )}

      <div className="crm-grid-2">
        <section className="card">
          <div className="crm-section-head">
            <h2 className="crm-card-title">🧩 Perfil del alumno/a</h2>
            {!editPerfil && <button className="doc-btn" onClick={() => setEditPerfil(true)}>✏️ Editar</button>}
          </div>
          {editPerfil ? (
            <div className="crm-form">
              <div className="crm-form-row">
                <Campo label="Nombre"><input className="input-tema" value={perfil.nombre} onChange={e => setPerfil(p => ({ ...p, nombre: e.target.value }))} /></Campo>
                <Campo label="Apellidos (o iniciales)"><input className="input-tema" value={perfil.apellidos} onChange={e => setPerfil(p => ({ ...p, apellidos: e.target.value }))} /></Campo>
              </div>
              <label className="crm-check"><input type="checkbox" checked={perfil.tiene_nee} onChange={e => setPerfil(p => ({ ...p, tiene_nee: e.target.checked }))} /> <span>Presenta necesidades educativas (NEE / NEAE)</span></label>
              {perfil.tiene_nee && <>
                <p className="field-hint">🔒 Registra solo información pedagógica. No incluyas diagnósticos clínicos detallados ni informes médicos.</p>
                <div className="chips-grid">
                  {NECESIDADES.map(n => (
                    <button key={n.id} type="button" className={`chip chip-small ${perfil.necesidades.includes(n.id) ? "chip-active" : ""}`} onClick={() => toggleNee(n.id)}>
                      <span className="chip-label">{n.emoji} {n.label}</span>
                    </button>
                  ))}
                </div>
                <Campo label="Descripción breve (se comparte con la Agenda)"><input className="input-tema" value={perfil.tipo_texto} onChange={e => setPerfil(p => ({ ...p, tipo_texto: e.target.value }))} placeholder="Ej: Dislexia — necesita más tiempo en lectura" maxLength={160} /></Campo>
                <Campo label="Medidas (ordinarias / específicas)"><textarea className="textarea" rows={3} value={perfil.medidas} onChange={e => setPerfil(p => ({ ...p, medidas: e.target.value }))} placeholder="Ej: ubicación cerca del docente, apoyos visuales, tiempo extra..." /></Campo>
                <Campo label="Apoyos (PT, AL, otros)"><textarea className="textarea" rows={2} value={perfil.apoyos} onChange={e => setPerfil(p => ({ ...p, apoyos: e.target.value }))} placeholder="Ej: PT 2 sesiones/semana dentro del aula" /></Campo>
              </>}
              <Campo label="Notas"><textarea className="textarea" rows={2} value={perfil.notas} onChange={e => setPerfil(p => ({ ...p, notas: e.target.value }))} /></Campo>
              <div className="crm-modal-actions">
                <span style={{ flex: 1 }} />
                <button className="btn-back" onClick={() => { setEditPerfil(false); cargar(); }}>Cancelar</button>
                <button className="library-new-btn" onClick={guardarPerfil}>Guardar</button>
              </div>
            </div>
          ) : (
            <div className="crm-perfil">
              {!alumno.tiene_nee ? <p className="crm-muted">Sin necesidades educativas registradas.</p> : <>
                <div className="chips-grid">
                  {(alumno.perfil_nee?.necesidades || []).map(id => { const n = NECESIDADES.find(x => x.id === id); return <span key={id} className="doc-badge crm-badge-nee">{n ? `${n.emoji} ${n.label}` : id}</span>; })}
                </div>
                {alumno.perfil_nee?.tipo_texto && <p>{alumno.perfil_nee.tipo_texto}</p>}
                {alumno.perfil_nee?.medidas && <p><strong>Medidas:</strong> {alumno.perfil_nee.medidas}</p>}
                {alumno.perfil_nee?.apoyos && <p><strong>Apoyos:</strong> {alumno.perfil_nee.apoyos}</p>}
              </>}
              {alumno.notas && <p><strong>Notas:</strong> {alumno.notas}</p>}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="crm-card-title">📄 Documentos</h2>
          {otrosDocs.length === 0 ? <p className="crm-muted">Aún no hay documentos para este alumno/a.</p> : (
            <div className="crm-doc-list">
              {otrosDocs.map(d => {
                const b = MODO_BADGE[d.modo] || MODO_BADGE.ordinario; const e = ESTADOS_DOC[d.estado || "borrador"];
                return (
                  <button key={d.id} className="crm-doc-item" onClick={() => onAbrirDoc(d.id)}>
                    <span className="crm-ellipsis">{d.titulo}</span>
                    <span className="doc-badge" style={{ color: b.color, borderColor: b.color }}>{b.label}</span>
                    <span className="doc-badge" style={{ color: e.color, borderColor: e.color }}>{e.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <h2 className="crm-card-title" style={{ marginTop: 18 }}>📊 Informes</h2>
          {informes.length === 0 ? <p className="crm-muted">Crea tu primer informe con «Generar informe».</p> : (
            <div className="crm-doc-list">
              {informes.map(d => (
                <button key={d.id} className="crm-doc-item" onClick={() => onAbrirDoc(d.id)}>
                  <span className="crm-ellipsis">{d.titulo}</span><span className="crm-muted">{fmtFecha(d.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="crm-card-title">📝 Seguimiento · {tri.label}</h2>
        <div className="crm-seg-form">
          <div className="chips-grid">
            {Object.entries(TIPOS_SEGUIMIENTO).map(([id, t]) => (
              <button key={id} className={`chip chip-small ${segTipo === id ? "chip-active" : ""}`} onClick={() => setSegTipo(id)}>
                <span className="chip-label">{t.emoji} {t.label}</span>
              </button>
            ))}
          </div>
          <div className="crm-form-row crm-form-row-btn">
            <input className="input-tema" value={segTexto} onChange={e => setSegTexto(e.target.value)} placeholder="Ej: Ha leído en voz alta sin apoyo por primera vez" onKeyDown={e => e.key === "Enter" && añadirSeguimiento()} maxLength={500} />
            <button className="library-new-btn" onClick={añadirSeguimiento}>Añadir</button>
          </div>
        </div>
        {segTrimestre.length === 0 ? <p className="crm-muted">No hay registros en este trimestre.</p> : (
          <ul className="crm-timeline">
            {segTrimestre.map(s => { const t = TIPOS_SEGUIMIENTO[s.tipo] || TIPOS_SEGUIMIENTO.observacion; return (
              <li key={s.id} style={{ borderLeftColor: t.color }}>
                <span className="crm-evento-hora">{fmtFecha(s.fecha + "T12:00:00", { day: "2-digit", month: "short" })} · {t.emoji} {t.label}</span>
                <p>{s.texto}</p>
                <button className="btn-back-sm crm-timeline-del" onClick={() => borrarSeguimiento(s.id)} title="Borrar">✕</button>
              </li>
            ); })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="crm-card-title">📅 Agenda de {alumno.nombre}</h2>
        <AgendaVista clases={clases} claseFija={clase} alumnoFijo={alumno} compacta onAbrirDoc={onAbrirDoc} />
      </section>
    </div>
  );
}
