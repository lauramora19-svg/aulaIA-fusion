import { useEffect, useRef, useState } from "react";
import Campo from "../components/Campo";
import EncabezadoSelect from "../components/EncabezadoSelect";
import { renderResultado } from "../lib/render";
import { miPerfil } from "../lib/equipo";
import { CARGOS, ETAPAS_SUST } from "../lib/sustituciones";
import { isoDia, redactarConEspecialista, urlGmail } from "../lib/asistencia";
import { correoInstitucional, guardarCorreoInstitucional } from "../lib/correo";
import { textoDeDocx } from "../lib/docx";
import { exportarWordContenido } from "../lib/word";
import {
  destinatariosCentro, plantillaAusencia, guardarPlantillaAusencia, enviarAvisos, avisosEnviados, borrarAvisos,
  conMotivo, fechasAusencia, MARCA_MOTIVO,
} from "../lib/ausencias";

const cargoDe = (d) => `${CARGOS[d.cargo] || d.cargo}${d.cargo === "coordinacion" && d.etapa ? ` (${ETAPAS_SUST.find(e => e.id === d.etapa)?.nombre || d.etapa})` : ""}`;
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Comunicar una ausencia a la directora y al equipo directivo: Carmen rellena el
// documento oficial del colegio, les llega un aviso en AulaIA y se abre Gmail.
export default function AusenciaPage({ clases = [], esAdmin, esAdminCentro, centro, onCarpeta }) {
  const [perfil, setPerfil] = useState(null);
  const [destinos, setDestinos] = useState(null);
  const [elegidos, setElegidos] = useState([]);
  const [otros, setOtros] = useState("");
  const [plantilla, setPlantilla] = useState(null);
  const [editarPlantilla, setEditarPlantilla] = useState(false);
  const [textoPlantilla, setTextoPlantilla] = useState("");
  const [desde, setDesde] = useState(isoDia());
  const [hasta, setHasta] = useState("");
  const [jornada, setJornada] = useState("completa");
  const [horas, setHoras] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [correo, setCorreo] = useState(correoInstitucional());
  const [encabezado, setEncabezado] = useState("");
  const [doc, setDoc] = useState("");
  const [vista, setVista] = useState(false);
  const [redactando, setRedactando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [enviados, setEnviados] = useState([]);
  const [gmailUrl, setGmailUrl] = useState("");
  const ctrl = useRef(null);
  const fileRef = useRef(null);
  const puedePlantilla = esAdmin || esAdminCentro;

  useEffect(() => {
    miPerfil().then(setPerfil).catch(() => {});
    destinatariosCentro().then(setDestinos).catch(e => { setDestinos([]); setError(e.message); });
    plantillaAusencia().then(t => { setPlantilla(t); setTextoPlantilla(t); });
    avisosEnviados().then(setEnviados);
    return () => ctrl.current?.abort();
  }, []);

  const horario = jornada === "completa" ? "Jornada completa" : (horas.trim() || "Algunas horas");
  const correosOtros = otros.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const toggle = (id) => setElegidos(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);

  const guardarPlantilla = async () => {
    setError(""); setOk("");
    try { await guardarPlantillaAusencia(textoPlantilla); setPlantilla(textoPlantilla); setEditarPlantilla(false); setOk("Documento oficial guardado: Carmen lo usará para todo el profesorado del centro."); }
    catch (e) { setError(e.message); }
  };
  const leerPlantilla = async (file) => {
    if (!file) return;
    setError("");
    try {
      if (/\.docx$/i.test(file.name)) setTextoPlantilla(await textoDeDocx(file));
      else if (/\.(txt|md)$/i.test(file.name)) setTextoPlantilla(await file.text());
      else setError("Sube el documento en Word (.docx). Si lo tienes en PDF, copia su texto y pégalo en el recuadro.");
    } catch { setError("No se ha podido leer el documento. Copia su texto y pégalo en el recuadro."); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const redactar = async () => {
    if (!desde) { setError("Pon la fecha de la ausencia."); return; }
    if (hasta && hasta < desde) { setError("«Hasta» no puede ser antes de «Desde»."); return; }
    setError(""); setOk(""); setDoc(""); setVista(false); setRedactando(true);
    ctrl.current = new AbortController();
    const misGrupos = [...new Set(clases.map(c => `${c.grupo_nombre || c.nombre}${c.area ? ` (${c.area})` : ""}`))].join(", ");
    const encargo = `ENCARGO:
Rellena el documento con el que un/a docente comunica a la dirección del colegio una ausencia prevista.

DATOS:
- Docente: ${perfil?.nombre || "[Nombre y apellidos]"}
- Centro: ${centro || perfil?.centro || "[Centro]"}
- Fecha del documento: ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
- Días de ausencia: ${fechasAusencia(desde, hasta)}
- Horario: ${horario}
- Grupos y materias que imparte: ${misGrupos || "[Grupos afectados]"}
- Motivo: escribe exactamente ${MARCA_MOTIVO} donde vaya el motivo (no lo cambies ni lo expliques).
${observaciones.trim() ? `- Observaciones del docente: ${observaciones.trim()}\n` : ""}
${plantilla?.trim()
  ? `DOCUMENTO OFICIAL DEL COLEGIO (reprodúcelo con la misma estructura, el mismo orden y los mismos textos fijos; rellena sus huecos con los DATOS; los huecos de los que no tengas datos déjalos entre corchetes, p. ej. [Firma], para que el docente los complete; si tiene casillas de tipo de permiso, marca solo la que corresponda si se deduce y si no déjalas sin marcar):
"""
${plantilla.slice(0, 20000)}
"""`
  : `No hay documento oficial cargado: redacta una comunicación formal breve dirigida a la Dirección del centro, con encabezado (centro y fecha), destinatario, cuerpo con los datos, una línea para el motivo, las observaciones y un espacio de firma.`}

NORMAS: escribe SOLO el documento, en Markdown sencillo (puedes usar tablas si el documento oficial las tiene). Sin comentarios para el docente.`;
    try { setDoc(await redactarConEspecialista("carmen", encargo, { onTexto: setDoc, signal: ctrl.current.signal })); }
    catch (e) { if (e.name !== "AbortError") setError(e.message); }
    finally { setRedactando(false); }
  };

  const enviar = async () => {
    const dest = (destinos || []).filter(d => elegidos.includes(d.id));
    const malos = correosOtros.filter(x => !emailValido(x));
    if (!dest.length && !correosOtros.length) { setError("Elige a quién va el comunicado."); return; }
    if (malos.length) { setError(`Revisa estos correos: ${malos.join(", ")}`); return; }
    if (correo && !emailValido(correo)) { setError("Revisa tu correo institucional."); return; }
    setEnviando(true); setError(""); setOk(""); setGmailUrl("");
    const ventana = window.open("", "_blank"); // se abre ya, para que el navegador no la bloquee
    try {
      guardarCorreoInstitucional(correo);
      const documento = conMotivo(doc, motivo);
      await enviarAvisos({ destinatarios: dest, deNombre: perfil?.nombre || correo, desde, hasta, horario, documento: doc });
      const titulo = `Comunicacion de ausencia ${perfil?.nombre || ""} ${desde}`;
      const archivo = await exportarWordContenido(documento, titulo, { encabezadoId: encabezado });
      const para = [...dest.map(d => d.email), ...correosOtros];
      const cuerpo = `Buenos días:\n\nOs comunico mi ausencia ${fechasAusencia(desde, hasta)} (${horario.toLowerCase()}).${motivo.trim() ? `\nMotivo: ${motivo.trim()}` : ""}${observaciones.trim() ? `\n${observaciones.trim()}` : ""}\n\nOs adjunto el documento de comunicación de ausencia.\n\nUn saludo,\n${perfil?.nombre || ""}`;
      const url = urlGmail({ para, asunto: `Comunicación de ausencia · ${perfil?.nombre || ""} · ${fechasAusencia(desde, hasta)}`, cuerpo, cuenta: correo });
      setGmailUrl(url);
      if (ventana) ventana.location.href = url;
      setOk(`${dest.length ? `Aviso enviado en AulaIA a ${dest.map(d => d.nombre).join(", ")}. ` : ""}Se ha descargado «${archivo}» y se ha abierto Gmail con un correo corto: arrastra ese Word (está en Descargas) al correo y pulsa Enviar.`);
      avisosEnviados().then(setEnviados);
    } catch (e) { ventana?.close(); setError(e.message || "No se ha podido enviar."); }
    finally { setEnviando(false); }
  };

  const nombreDe = (id) => (destinos || []).find(d => d.id === id)?.nombre || "Equipo directivo";
  // Una fila por envío (aunque vaya a varias personas)
  const envios = Object.values(enviados.reduce((acc, a) => {
    const k = `${a.desde}|${a.hasta || ""}|${a.horario || ""}|${(a.created_at || "").slice(0, 16)}`;
    (acc[k] ||= { ...a, ids: [], para: [], leidos: [] });
    acc[k].ids.push(a.id); acc[k].para.push(nombreDe(a.para_user)); if (a.leido_at) acc[k].leidos.push(nombreDe(a.para_user));
    return acc;
  }, {}));
  const borrarEnvio = async (e) => {
    if (!window.confirm(`¿Borrar la comunicación de ausencia ${fechasAusencia(e.desde, e.hasta)}?\n\nDesaparecerá también del Inicio de ${e.para.join(", ")}. Si ya enviaste el correo, ese no se puede retirar desde aquí.`)) return;
    setError(""); setOk("");
    try { await borrarAvisos(e.ids); setOk("Comunicación borrada."); avisosEnviados().then(setEnviados); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="crm-page">
      <h1 className="crm-hello-title">📨 Comunicar mi ausencia</h1>
      <p className="crm-muted">Carmen rellena el documento oficial del colegio. A quien elijas le llega un aviso en AulaIA y se abre tu Gmail institucional con el correo preparado. El motivo no se guarda en AulaIA: solo va en el Word y en el correo.</p>

      <section className="card crm-form">
        <div className="crm-form-row">
          <Campo label="Desde"><input type="date" className="input-tema" value={desde} onChange={e => setDesde(e.target.value)} /></Campo>
          <Campo label="Hasta (si son varios días)"><input type="date" className="input-tema" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} /></Campo>
        </div>
        <div className="chips-grid" role="radiogroup" aria-label="Horario">
          <button type="button" role="radio" aria-checked={jornada === "completa"} className={`chip chip-small ${jornada === "completa" ? "chip-active" : ""}`} onClick={() => setJornada("completa")}><span className="chip-label">Jornada completa</span></button>
          <button type="button" role="radio" aria-checked={jornada === "horas"} className={`chip chip-small ${jornada === "horas" ? "chip-active" : ""}`} onClick={() => setJornada("horas")}><span className="chip-label">Solo algunas horas</span></button>
          {jornada === "horas" && <input className="input-tema" style={{ maxWidth: 260 }} value={horas} onChange={e => setHoras(e.target.value)} placeholder="Ej.: de 9:00 a 11:20" aria-label="Horas" />}
        </div>
        <Campo label="Motivo" hint="No se guarda en AulaIA: solo se escribe en el Word y en el correo.">
          <input className="input-tema" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: consulta médica, asuntos propios, formación…" />
        </Campo>
        <Campo label="Observaciones (opcional)">
          <input className="input-tema" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Ej.: dejo preparada la carpeta de sustitución con las tareas" />
        </Campo>
        {onCarpeta && <p className="field-hint" style={{ marginTop: 0 }}>¿Necesitas dejar tareas? <button type="button" className="btn-back-sm" onClick={onCarpeta}>🗂️ Preparar la carpeta de sustitución</button></p>}

        <p className="crm-campo-label" style={{ marginTop: 6 }}>¿A quién se lo comunicas?</p>
        {destinos === null ? <p className="crm-muted">Cargando…</p> : destinos.length === 0
          ? <p className="crm-muted">Todavía no hay equipo directivo dado de alta en AulaIA para tu centro. {puedePlantilla ? "Puedes asignarlo en «Usuarios y consumo» o «Mi centro»." : "Pide a quien administra el centro que lo asigne."} Mientras, escribe los correos abajo.</p>
          : <div className="chips-grid">
              {destinos.map(d => (
                <button key={`${d.id}-${d.cargo}`} type="button" aria-pressed={elegidos.includes(d.id)} className={`chip chip-small ${elegidos.includes(d.id) ? "chip-active" : ""}`} onClick={() => toggle(d.id)} title={d.email}>
                  <span className="chip-label">{elegidos.includes(d.id) ? "✓ " : ""}{d.nombre} · {cargoDe(d)}</span>
                </button>
              ))}
            </div>}
        <div className="crm-form-row">
          <Campo label="Otros correos (opcional)" hint="Separados por comas. A estos solo les llega el correo, no el aviso en AulaIA.">
            <input className="input-tema" value={otros} onChange={e => setOtros(e.target.value)} placeholder="secretaria@…" />
          </Campo>
          <Campo label="Tu correo institucional" hint="Gmail se abrirá con esta cuenta.">
            <input className="input-tema" type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="nombre@colegio.org" />
          </Campo>
        </div>
        <EncabezadoSelect value={encabezado} onChange={setEncabezado} etiqueta="🏷️ Encabezado del Word" />

        <p className="field-hint">
          {plantilla === null ? "" : plantilla.trim() ? "📄 Documento oficial del colegio cargado: Carmen lo rellenará con el mismo formato." : "📄 Aún no hay documento oficial del colegio: Carmen escribirá una comunicación formal estándar."}
          {puedePlantilla && <> <button type="button" className="btn-back-sm" onClick={() => setEditarPlantilla(v => !v)}>{editarPlantilla ? "Cerrar" : plantilla?.trim() ? "⚙️ Cambiar el documento oficial" : "⚙️ Subir el documento oficial"}</button></>}
        </p>
        {editarPlantilla && (
          <div className="card" style={{ background: "#f8fafc" }}>
            <p className="crm-muted" style={{ marginTop: 0 }}>Sube el modelo en Word (.docx) o pega su texto. Lo usará todo el profesorado de tu centro.</p>
            <div className="crm-modal-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="doc-btn" onClick={() => fileRef.current?.click()}>📎 Subir Word (.docx)</button>
              <input ref={fileRef} type="file" accept=".docx,.txt,.md" hidden onChange={e => leerPlantilla(e.target.files?.[0])} />
            </div>
            <textarea className="input-tema" rows={10} value={textoPlantilla} onChange={e => setTextoPlantilla(e.target.value)} placeholder="Texto del documento oficial de comunicación de ausencias…" />
            <div className="crm-modal-actions"><span style={{ flex: 1 }} /><button type="button" className="library-new-btn" onClick={guardarPlantilla}>💾 Guardar documento oficial</button></div>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}
        {ok && <p className="crm-aviso">✅ {ok}{gmailUrl && <> <a href={gmailUrl} target="_blank" rel="noopener noreferrer">Abrir Gmail otra vez</a></>}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          {redactando && <button className="btn-back" onClick={() => ctrl.current?.abort()}>Cancelar</button>}
          <button className="generate-btn generate-active" onClick={redactar} disabled={redactando}>{redactando ? "Carmen está rellenando el documento…" : doc ? "✨ Volver a rellenar" : "✨ Que Carmen rellene el documento"}</button>
        </div>
      </section>

      {doc && (
        <section className="card">
          <div className="crm-modal-actions" style={{ justifyContent: "flex-start", marginTop: 0 }}>
            <p className="crm-card-title" style={{ margin: 0, flex: 1 }}>Documento (revísalo antes de enviarlo)</p>
            <button type="button" className="btn-back-sm" onClick={() => setVista(v => !v)}>{vista ? "✏️ Editar" : "👁️ Ver como queda"}</button>
          </div>
          {vista
            ? <div className="resultado-body">{renderResultado(conMotivo(doc, motivo))}</div>
            : <textarea className="input-tema" rows={16} value={doc} onChange={e => setDoc(e.target.value)} aria-label="Documento" />}
          <p className="field-hint">{MARCA_MOTIVO} se sustituye por el motivo al descargar el Word y en el correo.</p>
          {!redactando && (
            <div className="crm-modal-actions" style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1 }} />
              <button className="btn-word" onClick={() => exportarWordContenido(conMotivo(doc, motivo), `Comunicacion de ausencia ${desde}`, { encabezadoId: encabezado }).catch(() => setError("No se ha podido generar el Word."))}>📄 Solo descargar Word</button>
              <button className="library-new-btn" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "📨 Enviar a dirección"}</button>
            </div>
          )}
        </section>
      )}

      {enviados.length > 0 && (
        <section className="card">
          <p className="crm-card-title">Comunicaciones enviadas</p>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Ausencia</th><th>Para</th><th>Enviada</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {envios.map(e => (
                  <tr key={e.ids[0]}>
                    <td>{fechasAusencia(e.desde, e.hasta)}{e.horario ? ` · ${e.horario}` : ""}</td>
                    <td>{e.para.join(", ")}</td>
                    <td className="crm-nowrap">{new Date(e.created_at).toLocaleDateString("es-ES")}</td>
                    <td>{e.leidos.length ? `✔ Leído${e.para.length > 1 ? ` por ${e.leidos.join(", ")}` : ""}` : <span className="crm-muted">Sin leer</span>}</td>
                    <td><button className="doc-btn doc-btn-del" onClick={() => borrarEnvio(e)} title="Borrar esta comunicación">🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
