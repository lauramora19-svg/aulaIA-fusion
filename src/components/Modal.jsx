import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ titulo, onClose, children, ancho = 520 }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return createPortal(
    <div className="crm-modal-overlay" onMouseDown={onClose}>
      <div className="crm-modal" style={{ maxWidth: ancho }} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="crm-modal-head">
          <h3 className="crm-modal-title">{titulo}</h3>
          <button className="btn-back-sm" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
