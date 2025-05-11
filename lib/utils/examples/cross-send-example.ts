/**
 * Exemplo prático de uso do sistema de envio cruzado de emails
 * Demonstra a criação de uma rede de interação entre contas
 */

import { 
  EmailInteractionNetwork, 
  CrossSendConfig, 
  SendingStrategy,
  InteractionType,
  EmailTemplate
} from '../email-interaction-network';

import { 
  EmailTemplateGenerator, 
  EmailTemplateType, 
  FormalityLevel 
} from '../email-template-generator';

import { WebmailAccount } from '../webmail-automation/types';

/**
 * Função para executar o exemplo de envio cruzado
 */
export async function runCrossSendExample() {
  console.log('Iniciando exemplo de envio cruzado de emails...');
  
  // 1. Criar a rede de interação
  const network = new EmailInteractionNetwork({
    sendingStrategy: SendingStrategy.SPACED,
    timeBetweenSends: 30000, // 30 segundos entre envios (para demonstração)
    randomizeContent: true,
    verifyDelivery: true,
    rescueFromSpam: true
  });
  
  // 2. Criar o gerador de templates
  const templateGenerator = new EmailTemplateGenerator();
  
  // 3. Adicionar contas de exemplo à rede
  const accounts: WebmailAccount[] = [
    {
      id: 'account1',
      provider: 'gmail',
      email: 'teste1@exemplo.com',
      username: 'teste1',
      usesOAuth: false
    },
    {
      id: 'account2',
      provider: 'outlook',
      email: 'teste2@exemplo.com',
      username: 'teste2',
      usesOAuth: false
    },
    {
      id: 'account3',
      provider: 'gmail',
      email: 'teste3@exemplo.com',
      username: 'teste3',
      usesOAuth: false
    },
    {
      id: 'account4',
      provider: 'yahoo',
      email: 'teste4@exemplo.com',
      username: 'teste4',
      usesOAuth: false
    },
    {
      id: 'account5',
      provider: 'outlook',
      email: 'teste5@exemplo.com',
      username: 'teste5',
      usesOAuth: false
    }
  ];
  
  // Adicionar contas à rede (sem inicializar conexões para este exemplo)
  for (const account of accounts) {
    await network.addAccount(account, false);
    console.log(`Conta adicionada: ${account.email} (${account.provider})`);
  }
  
  // 4. Gerar templates de email
  
  // Template de apresentação
  const introTemplate = templateGenerator.generateTemplate('introduction_template', {
    type: EmailTemplateType.INTRODUCTION,
    language: 'pt-BR',
    style: {
      formalityLevel: FormalityLevel.NEUTRAL,
      useEmojis: false,
      punctuationVariation: true,
      typoFrequency: 0.1,
      wordVariety: 0.7,
      regionalisms: [],
      abbreviations: false
    },
    length: 'medium',
    includeGreeting: true,
    includeSignature: true
  });
  
  // Template de negócios
  const businessTemplate = templateGenerator.generateTemplate('business_template', {
    type: EmailTemplateType.PROFESSIONAL,
    language: 'pt-BR',
    style: {
      formalityLevel: FormalityLevel.FORMAL,
      useEmojis: false,
      punctuationVariation: false,
      typoFrequency: 0,
      wordVariety: 0.8,
      regionalisms: [],
      abbreviations: false
    },
    length: 'medium',
    includeGreeting: true,
    includeSignature: true
  });
  
  // Template de pergunta
  const questionTemplate = templateGenerator.generateTemplate('question_template', {
    type: EmailTemplateType.QUESTION,
    language: 'pt-BR',
    style: {
      formalityLevel: FormalityLevel.CASUAL,
      useEmojis: true,
      punctuationVariation: true,
      typoFrequency: 0.2,
      wordVariety: 0.6,
      regionalisms: [],
      abbreviations: true
    },
    length: 'short',
    includeGreeting: true,
    includeSignature: true
  });
  
  // Registrar templates na rede
  network.registerTemplate('introduction', introTemplate);
  network.registerTemplate('business', businessTemplate);
  network.registerTemplate('question', questionTemplate);
  
  console.log('Templates registrados:');
  console.log('- Template de introdução');
  console.log('- Template de negócios');
  console.log('- Template de perguntas');
  
  // 5. Configurar e executar envio cruzado (simulado)
  
  // Dividir contas em dois grupos para interação cruzada
  const senderGroup = ['account1', 'account3', 'account5'];
  const receiverGroup = ['account2', 'account4'];
  
  console.log('\nPlanejando envio cruzado:');
  console.log(`Grupo de remetentes: ${senderGroup.length} contas`);
  console.log(`Grupo de destinatários: ${receiverGroup.length} contas`);
  
  // Configuração para envio em modo de demonstração (simulado)
  const demoConfig: Partial<CrossSendConfig> = {
    sendingStrategy: SendingStrategy.SPACED,
    timeBetweenSends: 1000, // 1 segundo entre envios (para demo)
    randomizeSenders: true,
    randomizeReceivers: true,
    randomizeContent: true
  };
  
  // Para demonstração, substituir o método de envio real por uma simulação
  // @ts-ignore - Substituindo método privado para simulação
  network.sendWithSpacing = async (
    senders: string[], 
    receivers: string[],
    template: EmailTemplate,
    baseVariables: Record<string, string>,
    config: CrossSendConfig,
    result: any
  ): Promise<void> => {
    console.log(`\nSimulando envio com ${senders.length} remetentes e ${receivers.length} destinatários...`);
    
    // Criar pares de envio
    const sendPairs: Array<{senderId: string; receiverId: string}> = [];
    
    senders.forEach(senderId => {
      receivers.forEach(receiverId => {
        if (senderId !== receiverId) {
          sendPairs.push({ senderId, receiverId });
        }
      });
    });
    
    // Simular envios
    result.totalInteractions = sendPairs.length;
    
    for (const { senderId, receiverId } of sendPairs) {
      const sender = network['accounts'].get(senderId);
      const receiver = network['accounts'].get(receiverId);
      
      if (!sender || !receiver) {
        console.log(`❌ Par inválido: ${senderId} -> ${receiverId}`);
        result.failedSends++;
        continue;
      }
      
      // Simulando aplicação de variáveis ao template
      const variables = {
        ...baseVariables,
        senderName: sender.account.email.split('@')[0],
        receiverName: receiver.account.email.split('@')[0],
        senderEmail: sender.account.email,
        receiverEmail: receiver.account.email,
        industry: 'tecnologia',
        topic: 'inteligência artificial',
        product: 'EmailMaxV2',
        event: 'Lançamento do produto',
        date: new Date().toLocaleDateString('pt-BR')
      };
      
      // Simular envio
      console.log(`✉️ Enviando de ${sender.account.email} para ${receiver.account.email}`);
      
      // Simular variação de conteúdo
      const randomizedSubject = template.subject.replace(/{{(\w+)}}/g, (_, key) => variables[key] || `{{${key}}}`);
      console.log(`   Assunto: ${randomizedSubject}`);
      
      // Registrar envio bem-sucedido
      result.successfulSends++;
      
      // Pequena pausa entre envios simulados
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n✅ Simulação concluída. ${result.successfulSends}/${result.totalInteractions} envios bem-sucedidos.`);
  };
  
  // Executar envio cruzado (simulado)
  try {
    console.log('\nIniciando envio cruzado...');
    
    const result = await network.performCrossSend(
      senderGroup,
      receiverGroup,
      'introduction',
      {
        industry: 'tecnologia',
        topic: 'automação de email',
        product: 'EmailMaxV2',
        event: 'Webinar sobre automação',
        date: new Date().toLocaleDateString('pt-BR')
      },
      demoConfig
    );
    
    // Exibir resultados
    console.log('\nResultados do envio cruzado:');
    console.log(`✅ Total de interações: ${result.totalInteractions}`);
    console.log(`✅ Envios bem-sucedidos: ${result.successfulSends}`);
    console.log(`❌ Envios com falha: ${result.failedSends}`);
    console.log(`📊 Taxa de entrega: ${(result.deliveryRate * 100).toFixed(2)}%`);
    console.log(`⏱️ Duração total: ${result.totalDuration / 1000} segundos`);
    
    // Verificar estatísticas da rede
    const stats = network.getNetworkStatistics();
    
    console.log('\nEstatísticas da rede:');
    console.log(`📊 Total de contas: ${stats.totalAccounts}`);
    console.log(`📊 Total de interações: ${stats.totalInteractions}`);
    console.log(`📊 Taxa de entrega: ${(stats.deliveryRate * 100).toFixed(2)}%`);
    
    // Exibir principais remetentes
    console.log('\nPrincipais remetentes:');
    stats.topSenders.forEach((sender, index) => {
      const account = network['accounts'].get(sender.accountId);
      if (account) {
        console.log(`${index + 1}. ${account.account.email}: ${sender.successCount} envios`);
      }
    });
    
    console.log('\nExemplo concluído com sucesso!');
  } catch (error) {
    console.error('Erro durante o envio cruzado:', error);
  }
}

// Executar o exemplo se este arquivo for chamado diretamente
if (require.main === module) {
  runCrossSendExample().catch(console.error);
}