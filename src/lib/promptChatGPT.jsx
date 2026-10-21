import { useState } from "react";

// Fichas, materiales y exámenes llevan al final un prompt para que ChatGPT cree
// la ficha completa (maquetación + imágenes). Aquí se extrae y se copia.
export const MARCA_PROMPT = "## 🎨 Prompt para ChatGPT";
const FIRMAS = /\n?---\n?(✅ Documento completo generado por AulaIA|⚠️[^\n]*)\s*$/;

export const extraerPromptChatGPT = (texto = "") => {
  const i = texto.indexOf(MARCA_PROMPT);
  if (i < 0) return "";
  return texto.slice(i + MARCA_PROMPT.length)
    .replace(FIRMAS, "")
    .split("\n")
    .filter(l => !/^copia (este|el) (texto|prompt)/i.test(l.trim()))
    .join("\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
};

// El documento sin la sección del prompt (para el Word o para copiar la ficha)
export const quitarPromptChatGPT = (texto = "") => {
  const i = texto.indexOf(MARCA_PROMPT);
  return i < 0 ? texto : texto.slice(0, i).replace(/\n+(---\s*)?$/, "").trimEnd();
};

export function BotonPromptChatGPT({ texto, pequeno = false }) {
  const [copiado, setCopiado] = useState(false);
  const prompt = extraerPromptChatGPT(texto);
  if (!prompt) return null;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(prompt); }
    catch {
      const ta = document.createElement("textarea"); ta.value = prompt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* sin portapapeles */ }
      ta.remove();
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  };
  return (
    <button className="btn-copy" style={pequeno ? { padding: "5px 12px", fontSize: 12 } : undefined} onClick={copiar}
      title="Copia el prompt y pégalo en ChatGPT para que cree la ficha completa con sus imágenes">
      {copiado ? "✅ Prompt copiado" : "🎨 Copiar prompt para ChatGPT"}
    </button>
  );
}
