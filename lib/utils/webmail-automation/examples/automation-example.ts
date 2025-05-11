/**
 * Exemplo de implementação do sistema de automação de webmail
 * Demonstra a integração dos diferentes componentes
 */

import {
  WebmailAccount,
  WebmailAction,
  ActionResult
} from '../types';
import { WebmailController } from '../webmail-controller';
import { SessionManager } from '../session-manager';

/**
 * Função principal do exemplo
 */
async function runAutomationExample() {
  console.log('Iniciando exemplo de automação de webmail...');

  // Configurar gerenciador de sessões
  const sessionManager = new SessionManager({
    sessionDir: './.webmail-sessions', // Diretório para armazenar sessões
    encryptSessions: true, // Ativar criptografia
    sessionExpiryDays: 7 // Sessões expiram após 7 dias
  });

  // Criar uma conta de exemplo (em produção, seria obtida do banco de dados)
  const account: WebmailAccount = {
    id: 'example-account',
    provider: 'gmail', // Pode ser 'gmail', 'outlook' ou 'yahoo'
    email: 'seu.email@gmail.com', // Substituir com um email real para teste
    usesOAuth: false, // Definir como true para usar OAuth
    // Dados de comportamento preferidos (opcional)
    behaviorProfile: {
      typingSpeed: { min: 180, max: 250 },
      readingSpeed: { min: 30, max: 60 },
      cursorMovement: { maxDeviation: 50, randomAcceleration: true },
      interactionDelays: {
        short: { min: 300, max: 800 },
        medium: { min: 1000, max: 3000 },
        long: { min: 3000, max: 10000 }
      }
    }
  };

  // Inicializar controlador
  const controller = new WebmailController({
    isHeadless: false, // Definir como true para ocultar o navegador
    mockMode: true, // Usar modo de simulação para teste (sem navegador real)
    sessionManager
  });

  try {
    // Inicializar navegador e componentes
    console.log(`Inicializando controlador para ${account.email}...`);
    const initialized = await controller.initialize(account);
    
    if (!initialized) {
      throw new Error('Falha ao inicializar controlador');
    }
    
    // Fazer login
    console.log(`Fazendo login em ${account.provider}...`);
    const loginResult = await controller.login();
    
    if (!loginResult.success) {
      console.error('Falha no login:', loginResult.error);
      throw new Error('Falha no login');
    }
    
    console.log('Login bem-sucedido! Aguardando...');
    await sleep(2000);
    
    // Navegar para a caixa de entrada
    console.log('Navegando para a caixa de entrada...');
    await controller.executeAction('navigate', { folder: 'inbox' });
    await sleep(2000);

    // Realizar uma pesquisa
    console.log('Realizando pesquisa por "importante"...');
    const searchResult = await controller.executeAction('search', { query: 'importante' });
    console.log(`Pesquisa encontrou ${searchResult.details?.resultCount || 0} resultados`);
    await sleep(2000);
    
    // Criar uma nova pasta
    console.log('Criando pasta "Teste Automação"...');
    await controller.executeAction('create-folder', { name: 'Teste Automação' });
    await sleep(2000);
    
    // Ler primeiro email (se disponível)
    console.log('Tentando ler o primeiro email...');
    const readResult = await controller.executeAction('read-email', { index: 0 });
    
    if (readResult.success) {
      console.log('Email lido:', readResult.details);
    } else {
      console.log('Nenhum email disponível ou erro ao ler');
    }
    await sleep(2000);
    
    // Navegar para a pasta de rascunhos
    console.log('Navegando para a pasta de rascunhos...');
    await controller.executeAction('navigate', { folder: 'drafts' });
    await sleep(2000);
    
    // Compor email de teste
    console.log('Compondo novo email...');
    const composeResult = await controller.executeAction('send-email', {
      to: 'destinatario@exemplo.com',
      subject: 'Teste de automação',
      body: 'Este é um email de teste enviado pelo sistema de automação.'
    });
    
    if (composeResult.success) {
      console.log('Email enviado com sucesso!');
    } else {
      console.log('Erro ao enviar email:', composeResult.error);
    }
    await sleep(2000);
    
    // Logout 
    console.log('Fazendo logout...');
    await controller.logout();
    await sleep(1000);
    
    console.log('Exemplo concluído com sucesso!');
  } catch (error) {
    console.error('Erro durante a execução do exemplo:', error);
  } finally {
    // Sempre fechar o navegador ao final
    await controller.close();
    console.log('Navegador fechado.');
  }
}

/**
 * Função auxiliar para aguardar um tempo específico
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Executar o exemplo se este arquivo for executado diretamente
if (require.main === module) {
  runAutomationExample().catch(console.error);
}

export { runAutomationExample };