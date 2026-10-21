import { CARGOS, ETAPAS_SUST } from "../lib/sustituciones";

// Tabla para dar o quitar cargos del equipo directivo (sustituciones).
export default function CargosTabla({ usuarios, cargos, onCambiar, mostrarCentro = false }) {
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead><tr><th>Cuenta</th>{mostrarCentro && <th>Centro</th>}<th>Cargo</th><th>Etapa</th></tr></thead>
        <tbody>
          {usuarios.map(u => {
            const c = cargos[u.id];
            return (
              <tr key={u.id}>
                <td><strong>{u.nombre || u.email}</strong>{u.nombre && <div className="crm-muted">{u.email}</div>}</td>
                {mostrarCentro && <td>{u.centro_nombre || <span className="crm-muted">Sin centro</span>}</td>}
                <td>{u.rol === "admin" ? <span className="crm-muted">Administradora (lo ve todo en su centro)</span> : (
                  <select className="input-tema crm-select" value={c?.cargo || ""} onChange={e => onCambiar(u, e.target.value, c?.etapa)} aria-label={`Cargo de ${u.nombre || u.email}`}>
                    <option value="">— Sin cargo (profesorado) —</option>
                    {Object.entries(CARGOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                )}</td>
                <td>{c?.cargo === "coordinacion" ? (
                  <select className="input-tema crm-select" value={c.etapa || "pri"} onChange={e => onCambiar(u, "coordinacion", e.target.value)} aria-label="Etapa que coordina">
                    {ETAPAS_SUST.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                ) : c?.cargo ? <span className="crm-muted">Todas</span> : <span className="crm-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
