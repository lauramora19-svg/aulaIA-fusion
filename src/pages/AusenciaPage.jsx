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
import { leerAgenda, horasDelDia, ASIGNATURAS_AGENDA } from "../lib/agenda";
import "../ausencia.css";
import { esPlantillaDocx, prepararPlantillaDocx, opcionesPlantilla, rellenarPlantilla, descargarBlob } from "../lib/plantillaDocx";
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
  const [desde, setDesde] = useState(() => { const d = new Date(); while (d.getDay() % 6 === 0) d.setDate(d.getDate() + 1); return isoDia(d); }); // si es finde, el lunes
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
  // Modelo oficial en Word con huecos: se rellena el original, sin IA
  const leerLS = (k, d = "") => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const modoDocx = esPlantillaDocx(plantilla);
  const [opciones, setOpciones] = useState([]);
  const [opcion, setOpcion] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState(() => leerLS("aulaia-ausencia-nombre"));
  const [horaIni, setHoraIni] = useState(() => leerLS("aulaia-ausencia-hini"));
  const [horaFin, setHoraFin] = useState(() => leerLS("aulaia-ausencia-hfin"));
  const [documentos, setDocumentos] = useState("");
  const [relleno, setRelleno] = useState(null); // { blob, texto }
  useEffect(() => { if (modoDocx) opcionesPlantilla(plantilla).then(setOpciones).catch(() => setOpciones([])); else setOpciones([]); }, [plantilla]);
  useEffect(() => { if (!nombreCompleto && perfil?.nombre) setNombreCompleto(perfil.nombre); }, [perfil]);
  // Horario de ese día (de la Agenda) para elegir las horas sin escribirlas
  const [horasDia, setHorasDia] = useState(null); // null = cargando · [] = sin horario
  const [selHoras, setSelHoras] = useState([]);
  useEffect(() => {
    let vivo = true; setSelHoras([]);
    if (!desde) { setHorasDia([]); return; }
    leerAgenda().then(st => {
      if (!vivo) return;
      const h = st ? horasDelDia(st, new Date(`${desde}T00:00:00`)) : [];
      setHorasDia(h); setSelHoras(h.map(x => x.slotId)); // por defecto, el día completo
    })
      .catch(() => { if (vivo) setHorasDia([]); });
    return () => { vivo = false; };
  }, [desde]);
  const conHorario = (horasDia || []).length > 0;
  const tramo = (lista) => lista.length ? [lista[0].time.split("-")[0].trim(), lista[lista.length - 1].time.split("-").pop().trim()] : ["", ""];
  const diaCompleto = conHorario && selHoras.length === horasDia.length;
  const jornadaEf = conHorario ? (diaCompleto ? "completa" : "horas") : jornada;
  const [hIni, hFin] = conHorario ? tramo(horasDia.filter(h => selHoras.includes(h.slotId))) : [horaIni, horaFin];
  // Calendario pequeño (lunes a viernes, 3 semanas) para elegir el día o varios días
  const hoyIso = isoDia();
  const [semBase, setSemBase] = useState(0);
  const [varios, setVarios] = useState(false);
  const semanas = (() => {
    const l = new Date(); l.setHours(0, 0, 0, 0); l.setDate(l.getDate() - ((l.getDay() + 6) % 7) + semBase * 7);
    return [0, 1, 2].map(w => [0, 1, 2, 3, 4].map(i => { const d = new Date(l); d.setDate(l.getDate() + w * 7 + i); return isoDia(d); }));
  })();
  const mesCal = (() => { const t = new Date(`${semanas[1][2]}T00:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const tocarDia = (d) => {
    if (varios && desde && !hasta && d > desde) { setHasta(d); return; }
    setDesde(d); setHasta("");
  };
  const toggleHora = (id) => setSelHoras(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);
  const etiquetaHora = (h) => {
    const asig = h.subjectId ? (ASIGNATURAS_AGENDA[h.subjectId] || h.subjectId) : "Sin clase";
    return `${h.time.replace(/\s*-\s*/, "–")} · ${asig}${h.group ? ` (${h.group})` : ""}`;
  };
  useEffect(() => { setRelleno(null); }, [desde, hasta, hIni, hFin, opcion, motivo, documentos, nombreCompleto, plantilla]);

  useEffect(() => {
    miPerfil().then(setPerfil).catch(() => {});
    destinatariosCentro().then(setDestinos).catch(e => { setDestinos([]); setError(e.message); });
    plantillaAusencia().then(t => { setPlantilla(t); setTextoPlantilla(t); });
    avisosEnviados().then(setEnviados);
    return () => ctrl.current?.abort();
  }, []);

  const horario = jornadaEf === "completa" ? "Jornada completa"
    : (conHorario || modoDocx) ? (hIni && hFin ? `De ${hIni} a ${hFin}` : "Algunas horas")
    : (horas.trim() || "Algunas horas");
  const opcionTexto = opcion !== "" ? (opciones[+opcion]?.texto || "").replace(/[.:]\s*$/, "") : "";
  const motivoCorreo = modoDocx ? [opcionTexto, motivo.trim()].filter(Boolean).join(": ") : motivo.trim();
  const datosDocx = () => {
    const hoy = new Date();
    return {
      NOMBRE: nombreCompleto.trim(), DIAS: fechasAusencia(desde, hasta).replace(/^el /, ""),
      HORA_INICIO: hIni, HORA_FIN: hFin, DIA: String(hoy.getDate()),
      MES: hoy.toLocaleDateString("es-ES", { month: "long" }), ANIO: String(hoy.getFullYear()),
      FECHA: hoy.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
      DOCUMENTOS: documentos.trim(), OBSERVACIONES: observaciones.trim(),
    };
  };
  const comprobarDocx = () => {
    if (!desde) return "Pon la fecha de la ausencia.";
    if (hasta && hasta < desde) return "«Hasta» no puede ser antes de «Desde».";
    if (!nombreCompleto.trim()) return "Escribe tu nombre y apellidos.";
    if (!hIni || !hFin) return conHorario ? "Marca las horas en las que vas a faltar." : "Pon desde qué hora y hasta qué hora.";
    return "";
  };
  const prepararDocx = async () => {
    const e = comprobarDocx(); if (e) { setError(e); return null; }
    setError(""); setOk("");
    guardarLS("aulaia-ausencia-nombre", nombreCompleto.trim()); if (!conHorario) { guardarLS("aulaia-ausencia-hini", horaIni); guardarLS("aulaia-ausencia-hfin", horaFin); }
    try { const r = await rellenarPlantilla(plantilla, datosDocx(), { opcion: opcion === "" ? null : +opcion, detalle: motivo }); setRelleno(r); return r; }
    catch (err) { setError(err.message || "No se ha podido rellenar el documento."); return null; }
  };
  const tituloDocx = () => `Solicitud de permiso ${nombreCompleto.trim()} ${desde}`;
  const correosOtros = otros.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const toggle = (id) => setElegidos(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);

  const guardarPlantilla = async () => {
    setError(""); setOk("");
    try { await guardarPlantillaAusencia(textoPlantilla); setPlantilla(textoPlantilla); setEditarPlantilla(false); setOk(esPlantillaDocx(textoPlantilla) ? "Documento oficial guardado: AulaIA lo rellenará tal cual para todo el profesorado del centro." : "Documento oficial guardado: Carmen lo usará para todo el profesorado del centro."); }
    catch (e) { setError(e.message); }
  };
  const leerPlantilla = async (file) => {
    if (!file) return;
    setError("");
    try {
      if (/\.docx$/i.test(file.name)) {
        const conHuecos = await prepararPlantillaDocx(file); // Word con {NOMBRE}, {CASILLA}…: se guarda tal cual
        setTextoPlantilla(conHuecos || await textoDeDocx(file));
      }
      else if (/\.(txt|md)$/i.test(file.name)) setTextoPlantilla(await file.text());
      else setError("Sube el documento en Word (.docx). Si lo tienes en PDF, copia su texto y pégalo en el recuadro.");
    } catch (e) { setError(e?.message?.includes("pesa demasiado") ? e.message : "No se ha podido leer el documento. Copia su texto y pégalo en el recuadro."); }
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
${plantilla?.trim() ? "" : `- Grupos y materias que imparte: ${misGrupos || "[Grupos afectados]"}\n`}- Motivo: escribe exactamente ${MARCA_MOTIVO} donde vaya el motivo (no lo cambies ni lo expliques).
${observaciones.trim() ? `- Observaciones del docente: ${observaciones.trim()}\n` : ""}
${plantilla?.trim()
  ? `DOCUMENTO OFICIAL DEL COLEGIO (reprodúcelo con la misma estructura, el mismo orden y los mismos textos fijos; rellena sus huecos con los DATOS; los huecos de los que no tengas datos déjalos entre corchetes, p. ej. [Firma], para que el docente los complete; si tiene casillas de tipo de permiso, marca solo la que corresponda si se deduce y si no déjalas sin marcar):
"""
${plantilla.slice(0, 20000)}
"""`
  : `No hay documento oficial cargado: redacta una comunicación formal breve dirigida a la Dirección del centro, con encabezado (centro y fecha), destinatario, cuerpo con los datos, una línea para el motivo, las observaciones y un espacio de firma.`}

NORMAS: escribe SOLO el documento, en Markdown sencillo. No añadas apartados, tablas ni datos que no estén en el documento oficial (por ejemplo, NO pongas una tabla de grupos y materias si el documento no la tiene); usa tablas solo si el documento oficial las tiene. No uses código HTML ni entidades como &nbsp;. Para las firmas, escribe cada una en su propia línea (p. ej. «Vº Bº El Director Titular» y «Fdo.: El/la interesado/a») y deja una línea en blanco entre ellas para firmar. Sin comentarios para el docente.`;
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
    if (modoDocx) { const e = comprobarDocx(); if (e) { setError(e); return; } }
    setEnviando(true); setError(""); setOk(""); setGmailUrl("");
    const ventana = window.open("", "_blank"); // se abre ya, para que el navegador no la bloquee
    try {
      guardarCorreoInstitucional(correo);
      let archivo;
      if (modoDocx) {
        const r = await prepararDocx();
        if (!r) throw new Error("No se ha podido rellenar el documento.");
        // En AulaIA se guarda sin el tipo de permiso ni el detalle (el motivo no se guarda)
        const sinDatos = await rellenarPlantilla(plantilla, { ...datosDocx(), DOCUMENTOS: "" }, { opcion: null });
        await enviarAvisos({ destinatarios: dest, deNombre: nombreCompleto.trim() || perfil?.nombre || correo, desde, hasta, horario, documento: sinDatos.texto });
        archivo = descargarBlob(r.blob, tituloDocx());
      } else {
        const documento = conMotivo(doc, motivo);
        await enviarAvisos({ destinatarios: dest, deNombre: perfil?.nombre || correo, desde, hasta, horario, documento: doc });
        const titulo = `Comunicacion de ausencia ${perfil?.nombre || ""} ${desde}`;
        archivo = await exportarWordContenido(documento, titulo, { encabezadoId: encabezado });
      }
      const para = [...dest.map(d => d.email), ...correosOtros];
      const cuerpo = `Buenos días:\n\nOs comunico mi ausencia ${fechasAusencia(desde, hasta)} (${horario.toLowerCase()}).${motivoCorreo ? `\nMotivo: ${motivoCorreo}` : ""}${observaciones.trim() ? `\n${observaciones.trim()}` : ""}\n\nOs adjunto el documento de comunicación de ausencia.\n\nUn saludo,\n${(modoDocx && nombreCompleto.trim()) || perfil?.nombre || ""}`;
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
      <p className="crm-muted">{modoDocx ? "AulaIA rellena el documento oficial del colegio (el Word original, sin cambiarlo)." : "Carmen rellena el documento oficial del colegio."} A quien elijas le llega un aviso en AulaIA y se abre tu Gmail institucional con el correo preparado. El motivo no se guarda en AulaIA: solo va en el Word y en el correo.</p>

      <section className="card crm-form">
        <div className="aus-cuando">
          <h3>¿Cuándo vas a faltar?</h3>
          {conHorario && <button type="button" className={`aus-completo ${diaCompleto ? "aus-completo-on" : ""}`} aria-pressed={diaCompleto} onClick={() => setSelHoras(diaCompleto ? [] : horasDia.map(h => h.slotId))}>🗓️ Día completo</button>}
        </div>
        <div className="aus-elegir">
        <div className="aus-cal">
          <div className="aus-cal-cab">
            <button type="button" className="aus-cal-flecha" onClick={() => setSemBase(n => Math.max(0, n - 1))} disabled={semBase === 0} aria-label="Semanas anteriores">‹</button>
            <strong>{mesCal}</strong>
            <button type="button" className="aus-cal-flecha" onClick={() => setSemBase(n => n + 1)} aria-label="Semanas siguientes">›</button>
            <label className="aus-cal-varios"><input type="checkbox" checked={varios} onChange={e => { setVarios(e.target.checked); if (!e.target.checked) setHasta(""); }} /> Varios días</label>
          </div>
          <div className="aus-cal-grid">
            {["L", "M", "X", "J", "V"].map(x => <span key={x} className="aus-cal-dsem">{x}</span>)}
            {semanas.flat().map(d => {
              const pasado = d < hoyIso;
              const ini = d === desde, fin = d === hasta, dentro = hasta && d > desde && d < hasta;
              return (
                <button key={d} type="button" disabled={pasado} onClick={() => tocarDia(d)} aria-pressed={ini || fin || !!dentro}
                  className={`aus-cal-dia ${ini || fin ? "aus-cal-on" : dentro ? "aus-cal-rango" : ""} ${d === hoyIso ? "aus-cal-hoy" : ""}`}>
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
          <p className="aus-cal-texto">
            {varios && desde && !hasta ? "Ahora toca el último día." : `${hasta ? "Del" : ""} ${new Date(`${desde}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}${hasta ? ` al ${new Date(`${hasta}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}` : ""}`}
          </p>
        </div>
        <div className="aus-elegir-horas">
        {horasDia === null ? null : conHorario ? (
          <>
            <p className="field-hint" style={{ margin: "6px 0 0" }}>Toca las horas en las que vas a faltar{hasta && hasta !== desde ? " (las mismas cada día)" : ""}.</p>
            <div className="aus-horas">
              {horasDia.map(h => {
                const [i, f] = h.time.split("-").map(x => x.trim());
                const asig = h.subjectId ? (ASIGNATURAS_AGENDA[h.subjectId] || h.subjectId) : "";
                const on = selHoras.includes(h.slotId);
                return (
                  <button key={h.slotId} type="button" className="aus-fila" aria-pressed={on} onClick={() => toggleHora(h.slotId)}>
                    <span className="aus-hora"><b>{i}</b><small>{f}</small></span>
                    <span className={`aus-clase ${asig ? "" : "aus-libre"} ${on ? "aus-marcada" : ""}`}>
                      {asig ? <><strong>{h.group || asig}</strong>{h.group && <em>{asig}</em>}</> : "Sin clase"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="aus-resumen">{hIni ? <>En el documento: {diaCompleto ? "día completo, " : ""}desde las <b>{hIni}</b> hasta las <b>{hFin}</b>.</> : "Marca al menos una hora."}</p>
          </>
        ) : (
          <>
            <div className="chips-grid" role="radiogroup" aria-label="Horario">
              <button type="button" role="radio" aria-checked={jornada === "completa"} className={`chip chip-small ${jornada === "completa" ? "chip-active" : ""}`} onClick={() => setJornada("completa")}><span className="chip-label">Todo el día</span></button>
              <button type="button" role="radio" aria-checked={jornada === "horas"} className={`chip chip-small ${jornada === "horas" ? "chip-active" : ""}`} onClick={() => setJornada("horas")}><span className="chip-label">Solo algunas horas</span></button>
            </div>
            {modoDocx ? (
              <div className="crm-form-row">
                <Campo label="Desde las"><input type="time" className="input-tema" value={horaIni} onChange={e => setHoraIni(e.target.value)} /></Campo>
                <Campo label="Hasta las"><input type="time" className="input-tema" value={horaFin} onChange={e => setHoraFin(e.target.value)} /></Campo>
              </div>
            ) : jornada === "horas" ? (
              <input className="input-tema" style={{ maxWidth: 260 }} value={horas} onChange={e => setHoras(e.target.value)} placeholder="Ej.: de 9:00 a 11:20" aria-label="Horas" />
            ) : null}
            {desde && <p className="field-hint" style={{ marginTop: 0 }}>{new Date(`${desde}T00:00:00`).getDay() % 6 === 0 ? "Ese día es fin de semana." : "Si rellenas tu horario semanal en la Agenda, aquí podrás tocar las horas directamente."}</p>}
          </>
        )}
        </div>
        </div>
        {modoDocx ? (
          <>
            <Campo label="Tu nombre y apellidos" hint="Así aparece en el documento. Se recuerda para la próxima vez.">
              <input className="input-tema" value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)} placeholder="Nombre y apellidos" />
            </Campo>
            {opciones.length > 0 && (
              <Campo label="Tipo de permiso" hint="Se marca su casilla en el documento. No se guarda en AulaIA.">
                <select className="input-tema" value={opcion} onChange={e => setOpcion(e.target.value)}>
                  <option value="">— Sin marcar —</option>
                  {opciones.map(o => <option key={o.i} value={o.i}>{o.texto}</option>)}
                </select>
              </Campo>
            )}
            <Campo label="Detalle del motivo (opcional)" hint="Se escribe junto a la casilla elegida (p. ej. el grado de parentesco) o en «Otros». No se guarda en AulaIA.">
              <input className="input-tema" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: padre · revisión médica · curso de formación…" />
            </Campo>
            <Campo label="Documentos aportados (opcional)">
              <input className="input-tema" value={documentos} onChange={e => setDocumentos(e.target.value)} placeholder="Ej.: justificante de la consulta" />
            </Campo>
          </>
        ) : (<>
        <Campo label="Motivo" hint="No se guarda en AulaIA: solo se escribe en el Word y en el correo.">
          <input className="input-tema" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: consulta médica, asuntos propios, formación…" />
        </Campo>
        </>)}
        <Campo label="Observaciones (opcional)" hint={modoDocx ? "Van en el correo, no en el documento." : undefined}>
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
        {!modoDocx && <EncabezadoSelect value={encabezado} onChange={setEncabezado} etiqueta="🏷️ Encabezado del Word" />}

        <p className="field-hint">
          {plantilla === null ? "" : modoDocx ? "📄 Documento oficial del colegio cargado: AulaIA rellena sus huecos y lo deja exactamente igual que el original." : plantilla.trim() ? "📄 Documento oficial del colegio cargado: Carmen lo rellenará con el mismo formato." : "📄 Aún no hay documento oficial del colegio: Carmen escribirá una comunicación formal estándar."}
          {puedePlantilla && <> <button type="button" className="btn-back-sm" onClick={() => setEditarPlantilla(v => !v)}>{editarPlantilla ? "Cerrar" : plantilla?.trim() ? "⚙️ Cambiar el documento oficial" : "⚙️ Subir el documento oficial"}</button></>}
        </p>
        {editarPlantilla && (
          <div className="card" style={{ background: "#f8fafc" }}>
            <p className="crm-muted" style={{ marginTop: 0 }}>Sube el modelo en Word (.docx) o pega su texto. Lo usará todo el profesorado de tu centro.</p>
            <div className="crm-modal-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="doc-btn" onClick={() => fileRef.current?.click()}>📎 Subir Word (.docx)</button>
              <input ref={fileRef} type="file" accept=".docx,.txt,.md" hidden onChange={e => leerPlantilla(e.target.files?.[0])} />
            </div>
            {esPlantillaDocx(textoPlantilla)
              ? <p className="crm-aviso" style={{ margin: "8px 0" }}>✅ Word con huecos marcados ({"{NOMBRE}"}, {"{CASILLA}"}…). AulaIA rellenará el documento original sin cambiar su formato. <button type="button" className="btn-back-sm" onClick={() => setTextoPlantilla("")}>Quitar</button></p>
              : <>
                  <textarea className="input-tema" rows={10} value={textoPlantilla} onChange={e => setTextoPlantilla(e.target.value)} placeholder="Texto del documento oficial de comunicación de ausencias…" />
                  <p className="field-hint">Para que quede idéntico al original, sube un Word con huecos marcados: {"{NOMBRE}"}, {"{DIAS}"}, {"{HORA_INICIO}"}, {"{HORA_FIN}"}, {"{DIA}"} {"{MES}"} {"{ANIO}"}, {"{DOCUMENTOS}"} y {"{CASILLA}"} delante de cada opción con casilla.</p>
                </>}
            <div className="crm-modal-actions"><span style={{ flex: 1 }} /><button type="button" className="library-new-btn" onClick={guardarPlantilla}>💾 Guardar documento oficial</button></div>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}
        {ok && <p className="crm-aviso">✅ {ok}{gmailUrl && <> <a href={gmailUrl} target="_blank" rel="noopener noreferrer">Abrir Gmail otra vez</a></>}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          {!modoDocx && redactando && <button className="btn-back" onClick={() => ctrl.current?.abort()}>Cancelar</button>}
          {modoDocx
            ? <button className="generate-btn generate-active" onClick={prepararDocx}>{relleno ? "🔄 Actualizar el documento" : "📄 Preparar el documento"}</button>
            : <button className="generate-btn generate-active" onClick={redactar} disabled={redactando}>{redactando ? "Carmen está rellenando el documento…" : doc ? "✨ Volver a rellenar" : "✨ Que Carmen rellene el documento"}</button>}
        </div>
      </section>

      {modoDocx && relleno && (
        <section className="card">
          <p className="crm-card-title" style={{ marginTop: 0 }}>Documento relleno (revísalo antes de enviarlo)</p>
          <div className="resultado-body" style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{relleno.texto}</div>
          <p className="field-hint">Esto es un resumen del texto: el Word que se descarga es el original del colegio, con su mismo formato.</p>
          <div className="crm-modal-actions" style={{ flexWrap: "wrap" }}>
            <span style={{ flex: 1 }} />
            <button className="btn-word" onClick={() => descargarBlob(relleno.blob, tituloDocx())}>📄 Solo descargar Word</button>
            <button className="library-new-btn" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "📨 Enviar a dirección"}</button>
          </div>
        </section>
      )}

      {!modoDocx && doc && (
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
