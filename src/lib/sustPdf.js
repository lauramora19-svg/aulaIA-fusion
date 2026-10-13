// PDFs del gestor de sustituciones: cuadro del día (en color) y hoja individual.
import { etapaDe, fechaLarga } from "./sustituciones";

// Un color por profesor sustituto (el mismo en todas sus horas del día)
const PALETA = [
  { fondo: [239, 246, 255], borde: [147, 197, 253], fuerte: [29, 78, 216], texto: [30, 58, 138] },
  { fondo: [255, 247, 237], borde: [253, 186, 116], fuerte: [234, 88, 12], texto: [124, 45, 18] },
  { fondo: [240, 253, 250], borde: [94, 234, 212], fuerte: [15, 118, 110], texto: [19, 78, 74] },
  { fondo: [250, 245, 255], borde: [216, 180, 254], fuerte: [126, 34, 206], texto: [88, 28, 135] },
  { fondo: [253, 242, 248], borde: [249, 168, 212], fuerte: [190, 24, 93], texto: [131, 24, 67] },
  { fondo: [254, 252, 232], borde: [253, 224, 71], fuerte: [161, 98, 7], texto: [113, 63, 18] },
  { fondo: [236, 253, 245], borde: [110, 231, 183], fuerte: [4, 120, 87], texto: [6, 78, 59] },
  { fondo: [241, 245, 249], borde: [148, 163, 184], fuerte: [51, 65, 85], texto: [30, 41, 59] },
];
const GRIS = { fondo: [250, 250, 249], borde: [214, 211, 209], fuerte: [120, 113, 108], texto: [68, 64, 60] };

async function nuevoPdf(orientation) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  return { doc: new jsPDF({ orientation, unit: "mm", format: "a4" }), autoTable };
}
const limpiar = (s) => String(s ?? "").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF\n-]/g, "");

// filas: [{ hora, grupo, materia, aula, ausente, sustituto, obs }]
export async function pdfCuadro({ etapa, fecha, filas, completa, centro }) {
  const { doc, autoTable } = await nuevoPdf("landscape");
  const E = etapaDe(etapa);
  const W = 297, M = 14;

  // Colores por sustituto
  const colorDe = {}, cuenta = {};
  filas.forEach(f => {
    const k = f.sustituto || "";
    if (k && !(k in colorDe)) colorDe[k] = PALETA[Object.keys(colorDe).length % PALETA.length];
    cuenta[k] = (cuenta[k] || 0) + 1;
  });
  const col = (f) => (f.sustituto ? colorDe[f.sustituto] : GRIS);

  // Cabecera de color de la etapa
  doc.setFillColor(...E.color); doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text(limpiar((centro ? centro.toUpperCase() + " · " : "") + E.largo.toUpperCase()), M, 10);
  doc.setFontSize(20); doc.text("Sustituciones del día", M, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  const fl = fechaLarga(fecha); doc.text(limpiar(fl.charAt(0).toUpperCase() + fl.slice(1)), M, 28);
  // Sello
  const sello = completa ? "CONFIDENCIAL · EQUIPO DIRECTIVO" : "SALA DE PROFESORES";
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  const sw = doc.getTextWidth(sello) + 8;
  doc.setFillColor(255, 255, 255); doc.roundedRect(W - M - sw, 6, sw, 7, 1.5, 1.5, "F");
  doc.setTextColor(...(completa ? [153, 27, 27] : E.color)); doc.text(sello, W - M - sw + 4, 10.8);
  // Contadores
  const nProf = Object.keys(colorDe).length;
  [[String(filas.length), "HORAS"], [String(nProf), "SUSTITUYEN"]].forEach(([n, l], i) => {
    const x = W - M - 24 - (1 - i) * 27;
    doc.setFillColor(...E.color.map(v => Math.round(v + (255 - v) * 0.2))); doc.roundedRect(x, 16, 24, 14, 2, 2, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text(n, x + 12, 23.5, { align: "center" });
    doc.setFontSize(6.5); doc.text(l, x + 12, 27.5, { align: "center" });
  });

  // Leyenda: quién sustituye hoy
  let x = M, y = 42;
  doc.setTextColor(87, 83, 78); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
  doc.text("QUIÉN SUSTITUYE HOY", x, y + 1); x += doc.getTextWidth("QUIÉN SUSTITUYE HOY") + 4;
  Object.entries(colorDe).forEach(([nombre, c]) => {
    const t = limpiar(`${nombre} · ${cuenta[nombre]} ${cuenta[nombre] === 1 ? "hora" : "horas"}`);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    const w = doc.getTextWidth(t) + 11;
    if (x + w > W - M) { x = M; y += 8; }
    doc.setFillColor(...c.fondo); doc.setDrawColor(...c.borde); doc.roundedRect(x, y - 3.6, w, 6.4, 3.2, 3.2, "FD");
    doc.setFillColor(...c.fuerte); doc.circle(x + 3.6, y - 0.4, 1.4, "F");
    doc.setTextColor(...c.texto); doc.text(t, x + 6.5, y + 0.6);
    x += w + 3;
  });

  // Tabla
  const cab = ["Hora", "Grupo · Área", "Aula", ...(completa ? ["Ausente"] : []), "Sustituye", "Observaciones"];
  const iSust = completa ? 4 : 3;
  const cuerpo = filas.map(f => [f.hora, `${f.grupo}${f.materia ? " · " + f.materia : ""}`, f.aula || "", ...(completa ? [f.ausente || ""] : []), f.sustituto || "Sin cubrir", f.obs || ""].map(limpiar));
  autoTable(doc, {
    startY: y + 7, head: [cab], body: cuerpo, theme: "plain", margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 }, textColor: [28, 25, 23], valign: "middle" },
    headStyles: { fontSize: 7.5, fontStyle: "bold", textColor: [87, 83, 78], fillColor: [255, 255, 255] },
    columnStyles: completa
      ? { 0: { cellWidth: 26, fontStyle: "bold" }, 2: { cellWidth: 30 }, 3: { cellWidth: 32 }, 4: { cellWidth: 40 }, 5: { cellWidth: 62, fontSize: 8 } }
      : { 0: { cellWidth: 26, fontStyle: "bold" }, 2: { cellWidth: 34 }, 3: { cellWidth: 44 }, 4: { cellWidth: 74, fontSize: 8 } },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const c = col(filas[d.row.index]);
      d.cell.styles.fillColor = c.fondo;
      if (d.column.index === 0) d.cell.styles.textColor = c.texto;
      if (d.column.index === iSust) { d.cell.styles.fontStyle = "bold"; d.cell.styles.textColor = c.fuerte; }
      if (completa && d.column.index === 3) d.cell.styles.textColor = [87, 83, 78];
    },
    didDrawCell: (d) => {
      if (d.section !== "body") return;
      const c = col(filas[d.row.index]);
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.9); doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      if (d.column.index === 0) { doc.setFillColor(...c.fuerte); doc.rect(d.cell.x, d.cell.y, 1.6, d.cell.height - 0.45, "F"); }
    },
    didDrawPage: () => {
      doc.setDrawColor(231, 229, 228); doc.setLineWidth(0.2); doc.line(M, 199, W - M, 199);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(87, 83, 78);
      doc.text(completa ? "Documento interno del equipo directivo. Contiene datos personales: no exponer ni reenviar." : "Sin el nombre del profesorado ausente ni el motivo de la ausencia.", M, 203);
      doc.text("Generado con AulaIA", W - M, 203, { align: "right" });
    },
  });
  return doc;
}

