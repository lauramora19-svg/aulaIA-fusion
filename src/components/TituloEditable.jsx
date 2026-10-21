import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Título de un documento de la biblioteca que la docente puede cambiar
// (para encontrarlo luego más fácilmente al buscar).
export default function TituloEditable({ docId, titulo, onGuardado, Tag = "h3", className = "", placeholder = "Documento" }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(titulo || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!editando) setValor(titulo || ""); }, [titulo, editando]);

  const guardar = async () => {
    const t = valor.trim().replace(/\s+/g, " ");
    if (!t) { setError("Escribe un título."); return; }
    if (t === (titulo || "")) { setEditando(false); return; }
    setGuardando(true); setError("");
    const { error: e } = await supabase.from("programaciones").update({ titulo: t.slice(0, 200) }).eq("id", docId);
    setGuardando(false);
    if (e) { setError("No se ha podido guardar el título."); return; }
    setEditando(false); onGuardado?.(t.slice(0, 200));
  };

  if (!editando) return (
    <Tag className={className}>
      {titulo || placeholder}{" "}
      {docId && (
        <button type="button" className="doc-btn" style={{ fontSize: 12, padding: "2px 8px", verticalAlign: "middle" }}
          onClick={(e) => { e.stopPropagation(); setEditando(true); }} title="Cambiar el título">✏️ Renombrar</button>
      )}
    </Tag>
  );

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "4px 0" }}>
      <input className="input-tema" style={{ flex: "1 1 220px", minWidth: 0 }} value={valor} autoFocus maxLength={200}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setEditando(false); }}
        placeholder="Escribe el título que quieras" />
      <button type="button" className="doc-btn" onClick={guardar} disabled={guardando}>{guardando ? "…" : "💾 Guardar"}</button>
      <button type="button" className="doc-btn" onClick={() => { setEditando(false); setError(""); }}>Cancelar</button>
      {error && <span className="error-msg" style={{ width: "100%" }}>{error}</span>}
    </div>
  );
}
