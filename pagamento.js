import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { app } from "./firebase-init.js";
import { exigirLogin } from "./guarda.js";

const $ = (id) => document.getElementById(id);
const status = $("status");

const pedidoId = new URLSearchParams(location.search).get("pedido") || "";
if (!/^[A-Za-z0-9]{10,40}$/.test(pedidoId)) location.replace("planos.html");

const obterPedido = httpsCallable(getFunctions(app, "us-central1"), "obterPedido");
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

await exigirLogin(`pagamento.html?pedido=${pedidoId}`);

function mostrarPago() {
  $("pagar").hidden = true;
  $("pago").hidden = false;
  status.textContent = "";
}

async function copiar(texto, botao) {
  const original = botao.textContent;
  try {
    await navigator.clipboard.writeText(texto);
    botao.textContent = "Copied!";
  } catch (e) {
    botao.textContent = "Select the text and copy";
  }
  setTimeout(() => { botao.textContent = original; }, 2000);
}

let pollingId = null;

async function conferirPagamento() {
  try {
    const { data } = await obterPedido({ pedidoId, semQr: true });
    if (data.status === "pago") { clearInterval(pollingId); mostrarPago(); }
  } catch (e) { /* tenta de novo no próximo ciclo */ }
}

try {
  const { data } = await obterPedido({ pedidoId });
  if (data.status === "pago") {
    mostrarPago();
  } else {
    $("plano-nome").textContent = data.nomePlano;
    $("valor").textContent = reais.format(data.valorBRL);
    // O QR vem do nosso servidor como imagem PNG em base64
    if (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.qr || "")) $("qr").src = data.qr;
    $("payload").value = data.payload;
    $("chave").textContent = data.chave;
    $("copiar-payload").addEventListener("click", (e) => copiar(data.payload, e.currentTarget));
    $("copiar-chave").addEventListener("click", (e) => copiar(data.chave, e.currentTarget));
    $("pagar").hidden = false;
    status.textContent = "Waiting for your payment. This page updates by itself when it is confirmed.";
    pollingId = setInterval(conferirPagamento, 15000);
  }
} catch (e) {
  status.textContent = "We could not load this order. Go back to the plans and try again.";
}
