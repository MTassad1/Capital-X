// Capital-X · Home

// 1. Data atual na faixa superior
(function setToday() {
  const el = document.getElementById("today");
  if (!el) return;
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());
  el.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
})();

// 2. Menu de navegação no celular
(function mobileMenu() {
  const btn = document.querySelector(".menu-toggle");
  const menu = document.getElementById("menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", () => {
    const aberto = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(aberto));
  });

  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
})();

// 3. Barra de busca
(function search() {
  const btn = document.getElementById("search-toggle");
  const bar = document.getElementById("search-bar");
  const input = document.getElementById("q");
  if (!btn || !bar || !input) return;

  function toggle(abrir) {
    bar.hidden = !abrir;
    btn.setAttribute("aria-expanded", String(abrir));
    btn.setAttribute("aria-label", abrir ? "Fechar busca" : "Abrir busca");
    if (abrir) input.focus();
  }

  btn.addEventListener("click", () => toggle(bar.hidden));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !bar.hidden) {
      toggle(false);
      btn.focus();
    }
  });
})();

// 4. Newsletter: validação no navegador
// O envio real ainda não existe. Ao ter o serviço de e-mail (Resend, Buttondown
// ou Beehiiv), troque o bloco marcado abaixo por uma chamada à API.
(function newsletter() {
  const form = document.getElementById("news-form");
  const input = document.getElementById("email");
  const msg = document.getElementById("news-msg");
  if (!form || !input || !msg) return;

  const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const valor = input.value.trim();

    if (!emailValido(valor)) {
      input.setAttribute("aria-invalid", "true");
      msg.textContent = "Informe um e-mail válido, por exemplo nome@empresa.com.";
      input.focus();
      return;
    }

    input.removeAttribute("aria-invalid");

    // --- Substituir por chamada real à API da newsletter ---
    msg.textContent = "Assinatura registrada. Você receberá a próxima edição por e-mail.";
    form.reset();
  });

  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    msg.textContent = "";
  });
})();

// 5. Faixa de mercado: movimento contínuo e atualização a cada 5 minutos
(function ticker() {
  // Endereço do Worker que entrega as cotações (arquivo worker-mercado.js).
  // Troque pela URL gerada no deploy.
  const MERCADO_URL = "https://capital-x-mercado.SEU-USUARIO.workers.dev/";
  const INTERVALO_MS = 5 * 60 * 1000;
  const PIXELS_POR_SEGUNDO = 45;

  const viewport = document.getElementById("ticker");
  const track = document.getElementById("ticker-track");
  if (!viewport || !track) return;

  const ITENS = [
    { id: "sp500", rotulo: "S&P 500", prefixo: "" },
    { id: "nasdaq", rotulo: "Nasdaq", prefixo: "" },
    { id: "ibovespa", rotulo: "Ibovespa", prefixo: "" },
    { id: "dolar", rotulo: "Dólar", prefixo: "R$ " },
    { id: "petroleo", rotulo: "Petróleo", prefixo: "US$ " },
    { id: "ouro", rotulo: "Ouro", prefixo: "US$ " },
  ];

  const nf = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let cotacoes = {};
  let carregado = false;
  let ultimaAtualizacao = 0;

  function formatarVariacao(v) {
    if (Math.abs(v) < 0.005) return "0,00%";
    return (v > 0 ? "+" : "") + nf.format(v) + "%";
  }

  function textoValor(item, c) {
    return c ? item.prefixo + nf.format(c.price) : "—";
  }

  function criarItem(item) {
    const c = cotacoes[item.id];
    const li = document.createElement("li");
    li.dataset.id = item.id;
    const b = document.createElement("b");
    b.textContent = textoValor(item, c);
    const span = document.createElement("span");
    span.textContent = c ? formatarVariacao(c.changePct) : "";
    li.append(item.rotulo + " ", b, " ", span);
    return li;
  }

  function itensVisiveis() {
    return carregado ? ITENS.filter((i) => cotacoes[i.id]) : ITENS;
  }

  function montarLista(repeticoes) {
    const ul = document.createElement("ul");
    ul.className = "ticker-list";
    for (let r = 0; r < repeticoes; r++) {
      itensVisiveis().forEach((item) => ul.append(criarItem(item)));
    }
    return ul;
  }

  // Monta a faixa com uma cópia extra para o loop ficar sem emenda
  function render() {
    let lista = montarLista(1);
    track.replaceChildren(lista);
    const largura = lista.getBoundingClientRect().width;
    if (largura > 0 && largura < viewport.clientWidth) {
      lista = montarLista(Math.ceil(viewport.clientWidth / largura));
      track.replaceChildren(lista);
    }
    const copia = lista.cloneNode(true);
    copia.setAttribute("aria-hidden", "true");
    track.append(copia);
    const total = lista.getBoundingClientRect().width;
    if (total > 0) track.style.setProperty("--dur", (total / PIXELS_POR_SEGUNDO).toFixed(1) + "s");
  }

  // Atualiza só os números, sem reiniciar o movimento
  function atualizarValores() {
    track.querySelectorAll("li[data-id]").forEach((li) => {
      const item = ITENS.find((i) => i.id === li.dataset.id);
      const c = item && cotacoes[item.id];
      if (!c) return;
      li.querySelector("b").textContent = textoValor(item, c);
      li.querySelector("span").textContent = formatarVariacao(c.changePct);
    });
  }

  async function atualizar() {
    if (MERCADO_URL.includes("SEU-USUARIO")) {
      console.info("Faixa de mercado: defina MERCADO_URL em script.js para exibir cotações reais.");
      return;
    }
    try {
      const resp = await fetch(MERCADO_URL, { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const dados = await resp.json();
      const novas = dados.quotes || {};
      if (Object.keys(novas).length === 0) throw new Error("Resposta sem cotações");

      const mudouConjunto = ITENS.some((i) => Boolean(novas[i.id]) !== Boolean(cotacoes[i.id]));
      cotacoes = novas;
      ultimaAtualizacao = Date.now();

      if (!carregado || mudouConjunto) {
        carregado = true;
        render();
      } else {
        atualizarValores();
      }

      const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })
        .format(new Date(dados.updatedAt || Date.now()));
      viewport.title = "Atualizado às " + hora + ". Cotações podem ter atraso.";
    } catch (erro) {
      console.warn("Faixa de mercado: não foi possível atualizar.", erro);
    }
  }

  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  atualizar();
  setInterval(atualizar, INTERVALO_MS);

  // Ao voltar para a aba, atualiza se já passou o intervalo
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - ultimaAtualizacao > INTERVALO_MS) atualizar();
  });

  let timerResize;
  window.addEventListener("resize", () => {
    clearTimeout(timerResize);
    timerResize = setTimeout(render, 250);
  });
})();
