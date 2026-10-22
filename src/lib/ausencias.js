// Comunicar una ausencia del docente al equipo directivo de su centro
import { supabase } from "./supabase";

const chk = ({ data, error }) => { if (error) throw new Error(error.message || "No se ha podido guardar."); return data; };

export const destinatariosCentro = async () => chk(await supabase.rpc("centro_destinatarios")) || [];
export const plantillaAusencia = async () => { const { data, error } = await supabase.rpc("centro_plantilla_ausencia"); return error ? "" : (data || ""); };
export const guardarPlantillaAusencia = async (texto) => chk(await supabase.rpc("centro_guardar_plantilla_ausencia", { p_texto: texto }));

export const MARCA_MOTIVO = "[MOTIVO]";
// El motivo no se guarda en AulaIA: solo va en el Word y en el correo
export const conMotivo = (doc, motivo) => doc.split(MARCA_MOTIVO).join(motivo?.trim() || "(se indicará personalmente)");
export const sinMotivo = (doc) => doc.split(MARCA_MOTIVO).join("(indicado en el correo)");

export async function enviarAvisos({ destinatarios, deNombre, desde, hasta, horario, documento }) {
  if (!destinatarios.length) return [];
  return chk(await supabase.from("avisos_ausencia").insert(destinatarios.map(d => ({
    para_user: d.id, de_nombre: (deNombre || "").slice(0, 120), desde, hasta: hasta || null, horario: (horario || "").slice(0, 200), documento: sinMotivo(documento).slice(0, 30000),
  }))).select("id"));
}

export async function avisosRecibidos() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const desde = new Date(); desde.setDate(desde.getDate() - 45);
  const { data, error } = await supabase.from("avisos_ausencia").select("*").eq("para_user", user.id)
    .or(`leido_at.is.null,created_at.gte.${desde.toISOString()}`).order("created_at", { ascending: false }).limit(30);
  if (error) return [];
  return data || [];
}
export async function avisosEnviados() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("avisos_ausencia").select("id, para_user, desde, hasta, horario, leido_at, created_at").eq("de_user", user.id).order("created_at", { ascending: false }).limit(40);
  return data || [];
}
// Borra una comunicación enviada (por error o de prueba): desaparece también del Inicio del equipo directivo
export async function borrarAvisos(ids) {
  const { data, error } = await supabase.from("avisos_ausencia").delete().in("id", ids).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No se ha podido borrar.");
}
export const marcarLeido = async (id) => chk(await supabase.from("avisos_ausencia").update({ leido_at: new Date().toISOString() }).eq("id", id));

const f = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
export const fechasAusencia = (desde, hasta) => (hasta && hasta !== desde) ? `del ${f(desde)} al ${f(hasta)}` : `el ${f(desde)}`;
