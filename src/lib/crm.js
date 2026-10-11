// Utilidades del módulo CRM (clases, alumnado, agenda)
export const TIPOS_EVENTO = {
  sesion:          { label: "Sesión de clase",      emoji: "📚", color: "#f97316" },
  reunion_familia: { label: "Reunión con familia",  emoji: "👨‍👩‍👧", color: "#6366f1" },
  coordinacion:    { label: "Coordinación",         emoji: "🤝", color: "#0d9488" },
  revision_aci:    { label: "Revisión ACI / PTI",   emoji: "✏️", color: "#f59e0b" },
  otro:            { label: "Otro",                 emoji: "📌", color: "#78716c" },
};

export const ESTADOS_DOC = {
  borrador: { label: "Borrador", color: "#78716c" },
  revisado: { label: "Revisado", color: "#6366f1" },
  aplicado: { label: "Aplicado", color: "#0d9488" },
};

export const TIPOS_SEGUIMIENTO = {
  observacion: { label: "Observación", emoji: "👀", color: "#6366f1" },
  logro:       { label: "Logro",       emoji: "🌟", color: "#0d9488" },
  dificultad:  { label: "Dificultad",  emoji: "🧗", color: "#f97316" },
};

export const MODO_BADGE = {
  nee:       { label: "NEE",       color: "#2dd4bf" },
  ordinario: { label: "Ordinario", color: "#818cf8" },
  mixto:     { label: "Mixto",     color: "#fbbf24" },
  informe:   { label: "Informe",   color: "#f97316" },
};

// Trimestres del curso escolar que contiene la fecha dada
export const trimestres = (ref = new Date()) => {
  const y = ref.getMonth() >= 8 ? ref.getFullYear() : ref.getFullYear() - 1; // el curso empieza en septiembre
  return [
    { id: 1, label: "1.er trimestre", desde: new Date(y, 8, 1),  hasta: new Date(y, 10, 30, 23, 59) },
    { id: 2, label: "2.º trimestre",  desde: new Date(y, 11, 1), hasta: new Date(y + 1, 2, 31, 23, 59) },
    { id: 3, label: "3.er trimestre", desde: new Date(y + 1, 3, 1), hasta: new Date(y + 1, 5, 30, 23, 59) },
  ];
};
export const trimestreActual = (ref = new Date()) =>
  trimestres(ref).find(t => ref >= t.desde && ref <= t.hasta)?.id || 1;

export const saludo = () => {
  const h = new Date().getHours();
  return h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
};

export const fmtFecha = (iso, opts = { day: "2-digit", month: "short" }) =>
  iso ? new Date(iso).toLocaleDateString("es-ES", opts) : "";
export const fmtHora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";

export const inicioSemana = (d) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const dia = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - dia);
  return x;
};
export const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Convierte Date -> valor para <input type="datetime-local">
export const toLocalInput = (d) => {
  const x = new Date(d); const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

// Mensaje claro si aún no se ha ejecutado el SQL del CRM
export const mensajeError = (error) => {
  if (!error) return "";
  const m = `${error.message || ""} ${error.code || ""}`;
  if (/does not exist|42P01|PGRST205|schema cache/i.test(m))
    return "Falta preparar la base de datos: ejecuta el archivo scripts/supabase-crm.sql en Supabase (SQL Editor).";
  return "No se ha podido completar la acción. Inténtalo de nuevo.";
};

// ── Nombre y apellidos ──────────────────────────────────────────────────────
export const nombreCompleto = (a) => [a?.nombre, a?.apellidos].filter(Boolean).join(" ").trim();

// "Paula A. D." → { nombre: "Paula", apellidos: "A. D." } · "López García, Ana" → { nombre: "Ana", apellidos: "López García" }
export const partirNombre = (full = "") => {
  const t = full.trim().replace(/\s+/g, " ");
  if (t.includes(",")) { const [ap, no] = t.split(",").map(x => x.trim()); return { nombre: no || ap, apellidos: no ? ap : "" }; }
  const i = t.indexOf(" ");
  return i < 0 ? { nombre: t, apellidos: "" } : { nombre: t.slice(0, i), apellidos: t.slice(i + 1) };
};

// Solo letras, sin tildes ni puntos: "Ávila D." → "AVILAD"
const letras = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-zÑñ]/g, "").toUpperCase();

// Orden alfabético por apellido (letra a letra: 1.ª, 2.ª...); si coinciden, por orden de creación.
export const ordenarAlumnos = (lista = []) => [...lista].sort((a, b) => {
  const ka = letras(a.apellidos) || letras(a.nombre);
  const kb = letras(b.apellidos) || letras(b.nombre);
  const c = ka.localeCompare(kb, "es");
  if (c !== 0) return c;
  return new Date(a.created_at || 0) - new Date(b.created_at || 0);
});

// Asignatura de AulaIA → asignatura del horario de la Agenda docente
export const AREA_A_AGENDA = (area = "") => {
  const a = area.toLowerCase();
  if (a.includes("educación física")) return "EF";
  if (a.includes("matem")) return "MATES";
  if (a.includes("lengua") || a.includes("comunicación")) return "LENGUA";
  if (a.includes("natural") || a.includes("biolog") || a.includes("física") || a.includes("química")) return "CIENCIAS";
  if (a.includes("social") || a.includes("historia") || a.includes("geograf") || a.includes("entorno")) return "SOCIALES";
  if (a.includes("inglés")) return "INGLES";
  if (a.includes("música")) return "MUSICA";
  if (a.includes("plástica") || a.includes("arte")) return "ARTISTICA";
  if (a.includes("religión")) return "RELIGION";
  if (a.includes("tutoría") || a.includes("valores")) return "TUTORIA";
  return null;
};
