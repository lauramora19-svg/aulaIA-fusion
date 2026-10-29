// Equipo docente IA (versión fusionada): especialistas, perfil y reparto.
import { supabase } from "./supabase";
import { NECESIDADES } from "./datos";

export const COLUMNAS_PUBLICAS = "id, nombre, inicial, rol, corto, claves, tipos, color, fondo, alcance, activo, orden";

// Tipos del constructor (para marcar qué respalda cada especialista)
export const TIPOS_CONSTRUCTOR = [
  ["actividades", "Actividades"], ["mixto_actividades", "Actividades dos niveles"], ["recursos", "Recursos y materiales"],
  ["rubrica", "Rúbrica"], ["mixto_rubrica", "Rúbrica multinivel"], ["familias", "Comunicación familias"],
  ["situacion", "Situación de aprendizaje"], ["mixto_situacion", "Situación de aprendizaje inclusiva"],
  ["programacion", "Programación didáctica"], ["mixto_programacion", "Programación inclusiva"],
  ["dua", "DUA"], ["mixto_dua", "Programación DUA"], ["aci", "ACI"], ["pti", "PTI"], ["mixto_plan", "Plan de inclusión"],
  ["ficha", "Ficha (siguientes pasos)"], ["manipulativo", "Manipulativo"], ["flashcards", "Flashcards"], ["pictogramas", "Pictogramas"],
  ["cuento", "Cuento"], ["plan_alumno", "Plan semanal"], ["cotejo", "Lista de cotejo"], ["examen", "Examen"], ["preguntas", "Preguntas"],
  ["informe", "Informe de alumno"], ["acta", "Acta (modelos del colegio)"],
];

export async function miPerfil() {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  if (!uid) return null;
  const { data } = await supabase.from("perfiles").select("*").eq("id", uid).maybeSingle();
  return data || { id: uid, rol: "docente", nombre: "", centro: "", comunidad: "", etapa: "", areas: "" };
}
export async function guardarPerfil(p) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user?.id;
  const fila = { id: uid, nombre: p.nombre?.trim() || "", centro: p.centro?.trim() || "", comunidad: p.comunidad || "", etapa: p.etapa?.trim() || "", areas: p.areas?.trim() || "", updated_at: new Date().toISOString() };
  const { error } = await supabase.from("perfiles").upsert(fila, { onConflict: "id" });
  if (error) throw error;
}

export async function listarEspecialistas(esAdmin) {
  if (esAdmin) {
    const { data, error } = await supabase.rpc("especialistas_admin");
    if (!error) return data || [];
  }
  const { data } = await supabase.from("especialistas").select(COLUMNAS_PUBLICAS).order("orden");
  return data || [];
}
export async function guardarEspecialista(e, nuevo) {
  const fila = {
    id: e.id, nombre: e.nombre.trim(), inicial: (e.inicial || e.nombre.trim()[0] || "?").slice(0, 2), rol: e.rol || "",
    corto: e.corto || "", descripcion: e.descripcion || "", instrucciones: e.instrucciones || "",
    claves: e.claves || [], tipos: e.tipos || [], color: e.color || "#4338ca", fondo: e.fondo || "#eef2ff",
    alcance: e.alcance || "admin", activo: e.activo !== false, orden: e.orden ?? 50, updated_at: new Date().toISOString(),
  };
  const { error } = nuevo
    ? await supabase.from("especialistas").insert(fila)
    : await supabase.from("especialistas").update(fila).eq("id", e.id);
  if (error) throw error;
}

