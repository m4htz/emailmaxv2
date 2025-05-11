/**
 * Exemplo de utilização da automação de webmail para aquecimento de conta
 * 
 * Este exemplo demonstra como o sistema de automação pode ser usado para
 * implementar um fluxo de aquecimento de contas de email, seguindo padrões
 * realistas de interação para melhorar a reputação da conta.
 */

import { 
  createWebmailAutomation, 
  WebmailAccount, 
  WebmailAction, 
  ActionResult 
} from '../index';

interface WarmupSession {
  account: WebmailAccount;
  targetActions: number;
  actionsPerformed: number;
  startTime: Date;
  endTime?: Date;
  results: ActionResult[];
}

/**
 * Executor de ações de aquecimento para uma conta de email
 */
class WebmailWarmupExecutor {
  private session: WarmupSession | null = null;
  private automation: any = null;
  
  /**
   * Inicia uma sessão de aquecimento para uma conta
   */
  async startWarmupSession(account: WebmailAccount, targetActions: number = 10): Promise<boolean> {
    console.log(`Iniciando sessão de aquecimento para ${account.email}...`);
    
    // Verificar se já existe uma sessão em andamento
    if (this.session) {
      console.warn('Uma sessão de aquecimento já está em andamento. Finalize-a antes de iniciar outra.');
      return false;
    }
    
    // Criar nova sessão
    this.session = {
      account,
      targetActions,
      actionsPerformed: 0,
      startTime: new Date(),
      results: []
    };
    
    try {
      // Criar automação adequada para o provedor
      this.automation = createWebmailAutomation(account.provider, {
        isHeadless: true, // Em produção, executar em segundo plano
        mockMode: true // Em desenvolvimento, usar modo de simulação
      });
      
      // Inicializar navegador
      const initialized = await this.automation.initialize();
      
      if (!initialized) {
        throw new Error('Falha ao inicializar automação');
      }
      
      // Fazer login
      const loginResult = await this.automation.login(account);
      this.session.results.push(loginResult);
      
      if (!loginResult.success) {
        throw new Error(`Falha no login: ${loginResult.error}`);
      }
      
      console.log(`Login bem-sucedido para ${account.email}`);
      return true;
      
    } catch (error) {
      console.error('Erro ao iniciar sessão de aquecimento:', error);
      
      // Limpar recursos em caso de erro
      if (this.automation) {
        await this.automation.close();
        this.automation = null;
      }
      
      this.session = null;
      return false;
    }
  }
  
