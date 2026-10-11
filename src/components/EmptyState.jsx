export default function EmptyState({ icono = "📂", texto, accion, onAccion }) {
  return (
    <div className="crm-empty">
      <span className="library-empty-icon">{icono}</span>
      <p>{texto}</p>
      {accion && <button className="library-new-btn" onClick={onAccion}>{accion}</button>}
    </div>
  );
}
