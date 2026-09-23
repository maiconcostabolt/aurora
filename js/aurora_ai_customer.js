(function (global) {
"use strict";
if (!global.AuroraAiEngine || !global.AuroraAiCustomerServices) return;
Object.keys(global.AuroraAiCustomerServices).forEach(function(profile){
 global.AuroraAiCustomerServices[profile].forEach(function(service){
  global.AuroraAiEngine.install(profile,service,"customer");
 });
});
})(window);
