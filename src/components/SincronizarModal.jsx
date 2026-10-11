import { useEffect, useMemo, useState } from "react";
import { analizarSincronizacion, aplicarSincronizacion } from "../lib/agenda";
import Modal from "./Modal";

// Vista previa de la sincronización: nada se cambia hasta pulsar "Aplicar".
export default function SincronizarModal({ onClose }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [hecho, setHecho] = useState(null);
  const [dAgenda, setDAgenda] = useState({});   // studentId → { accion, alumnoId }
  const [dAula, setDAula] = useState({});       // alumnoId → "enviar" | "no"
  const [dDif, setDDif] = useState({});         // alumnoId → { campo: "aula"|"agenda"|"nada" }
  const [dClAg, setDClAg] = useState({});       // classId → "emparejar"|"crear"|"ignorar"
  const [dClAu, setDClAu] = useState({});       // claseId → "enviar"|"no"

  useEffect(() => {
    analizarSincronizacion().then(p => {
      setPlan(p);
      const a = {}; p.nuevosAgenda.forEach(n => { a[n.studentId] = n.propuestaId ? { accion: "emparejar", alumnoId: n.propuestaId } : { accion: "ignorar" }; });
      setDAgenda(a);
      const c = {}; p.clasesNuevasAgenda.forEach(x => { c[x.classId] = x.parejaId ? "emparejar" : "ignorar"; });
      setDClAg(c);
    }).catch(e => setError(e.message));
  }, []);

  // Validación: un alumno de AulaIA no puede emparejarse con dos de la Agenda
  const repetidos = useMemo(() => {
    const vistos = {}, rep = new Set();
    Object.values(dAgenda).forEach(v => { if (v.accion === "emparejar" && v.alumnoId) { if (vistos[v.alumnoId]) rep.add(v.alumnoId); vistos[v.alumnoId] = 1; } });
    return rep;
  }, [dAgenda]);
  const emparejadosAula = useMemo(() => new Set(Object.values(dAgenda).filter(v => v.accion === "emparejar").map(v => v.alumnoId)), [dAgenda]);

  const total = !plan ? 0 :
    Object.values(dAgenda).filter(v => v.accion !== "ignorar").length +
    Object.entries(dAula).filter(([id, v]) => v === "enviar" && !emparejadosAula.has(id)).length +
    Object.values(dDif).reduce((n, o) => n + Object.values(o).filter(x => x !== "nada").length, 0) +
    Object.values(dClAg).filter(v => v !== "ignorar").length +
    Object.values(dClAu).filter(v => v === "enviar").length;

  const aplicar = async () => {
    if (repetidos.size) { setError("Has emparejado el mismo alumno de AulaIA con dos alumnos de la Agenda. Revísalo."); return; }
    setAplicando(true); setError("");
    try {
      const aula = Object.fromEntries(Object.entries(dAula).filter(([id]) => !emparejadosAula.has(id)));
      setHecho(await aplicarSincronizacion(plan, { agenda: dAgenda, aula, dif: dDif, clasesAgenda: dClAg, clasesAula: dClAu }));
    } catch (e) { setError(e.message); }
    finally { setAplicando(false); }
  };

  if (hecho) return (
    <Modal titulo="✅ Sincronización hecha" onClose={onClose}>
      <div className="crm-form">
        <p className="crm-aviso">Emparejados: {hecho.emparejados} · Creados en AulaIA: {hecho.creadosAula} · Añadidos a la Agenda: {hecho.enviadosAgenda} · Datos actualizados: {hecho.actualizados}</p>
        <p className="crm-muted">Antes de cambiar nada se guardó una copia de seguridad de tu Agenda. Si algo no te cuadra, puedes restaurarla desde «Ajustes de la Agenda».</p>
        <div className="crm-modal-actions"><span style={{ flex: 1 }} /><button className="library-new-btn" onClick={onClose}>Cerrar</button></div>
      </div>
    </Modal>
  );

  const vacio = plan && !plan.nuevosAgenda.length && !plan.nuevosAula.length && !plan.diferencias.length && !plan.clasesNuevasAgenda.length && !plan.clasesNuevasAula.length;

  return (
    <Modal titulo="⟳ Sincronizar con la Agenda" onClose={aplicando ? () => {} : onClose} ancho={760}>
      <div className="crm-form">
        <p className="crm-aviso">🛡️ Revisa la lista. <strong>No se cambia nada hasta que pulses «Aplicar»</strong>. Antes se guarda una copia de tu Agenda y <strong>nunca se borra nada</strong> en ninguna de las dos aplicaciones.</p>
        {error && <p className="error-msg">{error}</p>}
        {!plan && !error && <div className="crm-loading"><div className="lib-spinner" /></div>}
        {vacio && <p className="crm-muted">Todo está ya igual en las dos aplicaciones. No hay nada que sincronizar.</p>}

        {plan?.nuevosAgenda.length > 0 && (
          <section className="crm-sync-sec">
            <div className="crm-section-head">
              <h3 className="crm-card-title">👥 Alumnos que están en la Agenda ({plan.nuevosAgenda.length})</h3>
              <button className="btn-back-sm" onClick={() => setDAgenda(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.accion === "emparejar" ? v : { accion: "crear" }])))}>Crear en AulaIA los que no tienen pareja</button>
            </div>
            {plan.nuevosAgenda.map(n => {
              const v = dAgenda[n.studentId] || { accion: "ignorar" };
              const valor = v.accion === "emparejar" ? `e:${v.alumnoId}` : v.accion;
              return (
                <div key={n.studentId} className={`crm-sync-fila ${v.accion === "emparejar" && repetidos.has(v.alumnoId) ? "crm-sync-error" : ""}`}>
                  <span><strong>{n.nombre}</strong> <span className="crm-muted">· {n.grupo || "sin grupo"}{n.neae ? " · NEAE" : ""}</span></span>
                  <select className="input-tema crm-select" value={valor} onChange={e => {
                    const x = e.target.value;
                    setDAgenda(p => ({ ...p, [n.studentId]: x.startsWith("e:") ? { accion: "emparejar", alumnoId: x.slice(2) } : { accion: x } }));
                  }}>
                    <option value="ignorar">No hacer nada</option>
                    <option value="crear">➕ Crear en AulaIA</option>
                    {n.opciones.map(o => <option key={o.id} value={`e:${o.id}`}>🔗 Es «{o.nombre}» de AulaIA</option>)}
                  </select>
                </div>
              );
            })}
          </section>
        )}

        {plan?.nuevosAula.length > 0 && (
          <section className="crm-sync-sec">
            <div className="crm-section-head">
              <h3 className="crm-card-title">🧩 Alumnos de AulaIA que no están en la Agenda ({plan.nuevosAula.length})</h3>
              <button className="btn-back-sm" onClick={() => setDAula(Object.fromEntries(plan.nuevosAula.map(n => [n.alumnoId, "enviar"])))}>Marcar todos</button>
            </div>
            {plan.nuevosAula.map(n => (
              <label key={n.alumnoId} className="crm-sync-fila crm-check">
                <input type="checkbox" disabled={emparejadosAula.has(n.alumnoId)} checked={dAula[n.alumnoId] === "enviar" && !emparejadosAula.has(n.alumnoId)}
                  onChange={e => setDAula(p => ({ ...p, [n.alumnoId]: e.target.checked ? "enviar" : "no" }))} />
                <span><strong>{n.nombre}</strong> <span className="crm-muted">· {n.grupo}{emparejadosAula.has(n.alumnoId) ? " · ya emparejado arriba" : " · añadir a la Agenda"}</span></span>
              </label>
            ))}
          </section>
        )}

        {plan?.diferencias.length > 0 && (
          <section className="crm-sync-sec">
            <h3 className="crm-card-title">✏️ Datos distintos en cada aplicación ({plan.diferencias.length})</h3>
            {plan.diferencias.map(df => df.campos.map(c => (
              <div key={df.alumnoId + c.campo} className="crm-sync-fila">
                <span><strong>{df.nombre}</strong> · {c.campo}: <span className="crm-muted">AulaIA «{c.aula}» / Agenda «{c.agenda}»</span></span>
                <select className="input-tema crm-select" value={dDif[df.alumnoId]?.[c.campo] || "nada"}
                  onChange={e => setDDif(p => ({ ...p, [df.alumnoId]: { ...(p[df.alumnoId] || {}), [c.campo]: e.target.value } }))}>
                  <option value="nada">Dejar como está</option>
                  <option value="aula">Usar el de AulaIA</option>
                  <option value="agenda">Usar el de la Agenda</option>
                </select>
              </div>
            )))}
          </section>
        )}

        {(plan?.clasesNuevasAgenda.length > 0 || plan?.clasesNuevasAula.length > 0) && (
          <section className="crm-sync-sec">
            <h3 className="crm-card-title">📚 Asignaturas</h3>
            {plan.clasesNuevasAgenda.map(c => (
              <div key={c.classId} className="crm-sync-fila">
                <span>Agenda: <strong>{c.grupo} · {c.asignatura}</strong></span>
                <select className="input-tema crm-select" value={dClAg[c.classId] || "ignorar"} onChange={e => setDClAg(p => ({ ...p, [c.classId]: e.target.value }))}>
                  <option value="ignorar">No hacer nada</option>
                  {c.parejaId && <option value="emparejar">🔗 Es la misma que en AulaIA</option>}
                  {!c.parejaId && <option value="crear">➕ Crear en AulaIA</option>}
                </select>
              </div>
            ))}
            {plan.clasesNuevasAula.map(c => (
              <label key={c.claseId} className="crm-sync-fila crm-check">
                <input type="checkbox" checked={dClAu[c.claseId] === "enviar"} onChange={e => setDClAu(p => ({ ...p, [c.claseId]: e.target.checked ? "enviar" : "no" }))} />
                <span>AulaIA: <strong>{c.grupo} · {c.asignatura}</strong> <span className="crm-muted">· añadir a la Agenda</span></span>
              </label>
            ))}
          </section>
        )}

        {plan?.desaparecidos.length > 0 && (
          <p className="field-hint">ℹ️ {plan.desaparecidos.length} alumno(s) de AulaIA estaban unidos a alumnos que ya no están en la Agenda ({plan.desaparecidos.map(x => x.nombre).join(", ")}). No se borran; aparecerán para volver a unirlos.</p>
        )}

        <div className="crm-modal-actions">
          <span className="crm-muted">{total} cambio{total === 1 ? "" : "s"} seleccionado{total === 1 ? "" : "s"}</span>
          <span style={{ flex: 1 }} />
          <button className="btn-back" onClick={onClose} disabled={aplicando}>Cancelar</button>
          {plan && !vacio && <button className="library-new-btn" onClick={aplicar} disabled={aplicando || (!total && !plan.diferencias.length)}>{aplicando ? "Guardando copia y aplicando..." : `Aplicar ${total} cambio${total === 1 ? "" : "s"}`}</button>}
        </div>
      </div>
    </Modal>
  );
}
