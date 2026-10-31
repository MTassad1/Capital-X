import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { app } from "./firebase-init.js";
import { exigirLogin } from "./guarda.js";

const NOMES = { personal: "Personal", premium: "Premium", business: "Business", test: "Test" };

const form = document.getElementById("form-dados");
const status = document.getElementById("status");

const plano = new URLSearchParams(location.search).get("plano");
if (!Object.hasOwn(NOMES, plano)) {
  location.replace("planos.html"); // plano desconhecido: volta para a lista
}
document.getElementById("plano-nome").textContent = NOMES[plano] ?? "";

const criarPedido = httpsCallable(getFunctions(app, "us-central1"), "criarPedido");

// Erros do servidor que já vêm com texto pronto para o usuário
const COM_TEXTO = [
  "functions/invalid-argument", "functions/resource-exhausted", "functions/unavailable",
  "functions/failed-precondition", "functions/permission-denied"
];
const erroAmigavel = (e) =>
  COM_TEXTO.includes(e?.code) && e.message ? e.message : "Something went wrong. Please try again.";

const user = await exigirLogin(`checkout.html?plano=${plano}`);
form.elements.nome.value = user.displayName || "";
form.elements.email.value = user.email || "";
form.hidden = false;
status.textContent = "";

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(form));
  const telefone = dados.telefone.replace(/\D/g, "");
  const documento = dados.documento.replace(/\D/g, "");

  if (!dados.nome.trim() || !form.elements.email.checkValidity()) {
    status.textContent = "Please enter your name and a valid email.";
    return;
  }
  if (telefone.length < 10 || telefone.length > 15) {
    status.textContent = "Please enter a valid phone number with area code.";
    return;
  }
  if (documento && documento.length !== 11 && documento.length !== 14) {
    status.textContent = "CPF must have 11 digits or CNPJ 14 digits.";
    return;
  }

  const botao = form.querySelector(".enviar");
  botao.disabled = true;
  status.textContent = "Creating your order…";
  try {
    const { data } = await criarPedido({
      plano,
      cliente: { nome: dados.nome, email: dados.email, telefone, documento }
    });
    location.assign(`pagamento.html?pedido=${encodeURIComponent(data.pedidoId)}`);
  } catch (err) {
    status.textContent = erroAmigavel(err);
    botao.disabled = false;
  }
});
