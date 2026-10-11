import AgendaVista from "../components/AgendaVista";

export default function AgendaPage({ clases, onAbrirDoc }) {
  return (
    <div className="crm-page">
      <div className="library-header">
        <div>
          <h1 className="library-title">Agenda</h1>
          <p className="library-sub">Sesiones, reuniones con familias, coordinaciones y revisiones de todas tus clases. Si conectas tu Agenda docente, aquí verás también lo que planifiques allí.</p>
        </div>
      </div>
      <AgendaVista clases={clases} onAbrirDoc={onAbrirDoc} />
    </div>
  );
}
