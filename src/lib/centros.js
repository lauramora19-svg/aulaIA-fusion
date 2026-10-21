// Varios colegios en la misma plataforma: cada cuenta pertenece a un centro.
import { supabase } from "./supabase";

const chk = ({ data, error }) => { if (error) throw new Error(error.message || "No se ha podido guardar."); return data; };

export async function miCentroInfo() {
  const { data, error } = await supabase.rpc("mi_centro_info");
  if (error) return null;
  return (Array.isArray(data) ? data[0] : data) || null;
}
export async function centroUsuarios() { return chk(await supabase.rpc("centro_usuarios")) || []; }
export async function adminCentros() { return chk(await supabase.rpc("admin_centros")) || []; }
export async function adminGuardarCentro(id, nombre, dominio) {
  return chk(await supabase.rpc("admin_guardar_centro", { p_id: id || null, p_nombre: nombre, p_dominio: dominio || "" }));
}
export async function adminUsuarioCentro(userId, centroId, adminCentro) {
  return chk(await supabase.rpc("admin_usuario_centro", { p_user: userId, p_centro: centroId || null, p_admin_centro: !!adminCentro }));
}
