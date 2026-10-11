// ─── LECTOR DE STREAMING (SSE) ───────────────────────────────────────────────
// Guarda en un búfer las líneas que llegan partidas entre dos fragmentos de red.
// Antes se perdían esos trozos y por eso "se comía" palabras y negritas (**).
export const leerStreamSSE = async (res, onDelta, signal) => {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const procesarLinea = (line) => {
    if (!line.startsWith("data:")) return;
    const s = line.slice(5).trim();
    if (!s || s === "[DONE]") return;
    try {
      const d = JSON.parse(s);
      const txt = d?.type === "content_block_delta" ? (d?.delta?.text || "") : "";
      if (txt) onDelta(txt);
    } catch {}
  };
  while (true) {
    if (signal?.aborted) { try { await reader.cancel(); } catch {} break; }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) procesarLinea(line.replace(/\r$/, ""));
  }
  buffer += decoder.decode();
  if (buffer) procesarLinea(buffer.replace(/\r$/, ""));
};

