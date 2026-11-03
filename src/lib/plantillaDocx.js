// Documento oficial del colegio con huecos marcados ({NOMBRE}, {DIAS}, {CASILLA}...).
// AulaIA rellena el Word ORIGINAL sin reescribirlo: el formato queda idéntico.
// Se guarda en el mismo sitio que el modelo de texto, como "docx:" + base64.
//
// Marcas que entiende:
//   {NOMBRE} {DIAS} {HORA_INICIO} {HORA_FIN} {DIA} {MES} {ANIO} {FECHA} {DOCUMENTOS} {OBSERVACIONES}
//   {CASILLA} al principio de cada opción con casilla (□). La elegida se marca (☒) y, si hay
//   detalle, se escribe a continuación (en «Otros:» se escribe ahí el motivo).

const PREFIJO = "docx:";
const MAX = 30000; // lo que admite la base de datos
const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const esPlantillaDocx = (p) => typeof p === "string" && p.startsWith(PREFIJO);

async function cargarJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = resolve; s.onerror = () => reject(new Error("No se ha podido cargar el lector de Word. Revisa la conexión."));
    document.head.appendChild(s);
  });
  return window.JSZip;
}

const aBase64 = (buf) => {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};
const deBase64 = (t) => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const textoDe = (xml) => (xml.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const parrafos = (xml) => xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];

// ¿El Word tiene huecos marcados? Si es así, se guarda tal cual (no lo reescribe la IA).
export async function prepararPlantillaDocx(file) {
  const JSZip = await cargarJSZip();
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("No se ha podido leer el Word.");
  const marcas = textoDe(xml).match(/\{[A-Z_]+\}/g) || [];
  if (!marcas.length) return null; // Word normal: se usa su texto, como hasta ahora
  // Se vuelve a comprimir al máximo para que quepa
  const comprimido = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  const datos = PREFIJO + aBase64(comprimido);
  if (datos.length > MAX) throw new Error("Este Word pesa demasiado para guardarlo como modelo (suele ser por imágenes o logos). Quítalas y vuelve a subirlo: el encabezado se puede añadir aparte.");
  return datos;
}

async function abrir(plantilla) {
  const JSZip = await cargarJSZip();
  const zip = await JSZip.loadAsync(deBase64(plantilla.slice(PREFIJO.length)));
  const xml = await zip.file("word/document.xml").async("string");
  return { zip, xml };
}

// Opciones con casilla, en el orden del documento: [{ i, texto }]
export async function opcionesPlantilla(plantilla) {
  if (!esPlantillaDocx(plantilla)) return [];
  const { xml } = await abrir(plantilla);
  return parrafos(xml).filter(p => textoDe(p).includes("{CASILLA}"))
    .map((p, i) => ({ i, texto: textoDe(p).replace("{CASILLA}", "").trim() }));
}

