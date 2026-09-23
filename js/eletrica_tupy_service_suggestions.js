/* Regras de SUGESTÃO material→serviço. Nunca auto-selecionam. */
(function (global) {
"use strict";
var RULES = [{"id": "eletroduto_ate_1", "keywords": ["eletroduto"], "max_inch": 1, "family_item": 1, "confidence": "high"}, {"id": "eletroduto_acima_1", "keywords": ["eletroduto"], "min_inch": 1.01, "family_item": 2, "confidence": "high"}, {"id": "perfilado", "keywords": ["perfilado"], "family_item": 3, "confidence": "high"}, {"id": "eletrocalha_ate_200", "keywords": ["eletrocalha"], "max_mm": 200, "family_item": 5, "confidence": "high"}, {"id": "eletrocalha_acima_200", "keywords": ["eletrocalha"], "min_mm": 201, "family_item": 6, "confidence": "high"}, {"id": "cabo_aco", "keywords": ["cabo de aço", "cabo de aco", "cabo aço", "cabo aco"], "family_item": 1, "confidence": "medium", "note": "infraestrutura típica — confirmação humana obrigatória"}, {"id": "ventilador_parede", "keywords": ["ventilador"], "and_keywords": ["parede", "suporte"], "family_item": 15, "confidence": "high"}, {"id": "luminaria", "keywords": ["luminária", "luminaria", "tomada"], "family_item": 17, "confidence": "medium"}];

function parseMm(text) {
  var m = String(text || "").match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}
function parseInch(text) {
  var m = String(text || "").match(/(\d+(?:[.,]\d+)?)\s*(?:"|''|in|pol)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}
function suggestForMaterial(material) {
  var desc = String((material && (material.descricao || material.description || material.nome)) || "").toLowerCase();
  var sap = String((material && material.sap) || "");
  var hits = [];
  var catalog = (global.AURORA_ELETRICA_TUPY_SERVICES && global.AURORA_ELETRICA_TUPY_SERVICES.items) || [];
  RULES.forEach(function (rule) {
    var ok = (rule.keywords || []).some(function (k) { return desc.indexOf(String(k).toLowerCase()) !== -1; });
    if (!ok) return;
    if (rule.and_keywords && rule.and_keywords.length) {
      var aok = rule.and_keywords.some(function (k) { return desc.indexOf(String(k).toLowerCase()) !== -1; });
      if (!aok) return;
    }
    var mm = parseMm(desc);
    var inch = parseInch(desc);
    if (rule.max_mm != null && (mm == null || mm > rule.max_mm)) return;
    if (rule.min_mm != null && (mm == null || mm < rule.min_mm)) return;
    if (rule.max_inch != null && (inch == null || inch > rule.max_inch)) return;
    if (rule.min_inch != null && (inch == null || inch < rule.min_inch)) return;
    var fam = null;
    for (var i = 0; i < catalog.length; i += 1) {
      if (Number(catalog[i].item) === Number(rule.family_item)) { fam = catalog[i]; break; }
    }
    if (!fam) return;
    hits.push({ rule_id: rule.id, confidence: rule.confidence, family: fam, note: rule.note || "", sap: sap });
  });
  return hits;
}
global.AuroraEletricaTupyServiceSuggestions = { rules: RULES, suggestForMaterial: suggestForMaterial };
})(window);
