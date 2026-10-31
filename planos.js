// Preços em dólar (base). Quando o navegador traduz a página, ele muda o
// atributo lang do <html> (ex.: "en" -> "pt"); este script percebe isso e
// troca a moeda, já convertida.

// Idioma da página -> moeda e formato do número
const MOEDAS = {
  en: { moeda: "USD", formato: "en-US" },
  pt: { moeda: "BRL", formato: "pt-BR" }
};

// Taxa usada se a cotação ao vivo falhar. ATUALIZE de vez em quando.
const TAXA_RESERVA = { USD: 1, BRL: 5.5 };
let taxas = { ...TAXA_RESERVA };

const precos = document.querySelectorAll("[data-usd], [data-brl]");

function configAtual() {
  const idioma = (document.documentElement.lang || "en").toLowerCase().split("-")[0];
  return MOEDAS[idioma] || MOEDAS.en; // idioma sem moeda definida: dólar
}

function mostrarPrecos() {
  const { moeda, formato } = configAtual();
  const taxa = taxas[moeda] || TAXA_RESERVA[moeda] || 1;
  const moldura = new Intl.NumberFormat(formato, { style: "currency", currency: moeda });
  precos.forEach((el) => {
    // textContent: nunca injeta HTML
    // data-usd: preço base em dólar. data-brl: preço base em reais (ex.: plano de teste)
    const usd = el.dataset.usd !== undefined
      ? Number(el.dataset.usd)
      : Number(el.dataset.brl) / (taxas.BRL || TAXA_RESERVA.BRL);
    el.textContent = moldura.format(usd * taxa);
  });
}

// Mostra já, com a taxa de reserva
mostrarPrecos();

// Refaz quando a tradução do navegador muda o idioma da página
new MutationObserver(mostrarPrecos).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["lang"]
});

// Cotação ao vivo dólar -> real (se falhar, fica a taxa de reserva)
(async () => {
  try {
    const resp = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { cache: "no-store" });
    if (!resp.ok) return;
    const bid = Number((await resp.json())?.USDBRL?.bid);
    if (bid > 0 && bid < 100) {
      taxas.BRL = bid;
      mostrarPrecos();
    }
  } catch (e) { /* mantém a taxa de reserva */ }
})();