// Lista con casilla marcada (☒): la que trae el modelo o, si no, una creada a partir de la normal
function numeracionMarcada(numXml, numIdOriginal) {
  const numDe = (abs) => (numXml.match(new RegExp(`<w:num w:numId="(\\d+)"[^>]*>\\s*<w:abstractNumId w:val="${abs}"/>`)) || [])[1];
  const ya = numXml.match(/<w:abstractNum w:abstractNumId="(\d+)"[^>]*>(?:(?!<\/w:abstractNum>)[\s\S])*?<w:lvlText w:val="☒"\/>/);
  if (ya && numDe(ya[1])) return { numXml, numId: numDe(ya[1]) };
  // Crear una copia de la lista original cambiando □ por ☒
  let abs = (numXml.match(new RegExp(`<w:num w:numId="${numIdOriginal}"[^>]*>\\s*<w:abstractNumId w:val="(\\d+)"/>`)) || [])[1];
  if (abs == null) return null;
  let bloque = (numXml.match(new RegExp(`<w:abstractNum w:abstractNumId="${abs}"[^>]*>[\\s\\S]*?</w:abstractNum>`)) || [])[0];
  const enlace = bloque && (bloque.match(/<w:numStyleLink w:val="([^"]+)"\/>/) || [])[1];
  if (enlace) bloque = (numXml.match(new RegExp(`<w:abstractNum [^>]*>(?:(?!</w:abstractNum>)[\\s\\S])*?<w:styleLink w:val="${enlace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"/>[\\s\\S]*?</w:abstractNum>`)) || [])[0];
  if (!bloque) return null;
  const ids = [...numXml.matchAll(/w:abstractNumId="(\d+)"/g)].map(m => +m[1]);
  const nIds = [...numXml.matchAll(/<w:num w:numId="(\d+)"/g)].map(m => +m[1]);
  const nuevoAbs = Math.max(...ids, 0) + 1, nuevoNum = Math.max(...nIds, 0) + 1;
  const copia = bloque.replace(/w:abstractNumId="\d+"/, `w:abstractNumId="${nuevoAbs}"`)
    .replace(/<w:styleLink [^>]*\/>/, "").replace(/<w:nsid [^>]*\/>/, "").replace(/<w:lvlText w:val="[^"]*"\/>/, '<w:lvlText w:val="☒"/>');
  const ultimoAbs = numXml.lastIndexOf("</w:abstractNum>") + "</w:abstractNum>".length;
  numXml = numXml.slice(0, ultimoAbs) + copia + numXml.slice(ultimoAbs);
  numXml = numXml.replace("</w:numbering>", `<w:num w:numId="${nuevoNum}"><w:abstractNumId w:val="${nuevoAbs}"/></w:num></w:numbering>`);
  return { numXml, numId: String(nuevoNum) };
}

