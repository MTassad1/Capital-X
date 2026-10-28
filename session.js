import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-init.js";

const botao = document.getElementById("abrir-conta");
const botaoEntrar = document.getElementById("painel-entrar");

if (auth && botao) {
  onAuthStateChanged(auth, (user) => {
    botao.dataset.logado = user ? "true" : "false";
    botao.setAttribute("aria-label", user ? "Account (signed in)" : "Account");
    if (botaoEntrar) botaoEntrar.textContent = user ? "My account" : "Sign in / Sign up";
  });
}
