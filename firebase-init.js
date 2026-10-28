import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeAuth, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

export const configurado = !String(firebaseConfig.apiKey).startsWith("COLE");

export const app = configurado ? initializeApp(firebaseConfig) : null;

// initializeAuth sem popup/redirect: só e-mail e senha, sem carregar iframes do Google.
// A sessão fica guardada no navegador e vale para as duas páginas (site e login).
export const auth = app
  ? initializeAuth(app, { persistence: browserLocalPersistence })
  : null;
