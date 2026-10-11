// Renderizado del Markdown que devuelve la IA (títulos, listas, tablas y **negritas**)
export const parseBold = (text) => {
  if (!text || typeof text !== 'string') return text;
  if (!text.includes('**')) return text;
  const count = (text.match(/\*\*/g) || []).length;
  let workText = text;
  if (count % 2 !== 0) {
    const lastIdx = workText.lastIndexOf('**');
    workText = workText.slice(0, lastIdx) + workText.slice(lastIdx + 2);
  }
  const result = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0, match, key = 0;
  while ((match = regex.exec(workText)) !== null) {
    if (match.index > lastIndex) result.push(workText.slice(lastIndex, match.index));
    result.push(<strong key={key++} style={{fontWeight:700}}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < workText.length) result.push(workText.slice(lastIndex));
  return result.length > 0 ? result : workText;
};

const renderTabla = (lineas, startIdx) => {
  const filas = [];
  let i = startIdx;
  while (i < lineas.length && lineas[i].includes("|")) { filas.push(lineas[i]); i++; }
  if (filas.length < 2) return { elemento: null, nextIdx: startIdx + 1 };
  const cabecera = filas[0].split("|").filter(c => c.trim()).map(c => c.trim());
  const dataFilas = filas.slice(2).map(f => f.split("|").filter(c => c.trim()).map(c => c.trim()));
  const tabla = (
    <div key={startIdx} style={{overflowX:"auto", margin:"12px 0"}}>
      <table className="r-table">
        <thead><tr>{cabecera.map((c,j)=><th key={j}>{parseBold(c)}</th>)}</tr></thead>
        <tbody>{dataFilas.map((fila,j)=><tr key={j}>{fila.map((cel,k)=><td key={k}>{parseBold(cel)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  return { elemento: tabla, nextIdx: i };
};

const normalizarLinea = (l) => l.replace(/^(#{1,6})([^ #\n])/, '$1 $2');

export const renderResultado = (texto) => {
  const textoLimpio = texto
    .replace(/\n?---\n?✅ Documento completo generado por AulaIA\s*$/,"")
    .replace(/\n?---\n?⚠️[^\n]*$/,"")
    .trimEnd();
  const lineas = textoLimpio.split("\n");
  const elementos = [];
  let i = 0;
  while (i < lineas.length) {
    const l = normalizarLinea(lineas[i]);
    if (l.includes("|") && l.trim().startsWith("|")) {
      const { elemento, nextIdx } = renderTabla(lineas, i);
      if (elemento) { elementos.push(elemento); i = nextIdx; continue; }
    }
    if (l.trim()==="---"||l.trim()==="***"||l.trim()==="___")
      elementos.push(<br key={i}/>);
    else if (l.startsWith("#### ")||l.startsWith("##### ")||l.startsWith("###### "))
      elementos.push(<h3 key={i} className="r-h3">{parseBold(l.replace(/^#{4,6} /,""))}</h3>);
    else if (l.startsWith("### "))
      elementos.push(<h3 key={i} className="r-h3">{parseBold(l.replace(/^### /,""))}</h3>);
    else if (l.startsWith("## "))
      elementos.push(<h2 key={i} className="r-h2">{parseBold(l.replace(/^## /,""))}</h2>);
    else if (l.startsWith("# "))
      elementos.push(<h1 key={i} className="r-h1">{parseBold(l.replace(/^# /,""))}</h1>);
    else if (l.startsWith("- ")||l.startsWith("* "))
      elementos.push(<p key={i} className="r-li">• {parseBold(l.replace(/^[-*] /,""))}</p>);
    else if (l.startsWith("  - ")||l.startsWith("  * ")||l.startsWith("    - "))
      elementos.push(<p key={i} className="r-li" style={{paddingLeft:28}}>◦ {parseBold(l.replace(/^\s+[-*] /,""))}</p>);
    else if (/^\d+\./.test(l))
      elementos.push(<p key={i} className="r-li">{parseBold(l)}</p>);
    else if (l.trim()==="")
      elementos.push(<br key={i}/>);
    else
      elementos.push(<p key={i} className="r-p">{parseBold(l)}</p>);
    i++;
  }
  return elementos;
};

