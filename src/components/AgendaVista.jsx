import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { TIPOS_EVENTO, inicioSemana, sumarDias, mismoDia, fmtHora, fmtFecha, mensajeError } from "../lib/crm";
import EventoModal from "./EventoModal";
import Modal from "./Modal";
import { estadoAgenda, leerAgenda, sesionesAgenda, suscribirAgenda, AGENDA_WEB } from "../lib/agenda";
import EmptyState from "./EmptyState";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Agenda reutilizable: general (sin filtros), por clase (claseFija) o por alumno (alumnoFijo)
export default function AgendaVista({ clases = [], claseFija = null, alumnoFijo = null, compacta = false, onAbrirDoc }) {
  const [modo, setModo] = useState(compacta ? "lista" : "semana");
  const [semana, setSemana] = useState(inicioSemana(new Date()));
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // { evento?, fecha? }
  const [sesionAg, setSesionAg] = useState(null); // sesión que viene de la Agenda docente
  const [conectada, setConectada] = useState(estadoAgenda().conectada);
  useEffect(() => suscribirAgenda(e => setConectada(e.conectada)), []);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    let desde, hasta;
    if (modo === "semana") { desde = semana; hasta = sumarDias(semana, 7); }
    else { desde = new Date(); desde.setHours(0, 0, 0, 0); hasta = sumarDias(desde, 60); }
    let q = supabase.from("agenda_eventos").select("*")
      .gte("inicio", desde.toISOString()).lt("inicio", hasta.toISOString()).order("inicio");
    if (claseFija) q = q.eq("clase_id", claseFija.id);
    if (alumnoFijo) q = q.eq("alumno_id", alumnoFijo.id);
    const { data, error } = await q;
    if (error) setError(mensajeError(error));
    let lista = data || [];
    // Sesiones de la Agenda docente (si está conectada)
    if (conectada && !alumnoFijo) {
      try {
        const st = await leerAgenda();
        const grupoClase = (claseFija?.grupo_nombre || claseFija?.nombre || "").toLowerCase().replace(/\s/g, "");
        let ag = sesionesAgenda(st, desde, hasta);
        if (claseFija) ag = ag.filter(e => (e.grupo || "").toLowerCase().replace(/\s/g, "") === grupoClase);
        // Las que ya están en AulaIA (programadas desde aquí) no se repiten
        const yaEstan = new Set(lista.filter(e => e.agenda_ref).map(e => `${e.agenda_ref.week}-${e.agenda_ref.key}`));
        ag = ag.filter(e => !yaEstan.has(`${e.ref.week}-${e.ref.key}`));
        lista = [...lista, ...ag].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
      } catch {}
    }
    setEventos(lista); setCargando(false);
  }, [modo, semana, claseFija?.id, alumnoFijo?.id, conectada]);

  useEffect(() => { cargar(); }, [cargar]);

  const claseDe = (id) => clases.find(c => c.id === id) || (claseFija?.id === id ? claseFija : null);
  const hoy = new Date();

  const Evento = ({ ev, mostrarFecha }) => {
    const t = TIPOS_EVENTO[ev.tipo] || TIPOS_EVENTO.otro;
    const c = claseDe(ev.clase_id);
    return (
      <div className={`crm-evento ${ev.origen === "agenda" ? "crm-evento-agenda" : ""}`} style={{ borderLeftColor: t.color }}
        onClick={(e) => { e.stopPropagation(); ev.origen === "agenda" ? setSesionAg(ev) : setModal({ evento: ev }); }}>
        <span className="crm-evento-hora">{mostrarFecha ? `${fmtFecha(ev.inicio, { weekday: "short", day: "2-digit", month: "short" })} · ` : ""}{fmtHora(ev.inicio)}</span>
        <span className="crm-evento-titulo">{t.emoji} {ev.titulo}{ev.programacion_id ? " 📄" : ""}</span>
        {ev.origen === "agenda"
          ? <span className="crm-evento-meta">🗓️ Agenda{ev.grupo && !claseFija ? ` · ${ev.grupo}` : ""}{ev.asignatura ? ` · ${ev.asignatura}` : ""}</span>
          : c && !claseFija && <span className="crm-evento-meta">{c.nombre}{c.area ? ` · ${c.area}` : ""}</span>}
      </div>
    );
  };

  const nuevoEn = (dia) => { const f = new Date(dia); f.setHours(9, 0, 0, 0); setModal({ fecha: f }); };

  return (
    <div className="crm-agenda">
      <div className="crm-toolbar">
        <div className="chips-grid">
          <button className={`chip chip-small ${modo === "semana" ? "chip-active" : ""}`} onClick={() => setModo("semana")}><span className="chip-label">🗓️ Semana</span></button>
          <button className={`chip chip-small ${modo === "lista" ? "chip-active" : ""}`} onClick={() => setModo("lista")}><span className="chip-label">📋 Próximos</span></button>
        </div>
        {modo === "semana" && (
          <div className="crm-semana-nav">
            <button className="doc-btn" onClick={() => setSemana(sumarDias(semana, -7))} aria-label="Semana anterior">◀</button>
            <button className="doc-btn" onClick={() => setSemana(inicioSemana(new Date()))}>Hoy</button>
            <button className="doc-btn" onClick={() => setSemana(sumarDias(semana, 7))} aria-label="Semana siguiente">▶</button>
            <span className="crm-semana-label">{fmtFecha(semana, { day: "numeric", month: "short" })} – {fmtFecha(sumarDias(semana, 6), { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        )}
        <button className="library-new-btn" onClick={() => setModal({})}>＋ Nuevo evento</button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {cargando ? <div className="crm-loading"><div className="lib-spinner" /></div> : modo === "semana" ? (
        <div className="crm-semana">
          {DIAS.map((d, i) => {
            const dia = sumarDias(semana, i);
            const delDia = eventos.filter(ev => mismoDia(new Date(ev.inicio), dia));
            return (
              <div key={d} className={`crm-dia ${mismoDia(dia, hoy) ? "crm-dia-hoy" : ""} ${i >= 5 ? "crm-dia-finde" : ""}`} onClick={() => nuevoEn(dia)} title="Pulsa para añadir un evento este día">
                <div className="crm-dia-head"><span>{d}</span><strong>{dia.getDate()}</strong></div>
                {delDia.map(ev => <Evento key={ev.id} ev={ev} />)}
              </div>
            );
          })}
        </div>
      ) : eventos.length === 0 ? (
        <EmptyState icono="📅" texto="No hay eventos en los próximos 60 días." accion="＋ Nuevo evento" onAccion={() => setModal({})} />
      ) : (
        <div className="crm-lista-eventos">{eventos.map(ev => <Evento key={ev.id} ev={ev} mostrarFecha />)}</div>
      )}

      {modal && (
        <EventoModal
          evento={modal.evento} fechaInicial={modal.fecha}
          clases={clases} claseFija={claseFija} alumnoFijo={alumnoFijo}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar(); }}
          onAbrirDoc={onAbrirDoc}
        />
      )}

      {sesionAg && (
        <Modal titulo={`🗓️ ${sesionAg.titulo}`} onClose={() => setSesionAg(null)}>
          <div className="crm-form">
            <p className="crm-muted">{fmtFecha(sesionAg.inicio, { weekday: "long", day: "numeric", month: "long" })} · {fmtHora(sesionAg.inicio)}–{fmtHora(sesionAg.fin)}{sesionAg.asignatura ? ` · ${sesionAg.asignatura}` : ""}{sesionAg.grupo ? ` · ${sesionAg.grupo}` : ""}</p>
            {sesionAg.notas && <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{sesionAg.notas}</p>}
            <p className="field-hint">Esta sesión está en tu horario semanal. Para cambiarla, ábrela allí.</p>
            <div className="crm-modal-actions">
              <button className="doc-btn" onClick={() => { setSesionAg(null); window.dispatchEvent(new CustomEvent("aulaia-ir", { detail: { v: "ag", p: { seccion: "horario" } } })); }}>🗓️ Abrir en el horario</button>
              <span style={{ flex: 1 }} />
              {sesionAg.programacion_id && onAbrirDoc && <button className="library-new-btn" onClick={() => onAbrirDoc(sesionAg.programacion_id)}>📄 Ver sesión</button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
