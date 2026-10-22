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

function showMessage(message, isError = false) {
  let box = document.querySelector("#purchase-message");

  if (!box) {
    box = createElement("div", "purchase-message");
    box.id = "purchase-message";
    box.setAttribute("role", "status");
    grid.before(box);
  }

  box.textContent = message;
  box.style.color = isError ? "#a12626" : "#173b32";
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function openPurchaseForm(product, button) {
  if (document.querySelector("#purchase-form")) {
    document.querySelector("#purchase-form").remove();
  }

  const form = createElement("form", "purchase-form");
  form.id = "purchase-form";

  const heading = createElement("h3", "", "Fazer pedido");
  const description = createElement(
    "p",
    "",
    `${product.title} — ${formatPrice(product.price_cents)}`
  );

  const nameLabel = createElement("label", "", "Seu nome");
  const nameInput = createElement("input");
  nameInput.name = "customer_name";
  nameInput.autocomplete = "name";
  nameInput.required = true;
  nameInput.maxLength = 120;
  nameInput.placeholder = "Digite seu nome";
  nameLabel.append(nameInput);

  const emailLabel = createElement("label", "", "Seu e-mail");
  const emailInput = createElement("input");
  emailInput.type = "email";
  emailInput.name = "customer_email";
  emailInput.autocomplete = "email";
  emailInput.required = true;
  emailInput.maxLength = 254;
  emailInput.placeholder = "voce@exemplo.com";
  emailLabel.append(emailInput);

  const submit = createElement("button", "product-button", "Criar pedido");
  submit.type = "submit";

  const cancel = createElement("button", "text-link", "Cancelar");
  cancel.type = "button";
  cancel.addEventListener("click", () => form.remove());

  const note = createElement(
    "p",
    "",
    "Esta etapa registra o pedido. O pagamento ainda não está disponível."
  );

  form.append(heading, description, nameLabel, emailLabel, submit, cancel, note);
  grid.before(form);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  nameInput.focus();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    submit.disabled = true;
    submit.textContent = "Criando pedido...";

    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          customer_name: nameInput.value.trim(),
          customer_email: emailInput.value.trim(),
          product_ids: [product.id]
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok || !data.order_id) {
        throw new Error(data.error || "Não foi possível criar o pedido.");
      }

      // Guardamos apenas nesta página os dados necessários à próxima etapa.
      // O token não é enviado a ferramentas de análise nem exibido na tela.
      form.replaceChildren(
        createElement("h3", "", "Pedido registrado!"),
        createElement(
          "p",
          "",
          "Seu pedido foi registrado, mas ainda não há cobrança ou pagamento disponível."
        ),
        createElement(
          "p",
          "",
          `Número do pedido: ${data.order_id}`
        ),
        createElement(
          "p",
          "",
          "Guarde o número do pedido. A loja informará quando o pagamento estiver disponível."
        )
      );

      if (data.access_token) {
        try {
          sessionStorage.setItem(
            `order:${data.order_id}`,
            JSON.stringify({ access_token: data.access_token })
          );
        } catch {
          // A criação do pedido continua válida mesmo se o navegador bloquear armazenamento.
        }
      }

      
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      showMessage(
        error.message || "Não foi possível criar o pedido. Tente novamente.",
        true
      );
      submit.disabled = false;
      submit.textContent = "Tentar novamente";
    }
  });
}

function renderProducts() {
  const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const category = categorySelect.value;

  const filtered = products.filter(product => {
    const text = [product.title, product.description]
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return (
      text.includes(term) &&
      (category === "todas" || product.category === category)
    );
  });

  grid.replaceChildren();

  filtered.forEach(product => {
    const card = createElement("article", "product-card");
    const cover = createElement("div", "product-cover cover-green");

    cover.append(
      createElement("span", "cover-label", "APOSTILAS DA PATRÍCIA NAIANE"),
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
    bottom.append(createElement("span", "price", formatPrice(product.price_cents)));

    const button = createElement("button", "product-button", "Fazer pedido");
    button.type = "button";
    button.addEventListener("click", () => openPurchaseForm(product, button));

    bottom.append(button);
    info.append(bottom);
    card.append(cover, info);
    grid.append(card);
  });

  emptyState.hidden = filtered.length > 0;

  if (!filtered.length) {
    emptyState.textContent = products.length
      ? "Nenhuma apostila encontrada. Tente outro termo."
      : "Ainda não há apostilas publicadas. Volte em breve!";
  }
}

async function loadProducts() {
  grid.replaceChildren(createElement("p", "", "Carregando apostilas..."));

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

    if (demoNotice) demoNotice.hidden = true;
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

document.querySelector("#year").textContent = new Date().getFullYear();

loadProducts();
