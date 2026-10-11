export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const { contenido, titulo } = await req.json();
  if (!contenido) return new Response(JSON.stringify({ error: "Sin contenido" }), { status: 400 });

  const esc = (s) => (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const boldify = (t) => {
    if (!t) return "";
    const str = String(t);
    if (!str.includes("**")) return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(str)}</w:t></w:r>`;
    const count = (str.match(/\*\*/g)||[]).length;
    let work = str;
    if (count % 2 !== 0) {
      const last = work.lastIndexOf("**");
      work = work.slice(0, last) + work.slice(last + 2);
    }
    const parts = work.split(/\*\*(.+?)\*\*/g);
    return parts.map((p,i) => {
      if (!p) return "";
      return i % 2 === 1
        ? `<w:r><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(p)}</w:t></w:r>`
        : `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(p)}</w:t></w:r>`;
    }).join("");
  };

  // ── TABLA MEJORADA ────────────────────────────────────────────────────────
  const procesarTabla = (lineas, startIdx) => {
    const filas = [];
    let i = startIdx;
    while (i < lineas.length && lineas[i].trim().startsWith("|")) {
      filas.push(lineas[i]);
      i++;
    }
    if (filas.length < 1) return { xml: null, nextIdx: startIdx + 1 };

    // La cabecera es siempre la primera fila
    const cabeceraFila = filas[0];
    const cabecera = cabeceraFila.split("|").filter(c => c.trim()).map(c => c.trim());
    const numCols = cabecera.length;
    if (numCols === 0) return { xml: null, nextIdx: i };

    // Filtrar líneas separadoras (---) y obtener solo filas de datos reales
    const dataFilas = filas
      .slice(1)
      .filter(f => {
        // Eliminar separadores tipo |---|---|
        const sinPipes = f.replace(/\|/g,"").replace(/-/g,"").replace(/:/g,"").replace(/\s/g,"");
        return sinPipes.length > 0;
      })
      .map(f => {
        const celdas = f.split("|").filter((c,idx) => idx > 0 && idx <= numCols).map(c => c.trim());
        while (celdas.length < numCols) celdas.push("");
        return celdas.slice(0, numCols);
      });

    // Ancho total disponible
    const ANCHO_TOTAL = 9360;
    let anchos;
    if (numCols === 1) {
      anchos = [ANCHO_TOTAL];
    } else if (numCols === 2) {
      anchos = [2800, 6560];
    } else if (numCols === 3) {
      anchos = [2600, 3880, 2880];
    } else if (numCols === 4) {
      anchos = [2200, 2386, 2387, 2387];
    } else if (numCols === 5) {
      anchos = [2000, 800, 2186, 2187, 2187];
    } else if (numCols === 6) {
      anchos = [1800, 700, 1765, 1765, 1765, 1765];
    } else {
      const w = Math.floor(ANCHO_TOTAL / numCols);
      anchos = Array(numCols).fill(w);
      anchos[numCols-1] += ANCHO_TOTAL - w * numCols;
    }

    const tblGrid = anchos.map(w => `<w:gridCol w:w="${w}"/>`).join("");

    // Celda de cabecera
    const celdaHeader = (texto, ancho) => `
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="${ancho}" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="f97316"/>
          <w:tcMar>
            <w:top w:w="120" w:type="dxa"/>
            <w:bottom w:w="120" w:type="dxa"/>
            <w:left w:w="160" w:type="dxa"/>
            <w:right w:w="160" w:type="dxa"/>
          </w:tcMar>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:before="0" w:after="0" w:line="276" w:lineRule="auto"/>
            <w:jc w:val="left"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="FFFFFF"/>
              <w:sz w:val="18"/>
              <w:szCs w:val="18"/>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
            </w:rPr>
            <w:t xml:space="preserve">${esc(texto)}</w:t>
          </w:r>
        </w:p>
      </w:tc>`;

    // Celda de datos
    const celdaDato = (texto, ancho, bgColor) => {
      const partes = texto.split(";").map(p => p.trim()).filter(p => p);
      const usarBullets = partes.length > 1;

      const parrafos = (partes.length > 0 ? partes : [""]).map((parte, idx) => `
        <w:p>
          <w:pPr>
            <w:spacing w:before="${idx===0?"60":"40"}" w:after="40" w:line="276" w:lineRule="auto"/>
            ${usarBullets ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : ""}
          </w:pPr>
          ${boldify(parte)}
        </w:p>`).join("");

      return `
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${ancho}" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${bgColor}"/>
            <w:tcMar>
              <w:top w:w="120" w:type="dxa"/>
              <w:bottom w:w="120" w:type="dxa"/>
              <w:left w:w="160" w:type="dxa"/>
              <w:right w:w="160" w:type="dxa"/>
            </w:tcMar>
            <w:vAlign w:val="top"/>
          </w:tcPr>
          ${parrafos}
        </w:tc>`;
    };

    const filaHeaderXML = `
      <w:tr>
        <w:trPr>
          <w:trHeight w:val="560" w:hRule="atLeast"/>
          <w:tblHeader/>
        </w:trPr>
        ${cabecera.map((c, j) => celdaHeader(c, anchos[j])).join("")}
      </w:tr>`;

    const filasDataXML = dataFilas.map((fila, rowIdx) => {
      const bg = rowIdx % 2 === 0 ? "FFFFFF" : "FFF3E0";
      return `
        <w:tr>
          <w:trPr>
            <w:trHeight w:val="480" w:hRule="atLeast"/>
          </w:trPr>
          ${fila.map((cel, j) => celdaDato(cel, anchos[j], bg)).join("")}
        </w:tr>`;
    }).join("");

    const xml = `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="${ANCHO_TOTAL}" w:type="dxa"/>
          <w:tblLayout w:type="fixed"/>
          <w:tblBorders>
            <w:top    w:val="single" w:sz="6" w:space="0" w:color="f97316"/>
            <w:left   w:val="single" w:sz="6" w:space="0" w:color="f97316"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="f97316"/>
            <w:right  w:val="single" w:sz="6" w:space="0" w:color="f97316"/>
            <w:insideH w:val="single" w:sz="2" w:space="0" w:color="FFD0A0"/>
            <w:insideV w:val="single" w:sz="2" w:space="0" w:color="FFD0A0"/>
          </w:tblBorders>
          <w:tblCellMar>
            <w:top    w:w="0" w:type="dxa"/>
            <w:bottom w:w="0" w:type="dxa"/>
            <w:left   w:w="0" w:type="dxa"/>
            <w:right  w:w="0" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        <w:tblGrid>${tblGrid}</w:tblGrid>
        ${filaHeaderXML}
        ${filasDataXML}
      </w:tbl>
      <w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>`;

    return { xml, nextIdx: i };
  };

  // ── PROCESAR LÍNEAS ───────────────────────────────────────────────────────
  const lineas = contenido
    .replace(/---\n✅ Documento completo generado por AulaIA/g,"")
    .replace(/✅ Documento completo generado por AulaIA/g,"")
    .split("\n");

  const paragraphs = [];
  let i = 0;

  while (i < lineas.length) {
    const l = lineas[i];

    // Tabla Markdown
    if (l.trim().startsWith("|") && l.includes("|")) {
      const { xml, nextIdx } = procesarTabla(lineas, i);
      if (xml) { paragraphs.push(xml); i = nextIdx; continue; }
    }

    // Separador --- → solo espacio, sin línea
    if (l.trim() === "---" || l.trim() === "***") {
      paragraphs.push(`<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`);
      i++; continue;
    }

    // Títulos
    if (l.startsWith("# ")) {
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="400" w:after="160"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="36"/><w:szCs w:val="36"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${esc(l.replace(/^# /,"").replace(/\*\*/g,""))}</w:t></w:r></w:p>`);
    } else if (l.startsWith("## ")) {
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="300" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0F766E"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${esc(l.replace(/^## /,"").replace(/\*\*/g,""))}</w:t></w:r></w:p>`);
    } else if (l.startsWith("### ")||l.startsWith("#### ")||l.startsWith("##### ")) {
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading3"/><w:spacing w:before="200" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="f97316"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${esc(l.replace(/^#{1,6} /,"").replace(/\*\*/g,""))}</w:t></w:r></w:p>`);
    }
    // Listas
    else if (l.startsWith("- ")||l.startsWith("* ")) {
      paragraphs.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr>${boldify(l.replace(/^[-*] /,""))}</w:p>`);
    } else if (l.startsWith("  - ")||l.startsWith("  * ")||l.startsWith("    - ")) {
      paragraphs.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="40" w:line="276" w:lineRule="auto"/></w:pPr>${boldify(l.replace(/^\s+[-*] /,""))}</w:p>`);
    } else if (/^\d+\./.test(l)) {
      paragraphs.push(`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr>${boldify(l.replace(/^\d+\.\s*/,""))}</w:p>`);
    }
    // Línea vacía
    else if (l.trim() === "") {
      paragraphs.push(`<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`);
    }
    // Párrafo normal
    else {
      paragraphs.push(`<w:p><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr>${boldify(l)}</w:p>`);
    }
    i++;
  }

  const tituloDoc = titulo || "Programación AulaIA";
  const fecha = new Date().toLocaleDateString("es-ES", { day:"2-digit", month:"long", year:"numeric" });

  const docXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="94A3B8"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
        <w:t>AulaIA · Programación adaptada con IA · ${esc(fecha)}</w:t>
      </w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="400"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/><w:color w:val="1E3A5F"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
        <w:t>${esc(tituloDoc)}</w:t>
      </w:r>
    </w:p>
    ${paragraphs.join("\n")}
    <w:p><w:pPr><w:spacing w:before="480"/></w:pPr></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="94A3B8"/><w:i/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
        <w:t>Generado con AulaIA · Revisa y adapta según tu criterio profesional.</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
    <w:sz w:val="20"/><w:szCs w:val="20"/>
    <w:lang w:val="es-ES"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="20"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="400" w:after="160"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/><w:color w:val="1E3A5F"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="300" w:after="120"/>
      <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="0F766E"/></w:pBdr>
    </w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="0F766E"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="f97316"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
  </w:style>
</w:styles>`;

  const numberingXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="640" w:hanging="320"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="–"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="960" w:hanging="320"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="640" w:hanging="320"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

  const relsXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const mainRelsXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const contentTypesXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  return new Response(JSON.stringify({ docXML, stylesXML, numberingXML, relsXML, mainRelsXML, contentTypesXML, titulo: tituloDoc }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
