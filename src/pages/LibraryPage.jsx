import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import TituloEditable from "../components/TituloEditable";

const TIPO_LABELS = {
  actividades:"Actividades adaptadas", programacion:"Programación didáctica",
  aci:"Adaptación curricular", dua:"DUA", pti:"Plan Individual",
  recursos:"Recursos", situacion:"Situación de aprendizaje",
  rubrica:"Rúbrica", familias:"Comunicación familias",
  mixto_situacion:"Situación inclusiva", mixto_programacion:"Programación inclusiva",
  mixto_actividades:"Actividades dos niveles", mixto_dua:"DUA inclusivo",
  mixto_rubrica:"Rúbrica multinivel", mixto_plan:"Plan de inclusión",
};

const MODO_BADGE = {
  nee:      { label:"NEE",      color:"#2dd4bf" },
  ordinario:{ label:"Ordinario",color:"#818cf8" },
  mixto:    { label:"Mixto",    color:"#fbbf24" },
};

export default function LibraryPage({ onOpen, onNew }) {
  const [docs, setDocs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]  = useState("");
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("programaciones")
      .select("id, titulo, modo, tipo_resultado, comunidad, curso, area, created_at, compartido")
      .order("created_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta programación?")) return;
    setDeleting(id);
    await supabase.from("programaciones").delete().eq("id", id);
    setDocs(prev => prev.filter(d => d.id !== id));
    setDeleting(null);
  };

  const handleShare = async (doc) => {
    const shareUrl = `${window.location.origin}/compartido/${doc.id}`;
    if (!doc.compartido) {
      await supabase.from("programaciones").update({ compartido: true }).eq("id", doc.id);
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, compartido: true } : d));
    }
    await navigator.clipboard.writeText(shareUrl);
    alert("¡Enlace copiado! Cualquier persona con el enlace podrá ver este documento.");
  };

  const filtered = docs.filter(d =>
    !search ||
    d.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    d.area?.toLowerCase().includes(search.toLowerCase()) ||
    d.curso?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso) => new Date(iso).toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" });

  return (
    <div className="library">
      <div className="library-header">
        <div>
          <h1 className="library-title">Mi biblioteca</h1>
          <p className="library-sub">Tus programaciones guardadas</p>
        </div>
        <button className="library-new-btn" onClick={onNew}>✨ Nueva programación</button>
      </div>

      {docs.length > 4 && (
        <input
          className="library-search"
          placeholder="🔍 Buscar por área, curso, título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {loading ? (
        <div className="library-empty">
          <div className="lib-spinner" />
          <p>Cargando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="library-empty">
          <span className="library-empty-icon">📂</span>
          <p>{search ? "No se encontraron resultados." : "Aún no tienes programaciones guardadas."}</p>
          {!search && <button className="library-new-btn" onClick={onNew}>Crear la primera</button>}
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map(doc => {
            const badge = MODO_BADGE[doc.modo] || MODO_BADGE.ordinario;
            return (
              <div key={doc.id} className="doc-card" onClick={() => onOpen(doc.id)}>
                <div className="doc-card-top">
                  <span className="doc-badge" style={{ color: badge.color, borderColor: badge.color, background: `${badge.color}18` }}>
                    {badge.label}
                  </span>
                  {doc.compartido && <span className="doc-shared-icon" title="Compartido">🔗</span>}
                </div>
                <TituloEditable className="doc-title" docId={doc.id} titulo={doc.titulo || `${TIPO_LABELS[doc.tipo_resultado] || doc.tipo_resultado}`} onGuardado={(t) => setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, titulo: t } : d))} />
                <p className="doc-meta">{[doc.curso, doc.area, doc.comunidad].filter(Boolean).join(" · ")}</p>
                <p className="doc-date">{formatDate(doc.created_at)}</p>
                <div className="doc-actions" onClick={e => e.stopPropagation()}>
                  <button className="doc-btn" onClick={() => handleShare(doc)} title="Copiar enlace para compartir">🔗 Compartir</button>
                  <button className="doc-btn doc-btn-del" onClick={() => handleDelete(doc.id)} disabled={deleting === doc.id} title="Eliminar">
                    {deleting === doc.id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
