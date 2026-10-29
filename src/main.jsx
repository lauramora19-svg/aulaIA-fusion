import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./lib/AuthContext";
import App from "./App";
import "./lib/apiGuard";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// App instalable: registra el service worker (solo en la web publicada)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}
