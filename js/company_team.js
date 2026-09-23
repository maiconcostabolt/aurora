/**
 * Minha Equipe — Fase 2D (ADMIN_BOLT, manage_users claim).
 * READ/WRITE via RPC server-side apenas. Sem persistência de raw_token.
 */
(function (global) {
"use strict";

var ROLE_LABELS = Object.freeze({
    ADMIN_BOLT: "Administrador",
    USER_BOLT: "Usuário",
    COMPANY_ADMIN: "Administrador",
    COMPANY_USER: "Usuário"
});

var STATUS_LABELS = Object.freeze({
    active: "Ativo",
    inactive: "Inativo",
    suspended: "Suspenso",
    pending: "Pendente",
    revoked: "Revogado",
    blocked: "Bloqueado"
});

var teamModal = null;
var teamNavButton = null;
var teamOpen = false;

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function accessApi() {
    return global.AuroraCompanyAccess || null;
}

function cloudClient() {
    return global.AuroraCloudSync && global.AuroraCloudSync.client
        ? global.AuroraCloudSync.client
        : null;
}

function canShowTeamUi() {
    var api = accessApi();
    /* V26 — somente o claim autenticado com manage_users libera Minha Equipe.
       Nunca inferir ADMIN pela shape, pela Home ou pela presença de botões. */
    return Boolean(
        api &&
        typeof api.canManageUsers === "function" &&
        api.canManageUsers()
    );
}
function setTeamNavButtonVisible(visible) {
    if (!teamNavButton) return;
    teamNavButton.hidden = !visible;
    teamNavButton.setAttribute("aria-hidden", visible ? "false" : "true");
    teamNavButton.style.display = visible ? "" : "none";
    if (visible) {
        teamNavButton.removeAttribute("hidden");
    } else {
        teamNavButton.setAttribute("hidden", "");
    }
}

function detachTeamNavButton() {
    if (!teamNavButton) return;
    if (teamNavButton.parentNode) {
        teamNavButton.parentNode.removeChild(teamNavButton);
    }
    teamNavButton = null;
}

function showStatus(message, duration) {
    var el = document.getElementById("app-status");
    if (!el) return;
    el.textContent = String(message || "");
    el.classList.add("is-visible");
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(function () {
        el.classList.remove("is-visible");
    }, duration == null ? 2200 : duration);
}

function roleLabel(role) {
    var key = String(role || "").trim().toUpperCase();
    return ROLE_LABELS[key] || (role ? String(role) : "—");
}

function statusLabel(status) {
    var key = String(status || "").trim().toLowerCase();
    return STATUS_LABELS[key] || (status ? String(status) : "—");
}

function memberDisplayName(row) {
    if (!row) return "Membro";
    var name = row.display_name != null ? String(row.display_name).trim() : "";
    if (name) return name;
    if (row.user_id) return "Usuário " + String(row.user_id).slice(0, 8);
    return "Membro";
}

function ensureTeamModal() {
    if (teamModal) return teamModal;

    teamModal = document.createElement("div");
    teamModal.className = "aurora-team-modal";
    teamModal.hidden = true;
    teamModal.innerHTML = [
        '<button type="button" class="aurora-team-modal__backdrop" data-team-close aria-label="Fechar"></button>',
        '<section class="aurora-team-sheet" role="dialog" aria-modal="true" aria-label="Minha Equipe">',
        '<header class="aurora-team-sheet__header">',
        '<div>',
        '<button type="button" class="aurora-team-back" data-team-close>← Voltar</button>',
        '<h2>Minha Equipe</h2>',
        '<p data-team-company-subtitle>Carregando empresa...</p>',
        '</div>',
        '<button type="button" data-team-close aria-label="Fechar">×</button>',
        '</header>',
        '<div class="aurora-team-body" data-team-body>',
        '<p class="aurora-team-loading">Carregando membros...</p>',
        '</div>',
        '<footer class="aurora-team-footer">',
        '<button type="button" class="aurora-team-invite-btn" data-team-invite>+ Convidar usuário</button>',
        '</footer>',
        '</section>',
        '<div class="aurora-team-invite-result" data-team-invite-result hidden>',
        '<section class="aurora-team-invite-sheet" role="dialog" aria-modal="true" aria-label="Convite criado">',
        '<header><h3>Convite criado</h3><p>Compartilhe o link com quem você deseja convidar.</p></header>',
        '<div class="aurora-team-invite-actions">',
        '<button type="button" data-team-share>Compartilhar</button>',
        '<button type="button" data-team-copy>Copiar link</button>',
        '</div>',
        '<button type="button" class="aurora-team-invite-done" data-team-invite-done>Concluir</button>',
        '</section>',
        '</div>'
    ].join("");

    document.body.appendChild(teamModal);

    teamModal.querySelectorAll("[data-team-close]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            closeTeamModal();
        });
    });

    var inviteBtn = teamModal.querySelector("[data-team-invite]");
    if (inviteBtn) {
        inviteBtn.addEventListener("click", function () {
            handleInviteUser().catch(function (error) {
                showStatus("Não foi possível criar o convite.");
            });
        });
    }

    var inviteResult = teamModal.querySelector("[data-team-invite-result]");
    if (inviteResult) {
        inviteResult.querySelector("[data-team-invite-done]").addEventListener("click", function () {
            hideInviteResult();
        });
        inviteResult.querySelector("[data-team-share]").addEventListener("click", function () {
            sharePendingInvite().catch(function () {
                showStatus("Compartilhamento indisponível.");
            });
        });
        inviteResult.querySelector("[data-team-copy]").addEventListener("click", function () {
            copyPendingInvite().catch(function () {
                showStatus("Não foi possível copiar o link.");
            });
        });
    }

    return teamModal;
}

