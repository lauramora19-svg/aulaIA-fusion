import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtFecha, mensajeError } from "../lib/crm";
import EmptyState from "../components/EmptyState";
import Campo from "../components/Campo";
import { textoDeDocx } from "../lib/docx";

const TIPOS = { informe: "📊 Informe de alumno", acta: "📋 Acta de evaluación / grupo", otro: "📄 Otro" };
const MAX_MB = 15;

export default function ModelosPage() {
  const [lista, setLista] = useState(null);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("informe");
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  const cargar = async () => {
    const { data, error } = await supabase.from("plantillas").select("*").order("created_at", { ascending: false });
    if (error) setError(mensajeError(error));
    setLista(data || []);
  };
  useEffect(() => { cargar(); }, []);

  const elegir = (f) => {
    if (!f) return;
    setError("");
    if (f.size > MAX_MB * 1024 * 1024) { setError(`El archivo pesa más de ${MAX_MB} MB.`); return; }
    if (/\.doc$/i.test(f.name)) { setError("Los .doc antiguos no se pueden leer. Ábrelo en Word y guárdalo como .docx o PDF."); return; }
    setArchivo(f);
    if (!nombre) setNombre(f.name.replace(/\.[^.]+$/, ""));
  };

  const subir = async () => {
    if (!archivo) { setError("Elige un archivo."); return; }
    if (!nombre.trim()) { setError("Ponle un nombre al modelo."); return; }
    setSubiendo(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const esDocx = /\.docx$/i.test(archivo.name);
      const limpio = archivo.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
      const path = `${user.id}/${Date.now()}-${limpio}`;
      const mime = esDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : (archivo.type || "application/pdf");
      const up = await supabase.storage.from("modelos").upload(path, archivo, { contentType: mime });
      if (up.error) throw up.error;
      const texto = esDocx ? await textoDeDocx(archivo) : null;
      const { error } = await supabase.from("plantillas").insert({ nombre: nombre.trim(), tipo, archivo_path: path, mime, texto });
      if (error) throw error;
      setNombre(""); setArchivo(null); if (input.current) input.current.value = "";
      cargar();
    } catch (e) { setError(mensajeError(e)); }
    finally { setSubiendo(false); }
  };

  const ver = async (p) => {
    const { data } = await supabase.storage.from("modelos").createSignedUrl(p.archivo_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const borrar = async (p) => {
    if (!window.confirm(`¿Eliminar el modelo «${p.nombre}»?`)) return;
    await supabase.storage.from("modelos").remove([p.archivo_path]);
    await supabase.from("plantillas").delete().eq("id", p.id);
    cargar();
  };

  return (
    <div className="crm-page">
      <div className="library-header">
        <div>
          <h1 className="library-title">Modelos del colegio</h1>
          <p className="library-sub">Sube tus actas de evaluación o modelos de informe (PDF —también escaneado—, Word o foto). La IA los rellenará respetando su formato.</p>
        </div>
      </div>

      <section className="card crm-form">
        <h2 className="crm-card-title">⬆️ Subir un modelo</h2>
        <div className="crm-form-row">
          <Campo label="Archivo (PDF, Word .docx, JPG o PNG)">
            <input ref={input} className="input-tema" type="file" accept=".pdf,.docx,image/jpeg,image/png" onChange={e => elegir(e.target.files?.[0])} />
          </Campo>
          <Campo label="Nombre">
            <input className="input-tema" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Acta de evaluación 1.er trimestre" maxLength={100} />
          </Campo>
        </div>
        <Campo label="¿Para qué se usa?">
          <div className="chips-grid">
            {Object.entries(TIPOS).map(([id, l]) => <button key={id} type="button" className={`chip chip-small ${tipo === id ? "chip-active" : ""}`} onClick={() => setTipo(id)}><span className="chip-label">{l}</span></button>)}
          </div>
        </Campo>
        {error && <p className="error-msg">{error}</p>}
        <div className="crm-modal-actions">
          <span className="field-hint">🔒 Usa modelos en blanco, sin datos de alumnos.</span>
          <span style={{ flex: 1 }} />
          <button className="library-new-btn" onClick={subir} disabled={subiendo || !archivo}>{subiendo ? "Subiendo..." : "Guardar modelo"}</button>
        </div>
      </section>

      {lista === null ? <div className="crm-loading"><div className="lib-spinner" /></div> :
        lista.length === 0 ? <EmptyState icono="📋" texto="Aún no has subido ningún modelo." /> : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Modelo</th><th>Uso</th><th>Formato</th><th>Subido</th><th></th></tr></thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong></td>
                    <td>{TIPOS[p.tipo] || p.tipo}</td>
                    <td className="crm-muted">{p.texto ? "Word" : (p.mime || "").startsWith("image/") ? "Imagen" : "PDF"}</td>
                    <td className="crm-nowrap">{fmtFecha(p.created_at, { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="crm-nowrap">
                      <button className="doc-btn" onClick={() => ver(p)}>👁️ Ver</button>{" "}
                      <button className="doc-btn doc-btn-del" onClick={() => borrar(p)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <p className="field-hint">Cómo usarlos: en una clase → «☰ Acciones» → «📋 Rellenar modelo del colegio»; o en la ficha de un alumno → «📊 Generar informe» eligiendo el modelo.</p>
    </div>
  );
}
