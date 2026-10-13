// Envía por correo la sustitución al profesor, con su PDF adjunto.
// Solo funciona si en Vercel están RESEND_API_KEY y SUST_EMAIL_FROM.
// Si no, devuelve {enviado:false} y el profesor la ve igualmente en AulaIA.
export const config = { runtime: "edge" };

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const remitente = process.env.SUST_EMAIL_FROM;
  if (!resendKey || !remitente) return json({ enviado: false, motivo: "sin_servicio" });

  const { accessToken, avisoId, pdfBase64 } = await req.json();
  if (!accessToken || !avisoId) return json({ enviado: false, motivo: "datos" }, 400);
  const hU = { apikey: supabaseKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  // Lee el aviso con los permisos de quien envía (la base de datos comprueba que es directivo)
  const aviso = await fetch(`${supabaseUrl}/rest/v1/sust_avisos?id=eq.${encodeURIComponent(avisoId)}&select=*`, { headers: hU }).then(r => (r.ok ? r.json() : [])).then(a => a[0]).catch(() => null);
  if (!aviso) return json({ enviado: false, motivo: "no_encontrado" }, 404);
  const puede = await fetch(`${supabaseUrl}/rest/v1/rpc/sust_puede`, { method: "POST", headers: hU, body: JSON.stringify({ p_etapa: aviso.etapa }) }).then(r => (r.ok ? r.json() : false)).catch(() => false);
  if (puede !== true) return json({ enviado: false, motivo: "permiso" }, 403);

  const fecha = new Date(aviso.fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1c1917;line-height:1.6">
<p>Hola${aviso.nombre ? " " + esc(aviso.nombre.split(" ")[0]) : ""}:</p>
<p>Tienes una sustitución el <strong>${esc(fecha)}</strong>:</p>
<p style="padding:12px 16px;background:#fff7ed;border-radius:10px;font-weight:bold">${esc(aviso.hora)} · ${esc(aviso.grupo)}${aviso.materia ? " · " + esc(aviso.materia) : ""}${aviso.aula ? " · " + esc(aviso.aula) : ""}</p>
<p>Tienes el plan de la sesión en el PDF adjunto y en AulaIA.</p>
<p>Gracias,<br>Jefatura de estudios</p></div>`;

  const body = {
    from: remitente, to: [aviso.email],
    subject: `Sustitución: ${aviso.hora} · ${aviso.grupo}`,
    html,
    ...(pdfBase64 ? { attachments: [{ filename: `Sustitucion_${aviso.fecha}.pdf`, content: pdfBase64 }] } : {}),
  };
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return json({ enviado: !!r?.ok });
}