var pendingInviteUrl = null;
var pendingInviteShareText = null;

function clearPendingInvite() {
    pendingInviteUrl = null;
    pendingInviteShareText = null;
}

function hideInviteResult() {
    clearPendingInvite();
    var panel = teamModal && teamModal.querySelector("[data-team-invite-result]");
    if (panel) panel.hidden = true;
}

function showInviteResult(inviteUrl, companyName) {
    pendingInviteUrl = inviteUrl;
    pendingInviteShareText =
        "Você foi convidado para fazer parte da equipe "
        + (companyName || "da empresa")
        + " na Aurora.";
    var panel = ensureTeamModal().querySelector("[data-team-invite-result]");
    if (panel) panel.hidden = false;
}

async function sharePendingInvite() {
    if (!pendingInviteUrl) return false;
    if (global.navigator && typeof global.navigator.share === "function") {
        try {
            await global.navigator.share({
                title: "Convite Aurora",
                text: pendingInviteShareText || "Convite para equipe na Aurora.",
                url: pendingInviteUrl
            });
            showStatus("Convite compartilhado.");
            return true;
        } catch (error) {
            if (error && error.name === "AbortError") return false;
        }
    }
    showStatus("Compartilhamento nativo indisponível neste dispositivo.");
    return false;
}

async function copyTextToClipboard(text) {
    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === "function") {
        await global.navigator.clipboard.writeText(text);
        return true;
    }
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    var ok = false;
    try {
        ok = document.execCommand("copy");
    } catch (error) {
        ok = false;
    }
    document.body.removeChild(textarea);
    if (!ok) {
        var err = new Error("CLIPBOARD_UNAVAILABLE");
        err.code = "CLIPBOARD_UNAVAILABLE";
        throw err;
    }
    return true;
}

async function copyPendingInvite() {
    if (!pendingInviteUrl) return false;
    await copyTextToClipboard(pendingInviteUrl);
    showStatus("Link copiado.");
    return true;
}

