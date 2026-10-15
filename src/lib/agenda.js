// ═══════════════════════════════════════════════════════════════
// AGENDA DOCENTE dentro de AulaIA (versión fusionada)
// La Agenda ya vive en la MISMA base de datos y con la MISMA cuenta que AulaIA
// (tabla agenda_data). La Agenda antigua (su propia base) solo se usa para
// COPIAR los datos una vez con «Traer mis datos de la Agenda antigua»:
// nunca se borra ni se modifica nada allí.
// ═══════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { nombreCompleto, partirNombre } from "./crm";

// Base antigua de la Agenda: SOLO LECTURA, para la importación
const AGENDA_VIEJA_URL = "https://xvayhveiocfdgisvhmma.supabase.co";
const AGENDA_VIEJA_KEY = "sb_publishable_yA4pLAhAlSD6D86LWFnqNg_ZsuazmjK";
export const AGENDA_WEB = "/agenda/index.html";
export const agendaViejaSb = createClient(AGENDA_VIEJA_URL, AGENDA_VIEJA_KEY, {
  auth: { storageKey: "aulaia-agenda-auth", persistSession: true, autoRefreshToken: true },
});
// A partir de ahora la Agenda usa el cliente de AulaIA
export const agendaSb = supabase;
// Sincronización SEGURA: solo manual, con copia de seguridad previa,
// vista previa con confirmación y SIN borrados.

// ── Estado de conexión compartido (para que toda la app se entere) ─────────
let estado = { conectada: false, email: "", sincronizando: false, ultima: null, error: "", resumen: null };
const oyentes = new Set();
const emitir = (cambios) => { estado = { ...estado, ...cambios }; oyentes.forEach(f => f(estado)); };
export const suscribirAgenda = (f) => { oyentes.add(f); f(estado); return () => oyentes.delete(f); };
export const estadoAgenda = () => estado;

export async function agendaUsuario() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

export async function iniciarAgenda() {
  const u = await agendaUsuario();
  emitir({ conectada: !!u, email: u?.email || "" });

}

// En la versión fusionada no hay que «conectar»: la Agenda usa tu cuenta de AulaIA.
export async function conectarAgenda() { await iniciarAgenda(); return null; }
export async function desconectarAgenda() { /* nada: la Agenda va con la sesión de AulaIA */ }

// ── Lectura / escritura del estado de la Agenda (un único JSON por docente) ─
async function leerEstado(uid) {
  const { data, error } = await agendaSb.from("agenda_data").select("data, updated_at").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return { state: data?.data || {}, updated_at: data?.updated_at || null };
}

export async function leerAgenda() {
  const u = await agendaUsuario();
  return u ? (await leerEstado(u.id)).state : null;
}

