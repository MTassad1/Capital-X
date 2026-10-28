import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { auth, app } from "./firebase-init.js";

const $ = (id) => document.getElementById(id);
const formEntrar = $("form-entrar");
const formCriar = $("form-criar");
const formCodigo = $("form-codigo");
const abaEntrar = $("aba-entrar");
const abaCriar = $("aba-criar");
const abas = document.querySelector(".abas");
const painelLogado = $("conta-logado");
const statusConta = $("conta-status");
const campoCodigo = $("codigo");

// Funções do servidor (functions/index.js): enviam e conferem o código
const funcoes = app ? getFunctions(app, "us-central1") : null;
const enviarCodigo = funcoes && httpsCallable(funcoes, "enviarCodigo");
const verificarCodigo = funcoes && httpsCallable(funcoes, "verificarCodigo");

// ---------- Ver / esconder senha ----------
document.querySelectorAll(".ver-senha").forEach((botao) => {
  const campo = botao.parentElement.querySelector("input");
  botao.addEventListener("click", () => {
    const mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    botao.setAttribute("aria-pressed", String(mostrar));
    botao.setAttribute("aria-label", mostrar ? "Hide password" : "Show password");
  });
});

// ---------- Telas ----------
function esconderTudo() {
  formEntrar.hidden = true;
  formCriar.hidden = true;
  formCodigo.hidden = true;
  painelLogado.hidden = true;
  abas.hidden = true;
}

function mostrarAba(criar) {
  esconderTudo();
  abas.hidden = false;
  formEntrar.hidden = criar;
  formCriar.hidden = !criar;
  abaEntrar.setAttribute("aria-selected", String(!criar));
  abaCriar.setAttribute("aria-selected", String(criar));
  statusConta.textContent = "";
}
abaEntrar.addEventListener("click", () => mostrarAba(false));
abaCriar.addEventListener("click", () => mostrarAba(true));
if (location.hash === "#register") mostrarAba(true);

function mostrarCodigo(user) {
  esconderTudo();
  $("codigo-email").textContent = user.email;
  formCodigo.hidden = false;
  campoCodigo.focus();
}

function mostrarLogado(user) {
  esconderTudo();
  painelLogado.hidden = false;
  $("conta-nome").textContent = user.displayName || user.email;
}

// A conta só vale depois do código: o servidor marca isso no token do usuário
async function estaVerificado(user) {
  const { claims } = await user.getIdTokenResult();
  return claims.codigoVerificado === true;
}

async function atualizarUI(user) {
  if (!user) {
    if (formEntrar.hidden && formCriar.hidden) mostrarAba(false);
    return;
  }
  if (await estaVerificado(user)) mostrarLogado(user);
  else mostrarCodigo(user);
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
// Erros do servidor que já vêm com texto pronto para o usuário
const ERROS_SERVIDOR = [
  "functions/invalid-argument", "functions/resource-exhausted",
  "functions/deadline-exceeded", "functions/failed-precondition"
];
const erroAmigavel = (e) => {
  if (ERROS_SERVIDOR.includes(e?.code) && e.message) return e.message;
  return ERROS[e?.code] || "Something went wrong. Please try again.";
};

if (!auth) {
  statusConta.textContent = "Firebase is not configured yet. Fill in firebase-config.js.";
} else {
  onAuthStateChanged(auth, atualizarUI);
}

// ---------- Código por e-mail ----------
async function pedirCodigo() {
  statusConta.textContent = "Sending code…";
  await enviarCodigo();
  statusConta.textContent = "Code sent. It expires in 10 minutes.";
}

// Letras viram maiúsculas na hora; só letras e números entram
campoCodigo.addEventListener("input", () => {
  campoCodigo.value = campoCodigo.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});

formCodigo.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth?.currentUser) return;
  const codigo = campoCodigo.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(codigo)) {
    statusConta.textContent = "Enter the 6-character code from your email.";
    return;
  }
  const botao = formCodigo.querySelector(".enviar");
  botao.disabled = true;
  statusConta.textContent = "Checking…";
  try {
    await verificarCodigo({ codigo });
    await auth.currentUser.getIdToken(true); // traz o token já com a marca de verificado
    location.assign("index.html");
  } catch (err) {
    statusConta.textContent = erroAmigavel(err);
  } finally {
    botao.disabled = false;
  }
});

$("reenviar").addEventListener("click", async () => {
  if (!auth?.currentUser) return;
  try { await pedirCodigo(); } catch (err) { statusConta.textContent = erroAmigavel(err); }
});

$("cancelar").addEventListener("click", async () => {
  if (auth) await signOut(auth);
});

// ---------- Entrar / criar conta ----------
async function entrar(dados) {
  const cred = await signInWithEmailAndPassword(auth, dados.email, dados.senha);
  if (await estaVerificado(cred.user)) {
    location.assign("index.html"); // volta ao site, na mesma aba
    return;
  }
  mostrarCodigo(cred.user);
  await pedirCodigo();
}

async function criar(dados) {
  const cred = await createUserWithEmailAndPassword(auth, dados.email, dados.senha);
  await updateProfile(cred.user, { displayName: dados.nome });
  mostrarCodigo(auth.currentUser);
  await pedirCodigo();
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