function renderMembers(host, members, companyName, aiAccessRows, assetAccessRows, moduleAccessRows) {
    var subtitle = ensureTeamModal().querySelector("[data-team-company-subtitle]");
    if (subtitle) subtitle.textContent = companyName || "Equipe da empresa";
    if (!Array.isArray(members) || !members.length) {
        host.innerHTML = '<p class="aurora-team-empty">Nenhum membro encontrado.</p>';
        return;
    }
    var aiByUser = {};
    (Array.isArray(aiAccessRows) ? aiAccessRows : []).forEach(function (row) { if (row && row.user_id) aiByUser[String(row.user_id)] = row; });
    var assetByUser = {};
    (Array.isArray(assetAccessRows) ? assetAccessRows : []).forEach(function (row) { if (row && row.user_id) assetByUser[String(row.user_id)] = row; });
    var moduleByUser = {};
    (Array.isArray(moduleAccessRows) ? moduleAccessRows : []).forEach(function(row){
        if(!row || !row.user_id || !row.module_code) return;
        var uid=String(row.user_id); if(!moduleByUser[uid]) moduleByUser[uid]=[]; moduleByUser[uid].push(row);
    });
    var MODULE_LABELS={workshop:'Oficina mecânica',electrical:'Elétrica',eletrica_tupy:'Atividades Rotineiras',industrial:'Industrial',drone:'Drone',car_wash:'Lavação automotiva',upholstery_cleaning:'Sofás e estofados',curtains_blinds:'Cortinas e persianas',repairs_maintenance:'Reparos e manutenção',condominiums:'Condomínios',grounding_equipotentialization:'Aterramento e Equipotencialização'};
    var assetCatalogTitle = "Cadastros e históricos";
    try {
        var assetCard = document.querySelector("[data-open-assets][data-assets-title]");
        if (assetCard && assetCard.dataset.assetsTitle) assetCatalogTitle = assetCard.dataset.assetsTitle;
    } catch (_) {}
    var removable = members.filter(function (row) {
        return String(row.role || "").toUpperCase() === "COMPANY_USER" && row.user_id;
    });
    var items = members.map(function (row) {
        var memberRole = String(row.role || "").toUpperCase();
        var canRemove = (memberRole === "COMPANY_USER" || memberRole === "USER_BOLT") && row.user_id;
        var ai = row.user_id ? aiByUser[String(row.user_id)] : null;
        var ap = row.user_id ? assetByUser[String(row.user_id)] : null;
        /* V87: membro ativo ainda sem linha persistida recebe os mesmos defaults
           da RPC aurora_asset_my_permissions; o primeiro toggle faz o UPSERT oficial. */
        if (canRemove && !ap) {
            ap = {
                user_id: row.user_id,
                can_view: true,
                can_inspect: true,
                can_view_history: true,
                can_print_qr: false,
                can_create: false,
                can_edit: false,
                can_deactivate: false
            };
        }
        var mods = row.user_id ? (moduleByUser[String(row.user_id)] || []) : [];
        var moduleControl = canRemove && mods.length ? '<div class="aurora-team-asset-perms aurora-team-module-perms"><b>▦ Ambientes permitidos</b><div>'+mods.map(function(m){var code=String(m.module_code||'');return '<label class="aurora-team-module-chip"><span>'+escapeHtml(MODULE_LABELS[code]||code)+'</span><input type="checkbox" data-team-module-perm="'+escapeHtml(code)+'" data-user-id="'+escapeHtml(row.user_id)+'" '+(m.enabled?'checked':'')+'></label>';}).join('')+'</div></div>' : '';
        var CATALOG_LABELS={workshop:'Veículos',electrical:'Painéis e equipamentos',eletrica_tupy:'Atividades Rotineiras',industrial:'Máquinas e equipamentos',drone:'Estruturas inspecionadas',car_wash:'Veículos',upholstery_cleaning:'Estofados cadastrados',curtains_blinds:'Cortinas e persianas',repairs_maintenance:'Locais e manutenções',condominiums:'Áreas e equipamentos',grounding_equipotentialization:'Pontos e sistemas de aterramento'};
        var enabledMods=mods.filter(function(m){return !!m.enabled;}).map(function(m){return String(m.module_code||'');});
        var permissionTitle=enabledMods.length===1?(CATALOG_LABELS[enabledMods[0]]||'Cadastros e históricos'):(enabledMods.length>1?'Cadastros dos ambientes permitidos':'Cadastros e históricos');
        var assetControl = canRemove && ap ? '<div class="aurora-team-asset-perms"><b>▣ '+escapeHtml(permissionTitle)+'</b><small>Permissões definidas pelo administrador</small><div>'+[['can_view','Visualizar'],['can_inspect','Nova vistoria'],['can_view_history','Histórico'],['can_print_qr','Etiqueta QR'],['can_create','Cadastrar'],['can_edit','Editar'],['can_deactivate','Excluir / desativar']].map(function(x){return '<label><input type="checkbox" data-team-asset-perm="'+x[0]+'" data-user-id="'+escapeHtml(row.user_id)+'" '+(ap[x[0]]?'checked':'')+'> '+x[1]+'</label>';}).join('')+'</div></div>' : '';
        var aiControl = ai ? [
            '<label class="aurora-team-ai-toggle" title="Definir acesso deste membro à Aurora AI">',
            '<span><b>✦ Aurora AI</b><small>', ai.ai_enabled ? 'Ativada para este membro' : 'Desativada para este membro', '</small></span>',
            '<input type="checkbox" data-team-ai-toggle value="', escapeHtml(row.user_id), '" ', ai.ai_enabled ? 'checked' : '', '>',
            '<i aria-hidden="true"></i>',
            '</label>'
        ].join('') : '';
        return [
            '<article class="aurora-team-member '+(String(row.status||'').toLowerCase()==='blocked'?'is-blocked':'')+'">',
            '<div class="aurora-team-member__info">',
            '<strong class="aurora-team-member__name">', escapeHtml(memberDisplayName(row)), '</strong>',
            '<span class="aurora-team-member__role">', escapeHtml(roleLabel(row.role)), '</span>',
            '</div>',
            canRemove ? '<label class="aurora-team-status-toggle" title="Ativar ou bloquear este usuário"><input type="checkbox" data-team-member-active value="' + escapeHtml(row.user_id) + '" ' + (String(row.status || '').toLowerCase() === 'active' ? 'checked' : '') + '><i></i><span>'+(String(row.status||'').toLowerCase()==='active'?'Ativo':'Bloqueado')+'</span></label>' : '<span class="aurora-team-admin-badge">Administrador</span>',
            canRemove ? '<label class="aurora-team-delete-select"><input type="checkbox" data-team-member-select value="' + escapeHtml(row.user_id) + '"><span>Selecionar</span></label>' : '',
            moduleControl, assetControl, aiControl, '</article>'
        ].join("");
    }).join("");
    var actions = removable.length
        ? '<div class="aurora-team-bulk"><label><input type="checkbox" data-team-select-all> Selecionar vários</label><button type="button" data-team-remove-selected disabled>Excluir selecionados</button></div>'
        : '';
    host.innerHTML = actions + '<div class="aurora-team-ai-note">✦ O plano da empresa libera a Aurora AI. Você decide quais membros podem utilizá-la.</div><div class="aurora-team-list">' + items + "</div>";
    var all = host.querySelector('[data-team-select-all]');
    var remove = host.querySelector('[data-team-remove-selected]');
    function syncSelection() {
        var checks = Array.prototype.slice.call(host.querySelectorAll('[data-team-member-select]'));
        var selected = checks.filter(function (el) { return el.checked; });
        if (remove) { remove.disabled = !selected.length; remove.textContent = selected.length ? 'Excluir selecionados (' + selected.length + ')' : 'Excluir selecionados'; }
        if (all) { all.checked = checks.length > 0 && selected.length === checks.length; all.indeterminate = selected.length > 0 && selected.length < checks.length; }
    }
    host.addEventListener('change', async function (event) {
        if (event.target.matches('[data-team-member-active]')) {
            var activeToggle = event.target;
            var targetUserId = activeToggle.value;
            var nextActive = activeToggle.checked;
            activeToggle.disabled = true;
            try {
                var statusClient = cloudClient();
                if (!statusClient || typeof statusClient.rpc !== 'function') throw new Error('CLIENT_UNAVAILABLE');
                var statusResult = await statusClient.rpc('aurora_company_set_member_status', {
                    p_user_id: targetUserId,
                    p_status: nextActive ? 'active' : 'blocked'
                });
                if (statusResult && statusResult.error) throw statusResult.error;
                var persisted = statusResult && statusResult.data && statusResult.data.status ? String(statusResult.data.status).toLowerCase() : (nextActive ? 'active' : 'blocked');
                if ((nextActive && persisted !== 'active') || (!nextActive && persisted !== 'blocked')) throw new Error('MEMBER_STATUS_NOT_PERSISTED');
                showStatus(nextActive ? 'Usuário ativado.' : 'Usuário bloqueado.');
                await loadTeamMembers();
            } catch (error) {
                activeToggle.checked = !nextActive;
                showStatus('Não foi possível alterar o status deste usuário.');
            } finally {
                activeToggle.disabled = false;
            }
            return;
        }
        if (event.target.matches('[data-team-module-perm]')) {
            var mt=event.target, userId=mt.getAttribute('data-user-id'), moduleCode=mt.getAttribute('data-team-module-perm'), enabled=mt.checked;
            mt.disabled=true;
            try{var mc=cloudClient();var mr=await mc.rpc('aurora_set_member_module_access',{p_user_id:userId,p_module_code:moduleCode,p_enabled:enabled});if(mr&&mr.error)throw mr.error;showStatus(enabled?'Ambiente liberado para este usuário.':'Ambiente removido deste usuário.');await loadTeamMembers();}
            catch(error){mt.checked=!enabled;showStatus('Não foi possível alterar o ambiente deste usuário.');}
            finally{mt.disabled=false}
            return;
        }
        if (event.target.matches('[data-team-asset-perm]')) {
            var userId=event.target.getAttribute('data-user-id'), box=event.target.closest('.aurora-team-asset-perms');
            var vals={}; box.querySelectorAll('[data-team-asset-perm]').forEach(function(el){vals[el.getAttribute('data-team-asset-perm')]=el.checked});
            box.querySelectorAll('input').forEach(function(el){el.disabled=true});
            try{var client=cloudClient();var rr=await client.rpc('aurora_set_asset_member_permissions',{p_user_id:userId,p_can_view:!!vals.can_view,p_can_inspect:!!vals.can_inspect,p_can_view_history:!!vals.can_view_history,p_can_print_qr:!!vals.can_print_qr,p_can_create:!!vals.can_create,p_can_edit:!!vals.can_edit,p_can_deactivate:!!vals.can_deactivate});if(rr&&rr.error)throw rr.error;showStatus('Permissões de equipamentos atualizadas.');}
            catch(error){showStatus('Não foi possível alterar as permissões de equipamentos.');await loadTeamMembers();}
            finally{box.querySelectorAll('input').forEach(function(el){el.disabled=false})}
            return;
        }
        if (event.target.matches('[data-team-ai-toggle]')) {
            var toggle = event.target, enabled = toggle.checked;
            toggle.disabled = true;
            try {
                var client = cloudClient();
                if (!client || typeof client.rpc !== 'function') throw new Error('CLIENT_UNAVAILABLE');
                var result = await client.rpc('aurora_set_company_ai_member_access', { p_user_id: toggle.value, p_enabled: enabled });
                if (result && result.error) throw result.error;
                var confirmed = result && result.data && typeof result.data.enabled === 'boolean' ? result.data.enabled : enabled;
                if (confirmed !== enabled) throw new Error('AI_ACCESS_NOT_PERSISTED');
                toggle.checked = confirmed;
                var small = toggle.closest('.aurora-team-ai-toggle').querySelector('small');
                if (small) small.textContent = confirmed ? 'Ativada para este membro' : 'Desativada para este membro';
                showStatus(confirmed ? 'Aurora AI ativada para este membro.' : 'Aurora AI desativada para este membro.');
            } catch (error) {
                toggle.checked = !enabled;
                showStatus('Não foi possível alterar o acesso à Aurora AI.');
            } finally { toggle.disabled = false; }
            return;
        }
        if (event.target.matches('[data-team-select-all]')) {
            host.querySelectorAll('[data-team-member-select]').forEach(function (el) { el.checked = event.target.checked; });
        }
        if (event.target.matches('[data-team-select-all], [data-team-member-select]')) syncSelection();
    });
    if (remove) remove.addEventListener('click', async function () {
        var ids = Array.prototype.slice.call(host.querySelectorAll('[data-team-member-select]:checked')).map(function (el) { return el.value; });
        if (!ids.length) return;
        var dialog = global.AuroraDialog;
        var ok = true;
        if (dialog && typeof dialog.confirm === 'function') ok = await dialog.confirm('Excluir ' + ids.length + ' usuário(s) da equipe?\n\nEles perderão o vínculo com esta empresa.', { title: 'Excluir usuários', confirmLabel: 'Excluir', cancelLabel: 'Cancelar' });
        else ok = global.confirm('Excluir ' + ids.length + ' usuário(s) da equipe?');
        if (!ok) return;
        remove.disabled = true; remove.textContent = 'Excluindo…';
        try {
            await accessApi().removeCompanyMembers(cloudClient(), ids);
            showStatus(ids.length === 1 ? 'Usuário excluído da equipe.' : 'Usuários excluídos da equipe.');
            await loadTeamMembers();
        } catch (error) {
            showStatus('Não foi possível excluir os usuários.');
            remove.disabled = false; syncSelection();
        }
    });
}
async function loadTeamMembers() {
    var api = accessApi();
    var client = cloudClient();
    var host = ensureTeamModal().querySelector("[data-team-body]");
    if (!host) return;

    if (!canShowTeamUi()) {
        host.innerHTML = '<p class="aurora-team-error">Acesso negado à gestão de equipe.</p>';
        return;
    }

    host.innerHTML = '<p class="aurora-team-loading">Carregando membros...</p>';

    try {
        var members = await api.listCompanyMembers(client);
        var aiRows = [], assetRows = [], moduleRows = [];
        if (client && typeof client.rpc === "function") {
            var aiResult = await client.rpc("aurora_company_ai_member_access");
            if (aiResult && aiResult.error) throw aiResult.error;
            aiRows = aiResult && Array.isArray(aiResult.data) ? aiResult.data : [];
            var assetResult = await client.rpc('aurora_asset_permissions_admin_list');
            if (assetResult && !assetResult.error) assetRows = Array.isArray(assetResult.data) ? assetResult.data : [];
            var moduleResult = await client.rpc('aurora_admin_member_module_access');
            if (moduleResult && !moduleResult.error) moduleRows = Array.isArray(moduleResult.data) ? moduleResult.data : [];
        }
        var claim = api.get ? api.get() : {};
        renderMembers(host, members, claim.company_name || claim.company_slug || null, aiRows, assetRows, moduleRows);
    } catch (error) {
        host.innerHTML = '<p class="aurora-team-error">Não foi possível carregar a equipe.</p>';
    }
}

