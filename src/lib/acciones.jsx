// Acciones «a partir de esta programación» (rúbrica, ficha, examen…).
import { BotonPromptChatGPT, quitarPromptChatGPT } from "./promptChatGPT";
// Se usan al terminar de generar y también desde Mis documentos.
import { useState } from "react";
import { supabase } from "./supabase";
import { leerStreamSSE } from "./stream";
import { exportarWordContenido } from "./word";
import { renderResultado } from "./render";
import { contextoEncargo } from "./equipo";

export const FIRMA_COMPLETO = "✅ Documento completo generado por AulaIA";

// ─── COPIAR TEXTO LIMPIO ──────────────────────────────────────────────────────
export const copiarTextoLimpio = async (texto) => {
  let limpio = quitarPromptChatGPT(texto)
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

// ─── ACCION CARD — con continuar ─────────────────────────────────────────────
export function AccionResultado({ tipo, texto, label, emoji, area, curso, comunidad, modo, etapa, duracion, necesidades, numAlumnos, objetivos, idioma, metodologias, onUpdate }) {
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
            <BotonPromptChatGPT texto={texto} pequeno />
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

export const ACCIONES_META = {
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


export const ACCIONES_PROMPT = {
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

export const GRUPOS_ACCIONES = [
  ["📊 Evaluación", ["rubrica", "cotejo", "examen", "preguntas"]],
  ["🛠️ Materiales", ["ficha", "manipulativo", "flashcards", "pictogramas", "cuento"]],
  ["👨‍👩‍👧 Comunicación", ["familias", "plan_alumno"]],
];

// Contexto del grupo/alumno al que pertenece el documento (si lo tiene)
async function contextoDeDoc(doc) {
  try {
    const [c, a] = await Promise.all([
      doc.clase_id ? supabase.from("clases").select("*").eq("id", doc.clase_id).maybeSingle() : Promise.resolve({ data: null }),
      doc.alumno_id ? supabase.from("alumnos").select("*").eq("id", doc.alumno_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return await contextoEncargo(c.data, a.data);
  } catch { return ""; }
}

// Bloque completo de «Generar a partir de…» para un documento ya guardado.
// Lo que se genera se guarda solo en Mis documentos, enlazado al original.
export function AccionesSiguientes({ doc, onAbrirDoc }) {
  const [acciones, setAcciones] = useState([]);
  const [generando, setGenerando] = useState("");
  const [guardados, setGuardados] = useState({});
  const datos = {
    comunidad: doc.comunidad || "", modo: doc.modo || "ordinario", etapa: doc.etapa || "", curso: doc.curso || "", area: doc.area || "",
    duracion: doc.duracion || "", necesidades: doc.necesidades || [], numAlumnos: doc.num_alumnos || 1, objetivos: doc.objetivos || [],
    idioma: doc.idioma || "Castellano", metodologias: doc.metodologias || [],
  };
  const poner = (tipo, cambios) => setAcciones(prev => prev.map(a => a.tipo === tipo ? { ...a, ...cambios } : a));

  const guardar = async (tipo, texto) => {
    const meta = ACCIONES_META[tipo];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !texto || texto.startsWith("❌")) return;
    const { data } = await supabase.from("programaciones").insert({
      user_id: user.id, titulo: `${meta.label} — ${doc.titulo || [datos.area, datos.curso].filter(Boolean).join(" ")}`.slice(0, 200),
      modo: datos.modo, tipo_resultado: tipo, comunidad: datos.comunidad, etapa: datos.etapa, curso: datos.curso, area: datos.area,
      duracion: datos.duracion, necesidades: datos.necesidades, num_alumnos: datos.numAlumnos, objetivos: datos.objetivos,
      contenido: texto, compartido: false,
      ...(doc.clase_id ? { clase_id: doc.clase_id } : {}), ...(doc.alumno_id ? { alumno_id: doc.alumno_id } : {}),
    }).select("id").single();
    if (data?.id) setGuardados(g => ({ ...g, [tipo]: data.id }));
  };

  const generar = async (tipo) => {
    const meta = ACCIONES_META[tipo];
    if (!meta || generando) return;
    setGenerando(tipo);
    setAcciones(prev => [...prev.filter(a => a.tipo !== tipo), { tipo, label: meta.label, emoji: meta.emoji, texto: "" }]);
    setGuardados(g => { const n = { ...g }; delete n[tipo]; return n; });
    const base = (doc.contenido || "").replace(/---\n✅[^\n]*/g, "").slice(0, 8000);
    const prompt = `Basándote en esta programación, crea ${ACCIONES_PROMPT[tipo]}\n\nDOCUMENTO BASE:\n${base}\n\nDATOS: ${[datos.etapa, datos.curso, datos.area, datos.comunidad].filter(Boolean).join(" · ")}${datos.necesidades.length ? ` · NEE: ${datos.necesidades.join(", ")}` : ""}\nIDIOMA: ${datos.idioma}\n\nCompleta TODO. NUNCA uses recuadros ASCII. Al terminar escribe exactamente:\n---\n${FIRMA_COMPLETO}`;
    let full = "";
    try {
      const res = await fetch("/api/generar", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, tipoResultado: tipo, promptOverride: prompt, contextoEncargo: await contextoDeDoc(doc) }) });
      if (!res.ok) throw new Error();
      await leerStreamSSE(res, (d) => { full += d; poner(tipo, { texto: full }); });
      await guardar(tipo, full);
    } catch { poner(tipo, { texto: "❌ Error al generar." }); }
    finally { setGenerando(""); }
  };

  return (
    <div className="acciones-siguientes">
      <p className="acciones-title">✨ Generar a partir de este documento</p>
      {GRUPOS_ACCIONES.map(([titulo, ids], i) => (
        <div key={titulo}>
          <p className="acciones-grupo" style={i ? { marginTop: 14 } : undefined}>{titulo}</p>
          <div className="acciones-grid">
            {ids.map(id => (
              <button key={id} className="btn-accion" onClick={() => generar(id)} disabled={!!generando}
                style={generando === id ? { borderColor: "#f97316", color: "#f97316", background: "rgba(249,115,22,0.08)" } : {}}>
                {generando === id
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderTopColor: "#f97316", borderColor: "rgba(249,115,22,0.2)" }} /> Generando...</>
                  : <>{ACCIONES_META[id].emoji} {ACCIONES_META[id].label}</>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {acciones.map(a => (
        <div key={a.tipo}>
          <AccionResultado tipo={a.tipo} texto={a.texto} label={a.label} emoji={a.emoji} {...datos}
            onUpdate={(t) => { poner(a.tipo, { texto: t }); }} />
          {guardados[a.tipo] && (
            <p className="crm-aviso" style={{ marginTop: 8 }}>
              💾 Guardado en Mis documentos{onAbrirDoc && <> · <button className="crm-link" onClick={() => onAbrirDoc(guardados[a.tipo])}>Abrir</button></>}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
