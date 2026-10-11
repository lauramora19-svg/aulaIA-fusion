/* ==========================================================================
   Versión FUSIONADA: la Agenda vive dentro de AulaIA y usa su misma conexión
   (misma base de datos y misma cuenta). Ya no tiene login propio.
   ========================================================================== */
(function () {
  let sb = null;
  try { if (window.parent !== window) sb = window.parent.__aulaiaSupabase || null; } catch (e) { sb = null; }
  if (!sb) { location.replace('/'); } // abierta suelta → a AulaIA
  window.sb = sb;
  window.supabaseConfigured = !!sb;
})();
