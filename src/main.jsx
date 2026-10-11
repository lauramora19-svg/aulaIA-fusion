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
