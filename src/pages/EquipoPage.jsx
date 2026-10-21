import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { miPerfil, listarEspecialistas, guardarEspecialista, leerMdSubagente, repartir, resumenGrupo, tokenActual, contextoEncargo, TIPOS_CONSTRUCTOR } from "../lib/equipo";
import { leerStreamSSE } from "../lib/stream";
import { renderResultado } from "../lib/render";
import { exportarWordContenido } from "../lib/word";
import { BotonPromptChatGPT, quitarPromptChatGPT } from "../lib/promptChatGPT";
import Modal from "../components/Modal";
import Campo from "../components/Campo";

const EJEMPLOS = [
  "Un juego para repasar la letra P en 20 minutos",
  "Rúbrica de lectura en voz alta",
  "Mensaje a una familia para convocar una tutoría",
  "Circular para una salida al museo",
];
// Pases entre especialistas (como en sus instrucciones)
const PASES = {
  arturo: ["eva", "Pasar a Eva: crear su rúbrica", "A partir de esta actividad de Arturo, crea el instrumento de evaluación (rúbrica o lista de cotejo) adecuado."],
  eva: ["carmen", "Pasar a Carmen: explicarlo a las familias", "A partir de este instrumento de evaluación, redacta un mensaje breve para las familias explicando qué se va a evaluar y cómo pueden ayudar en casa."],
};

