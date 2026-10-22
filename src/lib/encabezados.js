// Encabezados / logos a medida (fundación, colegio...) para exámenes, circulares y comunicados.
// Se guardan ya reducidos como imagen (data URL) y los ve todo el profesorado del mismo centro.
import { supabase } from "./supabase";

const cache = new Map();
const chk = ({ data, error }) => { if (error) throw new Error(error.message || "No se ha podido guardar."); return data; };

export async function listarEncabezados() {
  const lista = chk(await supabase.from("encabezados").select("id, nombre, imagen, ancho, alto, user_id, created_at").order("created_at")) || [];
  lista.forEach(e => cache.set(e.id, e));
  return lista;
}

export async function obtenerEncabezado(id) {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  const { data } = await supabase.from("encabezados").select("id, nombre, imagen, ancho, alto").eq("id", id).maybeSingle();
  if (data) cache.set(id, data);
  return data || null;
}

// Reduce la imagen en el navegador (máx. 2000 px de ancho) para que el Word no pese
const leerImagen = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se ha podido leer la imagen. Usa un PNG o un JPG.")); };
  img.src = url;
});

export async function prepararImagen(file) {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error("Sube una imagen PNG o JPG (por ejemplo, el logo o una captura del encabezado).");
  const img = await leerImagen(file);
  let ancho = img.naturalWidth, alto = img.naturalHeight;
  if (!ancho || !alto) throw new Error("La imagen está vacía.");
  for (const max of [2000, 1500, 1100, 800]) {
    const k = Math.min(1, max / ancho);
    const w = Math.round(ancho * k), h = Math.round(alto * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const png = /png|gif|webp/i.test(file.type);
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.88);
    if (dataUrl.length < 1400000) return { imagen: dataUrl, ancho: w, alto: h };
  }
  throw new Error("La imagen es demasiado grande. Prueba con una más pequeña.");
}

export async function subirEncabezado(file, nombre) {
  const { imagen, ancho, alto } = await prepararImagen(file);
  const e = chk(await supabase.from("encabezados").insert({ nombre: (nombre || file.name.replace(/\.[^.]+$/, "")).slice(0, 80), imagen, ancho, alto }).select("id, nombre, imagen, ancho, alto, user_id, created_at").single());
  cache.set(e.id, e);
  return e;
}

export async function borrarEncabezado(id) {
  const { data, error } = await supabase.from("encabezados").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Solo puede quitarlo quien lo subió o quien administra el centro.");
  cache.delete(id);
}
