import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { COMUNIDADES, ETAPAS, CURSOS, AREAS } from "../lib/datos";
import { mensajeError } from "../lib/crm";
import { pedirSincronizacion } from "../lib/agenda";
import Modal from "./Modal";
import Campo from "./Campo";

const COLORES = ["#f97316", "#f59e0b", "#0d9488", "#6366f1", "#ec4899", "#84cc16"];

// grupoFijo: para "añadir otra asignatura a este grupo" (mismo alumnado)
export default function ClaseModal({ clase, grupoFijo, onClose, onSaved }) {
  const editando = !!clase?.id;
  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState(clase?.grupo_id || grupoFijo?.id || "nuevo");
  useEffect(() => { supabase.from("grupos").select("*").order("nombre").then(({ data }) => setGrupos(data || [])); }, []);
  const [nombre, setNombre] = useState(clase?.nombre || grupoFijo?.nombre || "");
  const [etapa, setEtapa] = useState(clase?.etapa || grupoFijo?.etapa || "primaria");
  const [curso, setCurso] = useState(clase?.curso || grupoFijo?.curso || "");
  const [area, setArea] = useState(clase?.area || "");
  const [comunidad, setComunidad] = useState(clase?.comunidad || grupoFijo?.comunidad || "Madrid");
  const [color, setColor] = useState(clase?.color || COLORES[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const elegirGrupo = (id) => {
    setGrupoId(id);
    const g = grupos.find(x => x.id === id);
    if (g) { setNombre(g.nombre); if (g.etapa) setEtapa(g.etapa); setCurso(g.curso || ""); if (g.comunidad) setComunidad(g.comunidad); }
    else setNombre("");
  };

  const guardar = async () => {
    if (!nombre.trim()) { setError("Escribe un nombre para el grupo (ej: 1º A)."); return; }
    if (!area) { setError("Elige la asignatura."); return; }
    setGuardando(true); setError("");
    // 1. Grupo (se crea si es nuevo; si existe, se actualizan sus datos)
    let gid = grupoId;
    const filaGrupo = { nombre: nombre.trim(), etapa, curso: curso || null, comunidad };
    if (gid === "nuevo") {
      const { data, error } = await supabase.from("grupos").insert(filaGrupo).select().single();
      if (error) { setGuardando(false); setError(mensajeError(error)); return; }
      gid = data.id;
    } else {
      await supabase.from("grupos").update(filaGrupo).eq("id", gid);
    }
    // Evita duplicar la misma asignatura en el mismo grupo
    const { data: ya } = await supabase.from("clases").select("id").eq("grupo_id", gid).eq("area", area);
    if ((ya || []).some(x => x.id !== clase?.id)) { setGuardando(false); setError(`${nombre.trim()} ya tiene la asignatura ${area}.`); return; }
    // 2. Asignatura (clase)
    const fila = { nombre: nombre.trim(), etapa, curso: curso || null, area, comunidad, color, grupo_id: gid };
    const { data, error } = editando
      ? await supabase.from("clases").update(fila).eq("id", clase.id).select().single()
      : await supabase.from("clases").insert(fila).select().single();
    setGuardando(false);
    if (error) { setError(mensajeError(error)); return; }
    if (editando && clase.grupo_id === gid) await supabase.from("clases").update({ nombre: fila.nombre, curso: fila.curso, etapa, comunidad }).eq("grupo_id", gid);
    pedirSincronizacion();
    onSaved(data);
  };

  return (
    <Modal titulo={editando ? "Editar clase" : grupoFijo ? `Nueva asignatura para ${grupoFijo.nombre}` : "Nueva clase"} onClose={onClose} ancho={600}>
      <div className="crm-form">
        {!grupoFijo && (
          <Campo label="Grupo" hint="Si el grupo ya existe (ej. 1º A en Lengua), elígelo para añadir otra asignatura con el mismo alumnado.">
            <select className="input-tema" value={grupoId} onChange={e => elegirGrupo(e.target.value)} disabled={editando && !!clase?.grupo_id}>
              <option value="nuevo">＋ Grupo nuevo</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.curso ? ` · ${g.curso}` : ""}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Nombre del grupo">
          <input className="input-tema" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: 1º A" autoFocus={!grupoFijo} maxLength={60} />
        </Campo>
        <Campo label="Etapa">
          <div className="chips-grid">
            {ETAPAS.map(e => (
              <button key={e.id} type="button" className={`chip chip-small ${etapa === e.id ? "chip-active" : ""}`} onClick={() => { setEtapa(e.id); setCurso(""); setArea(""); }}>
                <span className="chip-label">{e.emoji} {e.label}</span>
              </button>
            ))}
          </div>
        </Campo>
        <div className="crm-form-row">
          <Campo label="Curso">
            <select className="input-tema" value={curso} onChange={e => setCurso(e.target.value)}>
              <option value="">— Elige —</option>
              {(CURSOS[etapa] || []).map(c => <option key={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Área o asignatura">
            <select className="input-tema" value={area} onChange={e => setArea(e.target.value)}>
              <option value="">— Elige —</option>
              {(AREAS[etapa] || []).map(a => <option key={a}>{a}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Comunidad autónoma">
          <select className="input-tema" value={comunidad} onChange={e => setComunidad(e.target.value)}>
            {COMUNIDADES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo label="Color">
          <div className="crm-colores">
            {COLORES.map(c => (
              <span key={c} role="radio" aria-checked={color === c} tabIndex={0}
                className={`crm-color ${color === c ? "crm-color-on" : ""}`} style={{ background: c }}
                onClick={() => setColor(c)} onKeyDown={e => e.key === "Enter" && setColor(c)} />
            ))}
          </div>
        </Campo>
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          <button className="library-new-btn" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear clase"}</button>
        </div>
      </div>
    </Modal>
  );
}
