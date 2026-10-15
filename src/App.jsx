import { useCallback, useEffect, useState } from "react";
import { useSession } from "./lib/AuthContext";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import LibraryPage from "./pages/LibraryPage";
import DocPage from "./pages/DocPage";
import Navbar from "./components/Navbar";
import AgendaEmbed from "./components/AgendaEmbed";
import EquipoPage from "./pages/EquipoPage";
import PerfilPage from "./pages/PerfilPage";
import AdminPage from "./pages/AdminPage";
import SustitucionesPage from "./pages/SustitucionesPage";
import SustAvisos from "./components/SustAvisos";
import { misEtapasSust } from "./lib/sustituciones";
import Modal from "./components/Modal";
import { miPerfil } from "./lib/equipo";
import Sidebar from "./components/Sidebar";
import ClaseModal from "./components/ClaseModal";
import HomePage from "./pages/HomePage";
import ClasePage from "./pages/ClasePage";
import AlumnoPage from "./pages/AlumnoPage";
import AgendaPage from "./pages/AgendaPage";
import ModelosPage from "./pages/ModelosPage";
import AgendaConexionModal from "./components/AgendaConexionModal";
import { iniciarAgenda, pedirSincronizacion } from "./lib/agenda";
import { mensajeError } from "./lib/crm";
import { COMUNIDADES, ETAPAS, CURSOS, AREAS, NECESIDADES } from "./lib/datos";
import { leerStreamSSE } from "./lib/stream";
import { exportarWordContenido } from "./lib/word";
import { renderResultado } from "./lib/render";
import { listarEspecialistas, resumenGrupo, tokenActual } from "./lib/equipo";
import "./App.css";
import "./crm.css";

const OBJETIVOS = [
  "Comunicación y lenguaje","Atención y concentración","Autonomía e independencia",
  "Habilidades sociales","Lectoescritura","Cálculo y numeración",
  "Autorregulación emocional","Motricidad fina / gruesa","Comprensión lectora",
  "Expresión oral","Resolución de problemas","Trabajo en equipo",
];
const METODOLOGIAS = [
  { id:"abj",        label:"Aprendizaje Basado en el Juego",       emoji:"🎮", siglas:"ABJ" },
  { id:"tbl",        label:"Aprendizaje Basado en el Pensamiento", emoji:"🧠", siglas:"TBL" },
  { id:"abp_prob",   label:"Aprendizaje Basado en Problemas",      emoji:"🔍", siglas:"ABP" },
  { id:"abp_proy",   label:"Aprendizaje Basado en Proyectos",      emoji:"📐", siglas:"ABP" },
  { id:"cooperativo",label:"Aprendizaje Cooperativo",              emoji:"🤝", siglas:"AC" },
  { id:"design",     label:"Design Thinking",                      emoji:"💡", siglas:"DT" },
  { id:"flipped",    label:"Flipped Classroom",                    emoji:"🔄", siglas:"FC" },
  { id:"gamificacion",label:"Gamificación",                        emoji:"🏆", siglas:"" },
  { id:"talleres",   label:"Talleres (Workshop)",                  emoji:"🛠️", siglas:"" },
];
const IDIOMAS = ["Castellano","Inglés","Català","Valencià","Euskera","Galego"];

const TIPOS_RESULTADO = {
  nee:[
    { id:"actividades",  label:"Actividades adaptadas",        emoji:"🎯" },
    { id:"programacion", label:"Programación didáctica",       emoji:"📋" },
    { id:"aci",          label:"ACI (Anexo oficial)",          emoji:"✏️" },
    { id:"dua",          label:"Diseño Universal (DUA)",       emoji:"♾️" },
    { id:"pti",          label:"PTI (Anexo oficial)",          emoji:"📌" },
    { id:"recursos",     label:"Recursos y materiales",        emoji:"🛠️" },
  ],
  ordinario:[
    { id:"situacion",    label:"Situación de Aprendizaje",     emoji:"💡" },
    { id:"programacion", label:"Programación didáctica",       emoji:"📋" },
    { id:"actividades",  label:"Actividades y tareas",         emoji:"🎯" },
    { id:"rubrica",      label:"Rúbrica de evaluación",        emoji:"📊" },
    { id:"recursos",     label:"Recursos y materiales",        emoji:"🛠️" },
    { id:"familias",     label:"Comunicación familias",        emoji:"👨‍👩‍👧" },
  ],
  mixto:[
    { id:"mixto_situacion",    label:"Situación de Aprendizaje inclusiva", emoji:"💡" },
    { id:"mixto_programacion", label:"Programación inclusiva",             emoji:"📋" },
    { id:"mixto_actividades",  label:"Actividades dos niveles",            emoji:"🎯" },
    { id:"mixto_dua",          label:"Programación DUA",                   emoji:"♾️" },
    { id:"mixto_rubrica",      label:"Rúbrica multinivel",                 emoji:"📊" },
    { id:"mixto_plan",         label:"Plan de inclusión del aula",         emoji:"🤝" },
  ],
};

const TIPOS_CON_DURACION = ["actividades","mixto_actividades"];
const TIPOS_CON_SESIONES = ["situacion","programacion","aci","dua","pti","mixto_situacion","mixto_programacion","mixto_dua","mixto_plan"];
const DURACION_SESION = ["15 min","30 min","45 min","1 hora","1,5 horas","Sesión doble"];
const NUM_SESIONES = ["1 sesión","2 sesiones","3 sesiones","4 sesiones","5 sesiones","6 sesiones","8 sesiones","10 sesiones","12 sesiones"];

