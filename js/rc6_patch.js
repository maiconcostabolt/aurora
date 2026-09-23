(function(global){
"use strict";

const LIBRARIES = {
  industrial: {
    service_request:["Avaliar condição geral do equipamento.","Identificar causa da anomalia relatada.","Executar inspeção preventiva.","Registrar condições para planejamento de manutenção."],
    initial_condition:["Equipamento em operação.","Equipamento parado para inspeção.","Área liberada e sinalizada.","Conjunto com ruído anormal.","Vibração percebida durante o funcionamento."],
    customer_request:["Apresentar diagnóstico e ações recomendadas.","Confirmar possibilidade de operação segura.","Registrar componentes que exigem manutenção.","Gerar relatório para planejamento da parada."],
    summary:["Vibração elevada.","Vazamento de óleo.","Aquecimento acima do normal.","Ruído anormal.","Desalinhamento identificado."],
    recommendation:["Programar manutenção.","Trocar rolamentos.","Realizar alinhamento.","Realizar lubrificação.","Inspecionar novamente após o reparo."],
    occurrence:["Folga mecânica identificada.","Componente com desgaste.","Fixação inadequada.","Corrosão superficial.","Vazamento identificado."],
    final_observation:["Atendimento concluído conforme escopo.","Relatório emitido para planejamento da manutenção.","Serviço permanece pendente de correção."]
  },
  electrical: {
    asset_category:["Painel elétrico","Motor elétrico","Instalação elétrica","Circuito","Transformador","Gerador"],
    service_request:["Realizar diagnóstico da instalação.","Executar inspeção preventiva do circuito.","Verificar causa de desarme.","Avaliar aquecimento e integridade das conexões."],
    initial_condition:["Instalação energizada.","Circuito desenergizado e liberado.","Painel em operação.","Equipamento indisponível para operação."],
    customer_request:["Identificar a origem da falha.","Apresentar correção recomendada.","Verificar condições de segurança.","Registrar pontos de aquecimento e anomalias."],
    summary:["Contator aquecido.","Disjuntor desarmando.","Cabo com aquecimento.","Barramento oxidado.","Conexão com aperto insuficiente."],
    recommendation:["Reapertar conexões.","Realizar termografia.","Substituir o componente.","Limpar o painel.","Programar nova inspeção."],
    occurrence:["Aquecimento em conexão.","Isolação danificada.","Oxidação em terminal.","Componente desarmando.","Identificação ausente."],
    final_observation:["Atendimento elétrico concluído.","Circuito liberado após os testes.","Correção pendente de material ou parada programada."]
  },
  workshop: {
    service_request:["Verificar ruído relatado pelo cliente.","Executar revisão preventiva.","Avaliar vazamento identificado.","Apresentar orçamento antes do reparo."],
    initial_condition:["Veículo em funcionamento.","Veículo chegou rodando.","Veículo removido por guincho.","Luz de advertência acesa no painel.","Ruído percebido durante o teste inicial."],
    customer_request:["Diagnosticar a causa do ruído.","Verificar itens de segurança.","Apresentar orçamento antes da execução.","Realizar revisão completa do sistema."],
    summary:["Ruído durante o funcionamento.","Vazamento identificado.","Folga acima do normal.","Desgaste visível.","Funcionamento irregular."],
    recommendation:["Substituir o componente.","Programar manutenção.","Realizar alinhamento.","Realizar teste após o reparo.","Revisar o conjunto completo."],
    occurrence:["Amortecedor com vazamento.","Bucha rompida.","Pivô com folga.","Pastilhas abaixo do limite.","Disco com desgaste.","Fluido contaminado."],
    final_observation:["Veículo liberado após o atendimento.","Orçamento apresentado ao cliente.","Serviço pendente de autorização do cliente."]
  },
  car_wash: {
    service_request:["Lavação externa simples.","Lavação completa interna e externa.","Higienização interna.","Polimento técnico.","Aplicação de proteção na pintura.","Descontaminação da pintura."],
    initial_condition:["Veículo com sujeira leve no exterior.","Veículo com barro acumulado.","Poeira intensa no interior.","Bancos com manchas aparentes.","Pelos de animais no interior.","Rodas com sujeira intensa.","Pintura com marcas de chuva.","Itens pessoais deixados no veículo."],
    customer_request:["Realizar lavação completa.","Remover manchas dos bancos.","Eliminar odores do interior.","Limpar rodas e caixas de roda.","Avaliar riscos antes do polimento.","Aplicar proteção na pintura.","Preservar itens pessoais encontrados no veículo."],
    summary:["Lavação concluída conforme o serviço contratado.","Veículo higienizado interna e externamente.","Pintura limpa e preservada.","Interior higienizado e aspirado.","Manchas reduzidas após o tratamento.","Algumas avarias pré-existentes permaneceram visíveis."],
    recommendation:["Aguardar a secagem completa do interior.","Realizar hidratação dos bancos de couro.","Aplicar proteção na pintura.","Agendar polimento para correção de riscos leves.","Evitar produtos abrasivos nas próximas lavagens.","Retirar objetos pessoais antes do próximo atendimento."],
    occurrence:["Risco superficial identificado.","Amassado pré-existente.","Mancha de água na pintura.","Banco com mancha.","Farol com opacidade.","Item pessoal encontrado no veículo.","Sujeira intensa em área localizada.","Odor interno identificado."],
    final_observation:["Veículo entregue após conferência visual.","Serviço concluído conforme contratado.","Cliente orientado sobre o tempo de secagem.","Avarias pré-existentes registradas por fotografia."]
  },
  upholstery_cleaning: {
    service_request:["Higienização completa do estofado.","Remoção de manchas localizadas.","Tratamento de odor.","Limpeza e sanitização do tecido.","Aplicação de impermeabilizante."],
    initial_condition:["Estofado com sujeira leve.","Sujeira intensa no tecido.","Manchas localizadas.","Odor forte.","Pelos de animais.","Presença aparente de mofo.","Costura rompida antes do serviço.","Tecido com desbotamento pré-existente."],
    customer_request:["Remover manchas aparentes.","Reduzir odores do estofado.","Realizar higienização profunda.","Aplicar impermeabilização após a secagem.","Preservar o tecido e a tonalidade original."],
    summary:["Higienização concluída.","Manchas removidas parcialmente.","Odor reduzido após o tratamento.","Tecido preservado.","Dano pré-existente mantido após a limpeza."],
    recommendation:["Aguardar secagem completa antes do uso.","Manter o ambiente ventilado.","Não expor o tecido ao sol direto.","Aplicar impermeabilização após a secagem.","Repetir a higienização periodicamente."],
    occurrence:["Sujeira intensa.","Mancha de gordura.","Mancha de bebida.","Odor forte.","Pelos de animais.","Presença de mofo.","Costura rompida.","Tecido desbotado.","Espuma deformada.","Mancha removida parcialmente."],
    final_observation:["Estofado liberado para secagem.","Cliente orientado a aguardar o tempo de secagem.","Serviço concluído com registro das manchas remanescentes."]
  },
  curtains_blinds: {
    service_request:["Instalação de cortina.","Instalação de persiana.","Substituição de trilho ou varão.","Regulagem do sistema.","Manutenção do acionamento.","Instalação de sistema motorizado."],
    initial_condition:["Produto novo para instalação.","Suporte existente em boas condições.","Fixação anterior solta.","Cordão rompido.","Corrente danificada.","Trilho com travamento.","Lâminas desalinhadas.","Motor sem resposta."],
    customer_request:["Instalar e nivelar o conjunto.","Corrigir falha no acionamento.","Substituir componentes desgastados.","Reforçar os pontos de fixação.","Programar controle e limites do motor.","Realizar manutenção sem substituir o tecido."],
    summary:["Instalação concluída e nivelada.","Funcionamento testado.","Regulagem concluída.","Componente substituído.","Serviço pendente de peça."],
    recommendation:["Realizar limpeza periódica.","Evitar excesso de força no acionamento.","Programar revisão preventiva.","Substituir componentes desgastados.","Não operar o sistema motorizado manualmente."],
    occurrence:["Suporte solto.","Fixação inadequada.","Cordão rompido.","Corrente danificada.","Lâmina desalinhada.","Tecido manchado.","Trilho com travamento.","Motor com falha.","Nivelamento realizado.","Fixação reforçada."],
    final_observation:["Instalação concluída e testada.","Cliente orientado sobre o acionamento correto.","Manutenção pendente de peça de reposição."]
  },
  condominiums: {
    service_request:["Realizar inspeção periódica da área.","Verificar condição de conservação e segurança.","Registrar pendências para manutenção.","Acompanhar ocorrência anteriormente identificada."],
    initial_condition:["Área liberada para inspeção.","Condição geral aparentemente normal.","Pendência relatada por morador ou administração.","Manutenção anterior em acompanhamento.","Acesso parcial ao local."],
    customer_request:["Registrar as condições encontradas.","Priorizar itens de segurança.","Gerar evidências para manutenção.","Acompanhar a correção da pendência.","Apresentar recomendações ao condomínio."],
    summary:["Inspeção concluída sem condição crítica aparente.","Pendências registradas para acompanhamento.","Item requer manutenção corretiva.","Condição crítica requer ação prioritária."],
    recommendation:["Programar manutenção preventiva.","Solicitar avaliação de empresa especializada.","Corrigir a pendência e realizar nova conferência.","Isolar ou sinalizar o local até a correção.","Manter acompanhamento periódico."],
    occurrence:["Conservação inadequada.","Falha de funcionamento.","Dano físico aparente.","Sinalização ausente ou inadequada.","Risco de segurança identificado.","Manutenção preventiva recomendada."],
    final_observation:["Inspeção predial concluída.","Pendências registradas para acompanhamento do condomínio.","Itens críticos comunicados à administração."]
  },
  drone: {
    service_request:["Realizar levantamento visual da cobertura.","Inspecionar fachada e revestimentos.","Registrar condições de torre ou estrutura.","Localizar pontos de possível infiltração."],
    initial_condition:["Área liberada para voo.","Condições meteorológicas adequadas.","Infiltração relatada pelo cliente.","Acesso terrestre limitado."],
    customer_request:["Identificar telhas danificadas.","Registrar trincas e desprendimentos.","Mapear pontos de corrosão.","Gerar imagens para planejamento da manutenção."],
    summary:["Trinca identificada.","Infiltração aparente.","Corrosão superficial.","Fissura no revestimento.","Desplacamento visível."],
    recommendation:["Realizar reparo localizado.","Avaliar por profissional especializado.","Monitorar a evolução.","Impermeabilizar a área.","Programar inspeção complementar."],
    occurrence:["Trinca em fachada.","Infiltração.","Corrosão.","Telha deslocada.","Falha de vedação."],
    final_observation:["Levantamento aéreo concluído.","Imagens disponibilizadas para análise.","Recomenda-se avaliação presencial complementar."]
  },
  repairs_maintenance: {
    service_request:["Executar reparo no local indicado.","Corrigir acabamento danificado.","Realizar manutenção preventiva.","Avaliar o serviço e registrar as etapas necessárias.","Executar pequena reforma no ambiente."],
    initial_condition:["Área liberada para o serviço.","Local com acabamento danificado.","Presença de trinca ou fissura superficial.","Revestimento solto ou quebrado.","Superfície com umidade aparente.","Serviço anterior com acabamento irregular."],
    customer_request:["Corrigir o problema e recompor o acabamento.","Preservar os elementos existentes.","Executar o serviço com mínima geração de sujeira.","Apresentar materiais necessários antes da execução.","Registrar o resultado por fotografias."],
    summary:["Serviço concluído conforme solicitado.","Reparo executado e acabamento recomposto.","Etapa concluída; aguardando cura ou secagem.","Serviço parcialmente concluído.","Atendimento pendente de material ou nova etapa."],
    recommendation:["Aguardar o tempo de cura antes do uso.","Manter a área seca durante a cura.","Realizar pintura após a secagem completa.","Monitorar o reaparecimento da fissura.","Programar a etapa complementar."],
    occurrence:["Área preparada para o reparo.","Material danificado removido.","Reparo executado.","Acabamento recomposto.","Material adicional necessário.","Pendência identificada durante o serviço."],
    final_observation:["Serviço conferido após a execução.","Cliente orientado sobre cura, secagem e uso do local.","Área limpa e liberada após o atendimento.","Serviço permanece pendente de material ou etapa complementar."]
  }
};

function profile(){
  const runtime=global.auroraRuntime || global.AuroraRuntime || null;
  let value='';
  try {
    if(runtime){
      value=runtime.profile || runtime.profileId || runtime.activeProfile || '';
      if(!value && typeof runtime.getCase==='function'){
        const c=runtime.getCase() || {};
        value=c.profile_id || c.module_id || (c.service && (c.service.profile_id || c.service.profile)) || '';
      }
      if(!value && runtime.caseData){
        const c=runtime.caseData || {};
        value=c.profile_id || c.module_id || (c.service && (c.service.profile_id || c.service.profile)) || '';
      }
    }
  } catch(_e) {}
  if(!value){
    const body=document.body;
    value=(body && (body.dataset.profile || body.dataset.profileId || body.dataset.module)) || '';
  }
  if(!value){
    value=localStorage.getItem('aurora.activeProfile') || localStorage.getItem('aurora.profile') || localStorage.getItem('aurora.selectedProfile') || '';
  }
  return String(value || 'industrial').toLowerCase();
}

function currentService(){
  const runtime=global.auroraRuntime || global.AuroraRuntime || null;
  let c={};
  try {
    c=(runtime && typeof runtime.getCase==='function' && runtime.getCase()) || (runtime && runtime.caseData) || {};
  } catch(_e) {}
  const service=c.service || {};
  const value=service.id || service.service_id || c.service_id || c.shape_id || localStorage.getItem('aurora.activeService') || '';
  return String(value || '').toLowerCase();
}

const SERVICE_EXTRAS={
  /* OFICINA — sugestões específicas por sistema */
  vehicle_inspection:{
    service_request:["Realizar vistoria de recebimento do veículo.","Registrar condições antes da execução do serviço.","Executar checklist preventivo do veículo.","Documentar avarias e itens entregues pelo cliente."],
    initial_condition:["Veículo recebido para vistoria.","Condições externas e internas registradas na entrada.","Avarias preexistentes identificadas e fotografadas.","Checklist realizado na presença do cliente."],
    customer_request:["Registrar o estado geral antes do serviço.","Verificar itens de segurança e níveis.","Apresentar orçamento antes de qualquer reparo adicional.","Documentar objetos e acessórios deixados no veículo."],
    occurrence:["Risco identificado na carroceria.","Amassado preexistente registrado.","Componente com desgaste aparente.","Acessório ausente no recebimento.","Pneu apresenta desgaste ou avaria.","Item requer atenção na próxima revisão.","Condição registrada apenas para ciência do cliente."],
    summary:["Vistoria de recebimento concluída.","Condições do veículo documentadas com evidências.","Checklist preventivo realizado.","Avarias preexistentes registradas."],
    recommendation:["Solicitar autorização antes de executar reparos adicionais.","Manter o registro fotográfico anexado à ordem de serviço.","Programar correção dos itens classificados como atenção.","Executar reparo imediato nos itens que comprometem a segurança."],
    final_observation:["Veículo recebido e condições conferidas com o cliente.","Registro de entrada concluído.","Cliente informado sobre as condições encontradas.","Veículo liberado para início dos serviços autorizados."]
  },
  suspension:{
    service_request:["Diagnosticar ruído na suspensão.","Verificar folgas e desgaste do conjunto.","Executar revisão preventiva da suspensão.","Avaliar estabilidade e comportamento do veículo."],
    initial_condition:["Ruído ao passar por irregularidades.","Veículo apresenta instabilidade em movimento.","Desgaste irregular dos pneus.","Suspensão apresenta batida seca.","Veículo apresenta inclinação ou altura irregular."],
    customer_request:["Identificar a origem do ruído.","Verificar amortecedores, buchas e pivôs.","Avaliar necessidade de substituição de componentes.","Apresentar orçamento antes do reparo."],
    occurrence:["Amortecedor com vazamento.","Bucha com desgaste ou ruptura.","Pivô com folga.","Terminal com folga.","Coxim do amortecedor com desgaste.","Mola com dano ou assentamento irregular.","Bieleta com folga.","Fixação do conjunto com anomalia."],
    summary:["Folga identificada no conjunto da suspensão.","Componente da suspensão apresenta desgaste.","Origem provável do ruído localizada.","Suspensão inspecionada sem anomalia aparente no item verificado."],
    recommendation:["Substituir o componente com desgaste.","Revisar o conjunto do mesmo eixo.","Realizar alinhamento após o reparo.","Realizar teste de rodagem após a manutenção."],
    final_observation:["Suspensão conferida após o atendimento.","Veículo liberado para teste de rodagem.","Reparo pendente de autorização ou peça."]
  },
  engine:{
    service_request:["Diagnosticar falha de funcionamento do motor.","Verificar ruído anormal no motor.","Avaliar vazamento de óleo ou fluido.","Executar revisão preventiva do motor."],
    initial_condition:["Motor apresenta funcionamento irregular.","Luz de injeção acesa.","Ruído anormal durante o funcionamento.","Vazamento aparente no compartimento do motor.","Dificuldade de partida relatada pelo cliente."],
    customer_request:["Identificar a causa da falha.","Verificar origem do vazamento.","Avaliar sistema de ignição e alimentação.","Apresentar diagnóstico antes da execução do reparo."],
    occurrence:["Vazamento de óleo identificado.","Vazamento de líquido de arrefecimento.","Mangueira com ressecamento ou dano.","Correia com desgaste aparente.","Falha de ignição identificada.","Marcha lenta irregular.","Ruído mecânico anormal.","Conector ou chicote com anomalia."],
    summary:["Falha de funcionamento identificada.","Vazamento localizado.","Sistema inspecionado e condição registrada.","Motor funcionando normalmente após o atendimento."],
    recommendation:["Corrigir o vazamento identificado.","Substituir componente com desgaste.","Realizar revisão do sistema de arrefecimento.","Executar novo teste após o reparo."],
    final_observation:["Motor testado após o atendimento.","Diagnóstico apresentado ao cliente.","Reparo pendente de autorização ou peça."]
  },
  brakes:{
    service_request:["Verificar ruído durante a frenagem.","Avaliar desgaste do sistema de freios.","Executar revisão preventiva dos freios.","Verificar eficiência de frenagem."],
    initial_condition:["Ruído relatado durante a frenagem.","Pedal apresenta comportamento anormal.","Veículo apresenta desvio durante a frenagem.","Luz de advertência do sistema acesa.","Freio de estacionamento com baixa eficiência."],
    customer_request:["Verificar pastilhas e discos.","Avaliar condição do fluido de freio.","Identificar origem do ruído.","Apresentar necessidade de reparo antes da execução."],
    occurrence:["Pastilhas com desgaste acentuado.","Disco com desgaste aparente.","Disco com sulcos ou superfície irregular.","Fluido de freio com condição inadequada.","Vazamento no sistema de freio.","Flexível com dano aparente.","Pinça apresenta anomalia de funcionamento.","Freio de estacionamento necessita regulagem."],
    summary:["Desgaste identificado no sistema de freios.","Sistema de freios revisado.","Componente substituído e funcionamento conferido.","Sistema permanece pendente de reparo."],
    recommendation:["Substituir os componentes desgastados do mesmo eixo.","Realizar troca do fluido conforme condição verificada.","Revisar pinças e elementos de acionamento.","Realizar teste de frenagem após o reparo."],
    final_observation:["Sistema de freios conferido após o atendimento.","Veículo liberado após teste funcional.","Reparo pendente de autorização ou material."]
  },
  steering:{
    service_request:["Diagnosticar ruído ou folga na direção.","Verificar terminais, pivôs e caixa de direção.","Executar revisão preventiva da direção.","Avaliar alinhamento e estabilidade na condução."],
    initial_condition:["Ruído ao girar o volante.","Volante com folga perceptível.","Veículo puxa para um lado.","Retorno do volante irregular.","Direção apresenta resistência ou travamento."],
    customer_request:["Identificar origem da folga na direção.","Verificar terminais e caixa de direção.","Avaliar necessidade de alinhamento.","Apresentar orçamento antes do reparo."],
    occurrence:["Terminal de direção com folga.","Pivô com desgaste ou folga.","Caixa de direção com ruído anormal.","Bieleta da direção com folga.","Coifa da direção danificada.","Fluido da direção hidráulica baixo.","Mancal ou suporte da direção com desgaste.","Folga identificada no volante."],
    summary:["Folga identificada no sistema de direção.","Componente da direção apresenta desgaste.","Origem provável do ruído localizada.","Direção inspecionada sem anomalia aparente no item verificado."],
    recommendation:["Substituir o componente com folga.","Revisar terminais e caixa de direção.","Realizar alinhamento após o reparo.","Realizar teste de rodagem após a manutenção."],
    final_observation:["Direção conferida após o atendimento.","Veículo liberado para teste de rodagem.","Reparo pendente de autorização ou peça."]
  },
  vehicle_electrical:{
    service_request:["Diagnosticar falha elétrica do veículo.","Verificar sistema de carga e partida.","Identificar consumo elétrico anormal.","Avaliar iluminação, sinalização e acessórios."],
    initial_condition:["Veículo apresenta dificuldade de partida.","Bateria apresenta baixa carga.","Luz de advertência acesa no painel.","Componente elétrico sem funcionamento.","Falha elétrica ocorre de forma intermitente."],
    customer_request:["Testar bateria e alternador.","Localizar falha no circuito.","Verificar fusíveis, relés e conexões.","Corrigir falha de iluminação ou acessório."],
    occurrence:["Bateria com tensão abaixo do esperado.","Terminal da bateria com oxidação.","Fusível aberto.","Relé apresenta falha.","Conector com mau contato.","Chicote com dano aparente.","Lâmpada ou conjunto de iluminação inoperante.","Sistema de carga apresenta anomalia."],
    summary:["Falha elétrica localizada.","Circuito testado após a intervenção.","Sistema de carga e partida verificado.","Anomalia intermitente permanece em observação."],
    recommendation:["Corrigir conexão ou chicote afetado.","Substituir componente elétrico defeituoso.","Revisar sistema de carga.","Realizar novo diagnóstico caso a falha intermitente retorne."],
    final_observation:["Sistema elétrico testado após o atendimento.","Veículo entregue com circuito conferido.","Diagnóstico permanece pendente de teste complementar."]
  },
  air_conditioning:{
    service_request:["Diagnosticar baixa eficiência do ar-condicionado.","Verificar ausência de refrigeração.","Avaliar ruído no sistema de climatização.","Executar revisão preventiva do ar-condicionado."],
    initial_condition:["Sistema não refrigera adequadamente.","Ventilação apresenta vazão reduzida.","Odor perceptível ao ligar a climatização.","Ruído anormal durante o acionamento.","Sistema apresenta funcionamento intermitente."],
    customer_request:["Verificar carga e pressões do sistema.","Avaliar filtro de cabine.","Localizar possível vazamento.","Verificar compressor e acionamento."],
    occurrence:["Filtro de cabine com sujidade elevada.","Indício de vazamento no sistema.","Compressor apresenta ruído anormal.","Ventoinha apresenta funcionamento irregular.","Dreno apresenta obstrução.","Conexão ou mangueira apresenta anomalia."],
    summary:["Sistema de climatização inspecionado.","Eficiência de refrigeração restabelecida.","Ponto de anomalia identificado.","Sistema permanece pendente de reparo complementar."],
    recommendation:["Substituir filtro de cabine.","Corrigir vazamento antes da recarga.","Higienizar o sistema de ventilação.","Reavaliar pressões e temperatura após o reparo."],
    final_observation:["Ar-condicionado testado após o atendimento.","Cliente orientado sobre manutenção do sistema.","Serviço pendente de componente ou teste complementar."]
  },

  common_areas:{
    service_request:["Inspecionar áreas comuns.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Conservação de hall ou corredor", "Sinalização de rota de circulação", "Iluminação de área comum", "Corrimão ou guarda-corpo", "Limpeza e organização"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  electrical_system:{
    service_request:["Inspecionar sistema elétrico.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Quadro sem identificação adequada", "Luminária com falha", "Tampa ou proteção inadequada", "Sinais de aquecimento", "Fiação aparente"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  hydraulic_system:{
    service_request:["Inspecionar sistema hidráulico.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Vazamento aparente", "Registro com falha", "Umidade em parede ou teto", "Drenagem obstruída", "Tubulação com corrosão aparente"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  pump_room:{
    service_request:["Inspecionar bombas e casa de máquinas.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Bomba com ruído anormal", "Vibração no conjunto", "Vazamento em conexão", "Painel com indicação de falha", "Casa de máquinas desorganizada"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  elevators:{
    service_request:["Inspecionar elevadores.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Porta com ruído ou impacto", "Desnível na parada", "Sinalização danificada", "Cabine com dano aparente", "Ocorrência operacional relatada"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  fire_safety:{
    service_request:["Inspecionar sistema de incêndio.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Extintor fora do prazo", "Acesso ao hidrante obstruído", "Porta corta-fogo obstruída", "Sinalização de emergência ausente", "Iluminação de emergência com falha"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  facade_roof:{
    service_request:["Inspecionar fachada e cobertura.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Trinca ou fissura aparente", "Infiltração", "Revestimento com soltura", "Calha obstruída", "Telha ou acabamento danificado"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  garage:{
    service_request:["Inspecionar garagem.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Iluminação deficiente", "Piso danificado", "Drenagem com acúmulo de água", "Sinalização desgastada", "Risco em circulação"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  access_gates:{
    service_request:["Inspecionar portões e acessos.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Portão com funcionamento intermitente", "Sensor de segurança com falha", "Estrutura com folga", "Interfone sem funcionamento", "Acesso sem condição adequada"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  leisure_area:{
    service_request:["Inspecionar piscina e área de lazer.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Equipamento danificado", "Piso com risco de queda", "Sinalização ausente", "Limpeza inadequada", "Item de segurança requer atenção"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },
  maintenance_occurrences:{
    service_request:["Inspecionar ocorrências e manutenção.","Registrar pendências e necessidades de manutenção.","Executar conferência periódica do condomínio."],
    initial_condition:["Área liberada para inspeção.","Condição relatada pela administração.","Pendência anterior em acompanhamento."],
    customer_request:["Registrar evidências das condições encontradas.","Indicar prioridade das pendências.","Apresentar recomendação de manutenção."],
    occurrence:["Nova pendência registrada", "Aguardando orçamento", "Aguardando material", "Serviço em execução", "Correção concluída para conferência"],
    summary:["Inspeção concluída.","Pendências registradas para acompanhamento.","Item requer ação corretiva."],
    recommendation:["Programar manutenção.","Solicitar avaliação especializada.","Corrigir e realizar nova conferência.","Sinalizar o local até a correção."],
    final_observation:["Atendimento concluído e registrado.","Pendências encaminhadas para acompanhamento do condomínio."]
  },

  /* ELÉTRICA — sugestões específicas por tipo de atendimento */
  panel:{
    service_request:["Inspecionar painel elétrico.","Diagnosticar desarme ou falha no painel.","Executar manutenção preventiva do painel.","Verificar aquecimento e integridade das conexões."],
    initial_condition:["Painel energizado e em operação.","Painel desenergizado e liberado para manutenção.","Sinais de aquecimento relatados.","Desarme recorrente relatado.","Painel apresenta acúmulo de poeira ou contaminantes."],
    customer_request:["Identificar origem do desarme.","Verificar aperto e estado das conexões.","Avaliar componentes com sinais de aquecimento.","Registrar itens para manutenção programada."],
    occurrence:["Conexão com sinais de aquecimento.","Terminal com oxidação.","Cabo com isolação danificada.","Componente com escurecimento térmico.","Identificação de circuito ausente ou ilegível.","Canaleta ou proteção interna danificada.","Ventilação do painel obstruída.","Componente com fixação inadequada."],
    summary:["Painel inspecionado e anomalias registradas.","Ponto de aquecimento identificado.","Conexões verificadas conforme o escopo.","Painel permanece pendente de intervenção corretiva."],
    recommendation:["Programar reaperto com circuito desenergizado.","Substituir componente com sinais de dano térmico.","Recomenda-se termografia após estabilização de carga.","Atualizar identificação dos circuitos."],
    final_observation:["Painel liberado conforme condição encontrada.","Anomalias registradas para manutenção programada.","Intervenção corretiva permanece pendente."]
  },
  thermography:{
    service_request:["Executar inspeção termográfica do painel.","Mapear pontos de aquecimento anormal.","Comparar componentes sob condição de carga.","Registrar anomalias térmicas para manutenção."],
    initial_condition:["Equipamento em operação durante a inspeção.","Carga estável no momento do levantamento.","Painel acessível para captura termográfica.","Anomalia térmica previamente relatada."],
    customer_request:["Identificar pontos com temperatura elevada.","Comparar fases e componentes equivalentes.","Registrar imagens térmicas das anomalias.","Priorizar pontos para manutenção preventiva."],
    occurrence:["Conexão apresenta aquecimento localizado.","Componente apresenta temperatura superior aos equivalentes.","Desbalanceamento térmico entre fases.","Ponto quente identificado em terminal.","Aquecimento localizado em cabo ou barramento.","Componente sem anomalia térmica aparente no momento da inspeção."],
    summary:["Anomalia térmica registrada.","Diferença térmica identificada entre componentes comparáveis.","Inspeção termográfica concluída sem ponto crítico aparente no item.","Ponto requer correlação com carga e condição operacional."],
    recommendation:["Verificar aperto e condição da conexão com circuito desenergizado.","Correlacionar temperatura com corrente e carga do circuito.","Programar correção e repetir a termografia.","Monitorar a evolução térmica do ponto registrado."],
    final_observation:["Levantamento termográfico concluído.","Imagens térmicas registradas para análise.","Recomendações condicionadas à condição de carga observada."]
  },
  installation:{
    service_request:["Executar instalação de novo circuito.","Adequar ponto elétrico existente.","Diagnosticar falha em circuito elétrico.","Revisar tomadas, iluminação e conexões."],
    initial_condition:["Circuito existente em operação.","Ponto sem alimentação elétrica.","Instalação apresenta sinais de intervenção anterior.","Infraestrutura disponível para execução.","Circuito desenergizado e liberado."],
    customer_request:["Instalar novo ponto elétrico.","Corrigir circuito sem funcionamento.","Substituir tomada, interruptor ou conexão.","Organizar e identificar o circuito atendido."],
    occurrence:["Tomada com sinais de aquecimento.","Condutor com isolação danificada.","Emenda inadequada identificada.","Conexão frouxa.","Proteção incompatível com a condição observada.","Caixa ou espelho danificado.","Identificação de circuito ausente."],
    summary:["Circuito instalado conforme o escopo.","Ponto elétrico restabelecido.","Conexões revisadas e testadas.","Adequação permanece pendente de material ou liberação."],
    recommendation:["Adequar o circuito antes de ampliar a carga.","Substituir componentes danificados.","Identificar o circuito no quadro correspondente.","Realizar teste funcional após a conclusão."],
    final_observation:["Instalação testada após o atendimento.","Ponto entregue em funcionamento.","Serviço permanece pendente de adequação complementar."]
  },
  electric_motor:{
    service_request:["Diagnosticar falha em motor elétrico.","Verificar aquecimento, ruído e vibração.","Executar inspeção preventiva do motor.","Avaliar alimentação e condição de operação."],
    initial_condition:["Motor em operação.","Motor parado por falha.","Aquecimento anormal relatado.","Ruído ou vibração anormal relatados.","Desarme da proteção durante a operação."],
    customer_request:["Identificar causa do desarme.","Verificar alimentação e conexões.","Avaliar rolamentos e condição mecânica aparente.","Registrar dados para manutenção programada."],
    occurrence:["Terminal apresenta sinais de aquecimento.","Cabo ou conexão com anomalia.","Ruído anormal nos rolamentos.","Vibração acima da condição habitual.","Ventilação do motor obstruída.","Carcaça apresenta aquecimento elevado.","Caixa de ligação apresenta umidade ou contaminação."],
    summary:["Motor inspecionado e condição registrada.","Causa provável da falha identificada.","Anomalia elétrica ou mecânica requer manutenção.","Motor testado após a intervenção."],
    recommendation:["Revisar conexões e alimentação.","Programar manutenção dos rolamentos.","Limpar o sistema de ventilação.","Realizar medições elétricas complementares antes da liberação."],
    final_observation:["Motor testado conforme condição disponível.","Equipamento liberado após conferência.","Manutenção complementar permanece pendente."]
  },
  grounding:{
    service_request:["Inspecionar sistema de aterramento.","Verificar continuidade dos condutores de proteção.","Avaliar conexões e pontos de equipotencialização.","Executar medição do sistema de aterramento."],
    initial_condition:["Sistema de aterramento acessível para inspeção.","Ponto de inspeção identificado.","Conexões apresentam sinais de oxidação.","Documentação do sistema não disponível no local."],
    customer_request:["Verificar integridade das conexões.","Registrar condição dos condutores de proteção.","Executar medição quando tecnicamente aplicável.","Identificar pontos que exigem adequação."],
    occurrence:["Conexão de aterramento com oxidação.","Condutor de proteção com dano aparente.","Ponto de conexão sem identificação.","Fixação do condutor inadequada.","Caixa de inspeção com umidade ou contaminação.","Ligação equipotencial ausente no ponto observado."],
    summary:["Sistema de aterramento inspecionado.","Anomalia de conexão registrada.","Medição registrada conforme condição do ensaio.","Ponto requer adequação ou avaliação complementar."],
    recommendation:["Limpar e recompor conexão oxidada.","Substituir condutor ou terminal danificado.","Identificar os pontos do sistema.","Executar avaliação técnica complementar quando necessário."],
    final_observation:["Inspeção do aterramento concluída.","Resultados registrados conforme condição encontrada.","Adequações permanecem pendentes conforme apontamentos."]
  },
  lighting:{
    service_request:["Inspecionar sistema de iluminação.","Diagnosticar falha ou oscilação de luminárias.","Executar manutenção preventiva de iluminação.","Avaliar níveis de iluminância e comandos."],
    initial_condition:["Luminária sem acendimento.","Oscilação ou flicker perceptível.","Iluminação de emergência sem teste recente.","Comando ou sensor apresenta falha.","Luminária com aquecimento anormal."],
    customer_request:["Restabelecer iluminação do ambiente.","Substituir lâmpadas ou drivers defeituosos.","Verificar comandos, sensores e circuitos.","Registrar pontos para adequação do sistema."],
    occurrence:["Lâmpada queimada ou inoperante.","Driver ou reator com falha.","Conexão com mau contato.","Comando de iluminação defeituoso.","Sensor de presença sem resposta.","Iluminação de emergência sem autonomia.","Fixação ou suporte da luminária danificado.","Circuito de iluminação sem identificação."],
    summary:["Sistema de iluminação inspecionado.","Ponto de falha localizado.","Iluminação restabelecida após intervenção.","Adequação permanece pendente de material ou teste."],
    recommendation:["Substituir componente de iluminação defeituoso.","Revisar conexões e circuito de comando.","Executar teste de iluminação de emergência.","Identificar o circuito no quadro correspondente."],
    final_observation:["Iluminação testada após o atendimento.","Ambiente liberado com luminárias conferidas.","Serviço permanece pendente de adequação complementar."]
  },

  /* INDUSTRIAL */
  machine:{
    service_request:["Inspecionar condição geral da máquina.","Diagnosticar ruído, vibração ou aquecimento.","Executar inspeção preventiva do conjunto.","Registrar condições para parada de manutenção."],
    initial_condition:["Máquina em operação durante a inspeção.","Máquina parada e liberada para inspeção.","Ruído anormal relatado.","Vibração perceptível durante a operação.","Vazamento visível no conjunto."],
    customer_request:["Identificar pontos de desgaste.","Registrar vazamentos e folgas.","Verificar proteções, fixações e componentes aparentes.","Priorizar itens para manutenção programada."],
    occurrence:["Vazamento de óleo ou fluido.","Fixação com folga.","Proteção física danificada ou ausente.","Componente com desgaste aparente.","Ruído anormal localizado.","Vibração perceptível no conjunto.","Mangueira ou conexão com dano aparente.","Corrosão em componente ou base."],
    summary:["Máquina inspecionada e anomalias registradas.","Componente apresenta condição que requer manutenção.","Vazamento localizado.","Conjunto sem anomalia aparente no item inspecionado."],
    recommendation:["Programar manutenção corretiva do ponto registrado.","Revisar fixações e elementos de transmissão.","Corrigir vazamento e inspecionar novamente.","Monitorar ruído e vibração após a intervenção."],
    final_observation:["Inspeção concluída conforme escopo.","Itens registrados para planejamento da manutenção.","Máquina permanece pendente de intervenção programada."]
  },
  pipeline:{
    service_request:["Inspecionar condição aparente da tubulação.","Localizar vazamento ou perda de contenção.","Avaliar suportes, conexões e isolamento.","Registrar corrosão e pontos para manutenção."],
    initial_condition:["Tubulação em operação.","Linha isolada para inspeção.","Vazamento relatado pelo cliente.","Isolamento térmico presente.","Acesso parcial ao trecho inspecionado."],
    customer_request:["Localizar o ponto de vazamento.","Mapear corrosão aparente.","Verificar suportes e fixações.","Registrar condição de juntas, flanges e conexões."],
    occurrence:["Corrosão superficial na tubulação.","Vazamento aparente em conexão.","Flange apresenta indício de vazamento.","Suporte com corrosão ou dano.","Fixação do suporte inadequada.","Isolamento térmico danificado.","Revestimento protetivo deteriorado.","Trecho apresenta deformação aparente."],
    summary:["Trecho inspecionado e anomalias registradas.","Ponto de vazamento identificado visualmente.","Corrosão aparente requer avaliação complementar.","Suportes e conexões registrados conforme condição encontrada."],
    recommendation:["Programar reparo do ponto de vazamento.","Avaliar espessura residual quando aplicável.","Recuperar proteção anticorrosiva.","Revisar suporte ou fixação danificada."],
    final_observation:["Inspeção visual da linha concluída.","Pontos críticos registrados para manutenção.","Condição interna da tubulação não foi avaliada visualmente."]
  },
  structure:{
    service_request:["Inspecionar condição aparente da estrutura.","Mapear pontos de corrosão.","Verificar fixações, ligações e deformações.","Registrar danos para planejamento de manutenção."],
    initial_condition:["Estrutura em uso durante a inspeção.","Área liberada para inspeção.","Corrosão previamente relatada.","Acesso restrito a parte da estrutura."],
    customer_request:["Registrar corrosão e perda aparente de revestimento.","Verificar parafusos, soldas e fixações aparentes.","Identificar deformações visíveis.","Mapear pontos que exigem avaliação especializada."],
    occurrence:["Corrosão superficial.","Corrosão acentuada em região localizada.","Pintura ou revestimento deteriorado.","Parafuso ou fixação ausente.","Fixação apresenta folga aparente.","Solda apresenta descontinuidade visual.","Elemento apresenta deformação aparente.","Acúmulo de água ou contaminantes em região da estrutura."],
    summary:["Estrutura inspecionada visualmente.","Corrosão mapeada no trecho inspecionado.","Ligação apresenta anomalia aparente.","Ponto requer avaliação técnica complementar."],
    recommendation:["Recuperar sistema de proteção anticorrosiva.","Avaliar tecnicamente o elemento deformado.","Revisar ligação ou fixação registrada.","Monitorar a evolução do ponto identificado."],
    final_observation:["Levantamento visual concluído.","Anomalias registradas para planejamento de manutenção.","Recomenda-se avaliação especializada dos pontos indicados quando aplicável."]
  },
  tank:{
    service_request:["Inspecionar condição externa do tanque.","Verificar sinais de corrosão ou vazamento.","Avaliar suportes, bocais e conexões aparentes.","Registrar condições para manutenção programada."],
    initial_condition:["Tanque em operação.","Tanque fora de operação e liberado.","Vazamento ou umidade relatados.","Inspeção limitada às superfícies acessíveis."],
    customer_request:["Mapear corrosão externa.","Registrar pontos de vazamento aparente.","Verificar bocais, conexões e suportes.","Identificar deterioração do revestimento externo."],
    occurrence:["Corrosão superficial no costado.","Revestimento externo deteriorado.","Indício de vazamento em conexão.","Bocal apresenta corrosão aparente.","Suporte ou base com corrosão.","Umidade acumulada em região localizada.","Escada ou guarda-corpo apresenta anomalia aparente."],
    summary:["Tanque inspecionado externamente.","Ponto de corrosão registrado.","Indício de vazamento identificado visualmente.","Condição interna não avaliada neste levantamento."],
    recommendation:["Avaliar espessura residual quando aplicável.","Recuperar revestimento protetivo.","Corrigir vazamento e reinspecionar a região.","Programar avaliação especializada do ponto registrado."],
    final_observation:["Inspeção externa concluída.","Anomalias registradas para planejamento.","Avaliação interna permanece fora do escopo deste registro."]
  },

  /* DRONE */
  roof:{
    service_request:["Realizar inspeção visual da cobertura.","Localizar possíveis pontos de infiltração.","Mapear telhas danificadas ou deslocadas.","Registrar calhas, rufos e elementos de vedação."],
    initial_condition:["Infiltração relatada pelo cliente.","Cobertura inspecionada sem acesso físico direto.","Telhado apresenta sujidade ou material acumulado.","Área de voo liberada para o levantamento."],
    customer_request:["Identificar telhas quebradas ou deslocadas.","Verificar cumeeiras, rufos e arremates.","Registrar condição aparente de calhas.","Mapear regiões relacionadas ao ponto interno de infiltração."],
    occurrence:["Telha quebrada.","Telha trincada.","Telha deslocada.","Telha ausente.","Cumeeira apresenta falha aparente.","Rufo apresenta falha de vedação.","Calha apresenta obstrução aparente.","Calha apresenta deformação ou dano.","Vedação deteriorada.","Fixação aparente inadequada.","Vegetação ou material acumulado sobre a cobertura.","Ponto com indício de entrada de água."],
    summary:["Anomalia localizada na cobertura.","Telhas danificadas ou deslocadas foram registradas.","Ponto de vedação requer manutenção.","Não foi identificada anomalia visual evidente na região observada."],
    recommendation:["Recomenda-se substituir as telhas danificadas.","Recomenda-se reposicionar e fixar adequadamente as telhas deslocadas.","Sugere-se revisar e recompor a vedação do ponto indicado.","Recomenda-se limpar e desobstruir a calha.","Sugere-se avaliação presencial complementar antes da intervenção.","Recomenda-se verificar os elementos adjacentes durante o reparo."],
    final_observation:["Levantamento aéreo da cobertura concluído.","Pontos registrados para planejamento da manutenção.","Recomendações baseadas nas condições visuais observáveis nas imagens."]
  },
  facade:{
    service_request:["Realizar inspeção visual da fachada.","Mapear fissuras, trincas e desprendimentos.","Verificar revestimentos, juntas e elementos aparentes.","Registrar pontos relacionados a infiltração."],
    initial_condition:["Fachada acessível visualmente por drone.","Infiltração relatada no interior da edificação.","Desprendimento de revestimento previamente relatado.","Área externa liberada para o levantamento."],
    customer_request:["Mapear fissuras e trincas visíveis.","Identificar áreas com desprendimento aparente.","Verificar juntas e vedações externas.","Registrar manchas, umidade e alterações do revestimento."],
    occurrence:["Fissura no revestimento.","Trinca aparente.","Desplacamento ou desprendimento aparente.","Mancha de umidade.","Eflorescência aparente.","Falha de vedação em esquadria.","Junta com deterioração aparente.","Revestimento com perda de acabamento.","Elemento metálico apresenta corrosão.","Vegetação em região da fachada."],
    summary:["Anomalia visual registrada na fachada.","Fissuras ou trincas mapeadas no trecho observado.","Revestimento apresenta deterioração localizada.","Ponto requer avaliação presencial complementar."],
    recommendation:["Sugere-se avaliação técnica da fissura ou trinca antes do reparo.","Recomenda-se remover partes soltas com procedimento seguro e recompor o revestimento.","Sugere-se revisar a vedação da esquadria ou junta indicada.","Recomenda-se tratar a origem da umidade antes de recompor o acabamento.","Sugere-se monitorar a evolução do ponto registrado."],
    final_observation:["Levantamento aéreo da fachada concluído.","Anomalias visuais registradas para planejamento.","Recomenda-se confirmação presencial quando a definição da causa exigir ensaio ou acesso direto."]
  },
  tower:{
    service_request:["Realizar inspeção visual aérea da torre.","Mapear corrosão, fixações e elementos aparentes.","Verificar antenas, cabos e acessórios visíveis.","Registrar condições para manutenção em altura."],
    initial_condition:["Torre em operação durante o levantamento.","Área de voo liberada.","Acesso físico em altura não realizado.","Corrosão previamente relatada."],
    customer_request:["Mapear pontos de corrosão.","Verificar fixações e elementos aparentes.","Registrar cabos, suportes e acessórios com anomalias visuais.","Gerar imagens para planejamento da manutenção em altura."],
    occurrence:["Corrosão em elemento metálico.","Pintura ou proteção deteriorada.","Fixação apresenta anomalia visual.","Cabo ou guia apresenta condição irregular.","Suporte ou acessório apresenta deformação aparente.","Elemento apresenta desalinhamento aparente.","Vegetação ou material estranho presente na estrutura."],
    summary:["Torre inspecionada visualmente por meio aéreo.","Pontos de corrosão registrados.","Elemento aparente requer conferência presencial.","Imagens obtidas para planejamento da intervenção."],
    recommendation:["Recomenda-se inspeção presencial do ponto por equipe habilitada para trabalho em altura.","Sugere-se recuperar a proteção anticorrosiva após avaliação do elemento.","Recomenda-se conferir torque e fixação durante parada segura quando aplicável.","Sugere-se monitorar o ponto até a intervenção programada."],
    final_observation:["Levantamento aéreo da torre concluído.","Registro visual não substitui verificação física dos elementos críticos.","Pontos indicados encaminhados para avaliação complementar."]
  },
  solar:{
    service_request:["Realizar inspeção visual aérea da usina solar.","Mapear módulos com anomalias aparentes.","Verificar estruturas, cabos e organização dos arranjos.","Registrar sujeira, sombreamento e danos visíveis."],
    initial_condition:["Usina em operação durante o levantamento.","Área liberada para voo.","Módulos apresentam sujidade aparente.","Falha de geração relatada pelo cliente."],
    customer_request:["Identificar módulos quebrados ou danificados.","Mapear regiões com sujidade intensa.","Registrar vegetação ou sombreamento sobre os módulos.","Verificar condição visual das estruturas e cabos aparentes."],
    occurrence:["Módulo apresenta trinca ou dano aparente.","Módulo apresenta sujidade intensa.","Vegetação provoca sombreamento aparente.","Objeto ou detrito sobre o módulo.","Estrutura apresenta corrosão aparente.","Cabo ou conector apresenta condição visual irregular.","Módulo apresenta desalinhamento aparente.","Área apresenta acúmulo de água ou material."],
    summary:["Anomalia visual registrada no arranjo fotovoltaico.","Módulos com sujidade foram mapeados.","Ponto requer inspeção elétrica complementar.","Levantamento visual concluído conforme área acessível ao voo."],
    recommendation:["Recomenda-se limpeza dos módulos conforme procedimento adequado.","Sugere-se inspeção elétrica do módulo ou string indicada.","Recomenda-se remover vegetação responsável por sombreamento.","Sugere-se verificar fisicamente cabos, conectores e fixações no ponto registrado.","Recomenda-se termografia específica quando houver suspeita de anomalia térmica."],
    final_observation:["Levantamento aéreo da usina concluído.","Anomalias visuais registradas por posição observada.","Avaliação elétrica não faz parte do levantamento visual salvo quando contratada separadamente."]
  },

  /* LAVAÇÃO E ESTÉTICA AUTOMOTIVA */
  basic_wash:{
    service_request:["Executar lavação externa simples.","Realizar limpeza de carroceria, vidros e rodas.","Remover sujeira superficial externa."],
    initial_condition:["Veículo com poeira e sujeira superficial.","Veículo com barro localizado.","Rodas apresentam sujidade aparente.","Pintura apresenta avarias pré-existentes visíveis."],
    customer_request:["Realizar lavação externa.","Priorizar rodas e caixas de roda.","Remover sujeira localizada indicada pelo cliente."],
    occurrence:["Risco pré-existente na pintura.","Amassado pré-existente.","Mancha persistente na pintura.","Sujidade intensa em roda.","Resíduo aderido à carroceria."],
    summary:["Lavação externa concluída.","Carroceria e vidros limpos conforme o escopo.","Rodas higienizadas conforme o serviço contratado."],
    recommendation:["Evitar produtos abrasivos na pintura.","Avaliar descontaminação para resíduos aderidos.","Avaliar polimento para correção de marcas superficiais."],
    final_observation:["Veículo entregue após conferência visual.","Avarias pré-existentes permaneceram registradas."]
  },
  complete_wash:{
    service_request:["Executar lavação completa interna e externa.","Realizar limpeza externa, aspiração e acabamento interno.","Higienizar carroceria, rodas, vidros e interior."],
    initial_condition:["Exterior com sujidade acumulada.","Interior apresenta poeira e resíduos.","Tapetes apresentam sujidade.","Itens pessoais presentes no interior."],
    customer_request:["Realizar lavação interna e externa.","Priorizar interior e porta-malas.","Limpar rodas, caixas de roda e vidros.","Preservar e organizar itens pessoais encontrados."],
    occurrence:["Sujidade intensa no interior.","Mancha aparente no banco.","Pelos de animais no interior.","Odor interno perceptível.","Item pessoal encontrado.","Avaria pré-existente registrada."],
    summary:["Lavação completa concluída.","Interior aspirado e superfícies limpas.","Exterior higienizado conforme o escopo.","Itens pessoais preservados durante o atendimento."],
    recommendation:["Aguardar secagem de áreas internas úmidas.","Avaliar higienização técnica para manchas persistentes.","Retirar objetos pessoais antes do próximo atendimento."],
    final_observation:["Veículo entregue após conferência interna e externa.","Serviço concluído conforme contratado."]
  },
  technical_wash:{
    service_request:["Executar lavação técnica detalhada.","Realizar descontaminação e limpeza de áreas de difícil acesso.","Preparar a pintura para etapa de proteção ou polimento."],
    initial_condition:["Pintura apresenta contaminação aderida.","Emblemas e frestas apresentam acúmulo de resíduos.","Rodas apresentam contaminação intensa.","Pintura apresenta marcas e riscos pré-existentes."],
    customer_request:["Descontaminar a pintura.","Detalhar frestas, emblemas e acabamentos.","Executar limpeza técnica das rodas.","Preparar superfície para proteção posterior."],
    occurrence:["Contaminação ferrosa aparente.","Piche ou resíduo aderido.","Seiva ou contaminação orgânica.","Risco pré-existente evidenciado após a limpeza.","Marca de chuva ou mineralização.","Contaminação intensa em roda."],
    summary:["Lavação técnica concluída.","Contaminantes removidos conforme resposta da superfície.","Pintura preparada para a etapa seguinte.","Avarias pré-existentes evidenciadas após a limpeza foram registradas."],
    recommendation:["Aplicar proteção após a descontaminação.","Avaliar polimento para defeitos remanescentes.","Manter rotina de lavagem com produtos adequados."],
    final_observation:["Veículo conferido após a lavação técnica.","Condições remanescentes registradas antes da próxima etapa."]
  },
  interior_detailing:{
    service_request:["Executar higienização interna completa.","Higienizar bancos, carpetes e acabamentos.","Tratar manchas e odores no interior.","Realizar limpeza técnica da cabine."],
    initial_condition:["Bancos apresentam manchas.","Carpete apresenta sujidade intensa.","Pelos de animais presentes no interior.","Odor perceptível na cabine.","Teto apresenta marcas localizadas.","Itens pessoais presentes no veículo."],
    customer_request:["Priorizar bancos e carpetes.","Tratar odor indicado pelo cliente.","Higienizar teto e acabamentos.","Preservar comandos e componentes eletrônicos."],
    occurrence:["Mancha em banco.","Mancha em carpete.","Pelos de animais.","Odor localizado.","Teto apresenta marca pré-existente.","Acabamento apresenta desgaste pré-existente.","Item pessoal encontrado."],
    summary:["Interior higienizado conforme o escopo.","Bancos e carpetes tratados.","Odor reduzido após a higienização.","Acabamentos e comandos preservados."],
    recommendation:["Aguardar secagem completa antes do uso intenso.","Manter ventilação durante a secagem.","Evitar fechar o veículo por longo período enquanto houver umidade residual."],
    final_observation:["Interior liberado para secagem.","Cliente orientado sobre ventilação e tempo de secagem.","Condições remanescentes registradas."]
  },
  polishing:{
    service_request:["Executar polimento técnico da pintura.","Corrigir riscos leves e marcas superficiais.","Recuperar brilho e acabamento da pintura.","Realizar etapa de refino após correção."],
    initial_condition:["Pintura apresenta micro-riscos.","Hologramas aparentes sob iluminação.","Oxidação superficial reduz o brilho.","Riscos localizados exigem avaliação antes do polimento.","Pintura previamente descontaminada."],
    customer_request:["Reduzir micro-riscos e marcas de lavagem.","Remover hologramas aparentes.","Recuperar brilho da pintura.","Preservar espessura e acabamento do verniz."],
    occurrence:["Hologramas na pintura.","Micro-riscos generalizados.","Risco localizado.","Oxidação superficial.","Marca de chuva mineralizada.","Defeito profundo permanece após avaliação."],
    summary:["Brilho recuperado após o polimento.","Micro-riscos reduzidos conforme condição da pintura.","Hologramas corrigidos nas áreas tratadas.","Defeitos profundos remanescentes foram registrados."],
    recommendation:["Aplicar proteção após o polimento.","Evitar lavagem abrasiva para preservar o acabamento.","Manter rotina de manutenção compatível com a proteção aplicada."],
    final_observation:["Polimento concluído conforme o nível contratado.","Defeitos remanescentes registrados após a correção."]
  },
  paint_protection:{
    service_request:["Aplicar proteção na pintura.","Aplicar selante ou proteção sintética.","Aplicar proteção cerâmica conforme produto contratado.","Finalizar pintura após preparação da superfície."],
    initial_condition:["Pintura limpa e preparada para aplicação.","Superfície descontaminada antes da proteção.","Pintura apresenta defeitos pré-existentes não corrigidos.","Etapa de polimento concluída antes da aplicação."],
    customer_request:["Aplicar proteção conforme produto contratado.","Proteger pintura após polimento.","Orientar sobre cura e manutenção do produto."],
    occurrence:["Superfície preparada para aplicação.","Proteção aplicada uniformemente.","Área requer correção antes da aplicação.","Defeito pré-existente permanece visível sob a proteção."],
    summary:["Proteção aplicada conforme o produto selecionado.","Pintura finalizada após preparação.","Aplicação concluída nas áreas contratadas."],
    recommendation:["Respeitar o tempo de cura do produto.","Evitar lavagem durante o período de cura informado.","Utilizar produtos de manutenção compatíveis com a proteção.","Realizar manutenção periódica conforme o sistema aplicado."],
    final_observation:["Proteção aplicada e veículo liberado conforme orientação do produto.","Cliente orientado sobre cura e cuidados posteriores."]
  },

  /* CORTINAS E PERSIANAS */
  curtain_installation:{
    service_request:["Instalar cortina conforme o vão definido.","Fixar trilho ou varão e instalar a cortina.","Substituir instalação existente por novo conjunto."],
    initial_condition:["Cortina nova disponível para instalação.","Ponto de fixação livre para montagem.","Suporte existente será reaproveitado.","Instalação anterior apresenta marcas ou furos."],
    customer_request:["Centralizar e nivelar a cortina.","Ajustar altura e caimento.","Reaproveitar suporte quando tecnicamente adequado.","Testar abertura e fechamento após a instalação."],
    occurrence:["Ponto de fixação necessita reforço.","Suporte existente inadequado.","Desnível identificado no vão.","Tecido apresenta marca pré-existente.","Comprimento da cortina exige ajuste."],
    summary:["Cortina instalada e nivelada.","Abertura e fechamento testados.","Caimento conferido após a instalação."],
    recommendation:["Evitar esforço excessivo no acionamento.","Realizar limpeza conforme orientação do fabricante.","Reapertar fixações caso seja observada movimentação do suporte."],
    final_observation:["Instalação concluída e testada.","Cliente orientado sobre uso e conservação."]
  },
  blind_installation:{
    service_request:["Instalar persiana conforme o vão definido.","Fixar suportes e instalar o conjunto.","Substituir persiana existente por novo conjunto."],
    initial_condition:["Persiana nova disponível para instalação.","Vão liberado para montagem.","Suportes existentes serão avaliados para reaproveitamento.","Parede ou teto apresenta pontos de fixação anteriores."],
    customer_request:["Nivelar e centralizar a persiana.","Ajustar curso de abertura e fechamento.","Verificar alinhamento das lâminas.","Testar acionamento após a instalação."],
    occurrence:["Ponto de fixação necessita reforço.","Suporte incompatível com o conjunto.","Lâmina apresenta dano pré-existente.","Acionamento apresenta resistência.","Persiana necessita ajuste de nivelamento."],
    summary:["Persiana instalada e nivelada.","Acionamento testado em todo o curso.","Lâminas alinhadas conforme condição do conjunto."],
    recommendation:["Operar o acionamento sem esforço excessivo.","Manter lâminas alinhadas durante abertura e fechamento.","Realizar limpeza periódica sem forçar os componentes."],
    final_observation:["Instalação concluída e funcionamento testado.","Cliente orientado sobre acionamento correto."]
  },
  curtain_maintenance:{
    service_request:["Executar manutenção do sistema da cortina.","Corrigir travamento ou dificuldade de acionamento.","Substituir componente desgastado.","Regular trilho, rodízios ou suportes."],
    initial_condition:["Cortina apresenta dificuldade de movimentação.","Trilho apresenta travamento.","Suporte apresenta folga.","Tecido apresenta condição pré-existente registrada."],
    customer_request:["Restabelecer abertura e fechamento.","Corrigir fixação do conjunto.","Substituir componentes danificados.","Preservar tecido e acabamento existentes."],
    occurrence:["Trilho com travamento.","Rodízio ou deslizador danificado.","Suporte solto.","Fixação inadequada.","Tecido apresenta rasgo ou mancha pré-existente.","Componente necessita substituição."],
    summary:["Movimentação da cortina restabelecida.","Fixação revisada.","Componente substituído e testado.","Manutenção permanece pendente de peça."],
    recommendation:["Evitar esforço no acionamento.","Substituir componentes com desgaste recorrente.","Realizar limpeza periódica do trilho."],
    final_observation:["Manutenção concluída e sistema testado.","Serviço pendente de peça foi registrado."]
  },
  blind_maintenance:{
    service_request:["Executar manutenção da persiana.","Corrigir falha de subida, descida ou inclinação.","Substituir cordão, corrente ou componente danificado.","Regular alinhamento e acionamento."],
    initial_condition:["Persiana apresenta acionamento irregular.","Cordão ou corrente apresenta dano.","Lâminas estão desalinhadas.","Conjunto apresenta travamento durante o curso."],
    customer_request:["Restabelecer o acionamento.","Alinhar lâminas ou tecido.","Substituir componente danificado.","Regular curso e nivelamento."],
    occurrence:["Cordão rompido ou desgastado.","Corrente danificada.","Lâmina desalinhada ou danificada.","Mecanismo apresenta travamento.","Suporte apresenta folga.","Tecido apresenta dano pré-existente."],
    summary:["Acionamento restabelecido.","Persiana regulada e testada.","Componente substituído.","Manutenção permanece pendente de peça."],
    recommendation:["Evitar força excessiva no acionamento.","Substituir lâminas danificadas quando aplicável.","Programar revisão caso o travamento retorne."],
    final_observation:["Persiana testada após a manutenção.","Cliente orientado sobre acionamento correto."]
  },
  motorized_system:{
    service_request:["Instalar sistema motorizado.","Diagnosticar falha no acionamento motorizado.","Programar controle e limites de curso.","Regular abertura e fechamento automático."],
    initial_condition:["Motor sem resposta ao comando.","Sistema apresenta funcionamento intermitente.","Limites de abertura ou fechamento desregulados.","Controle sem comunicação com o motor.","Alimentação disponível no ponto."],
    customer_request:["Restabelecer o acionamento elétrico.","Programar controle remoto.","Regular limites de abertura e fechamento.","Verificar alimentação e conexões do motor."],
    occurrence:["Motor sem resposta.","Limite de abertura desregulado.","Limite de fechamento desregulado.","Controle sem comunicação.","Alimentação elétrica ausente ou irregular.","Conexão do motor apresenta anomalia.","Mecanismo oferece resistência ao motor."],
    summary:["Sistema motorizado programado e testado.","Limites regulados.","Comunicação do controle restabelecida.","Falha permanece pendente de componente."],
    recommendation:["Não forçar manualmente o conjunto motorizado.","Verificar alimentação antes de substituir o motor.","Reprogramar os limites após qualquer alteração mecânica.","Substituir componente defeituoso quando confirmado."],
    final_observation:["Sistema motorizado testado em todo o curso.","Cliente orientado sobre comando e operação."]
  },
  track_and_rod:{
    service_request:["Instalar trilho de cortina.","Instalar varão e suportes.","Substituir trilho ou varão existente.","Reforçar ou regular a fixação do conjunto."],
    initial_condition:["Trilho existente apresenta travamento.","Varão apresenta deformação.","Suporte apresenta folga.","Pontos de fixação anteriores estão disponíveis."],
    customer_request:["Instalar e nivelar o trilho ou varão.","Reforçar fixações existentes.","Substituir suporte danificado.","Corrigir alinhamento do conjunto."],
    occurrence:["Trilho com deformação.","Trilho apresenta travamento.","Varão apresenta empenamento.","Suporte solto ou danificado.","Fixação inadequada ao substrato.","Ponto de fixação necessita reposicionamento."],
    summary:["Trilho instalado e testado.","Varão instalado e nivelado.","Fixações reforçadas.","Movimentação do conjunto conferida."],
    recommendation:["Evitar carga superior à prevista para o conjunto.","Revisar fixações caso surja folga.","Manter trilho limpo para preservar o deslizamento."],
    final_observation:["Trilho/varão instalado e conferido.","Fixações e nivelamento verificados ao final do serviço."]
  },

  sofa_cleaning:{
    contracted_services:["Higienização completa","Limpeza de assentos","Limpeza de encosto","Limpeza de braços","Higienização de almofadas","Remoção de manchas","Neutralização de odores","Tratamento localizado","Limpeza superficial","Outros"],
    room_ambient:["Sala","Sala de estar","Escritório","Quarto","Recepção","Área comum","Outros"],
    service_request:["Higienização completa do sofá.","Tratamento localizado de manchas.","Tratamento de odor.","Higienização com impermeabilização posterior."],
    initial_condition:["Sujidade concentrada nos assentos e braços.","Manchas localizadas nas áreas de maior contato.","Odor perceptível no revestimento.","Pelos de animais entre assentos, encostos e módulos.","Sinais de umidade ou mofo no revestimento.","Costuras apresentam desgaste pré-existente.","Espuma apresenta deformação pré-existente.","Mecanismo retrátil/reclinável exige cuidado durante a limpeza."],
    customer_request:["Priorizar assentos e braços.","Tratar manchas indicadas pelo cliente.","Remover pelos acumulados entre os módulos.","Reduzir odor sem alterar a tonalidade.","Preservar mecanismos, costuras e acabamentos.","Avaliar possibilidade de impermeabilização após a secagem."],
    occurrence:["Mancha de bebida / alimento.","Mancha de gordura / oleosidade.","Mancha de urina.","Mancha de origem não identificada.","Odor localizado no revestimento.","Sinais de mofo / umidade.","Sujidade intensa no assento.","Sujidade acumulada no braço.","Pelos de animais entre módulos.","Costura com desgaste ou ruptura pré-existente.","Tecido com desgaste ou desbotamento pré-existente.","Espuma com deformação pré-existente.","Mecanismo com resistência ou folga pré-existente.","Mancha com remoção parcial."],
    summary:["Sofá higienizado em todas as áreas contratadas.","Assentos, encostos e braços higienizados conforme o escopo.","Manchas tratadas com resultado registrado por região.","Odor reduzido após o tratamento.","Revestimento preservado após a extração.","Mecanismos e acabamentos preservados durante o serviço."],
    recommendation:["Aguardar a secagem completa antes de utilizar o sofá.","Manter o ambiente ventilado durante a secagem.","Manter módulos retráteis/reclináveis abertos durante a secagem quando possível.","Não apoiar mantas ou almofadas enquanto houver umidade residual.","Evitar exposição direta ao sol durante a secagem.","Avaliar impermeabilização somente após a secagem completa."],
    final_observation:["Sofá liberado para secagem.","Cliente orientado sobre ventilação, tempo de secagem e uso.","Módulos e almofadas posicionados para favorecer a secagem.","Manchas ou odores remanescentes registrados no atendimento.","Danos pré-existentes permaneceram documentados após a higienização."]
  },
  mattress_cleaning:{
    service_request:["Higienização completa do colchão.","Tratamento de manchas no colchão.","Tratamento de odor.","Higienização das duas faces e laterais."],
    initial_condition:["Manchas localizadas na face superior.","Odor perceptível no colchão.","Sinais de umidade no revestimento.","Laterais com sujidade acumulada.","Tecido com alteração de tonalidade pré-existente."],
    customer_request:["Priorizar a face de uso.","Tratar a mancha indicada pelo cliente.","Higienizar faces e laterais.","Reduzir odor e preservar o revestimento."],
    occurrence:["Mancha de urina.","Mancha de sangue.","Mancha de suor / oleosidade corporal.","Mancha orgânica.","Mancha de bebida.","Mancha de origem não identificada.","Odor localizado.","Sinais de mofo / umidade.","Sujidade acumulada nas laterais.","Costura danificada ou com desgaste pré-existente.","Rasgo ou furo pré-existente.","Alteração de tonalidade pré-existente.","Mancha com remoção parcial."],
    summary:["Colchão higienizado nas faces contratadas.","Manchas tratadas com resultado registrado.","Odor reduzido após o tratamento.","Revestimento preservado após a extração."],
    recommendation:["Aguardar secagem completa antes de colocar roupa de cama.","Manter o colchão em ambiente ventilado.","Não utilizar o colchão enquanto houver umidade residual."],
    final_observation:["Colchão liberado para secagem.","Cliente orientado a não colocar roupa de cama antes da secagem completa.","Condições remanescentes registradas no atendimento."]
  },
  armchair_cleaning:{
    service_request:["Higienização completa da poltrona.","Tratamento de manchas localizadas.","Tratamento de odor.","Limpeza técnica com preservação do mecanismo."],
    initial_condition:["Sujidade concentrada no assento e braços.","Encosto com manchas localizadas.","Base com sinais de uso.","Mecanismo apresenta resistência pré-existente.","Tecido com desgaste em área de contato."],
    customer_request:["Priorizar assento e braços.","Tratar manchas do encosto.","Preservar o mecanismo reclinável/giratório.","Reduzir odor do revestimento."],
    occurrence:["Mancha no assento.","Sujidade no braço.","Desgaste no encosto.","Folga pré-existente no mecanismo.","Tecido com desbotamento localizado."],
    summary:["Poltrona higienizada conforme o escopo.","Revestimento preservado.","Mecanismo preservado durante a higienização.","Manchas tratadas com resultado registrado."],
    recommendation:["Aguardar secagem completa antes do uso.","Evitar movimentar o mecanismo enquanto o tecido estiver úmido.","Manter a poltrona em local ventilado durante a secagem."],
    final_observation:["Poltrona liberada para secagem.","Cliente orientado sobre secagem e mecanismo.","Danos pré-existentes mantidos no registro."]
  },
  chair_cleaning:{
    service_request:["Higienização do conjunto de cadeiras.","Higienização de assentos e encostos.","Tratamento de manchas por unidade.","Higienização de lote corporativo/comercial."],
    initial_condition:["Sujidade variável entre as cadeiras.","Assentos com manchas de uso.","Encostos com marcas localizadas.","Algumas unidades apresentam desgaste pré-existente.","Estruturas exigem cuidado durante a higienização."],
    customer_request:["Higienizar todas as unidades do lote.","Separar unidades com manchas persistentes.","Priorizar cadeiras de maior uso.","Preservar estrutura e acabamento."],
    occurrence:["Mancha em uma unidade do lote.","Assento com sujidade intensa.","Encosto com mancha localizada.","Estrutura com avaria pré-existente.","Diferença de tonalidade entre unidades."],
    summary:["Lote de cadeiras higienizado conforme quantidade registrada.","Unidades com resultado diferente foram registradas individualmente.","Assentos e encostos higienizados conforme o escopo."],
    recommendation:["Aguardar secagem completa antes de empilhar ou utilizar.","Manter espaçamento entre as cadeiras durante a secagem.","Separar unidades com umidade residual."],
    final_observation:["Quantidade atendida conferida ao final do serviço.","Cadeiras liberadas para secagem.","Unidades com manchas remanescentes foram identificadas."]
  },
  auto_upholstery:{
    service_request:["Higienização dos bancos do veículo.","Higienização interna completa.","Limpeza de bancos e carpete.","Tratamento de odor no interior.","Higienização do teto e acabamentos."],
    initial_condition:["Bancos com manchas aparentes.","Carpete com sujeira acumulada.","Pelos de animais no interior.","Odor perceptível na cabine.","Teto com marcas localizadas.","Itens pessoais presentes no veículo."],
    customer_request:["Priorizar bancos dianteiros.","Higienizar banco traseiro e carpete.","Tratar odor interno.","Preservar comandos, cintos e componentes elétricos.","Registrar itens pessoais encontrados."],
    occurrence:["Mancha em banco dianteiro.","Banco traseiro com sujidade intensa.","Carpete com mancha localizada.","Teto com marca pré-existente.","Cinto com sujidade.","Item pessoal encontrado no veículo."],
    summary:["Interior higienizado conforme o escopo contratado.","Bancos e carpetes higienizados.","Odor interno reduzido após o tratamento.","Componentes e acabamentos preservados."],
    recommendation:["Aguardar secagem completa antes de fechar o veículo por longos períodos.","Manter vidros parcialmente abertos em local seguro durante a secagem.","Evitar sentar nos bancos enquanto houver umidade residual."],
    final_observation:["Interior liberado para secagem.","Cliente orientado sobre ventilação e tempo de secagem.","Itens pessoais e avarias pré-existentes registrados."]
  },
  carpet_cleaning:{
    service_request:["Higienização de tapete solto.","Limpeza de carpete fixo.","Tratamento de manchas por área.","Tratamento de odor.","Limpeza de área de alto tráfego."],
    initial_condition:["Área de alto tráfego com sujidade intensa.","Manchas localizadas no centro da peça.","Bordas com escurecimento.","Franjas com sujidade acumulada.","Carpete apresenta umidade pré-existente.","Mobiliário limita o acesso a parte da área."],
    customer_request:["Priorizar áreas de alto tráfego.","Tratar manchas indicadas pelo cliente.","Higienizar bordas e franjas.","Executar limpeza sem remover mobiliário pesado."],
    occurrence:["Mancha em área localizada.","Borda com sujidade intensa.","Franja com alteração de tonalidade.","Área de alto tráfego com desgaste pré-existente.","Emenda do carpete exige cuidado.","Mancha com remoção parcial."],
    summary:["Área contratada higienizada.","Tapete higienizado incluindo bordas e franjas previstas.","Áreas de alto tráfego tratadas.","Manchas remanescentes registradas por região."],
    recommendation:["Evitar tráfego até a secagem completa.","Manter ventilação no ambiente.","Não reposicionar mobiliário sobre áreas ainda úmidas.","Aguardar secagem das franjas antes de movimentar a peça."],
    final_observation:["Tapete/carpete liberado para secagem.","Cliente orientado sobre tráfego e ventilação.","Áreas não acessíveis foram registradas no atendimento."]
  },
  small_repairs:{
    service_request:["Executar pequenos reparos no ambiente.","Corrigir fixação ou acabamento solto.","Realizar ajustes e manutenção pontual."],
    occurrence:["Fixação solta identificada.","Acabamento danificado.","Peça ajustada ou substituída.","Reparo pontual concluído."],
    recommendation:["Conferir novamente após o período de uso.","Evitar esforço no ponto reparado durante a cura."]
  },
  masonry:{
    service_request:["Executar reparo de alvenaria.","Corrigir trinca, reboco ou vão.","Construir ou ajustar parede e acabamento."],
    occurrence:["Reboco solto removido.","Trinca preparada para correção.","Alvenaria recomposta.","Regularização executada."],
    recommendation:["Aguardar a cura antes da pintura.","Investigar a origem caso a trinca reapareça."]
  },
  painting:{
    service_request:["Preparar e pintar o ambiente.","Corrigir imperfeições antes da pintura.","Executar retoque localizado."],
    occurrence:["Superfície lixada e preparada.","Massa aplicada para correção.","Demão de tinta aplicada.","Pintura concluída."],
    recommendation:["Aguardar a secagem completa.","Evitar limpeza úmida durante o período de cura."]
  },
  flooring:{
    service_request:["Assentar piso ou revestimento.","Substituir peça quebrada ou solta.","Refazer rejunte e acabamento."],
    occurrence:["Peça solta identificada.","Base preparada e regularizada.","Revestimento assentado.","Rejunte executado."],
    recommendation:["Não liberar tráfego antes da cura.","Evitar contato com água durante a secagem."]
  },
  minor_renovation:{
    service_request:["Executar pequena reforma no ambiente.","Readequar o espaço conforme solicitado.","Realizar serviços combinados de reparo e acabamento."],
    occurrence:["Etapa de demolição controlada concluída.","Infraestrutura ajustada.","Revestimento ou acabamento executado.","Etapa da reforma concluída."],
    recommendation:["Prosseguir para a próxima etapa após a cura.","Conferir medidas e acabamentos antes da entrega."]
  },
  general_maintenance:{
    service_request:["Realizar manutenção geral no imóvel.","Corrigir os itens indicados pelo cliente.","Executar vistoria e manutenção dos pontos necessários."],
    occurrence:["Item avaliado e condição registrada.","Ajuste executado.","Componente substituído.","Pendência de material identificada."],
    recommendation:["Programar manutenção preventiva.","Acompanhar o funcionamento após o reparo."]
  }
};

const UPHOLSTERY_PROTOCOL_SERVICES=new Set([
  'sofa_cleaning','mattress_cleaning','armchair_cleaning','chair_cleaning','auto_upholstery','carpet_cleaning'
]);

const VEHICLE_PERSONAL_ITEMS=[
  "Nenhum item pessoal deixado no veículo.",
  "Chave residencial deixada no veículo.",
  "Documentos pessoais deixados no veículo.",
  "Carteira deixada no veículo.",
  "Cartão bancário deixado no veículo.",
  "Óculos deixados no veículo.",
  "Celular deixado no veículo.",
  "Carregador ou cabo deixado no veículo.",
  "Controle de portão deixado no veículo.",
  "Dinheiro ou moedas deixados no veículo.",
  "Objetos pessoais deixados no porta-luvas.",
  "Objetos pessoais deixados no porta-malas."
];

function fieldDescriptor(field){
  const wrap=field.closest('.aurora-field') || field.closest('[data-group-field]') || field.parentElement;
  const labelNode=(field.labels && field.labels[0]) || (wrap && wrap.querySelector('label')) || (field.previousElementSibling && field.previousElementSibling.matches && field.previousElementSibling.matches('label') ? field.previousElementSibling : null);
  const explicit=(field.dataset && (field.dataset.fieldLabel || field.dataset.label || field.dataset.fieldName)) || '';
  return ((labelNode ? labelNode.textContent : '')+' '+explicit+' '+(field.name||'')+' '+(field.id||'')+' '+(field.placeholder||'')).toLowerCase();
}

function categoryFor(field){
  const text=fieldDescriptor(field);
  if(/categoria/.test(text) && /asset_type|categoria/.test(text)) return 'asset_category';
  if(/título do relatório|report_title/.test(text)) return 'report_title';
  if(/serviço contratado|contracted_services/.test(text)) return 'contracted_services';
  if(/\bambiente\b/.test(text) && !/endereço/.test(text)) return 'room_ambient';
  if(/itens deixados no veículo|itens pessoais \/ detalhes do interior|itens pessoais/.test(text)) return 'vehicle_personal_items';
  if(/observação comercial|commercial_notes|budget-notes/.test(text)) return 'commercial_notes';
  if(/observação final|final_observation|final-notes/.test(text)) return 'final_observation';
  if(/solicitação do cliente|pontos indicados pelo cliente|customer_request|request/.test(text)) return 'customer_request';
  if(/motivo|serviço contratado|serviço solicitado|reason/.test(text)) return 'service_request';
  if(/condição inicial|condições iniciais|condição geral|condições gerais|condição externa|condição conhecida|initial_condition/.test(text)) return 'initial_condition';
  if(/recomenda|orientação|ação recomendada/.test(text)) return 'recommendation';
  if(/resumo|conclusão|diagnóstico/.test(text)) return 'summary';
  if(/descrição|título do registro|item|componente|área do veículo|parte \/ região|escopo/.test(text)) return 'occurrence';
  if(/observação|notes/.test(text)) return 'occurrence';
  return null;
}

function resolveReportTitleSuggestions(activeProfile,serviceId){
  const resolver=global.AURORA_REPORT_TITLE_SUGGESTIONS && global.AURORA_REPORT_TITLE_SUGGESTIONS.resolveReportTitleSuggestions;
  if(typeof resolver==='function'){
    return unique(resolver(activeProfile,serviceId));
  }
  return [];
}

function resolveSuggestionItems(category,activeProfile,serviceId){
  if(category==='commercial_notes'){
    return unique([
      "Valores sujeitos à aprovação do cliente.",
      "Materiais não inclusos no valor informado.",
      "Materiais inclusos no valor informado.",
      "Prazo e condições de execução a combinar.",
      "Orçamento válido conforme condições apresentadas neste atendimento.",
      "Serviços adicionais serão orçados separadamente.",
      "Valor sujeito à revisão caso sejam identificados serviços não previstos."
    ]);
  }
  if(category==='vehicle_personal_items'){
    return unique(VEHICLE_PERSONAL_ITEMS);
  }
  if(category==='report_title'){
    return resolveReportTitleSuggestions(activeProfile,serviceId);
  }

  const extra=SERVICE_EXTRAS[serviceId]||{};
  const extraItems=unique(extra[category]||[]);
  const upholsteryServiceOnly=activeProfile==='upholstery_cleaning' && UPHOLSTERY_PROTOCOL_SERVICES.has(serviceId);

  if(upholsteryServiceOnly){
    return extraItems;
  }

  if(extraItems.length){
    return extraItems;
  }

  const lib=LIBRARIES[activeProfile]||LIBRARIES.industrial;
  return unique(lib[category]||[]);
}

function unique(items){
  return Array.from(new Set(items.map(v=>String(v||'').trim()).filter(Boolean)));
}

function applySuggestion(field,item){
  const current=String(field.value||'').trim();
  field.value=current ? current + ' ' + item : item;
  field.dispatchEvent(new Event('input',{bubbles:true}));
  field.dispatchEvent(new Event('change',{bubbles:true}));
}

function suggestionStorageKey(field,context){
  context=context||{};
  const account=(window.AuroraAccountStorage && window.AuroraAccountStorage.activeUserId()) || 'local';
  return ['aurora_user_suggestions_v1',account,context.profileId||profile(),context.serviceId||currentService(),context.category||categoryFor(field)].join(':');
}

function loadUserSuggestions(field,context){
  try{return unique(JSON.parse(localStorage.getItem(suggestionStorageKey(field,context))||'[]'));}catch(error){return [];}
}

function saveUserSuggestions(field,items,context){
  localStorage.setItem(suggestionStorageKey(field,context),JSON.stringify(unique(items)));
}

function selectedSuggestions(field,items){
  const value=String(field.value||'').toLocaleLowerCase('pt-BR');
  return new Set(items.filter(item=>value.includes(String(item).toLocaleLowerCase('pt-BR'))));
}

let activeSuggestionController=null;

function selectedValues(field,items,singleChoice){
  if(singleChoice){
    const current=String(field.value||'').trim();
    return current ? [current] : [];
  }
  return Array.from(selectedSuggestions(field,items));
}

function finishSuggestionRequest(panel,status,values){
  const request=panel && panel._auroraRequest;
  if(!request || request.done) return;
  request.done=true;
  panel._auroraRequest=null;
  request.resolve({status:status,values:Array.from(values||[])});
}

function closeSuggestionPicker(panel,toggle,status,values){
  if(!panel) return;
  const controller=panel._auroraController;
  if(status!=='applied'){
    const fallback=controller ? selectedValues(controller.field,controller.items,controller.singleChoice) : [];
    finishSuggestionRequest(panel,'cancelled',values||fallback);
  }else{
    finishSuggestionRequest(panel,'applied',values||[]);
  }
  panel.hidden=true;
  document.body.classList.remove('aurora-picker-open');
  if(toggle) toggle.setAttribute('aria-expanded','false');
  const host=panel._auroraHost || (toggle && toggle.closest('.aurora-field--picker'));
  if(host && panel.parentElement!==host) host.appendChild(panel);
  if(host) host.classList.remove('is-suggestions-open');
  if(activeSuggestionController===controller) activeSuggestionController=null;
}

function normalizeExplicitSuggestions(items){
  const seen=new Set();
  return (Array.isArray(items)?items:[]).map(item=>{
    if(item && typeof item==='object') return String(item.label||'').trim();
    return String(item||'').trim();
  }).filter(item=>{
    if(!item) return false;
    const key=item.toLocaleLowerCase('pt-BR');
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function openSuggestionController(controller){
  const {field,host,toggle,panel}=controller;
  if(activeSuggestionController && activeSuggestionController!==controller){
    closeSuggestionPicker(activeSuggestionController.panel,activeSuggestionController.toggle);
  }
  if(panel._auroraRequest && !panel._auroraRequest.done){
    finishSuggestionRequest(panel,'cancelled',selectedValues(field,controller.items,controller.singleChoice));
  }
  panel._auroraSelected=controller.singleChoice
    ? new Set(controller.items.filter(item=>String(item).trim().toLocaleLowerCase('pt-BR')===String(field.value||'').trim().toLocaleLowerCase('pt-BR')))
    : selectedSuggestions(field,controller.items);
  if(panel._auroraRender) panel._auroraRender();
  panel._auroraHost=host;
  panel._auroraToggle=toggle;
  document.body.appendChild(panel);
  panel.hidden=false;
  toggle.setAttribute('aria-expanded','true');
  host.classList.add('is-suggestions-open');
  document.body.classList.add('aurora-picker-open');
  activeSuggestionController=controller;
  return new Promise(resolve=>{panel._auroraRequest={resolve:resolve,done:false};});
}

function attachSuggestionPicker(field,options,strict){
  options=options||{};
  if(!field || !/^(INPUT|TEXTAREA)$/.test(String(field.tagName||'')) || field.type==='hidden'){
    if(strict) throw new TypeError('AuroraSuggestionsPicker requires a text input or textarea field.');
    return null;
  }
  /* Elétrica Tupy: a observação individual da foto é texto livre.
     Não instalar o seletor/seta de sugestões dentro do card fotográfico. */
  if(field.closest && field.closest('.aurora-evidence-photo')) return null;
  const explicit=Object.keys(options).length>0;
  /* Grounding independente: os campos com data-ag-picker já são ligados explicitamente
     ao AuroraSuggestionsPicker pela shape. Impedir o auto-installer legado de anexar
     primeiro as sugestões genéricas (ex.: ocorrência industrial). */
  if(!explicit && field.closest && field.closest('#aurora-grounding-shape')){
    const manualHost=field.parentElement;
    if(manualHost && manualHost.querySelector(':scope > [data-ag-picker]')) return null;
  }
  const category=String(options.category||categoryFor(field)||'').trim();
  if(!category){
    if(strict) throw new Error('AuroraSuggestionsPicker requires an explicit or inferable category.');
    return null;
  }
  const singleChoice=typeof options.multiple==='boolean' ? !options.multiple : (category==='asset_category' || category==='report_title');
  const host=field.closest('.aurora-field,[data-group-field]') || field.parentElement;
  if(!host){
    if(strict) throw new Error('AuroraSuggestionsPicker field requires a parent host.');
    return null;
  }

  const activeProfile=String(options.profileId||profile());
  host.querySelectorAll('.aurora-quick-texts').forEach(box=>box.classList.add('is-rc6-hidden'));
  const serviceId=String(options.serviceId||currentService());
  const context={profileId:activeProfile,serviceId:serviceId,category:category};
  const shapeItems=normalizeExplicitSuggestions(options.suggestions);
  const resolved=resolveSuggestionItems(category,activeProfile,serviceId);
  let items=explicit ? normalizeExplicitSuggestions([...shapeItems,...resolved]) : resolved;
  items=explicit
    ? normalizeExplicitSuggestions([...items,...loadUserSuggestions(field,context)])
    : unique([...items,...loadUserSuggestions(field,context)]);
  if(!items.length){
    if(strict) throw new Error('AuroraSuggestionsPicker found no suggestions for this context.');
    return null;
  }
  const pickerContext=[activeProfile,serviceId,category,singleChoice?'single':'multi',shapeItems.join('\u001f')].join('|');
  const alignToggle=()=>{
    const existing=host.querySelector(':scope > .aurora-suggestion-toggle');
    if(!existing)return;
    const fieldRect=field.getBoundingClientRect();
    const hostRect=host.getBoundingClientRect();
    existing.style.top=(fieldRect.top-hostRect.top+(fieldRect.height/2))+'px';
  };
  if(field.dataset.auroraPickerContext===pickerContext && field._auroraSuggestionsController){
    field._auroraSuggestionsController.items=items;
    alignToggle();
    return field._auroraSuggestionsController.publicController;
  }

  field.dataset.auroraPickerReady='1';
  field.dataset.auroraPickerContext=pickerContext;

  host.classList.add('aurora-field--picker');
  let toggle=host.querySelector(':scope > .aurora-suggestion-toggle');
  let panel=host.querySelector(':scope > .aurora-suggestion-panel');

  if(!toggle){
    toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='aurora-suggestion-toggle';
    toggle.setAttribute('aria-label','Abrir sugestões');
    toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML='<span class="aurora-chevron" aria-hidden="true"></span>';
    host.appendChild(toggle);
  }
  if(!panel){
    panel=document.createElement('div');
    panel.className='aurora-suggestion-panel';
    panel.hidden=true;
    host.appendChild(panel);
  }
  panel._auroraHost=host;
  panel._auroraToggle=toggle;

  alignToggle();
  requestAnimationFrame(alignToggle);
  field.classList.add('has-suggestion-picker');
  const signature=pickerContext+'|'+items.join('|');
  if(panel.dataset.signature!==signature){
    panel.dataset.signature=signature;
    panel.innerHTML='';
    const title=document.createElement('div');
    title.className='aurora-suggestion-panel__title';
    title.innerHTML=category==='report_title'
      ? '<strong>Selecione o título do relatório</strong><small>Toque para usar uma sugestão ou digite o seu.</small>'
      : (singleChoice
        ? '<strong>Selecione a categoria</strong><small>Escolha uma opção ou crie a sua.</small>'
        : '<strong>Selecione as sugestões</strong><small>Marque uma ou várias opções.</small>');
    const close=document.createElement('button');
    close.type='button'; close.className='aurora-suggestion-panel__close'; close.setAttribute('aria-label','Fechar sugestões'); close.textContent='×';
    title.appendChild(close); panel.appendChild(title);
    const list=document.createElement('div'); list.className='aurora-suggestion-panel__list'; panel.appendChild(list);
    const renderItems=()=>{
      const custom=new Set(loadUserSuggestions(field,context));
      const selected=panel._auroraSelected || (singleChoice
        ? new Set(items.filter(item=>String(item).trim().toLocaleLowerCase('pt-BR')===String(field.value||'').trim().toLocaleLowerCase('pt-BR')))
        : selectedSuggestions(field,items));
      panel._auroraSelected=selected;
      list.innerHTML='';
      items.forEach(item=>{
      const b=document.createElement('button');
      b.type='button'; b.className='aurora-suggestion-option';
      b.setAttribute('aria-pressed',String(selected.has(item)));
      b.innerHTML='<span class="aurora-suggestion-check" aria-hidden="true">✓</span><span></span>';
      b.children[1].textContent=item;
      if(custom.has(item)){
        const actions=document.createElement('span'); actions.className='aurora-suggestion-user-actions';
        const edit=document.createElement('button'); edit.type='button'; edit.textContent='Editar'; edit.dataset.editSuggestion='';
        const remove=document.createElement('button'); remove.type='button'; remove.textContent='Excluir'; remove.dataset.deleteSuggestion='';
        actions.append(edit,remove); b.appendChild(actions);
        edit.addEventListener('click',async(event)=>{event.stopPropagation(); const changed=await window.AuroraDialog.prompt('Altere o texto da sugestão personalizada.',item,{title:'Editar sugestão',confirmLabel:'Salvar',fieldLabel:'Sugestão'}); if(changed===null)return; const value=changed.trim(); if(!value)return; const user=loadUserSuggestions(field,context).map(v=>v===item?value:v); saveUserSuggestions(field,user,context); if(selected.delete(item))selected.add(value); items=items.map(v=>v===item?value:v); if(panel._auroraController)panel._auroraController.items=items; panel.dataset.signature=pickerContext+'|'+items.join('|'); renderItems();});
        remove.addEventListener('click',async(event)=>{event.stopPropagation(); if(!await window.AuroraDialog.confirm('A sugestão personalizada será removida.',{title:'Excluir sugestão?',confirmLabel:'Excluir',tone:'danger'}))return; saveUserSuggestions(field,loadUserSuggestions(field,context).filter(v=>v!==item),context); selected.delete(item); items=items.filter(v=>v!==item); if(panel._auroraController)panel._auroraController.items=items; panel.dataset.signature=pickerContext+'|'+items.join('|'); renderItems();});
      }
      b.addEventListener('pointerdown',(event)=>{if(event.pointerType==='mouse')event.preventDefault();});
      b.addEventListener('click',(event)=>{
        event.preventDefault();
        event.stopPropagation();
        if(singleChoice){selected.clear();selected.add(item);}else{selected.has(item)?selected.delete(item):selected.add(item);}
        renderItems();
      });
      list.appendChild(b);
      });
    };
    const add=document.createElement('div'); add.className='aurora-suggestion-add'; add.innerHTML='<input type="text" maxlength="220" placeholder="'+(category==='report_title'?'Crie um título personalizado':(singleChoice?'Crie uma categoria':'Escreva uma nova sugestão'))+'"><button type="button">Salvar</button>';
    panel.appendChild(add);
    const footer=document.createElement('div'); footer.className='aurora-suggestion-panel__footer'; footer.innerHTML='<button type="button" data-cancel-suggestions>Cancelar</button><button type="button" data-apply-suggestions>'+(category==='report_title'?'Usar título':(singleChoice?'Usar categoria':'Adicionar selecionadas'))+'</button>'; panel.appendChild(footer);
    close.onclick=()=>closeSuggestionPicker(panel,toggle);
    footer.querySelector('[data-cancel-suggestions]').onclick=()=>closeSuggestionPicker(panel,toggle);
    footer.querySelector('[data-apply-suggestions]').onclick=()=>{
      const selected=panel._auroraSelected||new Set();
      if(singleChoice){
        field.value=Array.from(selected)[0]||'';
        field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
        const values=Array.from(selected);
        closeSuggestionPicker(panel,toggle,'applied',values);return;
      }
      let value=String(field.value||'');
      items.filter(item=>!selected.has(item)).forEach(item=>{
        const escaped=item.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        value=value.replace(new RegExp('(?:\\s*[—;]\\s*)?'+escaped,'giu'),'').replace(/^\s*[—;]\s*|\s*[—;]\s*$/g,'').trim();
      });
      field.value=value;
      Array.from(selected).forEach(item=>{if(!String(field.value||'').toLocaleLowerCase('pt-BR').includes(item.toLocaleLowerCase('pt-BR')))applySuggestion(field,item);});
      field.value=String(field.value||'').replace(/\s*[—–]\s*/g,' ').replace(/\s{2,}/g,' ').trim();
      field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
      closeSuggestionPicker(panel,toggle,'applied',Array.from(selected));
    };
    add.querySelector('button').onclick=()=>{const input=add.querySelector('input');const value=input.value.trim();if(!value)return;saveUserSuggestions(field,[...loadUserSuggestions(field,context),value],context);items=unique([...items,value]);if(panel._auroraController)panel._auroraController.items=items;if(singleChoice)panel._auroraSelected.clear();panel._auroraSelected.add(value);panel.dataset.signature=pickerContext+'|'+items.join('|');input.value='';renderItems();};
    panel._auroraRender=renderItems;
    renderItems();
  }
  const controller={field:field,host:host,toggle:toggle,panel:panel,items:items,singleChoice:singleChoice,context:context};
  controller.open=()=>openSuggestionController(controller);
  controller.close=()=>closeSuggestionPicker(panel,toggle);
  controller.publicController=Object.freeze({open:controller.open,close:controller.close});
  panel._auroraController=controller;
  field._auroraSuggestionsController=controller;
  if(toggle.dataset.bound!=='1'){
    toggle.dataset.bound='1';
    toggle.addEventListener('pointerdown',(event)=>event.preventDefault());
    toggle.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      if(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)){
        document.activeElement.blur();
      }
      const current=field._auroraSuggestionsController;
      if(!current)return;
      if(current.panel.hidden) current.open(); else current.close();
    });
  }
  return controller.publicController;
}

function installSuggestionPicker(field){
  return attachSuggestionPicker(field,{},false);
}

global.AuroraSuggestionsPicker=Object.freeze({
  attach(field,options){return attachSuggestionPicker(field,options||{},true);},
  open(options){
    options=options||{};
    if(!options.category) return Promise.reject(new Error('AuroraSuggestionsPicker.open requires category.'));
    try{
      const control=attachSuggestionPicker(options.field,options,true);
      return control.open();
    }catch(error){return Promise.reject(error);}
  },
  close(){
    if(activeSuggestionController) activeSuggestionController.close();
  }
});

let footerState=null;
function syncUnifiedNavigation(){
  const dock=document.querySelector('.aurora-workflow-dock');
  const footer=document.querySelector('.aurora-footer-nav');
  if(!dock || !footer) return;
  const prev=dock.querySelector('[data-workflow-previous]');
  const next=dock.querySelector('[data-workflow-next]');
  const progress=dock.querySelector('[data-workflow-progress]');
  let home=document.querySelector('[data-footer-home]');
  let reports=document.querySelector('[data-footer-reports]');
  const visible=dock.classList.contains('is-visible');

  if(visible && prev && next && home && reports){
    if(!footerState){
      footerState={footer,homeNext:home.nextSibling,reportsNext:reports.nextSibling};
    }
    dock.classList.add('aurora-workflow-dock--unified');
    if(progress) progress.classList.add('aurora-workflow-progress--compact');
    /* Só move os nós quando a ordem realmente estiver diferente.
       Isso evita alimentar o MutationObserver em um ciclo contínuo. */
    if(home.parentNode!==dock || home.nextSibling!==reports){
      dock.insertBefore(home,next);
    }
    if(reports.parentNode!==dock || reports.nextSibling!==next){
      dock.insertBefore(reports,next);
    }
    footer.classList.add('is-workflow-hidden');
  }else if(!visible && footerState){
    const target=footerState.footer;
    home=document.querySelector('[data-footer-home]');
    reports=document.querySelector('[data-footer-reports]');
    if(home) target.appendChild(home);
    if(reports) target.appendChild(reports);
    target.classList.remove('is-workflow-hidden');
    dock && dock.classList.remove('aurora-workflow-dock--unified');
    footerState=null;
  }
}

function scan(){
  /* FIX5 — se uma reinicialização parcial deixou dois docks de workflow no DOM,
     preservar apenas o dock unificado/nativo e remover a cópia simples. */
  const workflowDocks=[...document.querySelectorAll('.aurora-workflow-dock')];
  if(workflowDocks.length>1){
    const keep=workflowDocks.find(item=>item.classList.contains('aurora-workflow-dock--unified') || item.querySelector('[data-footer-home],[data-footer-reports]')) || workflowDocks[workflowDocks.length-1];
    workflowDocks.forEach(item=>{if(item!==keep)item.remove();});
  }
  document.querySelectorAll('input[name="asset_type"]').forEach(field=>{if(field.value.trim().toLowerCase()==='outro')field.value='';});
  document.querySelectorAll('textarea,input[type="text"]').forEach(installSuggestionPicker);
  document.querySelectorAll('.aurora-form__header h2').forEach(h=>{
    if(h.textContent.trim()==='Ocorrência') h.textContent='Registro';
  });
  syncUnifiedNavigation();
}

function showCameraTip(input){
  if(input.dataset.rc6CameraBypass==='1'){ input.dataset.rc6CameraBypass=''; return false; }
  if(localStorage.getItem('aurora.cameraLandscapeTip')==='hidden') return false;
  const modal=document.createElement('div'); modal.className='aurora-camera-tip';
  modal.innerHTML='<section><b>📷 Dica para um relatório melhor</b><p>Sempre que possível, fotografe com o celular deitado. As imagens horizontais ficam maiores e melhor distribuídas no relatório.</p><div><button type="button" data-tip-ok>Entendi</button><button type="button" data-tip-hide>Não mostrar novamente</button></div></section>';
  document.body.appendChild(modal);
  const proceed=(hide)=>{ if(hide) localStorage.setItem('aurora.cameraLandscapeTip','hidden'); modal.remove(); input.dataset.rc6CameraBypass='1'; input.click(); };
  modal.querySelector('[data-tip-ok]').onclick=()=>proceed(false);
  modal.querySelector('[data-tip-hide]').onclick=()=>proceed(true);
  return true;
}

document.addEventListener('click',e=>{
  const input=e.target.closest && e.target.closest('input[type="file"][accept*="image"]');
  if(!input || input.hasAttribute('capture')) return;
  if(showCameraTip(input)){ e.preventDefault(); e.stopImmediatePropagation(); }
},true);

document.addEventListener('click',e=>{
  if(!e.target.closest('.aurora-field--picker') && !e.target.closest('.aurora-suggestion-panel')){
    document.querySelectorAll('.aurora-suggestion-panel:not([hidden])').forEach(panel=>{
      closeSuggestionPicker(panel,panel._auroraToggle);
    });
    document.body.classList.remove('aurora-picker-open');
  }
});

let scanFrame=0;
const observer=new MutationObserver((mutations)=>{
  /* A RC8 só precisa reexaminar a UI quando novos nós entram na tela.
     Mudanças de classe feitas pelo próprio patch não devem disparar novo scan. */
  if(!mutations.some(m=>m.type==='childList' && m.addedNodes.length)) return;
  if(scanFrame) return;
  scanFrame=requestAnimationFrame(()=>{
    scanFrame=0;
    scan();
  });
});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',scan);
setTimeout(scan,800);
})(window);
