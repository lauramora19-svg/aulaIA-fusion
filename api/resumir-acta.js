// Resume un acta de evaluación (PDF, foto, Word o Excel) para el apartado
// «Evaluaciones» de un grupo. La docente revisa el resumen antes de guardarlo.
export const config = { runtime: "edge" };

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!apiKey || !supabaseUrl || !supabaseKey) return json({ mensaje: "Servidor sin configurar" }, 500);

  const { accessToken, archivo, grupo = "", periodo = "" } = await req.json();
  const uRes = accessToken ? await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` } }).catch(() => null) : null;
  const usuario = uRes?.ok ? await uRes.json() : null;
  if (!usuario?.id) return json({ mensaje: "Tu sesión ha caducado. Vuelve a entrar en AulaIA." }, 401);
  if (!archivo?.data) return json({ mensaje: "No ha llegado ningún archivo." }, 400);

  const hS = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" };
  await fetch(`${supabaseUrl}/rest/v1/uso_ia`, { method: "POST", headers: hS, body: JSON.stringify({ user_id: usuario.id, tipo: "resumen_acta", continuacion: false }) }).catch(() => {});

  const instrucciones = `Eres un asistente de una docente de un colegio español. Te paso el acta de la sesión de evaluación${periodo ? ` (${periodo})` : ""}${grupo ? ` del grupo ${grupo}` : ""}.
Escribe en español un resumen breve y útil para que otra IA lo tenga en cuenta al preparar programaciones y materiales para este grupo. Usa exactamente estos apartados, con viñetas cortas:

Resultados generales:
Dificultades detectadas:
Acuerdos de la junta de evaluación:
Medidas y propuestas de mejora:
Alumnado con seguimiento especial:

Reglas:
- NUNCA escribas nombres ni apellidos de alumnos: usa solo sus iniciales (por ejemplo, «P. A. D.»).
- No incluyas notas numéricas individuales; sí porcentajes o tendencias del grupo.
- Si un apartado no aparece en el acta, escribe «— No consta».
- Máximo unas 250 palabras. Sin introducción ni despedida.`;

  const contenido = [];
  if (archivo.tipo === "pdf") contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo.data } });
  else if (archivo.tipo === "imagen") contenido.push({ type: "image", source: { type: "base64", media_type: archivo.mediaType || "image/jpeg", data: archivo.data } });
  else contenido.push({ type: "text", text: `Contenido del acta:\n\n${String(archivo.data).slice(0, 80000)}` });
  contenido.push({ type: "text", text: instrucciones });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, stream: true, messages: [{ role: "user", content: contenido }] }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return json({ mensaje: "La IA no ha podido leer el acta. " + (t.includes("pdf") ? "Puede que el PDF esté protegido." : "Inténtalo de nuevo.") }, 502);
  }
  return new Response(r.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
