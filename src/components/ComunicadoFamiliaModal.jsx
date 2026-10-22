import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Campo from "./Campo";
import { nombreCompleto } from "../lib/crm";
import { resumenGrupo } from "../lib/equipo";
import { tareasDelDia, tareasComoTexto, redactarConEspecialista, urlGmail, textoPlano, marcarComunicado, fechaLargaAsist } from "../lib/asistencia";
import { correoInstitucional } from "../lib/correo";

// Carmen redacta el comunicado a la familia del alumno que ha faltado,
// con las tareas de ese día sacadas de la programación de aula.
export default function ComunicadoFamiliaModal({ clase, clases, fecha, alumno, registro, onClose, onHecho }) {
  const [ambito, setAmbito] = useState("dia");
  const [tareas, setTareas] = useState(null);
  const [lista, setLista] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [texto, setTexto] = useState("");
  const [redactando, setRedactando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const ctrl = useRef(null);
  const nombre = nombreCompleto(alumno);
  const grupo = clase.grupo_nombre || clase.nombre;

  useEffect(() => {
    setTareas(null);
    tareasDelDia(clase, clases, fecha, ambito)
      .then(t => { setTareas(t); setLista(t.map(x => `• ${x.asignatura || "Clase"}: ${x.titulo}${x.notas ? ` (${x.notas})` : ""}`).join("\n")); })
      .catch(() => { setTareas([]); setLista(""); });
  }, [ambito, fecha, clase.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => ctrl.current?.abort(), []);

  const redactar = async () => {
    setError(""); setTexto(""); setRedactando(true);
    ctrl.current = new AbortController();
    const detalle = tareas?.length ? tareasComoTexto(tareas) : "";
    const encargo = `ENCARGO:
Redacta el mensaje que el/la tutor/a enviará a la familia de ${nombre} (${grupo}${clase.curso ? `, ${clase.curso}` : ""}) porque hoy, ${fechaLargaAsist(fecha)}, no ha asistido a clase. El objetivo es que pueda ponerse al día en casa con lo que se ha trabajado.

TAREAS DEL DÍA (lo que el/la docente ha confirmado; inclúyelas todas y no añadas otras):
${lista.trim() || "(no hay tareas apuntadas para ese día: escribe [Tareas del día] para que el/la docente las complete)"}
${detalle ? `\nDETALLE DE LA PROGRAMACIÓN DE AULA (úsalo solo para explicar cada tarea de forma clara y concreta para casa: qué hacer, páginas o ejercicios, materiales):\n${detalle.slice(0, 9000)}\n` : ""}${indicaciones.trim() ? `\nINDICACIONES DEL DOCENTE:\n${indicaciones.trim()}\n` : ""}
NORMAS:
- Empieza con «Estimada familia de ${nombre}:». Usa el nombre tal cual (son iniciales), sin inventar nombres.
- Tono cercano, breve y respetuoso. No supongas el motivo de la ausencia ni pidas justificantes; puedes desear que se encuentre bien.
- Presenta las tareas en una lista clara, agrupadas por asignatura, con lo que tiene que hacer en casa.
- Termina ofreciendo resolver dudas y con la firma del/de la tutor/a.
- Escribe SOLO el mensaje, listo para enviar: sin títulos, sin tablas, sin notas para el docente.`;
    try {
      const grupoTexto = await resumenGrupo(clase, alumno).catch(() => "");
      setTexto(await redactarConEspecialista("carmen", encargo, { onTexto: setTexto, signal: ctrl.current.signal, grupoTexto }));
    } catch (e) { if (e.name !== "AbortError") setError(e.message); }
    finally { setRedactando(false); }
  };

  const hecho = async () => { await marcarComunicado(registro?.id).catch(() => {}); onHecho?.(); };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(textoPlano(texto)); } catch { /* sin portapapeles */ }
    setCopiado(true); setTimeout(() => setCopiado(false), 2000); hecho();
  };
  const gmail = () => {
    window.open(urlGmail({ asunto: `${nombre} · Tareas del ${fechaLargaAsist(fecha)}`, cuerpo: textoPlano(texto), cuenta: correoInstitucional() }), "_blank", "noopener");
    hecho();
  };

  return (
    <Modal titulo={`✉️ Comunicado a la familia · ${nombre}`} onClose={onClose} ancho={720}>
      <p className="crm-muted" style={{ marginTop: 0 }}>Carmen redacta el mensaje con las tareas de ese día sacadas de tu programación de aula (Horario semanal y documentos programados). Tú lo revisas y lo envías: AulaIA no guarda correos de las familias.</p>

      <div className="chips-grid" role="radiogroup" aria-label="Qué tareas incluir">
        <button type="button" role="radio" aria-checked={ambito === "dia"} className={`chip chip-small ${ambito === "dia" ? "chip-active" : ""}`} onClick={() => setAmbito("dia")}><span className="chip-label">Todo el día de {grupo}</span></button>
        <button type="button" role="radio" aria-checked={ambito === "asignatura"} className={`chip chip-small ${ambito === "asignatura" ? "chip-active" : ""}`} onClick={() => setAmbito("asignatura")}><span className="chip-label">Solo {clase.area || "esta asignatura"}</span></button>
      </div>

      <Campo label="Tareas del día" hint={tareas === null ? "Buscando en tu programación…" : tareas.length ? `Encontradas ${tareas.length} en tu programación. Puedes cambiarlas o añadir más.` : "No hay nada programado ese día en tu Horario semanal ni en el Calendario: escríbelas tú."}>
        <textarea className="input-tema" rows={5} value={lista} onChange={e => setLista(e.target.value)} placeholder="• Lengua: ficha de la página 23&#10;• Matemáticas: problemas 1 a 4 de la página 40" />
      </Campo>
      <Campo label="Algo más para Carmen (opcional)">
        <input className="input-tema" value={indicaciones} onChange={e => setIndicaciones(e.target.value)} placeholder="Ej.: recordar que el viernes hay control de la unidad 2" />
      </Campo>

      {error && <p className="error-msg">{error}</p>}
      <div className="crm-modal-actions">
        <span style={{ flex: 1 }} />
        {redactando && <button className="btn-back" onClick={() => ctrl.current?.abort()}>Cancelar</button>}
        <button className="generate-btn generate-active" onClick={redactar} disabled={redactando || tareas === null}>{redactando ? "Carmen está escribiendo…" : texto ? "✨ Volver a redactar" : "✨ Que Carmen lo redacte"}</button>
      </div>

      {texto && (
        <>
          <Campo label="Mensaje para la familia (puedes editarlo)">
            <textarea className="input-tema" rows={12} value={texto} onChange={e => setTexto(e.target.value)} />
          </Campo>
          {!redactando && (
            <div className="crm-modal-actions" style={{ flexWrap: "wrap" }}>
              <span className="crm-muted" style={{ flex: 1 }}>{registro?.comunicado_at ? "✔ Ya lo marcaste como comunicado." : ""}</span>
              <button className="btn-copy" onClick={copiar}>{copiado ? "✅ Copiado" : "📋 Copiar"}</button>
              <button className="doc-btn" onClick={gmail}>✉️ Abrir en Gmail</button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
