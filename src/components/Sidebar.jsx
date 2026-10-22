// Barra lateral de AulaIA (versión fusionada con la Agenda).
// Usa las clases de botón ya existentes (navbar-link, doc-btn): no cambian.
export default function Sidebar({ esAdmin, esAdminCentro, esDirectivo, view, seccion, clases, claseActivaId, abierta, onCerrar, onGo, onNuevo, onNuevaClase, onConectarAgenda }) {
  const activo = (id, extra) => (id === "ag" ? view === "ag" && seccion === extra.seccion : view === id && !extra.claseId);
  const item = (id, emoji, label, extra = {}, accion) => (
    <button
      key={id + (extra.seccion || "")}
      className={`navbar-link ${activo(id, extra) ? "navbar-link-active" : ""}`}
      onClick={() => { accion ? accion() : onGo(id, extra); onCerrar?.(); }}
    >{emoji} {label}</button>
  );
  const ag = (seccion, emoji, label) => item("ag", emoji, label, { seccion });

  return (
    <>
      {abierta && <div className="crm-side-backdrop" onClick={onCerrar} />}
      <aside className={`crm-side ${abierta ? "crm-side-open" : ""}`}>
        <p className="crm-side-title">Mi día</p>
        <nav className="crm-side-nav">
          {item("inicio", "🏠", "Inicio")}
          {ag("horario", "🗓️", "Horario semanal")}
          {ag("anual", "📆", "Vista anual")}
          {item("agenda", "📅", "Calendario")}
          {item("ausencia", "📨", "Comunicar mi ausencia")}
        </nav>

        <p className="crm-side-title">Mis clases</p>
        <nav className="crm-side-nav">
          {clases.length === 0 && <p className="crm-side-empty">Aún no hay clases</p>}
          {clases.map(c => (
            <button
              key={c.id}
              className={`navbar-link ${view === "clase" && claseActivaId === c.id ? "navbar-link-active" : ""}`}
              onClick={() => { onGo("clase", { claseId: c.id }); onCerrar?.(); }}
              title={`${c.nombre}${c.area ? " · " + c.area : ""}`}
            >
              <span className="crm-dot" style={{ background: c.color || "#f97316" }} />
              <span className="crm-ellipsis">{c.grupo_nombre || c.nombre}{c.area ? ` · ${c.area}` : ""}</span>
            </button>
          ))}
        </nav>

        <p className="crm-side-title">Mi aula</p>
        <nav className="crm-side-nav">
          {ag("clases", "🪑", "Plano de aula")}
          {ag("alumnado", "🧒", "Alumnado y NEAE")}
          {ag("listados", "✅", "Listados del grupo")}
          {ag("mensajes", "💬", "Mensajes a familias")}
        </nav>

        <p className="crm-side-title">Con IA</p>
        <nav className="crm-side-nav">
          {item("equipo", "🧑‍🏫", "Equipo docente IA")}
          {item("generator", "✨", "Crear con IA", {}, onNuevo)}
          {item("library", "📂", "Mi biblioteca")}
          {item("modelos", "📋", "Modelos del colegio")}
        </nav>

        {esDirectivo && <>
          <p className="crm-side-title">🔒 Dirección</p>
          <nav className="crm-side-nav">
            {item("sust", "🔁", "Sustituciones")}
          </nav>
        </>}

        <div className="crm-side-footer">
          <nav className="crm-side-nav">{ag("sustitucion", "🗂️", "Carpeta de sustitución")}{item("perfil", "👤", "Mi perfil docente")}{esAdmin && item("admin", "📊", "Usuarios y consumo")}{esAdminCentro && !esAdmin && item("centro", "🏫", "Mi centro")}</nav>
          <button className="doc-btn" onClick={() => { onNuevaClase(); onCerrar?.(); }}>＋ Nueva clase</button>
          <div className="crm-agenda-estado">
            <button className="btn-back-sm" onClick={() => { onConectarAgenda(); onCerrar?.(); }}>⚙️ Mi Agenda: datos y copias</button>
          </div>
        </div>
      </aside>
    </>
  );
}
