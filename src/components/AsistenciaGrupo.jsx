import { useEffect, useMemo, useState } from "react";
import { nombreCompleto } from "../lib/crm";
import {
  ESTADOS_ASIST, isoDia, fechaLargaAsist, cargarAsistencia, guardarAsistencia, resumenAsistencia,
} from "../lib/asistencia";
import ComunicadoFamiliaModal from "./ComunicadoFamiliaModal";

// Pestaña «Asistencia» de una clase: pasar lista y preparar el comunicado a la familia
export default function AsistenciaGrupo({ clase, clases, alumnos }) {
  const [fecha, setFecha] = useState(isoDia());
  const [marcas, setMarcas] = useState({});
  const [notas, setNotas] = useState({});
  const [registros, setRegistros] = useState({});
  const [pasada, setPasada] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [comunicado, setComunicado] = useState(null); // alumno
  const [resumen, setResumen] = useState(null);

  const aplicar = ({ pasada, registros }) => {
    setPasada(pasada); setRegistros(registros);
    setMarcas(Object.fromEntries(alumnos.map(a => [a.id, registros[a.id]?.estado || "presente"])));
    setNotas(Object.fromEntries(alumnos.map(a => [a.id, registros[a.id]?.nota || ""])));
    setCambios(false);
  };
  useEffect(() => {
    setCargando(true); setError(""); setOk("");
    cargarAsistencia(clase.id, fecha).then(aplicar).catch(e => setError(e.message)).finally(() => setCargando(false));
  }, [clase.id, fecha, alumnos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const desdeMes = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDia(d); }, []);
  const cargarResumen = () => resumenAsistencia(clase.id, desdeMes).then(setResumen).catch(() => setResumen(null));
  useEffect(() => { cargarResumen(); }, [clase.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcar = (id, estado) => { setMarcas(m => ({ ...m, [id]: estado })); setCambios(true); setOk(""); };
  const todosPresentes = () => { setMarcas(Object.fromEntries(alumnos.map(a => [a.id, "presente"]))); setCambios(true); };
  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      aplicar(await guardarAsistencia(clase.id, fecha, marcas, notas));
      const n = Object.values(marcas).filter(e => e === "falta" || e === "justificada").length;
      setOk(n ? `Lista guardada. ${n === 1 ? "Hay 1 ausencia" : `Hay ${n} ausencias`}: puedes preparar el comunicado a la familia con «✉️ Comunicado».` : "Lista guardada: hoy están todos.");
      cargarResumen();
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  const cuenta = (e) => Object.values(marcas).filter(x => x === e).length;
  const moverDia = (n) => { const d = new Date(`${fecha}T12:00:00`); d.setDate(d.getDate() + n); setFecha(isoDia(d)); };

  if (!alumnos.length) return <p className="crm-muted">Añade alumnos a la clase para poder pasar lista.</p>;

  return (
    <>
      <div className="crm-toolbar" style={{ flexWrap: "wrap" }}>
        <button className="btn-back-sm" onClick={() => moverDia(-1)} aria-label="Día anterior">◀</button>
        <input type="date" className="input-tema crm-select" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} aria-label="Fecha" />
        <button className="btn-back-sm" onClick={() => moverDia(1)} aria-label="Día siguiente">▶</button>
        <strong style={{ textTransform: "capitalize" }}>{fechaLargaAsist(fecha)}</strong>
        <span className="crm-muted">{pasada ? "✔ Lista pasada" : "Lista sin pasar"}</span>
        <span style={{ flex: 1 }} />
        <span className="crm-muted">{cuenta("presente")} presentes · {cuenta("falta")} faltas · {cuenta("retraso")} retrasos · {cuenta("justificada")} justificadas</span>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {ok && <p className="crm-aviso">✅ {ok}</p>}

      {cargando ? <div className="crm-loading"><div className="lib-spinner" /></div> : (
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead><tr><th>#</th><th>Alumno/a</th><th>Asistencia</th><th>Nota</th><th>Familia</th></tr></thead>
            <tbody>
              {alumnos.map((a, i) => {
                const est = marcas[a.id] || "presente";
                const reg = registros[a.id];
                const ausente = reg && (reg.estado === "falta" || reg.estado === "justificada");
                return (
                  <tr key={a.id}>
                    <td className="crm-muted">{i + 1}</td>
                    <td><strong>{nombreCompleto(a)}</strong>{a.tiene_nee && <span className="doc-badge crm-badge-nee">NEE</span>}
                      {resumen?.por[a.id]?.falta > 0 && <div className="crm-muted" style={{ fontSize: 12 }}>{resumen.por[a.id].falta} falta{resumen.por[a.id].falta > 1 ? "s" : ""} en 30 días</div>}
                    </td>
                    <td>
                      <div className="chips-grid" role="radiogroup" aria-label={`Asistencia de ${nombreCompleto(a)}`} style={{ gap: 4, flexWrap: "nowrap" }}>
                        {Object.entries(ESTADOS_ASIST).map(([k, e]) => (
                          <button key={k} type="button" role="radio" aria-checked={est === k} title={e.label}
                            className={`chip chip-small ${est === k ? "chip-active" : ""}`}
                            style={est === k ? { backgroundImage: "none", backgroundColor: e.color, borderColor: e.color, color: "#fff" } : undefined}
                            onClick={() => marcar(a.id, k)}>
                            <span className="chip-label">{e.corto}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>{est !== "presente" && <input className="input-tema" style={{ minWidth: 140 }} value={notas[a.id] || ""} placeholder="Opcional" onChange={e => { setNotas(n => ({ ...n, [a.id]: e.target.value })); setCambios(true); }} />}</td>
                    <td>{ausente
                      ? <button className="doc-btn" onClick={() => setComunicado({ alumno: a, registro: reg })}>{reg.comunicado_at ? "✔ Comunicado" : "✉️ Comunicado"}</button>
                      : <span className="crm-muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="crm-modal-actions" style={{ marginTop: 12 }}>
        <span className="crm-muted" style={{ flex: 1 }}>P: presente · F: falta · R: retraso · J: falta justificada. Solo se guardan las ausencias y los retrasos.</span>
        <button className="btn-back" onClick={todosPresentes}>Todos presentes</button>
        <button className="library-new-btn" onClick={guardar} disabled={guardando || cargando}>{guardando ? "Guardando…" : pasada && !cambios ? "✔ Guardada" : "💾 Guardar lista"}</button>
      </div>

      {resumen && resumen.dias > 0 && (
        <p className="field-hint" style={{ marginTop: 8 }}>Últimos 30 días: lista pasada {resumen.dias} {resumen.dias === 1 ? "día" : "días"} · {Object.values(resumen.por).reduce((s, x) => s + x.falta + x.justificada, 0)} ausencias · {Object.values(resumen.por).reduce((s, x) => s + x.retraso, 0)} retrasos.</p>
      )}

      {comunicado && (
        <ComunicadoFamiliaModal clase={clase} clases={clases} fecha={fecha} alumno={comunicado.alumno} registro={comunicado.registro}
          onClose={() => setComunicado(null)}
          onHecho={() => cargarAsistencia(clase.id, fecha).then(r => setRegistros(r.registros)).catch(() => {})} />
      )}
    </>
  );
}
