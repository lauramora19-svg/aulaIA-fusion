import { useEffect, useState } from "react";
import { miPerfil, guardarPerfil } from "../lib/equipo";
import { COMUNIDADES } from "../lib/datos";
import Campo from "../components/Campo";

// Mi perfil docente: se rellena una vez. Completa los huecos de los
// especialistas ({docente}, {centro}, {comunidad}...). Solo lo ve esta cuenta.
export default function PerfilPage() {
  const [p, setP] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { miPerfil().then(setP).catch(e => setError(e.message)); }, []);
  if (!p) return <div className="crm-page"><p className="crm-loading">Cargando…</p></div>;
  const set = (k) => (e) => { setOk(false); setP({ ...p, [k]: e.target.value }); };
  const guardar = async (e) => {
    e.preventDefault(); setGuardando(true); setError("");
    try { await guardarPerfil(p); setOk(true); } catch (err) { setError(err.message); } finally { setGuardando(false); }
  };
  const comunidades = (COMUNIDADES || []).map(c => (typeof c === "string" ? c : c.label || c.nombre || c.id));
  return (
    <div className="crm-page">
      <h1 className="crm-hello-title">Mi perfil docente</h1>
      <p className="crm-muted">Se rellena una vez. Los especialistas del equipo son iguales para todas las cuentas; estos datos (y tus grupos) son los que hacen que trabajen para ti. Solo los ve tu cuenta.{p.rol === "admin" ? " · Tu cuenta es la administradora." : ""}</p>
      <form className="crm-form" onSubmit={guardar} style={{ maxWidth: 560 }}>
        <Campo label="Nombre" hint="Cómo te nombran los especialistas ({docente})"><input className="input-tema" value={p.nombre || ""} onChange={set("nombre")} /></Campo>
        <Campo label="Centro" hint="{centro}"><input className="input-tema" value={p.centro || ""} onChange={set("centro")} /></Campo>
        <Campo label="Comunidad autónoma" hint="{comunidad}: decide el currículo de referencia">
          <select className="input-tema" value={p.comunidad || ""} onChange={set("comunidad")}>
            <option value="">— Elige —</option>
            {comunidades.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo label="Etapa y curso" hint="{etapa}, p. ej. «1.º de Primaria»"><input className="input-tema" value={p.etapa || ""} onChange={set("etapa")} /></Campo>
        <Campo label="Áreas que impartes" hint="{areas}"><input className="input-tema" value={p.areas || ""} onChange={set("areas")} /></Campo>
        <p className="field-hint">El alumnado no se escribe aquí: sale de tus grupos, con iniciales.</p>
        {error && <p className="error-msg">{error}</p>}
        {ok && <p className="crm-aviso">✅ Guardado.</p>}
        <div className="crm-modal-actions"><span style={{ flex: 1 }} /><button type="submit" className="library-new-btn" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button></div>
      </form>
    </div>
  );
}
