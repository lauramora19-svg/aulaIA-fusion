import { useEffect, useState } from "react";
import { listarCopias, restaurarCopia, agendaViejaSesion, entrarAgendaVieja, previsualizarAgendaVieja, importarAgendaVieja } from "../lib/agenda";
import SincronizarModal from "./SincronizarModal";
import Modal from "./Modal";
import Campo from "./Campo";

// Ajustes de «Mi Agenda» en la versión fusionada:
// 1) Traer (copiar) los datos de la Agenda antigua — allí no se toca nada.
// 2) Sincronizar alumnado y asignaturas (revisando cada cambio).
// 3) Copias de seguridad.
export default function AgendaConexionModal({ onClose }) {
  const [vieja, setVieja] = useState(undefined); // undefined = cargando, null = sin sesión
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(null);
  const [sync, setSync] = useState(false);
  const [copias, setCopias] = useState(null);

  const cargarVieja = async () => {
    try { setVieja((await agendaViejaSesion()) ? await previsualizarAgendaVieja() : null); }
    catch (e) { setVieja(null); setError(e.message); }
  };
  useEffect(() => { cargarVieja(); }, []);

  const entrar = async (e) => {
    e?.preventDefault();
    setCargando(true); setError("");
    try { await entrarAgendaVieja(email.trim(), password); setPassword(""); await cargarVieja(); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  };

  const copiar = async () => {
    const aviso = vieja.aquiVacia
      ? "Se copiarán aquí los datos de tu Agenda antigua. La Agenda antigua no se modifica. ¿Continuar?"
      : "Ya tienes datos de Agenda en AulaIA. Se sustituirán por los de la Agenda antigua (antes se guarda una copia de seguridad de lo que hay aquí, que puedes restaurar). La Agenda antigua no se modifica. ¿Continuar?";
    if (!window.confirm(aviso)) return;
    setCargando(true); setError(""); setHecho(null);
    try {
      const r = await importarAgendaVieja(setProgreso);
      setHecho(r);
      window.dispatchEvent(new Event("aulaia-agenda-recargar"));
      await cargarVieja();
    } catch (err) { setError(err.message); }
    finally { setCargando(false); setProgreso(""); }
  };

  const verCopias = async () => setCopias(await listarCopias());
  const restaurar = async (c) => {
    if (!window.confirm(`¿Restaurar tu Agenda tal como estaba el ${new Date(c.created_at).toLocaleString("es-ES")}? Antes se guarda una copia de cómo está ahora.`)) return;
    setCargando(true); setError("");
    try { await restaurarCopia(c.id); window.dispatchEvent(new Event("aulaia-agenda-recargar")); alert("Agenda restaurada."); verCopias(); }
    catch (err) { setError(err.message); } finally { setCargando(false); }
  };

  const Fila = ({ t, a, b }) => <tr><td>{t}</td><td style={{ textAlign: "center" }}>{a}</td><td style={{ textAlign: "center" }}>{b}</td></tr>;

  return (
    <Modal titulo="📅 Mi Agenda" onClose={onClose}>
      <div className="crm-form">
        <p className="crm-muted">Tu Agenda ya forma parte de AulaIA y usa tu misma cuenta. Aquí puedes traer los datos de la Agenda antigua, sincronizar el alumnado y ver las copias de seguridad.</p>

        <h3 className="crm-h3">1 · Traer mis datos de la Agenda antigua</h3>
        {vieja === undefined && <p className="crm-muted">Comprobando…</p>}
        {vieja === null && (
          <form onSubmit={entrar} className="crm-form">
            <p className="crm-muted">Entra con el <strong>correo y la contraseña de tu Agenda antigua</strong> (aula-ai-agenda.vercel.app). Solo se leen tus datos para copiarlos: allí no se cambia nada.</p>
            <Campo label="Correo de la Agenda antigua"><input className="input-tema" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></Campo>
            <Campo label="Contraseña de la Agenda antigua"><input className="input-tema" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></Campo>
            <div className="crm-modal-actions">
              <span style={{ flex: 1 }} />
              <button type="submit" className="library-new-btn" disabled={cargando}>{cargando ? "Entrando..." : "Entrar y ver mis datos"}</button>
            </div>
          </form>
        )}
        {vieja && (
          <>
            <p className="crm-muted">Agenda antigua de <strong>{vieja.email}</strong>{vieja.actualizada ? ` · último cambio ${new Date(vieja.actualizada).toLocaleString("es-ES")}` : ""}</p>
            <table className="crm-table">
              <thead><tr><th></th><th>Agenda antigua</th><th>Ahora en AulaIA</th></tr></thead>
              <tbody>
                <Fila t="Alumnado" a={vieja.vieja.alumnos} b={vieja.aqui.alumnos} />
                <Fila t="Clases" a={vieja.vieja.clases} b={vieja.aqui.clases} />
                <Fila t="Horas del horario" a={vieja.vieja.horas} b={vieja.aqui.horas} />
                <Fila t="Semanas con sesiones" a={vieja.vieja.semanas} b={vieja.aqui.semanas} />
                <Fila t="Listados" a={vieja.vieja.listados} b={vieja.aqui.listados} />
                <Fila t="Documentos subidos" a={vieja.vieja.documentos} b={vieja.aqui.documentos} />
              </tbody>
            </table>
            <div className="crm-modal-actions">
              <span style={{ flex: 1 }} />
              <button className="library-new-btn" onClick={copiar} disabled={cargando}>{cargando ? (progreso || "Copiando...") : "Copiar a AulaIA"}</button>
            </div>
          </>
        )}
        {hecho && <p className="crm-aviso">✅ Copiado: {hecho.alumnos} alumnos y {hecho.clases} clases{hecho.copiados ? ` · ${hecho.copiados} documento(s)` : ""}.{hecho.fallidos ? ` ${hecho.fallidos} documento(s) no se pudieron copiar; siguen en la Agenda antigua.` : ""}</p>}

        <h3 className="crm-h3">2 · Alumnado y asignaturas</h3>
        <p className="crm-muted">Une el alumnado de la Agenda con el de tus clases de AulaIA. Antes de aplicar nada ves cada cambio, y nunca se borra nada.</p>
        <div><button className="library-new-btn" onClick={() => setSync(true)}>⟳ Sincronizar alumnado y asignaturas…</button></div>

        <h3 className="crm-h3">3 · Copias de seguridad</h3>
        <div>
          <button className="btn-back-sm" onClick={verCopias}>🛡️ Ver copias de seguridad de la Agenda</button>
          {copias && (copias.length === 0 ? <p className="crm-muted">Aún no hay copias.</p> : (
            <div className="crm-doc-list" style={{ marginTop: 8 }}>
              {copias.map(c => (
                <div key={c.id} className="crm-doc-item">
                  <span className="crm-ellipsis">{new Date(c.created_at).toLocaleString("es-ES")} · {c.motivo}</span>
                  <button className="doc-btn" onClick={() => restaurar(c)} disabled={cargando}>Restaurar</button>
                </div>
              ))}
            </div>
          ))}
        </div>
        {error && <p className="error-msg">{error}</p>}
      </div>
      {sync && <SincronizarModal onClose={() => setSync(false)} />}
    </Modal>
  );
}
