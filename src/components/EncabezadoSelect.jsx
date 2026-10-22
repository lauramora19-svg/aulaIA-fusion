import { useEffect, useRef, useState } from "react";
import { listarEncabezados, subirEncabezado, borrarEncabezado } from "../lib/encabezados";

// Elegir el encabezado o logo (fundación, colegio...) que llevará el documento en Word.
// value: id del encabezado o "" (sin encabezado).
export default function EncabezadoSelect({ value = "", onChange, etiqueta = "🏷️ Encabezado o logo", compacto = false }) {
  const [lista, setLista] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  useEffect(() => { listarEncabezados().then(setLista).catch(() => setLista([])); }, []);
  const elegido = lista.find(e => e.id === value);

  const subir = async (file) => {
    if (!file) return;
    setError("");
    const nombre = window.prompt("Nombre para este encabezado (p. ej. «Fundación», «Colegio · exámenes»):", file.name.replace(/\.[^.]+$/, ""));
    if (nombre === null) return;
    setSubiendo(true);
    try { const e = await subirEncabezado(file, nombre.trim()); setLista(l => [...l, e]); onChange?.(e.id); }
    catch (e) { setError(e.message); }
    finally { setSubiendo(false); if (input.current) input.current.value = ""; }
  };
  const quitar = async () => {
    if (!elegido || !window.confirm(`¿Quitar «${elegido.nombre}» de la lista de encabezados del colegio? Los documentos que ya lo usan se quedarán sin él.`)) return;
    setError("");
    try { await borrarEncabezado(elegido.id); setLista(l => l.filter(e => e.id !== elegido.id)); onChange?.(""); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="encabezado-select" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {!compacto && <span className="crm-muted" style={{ fontWeight: 600 }}>{etiqueta}</span>}
        <select className="input-tema crm-select" value={value || ""} aria-label={etiqueta}
          onChange={e => { if (e.target.value === "__subir") { input.current?.click(); return; } onChange?.(e.target.value); }}>
          <option value="">Sin encabezado</option>
          {lista.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          <option value="__subir">＋ Subir un encabezado nuevo…</option>
        </select>
        {subiendo && <span className="crm-muted">Subiendo…</span>}
        {elegido && <button type="button" className="btn-back-sm" onClick={quitar} title="Quitar este encabezado de la lista">🗑️</button>}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => subir(e.target.files?.[0])} />
      </div>
      {elegido && <img src={elegido.imagen} alt={`Encabezado: ${elegido.nombre}`} style={{ maxWidth: compacto ? 220 : 360, maxHeight: 70, objectFit: "contain", alignSelf: "flex-start", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", padding: 4 }} />}
      {error && <p className="error-msg" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
