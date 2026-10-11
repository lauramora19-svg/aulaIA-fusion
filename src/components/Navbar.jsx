import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Navbar({ session, view, onGoLibrary, onGoNew }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
  };

  const emailShort = session?.user?.email?.split("@")[0] || "docente";

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <button className="navbar-logo" onClick={onGoLibrary}>
          <span className="navbar-logo-icon">🧩</span>
          <span className="navbar-logo-text">Aula<span className="navbar-ia">IA</span></span>
        </button>

        <div className="navbar-right">
          <button
            className={`navbar-link ${view === "library" ? "navbar-link-active" : ""}`}
            onClick={onGoLibrary}
          >📂 Mis programaciones</button>

          <button
            className={`navbar-new ${view === "generator" ? "navbar-new-active" : ""}`}
            onClick={onGoNew}
          >✨ Nueva</button>

          <div className="navbar-user-wrap">
            <button className="navbar-user" onClick={() => setMenuOpen(p => !p)}>
              <span className="navbar-avatar">{emailShort[0].toUpperCase()}</span>
              <span className="navbar-email-short">{emailShort}</span>
              <span className="navbar-chevron">{menuOpen ? "▲" : "▼"}</span>
            </button>

            {menuOpen && (
              <div className="navbar-menu">
                <p className="navbar-menu-email">{session?.user?.email}</p>
                <button className="navbar-menu-btn" onClick={logout}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