const TEMAS_POR_AREA = {
  "Lengua y Literatura": "Ej: los animales, el otoño, tipos de textos, el adjetivo, la narración...",
  "Matemáticas": "Ej: sumas con llevadas, fracciones, tablas de multiplicar, geometría, divisiones...",
  "Ciencias Naturales": "Ej: el cuerpo humano, los ecosistemas, los animales vertebrados, la célula...",
  "Ciencias Sociales": "Ej: la prehistoria, los climas, los continentes, la Edad Media, el municipio...",
  "Inglés": "Ej: family vocabulary, present simple, colours and shapes, describing people...",
  "Educación Física": "Ej: el juego cooperativo, atletismo, expresión corporal, deportes de equipo...",
  "Música": "Ej: las figuras musicales, instrumentos de viento, la canción popular, el ritmo...",
  "Plástica": "Ej: los colores primarios, el retrato, la escultura, técnicas de pintura...",
  "Tutoría / Habilidades sociales": "Ej: las emociones, la resolución de conflictos, la amistad, la autoestima...",
  "Autonomía personal": "Ej: el aseo personal, organizar la mochila, pedir ayuda, rutinas diarias...",
  "Comunicación y representación": "Ej: los cuentos, el trazo, canciones, los colores, mi familia...",
  "Conocimiento del entorno": "Ej: las estaciones, los animales, el barrio, las plantas, los números...",
  "Identidad y autonomía personal": "Ej: mis emociones, me presento, mi cuerpo, mis rutinas...",
  "Física y Química": "Ej: la materia y sus estados, las fuerzas, la tabla periódica, reacciones químicas...",
  "Biología y Geología": "Ej: la célula, la genética, los ecosistemas, los minerales y rocas...",
  "Geografía e Historia": "Ej: la Revolución Francesa, climas del mundo, la Edad Moderna, la industria...",
  "Tecnología": "Ej: programación básica, materiales y sus propiedades, electricidad, diseño CAD...",
  "Valores Cívicos": "Ej: la democracia, los derechos humanos, el medio ambiente, la igualdad...",
  "Tutoría": "Ej: técnicas de estudio, gestión del estrés, proyecto de vida, habilidades sociales...",
  "Historia": "Ej: la Guerra Civil, la Segunda Guerra Mundial, la Transición española...",
  "Filosofía": "Ej: el conocimiento, la ética, Platón, el existencialismo, la lógica...",
  "Física": "Ej: la mecánica newtoniana, el electromagnetismo, la óptica, termodinámica...",
  "Química": "Ej: estequiometría, equilibrio químico, ácidos y bases, química orgánica...",
  "Biología": "Ej: la genética mendeliana, la evolución, la inmunología, biotecnología...",
  "Economía": "Ej: oferta y demanda, el mercado laboral, el sistema financiero, macroeconomía...",
  "Arte": "Ej: el Renacimiento, el arte contemporáneo, análisis de obras, arquitectura...",
};

const MODOS = [
  { id:"nee",       emoji:"🧩", label:"Solo NEE",         desc:"Programación exclusivamente para alumnado con NEE" },
  { id:"ordinario", emoji:"📚", label:"Ordinario",         desc:"Programación para el grupo clase completo" },
  { id:"mixto",     emoji:"🤝", label:"Mixto / Inclusivo", desc:"Grupo ordinario + adaptaciones NEE integradas en un solo documento" },
];

const FIRMA_COMPLETO = "✅ Documento completo generado por AulaIA";
const FIRMA_INCOMPLETO = "⚠️ Documento incompleto";

const BtnCancelar = ({ onClick }) => (
  <button onClick={onClick} style={{
    width:"100%", marginTop:12, padding:"14px", borderRadius:14,
    border:"2px solid rgba(220,38,38,0.3)", background:"rgba(220,38,38,0.06)",
    color:"#dc2626", fontFamily:"var(--font-body)", fontSize:14, fontWeight:700,
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
  }}>
    ⏹ Cancelar generación
  </button>
);

// ─── COPIAR TEXTO LIMPIO ──────────────────────────────────────────────────────
const copiarTextoLimpio = async (texto) => {
  let limpio = texto
    .replace(/---\n✅ Documento completo generado por AulaIA/g,"")
    .replace(/---\n⚠️[^\n]*/g,"")
    .replace(/^#{1,6} (.+)$/gm, (_,t) => t.toUpperCase())
    .replace(/\*\*([^*]+)\*\*/g,"$1")
    .replace(/\*\*/g,"")
    .replace(/^\|(.+)\|$/gm, (line) => {
      if (line.includes("---")) return "";
      return line.split("|").filter(c=>c.trim()).map(c=>c.trim()).join("\t");
    })
    .replace(/^- (.+)$/gm,"• $1")
    .replace(/^  - (.+)$/gm,"  ◦ $1")
    .replace(/^---$/gm,"")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
  try { await navigator.clipboard.writeText(limpio); }
  catch {
    const ta=document.createElement("textarea");ta.value=limpio;
    ta.style.position="fixed";ta.style.opacity="0";
    document.body.appendChild(ta);ta.focus();ta.select();
    document.execCommand("copy");document.body.removeChild(ta);
  }
};

// ─── COMPONENTES PEQUEÑOS ────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  return (
    <div className="progress-wrap">
      <div className="progress-track"><div className="progress-fill" style={{ width:`${(step/total)*100}%` }} /></div>
      <span className="progress-label">Paso {step} de {total}</span>
    </div>
  );
}
function StepHeader({ n, title, sub }) {
  return (
    <div className="card-header">
      <span className="step">{n}</span>
      <div><h2 className="card-title">{title}</h2>{sub && <p className="card-sub">{sub}</p>}</div>
    </div>
  );
}
function Chip({ label, emoji, desc, selected, onClick, small }) {
  return (
    <button className={`chip ${selected?"chip-active":""} ${small?"chip-small":""}`} onClick={onClick}>
      {emoji && <span className="chip-emoji">{emoji}</span>}
      <span className="chip-label">{label}</span>
      {desc && !small && <span className="chip-desc">{desc}</span>}
    </button>
  );
}
function NavBtns({ onBack, onNext, nextLabel="Siguiente →", nextDisabled }) {
  return (
    <div className="nav-btns">
      {onBack && <button className="btn-back" onClick={onBack}>← Atrás</button>}
      <button className={`btn-next ${!nextDisabled?"btn-next-active":""}`} onClick={onNext} disabled={nextDisabled}>{nextLabel}</button>
    </div>
  );
}

