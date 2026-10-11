import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Versión fusionada: la Agenda (que va dentro, en /agenda) usa esta misma conexión
if (typeof window !== "undefined") window.__aulaiaSupabase = supabase;
