import { useEffect, useState } from "react";
import { centroUsuarios } from "../lib/centros";
import { listarCargos, ponerCargo, CARGOS, ETAPAS_SUST } from "../lib/sustituciones";
import CargosTabla from "../components/CargosTabla";

// Para quien administra un centro: las cuentas de su colegio y los cargos
// del equipo directivo (quién gestiona las sustituciones).
export default function CentroPage({ centro, onCargos }) {
  const [usuarios, setUsuarios] = useState(null);
  const [cargos, setCargos] = useState({});
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const cargar = async () => {
    try {
      const [u, c] = await Promise.all([centroUsuarios(), listarCargos()]);
      setUsuarios(u); setCargos(Object.fromEntries(c.map(x => [x.user_id, x])));
    } catch (e) { setError(e.message); setUsuarios([]); }
  };
  useEffect(() => { cargar(); }, []);

  const cambiarCargo = async (u, cargo, etapa) => {
    setError(""); setOk("");
    try {
      await ponerCargo(u.id, cargo, etapa);
      setOk(cargo ? `${u.nombre || u.email}: ${CARGOS[cargo]}${cargo === "coordinacion" ? " de " + ETAPAS_SUST.find(e => e.id === (etapa || "pri")).nombre : ""}.` : `${u.nombre || u.email} ya no tiene cargo.`);
      cargar(); onCargos?.();
    } catch (e) { setError(e.message); }
  };

  if (!usuarios) return <div className="crm-page"><p className="crm-loading">Cargando…</p></div>;
  return (
    <div className="crm-page">
      <h1 className="crm-hello-title">🏫 {centro || "Mi centro"}</h1>
      <p className="crm-muted">Estas son las cuentas de tu colegio en AulaIA. Aquí decides quién forma parte del equipo directivo y verá el apartado «Sustituciones». Nadie de otro colegio ve estos datos.</p>
      {error && <p className="error-msg">{error}</p>}
      {ok && <p className="crm-aviso">✅ {ok}</p>}
      {usuarios.length === 0
        ? <p className="crm-muted">Todavía no hay cuentas en tu centro.</p>
        : <CargosTabla usuarios={usuarios} cargos={cargos} onCambiar={cambiarCargo} />}
      <p className="field-hint">Las cuentas nuevas de tu colegio aparecen aquí cuando se registran con el correo del centro. Si falta alguien, pídeselo a la administradora de AulaIA.</p>
    </div>
  );
}
