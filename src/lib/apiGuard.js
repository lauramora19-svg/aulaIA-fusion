// Todas las llamadas a /api/generar llevan la sesión del usuario (para el
// contador de uso). Si se llega al límite del mes, avisa a la app.
import { supabase } from "./supabase";

const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (!url.includes("/api/generar")) return fetchOriginal(input, init);
  if (init && typeof init.body === "string") {
    try {
      const b = JSON.parse(init.body);
      if (!b.accessToken) {
        const { data } = await supabase.auth.getSession();
        b.accessToken = data.session?.access_token || null;
        init = { ...init, body: JSON.stringify(b) };
      }
    } catch { /* cuerpo no JSON: se envía tal cual */ }
  }
  const res = await fetchOriginal(input, init);
  if (res.status === 429 || res.status === 401) {
    const info = await res.clone().json().catch(() => ({}));
    window.dispatchEvent(new CustomEvent("aulaia-limite", { detail: { ...info, status: res.status } }));
  } else if (res.ok) {
    window.dispatchEvent(new Event("aulaia-uso"));
  }
  return res;
};
