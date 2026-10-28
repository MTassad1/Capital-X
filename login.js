import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-init.js";

const $ = (id) => document.getElementById(id);
const formEntrar = $("form-entrar");
const formCriar = $("form-criar");
const abaEntrar = $("aba-entrar");
const abaCriar = $("aba-criar");
const abas = document.querySelector(".abas");
const painelLogado = $("conta-logado");
const statusConta = $("conta-status");

// ---------- Abas ----------
function mostrarAba(criar) {
  formEntrar.hidden = criar;
  formCriar.hidden = !criar;
  abaEntrar.setAttribute("aria-selected", String(!criar));
  abaCriar.setAttribute("aria-selected", String(criar));
  statusConta.textContent = "";
}
abaEntrar.addEventListener("click", () => mostrarAba(false));
abaCriar.addEventListener("click", () => mostrarAba(true));
if (location.hash === "#register") mostrarAba(true);

// ---------- Estado da sessão ----------
function atualizarUI(user) {
  const logado = Boolean(user);
  painelLogado.hidden = !logado;
  abas.hidden = logado;
  if (logado) { formEntrar.hidden = true; formCriar.hidden = true; }
  else if (formEntrar.hidden && formCriar.hidden) { mostrarAba(false); }
  $("conta-nome").textContent = logado ? (user.displayName || user.email) : "";
  $("conta-aviso").textContent = logado && !user.emailVerified ? "Please verify your email (check your inbox)." : "";
}

// Mensagens genéricas de propósito: não revelam se um e-mail já tem conta
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

if (!auth) {
  statusConta.textContent = "Firebase is not configured yet. Fill in firebase-config.js.";
} else {
  onAuthStateChanged(auth, atualizarUI);
}

// ---------- Entrar / criar conta ----------
async function entrar(dados) {
  await signInWithEmailAndPassword(auth, dados.email, dados.senha);
  location.assign("index.html"); // volta ao site, na mesma aba
}

async function criar(dados) {
  const cred = await createUserWithEmailAndPassword(auth, dados.email, dados.senha);
  await updateProfile(cred.user, { displayName: dados.nome });
  await sendEmailVerification(cred.user);
  atualizarUI(auth.currentUser); // o Firebase não avisa a mudança de nome sozinho
  statusConta.textContent = "Account created. We sent a verification email.";
}

[formEntrar, formCriar].forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!auth) return;

    const dados = Object.fromEntries(new FormData(form));
    dados.email = String(dados.email).trim();
    if (dados.nome) dados.nome = String(dados.nome).trim();

    if (!form.checkValidity()) {
      statusConta.textContent = "Please fill in all fields correctly (password: at least 8 characters).";
      return;
    }
    if (form.dataset.tipo === "criar" && dados.senha !== dados.confirma) {
      statusConta.textContent = "The passwords do not match.";
      return;
    }

    const botao = form.querySelector(".enviar");
    botao.disabled = true;
    statusConta.textContent = "Sending…";
    try {
      if (form.dataset.tipo === "entrar") await entrar(dados);
      else { await criar(dados); form.reset(); }
    } catch (err) {
      statusConta.textContent = erroAmigavel(err); // textContent: nunca injeta HTML
    } finally {
      botao.disabled = false;
    }
  });
});

// ---------- Esqueci a senha ----------
$("esqueci").addEventListener("click", async () => {
  if (!auth) return;
  const email = formEntrar.querySelector("[name=email]").value.trim();
  if (!email) { statusConta.textContent = "Type your email above first."; return; }
  try { await sendPasswordResetEmail(auth, email); } catch (e) { /* resposta igual de propósito */ }
  statusConta.textContent = "If an account exists for this email, we sent a reset link.";
});

// ---------- Sair ----------
$("sair").addEventListener("click", async () => {
  if (auth) await signOut(auth);
  statusConta.textContent = "";
});
