/**
 * Grade compartilhada de códigos de serviço (USER + ADMIN) — Elétrica Tupy.
 * REV1.6: cards Aurora. Mesma fonte de associações / collectFromDom.
 */
(function (global) {
"use strict";

var DAY_COLS = [
    { day_type: "weekday", day_label: "Dias úteis", codeKey: "codigo_dia_semana", execKey: "weekday" },
    { day_type: "saturday", day_label: "Sábado", codeKey: "codigo_sabado", execKey: "saturday" },
    { day_type: "sunday", day_label: "Domingo", codeKey: "codigo_domingo", execKey: "sunday" }
];

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function catalogItems() {
    var pack = global.AURORA_ELETRICA_TUPY_SERVICES;
    return pack && Array.isArray(pack.items) ? pack.items : [];
}

function humanizeDescription(raw) {
    return String(raw || "")
        .replace(/INFRAESTRUTURA OU DESMONTAGEM DE INFRAESTRUTURA/gi, "Instalação ou remoção de infraestrutura")
        .replace(/Infraestrutura ou desmontagem de infraestrutura/gi, "Instalação ou remoção de infraestrutura");
}

function codeFor(row, col) {
    if (!row || !col) return "";
    var fromExec = row.execution_codes && row.execution_codes[col.execKey];
    if (fromExec) return String(fromExec).trim();
    return String(row[col.codeKey] || "").trim();
}

function assocKey(activityId, serviceItem, serviceCode) {
    return [
        String(activityId || ""),
        String(serviceItem != null ? serviceItem : ""),
        String(serviceCode || "")
    ].join("|");
}

function indexAssociations(associations) {
    var map = {};
    (associations || []).forEach(function (a) {
        if (!a) return;
        map[assocKey(a.activity_id, a.service_item, a.service_code)] = a;
    });
    return map;
}

function matchesQuery(row, query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    var tokens = q.split(/\s+/).filter(Boolean);
    var blob = [
        row.item,
        humanizeDescription(row.descricao_servico),
        row.descricao_servico,
        row.unidade,
        row.codigo_dia_semana,
        row.codigo_sabado,
        row.codigo_domingo
    ].join(" ").toLowerCase();
    return tokens.every(function (t) { return blob.indexOf(t) !== -1; });
}

function clampQty(raw) {
    if (raw == null || raw === "") return "";
    var n = Number(raw);
    if (!Number.isFinite(n)) return String(raw).replace(/^-/, "");
    if (n < 0) n = 0;
    return String(n);
}

function renderTableHtml(opts) {
    opts = opts || {};
    var activityId = String(opts.activityId || "");
    var associations = Array.isArray(opts.associations) ? opts.associations : [];
    var query = opts.query || "";
    var byKey = indexAssociations(associations);
    var items = catalogItems().filter(function (row) {
        return matchesQuery(row, query);
    });

    var rows = items.map(function (row) {
        var cells = DAY_COLS.map(function (col) {
            var code = codeFor(row, col);
            if (!code) {
                return '<td class="aet-codes-grid__day aet-codes-grid__day--empty"><span class="aet-hint">—</span></td>';
            }
            var k = assocKey(activityId, row.item, code);
            var assoc = byKey[k];
            var on = !!assoc;
            var qty = assoc && assoc.quantity != null ? String(assoc.quantity) : "";
            var desc = humanizeDescription(row.descricao_servico || "");
            return '<td class="aet-codes-grid__day">' +
                '<label class="aet-codes-grid__cell">' +
                '<input type="checkbox" data-aet-cg-check' +
                ' data-activity-id="' + esc(activityId) + '"' +
                ' data-service-item="' + esc(row.item) + '"' +
                ' data-service-description="' + esc(desc) + '"' +
                ' data-service-unit="' + esc(row.unidade || "") + '"' +
                ' data-day-type="' + esc(col.day_type) + '"' +
                ' data-day-label="' + esc(col.day_label) + '"' +
                ' data-service-code="' + esc(code) + '"' +
                (on ? " checked" : "") + ">" +
                '<span class="aet-codes-grid__code">' + esc(code) + "</span>" +
                '<input type="number" min="0" step="any" inputmode="decimal"' +
                ' class="aet-codes-grid__qty" data-aet-cg-qty' +
                ' data-service-code="' + esc(code) + '"' +
                ' data-service-item="' + esc(row.item) + '"' +
                ' value="' + esc(qty) + '" aria-label="Quantidade ' + esc(col.day_label) + '"' +
                (on ? "" : " disabled") + ">" +
                "</label></td>";
        }).join("");

        return '<tr class="aet-codes-grid__row" data-service-item="' + esc(row.item) + '">' +
            '<td class="aet-codes-grid__svc">' +
            '<strong>' + esc(humanizeDescription(row.descricao_servico || "")) + "</strong>" +
            (row.unidade ? '<small>Unidade: ' + esc(row.unidade) + "</small>" : "") +
            "</td>" + cells + "</tr>";
    }).join("");

    return '<div class="aet-codes-grid" data-aet-codes-grid data-activity-id="' + esc(activityId) + '">' +
        '<label class="aet-codes-grid__search"><span>Buscar serviço / código</span>' +
        '<input type="search" data-aet-cg-query value="' + esc(query) +
        '" placeholder="Ex.: ventilador ou 50012384" autocomplete="off">' +
        "</label>" +
        '<div class="aet-codes-grid__scroll">' +
        '<table class="aet-codes-grid__table">' +
        "<thead><tr>" +
        "<th>Serviço</th><th>Dias úteis</th><th>Sábado</th><th>Domingo</th>" +
        "</tr></thead>" +
        "<tbody>" +
        (rows || '<tr><td colspan="4" class="aet-hint">Nenhum serviço no catálogo.</td></tr>') +
        "</tbody></table></div></div>";
}

function renderHtml(opts) {
    opts = opts || {};
    if (opts.layout === "cards") return renderCardsHtml(opts);
    return renderTableHtml(opts);
}

function renderCardsHtml(opts) {
    opts = opts || {};
    var activityId = String(opts.activityId || "");
    var associations = Array.isArray(opts.associations) ? opts.associations : [];
    var query = opts.query || "";
    var byKey = indexAssociations(associations);
    var items = catalogItems().filter(function (row) {
        return matchesQuery(row, query);
    });
    var cards = items.map(function (row) {
        var num = String(row.item != null ? row.item : "").padStart(2, "0");
        var desc = humanizeDescription(row.descricao_servico || "");
        var periods = DAY_COLS.map(function (col) {
            var code = codeFor(row, col);
            if (!code) {
                return '<div class="aet-code-period aet-code-period--empty"><span class="aet-hint">—</span></div>';
            }
            var k = assocKey(activityId, row.item, code);
            var assoc = byKey[k];
            var on = !!assoc;
            var qty = assoc && assoc.quantity != null ? String(assoc.quantity) : "";
            return '<div class="aet-code-period' + (on ? " aet-code-period--selected" : "") + '" data-aet-cg-period-toggle tabindex="0" role="button" aria-pressed="' + (on ? "true" : "false") + '">' +
                '<div class="aet-code-period__label">' + esc(col.day_label) + "</div>" +
                '<div class="aet-code-period__code">' + esc(code) + "</div>" +
                '<input type="checkbox" class="aet-code-period__check" data-aet-cg-check' +
                ' data-activity-id="' + esc(activityId) + '"' +
                ' data-service-item="' + esc(row.item) + '"' +
                ' data-service-description="' + esc(desc) + '"' +
                ' data-service-unit="' + esc(row.unidade || "") + '"' +
                ' data-day-type="' + esc(col.day_type) + '"' +
                ' data-day-label="' + esc(col.day_label) + '"' +
                ' data-service-code="' + esc(code) + '"' +
                (on ? " checked" : "") + ' tabindex="-1" aria-hidden="true">' +
                '<label class="aet-code-period__qty-wrap"><span>Quantidade</span>' +
                '<input type="number" min="0" step="any" inputmode="decimal"' +
                ' class="aet-code-period__qty" data-aet-cg-qty' +
                ' data-service-code="' + esc(code) + '"' +
                ' data-service-item="' + esc(row.item) + '"' +
                ' value="' + esc(qty) + '" placeholder="—"' +
                ' aria-label="Quantidade ' + esc(col.day_label) + '"' +
                (on ? "" : " disabled") + "></label></div>";
        }).join("");

        return '<article class="aet-code-family" data-service-item="' + esc(row.item) + '">' +
            '<div class="aet-code-family__identity">' +
            '<span class="aet-code-family__number">' + esc(num) + "</span>" +
            '<div class="aet-code-family__text"><strong>' + esc(desc) + "</strong>" +
            (row.unidade ? '<span class="aet-code-family__unit">' + esc(row.unidade) + "</span>" : "") +
            "</div></div>" +
            '<div class="aet-code-family__periods">' + periods + "</div></article>";
    }).join("");

    return '<div class="aet-codes-grid aet-codes-grid--cards" data-aet-codes-grid data-aet-cg-layout="cards" data-activity-id="' + esc(activityId) + '">' +
        (opts.catalogHtml || "") +
        '<label class="aet-codes-grid__search"><span>Buscar código ou serviço</span>' +
        '<input type="search" data-aet-cg-query value="' + esc(query) +
        '" placeholder="Ex.: 50012313 ou eletroduto" autocomplete="off"></label>' +
        '<div class="aet-codes-grid__list">' +
        (cards || '<p class="aet-hint">Nenhum serviço no catálogo.</p>') +
        "</div></div>";
}

function collectFromDom(root, activityId) {
    var list = [];
    if (!root) return list;
    var checks = root.querySelectorAll("[data-aet-cg-check]");
    for (var i = 0; i < checks.length; i += 1) {
        var cb = checks[i];
        if (!cb.checked) continue;
        var wrap = cb.closest(".aet-code-period") || cb.closest(".aet-codes-grid__cell");
        var qtyEl = wrap ? wrap.querySelector("[data-aet-cg-qty]") : null;
        var rawQty = qtyEl ? String(qtyEl.value || "").trim() : "";
        var qtyNum = rawQty === "" ? null : Number(rawQty);
        if (Number.isFinite(qtyNum) && qtyNum < 0) qtyNum = 0;
        list.push({
            activity_id: String(cb.getAttribute("data-activity-id") || activityId || ""),
            service_item: (function () {
                var v = cb.getAttribute("data-service-item");
                if (v == null || v === "") return null;
                var n = Number(v);
                return Number.isFinite(n) ? n : v;
            })(),
            service_description: String(cb.getAttribute("data-service-description") || ""),
            service_unit: String(cb.getAttribute("data-service-unit") || ""),
            day_type: String(cb.getAttribute("data-day-type") || ""),
            day_label: String(cb.getAttribute("data-day-label") || ""),
            service_code: String(cb.getAttribute("data-service-code") || ""),
            quantity: Number.isFinite(qtyNum) ? qtyNum : (rawQty === "" ? null : rawQty)
        });
    }
    return list;
}

function bindNumberWheelGuard(root) {
    if (!root || root.__aetCgWheelBound) return;
    root.__aetCgWheelBound = true;
    root.addEventListener("wheel", function (e) {
        var t = e.target;
        if (t && t.tagName === "INPUT" && String(t.type).toLowerCase() === "number") {
            e.preventDefault();
        }
    }, { passive: false });
}

function refreshPeriodUi(period) {
    if (!period) return;
    var cb = period.querySelector("[data-aet-cg-check]");
    var qty = period.querySelector("[data-aet-cg-qty]");
    var on = !!(cb && cb.checked);
    period.classList.toggle("aet-code-period--selected", on);
    period.setAttribute("aria-pressed", on ? "true" : "false");
    if (qty) {
        qty.disabled = !on;
        if (!on) qty.value = "";
    }
}

function bind(container, api) {
    api = api || {};
    if (!container) return;
    var root = container.matches && container.matches("[data-aet-codes-grid]")
        ? container
        : container.querySelector("[data-aet-codes-grid]");
    if (!root) return;

    var activityId = root.getAttribute("data-activity-id") || "";
    bindNumberWheelGuard(root);
    function emit() {
        var next = collectFromDom(root, activityId);
        if (typeof api.setAssociations === "function") api.setAssociations(next);
        if (typeof api.onChange === "function") api.onChange(next);
    }

    if (root.__aetCgBound) return;
    root.__aetCgBound = true;

    root.addEventListener("click", function (e) {
        var period = e.target.closest("[data-aet-cg-period-toggle]");
        if (period && !e.target.closest("[data-aet-cg-qty]")) {
            e.preventDefault();
            var cb = period.querySelector("[data-aet-cg-check]");
            if (!cb) return;
            cb.checked = !cb.checked;
            refreshPeriodUi(period);
            emit();
            return;
        }
    });

    root.addEventListener("keydown", function (e) {
        var period = e.target.closest && e.target.closest("[data-aet-cg-period-toggle]");
        if (!period || (e.key !== "Enter" && e.key !== " ")) return;
        if (e.target.closest("[data-aet-cg-qty]")) return;
        e.preventDefault();
        var cb = period.querySelector("[data-aet-cg-check]");
        if (!cb) return;
        cb.checked = !cb.checked;
        refreshPeriodUi(period);
        emit();
    });

    root.addEventListener("change", function (e) {
        var t = e.target;
        if (!t) return;
        if (t.hasAttribute("data-aet-cg-check")) {
            refreshPeriodUi(t.closest(".aet-code-period"));
            emit();
            return;
        }
        if (t.hasAttribute("data-aet-cg-qty")) {
            t.value = clampQty(t.value);
            emit();
        }
    });

    root.addEventListener("input", function (e) {
        var t = e.target;
        if (!t) return;
        if (t.hasAttribute("data-aet-cg-qty")) {
            if (String(t.value).indexOf("-") !== -1) t.value = clampQty(t.value);
            return;
        }
        if (t.hasAttribute("data-aet-cg-query")) {
            var q = t.value;
            var associations = typeof api.getAssociations === "function"
                ? api.getAssociations()
                : collectFromDom(root, activityId);
            var html = renderHtml({ activityId: activityId, associations: associations, query: q, layout: root.getAttribute("data-aet-cg-layout") || "" });
            var tmp = document.createElement("div");
            tmp.innerHTML = html;
            var fresh = tmp.firstChild;
            if (fresh && root.parentNode) {
                root.parentNode.replaceChild(fresh, root);
                bind(fresh, api);
                var qEl = fresh.querySelector("[data-aet-cg-query]");
                if (qEl) {
                    try {
                        qEl.focus();
                        qEl.setSelectionRange(q.length, q.length);
                    } catch (err) { /* ignore */ }
                }
            }
        }
    });
}

global.AuroraEletricaTupyCodesGrid = {
    DAY_COLS: DAY_COLS,
    renderHtml: renderHtml,
    bind: bind,
    collectFromDom: collectFromDom,
    assocKey: assocKey,
    clampQty: clampQty
};
})(window);
