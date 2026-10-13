// Lee el horario de uno o varios profesores (PDF, foto, Word o Excel) con IA.
// Solo para el equipo directivo. Devuelve JSON en streaming (SSE de Anthropic).
export const config = { runtime: "edge" };

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!apiKey || !supabaseUrl || !supabaseKey) return json({ mensaje: "Servidor sin configurar" }, 500);

  const { accessToken, etapa, archivo, tramos = [], profesores = [] } = await req.json();

  // ¿Quién lo pide? Tiene que ser del equipo directivo de esa etapa
  const uRes = accessToken ? await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` } }).catch(() => null) : null;
  const usuario = uRes?.ok ? await uRes.json() : null;
  if (!usuario?.id) return json({ mensaje: "Tu sesión ha caducado. Vuelve a entrar en AulaIA." }, 401);
  const etapas = await fetch(`${supabaseUrl}/rest/v1/rpc/sust_etapas`, {
    method: "POST", headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: "{}",
  }).then(r => (r.ok ? r.json() : [])).catch(() => []);
  if (!Array.isArray(etapas) || !etapas.includes(etapa)) return json({ mensaje: "Solo el equipo directivo puede cargar horarios." }, 403);
  if (!archivo?.data) return json({ mensaje: "No ha llegado ningún archivo." }, 400);

  // Apunta el uso (sin límite: es trabajo del centro)
  const hS = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" };
  await fetch(`${supabaseUrl}/rest/v1/uso_ia`, { method: "POST", headers: hS, body: JSON.stringify({ user_id: usuario.id, tipo: "horario_sust", continuacion: false }) }).catch(() => {});

  const listaTramos = tramos.map((t, i) => `- ${t.inicio}–${t.fin}${t.recreo ? " (recreo)" : ""}`).join("\n");
  const instrucciones = `Eres un asistente de jefatura de estudios de un colegio español. Te paso el horario de uno o varios profesores. Extrae TODAS las sesiones semanales de cada profesor.

Tramos horarios de esta etapa:
${listaTramos}

${profesores.length ? `Profesorado ya dado de alta (usa exactamente estos nombres si coinciden): ${profesores.join(", ")}` : ""}

Para cada sesión indica:
- "dia": 1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes.
- "tramo": la hora de INICIO del tramo de la lista de arriba que corresponda (por ejemplo "9:00"). Si en el documento las horas no coinciden exactamente, elige el tramo que más se solape.
- "tipo": "clase" (da clase a un grupo), "guardia", "refuerzo" (apoyo, desdoble, refuerzo), "libre" (hora sin docencia dentro del horario) o "patio" (vigilancia de recreo).
- "grupo", "materia", "aula": como aparezcan (vacío si no aparece).
- "dudoso": true si no estás segura de lo que pone esa casilla.
No incluyas los tramos en los que el profesor no tiene nada.

Responde SOLO con JSON válido, sin texto antes ni después, con esta forma:
{"profesores":[{"nombre":"...","email":"","sesiones":[{"dia":1,"tramo":"9:00","tipo":"clase","grupo":"3.º B","materia":"Lengua","aula":"Aula 3B","dudoso":false}]}]}`;

  const contenido = [];
  if (archivo.tipo === "pdf") contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo.data } });
  else if (archivo.tipo === "imagen") contenido.push({ type: "image", source: { type: "base64", media_type: archivo.mediaType || "image/jpeg", data: archivo.data } });
  else contenido.push({ type: "text", text: `Contenido del documento:\n\n${String(archivo.data).slice(0, 80000)}` });
  contenido.push({ type: "text", text: instrucciones });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 16000, stream: true, messages: [{ role: "user", content: contenido }] }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return json({ mensaje: "La IA no ha podido leer el archivo. " + (t.includes("pdf") ? "Puede que el PDF esté protegido." : "Inténtalo de nuevo.") }, 502);
  }
  return new Response(r.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
