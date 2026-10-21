const API_URL =
  "https://apostilas-patricia-api.apostilaspatricia8.workers.dev";

const grid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#search");
const categorySelect = document.querySelector("#category");
const emptyState = document.querySelector("#empty-state");
const demoNotice = document.querySelector(".demo-notice");

let products = [];

function formatPrice(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderProducts() {
  const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const category = categorySelect.value;

  const filtered = products.filter(product => {
    const text = [
      product.title,
      product.description
    ].join(" ").toLocaleLowerCase("pt-BR");

    const matchesText = text.includes(term);
    const matchesCategory =
      category === "todas" ||
      product.category === category;

    return matchesText && matchesCategory;
  });

  grid.replaceChildren();

  filtered.forEach(product => {
    const card = createElement("article", "product-card");

    const cover = createElement(
      "div",
      "product-cover cover-green"
    );

    cover.append(
      createElement(
        "span",
        "cover-label",
        "APOSTILAS DA PATRÍCIA NAIANE"
      ),
      createElement("span", "cover-title", product.title),
      createElement("span", "cover-footer", "MATERIAL DIGITAL • PDF")
    );

    const info = createElement("div", "product-info");

    info.append(
      createElement("span", "product-category", "Apostila digital"),
      createElement("h3", "", product.title),
      createElement("p", "", product.description || "Material digital de estudo.")
    );

    const bottom = createElement("div", "product-bottom");
    bottom.append(
      createElement("span", "price", formatPrice(product.price_cents))
    );

    const button = createElement(
      "button",
      "product-button",
      "Em breve"
    );
    button.type = "button";
    button.disabled = true;
    button.setAttribute("aria-label", "Compra ainda não disponível");

    bottom.append(button);
    info.append(bottom);
    card.append(cover, info);
    grid.append(card);
  });

  emptyState.hidden = filtered.length > 0;

  if (filtered.length === 0) {
    emptyState.textContent = products.length
      ? "Nenhuma apostila encontrada. Tente outro termo."
      : "Ainda não há apostilas publicadas. Volte em breve!";
  }
}

async function loadProducts() {
  grid.replaceChildren(
    createElement("p", "", "Carregando apostilas...")
  );

  try {
    const response = await fetch(`${API_URL}/api/products`, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.products)) {
      throw new Error("Resposta inválida da API");
    }

    products = data.products.filter(product =>
      typeof product.id === "string" &&
      typeof product.title === "string" &&
      Number.isSafeInteger(product.price_cents) &&
      product.price_cents >= 0
    );

    if (demoNotice) {
      demoNotice.hidden = true;
    }

    renderProducts();
  } catch (error) {
    console.error("Falha ao carregar apostilas:", error);
    grid.replaceChildren();

    emptyState.hidden = false;
    emptyState.textContent =
      "Não foi possível carregar as apostilas agora. Tente novamente mais tarde.";
  }
}

searchInput.addEventListener("input", renderProducts);
categorySelect.addEventListener("change", renderProducts);

document.querySelector("#year").textContent =
  new Date().getFullYear();

loadProducts();
