import { useState } from "react";
import { supabase } from "../lib/supabase";
import "../auth.css";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "ok"|"err", text }

  const handle = async () => {
    setLoading(true);
    setMsg(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: "err", text: "Email o contraseña incorrectos. Si todavía no tienes cuenta, pulsa «¿No tienes cuenta? Regístrate»." });

    } else if (mode === "register") {
      if (password.length < 8) {
        setMsg({ type: "err", text: "La contraseña debe tener al menos 8 caracteres." });
        setLoading(false); return;
      }
      // Solo pueden registrarse los correos de los colegios dados de alta en AulaIA
      const correo = email.trim().toLowerCase();
      const { data: permitido, error: errDominio } = await supabase.rpc("dominio_permitido", { p_email: correo });
      if (errDominio) {
        setMsg({ type: "err", text: "No se ha podido comprobar tu correo. Inténtalo de nuevo en un momento." });
        setLoading(false); return;
      }
      if (!permitido) {
        setMsg({ type: "err", text: "Tu colegio todavía no está dado de alta en AulaIA. Regístrate con el correo de tu centro o pide a tu colegio que se ponga en contacto con AulaIA." });
        setLoading(false); return;
      }
      const { data, error } = await supabase.auth.signUp({ email: correo, password });
      if (error) setMsg({ type: "err", text: "Este email ya está registrado o no es válido." });
      // Si la cuenta queda activa al momento, entra directamente; si no, hay que confirmar el correo
      else if (data?.session) setMsg({ type: "ok", text: "¡Cuenta creada! Entrando en AulaIA…" });
      else setMsg({ type: "ok", text: "¡Cuenta creada! Ya puedes entrar con tu correo y tu contraseña." });

    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setMsg({ type: "err", text: "No se pudo enviar el email." });
      else setMsg({ type: "ok", text: "Email de recuperación enviado. Revisa tu bandeja." });
    }

    setLoading(false);
  };

  const canSubmit = email.includes("@") && (mode === "forgot" || password.length >= 1);

  return (
    <div className="auth-wrap">
      <div className="auth-orbs">
        <div className="auth-orb auth-orb-1" /><div className="auth-orb auth-orb-2" />
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🧩</span>
          <span className="auth-logo-text">Aula<span className="auth-logo-ia">IA</span></span>
        </div>

        <h1 className="auth-title">
          {mode === "login"    && "Accede a tu cuenta"}
          {mode === "register" && "Crea tu cuenta"}
          {mode === "forgot"   && "Recuperar contraseña"}
        </h1>
        <p className="auth-sub">
          {mode === "login"    && "Solo necesitas tu email y contraseña. Sin datos personales."}
          {mode === "register" && "Solo pedimos email y contraseña. Nada más."}
          {mode === "forgot"   && "Te enviaremos un enlace para restablecer tu contraseña."}
        </p>

        <div className="auth-fields">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && handle()}
              autoComplete="email"
            />
          </div>

          {mode !== "forgot" && (
            <div className="auth-field">
              <label className="auth-label">Contraseña</label>
              <input
                className="auth-input"
                type="password"
                placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && canSubmit && handle()}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          )}
        </div>

        {msg && (
          <div className={`auth-msg ${msg.type === "ok" ? "auth-msg-ok" : "auth-msg-err"}`}>
            {msg.text}
          </div>
        )}

        <button
          className={`auth-btn ${canSubmit && !loading ? "auth-btn-active" : ""}`}
          onClick={handle}
          disabled={!canSubmit || loading}
        >
          {loading ? <span className="auth-spinner" /> : (
            mode === "login"    ? "Entrar" :
            mode === "register" ? "Crear cuenta" : "Enviar enlace"
          )}
        </button>

        <div className="auth-links">
          {mode === "login" && <>
            <button className="auth-link" onClick={() => { setMode("register"); setMsg(null); }}>¿No tienes cuenta? Regístrate</button>
            <button className="auth-link auth-link-muted" onClick={() => { setMode("forgot"); setMsg(null); }}>Olvidé mi contraseña</button>
          </>}
          {mode === "register" && (
            <button className="auth-link" onClick={() => { setMode("login"); setMsg(null); }}>¿Ya tienes cuenta? Entra aquí</button>
          )}
          {mode === "forgot" && (
            <button className="auth-link" onClick={() => { setMode("login"); setMsg(null); }}>← Volver al inicio de sesión</button>
          )}
        </div>

        <p className="auth-privacy">
          🔒 No almacenamos tu nombre ni datos personales. Solo el email es necesario para acceder a tu cuenta. Cumplimos el RGPD.
        </p>
      </div>
    </div>
  );
}
