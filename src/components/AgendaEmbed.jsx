// La Agenda docente dentro de AulaIA. Es el mismo código de la Agenda, sin
// cambios en su funcionamiento (pipeline, arrastrar sesiones, plano, listados...).
// Se carga una vez y se queda abierta, así no pierde lo que estés haciendo.
import { useEffect, useRef, useState } from "react";
import { leerStreamSSE } from "../lib/stream";

export default function AgendaEmbed({ visible, seccion, onVista, onAbrirDoc }) {
  const ref = useRef(null);
  const [lista, setLista] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    window.__aulaiaAgendaLista = () => setLista(true);
    window.__aulaiaAgendaVista = (v) => onVista?.(v);
    window.__aulaiaAbrirDoc = (id) => id && onAbrirDoc?.(id);
    // La Agenda puede pedir textos a los especialistas (p. ej. Carmen en Mensajes a familias)
    window.__aulaiaGenerar = async ({ especialistaId, prompt, tipo }, onDelta) => {
      const r = await fetch("/api/generar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptOverride: prompt, especialistaId, tipoResultado: tipo || "familias", modo: "ordinario", idioma: "Castellano" }),
      });
      if (!r.ok) throw new Error(r.status === 429 || r.status === 401 ? "limite" : "error");
      let full = "";
      await leerStreamSSE(r, (d) => { full += d; onDelta?.(full); });
      return full;
    };
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
