// Gestor de sustituciones · solo equipo directivo (la base de datos lo impide al resto)
import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import Campo from "../components/Campo";
import SustHorarios from "../components/SustHorarios";
import {
  ETAPAS_SUST, etapaDe, TIPOS_HORA, hoyISO, isoLocal, fechaDe, fechaLarga, fechaCorta, diasLectivos,
  cargarDia, candidatos, sesionesDe, registrarAusencia, borrarAusencia, cambiarSustituto, ponerEstado,
  guardarObservaciones, enviarAviso, enviarCorreo, planDe, listarProfesores, guardarProfesor, borrarProfesor,
  cuentasAulaIA, historialMes,
} from "../lib/sustituciones";
import { pdfCuadro, pdfAviso, pdfBase64 } from "../lib/sustPdf";
import "../sust.css";

const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const TABS = [
  { id: "dia", label: "📋 Sustituciones del día" },
  { id: "horarios", label: "🗓️ Horarios" },
  { id: "profes", label: "👥 Profesorado" },
  { id: "historial", label: "📊 Historial y reparto" },
];

export default function SustitucionesPage({ etapas, centro }) {
  const visibles = ETAPAS_SUST.filter(e => etapas.includes(e.id));
  const [etapa, setEtapa] = useState(etapas.includes("pri") ? "pri" : etapas[0]);
  const [tab, setTab] = useState("dia");
  const [fecha, setFecha] = useState(hoyISO());
  if (!visibles.length) return <div className="crm-page"><p className="crm-muted">No tienes acceso al gestor de sustituciones.</p></div>;

  return (
    <div className="crm-page">
      <h1 className="crm-hello-title">Sustituciones</h1>
      <p className="crm-muted">🔒 Solo lo ve el equipo directivo. El resto del profesorado recibe únicamente su propia sustitución.</p>

      {visibles.length > 1 && (
        <div className="chips-grid crm-tabs" role="tablist" aria-label="Etapa">
          {visibles.map(e => (
            <button key={e.id} role="tab" aria-selected={etapa === e.id} className={`chip chip-small ${etapa === e.id ? "chip-active" : ""}`} onClick={() => setEtapa(e.id)}>
              <span className="chip-label">{e.nombre}</span>
            </button>
          ))}
        </div>
      )}
      <div className="chips-grid crm-tabs" role="tablist" aria-label="Apartado">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`chip chip-small ${tab === t.id ? "chip-active" : ""}`} onClick={() => setTab(t.id)}>
            <span className="chip-label">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "dia" && <PanelDia key={etapa} etapa={etapa} etapas={etapas} fecha={fecha} setFecha={setFecha} centro={centro} irHorarios={() => setTab("horarios")} />}
      {tab === "horarios" && <SustHorarios key={etapa} etapa={etapa} />}
      {tab === "profes" && <Profesorado etapa={etapa} etapas={etapas} />}
      {tab === "historial" && <Historial key={etapa} etapa={etapa} onVerDia={(f) => { setFecha(f); setTab("dia"); }} />}
    </div>
  );
}