async function handleInviteUser() {
    var api = accessApi();
    var client = cloudClient();
    var dialog = global.AuroraDialog;

    if (!canShowTeamUi()) {
        showStatus("Acesso negado.");
        return;
    }

    if (dialog && typeof dialog.confirm === "function") {
        var confirmed = await dialog.confirm(
            "Será criado um link de convite para entrar na equipe da empresa.\n\nDeseja continuar?",
            {
                title: "Convidar usuário",
                confirmLabel: "Criar convite",
                cancelLabel: "Cancelar"
            }
        );
        if (!confirmed) return;
    }

    showStatus("Criando convite...");

    var payload = await api.createCompanyInvite(client);
    var rawToken = payload && payload.raw_token;
    if (!rawToken) {
        showStatus("Resposta de convite inválida.");
        return;
    }

    var inviteUrl = api.buildCompanyInviteUrl(rawToken);
    var companyName =
        (payload && payload.company_name)
        || (api.get && api.get().company_name)
        || null;

    showInviteResult(inviteUrl, companyName);
    showStatus("Convite criado.");
}

function openTeamModal() {
    if (!canShowTeamUi()) {
        showStatus("Acesso negado à gestão de equipe.");
        return;
    }
    ensureTeamModal();
    teamModal.hidden = false;
    teamOpen = true;
    document.body.classList.add("aurora-team-open");
    hideInviteResult();
    loadTeamMembers().catch(function () {
        showStatus("Não foi possível carregar a equipe.");
    });
}

