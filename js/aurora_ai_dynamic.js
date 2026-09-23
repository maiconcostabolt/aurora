(function(global){
"use strict";
if(!global.AuroraAiEngine)return;
[["AssetModuleController","asset"],["IntakeModuleController","intake"],["OccurrenceModuleController","occurrence"],["DiagnosticModuleController","diagnostic"],["ApprovalModuleController","approval"]].forEach(function(x){global.AuroraAiEngine.installDynamic(x[0],x[1]);});
})(window);
