// Asistencia del alumnado por clase y día. Solo se guardan las faltas, los retrasos
// y las faltas justificadas; quien no aparece, estuvo presente.
import { supabase } from "./supabase";
import { leerAgenda, sesionesAgenda, ASIGNATURAS_AGENDA, estadoAgenda } from "./agenda";
import { AREA_A_AGENDA } from "./crm";
import { tokenActual } from "./equipo";
import { leerStreamSSE } from "./stream";

export const ESTADOS_ASIST = {
  presente:    { label: "Presente",   corto: "P", color: "#16a34a" },
  falta:       { label: "Falta",      corto: "F", color: "#dc2626" },
  retraso:     { label: "Retraso",    corto: "R", color: "#d97706" },
  justificada: { label: "Justificada", corto: "J", color: "#6366f1" },
};

const chk = ({ data, error }) => { if (error) throw new Error(error.message || "No se ha podido guardar."); return data; };
const dos = (n) => String(n).padStart(2, "0");
export const isoDia = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const fechaLargaAsist = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export async function cargarAsistencia(claseId, fecha) {
  const [dia, regs] = await Promise.all([
    supabase.from("asistencia_dias").select("id").eq("clase_id", claseId).eq("fecha", fecha).maybeSingle(),
    supabase.from("asistencia").select("*").eq("clase_id", claseId).eq("fecha", fecha),
  ]);
  if (regs.error) throw new Error(regs.error.message);
  return { pasada: !!dia.data, registros: Object.fromEntries((regs.data || []).map(r => [r.alumno_id, r])) };
}

// marcas: { alumno_id: "presente" | "falta" | "retraso" | "justificada" }, notas: { alumno_id: "..." }
export async function guardarAsistencia(claseId, fecha, marcas, notas = {}) {
  chk(await supabase.from("asistencia_dias").upsert({ clase_id: claseId, fecha }, { onConflict: "clase_id,fecha" }));
  const ausentes = Object.entries(marcas).filter(([, e]) => e && e !== "presente");
  const presentes = Object.entries(marcas).filter(([, e]) => !e || e === "presente").map(([id]) => id);
  if (presentes.length) chk(await supabase.from("asistencia").delete().eq("clase_id", claseId).eq("fecha", fecha).in("alumno_id", presentes));
  if (ausentes.length) chk(await supabase.from("asistencia").upsert(
    ausentes.map(([alumno_id, estado]) => ({ clase_id: claseId, alumno_id, fecha, estado, nota: (notas[alumno_id] || "").slice(0, 300) })),
    { onConflict: "clase_id,alumno_id,fecha" }));
  return cargarAsistencia(claseId, fecha);
}

// Resumen desde una fecha: { alumno_id: { falta, retraso, justificada } } y nº de días con lista
export async function resumenAsistencia(claseId, desde) {
  const [regs, dias] = await Promise.all([
    supabase.from("asistencia").select("alumno_id, estado, fecha").eq("clase_id", claseId).gte("fecha", desde),
    supabase.from("asistencia_dias").select("fecha", { count: "exact", head: true }).eq("clase_id", claseId).gte("fecha", desde),
  ]);
  const por = {};
  (regs.data || []).forEach(r => { por[r.alumno_id] = por[r.alumno_id] || { falta: 0, retraso: 0, justificada: 0, fechas: [] }; por[r.alumno_id][r.estado]++; por[r.alumno_id].fechas.push(r.fecha); });
  return { por, dias: dias.count || 0 };
}

export async function marcarComunicado(registroId) {
  if (registroId) chk(await supabase.from("asistencia").update({ comunicado_at: new Date().toISOString() }).eq("id", registroId));
}

