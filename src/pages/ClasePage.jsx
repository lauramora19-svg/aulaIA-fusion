import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { ESTADOS_DOC, MODO_BADGE, fmtFecha, mensajeError, ordenarAlumnos, nombreCompleto } from "../lib/crm";
import { borrarAlumnoEnAgenda, borrarClaseEnAgenda, borrarGrupoEnAgenda } from "../lib/agenda";
import ProgramarModal from "../components/ProgramarModal";
import RellenarModeloModal from "../components/RellenarModeloModal";
import AgendaVista from "../components/AgendaVista";
import EvaluacionesGrupo from "../components/EvaluacionesGrupo";
import EmptyState from "../components/EmptyState";
import ClaseModal from "../components/ClaseModal";
import { AlumnosModal, SubgruposModal, TransferirModal, VincularModal } from "../components/ClaseModales";

const TABS = [
  { id: "documentos", label: "📄 Documentos" },
  { id: "alumnos", label: "👥 Alumnos" },
  { id: "evaluaciones", label: "📊 Evaluaciones" },
  { id: "agenda", label: "📅 Agenda" },
];

export default function ClasePage({ claseId, clases, onClasesChanged, onNuevoDocumento, onAbrirAlumno, onAbrirDoc, onEliminada }) {
  const [programar, setProgramar] = useState(null);
  const [aviso, setAviso] = useState("");
  const clase = clases.find(c => c.id === claseId);
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("aulaia-tab-clase") || "documentos"; } catch { return "documentos"; } });
  const [alumnos, setAlumnos] = useState([]);
  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [contextoGrupo, setContextoGrupo] = useState("");
  const [menu, setMenu] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [buscar, setBuscar] = useState("");
  const menuRef = useRef(null);

  const cambiarTab = (t) => { setTab(t); try { localStorage.setItem("aulaia-tab-clase", t); } catch {} };

  const cargar = useCallback(async () => {
    if (!claseId) return;
    setCargando(true); setError("");
    const [{ data: al, error: e1 }, { data: dc, error: e2 }] = await Promise.all([
      supabase.from("alumnos").select("*").eq("grupo_id", clases.find(c => c.id === claseId)?.grupo_id || "00000000-0000-0000-0000-000000000000"),
      supabase.from("programaciones").select("id, titulo, modo, tipo_resultado, estado, alumno_id, clase_id, created_at, carpeta").eq("clase_id", claseId).order("created_at", { ascending: false }),
    ]);
    if (e1 || e2) setError(mensajeError(e1 || e2));
    setAlumnos(ordenarAlumnos(al || [])); setDocs(dc || []); setCargando(false);
  }, [claseId, clases]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (modal || !clase?.grupo_id) return;
    supabase.from("grupos").select("contexto").eq("id", clase.grupo_id).maybeSingle().then(({ data }) => setContextoGrupo(data?.contexto || ""));
  }, [clase?.grupo_id, modal]);
  useEffect(() => {
    const f = () => cargar();
    window.addEventListener("aulaia-agenda-sync", f);
    return () => window.removeEventListener("aulaia-agenda-sync", f);
  }, [cargar]);
  useEffect(() => {
    const cerrar = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  if (!clase) return <EmptyState icono="🔎" texto="No se ha encontrado esta clase." />;

  const cambiarEstado = async (id, estado) => {
    setDocs(p => p.map(d => d.id === id ? { ...d, estado } : d));
    const { error } = await supabase.from("programaciones").update({ estado }).eq("id", id);
    if (error) setError(mensajeError(error));
  };
  const desvincular = async (id) => {
    if (!window.confirm("¿Quitar este documento de la clase? Seguirá en tu biblioteca.")) return;
    await supabase.from("programaciones").update({ clase_id: null, alumno_id: null }).eq("id", id);
    cargar();
  };
  const borrarAlumno = async (a) => {
    if (!window.confirm(`¿Eliminar a ${nombreCompleto(a)} del grupo ${clase.nombre}? Se borrará en todas sus asignaturas (y en la Agenda, si está conectada), junto con su seguimiento. Sus documentos seguirán en tu biblioteca.`)) return;
    const { error } = await supabase.from("alumnos").delete().eq("id", a.id);
    if (error) { setError(mensajeError(error)); return; }
    try { await borrarAlumnoEnAgenda(a.agenda_student_id); } catch {}
    cargar();
  };
  const eliminarClase = async () => {
    if (!window.confirm(`¿Eliminar la asignatura ${clase.area || ""} de ${clase.nombre}? El alumnado del grupo NO se borra. Se borrarán sus eventos; los documentos seguirán en tu biblioteca.`)) return;
    const { error } = await supabase.from("clases").delete().eq("id", clase.id);
    if (error) { setError(mensajeError(error)); return; }
    try { await borrarClaseEnAgenda(clase.agenda_class_id); } catch {}
    // Si era la última asignatura del grupo, ofrece borrar también el grupo
    const otras = clases.filter(c => c.grupo_id === clase.grupo_id && c.id !== clase.id);
    if (!otras.length && clase.grupo_id && window.confirm(`${clase.nombre} ya no tiene asignaturas. ¿Quieres borrar también el grupo y sus ${alumnos.length} alumnos?`)) {
      await borrarGrupoCompleto(false);
      return;
    }
    onEliminada();
  };

  // Borra el grupo entero: todas sus asignaturas, su alumnado y su seguimiento.
  // Los documentos generados se conservan en "Mis programaciones".
  const borrarGrupoCompleto = async (preguntar = true) => {
    const asignaturas = clases.filter(c => c.grupo_id === clase.grupo_id);
    if (preguntar) {
      const lista = asignaturas.map(c => c.area || "sin asignatura").join(", ");
      const escrito = window.prompt(`Vas a borrar el grupo ${clase.nombre} COMPLETO:\n• Asignaturas: ${lista}\n• ${alumnos.length} alumnos con su perfil y seguimiento\n• Sus eventos de la agenda\n\nLos documentos generados se conservan en «Mis programaciones».\nNo se puede deshacer. Para confirmar, escribe el nombre del grupo: ${clase.nombre}`);
      if (escrito === null) return;
      if (escrito.trim().toLowerCase().replace(/\s/g, "") !== clase.nombre.trim().toLowerCase().replace(/\s/g, "")) { setError("El nombre no coincide: no se ha borrado nada."); return; }
    }
    try {
      await borrarGrupoEnAgenda(asignaturas.map(c => c.agenda_class_id).filter(Boolean), alumnos.map(a => a.agenda_student_id).filter(Boolean));
    } catch {}
    const ids = asignaturas.map(c => c.id);
    if (ids.length) { const r = await supabase.from("clases").delete().in("id", ids); if (r.error) { setError(mensajeError(r.error)); return; } }
    if (clase.grupo_id) {
      await supabase.from("alumnos").delete().eq("grupo_id", clase.grupo_id);
      const r = await supabase.from("grupos").delete().eq("id", clase.grupo_id);
      if (r.error) { setError(mensajeError(r.error)); return; }
    }
    onEliminada();
  };

  const nombreAlumno = (id) => { const a = alumnos.find(x => x.id === id); return a ? nombreCompleto(a) : ""; };
  const nee = alumnos.filter(a => a.tiene_nee).length;
  const docsFiltrados = docs.filter(d =>
    (!filtroEstado || (d.estado || "borrador") === filtroEstado) &&
    (!buscar || (d.titulo || "").toLowerCase().includes(buscar.toLowerCase())));

  return (
    <div className="crm-page">
      <div className="card crm-clase-header" style={{ borderLeft: `5px solid ${clase.color || "#f97316"}` }}>
        <div>
          <p className="crm-clase-area" style={{ color: clase.color || "#f97316" }}>{clase.area || "Sin área"}{clase.comunidad ? ` · ${clase.comunidad}` : ""}</p>
          <h1 className="library-title">{clase.curso ? `${clase.curso} · ` : ""}{clase.nombre}</h1>
          <div className="crm-clase-stats">
            <span><i className="crm-dot" style={{ background: "#0d9488" }} />{alumnos.length} alumnos</span>
            <span><i className="crm-dot" style={{ background: "#f59e0b" }} />{nee} con NEE</span>
            <span><i className="crm-dot" style={{ background: "#6366f1" }} />{docs.length} documentos</span>
          </div>
          <p className="crm-muted" style={{ margin: "10px 0 0", maxWidth: 640 }}>
            {contextoGrupo
              ? <>📝 <strong>Contexto del grupo:</strong> {contextoGrupo.length > 200 ? contextoGrupo.slice(0, 200) + "…" : contextoGrupo} <button className="btn-back-sm" onClick={() => setModal("editar")}>Editar</button></>
              : <button className="btn-back-sm" onClick={() => setModal("editar")}>📝 Añade el contexto del grupo para que la IA lo tenga en cuenta</button>}
          </p>
        </div>
        <div className="crm-header-actions">
          <button className="library-new-btn" onClick={() => onNuevoDocumento(clase, null)}>✨ Nuevo documento</button>
          <button className="doc-btn" onClick={() => setModal("asignatura")} title="Mismo alumnado, otra asignatura">📚 Añadir asignatura a {clase.nombre}</button>
          <div className="crm-menu-wrap" ref={menuRef}>
            <button className="doc-btn" onClick={() => setMenu(m => !m)}>☰ Acciones</button>
            {menu && (
              <div className="navbar-menu crm-menu">
                <button className="navbar-link" onClick={() => { setMenu(false); setModal("editar"); }}>✏️ Editar clase</button>
                <button className="navbar-link" onClick={() => { setMenu(false); setModal("asignatura"); }}>📚 Añadir otra asignatura a {clase.nombre}</button>
                <button className="navbar-link" onClick={() => { setMenu(false); setModal("modelo"); }}>📋 Rellenar modelo del colegio (acta...)</button>
                <button className="navbar-link" onClick={() => { setMenu(false); setModal("alumnos"); }}>👥 Añadir alumnos</button>
                <button className="navbar-link" onClick={() => { setMenu(false); setModal("subgrupos"); }}>🧩 Gestionar subgrupos</button>
                <button className="navbar-link" onClick={() => { setMenu(false); setModal("transferir"); }}>🔀 Transferir alumno</button>
                <button className="navbar-link" onClick={() => { setMenu(false); setModal("vincular"); }}>🔗 Añadir desde biblioteca</button>
                <button className="navbar-menu-btn" onClick={() => { setMenu(false); eliminarClase(); }}>Eliminar esta asignatura ({clase.area || "—"})</button>
                <button className="navbar-menu-btn" onClick={() => { setMenu(false); borrarGrupoCompleto(); }}>Eliminar el grupo {clase.nombre} completo</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="chips-grid crm-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`chip chip-small ${tab === t.id ? "chip-active" : ""}`} onClick={() => cambiarTab(t.id)}>
            <span className="chip-label">{t.label}</span>
          </button>
        ))}
      </div>

      {error && <p className="error-msg">{error}</p>}
      {aviso && <p className="crm-aviso">{aviso}</p>}

      {cargando && tab !== "agenda" ? <div className="crm-loading"><div className="lib-spinner" /></div> : tab === "documentos" ? (
        docs.length === 0 ? (
          <EmptyState icono="📄" texto="Esta clase aún no tiene documentos." accion="✨ Crear el primero" onAccion={() => onNuevoDocumento(clase, null)} />
        ) : (
          <>
            <div className="crm-toolbar">
              <input className="library-search crm-search" placeholder="🔍 Buscar documento..." value={buscar} onChange={e => setBuscar(e.target.value)} />
              <select className="input-tema crm-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(ESTADOS_DOC).map(([id, e]) => <option key={id} value={id}>{e.label}</option>)}
              </select>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead><tr><th>Título</th><th>Modo</th><th>Para</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {docsFiltrados.map(d => {
                    const b = MODO_BADGE[d.tipo_resultado === "informe" ? "informe" : d.modo] || MODO_BADGE.ordinario;
                    const est = ESTADOS_DOC[d.estado || "borrador"];
                    return (
                      <tr key={d.id}>
                        <td><button className="crm-link" onClick={() => onAbrirDoc(d.id)}>{d.titulo || d.tipo_resultado}</button></td>
                        <td><span className="doc-badge" style={{ color: b.color, borderColor: b.color, background: `${b.color}18` }}>{b.label}</span></td>
                        <td>{d.alumno_id ? <button className="crm-link" onClick={() => onAbrirAlumno(d.alumno_id, clase.id)}>{nombreAlumno(d.alumno_id) || "Alumno/a"}</button> : <span className="crm-muted">Toda la clase</span>}</td>
                        <td className="crm-nowrap">{fmtFecha(d.created_at, { day: "2-digit", month: "short", year: "2-digit" })}</td>
                        <td>
                          <select className="crm-estado" value={d.estado || "borrador"} onChange={e => cambiarEstado(d.id, e.target.value)} style={{ color: est.color, borderColor: est.color }}>
                            {Object.entries(ESTADOS_DOC).map(([id, e]) => <option key={id} value={id}>{e.label}</option>)}
                          </select>
                        </td>
                        <td className="crm-nowrap">
                          <button className="doc-btn" onClick={() => setProgramar(d)} title="Programar en un día">📅</button>{" "}
                          <button className="doc-btn doc-btn-del" onClick={() => desvincular(d.id)} title="Quitar de la clase">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : tab === "alumnos" ? (
        alumnos.length === 0 ? (
          <EmptyState icono="👥" texto="Aún no hay alumnos en esta clase." accion="＋ Añadir alumnos" onAccion={() => setModal("alumnos")} />
        ) : (
          <>
            <div className="crm-toolbar">
              <span className="crm-muted">{alumnos.length} alumnos · {nee} con NEE</span>
              <span style={{ flex: 1 }} />
              <button className="doc-btn" onClick={() => setModal("alumnos")}>＋ Añadir alumnos</button>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead><tr><th>#</th><th>Nombre</th><th>Generar documento adaptado</th><th>Ficha</th><th></th></tr></thead>
                <tbody>
                  {alumnos.map((a, i) => (
                    <tr key={a.id}>
                      <td className="crm-muted">{i + 1}</td>
                      <td>
                        <button className="crm-link" onClick={() => onAbrirAlumno(a.id, clase.id)}><span className="crm-apellidos">{a.apellidos}</span>{a.apellidos ? ", " : ""}{a.nombre}</button>
                        {a.tiene_nee && <span className="doc-badge crm-badge-nee">NEE</span>}
                      </td>
                      <td><button className="doc-btn" onClick={() => onNuevoDocumento(clase, a)}>📄 Generar documento</button></td>
                      <td><button className="doc-btn" onClick={() => onAbrirAlumno(a.id, clase.id)}>📊 Ver ficha</button></td>
                      <td><button className="doc-btn doc-btn-del" onClick={() => borrarAlumno(a)} title="Eliminar alumno">🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : tab === "evaluaciones" ? (
        <EvaluacionesGrupo clase={clase} clases={clases} onAbrirDoc={onAbrirDoc} />
      ) : (
        <AgendaVista clases={clases} claseFija={clase} onAbrirDoc={onAbrirDoc} />
      )}

      {modal === "asignatura" && <ClaseModal grupoFijo={{ id: clase.grupo_id, nombre: clase.nombre, etapa: clase.etapa, curso: clase.curso, comunidad: clase.comunidad }} onClose={() => setModal(null)} onSaved={(c) => { setModal(null); onClasesChanged(c?.id); }} />}
      {modal === "modelo" && <RellenarModeloModal clase={clase} alumnos={alumnos} onClose={() => setModal(null)} onCreado={(id) => { setModal(null); onAbrirDoc(id); }} />}
      {programar && <ProgramarModal doc={programar} onClose={() => setProgramar(null)} onSaved={({ fecha, enAgenda }) => { setProgramar(null); setAviso(`📅 Programado para el ${new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}${enAgenda ? " (también en tu Agenda docente)" : ""}.`); }} />}
      {modal === "editar" && <ClaseModal clase={clase} onClose={() => setModal(null)} onSaved={() => { setModal(null); onClasesChanged(); }} />}
      {modal === "alumnos" && <AlumnosModal clase={clase} onClose={() => setModal(null)} onSaved={() => { setModal(null); cambiarTab("alumnos"); cargar(); }} />}
      {modal === "subgrupos" && <SubgruposModal clase={clase} alumnos={alumnos} onClose={() => setModal(null)} />}
      {modal === "transferir" && <TransferirModal clase={clase} clases={clases} alumnos={alumnos} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar(); }} />}
      {modal === "vincular" && <VincularModal clase={clase} onClose={() => setModal(null)} onSaved={() => { setModal(null); cambiarTab("documentos"); cargar(); }} />}
    </div>
  );
}
