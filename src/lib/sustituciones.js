// Gestor de sustituciones: datos, propuestas de sustituto e importación de horarios.
// Solo lo usa el equipo directivo (la base de datos lo impide al resto).
import { supabase } from "./supabase";

export const ETAPAS_SUST = [
  { id: "inf", nombre: "Infantil", largo: "Educación Infantil", color: [190, 24, 93], hex: "#be185d" },
  { id: "pri", nombre: "Primaria", largo: "Educación Primaria", color: [194, 65, 12], hex: "#c2410c" },
  { id: "sec", nombre: "Secundaria y Bachillerato", largo: "Secundaria y Bachillerato", color: [29, 78, 216], hex: "#1d4ed8" },
];
export const etapaDe = (id) => ETAPAS_SUST.find(e => e.id === id) || ETAPAS_SUST[1];

export const TIPOS_HORA = {
  clase: { label: "Clase", emoji: "📘" },
  guardia: { label: "Guardia", emoji: "🛡️" },
  refuerzo: { label: "Refuerzo", emoji: "🤝" },
  libre: { label: "Libre", emoji: "☕" },
  patio: { label: "Patio", emoji: "🌳" },
};
export const ORDEN_TIPOS = ["clase", "guardia", "refuerzo", "libre"];

export const CARGOS = {
  direccion: "Dirección general / titular",
  pedagogica: "Dirección pedagógica",
  jefatura: "Jefatura de estudios",
  coordinacion: "Coordinación de etapa",
};

