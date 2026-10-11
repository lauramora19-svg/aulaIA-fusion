import { useEffect, useState } from "react";
import { miPerfil, guardarPerfil, miUsoMes } from "../lib/equipo";
import { COMUNIDADES } from "../lib/datos";
import Campo from "../components/Campo";

// Mi perfil docente: se rellena una vez. Completa los huecos de los
// especialistas ({docente}, {centro}, {comunidad}...). Solo lo ve esta cuenta.
export default function PerfilPage() {
  const [p, setP] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  const [uso, setUso] = useState(null);
  useEffect(() => { miPerfil().then(setP).catch(e => setError(e.message)); miUsoMes().then(setUso).catch(() => {}); }, []);
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
      {uso && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 16 }}>
          <p className="crm-card-title">Tu uso de la IA este mes</p>
          {uso.limite < 0 ? <p className="crm-muted">{uso.usados} generaciones · sin límite</p> : (
            <>
              <p className="crm-muted">{uso.usados} de {uso.limite} generaciones · se renueva el día 1</p>
              <div style={{ height: 8, borderRadius: 99, background: "var(--border-soft)", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (uso.usados / Math.max(1, uso.limite)) * 100)}%`, height: "100%", background: uso.usados >= uso.limite ? "#dc2626" : "var(--orange)" }} />
              </div>
            </>
          )}
        </div>
      )}
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
