// Catálogo demonstrativo. Substitua os exemplos por produtos reais antes do lançamento.
const products = [
  {
    id: "exemplo-concursos",
    title: "Guia de preparação para concursos",
    category: "concursos",
    categoryLabel: "Concursos",
    description: "Um exemplo de página de produto para materiais de preparação.",
    coverTitle: "Preparação para concursos",
    coverClass: "cover-green",
    price: "R$ 29,90"
  },
  {
    id: "exemplo-organizacao",
    title: "Planner de estudos",
    category: "organizacao",
    categoryLabel: "Organização",
    description: "Modelo demonstrativo para organizar metas e rotina de estudos.",
    coverTitle: "Organize seus estudos",
    coverClass: "cover-clay",
    price: "R$ 14,90"
  },
  {
    id: "exemplo-revisao",
    title: "Caderno de revisão",
    category: "revisao",
    categoryLabel: "Revisão",
    description: "Exemplo de material para revisão e acompanhamento do conteúdo.",
    coverTitle: "Revise com foco",
    coverClass: "cover-blue",
    price: "R$ 19,90"
  }
];

const grid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#search");
const categorySelect = document.querySelector("#category");
const emptyState = document.querySelector("#empty-state");

function renderProducts() {
  const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const category = categorySelect.value;
  const filtered = products.filter(product => {
    const matchesText = `${product.title} ${product.description} ${product.categoryLabel}`
      .toLocaleLowerCase("pt-BR").includes(term);
    return matchesText && (category === "todas" || product.category === category);
  });

  grid.innerHTML = filtered.map(product => `
    <article class="product-card">
      <div class="product-cover ${product.coverClass}">
        <span class="cover-label">APOSTILAS DA PATRÍCIA NAIANE</span>
        <span class="cover-title">${product.coverTitle}</span>
        <span class="cover-footer">MATERIAL DEMONSTRATIVO • PDF</span>
      </div>
      <div class="product-info">
        <span class="product-category">${product.categoryLabel}</span>
        <h3>${product.title}</h3>
        <p>${product.description}</p>
        <div class="product-bottom">
          <span class="price">${product.price}</span>
          <button class="product-button" type="button" data-product="${product.id}">Em breve</button>
        </div>
      </div>
    </article>
  `).join("");

  emptyState.hidden = filtered.length > 0;
}

searchInput.addEventListener("input", renderProducts);
categorySelect.addEventListener("change", renderProducts);

grid.addEventListener("click", event => {
  const button = event.target.closest("[data-product]");
  if (!button) return;
  alert("Esta é uma prévia do site. O checkout será ativado depois da integração segura com o meio de pagamento.");
});

document.querySelector("#year").textContent = new Date().getFullYear();
renderProducts();