function closeTeamModal() {
    if (!teamModal) return false;
    hideInviteResult();
    teamModal.hidden = true;
    teamOpen = false;
    document.body.classList.remove("aurora-team-open");
    return true;
}

function closeIfOpen() {
    if (!teamOpen) return false;
    return closeTeamModal();
}

function syncNavVisibility() {
    var access = global.AURORA_COMPANY_ACCESS || null;
    var loaded = Boolean(access && access.loaded === true);

    /* V97 — regra por papel/origem empresarial.
       Enquanto o claim autenticado ainda não terminou de carregar, NÃO remover
       o placeholder criado pelo Perfil. Apenas mantê-lo oculto.
       Depois do claim:
       - COMPANY_ADMIN/manage_users => mostra Minha Equipe;
       - COMPANY_USER ou conta individual => remove/oculta o acesso. */
    if (!loaded) {
        if (!teamNavButton || !teamNavButton.isConnected) {
            teamNavButton = null;
            injectTeamNavButton();
        }
        setTeamNavButtonVisible(false);
        return;
    }
    if (!canShowTeamUi()) {
        detachTeamNavButton();
        return;
    }
    if (!teamNavButton || !teamNavButton.isConnected) {
        teamNavButton = null;
        injectTeamNavButton();
    }
    setTeamNavButtonVisible(true);
}

