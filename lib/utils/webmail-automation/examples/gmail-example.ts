/**
 * Exemplo de uso da automação de webmail para Gmail
 * Este exemplo demonstra como utilizar o sistema de automação para realizar tarefas comuns
 * 
 * IMPORTANTE: Este arquivo é apenas um exemplo e não deve ser usado em produção sem
 * implementar gestão segura de credenciais.
 */

import { GmailAutomation, WebmailAccount } from '../index';

async function runGmailAutomationExample() {
  console.log('Iniciando exemplo de automação do Gmail...');
  
  // Configuração da conta (em produção, obter de forma segura do banco de dados)
  // NUNCA armazenar senhas diretamente no código
  const gmailAccount: WebmailAccount = {
    id: 'example-account-1',
    provider: 'gmail',
    email: 'seu_email@gmail.com', // Substituir por um email real para teste
    usesOAuth: false
  };
  
  // Criar instância de automação com modo de demonstração
  // Em produção, use isHeadless: true para execução em segundo plano
  const gmailAutomation = new GmailAutomation({
    isHeadless: false, 
    mockMode: true // Usar true para simulação sem navegador real
  });
  
  try {
    // 1. Inicializar o navegador
    console.log('Inicializando navegador...');
    const initialized = await gmailAutomation.initialize();
    
    if (!initialized) {
      throw new Error('Falha ao inicializar o navegador');
    }
    
    console.log('Navegador inicializado com sucesso.');
    
    // 2. Fazer login
    console.log('Realizando login...');
    const loginResult = await gmailAutomation.login(gmailAccount);
    
    if (!loginResult.success) {
      throw new Error(`Falha no login: ${loginResult.error}`);
    }
    
    console.log('Login realizado com sucesso.');
    
    // 3. Realizar algumas ações de exemplo
    
    // 3.1 Pesquisar emails
    console.log('Pesquisando emails...');
    const searchResult = await gmailAutomation.executeAction('search', {
      query: 'importante'
    });
    
    if (searchResult.success) {
      console.log(`Pesquisa concluída. Encontrados ${searchResult.details?.resultCount} resultados.`);
    } else {
      console.warn(`Falha na pesquisa: ${searchResult.error}`);
    }
    
    // 3.2 Ler o primeiro email dos resultados
    if (searchResult.success && searchResult.details?.resultCount > 0) {
      console.log('Lendo o primeiro email...');
      const readResult = await gmailAutomation.executeAction('read-email', {
        index: 0
      });
      
      if (readResult.success) {
        console.log(`Email lido: ${readResult.details?.subject}`);
        console.log(`Prévia: ${readResult.details?.bodyPreview}`);
      } else {
        console.warn(`Falha ao ler email: ${readResult.error}`);
      }
    }
    
    // 3.3 Enviar um email de teste
    console.log('Enviando email de teste...');
    const sendResult = await gmailAutomation.executeAction('send-email', {
      to: 'destinatario@example.com',
      subject: 'Teste de automação',
      body: `Este é um email de teste enviado via automação em ${new Date().toLocaleString()}`
    });
    
    if (sendResult.success) {
      console.log('Email enviado com sucesso.');
    } else {
      console.warn(`Falha ao enviar email: ${sendResult.error}`);
    }
    
    // 3.4 Marcar um email como lido
    console.log('Marcando email como lido...');
    const markResult = await gmailAutomation.executeAction('mark-as-read', {
      index: 0
    });
    
    if (markResult.success) {
      console.log('Email marcado como lido.');
    } else {
      console.warn(`Falha ao marcar email como lido: ${markResult.error}`);
    }
    
    // 4. Fazer logout
    console.log('Realizando logout...');
    const logoutResult = await gmailAutomation.logout();
    
    if (logoutResult.success) {
      console.log('Logout realizado com sucesso.');
    } else {
      console.warn(`Falha no logout: ${logoutResult.error}`);
    }
    
    // 5. Fechar o navegador
    console.log('Fechando navegador...');
    await gmailAutomation.close();
    console.log('Navegador fechado.');
    
    console.log('Exemplo concluído com sucesso!');
    
  } catch (error) {
    console.error('Erro durante a execução do exemplo:', error);
    
    // Garantir que o navegador seja fechado em caso de erro
    try {
      await gmailAutomation.close();
      console.log('Navegador fechado após erro.');
    } catch (closeError) {
      console.error('Erro ao fechar o navegador:', closeError);
    }
  }
}

// Para executar o exemplo:
// runGmailAutomationExample().catch(console.error);

export default runGmailAutomationExample;