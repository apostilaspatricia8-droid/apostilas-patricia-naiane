const API_URL = "https://apostilas-patricia-api.apostilaspatricia8.workers.dev";

const grid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#search");
const categorySelect = document.querySelector("#category");
const emptyState = document.querySelector("#empty-state");
const demoNotice = document.querySelector(".demo-notice");
let products = [];

function formatPrice(cents) {
  return (Number(cents) / 100).toLocaleString("pt-BR", {
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

function orderCredentials(orderId) {
  try {
    return JSON.parse(sessionStorage.getItem(`order:${orderId}`) || "null");
  } catch {
    return null;
  }
}

function saveOrderCredentials(orderId, accessToken, productId) {
  try {
    sessionStorage.setItem(`order:${orderId}`, JSON.stringify({ access_token: accessToken, product_id: productId }));
  } catch {
    // O pedido continua válido mesmo quando o navegador bloqueia o armazenamento da sessão.
  }
}

function setButtonBusy(button, busy, label) {
  button.disabled = busy;
  if (label) button.textContent = label;
}

function openPurchaseForm(product) {
  document.querySelector("#purchase-form")?.remove();
  const form = createElement("form", "purchase-form");
  form.id = "purchase-form";
  const heading = createElement("h3", "", "Fazer pedido");
  const description = createElement("p", "", `${product.title} — ${formatPrice(product.price_cents)}`);

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

  const submit = createElement("button", "product-button", "Continuar para o Pix");
  submit.type = "submit";
  const cancel = createElement("button", "text-link", "Cancelar");
  cancel.type = "button";
  cancel.addEventListener("click", () => form.remove());
  const note = createElement("p", "", "Após registrar o pedido, a loja mostrará a chave Pix e o valor exato. O pagamento será confirmado manualmente depois que a Patrícia conferir o crédito no banco.");
  form.append(heading, description, nameLabel, emailLabel, submit, cancel, note);
  grid.before(form);
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  nameInput.focus();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    setButtonBusy(submit, true, "Registrando pedido...");
    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          customer_name: nameInput.value.trim(),
          customer_email: emailInput.value.trim(),
          product_ids: [product.id]
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.order_id || !data.access_token) {
        throw new Error(data.error || "Não foi possível criar o pedido.");
      }
      saveOrderCredentials(data.order_id, data.access_token, product.id);
      form.replaceChildren(
        createElement("h3", "", "Pedido registrado!"),
        createElement("p", "", `Número do pedido: ${data.order_id}`),
        createElement("p", "", `Total: ${formatPrice(data.total_cents)}`),
        createElement("p", "", "Preparando as instruções do pagamento...")
      );
      const paymentArea = createElement("div", "payment-area");
      paymentArea.id = "payment-area";
      form.append(paymentArea);
      await createPixPayment(data.order_id, data.access_token, product.id, paymentArea);
    } catch (error) {
      console.error("Erro ao registrar pedido:", error);
      showMessage(error.message || "Não foi possível criar o pedido. Tente novamente.", true);
      setButtonBusy(submit, false, "Tentar novamente");
    }
  });
}