const norm = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Lo que se trabajó ese día con el grupo, sacado de la programación de aula:
// sesiones del Horario semanal (Agenda) y documentos programados en ese día.
// ambito: "dia" (todas las asignaturas del grupo) | "asignatura" (solo esta clase)
export async function tareasDelDia(clase, clases, fecha, ambito = "dia") {
  const desde = new Date(`${fecha}T00:00:00`), hasta = new Date(`${fecha}T23:59:59`);
  const grupo = norm(clase.grupo_nombre || clase.nombre);
  const asignaturaClase = ASIGNATURAS_AGENDA[AREA_A_AGENDA(clase.area || "")] || "";
  const out = [];

  // 1) Horario semanal de la Agenda
  if (estadoAgenda().conectada !== false) {
    try {
      const st = await leerAgenda();
      sesionesAgenda(st, desde, hasta)
        .filter(s => !s.grupo || norm(s.grupo) === grupo)
        .filter(s => ambito === "dia" || !asignaturaClase || s.asignatura === asignaturaClase)
        .forEach(s => out.push({ hora: new Date(s.inicio).toTimeString().slice(0, 5), asignatura: s.asignatura, titulo: s.titulo, notas: s.notas || "", programacion_id: s.programacion_id }));
    } catch { /* sin Agenda */ }
  }

  // 2) Documentos programados ese día desde AulaIA
  const ids = ambito === "dia" ? clases.filter(c => c.grupo_id && c.grupo_id === clase.grupo_id).map(c => c.id) : [clase.id];
  if (!ids.includes(clase.id)) ids.push(clase.id);
  const { data: ev } = await supabase.from("agenda_eventos").select("titulo, inicio, notas, programacion_id, clase_id")
    .in("clase_id", ids).gte("inicio", desde.toISOString()).lte("inicio", hasta.toISOString()).order("inicio");
  (ev || []).forEach(e => {
    if (out.some(o => o.programacion_id && o.programacion_id === e.programacion_id)) return;
    out.push({ hora: new Date(e.inicio).toTimeString().slice(0, 5), asignatura: clases.find(c => c.id === e.clase_id)?.area || "", titulo: e.titulo, notas: e.notas || "", programacion_id: e.programacion_id });
  });

  // 3) Contenido de los documentos enlazados (resumido)
  const docIds = [...new Set(out.map(o => o.programacion_id).filter(Boolean))];
  if (docIds.length) {
    const { data: docs } = await supabase.from("programaciones").select("id, titulo, contenido").in("id", docIds);
    (docs || []).forEach(d => out.filter(o => o.programacion_id === d.id).forEach(o => { o.documento = d.titulo; o.contenido = (d.contenido || "").slice(0, 2500); }));
  }
  return out.sort((a, b) => a.hora.localeCompare(b.hora));
}

export const tareasComoTexto = (tareas) => tareas.map(t =>
  `• ${t.hora} · ${t.asignatura || "Clase"} · ${t.titulo}${t.notas ? `\n  Notas: ${t.notas}` : ""}${t.contenido ? `\n  Del documento «${t.documento}»:\n  ${t.contenido.replace(/\n+/g, "\n  ")}` : ""}`
).join("\n\n");

// ── Redactar con un especialista del Equipo docente (Carmen) ─────────────────
const FIRMAS = /\n*-{3,}\s*\n*(✅ Documento completo generado por AulaIA|⚠️[^\n]*)\s*$/;
export const sinFirma = (t = "") => t.replace(FIRMAS, "").trim();

export async function redactarConEspecialista(especialistaId, encargo, { onTexto, signal, grupoTexto = "", contextoEncargo = "" } = {}) {
  const r = await fetch("/api/generar", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ promptOverride: encargo, especialistaId, grupoTexto, contextoEncargo, accessToken: await tokenActual(), tipoResultado: "comunicado", modo: "ordinario", idioma: "Castellano" }),
  });
  if (r.status === 429) throw new Error("Has llegado al límite de generaciones de este mes.");
  if (!r.ok) throw new Error("No se ha podido redactar. Inténtalo de nuevo.");
  let full = "";
  await leerStreamSSE(r, (d) => { full += d; onTexto?.(full); }, signal);
  return sinFirma(full);
}

// Abre Gmail (la cuenta indicada) con el correo ya escrito
export function urlGmail({ para = [], asunto = "", cuerpo = "", cuenta = "" }) {
  const p = new URLSearchParams({ view: "cm", fs: "1" });
  if (para.length) p.set("to", para.join(","));
  if (asunto) p.set("su", asunto);
  if (cuerpo) p.set("body", cuerpo.slice(0, 6000));
  if (cuenta) p.set("authuser", cuenta);
  return `https://mail.google.com/mail/?${p.toString()}`;
}

// Texto plano para el cuerpo de un correo (sin marcas de Markdown)
export const textoPlano = (md = "") => md
  .replace(/^#{1,6}\s*/gm, "")
  .replace(/\*\*([^*]+)\*\*/g, "$1")
  .replace(/^\s*[-*]\s+/gm, "• ")
  .replace(/^\|?\s*-{2,}.*$/gm, "")
  .replace(/\|/g, "  ")
  .replace(/\n{3,}/g, "\n\n").trim();