function injectTeamNavButton() {
    var nav = document.querySelector(".aurora-settings-nav");
    if (!nav) return false;

    if (!teamNavButton) {
        var existing = nav.querySelector("[data-settings-team]");
        if (existing) {
            teamNavButton = existing;
            if (!existing.dataset.teamNavBound) {
                existing.dataset.teamNavBound = "1";
                existing.addEventListener("click", function () {
                    openTeamModal();
                });
            }
            return true;
        }

        teamNavButton = document.createElement("button");
        teamNavButton.type = "button";
        teamNavButton.dataset.settingsTeam = "";
        teamNavButton.hidden = true;
        teamNavButton.setAttribute("hidden", "");
        teamNavButton.setAttribute("aria-hidden", "true");
        teamNavButton.style.display = "none";
        teamNavButton.innerHTML = [
            "<span>👥</span>",
            "<div><strong>Minha Equipe</strong><small>Membros e convites</small></div>",
            "<b>›</b>"
        ].join("");

        var identityBtn = nav.querySelector("[data-settings-identity]");
        if (identityBtn && identityBtn.parentNode === nav) {
            if (identityBtn.nextSibling) {
                nav.insertBefore(teamNavButton, identityBtn.nextSibling);
            } else {
                nav.appendChild(teamNavButton);
            }
        } else {
            nav.insertBefore(teamNavButton, nav.firstChild);
        }

        teamNavButton.addEventListener("click", function () {
            openTeamModal();
        });
        teamNavButton.dataset.teamNavBound = "1";
    }

    return true;
}

