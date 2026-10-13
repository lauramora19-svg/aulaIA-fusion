// Horarios del centro para sustituciones: tramos, carga por Excel, a mano o con IA.
import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import Campo from "./Campo";
import {
  etapaDe, TIPOS_HORA, DIAS, horaTramo, etiquetasTramos, listarTramos, crearTramosEjemplo, guardarTramo, borrarTramo,
  listarProfesores, listarHorario, guardarCelda, plantillaExcel, leerExcel, leerHorarioConIA, guardarImportacion,
} from "../lib/sustituciones";

const METODOS = [
  { id: "manual", label: "✍️ Rellenar a mano" },
  { id: "excel", label: "📊 Importar Excel" },
  { id: "ia", label: "🤖 Desde PDF, Word o foto (con IA)" },
];

export default function SustHorarios({ etapa }) {
  const [tramos, setTramos] = useState(null);
  const [profes, setProfes] = useState([]);
  const [horario, setHorario] = useState([]);
  const [metodo, setMetodo] = useState("manual");
  const [editTramos, setEditTramos] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const cargar = async () => {
    const [t, p, h] = await Promise.all([listarTramos(etapa), listarProfesores(), listarHorario(etapa)]);
    setTramos(t); setProfes(p.filter(x => (x.etapas || []).includes(etapa))); setHorario(h);
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const conHorario = new Set(horario.map(h => h.profesor_id));
  const sinHorario = profes.filter(p => !conHorario.has(p.id));
  const etiquetas = useMemo(() => etiquetasTramos(tramos || []), [tramos]);
  const hecho = (m) => { setOk(m); setError(""); cargar(); };

  if (!tramos) return <p className="crm-loading">Cargando…</p>;
  return (
    <section className="sust-seccion">
      {error && <p className="error-msg">{error}</p>}
      {ok && <p className="crm-aviso">✅ {ok}</p>}

      <div className="card">
        <div className="sust-cabecera">
          <div><h3 className="crm-h3" style={{ margin: 0 }}>Tramos horarios de {etapaDe(etapa).nombre}</h3><p className="crm-muted" style={{ margin: "4px 0 0" }}>Cada etapa tiene los suyos.</p></div>
          {tramos.length > 0 && <button className="doc-btn" onClick={() => setEditTramos(true)}>✏️ Editar tramos</button>}
        </div>
        {tramos.length === 0 ? (
          <div className="sust-acciones" style={{ marginTop: 12 }}>
            <button className="library-new-btn" onClick={async () => { try { await crearTramosEjemplo(etapa); hecho("Tramos creados. Cámbialos si en tu centro son distintos."); } catch (e) { setError(e.message); } }}>Usar tramos de ejemplo</button>
            <button className="doc-btn" onClick={() => setEditTramos(true)}>➕ Crear mis tramos</button>
          </div>
        ) : (
          <div className="sust-tramos" style={{ marginTop: 12 }}>
            {tramos.map(t => <span key={t.id} className={`sust-tramo ${t.recreo ? "sust-tramo-recreo" : ""}`}>{etiquetas[t.id]} · {horaTramo(t)}</span>)}
          </div>
        )}
      </div>

      {tramos.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="crm-h3" style={{ marginTop: 0 }}>Cargar horarios del profesorado</h3>
          <div className="chips-grid crm-tabs" role="tablist" aria-label="Forma de carga">
            {METODOS.map(m => <button key={m.id} role="tab" aria-selected={metodo === m.id} className={`chip chip-small ${metodo === m.id ? "chip-active" : ""}`} onClick={() => setMetodo(m.id)}><span className="chip-label">{m.label}</span></button>)}
          </div>
          {metodo === "manual" && <Manual etapa={etapa} tramos={tramos} etiquetas={etiquetas} profes={profes} horario={horario} onCambio={cargar} onError={setError} />}
          {metodo === "excel" && <Importar etapa={etapa} tramos={tramos} etiquetas={etiquetas} profes={profes} modo="excel" onHecho={hecho} onError={setError} />}
          {metodo === "ia" && <Importar etapa={etapa} tramos={tramos} etiquetas={etiquetas} profes={profes} modo="ia" onHecho={hecho} onError={setError} />}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="crm-h3" style={{ marginTop: 0 }}>Estado de la carga</h3>
        <p style={{ margin: 0 }}><strong>{profes.length - sinHorario.length}</strong> de <strong>{profes.length}</strong> profesores tienen horario en {etapaDe(etapa).nombre}.</p>
        {sinHorario.length > 0 && <p className="crm-muted">Falta: {sinHorario.map(p => p.nombre).join(", ")}</p>}
        <p className="field-hint">Los horarios solo los ve el equipo directivo de esta etapa.</p>
      </div>

      {editTramos && <EditarTramos etapa={etapa} tramos={tramos} onClose={() => { setEditTramos(false); cargar(); }} />}
    </section>
  );
}

function EditarTramos({ etapa, tramos, onClose }) {
  const [lista, setLista] = useState(tramos.map(t => ({ ...t })));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cambia = (i, k, v) => setLista(lista.map((t, j) => (j === i ? { ...t, [k]: v, cambiado: true } : t)));
  const guardar = async () => {
    setGuardando(true); setError("");
    try {
      const ordenada = [...lista].filter(t => t.inicio && t.fin).sort((a, b) => a.inicio.localeCompare(b.inicio, "es", { numeric: true }));
      for (const [i, t] of ordenada.entries()) if (t.cambiado || !t.id || t.orden !== i + 1) await guardarTramo({ ...t, etapa, orden: i + 1 });
      onClose();
    } catch (e) { setError(e.message); setGuardando(false); }
  };
  const quitar = async (i) => {
    const t = lista[i];
    if (t.id && !window.confirm("¿Quitar este tramo? Se borran también las horas de ese tramo en todos los horarios.")) return;
    if (t.id) { try { await borrarTramo(t.id); } catch (e) { setError(e.message); return; } }
    setLista(lista.filter((_, j) => j !== i));
  };
  return (
    <Modal titulo={`Tramos de ${etapaDe(etapa).nombre}`} onClose={onClose} ancho={560}>
      <div className="crm-form">
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead><tr><th>Empieza</th><th>Termina</th><th>Recreo</th><th></th></tr></thead>
            <tbody>
              {lista.map((t, i) => (
                <tr key={t.id || "n" + i}>
                  <td><input className="input-tema" style={{ maxWidth: 90 }} value={t.inicio} placeholder="9:00" onChange={e => cambia(i, "inicio", e.target.value)} aria-label="Empieza" /></td>
                  <td><input className="input-tema" style={{ maxWidth: 90 }} value={t.fin} placeholder="9:45" onChange={e => cambia(i, "fin", e.target.value)} aria-label="Termina" /></td>
                  <td><input type="checkbox" checked={!!t.recreo} onChange={e => cambia(i, "recreo", e.target.checked)} aria-label="Es recreo" style={{ width: 20, height: 20 }} /></td>
                  <td><button className="sust-btn sust-btn-suave" onClick={() => quitar(i)} aria-label="Quitar tramo">🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="doc-btn" onClick={() => setLista([...lista, { inicio: "", fin: "", recreo: false, cambiado: true }])}>➕ Añadir tramo</button>
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions"><button className="btn-back-sm" onClick={onClose}>Cancelar</button><span style={{ flex: 1 }} /><button className="library-new-btn" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar tramos"}</button></div>
      </div>
    </Modal>
  );
}

// ── Rellenar a mano ─────────────────────────────────────────────────────────
function Manual({ etapa, tramos, etiquetas, profes, horario, onCambio, onError }) {
  const [pid, setPid] = useState(profes[0]?.id || "");
  const [celda, setCelda] = useState(null);
  useEffect(() => { if (!profes.some(p => p.id === pid)) setPid(profes[0]?.id || ""); }, [profes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!profes.length) return <p className="sust-privacidad" style={{ marginTop: 12 }}>Primero añade al profesorado en la pestaña «Profesorado», o importa los horarios: se dan de alta solos.</p>;
  const mio = horario.filter(h => h.profesor_id === pid);
  const de = (tramoId, dia) => mio.find(h => h.tramo_id === tramoId && h.dia === dia);

  const guardar = async (c) => {
    try { await guardarCelda({ ...c, profesor_id: pid, etapa }); setCelda(null); onCambio(); } catch (e) { onError(e.message); }
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div className="sust-cabecera" style={{ marginBottom: 10 }}>
        <Campo label="Profesor/a">
          <select className="input-tema crm-select" value={pid} onChange={e => setPid(e.target.value)}>
            {profes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <div className="sust-leyenda">{Object.entries(TIPOS_HORA).map(([k, t]) => <span key={k} className={`sust-t-${k}`}>{t.emoji} {t.label}</span>)}</div>
      </div>
      <p className="field-hint">Pulsa una casilla para decir qué hace en esa hora.</p>
      <div className="sust-grid-wrap">
        <div className="sust-grid">
          <div />
          {DIAS.map(d => <div key={d} className="sust-grid-dia">{d.toUpperCase()}</div>)}
          {tramos.map(t => [
            <div key={t.id} className="sust-grid-tramo">{etiquetas[t.id]}<small>{horaTramo(t)}</small></div>,
            ...[1, 2, 3, 4, 5].map(dia => {
              const h = de(t.id, dia);
              return (
                <button key={t.id + dia} className={`sust-celda ${h ? "sust-t-" + h.tipo : ""}`} aria-label={`${DIAS[dia - 1]} ${horaTramo(t)}: ${h ? TIPOS_HORA[h.tipo].label : "vacía"}`}
                  onClick={() => setCelda({ tramo_id: t.id, dia, tipo: h?.tipo || (t.recreo ? "patio" : "clase"), grupo: h?.grupo || "", materia: h?.materia || "", aula: h?.aula || "", existe: !!h, recreo: t.recreo, hora: horaTramo(t) })}>
                  {h ? <>{TIPOS_HORA[h.tipo].label}{(h.grupo || h.materia) && <small>{[h.grupo, h.materia].filter(Boolean).join(" · ")}</small>}</> : "＋"}
                </button>
              );
            }),
          ])}
        </div>
      </div>
      {celda && (
        <Modal titulo={`${DIAS[celda.dia - 1]} · ${celda.hora}`} onClose={() => setCelda(null)}>
          <div className="crm-form">
            <div className="sust-tipos">
              {(celda.recreo ? ["patio", "guardia", "libre"] : ["clase", "guardia", "refuerzo", "libre"]).map(k => (
                <button key={k} className={`sust-t-${k} ${celda.tipo === k ? "sust-tipo-on" : ""}`} onClick={() => setCelda({ ...celda, tipo: k })}>{TIPOS_HORA[k].emoji} {TIPOS_HORA[k].label}</button>
              ))}
            </div>
            {(celda.tipo === "clase" || celda.tipo === "refuerzo") && (
              <div className="crm-form-row">
                <Campo label="Grupo"><input className="input-tema" value={celda.grupo} onChange={e => setCelda({ ...celda, grupo: e.target.value })} placeholder="3.º B" /></Campo>
                <Campo label="Área"><input className="input-tema" value={celda.materia} onChange={e => setCelda({ ...celda, materia: e.target.value })} placeholder="Lengua" /></Campo>
                <Campo label="Aula"><input className="input-tema" value={celda.aula} onChange={e => setCelda({ ...celda, aula: e.target.value })} placeholder="Aula 3B" /></Campo>
              </div>
            )}
            <div className="crm-modal-actions">
              {celda.existe && <button className="btn-back-sm" onClick={() => guardar({ ...celda, tipo: "" })}>🗑️ Dejar vacía</button>}
              <span style={{ flex: 1 }} />
              <button className="library-new-btn" onClick={() => guardar(celda)}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Importar (Excel con plantilla, o cualquier documento con IA) ───────────
function Importar({ etapa, tramos, etiquetas, profes, modo, onHecho, onError }) {
  const [archivo, setArchivo] = useState(null);
  const [res, setRes] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const tramo = (id) => tramos.find(t => t.id === id);

  const leer = async (f, conIA) => {
    setRes(null); setAviso(""); onError(""); setLeyendo(true); setProgreso(0);
    try {
      if (!conIA) {
        const r = await leerExcel(f, tramos);
        if (!r.formato) { setAviso("Este Excel no tiene las columnas de la plantilla. Puedes leerlo con IA."); setLeyendo(false); return; }
        setRes(r);
      } else setRes(await leerHorarioConIA(f, etapa, tramos, profes, setProgreso));
    } catch (e) { onError(e.message); }
    setLeyendo(false);
  };
  const elegir = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setArchivo(f); leer(f, modo === "ia"); };
  const guardar = async () => {
    setGuardando(true);
    try { const r = await guardarImportacion(etapa, res.filas, await listarProfesores()); setRes(null); setArchivo(null); onHecho(`Guardadas ${r.celdas} horas${r.nuevos ? ` y ${r.nuevos} profesores nuevos (revisa su correo en Profesorado)` : ""}.`); }
    catch (e) { onError(e.message); }
    setGuardando(false);
  };
  const cambiaTipo = (i, tipo) => setRes({ ...res, filas: res.filas.map((f, j) => (j === i ? { ...f, tipo, dudoso: false } : f)) });
  const quita = (i) => setRes({ ...res, filas: res.filas.filter((_, j) => j !== i) });
  const porProfe = useMemo(() => {
    const g = {}; (res?.filas || []).forEach((f, i) => { (g[f.profesor] = g[f.profesor] || []).push({ ...f, i }); }); return g;
  }, [res]);

  return (
    <div style={{ marginTop: 12 }}>
      {modo === "excel" ? (
        <div className="sust-acciones" style={{ marginBottom: 12 }}>
          <p className="crm-muted" style={{ margin: 0, flex: "1 1 320px" }}>Descarga la plantilla, rellénala (una fila por profesor, día y tramo) y súbela. Los profesores que no estén dados de alta se crean solos.</p>
          <button className="doc-btn" onClick={() => plantillaExcel(etapa, tramos, profes).catch(e => onError(e.message))}>⬇️ Descargar plantilla</button>
        </div>
      ) : (
        <p className="crm-muted">Sube el horario de un profesor o el de todo el claustro: PDF, Word, Excel con otro formato o una foto. La IA lo lee y te lo enseña para revisarlo. <strong>Nada se guarda sin tu visto bueno.</strong></p>
      )}
      {!res && (
        <div className="sust-drop">
          <div style={{ fontWeight: 800 }}>{modo === "excel" ? "Sube el Excel con los horarios" : "Elige el archivo con el horario"}</div>
          <label className="library-new-btn" style={{ cursor: "pointer" }}>
            {leyendo ? (modo === "ia" ? `Leyendo con IA… ${progreso ? Math.min(99, Math.round(progreso / 40)) + "%" : ""}` : "Leyendo…") : "📎 Elegir archivo"}
            <input type="file" hidden disabled={leyendo} accept={modo === "excel" ? ".xlsx,.xls,.csv,.ods" : ".pdf,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"} onChange={elegir} />
          </label>
          {archivo && <span className="field-hint">{archivo.name}</span>}
          {aviso && <><p className="error-msg" style={{ margin: 0 }}>{aviso}</p><button className="doc-btn" onClick={() => leer(archivo, true)}>🤖 Leer este Excel con IA</button></>}
        </div>
      )}
      {res && (
        <>
          <p><strong>{res.filas.length}</strong> horas leídas de <strong>{Object.keys(porProfe).length}</strong> profesores.{res.dudas.length > 0 && ` ${res.dudas.length} filas no se han entendido y no se guardarán.`} Revisa y pulsa Guardar.</p>
          {Object.entries(porProfe).map(([nombre, filas]) => (
            <details key={nombre} className="card" style={{ marginBottom: 10 }} open={Object.keys(porProfe).length <= 3}>
              <summary style={{ cursor: "pointer", fontWeight: 800 }}>{nombre} · {filas.length} horas{filas.some(f => f.dudoso) ? " · ⚠️ revisar" : ""}</summary>
              <div className="crm-table-wrap" style={{ marginTop: 8 }}>
                <table className="crm-table">
                  <thead><tr><th>Día</th><th>Tramo</th><th>Tipo</th><th>Grupo · Área</th><th>Aula</th><th></th></tr></thead>
                  <tbody>
                    {[...filas].sort((a, b) => a.dia - b.dia || tramo(a.tramo_id).orden - tramo(b.tramo_id).orden).map(f => (
                      <tr key={f.i} className={f.dudoso ? "sust-dudoso" : ""}>
                        <td>{DIAS[f.dia - 1]}</td>
                        <td className="crm-nowrap">{etiquetas[f.tramo_id]} · {horaTramo(tramo(f.tramo_id))}</td>
                        <td><select className="input-tema" value={f.tipo} onChange={e => cambiaTipo(f.i, e.target.value)} aria-label="Tipo">{Object.entries(TIPOS_HORA).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>{f.dudoso && <span className="sust-motivo">⚠️ La IA no está segura</span>}</td>
                        <td>{[f.grupo, f.materia].filter(Boolean).join(" · ")}</td>
                        <td>{f.aula}</td>
                        <td><button className="sust-btn sust-btn-suave" onClick={() => quita(f.i)} aria-label="Quitar fila">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
          {res.dudas.length > 0 && (
            <details className="card" style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800 }}>⚠️ {res.dudas.length} filas sin entender</summary>
              <ul className="crm-muted">{res.dudas.slice(0, 40).map((d, i) => <li key={i}>{d.linea ? `Fila ${d.linea}: ` : ""}{[d.profesor, d.dia ? DIAS[d.dia - 1] : "día ?", d.tramo_id ? "" : "tramo ?", d.tipo || "tipo ?", d.grupo].filter(Boolean).join(" · ")}</li>)}</ul>
            </details>
          )}
          <div className="crm-modal-actions">
            <button className="btn-back-sm" onClick={() => { setRes(null); setArchivo(null); }}>Cancelar</button>
            <span style={{ flex: 1 }} />
            <button className="library-new-btn" disabled={guardando || !res.filas.length} onClick={guardar}>{guardando ? "Guardando…" : `💾 Guardar ${res.filas.length} horas`}</button>
          </div>
        </>
      )}
    </div>
  );
}
