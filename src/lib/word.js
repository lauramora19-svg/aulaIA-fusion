// ─── EXPORTAR WORD ────────────────────────────────────────────────────────────
import { quitarPromptChatGPT } from "./promptChatGPT";
import { obtenerEncabezado } from "./encabezados";

const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const EMU_CM = 360000;

// Encabezado de página con la imagen elegida (se repite en todas las páginas)
function headerXML(cx, cy) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${NS_R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:r><w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Encabezado"/>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>
        <pic:nvPicPr><pic:cNvPr id="1" name="encabezado"/><pic:cNvPicPr/></pic:nvPicPr>
        <pic:blipFill><a:blip r:embed="rIdImgEnc"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
        <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
      </pic:pic></a:graphicData></a:graphic>
    </wp:inline>
  </w:drawing></w:r></w:p>
</w:hdr>`;
}

export function anadirEncabezado(zip, data, enc) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(enc?.imagen || "");
  if (!m) return data;
  const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
  // Cabe en el ancho de la página (17 cm) sin pasar de 3,2 cm de alto
  const ratio = (enc.alto && enc.ancho) ? enc.alto / enc.ancho : 0.2;
  let cx = 17 * EMU_CM, cy = Math.round(cx * ratio);
  if (cy > 3.2 * EMU_CM) { cy = Math.round(3.2 * EMU_CM); cx = Math.round(cy / ratio); }
  zip.file(`word/media/encabezado.${ext}`, m[2], { base64: true });
  zip.file("word/header1.xml", headerXML(cx, cy));
  zip.file("word/_rels/header1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImgEnc" Type="${NS_R}/image" Target="media/encabezado.${ext}"/></Relationships>`);
  let docXML = data.docXML;
  if (!/xmlns:r=/.test(docXML.slice(0, 2000))) docXML = docXML.replace("<w:document ", `<w:document xmlns:r="${NS_R}" `);
  docXML = docXML.replace(/<w:sectPr>/, `<w:sectPr><w:headerReference w:type="default" r:id="rIdHdrEnc"/>`)
    .replace(/<w:pgMar ([^/]*)\/>/, (t, attrs) => attrs.includes("w:header=") ? t : `<w:pgMar ${attrs.trim()} w:header="567" w:footer="567"/>`);
  const relsXML = data.relsXML.replace("</Relationships>", `  <Relationship Id="rIdHdrEnc" Type="${NS_R}/header" Target="header1.xml"/>\n</Relationships>`);
  const contentTypesXML = data.contentTypesXML.replace("</Types>",
    `  <Default Extension="${ext}" ContentType="image/${ext}"/>\n  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n</Types>`);
  return { ...data, docXML, relsXML, contentTypesXML };
}

// opciones: { encabezadoId } o { encabezado: { imagen, ancho, alto } }
export const exportarWordContenido = async (contenidoOriginal, tituloDoc, opciones = {}) => {
  const contenido = quitarPromptChatGPT(contenidoOriginal || "");
  const res = await fetch("/api/exportar-word", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ contenido, titulo: tituloDoc }),
  });
  if (!res.ok) throw new Error("Error exportando");
  let data = await res.json();
  await new Promise((resolve,reject)=>{
    if(window.JSZip){resolve();return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
  });
  const zip=new window.JSZip();
  const enc = opciones.encabezado || (opciones.encabezadoId ? await obtenerEncabezado(opciones.encabezadoId).catch(() => null) : null);
  if (enc) data = anadirEncabezado(zip, data, enc);
  zip.file("[Content_Types].xml",data.contentTypesXML);
  zip.file("_rels/.rels",data.mainRelsXML);
  zip.file("word/document.xml",data.docXML);
  zip.file("word/styles.xml",data.stylesXML);
  zip.file("word/numbering.xml",data.numberingXML);
  zip.file("word/_rels/document.xml.rels",data.relsXML);
  const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`${(tituloDoc || "Documento").replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9 ]/g,"").trim() || "Documento"}.docx`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),10000);
  return a.download;
};
