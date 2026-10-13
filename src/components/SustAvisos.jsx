// Aviso de sustitución para el profesor (en «Hoy»). Solo ve las suyas.
import { useEffect, useState } from "react";
import { misAvisos, marcarEnterado, fechaLarga, hoyISO } from "../lib/sustituciones";
import { pdfAviso } from "../lib/sustPdf";
import "../sust.css";

export default function SustAvisos({ email, centro }) {
  const [avisos, setAvisos] = useState([]);
  const cargar = () => misAvisos(email).then(setAvisos).catch(() => setAvisos([]));
  useEffect(() => { cargar(); }, [email]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!avisos.length) return null;
  const hoy = hoyISO();
  return (
    <div className="crm-page" style={{ paddingBottom: 0 }}><section className="sust-aviso" aria-label="Tus sustituciones">
      <h3>{avisos.some(a => a.fecha === hoy) ? "TIENES UNA SUSTITUCIÓN HOY" : "TIENES SUSTITUCIONES PRÓXIMAMENTE"}</h3>
      {avisos.map(a => (
        <div key={a.id} className="sust-aviso-item">
          <div>
            <strong>{a.fecha === hoy ? "Hoy" : fechaLarga(a.fecha)} · {a.hora} · {a.grupo}{a.materia ? ` · ${a.materia}` : ""}</strong>
            <p>{a.aula ? `${a.aula}. ` : ""}{a.enterado_at ? "✔ Ya has marcado «Enterado»." : ""}</p>
          </div>
          <div className="sust-acciones">
            <button className="sust-b1" onClick={async () => (await pdfAviso(a, centro)).save(`Sustitucion_${a.fecha}.pdf`)}>📄 Ver plan (PDF)</button>
            {!a.enterado_at && <button className="sust-b2" onClick={async () => { await marcarEnterado(a.id).catch(() => {}); cargar(); }}>👍 Enterado</button>}
          </div>
        </div>
      ))}
    </section></div>
  );
}
