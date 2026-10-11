// La Agenda docente dentro de AulaIA. Es el mismo código de la Agenda, sin
// cambios en su funcionamiento (pipeline, arrastrar sesiones, plano, listados...).
// Se carga una vez y se queda abierta, así no pierde lo que estés haciendo.
import { useEffect, useRef, useState } from "react";

export default function AgendaEmbed({ visible, seccion, onVista, onAbrirDoc }) {
  const ref = useRef(null);
  const [lista, setLista] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    window.__aulaiaAgendaLista = () => setLista(true);
    window.__aulaiaAgendaVista = (v) => onVista?.(v);
    window.__aulaiaAbrirDoc = (id) => id && onAbrirDoc?.(id);
  }, [onVista, onAbrirDoc]);

  useEffect(() => {
    const f = () => { setLista(false); setRecarga(x => x + 1); };
    window.addEventListener("aulaia-agenda-recargar", f);
    return () => window.removeEventListener("aulaia-agenda-recargar", f);
  }, []);

  useEffect(() => {
    if (!visible || !lista) return;
    try {
      const w = ref.current?.contentWindow;
      if (w?.app && seccion && !w.document.querySelector(`#view-${seccion}.active-view`)) w.app.switchView(seccion);
      w?.__agendaRefrescar?.();
    } catch (e) { console.error(e); }
  }, [visible, seccion, lista]);

  return (
    <div className="agenda-embed" style={{ display: visible ? "block" : "none" }}>
      {!lista && <p className="agenda-embed-cargando">Cargando tu Agenda…</p>}
      <iframe key={recarga} ref={ref} src="/agenda/index.html" title="Agenda docente" className="agenda-embed-frame" />
    </div>
  );
}
