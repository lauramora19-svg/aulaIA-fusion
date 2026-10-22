import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { exportarWordContenido } from "../lib/word";
import { renderResultado } from "../lib/render";
import ProgramarModal from "../components/ProgramarModal";
import { AccionesSiguientes } from "../lib/acciones";
import TituloEditable from "../components/TituloEditable";
import { BotonPromptChatGPT, quitarPromptChatGPT } from "../lib/promptChatGPT";
import EncabezadoSelect from "../components/EncabezadoSelect";
import { obtenerEncabezado } from "../lib/encabezados";

export default function DocPage({ docId, onBack, onAbrirDoc, isShared = false }) {
  const [doc, setDoc]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]  = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [programar, setProgramar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [encabezado, setEncabezado] = useState(null);
  useEffect(() => { obtenerEncabezado(doc?.encabezado_id).then(setEncabezado).catch(() => setEncabezado(null)); }, [doc?.encabezado_id]);
  const cambiarEncabezado = async (id) => {
    setDoc(d => ({ ...d, encabezado_id: id || null }));
    const { error } = await supabase.from("programaciones").update({ encabezado_id: id || null }).eq("id", doc.id);
    if (error) setAviso("No se ha podido guardar el encabezado.");
  };

  const descargarWord = async () => {
    setDescargando(true);
    try { await exportarWordContenido(doc.contenido, doc.titulo || "Documento AulaIA", { encabezadoId: doc.encabezado_id }); }
    catch { alert("No se ha podido generar el Word. Inténtalo de nuevo."); }
    finally { setDescargando(false); }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("programaciones")
        .select("*")
        .eq("id", docId)
        .single();

      if (error || !data) { setNotFound(true); }
      else if (isShared && !data.compartido) { setNotFound(true); }
      else setDoc(data);
      setLoading(false);
    };
    load();
  }, [docId]);

  const copy = () => {
    navigator.clipboard.writeText(quitarPromptChatGPT(doc.contenido));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="doc-page-loading">
      <div className="lib-spinner" />
    </div>
  );

  if (notFound) return (
    <div className="doc-page-loading">
      <p style={{ color:"#64748b", fontSize:15 }}>Documento no encontrado o sin acceso.</p>
      {onBack && <button className="btn-back" style={{ marginTop:16 }} onClick={onBack}>← Volver</button>}
    </div>
  );

  return (
    <div className="doc-page">
      <div className="doc-page-header">
        <div className="doc-page-meta">
          {onBack && <button className="btn-back-sm" onClick={onBack}>← Volver</button>}
          {isShared
            ? <h1 className="doc-page-title">{doc.titulo || "Programación"}</h1>
            : <TituloEditable Tag="h1" className="doc-page-title" docId={doc.id} titulo={doc.titulo} placeholder="Programación" onGuardado={(t) => setDoc(d => ({ ...d, titulo: t }))} />}
          <p className="doc-page-sub">
            {[doc.curso, doc.area, doc.comunidad].filter(Boolean).join(" · ")}
            {" · "}{new Date(doc.created_at).toLocaleDateString("es-ES")}
          </p>
        </div>
        <div className="doc-page-actions">
          <button className="btn-copy" onClick={copy}>{copied ? "¡Copiado!" : "📋 Copiar"}</button>
          <BotonPromptChatGPT texto={doc.contenido} />
          {!isShared && <button className="btn-word" onClick={descargarWord} disabled={descargando}>{descargando ? "⏳..." : "📄 Word"}</button>}
          {!isShared && <button className="doc-btn" onClick={() => setProgramar(true)}>📅 Programar en un día</button>}
        </div>
      </div>

      {aviso && <p className="crm-aviso">{aviso}</p>}
      {!isShared && <div style={{ margin: "0 0 12px" }}><EncabezadoSelect value={doc.encabezado_id || ""} onChange={cambiarEncabezado} etiqueta="🏷️ Encabezado del Word" compacto={false} /></div>}
      {programar && <ProgramarModal doc={doc} onClose={() => setProgramar(false)} onSaved={({ fecha, enAgenda }) => { setProgramar(false); setAviso(`📅 Programado para el ${new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}${enAgenda ? " (también en tu Agenda docente)" : ""}.`); }} />}

      {isShared && (
        <div className="shared-notice">
          🔗 Este documento ha sido compartido contigo. Crea tu cuenta gratis para guardar tus propias programaciones.
        </div>
      )}

      <div className="resultado-body" style={{ maxHeight:"none" }}>
        {encabezado?.imagen && <img src={encabezado.imagen} alt={`Encabezado: ${encabezado.nombre}`} style={{ display: "block", margin: "0 auto 16px", maxWidth: "100%", maxHeight: 110, objectFit: "contain" }} />}
        {renderResultado(doc.contenido || "")}
      </div>

      {!isShared && <AccionesSiguientes doc={doc} onAbrirDoc={onAbrirDoc} />}
    </div>
  );
}