  /**
   * Executa uma sequência de ações de aquecimento
   */
  async executeWarmupActions(): Promise<boolean> {
    if (!this.session || !this.automation) {
      console.error('Nenhuma sessão de aquecimento iniciada');
      return false;
    }
    
    try {
      const { targetActions } = this.session;
      
      // Calcular sequência de ações com distribuição realista
      const actions = this.generateActionSequence(targetActions);
      
      // Executar ações sequencialmente
      for (const action of actions) {
        console.log(`Executando ação: ${action.action}`);
        
        // Adicionar variação de tempo entre ações (comportamento humano)
        const waitTime = 2000 + Math.floor(Math.random() * 5000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Executar ação
        const result = await this.automation.executeAction(action.action, action.params);
        this.session.results.push(result);
        this.session.actionsPerformed++;
        
        if (!result.success) {
          console.warn(`Falha ao executar ação ${action.action}: ${result.error}`);
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('Erro durante execução de ações de aquecimento:', error);
      return false;
    }
  }
  
  /**
   * Finaliza a sessão de aquecimento
   */
  async finishWarmupSession(): Promise<WarmupSession> {
    if (!this.session || !this.automation) {
      throw new Error('Nenhuma sessão de aquecimento iniciada');
    }
    
    try {
      // Fazer logout
      const logoutResult = await this.automation.logout();
      this.session.results.push(logoutResult);
      
      if (!logoutResult.success) {
        console.warn(`Falha no logout: ${logoutResult.error}`);
      }
      
      // Fechar navegador
      await this.automation.close();
      
      // Finalizar sessão
      this.session.endTime = new Date();
      const sessionDuration = Math.round((this.session.endTime.getTime() - this.session.startTime.getTime()) / 1000);
      
      const successCount = this.session.results.filter(r => r.success).length;
      const successRate = Math.round((successCount / this.session.results.length) * 100);
      
      console.log(`Sessão de aquecimento finalizada para ${this.session.account.email}`);
      console.log(`Duração: ${sessionDuration} segundos`);
      console.log(`Ações realizadas: ${this.session.actionsPerformed}/${this.session.targetActions}`);
      console.log(`Taxa de sucesso: ${successRate}%`);
      
      const completedSession = { ...this.session };
      
      // Limpar recursos
      this.automation = null;
      this.session = null;
      
      return completedSession;
      
    } catch (error) {
      console.error('Erro ao finalizar sessão de aquecimento:', error);
      
      // Tentar limpar recursos mesmo em caso de erro
      if (this.automation) {
        try {
          await this.automation.close();
        } catch (closeError) {
          console.error('Erro ao fechar automação:', closeError);
        }
      }
      
      const incompleteSession = { ...this.session! };
      this.automation = null;
      this.session = null;
      
      return incompleteSession;
    }
  }
  
  /**
   * Gera uma sequência de ações de aquecimento com distribuição realista
   */
  private generateActionSequence(count: number): Array<{ action: WebmailAction; params: any }> {
    const actions: Array<{ action: WebmailAction; params: any }> = [];
    
    // Distribuição aproximada de ações comuns
    const actionDistribution = {
      'search': 0.25,         // 25% pesquisas
      'read-email': 0.35,     // 35% leitura de emails
      'mark-as-read': 0.15,   // 15% marcar como lido
      'mark-as-unread': 0.05, // 5% marcar como não lido
      'send-email': 0.2       // 20% envio de emails
    };
    
    // Gerar ações baseadas na distribuição
    for (let i = 0; i < count; i++) {
      const random = Math.random();
      let actionType: WebmailAction = 'read-email';
      let cumulativeProbability = 0;
      
      // Selecionar ação com base na distribuição de probabilidade
      for (const [action, probability] of Object.entries(actionDistribution)) {
        cumulativeProbability += probability;
        if (random < cumulativeProbability) {
          actionType = action as WebmailAction;
          break;
        }
      }
      
      // Preparar parâmetros para cada tipo de ação
      let params: any = {};
      
      switch (actionType) {
        case 'search':
          // Pesquisas comuns em caixas de entrada
          const searchQueries = [
            'important', 'unread', 'label:inbox', 'from:newsletter',
            'after:2023/01/01', 'has:attachment', 'is:unread'
          ];
          params = {
            query: searchQueries[Math.floor(Math.random() * searchQueries.length)]
          };
          break;
          
        case 'read-email':
          // Ler emails por índice (aleatório entre os primeiros 10)
          params = {
            index: Math.floor(Math.random() * 10)
          };
          break;
          
        case 'mark-as-read':
        case 'mark-as-unread':
          // Marcar emails por índice (aleatório entre os primeiros 15)
          params = {
            index: Math.floor(Math.random() * 15)
          };
          break;
          
        case 'send-email':
          // Email para destinatários de teste (podem ser contas da rede de aquecimento)
          const testRecipients = [
            'test1@example.com', 'test2@example.com', 'test3@example.com'
          ];
          const testSubjects = [
            'Teste de aquecimento', 'Verificação de entrega', 
            'Email de interação', 'Teste de warmup'
          ];
          const recipient = testRecipients[Math.floor(Math.random() * testRecipients.length)];
          const subject = testSubjects[Math.floor(Math.random() * testSubjects.length)];
          
          params = {
            to: recipient,
            subject: `${subject} - ${new Date().toLocaleDateString()}`,
            body: `Este é um email de teste para aquecimento de conta. Enviado em: ${new Date().toLocaleString()}`
          };
          break;
      }
      
      actions.push({ action: actionType, params });
    }
    
    return actions;
  }
}

/**
 * Exemplo de uso do executor de aquecimento
 */
async function runWarmupExample() {
  // Conta de exemplo para demonstração
  const account: WebmailAccount = {
    id: 'warmup-example-1',
    provider: 'gmail',
    email: 'exemplo@gmail.com',
    usesOAuth: false
  };
  
  const warmupExecutor = new WebmailWarmupExecutor();
  
  try {
    // Iniciar sessão
    const sessionStarted = await warmupExecutor.startWarmupSession(account, 5);
    
    if (!sessionStarted) {
      throw new Error('Falha ao iniciar sessão de aquecimento');
    }
    
    // Executar ações
    const actionsExecuted = await warmupExecutor.executeWarmupActions();
    
    if (!actionsExecuted) {
      console.warn('Ocorreram problemas durante a execução das ações');
    }
    
    // Finalizar sessão
    const session = await warmupExecutor.finishWarmupSession();
    
    // Análise dos resultados
    const successfulActions = session.results.filter(r => r.success).length;
    console.log(`Sessão concluída com ${successfulActions}/${session.results.length} ações bem-sucedidas`);
    
  } catch (error) {
    console.error('Erro durante exemplo de aquecimento:', error);
    
    // Tentar finalizar sessão em caso de erro
    try {
      await warmupExecutor.finishWarmupSession();
    } catch (finalizeError) {
      console.error('Erro ao finalizar sessão após falha:', finalizeError);
    }
  }
}

// Para executar o exemplo:
// runWarmupExample().catch(console.error);

export { WebmailWarmupExecutor, runWarmupExample };