// ─── ACCION CARD — con continuar ─────────────────────────────────────────────
function AccionResultado({ tipo, texto, label, emoji, area, curso, comunidad, modo, etapa, duracion, necesidades, numAlumnos, objetivos, idioma, metodologias, onUpdate }) {
  const [copiado, setCopiado] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [expandido, setExpandido] = useState(true);
  const [continuando, setContinuando] = useState(false);

  const estaCompleto = texto.includes(FIRMA_COMPLETO);
  const estaIncompleto = !estaCompleto && texto.length > 100 && !continuando;

  const copiar = async () => {
    await copiarTextoLimpio(texto);
    setCopiado(true); setTimeout(()=>setCopiado(false), 2000);
  };

  const descargarWord = async () => {
    if (!texto || descargando) return;
    setDescargando(true);
    try { await exportarWordContenido(texto, `${label} — ${area} ${curso}`); }
    catch(e) { console.error(e); alert("Error generando el documento Word."); }
    finally { setDescargando(false); }
  };

  const continuar = async () => {
    if (continuando) return;
    setContinuando(true);
    const ultimas = texto.slice(-3000);
    try {
      const res = await fetch("/api/generar", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          comunidad, modo, etapa, curso, area, duracion,
          necesidades, numAlumnos, objetivos, tipoResultado: tipo,
          idioma, metodologias,
          continuarDesde: ultimas,
        }),
      });
      if (!res.ok) throw new Error();
      let nuevaParte = "";
      await leerStreamSSE(res, (d) => { nuevaParte += d; onUpdate(texto + nuevaParte); });
    } catch(e) { console.error(e); }
    finally { setContinuando(false); }
  };

  return (
    <div style={{marginTop:16,background:"rgba(255,255,255,0.85)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(249,115,22,0.08)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",background:"rgba(249,115,22,0.06)",borderBottom:expandido?"1px solid rgba(249,115,22,0.12)":"none",cursor:"pointer"}} onClick={()=>setExpandido(p=>!p)}>
        <span style={{fontWeight:700,fontSize:14,color:"#1c1917"}}>{emoji} {label}</span>
        <div style={{display:"flex",gap:8,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
          {texto && <>
            <button className="btn-copy" style={{padding:"5px 12px",fontSize:12}} onClick={copiar}>{copiado?"✅ Copiado":"📋 Copiar"}</button>
            <button className="btn-word" style={{padding:"5px 12px",fontSize:12}} onClick={descargarWord} disabled={descargando}>{descargando?"⏳...":"📄 Word"}</button>
          </>}
          <span style={{fontSize:12,color:"#78716c"}}>{expandido?"▲":"▼"}</span>
        </div>
      </div>
      {expandido&&(
        <div className="resultado-body" style={{maxHeight:500,borderRadius:0,border:"none",boxShadow:"none"}}>
          {texto
            ? <>
                {renderResultado(texto)}
                {continuando && <span className="cursor-blink">▌</span>}

                {/* Banner completo */}
                {estaCompleto && !continuando && (
                  <div style={{margin:"16px 0 4px",padding:"10px 16px",background:"rgba(13,148,136,0.08)",border:"1px solid rgba(13,148,136,0.25)",borderRadius:10,display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#0d9488",fontWeight:700}}>
                    ✅ Documento completo
                  </div>
                )}

                {/* Banner incompleto + botón continuar */}
                {estaIncompleto && !continuando && (
                  <div style={{margin:"16px 0 4px",padding:"14px 16px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.35)",borderRadius:10,display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{fontSize:13,color:"#b45309",fontWeight:700}}>⚠️ El documento no ha terminado de generarse</div>
                    <button onClick={continuar} style={{alignSelf:"flex-start",padding:"8px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg, #f59e0b, #f97316)",color:"#fff",fontFamily:"var(--font-body)",fontSize:13,fontWeight:800,cursor:"pointer"}}>
                      ▶️ Continuar generando
                    </button>
                  </div>
                )}

                {/* Spinner continuando */}
                {continuando && (
                  <div style={{margin:"12px 0",padding:"10px 16px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#b45309"}}>
                    <span className="spinner" style={{width:14,height:14,borderTopColor:"#f59e0b",borderColor:"rgba(245,158,11,0.2)"}}/>
                    Continuando la generación...
                  </div>
                )}
              </>
            : <div style={{display:"flex",alignItems:"center",gap:10,color:"#78716c",fontSize:14}}>
                <span className="spinner" style={{width:16,height:16,borderTopColor:"#f97316",borderColor:"rgba(249,115,22,0.2)"}}/>
                Generando {label.toLowerCase()}...
              </div>
          }
        </div>
      )}
    </div>
  );
}

const ACCIONES_META = {
  rubrica:      { label:"Rúbrica de evaluación",         emoji:"📊" },
  cotejo:       { label:"Lista de cotejo",               emoji:"✅" },
  examen:       { label:"Examen / prueba escrita",       emoji:"📝" },
  preguntas:    { label:"Preguntas de comprensión",      emoji:"❓" },
  ficha:        { label:"Ficha de trabajo",              emoji:"📄" },
  manipulativo: { label:"Material manipulativo",         emoji:"✂️" },
  flashcards:   { label:"Tarjetas / Flashcards",         emoji:"🃏" },
  pictogramas:  { label:"Apoyos visuales y pictogramas", emoji:"🖼️" },
  cuento:       { label:"Cuento o texto adaptado",       emoji:"📖" },
  familias:     { label:"Carta informativa a familias",  emoji:"💌" },
  plan_alumno:  { label:"Plan de trabajo del alumno",    emoji:"📌" },
};

// ─── GENERADOR ───────────────────────────────────────────────────────────────
function Generator({ onSaved, contexto }) {
  const TOTAL = 4;
  // Contexto opcional: cuando se abre desde una clase o desde la ficha de un alumno
  const ctxClase = contexto?.clase || null;
  const ctxAlumno = contexto?.alumno || null;
  const comentarioInicial = ctxAlumno?.tiene_nee
    ? [ctxAlumno.perfil_nee?.medidas && `Medidas del alumno/a: ${ctxAlumno.perfil_nee.medidas}`,
       ctxAlumno.perfil_nee?.apoyos && `Apoyos: ${ctxAlumno.perfil_nee.apoyos}`].filter(Boolean).join(". ")
    : "";
  const [step, setStep]               = useState(1);
  const [comunidad, setComunidad]     = useState(ctxClase?.comunidad || "");
  const [modo, setModo]               = useState(ctxAlumno ? (ctxAlumno.tiene_nee ? "nee" : "ordinario") : "");
  const [idioma, setIdioma]           = useState("Castellano");
  const [comentario, setComentario]   = useState(comentarioInicial);
  const [etapa, setEtapa]             = useState(ctxClase?.etapa || "");
  const [curso, setCurso]             = useState(ctxClase?.curso || "");
  const [area, setArea]               = useState(ctxClase?.area || "");
  const [tema, setTema]               = useState("");
  const [necesidades, setNecesidades] = useState(ctxAlumno?.perfil_nee?.necesidades || []);
  const [numAlumnos, setNumAlumnos]   = useState(ctxAlumno ? 1 : 2);
  const [objetivos, setObjetivos]     = useState([]);
  const [metodologias, setMetodologias] = useState([]);
  const [tipoResultado, setTipoResultado] = useState("");
  const [duracion, setDuracion]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [continuando, setContinuando] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [resultado, setResultado]     = useState("");
  const [savedDocId, setSavedDocId]   = useState(null);
  const [documentoCompleto, setDocumentoCompleto] = useState(false);
  const [documentoIncompleto, setDocumentoIncompleto] = useState(false);
  const [seccionesFaltantes, setSeccionesFaltantes] = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [copiado, setCopiado]         = useState(false);
  const [accionGenerando, setAccionGenerando] = useState("");
  const [acciones, setAcciones]       = useState([]);
  const [error, setError]             = useState("");
  const [especialistas, setEspecialistas] = useState([]);
  useEffect(() => { listarEspecialistas(false).then(setEspecialistas).catch(() => {}); }, []);
  const espDeTipo = (t) => especialistas.find(e => (e.tipos || []).includes(t));
  // Datos para que el especialista del equipo trabaje con tu perfil y tu grupo
  const extraEquipo = async () => ({ accessToken: await tokenActual(), grupoTexto: await resumenGrupo(ctxClase, ctxAlumno).catch(() => "") });

  const toggle = (list, setList, id) => setList(p => p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const needsDuracion = TIPOS_CON_DURACION.includes(tipoResultado);
  const needsSesiones = TIPOS_CON_SESIONES.includes(tipoResultado);
  const needsAnyDuracion = needsDuracion || needsSesiones;
  const canStep1 = comunidad && modo;
  const canStep2 = etapa && curso && area;
  const canStep3 = (modo === "ordinario" || necesidades.length > 0) && !!tipoResultado;
  const canStep4 = !needsAnyDuracion || !!duracion;

  const procesarStream = async (res, onChunk, signal) => {
    let full = "";
    await leerStreamSSE(res, (d) => { full += d; onChunk(full); }, signal);
    return full;
  };

  const cancelar = () => {
    if (abortController) { abortController.abort(); setAbortController(null); }
    setLoading(false); setError("");
  };

  const generar = async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true); setError(""); setResultado(""); setSaved(false);
    setAcciones([]); setDocumentoCompleto(false); setDocumentoIncompleto(false);
    setSeccionesFaltantes(""); setSavedDocId(null);
    try {
      const res = await fetch("/api/generar", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ comunidad, modo, etapa, curso, area, duracion, tema, necesidades, numAlumnos, objetivos, tipoResultado, comentario, idioma, metodologias, ...(await extraEquipo()) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error();
      const full = await procesarStream(res, (texto) => setResultado(texto), controller.signal);
      if (controller.signal.aborted) return;
      if (full.includes(FIRMA_COMPLETO)) { setDocumentoCompleto(true); }
      else if (full.includes(FIRMA_INCOMPLETO)) {
        setDocumentoIncompleto(true);
        const match = full.match(/⚠️ Documento incompleto — faltan las siguientes secciones: ([^\n]+)/);
        if (match) setSeccionesFaltantes(match[1]);
      } else { setDocumentoIncompleto(true); }
      if (full) {
        setSaving(true);
        const titulo = `${TIPOS_RESULTADO[modo]?.find(t=>t.id===tipoResultado)?.label||tipoResultado} — ${area} ${curso}${ctxAlumno ? ` — ${ctxAlumno.nombre}` : ""}`;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: inserted } = await supabase.from("programaciones").insert({
            user_id: user.id, titulo, modo, tipo_resultado:tipoResultado,
            comunidad, etapa, curso, area, duracion,
            necesidades, num_alumnos:numAlumnos, objetivos,
            comentario, contenido: full, compartido: false,
            ...(ctxClase ? { clase_id: ctxClase.id } : {}), ...(ctxAlumno ? { alumno_id: ctxAlumno.id } : {}),
          }).select("id").single();
          if (inserted?.id) setSavedDocId(inserted.id);
        }
        setSaved(true); setSaving(false);
      }
    } catch(e) {
      if (e.name !== 'AbortError') setError("Error al generar. Inténtalo de nuevo.");
    } finally { setLoading(false); setAbortController(null); }
  };

  const continuar = async () => {
    if (!resultado || continuando) return;
    setContinuando(true); setDocumentoIncompleto(false); setSeccionesFaltantes("");
    const ultimas = resultado.slice(-3000);
    try {
      const res = await fetch("/api/generar", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ comunidad, modo, etapa, curso, area, duracion, tema, necesidades, numAlumnos, objetivos, tipoResultado, comentario, idioma, metodologias, continuarDesde: ultimas }),
      });
      if (!res.ok) throw new Error();
      let textoAnterior = resultado;
      const full = await procesarStream(res, (nuevasParte) => setResultado(textoAnterior + nuevasParte));
      const textoFinal = textoAnterior + full;
      if (textoFinal.includes(FIRMA_COMPLETO)) { setDocumentoCompleto(true); }
      else { setDocumentoIncompleto(true); }
      if (savedDocId) await supabase.from("programaciones").update({ contenido: textoFinal }).eq("id", savedDocId);
    } catch { setError("Error al continuar. Inténtalo de nuevo."); }
    finally { setContinuando(false); }
  };

  const exportarWord = async () => {
    if (!resultado || descargando) return;
    setDescargando(true);
    try {
      const tituloDoc = `${TIPOS_RESULTADO[modo]?.find(t=>t.id===tipoResultado)?.label||tipoResultado} — ${area} ${curso}`;
      await exportarWordContenido(resultado, tituloDoc);
    } catch(e) { console.error(e); alert("Error generando el documento."); }
    finally { setDescargando(false); }
  };

  const copiarPrincipal = async () => {
    await copiarTextoLimpio(resultado);
    setCopiado(true); setTimeout(()=>setCopiado(false), 2000);
  };

  const generarAccion = async (tipo) => {
    if (!resultado || accionGenerando) return;
    const meta = ACCIONES_META[tipo];
    if (!meta) return;
    setAccionGenerando(tipo);
    setAcciones(prev=>{
      const idx=prev.findIndex(a=>a.tipo===tipo);
      const item={tipo,label:meta.label,emoji:meta.emoji,texto:""};
      if(idx>=0){const u=[...prev];u[idx]=item;return u;}
      return [...prev,item];
    });
    setTimeout(()=>document.querySelector('.acciones-siguientes')?.scrollIntoView({behavior:'smooth',block:'end'}),100);

    const ACCIONES_PROMPT = {
      rubrica:"una rúbrica de evaluación EN FORMATO TABLA con 4-5 criterios y 4 niveles (Excelente, Satisfactorio, En proceso, Iniciando). Descriptores concretos. Columna de peso.",
      cotejo:"una lista de cotejo EN FORMATO TABLA: Indicador | Sí | No | En proceso | Observaciones. Mínimo 12 indicadores.",
      examen:"un examen completo: cabecera, instrucciones, 4 tipos de preguntas. Versión simplificada para NEE al final.",
      preguntas:"15 preguntas: 5 literales, 5 inferenciales, 5 críticas. Con nivel indicado y respuestas modelo.",
      ficha:"una ficha de trabajo completa para el alumnado con exactamente 4 actividades numeradas, instrucciones claras, espacios de respuesta con líneas (_______), autoevaluación y nota para el maestro. SIN recuadros ASCII ni arte de texto.",
      manipulativo:"material manipulativo: nombre, objetivo, materiales, instrucciones paso a paso, adaptaciones NEE.",
      flashcards:"16 tarjetas EN TABLA: Nº | Cara A | Cara B | Nivel.",
      pictogramas:"guía de apoyos visuales: lista con descripción, uso, secuencias y recursos (ARASAAC).",
      cuento:"cuento 400-600 palabras + preguntas de comprensión + glosario + versión simplificada NEE.",
      familias:"carta a familias: saludo, qué se trabajará, cómo apoyar en casa, despedida.",
      plan_alumno:"plan semanal: días, tareas claras, casillas para marcar, autoevaluación.",
    };

    const prompt = `Basándote en esta programación, crea ${ACCIONES_PROMPT[tipo]}\n\nDOCUMENTO BASE:\n${resultado.slice(0,2000)}\n\nDATOS: ${etapa} · ${curso} · ${area} · ${comunidad}${necesidades.length?` · NEE: ${necesidades.join(", ")}`:""}\nIDIOMA: ${idioma}\n\nCompleta TODO. NUNCA uses recuadros ASCII. Al terminar escribe exactamente:\n---\n✅ Documento completo generado por AulaIA`;

    try {
      const res=await fetch("/api/generar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({comunidad,modo,etapa,curso,area,duracion,tema,necesidades,numAlumnos,objetivos,tipoResultado:tipo,comentario,idioma,metodologias,promptOverride:prompt,...(await extraEquipo())})});
      if(!res.ok)throw new Error();
      const textoAccion = await procesarStream(res, (texto) => {
        setAcciones(prev=>{const idx=prev.findIndex(a=>a.tipo===tipo);if(idx<0)return prev;const u=[...prev];u[idx]={...u[idx],texto};return u;});
      });
      // Se guarda sola en Mis documentos, para no perderla al salir
      try { const { data: { user } } = await supabase.auth.getUser(); if (user && textoAccion) await supabase.from("programaciones").insert({ user_id: user.id, titulo: `${meta.label} — ${area} ${curso}${ctxAlumno ? ` — ${ctxAlumno.nombre}` : ""}`.slice(0, 200), modo, tipo_resultado: tipo, comunidad, etapa, curso, area, duracion, necesidades, num_alumnos: numAlumnos, objetivos, comentario, contenido: textoAccion, compartido: false, ...(ctxClase ? { clase_id: ctxClase.id } : {}), ...(ctxAlumno ? { alumno_id: ctxAlumno.id } : {}) }); } catch {}
    } catch(e){
      setAcciones(prev=>{const idx=prev.findIndex(a=>a.tipo===tipo);if(idx<0)return prev;const u=[...prev];u[idx]={...u[idx],texto:"❌ Error al generar."};return u;});
    } finally{setAccionGenerando("");}
  };

  const actualizarAccion = (tipo, nuevoTexto) => {
    setAcciones(prev=>{
      const idx=prev.findIndex(a=>a.tipo===tipo);
      if(idx<0)return prev;
      const u=[...prev];u[idx]={...u[idx],texto:nuevoTexto};return u;
    });
  };

  const reset = () => {
    setStep(1);setComunidad("");setModo("");setComentario("");setIdioma("Castellano");
    setEtapa("");setCurso("");setArea("");setDuracion("");setTema("");
    setNecesidades([]);setNumAlumnos(2);setObjetivos([]);setMetodologias([]);
    setTipoResultado("");setResultado("");setError("");setSaved(false);
    setAccionGenerando("");setAcciones([]);setDocumentoCompleto(false);
    setDocumentoIncompleto(false);setSeccionesFaltantes("");setSavedDocId(null);
  };

  if (resultado || loading) return (
    <div className="container">
      <div className="resultado">
        <div className="resultado-header">
          <div>
            <h2 className="resultado-title">{loading?"⏳ Generando...":"✅ Listo para usar"}</h2>
            <p className="resultado-sub">{saving?"💾 Guardando...":saved?"💾 Guardado en tu biblioteca":""}</p>
          </div>
          {!loading&&(
            <div className="resultado-actions">
              <button className="btn-copy" onClick={copiarPrincipal}>{copiado?"✅ Copiado":"📋 Copiar"}</button>
              <button className="btn-word" onClick={exportarWord} disabled={descargando}>{descargando?"⏳ Generando...":"📄 Descargar Word"}</button>
              <button className="btn-copy" style={{background:"rgba(129,140,248,0.15)",color:"#a5b4fc",borderColor:"rgba(129,140,248,0.3)"}} onClick={onSaved}>📂 Mi biblioteca</button>
              <button className="btn-reset" onClick={reset}>🔄 Nueva</button>
            </div>
          )}
        </div>

        <div className="resultado-body">
          {renderResultado(resultado)}
          {loading&&<span className="cursor-blink">▌</span>}
        </div>

        {loading && <BtnCancelar onClick={cancelar}/>}

        {documentoCompleto&&!loading&&!continuando&&(
          <div style={{margin:"12px 0",padding:"12px 18px",background:"rgba(13,148,136,0.08)",border:"1px solid rgba(13,148,136,0.3)",borderRadius:12,display:"flex",alignItems:"center",gap:10,fontSize:14,color:"#0d9488",fontWeight:700}}>
            ✅ Documento completo — todas las secciones han sido generadas
          </div>
        )}

        {documentoIncompleto&&!loading&&!continuando&&(
          <div style={{margin:"12px 0",padding:"14px 18px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.35)",borderRadius:12,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:14,color:"#b45309",fontWeight:700}}>⚠️ El documento no ha terminado de generarse</div>
            {seccionesFaltantes&&<p style={{fontSize:13,color:"#92400e",margin:0}}>Secciones pendientes: {seccionesFaltantes}</p>}
            <button onClick={continuar} style={{alignSelf:"flex-start",padding:"10px 20px",borderRadius:10,border:"none",background:"linear-gradient(135deg, #f59e0b, #f97316)",color:"#fff",fontFamily:"var(--font-body)",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 12px rgba(245,158,11,0.35)"}}>
              ▶️ Continuar generando
            </button>
          </div>
        )}

        {continuando&&(
          <div style={{margin:"12px 0",padding:"12px 18px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,display:"flex",alignItems:"center",gap:10,fontSize:14,color:"#b45309"}}>
            <span className="spinner" style={{width:16,height:16,borderTopColor:"#f59e0b",borderColor:"rgba(245,158,11,0.2)"}}/>
            Continuando la generación...
          </div>
        )}

        {!loading&&!continuando&&(
          <div className="acciones-siguientes">
            <p className="acciones-title">✨ Generar a partir de esta programación</p>
            <p className="acciones-grupo">📊 Evaluación</p>
            <div className="acciones-grid">
              {[{id:"rubrica",label:"Rúbrica de evaluación",emoji:"📊"},{id:"cotejo",label:"Lista de cotejo",emoji:"✅"},{id:"examen",label:"Examen / prueba escrita",emoji:"📝"},{id:"preguntas",label:"Preguntas de comprensión",emoji:"❓"}].map(a=>(
                <button key={a.id} className="btn-accion" onClick={()=>generarAccion(a.id)} disabled={!!accionGenerando} style={accionGenerando===a.id?{borderColor:"#f97316",color:"#f97316",background:"rgba(249,115,22,0.08)"}:{}}>
                  {accionGenerando===a.id?<><span className="spinner" style={{width:14,height:14,borderTopColor:"#f97316",borderColor:"rgba(249,115,22,0.2)"}}/> Generando...</>:<>{a.emoji} {a.label}</>}
                </button>
              ))}
            </div>
            <p className="acciones-grupo" style={{marginTop:14}}>🛠️ Materiales</p>
            <div className="acciones-grid">
              {[{id:"ficha",label:"Ficha de trabajo",emoji:"📄"},{id:"manipulativo",label:"Material manipulativo",emoji:"✂️"},{id:"flashcards",label:"Tarjetas / Flashcards",emoji:"🃏"},{id:"pictogramas",label:"Apoyos visuales y pictogramas",emoji:"🖼️"},{id:"cuento",label:"Cuento o texto adaptado",emoji:"📖"}].map(a=>(
                <button key={a.id} className="btn-accion" onClick={()=>generarAccion(a.id)} disabled={!!accionGenerando} style={accionGenerando===a.id?{borderColor:"#f97316",color:"#f97316",background:"rgba(249,115,22,0.08)"}:{}}>
                  {accionGenerando===a.id?<><span className="spinner" style={{width:14,height:14,borderTopColor:"#f97316",borderColor:"rgba(249,115,22,0.2)"}}/> Generando...</>:<>{a.emoji} {a.label}</>}
                </button>
              ))}
            </div>
            <p className="acciones-grupo" style={{marginTop:14}}>👨‍👩‍👧 Comunicación</p>
            <div className="acciones-grid">
              {[{id:"familias",label:"Carta informativa a familias",emoji:"💌"},{id:"plan_alumno",label:"Plan de trabajo del alumno",emoji:"📌"}].map(a=>(
                <button key={a.id} className="btn-accion" onClick={()=>generarAccion(a.id)} disabled={!!accionGenerando} style={accionGenerando===a.id?{borderColor:"#f97316",color:"#f97316",background:"rgba(249,115,22,0.08)"}:{}}>
                  {accionGenerando===a.id?<><span className="spinner" style={{width:14,height:14,borderTopColor:"#f97316",borderColor:"rgba(249,115,22,0.2)"}}/> Generando...</>:<>{a.emoji} {a.label}</>}
                </button>
              ))}
            </div>
            {acciones.map(accion=>(
              <AccionResultado
                key={accion.tipo}
                tipo={accion.tipo}
                texto={accion.texto}
                label={accion.label}
                emoji={accion.emoji}
                area={area}
                curso={curso}
                comunidad={comunidad}
                modo={modo}
                etapa={etapa}
                duracion={duracion}
                necesidades={necesidades}
                numAlumnos={numAlumnos}
                objetivos={objetivos}
                idioma={idioma}
                metodologias={metodologias}
                onUpdate={(nuevoTexto) => actualizarAccion(accion.tipo, nuevoTexto)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="container">
      <header className="header">
        <div className="badge">IA para Educación Inclusiva</div>
        <h1 className="title">Programaciones adaptadas<br/><span className="title-accent">con Inteligencia Artificial</span></h1>
        <p className="subtitle">Selecciona las características de tu aula y obtén recursos listos para usar en segundos.</p>
      </header>
      {ctxClase && (
        <div className="crm-contexto">📌 Para: <strong>{ctxClase.nombre}</strong>{ctxClase.area ? ` · ${ctxClase.area}` : ""}{ctxAlumno ? <> · <strong>{ctxAlumno.nombre}</strong>{ctxAlumno.tiene_nee ? " (NEE)" : ""}</> : ""}</div>
      )}
      <ProgressBar step={step} total={TOTAL}/>

      {step===1&&(
        <div className="form">
          <section className="card"><StepHeader n="01" title="Comunidad Autónoma" sub="Adapta el contenido al currículo de tu región"/><div className="comunidad-grid">{COMUNIDADES.map(c=><button key={c} className={`comunidad-btn ${comunidad===c?"comunidad-active":""}`} onClick={()=>setComunidad(c)}>{c}</button>)}</div></section>
          <section className="card"><StepHeader n="02" title="Tipo de programación" sub="Elige el enfoque de lo que vas a generar"/><div className="modes-grid">{MODOS.map(m=>(<button key={m.id} className={`mode-card ${modo===m.id?"mode-active":""}`} onClick={()=>{setModo(m.id);setTipoResultado("");setDuracion("");}}><span className="mode-emoji">{m.emoji}</span><span className="mode-label">{m.label}</span><span className="mode-desc">{m.desc}</span></button>))}</div></section>
          <section className="card"><StepHeader n="03" title="Idioma de salida" sub="Idioma en el que se generará el documento"/><div className="chips-grid">{IDIOMAS.map(id=>(<button key={id} className={`chip chip-small ${idioma===id?"chip-active":""}`} onClick={()=>setIdioma(id)}><span className="chip-label">{id}</span></button>))}</div></section>
          <section className="card"><StepHeader n="04" title="Contexto del aula" sub="Opcional — ayuda a personalizar el resultado"/><textarea className="textarea" placeholder="Ej: Centro rural en Málaga. Grupo muy heterogéneo..." value={comentario} onChange={e=>setComentario(e.target.value)} rows={3}/><p className="field-hint">No es obligatorio. Cuanto más detallado, más personalizado el resultado.</p></section>
          <NavBtns onNext={()=>setStep(2)} nextDisabled={!canStep1}/>
        </div>
      )}

      {step===2&&(
        <div className="form">
          <section className="card"><StepHeader n="05" title="Etapa educativa"/><div className="chips-grid">{ETAPAS.map(e=><Chip key={e.id} label={e.label} emoji={e.emoji} desc={e.rango} selected={etapa===e.id} onClick={()=>{setEtapa(e.id);setCurso("");setArea("");}}/>)}</div></section>
          {etapa&&<section className="card"><StepHeader n="06" title="Curso"/><div className="chips-grid">{CURSOS[etapa].map(c=><Chip key={c} label={c} selected={curso===c} onClick={()=>setCurso(c)} small/>)}</div></section>}
          {etapa&&<section className="card"><StepHeader n="07" title="Área o asignatura"/><div className="chips-grid">{AREAS[etapa].map(a=><Chip key={a} label={a} selected={area===a} onClick={()=>{setArea(a);setTema("");}} small/>)}</div></section>}
          {etapa&&area&&(<section className="card"><StepHeader n="08" title="Tema o contenido específico" sub="Opcional pero recomendado"/><input className="input-tema" type="text" placeholder={TEMAS_POR_AREA[area]||"Ej: el tema que estás trabajando..."} value={tema} onChange={e=>setTema(e.target.value)} maxLength={120}/><p className="field-hint">Si lo dejas en blanco la IA elegirá un tema apropiado.</p></section>)}
          <NavBtns onBack={()=>setStep(1)} onNext={()=>setStep(3)} nextDisabled={!canStep2}/>
        </div>
      )}

      {step===3&&(
        <div className="form">
          {(modo==="nee"||modo==="mixto")&&<>
            <section className="card"><StepHeader n="09" title="Necesidades educativas" sub="Selecciona las NEE presentes en el aula"/><div className="chips-grid">{NECESIDADES.map(n=><Chip key={n.id} {...n} selected={necesidades.includes(n.id)} onClick={()=>toggle(necesidades,setNecesidades,n.id)}/>)}</div></section>
            <section className="card"><StepHeader n="10" title="Número de alumnos con NEE"/><div className="number-picker"><button className="np-btn" onClick={()=>setNumAlumnos(Math.max(1,numAlumnos-1))}>−</button><span className="np-value">{numAlumnos}</span><button className="np-btn" onClick={()=>setNumAlumnos(Math.min(30,numAlumnos+1))}>+</button></div></section>
          </>}
          <section className="card"><StepHeader n={modo==="ordinario"?"09":"11"} title="¿Qué quieres generar?" sub="Selecciona el tipo de documento"/><div className="tipo-grid">{(TIPOS_RESULTADO[modo]||[]).map(t=>(<button key={t.id} className={`tipo-btn ${tipoResultado===t.id?"tipo-active":""}`} onClick={()=>{setTipoResultado(t.id);setDuracion("");}}><span className="tipo-emoji">{t.emoji}</span><span className="tipo-label">{t.label}</span>{espDeTipo(t.id) && <span className="tipo-esp">con {espDeTipo(t.id).nombre}</span>}</button>))}</div></section>
          <section className="card"><StepHeader n={modo==="ordinario"?"10":"12"} title="Objetivos prioritarios" sub="Opcional — selecciona los que apliquen"/><div className="tags-wrap">{OBJETIVOS.map(obj=><button key={obj} className={`tag ${objetivos.includes(obj)?"tag-active":""}`} onClick={()=>toggle(objetivos,setObjetivos,obj)}>{obj}</button>)}</div></section>
          <section className="card"><StepHeader n={modo==="ordinario"?"11":"13"} title="Metodologías" sub="Opcional — selecciona las que quieras aplicar"/><div className="chips-grid">{METODOLOGIAS.map(m=>(<button key={m.id} className={`chip ${metodologias.includes(m.id)?"chip-active":""}`} onClick={()=>toggle(metodologias,setMetodologias,m.id)}><span className="chip-emoji">{m.emoji}</span><span className="chip-label">{m.label}</span>{m.siglas&&<span className="chip-desc">{m.siglas}</span>}</button>))}</div><p className="field-hint">No es obligatorio seleccionar ninguna.</p></section>
          <NavBtns onBack={()=>setStep(2)} onNext={()=>setStep(4)} nextDisabled={!canStep3}/>
        </div>
      )}

      {step===4&&(
        <div className="form">
          {needsDuracion&&(<section className="card"><StepHeader n={modo==="ordinario"?"12":"14"} title="Duración de la sesión"/><div className="chips-grid">{DURACION_SESION.map(d=><Chip key={d} label={d} selected={duracion===d} onClick={()=>setDuracion(d)} small/>)}</div></section>)}
          {needsSesiones&&(<section className="card"><StepHeader n={modo==="ordinario"?"12":"14"} title="Número de sesiones" sub="¿Cuántas sesiones abarca este documento?"/><div className="chips-grid">{NUM_SESIONES.map(s=><Chip key={s} label={s} selected={duracion===s} onClick={()=>setDuracion(s)} small/>)}</div></section>)}
          <section className="card resumen">
            <h3 className="resumen-title">📋 Resumen de tu aula</h3>
            <div className="resumen-grid">
              <div><span className="r-key">Comunidad</span><span className="r-val">{comunidad}</span></div>
              <div><span className="r-key">Modo</span><span className="r-val">{MODOS.find(m=>m.id===modo)?.label}</span></div>
              <div><span className="r-key">Idioma</span><span className="r-val">{idioma}</span></div>
              <div><span className="r-key">Curso</span><span className="r-val">{curso}</span></div>
              <div><span className="r-key">Área</span><span className="r-val">{area}</span></div>
              <div><span className="r-key">Documento</span><span className="r-val">{TIPOS_RESULTADO[modo]?.find(t=>t.id===tipoResultado)?.label}</span></div>
              {duracion&&<div><span className="r-key">{needsDuracion?"Duración":"Sesiones"}</span><span className="r-val">{duracion}</span></div>}
              {tema&&<div><span className="r-key">Tema</span><span className="r-val">{tema}</span></div>}
              {necesidades.length>0&&<div><span className="r-key">NEE</span><span className="r-val">{necesidades.join(", ")}</span></div>}
              {metodologias.length>0&&<div className="resumen-full"><span className="r-key">Metodologías</span><span className="r-val">{metodologias.map(id=>METODOLOGIAS.find(m=>m.id===id)?.label).join(", ")}</span></div>}
              {comentario&&<div className="resumen-full"><span className="r-key">Contexto</span><span className="r-val">{comentario}</span></div>}
            </div>
          </section>
          {error&&<p className="error-msg">{error}</p>}
          <div className="nav-btns">
            <button className="btn-back" onClick={()=>setStep(3)}>← Atrás</button>
            <button className={`generate-btn ${canStep4&&!loading?"generate-active":""}`} onClick={generar} disabled={!canStep4||loading} style={{flex:1}}>
              {loading?<span className="btn-loading"><span className="spinner"/>Generando...</span>:"✨ Generar con IA"}
            </button>
          </div>
          {loading && <BtnCancelar onClick={cancelar}/>}
        </div>
      )}
      <footer className="footer"><p>Herramienta de apoyo docente con IA · No sustituye el criterio del especialista</p></footer>
    </div>
  );
}

export default function App() {
  const session = useSession();
  const [view, setView] = useState("inicio");
  const [params, setParams] = useState({});           // { claseId, alumnoId, docId }
  const [docId, setDocId] = useState(null);
  const [contexto, setContexto] = useState(null);     // clase/alumno para el generador
  const [genKey, setGenKey] = useState(0);
  const [clases, setClases] = useState([]);
  const [cargandoClases, setCargandoClases] = useState(true);
  const [errorClases, setErrorClases] = useState("");
  const [menuMovil, setMenuMovil] = useState(false);
  const [claseModal, setClaseModal] = useState(false);
  const path = window.location.pathname;
  const sharedMatch = path.match(/^\/compartido\/(.+)$/);

  const [agendaModal, setAgendaModal] = useState(false);
  const [agendaUsada, setAgendaUsada] = useState(false); // la Agenda se carga la primera vez que se abre
  const [esAdmin, setEsAdmin] = useState(false);
  const [sustEtapas, setSustEtapas] = useState([]); // etapas que gestiona (equipo directivo)
  const [centro, setCentro] = useState("");
  const [avisoLimite, setAvisoLimite] = useState(null);
  useEffect(() => {
    const f = (e) => setAvisoLimite(e.detail || {});
    window.addEventListener("aulaia-limite", f);
    return () => window.removeEventListener("aulaia-limite", f);
  }, []);
  const cargarClases = useCallback(async () => {
    setCargandoClases(true);
    let { data, error } = await supabase.from("clases").select("*, grupos(nombre)").order("created_at");
    if (error) ({ data, error } = await supabase.from("clases").select("*").order("created_at"));
    setErrorClases(error ? mensajeError(error) : "");
    const lista = (data || []).map(c => ({ ...c, grupo_nombre: c.grupos?.nombre || c.nombre }))
      .sort((a, b) => (a.grupo_nombre || "").localeCompare(b.grupo_nombre || "", "es", { numeric: true }) || (a.area || "").localeCompare(b.area || "", "es"));
    setClases(lista); setCargandoClases(false);
    return lista;
  }, []);
  useEffect(() => {
    if (!session) return;
    cargarClases();
    iniciarAgenda();
    miPerfil().then(p => { setEsAdmin(p?.rol === "admin"); setCentro(p?.centro || ""); }).catch(() => {});
    misEtapasSust().then(setSustEtapas).catch(() => {});
    // Enlace directo a un documento (?doc=...), p. ej. desde la Agenda docente
    const docParam = new URLSearchParams(window.location.search).get("doc");
    if (docParam) { setDocId(docParam); setView("doc"); window.history.replaceState({}, "", window.location.pathname); }
    const f = () => cargarClases();
    window.addEventListener("aulaia-agenda-sync", f);
    return () => window.removeEventListener("aulaia-agenda-sync", f);
  }, [session?.user?.id]);

  // Alumnado y grupos de la Agenda y de AulaIA, siempre al día (solo añade, nunca borra)
  useEffect(() => { if (session) pedirSincronizacion(true); }, [session?.user?.id, view, params.claseId]);
  const ir = (v, p = {}) => { if (v === "ag") setAgendaUsada(true); setView(v); setParams(p); window.scrollTo(0, 0); };
  useEffect(() => { window.__aulaiaSignOut = () => supabase.auth.signOut(); }, []);
  useEffect(() => {
    const f = (e) => ir(e.detail.v, e.detail.p || {});
    window.addEventListener("aulaia-ir", f);
    return () => window.removeEventListener("aulaia-ir", f);
  }, []);
  const abrirDoc = (id) => { setDocId(id); ir("doc", { volver: view === "doc" ? params.volver : { view, params } }); };
  const nuevoDocumento = (clase = null, alumno = null) => {
    setContexto(clase ? { clase, alumno } : null); setGenKey(k => k + 1); ir("generator");
  };

  if (session===undefined) return (<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0b1120"}}><div className="lib-spinner"/></div>);
  if (sharedMatch) return (<div style={{minHeight:"100vh",background:"#0b1120",padding:"40px 20px"}}><div style={{maxWidth:760,margin:"0 auto"}}><DocPage docId={sharedMatch[1]} isShared={true}/></div></div>);
  if (!session) return <AuthPage/>;

  const volverDeDoc = () => { const v = params.volver; v ? ir(v.view, v.params) : ir("library"); };

  return (
    <div className="app">
      <div className="bg-orbs"><div className="orb orb-1"/><div className="orb orb-2"/><div className="orb orb-3"/></div>
      <Navbar session={session} view={view} onGoLibrary={()=>ir("library")} onGoNew={()=>nuevoDocumento()}/>
      <div className="crm-layout">
        <Sidebar
          view={view} seccion={params.seccion} clases={clases} claseActivaId={params.claseId} onNuevo={()=>nuevoDocumento()} esAdmin={esAdmin} esDirectivo={sustEtapas.length>0}
          abierta={menuMovil} onCerrar={()=>setMenuMovil(false)}
          onGo={(v, p)=>ir(v, p)} onNuevaClase={()=>setClaseModal(true)} onConectarAgenda={()=>setAgendaModal(true)}
        />
        <main className={`crm-main ${view==="ag"?"crm-main-agenda":""}`}>
          <button className="doc-btn crm-menu-movil" onClick={()=>setMenuMovil(true)}>☰ Menú</button>
          {view==="inicio"    &&<SustAvisos email={session?.user?.email} centro={centro}/>}
          {view==="inicio"    &&<HomePage session={session} clases={clases} cargandoClases={cargandoClases} errorClases={errorClases} onAbrirClase={id=>ir("clase",{claseId:id})} onNuevaClase={()=>setClaseModal(true)} onAgenda={()=>ir("agenda")}/>}
          {view==="agenda"    &&<AgendaPage clases={clases} onAbrirDoc={abrirDoc}/>}
          {view==="modelos"   &&<ModelosPage/>}
          {view==="equipo"    &&<EquipoPage clases={clases} onAbrirDoc={abrirDoc}/>}
          {view==="perfil"    &&<PerfilPage/>}
          {view==="admin" && esAdmin &&<AdminPage onCargos={()=>misEtapasSust().then(setSustEtapas)}/>}
          {view==="sust" && sustEtapas.length>0 &&<SustitucionesPage etapas={sustEtapas} centro={centro}/>}
          {view==="clase"     &&<ClasePage key={params.claseId} claseId={params.claseId} clases={clases} onClasesChanged={async (nuevaId)=>{ await cargarClases(); if (typeof nuevaId === "string") ir("clase",{claseId:nuevaId}); }} onNuevoDocumento={nuevoDocumento} onAbrirAlumno={(id, cid)=>ir("alumno",{alumnoId:id, claseId:cid})} onAbrirDoc={abrirDoc} onEliminada={()=>{cargarClases();ir("inicio");}}/>}
          {view==="alumno"    &&<AlumnoPage key={params.alumnoId} alumnoId={params.alumnoId} claseId={params.claseId} clases={clases} onVolverClase={id=>ir("clase",{claseId:id})} onNuevoDocumento={nuevoDocumento} onAbrirDoc={abrirDoc}/>}
          {view==="library"   &&<div className="container"><LibraryPage onOpen={abrirDoc} onNew={()=>nuevoDocumento()}/></div>}
          {view==="generator" &&<Generator key={genKey} contexto={contexto} onSaved={()=>ir("library")}/>}
          {view==="doc"       &&<div className="container"><DocPage key={docId} docId={docId} onBack={volverDeDoc} onAbrirDoc={abrirDoc}/></div>}
          {agendaUsada && <AgendaEmbed visible={view==="ag"} seccion={params.seccion} onVista={(v)=>{ setView("ag"); setParams({ seccion: v }); }} onAbrirDoc={abrirDoc}/>}
        </main>
      </div>
      {avisoLimite && (
        <Modal titulo={avisoLimite.status === 401 ? "Sesión caducada" : "Has llegado a tu límite del mes"} onClose={() => setAvisoLimite(null)}>
          <div className="crm-form">
            <p>{avisoLimite.mensaje || (avisoLimite.status === 401 ? "Vuelve a entrar en AulaIA." : "Has usado todas las generaciones de este mes.")}</p>
            {avisoLimite.status !== 401 && <p className="crm-muted">Puedes seguir usando el horario, tus clases, tus documentos y todo lo demás. Si necesitas más generaciones, habla con la administradora.</p>}
            <div className="crm-modal-actions"><span style={{ flex: 1 }} /><button className="library-new-btn" onClick={() => setAvisoLimite(null)}>Entendido</button></div>
          </div>
        </Modal>
      )}
      {agendaModal && <AgendaConexionModal onClose={()=>setAgendaModal(false)}/>}
      {claseModal && <ClaseModal onClose={()=>setClaseModal(false)} onSaved={(c)=>{setClaseModal(false);cargarClases();if(c?.id)ir("clase",{claseId:c.id});}}/>}
    </div>
  );
}
