// Barra de cotações do Capital-X, com botão "Customize".
//
// Regras principais:
// - O visitante escolhe quais ativos aparecem (salvo no navegador, em localStorage).
// - SÓ os ativos selecionados são buscados. Ativo desmarcado = zero requisições.
// - Ao marcar um ativo, ele é buscado na hora; depois só é atualizado em intervalos
//   (cripto 1 min, o resto 5 min), e nada é buscado com a aba escondida.
// - Página em inglês (original): cada ativo na sua moeda de origem. Página traduzida pelo navegador:
//   tudo convertido para a moeda do idioma (pt = real, es = euro, ja = iene...), com o formato de número dele.

(() => {
  const barra = document.getElementById("ticker");
  const trilho = document.getElementById("ticker-trilho");
  const botao = document.getElementById("ticker-config");
  const painel = document.getElementById("ticker-painel");
  if (!barra || !trilho) return;

  // ===================== CONFIGURAÇÃO =====================
  const PIXELS_POR_SEGUNDO = 50;      // velocidade da barra
  const MAX_SELECIONADOS = 20;        // limite de ativos na barra (evita travar)
  const CHAVE_SELECAO = "capitalx-ticker";
  const PADRAO = ["dolar", "brent", "wti", "ouro"];
  const MOSTRAR_EM_BREVE = true;      // false = esconde do painel o que ainda não tem fonte de dados

  // Quando existir a Cloud Function de cotações, coloque a URL aqui (e na CSP do index.html).
  // Contrato: GET <URL>?symbols=PETR4,HGLG11,SPY  ->  { "PETR4": { "price": 38.1, "currency": "BRL", "change": 0.8 }, ... }
  const COTACOES_URL = "";

  // Intervalo entre atualizações de cada fonte (só roda se houver ativo selecionado daquela fonte)
  const INTERVALO = { cripto: 60e3, cambio: 5 * 60e3, metal: 5 * 60e3, petroleo: 5 * 60e3, brapi: 5 * 60e3, servidor: 5 * 60e3 };

  // Serviços usados (todos precisam estar no connect-src da CSP do index.html)
  const URL_IP_1 = "https://ipwho.is/";
  const URL_IP_2 = "https://ipapi.co/json/";
  const URL_CAMBIO = "https://open.er-api.com/v6/latest/USD";
  const URL_METAL = "https://api.gold-api.com/price/";
  const URL_PETROLEO = "https://api.oilpriceapi.com/v1/demo/prices";
  const URL_CRIPTO = "https://data-api.binance.vision/api/v3/ticker/24hr";
  const URL_BRAPI = "https://brapi.dev/api/quote/";   // sem token só aceita PETR4, VALE3, MGLU3, ITUB4 (teste)

  // ===================== CATÁLOGO DE ATIVOS =====================
  // fonte: de onde vem o preço. "servidor" = precisa da COTACOES_URL (ainda não existe -> "Coming soon").
  const par = (cod, nome) => ({ id: "fx-" + cod.toLowerCase(), nome, simbolo: "USD / " + cod, fonte: "cambio", moeda: cod });
  const cripto = (sim, nome) => ({ id: "c-" + sim.toLowerCase(), nome, simbolo: sim, fonte: "cripto", par: sim + "USDT" });
  const TESTE_BRAPI = ["PETR4", "VALE3", "MGLU3", "ITUB4"];
  const acaoBR = (sim, nome) => ({ id: "br-" + sim.toLowerCase(), nome, simbolo: sim, fonte: TESTE_BRAPI.includes(sim) ? "brapi" : "servidor", moeda: "BRL" });
  const srv = (prefixo, sim, nome, moeda, extra) => Object.assign({ id: prefixo + sim.toLowerCase(), nome, simbolo: sim, fonte: "servidor", moeda }, extra);

  const CATEGORIAS = [
    { id: "moedas", nome: "Currencies", itens: [
      { id: "dolar", nome: "Dollar vs. your currency", simbolo: "USD", fonte: "cambio", especial: true },
      par("EUR", "Euro"), par("GBP", "British pound"), par("JPY", "Japanese yen"), par("CHF", "Swiss franc"),
      par("CAD", "Canadian dollar"), par("AUD", "Australian dollar"), par("CNY", "Chinese yuan"),
      par("BRL", "Brazilian real"), par("MXN", "Mexican peso"), par("ARS", "Argentine peso"), par("INR", "Indian rupee")
    ] },
    { id: "materias", nome: "Metals & energy", itens: [
      { id: "ouro", nome: "Gold", simbolo: "XAU", rotulo: "Gold", traduzir: true, fonte: "metal", codigo: "XAU", moeda: "USD", unidade: "oz" },
      { id: "prata", nome: "Silver", simbolo: "XAG", rotulo: "Silver", traduzir: true, fonte: "metal", codigo: "XAG", moeda: "USD", unidade: "oz" },
      { id: "platina", nome: "Platinum", simbolo: "XPT", rotulo: "Platinum", traduzir: true, fonte: "metal", codigo: "XPT", moeda: "USD", unidade: "oz" },
      { id: "paladio", nome: "Palladium", simbolo: "XPD", rotulo: "Palladium", traduzir: true, fonte: "metal", codigo: "XPD", moeda: "USD", unidade: "oz" },
      { id: "brent", nome: "Brent crude oil", simbolo: "BRENT", rotulo: "Brent crude", traduzir: true, fonte: "petroleo", padrao: /BRENT/i, moeda: "USD", unidade: "bbl" },
      { id: "wti", nome: "WTI crude oil", simbolo: "WTI", rotulo: "WTI crude", traduzir: true, fonte: "petroleo", padrao: /WTI/i, moeda: "USD", unidade: "bbl" }
    ] },
    { id: "cripto", nome: "Crypto", itens: [
      cripto("BTC", "Bitcoin"), cripto("ETH", "Ethereum"), cripto("BNB", "BNB"), cripto("SOL", "Solana"),
      cripto("XRP", "XRP"), cripto("ADA", "Cardano"), cripto("DOGE", "Dogecoin"), cripto("AVAX", "Avalanche"),
      cripto("DOT", "Polkadot"), cripto("LINK", "Chainlink"), cripto("LTC", "Litecoin"), cripto("TRX", "TRON")
    ] },
    { id: "acoes-br", nome: "Stocks (Brazil)", itens: [
      acaoBR("PETR4", "Petrobras"), acaoBR("VALE3", "Vale"), acaoBR("ITUB4", "Itaú Unibanco"), acaoBR("MGLU3", "Magazine Luiza"),
      acaoBR("BBDC4", "Bradesco"), acaoBR("BBAS3", "Banco do Brasil"), acaoBR("ABEV3", "Ambev"), acaoBR("WEGE3", "WEG"),
      acaoBR("RENT3", "Localiza"), acaoBR("SUZB3", "Suzano"), acaoBR("B3SA3", "B3"), acaoBR("ELET3", "Eletrobras")
    ] },
    { id: "acoes-us", nome: "Stocks (US)", itens: [
      srv("us-", "AAPL", "Apple", "USD"), srv("us-", "MSFT", "Microsoft", "USD"), srv("us-", "NVDA", "NVIDIA", "USD"),
      srv("us-", "AMZN", "Amazon", "USD"), srv("us-", "GOOGL", "Alphabet", "USD"), srv("us-", "TSLA", "Tesla", "USD"),
      srv("us-", "META", "Meta Platforms", "USD"), srv("us-", "JPM", "JPMorgan Chase", "USD")
    ] },
    { id: "fiis", nome: "REITs (FIIs)", itens: [
      srv("fii-", "HGLG11", "CSHG Logística", "BRL"), srv("fii-", "XPML11", "XP Malls", "BRL"),
      srv("fii-", "KNRI11", "Kinea Renda Imobiliária", "BRL"), srv("fii-", "MXRF11", "Maxi Renda", "BRL"),
      srv("fii-", "XPLG11", "XP Log", "BRL"), srv("fii-", "VISC11", "Vinci Shopping Centers", "BRL"),
      srv("fii-", "BTLG11", "BTG Pactual Logística", "BRL"), srv("fii-", "HGRU11", "CSHG Renda Urbana", "BRL")
    ] },
    { id: "etfs", nome: "International ETFs", itens: [
      srv("etf-", "IVVB11", "iShares S&P 500 (B3)", "BRL"), srv("etf-", "SPXI11", "S&P 500 (B3)", "BRL"),
      srv("etf-", "NASD11", "Nasdaq 100 (B3)", "BRL"), srv("etf-", "SPY", "SPDR S&P 500", "USD"),
      srv("etf-", "QQQ", "Invesco QQQ (Nasdaq-100)", "USD"), srv("etf-", "VTI", "Vanguard Total Stock Market", "USD"),
      srv("etf-", "VOO", "Vanguard S&P 500", "USD"), srv("etf-", "EEM", "iShares MSCI Emerging Markets", "USD")
    ] },
    { id: "indices", nome: "Indexes", itens: [
      srv("ix-", "IBOV", "Ibovespa", null, { formato: "pontos" }), srv("ix-", "SPX", "S&P 500", null, { formato: "pontos" }),
      srv("ix-", "NDX", "Nasdaq-100", null, { formato: "pontos" }), srv("ix-", "DJI", "Dow Jones", null, { formato: "pontos" })
    ] },
    { id: "previdencia", nome: "Private pension", itens: [],
      aviso: "Private pension fund quotes (PGBL / VGBL) depend on each fund manager and are coming soon." }
  ];

  const ITENS = {};
  for (const cat of CATEGORIAS) for (const it of cat.itens) { it.categoria = cat.id; ITENS[it.id] = it; }

  // Idioma da página -> moeda. Primeiro vale o código completo (pt-br), depois só o idioma (pt).
  // "en" fica de fora de propósito: é o idioma original, então cada ativo aparece na sua moeda.
  const MOEDA_POR_TAG = {
    "pt-br": "BRL", "pt-pt": "EUR",
    "en-gb": "GBP", "en-au": "AUD", "en-ca": "CAD", "en-in": "INR", "en-nz": "NZD",
    "es-mx": "MXN", "es-ar": "ARS", "es-cl": "CLP", "es-co": "COP",
    "fr-ca": "CAD", "fr-ch": "CHF", "de-ch": "CHF",
    "zh-cn": "CNY", "zh-tw": "TWD", "zh-hk": "HKD"
  };
  const MOEDA_POR_IDIOMA = {
    pt: "BRL", es: "EUR", fr: "EUR", de: "EUR", it: "EUR", nl: "EUR", fi: "EUR", el: "EUR",
    ja: "JPY", zh: "CNY", ko: "KRW", ru: "RUB", uk: "UAH", hi: "INR", tr: "TRY",
    pl: "PLN", sv: "SEK", da: "DKK", no: "NOK", nb: "NOK", cs: "CZK", hu: "HUF", ro: "RON",
    he: "ILS", id: "IDR", vi: "VND", th: "THB"
  };

  // ===================== ESTADO =====================
  const dados = { moedaIP: null, taxas: null };
  const precos = {};            // id -> { preco, moeda, var }
  const fontes = {};            // fonte -> { proxima, falhas, emVoo, refazer }
  let jaTentou = false;
  let desenhados = "";
  let abaAtiva = CATEGORIAS[0].id;
  let busca = "";
  const pendentes = new Set();  // fontes a buscar assim que o visitante marcar algo
  let relogioPendentes = null;

  const disponivel = (it) => it.fonte !== "servidor" || !!COTACOES_URL;

  function carregarSelecao() {
    try {
      const lista = JSON.parse(localStorage.getItem(CHAVE_SELECAO));
      if (Array.isArray(lista)) return lista.filter((id) => ITENS[id] && disponivel(ITENS[id])).slice(0, MAX_SELECIONADOS);
    } catch (e) {}
    return PADRAO.slice();
  }
  const selecionados = new Set(carregarSelecao());
  function salvarSelecao() {
    try { localStorage.setItem(CHAVE_SELECAO, JSON.stringify([...selecionados])); } catch (e) {}
  }

  // ===================== REDE =====================
  async function buscar(url, limiteMs = 8000) {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), limiteMs);
    try {
      const resp = await fetch(url, { cache: "no-store", signal: controle.signal });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return await resp.json();
    } finally {
      clearTimeout(relogio);
    }
  }

  // Moeda do país do visitante, guardada na sessão para não consultar o IP toda hora
  async function moedaDoVisitante() {
    try {
      const salva = sessionStorage.getItem("moeda-ip");
      if (/^[A-Z]{3}$/.test(salva)) return salva;
    } catch (e) {}
    let codigo = null;
    try { codigo = (await buscar(URL_IP_1))?.currency?.code; } catch (e) {}
    if (!/^[A-Z]{3}$/.test(codigo || "")) {
      try { codigo = (await buscar(URL_IP_2))?.currency; } catch (e) {}
    }
    if (/^[A-Z]{3}$/.test(codigo || "")) {
      try { sessionStorage.setItem("moeda-ip", codigo); } catch (e) {}
      return codigo;
    }
    return null;
  }

  // Procura dentro de uma resposta qualquer um item cujo código/nome bate com o padrão e tem preço
  function acharPreco(resposta, padrao) {
    const pilha = [resposta];
    while (pilha.length) {
      const atual = pilha.pop();
      if (!atual || typeof atual !== "object") continue;
      const id = String(atual.code ?? atual.symbol ?? atual.name ?? "");
      const preco = Number(atual.price ?? atual.value);
      if (id && padrao.test(id) && preco > 0) return preco;
      for (const [chave, valor] of Object.entries(atual)) {
        if (valor && typeof valor === "object") {
          const p = Number(valor.price ?? valor.value);
          if (padrao.test(chave) && p > 0) return p;
          pilha.push(valor);
        }
      }
    }
    return null;
  }

  // Cada fonte recebe SÓ os itens selecionados dela
  const PROVEDORES = {
    async cambio() {
      const c = await buscar(URL_CAMBIO);
      if (c?.rates) dados.taxas = c.rates;
      if (selecionados.has("dolar") && !dados.moedaIP) dados.moedaIP = await moedaDoVisitante().catch(() => null);
    },
    async metal(itens) {
      await Promise.all(itens.map(async (it) => {
        const r = await buscar(URL_METAL + it.codigo);
        const p = Number(r?.price);
        if (p > 0) precos[it.id] = { preco: p, moeda: "USD" };
      }));
    },
    async petroleo(itens) {
      const r = await buscar(URL_PETROLEO);
      for (const it of itens) {
        const p = acharPreco(r, it.padrao);
        if (p > 5 && p < 400) precos[it.id] = { preco: p, moeda: "USD" };
      }
    },
    async cripto(itens) {
      const url = URL_CRIPTO + "?symbols=" + encodeURIComponent(JSON.stringify(itens.map((i) => i.par)));
      const lista = await buscar(url);
      for (const it of itens) {
        const r = Array.isArray(lista) ? lista.find((x) => x.symbol === it.par) : null;
        const p = Number(r?.lastPrice);
        if (p > 0) precos[it.id] = { preco: p, moeda: "USD", var: Number(r.priceChangePercent) };
      }
    },
    async brapi(itens) {
      const r = await buscar(URL_BRAPI + itens.map((i) => i.simbolo).join(","));
      for (const it of itens) {
        const x = (r?.results || []).find((y) => y.symbol === it.simbolo);
        const p = Number(x?.regularMarketPrice);
        if (p > 0) precos[it.id] = { preco: p, moeda: x.currency || "BRL", var: Number(x.regularMarketChangePercent) };
      }
    },
    async servidor(itens) {
      const r = await buscar(COTACOES_URL + "?symbols=" + encodeURIComponent(itens.map((i) => i.simbolo).join(",")));
      for (const it of itens) {
        const x = r?.[it.simbolo];
        const p = Number(x?.price);
        if (p > 0) precos[it.id] = { preco: p, moeda: x.currency || it.moeda, var: Number(x.change) };
      }
    }
  };

  const idiomaAtual = () => document.documentElement.lang || "en";
  function moedaDoIdioma(lang) {
    const tag = (lang || "en").toLowerCase();
    return MOEDA_POR_TAG[tag] || MOEDA_POR_IDIOMA[tag.split("-")[0]] || null;
  }

  // Quais fontes precisam rodar agora: só as dos ativos selecionados (+ câmbio se a página está traduzida)
  function fontesAtivas() {
    const f = new Set();
    for (const id of selecionados) {
      const it = ITENS[id];
      if (it && disponivel(it)) f.add(it.fonte);
    }
    if (f.size && moedaDoIdioma(idiomaAtual())) f.add("cambio");
    return f;
  }

  async function atualizarFonte(nome, forcar) {
    const f = (fontes[nome] = fontes[nome] || { proxima: 0, falhas: 0, emVoo: false, refazer: false });
    if (f.emVoo) { if (forcar) f.refazer = true; return; }
    if (!forcar && Date.now() < f.proxima) return;
    const itens = [...selecionados].map((id) => ITENS[id]).filter((it) => it && disponivel(it) && it.fonte === nome);
    if (nome !== "cambio" && !itens.length) return;

    f.emVoo = true;
    try {
      await PROVEDORES[nome](itens);
      f.falhas = 0;
      f.proxima = Date.now() + INTERVALO[nome];
    } catch (e) {
      f.falhas += 1; // tenta de novo mais tarde, esperando cada vez mais (30 s, 1 min, 2 min... até 5 min)
      f.proxima = Date.now() + Math.min(5 * 60e3, 30e3 * 2 ** (f.falhas - 1));
    } finally {
      f.emVoo = false;
    }
    jaTentou = true;
    mostrar();
    if (f.refazer) { f.refazer = false; atualizarFonte(nome, true); }
  }

  function atualizarTudo(forcar) {
    for (const nome of fontesAtivas()) atualizarFonte(nome, forcar);
  }

  // Depois de marcar ativos: espera um instante (o visitante pode marcar vários) e busca só as fontes envolvidas
  function agendar() {
    clearTimeout(relogioPendentes);
    relogioPendentes = setTimeout(() => {
      const ativas = fontesAtivas();
      for (const nome of pendentes) if (ativas.has(nome)) atualizarFonte(nome, true);
      pendentes.clear();
    }, 250);
  }

  // ===================== FORMATAÇÃO =====================
  // Formato de número do idioma da página (se o navegador não conhecer, usa en-US)
  function localeDaPagina(lang) {
    try {
      return Intl.NumberFormat.supportedLocalesOf([lang || "en-US"]).length ? lang : "en-US";
    } catch (e) {
      return "en-US";
    }
  }

  function formatarPreco(it, p, loc, destino) {
    if (it.formato === "pontos") return new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(p.preco);
    let valor = p.preco;
    let moeda = p.moeda || "USD";
    if (destino && destino !== moeda && dados.taxas) {
      const de = moeda === "USD" ? 1 : Number(dados.taxas[moeda]);
      const para = destino === "USD" ? 1 : Number(dados.taxas[destino]);
      if (de > 0 && para > 0) { valor = (valor / de) * para; moeda = destino; }
    }
    const opcoes = { style: "currency", currency: moeda };
    if (valor < 1) opcoes.maximumFractionDigits = 4; // moedas baratas (DOGE, TRX) precisam de mais casas
    let texto = new Intl.NumberFormat(loc, opcoes).format(valor);
    if (it.unidade) texto += " / " + it.unidade;
    return texto;
  }

  // Lista do que aparece na barra agora, na ordem do catálogo
  function itensAtuais() {
    const lang = idiomaAtual();
    const loc = localeDaPagina(lang);
    const destino = moedaDoIdioma(lang);
    const variacao = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
    const numero = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const lista = [];

    for (const cat of CATEGORIAS) {
      for (const it of cat.itens) {
        if (!selecionados.has(it.id) || !disponivel(it)) continue;

        if (it.fonte === "cambio") {
          // "dolar": contra a moeda do idioma traduzido, ou a do IP; se for dólar, contra o euro
          let alvo = it.moeda;
          if (it.especial) {
            alvo = destino || dados.moedaIP;
            if (!alvo || alvo === "USD") alvo = "EUR";
          }
          const taxa = Number(dados.taxas?.[alvo]);
          if (taxa > 0) lista.push({ id: it.id, nome: "USD / " + alvo, valor: numero.format(taxa), traduzir: false });
          continue;
        }

        const p = precos[it.id];
        if (!p) continue;
        const item = {
          id: it.id,
          nome: it.rotulo || it.simbolo,
          valor: formatarPreco(it, p, loc, destino),
          traduzir: !!it.traduzir
        };
        if (Number.isFinite(p.var) && p.var !== undefined) {
          item.variacao = variacao.format(p.var) + "%";
          item.sentido = p.var > 0 ? "alta" : p.var < 0 ? "baixa" : "";
        }
        lista.push(item);
      }
    }
    return lista;
  }

  // ===================== DESENHO DA BARRA =====================
  function criarGrupo(itens, escondido) {
    const lista = document.createElement("ul");
    lista.className = "ticker-grupo";
    if (escondido) lista.setAttribute("aria-hidden", "true");
    for (const item of itens) {
      const li = document.createElement("li");
      li.dataset.id = item.id;
      const nome = document.createElement("span");
      nome.className = "ticker-nome";
      nome.textContent = item.nome;
      // Só códigos (BTC, USD / BRL) e números ficam sem tradução; palavras como "Gold" o navegador traduz
      if (!item.traduzir) { nome.className += " notranslate"; nome.translate = false; }
      const valor = document.createElement("span");
      valor.className = "ticker-valor notranslate";
      valor.translate = false;
      valor.textContent = item.valor;
      li.append(nome, valor);
      if (item.variacao) {
        const v = document.createElement("span");
        v.className = "ticker-var notranslate " + (item.sentido || "");
        v.translate = false;
        v.textContent = item.variacao;
        li.append(v);
      }
      lista.append(li);
    }
    return lista;
  }

  function desenhar(itens) {
    // Mede um grupo para saber quantas cópias cobrem a largura da tela
    trilho.classList.remove("andando");
    trilho.replaceChildren(criarGrupo(itens, false));
    const larguraGrupo = trilho.firstChild.getBoundingClientRect().width || 1;
    const copias = Math.max(1, Math.ceil(window.innerWidth / larguraGrupo)) + 1;

    // Dois conjuntos iguais: a animação anda metade do trilho e recomeça sem pulo
    trilho.replaceChildren();
    for (let c = 0; c < 2; c++) {
      const conjunto = document.createElement("div");
      conjunto.className = "ticker-conjunto";
      for (let i = 0; i < copias; i++) conjunto.append(criarGrupo(itens, c > 0 || i > 0));
      trilho.append(conjunto);
    }
    trilho.style.animationDuration = Math.max(20, (larguraGrupo * copias) / PIXELS_POR_SEGUNDO) + "s";
    trilho.classList.add("andando");
  }

  // Troca só os textos, sem recriar a barra (não reinicia a animação nem desfaz a tradução do navegador)
  function atualizarTextos(itens) {
    for (const item of itens) {
      trilho.querySelectorAll('li[data-id="' + item.id + '"]').forEach((li) => {
        li.querySelector(".ticker-valor").textContent = item.valor;
        if (!item.traduzir) li.querySelector(".ticker-nome").textContent = item.nome;
        const v = li.querySelector(".ticker-var");
        if (v && item.variacao) { v.textContent = item.variacao; v.className = "ticker-var notranslate " + (item.sentido || ""); }
      });
    }
  }

  function mensagem(texto) {
    if (desenhados === "msg:" + texto) return;
    desenhados = "msg:" + texto;
    trilho.classList.remove("andando");
    const p = document.createElement("p");
    p.className = "ticker-aviso";
    p.textContent = texto;
    trilho.replaceChildren(p);
  }

  function mostrar() {
    const itens = itensAtuais();
    if (!itens.length) {
      if (selecionados.size === 0) mensagem("No assets selected. Use the Customize button to choose what to show.");
      else if (jaTentou) mensagem("Market data is unavailable right now.");
      else mensagem("Loading markets…");
      return;
    }
    const assinatura = itens.map((i) => i.id + (i.variacao ? "+" : "")).join(",");
    if (assinatura === desenhados) atualizarTextos(itens);
    else { desenhar(itens); desenhados = assinatura; }
  }

  // ===================== PAINEL DE PERSONALIZAÇÃO =====================
  const el = (tag, classe, texto) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };

  let elAbas, elBusca, elLista, elContador, elNota;

  function corDoSite() {
    const semCor = (c) => !c || c === "transparent" || c === "rgba(0, 0, 0, 0)";
    let fundo = getComputedStyle(document.body).backgroundColor;
    if (semCor(fundo)) fundo = getComputedStyle(document.documentElement).backgroundColor;
    if (semCor(fundo)) fundo = "#ffffff";
    painel.style.setProperty("--tp-fundo", fundo);
    painel.style.setProperty("--tp-texto", getComputedStyle(document.body).color);
  }

  function contarNaCategoria(cat) {
    return cat.itens.filter((it) => selecionados.has(it.id)).length;
  }

  function atualizarContador() {
    elContador.textContent = selecionados.size + " of " + MAX_SELECIONADOS + " selected";
  }

  function desenharAbas() {
    elAbas.replaceChildren();
    for (const cat of CATEGORIAS) {
      const n = contarNaCategoria(cat);
      const b = el("button", "ticker-aba", cat.nome + (n ? " (" + n + ")" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(cat.id === abaAtiva && !busca));
      b.addEventListener("click", () => {
        abaAtiva = cat.id;
        busca = "";
        elBusca.value = "";
        elNota.textContent = "";
        desenharAbas();
        desenharLista();
      });
      elAbas.append(b);
    }
  }

  function desenharLista() {
    elLista.replaceChildren();
    const termo = busca.trim().toLowerCase();
    let itens;
    let aviso = "";
    if (termo) {
      itens = CATEGORIAS.flatMap((c) => c.itens).filter((it) => (it.nome + " " + it.simbolo).toLowerCase().includes(termo));
    } else {
      const cat = CATEGORIAS.find((c) => c.id === abaAtiva);
      itens = cat.itens;
      aviso = cat.aviso || "";
    }
    if (!MOSTRAR_EM_BREVE) itens = itens.filter(disponivel);

    if (!itens.length) {
      elLista.append(el("li", "ticker-vazio", aviso || "No assets found."));
      return;
    }
    for (const it of itens) {
      const li = el("li");
      const rotulo = el("label");
      const caixa = el("input");
      caixa.type = "checkbox";
      caixa.checked = selecionados.has(it.id);
      caixa.disabled = !disponivel(it);
      caixa.addEventListener("change", () => alternar(it.id, caixa.checked, caixa));
      const texto = el("span", "ticker-item-texto");
      texto.append(el("span", "ticker-item-nome", it.nome));
      const simbolo = el("span", "ticker-item-simbolo notranslate", it.simbolo);
      simbolo.translate = false;
      texto.append(simbolo);
      rotulo.append(caixa, texto);
      if (!disponivel(it)) rotulo.append(el("span", "ticker-embreve", "Coming soon"));
      li.append(rotulo);
      elLista.append(li);
    }
  }

  function alternar(id, ligado, caixa) {
    const it = ITENS[id];
    if (ligado) {
      if (selecionados.size >= MAX_SELECIONADOS) {
        caixa.checked = false;
        elNota.textContent = "You can show up to " + MAX_SELECIONADOS + " assets at a time.";
        return;
      }
      elNota.textContent = "";
      selecionados.add(id);
      pendentes.add(it.fonte);
      if (moedaDoIdioma(idiomaAtual())) pendentes.add("cambio");
    } else {
      selecionados.delete(id); // desmarcado: some da barra e deixa de ser buscado
    }
    salvarSelecao();
    atualizarContador();
    desenharAbas();
    mostrar();
    agendar();
  }

  function restaurarPadrao() {
    selecionados.clear();
    PADRAO.forEach((id) => selecionados.add(id));
    PADRAO.forEach((id) => pendentes.add(ITENS[id].fonte));
    salvarSelecao();
    elNota.textContent = "";
    atualizarContador();
    desenharAbas();
    desenharLista();
    mostrar();
    agendar();
  }

  function construirPainel() {
    painel.replaceChildren();

    const topo = el("div", "ticker-painel-topo");
    topo.append(el("strong", "", "Customize your market bar"));
    elContador = el("span", "ticker-contador");
    const x = el("button", "ticker-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.addEventListener("click", () => fecharPainel(true));
    topo.append(elContador, x);

    elAbas = el("div", "ticker-abas");
    elAbas.setAttribute("role", "tablist");

    elBusca = el("input", "ticker-busca");
    elBusca.type = "search";
    elBusca.placeholder = "Search assets";
    elBusca.setAttribute("aria-label", "Search assets");
    elBusca.autocomplete = "off";
    elBusca.addEventListener("input", () => { busca = elBusca.value; desenharAbas(); desenharLista(); });

    elLista = el("ul", "ticker-lista");
    elNota = el("p", "ticker-nota");
    elNota.setAttribute("role", "status");

    const rodape = el("div", "ticker-rodape");
    const reset = el("button", "ticker-botao", "Reset to default");
    reset.type = "button";
    reset.addEventListener("click", restaurarPadrao);
    const pronto = el("button", "ticker-botao principal", "Done");
    pronto.type = "button";
    pronto.addEventListener("click", () => fecharPainel(true));
    rodape.append(reset, pronto);

    painel.append(topo, elAbas, elBusca, elLista, elNota, rodape);
    atualizarContador();
    desenharAbas();
    desenharLista();
  }

  function abrirPainel() {
    corDoSite();
    painel.hidden = false;
    botao.setAttribute("aria-expanded", "true");
    elBusca.focus({ preventScroll: true });
  }
  function fecharPainel(devolverFoco) {
    if (painel.hidden) return;
    painel.hidden = true;
    botao.setAttribute("aria-expanded", "false");
    if (devolverFoco) botao.focus();
  }

  if (botao && painel) {
    construirPainel();
    botao.addEventListener("click", () => (painel.hidden ? abrirPainel() : fecharPainel(true)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharPainel(true); });
    document.addEventListener("pointerdown", (e) => { if (!painel.hidden && !barra.contains(e.target)) fecharPainel(false); });
  }

  // ===================== INICIO =====================
  // Quando o navegador traduz a página, ele muda o atributo lang do <html>: refaz os preços na nova moeda
  new MutationObserver(() => { mostrar(); atualizarTudo(false); }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"]
  });

  // Atualização periódica: só das fontes com ativo selecionado e só com a aba visível
  setInterval(() => { if (!document.hidden) atualizarTudo(false); }, 30 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizarTudo(false); });

  mostrar();
  atualizarTudo(true);
})();
