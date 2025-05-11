/**
 * Exemplo de utilização da automação com múltiplos provedores
 * 
 * Este exemplo demonstra como utilizar o sistema de automação
 * para trabalhar com diferentes provedores de webmail simultaneamente.
 */

import { 
  createWebmailAutomation, 
  WebmailAccount, 
  WebmailAction, 
  ActionResult 
} from '../index';

/**
 * Classe para gerenciar automação em múltiplos provedores
 */
class MultiProviderAutomation {
  private accounts: WebmailAccount[] = [];
  private automations: Record<string, any> = {};
  
  /**
   * Adiciona uma conta para automação
   */
  public addAccount(account: WebmailAccount): void {
    this.accounts.push(account);
  }
  
  /**
   * Inicia automação para todas as contas adicionadas
   */
  public async initializeAllAccounts(options: { mockMode?: boolean } = {}): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const account of this.accounts) {
      console.log(`Iniciando automação para ${account.email} (${account.provider})...`);
      
      try {
        // Criar automação específica para o provedor
        const automation = createWebmailAutomation(account.provider, {
          isHeadless: true,
          mockMode: options.mockMode ?? false
        });
        
        // Inicializar
        const success = await automation.initialize();
        results[account.id] = success;
        
        if (success) {
          // Armazenar a instância para uso posterior
          this.automations[account.id] = automation;
          console.log(`✅ Automação inicializada com sucesso para ${account.email}`);
        } else {
          console.error(`❌ Falha ao inicializar automação para ${account.email}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao inicializar automação para ${account.email}:`, error);
        results[account.id] = false;
      }
    }
    
    return results;
  }
  
  /**
   * Executa login em todas as contas
   */
  public async loginAllAccounts(): Promise<Record<string, ActionResult>> {
    const results: Record<string, ActionResult> = {};
    
    for (const account of this.accounts) {
      const automation = this.automations[account.id];
      
      if (!automation) {
        results[account.id] = {
          action: 'login',
          success: false,
          timestamp: new Date(),
          error: 'Automação não inicializada'
        };
        continue;
      }
      
      console.log(`Iniciando login para ${account.email}...`);
      
      try {
        const result = await automation.login(account);
        results[account.id] = result;
        
        if (result.success) {
          console.log(`✅ Login bem-sucedido para ${account.email}`);
        } else {
          console.error(`❌ Falha no login para ${account.email}: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Erro durante login para ${account.email}:`, error);
        results[account.id] = {
          action: 'login',
          success: false,
          timestamp: new Date(),
          error: String(error)
        };
      }
    }
    
    return results;
  }
  
  /**
   * Executa uma ação em todas as contas
   */
  public async executeActionOnAllAccounts(
    action: WebmailAction, 
    params: Record<string, any> = {}
  ): Promise<Record<string, ActionResult>> {
    const results: Record<string, ActionResult> = {};
    
    for (const account of this.accounts) {
      const automation = this.automations[account.id];
      
      if (!automation) {
        results[account.id] = {
          action,
          success: false,
          timestamp: new Date(),
          error: 'Automação não inicializada'
        };
        continue;
      }
      
      console.log(`Executando ação '${action}' para ${account.email}...`);
      
      try {
        const result = await automation.executeAction(action, params);
        results[account.id] = result;
        
        if (result.success) {
          console.log(`✅ Ação '${action}' bem-sucedida para ${account.email}`);
        } else {
          console.error(`❌ Falha na ação '${action}' para ${account.email}: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Erro durante ação '${action}' para ${account.email}:`, error);
        results[account.id] = {
          action,
          success: false,
          timestamp: new Date(),
          error: String(error)
        };
      }
    }
    
    return results;
  }
  
  /**
   * Fecha todas as sessões de automação
   */
  public async closeAllSessions(): Promise<void> {
    for (const account of this.accounts) {
      const automation = this.automations[account.id];
      
      if (automation) {
        console.log(`Fechando sessão para ${account.email}...`);
        
        try {
          // Tentar fazer logout primeiro
          await automation.logout().catch(() => {});
          // Fechar o navegador
          await automation.close();
          console.log(`✅ Sessão fechada para ${account.email}`);
        } catch (error) {
          console.error(`❌ Erro ao fechar sessão para ${account.email}:`, error);
        }
      }
    }
    
    // Limpar as referências
    this.automations = {};
  }
}

/**
 * Executa um exemplo de automação multi-provedor
 */
async function runMultiProviderExample() {
  // Criar gerenciador de automação
  const manager = new MultiProviderAutomation();
  
  // Adicionar contas de diferentes provedores
  const accounts: WebmailAccount[] = [
    {
      id: 'gmail-example',
      provider: 'gmail',
      email: 'exemplo.gmail@gmail.com',
      usesOAuth: false
    },
    {
      id: 'outlook-example',
      provider: 'outlook',
      email: 'exemplo.outlook@outlook.com',
      usesOAuth: false
    },
    {
      id: 'yahoo-example',
      provider: 'yahoo',
      email: 'exemplo.yahoo@yahoo.com',
      usesOAuth: false
    }
  ];
  
  accounts.forEach(account => manager.addAccount(account));
  
  try {
    // Inicializar automação (modo de simulação para testes)
    await manager.initializeAllAccounts({ mockMode: true });
    
    // Fazer login em todas as contas
    await manager.loginAllAccounts();
    
    // Pesquisar em todas as contas
    await manager.executeActionOnAllAccounts('search', { query: 'importante' });
    
    // Ler o primeiro email em cada conta
    await manager.executeActionOnAllAccounts('read-email', { index: 0 });
    
    // Enviar um email de teste de cada conta
    await manager.executeActionOnAllAccounts('send-email', {
      to: 'destinatario@exemplo.com',
      subject: 'Teste de automação multi-provedor',
      body: 'Este é um email de teste enviado por automação multi-provedor.'
    });
    
    // Fechar todas as sessões
    await manager.closeAllSessions();
    
    console.log('✅ Exemplo de automação multi-provedor concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante exemplo de automação multi-provedor:', error);
    
    // Garantir que todas as sessões sejam fechadas mesmo em caso de erro
    await manager.closeAllSessions();
  }
}

// Para executar o exemplo:
// runMultiProviderExample().catch(console.error);

export { MultiProviderAutomation, runMultiProviderExample };