function observeSettingsModalOpen() {
    if (observeSettingsModalOpen._active) return true;
    var modal = document.querySelector(".aurora-settings-modal");
    if (!modal) return false;
    observeSettingsModalOpen._active = true;
    new MutationObserver(function () {
        if (modal.classList.contains("is-open")) {
            syncNavVisibility();
        }
    }).observe(modal, {
        attributes: true,
        attributeFilter: ["class"]
    });
    return true;
}

function ensureSettingsModalObserver() {
    if (observeSettingsModalOpen._active) return;
    if (observeSettingsModalOpen()) return;
    if (ensureSettingsModalObserver._observer) return;
    ensureSettingsModalObserver._observer = new MutationObserver(function () {
        if (observeSettingsModalOpen()) {
            ensureSettingsModalObserver._observer.disconnect();
            ensureSettingsModalObserver._observer = null;
        }
    });
    ensureSettingsModalObserver._observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

function observeCompanyAccessRefresh() {
    if (observeCompanyAccessRefresh._active) return;
    observeCompanyAccessRefresh._active = true;
    ["aurora:company-invite-accepted", "aurora:company-access-ready", "aurora:home-rendered", "aurora:module-changed"].forEach(function (eventName) {
        global.addEventListener(eventName, function () {
            /* V98 — o claim pode mudar de vazio/intermediário para COMPANY_ADMIN.
               Recria o acesso oficial antes de reconciliar sua visibilidade. */
            if (canShowTeamUi()) ensureTeamNavButton();
            syncNavVisibility();
        });
    });
}

function ensureTeamNavButton() {
    if (injectTeamNavButton()) {
        syncNavVisibility();
        return;
    }
    if (ensureTeamNavButton._observer) return;
    ensureTeamNavButton._observer = new MutationObserver(function () {
        if (injectTeamNavButton()) {
            syncNavVisibility();
            ensureTeamNavButton._observer.disconnect();
            ensureTeamNavButton._observer = null;
        }
    });
    ensureTeamNavButton._observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

function initWhenReady() {
    ensureTeamNavButton();
    ensureSettingsModalObserver();
    observeCompanyAccessRefresh();
    syncNavVisibility();

    /* A tela de Perfil é criada dinamicamente pelo bootstrap. Ao abri-la,
       revalida Minha Equipe depois da própria navegação terminar. Isso
       preserva o fluxo já existente e elimina a corrida vista no F5. */
    document.addEventListener("click", function () {
        setTimeout(async function () {
            var modal = document.querySelector(".aurora-settings-modal");
            if (!modal || !modal.classList.contains("is-open")) return;

            /* V99 — ao abrir Perfil e configurações, confirma o papel diretamente
               na RPC autenticada antes de decidir Minha Equipe. Não depende da
               shape nem de uma hidratação anterior do bootstrap. */
            var api = accessApi();
            var client = cloudClient();
            if (api && typeof api.refresh === "function" && client) {
                try {
                    await api.refresh(client);
                } catch (e) {
                    /* fail closed: syncNavVisibility manterá o card oculto */
                }
            }
            ensureTeamNavButton();
            syncNavVisibility();
        }, 0);
    }, true);
    [120, 400, 900].forEach(function (delay) {
        setTimeout(function () {
            ensureTeamNavButton();
            syncNavVisibility();
        }, delay);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWhenReady);
} else {
    initWhenReady();
}

global.AuroraCompanyTeam = {
    canShowTeamUi: canShowTeamUi,
    open: openTeamModal,
    close: closeTeamModal,
    closeIfOpen: closeIfOpen,
    syncNavVisibility: syncNavVisibility,
    ensureNavButton: ensureTeamNavButton,
    roleLabel: roleLabel,
    statusLabel: statusLabel,
    buildInviteShareText: function (companyName) {
        return "Você foi convidado para fazer parte da equipe "
            + (companyName || "da empresa")
            + " na Aurora.";
    }
};

})(window);
