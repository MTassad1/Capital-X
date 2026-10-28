import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeAuth, browserLocalPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const dialog = document.getElementById("conta-dialog");
const statusConta = document.getElementById("conta-status");
const nomeLogado = document.getElementById("conta-nome");
const avisoEmail = document.getElementById("conta-aviso");

const botaoConta = document.getElementById("abrir-conta");

function atualizarUI(user) {
  dialog.dataset.logado = user ? "true" : "false";
  botaoConta.dataset.logado = user ? "true" : "false";
  botaoConta.setAttribute("aria-label", user ? "Account (signed in)" : "Account");
  nomeLogado.textContent = user ? (user.displayName || user.email) : "";
  avisoEmail.textContent = user && !user.emailVerified ? "Please verify your email (check your inbox)." : "";
  if (!user && window.mostrarAba) window.mostrarAba(false); // ao sair, volta para a aba "Sign in"
}

const configurado = !String(firebaseConfig.apiKey).startsWith("COLE");
let auth = null;

if (configurado) {
  const app = initializeApp(firebaseConfig);
  // initializeAuth sem popup/redirect: só email e senha, sem carregar iframes do Google
  auth = initializeAuth(app, { persistence: browserLocalPersistence });
}

// Mensagens genéricas de propósito: não revelam se um email já tem conta
const ERROS = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "Please enter a valid email.",
  "auth/user-disabled": "This account is disabled.",
  "auth/email-already-in-use": "We could not create the account with these details.",
  "auth/weak-password": "Password is too weak. Use at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again."
};
const erroAmigavel = (e) => ERROS[e?.code] || "Something went wrong. Please try again.";

window.loginFirebase = async (tipo, dados) => {
  if (!auth) {
    return { ok: false, mensagem: "Firebase is not configured yet. Fill in firebase-config.js." };
  }
  const email = String(dados.email).trim();
  try {
    if (tipo === "entrar") {
      await signInWithEmailAndPassword(auth, email, dados.senha);
      return { ok: true, mensagem: "" };
    }
    const cred = await createUserWithEmailAndPassword(auth, email, dados.senha);
    await updateProfile(cred.user, { displayName: String(dados.nome).trim() });
    await sendEmailVerification(cred.user);
    atualizarUI(auth.currentUser); // o Firebase não avisa a mudança de nome sozinho
    statusConta.textContent = "Account created. We sent a verification email.";
    return { ok: true, mensagem: "Account created. We sent a verification email." };
  } catch (e) {
    return { ok: false, mensagem: erroAmigavel(e) };
  }
};

// Esqueci a senha
document.getElementById("esqueci").addEventListener("click", async () => {
  const email = document.querySelector("#form-entrar [name=email]").value.trim();
  if (!auth) { statusConta.textContent = "Firebase is not configured yet."; return; }
  if (!email) { statusConta.textContent = "Type your email above first."; return; }
  try { await sendPasswordResetEmail(auth, email); } catch (e) { /* resposta igual de propósito */ }
  statusConta.textContent = "If an account exists for this email, we sent a reset link.";
});

// Sair
document.getElementById("sair").addEventListener("click", () => auth && signOut(auth));

// Estado da sessão: mostra "logado" ou os formulários
if (auth) {
  onAuthStateChanged(auth, atualizarUI);
}