// Aplica cambios al estado de la Agenda sin pisar lo que se haya guardado
// mientras tanto (si alguien guardó entre medias, se vuelve a intentar).
export async function modificarAgenda(fn) {
  const u = await agendaUsuario();
  if (!u) return null;
  for (let intento = 0; intento < 4; intento++) {
    const { state, updated_at } = await leerEstado(u.id);
    const nuevo = JSON.parse(JSON.stringify(state));
    const r = await fn(nuevo);
    if (r === false) return state; // nada que guardar
    const actual = await leerEstado(u.id);
    if (actual.updated_at !== updated_at) continue;
    const { error } = await agendaSb.from("agenda_data")
      .upsert({ user_id: u.id, data: nuevo, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    return nuevo;
  }
  throw new Error("La Agenda estaba guardando cambios. Inténtalo de nuevo en unos segundos.");
}

// ── Utilidades de fechas y horario de la Agenda ────────────────────────────
const DIAS = ["LUN", "MAR", "MIE", "JUE", "VIE"];
const SLOTS_POR_DEFECTO = [
  { id: "S1", label: "1ª Hora", time: "09:00 - 09:55" },
  { id: "S2", label: "2ª Hora", time: "09:55 - 10:50" },
  { id: "REC", label: "Recreo", time: "10:50 - 11:20", isBreak: true },
  { id: "S3", label: "3ª Hora", time: "11:20 - 12:15" },
  { id: "S4", label: "4ª Hora", time: "12:15 - 13:10" },
  { id: "S5", label: "5ª Hora", time: "13:10 - 14:05" },
];
export const ASIGNATURAS_AGENDA = {
  MATES: "Matemáticas", LENGUA: "Lengua Castellana", CIENCIAS: "Ciencias Naturales", SOCIALES: "Ciencias Sociales",
  INGLES: "Inglés", EF: "Educación Física", MUSICA: "Música", ARTISTICA: "Educación Artística", RELIGION: "Religión",
  REFUERZO: "Refuerzo", TUTORIA: "Tutoría / Valores", RECREO: "Recreo / Descanso",
};

const inicioCurso = (st) => { const d = new Date(`${st.startDate || "2026-09-07"}T00:00:00`); d.setHours(0, 0, 0, 0); return d; };
export const semanaDe = (st, fecha) => {
  const d = new Date(fecha); d.setHours(0, 0, 0, 0);
  return Math.floor(Math.round((d - inicioCurso(st)) / 86400000) / 7);
};
export const diaDe = (fecha) => DIAS[(new Date(fecha).getDay() + 6) % 7] || null; // sáb/dom → null
const slotsDe = (st) => (st.slots && st.slots.length ? st.slots : SLOTS_POR_DEFECTO);
const horaDe = (fecha, hhmm) => { const d = new Date(fecha); const [h, m] = (hhmm || "09:00").split(":").map(Number); d.setHours(h || 0, m || 0, 0, 0); return d; };

// Horas de un día concreto con lo que toca en cada una (según el horario de la Agenda)
export function horasDelDia(st, fecha) {
  const dia = diaDe(fecha);
  if (!dia) return [];
  const w = semanaDe(st, fecha);
  const lecciones = (st.weeklyLessons || {})[w] || {};
  return slotsDe(st).filter(s => !s.isBreak).map(s => {
    const key = `${dia}_${s.id}`;
    const fijo = (st.schedule || {})[key];
    const lec = lecciones[key] || null;
    const override = lec && Object.prototype.hasOwnProperty.call(lec, "subjectOverride");
    const subjectId = override ? lec.subjectOverride : (typeof fijo === "string" ? fijo : fijo?.subjectId) || null;
    const group = override ? (lec.groupOverride || "") : (fijo?.group || "");
    return { slotId: s.id, label: s.label, time: s.time, subjectId, group, titulo: lec?.title || "", aulaiaDocId: lec?.aulaiaDocId || null };
  });
}

// Sesiones planificadas en la Agenda entre dos fechas → eventos para AulaIA
export function sesionesAgenda(st, desde, hasta) {
  if (!st) return [];
  const out = [];
  const inicio = inicioCurso(st);
  const slots = slotsDe(st);
  Object.entries(st.weeklyLessons || {}).forEach(([w, lecciones]) => {
    Object.entries(lecciones || {}).forEach(([key, lec]) => {
      if (!lec || !(lec.title || lec.aulaiaDocId)) return;
      const [dia, slotId] = key.split("_");
      const di = DIAS.indexOf(dia);
      if (di < 0) return;
      const fecha = new Date(inicio); fecha.setDate(fecha.getDate() + Number(w) * 7 + di);
      const slot = slots.find(s => s.id === slotId);
      const [h1, h2] = (slot?.time || "09:00 - 10:00").split("-").map(x => x.trim());
      const ini = horaDe(fecha, h1), fin = horaDe(fecha, h2);
      if (ini < desde || ini >= hasta) return;
      const fijo = (st.schedule || {})[key];
      const override = Object.prototype.hasOwnProperty.call(lec, "subjectOverride");
      out.push({
        id: `agenda-${w}-${key}`, origen: "agenda", tipo: "sesion",
        titulo: lec.title || "Sesión", notas: lec.notes || "",
        inicio: ini.toISOString(), fin: fin.toISOString(),
        grupo: override ? (lec.groupOverride || "") : (fijo?.group || ""),
        asignatura: ASIGNATURAS_AGENDA[override ? lec.subjectOverride : (typeof fijo === "string" ? fijo : fijo?.subjectId)] || "",
        programacion_id: lec.aulaiaDocId || null,
        ref: { week: Number(w), key },
      });
    });
  });
  return out;
}

// Coloca un documento de AulaIA como sesión en una hora concreta de la Agenda
export async function programarEnAgenda({ fecha, slotId, titulo, docId }) {
  const dia = diaDe(fecha);
  if (!dia) throw new Error("La Agenda solo tiene horario de lunes a viernes.");
  let ref = null;
  await modificarAgenda((st) => {
    const w = semanaDe(st, fecha);
    if (w < 0) throw new Error("Esa fecha es anterior al inicio de curso de tu Agenda.");
    const key = `${dia}_${slotId}`;
    st.weeklyLessons = st.weeklyLessons || {};
    st.weeklyLessons[w] = st.weeklyLessons[w] || {};
    const prev = st.weeklyLessons[w][key] || { id: key, day: dia, slot: slotId };
    st.weeklyLessons[w][key] = { ...prev, title: titulo, aulaiaDocId: docId, aulaiaUrl: `${window.location.origin}/?doc=${docId}` };
    ref = { week: w, key };
  });
  return ref;
}

export async function quitarDeAgenda(ref) {
  if (!ref) return;
  await modificarAgenda((st) => {
    const lec = st.weeklyLessons?.[ref.week]?.[ref.key];
    if (!lec) return false;
    delete lec.aulaiaDocId; delete lec.aulaiaUrl; lec.title = "";
  });
}


// ═══════════════════════════════════════════════════════════════
// SINCRONIZACIÓN SEGURA de grupos, asignaturas y alumnado
//  1. analizarSincronizacion(): NO escribe nada; propone un plan.
//  2. La docente revisa y confirma cada emparejamiento / alta.
//  3. aplicarSincronizacion(): guarda antes una COPIA completa de la Agenda
//     y después solo AÑADE o ACTUALIZA. Nunca borra en ninguna de las dos apps.
// ═══════════════════════════════════════════════════════════════
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
const normG = (s) => norm(s).replace(/\s/g, ""); // "1º A" = "1ºA"
const IGNORADOS_KEY = "aulaia-agenda-ignorados";
const leerIgnorados = () => { try { return new Set(JSON.parse(localStorage.getItem(IGNORADOS_KEY) || "[]")); } catch { return new Set(); } };
const guardarIgnorados = (set) => { try { localStorage.setItem(IGNORADOS_KEY, JSON.stringify([...set])); } catch {} };
// Diferencias que la docente ya decidió dejar como están (no se vuelven a preguntar mientras no cambien)
const ACEPTADAS_KEY = "aulaia-agenda-diferencias-ok";
const leerAceptadas = () => { try { return JSON.parse(localStorage.getItem(ACEPTADAS_KEY) || "{}"); } catch { return {}; } };
const guardarAceptadas = (o) => { try { localStorage.setItem(ACEPTADAS_KEY, JSON.stringify(o)); } catch {} };

// ¿Pueden ser la misma persona? "Paula A. D." ↔ "Paula Álvarez Díaz"
export function parecido(alumnoAula, nombreAgenda) {
  const tA = norm(nombreAgenda).split(" ").filter(Boolean);
  const nom = norm(alumnoAula.nombre).split(" ").filter(Boolean);
  const ape = norm(alumnoAula.apellidos).split(" ").filter(Boolean);
  if (!tA.length || !nom.length) return 0;
  if (norm(nombreCompleto(alumnoAula)) === norm(nombreAgenda)) return 3; // idéntico
  // El nombre de pila debe coincidir
  if (tA.slice(0, nom.length).join(" ") !== nom.join(" ")) return 0;
  const resto = tA.slice(nom.length);
  if (!ape.length) return resto.length ? 1 : 2;
  const coincideInicial = ape.every((p, i) => resto[i] && (p.length === 1 ? resto[i][0] === p : resto[i] === p));
  return coincideInicial ? 2 : 0;
}

export async function analizarSincronizacion() {
  const u = await agendaUsuario();
  if (!u) throw new Error("Primero conecta tu Agenda.");
  const [rg, rc, ra] = await Promise.all([
    supabase.from("grupos").select("*"),
    supabase.from("clases").select("*"),
    supabase.from("alumnos").select("*").order("created_at"),
  ]);
  const err = rg.error || rc.error || ra.error;
  if (err) throw err;
  const grupos = rg.data || [], clases = rc.data || [], alumnos = ra.data || [];
  const st = (await leerAgenda()) || {};
  const students = st.students || [], classes = st.classes || [];
  const ignorados = leerIgnorados();
  const aceptadas = leerAceptadas();
  const grupoDe = (id) => grupos.find(g => g.id === id);

  // ── Alumnado ──
  const idsAgenda = new Set(students.map(s => s.id));
  const vinculados = alumnos.filter(a => a.agenda_student_id && idsAgenda.has(a.agenda_student_id));
  const usadosAula = new Set(vinculados.map(a => a.id));
  const usadosAgenda = new Set(vinculados.map(a => a.agenda_student_id));

  const diferencias = [];
  for (const a of vinculados) {
    const s = students.find(x => x.id === a.agenda_student_id);
    const campos = [];
    if (norm(nombreCompleto(a)) !== norm(s.name)) campos.push({ campo: "nombre", aula: nombreCompleto(a), agenda: s.name || "" });
    if (normG(grupoDe(a.grupo_id)?.nombre) !== normG(s.group)) campos.push({ campo: "grupo", aula: grupoDe(a.grupo_id)?.nombre || "", agenda: s.group || "" });
    if (!!a.tiene_nee !== !!s.neae) campos.push({ campo: "NEAE", aula: a.tiene_nee ? "Sí" : "No", agenda: s.neae ? "Sí" : "No" });
    const ok = aceptadas;
    const pendientes = campos.filter(c => ok[`${a.id}:${c.campo}`] !== `${c.aula}|${c.agenda}`);
    if (pendientes.length) diferencias.push({ alumnoId: a.id, studentId: s.id, nombre: nombreCompleto(a), campos: pendientes });
  }

  // Alumnos de la Agenda sin pareja → proponer pareja (mismo grupo y nombre compatible)
  const nuevosAgenda = [];
  for (const s of students) {
    if (usadosAgenda.has(s.id) || ignorados.has(s.id)) continue;
    const candidatos = alumnos
      .filter(a => !usadosAula.has(a.id) && !(a.agenda_student_id && idsAgenda.has(a.agenda_student_id)) && normG(grupoDe(a.grupo_id)?.nombre) === normG(s.group))
      .map(a => ({ a, p: parecido(a, s.name) })).filter(x => x.p > 0).sort((x, y) => y.p - x.p);
    const propuesta = candidatos.length && (candidatos.length === 1 || candidatos[0].p > candidatos[1].p) ? candidatos[0].a : null;
    if (propuesta) usadosAula.add(propuesta.id);
    nuevosAgenda.push({
      studentId: s.id, nombre: s.name || "(sin nombre)", grupo: s.group || "", neae: !!s.neae, tipo: s.neaeType || "",
      propuestaId: propuesta?.id || null, dudoso: !propuesta && candidatos.length > 0,
      opciones: alumnos.filter(a => !(a.agenda_student_id && idsAgenda.has(a.agenda_student_id)) && normG(grupoDe(a.grupo_id)?.nombre) === normG(s.group))
        .map(a => ({ id: a.id, nombre: nombreCompleto(a) })),
    });
  }
  // Alumnos de AulaIA sin pareja → proponer enviarlos a la Agenda
  const propuestosAula = new Set(nuevosAgenda.map(n => n.propuestaId).filter(Boolean));
  const nuevosAula = alumnos
    .filter(a => !(a.agenda_student_id && idsAgenda.has(a.agenda_student_id)) && !propuestosAula.has(a.id))
    .map(a => ({ alumnoId: a.id, nombre: nombreCompleto(a), grupo: grupoDe(a.grupo_id)?.nombre || "", neae: !!a.tiene_nee, tipo: a.perfil_nee?.tipo_texto || "" }));
  // Vinculados cuyo alumno ya no está en la Agenda (solo informativo; no se borra nada)
  const desaparecidos = alumnos.filter(a => a.agenda_student_id && !idsAgenda.has(a.agenda_student_id))
    .map(a => ({ alumnoId: a.id, nombre: nombreCompleto(a) }));

  // ── Asignaturas ──
  const idsClasesAgenda = new Set(classes.map(c => c.id));
  const clasesVinc = new Set(clases.filter(c => c.agenda_class_id && idsClasesAgenda.has(c.agenda_class_id)).map(c => c.agenda_class_id));
  const clasesNuevasAgenda = classes.filter(c => !clasesVinc.has(c.id) && !ignorados.has(c.id)).map(c => {
    const par = clases.find(x => !(x.agenda_class_id && idsClasesAgenda.has(x.agenda_class_id)) && normG(grupoDe(x.grupo_id)?.nombre) === normG(c.groupLabel) && norm(x.area) === norm(c.subject));
    return { classId: c.id, grupo: c.groupLabel || "", asignatura: c.subject || "", parejaId: par?.id || null };
  });
  const paresClase = new Set(clasesNuevasAgenda.map(c => c.parejaId).filter(Boolean));
  const clasesNuevasAula = clases.filter(c => !(c.agenda_class_id && idsClasesAgenda.has(c.agenda_class_id)) && !paresClase.has(c.id))
    .map(c => ({ claseId: c.id, grupo: grupoDe(c.grupo_id)?.nombre || c.nombre, asignatura: c.area || "" }));

  return { nuevosAgenda, nuevosAula, diferencias, desaparecidos, clasesNuevasAgenda, clasesNuevasAula };
}

// Copia de seguridad completa de la Agenda (en la base de datos de AulaIA)
async function copiaDeSeguridad(motivo) {
  const st = await leerAgenda();
  const { error } = await supabase.from("agenda_backups").insert({ motivo, data: st || {} });
  if (error) throw new Error("No se pudo hacer la copia de seguridad de la Agenda; no se ha cambiado nada. (" + (error.message || "") + ")");
}
export async function listarCopias() {
  const { data } = await supabase.from("agenda_backups").select("id, created_at, motivo").order("created_at", { ascending: false }).limit(20);
  return data || [];
}
export async function restaurarCopia(id) {
  const { data, error } = await supabase.from("agenda_backups").select("data").eq("id", id).single();
  if (error || !data) throw new Error("No se encontró la copia.");
  await copiaDeSeguridad("Antes de restaurar otra copia");
  await modificarAgenda((st) => { Object.keys(st).forEach(k => delete st[k]); Object.assign(st, data.data || {}); });
}

// decisiones = {
//   agenda: { [studentId]: { accion: "emparejar"|"crear"|"ignorar", alumnoId? } },
//   aula:   { [alumnoId]: "enviar"|"no" },
//   dif:    { [alumnoId]: { [campo]: "aula"|"agenda"|"nada" } },
//   clasesAgenda: { [classId]: "emparejar"|"crear"|"ignorar" },
//   clasesAula: { [claseId]: "enviar"|"no" },
// }
export async function aplicarSincronizacion(plan, d) {
  emitir({ sincronizando: true, error: "" });
  const r = { creadosAula: 0, enviadosAgenda: 0, emparejados: 0, actualizados: 0 };
  try {
    await copiaDeSeguridad("Antes de sincronizar");
    const [rg, rc, ra] = await Promise.all([supabase.from("grupos").select("*"), supabase.from("clases").select("*"), supabase.from("alumnos").select("*")]);
    const grupos = rg.data || [], clases = rc.data || [], alumnos = ra.data || [];
    const asegurarGrupo = async (label) => {
      let g = grupos.find(x => normG(x.nombre) === normG(label || "Sin grupo"));
      if (!g) {
        const { data, error } = await supabase.from("grupos").insert({ nombre: (label || "Sin grupo").trim(), etapa: "primaria" }).select().single();
        if (error) throw error;
        g = data; grupos.push(g);
      }
      return g;
    };
    const ignorados = leerIgnorados();
    const st0 = (await leerAgenda()) || {};
    const stuAg = (id) => (st0.students || []).find(s => s.id === id);

    // ── PASO 1: cambios en AulaIA (Agenda → AulaIA). No toca la Agenda. ──
    for (const c of plan.clasesNuevasAgenda) {
      const acc = d.clasesAgenda?.[c.classId] || (c.parejaId ? "emparejar" : "ignorar");
      if (acc === "ignorar") { ignorados.add(c.classId); continue; }
      if (acc === "emparejar" && c.parejaId) { await supabase.from("clases").update({ agenda_class_id: c.classId }).eq("id", c.parejaId); continue; }
      if (acc === "crear") {
        const g = await asegurarGrupo(c.grupo);
        const ya = clases.find(x => x.grupo_id === g.id && norm(x.area) === norm(c.asignatura));
        if (ya) { await supabase.from("clases").update({ agenda_class_id: c.classId }).eq("id", ya.id); continue; }
        const { data, error } = await supabase.from("clases").insert({ nombre: g.nombre, grupo_id: g.id, area: c.asignatura || null, etapa: g.etapa, curso: g.curso, comunidad: g.comunidad, agenda_class_id: c.classId }).select().single();
        if (error) throw error;
        clases.push(data);
      }
    }
    for (const n of plan.nuevosAgenda) {
      const dec = d.agenda?.[n.studentId] || { accion: n.propuestaId ? "emparejar" : "ignorar", alumnoId: n.propuestaId };
      if (dec.accion === "ignorar") { ignorados.add(n.studentId); continue; }
      if (dec.accion === "emparejar" && dec.alumnoId) {
        await supabase.from("alumnos").update({ agenda_student_id: n.studentId, agenda_off: false }).eq("id", dec.alumnoId);
        r.emparejados++; continue;
      }
      if (dec.accion === "crear") {
        const g = await asegurarGrupo(n.grupo);
        const { error } = await supabase.from("alumnos").insert({
          ...partirNombre(n.nombre), grupo_id: g.id, clase_id: clases.find(c => c.grupo_id === g.id)?.id || null,
          tiene_nee: n.neae, perfil_nee: n.tipo ? { tipo_texto: n.tipo, necesidades: [] } : {}, agenda_student_id: n.studentId,
        });
        if (error) throw error;
        r.creadosAula++;
      }
    }
    for (const df of plan.diferencias) {
      const s = stuAg(df.studentId); const a = alumnos.find(x => x.id === df.alumnoId);
      if (!s || !a) continue;
      for (const c of df.campos) {
        if ((d.dif?.[df.alumnoId]?.[c.campo] || "nada") !== "agenda") continue;
        if (c.campo === "nombre") await supabase.from("alumnos").update(partirNombre(s.name)).eq("id", a.id);
        if (c.campo === "grupo") { const g = await asegurarGrupo(s.group); await supabase.from("alumnos").update({ grupo_id: g.id, clase_id: clases.find(x => x.grupo_id === g.id)?.id || null }).eq("id", a.id); }
        if (c.campo === "NEAE") await supabase.from("alumnos").update({ tiene_nee: !!s.neae }).eq("id", a.id);
        r.actualizados++;
      }
    }
    guardarIgnorados(ignorados);
    const aceptadas = leerAceptadas();
    plan.diferencias.forEach(df => df.campos.forEach(c => { if ((d.dif?.[df.alumnoId]?.[c.campo] || "nada") === "nada") aceptadas[`${df.alumnoId}:${c.campo}`] = `${c.aula}|${c.agenda}`; }));
    guardarAceptadas(aceptadas);

    // ── PASO 2: cambios en la Agenda (AulaIA → Agenda). Solo AÑADE o ACTUALIZA. ──
    const clasesEnviar = plan.clasesNuevasAula.filter(c => d.clasesAula?.[c.claseId] === "enviar")
      .map(c => ({ claseId: c.claseId, id: `CLASS-AULAIA-${c.claseId.slice(0, 8)}`, groupLabel: c.grupo, subject: c.asignatura }));
    const alumnosEnviar = plan.nuevosAula.filter(n => d.aula?.[n.alumnoId] === "enviar")
      .map(n => ({ alumnoId: n.alumnoId, id: `STU-AULAIA-${n.alumnoId.slice(0, 8)}`, n }));
    const camposAula = [];
    plan.diferencias.forEach(df => df.campos.forEach(c => { if (d.dif?.[df.alumnoId]?.[c.campo] === "aula") camposAula.push({ studentId: df.studentId, ...c }); }));

    if (clasesEnviar.length || alumnosEnviar.length || camposAula.length) {
      await modificarAgenda((st) => { // idempotente: se puede repetir sin duplicar
        st.students = st.students || []; st.classes = st.classes || [];
        clasesEnviar.forEach(c => { if (!st.classes.some(x => x.id === c.id)) st.classes.push({ id: c.id, groupLabel: c.groupLabel, subject: c.subject }); });
        alumnosEnviar.forEach(({ id, n }) => {
          if (!st.students.some(x => x.id === id)) st.students.push({ id, name: n.nombre, group: n.grupo, neae: n.neae, neaeType: n.tipo, birthday: "", behavior: "", notes: "", parentName: "", parentEmail: "", phones: [], gradeAvg: null });
        });
        camposAula.forEach(c => {
          const s = st.students.find(x => x.id === c.studentId); if (!s) return;
          if (c.campo === "nombre") s.name = c.aula;
          if (c.campo === "grupo") s.group = c.aula;
          if (c.campo === "NEAE") s.neae = c.aula === "Sí";
        });
      });
      // Solo cuando la Agenda ya está guardada, se anotan los vínculos en AulaIA
      for (const c of clasesEnviar) await supabase.from("clases").update({ agenda_class_id: c.id }).eq("id", c.claseId);
      for (const x of alumnosEnviar) { await supabase.from("alumnos").update({ agenda_student_id: x.id }).eq("id", x.alumnoId); r.enviadosAgenda++; }
      r.actualizados += camposAula.length;
    }
    emitir({ sincronizando: false, ultima: new Date(), resumen: r });
    window.dispatchEvent(new CustomEvent("aulaia-agenda-sync", { detail: r }));
    return r;
  } catch (e) {
    emitir({ sincronizando: false, error: e.message || "No se pudo sincronizar." });
    throw e;
  }
}

// ── Sincronización AUTOMÁTICA (solo lo seguro, nunca borra) ─────────────────
//  · Alumnado de la Agenda cuyo grupo ya existe en AulaIA → entra en ese grupo
//    (si ya estaba con un nombre compatible, solo se vinculan).
//  · Alumnado y clases creados en AulaIA que nunca se enviaron → se añaden a la Agenda.
//  · Lo dudoso (dos alumnos parecidos, grupos que no existen, diferencias de
//    datos) se deja para «⚙️ Mi Agenda → Sincronizar», donde decide la docente.
let autoEnCurso = null, ultimaAuto = 0, autoTimer = null;
export async function sincronizarAuto() {
  if (autoEnCurso) return autoEnCurso;
  autoEnCurso = (async () => {
    try {
      const u = await agendaUsuario();
      if (!u) return null;
      const plan = await analizarSincronizacion();
      const [rg, ra, rc] = await Promise.all([
        supabase.from("grupos").select("id, nombre"),
        supabase.from("alumnos").select("id, agenda_student_id, agenda_off"),
        supabase.from("clases").select("id, agenda_class_id"),
      ]);
      const gruposAula = new Set((rg.data || []).map(g => normG(g.nombre)));
      const nuncaEnviados = new Set((ra.data || []).filter(a => !a.agenda_student_id && !a.agenda_off).map(a => a.id));
      const clasesSinVinculo = new Set((rc.data || []).filter(c => !c.agenda_class_id).map(c => c.id));
      const d = { agenda: {}, aula: {}, dif: {}, clasesAgenda: {}, clasesAula: {} };
      const nuevosAgenda = plan.nuevosAgenda.filter(n => {
        if (n.propuestaId) { d.agenda[n.studentId] = { accion: "emparejar", alumnoId: n.propuestaId }; return true; }
        if (!n.dudoso && n.grupo && gruposAula.has(normG(n.grupo))) { d.agenda[n.studentId] = { accion: "crear" }; return true; }
        return false;
      });
      const nuevosAula = plan.nuevosAula.filter(n => nuncaEnviados.has(n.alumnoId));
      nuevosAula.forEach(n => { d.aula[n.alumnoId] = "enviar"; });
      const clasesNuevasAgenda = plan.clasesNuevasAgenda.filter(c => c.parejaId);
      clasesNuevasAgenda.forEach(c => { d.clasesAgenda[c.classId] = "emparejar"; });
      const clasesNuevasAula = plan.clasesNuevasAula.filter(c => clasesSinVinculo.has(c.claseId));
      clasesNuevasAula.forEach(c => { d.clasesAula[c.claseId] = "enviar"; });
      if (!nuevosAgenda.length && !nuevosAula.length && !clasesNuevasAgenda.length && !clasesNuevasAula.length) return null;
      return await aplicarSincronizacion({ nuevosAgenda, nuevosAula, diferencias: [], desaparecidos: [], clasesNuevasAgenda, clasesNuevasAula }, d);
    } catch (e) { console.error("Sincronización automática:", e); return null; }
    finally { ultimaAuto = Date.now(); }
  })();
  try { return await autoEnCurso; } finally { autoEnCurso = null; }
}
// Se llama al crear clases o alumnos (inmediata) y al moverse por la app (como mucho cada 20 s)
export const pedirSincronizacion = (soloSiToca = false) => {
  if (soloSiToca && Date.now() - ultimaAuto < 20000) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => { sincronizarAuto(); }, soloSiToca ? 0 : 400);
};
export async function borrarAlumnoEnAgenda() {}
export async function borrarClaseEnAgenda() {}
export async function borrarGrupoEnAgenda() {}
export const olvidarIgnorados = () => { try { localStorage.removeItem(IGNORADOS_KEY); } catch {} };

// ── Traer (COPIAR) mis datos de la Agenda antigua ──────────────────────────
// Lee la Agenda antigua (su propia base de datos) y la copia aquí. Allí no se
// borra ni se modifica NADA. Antes de escribir se guarda una copia de seguridad
// de lo que hubiera aquí. Los documentos subidos (PDF/fotos) también se copian.
export async function agendaViejaSesion() {
  const { data } = await agendaViejaSb.auth.getSession();
  return data.session?.user || null;
}
export async function entrarAgendaVieja(email, password) {
  const { data, error } = await agendaViejaSb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(/invalid/i.test(error.message) ? "Correo o contraseña de la Agenda antigua incorrectos." : error.message);
  return data.user;
}
export async function previsualizarAgendaVieja() {
  const vu = await agendaViejaSesion();
  if (!vu) return null;
  const { data, error } = await agendaViejaSb.from("agenda_data").select("data, updated_at").eq("user_id", vu.id).maybeSingle();
  if (error) throw error;
  const st = data?.data || {};
  const actual = await leerAgenda();
  const cuenta = (s) => ({
    alumnos: (s?.students || []).length,
    clases: (s?.classes || []).length,
    semanas: Object.values(s?.weeklyLessons || {}).filter(w => w && Object.keys(w).length).length,
    horas: Object.keys(s?.schedule || {}).length,
    documentos: (s?.documents || []).length,
    listados: (s?.checklists || []).length,
  });
  return { email: vu.email, vieja: cuenta(st), aqui: cuenta(actual), aquiVacia: !actual || !Object.keys(actual).length, actualizada: data?.updated_at || null };
}
export async function importarAgendaVieja(onProgreso = () => {}) {
  const vu = await agendaViejaSesion();
  if (!vu) throw new Error("Primero entra con tu cuenta de la Agenda antigua.");
  const u = await agendaUsuario();
  if (!u) throw new Error("Tu sesión de AulaIA ha caducado. Vuelve a entrar.");
  onProgreso("Leyendo tu Agenda antigua…");
  const { data, error } = await agendaViejaSb.from("agenda_data").select("data").eq("user_id", vu.id).maybeSingle();
  if (error) throw error;
  const vieja = data?.data;
  if (!vieja || !Object.keys(vieja).length) throw new Error("La Agenda antigua está vacía: no hay nada que copiar.");
  const nueva = JSON.parse(JSON.stringify(vieja));

  onProgreso("Guardando copia de seguridad de lo que hay aquí…");
  await copiaDeSeguridad("Antes de copiar la Agenda antigua");

  // Documentos: se copian a tu carpeta en AulaIA (los originales siguen allí)
  const docs = nueva.documents || [];
  let copiados = 0, fallidos = 0;
  for (const d of docs) {
    if (!d.storagePath) continue;
    onProgreso(`Copiando documentos (${copiados + fallidos + 1}/${docs.length})…`);
    try {
      const { data: blob, error: e1 } = await agendaViejaSb.storage.from("documentos-alumnado").download(d.storagePath);
      if (e1) throw e1;
      const nuevaRuta = `${u.id}/${d.storagePath.split("/").slice(1).join("/") || d.id}`;
      const { error: e2 } = await supabase.storage.from("documentos-alumnado").upload(nuevaRuta, blob, { upsert: true });
      if (e2) throw e2;
      d.storagePath = nuevaRuta; copiados++;
    } catch { d.copiaPendiente = true; fallidos++; }
  }

  onProgreso("Guardando tu Agenda en AulaIA…");
  const { error: e3 } = await supabase.from("agenda_data")
    .upsert({ user_id: u.id, data: nueva, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (e3) throw e3;
  emitir({ conectada: true });
  return { alumnos: (nueva.students || []).length, clases: (nueva.classes || []).length, copiados, fallidos };
}
