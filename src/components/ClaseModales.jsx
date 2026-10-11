import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError, fmtFecha, partirNombre, nombreCompleto } from "../lib/crm";
import { pedirSincronizacion } from "../lib/agenda";
import Modal from "./Modal";
import Campo from "./Campo";

// ── Añadir alumnado (uno por línea) ─────────────────────────────────────────
export function AlumnosModal({ clase, onClose, onSaved }) {
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const nombres = texto.split("\n").map(n => n.trim()).filter(Boolean);

  const guardar = async () => {
    if (!nombres.length) { setError("Escribe al menos un nombre."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("alumnos").insert(nombres.map(n => ({ clase_id: clase.id, grupo_id: clase.grupo_id, ...partirNombre(n) })));
    setGuardando(false);
    if (error) { setError(mensajeError(error)); return; }
    pedirSincronizacion();
    onSaved();
  };

  return (
    <Modal titulo={`Añadir alumnos a ${clase.nombre}`} onClose={onClose}>
      <div className="crm-form">
        <Campo label="Un alumno por línea: nombre y después apellidos" hint="Se ordenarán por apellido. 🔒 Por privacidad puedes usar solo las iniciales de los apellidos (ej: Paula A. D.).">
          <textarea className="textarea" rows={8} value={texto} onChange={e => setTexto(e.target.value)} placeholder={"Paula A. D.\nMireia B. B.\nJan G. C."} autoFocus />
        </Campo>
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span className="crm-muted">{nombres.length} alumno{nombres.length === 1 ? "" : "s"}</span>
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          <button className="library-new-btn" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Añadir"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Gestionar subgrupos ─────────────────────────────────────────────────────
export function SubgruposModal({ clase, alumnos, onClose, onChanged }) {
  const [subgrupos, setSubgrupos] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState("");

  const cargar = async () => {
    const { data: sg, error } = await supabase.from("subgrupos").select("*").eq("clase_id", clase.id).order("created_at");
    if (error) { setError(mensajeError(error)); return; }
    setSubgrupos(sg || []);
    const ids = (sg || []).map(s => s.id);
    if (ids.length) {
      const { data: m } = await supabase.from("subgrupo_alumnos").select("*").in("subgrupo_id", ids);
      setMiembros(m || []);
    } else setMiembros([]);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!nuevo.trim()) return;
    const { error } = await supabase.from("subgrupos").insert({ clase_id: clase.id, nombre: nuevo.trim() });
    if (error) { setError(mensajeError(error)); return; }
    setNuevo(""); cargar(); onChanged?.();
  };
  const borrar = async (id) => {
    if (!window.confirm("¿Eliminar este subgrupo? El alumnado no se borra.")) return;
    await supabase.from("subgrupos").delete().eq("id", id); cargar(); onChanged?.();
  };
  const toggle = async (sgId, alId) => {
    const esta = miembros.some(m => m.subgrupo_id === sgId && m.alumno_id === alId);
    const { error } = esta
      ? await supabase.from("subgrupo_alumnos").delete().eq("subgrupo_id", sgId).eq("alumno_id", alId)
      : await supabase.from("subgrupo_alumnos").insert({ subgrupo_id: sgId, alumno_id: alId });
    if (error) { setError(mensajeError(error)); return; }
    cargar(); onChanged?.();
  };

  return (
    <Modal titulo="Subgrupos" onClose={onClose} ancho={640}>
      <div className="crm-form">
        <div className="crm-form-row crm-form-row-btn">
          <input className="input-tema" value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Ej: Refuerzo lectoescritura" onKeyDown={e => e.key === "Enter" && crear()} />
          <button className="library-new-btn" onClick={crear}>＋ Crear</button>
        </div>
        {error && <p className="error-msg">{error}</p>}
        {subgrupos.length === 0 && <p className="crm-muted">Aún no hay subgrupos. Úsalos para refuerzo, ampliación o grupos NEE.</p>}
        {subgrupos.map(sg => (
          <div key={sg.id} className="card crm-subgrupo">
            <div className="crm-section-head">
              <strong>{sg.nombre}</strong>
              <button className="doc-btn doc-btn-del" onClick={() => borrar(sg.id)}>🗑️</button>
            </div>
            <div className="chips-grid">
              {alumnos.map(a => {
                const on = miembros.some(m => m.subgrupo_id === sg.id && m.alumno_id === a.id);
                return (
                  <button key={a.id} className={`chip chip-small ${on ? "chip-active" : ""}`} onClick={() => toggle(sg.id, a.id)}>
                    <span className="chip-label">{on ? "✓ " : ""}{nombreCompleto(a)}</span>
                  </button>
                );
              })}
              {alumnos.length === 0 && <p className="crm-muted">Primero añade alumnado a la clase.</p>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Transferir alumno a otro grupo ──────────────────────────────────────────
export function TransferirModal({ clase, alumnos, onClose, onSaved }) {
  const [alumnoId, setAlumnoId] = useState("");
  const [destino, setDestino] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { supabase.from("grupos").select("*").order("nombre").then(({ data }) => setGrupos((data || []).filter(g => g.id !== clase.grupo_id))); }, []);

  const mover = async () => {
    if (!alumnoId || !destino) { setError("Elige el alumno y el grupo de destino."); return; }
    const { data: cl } = await supabase.from("clases").select("id").eq("grupo_id", destino).limit(1);
    const { error } = await supabase.from("alumnos").update({ grupo_id: destino, clase_id: cl?.[0]?.id || null }).eq("id", alumnoId);
    if (error) { setError(mensajeError(error)); return; }
    await supabase.from("subgrupo_alumnos").delete().eq("alumno_id", alumnoId);
    pedirSincronizacion();
    onSaved();
  };

  return (
    <Modal titulo="Transferir alumno a otro grupo" onClose={onClose}>
      <div className="crm-form">
        {grupos.length === 0 ? <p className="crm-muted">Necesitas al menos otro grupo creado.</p> : <>
          <Campo label="Alumno/a">
            <select className="input-tema" value={alumnoId} onChange={e => setAlumnoId(e.target.value)}>
              <option value="">— Elige —</option>
              {alumnos.map(a => <option key={a.id} value={a.id}>{nombreCompleto(a)}</option>)}
            </select>
          </Campo>
          <Campo label="Grupo de destino" hint="Su perfil, seguimiento y documentos se mueven con él/ella.">
            <select className="input-tema" value={destino} onChange={e => setDestino(e.target.value)}>
              <option value="">— Elige —</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.curso ? ` · ${g.curso}` : ""}</option>)}
            </select>
          </Campo>
        </>}
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          {grupos.length > 0 && <button className="library-new-btn" onClick={mover}>Transferir</button>}
        </div>
      </div>
    </Modal>
  );
}

// ── Vincular programaciones ya guardadas a esta clase ───────────────────────
export function VincularModal({ clase, onClose, onSaved }) {
  const [docs, setDocs] = useState(null);
  const [sel, setSel] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("programaciones").select("id, titulo, tipo_resultado, curso, area, created_at")
      .is("clase_id", null).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }) => { if (error) setError(mensajeError(error)); setDocs(data || []); });
  }, []);

  const vincular = async () => {
    if (!sel.length) return;
    const { error } = await supabase.from("programaciones").update({ clase_id: clase.id }).in("id", sel);
    if (error) { setError(mensajeError(error)); return; }
    onSaved();
  };

  return (
    <Modal titulo="Añadir desde mi biblioteca" onClose={onClose} ancho={640}>
      <div className="crm-form">
        {docs === null ? <div className="crm-loading"><div className="lib-spinner" /></div> :
          docs.length === 0 ? <p className="crm-muted">No hay programaciones sin clase asignada.</p> : (
            <div className="crm-check-list">
              {docs.map(d => (
                <label key={d.id} className="crm-check">
                  <input type="checkbox" checked={sel.includes(d.id)} onChange={() => setSel(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])} />
                  <span><strong>{d.titulo || d.tipo_resultado}</strong><br /><small className="crm-muted">{[d.curso, d.area, fmtFecha(d.created_at)].filter(Boolean).join(" · ")}</small></span>
                </label>
              ))}
            </div>
          )}
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span className="crm-muted">{sel.length} seleccionado{sel.length === 1 ? "" : "s"}</span>
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          <button className="library-new-btn" onClick={vincular} disabled={!sel.length}>Añadir a {clase.nombre}</button>
        </div>
      </div>
    </Modal>
  );
}