// Hoja individual que recibe el profesor sustituto (A4 vertical)
export async function pdfAviso(a, centro) {
  const { doc } = await nuevoPdf("portrait");
  const E = etapaDe(a.etapa);
  const W = 210, M = 18;
  doc.setFillColor(...E.color); doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text(limpiar((centro ? centro.toUpperCase() + " · " : "") + E.largo.toUpperCase()), M, 11);
  doc.setFontSize(20); doc.text("Hoja de sustitución", M, 22);

  const caja = (x, y, w, etiqueta, valor) => {
    doc.setFillColor(250, 250, 249); doc.setDrawColor(231, 229, 228); doc.roundedRect(x, y, w, 18, 2, 2, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(87, 83, 78); doc.text(etiqueta, x + 4, y + 6.5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(28, 25, 23); doc.text(limpiar(valor), x + 4, y + 13.5, { maxWidth: w - 8 });
  };
  const fl = fechaLarga(a.fecha);
  const w2 = (W - 2 * M - 6) / 2;
  caja(M, 40, w2, "Día", fl.charAt(0).toUpperCase() + fl.slice(1));
  caja(M + w2 + 6, 40, w2, "Hora", a.hora || "");
  caja(M, 62, w2, "Grupo y área", `${a.grupo || ""}${a.materia ? " · " + a.materia : ""}`);
  caja(M + w2 + 6, 62, w2, "Aula", a.aula || "");

  let y = 96;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...E.color); doc.text("Plan de la sesión", M, y);
  y += 3; doc.setDrawColor(...E.color); doc.setLineWidth(0.6); doc.line(M, y, M + 40, y);
  y += 8; doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(28, 25, 23);
  const plan = (a.plan || "").trim() || "Jefatura no ha dejado indicaciones. Pide al grupo que continúe con la tarea del día o con lectura.";
  doc.splitTextToSize(limpiar(plan), W - 2 * M).forEach(l => { if (y > 270) { doc.addPage(); y = 20; } doc.text(l, M, y); y += 6; });

  doc.setFontSize(8); doc.setTextColor(120, 113, 108);
  doc.text("Documento personal de la sustitución. No incluye quién falta ni el motivo.", M, 287);
  doc.text("Generado con AulaIA", W - M, 287, { align: "right" });
  return doc;
}

export const pdfBase64 = (doc) => doc.output("datauristring").split(",")[1];