export default function EquipoPage({ clases = [], onAbrirDoc }) {
  const [perfil, setPerfil] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [claseId, setClaseId] = useState("");
  const [texto, setTexto] = useState("");
  const [manual, setManual] = useState(null);
  const [res, setRes] = useState(null); // { espId, texto, pedido }
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [editar, setEditar] = useState(null); // especialista en edición (admin)
  const ctrl = useRef(null);

  const esAdmin = perfil?.rol === "admin";
  const cargar = async (admin) => setEquipo(await listarEspecialistas(admin));
  useEffect(() => { miPerfil().then(p => { setPerfil(p); cargar(p?.rol === "admin"); }); }, []);

  const auto = repartir(texto, equipo.filter(e => e.activo !== false));
  const elegido = manual || auto;
  const porId = (id) => equipo.find(e => e.id === id);

  const pedir = async (espId = elegido, pedido = texto, previo = "") => {
    if (!pedido.trim()) { setError("Escribe qué necesitas."); return; }
    setError(""); setGuardado(null); setGenerando(true); setRes({ espId, texto: "", pedido });
    ctrl.current = new AbortController();
    try {
      const clase = clases.find(c => c.id === claseId) || null;
      const grupoTexto = await resumenGrupo(clase);
      const prompt = `ENCARGO:\n${pedido.trim()}${previo ? `\n\nMATERIAL DE PARTIDA (de otro especialista del equipo):\n${previo.slice(0, 12000)}` : ""}\n\nAl terminar escribe exactamente:\n---\n✅ Documento completo generado por AulaIA`;
      const r = await fetch("/api/generar", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.current.signal,
        body: JSON.stringify({ promptOverride: prompt, especialistaId: espId, grupoTexto, contextoEncargo: clase ? await contextoEncargo(clase).catch(() => "") : "", accessToken: await tokenActual(), tipoResultado: "encargo", modo: "ordinario", idioma: "Castellano", comunidad: perfil?.comunidad || clase?.comunidad, etapa: clase?.etapa, curso: clase?.curso, area: clase?.area }),
      });
      if (!r.ok) throw new Error("No se pudo generar. Inténtalo de nuevo.");
      let full = "";
      await leerStreamSSE(r, (d) => { full += d; setRes({ espId, texto: full, pedido }); }, ctrl.current.signal);
    } catch (e) { if (e.name !== "AbortError") setError(e.message); }
    finally { setGenerando(false); }
  };

  const guardar = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const esp = porId(res.espId);
    const { data, error } = await supabase.from("programaciones").insert({
      user_id: user.id, titulo: `${esp?.nombre || "Equipo"} — ${res.pedido.slice(0, 70)}`, modo: "ordinario", tipo_resultado: "encargo",
      contenido: res.texto, compartido: false, ...(claseId ? { clase_id: claseId } : {}),
    }).select("id").single();
    if (error) setError(error.message); else setGuardado(data.id);
  };

  const r = res && porId(res.espId);
  const pase = res && !generando && res.texto && PASES[res.espId] && porId(PASES[res.espId][0]) ? PASES[res.espId] : null;

  return (
    <div className="crm-page">
      <div className="crm-section-head">
        <div>
          <h1 className="crm-hello-title">Equipo docente IA</h1>
          <p className="crm-muted">Pide lo que necesites: la coordinadora lo pasa al especialista adecuado. Conocen tu perfil y el grupo que elijas.</p>
        </div>
      </div>

      <section className="card crm-form">
        <div className="crm-form-row">
          <Campo label="Grupo (opcional)">
            <select className="input-tema" value={claseId} onChange={e => setClaseId(e.target.value)}>
              <option value="">— Sin grupo —</option>
              {clases.map(c => <option key={c.id} value={c.id}>{c.grupo_nombre || c.nombre}{c.area ? ` · ${c.area}` : ""}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="¿Qué necesitas?">
          <textarea className="input-tema" rows={3} value={texto} onChange={e => { setTexto(e.target.value); setManual(null); }} placeholder="Ej.: un juego para repasar la letra P en 20 minutos" />
        </Campo>
        <div className="chips-grid">{EJEMPLOS.map(t => <button key={t} type="button" className="chip chip-small" onClick={() => { setTexto(t); setManual(null); }}>{t}</button>)}</div>
        <div className="chips-grid">
          <span className="crm-muted">Lo llevará:</span>
          {equipo.filter(e => e.activo !== false).map(e => (
            <button key={e.id} type="button" className={`chip chip-small ${e.id === elegido ? "chip-active" : ""}`} onClick={() => setManual(e.id)}>{e.nombre}</button>
          ))}
          <span className="crm-muted">{manual ? "elegido por ti" : texto ? "elegido automáticamente" : ""}</span>
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          {generando && <button className="btn-back" onClick={() => ctrl.current?.abort()}>Cancelar</button>}
          <button className="generate-btn generate-active" onClick={() => pedir()} disabled={generando || !equipo.length}>{generando ? "Trabajando..." : "✨ Pedir"}</button>
        </div>
      </section>

      {res && (
        <section className="card" style={{ borderTop: `4px solid ${r?.color || "#f97316"}` }}>
          <p className="crm-card-title">{r?.nombre || "Equipo"} · <span className="crm-muted">{r?.rol}</span> · <span className="crm-muted">borrador para revisar</span></p>
          <div className="resultado-body">{renderResultado(res.texto || "…")}</div>
          {!generando && res.texto && (
            <div className="crm-modal-actions" style={{ flexWrap: "wrap" }}>
              <button className="btn-copy" onClick={() => { navigator.clipboard.writeText(quitarPromptChatGPT(res.texto)); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>{copiado ? "✅ Copiado" : "📋 Copiar"}</button>
              <BotonPromptChatGPT texto={res.texto} />
              <button className="btn-word" onClick={() => exportarWordContenido(quitarPromptChatGPT(res.texto), `${r?.nombre || "Equipo"} — ${res.pedido.slice(0, 40)}`)}>📄 Descargar Word</button>
              {guardado
                ? <button className="library-new-btn" onClick={() => onAbrirDoc?.(guardado)}>📄 Abrir (y 📅 programar)</button>
                : <button className="library-new-btn" onClick={guardar}>💾 Guardar en Mis documentos</button>}
              {pase && <button className="doc-btn" onClick={() => { setManual(pase[0]); pedir(pase[0], pase[2], res.texto); }}>{pase[1]}</button>}
            </div>
          )}
        </section>
      )}

      <div className="crm-section-head" style={{ marginTop: 24 }}>
        <h2 className="crm-section-title">El equipo</h2>
        {esAdmin
          ? <button className="library-new-btn" onClick={() => setEditar({ nuevo: true, id: "", nombre: "", corto: "", rol: "", descripcion: "", instrucciones: "", claves: [], tipos: [], alcance: "admin", activo: true, color: "#4338ca", fondo: "#eef2ff", orden: 50 })}>＋ Añadir especialista</button>
          : <span className="crm-muted">🔒 El equipo lo gestiona la administradora</span>}
      </div>
      <div className="crm-clases-grid">
        {equipo.map(e => (
          <div key={e.id} className="card crm-clase-card" style={{ borderTop: `4px solid ${e.color}`, opacity: e.activo === false ? 0.55 : 1 }}>
            <div className="crm-clase-area" style={{ color: e.color }}>{e.rol}</div>
            <div className="crm-clase-nombre">{e.nombre}</div>
            {esAdmin ? (
              <>
                <p className="crm-muted">{e.descripcion || e.corto}</p>
                <p className="field-hint"><strong>En el constructor:</strong> {(e.tipos || []).length ? e.tipos.map(t => TIPOS_CONSTRUCTOR.find(x => x[0] === t)?.[1] || t).join(", ") : "—"}</p>
                <p className="field-hint">{e.alcance === "admin" ? "🧪 En pruebas · solo tú" : "Para todas las cuentas"}{e.activo === false ? " · desactivado" : ""}</p>
                <div><button className="doc-btn" onClick={() => setEditar({ ...e, claves: e.claves || [], tipos: e.tipos || [] })}>Editar</button></div>
              </>
            ) : <p className="crm-muted">{e.corto}</p>}
          </div>
        ))}
      </div>

      {editar && <EditorEspecialista e={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); cargar(true); }} />}
    </div>
  );
}

function EditorEspecialista({ e: inicial, onClose, onSaved }) {
  const [e, setE] = useState(inicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (ev) => setE({ ...e, [k]: ev.target.value });
  const leerArchivo = async (f) => {
    if (!f) return;
    const md = leerMdSubagente(await f.text());
    setE({ ...e, ...Object.fromEntries(Object.entries(md).filter(([, v]) => v)), id: e.nuevo ? md.id || e.id : e.id });
  };
  // ✨ La IA redacta las instrucciones a partir de una descripción breve
  const [idea, setIdea] = useState("");
  const [redactando, setRedactando] = useState(false);
  const redactarConIA = async () => {
    if (!idea.trim()) { setError("Escribe en una o dos frases qué quieres que haga el especialista."); return; }
    setError(""); setRedactando(true);
    try {
      const actuales = await listarEspecialistas(true).catch(() => []);
      const ejemplo = actuales.find(x => x.id !== "coordinadora" && x.instrucciones) || null;
      const tiposLista = TIPOS_CONSTRUCTOR.map(([t, l]) => `${t} (${l})`).join(", ");
      const prompt = `ENCARGO: redacta un nuevo especialista (subagente) para el Equipo docente IA de AulaIA, una plataforma para docentes de Infantil, Primaria, ESO y Bachillerato en España (LOMLOE).

LO QUE QUIERE LA ADMINISTRADORA:
${idea.trim()}

EQUIPO ACTUAL (no repitas sus funciones): ${actuales.map(x => `${x.nombre} — ${x.rol || ""}: ${x.corto || ""}`).join(" | ") || "Coordinadora, Arturo (actividades y materiales), Eva (evaluación), Carmen (familias)"}

${ejemplo ? `EJEMPLO DE INSTRUCCIONES DE OTRO ESPECIALISTA (imita su estructura, tono y nivel de detalle, pero NO su contenido):\n${String(ejemplo.instrucciones).slice(0, 5000)}\n` : ""}
REGLAS PARA LAS INSTRUCCIONES:
- En segunda persona («Eres …»), en español, con apartados claros: quién eres, qué haces, cómo trabajas paso a paso, qué entregas (formato), qué NO haces, y cuándo pasar el encargo a otro especialista del equipo.
- Genéricas: SIN nombres de personas ni del colegio. Usa estos huecos donde haga falta, escritos exactamente así: {docente} {centro} {comunidad} {etapa} {areas} {grupo}.
- Enfoque inclusivo (DUA, NEAE) y nomenclatura LOMLOE.

RESPONDE EXACTAMENTE CON ESTE FORMATO (sin nada antes ni después, sin negritas en las etiquetas):
NOMBRE: (un nombre propio corto, como los del equipo)
AREA: (2-4 palabras)
FRASE: (una frase corta para los demás docentes)
DESCRIPCION: (una línea)
CLAVES: (8-15 palabras clave separadas por comas, en minúscula, para el reparto automático)
TIPOS: (de esta lista, solo los ids que le correspondan, separados por comas, o «ninguno»: ${tiposLista})
INSTRUCCIONES:
(las instrucciones completas)`;
      const res = await fetch("/api/generar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptOverride: prompt, accessToken: await tokenActual(), tipoResultado: "encargo", modo: "ordinario", idioma: "Castellano" }),
      });
      if (!res.ok) throw new Error("No se ha podido redactar. Inténtalo de nuevo.");
      let txt = "";
      await leerStreamSSE(res, (d) => { txt += d; });
      txt = txt.replace(/\n?---\n?✅ Documento completo generado por AulaIA\s*$/, "").replace(/\*\*/g, "");
      const campo = (k) => (txt.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, "mi")) || [])[1]?.trim() || "";
      const iIns = txt.search(/^\s*INSTRUCCIONES:/mi);
      const instrucciones = iIns >= 0 ? txt.slice(iIns).replace(/^\s*INSTRUCCIONES:\s*/i, "").trim() : txt.trim();
      const validos = new Set(TIPOS_CONSTRUCTOR.map(([t]) => t));
      setE(prev => ({
        ...prev,
        nombre: prev.nombre || campo("NOMBRE"),
        rol: prev.rol || campo("AREA"),
        corto: prev.corto || campo("FRASE"),
        descripcion: prev.descripcion || campo("DESCRIPCION"),
        claves: (prev.claves || []).length ? prev.claves : campo("CLAVES").split(",").map(x => x.trim().toLowerCase()).filter(Boolean),
        tipos: (prev.tipos || []).length ? prev.tipos : campo("TIPOS").split(",").map(x => x.trim()).filter(t => validos.has(t)),
        instrucciones,
      }));
    } catch (err) { setError(err.message); }
    setRedactando(false);
  };
  const alternarTipo = (t) => setE({ ...e, tipos: e.tipos.includes(t) ? e.tipos.filter(x => x !== t) : [...e.tipos, t] });
  const guardar = async () => {
    if (!e.nombre.trim() || !e.instrucciones.trim()) { setError("Faltan el nombre o las instrucciones."); return; }
    if (/\b(Laura|Nuestra Señora del Carmen)\b/.test(e.instrucciones)) { if (!window.confirm("Las instrucciones parecen tener datos personales (tu nombre o el del colegio). Los especialistas base no deberían llevarlos: usa {docente}, {centro}, {comunidad}, {etapa}, {areas} y {grupo}. ¿Guardar igualmente?")) return; }
    setGuardando(true); setError("");
    try {
      const id = e.id || e.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
      await guardarEspecialista({ ...e, id }, !!e.nuevo); onSaved();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };
  return (
    <Modal titulo={e.nuevo ? "Añadir especialista" : `Editar a ${e.nombre}`} onClose={onClose}>
      <div className="crm-form">
        {e.nuevo && <p className="crm-muted">Elige cómo prefieres crearlo: sube el .md de VS Code, deja que la IA escriba las instrucciones o escríbelas tú abajo.</p>}
        {e.nuevo && <Campo label="Opción 1 · Subir el .md del subagente (el mismo de VS Code)" hint="Se leen el nombre, la descripción y las instrucciones."><input type="file" accept=".md,.txt" onChange={ev => leerArchivo(ev.target.files?.[0])} /></Campo>}
        {e.nuevo && (
          <Campo label="Opción 2 · ✨ Que la IA escriba las instrucciones" hint="Cuéntale en una o dos frases qué quieres que haga. Rellena el formulario y luego lo revisas y corriges.">
            <textarea className="input-tema" rows={3} value={idea} onChange={ev => setIdea(ev.target.value)} placeholder="Ej.: especialista en orientación y tutoría: dinámicas de grupo, resolución de conflictos y preparación de entrevistas con familias" />
            <div style={{ marginTop: 6 }}><button type="button" className="doc-btn" onClick={redactarConIA} disabled={redactando}>{redactando ? "⏳ Escribiendo las instrucciones…" : "✨ Escribir las instrucciones con IA"}</button></div>
          </Campo>
        )}
        {e.nuevo && <p className="crm-muted" style={{ marginTop: -4 }}>Opción 3 · Escríbelo tú directamente en los campos de abajo.</p>}
        <div className="crm-form-row">
          <Campo label="Nombre"><input className="input-tema" value={e.nombre} onChange={set("nombre")} /></Campo>
          <Campo label="Área (p. ej. Burocracia)"><input className="input-tema" value={e.rol} onChange={set("rol")} /></Campo>
        </div>
        <Campo label="Frase corta" hint="Es lo único que ven los demás docentes."><input className="input-tema" value={e.corto} onChange={set("corto")} /></Campo>
        <Campo label="Descripción (solo tú)"><input className="input-tema" value={e.descripcion || ""} onChange={set("descripcion")} /></Campo>
        <Campo label="Instrucciones" hint="Sin datos personales. Huecos: {docente} {centro} {comunidad} {etapa} {areas} {grupo}">
          <textarea className="input-tema" rows={10} value={e.instrucciones} onChange={set("instrucciones")} />
        </Campo>
        <Campo label="Palabras para el reparto automático" hint="Separadas por comas"><input className="input-tema" value={(e.claves || []).join(", ")} onChange={ev => setE({ ...e, claves: ev.target.value.split(",").map(x => x.trim()).filter(Boolean) })} /></Campo>
        <div>
          <span className="crm-campo-label">¿Lo usa también el constructor?</span>
          <div className="chips-grid">{TIPOS_CONSTRUCTOR.map(([t, l]) => <button key={t} type="button" className={`chip chip-small ${e.tipos.includes(t) ? "chip-active" : ""}`} onClick={() => alternarTipo(t)}>{l}</button>)}</div>
        </div>
        <div className="crm-form-row">
          <Campo label="Quién lo usa">
            <select className="input-tema" value={e.alcance} onChange={set("alcance")}>
              <option value="admin">Solo yo (en pruebas)</option>
              <option value="todas">Todas las cuentas</option>
            </select>
          </Campo>
          <Campo label="Estado">
            <select className="input-tema" value={e.activo === false ? "no" : "si"} onChange={ev => setE({ ...e, activo: ev.target.value === "si" })}>
              <option value="si">Activo</option>
              <option value="no">Desactivado</option>
            </select>
          </Campo>
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          <button className="library-new-btn" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
}