// Tramos de ejemplo para empezar (se pueden cambiar)
export const TRAMOS_EJEMPLO = {
  inf: [["9:00", "10:00"], ["10:00", "11:00"], ["11:00", "11:30", true], ["11:30", "12:30"], ["12:30", "13:00"], ["15:00", "16:30"]],
  pri: [["9:00", "9:45"], ["9:45", "10:30"], ["10:30", "11:00", true], ["11:00", "11:45"], ["11:45", "12:30"], ["12:30", "13:15"], ["15:00", "15:45"], ["15:45", "16:30"]],
  sec: [["8:00", "8:55"], ["8:55", "9:50"], ["9:50", "10:45"], ["10:45", "11:15", true], ["11:15", "12:10"], ["12:10", "13:05"], ["13:05", "14:00"], ["14:00", "14:30"]],
};

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// ── Fechas ────────────────────────────────────────────────────────────────
const dos = (n) => String(n).padStart(2, "0");
export const isoLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const hoyISO = () => isoLocal(new Date());
export const fechaDe = (iso) => new Date(iso + "T12:00:00");
export const diaSemana = (iso) => { const d = fechaDe(iso).getDay(); return d === 0 ? 7 : d; }; // 1 = lunes
export const fechaLarga = (iso) => fechaDe(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fechaCorta = (iso) => fechaDe(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
export function diasLectivos(desde, hasta) {
  const out = []; const d = fechaDe(desde); const fin = fechaDe(hasta);
  for (let i = 0; d <= fin && i < 60; i++) { const w = d.getDay(); if (w >= 1 && w <= 5) out.push(isoLocal(d)); d.setDate(d.getDate() + 1); }
  return out;
}
export const horaTramo = (t) => (t ? `${t.inicio}–${t.fin}` : "");
const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const normHora = (s) => { const m = String(s || "").match(/(\d{1,2})[:.h](\d{2})/); return m ? `${parseInt(m[1], 10)}:${m[2]}` : ""; };

const chk = ({ data, error }) => { if (error) throw error; return data; };

// ── Permisos ──────────────────────────────────────────────────────────────
export async function misEtapasSust() {
  const { data, error } = await supabase.rpc("sust_etapas");
  if (error) return [];
  return Array.isArray(data) ? data : [];
}
export async function listarCargos() {
  const { data } = await supabase.from("centro_cargos").select("*");
  return data || [];
}
export async function ponerCargo(userId, cargo, etapa) {
  if (!cargo) return chk(await supabase.from("centro_cargos").delete().eq("user_id", userId));
  chk(await supabase.from("centro_cargos").upsert({ user_id: userId, cargo, etapa: cargo === "coordinacion" ? (etapa || "pri") : null, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
}

// ── Tramos ────────────────────────────────────────────────────────────────
export async function listarTramos(etapa) {
  const { data } = await supabase.from("sust_tramos").select("*").eq("etapa", etapa).order("orden");
  return data || [];
}
export async function crearTramosEjemplo(etapa) {
  const filas = TRAMOS_EJEMPLO[etapa].map(([inicio, fin, recreo], i) => ({ etapa, orden: i + 1, inicio, fin, recreo: !!recreo }));
  chk(await supabase.from("sust_tramos").insert(filas));
}
export async function guardarTramo(t) {
  const fila = { etapa: t.etapa, orden: Number(t.orden) || 0, inicio: normHora(t.inicio) || t.inicio, fin: normHora(t.fin) || t.fin, recreo: !!t.recreo };
  if (t.id) chk(await supabase.from("sust_tramos").update(fila).eq("id", t.id));
  else chk(await supabase.from("sust_tramos").insert(fila));
}
export async function borrarTramo(id) { chk(await supabase.from("sust_tramos").delete().eq("id", id)); }
// Etiqueta corta del tramo: «1.ª», «2.ª»… o «Recreo»
export function etiquetasTramos(tramos) {
  let n = 0; const out = {};
  tramos.forEach(t => { out[t.id] = t.recreo ? "Recreo" : `${++n}.ª`; });
  return out;
}

// ── Profesorado ───────────────────────────────────────────────────────────
export async function listarProfesores() {
  const { data } = await supabase.from("sust_profesores").select("*").order("nombre");
  return data || [];
}
export async function guardarProfesor(p) {
  const fila = { nombre: p.nombre.trim(), email: (p.email || "").trim().toLowerCase() || null, etapas: p.etapas?.length ? p.etapas : ["pri"], activo: p.activo !== false };
  if (p.id) { chk(await supabase.from("sust_profesores").update(fila).eq("id", p.id)); return p.id; }
  const d = chk(await supabase.from("sust_profesores").insert(fila).select("id").single());
  return d.id;
}
export async function borrarProfesor(id) { chk(await supabase.from("sust_profesores").delete().eq("id", id)); }
export async function cuentasAulaIA(emails) {
  const lista = emails.filter(Boolean);
  if (!lista.length) return new Set();
  const { data } = await supabase.rpc("sust_cuentas", { p_emails: lista });
  return new Set((data || []).map(x => (typeof x === "string" ? x : Object.values(x)[0])));
}

// ── Horario ───────────────────────────────────────────────────────────────
export async function listarHorario(etapa, filtro = {}) {
  let q = supabase.from("sust_horario").select("*").eq("etapa", etapa);
  if (filtro.dia) q = q.eq("dia", filtro.dia);
  if (filtro.profesorId) q = q.eq("profesor_id", filtro.profesorId);
  const { data } = await q;
  return data || [];
}
export async function guardarCelda(c) {
  if (!c.tipo) return chk(await supabase.from("sust_horario").delete().eq("profesor_id", c.profesor_id).eq("tramo_id", c.tramo_id).eq("dia", c.dia));
  chk(await supabase.from("sust_horario").upsert({
    profesor_id: c.profesor_id, tramo_id: c.tramo_id, etapa: c.etapa, dia: c.dia, tipo: c.tipo,
    grupo: c.grupo || "", materia: c.materia || "", aula: c.aula || "",
  }, { onConflict: "profesor_id,tramo_id,dia" }));
}
export async function guardarCeldas(celdas) {
  const filas = celdas.map(c => ({ profesor_id: c.profesor_id, tramo_id: c.tramo_id, etapa: c.etapa, dia: c.dia, tipo: c.tipo, grupo: c.grupo || "", materia: c.materia || "", aula: c.aula || "" }));
  for (let i = 0; i < filas.length; i += 400) chk(await supabase.from("sust_horario").upsert(filas.slice(i, i + 400), { onConflict: "profesor_id,tramo_id,dia" }));
}

// ── Contexto de un día (para proponer sustitutos) ─────────────────────────
export async function cargarDia(etapa, fecha) {
  const dia = diaSemana(fecha);
  const mes0 = fecha.slice(0, 8) + "01";
  const [tramos, profesores, horarioDia, asig, aus, mes] = await Promise.all([
    listarTramos(etapa),
    listarProfesores(),
    dia <= 5 ? listarHorario(etapa, { dia }) : Promise.resolve([]),
    supabase.from("sust_asignaciones").select("*, sust_ausencias(indicaciones)").eq("etapa", etapa).eq("fecha", fecha).order("orden"),
    supabase.from("sust_ausencias").select("*").lte("desde", fecha).gte("hasta", fecha),
    supabase.from("sust_asignaciones").select("sustituto_id, estado, fecha").eq("etapa", etapa).gte("fecha", mes0).lte("fecha", fecha.slice(0, 8) + "31"),
  ]);
  const conteo = {};
  (mes.data || []).forEach(a => { if (a.sustituto_id && a.estado !== "pendiente") conteo[a.sustituto_id] = (conteo[a.sustituto_id] || 0) + 1; });
  const ausencias = aus.data || [];
  return {
    etapa, fecha, dia, tramos, horarioDia, conteo, ausencias,
    profesores: profesores.filter(p => (p.etapas || []).includes(etapa) && p.activo !== false),
    todosProfesores: profesores,
    ausentesIds: new Set(ausencias.map(a => a.profesor_id)),
    asignaciones: asig.data || [],
  };
}

// Candidatos para cubrir una hora: guardia → refuerzo → libre, y quien menos lleva este mes
export function candidatos(ctx, a) {
  const tramo = ctx.tramos.find(t => t.id === a.tramo_id);
  const ocupados = new Set(ctx.asignaciones.filter(x => x.id !== a.id && x.tramo_id === a.tramo_id && x.sustituto_id).map(x => x.sustituto_id));
  const filas = ctx.horarioDia.filter(h => h.tramo_id === a.tramo_id);
  const porProf = {}; filas.forEach(h => { porProf[h.profesor_id] = h.tipo; });
  const libreDe = (p) => !ctx.ausentesIds.has(p.id) && !ocupados.has(p.id) && p.id !== a.ausente_id;
  const prio = { guardia: 0, refuerzo: 1, libre: 2 };
  let lista;
  if (tramo?.recreo) {
    lista = ctx.profesores.filter(p => libreDe(p) && porProf[p.id] !== "patio" && porProf[p.id] !== "clase")
      .map(p => ({ id: p.id, nombre: p.nombre, tipo: porProf[p.id] === "guardia" ? "guardia" : "libre" }));
  } else {
    lista = ctx.profesores.filter(p => libreDe(p) && porProf[p.id] in prio)
      .map(p => ({ id: p.id, nombre: p.nombre, tipo: porProf[p.id] }));
  }
  // Reparto justo: cuenta lo que lleva este mes y lo que ya tiene asignado hoy
  const hoy = {}; ctx.asignaciones.forEach(x => { if (x.id !== a.id && x.sustituto_id) hoy[x.sustituto_id] = (hoy[x.sustituto_id] || 0) + 1; });
  lista.forEach(c => { c.n = ctx.conteo[c.id] || 0; c.hoy = hoy[c.id] || 0; });
  lista.sort((x, y) => (prio[x.tipo] ?? 3) - (prio[y.tipo] ?? 3) || (x.n + x.hoy) - (y.n + y.hoy) || x.nombre.localeCompare(y.nombre));
  const ids = new Set(lista.map(c => c.id));
  const otros = ctx.profesores.filter(p => !ids.has(p.id) && p.id !== a.ausente_id && !ctx.ausentesIds.has(p.id))
    .map(p => ({ id: p.id, nombre: p.nombre, tipo: porProf[p.id] || "", n: ctx.conteo[p.id] || 0, hoy: hoy[p.id] || 0, ocupado: true }));
  return { lista, otros };
}

// ── Ausencias ─────────────────────────────────────────────────────────────
// Sesiones del profesor ausente en un día (de todas las etapas que gestionas)
export async function sesionesDe(profesor, fecha, etapasPermitidas) {
  const dia = diaSemana(fecha);
  if (dia > 5) return [];
  const out = [];
  for (const etapa of (profesor.etapas || []).filter(e => etapasPermitidas.includes(e))) {
    const [tramos, filas] = await Promise.all([listarTramos(etapa), listarHorario(etapa, { dia, profesorId: profesor.id })]);
    filas.filter(h => h.tipo === "clase" || h.tipo === "patio").forEach(h => {
      const t = tramos.find(x => x.id === h.tramo_id);
      if (t) out.push({ ...h, etapa, tramo: t, hora: horaTramo(t), orden: t.orden });
    });
  }
  return out.sort((a, b) => a.tramo.inicio.localeCompare(b.tramo.inicio, "es", { numeric: true }));
}

export async function registrarAusencia({ profesor, desde, hasta, indicaciones, tramosElegidos, etapasPermitidas }) {
  const ausencia = chk(await supabase.from("sust_ausencias").insert({ profesor_id: profesor.id, desde, hasta: hasta || desde, indicaciones: indicaciones || "" }).select("*").single());
  let creadas = 0;
  for (const fecha of diasLectivos(desde, hasta || desde)) {
    const sesiones = (await sesionesDe(profesor, fecha, etapasPermitidas)).filter(s => !tramosElegidos || tramosElegidos.has(s.tramo_id));
    const porEtapa = {};
    sesiones.forEach(s => { (porEtapa[s.etapa] = porEtapa[s.etapa] || []).push(s); });
    for (const [etapa, lista] of Object.entries(porEtapa)) {
      const ctx = await cargarDia(etapa, fecha);
      for (const s of lista) {
        const a = { id: null, tramo_id: s.tramo_id, ausente_id: profesor.id };
        const { lista: cands } = candidatos(ctx, a);
        const elegido = cands[0];
        const fila = {
          ausencia_id: ausencia.id, etapa, fecha, tramo_id: s.tramo_id, orden: s.orden, hora: s.hora,
          grupo: s.tipo === "patio" ? "Patio" : s.grupo, materia: s.tipo === "patio" ? "Vigilancia de patio" : s.materia, aula: s.aula,
          ausente_id: profesor.id, sustituto_id: elegido?.id || null, tipo_sustituto: elegido?.tipo || "", estado: "pendiente",
        };
        const nueva = chk(await supabase.from("sust_asignaciones").insert(fila).select("*").single());
        ctx.asignaciones.push(nueva);
        creadas++;
      }
    }
  }
  return { ausencia, creadas };
}
export async function borrarAusencia(id) { chk(await supabase.from("sust_ausencias").delete().eq("id", id)); }

// ── Asignaciones y avisos ─────────────────────────────────────────────────
export async function cambiarSustituto(a, cand) {
  await supabase.from("sust_avisos").delete().eq("asignacion_id", a.id);
  chk(await supabase.from("sust_asignaciones").update({ sustituto_id: cand?.id || null, tipo_sustituto: cand?.tipo || "", estado: "pendiente", enviada_at: null, enterado_at: null }).eq("id", a.id));
}
export async function ponerEstado(ids, estado) {
  if (!ids.length) return;
  chk(await supabase.from("sust_asignaciones").update({ estado }).in("id", ids));
}
export async function guardarObservaciones(id, observaciones) {
  chk(await supabase.from("sust_asignaciones").update({ observaciones }).eq("id", id));
}
export const planDe = (a) => [a.sust_ausencias?.indicaciones, a.observaciones].filter(x => x && x.trim()).join("\n\n");

export async function enviarAviso(a, sustituto) {
  if (!sustituto?.email) throw new Error(`Falta el correo de ${sustituto?.nombre || "este profesor"}. Añádelo en Profesorado.`);
  const aviso = {
    asignacion_id: a.id, etapa: a.etapa, email: sustituto.email.toLowerCase(), nombre: sustituto.nombre, fecha: a.fecha,
    hora: a.hora, grupo: a.grupo, materia: a.materia, aula: a.aula, plan: planDe(a), observaciones: "", enterado_at: null,
  };
  const guardado = chk(await supabase.from("sust_avisos").upsert(aviso, { onConflict: "asignacion_id" }).select("*").single());
  chk(await supabase.from("sust_asignaciones").update({ estado: "enviada", enviada_at: new Date().toISOString() }).eq("id", a.id));
  return guardado;
}

// Correo automático (solo si el servicio de correo está configurado en Vercel)
export async function enviarCorreo(aviso, pdfBase64) {
  try {
    const r = await fetch("/api/sust-enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId: aviso.id, pdfBase64 }) });
    const j = await r.json().catch(() => ({}));
    return !!j.enviado;
  } catch { return false; }
}

// Avisos del profesor conectado (solo los suyos, aunque sea directivo)
export async function misAvisos(email) {
  if (!email) return [];
  const { data } = await supabase.from("sust_avisos").select("*").ilike("email", email).gte("fecha", hoyISO()).order("fecha").order("hora");
  return (data || []).filter(a => a.email.toLowerCase() === email.toLowerCase());
}
export async function marcarEnterado(id) { chk(await supabase.rpc("sust_enterado", { p_id: id })); }

// ── Historial ─────────────────────────────────────────────────────────────
export async function historialMes(etapa, mes /* YYYY-MM */) {
  const { data } = await supabase.from("sust_asignaciones").select("fecha, sustituto_id, estado, ausente_id, enterado_at").eq("etapa", etapa).gte("fecha", mes + "-01").lte("fecha", mes + "-31").order("fecha", { ascending: false });
  return data || [];
}

// ── Importar Excel ────────────────────────────────────────────────────────
const COLS = {
  profesor: ["profesor", "profesora", "profesor/a", "docente", "nombre"],
  email: ["email", "correo", "e-mail", "mail"],
  dia: ["dia", "día"],
  tramo: ["tramo", "hora", "sesion", "sesión", "franja"],
  tipo: ["tipo"],
  grupo: ["grupo", "curso", "clase"],
  materia: ["materia", "area", "área", "asignatura"],
  aula: ["aula", "espacio", "lugar"],
};
const parseDia = (v) => {
  const s = norm(v);
  if (/^[1-5]$/.test(s)) return Number(s);
  const i = ["l", "m", "x", "j", "v"].indexOf(s);
  if (i >= 0) return i + 1;
  const j = ["lun", "mar", "mie", "jue", "vie"].findIndex(p => s.startsWith(p));
  return j >= 0 ? j + 1 : 0;
};
export const parseTipo = (v, grupo) => {
  const s = norm(v);
  if (s.startsWith("guar")) return "guardia";
  if (s.startsWith("ref") || s.startsWith("apo")) return "refuerzo";
  if (s.startsWith("lib")) return "libre";
  if (s.startsWith("pat") || s.startsWith("recr") || s.startsWith("vigil")) return "patio";
  if (s.startsWith("cla") || s.startsWith("lect")) return "clase";
  return grupo ? "clase" : "";
};
// Busca el tramo por hora («9:00») o por número de sesión (1, 2, 3… sin contar el recreo)
export function tramoPorTexto(tramos, v) {
  const s = String(v ?? "").trim();
  const h = normHora(s);
  if (h) return tramos.find(t => normHora(t.inicio) === h) || null;
  if (/recreo|patio/i.test(s)) return tramos.find(t => t.recreo) || null;
  const n = parseInt(s, 10);
  if (!n) return null;
  return tramos.filter(t => !t.recreo)[n - 1] || null;
}

export async function plantillaExcel(etapa, tramos, profesores) {
  const XLSX = await import("xlsx");
  const filas = [["Profesor", "Email", "Día", "Tramo", "Tipo", "Grupo", "Materia", "Aula"]];
  const ej = profesores.slice(0, 2);
  const t1 = tramos.find(t => !t.recreo);
  if (ej.length && t1) {
    filas.push([ej[0].nombre, ej[0].email || "", "Lunes", t1.inicio, "Clase", "3.º B", "Lengua", "Aula 3B"]);
    if (ej[1]) filas.push([ej[1].nombre, ej[1].email || "", "Lunes", t1.inicio, "Guardia", "", "", ""]);
  } else if (t1) {
    filas.push(["M. López", "mlopez@colegio.es", "Lunes", t1.inicio, "Clase", "3.º B", "Lengua", "Aula 3B"]);
    filas.push(["A. Pérez", "aperez@colegio.es", "Lunes", t1.inicio, "Guardia", "", "", ""]);
  }
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 11 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 12 }];
  const ayuda = XLSX.utils.aoa_to_sheet([
    ["Cómo rellenar la hoja «Horario»"],
    ["Una fila por profesor, día y tramo."],
    ["Día: Lunes, Martes, Miércoles, Jueves o Viernes."],
    ["Tramo: la hora de inicio del tramo. Tramos de esta etapa:"],
    ...tramos.map(t => [`   ${t.inicio}–${t.fin}${t.recreo ? " (recreo)" : ""}`]),
    ["Tipo: Clase, Guardia, Refuerzo, Libre o Patio."],
    ["Email: el correo con el que el profesor entra en AulaIA (para que le llegue el aviso)."],
  ]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Horario");
  XLSX.utils.book_append_sheet(libro, ayuda, "Ayuda");
  XLSX.writeFile(libro, `Plantilla_horarios_${etapaDe(etapa).nombre.split(" ")[0]}.xlsx`);
}

// Lee un Excel con el formato de la plantilla. Devuelve las filas y las que no se entienden.
export async function leerExcel(file, tramos) {
  const XLSX = await import("xlsx");
  const libro = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  if (!filas.length) return { filas: [], dudas: [], formato: false };
  const cab = filas[0].map(norm);
  const idx = {};
  Object.entries(COLS).forEach(([k, nombres]) => { idx[k] = cab.findIndex(c => nombres.some(n => c === norm(n) || c.startsWith(norm(n)))); });
  if (idx.profesor < 0 || idx.dia < 0 || idx.tramo < 0) return { filas: [], dudas: [], formato: false };
  const ok = [], dudas = [];
  filas.slice(1).forEach((f, i) => {
    if (!f.some(x => String(x).trim())) return;
    const g = (k) => (idx[k] >= 0 ? String(f[idx[k]] ?? "").trim() : "");
    const dia = parseDia(g("dia"));
    const tramo = tramoPorTexto(tramos, g("tramo"));
    const tipo = parseTipo(g("tipo"), g("grupo"));
    const fila = { linea: i + 2, profesor: g("profesor"), email: g("email").toLowerCase(), dia, tramo_id: tramo?.id, tipo, grupo: g("grupo"), materia: g("materia"), aula: g("aula") };
    if (!fila.profesor || !dia || !tramo || !tipo) dudas.push(fila); else ok.push(fila);
  });
  return { filas: ok, dudas, formato: true };
}
// Cualquier hoja convertida en texto (para que la IA la entienda)
export async function excelComoTexto(file) {
  const XLSX = await import("xlsx");
  const libro = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return libro.SheetNames.map(n => `### Hoja: ${n}\n` + XLSX.utils.sheet_to_csv(libro.Sheets[n])).join("\n\n").slice(0, 60000);
}

// ── Leer un horario con IA (PDF, Word, imagen o Excel con otro formato) ──
const aBase64 = (buf) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
export async function leerHorarioConIA(file, etapa, tramos, profesores, onProgreso) {
  const nombre = file.name.toLowerCase();
  let archivo;
  if (nombre.endsWith(".pdf")) archivo = { tipo: "pdf", data: aBase64(await file.arrayBuffer()) };
  else if (/\.(png|jpe?g|webp|gif)$/.test(nombre)) archivo = { tipo: "imagen", mediaType: file.type || "image/jpeg", data: aBase64(await file.arrayBuffer()) };
  else if (nombre.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    archivo = { tipo: "texto", data: r.value.slice(0, 80000) };
  } else if (/\.(xlsx|xls|csv|ods)$/.test(nombre)) archivo = { tipo: "texto", data: await excelComoTexto(file) };
  else throw new Error("Ese tipo de archivo no se puede leer. Usa PDF, Word (.docx), Excel o una foto.");
  if (archivo.data.length > 9_000_000) throw new Error("El archivo es demasiado grande. Prueba con uno de menos de 6 MB.");

  const res = await fetch("/api/sust-leer-horario", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ etapa, archivo, tramos: tramos.map(t => ({ inicio: t.inicio, fin: t.fin, recreo: t.recreo })), profesores: profesores.map(p => p.nombre) }),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.mensaje || "No se ha podido leer el horario."); }
  const { leerStreamSSE } = await import("./stream");
  let txt = "";
  await leerStreamSSE(res, (d) => { txt += d; onProgreso?.(txt.length); });
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no ha devuelto un horario. Prueba con otro archivo o rellénalo a mano.");
  let datos;
  try { datos = JSON.parse(m[0]); } catch { throw new Error("La respuesta de la IA venía incompleta. Vuelve a intentarlo."); }
  const filas = [], dudas = [];
  (datos.profesores || []).forEach(p => (p.sesiones || []).forEach(s => {
    const tramo = tramoPorTexto(tramos, s.tramo);
    const tipo = ["clase", "guardia", "refuerzo", "libre", "patio"].includes(s.tipo) ? s.tipo : parseTipo(s.tipo, s.grupo);
    const fila = { profesor: (p.nombre || "").trim(), email: (p.email || "").trim().toLowerCase(), dia: Number(s.dia) || parseDia(s.dia), tramo_id: tramo?.id, tipo, grupo: s.grupo || "", materia: s.materia || "", aula: s.aula || "", dudoso: !!s.dudoso };
    if (!fila.profesor || !fila.dia || fila.dia > 5 || !tramo || !tipo) dudas.push(fila); else filas.push(fila);
  }));
  return { filas, dudas };
}

// Guarda las filas importadas: crea los profesores que falten y rellena su horario
export async function guardarImportacion(etapa, filas, profesores) {
  const porNombre = {}; profesores.forEach(p => { porNombre[norm(p.nombre)] = p; });
  let nuevos = 0;
  for (const f of filas) {
    const k = norm(f.profesor);
    if (!porNombre[k]) {
      const id = await guardarProfesor({ nombre: f.profesor, email: f.email, etapas: [etapa] });
      porNombre[k] = { id, nombre: f.profesor, email: f.email, etapas: [etapa] }; nuevos++;
    } else {
      const p = porNombre[k];
      const cambios = {};
      if (f.email && !p.email) cambios.email = f.email;
      if (!(p.etapas || []).includes(etapa)) cambios.etapas = [...(p.etapas || []), etapa];
      if (Object.keys(cambios).length) { await guardarProfesor({ ...p, ...cambios }); Object.assign(p, cambios); }
    }
  }
  const unicas = {};
  filas.forEach(f => { const pid = porNombre[norm(f.profesor)].id; unicas[`${pid}|${f.tramo_id}|${f.dia}`] = { ...f, profesor_id: pid, etapa }; });
  await guardarCeldas(Object.values(unicas));
  return { celdas: Object.keys(unicas).length, nuevos };
}
