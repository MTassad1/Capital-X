const elementoData = document.getElementById("data");

function atualizarData() {
  // textContent evita injeção de HTML
  elementoData.textContent = new Date().toLocaleDateString("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

atualizarData(); // Mostra a data ao abrir a página
setInterval(atualizarData, 60 * 1000); // Atualiza a cada minuto

// Tema: preto ou branco, lembrado entre visitas
const botaoTema = document.getElementById("tema");

// Garante o tema inicial mesmo se o theme.js não estiver na pasta
if (!document.documentElement.dataset.theme) {
  let salvo = null;
  try { salvo = localStorage.getItem("tema"); } catch (e) {}
  document.documentElement.dataset.theme = salvo === "light" ? "light" : "dark";
}

function mostrarRotulo() {
  const claro = document.documentElement.dataset.theme === "light";
  const rotulo = claro ? "Switch to dark theme" : "Switch to light theme";
  botaoTema.setAttribute("aria-label", rotulo);
  botaoTema.title = rotulo;
}

botaoTema.addEventListener("click", () => {
  const novo = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem("tema", novo); } catch (e) {}
  mostrarRotulo();
});

mostrarRotulo();

// Painel lateral da conta
const botaoConta = document.getElementById("abrir-conta");
const painel = document.getElementById("painel");
const fundoPainel = document.getElementById("painel-fundo");
const fecharPainel = document.getElementById("fechar-painel");

function abrirPainel() {
  painel.inert = false;
  painel.dataset.aberto = "true";
  fundoPainel.dataset.aberto = "true";
  document.documentElement.classList.add("painel-aberto");
  botaoConta.setAttribute("aria-expanded", "true");
  fecharPainel.focus();
}

function fechar() {
  painel.inert = true;
  painel.dataset.aberto = "false";
  fundoPainel.dataset.aberto = "false";
  document.documentElement.classList.remove("painel-aberto");
  botaoConta.setAttribute("aria-expanded", "false");
  botaoConta.focus();
}

botaoConta.addEventListener("click", abrirPainel);
fecharPainel.addEventListener("click", fechar);
fundoPainel.addEventListener("click", fechar);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && painel.dataset.aberto === "true") fechar();
});
