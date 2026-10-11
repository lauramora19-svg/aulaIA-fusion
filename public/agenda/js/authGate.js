/* ==========================================================================
   AuthGate — pantalla de acceso (registro/login) antes de mostrar AulaAI.
   Sistema de cuentas propio de esta Agenda, independiente de AulaIA.
   ========================================================================== */

(function () {
  function showAuthScreen() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
  }

  function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-container').style.display = '';
  }

  async function startAppFor(userId, email) {
    document.getElementById('auth-box').innerHTML = `
      <div class="auth-card">
        <p style="text-align:center; color: var(--text-secondary);">Cargando tus datos…</p>
      </div>
    `;
    await window.store.loadFromCloud(userId);
    window.currentUserEmail = email;
    showApp();
    window.app = new AppController();
  }

  function renderAuthForm(mode, message) {
    const box = document.getElementById('auth-box');
    if (!box) return;
    box.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <div class="student-avatar" style="width:48px;height:48px;font-size:1.3rem;">
            <i class="fa-solid fa-graduation-cap"></i>
          </div>
          <div>
            <div style="font-family: var(--font-display); font-weight:700; font-size:1.3rem;">AulaAI</div>
            <div style="font-size:0.72rem; font-weight:700; color: var(--accent-primary); letter-spacing: 0.5px;">AGENDA DOCENTE</div>
          </div>
        </div>

        <p style="color: var(--text-secondary); font-size: 0.86rem; margin: 0.75rem 0 1rem;">
          Accede con tu cuenta. Cada docente tiene su propio horario, alumnado y programación — separados del resto.
        </p>

        <div class="form-group">
          <label class="form-label">Correo</label>
          <input type="email" id="auth-email" class="form-input" placeholder="tucorreo@ejemplo.com">
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" id="auth-password" class="form-input" placeholder="••••••••" minlength="6">
        </div>

        ${message ? `
          <p style="font-size: 0.82rem; margin-bottom: 0.75rem; color: ${message.error ? '#b91c1c' : '#047857'}; background: ${message.error ? '#fef2f2' : '#ecfdf5'}; padding: 8px 12px; border-radius: var(--radius-md);">
            ${message.text}
          </p>
        ` : ''}

        <button class="btn btn-primary" style="width:100%;" onclick="window.authGate.submit('${mode}')">
          ${mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
        </button>
        <button class="btn btn-outline" style="width:100%; margin-top: 0.6rem;" onclick="window.authGate.toggleMode()">
          ${mode === 'signup' ? '¿Ya tienes cuenta? Entrar' : '¿No tienes cuenta? Crear una'}
        </button>
      </div>
    `;
  }

  window.authGate = {
    mode: 'signin',

    toggleMode() {
      this.mode = this.mode === 'signin' ? 'signup' : 'signin';
      renderAuthForm(this.mode);
    },

    async submit(mode) {
      const email = (document.getElementById('auth-email').value || '').trim();
      const password = document.getElementById('auth-password').value || '';

      if (!window.supabaseConfigured) {
        renderAuthForm(mode, { error: true, text: 'Falta configurar Supabase: edita js/supabaseClient.js con la URL y la clave de tu proyecto (ver README-DESPLIEGUE.md).' });
        return;
      }
      if (!email || !password) {
        renderAuthForm(mode, { error: true, text: 'Rellena correo y contraseña.' });
        return;
      }
      if (password.length < 6) {
        renderAuthForm(mode, { error: true, text: 'La contraseña debe tener al menos 6 caracteres.' });
        return;
      }

      if (mode === 'signup') {
        const { error } = await window.sb.auth.signUp({ email, password });
        if (error) {
          renderAuthForm(mode, { error: true, text: error.message });
          return;
        }
        renderAuthForm('signin', { error: false, text: 'Cuenta creada. Si tu proyecto de Supabase pide confirmar el correo, revisa tu bandeja antes de entrar. Si no, ya puedes iniciar sesión.' });
      } else {
        const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
        if (error) {
          renderAuthForm(mode, { error: true, text: error.message });
          return;
        }
        startAppFor(data.user.id, data.user.email);
      }
    },

    signOut() {
      if (window.sb) window.sb.auth.signOut();
      location.reload();
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseConfigured) {
      renderAuthForm('signin', { error: true, text: 'Falta configurar Supabase: edita js/supabaseClient.js con la URL y la clave de tu proyecto (ver README-DESPLIEGUE.md).' });
      showAuthScreen();
      return;
    }

    const { data } = await window.sb.auth.getSession();
    if (data.session) {
      startAppFor(data.session.user.id, data.session.user.email);
    } else {
      renderAuthForm('signin');
      showAuthScreen();
    }
  });
})();
