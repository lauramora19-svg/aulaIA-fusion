import { useEffect, useRef, useState } from "react";

// Firma para los documentos: se dibuja con el dedo o el ratón (o se sube una foto)
// y se guarda SOLO en este dispositivo (no se sube a AulaIA).
const CLAVE = "aulaia-firma";
export const leerFirma = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch { return null; } };
const guardarFirma = (f) => { try { f ? localStorage.setItem(CLAVE, JSON.stringify(f)) : localStorage.removeItem(CLAVE); } catch {} };

// Recorta lo que no es firma (fondo blanco o transparente) y devuelve { png, ancho, alto }
function recortar(canvas, umbral = 200) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const tinta = px[i + 3] > 40 && (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) < umbral;
    if (tinta) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const m = 6; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const c = document.createElement("canvas"); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  const cx = c.getContext("2d");
  // Solo los trazos oscuros, sobre fondo transparente
  const src = ctx.getImageData(x0, y0, c.width, c.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const d = src.data;
    const oscuro = d[i + 3] > 40 && (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) < umbral;
    if (!oscuro) d[i + 3] = 0;
  }
  cx.putImageData(src, 0, 0);
  return { png: c.toDataURL("image/png"), ancho: c.width, alto: c.height };
}

export default function FirmaPad({ onCambio }) {
  const [firma, setFirma] = useState(leerFirma);
  const [editar, setEditar] = useState(false);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef(null);
  const dibujando = useRef(false);
  const fileRef = useRef(null);

  useEffect(() => { onCambio?.(firma); }, [firma]);

  useEffect(() => {
    if (!editar || !canvas.current) return;
    const c = canvas.current;
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2);
    const ctx = c.getContext("2d");
    ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1e3a8a";
    setHayTrazo(false);
  }, [editar]);

  const pos = (e) => { const r = canvas.current.getBoundingClientRect(); return [(e.clientX - r.left) * 2, (e.clientY - r.top) * 2]; };
  const bajar = (e) => { e.preventDefault(); canvas.current.setPointerCapture?.(e.pointerId); dibujando.current = true; const ctx = canvas.current.getContext("2d"); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); setHayTrazo(true); };
  const mover = (e) => { if (!dibujando.current) return; e.preventDefault(); const ctx = canvas.current.getContext("2d"); const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
  const subir = () => { dibujando.current = false; };
  const limpiar = () => { const c = canvas.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setHayTrazo(false); };

  const guardar = () => {
    const f = recortar(canvas.current);
    if (!f) { setError("Dibuja tu firma en el recuadro."); return; }
    guardarFirma(f); setFirma(f); setEditar(false); setError("");
  };
  const desdeFoto = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1200 / img.naturalWidth);
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const f = recortar(c, 110);
      if (!f) { setError("No se ve ninguna firma en la foto. Hazla sobre papel blanco y con bolígrafo oscuro."); return; }
      guardarFirma(f); setFirma(f); setEditar(false); setError("");
    };
    img.onerror = () => { URL.revokeObjectURL(url); setError("No se ha podido abrir la imagen. Usa una foto JPG o PNG."); };
    img.src = url;
    if (fileRef.current) fileRef.current.value = "";
  };
  const quitar = () => { if (!window.confirm("¿Quitar tu firma de este dispositivo?")) return; guardarFirma(null); setFirma(null); };

  return (
    <div className="aus-firma">
      {!editar && firma && (
        <div className="aus-firma-actual">
          <img src={firma.png} alt="Tu firma" />
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-back-sm" onClick={() => setEditar(true)}>✏️ Cambiar</button>
          <button type="button" className="btn-back-sm" onClick={quitar}>🗑️ Quitar</button>
        </div>
      )}
      {!editar && !firma && (
        <button type="button" className="btn-back-sm" onClick={() => setEditar(true)}>✍️ Añadir mi firma</button>
      )}
      {editar && (
        <div>
          <canvas ref={canvas} className="aus-firma-lienzo" onPointerDown={bajar} onPointerMove={mover} onPointerUp={subir} onPointerLeave={subir} onPointerCancel={subir} aria-label="Recuadro para firmar" />
          <div className="crm-modal-actions" style={{ flexWrap: "wrap", marginTop: 6 }}>
            <button type="button" className="btn-back-sm" onClick={limpiar} disabled={!hayTrazo}>Borrar</button>
            <button type="button" className="btn-back-sm" onClick={() => fileRef.current?.click()}>📷 Usar una foto de mi firma</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => desdeFoto(e.target.files?.[0])} />
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-back-sm" onClick={() => { setEditar(false); setError(""); }}>Cancelar</button>
            <button type="button" className="library-new-btn" onClick={guardar} disabled={!hayTrazo}>Guardar firma</button>
          </div>
        </div>
      )}
      {error && <p className="error-msg">{error}</p>}
      <p className="field-hint" style={{ margin: "4px 0 0" }}>Firma con el dedo o con el ratón. Se guarda solo en este dispositivo, no en AulaIA.</p>
    </div>
  );
}