// Lee un .md de subagente (formato de VS Code / Claude Code)
export function leerMdSubagente(texto) {
  const m = texto.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  const cab = {}, cuerpo = m ? m[2] : texto;
  if (m) m[1].split("\n").forEach(l => { const i = l.indexOf(":"); if (i > 0) cab[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  const nombre = cab.name ? cab.name[0].toUpperCase() + cab.name.slice(1) : "";
  return { id: (cab.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"), nombre, descripcion: cab.description || "", instrucciones: cuerpo.trim() };
}

// Reparto automático por palabras clave; si no encaja ninguno → coordinadora
// (si encajan varios, gana la palabra clave más larga: «corrige estas fichas» → Rosa, no Arturo)
export function repartir(texto, lista) {
  const t = (texto || "").toLowerCase();
  let mejor = null, largo = 0;
  lista.forEach(e => {
    if (e.id === "coordinadora") return;
    (e.claves || []).forEach(k => { const kk = (k || "").toLowerCase(); if (kk && t.includes(kk) && kk.length > largo) { mejor = e; largo = kk.length; } });
  });
  return mejor?.id || "coordinadora";
}

// Resumen del grupo para los especialistas: sin nombres, solo datos de aula
export async function resumenGrupo(clase, alumno = null) {
  if (!clase) return "";
  let q = supabase.from("alumnos").select("nombre, apellidos, tiene_nee, perfil_nee");
  q = clase.grupo_id ? q.eq("grupo_id", clase.grupo_id) : q.eq("clase_id", clase.id);
  const { data } = await q;
  const al = data || [];
  const conNee = al.filter(a => a.tiene_nee);
  const tipos = {};
  conNee.forEach(a => {
    const ns = (a.perfil_nee?.necesidades || []).map(id => NECESIDADES.find(n => n.id === id)?.desc || id);
    (ns.length ? ns : [a.perfil_nee?.tipo_texto || "sin especificar"]).forEach(n => { tipos[n] = (tipos[n] || 0) + 1; });
  });
  const lineas = [
    `- Grupo: ${clase.grupo_nombre || clase.nombre}${clase.area ? ` · área: ${clase.area}` : ""}${clase.curso ? ` · ${clase.curso}` : ""}`,
    `- Alumnado: ${al.length}`,
    conNee.length ? `- Alumnado con NEAE: ${conNee.length} (${Object.entries(tipos).map(([k, v]) => `${k}: ${v}`).join("; ")})` : "- Sin alumnado con NEAE registrado",
  ];
  if (alumno) {
    const ini = [alumno.nombre, alumno.apellidos].filter(Boolean).join(" ").split(/\s+/).map(p => p[0] + ".").join(" ");
    lineas.push(`- Este encargo es sobre un alumno/a concreto (iniciales ${ini})${alumno.tiene_nee ? `, con NEAE: ${(alumno.perfil_nee?.necesidades || []).map(id => NECESIDADES.find(n => n.id === id)?.desc || id).join(", ") || alumno.perfil_nee?.tipo_texto || "sin especificar"}` : ""}.`);
  }
  return lineas.join("\n");
}

// Contexto real para la IA: lo que la docente ha escrito del grupo, el resumen
// del grupo y las fichas (solo iniciales; nunca nombres completos).
// - Para un alumno concreto: su ficha completa.
// - Para el grupo entero: la ficha resumida de cada alumno/a con NEAE.
const iniciales = (a) => [a.nombre, a.apellidos].filter(Boolean).join(" ").split(/\s+/).filter(Boolean).map(p => p[0] + ".").join(" ");
const corta = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
async function leerAgendaAlumnos() {
  try {
    const { data: ag } = await supabase.from("agenda_data").select("data").maybeSingle();
    return ag?.data?.students || [];
  } catch { return []; }
}
function fichaAlumno(alumno, agenda, completa) {
  const pn = alumno.perfil_nee || {};
  const nec = (pn.necesidades || []).map(id => NECESIDADES.find(n => n.id === id)?.desc || id);
  const n = completa ? 600 : 220;
  const l = [completa ? `- Iniciales: ${iniciales(alumno)}` : `• ${iniciales(alumno)}`];
  l.push(alumno.tiene_nee ? `  NEAE${nec.length ? `: ${nec.join(", ")}` : ""}${pn.tipo_texto ? ` (${corta(pn.tipo_texto, 80)})` : ""}` : "  Sin NEAE registradas");
  if (pn.medidas) l.push(`  Medidas: ${corta(pn.medidas, n)}`);
  if (pn.apoyos) l.push(`  Apoyos: ${corta(pn.apoyos, n)}`);
  if (alumno.notas) l.push(`  Notas de la docente: ${corta(alumno.notas, n)}`);
  const s = alumno.agenda_student_id ? agenda.find(x => x.id === alumno.agenda_student_id) : null;
  if (s?.notes) l.push(`  Pautas / adaptación (Agenda): ${corta(s.notes, n)}`);
  if (s?.behavior) l.push(`  Conducta: ${corta(s.behavior, completa ? 300 : 120)}`);
  return l.join("\n");
}
export async function contextoEncargo(clase, alumno = null) {
  if (!clase && !alumno) return "";
  const partes = [];
  const grupoId = clase?.grupo_id || alumno?.grupo_id;
  if (grupoId) {
    const { data: g } = await supabase.from("grupos").select("nombre, contexto").eq("id", grupoId).maybeSingle();
    if (g?.contexto?.trim()) partes.push(`CONTEXTO DEL GRUPO ${g.nombre || ""} (escrito por la docente):\n${g.contexto.trim()}`);
  }
  if (clase) partes.push(`DATOS DEL GRUPO:\n${await resumenGrupo(clase)}`);
  if (grupoId) {
    // Las dos últimas sesiones de evaluación del grupo (resumen escrito por la docente)
    try {
      const { data: ev } = await supabase.from("grupo_evaluaciones").select("periodo, resumen, updated_at").eq("grupo_id", grupoId).order("created_at", { ascending: false }).limit(2);
      if (ev?.length) partes.push(`ÚLTIMAS EVALUACIONES DEL GRUPO (tenlas en cuenta: dificultades, acuerdos y propuestas de mejora):\n${ev.map(e => `${e.periodo}:\n${String(e.resumen || "").trim().slice(0, 1500)}`).join("\n\n")}`);
    } catch { /* sin evaluaciones: seguimos */ }
    // Los últimos informes de análisis de resultados (rúbricas, exámenes) del grupo
    try {
      const { data: cl } = await supabase.from("clases").select("id").eq("grupo_id", grupoId);
      const ids = (cl || []).map(c => c.id);
      if (ids.length) {
        const { data: an } = await supabase.from("programaciones").select("titulo, periodo, contenido").in("clase_id", ids).eq("tipo_resultado", "analisis_resultados").order("created_at", { ascending: false }).limit(3);
        if (an?.length) partes.push(`ÚLTIMOS ANÁLISIS DE RESULTADOS DEL GRUPO:\n${an.map(x => `${x.titulo}:\n${String(x.contenido || "").slice(0, 1200)}`).join("\n\n")}`);
      }
    } catch { /* sin análisis: seguimos */ }
  }
  const agenda = await leerAgendaAlumnos();
  if (alumno) {
    partes.push(`ESTE DOCUMENTO ES PARA UN ALUMNO/A CONCRETO (tienes acceso a su ficha, tenga o no NEAE; úsala):\n${fichaAlumno(alumno, agenda, true)}`);
    // Seguimiento registrado por la docente (observaciones, logros, dificultades)
    try {
      const { data: seg } = await supabase.from("seguimiento").select("fecha, tipo, texto").eq("alumno_id", alumno.id).order("fecha", { ascending: false }).limit(12);
      if (seg?.length) partes.push(`SEGUIMIENTO DE ${iniciales(alumno)} (más reciente primero):\n${seg.map(s => `- ${s.fecha} · ${s.tipo}: ${corta(s.texto, 300)}`).join("\n")}`);
    } catch { /* sin seguimiento */ }
    // Asistencia de los últimos 90 días
    try {
      const d = new Date(); d.setDate(d.getDate() - 90);
      const { data: as } = await supabase.from("asistencia").select("fecha, estado").eq("alumno_id", alumno.id).gte("fecha", d.toISOString().slice(0, 10));
      if (as?.length) {
        const n = (e) => as.filter(x => x.estado === e).length;
        partes.push(`ASISTENCIA DE ${iniciales(alumno)} (últimos 90 días): ${n("falta")} faltas, ${n("justificada")} justificadas, ${n("retraso")} retrasos.`);
      }
    } catch { /* sin asistencia */ }
  } else if (clase) {
    let q = supabase.from("alumnos").select("nombre, apellidos, tiene_nee, perfil_nee, notas, agenda_student_id");
    q = clase.grupo_id ? q.eq("grupo_id", clase.grupo_id) : q.eq("clase_id", clase.id);
    const { data } = await q;
    const conNee = (data || []).filter(a => a.tiene_nee).sort((a, b) => iniciales(a).localeCompare(iniciales(b), "es"));
    if (conNee.length) partes.push(`ALUMNADO CON NEAE DEL GRUPO (incluye adaptaciones concretas para cada uno, citándolos solo por sus iniciales):\n${conNee.map(a => fichaAlumno(a, agenda, false)).join("\n")}`);
    partes.push("Si el encargo es sobre un alumno/a concreto cuya ficha no aparece aquí, no digas que no puedes acceder a sus datos: prepara el documento con lo que te hayan contado y añade al principio una línea indicando que, para tener su ficha completa, la docente debe elegirlo en «Alumno/a».");
  }
  return partes.join("\n\n").slice(0, 10000);
}

export async function tokenActual() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

// ── Uso y límites ──────────────────────────────────────────────────────────
export async function miUsoMes() {
  const { data } = await supabase.rpc("mi_uso_mes");
  const r = Array.isArray(data) ? data[0] : data;
  return r ? { usados: r.usados ?? 0, limite: r.limite ?? 30 } : null;
}
export async function adminUsuarios() {
  const { data, error } = await supabase.rpc("admin_usuarios");
  if (error) throw error;
  return data || [];
}
export async function adminPonerLimite(userId, limite) {
  const { error } = await supabase.rpc("admin_poner_limite", { p_user: userId, p_limite: limite });
  if (error) throw error;
}
export async function leerAjustes() {
  const { data } = await supabase.from("ajustes_ia").select("*").eq("id", 1).maybeSingle();
  return data || { id: 1, limite_por_defecto: 30, precio_entrada_millon: 0, precio_salida_millon: 0 };
}
export async function guardarAjustes(a) {
  const { error } = await supabase.from("ajustes_ia").update({
    limite_por_defecto: Number(a.limite_por_defecto) || 0,
    precio_entrada_millon: Number(a.precio_entrada_millon) || 0,
    precio_salida_millon: Number(a.precio_salida_millon) || 0,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  if (error) throw error;
}

// Lo que hay guardado de una evaluación concreta (resumen + informes de resultados),
// para rellenar el acta de esa evaluación.
export async function informesDeEvaluacion(clase, periodos) {
  if (!clase?.grupo_id) return "";
  const partes = [];
  try {
    const { data: ev } = await supabase.from("grupo_evaluaciones").select("periodo, resumen").eq("grupo_id", clase.grupo_id).in("periodo", periodos);
    (ev || []).forEach(e => partes.push(`RESUMEN DE LA ${e.periodo.toUpperCase()} (escrito por la docente):\n${e.resumen}`));
    const { data: cl } = await supabase.from("clases").select("id").eq("grupo_id", clase.grupo_id);
    const ids = (cl || []).map(c => c.id);
    if (ids.length) {
      const { data: an } = await supabase.from("programaciones").select("titulo, contenido").in("clase_id", ids).eq("tipo_resultado", "analisis_resultados").in("periodo", periodos).order("created_at");
      (an || []).forEach(x => partes.push(`INFORME — ${x.titulo}:\n${String(x.contenido || "").slice(0, 5000)}`));
    }
  } catch { /* seguimos sin ellos */ }
  return partes.join("\n\n").slice(0, 20000);
}
