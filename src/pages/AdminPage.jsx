import { useEffect, useState } from "react";
import { adminUsuarios, adminPonerLimite, leerAjustes, guardarAjustes } from "../lib/equipo";
import { fmtFecha } from "../lib/crm";
import Campo from "../components/Campo";
import { listarCargos, ponerCargo, CARGOS, ETAPAS_SUST } from "../lib/sustituciones";
import { adminCentros, adminGuardarCentro, adminUsuarioCentro } from "../lib/centros";
import CargosTabla from "../components/CargosTabla";

// Solo para la administradora: cuentas, consumo del mes y límites.
export default function AdminPage({ onCargos }) {
  const [lista, setLista] = useState(null);
  const [aj, setAj] = useState(null);
  const [edit, setEdit] = useState({}); // id -> texto del límite
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cargos, setCargos] = useState({}); // user_id -> { cargo, etapa }
  const [centros, setCentros] = useState([]);
  const [centroEdit, setCentroEdit] = useState(null); // null | { id?, nombre, dominio }

  const cargar = async () => {
    listarCargos().then(c => setCargos(Object.fromEntries(c.map(x => [x.user_id, x])))).catch(() => {});
    adminCentros().then(setCentros).catch(() => setCentros([]));
    try { const [l, a] = await Promise.all([adminUsuarios(), leerAjustes()]); setAj(a); setLista(l); }
    catch (e) { setError(e.message); setAj(a => a || { limite_por_defecto: 30, precio_entrada_millon: 0, precio_salida_millon: 0 }); setLista([]); }
  };
  useEffect(() => { cargar(); }, []);

  const coste = (u) => aj ? (u.tokens_entrada_mes * (aj.precio_entrada_millon || 0) + u.tokens_salida_mes * (aj.precio_salida_millon || 0)) / 1e6 : 0;
  const hayPrecios = aj && (Number(aj.precio_entrada_millon) > 0 || Number(aj.precio_salida_millon) > 0);
  const total = (lista || []).reduce((s, u) => s + coste(u), 0);

  const guardarLimite = async (u) => {
    const t = (edit[u.id] ?? "").trim();
    const valor = t === "" ? null : t.toLowerCase().startsWith("sin") ? -1 : parseInt(t, 10);
    if (t !== "" && Number.isNaN(valor)) { setError("Escribe un número, «sin límite» o déjalo vacío para el de por defecto."); return; }
    setError(""); setOk("");
    try { await adminPonerLimite(u.id, valor); setEdit(e => ({ ...e, [u.id]: undefined })); setOk("Límite guardado."); cargar(); }
    catch (e) { setError(e.message); }
  };
  const guardarAj = async (e) => {
    e.preventDefault(); setError(""); setOk("");
    try { await guardarAjustes(aj); setOk("Ajustes guardados."); cargar(); } catch (err) { setError(err.message); }
  };
  const cambiarCargo = async (u, cargo, etapa) => {
    setError(""); setOk("");
    if (cargo && !u.centro_id) { setError(`Asigna primero un centro a ${u.nombre || u.email} (columna «Centro» de arriba).`); return; }
    try { await ponerCargo(u.id, cargo, etapa); setOk(cargo ? `${u.nombre || u.email}: ${CARGOS[cargo]}${cargo === "coordinacion" ? " de " + ETAPAS_SUST.find(e => e.id === (etapa || "pri")).nombre : ""}.` : `${u.nombre || u.email} ya no tiene cargo.`); cargar(); onCargos?.(); }
    catch (e) { setError(e.message); }
  };
  const guardarCentro = async (ev) => {
    ev.preventDefault(); setError(""); setOk("");
    try { await adminGuardarCentro(centroEdit.id, centroEdit.nombre, centroEdit.dominio); setOk(`Centro «${centroEdit.nombre}» guardado.`); setCentroEdit(null); cargar(); }
    catch (e) { setError(e.message); }
  };
  const cambiarCentro = async (u, centroId, adminCentro) => {
    setError(""); setOk("");
    if (centroId !== (u.centro_id || "") && cargos[u.id] && !window.confirm(`${u.nombre || u.email} tiene un cargo en su centro actual. Si la cambias de centro, pierde ese cargo. ¿Seguir?`)) return;
    try { await adminUsuarioCentro(u.id, centroId || null, adminCentro); setOk(`${u.nombre || u.email}: ${centros.find(c => c.id === centroId)?.nombre || "sin centro"}${adminCentro ? " (administra el centro)" : ""}.`); cargar(); onCargos?.(); }
    catch (e) { setError(e.message); }
  };
  const txtLimite = (n) => (n < 0 ? "Sin límite" : n);

  if (!lista || !aj) return <div className="crm-page"><p className="crm-loading">Cargando…</p></div>;
  return (
    <div className="crm-page">
      <h1 className="crm-hello-title">Usuarios y consumo</h1>
      <p className="crm-muted">Solo lo ves tú. Cuenta las generaciones de este mes (se renuevan el día 1). Las continuaciones de un documento cortado no cuentan.</p>

      <form className="card crm-form" onSubmit={guardarAj}>
        <div className="crm-form-row">
          <Campo label="Límite por defecto (generaciones al mes)" hint="Para las cuentas sin límite propio"><input className="input-tema" type="number" min="0" value={aj.limite_por_defecto} onChange={e => setAj({ ...aj, limite_por_defecto: e.target.value })} /></Campo>
          <Campo label="Precio por millón de tokens de entrada" hint="Opcional, para estimar el coste"><input className="input-tema" type="number" step="0.01" min="0" value={aj.precio_entrada_millon} onChange={e => setAj({ ...aj, precio_entrada_millon: e.target.value })} /></Campo>
          <Campo label="Precio por millón de tokens de salida" hint="Lo ves en console.anthropic.com"><input className="input-tema" type="number" step="0.01" min="0" value={aj.precio_salida_millon} onChange={e => setAj({ ...aj, precio_salida_millon: e.target.value })} /></Campo>
        </div>
        <div className="crm-modal-actions"><span style={{ flex: 1 }} /><button type="submit" className="library-new-btn">Guardar ajustes</button></div>
      </form>

      {error && <p className="error-msg">{error}</p>}
      {ok && <p className="crm-aviso">✅ {ok}</p>}

      <div className="crm-table-wrap" style={{ marginTop: 16 }}>
        <table className="crm-table">
          <thead><tr><th>Cuenta</th><th>Centro</th><th>Generaciones este mes</th><th>Tokens (entrada / salida)</th>{hayPrecios && <th>Coste estimado</th>}<th>Último uso</th><th>Límite propio</th><th></th></tr></thead>
          <tbody>
            {lista.map(u => (
              <tr key={u.id}>
                <td><strong>{u.nombre || u.email}</strong>{u.nombre && <div className="crm-muted">{u.email}</div>}{u.rol === "admin" && <div className="crm-muted">Administradora</div>}</td>
                <td>
                  <select className="input-tema crm-select" value={u.centro_id || ""} onChange={e => cambiarCentro(u, e.target.value, u.admin_centro && !!e.target.value)} aria-label={`Centro de ${u.nombre || u.email}`}>
                    <option value="">— Sin centro —</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  {u.centro_id && <label className="crm-muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}><input type="checkbox" checked={!!u.admin_centro} disabled={u.rol === "admin"} onChange={e => cambiarCentro(u, u.centro_id, e.target.checked)} /> Administra el centro</label>}
                </td>
                <td className="crm-nowrap">{u.usados_mes} / {txtLimite(u.limite_efectivo)}</td>
                <td className="crm-nowrap">{Number(u.tokens_entrada_mes).toLocaleString("es-ES")} / {Number(u.tokens_salida_mes).toLocaleString("es-ES")}</td>
                {hayPrecios && <td className="crm-nowrap">{coste(u).toFixed(2)}</td>}
                <td className="crm-nowrap">{u.ultimo_uso ? fmtFecha(u.ultimo_uso) : "—"}</td>
                <td>
                  {u.rol === "admin" ? <span className="crm-muted">Sin límite</span> : (
                    <input className="input-tema" style={{ maxWidth: 140 }} placeholder={u.limite_mensual == null ? "por defecto" : ""}
                      value={edit[u.id] ?? (u.limite_mensual == null ? "" : u.limite_mensual < 0 ? "sin límite" : String(u.limite_mensual))}
                      onChange={e => setEdit({ ...edit, [u.id]: e.target.value })} />
                  )}
                </td>
                <td>{u.rol !== "admin" && edit[u.id] !== undefined && <button className="doc-btn" onClick={() => guardarLimite(u)}>Guardar</button>}</td>
              </tr>
            ))}
          </tbody>
          {hayPrecios && <tfoot><tr><td colSpan={4}><strong>Total estimado del mes</strong></td><td><strong>{total.toFixed(2)}</strong></td><td colSpan={3}></td></tr></tfoot>}
        </table>
      </div>
      <p className="field-hint">En «Límite propio»: un número, «sin límite», o vacío para usar el de por defecto.</p>

      <h2 className="crm-hello-title" style={{ fontSize: 24, marginTop: 24 }}>🏫 Centros</h2>
      <p className="crm-muted">Cada cuenta pertenece a un centro. Las sustituciones y los cargos del equipo directivo de un centro no los ve nadie de otro. Las cuentas cuyo correo termina en el dominio del centro entran en él solas; las demás las asignas tú en la tabla de arriba. Quien «administra el centro» puede dar los cargos del equipo directivo de su colegio.</p>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead><tr><th>Centro</th><th>Dominio del correo</th><th>Cuentas</th><th>Lo administra</th><th></th></tr></thead>
          <tbody>
            {centros.map(c => (
              <tr key={c.id}>
                <td><strong>{c.nombre}</strong></td>
                <td>{c.dominio ? `@${c.dominio}` : <span className="crm-muted">—</span>}</td>
                <td>{c.cuentas}</td>
                <td>{c.admins || <span className="crm-muted">—</span>}</td>
                <td><button className="doc-btn" onClick={() => setCentroEdit({ id: c.id, nombre: c.nombre, dominio: c.dominio })}>✏️ Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {centroEdit ? (
        <form className="card crm-form" style={{ marginTop: 12 }} onSubmit={guardarCentro}>
          <div className="crm-form-row">
            <Campo label="Nombre del centro"><input className="input-tema" value={centroEdit.nombre} onChange={e => setCentroEdit({ ...centroEdit, nombre: e.target.value })} placeholder="Colegio San José" autoFocus /></Campo>
            <Campo label="Dominio del correo (opcional)" hint="Sin @. Las cuentas con ese correo entran solas en el centro."><input className="input-tema" value={centroEdit.dominio} onChange={e => setCentroEdit({ ...centroEdit, dominio: e.target.value.replace(/^@/, "") })} placeholder="colegiosanjose.es" /></Campo>
          </div>
          <div className="crm-modal-actions"><span style={{ flex: 1 }} /><button type="button" className="btn-back" onClick={() => setCentroEdit(null)}>Cancelar</button><button type="submit" className="library-new-btn">Guardar centro</button></div>
        </form>
      ) : <button className="doc-btn" style={{ marginTop: 10 }} onClick={() => setCentroEdit({ nombre: "", dominio: "" })}>＋ Añadir centro</button>}

      <h2 className="crm-hello-title" style={{ fontSize: 24, marginTop: 24 }}>🔒 Equipo directivo · Sustituciones</h2>
      <p className="crm-muted">Solo estas personas verán el apartado «Sustituciones». La coordinación de etapa solo ve su etapa. El resto del profesorado no ve nada: solo recibe su propia sustitución.</p>
      <CargosTabla usuarios={lista} cargos={cargos} onCambiar={cambiarCargo} mostrarCentro />
    </div>
  );
}
