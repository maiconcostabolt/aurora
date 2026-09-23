(function () {
  "use strict";

  const app = document.getElementById("app");
  if (!app) return;

  const state = {
    user: null,
    workType: null,
    customer: null,
    asset: null,
    intake: null,
    occurrences: [],
    editingOccurrenceId: null,
    selectedEvidenceOccurrenceId: null,
    previewEvidence: null,
    diagnostic: null,
    customers: [
      {
        id: "c1",
        name: "Luiz Renato da Luz",
        phone: "(47) 99999-9999",
        email: "luiz@example.com"
      }
    ]
  };

  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function card(icon, title, description, action, extra = "") {
    return `
      <button class="action-card" type="button" ${extra} data-action="${action}">
        <span class="action-icon">${icon}</span>
        <span class="action-title">${title}</span>
        <span class="action-description">${description}</span>
        <span class="action-arrow">›</span>
      </button>
    `;
  }

  function progress(step, label) {
    return `
      <section class="welcome-card" style="margin-bottom:18px">
        <p>${esc(label)}</p>
        <strong>Etapa ${step} de 5</strong>
        <div style="height:8px;margin-top:16px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.10)">
          <div style="width:${step * 20}%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#5ca8ff,#64f0e5,#9f7cff)"></div>
        </div>
      </section>
    `;
  }

  function shell(title, subtitle, body, back) {
    app.innerHTML = `
      <section class="screen home-screen">
        <header class="home-header">
          <div>
            <p class="eyebrow">Novo atendimento</p>
            <h1>${title}</h1>
            <p class="muted">${subtitle}</p>
          </div>
          ${back ? '<div class="avatar" id="back-button" role="button" tabindex="0">‹</div>' : ""}
        </header>
        <main class="home-content">${body}</main>
      </section>
    `;
    if (back) {
      document.getElementById("back-button").addEventListener("click", back);
    }
  }

  function splash() {
    app.innerHTML = `
      <section class="screen splash-screen">
        <div class="splash-content">
          <div class="aurora-logo aurora-logo--official">
            <img src="./assets/icons/aurora-192.png" alt="Logo Aurora">
          </div>
          <h1 class="aurora-name">AURORA</h1>
          <p class="aurora-purpose">Inspeções Inteligentes.<br>Decisões Confiáveis.</p>
          <div class="loading-line"><span></span></div>
          <p class="aurora-values">Organize. &nbsp;|&nbsp; Inspecione. &nbsp;|&nbsp; Evolua.</p>
        </div>
      </section>
    `;
    setTimeout(login, 3400);
  }

  function login() {
    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          <div class="login-mini-logo login-mini-logo--official"><img src="./assets/icons/aurora-192.png" alt="Logo Aurora"></div>
          <p class="eyebrow">Bem-vindo</p>
          <h1>Entre na Aurora</h1>
          <p class="muted">Informe seus dados para acessar o ambiente de demonstração.</p>
          <form id="login-form">
            <label class="field">
              <span>Seu nome</span>
              <input id="user-name" value="${esc(state.user?.name || "Maike")}">
            </label>
            <label class="field">
              <span>Função</span>
              <input id="user-role" value="${esc(state.user?.role || "Administrador")}">
            </label>
            <button class="primary-button" type="submit">Entrar na Aurora</button>
          </form>
        </div>
      </section>
    `;

    document.getElementById("login-form").addEventListener("submit", (event) => {
      event.preventDefault();
      state.user = {
        name: document.getElementById("user-name").value.trim() || "Usuário",
        role: document.getElementById("user-role").value.trim() || "Profissional"
      };
      home();
    });
  }

  function home() {
    const name = state.user?.name || "Usuário";
    shell(
      `Bom dia, ${esc(name)}.`,
      esc(state.user?.role || "Profissional"),
      `
        <section class="welcome-card">
          <p>Seu ambiente está pronto.</p>
          <strong>O que você quer fazer hoje?</strong>
        </section>

        <div class="action-grid">
          ${card("🔧", "Novo atendimento", "Abra um novo atendimento com cliente, ativo e ocorrências.", "new-service")}
          ${card("📸", "Nova ocorrência", "Adicione uma ocorrência a um atendimento existente.", "occurrence")}
          ${card("📄", "Relatórios", "Consulte diagnósticos, propostas e relatórios finais.", "reports")}
          ${card("🕘", "Histórico", "Acesse atendimentos e registros anteriores.", "history")}
        </div>

        <p id="message" class="action-message">Escolha uma opção para continuar.</p>
        <button id="logout" class="secondary-button" type="button">Trocar usuário</button>
      `,
      null
    );

    document.querySelector('[data-action="new-service"]').addEventListener("click", workSelector);
    document.querySelectorAll('[data-action]:not([data-action="new-service"])').forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById("message").textContent = "Este fluxo será conectado em breve.";
      });
    });
    document.getElementById("logout").addEventListener("click", () => {
      state.user = null;
      state.workType = null;
      state.customer = null;
      state.asset = null;
      state.intake = null;
      state.occurrences = [];
      state.editingOccurrenceId = null;
      state.selectedEvidenceOccurrenceId = null;
      state.previewEvidence = null;
      state.diagnostic = null;
      login();
    });
  }

  function workSelector() {
    state.workType = null;

    shell(
      "O que vamos fazer hoje?",
      `Escolha o tipo de trabalho. A Aurora adaptará o fluxo para você, ${esc(state.user?.name || "Usuário")}.`,
      `
        ${progress(1, "Tipo de trabalho")}

        <div class="action-grid">
          ${card("🔩", "Oficina mecânica", "Veículos, manutenção, diagnóstico e reparos.", "automotive")}
          ${card("🏭", "Manutenção industrial", "Máquinas, equipamentos, painéis e instalações.", "industrial")}
          ${card("🚁", "Inspeção aérea", "Coberturas, fachadas, estruturas e levantamentos.", "aerial")}
          ${card("⚡", "Serviço elétrico", "Quadros, circuitos, medições e manutenção.", "electrical")}
          ${card("🛠️", "Serviço geral", "Reparos, montagens e serviços diversos.", "general")}
          ${card("＋", "Outro tipo de trabalho", "Crie um atendimento personalizado.", "other")}
        </div>

        <p id="work-message" class="action-message">Nenhuma área selecionada.</p>
        <button id="continue-work" class="primary-button" type="button" disabled style="opacity:.45;pointer-events:none">Continuar</button>
        <button id="cancel-work" class="secondary-button" type="button">Voltar para a Home</button>
      `,
      home
    );

    document.querySelectorAll("[data-action]").forEach((item) => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".action-card").forEach((cardItem) => {
          cardItem.style.borderColor = "rgba(255,255,255,.14)";
          cardItem.style.background = "rgba(255,255,255,.07)";
          cardItem.style.boxShadow = "none";
        });

        item.style.borderColor = "rgba(100,240,229,.78)";
        item.style.background = "linear-gradient(135deg,rgba(92,168,255,.18),rgba(159,124,255,.16))";
        item.style.boxShadow = "0 0 0 3px rgba(100,240,229,.08)";

        state.workType = {
          id: item.dataset.action,
          title: item.querySelector(".action-title").textContent.trim()
        };

        document.getElementById("work-message").textContent = `Selecionado: ${state.workType.title}.`;
        const next = document.getElementById("continue-work");
        next.disabled = false;
        next.style.opacity = "1";
        next.style.pointerEvents = "auto";
      });
    });

    document.getElementById("continue-work").addEventListener("click", customerSelector);
    document.getElementById("cancel-work").addEventListener("click", home);
  }

  function customerSelector() {
    state.customer = null;

    const customerList = state.customers.map((customer) => `
      <button
        class="action-card"
        type="button"
        data-customer-id="${esc(customer.id)}"
        style="min-height:132px"
      >
        <span class="action-icon">👤</span>
        <span class="action-title">${esc(customer.name)}</span>
        <span class="action-description">${esc(customer.phone || customer.email || "Sem contato informado")}</span>
        <span class="action-arrow">›</span>
      </button>
    `).join("");

    shell(
      "Para quem será este trabalho?",
      "Pesquise um cliente existente ou cadastre um novo.",
      `
        ${progress(2, "Cliente")}

        <label class="field">
          <span>Pesquisar cliente</span>
          <input id="customer-search" type="search" placeholder="Digite o nome ou telefone">
        </label>

        <div id="customer-list" class="action-grid" style="margin-top:18px">
          ${customerList}
        </div>

        <p id="customer-message" class="action-message">Nenhum cliente selecionado.</p>
        <button id="continue-customer" class="primary-button" type="button" disabled style="opacity:.45;pointer-events:none">Continuar com o cliente</button>
        <button id="new-customer" class="secondary-button" type="button">+ Cadastrar novo cliente</button>
        <button id="cancel-customer" class="secondary-button" type="button">Voltar</button>
      `,
      workSelector
    );

    bindCustomerCards();

    document.getElementById("customer-search").addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll("[data-customer-id]").forEach((item) => {
        item.style.display = item.textContent.toLowerCase().includes(query) ? "" : "none";
      });
    });

    document.getElementById("continue-customer").addEventListener("click", customerConfirmation);
    document.getElementById("new-customer").addEventListener("click", newCustomer);
    document.getElementById("cancel-customer").addEventListener("click", workSelector);
  }

  function bindCustomerCards() {
    document.querySelectorAll("[data-customer-id]").forEach((item) => {
      item.addEventListener("click", () => {
        document.querySelectorAll("[data-customer-id]").forEach((cardItem) => {
          cardItem.style.borderColor = "rgba(255,255,255,.14)";
          cardItem.style.background = "rgba(255,255,255,.07)";
          cardItem.style.boxShadow = "none";
        });

        item.style.borderColor = "rgba(100,240,229,.78)";
        item.style.background = "linear-gradient(135deg,rgba(92,168,255,.18),rgba(159,124,255,.16))";
        item.style.boxShadow = "0 0 0 3px rgba(100,240,229,.08)";

        state.customer = state.customers.find((customer) => customer.id === item.dataset.customerId);

        document.getElementById("customer-message").textContent = `Selecionado: ${state.customer.name}.`;
        const next = document.getElementById("continue-customer");
        next.disabled = false;
        next.style.opacity = "1";
        next.style.pointerEvents = "auto";
      });
    });
  }

  function newCustomer() {
    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(2, "Novo cliente")}
          <div class="login-mini-logo">👤</div>
          <p class="eyebrow">Novo atendimento</p>
          <h1>Cadastrar cliente</h1>
          <p class="muted">Preencha somente o necessário. Os demais dados podem ser completados depois.</p>

          <form id="customer-form">
            <label class="field">
              <span>Nome do cliente *</span>
              <input id="customer-name" required placeholder="Ex.: João da Silva">
            </label>

            <label class="field">
              <span>Telefone</span>
              <input id="customer-phone" type="tel" placeholder="Ex.: (47) 99999-9999">
            </label>

            <label class="field">
              <span>E-mail</span>
              <input id="customer-email" type="email" placeholder="Ex.: cliente@email.com">
            </label>

            <label class="field">
              <span>Documento</span>
              <input id="customer-document" placeholder="CPF ou CNPJ">
            </label>

            <label class="field">
              <span>Endereço</span>
              <input id="customer-address" placeholder="Rua, número e cidade">
            </label>

            <p id="form-message" class="action-message">O nome do cliente é obrigatório.</p>
            <button class="primary-button" type="submit">Salvar cliente</button>
            <button id="back-customer-list" class="secondary-button" type="button">Voltar para clientes</button>
          </form>
        </div>
      </section>
    `;

    document.getElementById("customer-form").addEventListener("submit", (event) => {
      event.preventDefault();

      const name = document.getElementById("customer-name").value.trim();
      if (!name) {
        document.getElementById("form-message").textContent = "Digite o nome do cliente para continuar.";
        return;
      }

      const customer = {
        id: `c${Date.now()}`,
        name,
        phone: document.getElementById("customer-phone").value.trim(),
        email: document.getElementById("customer-email").value.trim(),
        document: document.getElementById("customer-document").value.trim(),
        address: document.getElementById("customer-address").value.trim()
      };

      state.customers.push(customer);
      state.customer = customer;
      customerConfirmation();
    });

    document.getElementById("back-customer-list").addEventListener("click", customerSelector);
  }

  function customerConfirmation() {
    if (!state.customer) {
      customerSelector();
      return;
    }

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(2, "Cliente confirmado")}
          <div class="login-mini-logo">✓</div>
          <p class="eyebrow">Cliente selecionado</p>
          <h1>${esc(state.customer.name)}</h1>
          <p class="muted">Confira o resumo antes de seguir para o cadastro do ativo.</p>

          <section class="welcome-card" style="margin-top:24px">
            <p>Contato</p>
            <strong>${esc(state.customer.phone || state.customer.email || "Não informado")}</strong>
          </section>

          <section class="welcome-card" style="margin-top:14px">
            <p>Tipo de trabalho</p>
            <strong>${esc(state.workType?.title || "Não informado")}</strong>
          </section>

          <button id="continue-asset" class="primary-button" type="button">Continuar para o ativo</button>
          <button id="change-customer" class="secondary-button" type="button">Alterar cliente</button>
          <button id="cancel-service" class="secondary-button" type="button">Cancelar atendimento</button>
        </div>
      </section>
    `;

    document
      .getElementById("continue-asset")
      .addEventListener("click", assetForm);

    document.getElementById("change-customer").addEventListener("click", customerSelector);

    document.getElementById("cancel-service").addEventListener("click", () => {
      state.workType = null;
      state.customer = null;
      state.asset = null;
      home();
    });
  }


  function assetConfiguration() {
    const type = state.workType?.id || "general";

    const configurations = {
      automotive: {
        icon: "🚗",
        title: "Cadastrar veículo",
        subtitle:
          "Identifique o veículo que será atendido. " +
          "Você poderá consultar todo o histórico dele depois.",
        nameLabel: "Veículo ou identificação *",
        namePlaceholder: "Ex.: Honda Civic",
        primaryLabel: "Placa",
        primaryPlaceholder: "Ex.: ABC1D23",
        secondaryLabel: "Ano / modelo",
        secondaryPlaceholder: "Ex.: 2020 / 2021",
        counterLabel: "Quilometragem atual",
        counterPlaceholder: "Ex.: 84500 km",
        serialLabel: "Chassi",
        serialPlaceholder: "Opcional",
        locationLabel: "Cor",
        locationPlaceholder: "Ex.: Prata"
      },

      industrial: {
        icon: "🏭",
        title: "Cadastrar máquina ou equipamento",
        subtitle:
          "Identifique o ativo industrial para preservar " +
          "seu histórico de inspeções e intervenções.",
        nameLabel: "Nome do ativo *",
        namePlaceholder: "Ex.: Compressor de ar 02",
        primaryLabel: "Código ou TAG",
        primaryPlaceholder: "Ex.: COMP-02",
        secondaryLabel: "Fabricante / modelo",
        secondaryPlaceholder: "Ex.: Atlas Copco GA15",
        counterLabel: "Horas ou ciclos atuais",
        counterPlaceholder: "Ex.: 12.450 horas",
        serialLabel: "Número de série",
        serialPlaceholder: "Opcional",
        locationLabel: "Localização",
        locationPlaceholder: "Ex.: Sala de compressores"
      },

      aerial: {
        icon: "🏢",
        title: "Cadastrar imóvel ou estrutura",
        subtitle:
          "Identifique o local que será inspecionado " +
          "e mantenha o histórico técnico organizado.",
        nameLabel: "Nome do imóvel ou estrutura *",
        namePlaceholder: "Ex.: Edifício Residencial Aurora",
        primaryLabel: "Código interno",
        primaryPlaceholder: "Ex.: PRED-001",
        secondaryLabel: "Tipo de estrutura",
        secondaryPlaceholder: "Ex.: Edificação comercial",
        counterLabel: "Área aproximada",
        counterPlaceholder: "Ex.: 2.500 m²",
        serialLabel: "Identificação complementar",
        serialPlaceholder: "Bloco, unidade ou referência",
        locationLabel: "Endereço ou localização",
        locationPlaceholder: "Rua, número e cidade"
      },

      electrical: {
        icon: "⚡",
        title: "Cadastrar instalação elétrica",
        subtitle:
          "Identifique o quadro, painel, circuito " +
          "ou instalação que receberá o atendimento.",
        nameLabel: "Nome do ativo elétrico *",
        namePlaceholder: "Ex.: Painel TB05",
        primaryLabel: "Código ou TAG",
        primaryPlaceholder: "Ex.: TB05",
        secondaryLabel: "Tipo",
        secondaryPlaceholder: "Ex.: Quadro de distribuição",
        counterLabel: "Tensão / capacidade",
        counterPlaceholder: "Ex.: 380 V / 250 A",
        serialLabel: "Número de série",
        serialPlaceholder: "Opcional",
        locationLabel: "Localização",
        locationPlaceholder: "Ex.: Sala elétrica 01"
      },

      general: {
        icon: "🛠️",
        title: "Cadastrar item ou local",
        subtitle:
          "Identifique aquilo que receberá o serviço " +
          "para preservar seu histórico.",
        nameLabel: "Nome ou identificação *",
        namePlaceholder: "Ex.: Portão principal",
        primaryLabel: "Código ou referência",
        primaryPlaceholder: "Opcional",
        secondaryLabel: "Categoria",
        secondaryPlaceholder: "Ex.: Estrutura metálica",
        counterLabel: "Medida ou contador atual",
        counterPlaceholder: "Horas, ciclos, km ou outra referência",
        serialLabel: "Número de série",
        serialPlaceholder: "Opcional",
        locationLabel: "Localização",
        locationPlaceholder: "Endereço ou setor"
      },

      other: {
        icon: "📦",
        title: "Cadastrar ativo",
        subtitle:
          "Defina o item, equipamento, local ou objeto " +
          "que receberá este atendimento.",
        nameLabel: "Nome ou identificação *",
        namePlaceholder: "Digite uma identificação clara",
        primaryLabel: "Código ou referência",
        primaryPlaceholder: "Opcional",
        secondaryLabel: "Tipo ou categoria",
        secondaryPlaceholder: "Descreva o tipo do ativo",
        counterLabel: "Contador ou medida atual",
        counterPlaceholder: "Opcional",
        serialLabel: "Número de série",
        serialPlaceholder: "Opcional",
        locationLabel: "Localização",
        locationPlaceholder: "Opcional"
      }
    };

    return configurations[type] || configurations.general;
  }

  function assetField(label, id, value, placeholder, required = false) {
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <input
          id="${id}"
          type="text"
          value="${esc(value || "")}"
          placeholder="${esc(placeholder || "")}"
          ${required ? "required" : ""}
        >
      </label>
    `;
  }

  function assetForm() {
    if (!state.customer) {
      customerSelector();
      return;
    }

    const config = assetConfiguration();
    const asset = state.asset || {};

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(3, "Ativo")}

          <div class="login-mini-logo">
            ${config.icon}
          </div>

          <p class="eyebrow">Novo atendimento</p>

          <h1>${esc(config.title)}</h1>

          <p class="muted">${esc(config.subtitle)}</p>

          <section
            class="welcome-card"
            style="margin-top:24px"
          >
            <p>Cliente selecionado</p>
            <strong>${esc(state.customer.name)}</strong>
          </section>

          <form id="asset-form">
            ${assetField(
              config.nameLabel,
              "asset-name",
              asset.name,
              config.namePlaceholder,
              true
            )}

            ${assetField(
              config.primaryLabel,
              "asset-primary",
              asset.primary,
              config.primaryPlaceholder
            )}

            ${assetField(
              config.secondaryLabel,
              "asset-secondary",
              asset.secondary,
              config.secondaryPlaceholder
            )}

            ${assetField(
              config.counterLabel,
              "asset-counter",
              asset.counter,
              config.counterPlaceholder
            )}

            ${assetField(
              config.serialLabel,
              "asset-serial",
              asset.serial,
              config.serialPlaceholder
            )}

            ${assetField(
              config.locationLabel,
              "asset-location",
              asset.location,
              config.locationPlaceholder
            )}

            <label class="field">
              <span>Observações</span>

              <textarea
                id="asset-notes"
                rows="4"
                placeholder="Informações importantes sobre este ativo"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(asset.notes || "")}</textarea>
            </label>

            <p
              id="asset-form-message"
              class="action-message"
            >
              O campo de identificação é obrigatório.
            </p>

            <button
              class="primary-button"
              type="submit"
            >
              Salvar ativo
            </button>

            <button
              id="back-customer-confirmation"
              class="secondary-button"
              type="button"
            >
              Voltar para o cliente
            </button>
          </form>
        </div>
      </section>
    `;

    document
      .getElementById("asset-form")
      .addEventListener("submit", saveAsset);

    document
      .getElementById("back-customer-confirmation")
      .addEventListener("click", customerConfirmation);
  }

  function saveAsset(event) {
    event.preventDefault();

    const name =
      document
        .getElementById("asset-name")
        .value
        .trim();

    if (!name) {
      const message =
        document.getElementById("asset-form-message");

      message.textContent =
        "Digite o nome ou a identificação do ativo para continuar.";

      message.style.color = "#ff9aa6";
      return;
    }

    state.asset = {
      id:
        state.asset?.id ||
        `a${Date.now()}`,

      type:
        state.workType?.id ||
        "general",

      name,

      primary:
        document
          .getElementById("asset-primary")
          .value
          .trim(),

      secondary:
        document
          .getElementById("asset-secondary")
          .value
          .trim(),

      counter:
        document
          .getElementById("asset-counter")
          .value
          .trim(),

      serial:
        document
          .getElementById("asset-serial")
          .value
          .trim(),

      location:
        document
          .getElementById("asset-location")
          .value
          .trim(),

      notes:
        document
          .getElementById("asset-notes")
          .value
          .trim()
    };

    assetConfirmation();
  }

  function assetSummaryLine(label, value) {
    if (!value) {
      return "";
    }

    return `
      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:18px;
          padding:12px 0;
          border-bottom:1px solid rgba(255,255,255,.09);
        "
      >
        <span style="color:#b9c8dc">
          ${esc(label)}
        </span>

        <strong
          style="
            color:#ffffff;
            text-align:right;
            overflow-wrap:anywhere;
          "
        >
          ${esc(value)}
        </strong>
      </div>
    `;
  }

  function assetConfirmation() {
    if (!state.asset) {
      assetForm();
      return;
    }

    const config = assetConfiguration();

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(3, "Ativo confirmado")}

          <div class="login-mini-logo">✓</div>

          <p class="eyebrow">Ativo salvo</p>

          <h1>${esc(state.asset.name)}</h1>

          <p class="muted">
            Confira as informações antes de seguir
            para a entrada do atendimento.
          </p>

          <section
            class="welcome-card"
            style="margin-top:24px"
          >
            <p>Cliente</p>
            <strong>${esc(state.customer.name)}</strong>
          </section>

          <section
            class="welcome-card"
            style="margin-top:14px"
          >
            <p>Tipo de trabalho</p>
            <strong>${esc(state.workType?.title || "Não informado")}</strong>
          </section>

          <section
            style="
              margin-top:14px;
              padding:20px;
              border:1px solid rgba(255,255,255,.14);
              border-radius:22px;
              background:rgba(255,255,255,.055);
            "
          >
            ${assetSummaryLine(
              config.primaryLabel,
              state.asset.primary
            )}

            ${assetSummaryLine(
              config.secondaryLabel,
              state.asset.secondary
            )}

            ${assetSummaryLine(
              config.counterLabel,
              state.asset.counter
            )}

            ${assetSummaryLine(
              config.serialLabel,
              state.asset.serial
            )}

            ${assetSummaryLine(
              config.locationLabel,
              state.asset.location
            )}

            ${
              !state.asset.primary &&
              !state.asset.secondary &&
              !state.asset.counter &&
              !state.asset.serial &&
              !state.asset.location
                ? `
                    <p
                      class="muted"
                      style="margin:0"
                    >
                      Nenhuma informação complementar registrada.
                    </p>
                  `
                : ""
            }
          </section>

          <button
            id="continue-intake"
            class="primary-button"
            type="button"
          >
            Continuar para a entrada
          </button>

          <button
            id="edit-asset"
            class="secondary-button"
            type="button"
          >
            Editar ativo
          </button>

          <button
            id="change-customer-from-asset"
            class="secondary-button"
            type="button"
          >
            Alterar cliente
          </button>

          <button
            id="cancel-asset-flow"
            class="secondary-button"
            type="button"
          >
            Cancelar atendimento
          </button>
        </div>
      </section>
    `;

    document
      .getElementById("continue-intake")
      .addEventListener("click", intakeForm);

    document
      .getElementById("edit-asset")
      .addEventListener("click", assetForm);

    document
      .getElementById("change-customer-from-asset")
      .addEventListener("click", customerSelector);

    document
      .getElementById("cancel-asset-flow")
      .addEventListener("click", function () {
        state.workType = null;
        state.customer = null;
        state.asset = null;
        state.intake = null;
        state.occurrences = [];
        state.editingOccurrenceId = null;
        state.selectedEvidenceOccurrenceId = null;
        state.previewEvidence = null;
        state.diagnostic = null;
        home();
      });
  }


  function localDateValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  }

  function localTimeValue() {
    const now = new Date();
    return [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0")
    ].join(":");
  }

  function intakeConfiguration() {
    const type = state.workType?.id || "general";

    const configurations = {
      automotive: {
        icon: "📝",
        title: "Entrada do veículo",
        subtitle:
          "Registre o motivo da chegada, a solicitação do cliente " +
          "e as condições iniciais do veículo.",
        reasonLabel: "Motivo da entrada *",
        reasonPlaceholder:
          "Ex.: Barulho na suspensão dianteira ao passar em lombadas",
        conditionLabel: "Condição inicial do veículo",
        conditionPlaceholder:
          "Ex.: Veículo em funcionamento, riscos no para-choque traseiro",
        requestLabel: "Solicitação do cliente",
        requestPlaceholder:
          "Ex.: Verificar suspensão e apresentar orçamento antes do reparo"
      },

      industrial: {
        icon: "📝",
        title: "Entrada da inspeção",
        subtitle:
          "Registre a demanda, a condição operacional " +
          "e o objetivo inicial do atendimento.",
        reasonLabel: "Motivo do atendimento *",
        reasonPlaceholder:
          "Ex.: Vibração acima do normal no conjunto motriz",
        conditionLabel: "Condição operacional inicial",
        conditionPlaceholder:
          "Ex.: Equipamento parado e bloqueado para inspeção",
        requestLabel: "Solicitação da equipe ou cliente",
        requestPlaceholder:
          "Ex.: Diagnosticar causa e indicar ações recomendadas"
      },

      aerial: {
        icon: "📝",
        title: "Entrada da inspeção aérea",
        subtitle:
          "Registre o objetivo do levantamento " +
          "e as condições conhecidas antes da inspeção.",
        reasonLabel: "Objetivo da inspeção *",
        reasonPlaceholder:
          "Ex.: Levantamento visual da cobertura para manutenção predial",
        conditionLabel: "Condição conhecida do local",
        conditionPlaceholder:
          "Ex.: Infiltração relatada na região norte da cobertura",
        requestLabel: "Solicitação do cliente",
        requestPlaceholder:
          "Ex.: Identificar telhas danificadas e pontos de possível infiltração"
      },

      electrical: {
        icon: "📝",
        title: "Entrada do atendimento elétrico",
        subtitle:
          "Registre a falha relatada, a condição inicial " +
          "e o objetivo do serviço.",
        reasonLabel: "Motivo do atendimento *",
        reasonPlaceholder:
          "Ex.: Disjuntor desarmando durante a partida do equipamento",
        conditionLabel: "Condição inicial da instalação",
        conditionPlaceholder:
          "Ex.: Painel energizado, equipamento indisponível",
        requestLabel: "Solicitação do cliente",
        requestPlaceholder:
          "Ex.: Realizar diagnóstico e apresentar correção recomendada"
      },

      general: {
        icon: "📝",
        title: "Entrada do atendimento",
        subtitle:
          "Registre por que o serviço foi solicitado " +
          "e como o item foi recebido.",
        reasonLabel: "Motivo do atendimento *",
        reasonPlaceholder:
          "Descreva o problema, necessidade ou serviço solicitado",
        conditionLabel: "Condição inicial",
        conditionPlaceholder:
          "Descreva como o item ou local foi encontrado",
        requestLabel: "Solicitação do cliente",
        requestPlaceholder:
          "Descreva o resultado esperado pelo cliente"
      },

      other: {
        icon: "📝",
        title: "Entrada do atendimento",
        subtitle:
          "Registre as informações iniciais " +
          "que orientarão este trabalho.",
        reasonLabel: "Motivo do atendimento *",
        reasonPlaceholder:
          "Descreva o motivo principal",
        conditionLabel: "Condição inicial",
        conditionPlaceholder:
          "Descreva a situação encontrada",
        requestLabel: "Solicitação",
        requestPlaceholder:
          "Descreva o que deverá ser avaliado ou executado"
      }
    };

    return configurations[type] || configurations.general;
  }

  function intakeForm() {
    if (!state.asset) {
      assetForm();
      return;
    }

    const config = intakeConfiguration();
    const intake = state.intake || {};

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(4, "Entrada do atendimento")}

          <div class="login-mini-logo">${config.icon}</div>

          <p class="eyebrow">Novo atendimento</p>

          <h1>${esc(config.title)}</h1>

          <p class="muted">${esc(config.subtitle)}</p>

          <section class="welcome-card" style="margin-top:24px">
            <p>Cliente e ativo</p>
            <strong>
              ${esc(state.customer.name)}
              ·
              ${esc(state.asset.name)}
            </strong>
          </section>

          <form id="intake-form">
            <label class="field">
              <span>${esc(config.reasonLabel)}</span>

              <textarea
                id="intake-reason"
                rows="4"
                placeholder="${esc(config.reasonPlaceholder)}"
                required
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(intake.reason || "")}</textarea>
            </label>

            <label class="field">
              <span>${esc(config.conditionLabel)}</span>

              <textarea
                id="intake-condition"
                rows="3"
                placeholder="${esc(config.conditionPlaceholder)}"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(intake.condition || "")}</textarea>
            </label>

            <label class="field">
              <span>${esc(config.requestLabel)}</span>

              <textarea
                id="intake-request"
                rows="3"
                placeholder="${esc(config.requestPlaceholder)}"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(intake.request || "")}</textarea>
            </label>

            <label class="field">
              <span>Responsável pela entrada</span>

              <input
                id="intake-responsible"
                type="text"
                value="${esc(intake.responsible || state.user?.name || "Maike")}"
                placeholder="Nome de quem recebeu ou iniciou o atendimento"
              >
            </label>

            <div
              style="
                display:grid;
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:14px;
              "
            >
              <label class="field">
                <span>Data de entrada</span>

                <input
                  id="intake-date"
                  type="date"
                  value="${esc(intake.date || localDateValue())}"
                >
              </label>

              <label class="field">
                <span>Hora</span>

                <input
                  id="intake-time"
                  type="time"
                  value="${esc(intake.time || localTimeValue())}"
                >
              </label>
            </div>

            <label class="field">
              <span>Prioridade</span>

              <select
                id="intake-priority"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  background:#15203a;
                  font:inherit;
                  box-sizing:border-box;
                "
              >
                <option value="normal" ${intake.priority === "normal" || !intake.priority ? "selected" : ""}>
                  Normal
                </option>

                <option value="attention" ${intake.priority === "attention" ? "selected" : ""}>
                  Requer atenção
                </option>

                <option value="urgent" ${intake.priority === "urgent" ? "selected" : ""}>
                  Urgente
                </option>
              </select>
            </label>

            <label class="field">
              <span>Prazo ou previsão desejada</span>

              <input
                id="intake-deadline"
                type="text"
                value="${esc(intake.deadline || "")}"
                placeholder="Ex.: Até sexta-feira, sem prazo definido..."
              >
            </label>

            <label
              style="
                display:flex;
                align-items:flex-start;
                gap:12px;
                margin-top:20px;
                color:#dce7f7;
                line-height:1.45;
              "
            >
              <input
                id="intake-authorization"
                type="checkbox"
                ${intake.authorization ? "checked" : ""}
                style="
                  width:20px;
                  height:20px;
                  margin-top:1px;
                  flex:0 0 20px;
                "
              >

              <span>
                A entrada foi conferida com o cliente
                ou responsável presente.
              </span>
            </label>

            <p id="intake-message" class="action-message">
              O motivo do atendimento é obrigatório.
            </p>

            <button class="primary-button" type="submit">
              Salvar entrada
            </button>

            <button
              id="back-asset-confirmation"
              class="secondary-button"
              type="button"
            >
              Voltar para o ativo
            </button>
          </form>
        </div>
      </section>
    `;

    document
      .getElementById("intake-form")
      .addEventListener("submit", saveIntake);

    document
      .getElementById("back-asset-confirmation")
      .addEventListener("click", assetConfirmation);
  }

  function saveIntake(event) {
    event.preventDefault();

    const reason =
      document
        .getElementById("intake-reason")
        .value
        .trim();

    if (!reason) {
      const message =
        document.getElementById("intake-message");

      message.textContent =
        "Descreva o motivo do atendimento para continuar.";

      message.style.color = "#ff9aa6";
      return;
    }

    state.intake = {
      reason,

      condition:
        document
          .getElementById("intake-condition")
          .value
          .trim(),

      request:
        document
          .getElementById("intake-request")
          .value
          .trim(),

      responsible:
        document
          .getElementById("intake-responsible")
          .value
          .trim(),

      date:
        document
          .getElementById("intake-date")
          .value,

      time:
        document
          .getElementById("intake-time")
          .value,

      priority:
        document
          .getElementById("intake-priority")
          .value,

      deadline:
        document
          .getElementById("intake-deadline")
          .value
          .trim(),

      authorization:
        document
          .getElementById("intake-authorization")
          .checked
    };

    intakeConfirmation();
  }

  function priorityLabel(value) {
    const labels = {
      normal: "Normal",
      attention: "Requer atenção",
      urgent: "Urgente"
    };

    return labels[value] || "Normal";
  }

  function intakeSummaryLine(label, value) {
    if (!value) {
      return "";
    }

    return `
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:18px;
          padding:12px 0;
          border-bottom:1px solid rgba(255,255,255,.09);
        "
      >
        <span style="color:#b9c8dc">
          ${esc(label)}
        </span>

        <strong
          style="
            max-width:62%;
            color:#ffffff;
            text-align:right;
            overflow-wrap:anywhere;
            white-space:pre-line;
          "
        >
          ${esc(value)}
        </strong>
      </div>
    `;
  }

  function intakeConfirmation() {
    if (!state.intake) {
      intakeForm();
      return;
    }

    const dateTime = [
      state.intake.date,
      state.intake.time
    ]
      .filter(Boolean)
      .join(" · ");

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(4, "Entrada confirmada")}

          <div class="login-mini-logo">✓</div>

          <p class="eyebrow">Entrada salva</p>

          <h1>Atendimento aberto</h1>

          <p class="muted">
            Confira o resumo antes de iniciar
            o levantamento das ocorrências.
          </p>

          <section class="welcome-card" style="margin-top:24px">
            <p>Cliente</p>
            <strong>${esc(state.customer.name)}</strong>
          </section>

          <section class="welcome-card" style="margin-top:14px">
            <p>Ativo</p>
            <strong>${esc(state.asset.name)}</strong>
          </section>

          <section
            style="
              margin-top:14px;
              padding:20px;
              border:1px solid rgba(255,255,255,.14);
              border-radius:22px;
              background:rgba(255,255,255,.055);
            "
          >
            ${intakeSummaryLine("Motivo", state.intake.reason)}
            ${intakeSummaryLine("Condição inicial", state.intake.condition)}
            ${intakeSummaryLine("Solicitação", state.intake.request)}
            ${intakeSummaryLine("Responsável", state.intake.responsible)}
            ${intakeSummaryLine("Entrada", dateTime)}
            ${intakeSummaryLine("Prioridade", priorityLabel(state.intake.priority))}
            ${intakeSummaryLine("Prazo desejado", state.intake.deadline)}
            ${intakeSummaryLine(
              "Conferência",
              state.intake.authorization
                ? "Conferida com o cliente ou responsável"
                : "Ainda não confirmada"
            )}
          </section>

          <button
            id="continue-occurrences"
            class="primary-button"
            type="button"
          >
            Iniciar ocorrências
          </button>

          <button
            id="edit-intake"
            class="secondary-button"
            type="button"
          >
            Editar entrada
          </button>

          <button
            id="back-asset-from-intake"
            class="secondary-button"
            type="button"
          >
            Voltar para o ativo
          </button>

          <button
            id="cancel-intake-flow"
            class="secondary-button"
            type="button"
          >
            Cancelar atendimento
          </button>
        </div>
      </section>
    `;

    document
      .getElementById("continue-occurrences")
      .addEventListener("click", occurrenceList);

    document
      .getElementById("edit-intake")
      .addEventListener("click", intakeForm);

    document
      .getElementById("back-asset-from-intake")
      .addEventListener("click", assetConfirmation);

    document
      .getElementById("cancel-intake-flow")
      .addEventListener("click", function () {
        state.workType = null;
        state.customer = null;
        state.asset = null;
        state.intake = null;
        home();
      });
  }


  function occurrenceConfiguration() {
    const type = state.workType?.id || "general";

    const configurations = {
      automotive: {
        icon: "🔧",
        title: "Ocorrência mecânica",
        itemLabel: "Item inspecionado *",
        itemPlaceholder:
          "Ex.: Amortecedor dianteiro esquerdo",
        titlePlaceholder:
          "Ex.: Vazamento no amortecedor",
        descriptionPlaceholder:
          "Descreva o problema, sintoma ou condição encontrada",
        recommendationPlaceholder:
          "Ex.: Recomenda-se substituir o par de amortecedores dianteiros"
      },

      industrial: {
        icon: "🏭",
        title: "Ocorrência industrial",
        itemLabel: "Componente ou ponto inspecionado *",
        itemPlaceholder:
          "Ex.: Mancal do motor principal",
        titlePlaceholder:
          "Ex.: Vibração acima do limite esperado",
        descriptionPlaceholder:
          "Descreva a anomalia, condição operacional ou desvio encontrado",
        recommendationPlaceholder:
          "Ex.: Verificar alinhamento e condição dos rolamentos"
      },

      aerial: {
        icon: "🚁",
        title: "Ocorrência da inspeção aérea",
        itemLabel: "Elemento inspecionado *",
        itemPlaceholder:
          "Ex.: Cobertura — setor norte",
        titlePlaceholder:
          "Ex.: Telhas deslocadas",
        descriptionPlaceholder:
          "Descreva visualmente a condição identificada",
        recommendationPlaceholder:
          "Ex.: Reposicionar e fixar as telhas por equipe qualificada"
      },

      electrical: {
        icon: "⚡",
        title: "Ocorrência elétrica",
        itemLabel: "Componente ou circuito inspecionado *",
        itemPlaceholder:
          "Ex.: Disjuntor QF-03",
        titlePlaceholder:
          "Ex.: Aquecimento anormal no terminal",
        descriptionPlaceholder:
          "Descreva a falha, medição, risco ou condição observada",
        recommendationPlaceholder:
          "Ex.: Desenergizar, reapertar conexões e repetir a medição"
      },

      general: {
        icon: "🛠️",
        title: "Nova ocorrência",
        itemLabel: "Item ou local inspecionado *",
        itemPlaceholder:
          "Ex.: Portão principal",
        titlePlaceholder:
          "Ex.: Folga excessiva na dobradiça",
        descriptionPlaceholder:
          "Descreva claramente o que foi encontrado",
        recommendationPlaceholder:
          "Descreva a ação recomendada"
      },

      other: {
        icon: "📌",
        title: "Nova ocorrência",
        itemLabel: "Item inspecionado *",
        itemPlaceholder:
          "Informe o item, local ou componente",
        titlePlaceholder:
          "Dê um título curto para a ocorrência",
        descriptionPlaceholder:
          "Descreva claramente o que foi encontrado",
        recommendationPlaceholder:
          "Descreva a ação recomendada"
      }
    };

    return configurations[type] || configurations.general;
  }

  function severityLabel(value) {
    const labels = {
      info: "Informativa",
      low: "Baixa",
      medium: "Média",
      high: "Alta",
      critical: "Crítica"
    };

    return labels[value] || "Informativa";
  }

  function severityStyle(value) {
    const styles = {
      info: {
        color: "#9ed8ff",
        background: "rgba(92,168,255,.14)"
      },
      low: {
        color: "#84efbd",
        background: "rgba(94,226,160,.14)"
      },
      medium: {
        color: "#ffe08a",
        background: "rgba(255,192,72,.14)"
      },
      high: {
        color: "#ffae8f",
        background: "rgba(255,126,89,.15)"
      },
      critical: {
        color: "#ff91a0",
        background: "rgba(255,74,98,.17)"
      }
    };

    return styles[value] || styles.info;
  }

  function followUpText(occurrence) {
    if (!occurrence.followUpEnabled) {
      return "Sem acompanhamento periódico";
    }

    const units = {
      days: "dias",
      hours: "horas",
      kilometers: "quilômetros",
      cycles: "ciclos",
      months: "meses"
    };

    const unit =
      units[occurrence.followUpUnit] ||
      occurrence.followUpUnit ||
      "período";

    return `Revisar a cada ${occurrence.followUpValue} ${unit}`;
  }

  function occurrenceList() {
    if (!state.intake) {
      intakeForm();
      return;
    }

    state.editingOccurrenceId = null;

    const cards =
      state.occurrences.length
        ? state.occurrences
            .map(function (occurrence, index) {
              const style =
                severityStyle(occurrence.severity);

              return `
                <article
                  style="
                    padding:20px;
                    border:1px solid rgba(255,255,255,.14);
                    border-radius:22px;
                    background:rgba(255,255,255,.06);
                    box-shadow:0 16px 36px rgba(0,0,0,.16);
                  "
                >
                  <div
                    style="
                      display:flex;
                      align-items:flex-start;
                      justify-content:space-between;
                      gap:16px;
                    "
                  >
                    <div style="min-width:0">
                      <p
                        class="eyebrow"
                        style="margin-bottom:7px"
                      >
                        Ocorrência ${index + 1}
                      </p>

                      <h2
                        style="
                          margin:0;
                          color:#ffffff;
                          font-size:21px;
                          overflow-wrap:anywhere;
                        "
                      >
                        ${esc(occurrence.title)}
                      </h2>

                      <p
                        class="muted"
                        style="margin-top:7px"
                      >
                        ${esc(occurrence.item)}
                      </p>
                    </div>

                    <span
                      style="
                        flex:0 0 auto;
                        padding:7px 10px;
                        border-radius:999px;
                        color:${style.color};
                        background:${style.background};
                        font-size:12px;
                        font-weight:800;
                      "
                    >
                      ${esc(severityLabel(occurrence.severity))}
                    </span>
                  </div>

                  <p
                    style="
                      margin:17px 0 0;
                      color:#dce7f7;
                      line-height:1.55;
                      white-space:pre-line;
                    "
                  >
                    ${esc(occurrence.description)}
                  </p>

                  ${
                    occurrence.recommendation
                      ? `
                          <section
                            style="
                              margin-top:15px;
                              padding:15px;
                              border-radius:17px;
                              background:rgba(100,240,229,.07);
                            "
                          >
                            <p
                              style="
                                margin:0 0 6px;
                                color:#64f0e5;
                                font-size:12px;
                                font-weight:800;
                                text-transform:uppercase;
                                letter-spacing:.1em;
                              "
                            >
                              Recomendação
                            </p>

                            <p
                              style="
                                margin:0;
                                color:#e8f2ff;
                                line-height:1.5;
                                white-space:pre-line;
                              "
                            >
                              ${esc(occurrence.recommendation)}
                            </p>
                          </section>
                        `
                      : ""
                  }

                  <p
                    class="muted"
                    style="
                      margin-top:15px;
                      font-size:13px;
                    "
                  >
                    ${esc(followUpText(occurrence))}
                  </p>

                  <div
                    style="
                      display:grid;
                      grid-template-columns:repeat(2,minmax(0,1fr));
                      gap:10px;
                      margin-top:16px;
                    "
                  >
                    <button
                      class="secondary-button"
                      type="button"
                      data-edit-occurrence="${esc(occurrence.id)}"
                      style="margin-top:0"
                    >
                      Editar
                    </button>

                    <button
                      class="secondary-button"
                      type="button"
                      data-delete-occurrence="${esc(occurrence.id)}"
                      style="
                        margin-top:0;
                        color:#ff9aa6;
                      "
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              `;
            })
            .join("")
        : `
            <section
              class="welcome-card"
              style="margin-top:0"
            >
              <p>Nenhuma ocorrência registrada</p>

              <strong>
                Comece adicionando o primeiro item inspecionado
              </strong>
            </section>
          `;

    app.innerHTML = `
      <section class="screen home-screen">
        <header class="home-header">
          <div>
            <p class="eyebrow">Novo atendimento</p>

            <h1>Ocorrências</h1>

            <p class="muted">
              Registre tudo o que foi observado.
              Você poderá adicionar fotos no próximo passo.
            </p>
          </div>

          <div
            class="avatar"
            id="back-intake"
            role="button"
            tabindex="0"
            aria-label="Voltar"
          >
            ‹
          </div>
        </header>

        <main class="home-content">
          ${progress(5, "Ocorrências")}

          <section
            class="welcome-card"
            style="margin-bottom:18px"
          >
            <p>Atendimento atual</p>

            <strong>
              ${esc(state.customer.name)}
              ·
              ${esc(state.asset.name)}
            </strong>
          </section>

          <div
            style="
              display:grid;
              gap:14px;
            "
          >
            ${cards}
          </div>

          <button
            id="new-occurrence"
            class="primary-button"
            type="button"
          >
            + Adicionar ocorrência
          </button>

          <button
            id="continue-evidence"
            class="secondary-button"
            type="button"
            ${state.occurrences.length ? "" : "disabled"}
            style="
              ${
                state.occurrences.length
                  ? ""
                  : "opacity:.45;pointer-events:none;"
              }
            "
          >
            Continuar para evidências
          </button>

          <button
            id="back-intake-button"
            class="secondary-button"
            type="button"
          >
            Voltar para a entrada
          </button>
        </main>
      </section>
    `;

    document
      .getElementById("new-occurrence")
      .addEventListener("click", function () {
        state.editingOccurrenceId = null;
        occurrenceForm();
      });

    document
      .getElementById("back-intake")
      .addEventListener("click", intakeConfirmation);

    document
      .getElementById("back-intake-button")
      .addEventListener("click", intakeConfirmation);

    document
      .getElementById("continue-evidence")
      .addEventListener("click", evidenceOccurrenceSelector);

    document
      .querySelectorAll("[data-edit-occurrence]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          state.editingOccurrenceId =
            button.dataset.editOccurrence;

          occurrenceForm();
        });
      });

    document
      .querySelectorAll("[data-delete-occurrence]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          deleteOccurrence(
            button.dataset.deleteOccurrence
          );
        });
      });
  }

  function occurrenceForm() {
    const config = occurrenceConfiguration();

    const occurrence =
      state.occurrences.find(function (item) {
        return item.id === state.editingOccurrenceId;
      }) || {};

    const isEditing = Boolean(occurrence.id);

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(5, isEditing ? "Editar ocorrência" : "Nova ocorrência")}

          <div class="login-mini-logo">
            ${config.icon}
          </div>

          <p class="eyebrow">
            ${isEditing ? "Edição" : "Novo registro"}
          </p>

          <h1>${esc(config.title)}</h1>

          <p class="muted">
            Use uma descrição clara e objetiva.
            Fotos serão adicionadas na próxima etapa.
          </p>

          <form id="occurrence-form">
            <label class="field">
              <span>${esc(config.itemLabel)}</span>

              <input
                id="occurrence-item"
                type="text"
                value="${esc(occurrence.item || "")}"
                placeholder="${esc(config.itemPlaceholder)}"
                required
              >
            </label>

            <label class="field">
              <span>Título da ocorrência *</span>

              <input
                id="occurrence-title"
                type="text"
                value="${esc(occurrence.title || "")}"
                placeholder="${esc(config.titlePlaceholder)}"
                required
              >
            </label>

            <label class="field">
              <span>Descrição detalhada *</span>

              <textarea
                id="occurrence-description"
                rows="5"
                placeholder="${esc(config.descriptionPlaceholder)}"
                required
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(occurrence.description || "")}</textarea>
            </label>

            <label class="field">
              <span>Gravidade</span>

              <select
                id="occurrence-severity"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  background:#15203a;
                  font:inherit;
                  box-sizing:border-box;
                "
              >
                <option value="info" ${occurrence.severity === "info" || !occurrence.severity ? "selected" : ""}>
                  Informativa
                </option>

                <option value="low" ${occurrence.severity === "low" ? "selected" : ""}>
                  Baixa
                </option>

                <option value="medium" ${occurrence.severity === "medium" ? "selected" : ""}>
                  Média
                </option>

                <option value="high" ${occurrence.severity === "high" ? "selected" : ""}>
                  Alta
                </option>

                <option value="critical" ${occurrence.severity === "critical" ? "selected" : ""}>
                  Crítica
                </option>
              </select>
            </label>

            <label class="field">
              <span>Recomendação ou ação sugerida</span>

              <textarea
                id="occurrence-recommendation"
                rows="4"
                placeholder="${esc(config.recommendationPlaceholder)}"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(occurrence.recommendation || "")}</textarea>
            </label>

            <label
              style="
                display:flex;
                align-items:flex-start;
                gap:12px;
                margin-top:21px;
                color:#dce7f7;
                line-height:1.45;
              "
            >
              <input
                id="follow-up-enabled"
                type="checkbox"
                ${occurrence.followUpEnabled ? "checked" : ""}
                style="
                  width:20px;
                  height:20px;
                  margin-top:1px;
                  flex:0 0 20px;
                "
              >

              <span>
                Criar acompanhamento periódico para esta ocorrência
              </span>
            </label>

            <section
              id="follow-up-fields"
              style="
                display:${occurrence.followUpEnabled ? "grid" : "none"};
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:14px;
                margin-top:4px;
              "
            >
              <label class="field">
                <span>A cada</span>

                <input
                  id="follow-up-value"
                  type="number"
                  min="1"
                  step="1"
                  value="${esc(occurrence.followUpValue || "30")}"
                >
              </label>

              <label class="field">
                <span>Unidade</span>

                <select
                  id="follow-up-unit"
                  style="
                    width:100%;
                    max-width:100%;
                    min-width:0;
                    padding:16px;
                    color:#ffffff;
                    border:1px solid rgba(255,255,255,.14);
                    border-radius:18px;
                    outline:none;
                    background:#15203a;
                    font:inherit;
                    box-sizing:border-box;
                  "
                >
                  <option value="days" ${occurrence.followUpUnit === "days" || !occurrence.followUpUnit ? "selected" : ""}>
                    Dias
                  </option>

                  <option value="hours" ${occurrence.followUpUnit === "hours" ? "selected" : ""}>
                    Horas
                  </option>

                  <option value="kilometers" ${occurrence.followUpUnit === "kilometers" ? "selected" : ""}>
                    Quilômetros
                  </option>

                  <option value="cycles" ${occurrence.followUpUnit === "cycles" ? "selected" : ""}>
                    Ciclos
                  </option>

                  <option value="months" ${occurrence.followUpUnit === "months" ? "selected" : ""}>
                    Meses
                  </option>
                </select>
              </label>
            </section>

            <p
              id="occurrence-message"
              class="action-message"
            >
              Item, título e descrição são obrigatórios.
            </p>

            <button
              class="primary-button"
              type="submit"
            >
              ${isEditing ? "Salvar alterações" : "Salvar ocorrência"}
            </button>

            <button
              id="cancel-occurrence"
              class="secondary-button"
              type="button"
            >
              Voltar para a lista
            </button>
          </form>
        </div>
      </section>
    `;

    document
      .getElementById("follow-up-enabled")
      .addEventListener("change", function (event) {
        document
          .getElementById("follow-up-fields")
          .style
          .display =
            event.target.checked
              ? "grid"
              : "none";
      });

    document
      .getElementById("occurrence-form")
      .addEventListener("submit", saveOccurrence);

    document
      .getElementById("cancel-occurrence")
      .addEventListener("click", occurrenceList);
  }

  function saveOccurrence(event) {
    event.preventDefault();

    const item =
      document
        .getElementById("occurrence-item")
        .value
        .trim();

    const title =
      document
        .getElementById("occurrence-title")
        .value
        .trim();

    const description =
      document
        .getElementById("occurrence-description")
        .value
        .trim();

    if (!item || !title || !description) {
      const message =
        document.getElementById("occurrence-message");

      message.textContent =
        "Preencha o item, o título e a descrição para continuar.";

      message.style.color = "#ff9aa6";
      return;
    }

    const followUpEnabled =
      document
        .getElementById("follow-up-enabled")
        .checked;

    const followUpValue =
      document
        .getElementById("follow-up-value")
        .value;

    const occurrenceId =
      state.editingOccurrenceId ||
      `o${Date.now()}`;

    const existingIndex =
      state.occurrences.findIndex(function (item) {
        return item.id === occurrenceId;
      });

    const occurrence = {
      id: occurrenceId,

      item,

      title,

      description,

      severity:
        document
          .getElementById("occurrence-severity")
          .value,

      recommendation:
        document
          .getElementById("occurrence-recommendation")
          .value
          .trim(),

      followUpEnabled,

      followUpValue:
        followUpEnabled
          ? followUpValue || "1"
          : "",

      followUpUnit:
        followUpEnabled
          ? document
              .getElementById("follow-up-unit")
              .value
          : "",

      photos:
        existingIndex >= 0
          ? state.occurrences[existingIndex].photos || []
          : []
    };

    if (existingIndex >= 0) {
      state.occurrences[existingIndex] = occurrence;
    } else {
      state.occurrences.push(occurrence);
    }

    state.editingOccurrenceId = null;
    occurrenceList();
  }

  async function deleteOccurrence(id) {
    const occurrence =
      state.occurrences.find(function (item) {
        return item.id === id;
      });

    if (!occurrence) {
      return;
    }

    const confirmed =
      await window.AuroraDialog.confirm(`A ocorrência “${occurrence.title}” será excluída.`, { title: "Excluir ocorrência?", confirmLabel: "Excluir", tone: "danger" });

    if (!confirmed) {
      return;
    }

    state.occurrences =
      state.occurrences.filter(function (item) {
        return item.id !== id;
      });

    occurrenceList();
  }


  function totalEvidenceCount() {
    return state.occurrences.reduce(function (total, occurrence) {
      return total + (occurrence.photos?.length || 0);
    }, 0);
  }

  function evidenceOccurrenceSelector() {
    if (!state.occurrences.length) {
      occurrenceList();
      return;
    }

    state.selectedEvidenceOccurrenceId = null;
    state.previewEvidence = null;

    const cards =
      state.occurrences
        .map(function (occurrence, index) {
          const photoCount = occurrence.photos?.length || 0;

          return `
            <button
              class="action-card"
              type="button"
              data-evidence-occurrence="${esc(occurrence.id)}"
              style="min-height:156px"
            >
              <span class="action-icon">
                ${photoCount ? "🖼️" : "📷"}
              </span>

              <span class="action-title">
                ${index + 1}. ${esc(occurrence.title)}
              </span>

              <span class="action-description">
                ${esc(occurrence.item)}
                <br>
                ${photoCount}
                ${photoCount === 1 ? "foto anexada" : "fotos anexadas"}
              </span>

              <span class="action-arrow">›</span>
            </button>
          `;
        })
        .join("");

    app.innerHTML = `
      <section class="screen home-screen">
        <header class="home-header">
          <div>
            <p class="eyebrow">Evidências</p>

            <h1>Escolha uma ocorrência</h1>

            <p class="muted">
              Cada foto ficará vinculada à ocorrência selecionada.
            </p>
          </div>

          <div
            class="avatar"
            id="back-occurrences"
            role="button"
            tabindex="0"
            aria-label="Voltar"
          >
            ‹
          </div>
        </header>

        <main class="home-content">
          ${progress(5, "Fotos e evidências")}

          <section
            class="welcome-card"
            style="margin-bottom:18px"
          >
            <p>Resumo do atendimento</p>

            <strong>
              ${state.occurrences.length}
              ${state.occurrences.length === 1 ? "ocorrência" : "ocorrências"}
              ·
              ${totalEvidenceCount()}
              ${totalEvidenceCount() === 1 ? "foto" : "fotos"}
            </strong>
          </section>

          <div class="action-grid">
            ${cards}
          </div>

          <button
            id="finish-evidence"
            class="primary-button"
            type="button"
          >
            Revisar atendimento
          </button>

          <button
            id="return-occurrences"
            class="secondary-button"
            type="button"
          >
            Voltar para ocorrências
          </button>
        </main>
      </section>
    `;

    document
      .querySelectorAll("[data-evidence-occurrence]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          state.selectedEvidenceOccurrenceId =
            button.dataset.evidenceOccurrence;

          evidenceGallery();
        });
      });

    document
      .getElementById("back-occurrences")
      .addEventListener("click", occurrenceList);

    document
      .getElementById("return-occurrences")
      .addEventListener("click", occurrenceList);

    document
      .getElementById("finish-evidence")
      .addEventListener("click", evidenceReview);
  }

  function selectedEvidenceOccurrence() {
    return (
      state.occurrences.find(function (occurrence) {
        return occurrence.id === state.selectedEvidenceOccurrenceId;
      }) || null
    );
  }

  function evidenceGallery() {
    const occurrence = selectedEvidenceOccurrence();

    if (!occurrence) {
      evidenceOccurrenceSelector();
      return;
    }

    const photos = occurrence.photos || [];

    const photoCards =
      photos.length
        ? photos
            .map(function (photo, index) {
              return `
                <article
                  style="
                    overflow:hidden;
                    border:1px solid rgba(255,255,255,.14);
                    border-radius:22px;
                    background:rgba(255,255,255,.06);
                  "
                >
                  <button
                    type="button"
                    data-preview-photo="${esc(photo.id)}"
                    style="
                      display:block;
                      width:100%;
                      padding:0;
                      border:0;
                      background:#050a14;
                      cursor:pointer;
                    "
                  >
                    <img
                      src="${photo.dataUrl}"
                      alt="${esc(photo.caption || `Evidência ${index + 1}`)}"
                      style="
                        display:block;
                        width:100%;
                        aspect-ratio:4/3;
                        object-fit:cover;
                      "
                    >
                  </button>

                  <div style="padding:16px">
                    <p
                      class="eyebrow"
                      style="margin-bottom:6px"
                    >
                      Evidência ${index + 1}
                    </p>

                    <strong
                      style="
                        display:block;
                        color:#ffffff;
                        overflow-wrap:anywhere;
                      "
                    >
                      ${esc(photo.caption || photo.name || "Foto sem legenda")}
                    </strong>

                    <p
                      class="muted"
                      style="
                        margin-top:7px;
                        font-size:13px;
                      "
                    >
                      ${esc(photo.createdAt || "")}
                    </p>

                    <div
                      style="
                        display:grid;
                        grid-template-columns:repeat(2,minmax(0,1fr));
                        gap:10px;
                        margin-top:14px;
                      "
                    >
                      <button
                        type="button"
                        class="secondary-button"
                        data-edit-photo="${esc(photo.id)}"
                        style="margin-top:0"
                      >
                        Legenda
                      </button>

                      <button
                        type="button"
                        class="secondary-button"
                        data-delete-photo="${esc(photo.id)}"
                        style="
                          margin-top:0;
                          color:#ff9aa6;
                        "
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              `;
            })
            .join("")
        : `
            <section class="welcome-card">
              <p>Nenhuma foto adicionada</p>

              <strong>
                Tire uma nova foto ou escolha uma imagem da galeria
              </strong>
            </section>
          `;

    app.innerHTML = `
      <section class="screen home-screen">
        <header class="home-header">
          <div>
            <p class="eyebrow">Fotos e evidências</p>

            <h1>${esc(occurrence.title)}</h1>

            <p class="muted">
              ${esc(occurrence.item)}
            </p>
          </div>

          <div
            class="avatar"
            id="back-evidence-selector"
            role="button"
            tabindex="0"
            aria-label="Voltar"
          >
            ‹
          </div>
        </header>

        <main class="home-content">
          ${progress(5, "Evidências da ocorrência")}

          <section
            class="welcome-card"
            style="margin-bottom:18px"
          >
            <p>Fotos anexadas</p>

            <strong>
              ${photos.length}
              ${photos.length === 1 ? "evidência" : "evidências"}
            </strong>
          </section>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
              gap:14px;
            "
          >
            ${photoCards}
          </div>

          <input
            id="evidence-camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
          >

          <input
            id="evidence-gallery-input"
            type="file"
            accept="image/*"
            multiple
            hidden
          >

          <button
            id="take-evidence-photo"
            class="primary-button"
            type="button"
          >
            📷 Tirar nova foto
          </button>

          <button
            id="choose-evidence-photo"
            class="secondary-button"
            type="button"
          >
            🖼️ Escolher da galeria
          </button>

          <button
            id="add-another-occurrence-evidence"
            class="secondary-button"
            type="button"
          >
            Voltar às ocorrências
          </button>
        </main>
      </section>
    `;

    const cameraInput =
      document.getElementById("evidence-camera-input");

    const galleryInput =
      document.getElementById("evidence-gallery-input");

    document
      .getElementById("take-evidence-photo")
      .addEventListener("click", function () {
        cameraInput.click();
      });

    document
      .getElementById("choose-evidence-photo")
      .addEventListener("click", function () {
        galleryInput.click();
      });

    cameraInput.addEventListener("change", importEvidenceFiles);
    galleryInput.addEventListener("change", importEvidenceFiles);

    document
      .getElementById("back-evidence-selector")
      .addEventListener("click", evidenceOccurrenceSelector);

    document
      .getElementById("add-another-occurrence-evidence")
      .addEventListener("click", evidenceOccurrenceSelector);

    document
      .querySelectorAll("[data-preview-photo]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          openEvidencePreview(button.dataset.previewPhoto);
        });
      });

    document
      .querySelectorAll("[data-edit-photo]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          editEvidenceCaption(button.dataset.editPhoto);
        });
      });

    document
      .querySelectorAll("[data-delete-photo]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          deleteEvidencePhoto(button.dataset.deletePhoto);
        });
      });
  }

  async function importEvidenceFiles(event) {
    const occurrence = selectedEvidenceOccurrence();
    const files = Array.from(event.target.files || []);

    event.target.value = "";

    if (!occurrence || !files.length) {
      return;
    }

    const validFiles =
      files.filter(function (file) {
        return file.type.startsWith("image/");
      });

    if (!validFiles.length) {
      await window.AuroraDialog.alert("Selecione arquivos de imagem para continuar.", { title: "Arquivo incompatível", tone: "danger" });
      return;
    }

    let completed = 0;

    validFiles.forEach(function (file) {
      const reader = new FileReader();

      reader.addEventListener("load", function () {
        occurrence.photos = occurrence.photos || [];

        occurrence.photos.push({
          id: `p${Date.now()}${Math.random().toString(16).slice(2)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
          caption: "",
          createdAt:
            new Date().toLocaleString("pt-BR")
        });

        completed += 1;

        if (completed === validFiles.length) {
          evidenceGallery();
        }
      });

      reader.addEventListener("error", function () {
        completed += 1;

        if (completed === validFiles.length) {
          evidenceGallery();
        }
      });

      reader.readAsDataURL(file);
    });
  }

  function openEvidencePreview(photoId) {
    const occurrence = selectedEvidenceOccurrence();

    if (!occurrence) {
      evidenceOccurrenceSelector();
      return;
    }

    const photo =
      occurrence.photos?.find(function (item) {
        return item.id === photoId;
      });

    if (!photo) {
      evidenceGallery();
      return;
    }

    state.previewEvidence = photoId;

    app.innerHTML = `
      <section
        class="screen"
        style="
          padding:0;
          background:#02050c;
          justify-content:stretch;
        "
      >
        <header
          style="
            position:relative;
            z-index:3;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:16px;
            padding:
              calc(16px + env(safe-area-inset-top))
              16px
              14px;
            background:rgba(2,5,12,.88);
            backdrop-filter:blur(16px);
          "
        >
          <div style="min-width:0">
            <p
              class="eyebrow"
              style="margin-bottom:5px"
            >
              Visualização da evidência
            </p>

            <strong
              style="
                display:block;
                color:#ffffff;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
              "
            >
              ${esc(photo.caption || photo.name || "Foto")}
            </strong>
          </div>

          <button
            id="close-evidence-preview"
            type="button"
            aria-label="Fechar"
            style="
              width:46px;
              height:46px;
              flex:0 0 46px;
              border:1px solid rgba(255,255,255,.18);
              border-radius:15px;
              color:#ffffff;
              background:rgba(255,255,255,.08);
              font-size:25px;
              cursor:pointer;
            "
          >
            ×
          </button>
        </header>

        <main
          style="
            position:relative;
            z-index:2;
            min-height:0;
            flex:1;
            display:flex;
            align-items:center;
            justify-content:center;
            overflow:auto;
            padding:18px;
          "
        >
          <img
            src="${photo.dataUrl}"
            alt="${esc(photo.caption || "Evidência")}"
            style="
              display:block;
              max-width:100%;
              max-height:calc(100svh - 190px);
              object-fit:contain;
              border-radius:18px;
              box-shadow:0 28px 80px rgba(0,0,0,.55);
              touch-action:pinch-zoom;
            "
          >
        </main>

        <footer
          style="
            position:relative;
            z-index:3;
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:12px;
            padding:
              14px
              16px
              calc(16px + env(safe-area-inset-bottom));
            background:rgba(2,5,12,.90);
            backdrop-filter:blur(16px);
          "
        >
          <button
            id="preview-use-photo"
            class="primary-button"
            type="button"
            style="margin-top:0"
          >
            Usar esta foto
          </button>

          <button
            id="preview-edit-photo"
            class="secondary-button"
            type="button"
            style="margin-top:0"
          >
            Editar foto
          </button>
        </footer>
      </section>
    `;

    document
      .getElementById("close-evidence-preview")
      .addEventListener("click", evidenceGallery);

    document
      .getElementById("preview-use-photo")
      .addEventListener("click", evidenceGallery);

    document
      .getElementById("preview-edit-photo")
      .addEventListener("click", function () {
        openEvidenceEditor(photoId);
      });
  }

  async function editEvidenceCaption(photoId) {
    const occurrence = selectedEvidenceOccurrence();

    if (!occurrence) {
      return;
    }

    const photo =
      occurrence.photos?.find(function (item) {
        return item.id === photoId;
      });

    if (!photo) {
      return;
    }

    const caption =
      await window.AuroraDialog.prompt("Escreva uma legenda curta para identificar esta evidência.", photo.caption || "", { title: "Legenda da evidência", confirmLabel: "Salvar", fieldLabel: "Legenda" });

    if (caption === null) {
      return;
    }

    photo.caption = caption.trim();
    evidenceGallery();
  }

  async function deleteEvidencePhoto(photoId) {
    const occurrence = selectedEvidenceOccurrence();

    if (!occurrence) {
      return;
    }

    const photo =
      occurrence.photos?.find(function (item) {
        return item.id === photoId;
      });

    if (!photo) {
      return;
    }

    const confirmed =
      await window.AuroraDialog.confirm(`A evidência “${photo.caption || photo.name || "Foto"}” será excluída.`, { title: "Excluir evidência?", confirmLabel: "Excluir", tone: "danger" });

    if (!confirmed) {
      return;
    }

    occurrence.photos =
      occurrence.photos.filter(function (item) {
        return item.id !== photoId;
      });

    evidenceGallery();
  }

  function evidenceReview() {
    const occurrenceCards =
      state.occurrences
        .map(function (occurrence, index) {
          const photoCount = occurrence.photos?.length || 0;
          const style = severityStyle(occurrence.severity);

          return `
            <article
              style="
                padding:18px;
                border:1px solid rgba(255,255,255,.14);
                border-radius:20px;
                background:rgba(255,255,255,.055);
              "
            >
              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:flex-start;
                  gap:14px;
                "
              >
                <div>
                  <p
                    class="eyebrow"
                    style="margin-bottom:6px"
                  >
                    Ocorrência ${index + 1}
                  </p>

                  <strong
                    style="
                      display:block;
                      color:#ffffff;
                      font-size:18px;
                    "
                  >
                    ${esc(occurrence.title)}
                  </strong>
                </div>

                <span
                  style="
                    padding:7px 10px;
                    border-radius:999px;
                    color:${style.color};
                    background:${style.background};
                    font-size:12px;
                    font-weight:800;
                  "
                >
                  ${esc(severityLabel(occurrence.severity))}
                </span>
              </div>

              <p
                class="muted"
                style="margin-top:10px"
              >
                ${esc(occurrence.item)}
                ·
                ${photoCount}
                ${photoCount === 1 ? "foto" : "fotos"}
              </p>
            </article>
          `;
        })
        .join("");

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          ${progress(5, "Revisão do atendimento")}

          <div class="login-mini-logo">✓</div>

          <p class="eyebrow">Evidências concluídas</p>

          <h1>Revisar atendimento</h1>

          <p class="muted">
            Confira o resumo antes de seguir para
            diagnóstico, execução e relatório.
          </p>

          <section
            class="welcome-card"
            style="margin-top:24px"
          >
            <p>Cliente e ativo</p>

            <strong>
              ${esc(state.customer.name)}
              ·
              ${esc(state.asset.name)}
            </strong>
          </section>

          <section
            class="welcome-card"
            style="margin-top:14px"
          >
            <p>Registros</p>

            <strong>
              ${state.occurrences.length}
              ${state.occurrences.length === 1 ? "ocorrência" : "ocorrências"}
              ·
              ${totalEvidenceCount()}
              ${totalEvidenceCount() === 1 ? "foto" : "fotos"}
            </strong>
          </section>

          <div
            style="
              display:grid;
              gap:12px;
              margin-top:18px;
            "
          >
            ${occurrenceCards}
          </div>

          <button
            id="continue-diagnostic"
            class="primary-button"
            type="button"
          >
            Continuar para diagnóstico
          </button>

          <button
            id="edit-evidences"
            class="secondary-button"
            type="button"
          >
            Voltar às evidências
          </button>

          <button
            id="edit-occurrences-from-review"
            class="secondary-button"
            type="button"
          >
            Voltar às ocorrências
          </button>
        </div>
      </section>
    `;

    document
      .getElementById("continue-diagnostic")
      .addEventListener("click", diagnosticForm);

    document
      .getElementById("edit-evidences")
      .addEventListener("click", evidenceOccurrenceSelector);

    document
      .getElementById("edit-occurrences-from-review")
      .addEventListener("click", occurrenceList);
  }


  function openEvidenceEditor(photoId) {
    const occurrence = selectedEvidenceOccurrence();

    if (!occurrence) {
      evidenceOccurrenceSelector();
      return;
    }

    const photo =
      occurrence.photos?.find(function (item) {
        return item.id === photoId;
      });

    if (!photo) {
      evidenceGallery();
      return;
    }

    const editor = {
      canvas: null,
      context: null,
      image: new Image(),
      photo,
      occurrence,
      tool: "select",
      color: "#ff3b55",
      lineWidth: 8,
      fontSize: 42,
      objects: Array.isArray(photo.annotations)
        ? JSON.parse(JSON.stringify(photo.annotations))
        : [],
      selectedId: null,
      history: [],
      future: [],
      view: {
        scale: 1,
        offsetX: 0,
        offsetY: 0
      },
      pointers: new Map(),
      gesture: null,
      action: null,
      draft: null,
      canvasCssWidth: 1,
      canvasCssHeight: 1,
      pixelRatio: Math.max(1, window.devicePixelRatio || 1)
    };

    app.innerHTML = `
      <section
        id="evidence-editor-screen"
        style="
          width:100%;
          min-height:100svh;
          display:flex;
          flex-direction:column;
          overflow:hidden;
          color:#ffffff;
          background:#02050c;
          font-family:Inter,'Segoe UI',Arial,sans-serif;
        "
      >
        <header
          style="
            position:relative;
            z-index:5;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            padding:
              calc(12px + env(safe-area-inset-top))
              14px
              12px;
            border-bottom:1px solid rgba(255,255,255,.12);
            background:rgba(4,9,20,.94);
            backdrop-filter:blur(18px);
          "
        >
          <div style="min-width:0">
            <p
              style="
                margin:0 0 4px;
                color:#64f0e5;
                font-size:11px;
                font-weight:800;
                letter-spacing:.12em;
                text-transform:uppercase;
              "
            >
              Editor de evidências
            </p>

            <strong
              style="
                display:block;
                overflow:hidden;
                color:#ffffff;
                text-overflow:ellipsis;
                white-space:nowrap;
              "
            >
              ${esc(photo.caption || photo.name || "Foto")}
            </strong>
          </div>

          <button
            id="editor-close"
            type="button"
            aria-label="Fechar editor"
            style="
              width:44px;
              height:44px;
              flex:0 0 44px;
              border:1px solid rgba(255,255,255,.18);
              border-radius:14px;
              color:#ffffff;
              background:rgba(255,255,255,.08);
              font-size:24px;
              cursor:pointer;
            "
          >
            ×
          </button>
        </header>

        <div
          style="
            position:relative;
            z-index:4;
            display:flex;
            gap:8px;
            overflow-x:auto;
            padding:10px 12px;
            border-bottom:1px solid rgba(255,255,255,.10);
            background:rgba(7,14,29,.96);
            scrollbar-width:none;
          "
        >
          ${editorToolButton("select", "↖", "Selecionar")}
          ${editorToolButton("arrow", "➜", "Seta")}
          ${editorToolButton("line", "╱", "Linha")}
          ${editorToolButton("rect", "□", "Retângulo")}
          ${editorToolButton("circle", "○", "Círculo")}
          ${editorToolButton("text", "T", "Texto")}
        </div>

        <main
          id="editor-stage"
          style="
            position:relative;
            flex:1;
            min-height:260px;
            overflow:hidden;
            background:
              radial-gradient(circle at 50% 45%,#111c32,#030711 72%);
            touch-action:none;
            user-select:none;
          "
        >
          <canvas
            id="evidence-editor-canvas"
            style="
              position:absolute;
              inset:0;
              width:100%;
              height:100%;
              display:block;
              touch-action:none;
              cursor:default;
            "
          ></canvas>

          <div
            id="editor-empty-hint"
            style="
              position:absolute;
              left:50%;
              bottom:18px;
              transform:translateX(-50%);
              max-width:calc(100% - 30px);
              padding:9px 13px;
              border:1px solid rgba(255,255,255,.12);
              border-radius:999px;
              color:#d8e6f8;
              background:rgba(2,6,15,.74);
              font-size:12px;
              text-align:center;
              pointer-events:none;
              backdrop-filter:blur(12px);
            "
          >
            Selecione uma ferramenta. Após criar, o editor volta à seleção.
          </div>
        </main>

        <section
          style="
            position:relative;
            z-index:5;
            padding:11px 12px;
            border-top:1px solid rgba(255,255,255,.11);
            background:rgba(4,9,20,.96);
            backdrop-filter:blur(18px);
          "
        >
          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              overflow-x:auto;
              padding-bottom:9px;
              scrollbar-width:none;
            "
          >
            <span
              style="
                flex:0 0 auto;
                color:#b9c8dc;
                font-size:12px;
                font-weight:700;
              "
            >
              Cor
            </span>

            ${editorColorButton("#ff3b55")}
            ${editorColorButton("#ffd43b")}
            ${editorColorButton("#28e1a2")}
            ${editorColorButton("#35a7ff")}
            ${editorColorButton("#a66bff")}
            ${editorColorButton("#ffffff")}
            ${editorColorButton("#111111")}
          </div>

          <div
            style="
              display:grid;
              grid-template-columns:minmax(0,1fr) minmax(0,1fr);
              gap:12px;
              align-items:center;
            "
          >
            <label
              style="
                display:grid;
                gap:6px;
                color:#b9c8dc;
                font-size:12px;
              "
            >
              Espessura
              <input
                id="editor-line-width"
                type="range"
                min="2"
                max="24"
                value="8"
              >
            </label>

            <label
              style="
                display:grid;
                gap:6px;
                color:#b9c8dc;
                font-size:12px;
              "
            >
              Texto
              <input
                id="editor-font-size"
                type="range"
                min="20"
                max="96"
                value="42"
              >
            </label>
          </div>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(5,minmax(0,1fr));
              gap:8px;
              margin-top:11px;
            "
          >
            ${editorActionButton("editor-undo", "↶", "Desfazer")}
            ${editorActionButton("editor-redo", "↷", "Refazer")}
            ${editorActionButton("editor-delete", "⌫", "Excluir")}
            ${editorActionButton("editor-center", "◎", "Centralizar")}
            ${editorActionButton("editor-clear", "✕", "Limpar")}
          </div>

          <div
            style="
              display:grid;
              grid-template-columns:minmax(0,1fr) minmax(0,1fr);
              gap:10px;
              margin-top:11px;
              padding-bottom:env(safe-area-inset-bottom);
            "
          >
            <button
              id="editor-cancel"
              class="secondary-button"
              type="button"
              style="margin-top:0"
            >
              Cancelar
            </button>

            <button
              id="editor-save"
              class="primary-button"
              type="button"
              style="margin-top:0"
            >
              Salvar edição
            </button>
          </div>
        </section>
      </section>
    `;

    editor.canvas =
      document.getElementById("evidence-editor-canvas");

    editor.context =
      editor.canvas.getContext("2d");

    editor.image.addEventListener("load", function () {
      setupEvidenceEditor(editor);
    });

    editor.image.addEventListener("error", async function () {
      await window.AuroraDialog.alert("A imagem não pôde ser aberta. Verifique o arquivo e tente novamente.", { title: "Erro ao abrir imagem", tone: "danger" });
      evidenceGallery();
    });

    editor.image.src =
      photo.originalDataUrl ||
      photo.dataUrl;
  }

  function editorToolButton(tool, symbol, label) {
    return `
      <button
        type="button"
        data-editor-tool="${tool}"
        title="${esc(label)}"
        aria-label="${esc(label)}"
        style="
          min-width:70px;
          min-height:52px;
          flex:0 0 auto;
          display:grid;
          place-items:center;
          gap:2px;
          padding:7px 10px;
          border:1px solid rgba(255,255,255,.13);
          border-radius:15px;
          color:#ffffff;
          background:rgba(255,255,255,.06);
          cursor:pointer;
        "
      >
        <strong style="font-size:21px;line-height:1">
          ${symbol}
        </strong>

        <span style="font-size:10px;color:#b9c8dc">
          ${esc(label)}
        </span>
      </button>
    `;
  }

  function editorColorButton(color) {
    return `
      <button
        type="button"
        data-editor-color="${color}"
        aria-label="Selecionar cor ${color}"
        style="
          width:31px;
          height:31px;
          flex:0 0 31px;
          border:2px solid rgba(255,255,255,.25);
          border-radius:50%;
          background:${color};
          cursor:pointer;
          box-shadow:0 3px 10px rgba(0,0,0,.28);
        "
      ></button>
    `;
  }

  function editorActionButton(id, symbol, label) {
    return `
      <button
        id="${id}"
        type="button"
        title="${esc(label)}"
        aria-label="${esc(label)}"
        style="
          min-height:45px;
          border:1px solid rgba(255,255,255,.13);
          border-radius:14px;
          color:#ffffff;
          background:rgba(255,255,255,.065);
          font-size:20px;
          cursor:pointer;
        "
      >
        ${symbol}
      </button>
    `;
  }

  function setupEvidenceEditor(editor) {
    const stage =
      document.getElementById("editor-stage");

    function resize() {
      const rect = stage.getBoundingClientRect();

      editor.canvasCssWidth =
        Math.max(1, rect.width);

      editor.canvasCssHeight =
        Math.max(1, rect.height);

      editor.canvas.width =
        Math.round(
          editor.canvasCssWidth *
          editor.pixelRatio
        );

      editor.canvas.height =
        Math.round(
          editor.canvasCssHeight *
          editor.pixelRatio
        );

      editor.context.setTransform(
        editor.pixelRatio,
        0,
        0,
        editor.pixelRatio,
        0,
        0
      );

      fitEvidenceImage(editor);
      drawEvidenceEditor(editor);
    }

    const observer =
      new ResizeObserver(resize);

    observer.observe(stage);

    editor.cleanup = function () {
      observer.disconnect();
      window.removeEventListener("keydown", editor.keyHandler);
    };

    editor.keyHandler = function (event) {
      if (
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        if (
          document.activeElement &&
          ["INPUT", "TEXTAREA"].includes(
            document.activeElement.tagName
          )
        ) {
          return;
        }

        deleteSelectedEditorObject(editor);
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();

        if (event.shiftKey) {
          redoEditor(editor);
        } else {
          undoEditor(editor);
        }
      }
    };

    window.addEventListener("keydown", editor.keyHandler);

    bindEvidenceEditorControls(editor);
    bindEvidenceEditorPointers(editor);
    setEditorTool(editor, "select");

    requestAnimationFrame(resize);
  }

  function fitEvidenceImage(editor) {
    const padding = 24;

    const availableWidth =
      Math.max(
        1,
        editor.canvasCssWidth - padding * 2
      );

    const availableHeight =
      Math.max(
        1,
        editor.canvasCssHeight - padding * 2
      );

    editor.view.scale =
      Math.min(
        availableWidth / editor.image.width,
        availableHeight / editor.image.height
      );

    editor.view.scale =
      Math.max(0.01, editor.view.scale);

    editor.view.offsetX =
      (
        editor.canvasCssWidth -
        editor.image.width * editor.view.scale
      ) / 2;

    editor.view.offsetY =
      (
        editor.canvasCssHeight -
        editor.image.height * editor.view.scale
      ) / 2;
  }

  function bindEvidenceEditorControls(editor) {
    document
      .querySelectorAll("[data-editor-tool]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          setEditorTool(
            editor,
            button.dataset.editorTool
          );
        });
      });

    document
      .querySelectorAll("[data-editor-color]")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          editor.color =
            button.dataset.editorColor;

          updateEditorColorButtons(editor);

          const selected =
            getSelectedEditorObject(editor);

          if (selected) {
            pushEditorHistory(editor);
            selected.color = editor.color;
            drawEvidenceEditor(editor);
          }
        });
      });

    document
      .getElementById("editor-line-width")
      .addEventListener("input", function (event) {
        editor.lineWidth =
          Number(event.target.value);

        const selected =
          getSelectedEditorObject(editor);

        if (
          selected &&
          selected.type !== "text"
        ) {
          selected.lineWidth =
            editor.lineWidth;

          drawEvidenceEditor(editor);
        }
      });

    document
      .getElementById("editor-line-width")
      .addEventListener("change", function () {
        const selected =
          getSelectedEditorObject(editor);

        if (
          selected &&
          selected.type !== "text"
        ) {
          pushEditorHistory(editor);
        }
      });

    document
      .getElementById("editor-font-size")
      .addEventListener("input", function (event) {
        editor.fontSize =
          Number(event.target.value);

        const selected =
          getSelectedEditorObject(editor);

        if (
          selected &&
          selected.type === "text"
        ) {
          selected.fontSize =
            editor.fontSize;

          drawEvidenceEditor(editor);
        }
      });

    document
      .getElementById("editor-font-size")
      .addEventListener("change", function () {
        const selected =
          getSelectedEditorObject(editor);

        if (
          selected &&
          selected.type === "text"
        ) {
          pushEditorHistory(editor);
        }
      });

    document
      .getElementById("editor-undo")
      .addEventListener("click", async function () {
        undoEditor(editor);
      });

    document
      .getElementById("editor-redo")
      .addEventListener("click", function () {
        redoEditor(editor);
      });

    document
      .getElementById("editor-delete")
      .addEventListener("click", function () {
        deleteSelectedEditorObject(editor);
      });

    document
      .getElementById("editor-center")
      .addEventListener("click", function () {
        fitEvidenceImage(editor);
        drawEvidenceEditor(editor);
      });

    document
      .getElementById("editor-clear")
      .addEventListener("click", async function () {
        if (!editor.objects.length) {
          return;
        }

        const confirmed =
          await window.AuroraDialog.confirm("Todas as marcações feitas nesta foto serão removidas.", { title: "Limpar anotações?", confirmLabel: "Limpar", tone: "danger" });

        if (!confirmed) {
          return;
        }

        pushEditorHistory(editor);
        editor.objects = [];
        editor.selectedId = null;
        drawEvidenceEditor(editor);
      });

    document
      .getElementById("editor-close")
      .addEventListener("click", function () {
        closeEvidenceEditor(editor);
      });

    document
      .getElementById("editor-cancel")
      .addEventListener("click", function () {
        closeEvidenceEditor(editor);
      });

    document
      .getElementById("editor-save")
      .addEventListener("click", function () {
        saveEvidenceEditor(editor);
      });

    updateEditorColorButtons(editor);
  }

  function setEditorTool(editor, tool) {
    editor.tool = tool;
    editor.action = null;
    editor.draft = null;

    document
      .querySelectorAll("[data-editor-tool]")
      .forEach(function (button) {
        const active =
          button.dataset.editorTool === tool;

        button.style.borderColor =
          active
            ? "rgba(100,240,229,.82)"
            : "rgba(255,255,255,.13)";

        button.style.background =
          active
            ? "linear-gradient(135deg,rgba(92,168,255,.23),rgba(159,124,255,.20))"
            : "rgba(255,255,255,.06)";

        button.style.boxShadow =
          active
            ? "0 0 0 3px rgba(100,240,229,.08)"
            : "none";
      });

    editor.canvas.style.cursor =
      tool === "select"
        ? "default"
        : "crosshair";

    drawEvidenceEditor(editor);
  }

  function updateEditorColorButtons(editor) {
    document
      .querySelectorAll("[data-editor-color]")
      .forEach(function (button) {
        const active =
          button.dataset.editorColor
            .toLowerCase() ===
          editor.color.toLowerCase();

        button.style.outline =
          active
            ? "3px solid #64f0e5"
            : "none";

        button.style.outlineOffset =
          active
            ? "2px"
            : "0";
      });
  }

  function bindEvidenceEditorPointers(editor) {
    editor.canvas.addEventListener(
      "pointerdown",
      function (event) {
        editor.canvas.setPointerCapture(
          event.pointerId
        );

        editor.pointers.set(
          event.pointerId,
          editorPointerPosition(editor, event)
        );

        if (editor.pointers.size === 2) {
          startEditorPinch(editor);
          return;
        }

        if (editor.pointers.size > 1) {
          return;
        }

        startEditorPointerAction(
          editor,
          event.pointerId
        );
      }
    );

    editor.canvas.addEventListener(
      "pointermove",
      function (event) {
        if (
          !editor.pointers.has(event.pointerId)
        ) {
          return;
        }

        editor.pointers.set(
          event.pointerId,
          editorPointerPosition(editor, event)
        );

        if (editor.pointers.size >= 2) {
          updateEditorPinch(editor);
          return;
        }

        updateEditorPointerAction(
          editor,
          event.pointerId
        );
      }
    );

    function finish(event) {
      editor.pointers.delete(event.pointerId);

      if (editor.pointers.size < 2) {
        editor.gesture = null;
      }

      if (!editor.pointers.size) {
        finishEditorPointerAction(editor);
      }
    }

    editor.canvas.addEventListener(
      "pointerup",
      finish
    );

    editor.canvas.addEventListener(
      "pointercancel",
      finish
    );

    editor.canvas.addEventListener(
      "wheel",
      function (event) {
        event.preventDefault();

        const pointer =
          editorPointerPosition(editor, event);

        const imagePoint =
          screenToImage(editor, pointer);

        const factor =
          event.deltaY < 0
            ? 1.12
            : 0.89;

        const newScale =
          clampEditor(
            editor.view.scale * factor,
            0.03,
            12
          );

        editor.view.offsetX =
          pointer.x -
          imagePoint.x * newScale;

        editor.view.offsetY =
          pointer.y -
          imagePoint.y * newScale;

        editor.view.scale = newScale;

        drawEvidenceEditor(editor);
      },
      { passive: false }
    );
  }

  function editorPointerPosition(editor, event) {
    const rect =
      editor.canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function startEditorPinch(editor) {
    const points =
      Array.from(editor.pointers.values());

    const center = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };

    const distance =
      Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y
      );

    editor.gesture = {
      center,
      distance: Math.max(1, distance),
      scale: editor.view.scale,
      offsetX: editor.view.offsetX,
      offsetY: editor.view.offsetY,
      imageCenter:
        screenToImage(editor, center)
    };

    editor.action = null;
    editor.draft = null;
  }

  function updateEditorPinch(editor) {
    if (!editor.gesture) {
      startEditorPinch(editor);
      return;
    }

    const points =
      Array.from(editor.pointers.values());

    const center = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };

    const distance =
      Math.max(
        1,
        Math.hypot(
          points[1].x - points[0].x,
          points[1].y - points[0].y
        )
      );

    const newScale =
      clampEditor(
        editor.gesture.scale *
        distance /
        editor.gesture.distance,
        0.03,
        12
      );

    editor.view.scale = newScale;

    editor.view.offsetX =
      center.x -
      editor.gesture.imageCenter.x *
      newScale;

    editor.view.offsetY =
      center.y -
      editor.gesture.imageCenter.y *
      newScale;

    drawEvidenceEditor(editor);
  }

  async function startEditorPointerAction(editor, pointerId) {
    const screen =
      editor.pointers.get(pointerId);

    const imagePoint =
      screenToImage(editor, screen);

    if (editor.tool === "select") {
      const handle =
        findEditorHandle(editor, screen);

      if (handle) {
        const object =
          getSelectedEditorObject(editor);

        if (!object) {
          return;
        }

        pushEditorHistory(editor);

        editor.action = {
          type: handle.type,
          objectId: object.id,
          startScreen: screen,
          startImage: imagePoint,
          original:
            JSON.parse(JSON.stringify(object)),
          center:
            editorObjectCenter(object)
        };

        return;
      }

      const object =
        findEditorObjectAtPoint(
          editor,
          imagePoint
        );

      if (object) {
        editor.selectedId = object.id;

        pushEditorHistory(editor);

        editor.action = {
          type: "move",
          objectId: object.id,
          startScreen: screen,
          startImage: imagePoint,
          original:
            JSON.parse(JSON.stringify(object))
        };
      } else {
        editor.selectedId = null;

        editor.action = {
          type: "pan",
          startScreen: screen,
          offsetX: editor.view.offsetX,
          offsetY: editor.view.offsetY
        };
      }

      drawEvidenceEditor(editor);
      return;
    }

    if (editor.tool === "text") {
      const text =
        await window.AuroraDialog.prompt("Digite o texto que será inserido sobre a imagem.", "", { title: "Texto da anotação", confirmLabel: "Adicionar", fieldLabel: "Anotação" });

      if (
        text === null ||
        !text.trim()
      ) {
        setEditorTool(editor, "select");
        return;
      }

      pushEditorHistory(editor);

      const object = {
        id: editorObjectId(),
        type: "text",
        x: imagePoint.x,
        y: imagePoint.y,
        text: text.trim(),
        color: editor.color,
        fontSize:
          editor.fontSize /
          Math.max(editor.view.scale, 0.01),
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      };

      editor.objects.push(object);
      editor.selectedId = object.id;
      setEditorTool(editor, "select");
      drawEvidenceEditor(editor);
      return;
    }

    editor.draft = {
      id: editorObjectId(),
      type: editor.tool,
      startX: imagePoint.x,
      startY: imagePoint.y,
      endX: imagePoint.x,
      endY: imagePoint.y,
      color: editor.color,
      lineWidth:
        editor.lineWidth /
        Math.max(editor.view.scale, 0.01),
      rotation: 0
    };

    editor.action = {
      type: "create",
      pointerId
    };
  }

  function updateEditorPointerAction(editor, pointerId) {
    if (!editor.action) {
      return;
    }

    const screen =
      editor.pointers.get(pointerId);

    if (!screen) {
      return;
    }

    const imagePoint =
      screenToImage(editor, screen);

    if (
      editor.action.type === "create" &&
      editor.draft
    ) {
      editor.draft.endX = imagePoint.x;
      editor.draft.endY = imagePoint.y;
      drawEvidenceEditor(editor);
      return;
    }

    if (editor.action.type === "pan") {
      editor.view.offsetX =
        editor.action.offsetX +
        screen.x -
        editor.action.startScreen.x;

      editor.view.offsetY =
        editor.action.offsetY +
        screen.y -
        editor.action.startScreen.y;

      drawEvidenceEditor(editor);
      return;
    }

    const object =
      editor.objects.find(function (item) {
        return item.id === editor.action.objectId;
      });

    if (!object) {
      return;
    }

    if (editor.action.type === "move") {
      const dx =
        imagePoint.x -
        editor.action.startImage.x;

      const dy =
        imagePoint.y -
        editor.action.startImage.y;

      moveEditorObject(
        object,
        editor.action.original,
        dx,
        dy
      );

      drawEvidenceEditor(editor);
      return;
    }

    if (editor.action.type === "scale") {
      scaleEditorObjectFromCenter(
        object,
        editor.action.original,
        editor.action.center,
        imagePoint,
        editor.action.startImage
      );

      drawEvidenceEditor(editor);
      return;
    }

    if (editor.action.type === "rotate") {
      const center =
        editor.action.center;

      const startAngle =
        Math.atan2(
          editor.action.startImage.y - center.y,
          editor.action.startImage.x - center.x
        );

      const currentAngle =
        Math.atan2(
          imagePoint.y - center.y,
          imagePoint.x - center.x
        );

      object.rotation =
        (editor.action.original.rotation || 0) +
        currentAngle -
        startAngle;

      drawEvidenceEditor(editor);
    }
  }

  function finishEditorPointerAction(editor) {
    if (
      editor.action?.type === "create" &&
      editor.draft
    ) {
      const size =
        Math.hypot(
          editor.draft.endX -
          editor.draft.startX,
          editor.draft.endY -
          editor.draft.startY
        );

      if (
        size *
        editor.view.scale >
        8
      ) {
        pushEditorHistory(editor);
        editor.objects.push(editor.draft);
        editor.selectedId =
          editor.draft.id;
      }

      editor.draft = null;
      editor.action = null;
      setEditorTool(editor, "select");
      drawEvidenceEditor(editor);
      return;
    }

    editor.action = null;
    drawEvidenceEditor(editor);
  }

  function screenToImage(editor, point) {
    return {
      x:
        (point.x - editor.view.offsetX) /
        editor.view.scale,

      y:
        (point.y - editor.view.offsetY) /
        editor.view.scale
    };
  }

  function imageToScreen(editor, point) {
    return {
      x:
        editor.view.offsetX +
        point.x * editor.view.scale,

      y:
        editor.view.offsetY +
        point.y * editor.view.scale
    };
  }

  function drawEvidenceEditor(editor) {
    const context = editor.context;

    context.save();

    context.setTransform(
      editor.pixelRatio,
      0,
      0,
      editor.pixelRatio,
      0,
      0
    );

    context.clearRect(
      0,
      0,
      editor.canvasCssWidth,
      editor.canvasCssHeight
    );

    context.fillStyle = "#030711";

    context.fillRect(
      0,
      0,
      editor.canvasCssWidth,
      editor.canvasCssHeight
    );

    context.save();

    context.translate(
      editor.view.offsetX,
      editor.view.offsetY
    );

    context.scale(
      editor.view.scale,
      editor.view.scale
    );

    context.drawImage(
      editor.image,
      0,
      0
    );

    editor.objects.forEach(function (object) {
      drawEditorObject(
        context,
        object,
        false
      );
    });

    if (editor.draft) {
      drawEditorObject(
        context,
        editor.draft,
        true
      );
    }

    context.restore();

    drawEditorSelection(editor);

    context.restore();
  }

  function drawEditorObject(context, object, draft) {
    context.save();

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = object.color;
    context.fillStyle = object.color;
    context.lineWidth =
      Math.max(1, object.lineWidth || 5);

    if (draft) {
      context.globalAlpha = 0.82;
    }

    if (object.type === "line") {
      drawRotatedEditorSegment(
        context,
        object,
        false
      );
    }

    if (object.type === "arrow") {
      drawRotatedEditorSegment(
        context,
        object,
        true
      );
    }

    if (
      object.type === "rect" ||
      object.type === "circle"
    ) {
      const geometry =
        editorBoxGeometry(object);

      context.translate(
        geometry.centerX,
        geometry.centerY
      );

      context.rotate(
        object.rotation || 0
      );

      if (object.type === "rect") {
        context.strokeRect(
          -geometry.width / 2,
          -geometry.height / 2,
          geometry.width,
          geometry.height
        );
      } else {
        context.beginPath();

        context.ellipse(
          0,
          0,
          geometry.width / 2,
          geometry.height / 2,
          0,
          0,
          Math.PI * 2
        );

        context.stroke();
      }
    }

    if (object.type === "text") {
      context.translate(
        object.x,
        object.y
      );

      context.rotate(
        object.rotation || 0
      );

      context.scale(
        object.scaleX || 1,
        object.scaleY || 1
      );

      context.font =
        `700 ${object.fontSize || 42}px Inter, Arial, sans-serif`;

      context.textBaseline = "top";

      context.shadowColor =
        "rgba(0,0,0,.72)";

      context.shadowBlur = 7;

      context.lineWidth =
        Math.max(
          3,
          (object.fontSize || 42) * 0.10
        );

      context.strokeStyle =
        "rgba(0,0,0,.72)";

      context.strokeText(
        object.text,
        0,
        0
      );

      context.fillStyle = object.color;

      context.fillText(
        object.text,
        0,
        0
      );
    }

    context.restore();
  }

  function drawRotatedEditorSegment(
    context,
    object,
    arrow
  ) {
    const geometry =
      editorSegmentGeometry(object);

    context.translate(
      geometry.centerX,
      geometry.centerY
    );

    context.rotate(
      object.rotation || 0
    );

    context.beginPath();

    context.moveTo(
      -geometry.length / 2,
      0
    );

    context.lineTo(
      geometry.length / 2,
      0
    );

    context.stroke();

    if (arrow) {
      const head =
        Math.max(
          (object.lineWidth || 5) * 4,
          geometry.length * 0.12
        );

      context.beginPath();

      context.moveTo(
        geometry.length / 2,
        0
      );

      context.lineTo(
        geometry.length / 2 - head,
        -head * 0.58
      );

      context.lineTo(
        geometry.length / 2 - head,
        head * 0.58
      );

      context.closePath();
      context.fill();
    }
  }

  function editorSegmentGeometry(object) {
    const startX = object.startX;
    const startY = object.startY;
    const endX = object.endX;
    const endY = object.endY;

    return {
      centerX: (startX + endX) / 2,
      centerY: (startY + endY) / 2,
      length:
        Math.max(
          1,
          Math.hypot(
            endX - startX,
            endY - startY
          )
        ),
      baseAngle:
        Math.atan2(
          endY - startY,
          endX - startX
        )
    };
  }

  function editorBoxGeometry(object) {
    return {
      centerX:
        (object.startX + object.endX) / 2,

      centerY:
        (object.startY + object.endY) / 2,

      width:
        Math.max(
          1,
          Math.abs(
            object.endX - object.startX
          )
        ),

      height:
        Math.max(
          1,
          Math.abs(
            object.endY - object.startY
          )
        )
    };
  }

  function editorObjectCenter(object) {
    if (object.type === "text") {
      const bounds =
        editorObjectBounds(object);

      return {
        x:
          (bounds.minX + bounds.maxX) / 2,

        y:
          (bounds.minY + bounds.maxY) / 2
      };
    }

    return {
      x:
        (object.startX + object.endX) / 2,

      y:
        (object.startY + object.endY) / 2
    };
  }

  function editorObjectBounds(object) {
    if (object.type === "text") {
      const width =
        Math.max(
          20,
          object.text.length *
          (object.fontSize || 42) *
          0.62 *
          Math.abs(object.scaleX || 1)
        );

      const height =
        (object.fontSize || 42) *
        1.25 *
        Math.abs(object.scaleY || 1);

      return {
        minX: object.x,
        minY: object.y,
        maxX: object.x + width,
        maxY: object.y + height
      };
    }

    const padding =
      Math.max(
        8,
        (object.lineWidth || 5) * 2
      );

    return {
      minX:
        Math.min(
          object.startX,
          object.endX
        ) - padding,

      minY:
        Math.min(
          object.startY,
          object.endY
        ) - padding,

      maxX:
        Math.max(
          object.startX,
          object.endX
        ) + padding,

      maxY:
        Math.max(
          object.startY,
          object.endY
        ) + padding
    };
  }

  function findEditorObjectAtPoint(editor, point) {
    const tolerance =
      18 /
      Math.max(editor.view.scale, 0.01);

    for (
      let index = editor.objects.length - 1;
      index >= 0;
      index -= 1
    ) {
      const object =
        editor.objects[index];

      if (
        editorObjectContainsPoint(
          object,
          point,
          tolerance
        )
      ) {
        return object;
      }
    }

    return null;
  }

  function editorObjectContainsPoint(
    object,
    point,
    tolerance
  ) {
    if (
      object.type === "line" ||
      object.type === "arrow"
    ) {
      return (
        distancePointToSegment(
          point.x,
          point.y,
          object.startX,
          object.startY,
          object.endX,
          object.endY
        ) <=
        tolerance +
        (object.lineWidth || 5)
      );
    }

    const bounds =
      editorObjectBounds(object);

    return (
      point.x >= bounds.minX - tolerance &&
      point.x <= bounds.maxX + tolerance &&
      point.y >= bounds.minY - tolerance &&
      point.y <= bounds.maxY + tolerance
    );
  }

  function distancePointToSegment(
    px,
    py,
    x1,
    y1,
    x2,
    y2
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (!dx && !dy) {
      return Math.hypot(
        px - x1,
        py - y1
      );
    }

    const value =
      (
        (px - x1) * dx +
        (py - y1) * dy
      ) /
      (
        dx * dx +
        dy * dy
      );

    const t =
      clampEditor(value, 0, 1);

    const nearestX =
      x1 + t * dx;

    const nearestY =
      y1 + t * dy;

    return Math.hypot(
      px - nearestX,
      py - nearestY
    );
  }

  function drawEditorSelection(editor) {
    const object =
      getSelectedEditorObject(editor);

    if (!object) {
      return;
    }

    const bounds =
      editorObjectBounds(object);

    const topLeft =
      imageToScreen(editor, {
        x: bounds.minX,
        y: bounds.minY
      });

    const bottomRight =
      imageToScreen(editor, {
        x: bounds.maxX,
        y: bounds.maxY
      });

    const context = editor.context;

    context.save();

    context.setTransform(
      editor.pixelRatio,
      0,
      0,
      editor.pixelRatio,
      0,
      0
    );

    context.strokeStyle =
      "#64f0e5";

    context.lineWidth = 2;

    context.setLineDash([7, 5]);

    context.strokeRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );

    context.setLineDash([]);

    const centerX =
      (topLeft.x + bottomRight.x) / 2;

    const centerY =
      (topLeft.y + bottomRight.y) / 2;

    const scaleHandle = {
      x: bottomRight.x,
      y: bottomRight.y
    };

    const rotateHandle = {
      x: centerX,
      y: topLeft.y - 28
    };

    context.beginPath();

    context.moveTo(
      centerX,
      topLeft.y
    );

    context.lineTo(
      rotateHandle.x,
      rotateHandle.y
    );

    context.stroke();

    drawEditorHandle(
      context,
      scaleHandle.x,
      scaleHandle.y,
      "#64f0e5"
    );

    drawEditorHandle(
      context,
      rotateHandle.x,
      rotateHandle.y,
      "#a66bff"
    );

    context.fillStyle =
      "rgba(100,240,229,.16)";

    context.beginPath();

    context.arc(
      centerX,
      centerY,
      5,
      0,
      Math.PI * 2
    );

    context.fill();

    context.restore();

    editor.selectionHandles = {
      scale: scaleHandle,
      rotate: rotateHandle
    };
  }

  function drawEditorHandle(
    context,
    x,
    y,
    color
  ) {
    context.beginPath();

    context.arc(
      x,
      y,
      10,
      0,
      Math.PI * 2
    );

    context.fillStyle = color;
    context.fill();

    context.lineWidth = 2;
    context.strokeStyle = "#07111f";
    context.stroke();
  }

  function findEditorHandle(editor, point) {
    if (!editor.selectionHandles) {
      return null;
    }

    const entries = [
      ["scale", editor.selectionHandles.scale],
      ["rotate", editor.selectionHandles.rotate]
    ];

    for (const entry of entries) {
      const distance =
        Math.hypot(
          point.x - entry[1].x,
          point.y - entry[1].y
        );

      if (distance <= 20) {
        return {
          type: entry[0]
        };
      }
    }

    return null;
  }

  function getSelectedEditorObject(editor) {
    return (
      editor.objects.find(function (object) {
        return object.id === editor.selectedId;
      }) || null
    );
  }

  function moveEditorObject(
    object,
    original,
    dx,
    dy
  ) {
    if (object.type === "text") {
      object.x = original.x + dx;
      object.y = original.y + dy;
      return;
    }

    object.startX =
      original.startX + dx;

    object.startY =
      original.startY + dy;

    object.endX =
      original.endX + dx;

    object.endY =
      original.endY + dy;
  }

  function scaleEditorObjectFromCenter(
    object,
    original,
    center,
    currentPoint,
    startPoint
  ) {
    const startDistance =
      Math.max(
        0.001,
        Math.hypot(
          startPoint.x - center.x,
          startPoint.y - center.y
        )
      );

    const currentDistance =
      Math.max(
        0.001,
        Math.hypot(
          currentPoint.x - center.x,
          currentPoint.y - center.y
        )
      );

    const factor =
      clampEditor(
        currentDistance /
        startDistance,
        0.12,
        12
      );

    if (object.type === "text") {
      object.scaleX =
        (original.scaleX || 1) *
        factor;

      object.scaleY =
        (original.scaleY || 1) *
        factor;

      object.x =
        center.x +
        (original.x - center.x) *
        factor;

      object.y =
        center.y +
        (original.y - center.y) *
        factor;

      return;
    }

    object.startX =
      center.x +
      (original.startX - center.x) *
      factor;

    object.startY =
      center.y +
      (original.startY - center.y) *
      factor;

    object.endX =
      center.x +
      (original.endX - center.x) *
      factor;

    object.endY =
      center.y +
      (original.endY - center.y) *
      factor;

    object.lineWidth =
      Math.max(
        1,
        (original.lineWidth || 5) *
        factor
      );
  }

  function pushEditorHistory(editor) {
    editor.history.push(
      JSON.stringify(editor.objects)
    );

    if (editor.history.length > 60) {
      editor.history.shift();
    }

    editor.future = [];
  }

  function undoEditor(editor) {
    if (!editor.history.length) {
      return;
    }

    editor.future.push(
      JSON.stringify(editor.objects)
    );

    editor.objects =
      JSON.parse(editor.history.pop());

    editor.selectedId = null;
    drawEvidenceEditor(editor);
  }

  function redoEditor(editor) {
    if (!editor.future.length) {
      return;
    }

    editor.history.push(
      JSON.stringify(editor.objects)
    );

    editor.objects =
      JSON.parse(editor.future.pop());

    editor.selectedId = null;
    drawEvidenceEditor(editor);
  }

  function deleteSelectedEditorObject(editor) {
    if (!editor.selectedId) {
      return;
    }

    pushEditorHistory(editor);

    editor.objects =
      editor.objects.filter(function (object) {
        return object.id !== editor.selectedId;
      });

    editor.selectedId = null;
    drawEvidenceEditor(editor);
  }

  function closeEvidenceEditor(editor) {
    if (editor.cleanup) {
      editor.cleanup();
    }

    evidenceGallery();
  }

  function saveEvidenceEditor(editor) {
    const output =
      document.createElement("canvas");

    output.width =
      editor.image.naturalWidth ||
      editor.image.width;

    output.height =
      editor.image.naturalHeight ||
      editor.image.height;

    const context =
      output.getContext("2d");

    context.drawImage(
      editor.image,
      0,
      0,
      output.width,
      output.height
    );

    editor.objects.forEach(function (object) {
      drawEditorObject(
        context,
        object,
        false
      );
    });

    if (!editor.photo.originalDataUrl) {
      editor.photo.originalDataUrl =
        editor.photo.dataUrl;
    }

    editor.photo.annotations =
      JSON.parse(
        JSON.stringify(editor.objects)
      );

    editor.photo.dataUrl =
      output.toDataURL(
        "image/jpeg",
        0.94
      );

    editor.photo.editedAt =
      new Date().toLocaleString("pt-BR");

    if (editor.cleanup) {
      editor.cleanup();
    }

    evidenceGallery();
  }

  function editorObjectId() {
    return (
      "a" +
      Date.now() +
      Math.random()
        .toString(16)
        .slice(2)
    );
  }

  function clampEditor(
    value,
    minimum,
    maximum
  ) {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  }


  function diagnosticDefaults() {
    const totalOccurrences = state.occurrences.length;
    const totalPhotos = totalEvidenceCount();
    const criticalCount =
      state.occurrences.filter(function (occurrence) {
        return occurrence.severity === "critical";
      }).length;

    const highCount =
      state.occurrences.filter(function (occurrence) {
        return occurrence.severity === "high";
      }).length;

    return {
      summary:
        `Foram registradas ${totalOccurrences} ` +
        `${totalOccurrences === 1 ? "ocorrência" : "ocorrências"} ` +
        `e ${totalPhotos} ` +
        `${totalPhotos === 1 ? "evidência fotográfica" : "evidências fotográficas"}.`,

      conclusion:
        criticalCount || highCount
          ? "Foram identificadas condições que exigem atenção antes da continuidade do uso ou operação."
          : "As condições registradas devem ser avaliadas conforme as recomendações apresentadas.",

      scope:
        "Este relatório apresenta as condições observadas durante o atendimento e as recomendações técnicas correspondentes.",

      limitations:
        "A análise está limitada aos itens acessíveis e às condições observadas no momento do atendimento.",

      proposalNotes:
        "Os serviços somente deverão ser executados após a aprovação do cliente.",

      estimatedValue: "",
      estimatedDeadline: "",
      status: "draft",
      clientDecision: "pending",
      clientNotes: "",
      createdAt:
        new Date().toLocaleString("pt-BR")
    };
  }

  function diagnosticForm() {
    const diagnostic =
      state.diagnostic ||
      diagnosticDefaults();

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          <div class="login-mini-logo">📋</div>

          <p class="eyebrow">
            Diagnóstico e proposta
          </p>

          <h1>
            Preparar relatório ao cliente
          </h1>

          <p class="muted">
            Revise o atendimento e prepare a versão
            que será apresentada antes da execução.
          </p>

          <section
            class="welcome-card"
            style="margin-top:24px"
          >
            <p>Cliente e ativo</p>

            <strong>
              ${esc(state.customer.name)}
              ·
              ${esc(state.asset.name)}
            </strong>
          </section>

          <section
            class="welcome-card"
            style="margin-top:14px"
          >
            <p>Registros coletados</p>

            <strong>
              ${state.occurrences.length}
              ${state.occurrences.length === 1 ? "ocorrência" : "ocorrências"}
              ·
              ${totalEvidenceCount()}
              ${totalEvidenceCount() === 1 ? "foto" : "fotos"}
            </strong>
          </section>

          <form id="diagnostic-form">
            <label class="field">
              <span>Resumo executivo *</span>

              <textarea
                id="diagnostic-summary"
                rows="5"
                required
                placeholder="Resuma o que foi encontrado"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(diagnostic.summary || "")}</textarea>
            </label>

            <label class="field">
              <span>Conclusão preliminar *</span>

              <textarea
                id="diagnostic-conclusion"
                rows="4"
                required
                placeholder="Descreva a conclusão técnica preliminar"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(diagnostic.conclusion || "")}</textarea>
            </label>

            <label class="field">
              <span>Escopo do relatório</span>

              <textarea
                id="diagnostic-scope"
                rows="3"
                placeholder="Defina o que este relatório cobre"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(diagnostic.scope || "")}</textarea>
            </label>

            <label class="field">
              <span>Limitações</span>

              <textarea
                id="diagnostic-limitations"
                rows="3"
                placeholder="Registre limitações de acesso, método ou condição"
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(diagnostic.limitations || "")}</textarea>
            </label>

            <div
              style="
                display:grid;
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:14px;
              "
            >
              <label class="field">
                <span>Valor estimado</span>

                <input
                  id="diagnostic-value"
                  type="text"
                  value="${esc(diagnostic.estimatedValue || "")}"
                  placeholder="Ex.: R$ 1.500,00"
                >
              </label>

              <label class="field">
                <span>Prazo estimado</span>

                <input
                  id="diagnostic-deadline"
                  type="text"
                  value="${esc(diagnostic.estimatedDeadline || "")}"
                  placeholder="Ex.: 3 dias úteis"
                >
              </label>
            </div>

            <label class="field">
              <span>Observações da proposta</span>

              <textarea
                id="diagnostic-proposal-notes"
                rows="3"
                placeholder="Condições comerciais, materiais, garantias..."
                style="
                  width:100%;
                  max-width:100%;
                  min-width:0;
                  padding:16px;
                  color:#ffffff;
                  border:1px solid rgba(255,255,255,.14);
                  border-radius:18px;
                  outline:none;
                  resize:vertical;
                  background:rgba(255,255,255,.065);
                  font:inherit;
                  box-sizing:border-box;
                "
              >${esc(diagnostic.proposalNotes || "")}</textarea>
            </label>

            <p
              id="diagnostic-message"
              class="action-message"
            >
              Resumo e conclusão são obrigatórios.
            </p>

            <button
              class="primary-button"
              type="submit"
            >
              Salvar diagnóstico
            </button>

            <button
              id="back-diagnostic-review"
              class="secondary-button"
              type="button"
            >
              Voltar à revisão
            </button>
          </form>
        </div>
      </section>
    `;

    document
      .getElementById("diagnostic-form")
      .addEventListener("submit", saveDiagnostic);

    document
      .getElementById("back-diagnostic-review")
      .addEventListener("click", evidenceReview);
  }

  function saveDiagnostic(event) {
    event.preventDefault();

    const summary =
      document
        .getElementById("diagnostic-summary")
        .value
        .trim();

    const conclusion =
      document
        .getElementById("diagnostic-conclusion")
        .value
        .trim();

    if (!summary || !conclusion) {
      const message =
        document.getElementById("diagnostic-message");

      message.textContent =
        "Preencha o resumo executivo e a conclusão preliminar.";

      message.style.color = "#ff9aa6";
      return;
    }

    state.diagnostic = {
      summary,

      conclusion,

      scope:
        document
          .getElementById("diagnostic-scope")
          .value
          .trim(),

      limitations:
        document
          .getElementById("diagnostic-limitations")
          .value
          .trim(),

      estimatedValue:
        document
          .getElementById("diagnostic-value")
          .value
          .trim(),

      estimatedDeadline:
        document
          .getElementById("diagnostic-deadline")
          .value
          .trim(),

      proposalNotes:
        document
          .getElementById("diagnostic-proposal-notes")
          .value
          .trim(),

      status:
        state.diagnostic?.status ||
        "draft",

      clientDecision:
        state.diagnostic?.clientDecision ||
        "pending",

      clientNotes:
        state.diagnostic?.clientNotes ||
        "",

      createdAt:
        state.diagnostic?.createdAt ||
        new Date().toLocaleString("pt-BR"),

      updatedAt:
        new Date().toLocaleString("pt-BR")
    };

    preliminaryReport();
  }

  function reportSeverityBadge(severity) {
    const style =
      severityStyle(severity);

    return `
      <span
        style="
          display:inline-block;
          padding:7px 10px;
          border-radius:999px;
          color:${style.color};
          background:${style.background};
          font-size:12px;
          font-weight:800;
        "
      >
        ${esc(severityLabel(severity))}
      </span>
    `;
  }

  function preliminaryReportOccurrence(occurrence, index) {
    const photos =
      occurrence.photos || [];

    const thumbnails =
      photos.length
        ? `
            <div
              style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
                gap:9px;
                margin-top:14px;
              "
            >
              ${photos
                .map(function (photo) {
                  return `
                    <img
                      src="${photo.dataUrl}"
                      alt="${esc(photo.caption || "Evidência")}"
                      style="
                        display:block;
                        width:100%;
                        aspect-ratio:4/3;
                        object-fit:cover;
                        border-radius:13px;
                        border:1px solid rgba(255,255,255,.12);
                      "
                    >
                  `;
                })
                .join("")}
            </div>
          `
        : `
            <p
              class="muted"
              style="margin-top:12px;font-size:13px"
            >
              Nenhuma evidência fotográfica anexada.
            </p>
          `;

    return `
      <article
        style="
          padding:20px;
          border:1px solid rgba(255,255,255,.14);
          border-radius:22px;
          background:rgba(255,255,255,.055);
        "
      >
        <div
          style="
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:16px;
          "
        >
          <div>
            <p
              class="eyebrow"
              style="margin-bottom:6px"
            >
              Ocorrência ${index + 1}
            </p>

            <h2
              style="
                margin:0;
                color:#ffffff;
                font-size:21px;
              "
            >
              ${esc(occurrence.title)}
            </h2>

            <p
              class="muted"
              style="margin-top:7px"
            >
              ${esc(occurrence.item)}
            </p>
          </div>

          ${reportSeverityBadge(occurrence.severity)}
        </div>

        <p
          style="
            margin:16px 0 0;
            color:#e0ebf9;
            line-height:1.58;
            white-space:pre-line;
          "
        >
          ${esc(occurrence.description)}
        </p>

        ${
          occurrence.recommendation
            ? `
                <section
                  style="
                    margin-top:15px;
                    padding:15px;
                    border-radius:17px;
                    background:rgba(100,240,229,.07);
                  "
                >
                  <p
                    style="
                      margin:0 0 6px;
                      color:#64f0e5;
                      font-size:12px;
                      font-weight:800;
                      text-transform:uppercase;
                      letter-spacing:.1em;
                    "
                  >
                    Recomendação
                  </p>

                  <p
                    style="
                      margin:0;
                      color:#e8f2ff;
                      line-height:1.5;
                      white-space:pre-line;
                    "
                  >
                    ${esc(occurrence.recommendation)}
                  </p>
                </section>
              `
            : ""
        }

        <p
          class="muted"
          style="margin-top:14px;font-size:13px"
        >
          ${esc(followUpText(occurrence))}
        </p>

        ${thumbnails}
      </article>
    `;
  }

  function preliminaryReport() {
    if (!state.diagnostic) {
      diagnosticForm();
      return;
    }

    const occurrencesHtml =
      state.occurrences
        .map(preliminaryReportOccurrence)
        .join("");

    app.innerHTML = `
      <section class="screen home-screen">
        <header class="home-header">
          <div>
            <p class="eyebrow">
              Relatório preliminar
            </p>

            <h1>
              Diagnóstico para o cliente
            </h1>

            <p class="muted">
              Esta versão apresenta o que foi encontrado
              e o que poderá ser executado.
            </p>
          </div>

          <div
            class="avatar"
            id="back-diagnostic-form"
            role="button"
            tabindex="0"
            aria-label="Voltar"
          >
            ‹
          </div>
        </header>

        <main class="home-content">
          <section
            class="welcome-card"
            style="margin-bottom:14px"
          >
            <p>Cliente</p>
            <strong>${esc(state.customer.name)}</strong>
          </section>

          <section
            class="welcome-card"
            style="margin-bottom:14px"
          >
            <p>Ativo</p>
            <strong>${esc(state.asset.name)}</strong>
          </section>

          <section
            style="
              padding:20px;
              border:1px solid rgba(255,255,255,.14);
              border-radius:22px;
              background:
                linear-gradient(
                  135deg,
                  rgba(92,168,255,.14),
                  rgba(159,124,255,.12)
                );
            "
          >
            <p class="eyebrow">
              Resumo executivo
            </p>

            <p
              style="
                margin:10px 0 0;
                color:#ffffff;
                font-size:18px;
                line-height:1.6;
                white-space:pre-line;
              "
            >
              ${esc(state.diagnostic.summary)}
            </p>
          </section>

          <section
            style="
              margin-top:14px;
              padding:20px;
              border:1px solid rgba(255,255,255,.14);
              border-radius:22px;
              background:rgba(255,255,255,.055);
            "
          >
            <p class="eyebrow">
              Conclusão preliminar
            </p>

            <p
              style="
                margin:10px 0 0;
                color:#e5eefb;
                line-height:1.58;
                white-space:pre-line;
              "
            >
              ${esc(state.diagnostic.conclusion)}
            </p>
          </section>

          <div
            style="
              display:grid;
              gap:14px;
              margin-top:16px;
            "
          >
            ${occurrencesHtml}
          </div>

          <section
            style="
              margin-top:16px;
              padding:20px;
              border:1px solid rgba(255,255,255,.14);
              border-radius:22px;
              background:rgba(255,255,255,.055);
            "
          >
            <p class="eyebrow">
              Proposta
            </p>

            ${diagnosticReportLine(
              "Valor estimado",
              state.diagnostic.estimatedValue ||
              "A definir"
            )}

            ${diagnosticReportLine(
              "Prazo estimado",
              state.diagnostic.estimatedDeadline ||
              "A definir"
            )}

            ${diagnosticReportLine(
              "Observações",
              state.diagnostic.proposalNotes ||
              "Sem observações adicionais"
            )}
          </section>

          <section
            style="
              margin-top:16px;
              padding:20px;
              border:1px solid rgba(255,255,255,.14);
              border-radius:22px;
              background:rgba(255,255,255,.055);
            "
          >
            <p class="eyebrow">
              Escopo e limitações
            </p>

            ${diagnosticReportLine(
              "Escopo",
              state.diagnostic.scope ||
              "Não informado"
            )}

            ${diagnosticReportLine(
              "Limitações",
              state.diagnostic.limitations ||
              "Não informadas"
            )}
          </section>

          <button
            id="send-preliminary-report"
            class="primary-button"
            type="button"
          >
            Enviar para aprovação do cliente
          </button>

          <button
            id="edit-preliminary-report"
            class="secondary-button"
            type="button"
          >
            Editar diagnóstico
          </button>

          <button
            id="back-preliminary-evidence"
            class="secondary-button"
            type="button"
          >
            Voltar às evidências
          </button>
        </main>
      </section>
    `;

    document
      .getElementById("back-diagnostic-form")
      .addEventListener("click", diagnosticForm);

    document
      .getElementById("edit-preliminary-report")
      .addEventListener("click", diagnosticForm);

    document
      .getElementById("back-preliminary-evidence")
      .addEventListener("click", evidenceReview);

    document
      .getElementById("send-preliminary-report")
      .addEventListener("click", clientApprovalScreen);
  }

  function diagnosticReportLine(label, value) {
    return `
      <div
        style="
          display:grid;
          gap:6px;
          padding:13px 0;
          border-bottom:1px solid rgba(255,255,255,.09);
        "
      >
        <span
          style="
            color:#b9c8dc;
            font-size:13px;
          "
        >
          ${esc(label)}
        </span>

        <strong
          style="
            color:#ffffff;
            line-height:1.5;
            white-space:pre-line;
            overflow-wrap:anywhere;
          "
        >
          ${esc(value)}
        </strong>
      </div>
    `;
  }

  function clientApprovalScreen() {
    if (!state.diagnostic) {
      diagnosticForm();
      return;
    }

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          <div class="login-mini-logo">✉️</div>

          <p class="eyebrow">
            Aprovação do cliente
          </p>

          <h1>
            Relatório preliminar enviado
          </h1>

          <p class="muted">
            Registre a decisão do cliente para definir
            o próximo passo do atendimento.
          </p>

          <section
            class="welcome-card"
            style="margin-top:24px"
          >
            <p>Cliente</p>
            <strong>${esc(state.customer.name)}</strong>
          </section>

          <section
            class="welcome-card"
            style="margin-top:14px"
          >
            <p>Situação atual</p>
            <strong id="approval-status-label">
              ${esc(clientDecisionLabel(state.diagnostic.clientDecision))}
            </strong>
          </section>

          <label class="field">
            <span>Decisão do cliente</span>

            <select
              id="client-decision"
              style="
                width:100%;
                max-width:100%;
                min-width:0;
                padding:16px;
                color:#ffffff;
                border:1px solid rgba(255,255,255,.14);
                border-radius:18px;
                outline:none;
                background:#15203a;
                font:inherit;
                box-sizing:border-box;
              "
            >
              <option value="pending" ${state.diagnostic.clientDecision === "pending" ? "selected" : ""}>
                Aguardando resposta
              </option>

              <option value="approved" ${state.diagnostic.clientDecision === "approved" ? "selected" : ""}>
                Aprovado
              </option>

              <option value="partial" ${state.diagnostic.clientDecision === "partial" ? "selected" : ""}>
                Aprovado parcialmente
              </option>

              <option value="rejected" ${state.diagnostic.clientDecision === "rejected" ? "selected" : ""}>
                Não aprovado
              </option>
            </select>
          </label>

          <label class="field">
            <span>Observações da decisão</span>

            <textarea
              id="client-decision-notes"
              rows="4"
              placeholder="Ex.: Cliente aprovou somente a substituição dos amortecedores"
              style="
                width:100%;
                max-width:100%;
                min-width:0;
                padding:16px;
                color:#ffffff;
                border:1px solid rgba(255,255,255,.14);
                border-radius:18px;
                outline:none;
                resize:vertical;
                background:rgba(255,255,255,.065);
                font:inherit;
                box-sizing:border-box;
              "
            >${esc(state.diagnostic.clientNotes || "")}</textarea>
          </label>

          <button
            id="save-client-decision"
            class="primary-button"
            type="button"
          >
            Salvar decisão
          </button>

          <button
            id="back-client-report"
            class="secondary-button"
            type="button"
          >
            Voltar ao relatório
          </button>
        </div>
      </section>
    `;

    document
      .getElementById("save-client-decision")
      .addEventListener("click", saveClientDecision);

    document
      .getElementById("back-client-report")
      .addEventListener("click", preliminaryReport);
  }

  function clientDecisionLabel(value) {
    const labels = {
      pending: "Aguardando resposta",
      approved: "Aprovado",
      partial: "Aprovado parcialmente",
      rejected: "Não aprovado"
    };

    return labels[value] || labels.pending;
  }

  function saveClientDecision() {
    const decision =
      document
        .getElementById("client-decision")
        .value;

    const notes =
      document
        .getElementById("client-decision-notes")
        .value
        .trim();

    state.diagnostic.clientDecision = decision;
    state.diagnostic.clientNotes = notes;
    state.diagnostic.status =
      decision === "approved" ||
      decision === "partial"
        ? "approved"
        : decision === "rejected"
          ? "rejected"
          : "sent";

    decisionResultScreen();
  }

  function decisionResultScreen() {
    const decision =
      state.diagnostic.clientDecision;

    const approved =
      decision === "approved" ||
      decision === "partial";

    const rejected =
      decision === "rejected";

    app.innerHTML = `
      <section class="screen login-screen">
        <div class="login-card">
          <div class="login-mini-logo">
            ${approved ? "✓" : rejected ? "✕" : "⏳"}
          </div>

          <p class="eyebrow">
            Decisão registrada
          </p>

          <h1>
            ${esc(clientDecisionLabel(decision))}
          </h1>

          <p class="muted">
            ${
              approved
                ? "O atendimento está pronto para registrar a execução dos serviços."
                : rejected
                  ? "O atendimento poderá ser arquivado sem execução ou revisado."
                  : "A Aurora manterá o atendimento como pendente até a resposta do cliente."
            }
          </p>

          <section
            class="welcome-card"
            style="margin-top:24px"
          >
            <p>Cliente e ativo</p>

            <strong>
              ${esc(state.customer.name)}
              ·
              ${esc(state.asset.name)}
            </strong>
          </section>

          ${
            state.diagnostic.clientNotes
              ? `
                  <section
                    style="
                      margin-top:14px;
                      padding:20px;
                      border:1px solid rgba(255,255,255,.14);
                      border-radius:22px;
                      background:rgba(255,255,255,.055);
                    "
                  >
                    <p class="eyebrow">
                      Observações
                    </p>

                    <p
                      style="
                        margin:10px 0 0;
                        color:#e7f0fc;
                        line-height:1.55;
                        white-space:pre-line;
                      "
                    >
                      ${esc(state.diagnostic.clientNotes)}
                    </p>
                  </section>
                `
              : ""
          }

          ${
            approved
              ? `
                  <button
                    id="continue-execution"
                    class="primary-button"
                    type="button"
                  >
                    Registrar execução
                  </button>
                `
              : `
                  <button
                    id="review-client-decision"
                    class="primary-button"
                    type="button"
                  >
                    Atualizar decisão
                  </button>
                `
          }

          <button
            id="return-preliminary-report"
            class="secondary-button"
            type="button"
          >
            Abrir relatório preliminar
          </button>

          <button
            id="return-aurora-home"
            class="secondary-button"
            type="button"
          >
            Voltar para a Home
          </button>
        </div>
      </section>
    `;

    if (approved) {
      document
        .getElementById("continue-execution")
        .addEventListener("click", function () {
          document.querySelector(".muted").textContent =
            "Registro da execução e relatório final serão conectados no Pack 015.";
        });
    } else {
      document
        .getElementById("review-client-decision")
        .addEventListener("click", clientApprovalScreen);
    }

    document
      .getElementById("return-preliminary-report")
      .addEventListener("click", preliminaryReport);

    document
      .getElementById("return-aurora-home")
      .addEventListener("click", home);
  }

  splash();
})();
