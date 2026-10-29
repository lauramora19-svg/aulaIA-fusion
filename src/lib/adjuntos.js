// Fotos o PDF que acompañan un encargo al Equipo docente (p. ej. exámenes para que Rosa los corrija).
// Las fotos se reducen en el navegador para que quepan varias en un mismo envío.
// Los Word (.docx) se convierten a texto (p. ej. una programación ya hecha para actualizarla).
import { textoDeDocx } from "./docx";
export const MAX_TOTAL = 3_800_000; // caracteres en base64 por envío (límite del servidor)

const comoBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(new Error("No se ha podido leer el archivo."));
  r.readAsDataURL(file);
});

const cargarImagen = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se puede abrir «${file.name}». Si es una foto HEIC del iPhone, compártela como JPG (o haz una captura) y vuelve a subirla.`)); };
  img.src = url;
});

export async function prepararAdjunto(file) {
  if (/\.docx$/i.test(file.name)) {
    const texto = (await textoDeDocx(file).catch(() => "")).trim();
    if (!texto) throw new Error(`No se ha podido leer «${file.name}». Ábrelo en Word y guárdalo de nuevo como .docx, o expórtalo a PDF.`);
    return { nombre: file.name, tipo: "texto", mediaType: "text/plain", data: texto.slice(0, 80000), largo: texto.length > 45000, recortado: texto.length > 80000 };
  }
  if (/\.doc$/i.test(file.name)) throw new Error(`«${file.name}» es un Word antiguo (.doc). Ábrelo en Word y guárdalo como .docx o PDF.`);
  if (/\.(txt|md)$/i.test(file.name)) return { nombre: file.name, tipo: "texto", mediaType: "text/plain", data: (await file.text()).slice(0, 80000) };
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > 2_700_000) throw new Error(`«${file.name}» pesa demasiado (máx. 2,5 MB). Mejor sube fotos de las páginas.`);
    return { nombre: file.name, tipo: "pdf", mediaType: "application/pdf", data: await comoBase64(file) };
  }
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) throw new Error(`«${file.name}» no se puede adjuntar. Usa Word (.docx), PDF o fotos.`);
  const img = await cargarImagen(file);
  // Suficiente para leer la letra; ocupa poco
  const max = 1600;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = c.toDataURL("image/jpeg", 0.8);
  return { nombre: file.name, tipo: "imagen", mediaType: "image/jpeg", data: dataUrl.split(",")[1], miniatura: c.toDataURL("image/jpeg", 0.4) };
}

export const pesoTotal = (lista) => lista.reduce((n, a) => n + (a.data?.length || 0), 0);
