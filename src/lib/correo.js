// Correo institucional con el que se abre Gmail (se recuerda en este navegador)
import { supabase } from "./supabase";

const CLAVE = "aulaia-correo-institucional";
let correoSesion = "";
supabase.auth.getSession().then(({ data }) => { correoSesion = data?.session?.user?.email || ""; }).catch(() => {});

export const correoInstitucional = () => {
  try { const c = localStorage.getItem(CLAVE); if (c) return c; } catch { /* sin almacenamiento */ }
  return correoSesion;
};
export const guardarCorreoInstitucional = (c) => { try { localStorage.setItem(CLAVE, (c || "").trim()); } catch { /* sin almacenamiento */ } };
