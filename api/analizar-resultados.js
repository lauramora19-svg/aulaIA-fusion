// Analiza los resultados de una rúbrica o un examen (PDF, foto, Word o Excel)
// y devuelve un informe para el apartado «Evaluaciones» del grupo.
export const config = { runtime: "edge" };

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!apiKey || !supabaseUrl || !supabaseKey) return json({ mensaje: "Servidor sin configurar" }, 500);

  const { accessToken, archivo, grupo = "", periodo = "", prueba = "", nota = "", area = "", curso = "" } = await req.json();
  const uRes = accessToken ? await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` } }).catch(() => null) : null;
  const usuario = uRes?.ok ? await uRes.json() : null;
  if (!usuario?.id) return json({ mensaje: "Tu sesión ha caducado. Vuelve a entrar en AulaIA." }, 401);
  if (!archivo?.data) return json({ mensaje: "No ha llegado ningún archivo." }, 400);

  const hS = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" };
  await fetch(`${supabaseUrl}/rest/v1/uso_ia`, { method: "POST", headers: hS, body: JSON.stringify({ user_id: usuario.id, tipo: "analisis_resultados", continuacion: false }) }).catch(() => {});

  const instrucciones = `Eres Eva, especialista en evaluación educativa de un colegio español. Te paso los resultados de ${prueba ? `«${prueba}»` : "una prueba"} (rúbrica, examen o registro de calificaciones)${grupo ? ` del grupo ${grupo}` : ""}${area ? `, ${area}` : ""}${curso ? `, ${curso}` : ""}${periodo ? ` (${periodo})` : ""}.
${nota ? `Indicaciones de la docente: ${nota}\n` : ""}
Escribe en español un INFORME DE ANÁLISIS DE RESULTADOS claro y útil, en Markdown, con estos apartados:

## Datos generales
(número de alumnos evaluados, media, distribución por niveles o calificaciones, % que supera la prueba; solo si los datos lo permiten)
## Análisis por criterio, apartado o pregunta
(tabla con | si ayuda: qué se ha logrado mejor y peor)
## Fortalezas del grupo
## Dificultades detectadas
## Alumnado que necesita refuerzo o ampliación
(solo iniciales, p. ej. «P. A. D.», y en qué)
## Propuestas de mejora y decisiones para el aula

Reglas:
- NUNCA escribas nombres ni apellidos completos de alumnos: solo iniciales.
- Usa solo los datos del documento; no inventes cifras. Si algo no se puede calcular, dilo.
- Sé concreta y breve (máximo unas 600 palabras). Sin introducción ni despedida.`;

  const contenido = [];
  if (archivo.tipo === "pdf") contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo.data } });
  else if (archivo.tipo === "imagen") contenido.push({ type: "image", source: { type: "base64", media_type: archivo.mediaType || "image/jpeg", data: archivo.data } });
  else contenido.push({ type: "text", text: `Contenido del documento:\n\n${String(archivo.data).slice(0, 80000)}` });
  contenido.push({ type: "text", text: instrucciones });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, stream: true, messages: [{ role: "user", content: contenido }] }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return json({ mensaje: "La IA no ha podido leer el archivo. " + (t.includes("pdf") ? "Puede que el PDF esté protegido." : "Inténtalo de nuevo.") }, 502);
  }
  return new Response(r.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
