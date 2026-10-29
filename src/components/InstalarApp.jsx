import { useEffect, useState } from "react";
import Modal from "./Modal";

// Botón «Instalar AulaIA»: en Android/Chrome abre el aviso de instalación;
// en iPhone/iPad (y donde no hay aviso) explica cómo añadirla a la pantalla de inicio.
let avisoGuardado = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); avisoGuardado = e; window.dispatchEvent(new Event("aulaia-instalable")); });
}
const yaInstalada = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
};
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esSafariMac = () => /Macintosh/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);

export default function InstalarApp({ onHecho }) {
  const [instalada, setInstalada] = useState(yaInstalada());
  const [, refrescar] = useState(0);
  const [ayuda, setAyuda] = useState(false);
  useEffect(() => {
    const f = () => refrescar(n => n + 1);
    const g = () => setInstalada(true);
    window.addEventListener("aulaia-instalable", f);
    window.addEventListener("appinstalled", g);
    return () => { window.removeEventListener("aulaia-instalable", f); window.removeEventListener("appinstalled", g); };
  }, []);
  if (instalada) return null;

  const instalar = async () => {
    if (avisoGuardado) {
      avisoGuardado.prompt();
      const r = await avisoGuardado.userChoice.catch(() => null);
      avisoGuardado = null;
      if (r?.outcome === "accepted") setInstalada(true);
      onHecho?.();
      return;
    }
    setAyuda(true);
  };

  return (
    <>
      <button className="btn-back-sm" onClick={instalar}>📲 Instalar AulaIA como app</button>
      {ayuda && (
        <Modal titulo="📲 Instalar AulaIA" onClose={() => { setAyuda(false); onHecho?.(); }}>
          {esIOS() ? (
            <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
              <li>Abre AulaIA en <strong>Safari</strong> (en Chrome del iPhone no se puede).</li>
              <li>Pulsa el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba ⬆️).</li>
              <li>Baja y pulsa <strong>«Añadir a pantalla de inicio»</strong>.</li>
              <li>Pulsa <strong>«Añadir»</strong>. Aparecerá el icono de AulaIA con el resto de tus apps.</li>
            </ol>
          ) : esSafariMac() ? (
            <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
              <li>En la barra de menús de Safari, pulsa <strong>Archivo → «Añadir al Dock»</strong>.</li>
              <li>Pulsa <strong>«Añadir»</strong>. AulaIA se abrirá en su propia ventana, como una app.</li>
            </ol>
          ) : (
            <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
              <li>Abre AulaIA en <strong>Chrome</strong> (o Edge).</li>
              <li>Pulsa el menú <strong>⋮</strong> (arriba a la derecha).</li>
              <li>Elige <strong>«Instalar AulaIA»</strong> o <strong>«Añadir a pantalla de inicio»</strong>. En ordenador: <strong>«Enviar, guardar y compartir → Instalar página como aplicación»</strong>.</li>
            </ol>
          )}
          <p className="crm-muted" style={{ marginBottom: 0 }}>Es la misma AulaIA, con su icono y a pantalla completa. Se actualiza sola: no hay que descargar nada más.</p>
        </Modal>
      )}
    </>
  );
}
