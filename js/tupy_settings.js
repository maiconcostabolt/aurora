(function (global) {"use strict";
var navButton = null;
function hasActiveTupyShape() {
    try {
        var raw = global.localStorage && global.localStorage.getItem("aurora_company_identity_rc1_5");
        var identity = raw ? JSON.parse(raw) : {};
        var profile = String(identity && identity.profile || "").trim().toLowerCase();
        if (profile !== "electrical") return false;
        var selected = Array.isArray(identity.selected_services) ? identity.selected_services.slice() : [];
        var byModule = identity.selected_services_by_module && typeof identity.selected_services_by_module === "object"
            ? identity.selected_services_by_module.electrical
            : null;
        if (Array.isArray(byModule)) selected = selected.concat(byModule);
        return selected.some(function (id) {
            return String(id || "").trim().toLowerCase() === "eletrica_tupy";
        });
    } catch (error) {
        return false;
    }
}
function canShow() {
    var access = global.AuroraCompanyAccess;
    var roleOk = !!(access && typeof access.canManageUsers === "function" && access.canManageUsers());
    if (!roleOk) return false;
    try {
        var raw = global.localStorage && global.localStorage.getItem("aurora_company_identity_rc1_5");
        var identity = raw ? JSON.parse(raw) : {};
        var active = String(identity && identity.active_license_module_code || "").trim().toLowerCase();
        return active === "eletrica_tupy" || hasActiveTupyShape();
    } catch (_) { return hasActiveTupyShape(); }
}
function closeProfileSettings() { var modal = document.querySelector(".aurora-settings-modal.is-open"); if (!modal) return; var closeButton = modal.querySelector("[data-settings-close]"); if (closeButton && typeof closeButton.click === "function") closeButton.click(); }
function open() {
    var api = global.AuroraEletricaTupy; if (!api || !canShow()) return;
    var old = document.querySelector("[data-aet-settings-catalog-layer]"); if (old) old.remove();
    var layer = document.createElement("div"); layer.className = "aet-catalog-overlay aet-settings-tupy-overlay"; layer.setAttribute("data-aet-settings-catalog-layer", "");
    layer.innerHTML = '<section class="aet-settings-tupy-panel" role="dialog" aria-modal="true" aria-labelledby="aet-settings-tupy-title"><header><div><span>Administração</span><h3 id="aet-settings-tupy-title">Configurações Tupy</h3><p>Gerencie os catálogos usados nas Atividades Rotineiras.</p></div><button type="button" class="aet-modal-close" data-aet-settings-tupy-close aria-label="Fechar Configurações Tupy">×</button></header><div class="aet-settings-tupy-grid"><button type="button" class="aet-settings-tupy-card" data-aet-open-service-catalog><span>▤</span><div><strong>Catálogo de serviços</strong><small>Códigos Dias úteis / Sábado / Domingo</small></div><b>›</b></button><button type="button" class="aet-settings-tupy-card" data-aet-open-material-catalog><span>▦</span><div><strong>Materiais Tupy</strong><small>Catálogo oficial de materiais</small></div><b>›</b></button></div><div class="aet-catalog-overlay" data-aet-catalog-overlay hidden></div></section>';
    function close() { layer.remove(); if (navButton && typeof navButton.focus === "function") navButton.focus(); }
    document.body.appendChild(layer); layer.querySelector("[data-aet-settings-tupy-close]").addEventListener("click", close); layer.addEventListener("click", function (event) { if (event.target === layer) close(); });
    layer.addEventListener("keydown", function (event) { if (event.key === "Escape" && layer.querySelector("[data-aet-catalog-overlay]:not([hidden])") === null) { event.preventDefault(); close(); } });
    if (typeof api.bindServiceCatalogOpen === "function") api.bindServiceCatalogOpen(layer); if (typeof api.bindMaterialCatalogOpen === "function") api.bindMaterialCatalogOpen(layer);
    var first = layer.querySelector("[data-aet-open-service-catalog]"); if (first && typeof first.focus === "function") first.focus();
}
function sync() { if (navButton) { var show = canShow(); navButton.hidden = !show; navButton.style.display = show ? "" : "none"; } }
function openCatalog(kind) {
    open();
    setTimeout(function () {
        var sel = kind === "materials" ? "[data-aet-open-material-catalog]" : "[data-aet-open-service-catalog]";
        var btn = document.querySelector("[data-aet-settings-catalog-layer] " + sel);
        if (btn && typeof btn.click === "function") btn.click();
    }, 0);
}
function sync() {
    document.querySelectorAll("[data-settings-tupy-service]").forEach(function (btn) {
        var show = canShow(); btn.hidden = !show; btn.style.display = show ? "" : "none";
    });
}
function inject() {
    var nav = document.querySelector(".aurora-settings-nav"); if (!nav) return false;
    var team = nav.querySelector("[data-settings-team]");
    var service = nav.querySelector("[data-settings-tupy-service]");
    if (!service) {
        service = document.createElement("button"); service.type="button"; service.setAttribute("data-settings-tupy-service","");
        service.innerHTML='<span>▤</span><div><strong>Catálogo de serviços Tupy</strong><small>Serviços, códigos e materiais</small></div><b>›</b>';
        service.addEventListener("click", function(){ open(); });
        if (team && team.nextSibling) nav.insertBefore(service, team.nextSibling); else nav.insertBefore(service, nav.firstChild);
    }
    nav.querySelectorAll("[data-settings-tupy-material]").forEach(function (item) { item.remove(); });
    navButton = service; sync(); return true;
}
function init() { if (!inject()) { var observer = new MutationObserver(function () { if (inject()) observer.disconnect(); }); observer.observe(document.documentElement, {childList:true,subtree:true}); } var modal = document.querySelector(".aurora-settings-modal"); if (modal) new MutationObserver(sync).observe(modal, {attributes:true,attributeFilter:["class"]}); global.addEventListener("aurora:company-invite-accepted", sync); global.addEventListener("AuroraAuthReady", function () { inject(); sync(); }); document.addEventListener("click", function (event) { if (event.target && event.target.closest && event.target.closest("[data-settings-open], .aurora-user-menu, .aurora-settings-nav")) setTimeout(function () { inject(); sync(); }, 0); }); setTimeout(function () { inject(); sync(); }, 800); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); global.AuroraTupySettings = {open:open,sync:sync};
})(window);
