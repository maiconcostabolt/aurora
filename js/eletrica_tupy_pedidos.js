/**
 * DEMO / INTERIM — Pedidos Tupy (múltiplos) por projeto.
 * Persistência local até migration cloud (aurora_project_admin_orders / docs 18*).
 * NÃO é fonte de verdade na nuvem.
 *
 * localStorage key: aurora_aet_admin_pedidos_v1
 * shape: { [projectId]: [{ id, numero }] }
 */
(function (global) {
"use strict";

var STORAGE_KEY = "aurora_aet_admin_pedidos_v1";

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function readMap() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        var parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        return {};
    }
}

function writeMap(map) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
    } catch (error) { /* ignore quota */ }
}

function uid() {
    return "ped_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function get(projectId) {
    var pid = String(projectId || "").trim();
    if (!pid) return [];
    var map = readMap();
    var list = map[pid];
    return Array.isArray(list) ? list.slice() : [];
}

function set(projectId, list) {
    var pid = String(projectId || "").trim();
    if (!pid) return [];
    var map = readMap();
    var clean = (Array.isArray(list) ? list : []).map(function (item) {
        return {
            id: String((item && item.id) || uid()),
            numero: String((item && item.numero) || "").trim()
        };
    }).filter(function (item) {
        return item.numero !== "";
    });
    map[pid] = clean;
    writeMap(map);
    return clean;
}

function renderHtml(projectId, list) {
    list = Array.isArray(list) ? list : get(projectId);
    var chips = list.map(function (item) {
        return '<li class="aet-pedido-chip" data-aet-pedido-id="' + esc(item.id) + '">' +
            '<input type="text" class="aet-pedido-chip__input" data-aet-pedido-edit value="' +
            esc(item.numero) + '" aria-label="Número do pedido" autocomplete="off">' +
            '<button type="button" class="aet-pedido-chip__remove" data-aet-pedido-remove aria-label="Remover">×</button>' +
            "</li>";
    }).join("");

    return '<article class="aet-card aet-pedidos aet-admin-meta-card" data-aet-pedidos data-project-id="' +
        esc(projectId || "") + '">' +
        "<h2>Número do pedido</h2>" +
        '<div class="aet-pedidos__add-row">' +
        '<input type="text" class="aet-pedidos__input" data-aet-pedido-new placeholder="Nº do pedido" autocomplete="off">' +
        '<button type="button" class="aet-btn aet-btn--primary aet-pedidos__add" data-aet-pedido-add>+ Adicionar</button>' +
        "</div>" +
        '<ul class="aet-pedidos__chips" data-aet-pedidos-list>' +
        (chips || '<li class="aet-pedidos__empty">Nenhum pedido informado.</li>') +
        "</ul>" +
        '<p class="aet-hint aet-hint--error" data-aet-pedidos-msg hidden></p>' +
        "</article>";
}

function bind(container, opts) {
    opts = opts || {};
    if (!container) return;
    var root = container.matches && container.matches("[data-aet-pedidos]")
        ? container
        : container.querySelector("[data-aet-pedidos]");
    if (!root) return;

    var projectId = String(opts.projectId || root.getAttribute("data-project-id") || "").trim();
    var msg = root.querySelector("[data-aet-pedidos-msg]");

    function showMsg(text) {
        if (!msg) return;
        if (!text) {
            msg.hidden = true;
            msg.textContent = "";
            return;
        }
        msg.hidden = false;
        msg.textContent = text;
    }

    function currentList() {
        return get(projectId);
    }

    function remount() {
        var html = renderHtml(projectId, get(projectId));
        var tmp = document.createElement("div");
        tmp.innerHTML = html;
        var fresh = tmp.firstChild;
        if (fresh && root.parentNode) {
            root.parentNode.replaceChild(fresh, root);
            bind(fresh, opts);
            if (typeof opts.onChange === "function") opts.onChange(get(projectId));
        }
    }

    function persistFromDom() {
        var items = [];
        var inputs = root.querySelectorAll("[data-aet-pedido-edit]");
        for (var i = 0; i < inputs.length; i += 1) {
            var li = inputs[i].closest("[data-aet-pedido-id]");
            var id = li ? li.getAttribute("data-aet-pedido-id") : uid();
            var numero = String(inputs[i].value || "").trim();
            if (!numero) continue;
            items.push({ id: id, numero: numero });
        }
        set(projectId, items);
        if (typeof opts.onChange === "function") opts.onChange(get(projectId));
    }

    root.addEventListener("click", function (e) {
        var addBtn = e.target.closest("[data-aet-pedido-add]");
        if (addBtn) {
            e.preventDefault();
            var input = root.querySelector("[data-aet-pedido-new]");
            var numero = input ? String(input.value || "").trim() : "";
            if (!numero) {
                showMsg("Informe o número do pedido.");
                if (input) input.focus();
                return;
            }
            showMsg("");
            var list = currentList();
            list.push({ id: uid(), numero: numero });
            set(projectId, list);
            remount();
            return;
        }
        var rem = e.target.closest("[data-aet-pedido-remove]");
        if (rem) {
            e.preventDefault();
            var row = rem.closest("[data-aet-pedido-id]");
            var rid = row ? row.getAttribute("data-aet-pedido-id") : "";
            set(projectId, currentList().filter(function (p) { return p.id !== rid; }));
            remount();
        }
    });

    root.addEventListener("change", function (e) {
        if (e.target && e.target.hasAttribute("data-aet-pedido-edit")) {
            var v = String(e.target.value || "").trim();
            if (!v) {
                showMsg("Pedido não pode ficar vazio.");
                e.target.focus();
                return;
            }
            showMsg("");
            persistFromDom();
        }
    });

    root.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        if (e.target && e.target.hasAttribute("data-aet-pedido-new")) {
            e.preventDefault();
            var btn = root.querySelector("[data-aet-pedido-add]");
            if (btn) btn.click();
        }
    });
}

global.AuroraEletricaTupyPedidos = {
    STORAGE_KEY: STORAGE_KEY,
    get: get,
    set: set,
    renderHtml: renderHtml,
    bind: bind
};
})(window);
