import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { saludo, fmtFecha, fmtHora, sumarDias, TIPOS_EVENTO } from "../lib/crm";

export default function HomePage({ session, clases, cargandoClases, errorClases, onAbrirClase, onNuevaClase, onAgenda }) {
  const [stats, setStats] = useState({});
  const [eventos, setEventos] = useState([]);
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

  useEffect(() => {
    const desde = new Date(); desde.setHours(0, 0, 0, 0);
    supabase.from("agenda_eventos").select("*")
      .gte("inicio", desde.toISOString()).lt("inicio", sumarDias(desde, 7).toISOString())
      .order("inicio").limit(8)
      .then(({ data }) => setEventos(data || []));
  }, []);

  return (
    <div className="crm-page">
      <header className="crm-hello">
        <h1 className="crm-hello-title"><span className="title-accent">{saludo()}</span><br />{nombre}!</h1>
        <p className="library-sub">Tus clases, tu alumnado y tu agenda en un solo lugar.</p>
      </header>

      {errorClases && <p className="error-msg">{errorClases}</p>}

      <h2 className="crm-section-title">Mis clases</h2>
      {cargandoClases ? <div className="crm-loading"><div className="lib-spinner" /></div> : (
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
                {c && <span className="crm-evento-meta">{c.nombre}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
