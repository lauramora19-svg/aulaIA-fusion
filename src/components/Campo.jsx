// Etiqueta + campo de formulario, reutilizando los estilos de input existentes (input-tema / textarea)
export default function Campo({ label, children, hint }) {
  return (
    <label className="crm-campo">
      <span className="crm-campo-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
