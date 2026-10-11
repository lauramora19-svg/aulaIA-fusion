// ─── EXPORTAR WORD ────────────────────────────────────────────────────────────
export const exportarWordContenido = async (contenido, tituloDoc) => {
  const res = await fetch("/api/exportar-word", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ contenido, titulo: tituloDoc }),
  });
  if (!res.ok) throw new Error("Error exportando");
  const data = await res.json();
  await new Promise((resolve,reject)=>{
    if(window.JSZip){resolve();return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
  });
  const zip=new window.JSZip();
  zip.file("[Content_Types].xml",data.contentTypesXML);
  zip.file("_rels/.rels",data.mainRelsXML);
  zip.file("word/document.xml",data.docXML);
  zip.file("word/styles.xml",data.stylesXML);
  zip.file("word/numbering.xml",data.numberingXML);
  zip.file("word/_rels/document.xml.rels",data.relsXML);
  const blob=await zip.generateAsync({type:"blob"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`${tituloDoc.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9 ]/g,"").trim()}.docx`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
};