// Añade texto al final de un párrafo con el mismo formato que su último trozo
const anadirAlFinal = (p, texto) => {
  const runs = p.match(/<w:r>(?:(?!<\/w:r>)[\s\S])*<\/w:r>/g) || [];
  const rPr = (runs[runs.length - 1]?.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
  const i = p.lastIndexOf("</w:p>");
  return p.slice(0, i) + `<w:r>${rPr}<w:t xml:space="preserve">${esc(texto)}</w:t></w:r>` + p.slice(i);
};

// Firma (imagen PNG) debajo de «Fdo.»: en el hueco {FIRMA} si el modelo lo tiene o, si no,
// en la línea siguiente a la que contiene «Fdo», a la misma altura (mismos tabuladores).
const EMU_CM = 360000;
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
function dibujoFirma(cx, cy) {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="9101" name="Firma"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="9101" name="firma.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdFirmaAulaIA"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
async function ponerFirma(zip, xml, firma) {
  const m = /^data:image\/png;base64,(.+)$/.exec(firma?.png || "");
  if (!m) return xml.replace(/\{FIRMA\}/g, "");
  const ratio = firma.alto && firma.ancho ? firma.alto / firma.ancho : 0.4;
  let cx = Math.round(4.2 * EMU_CM), cy = Math.round(cx * ratio);
  if (cy > 1.6 * EMU_CM) { cy = Math.round(1.6 * EMU_CM); cx = Math.round(cy / ratio); }
  const dib = dibujoFirma(cx, cy);
  let hecho = false;
  if (/\{FIRMA\}/.test(xml)) {
    xml = xml.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*?\{FIRMA\}(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/, (r) => { hecho = true; return r.replace("{FIRMA}", "") + dib; });
  }
  if (!hecho) {
    const ps = parrafos(xml);
    const i = ps.findIndex(p => /Fdo/i.test(textoDe(p)));
    if (i < 0) return xml;
    const p = ps[i];
    const antes = p.slice(0, p.search(/<w:t(?: [^>]*)?>[^<]*Fdo/i));
    const tabs = (antes.match(/<w:tab\/>/g) || []).length;
    const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
    const nuevo = `<w:p>${pPr}${tabs ? `<w:r>${"<w:tab/>".repeat(tabs)}</w:r>` : ""}${dib}</w:p>`;
    const sig = ps[i + 1];
    if (sig && !/<w:t[ >]/.test(sig)) xml = xml.replace(p + sig, p + nuevo); // ocupa la línea vacía de debajo
    else xml = xml.replace(p, p + nuevo);
  }
  if (!/xmlns:wp=/.test(xml.slice(0, 3000))) xml = xml.replace("<w:document ", `<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" `);
  if (!/xmlns:r=/.test(xml.slice(0, 3000))) xml = xml.replace("<w:document ", `<w:document xmlns:r="${NS_R}" `);
  zip.file("word/media/firma_aulaia.png", m[1], { base64: true });
  const relsP = "word/_rels/document.xml.rels";
  let rels = (await zip.file(relsP)?.async("string")) || `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  if (!rels.includes("rIdFirmaAulaIA")) rels = rels.replace("</Relationships>", `<Relationship Id="rIdFirmaAulaIA" Type="${NS_R}/image" Target="media/firma_aulaia.png"/></Relationships>`);
  zip.file(relsP, rels);
  let ct = await zip.file("[Content_Types].xml").async("string");
  if (!/Extension="png"/i.test(ct)) ct = ct.replace("</Types>", `<Default Extension="png" ContentType="image/png"/></Types>`);
  zip.file("[Content_Types].xml", ct);
  return xml;
}

// datos: { NOMBRE, DIAS, HORA_INICIO, HORA_FIN, DIA, MES, ANIO, FECHA, DOCUMENTOS, OBSERVACIONES }
// opcion: índice de la casilla elegida (o null) · detalle: texto que va junto a ella
// Devuelve { blob, texto } (texto = vista previa sencilla del documento relleno)
export async function rellenarPlantilla(plantilla, datos, { opcion = null, detalle = "", firma = null } = {}) {
  const { zip, xml } = await abrir(plantilla);
  let numXml = await zip.file("word/numbering.xml")?.async("string");
  let n = -1;
  const vista = [];
  const rellenar = (t) => t.replace(/\{FIRMA\}/g, firma ? "[firma]" : "").replace(/\{([A-Z_]+)\}/g, (m, k) => (k in datos ? String(datos[k] ?? "") : m));
  let out = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => {
    const plano = (x) => textoDe(x.replace(/<w:tab\/>/g, "<w:t>\t</w:t>"));
    if (!textoDe(p).includes("{CASILLA}")) { vista.push(rellenar(plano(p))); return p; }
    n++;
    let q = p.replace("{CASILLA}", "");
    if (n !== opcion) { vista.push(`☐ ${plano(q).trim()}`); return q; }
    const numId = (q.match(/<w:numId w:val="(\d+)"\/>/) || [])[1];
    const marc = numId && numXml ? numeracionMarcada(numXml, numId) : null;
    if (marc) { numXml = marc.numXml; q = q.replace(/<w:numId w:val="\d+"\/>/, `<w:numId w:val="${marc.numId}"/>`); }
    else q = q.replace(/(<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:t[^>]*>)/, `$1☒ `);
    const d = String(detalle || "").trim();
    if (d) q = anadirAlFinal(q, /:\s*$/.test(textoDe(q)) ? (textoDe(q).endsWith(" ") ? d : ` ${d}`) : ` — ${d}`);
    vista.push(`☒ ${plano(q).trim()}`);
    return q;
  });
  // Huecos de texto (la marca entera está en un mismo trozo del Word)
  out = await ponerFirma(zip, out, firma);
  out = out.replace(/\{([A-Z_]+)\}/g, (m, k) => (k in datos ? esc(datos[k] ?? "") : m));
  zip.file("word/document.xml", out);
  if (numXml) zip.file("word/numbering.xml", numXml);
  const blob = await zip.generateAsync({ type: "blob", mimeType: MIME, compression: "DEFLATE" });
  return { blob, texto: vista.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(nombre || "Documento").replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9 ]/g, "").trim() || "Documento"}.docx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return a.download;
}
