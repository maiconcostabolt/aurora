# Relatório Premium — Vistoria Veicular (TESTE 1)

Integração controlada do layout Bolt como **segundo template** em paralelo ao relatório legado (`legacy`).

## Escopo desta rodada

- Apenas **Vistoria Veicular**
- Vanilla JS/HTML/CSS dentro de `core/reporting/premium/`
- **Sem** React, segunda PWA, APK, Cloudflare ou alteração do ReportEngine
- Dados reais via `ReportEngine.createFromCase()` + adapter (`vehicle_inspection_adapter.js`)
- Fotos com **`object-fit: contain`** (proibido crop/cover/stretch)

## Árvore

```
core/reporting/premium/
├── components/premium_components.js
├── data/premium_utils.js
├── data/vehicle_inspection_adapter.js
├── pages/cover_page.js
├── pages/identification_page.js
├── pages/occurrences_page.js
├── pages/diagnosis_page.js
├── proof/generate_proof.py
├── proof/premium_integration_proof.html
├── proof/premium_proof_case.js
├── premium_report_renderer.js
├── styles/premium_report.css
└── README.md
```

## Uso

```javascript
const renderer = new PremiumReportRenderer({
  companyProvider: () => identityFromMinhaEmpresa
});

const html = renderer.renderStandaloneDocument(report);
const fragment = renderer.renderDocumentFragment(report);
```

## Paginação dinâmica

| Página | Conteúdo |
|--------|----------|
| 1 | Capa |
| 2 | Identificação + grid 5 fotos guiadas |
| 3…N | Ocorrências (máx. 2 por página A4) + checklist na última página de ocorrências |
| N+1 | Diagnóstico + finalização + assinatura |

Com 0 ocorrências: uma página de ocorrências vazia + checklist.

## Mapeamento campo Premium → Aurora

| Campo Premium | Origem Aurora | Transformação |
|---------------|---------------|---------------|
| `company.name` | `report.company` + `companyProvider()` via `mergeCompany` | Mesclar snapshot + identidade live |
| `company.slogan` | `company.tagline` / `slogan` | String trim |
| `meta.reportNumber` | `report.public_id` | Fallback `report.id` |
| `meta.date/time` | `report.created_at` | Formato `DD MMM AAAA` / `HH:MM` |
| `customer.name` | `report.customer.name` | Trim |
| `inspector.name` | `performed_by_name`, `intake.responsible`, `company.professional` | `resolveVehicleInspectionResponsible` |
| `vehicle.make/model` | `approval.report_title` ou `asset.year_model` | Split por espaço |
| `vehicle.plate` | `asset.plate` | — |
| `vehicle.yearModel` | `asset.year_model` | — |
| `vehicle.color` | `asset.color` | — |
| `vehicle.mileageKm` | `asset.mileage` / `asset.km` | Number |
| `vehicle.fuel` | `asset.fuel` / `intake.fuel_level` | — |
| `entry.date/time` | `intake.entry_date`, `intake.entry_time` | Formatação PT |
| `exit.date/time` | `approval.finalized_at` / `updated_at` | Formatação PT |
| `coverPhoto` | `report.coverPhoto` | `src`/`url`, sem coords |
| `photos[]` | `occurrences` com `vehicle_photo_slot` | Slots `front/rear/left/right/dashboard` |
| `occurrences[]` | `occurrences` não guiadas | Filtrar guided; mapear severidade |
| `checklist[]` | `intake.internal_external` … `safety_items` | OK/Atenção/Reparo → ok/atencao/reparo |
| `diagnosis.summary` | `diagnostic.summary` / `conclusion` | — |
| `diagnosis.recommendation` | `diagnostic.recommendation` | — |
| `finalization.status` | `approval.status` / `report.status` | Uppercase |
| `finalization.note` | `approval.notes` | — |
| `finalization.signatureData` | `approval.signature_data` | Data URL real (não SVG decorativo) |

### Severidade Aurora → Premium

| Aurora | Premium |
|--------|---------|
| Baixa, Média | `atencao` |
| Alta, Crítica, Reparo | `reparo` |
| Sem gravidade | omitida |

## Prova

```powershell
python core/reporting/premium/proof/generate_proof.py
```

Saída: `AUDITORIAS/PREMIUM_REPORT_TEST1/`

## Diferenças intencionais vs Bolt

- Removidos sidebar LAT/LNG/ISO/EV da capa (dados fictícios proibidos)
- Assinatura do cliente usa `approval.signature_data` real
- Paginação calculada dinamicamente (não fixo “Página X de 4”)
- Portado para vanilla JS (≈ layout/CSS Bolt, não runtime React/Tailwind)

## Próximo passo (fora desta rodada)

Opt-in no fluxo de preview (`report.template === 'premium'`) — requer aprovação explícita por alterar `report_preview.js`.
