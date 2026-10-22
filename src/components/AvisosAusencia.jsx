// Comunicaciones de ausencia que el profesorado envía al equipo directivo (en «Inicio»)
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { renderResultado } from "../lib/render";
import { exportarWordContenido } from "../lib/word";
import { avisosRecibidos, marcarLeido, fechasAusencia } from "../lib/ausencias";

export default function AvisosAusencia() {
  const [avisos, setAvisos] = useState([]);
  const [ver, setVer] = useState(null);
  const cargar = () => avisosRecibidos().then(setAvisos).catch(() => setAvisos([]));
  useEffect(() => { cargar(); }, []);
  if (!avisos.length) return null;
  const sinLeer = avisos.filter(a => !a.leido_at).length;

  const leido = async (a) => { await marcarLeido(a.id).catch(() => {}); cargar(); };

  return (
    <div className="crm-page" style={{ paddingBottom: 0 }}>
      <section className="card" aria-label="Comunicaciones de ausencia" style={{ borderTop: "4px solid #6366f1" }}>
        <p className="crm-card-title">📨 Comunicaciones de ausencia {sinLeer ? <span className="doc-badge" style={{ color: "#6366f1", borderColor: "#6366f1" }}>{sinLeer} sin leer</span> : null}</p>
        {avisos.map(a => (
          <div key={a.id} className="crm-modal-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>{a.de_nombre || "Un/a docente"}</strong> · {fechasAusencia(a.desde, a.hasta)}{a.horario ? ` · ${a.horario}` : ""}
              <div className="crm-muted" style={{ fontSize: 12 }}>Recibida el {new Date(a.created_at).toLocaleDateString("es-ES")}{a.leido_at ? " · ✔ Leída" : ""}</div>
            </div>
            <button className="doc-btn" onClick={() => setVer(a)}>📄 Ver documento</button>
            {!a.leido_at && <button className="doc-btn" onClick={() => leido(a)}>✔ Marcar como leída</button>}
          </div>
        ))}
      </section>
      {ver && (
        <Modal titulo={`📨 ${ver.de_nombre || "Comunicación"} · ${fechasAusencia(ver.desde, ver.hasta)}`} onClose={() => { if (!ver.leido_at) leido(ver); setVer(null); }} ancho={760}>
          <div className="resultado-body">{renderResultado(ver.documento || "(sin documento)")}</div>
          <div className="crm-modal-actions">
            <span className="crm-muted" style={{ flex: 1 }}>El motivo no se guarda en AulaIA: lo tienes en el correo.</span>
            <button className="btn-word" onClick={() => exportarWordContenido(ver.documento || "", `Ausencia ${ver.de_nombre || ""} ${ver.desde}`)}>📄 Word</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
