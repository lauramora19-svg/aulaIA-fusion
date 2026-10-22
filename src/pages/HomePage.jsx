import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { saludo, fmtFecha, fmtHora, sumarDias, TIPOS_EVENTO } from "../lib/crm";
import { estadoAgenda, leerAgenda, sesionesAgenda, suscribirAgenda } from "../lib/agenda";

export default function HomePage({ session, clases, cargandoClases, errorClases, onAbrirClase, onNuevaClase, onAgenda }) {
  const [stats, setStats] = useState({});
  const [eventos, setEventos] = useState([]);
  // Cómo ver las clases: agrupadas por grupo (Infantil/Primaria) o una tarjeta por asignatura (ESO/Bach.)
  const [vista, setVista] = useState(() => { try { return localStorage.getItem("aulaia-inicio-vista") || "grupo"; } catch { return "grupo"; } });
  const cambiarVista = (v) => { setVista(v); try { localStorage.setItem("aulaia-inicio-vista", v); } catch {} };
  const grupos = [];
  clases.forEach(c => { const k = c.grupo_id || c.nombre; let g = grupos.find(x => x.k === k); if (!g) grupos.push(g = { k, clases: [] }); g.clases.push(c); });
  const nombre = session?.user?.user_metadata?.full_name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "";

  useEffect(() => {
    if (!clases.length) return;
    (async () => {
      const ids = clases.map(c => c.id);
      const gids = [...new Set(clases.map(c => c.grupo_id).filter(Boolean))];
      const { data: al } = gids.length ? await supabase.from("alumnos").select("grupo_id, tiene_nee").in("grupo_id", gids) : { data: [] };
      const { data: docs } = await supabase.from("programaciones").select("clase_id").in("clase_id", ids);
      const s = {};
      ids.forEach(id => { s[id] = { alumnos: 0, nee: 0, docs: 0 }; });
      clases.forEach(c => (al || []).forEach(a => { if (a.grupo_id === c.grupo_id) { s[c.id].alumnos++; if (a.tiene_nee) s[c.id].nee++; } }));
      (docs || []).forEach(d => { if (s[d.clase_id]) s[d.clase_id].docs++; });
      setStats(s);
    })();
  }, [clases]);

  // Lo del Calendario de AulaIA y, además, las sesiones planificadas en el Horario semanal (Agenda)
  const [conectada, setConectada] = useState(estadoAgenda().conectada);
  useEffect(() => suscribirAgenda(e => setConectada(e.conectada)), []);
  useEffect(() => {
    (async () => {
      const desde = new Date(); desde.setHours(0, 0, 0, 0);
      const hasta = sumarDias(desde, 7);
      const { data } = await supabase.from("agenda_eventos").select("*")
        .gte("inicio", desde.toISOString()).lt("inicio", hasta.toISOString()).order("inicio");
      let lista = data || [];
      if (conectada) {
        try {
          const st = await leerAgenda();
          const yaEstan = new Set(lista.filter(e => e.agenda_ref).map(e => `${e.agenda_ref.week}-${e.agenda_ref.key}`));
          const ag = sesionesAgenda(st, desde, hasta).filter(e => !yaEstan.has(`${e.ref.week}-${e.ref.key}`));
          lista = [...lista, ...ag].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
        } catch { /* sin Agenda */ }
      }
      setEventos(lista.slice(0, 12));
    })();
  }, [conectada]);

  return (
    <div className="crm-page">
      <header className="crm-hello">
        <h1 className="crm-hello-title">Inicio</h1>
        <p className="library-sub"><span className="title-accent">{saludo()}</span> {nombre}! Tus clases, tu alumnado y tu agenda en un solo lugar.</p>
      </header>

      {errorClases && <p className="error-msg">{errorClases}</p>}

      <div className="crm-section-head">
        <h2 className="crm-section-title">Mis clases</h2>
        <div className="chips-grid" role="tablist" aria-label="Cómo ver las clases">
          <button role="tab" aria-selected={vista === "grupo"} className={`chip chip-small ${vista === "grupo" ? "chip-active" : ""}`} onClick={() => cambiarVista("grupo")}><span className="chip-label">👥 Por grupo</span></button>
          <button role="tab" aria-selected={vista === "asignatura"} className={`chip chip-small ${vista === "asignatura" ? "chip-active" : ""}`} onClick={() => cambiarVista("asignatura")}><span className="chip-label">📚 Por asignatura</span></button>
        </div>
      </div>
      {cargandoClases ? <div className="crm-loading"><div className="lib-spinner" /></div> : vista === "grupo" ? (
        <div className="crm-clases-grid">
          {grupos.map(g => {
            const c0 = g.clases[0]; const s = stats[c0.id] || {};
            const docs = g.clases.reduce((n, c) => n + ((stats[c.id] || {}).docs || 0), 0);
            return (
              <div key={g.k} className="doc-card crm-clase-card" onClick={() => onAbrirClase(c0.id)} style={{ borderTopColor: c0.color || "#f97316" }}>
                <p className="crm-clase-area" style={{ color: c0.color || "#f97316" }}>{g.clases.length} {g.clases.length === 1 ? "asignatura" : "asignaturas"}</p>
                <h3 className="crm-clase-nombre">{c0.curso ? `${c0.curso} · ` : ""}{c0.grupo_nombre || c0.nombre}</h3>
                <div className="chips-grid" style={{ margin: "6px 0 10px" }}>
                  {g.clases.map(c => (
                    <button key={c.id} className="chip chip-small" onClick={(e) => { e.stopPropagation(); onAbrirClase(c.id); }} title={`Abrir ${c.area || "la asignatura"}`}>
                      <span className="crm-dot" style={{ background: c.color || "#f97316" }} /><span className="chip-label">{c.area || "Sin área"}</span>
                    </button>
                  ))}
                </div>
                <div className="crm-clase-stats">
                  <span><i className="crm-dot" style={{ background: "#0d9488" }} />{s.alumnos ?? 0} alumnos</span>
                  <span><i className="crm-dot" style={{ background: "#f59e0b" }} />{s.nee ?? 0} NEE</span>
                  <span><i className="crm-dot" style={{ background: "#6366f1" }} />{docs} documentos</span>
                </div>
              </div>
            );
          })}
          <div className="doc-card crm-clase-nueva" onClick={onNuevaClase} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onNuevaClase()}>
            <span className="crm-plus">＋</span>
            <h3 className="crm-clase-nombre">Crear nueva clase</h3>
            <p className="doc-meta">Añade un grupo con su alumnado</p>
          </div>
        </div>
      ) : (
        <div className="crm-clases-grid">
          {clases.map(c => {
            const s = stats[c.id] || {};
            return (
              <div key={c.id} className="doc-card crm-clase-card" onClick={() => onAbrirClase(c.id)} style={{ borderTopColor: c.color || "#f97316" }}>
                <p className="crm-clase-area" style={{ color: c.color || "#f97316" }}>{c.area || "Sin área"}</p>
                <h3 className="crm-clase-nombre">{c.curso ? `${c.curso} · ` : ""}{c.nombre}</h3>
                <div className="crm-clase-stats">
                  <span><i className="crm-dot" style={{ background: "#0d9488" }} />{s.alumnos ?? 0} alumnos</span>
                  <span><i className="crm-dot" style={{ background: "#f59e0b" }} />{s.nee ?? 0} NEE</span>
                  <span><i className="crm-dot" style={{ background: "#6366f1" }} />{s.docs ?? 0} documentos</span>
                </div>
              </div>
            );
          })}
          <div className="doc-card crm-clase-nueva" onClick={onNuevaClase} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onNuevaClase()}>
            <span className="crm-plus">＋</span>
            <h3 className="crm-clase-nombre">Crear nueva clase</h3>
            <p className="doc-meta">Añade un grupo con su alumnado</p>
          </div>
        </div>
      )}

      <div className="crm-section-head">
        <h2 className="crm-section-title">Próximos 7 días</h2>
        <button className="doc-btn" onClick={onAgenda}>Ver agenda →</button>
      </div>
      {eventos.length === 0 ? (
        <p className="crm-muted">No tienes eventos esta semana.</p>
      ) : (
        <div className="crm-lista-eventos">
          {eventos.map(ev => {
            const t = TIPOS_EVENTO[ev.tipo] || TIPOS_EVENTO.otro;
            const c = clases.find(x => x.id === ev.clase_id);
            return (
              <div key={ev.id} className="crm-evento" style={{ borderLeftColor: t.color }} onClick={onAgenda}>
                <span className="crm-evento-hora">{fmtFecha(ev.inicio, { weekday: "short", day: "2-digit", month: "short" })} · {fmtHora(ev.inicio)}</span>
                <span className="crm-evento-titulo">{t.emoji} {ev.titulo}</span>
                {ev.origen === "agenda"
                  ? <span className="crm-evento-meta">🗓️ {[ev.grupo, ev.asignatura].filter(Boolean).join(" · ") || "Horario semanal"}</span>
                  : c && <span className="crm-evento-meta">{c.nombre}{c.area ? ` · ${c.area}` : ""}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
