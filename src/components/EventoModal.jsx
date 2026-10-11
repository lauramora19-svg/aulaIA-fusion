import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { TIPOS_EVENTO, toLocalInput, mensajeError, nombreCompleto, ordenarAlumnos } from "../lib/crm";
import { quitarDeAgenda } from "../lib/agenda";
import Modal from "./Modal";
import Campo from "./Campo";

// Crear / editar un evento de la agenda
export default function EventoModal({ evento, clases, claseFija, alumnoFijo, fechaInicial, onClose, onSaved, onAbrirDoc }) {
  const editando = !!evento?.id;
  const base = fechaInicial ? new Date(fechaInicial) : new Date();
  if (!fechaInicial && !evento) { base.setMinutes(0, 0, 0); base.setHours(base.getHours() + 1); }
  const [titulo, setTitulo] = useState(evento?.titulo || "");
  const [tipo, setTipo] = useState(evento?.tipo || (alumnoFijo ? "reunion_familia" : "sesion"));
  const [claseId, setClaseId] = useState(evento?.clase_id || claseFija?.id || "");
  const [alumnoId, setAlumnoId] = useState(evento?.alumno_id || alumnoFijo?.id || "");
  const [inicio, setInicio] = useState(toLocalInput(evento?.inicio || base));
  const [fin, setFin] = useState(evento?.fin ? toLocalInput(evento.fin) : toLocalInput(new Date(new Date(evento?.inicio || base).getTime() + 60 * 60000)));
  const [notas, setNotas] = useState(evento?.notas || "");
  const [alumnos, setAlumnos] = useState(alumnoFijo ? [alumnoFijo] : []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (alumnoFijo || !claseId) { if (!alumnoFijo) setAlumnos([]); return; }
    supabase.from("alumnos").select("id, nombre, apellidos, created_at").eq("grupo_id", clases.find(c => c.id === claseId)?.grupo_id || "00000000-0000-0000-0000-000000000000")
      .then(({ data }) => setAlumnos(ordenarAlumnos(data || [])));
  }, [claseId, alumnoFijo]);

  const guardar = async () => {
    if (!titulo.trim()) { setError("Escribe un título para el evento."); return; }
    if (fin && new Date(fin) < new Date(inicio)) { setError("La hora de fin es anterior a la de inicio."); return; }
    setGuardando(true); setError("");
    const fila = {
      titulo: titulo.trim(), tipo, notas: notas.trim() || null,
      clase_id: claseId || null, alumno_id: alumnoId || null,
      inicio: new Date(inicio).toISOString(), fin: fin ? new Date(fin).toISOString() : null,
    };
    const { error } = editando
      ? await supabase.from("agenda_eventos").update(fila).eq("id", evento.id)
      : await supabase.from("agenda_eventos").insert(fila);
    setGuardando(false);
    if (error) { setError(mensajeError(error)); return; }
    onSaved();
  };

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar este evento?")) return;
    const { error } = await supabase.from("agenda_eventos").delete().eq("id", evento.id);
    if (error) { setError(mensajeError(error)); return; }
    if (evento.agenda_ref) { try { await quitarDeAgenda(evento.agenda_ref); } catch {} }
    onSaved();
  };

  return (
    <Modal titulo={editando ? "Editar evento" : "Nuevo evento"} onClose={onClose}>
      <div className="crm-form">
        <Campo label="Título">
          <input className="input-tema" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Reunión con la familia de Paula" autoFocus maxLength={120} />
        </Campo>
        <Campo label="Tipo">
          <div className="chips-grid">
            {Object.entries(TIPOS_EVENTO).map(([id, t]) => (
              <button key={id} type="button" className={`chip chip-small ${tipo === id ? "chip-active" : ""}`} onClick={() => setTipo(id)}>
                <span className="chip-label">{t.emoji} {t.label}</span>
              </button>
            ))}
          </div>
        </Campo>
        <div className="crm-form-row">
          <Campo label="Inicio"><input className="input-tema" type="datetime-local" value={inicio} onChange={e => setInicio(e.target.value)} /></Campo>
          <Campo label="Fin"><input className="input-tema" type="datetime-local" value={fin} onChange={e => setFin(e.target.value)} /></Campo>
        </div>
        {!claseFija && (
          <Campo label="Clase (opcional)">
            <select className="input-tema" value={claseId} onChange={e => { setClaseId(e.target.value); setAlumnoId(""); }}>
              <option value="">— Sin clase —</option>
              {clases.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.area ? ` · ${c.area}` : ""}</option>)}
            </select>
          </Campo>
        )}
        {!alumnoFijo && claseId && (
          <Campo label="Alumno/a (opcional)">
            <select className="input-tema" value={alumnoId} onChange={e => setAlumnoId(e.target.value)}>
              <option value="">— Toda la clase —</option>
              {alumnos.map(a => <option key={a.id} value={a.id}>{nombreCompleto(a)}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Notas (opcional)">
          <textarea className="textarea" rows={3} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Orden del día, materiales, acuerdos..." />
        </Campo>
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          {editando && <button className="doc-btn doc-btn-del" onClick={eliminar}>🗑️ Eliminar</button>}
          {evento?.programacion_id && onAbrirDoc && <button className="doc-btn" onClick={() => onAbrirDoc(evento.programacion_id)}>📄 Ver sesión</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          <button className="library-new-btn" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
}