// ── Sustituciones de un día ────────────────────────────────────────────────
function PanelDia({ etapa, etapas, fecha, setFecha, centro, irHorarios }) {
  const [ctx, setCtx] = useState(null);
  const [cuentas, setCuentas] = useState(new Set());
  const [registrar, setRegistrar] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [obs, setObs] = useState({});

  const cargar = useCallback(async () => {
    setError("");
    try {
      const c = await cargarDia(etapa, fecha);
      setCtx(c);
      setCuentas(await cuentasAulaIA(c.profesores.map(p => p.email)));
    } catch (e) { setError(e.message); setCtx(x => x || { asignaciones: [], profesores: [], tramos: [], ausencias: [], ausentesIds: new Set(), conteo: {}, horarioDia: [], todosProfesores: [] }); }
  }, [etapa, fecha]);
  useEffect(() => { setCtx(null); cargar(); }, [cargar]);

  const prof = useCallback((id) => ctx?.todosProfesores.find(p => p.id === id), [ctx]);
  const asig = ctx?.asignaciones || [];
  const ausentesEtapa = (ctx?.ausencias || []).filter(a => asig.some(x => x.ausente_id === a.profesor_id) || ctx.profesores.some(p => p.id === a.profesor_id));
  const n = (e) => asig.filter(a => a.estado === e).length;

  const mover = (d) => { const f = fechaDe(fecha); f.setDate(f.getDate() + d); setFecha(isoLocal(f)); };
  const accion = async (fn, msg) => { setOcupado(true); setError(""); setOk(""); try { const r = await fn(); if (msg) setOk(typeof msg === "function" ? msg(r) : msg); await cargar(); } catch (e) { setError(e.message); } setOcupado(false); };

  const enviarUna = async (a) => {
    const s = prof(a.sustituto_id);
    const aviso = await enviarAviso(a, s);
    const doc = await pdfAviso(aviso, centro);
    const porCorreo = await enviarCorreo(aviso, pdfBase64(doc));
    return { s, porCorreo, tieneCuenta: cuentas.has((s.email || "").toLowerCase()) };
  };
  const textoEnvio = ({ s, porCorreo, tieneCuenta }) =>
    `Enviado a ${s.nombre}. ${tieneCuenta ? "Lo verá al entrar en AulaIA" : "Aún no tiene cuenta en AulaIA"}${porCorreo ? " y le ha llegado por correo con el PDF." : tieneCuenta ? "." : ": pulsa ✉️ Correo para avisarle."}`;

  const enviarTodas = () => accion(async () => {
    const lista = asig.filter(a => a.estado === "confirmada" && a.sustituto_id);
    let hechas = 0; const fallos = [];
    for (const a of lista) { try { await enviarUna(a); hechas++; } catch (e) { fallos.push(e.message); } }
    if (fallos.length) setError([...new Set(fallos)].join(" "));
    return hechas;
  }, (k) => `Enviadas ${k} sustituciones.`);

  const correo = (a) => {
    const s = prof(a.sustituto_id);
    const cuerpo = `Hola:\n\nTienes una sustitución el ${fechaLarga(a.fecha)}:\n${a.hora} · ${a.grupo}${a.materia ? " · " + a.materia : ""}${a.aula ? " · " + a.aula : ""}\n\n${planDe(a) ? "Plan de la sesión:\n" + planDe(a) + "\n\n" : ""}Gracias,\nJefatura de estudios`;
    window.location.href = `mailto:${encodeURIComponent(s?.email || "")}?subject=${encodeURIComponent(`Sustitución: ${a.hora} · ${a.grupo}`)}&body=${encodeURIComponent(cuerpo)}`;
  };
  const verPdf = async (a) => {
    const s = prof(a.sustituto_id);
    const doc = await pdfAviso({ ...a, plan: planDe(a), nombre: s?.nombre }, centro);
    doc.save(`Sustitucion_${a.fecha}_${(a.grupo || "").replace(/\W+/g, "")}.pdf`);
  };
  const cuadro = async (completa) => {
    const filas = asig.map(a => ({ hora: a.hora, grupo: a.grupo, materia: a.materia, aula: a.aula, ausente: prof(a.ausente_id)?.nombre || "", sustituto: prof(a.sustituto_id)?.nombre || "", obs: a.observaciones || "" }));
    const doc = await pdfCuadro({ etapa, fecha, filas, completa, centro });
    doc.save(`Cuadro_${etapaDe(etapa).nombre.split(" ")[0]}_${fecha}_${completa ? "direccion" : "sala"}.pdf`);
  };

  return (
    <section className="sust-seccion">
      <div className="sust-cabecera">
        <div>
          <h2>{mayus(fechaLarga(fecha))}</h2>
          <div className="sust-fecha-nav">
            <button className="sust-btn sust-btn-suave" onClick={() => mover(-1)} aria-label="Día anterior">‹</button>
            <input type="date" className="input-tema" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} aria-label="Fecha" />
            <button className="sust-btn sust-btn-suave" onClick={() => mover(1)} aria-label="Día siguiente">›</button>
            {fecha !== hoyISO() && <button className="btn-back-sm" onClick={() => setFecha(hoyISO())}>Volver a hoy</button>}
          </div>
        </div>
        <div className="sust-acciones">
          <button className="library-new-btn" onClick={() => setRegistrar(true)}>➕ Registrar ausencia</button>
          <button className="doc-btn" disabled={!asig.length} onClick={() => cuadro(true)}>📄 Cuadro (dirección)</button>
          <button className="doc-btn" disabled={!asig.length} onClick={() => cuadro(false)}>📄 Cuadro (sala de profesores)</button>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {ok && <p className="crm-aviso">✅ {ok}</p>}
      {!ctx ? <p className="crm-loading">Cargando…</p> : (
        <>
          {!ctx.tramos.length && (
            <div className="sust-privacidad" style={{ marginTop: 12 }}>
              Para empezar, carga los tramos y los horarios de {etapaDe(etapa).nombre}. <button className="btn-back-sm" onClick={irHorarios}>Ir a Horarios →</button>
            </div>
          )}
          <div className="sust-resumen">
            <div className="sust-kpi"><span>Ausencias</span><b>{ausentesEtapa.length}</b></div>
            <div className="sust-kpi"><span>Horas a cubrir</span><b>{asig.length}</b></div>
            <div className="sust-kpi"><span>Confirmadas</span><b style={{ color: "#15803d" }}>{n("confirmada")}</b></div>
            <div className="sust-kpi"><span>Enviadas</span><b style={{ color: "#1d4ed8" }}>{n("enviada")}</b></div>
          </div>

          {ausentesEtapa.length > 0 && (
            <div className="sust-ausentes">
              <strong style={{ fontSize: 13 }}>Ausentes:</strong>
              {ausentesEtapa.map(a => (
                <span key={a.id} className="sust-pill">
                  <strong>{prof(a.profesor_id)?.nombre}</strong>
                  <span className="crm-muted">{a.desde === a.hasta ? "" : `del ${fechaCorta(a.desde)} al ${fechaCorta(a.hasta)}`}</span>
                  <button title="Quitar ausencia" aria-label={`Quitar la ausencia de ${prof(a.profesor_id)?.nombre}`} onClick={() => window.confirm("¿Quitar esta ausencia? Se borran también sus sustituciones de todos los días.") && accion(() => borrarAusencia(a.id), "Ausencia quitada.")}>✕</button>
                </span>
              ))}
              <span className="field-hint">No se guarda el motivo de la ausencia.</span>
            </div>
          )}

          {asig.length === 0 ? (
            <div className="sust-privacidad">Este día no hay horas que cubrir en {etapaDe(etapa).nombre}. Si falta alguien, pulsa <strong>➕ Registrar ausencia</strong>.</div>
          ) : (
            <>
              <div className="sust-acciones" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
                <button className="sust-btn sust-btn-ok" disabled={ocupado || !n("pendiente")} onClick={() => accion(() => ponerEstado(asig.filter(a => a.estado === "pendiente" && a.sustituto_id).map(a => a.id), "confirmada"), "Confirmadas.")}>✅ Confirmar todas</button>
                <button className="sust-btn sust-btn-enviar" disabled={ocupado || !n("confirmada")} onClick={enviarTodas}>📨 Enviar todas las confirmadas</button>
              </div>
              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead><tr><th>Hora</th><th>Grupo · Área</th><th>Aula</th><th>Ausente</th><th>Sustituye</th><th>Observaciones</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {asig.map(a => {
                      const { lista, otros } = candidatos(ctx, a);
                      const actual = prof(a.sustituto_id);
                      const enLista = lista.concat(otros).some(c => c.id === a.sustituto_id);
                      const sel = lista.find(c => c.id === a.sustituto_id) || otros.find(c => c.id === a.sustituto_id);
                      return (
                        <tr key={a.id}>
                          <td className="crm-nowrap"><strong>{a.hora}</strong></td>
                          <td><strong>{a.grupo}</strong><div className="crm-muted">{a.materia}</div></td>
                          <td>{a.aula}</td>
                          <td>{prof(a.ausente_id)?.nombre}</td>
                          <td>
                            <select className="input-tema sust-sel" aria-label={`Sustituto para ${a.grupo} a las ${a.hora}`} value={a.sustituto_id || ""} disabled={ocupado}
                              onChange={e => { const id = e.target.value; const c = lista.concat(otros).find(x => x.id === id); accion(() => cambiarSustituto(a, c || null)); }}>
                              <option value="">— Sin cubrir —</option>
                              {actual && !enLista && <option value={actual.id}>{actual.nombre}</option>}
                              {lista.length > 0 && <optgroup label="Disponibles">{lista.map(c => <option key={c.id} value={c.id}>{c.nombre} · {TIPOS_HORA[c.tipo]?.label}</option>)}</optgroup>}
                              {otros.length > 0 && <optgroup label="Otros (tienen clase a esa hora)">{otros.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.tipo ? ` · ${TIPOS_HORA[c.tipo]?.label}` : ""}</option>)}</optgroup>}
                            </select>
                            {sel && <span className="sust-motivo">{sel.ocupado ? "⚠️ Tiene otra tarea a esa hora" : `${TIPOS_HORA[sel.tipo]?.label} a esa hora · ${sel.n} este mes${sel.hoy ? ` · ${sel.hoy + 1}.ª hoy` : ""}`}</span>}
                            {actual && !actual.email && <span className="sust-motivo">⚠️ Sin correo: añádelo en Profesorado</span>}
                          </td>
                          <td>
                            <input className="input-tema sust-obs" placeholder="Ej.: ficha pág. 34" value={obs[a.id] ?? a.observaciones ?? ""}
                              onChange={e => setObs({ ...obs, [a.id]: e.target.value })}
                              onBlur={() => obs[a.id] !== undefined && obs[a.id] !== a.observaciones && accion(() => guardarObservaciones(a.id, obs[a.id]))} />
                          </td>
                          <td>
                            <span className={`sust-estado sust-estado-${a.estado}`}>{{ pendiente: "Pendiente", confirmada: "Confirmada", enviada: "Enviada" }[a.estado]}</span>
                            {a.enterado_at && <span className="sust-enterado">✔ Enterado</span>}
                          </td>
                          <td>
                            <div className="sust-fila-acciones">
                              {a.estado === "pendiente" && <button className="sust-btn sust-btn-ok" disabled={ocupado || !a.sustituto_id} onClick={() => accion(() => ponerEstado([a.id], "confirmada"))}>✅ Confirmar</button>}
                              {a.estado === "confirmada" && <button className="sust-btn sust-btn-enviar" disabled={ocupado} onClick={() => accion(() => enviarUna(a), textoEnvio)}>📨 Enviar al profesor</button>}
                              {a.estado === "enviada" && <>
                                <button className="sust-btn sust-btn-suave" onClick={() => verPdf(a)}>📄 PDF</button>
                                <button className="sust-btn sust-btn-suave" onClick={() => correo(a)}>✉️ Correo</button>
                              </>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="field-hint">Orden de propuesta: guardia → refuerzo → hora libre, y entre ellos quien menos sustituciones lleva este mes. Al pulsar «Enviar al profesor», solo recibe su hora, su grupo y el plan de la sesión.</p>
            </>
          )}
        </>
      )}
      {registrar && ctx && <RegistrarAusencia etapa={etapa} etapas={etapas} fechaInicial={fecha} profesores={ctx.todosProfesores.filter(p => (p.etapas || []).some(e => etapas.includes(e)))}
        onClose={() => setRegistrar(false)} onHecho={(f, k) => { setRegistrar(false); setOk(k ? `Ausencia registrada: ${k} horas con sustituto propuesto. Revísalas y pulsa Confirmar.` : "Ausencia registrada. No tenía horas que cubrir en el horario."); if (f !== fecha) setFecha(f); else cargar(); }} />}
    </section>
  );
}

// ── Registrar ausencia ─────────────────────────────────────────────────────
function RegistrarAusencia({ etapa, etapas, fechaInicial, profesores, onClose, onHecho }) {
  const delaEtapa = profesores.filter(p => (p.etapas || []).includes(etapa));
  const [pid, setPid] = useState(delaEtapa[0]?.id || profesores[0]?.id || "");
  const [desde, setDesde] = useState(fechaInicial);
  const [hasta, setHasta] = useState(fechaInicial);
  const [indic, setIndic] = useState("");
  const [sesiones, setSesiones] = useState(null);
  const [quitadas, setQuitadas] = useState(new Set());
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const profesor = profesores.find(p => p.id === pid);
  const varios = hasta > desde;
  const lectivos = useMemo(() => diasLectivos(desde, hasta < desde ? desde : hasta), [desde, hasta]);

  useEffect(() => {
    setSesiones(null); setQuitadas(new Set());
    if (!profesor || varios) return;
    sesionesDe(profesor, desde, etapas).then(setSesiones).catch(() => setSesiones([]));
  }, [pid, desde, varios]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!profesor) return;
    if (hasta < desde) { setError("La fecha «hasta» no puede ser anterior a «desde»."); return; }
    setGuardando(true); setError("");
    try {
      const elegidos = varios ? null : new Set((sesiones || []).filter(s => !quitadas.has(s.id)).map(s => s.tramo_id));
      const r = await registrarAusencia({ profesor, desde, hasta, indicaciones: indic, tramosElegidos: elegidos, etapasPermitidas: etapas });
      onHecho(desde, r.creadas);
    } catch (e) { setError(e.message); setGuardando(false); }
  };

  return (
    <Modal titulo="Registrar ausencia" onClose={onClose} ancho={620}>
      {!profesores.length ? <p className="crm-muted">Primero da de alta al profesorado en la pestaña «Profesorado» o importa los horarios.</p> : (
        <div className="crm-form">
          <Campo label="Profesor/a ausente">
            <select className="input-tema" value={pid} onChange={e => setPid(e.target.value)}>
              {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <div className="crm-form-row">
            <Campo label="Desde"><input type="date" className="input-tema" value={desde} onChange={e => { setDesde(e.target.value); if (hasta < e.target.value) setHasta(e.target.value); }} /></Campo>
            <Campo label="Hasta"><input type="date" className="input-tema" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} /></Campo>
          </div>
          {varios ? (
            <p className="sust-privacidad">Son {lectivos.length} días lectivos. Se cubrirán todas sus horas de clase y patio de cada día, según su horario.</p>
          ) : (
            <div className="sust-sesiones">
              <strong style={{ fontSize: 14 }}>Horas que hay que cubrir</strong>
              {sesiones === null ? <p className="crm-muted">Mirando su horario…</p> : sesiones.length === 0 ? (
                <p className="crm-muted">Ese día no tiene clases en el horario cargado.</p>
              ) : sesiones.map(s => (
                <label key={s.id}>
                  <input type="checkbox" checked={!quitadas.has(s.id)} onChange={() => { const q = new Set(quitadas); q.has(s.id) ? q.delete(s.id) : q.add(s.id); setQuitadas(q); }} />
                  <strong style={{ minWidth: 100 }}>{s.hora}</strong>
                  <span>{s.tipo === "patio" ? "Vigilancia de patio" : `${s.grupo} · ${s.materia}`}{s.aula ? ` · ${s.aula}` : ""}{etapas.length > 1 && s.etapa !== etapa ? ` (${etapaDe(s.etapa).nombre})` : ""}</span>
                </label>
              ))}
            </div>
          )}
          <Campo label="Indicaciones para quien sustituya (opcional)" hint="Saldrán en el PDF de cada sustituto. No escribas el motivo de la ausencia.">
            <textarea className="textarea" rows={3} value={indic} onChange={e => setIndic(e.target.value)} placeholder="Ej.: el grupo sigue con la ficha de la página 34. La lista está en la mesa." />
          </Campo>
          <p className="sust-privacidad">🔒 <strong>No se pide el motivo.</strong> Por protección de datos, AulaIA solo guarda el día y las horas.</p>
          {error && <p className="error-msg">{error}</p>}
          <div className="crm-modal-actions">
            <button className="btn-back-sm" onClick={onClose}>Cancelar</button>
            <span style={{ flex: 1 }} />
            <button className="library-new-btn" disabled={guardando || !profesor} onClick={guardar}>{guardando ? "Registrando…" : "Registrar y proponer sustitutos"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Profesorado ────────────────────────────────────────────────────────────
function Profesorado({ etapa, etapas }) {
  const [lista, setLista] = useState(null);
  const [cuentas, setCuentas] = useState(new Set());
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const cargar = async () => {
    const l = await listarProfesores();
    setLista(l);
    setCuentas(await cuentasAulaIA(l.map(p => p.email)));
  };
  useEffect(() => { cargar(); }, []);
  const deEtapa = (lista || []).filter(p => (p.etapas || []).includes(etapa));

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    if (!edit.nombre?.trim()) { setError("Escribe el nombre."); return; }
    if (!edit.etapas?.length) { setError("Marca al menos una etapa."); return; }
    try { await guardarProfesor(edit); setEdit(null); cargar(); } catch (err) { setError(err.message); }
  };

  return (
    <section className="sust-seccion">
      <div className="sust-cabecera">
        <div><h2>Profesorado de {etapaDe(etapa).nombre}</h2><p className="crm-muted" style={{ margin: 0 }}>El correo debe ser el mismo con el que entran en AulaIA para que les llegue el aviso.</p></div>
        <button className="library-new-btn" onClick={() => setEdit({ nombre: "", email: "", etapas: [etapa] })}>➕ Añadir profesor/a</button>
      </div>
      {error && !edit && <p className="error-msg">{error}</p>}
      {!lista ? <p className="crm-loading">Cargando…</p> : deEtapa.length === 0 ? (
        <p className="sust-privacidad" style={{ marginTop: 12 }}>Aún no hay profesorado en esta etapa. Añádelo uno a uno o importa los horarios desde Excel, PDF o Word: se dan de alta solos.</p>
      ) : (
        <div className="crm-table-wrap" style={{ marginTop: 12 }}>
          <table className="crm-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Etapas</th><th>Aviso</th><th></th></tr></thead>
            <tbody>
              {deEtapa.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.email || <span className="crm-muted">— sin correo —</span>}</td>
                  <td>{(p.etapas || []).map(e => etapaDe(e).nombre).join(", ")}</td>
                  <td className="crm-nowrap">{p.email && cuentas.has(p.email.toLowerCase()) ? "📱 Lo verá en AulaIA" : "✉️ Solo por correo"}</td>
                  <td><div className="sust-fila-acciones">
                    <button className="sust-btn sust-btn-suave" onClick={() => setEdit({ ...p })}>✏️ Editar</button>
                    <button className="sust-btn sust-btn-suave" onClick={async () => { if (window.confirm(`¿Quitar a ${p.nombre}? Se borra también su horario.`)) { try { await borrarProfesor(p.id); cargar(); } catch (e) { setError(e.message); } } }}>🗑️</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal titulo={edit.id ? "Editar profesor/a" : "Añadir profesor/a"} onClose={() => setEdit(null)}>
          <form className="crm-form" onSubmit={guardar}>
            <Campo label="Nombre" hint="Como queráis que aparezca en el cuadro (por ejemplo, «M. López»)"><input className="input-tema" value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} autoFocus /></Campo>
            <Campo label="Correo"><input className="input-tema" type="email" value={edit.email || ""} onChange={e => setEdit({ ...edit, email: e.target.value })} placeholder="nombre@colegio.es" /></Campo>
            <div className="crm-campo"><span className="crm-campo-label">Etapas en las que da clase</span>
              <div className="chips-grid">
                {ETAPAS_SUST.filter(e => etapas.includes(e.id)).map(e => {
                  const on = (edit.etapas || []).includes(e.id);
                  return <button type="button" key={e.id} className={`chip chip-small ${on ? "chip-active" : ""}`} onClick={() => setEdit({ ...edit, etapas: on ? edit.etapas.filter(x => x !== e.id) : [...(edit.etapas || []), e.id] })}><span className="chip-label">{e.nombre}</span></button>;
                })}
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="crm-modal-actions"><button type="button" className="btn-back-sm" onClick={() => setEdit(null)}>Cancelar</button><span style={{ flex: 1 }} /><button type="submit" className="library-new-btn">Guardar</button></div>
          </form>
        </Modal>
      )}
    </section>
  );
}

// ── Historial y reparto ────────────────────────────────────────────────────
function Historial({ etapa, onVerDia }) {
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [datos, setDatos] = useState(null);
  const [profes, setProfes] = useState([]);
  useEffect(() => { setDatos(null); Promise.all([historialMes(etapa, mes), listarProfesores()]).then(([d, p]) => { setDatos(d); setProfes(p); }); }, [etapa, mes]);
  const nombre = (id) => profes.find(p => p.id === id)?.nombre || "—";
  const reparto = useMemo(() => {
    const c = {};
    (datos || []).forEach(a => { if (a.sustituto_id && a.estado !== "pendiente") c[a.sustituto_id] = (c[a.sustituto_id] || 0) + 1; });
    return Object.entries(c).map(([id, n]) => ({ id, n, nombre: nombre(id) })).sort((a, b) => b.n - a.n);
  }, [datos, profes]); // eslint-disable-line react-hooks/exhaustive-deps
  const dias = useMemo(() => {
    const d = {};
    (datos || []).forEach(a => {
      const x = d[a.fecha] = d[a.fecha] || { fecha: a.fecha, aus: new Set(), horas: 0, cubiertas: 0, enterados: 0 };
      x.aus.add(a.ausente_id); x.horas++; if (a.sustituto_id && a.estado !== "pendiente") x.cubiertas++; if (a.enterado_at) x.enterados++;
    });
    return Object.values(d).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [datos]);
  const max = Math.max(1, ...reparto.map(r => r.n));
  const media = reparto.length ? (reparto.reduce((s, r) => s + r.n, 0) / reparto.length).toFixed(1).replace(".", ",") : "0";

  return (
    <section className="sust-seccion">
      <div className="sust-cabecera">
        <h2>Historial de {etapaDe(etapa).nombre}</h2>
        <Campo label="Mes"><input type="month" className="input-tema" value={mes} onChange={e => e.target.value && setMes(e.target.value)} /></Campo>
      </div>
      {!datos ? <p className="crm-loading">Cargando…</p> : (
        <>
          <div className="card" style={{ marginTop: 12 }}>
            <h3 className="crm-h3">Sustituciones hechas este mes</h3>
            <p className="crm-muted">AulaIA propone primero a quien menos lleva, para que el reparto sea justo. Media: {media}.</p>
            {reparto.length === 0 ? <p className="crm-muted">Aún no hay sustituciones confirmadas este mes.</p> : reparto.map(r => (
              <div key={r.id} className="sust-barra">
                <strong>{r.nombre}</strong>
                <div className="sust-barra-fondo"><div style={{ width: `${(r.n / max) * 100}%` }} /></div>
                <strong style={{ textAlign: "right" }}>{r.n}</strong>
              </div>
            ))}
          </div>
          <div className="crm-table-wrap" style={{ marginTop: 16 }}>
            <table className="crm-table">
              <thead><tr><th>Día</th><th>Ausencias</th><th>Horas cubiertas</th><th>Enterados</th><th></th></tr></thead>
              <tbody>
                {dias.length === 0 && <tr><td colSpan={5} className="crm-muted">No hay días con sustituciones en este mes.</td></tr>}
                {dias.map(d => (
                  <tr key={d.fecha}>
                    <td><strong>{mayus(fechaCorta(d.fecha))}</strong></td>
                    <td>{d.aus.size}</td>
                    <td>{d.cubiertas} de {d.horas}</td>
                    <td>{d.enterados}</td>
                    <td><button className="sust-btn sust-btn-suave" onClick={() => onVerDia(d.fecha)}>Ver día</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-hint">No se guarda ningún motivo de ausencia.</p>
        </>
      )}
    </section>
  );
}
