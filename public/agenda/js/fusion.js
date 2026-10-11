/* ==========================================================================
   Puente entre la Agenda y AulaIA (versión fusionada).
   No cambia cómo funciona la Agenda: solo la conecta con el menú de AulaIA.
   ========================================================================== */
(function () {
  document.body.classList.add('embebida');
  const padre = (() => { try { return window.parent !== window ? window.parent : null; } catch (e) { return null; } })();

  // Cerrar sesión → lo hace AulaIA
  const esperarAuth = setInterval(() => {
    if (!window.authGate) return;
    clearInterval(esperarAuth);
    window.authGate.signOut = () => padre && padre.__aulaiaSignOut ? padre.__aulaiaSignOut() : location.replace('/');
  }, 50);

  // Avisar a AulaIA de la sección activa (para marcarla en el menú)
  const esperarApp = setInterval(() => {
    if (!window.app || !window.app.switchView) return;
    clearInterval(esperarApp);
    const original = window.app.switchView.bind(window.app);
    window.app.switchView = (v) => { original(v); padre && padre.__aulaiaAgendaVista && padre.__aulaiaAgendaVista(v); };
    padre && padre.__aulaiaAgendaLista && padre.__aulaiaAgendaLista();
  }, 50);

  // «Ver sesión en AulaIA» → abre el documento dentro de la misma app
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="?doc="]');
    if (!a || !padre || !padre.__aulaiaAbrirDoc) return;
    e.preventDefault(); e.stopPropagation();
    padre.__aulaiaAbrirDoc(new URL(a.href, location.href).searchParams.get('doc'));
  }, true);

  // AulaIA pide comprobar cambios (p. ej. al volver al horario tras programar)
  window.__agendaRefrescar = async () => {
    try { if (window.store && window.app && await window.store.refreshIfRemoteChanged()) window.app.refreshAll(); } catch (e) { console.error(e); }
  };
})();