async function createPixPayment(orderId, accessToken, productId, target) {
  target.replaceChildren(createElement("p", "", "Carregando as instruções do Pix..."));
  try {
    const response = await fetch(`${API_URL}/api/payments/pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ order_id: orderId, access_token: accessToken })
    });
    const data = await response.json();

    if (response.status === 503 && data.code === "PIX_NOT_CONFIGURED") {
      target.replaceChildren(
        createElement("h4", "", "Pix ainda não configurado"),
        createElement("p", "", data.message || "A loja ainda não configurou a chave Pix. Não faça transferência até os dados aparecerem aqui.")
      );
      target.append(makeActionButton("Tentar novamente", async button => {
        setButtonBusy(button, true, "Consultando...");
        await createPixPayment(orderId, accessToken, productId, target);
      }));
      target.append(makeActionButton("Consultar pedido", () => consultarPedido(orderId, target)));
      return;
    }
    if (!response.ok || !data.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);

    if (data.status === "paid") {
      target.replaceChildren();
      await renderStatusAndDownload(orderId, accessToken, productId, target, {
        status: "paid", total_cents: data.total_cents, order_id: orderId
      });
      return;
    }

    target.replaceChildren();
    target.append(createElement("h4", "", "Pague com Pix"));
    target.append(createElement("p", "", "Confira os dados abaixo e transfira o valor exato usando o aplicativo do seu banco."));

    const detail = (label, value) => {
      const wrapper = createElement("div", "pix-detail");
      wrapper.append(createElement("strong", "", label));
      wrapper.append(createElement("p", "", value));
      return wrapper;
    };
    target.append(detail("Valor exato", formatPrice(data.total_cents)));
    target.append(detail("Banco recebedor", data.pix_bank || "Banco informado pela loja"));
    target.append(detail("Titular", data.pix_holder));
    target.append(detail(`Chave Pix (${String(data.pix_key_type || "").toUpperCase()})`, data.pix_key));

    const keyLabel = createElement("label", "", "Chave Pix para copiar e colar");
    const keyInput = document.createElement("textarea");
    keyInput.readOnly = true;
    keyInput.rows = 2;
    keyInput.value = data.pix_key;
    keyLabel.append(keyInput);
    target.append(keyLabel);
    target.append(makeActionButton("Copiar chave Pix", async button => {
      try {
        await navigator.clipboard.writeText(data.pix_key);
        button.textContent = "Chave copiada!";
      } catch {
        keyInput.focus(); keyInput.select();
        button.textContent = "Chave selecionada — copie manualmente";
      }
    }));

    const orderLabel = createElement("label", "", "Número do pedido (coloque na descrição, se seu banco permitir)");
    const orderInput = document.createElement("textarea");
    orderInput.readOnly = true;
    orderInput.rows = 2;
    orderInput.value = orderId;
    orderLabel.append(orderInput);
    target.append(orderLabel);
    target.append(makeActionButton("Copiar número do pedido", async button => {
      try {
        await navigator.clipboard.writeText(orderId);
        button.textContent = "Número copiado!";
      } catch {
        orderInput.focus(); orderInput.select();
        button.textContent = "Número selecionado — copie manualmente";
      }
    }));

    target.append(createElement("p", "", data.pix_instructions || "Após pagar, aguarde a Patrícia conferir o crédito no banco. Não envie comprovante como única prova de pagamento."));
    target.append(createElement("p", "", "A confirmação é manual. O PDF só será liberado depois que a loja verificar o recebimento real no extrato bancário."));
    target.append(makeActionButton("Consultar status do pedido", () => consultarPedido(orderId, target)));
  } catch (error) {
    target.replaceChildren(
      createElement("p", "", `O pedido foi registrado, mas não conseguimos carregar as instruções: ${error.message || "erro desconhecido"}.`),
      createElement("p", "", "Tente novamente sem criar outro pedido.")
    );
    target.append(makeActionButton("Tentar novamente", async button => {
      setButtonBusy(button, true, "Tentando...");
      await createPixPayment(orderId, accessToken, productId, target);
    }));
    target.append(makeActionButton("Consultar pedido", () => consultarPedido(orderId, target)));
  }
}

function makeActionButton(label, handler) {
  const button = createElement("button", "product-button", label);
  button.type = "button";
  button.addEventListener("click", async () => {
    try { await handler(button); }
    catch (error) { showMessage(error.message || "Não foi possível concluir a ação.", true); }
  });
  return button;
}

async function consultarPedido(orderId, targetOverride) {
  const credentials = orderCredentials(orderId);
  if (!credentials?.access_token) {
    showMessage("Não encontramos o acesso a este pedido nesta aba do navegador. Guarde o número do pedido; a recuperação segura será adicionada separadamente.", true);
    return;
  }
  const target = targetOverride || document.querySelector("#payment-area") || document.querySelector("#purchase-form");
  if (target) target.append(createElement("p", "", "Consultando o status do pedido..."));
  try {
    const url = new URL(`${API_URL}/api/orders/status`);
    url.searchParams.set("id", orderId);
    url.searchParams.set("token", credentials.access_token);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível consultar o pedido.");
    if (target) {
      target.replaceChildren();
      await renderStatusAndDownload(orderId, credentials.access_token, credentials.product_id, target, data);
    } else {
      alert(`Pedido: ${data.order_id}\nStatus: ${data.status === "paid" ? "Pagamento confirmado" : "Aguardando pagamento"}\nValor: ${formatPrice(data.total_cents)}`);
    }
  } catch (error) {
    if (target) target.replaceChildren(createElement("p", "", error.message || "Erro ao consultar o pedido."));
    else showMessage(error.message || "Erro ao consultar o pedido.", true);
  }
}

async function renderStatusAndDownload(orderId, accessToken, productId, target, data) {
  const paid = data.status === "paid";
  target.append(createElement("h4", "", paid ? "Pagamento confirmado!" : "Aguardando pagamento"));
  if (data.total_cents !== null && data.total_cents !== undefined) {
    target.append(createElement("p", "", `Valor do pedido: ${formatPrice(data.total_cents)}`));
  }
  if (paid) {
    target.append(createElement("p", "", "Seu pagamento foi confirmado pelo servidor. Agora você pode baixar a apostila."));
    target.append(makeActionButton("Baixar apostila em PDF", button => downloadProduct(orderId, accessToken, productId, button)));
  } else {
    target.append(createElement("p", "", "Assim que a Patrícia conferir o recebimento no banco e confirmar o pedido, esta página permitirá consultar o status novamente."));
    target.append(makeActionButton("Verificar novamente", button => consultarPedido(orderId, target)));
  }
}

async function downloadProduct(orderId, accessToken, productId, button) {
  if (!productId) throw new Error("Não encontramos o produto associado ao pedido nesta aba.");
  setButtonBusy(button, true, "Preparando download...");
  try {
    const url = new URL(`${API_URL}/api/orders/download`);
    url.searchParams.set("id", orderId);
    url.searchParams.set("token", accessToken);
    url.searchParams.set("product_id", productId);
    const response = await fetch(url, { headers: { Accept: "application/pdf, application/json" } });
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { /* erro sem JSON */ }
      throw new Error(data.error || "O download ainda não está disponível.");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "apostila.pdf";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    button.textContent = "Download iniciado";
  } finally {
    button.disabled = false;
    if (button.textContent === "Preparando download...") button.textContent = "Baixar apostila em PDF";
  }
}

function renderProducts() {
  const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const category = categorySelect.value;
  const filtered = products.filter(product => {
    const text = [product.title, product.description].join(" ").toLocaleLowerCase("pt-BR");
    return text.includes(term) && (category === "todas" || product.category === category);
  });
  grid.replaceChildren();
  filtered.forEach(product => {
    const card = createElement("article", "product-card");
    const cover = createElement("div", "product-cover cover-green");
    if (product.cover_url) {
      const image = document.createElement("img");
      image.src = product.cover_url;
      image.alt = `Capa da apostila ${product.title}`;
      image.loading = "lazy";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "cover";
      cover.append(image);
    } else {
      cover.append(
        createElement("span", "cover-label", "APOSTILAS DA PATRÍCIA NAIANE"),
        createElement("span", "cover-title", product.title),
        createElement("span", "cover-footer", "MATERIAL DIGITAL • PDF")
      );
    }
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
    button.addEventListener("click", () => openPurchaseForm(product));
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
    const response = await fetch(`${API_URL}/api/products`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error("Resposta inválida da API");
    products = data.products.filter(product =>
      typeof product.id === "string" && typeof product.title === "string" &&
      Number.isSafeInteger(product.price_cents) && product.price_cents >= 0
    );
    if (demoNotice) demoNotice.hidden = true;
    renderProducts();
  } catch (error) {
    console.error("Falha ao carregar apostilas:", error);
    grid.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = "Não foi possível carregar as apostilas agora. Tente novamente mais tarde.";
  }
}

searchInput.addEventListener("input", renderProducts);
categorySelect.addEventListener("change", renderProducts);
document.querySelector("#year").textContent = new Date().getFullYear();
loadProducts();
