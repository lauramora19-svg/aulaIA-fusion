import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError, AREA_A_AGENDA, toLocalInput } from "../lib/crm";
import { estadoAgenda, leerAgenda, horasDelDia, programarEnAgenda, ASIGNATURAS_AGENDA } from "../lib/agenda";
import Modal from "./Modal";
import Campo from "./Campo";

const hoyISO = () => { const d = new Date(); if (d.getDay() === 6) d.setDate(d.getDate() + 2); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return toLocalInput(d).slice(0, 10); };

// Coloca un documento (programación, sesión, actividad...) en un día concreto.
// Si la Agenda docente está conectada, se elige la hora de su horario y aparece allí también.
export default function ProgramarModal({ doc, onClose, onSaved }) {
  const conectada = estadoAgenda().conectada;
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState("09:00");
  const [st, setSt] = useState(null);
  const [slotId, setSlotId] = useState("");
  const [clase, setClase] = useState(null);
  const [titulo, setTitulo] = useState(doc.titulo || "Sesión");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (conectada) leerAgenda().then(setSt).catch(() => setSt(null));
    if (doc.clase_id) supabase.from("clases").select("*, grupos(nombre)").eq("id", doc.clase_id).single().then(({ data }) => setClase(data));
  }, []);

  const horas = st ? horasDelDia(st, new Date(`${fecha}T12:00:00`)) : [];
  // Propone la hora en la que toca esa asignatura con ese grupo
  useEffect(() => {
    if (!horas.length) { setSlotId(""); return; }
    const sub = AREA_A_AGENDA(clase?.area || "");
    const grupo = (clase?.grupos?.nombre || clase?.nombre || "").toLowerCase().replace(/\s/g, "");
    const h = horas.find(x => x.subjectId === sub && (x.group || "").toLowerCase().replace(/\s/g, "") === grupo)
      || horas.find(x => x.subjectId === sub);
    setSlotId(h ? h.slotId : "");
  }, [fecha, st, clase]);

  const guardar = async () => {
    setGuardando(true); setError("");
    try {
      let inicio, fin, agenda_ref = null;
      const h = horas.find(x => x.slotId === slotId);
      if (h) {
        const [h1, h2] = (h.time || "09:00 - 10:00").split("-").map(x => x.trim());
        inicio = new Date(`${fecha}T${h1}:00`); fin = new Date(`${fecha}T${h2}:00`);
        agenda_ref = await programarEnAgenda({ fecha: new Date(`${fecha}T12:00:00`), slotId, titulo, docId: doc.id });
      } else {
        inicio = new Date(`${fecha}T${hora}:00`); fin = new Date(inicio.getTime() + 60 * 60000);
      }
      const { error } = await supabase.from("agenda_eventos").insert({
        tipo: "sesion", titulo, inicio: inicio.toISOString(), fin: fin.toISOString(),
        clase_id: doc.clase_id || null, alumno_id: doc.alumno_id || null, programacion_id: doc.id,
        ...(agenda_ref ? { agenda_ref } : {}),
      });
      if (error) throw error;
      onSaved?.({ fecha, enAgenda: !!agenda_ref });
    } catch (e) {
      setError(e.message?.includes("Agenda") ? e.message : mensajeError(e));
    } finally { setGuardando(false); }
  };

  return (
    <Modal titulo="📅 Programar en un día" onClose={onClose}>
      <div className="crm-form">
        <Campo label="Título de la sesión">
          <input className="input-tema" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={140} />
        </Campo>
        <Campo label="Día">
          <input className="input-tema" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </Campo>
        {conectada && st ? (
          horas.length === 0 ? <p className="crm-muted">Ese día no hay horario en tu Agenda (fin de semana). Elige otro día o pon la hora a mano.</p> : (
            <Campo label="Hora (de tu horario de la Agenda)">
              <div className="crm-horas">
                {horas.map(x => (
                  <button key={x.slotId} type="button" className={`chip chip-small ${slotId === x.slotId ? "chip-active" : ""}`} onClick={() => setSlotId(slotId === x.slotId ? "" : x.slotId)}>
                    <span className="chip-label">{x.label} · {x.time}</span>
                    <span className="chip-desc">{x.subjectId ? `${ASIGNATURAS_AGENDA[x.subjectId] || x.subjectId}${x.group ? " · " + x.group : ""}` : "Libre"}{x.titulo ? ` — ya tiene: «${x.titulo}»` : ""}</span>
                  </button>
                ))}
              </div>
            </Campo>
          )
        ) : null}
        {(!conectada || !st || !horas.length || !slotId) && (
          <Campo label="Hora" hint={conectada ? "Sin hora del horario: se guardará solo en AulaIA." : "Conecta tu Agenda docente (barra lateral) para elegir la hora de tu horario y que aparezca también allí."}>
            <input className="input-tema" type="time" value={hora} onChange={e => setHora(e.target.value)} />
          </Campo>
        )}
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          <button className="library-new-btn" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Programar"}</button>
        </div>
      </div>
    </Modal>
  );
}
