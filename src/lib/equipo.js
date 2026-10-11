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
export function repartir(texto, lista) {
  const t = (texto || "").toLowerCase();
  const m = lista.find(e => e.id !== "coordinadora" && (e.claves || []).some(k => k && t.includes(k.toLowerCase())));
  return m?.id || "coordinadora";
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

export async function tokenActual() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
