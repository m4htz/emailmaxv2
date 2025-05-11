/**
 * Sistema para interações entre contas de email
 * Implementa envio cruzado de emails entre contas na rede
 */

import { SmtpConnection } from './smtp-connection';
import { ImapConnection } from './imap-connection';
import { ImapReader } from './imap-reader';
import { WebmailProvider, WebmailAccount } from './webmail-automation/types';

/**
 * Tipos de interação entre emails
 */
export enum InteractionType {
  INITIAL_CONTACT = 'initial_contact',  // Primeiro contato
  REPLY = 'reply',                      // Resposta a um email
  FORWARD = 'forward',                  // Encaminhamento
  FOLLOW_UP = 'follow_up',              // Sequência da conversa
  BULK_MESSAGE = 'bulk_message',        // Mensagem em massa (para várias contas)
}

/**
 * Status da interação
 */
export enum InteractionStatus {
  PENDING = 'pending',           // Aguardando execução
  SENT = 'sent',                 // Email enviado
  DELIVERED = 'delivered',       // Email confirmado como entregue
  READ = 'read',                 // Email foi lido pelo destinatário
  REPLIED = 'replied',           // Email recebeu resposta
  RESCUED = 'rescued',           // Email foi resgatado da pasta de spam
  FAILED = 'failed',             // Falha na interação
}

/**
 * Estratégia de envio para múltiplas contas
 */
export enum SendingStrategy {
  SEQUENTIAL = 'sequential',    // Enviar um após o outro
  BATCHED = 'batched',          // Enviar em lotes
  PARALLEL = 'parallel',        // Enviar todos em paralelo
  SPACED = 'spaced',            // Espaçar envios por tempo
  RANDOM = 'random',            // Ordem aleatória
}

/**
 * Interface para detalhes da interação
 */
export interface EmailInteraction {
  id: string;
  sourceAccountId: string;
  targetAccountId: string;
  type: InteractionType;
  status: InteractionStatus;
  subject?: string;
  content?: string;
  messageId?: string;
  replyToMessageId?: string;
  threadId?: string;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  repliedAt?: Date;
  failedAt?: Date;
  failReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Interface para configuração de envio cruzado de emails
 */
export interface CrossSendConfig {
  sendingStrategy: SendingStrategy;
  batchSize?: number;           // Tamanho do lote (para estratégia em lotes)
  timeBetweenSends?: number;    // Tempo em ms entre envios (para estratégia espaçada)
  maxConcurrentSends?: number;  // Máximo de envios simultâneos (para estratégia paralela)
  randomizeSenders?: boolean;   // Randomizar ordem dos remetentes
  randomizeReceivers?: boolean; // Randomizar ordem dos destinatários
  randomizeContent?: boolean;   // Randomizar conteúdo dos emails
  retryCount?: number;          // Número de tentativas em caso de falha
  retryDelay?: number;          // Tempo em ms entre tentativas
  verifyDelivery?: boolean;     // Verificar se o email foi entregue
  rescueFromSpam?: boolean;     // Resgatar de spam automaticamente
  generateStatistics?: boolean; // Gerar estatísticas da campanha
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Interface para resultado de envio cruzado
 */
export interface CrossSendResult {
  totalInteractions: number;
  successfulSends: number;
  failedSends: number;
  deliveryRate: number;
  openRate?: number;
  replyRate?: number;
  rescueRate?: number;
  interactions: EmailInteraction[];
  errors: Array<{
    accountId: string;
    error: string;
    timestamp: Date;
  }>;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
}

/**
 * Interface para o conteúdo de um template de email
 */
export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
  variables?: string[];  // Variáveis para substituição
}

/**
 * Classe para gerenciar interações entre contas de email na rede
 */
export class EmailInteractionNetwork {
  private accounts: Map<string, {
    account: WebmailAccount; 
    smtp?: SmtpConnection;
    imap?: ImapConnection;
  }> = new Map();
  
  private interactions: Map<string, EmailInteraction> = new Map();
  private emailTemplates: Map<string, EmailTemplate> = new Map();
  private defaultConfig: CrossSendConfig;
  
  constructor(config: Partial<CrossSendConfig> = {}) {
    // Configuração padrão
    this.defaultConfig = {
      sendingStrategy: SendingStrategy.SEQUENTIAL,
      batchSize: 5,
      timeBetweenSends: 60000, // 1 minuto
      maxConcurrentSends: 3,
      randomizeSenders: false,
      randomizeReceivers: false,
      randomizeContent: true,
      retryCount: 3,
      retryDelay: 300000, // 5 minutos
      verifyDelivery: true,
      rescueFromSpam: true,
      generateStatistics: true,
      logLevel: 'info',
      ...config
    };
  }
  
  /**
   * Adiciona uma conta ao sistema
   */
  public async addAccount(
    account: WebmailAccount,
    initializeConnections = true
  ): Promise<boolean> {
    try {
      // Verificar se a conta já existe
      if (this.accounts.has(account.id)) {
        console.warn(`Conta ${account.id} já está registrada na rede`);
        return true;
      }
      
      // Adicionar a conta ao mapa
      this.accounts.set(account.id, { account });
      
      // Inicializar conexões SMTP e IMAP, se solicitado
      if (initializeConnections) {
        const smtpConnection = new SmtpConnection({
          email: account.email,
          username: account.username || account.email,
          oauthEnabled: account.usesOAuth,
          // Outras configurações necessárias
        });
        
        const imapConnection = new ImapConnection({
          email: account.email,
          username: account.username || account.email,
          oauthEnabled: account.usesOAuth,
          // Outras configurações necessárias
        });
        
        this.accounts.set(account.id, { 
          account, 
          smtp: smtpConnection,
          imap: imapConnection
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Erro ao adicionar conta ${account.id}:`, error);
      return false;
    }
  }
  
  /**
   * Remove uma conta do sistema
   */
  public async removeAccount(accountId: string): Promise<boolean> {
    try {
      const account = this.accounts.get(accountId);
      
      if (!account) {
        console.warn(`Conta ${accountId} não encontrada na rede`);
        return false;
      }
      
      // Fechar conexões SMTP e IMAP se existirem
      if (account.smtp) {
        await account.smtp.close();
      }
      
      if (account.imap) {
        await account.imap.close();
      }
      
      // Remover do mapa
      this.accounts.delete(accountId);
      
      return true;
    } catch (error) {
      console.error(`Erro ao remover conta ${accountId}:`, error);
      return false;
    }
  }
  
  /**
   * Inicializa conexões para uma conta
   */
  public async initializeConnections(accountId: string): Promise<boolean> {
    try {
      const accountEntry = this.accounts.get(accountId);
      
      if (!accountEntry) {
        console.error(`Conta ${accountId} não encontrada na rede`);
        return false;
      }
      
      const { account } = accountEntry;
      
      // Criar conexão SMTP
      const smtpConnection = new SmtpConnection({
        email: account.email,
        username: account.username || account.email,
        oauthEnabled: account.usesOAuth,
        // Outras configurações necessárias
      });
      
      // Criar conexão IMAP
      const imapConnection = new ImapConnection({
        email: account.email,
        username: account.username || account.email,
        oauthEnabled: account.usesOAuth,
        // Outras configurações necessárias
      });
      
      // Atualizar o registro da conta
      this.accounts.set(accountId, { 
        account, 
        smtp: smtpConnection,
        imap: imapConnection
      });
      
      return true;
    } catch (error) {
      console.error(`Erro ao inicializar conexões para ${accountId}:`, error);
      return false;
    }
  }
  
  /**
   * Registra um template de email para uso
   */
  public registerTemplate(
    templateId: string, 
    template: EmailTemplate
  ): void {
    this.emailTemplates.set(templateId, template);
  }
  
  /**
   * Aplica variáveis a um template
   */
  private applyTemplateVariables(
    template: EmailTemplate,
    variables: Record<string, string>
  ): { subject: string; htmlBody: string; textBody: string } {
    let { subject, htmlBody, textBody } = template;
    
    // Substituir variáveis
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      htmlBody = htmlBody.replace(regex, value);
      textBody = textBody.replace(regex, value);
    });
    
    return { subject, htmlBody, textBody };
  }
  
  /**
   * Cria variações de conteúdo para parecer mais natural
   */
  private createContentVariations(
    template: EmailTemplate,
    baseVariables: Record<string, string>
  ): { subject: string; htmlBody: string; textBody: string } {
    // Implementação básica - pode ser expandida com sistemas mais avançados
    const variations = this.applyTemplateVariables(template, baseVariables);
    
    // Adicionar pequenas variações no conteúdo
    if (Math.random() > 0.5) {
      variations.subject = variations.subject.trim();
    }
    
    // Adicionar saudação aleatória
    const greetings = ['Olá', 'Oi', 'Bom dia', 'Boa tarde', 'Prezado', 'Caro'];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    // Adicionar assinatura aleatória
    const closings = ['Atenciosamente', 'Abraços', 'Até mais', 'Obrigado', 'Saudações'];
    const randomClosing = closings[Math.floor(Math.random() * closings.length)];
    
    // Aplicar variações sutis no corpo HTML e texto
    if (Math.random() > 0.7) {
      variations.htmlBody = `${randomGreeting},<br><br>${variations.htmlBody}<br><br>${randomClosing}`;
      variations.textBody = `${randomGreeting},\n\n${variations.textBody}\n\n${randomClosing}`;
    }
    
    return variations;
  }
  
  /**
   * Realiza envio cruzado entre contas
   */
  public async performCrossSend(
    senderIds: string[],
    receiverIds: string[],
    templateId: string,
    baseVariables: Record<string, string> = {},
    configOverrides: Partial<CrossSendConfig> = {}
  ): Promise<CrossSendResult> {
    // Fusão da configuração padrão com sobreposições
    const config: CrossSendConfig = {
      ...this.defaultConfig,
      ...configOverrides
    };
    
    // Validar existência das contas
    const validSenders = senderIds.filter(id => this.accounts.has(id));
    const validReceivers = receiverIds.filter(id => this.accounts.has(id));
    
    if (validSenders.length === 0) {
      throw new Error('Nenhum remetente válido fornecido');
    }
    
    if (validReceivers.length === 0) {
      throw new Error('Nenhum destinatário válido fornecido');
    }
    
    // Verificar existência do template
    const template = this.emailTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template de email "${templateId}" não encontrado`);
    }
    
    // Inicializar resultado
    const result: CrossSendResult = {
      totalInteractions: 0,
      successfulSends: 0,
      failedSends: 0,
      deliveryRate: 0,
      interactions: [],
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      totalDuration: 0
    };
    
    // Se requerido, randomizar remetentes
    let effectiveSenders = [...validSenders];
    if (config.randomizeSenders) {
      effectiveSenders = this.shuffleArray(effectiveSenders);
    }
    
    // Se requerido, randomizar destinatários
    let effectiveReceivers = [...validReceivers];
    if (config.randomizeReceivers) {
      effectiveReceivers = this.shuffleArray(effectiveReceivers);
    }
    
    // Baseado na estratégia, processar os envios
    try {
      switch (config.sendingStrategy) {
        case SendingStrategy.SEQUENTIAL:
          await this.sendSequentially(
            effectiveSenders, 
            effectiveReceivers,
            template,
            baseVariables,
            config,
            result
          );
          break;
        
        case SendingStrategy.BATCHED:
          await this.sendInBatches(
            effectiveSenders, 
            effectiveReceivers,
            template,
            baseVariables,
            config,
            result
          );
          break;
        
        case SendingStrategy.PARALLEL:
          await this.sendInParallel(
            effectiveSenders, 
            effectiveReceivers,
            template,
            baseVariables,
            config,
            result
          );
          break;
        
        case SendingStrategy.SPACED:
          await this.sendWithSpacing(
            effectiveSenders, 
            effectiveReceivers,
            template,
            baseVariables,
            config,
            result
          );
          break;
        
        case SendingStrategy.RANDOM:
          await this.sendRandomly(
            effectiveSenders, 
            effectiveReceivers,
            template,
            baseVariables,
            config,
            result
          );
          break;
        
        default:
          throw new Error(`Estratégia de envio "${config.sendingStrategy}" não suportada`);
      }
    } catch (error) {
      console.error('Erro durante o envio cruzado:', error);
      // Adicionar erro ao resultado
      result.errors.push({
        accountId: 'system',
        error: `Erro no processo de envio: ${error}`,
        timestamp: new Date()
      });
    } finally {
      // Finalizar o resultado
      result.endTime = new Date();
      result.totalDuration = result.endTime.getTime() - result.startTime.getTime();
      result.deliveryRate = result.successfulSends / result.totalInteractions;
      
      // Opcionalmente, gerar estatísticas adicionais
      if (config.generateStatistics) {
        this.addStatisticsToResult(result);
      }
    }
    
    return result;
  }
  
  /**
   * Distribui pares de envio entre remetentes e destinatários
   */
  private createSendPairs(
    senders: string[],
    receivers: string[]
  ): Array<{ senderId: string; receiverId: string }> {
    const pairs: Array<{ senderId: string; receiverId: string }> = [];
    
    // Criar pares de envio, garantindo que ninguém envie para si mesmo
    senders.forEach(senderId => {
      receivers.forEach(receiverId => {
        if (senderId !== receiverId) {
          pairs.push({ senderId, receiverId });
        }
      });
    });
    
    return pairs;
  }
  
  /**
   * Envia emails sequencialmente
   */
  private async sendSequentially(
    senders: string[],
    receivers: string[],
    template: EmailTemplate,
    baseVariables: Record<string, string>,
    config: CrossSendConfig,
    result: CrossSendResult
  ): Promise<void> {
    // Criar pares de envio
    const sendPairs = this.createSendPairs(senders, receivers);
    result.totalInteractions = sendPairs.length;
    
    // Enviar sequencialmente
    for (const { senderId, receiverId } of sendPairs) {
      try {
        // Obter contas
        const sender = this.accounts.get(senderId);
        const receiver = this.accounts.get(receiverId);
        
        if (!sender || !receiver || !sender.smtp) {
          throw new Error(`Remetente ou destinatário inválido: ${senderId} -> ${receiverId}`);
        }
        
        // Criar variações de conteúdo
        const variables = {
          ...baseVariables,
          senderName: sender.account.email.split('@')[0],
          receiverName: receiver.account.email.split('@')[0],
          senderEmail: sender.account.email,
          receiverEmail: receiver.account.email,
          timestamp: new Date().toISOString()
        };
        
        const content = config.randomizeContent 
          ? this.createContentVariations(template, variables)
          : this.applyTemplateVariables(template, variables);
        
        // Criar registro de interação
        const interactionId = `${senderId}-${receiverId}-${Date.now()}`;
        const interaction: EmailInteraction = {
          id: interactionId,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.PENDING,
          subject: content.subject,
          content: content.htmlBody,
          createdAt: new Date()
        };
        
        // Registrar interação
        this.interactions.set(interactionId, interaction);
        
        // Enviar email
        const smtpResult = await sender.smtp.sendMail({
          from: sender.account.email,
          to: receiver.account.email,
          subject: content.subject,
          html: content.htmlBody,
          text: content.textBody,
          // Opções adicionais conforme necessário
        });
        
        // Atualizar interação
        interaction.status = InteractionStatus.SENT;
        interaction.sentAt = new Date();
        interaction.messageId = smtpResult.messageId;
        this.interactions.set(interactionId, interaction);
        
        // Adicionar à lista de resultados
        result.interactions.push(interaction);
        result.successfulSends++;
        
        // Aguardar intervalo se não for o último
        if (config.timeBetweenSends && sendPairs.indexOf({ senderId, receiverId }) < sendPairs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, config.timeBetweenSends));
        }
      } catch (error) {
        console.error(`Erro ao enviar de ${senderId} para ${receiverId}:`, error);
        
        // Registrar erro
        result.errors.push({
          accountId: senderId,
          error: `Falha ao enviar para ${receiverId}: ${error}`,
          timestamp: new Date()
        });
        
        // Registrar interação falha
        const failedInteraction: EmailInteraction = {
          id: `failed-${senderId}-${receiverId}-${Date.now()}`,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.FAILED,
          createdAt: new Date(),
          failedAt: new Date(),
          failReason: `${error}`
        };
        
        this.interactions.set(failedInteraction.id, failedInteraction);
        result.interactions.push(failedInteraction);
        result.failedSends++;
      }
    }
  }
  
  /**
   * Envia emails em lotes
   */
  private async sendInBatches(
    senders: string[],
    receivers: string[],
    template: EmailTemplate,
    baseVariables: Record<string, string>,
    config: CrossSendConfig,
    result: CrossSendResult
  ): Promise<void> {
    // Criar pares de envio
    const sendPairs = this.createSendPairs(senders, receivers);
    result.totalInteractions = sendPairs.length;
    
    // Definir tamanho do lote
    const batchSize = config.batchSize || 5;
    
    // Dividir em lotes
    for (let i = 0; i < sendPairs.length; i += batchSize) {
      const batch = sendPairs.slice(i, i + batchSize);
      
      // Processar lote em paralelo
      await Promise.all(batch.map(async ({ senderId, receiverId }) => {
        try {
          // Obter contas
          const sender = this.accounts.get(senderId);
          const receiver = this.accounts.get(receiverId);
          
          if (!sender || !receiver || !sender.smtp) {
            throw new Error(`Remetente ou destinatário inválido: ${senderId} -> ${receiverId}`);
          }
          
          // Criar variações de conteúdo
          const variables = {
            ...baseVariables,
            senderName: sender.account.email.split('@')[0],
            receiverName: receiver.account.email.split('@')[0],
            senderEmail: sender.account.email,
            receiverEmail: receiver.account.email,
            timestamp: new Date().toISOString()
          };
          
          const content = config.randomizeContent 
            ? this.createContentVariations(template, variables)
            : this.applyTemplateVariables(template, variables);
          
          // Criar registro de interação
          const interactionId = `${senderId}-${receiverId}-${Date.now()}`;
          const interaction: EmailInteraction = {
            id: interactionId,
            sourceAccountId: senderId,
            targetAccountId: receiverId,
            type: InteractionType.INITIAL_CONTACT,
            status: InteractionStatus.PENDING,
            subject: content.subject,
            content: content.htmlBody,
            createdAt: new Date()
          };
          
          // Registrar interação
          this.interactions.set(interactionId, interaction);
          
          // Enviar email
          const smtpResult = await sender.smtp.sendMail({
            from: sender.account.email,
            to: receiver.account.email,
            subject: content.subject,
            html: content.htmlBody,
            text: content.textBody,
            // Opções adicionais conforme necessário
          });
          
          // Atualizar interação
          interaction.status = InteractionStatus.SENT;
          interaction.sentAt = new Date();
          interaction.messageId = smtpResult.messageId;
          this.interactions.set(interactionId, interaction);
          
          // Adicionar à lista de resultados
          result.interactions.push(interaction);
          result.successfulSends++;
        } catch (error) {
          console.error(`Erro ao enviar de ${senderId} para ${receiverId}:`, error);
          
          // Registrar erro
          result.errors.push({
            accountId: senderId,
            error: `Falha ao enviar para ${receiverId}: ${error}`,
            timestamp: new Date()
          });
          
          // Registrar interação falha
          const failedInteraction: EmailInteraction = {
            id: `failed-${senderId}-${receiverId}-${Date.now()}`,
            sourceAccountId: senderId,
            targetAccountId: receiverId,
            type: InteractionType.INITIAL_CONTACT,
            status: InteractionStatus.FAILED,
            createdAt: new Date(),
            failedAt: new Date(),
            failReason: `${error}`
          };
          
          this.interactions.set(failedInteraction.id, failedInteraction);
          result.interactions.push(failedInteraction);
          result.failedSends++;
        }
      }));
      
      // Aguardar entre lotes
      if (config.timeBetweenSends && i + batchSize < sendPairs.length) {
        await new Promise(resolve => setTimeout(resolve, config.timeBetweenSends));
      }
    }
  }
  
  /**
   * Envia emails em paralelo
   */
  private async sendInParallel(
    senders: string[],
    receivers: string[],
    template: EmailTemplate,
    baseVariables: Record<string, string>,
    config: CrossSendConfig,
    result: CrossSendResult
  ): Promise<void> {
    // Criar pares de envio
    const sendPairs = this.createSendPairs(senders, receivers);
    result.totalInteractions = sendPairs.length;
    
    // Enviar todos em paralelo
    await Promise.all(sendPairs.map(async ({ senderId, receiverId }) => {
      try {
        // Obter contas
        const sender = this.accounts.get(senderId);
        const receiver = this.accounts.get(receiverId);
        
        if (!sender || !receiver || !sender.smtp) {
          throw new Error(`Remetente ou destinatário inválido: ${senderId} -> ${receiverId}`);
        }
        
        // Criar variações de conteúdo
        const variables = {
          ...baseVariables,
          senderName: sender.account.email.split('@')[0],
          receiverName: receiver.account.email.split('@')[0],
          senderEmail: sender.account.email,
          receiverEmail: receiver.account.email,
          timestamp: new Date().toISOString()
        };
        
        const content = config.randomizeContent 
          ? this.createContentVariations(template, variables)
          : this.applyTemplateVariables(template, variables);
        
        // Criar registro de interação
        const interactionId = `${senderId}-${receiverId}-${Date.now()}`;
        const interaction: EmailInteraction = {
          id: interactionId,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.PENDING,
          subject: content.subject,
          content: content.htmlBody,
          createdAt: new Date()
        };
        
        // Registrar interação
        this.interactions.set(interactionId, interaction);
        
        // Enviar email
        const smtpResult = await sender.smtp.sendMail({
          from: sender.account.email,
          to: receiver.account.email,
          subject: content.subject,
          html: content.htmlBody,
          text: content.textBody,
          // Opções adicionais conforme necessário
        });
        
        // Atualizar interação
        interaction.status = InteractionStatus.SENT;
        interaction.sentAt = new Date();
        interaction.messageId = smtpResult.messageId;
        this.interactions.set(interactionId, interaction);
        
        // Adicionar à lista de resultados
        result.interactions.push(interaction);
        result.successfulSends++;
      } catch (error) {
        console.error(`Erro ao enviar de ${senderId} para ${receiverId}:`, error);
        
        // Registrar erro
        result.errors.push({
          accountId: senderId,
          error: `Falha ao enviar para ${receiverId}: ${error}`,
          timestamp: new Date()
        });
        
        // Registrar interação falha
        const failedInteraction: EmailInteraction = {
          id: `failed-${senderId}-${receiverId}-${Date.now()}`,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.FAILED,
          createdAt: new Date(),
          failedAt: new Date(),
          failReason: `${error}`
        };
        
        this.interactions.set(failedInteraction.id, failedInteraction);
        result.interactions.push(failedInteraction);
        result.failedSends++;
      }
    }));
  }
  
  /**
   * Envia emails com espaçamento de tempo
   */
  private async sendWithSpacing(
    senders: string[],
    receivers: string[],
    template: EmailTemplate,
    baseVariables: Record<string, string>,
    config: CrossSendConfig,
    result: CrossSendResult
  ): Promise<void> {
    // Criar pares de envio
    const sendPairs = this.createSendPairs(senders, receivers);
    result.totalInteractions = sendPairs.length;
    
    // Definir intervalo de tempo
    const timeBetween = config.timeBetweenSends || 60000; // 1 minuto padrão
    
    // Enviar com intervalos
    for (let i = 0; i < sendPairs.length; i++) {
      const { senderId, receiverId } = sendPairs[i];
      
      try {
        // Obter contas
        const sender = this.accounts.get(senderId);
        const receiver = this.accounts.get(receiverId);
        
        if (!sender || !receiver || !sender.smtp) {
          throw new Error(`Remetente ou destinatário inválido: ${senderId} -> ${receiverId}`);
        }
        
        // Criar variações de conteúdo
        const variables = {
          ...baseVariables,
          senderName: sender.account.email.split('@')[0],
          receiverName: receiver.account.email.split('@')[0],
          senderEmail: sender.account.email,
          receiverEmail: receiver.account.email,
          timestamp: new Date().toISOString()
        };
        
        const content = config.randomizeContent 
          ? this.createContentVariations(template, variables)
          : this.applyTemplateVariables(template, variables);
        
        // Criar registro de interação
        const interactionId = `${senderId}-${receiverId}-${Date.now()}`;
        const interaction: EmailInteraction = {
          id: interactionId,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.PENDING,
          subject: content.subject,
          content: content.htmlBody,
          createdAt: new Date()
        };
        
        // Registrar interação
        this.interactions.set(interactionId, interaction);
        
        // Enviar email
        const smtpResult = await sender.smtp.sendMail({
          from: sender.account.email,
          to: receiver.account.email,
          subject: content.subject,
          html: content.htmlBody,
          text: content.textBody,
          // Opções adicionais conforme necessário
        });
        
        // Atualizar interação
        interaction.status = InteractionStatus.SENT;
        interaction.sentAt = new Date();
        interaction.messageId = smtpResult.messageId;
        this.interactions.set(interactionId, interaction);
        
        // Adicionar à lista de resultados
        result.interactions.push(interaction);
        result.successfulSends++;
      } catch (error) {
        console.error(`Erro ao enviar de ${senderId} para ${receiverId}:`, error);
        
        // Registrar erro
        result.errors.push({
          accountId: senderId,
          error: `Falha ao enviar para ${receiverId}: ${error}`,
          timestamp: new Date()
        });
        
        // Registrar interação falha
        const failedInteraction: EmailInteraction = {
          id: `failed-${senderId}-${receiverId}-${Date.now()}`,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.FAILED,
          createdAt: new Date(),
          failedAt: new Date(),
          failReason: `${error}`
        };
        
        this.interactions.set(failedInteraction.id, failedInteraction);
        result.interactions.push(failedInteraction);
        result.failedSends++;
      }
      
      // Adicionar variação aleatória ao intervalo para parecer mais natural
      // Intervalo entre 80% e 120% do tempo configurado
      const randomFactor = 0.8 + Math.random() * 0.4;
      const adjustedTime = Math.floor(timeBetween * randomFactor);
      
      // Aguardar intervalo se não for o último
      if (i < sendPairs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, adjustedTime));
      }
    }
  }
  
  /**
   * Envia emails em ordem aleatória e tempo aleatório
   */
  private async sendRandomly(
    senders: string[],
    receivers: string[],
    template: EmailTemplate,
    baseVariables: Record<string, string>,
    config: CrossSendConfig,
    result: CrossSendResult
  ): Promise<void> {
    // Criar pares de envio
    let sendPairs = this.createSendPairs(senders, receivers);
    result.totalInteractions = sendPairs.length;
    
    // Embaralhar a ordem
    sendPairs = this.shuffleArray(sendPairs);
    
    // Definir intervalo base e variação
    const baseTime = config.timeBetweenSends || 60000; // 1 minuto padrão
    
    // Enviar em ordem e tempo aleatórios
    for (let i = 0; i < sendPairs.length; i++) {
      const { senderId, receiverId } = sendPairs[i];
      
      try {
        // Obter contas
        const sender = this.accounts.get(senderId);
        const receiver = this.accounts.get(receiverId);
        
        if (!sender || !receiver || !sender.smtp) {
          throw new Error(`Remetente ou destinatário inválido: ${senderId} -> ${receiverId}`);
        }
        
        // Criar variações de conteúdo
        const variables = {
          ...baseVariables,
          senderName: sender.account.email.split('@')[0],
          receiverName: receiver.account.email.split('@')[0],
          senderEmail: sender.account.email,
          receiverEmail: receiver.account.email,
          timestamp: new Date().toISOString()
        };
        
        const content = config.randomizeContent 
          ? this.createContentVariations(template, variables)
          : this.applyTemplateVariables(template, variables);
        
        // Criar registro de interação
        const interactionId = `${senderId}-${receiverId}-${Date.now()}`;
        const interaction: EmailInteraction = {
          id: interactionId,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.PENDING,
          subject: content.subject,
          content: content.htmlBody,
          createdAt: new Date()
        };
        
        // Registrar interação
        this.interactions.set(interactionId, interaction);
        
        // Enviar email
        const smtpResult = await sender.smtp.sendMail({
          from: sender.account.email,
          to: receiver.account.email,
          subject: content.subject,
          html: content.htmlBody,
          text: content.textBody,
          // Opções adicionais conforme necessário
        });
        
        // Atualizar interação
        interaction.status = InteractionStatus.SENT;
        interaction.sentAt = new Date();
        interaction.messageId = smtpResult.messageId;
        this.interactions.set(interactionId, interaction);
        
        // Adicionar à lista de resultados
        result.interactions.push(interaction);
        result.successfulSends++;
      } catch (error) {
        console.error(`Erro ao enviar de ${senderId} para ${receiverId}:`, error);
        
        // Registrar erro
        result.errors.push({
          accountId: senderId,
          error: `Falha ao enviar para ${receiverId}: ${error}`,
          timestamp: new Date()
        });
        
        // Registrar interação falha
        const failedInteraction: EmailInteraction = {
          id: `failed-${senderId}-${receiverId}-${Date.now()}`,
          sourceAccountId: senderId,
          targetAccountId: receiverId,
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.FAILED,
          createdAt: new Date(),
          failedAt: new Date(),
          failReason: `${error}`
        };
        
        this.interactions.set(failedInteraction.id, failedInteraction);
        result.interactions.push(failedInteraction);
        result.failedSends++;
      }
      
      // Tempo totalmente aleatório entre 50% e 150% do tempo base
      const randomTime = Math.floor(baseTime * (0.5 + Math.random()));
      
      // Aguardar intervalo se não for o último
      if (i < sendPairs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, randomTime));
      }
    }
  }
  
  /**
   * Embaralha um array (algoritmo Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  /**
   * Adiciona estatísticas calculadas ao resultado
   */
  private addStatisticsToResult(result: CrossSendResult): void {
    // Calcular taxas de abertura, resposta e resgate
    let openCount = 0;
    let replyCount = 0;
    let rescueCount = 0;
    
    result.interactions.forEach(interaction => {
      if (interaction.readAt) {
        openCount++;
      }
      
      if (interaction.repliedAt) {
        replyCount++;
      }
      
      if (interaction.status === InteractionStatus.RESCUED) {
        rescueCount++;
      }
    });
    
    // Adicionar ao resultado
    if (result.totalInteractions > 0) {
      result.openRate = openCount / result.totalInteractions;
      result.replyRate = replyCount / result.totalInteractions;
      result.rescueRate = rescueCount / result.totalInteractions;
    }
  }
  
  /**
   * Verifica entrega de emails enviados
   */
  public async verifyDelivery(
    interactionIds: string[] = []
  ): Promise<Map<string, EmailInteraction>> {
    const result = new Map<string, EmailInteraction>();
    const idList = interactionIds.length > 0 
      ? interactionIds 
      : Array.from(this.interactions.keys());
    
    // Filtrar apenas para interações que foram enviadas, mas não confirmadas como entregues
    const pendingInteractions = idList
      .map(id => this.interactions.get(id))
      .filter(interaction => 
        interaction && 
        interaction.status === InteractionStatus.SENT && 
        !interaction.deliveredAt
      ) as EmailInteraction[];
    
    // Verificar cada interação
    for (const interaction of pendingInteractions) {
      // Obter conta do destinatário
      const receiverAccount = this.accounts.get(interaction.targetAccountId);
      
      if (!receiverAccount || !receiverAccount.imap) {
        console.warn(`Não é possível verificar entrega para ${interaction.targetAccountId} - conta não disponível`);
        continue;
      }
      
      try {
        // Criar leitor IMAP
        const imapReader = new ImapReader(receiverAccount.imap);
        
        // Procurar pelo messageId nas pastas principais
        const folders = ['INBOX', 'Spam', 'Junk'];
        let messageFound = false;
        
        for (const folder of folders) {
          // Procurar pelo messageId
          const messages = await imapReader.searchMessages({
            folder,
            criteria: {
              header: [
                { key: 'Message-ID', value: interaction.messageId || '' }
              ]
            }
          });
          
          if (messages && messages.length > 0) {
            // Email encontrado
            interaction.status = InteractionStatus.DELIVERED;
            interaction.deliveredAt = new Date();
            
            // Se encontrado na pasta Spam/Junk, podemos tentar resgatá-lo
            if (folder === 'Spam' || folder === 'Junk') {
              // TODO: Implementar resgate de spam
            }
            
            messageFound = true;
            break;
          }
        }
        
        // Atualizar e retornar
        if (messageFound) {
          this.interactions.set(interaction.id, interaction);
          result.set(interaction.id, interaction);
        }
      } catch (error) {
        console.error(`Erro ao verificar entrega para ${interaction.id}:`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Verifica se os emails enviados foram lidos
   */
  public async checkReadStatus(
    interactionIds: string[] = []
  ): Promise<Map<string, EmailInteraction>> {
    const result = new Map<string, EmailInteraction>();
    const idList = interactionIds.length > 0 
      ? interactionIds 
      : Array.from(this.interactions.keys());
    
    // Filtrar apenas para interações entregues, mas não marcadas como lidas
    const pendingInteractions = idList
      .map(id => this.interactions.get(id))
      .filter(interaction => 
        interaction && 
        interaction.status === InteractionStatus.DELIVERED && 
        !interaction.readAt
      ) as EmailInteraction[];
    
    // Verificar cada interação
    for (const interaction of pendingInteractions) {
      // Obter conta do destinatário
      const receiverAccount = this.accounts.get(interaction.targetAccountId);
      
      if (!receiverAccount || !receiverAccount.imap) {
        console.warn(`Não é possível verificar leitura para ${interaction.targetAccountId} - conta não disponível`);
        continue;
      }
      
      try {
        // Criar leitor IMAP
        const imapReader = new ImapReader(receiverAccount.imap);
        
        // Procurar pelo messageId nas pastas principais e verificar flag lida
        const folders = ['INBOX', 'Spam', 'Junk'];
        
        for (const folder of folders) {
          // Procurar pelo messageId
          const messages = await imapReader.searchMessages({
            folder,
            criteria: {
              header: [
                { key: 'Message-ID', value: interaction.messageId || '' }
              ],
              seen: true  // Apenas mensagens vistas
            }
          });
          
          if (messages && messages.length > 0) {
            // Email encontrado e marcado como lido
            interaction.status = InteractionStatus.READ;
            interaction.readAt = new Date();
            
            this.interactions.set(interaction.id, interaction);
            result.set(interaction.id, interaction);
            break;
          }
        }
      } catch (error) {
        console.error(`Erro ao verificar leitura para ${interaction.id}:`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Realiza o resgate de emails da pasta de spam
   */
  public async rescueFromSpam(
    interactionIds: string[] = []
  ): Promise<Map<string, EmailInteraction>> {
    const result = new Map<string, EmailInteraction>();
    const idList = interactionIds.length > 0 
      ? interactionIds 
      : Array.from(this.interactions.keys());
    
    // Filtrar interações enviadas
    const sentInteractions = idList
      .map(id => this.interactions.get(id))
      .filter(interaction => 
        interaction && 
        [InteractionStatus.SENT, InteractionStatus.DELIVERED].includes(interaction.status as InteractionStatus)
      ) as EmailInteraction[];
    
    // Verificar cada interação
    for (const interaction of sentInteractions) {
      // Obter conta do destinatário
      const receiverAccount = this.accounts.get(interaction.targetAccountId);
      
      if (!receiverAccount || !receiverAccount.imap) {
        console.warn(`Não é possível resgatar emails para ${interaction.targetAccountId} - conta não disponível`);
        continue;
      }
      
      try {
        // Criar leitor IMAP
        const imapReader = new ImapReader(receiverAccount.imap);
        
        // Procurar pelo messageId nas pastas de spam
        const spamFolders = ['Spam', 'Junk', 'Bulk'];
        
        for (const folder of spamFolders) {
          // Procurar pelo messageId
          const messages = await imapReader.searchMessages({
            folder,
            criteria: {
              header: [
                { key: 'Message-ID', value: interaction.messageId || '' }
              ]
            }
          });
          
          if (messages && messages.length > 0) {
            // Email encontrado na pasta de spam, tentar mover para Inbox
            const messageUid = messages[0].uid;
            
            // Mover para a caixa de entrada
            await receiverAccount.imap.moveMessages(messageUid, folder, 'INBOX');
            
            // Atualizar interação
            interaction.status = InteractionStatus.RESCUED;
            this.interactions.set(interaction.id, interaction);
            result.set(interaction.id, interaction);
            
            break;
          }
        }
      } catch (error) {
        console.error(`Erro ao resgatar email para ${interaction.id}:`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Obtém estatísticas de interação da rede
   */
  public getNetworkStatistics(): {
    totalAccounts: number;
    totalInteractions: number;
    deliveryRate: number;
    openRate: number;
    replyRate: number;
    rescueRate: number;
    averageDeliveryTime: number;
    topSenders: Array<{ accountId: string; successCount: number }>;
    topReceivers: Array<{ accountId: string; receiveCount: number }>;
  } {
    const interactions = Array.from(this.interactions.values());
    
    // Total de interações
    const totalInteractions = interactions.length;
    
    // Interações enviadas e entregues
    const sentInteractions = interactions.filter(i => i.status === InteractionStatus.SENT);
    const deliveredInteractions = interactions.filter(i => 
      i.status === InteractionStatus.DELIVERED || 
      i.status === InteractionStatus.READ || 
      i.status === InteractionStatus.REPLIED || 
      i.status === InteractionStatus.RESCUED
    );
    const readInteractions = interactions.filter(i => 
      i.status === InteractionStatus.READ || 
      i.status === InteractionStatus.REPLIED
    );
    const repliedInteractions = interactions.filter(i => i.status === InteractionStatus.REPLIED);
    const rescuedInteractions = interactions.filter(i => i.status === InteractionStatus.RESCUED);
    
    // Calcular taxas
    const deliveryRate = totalInteractions > 0 ? deliveredInteractions.length / totalInteractions : 0;
    const openRate = deliveredInteractions.length > 0 ? readInteractions.length / deliveredInteractions.length : 0;
    const replyRate = deliveredInteractions.length > 0 ? repliedInteractions.length / deliveredInteractions.length : 0;
    const rescueRate = sentInteractions.length > 0 ? rescuedInteractions.length / sentInteractions.length : 0;
    
    // Calcular tempo médio de entrega
    let totalDeliveryTime = 0;
    let deliveryTimeCount = 0;
    
    for (const interaction of deliveredInteractions) {
      if (interaction.sentAt && interaction.deliveredAt) {
        totalDeliveryTime += interaction.deliveredAt.getTime() - interaction.sentAt.getTime();
        deliveryTimeCount++;
      }
    }
    
    const averageDeliveryTime = deliveryTimeCount > 0 ? totalDeliveryTime / deliveryTimeCount : 0;
    
    // Identificar os principais remetentes e destinatários
    const senderCounts: Record<string, number> = {};
    const receiverCounts: Record<string, number> = {};
    
    for (const interaction of interactions) {
      // Incrementar contador do remetente para envios bem-sucedidos
      if (interaction.status !== InteractionStatus.FAILED) {
        senderCounts[interaction.sourceAccountId] = (senderCounts[interaction.sourceAccountId] || 0) + 1;
      }
      
      // Incrementar contador do destinatário
      receiverCounts[interaction.targetAccountId] = (receiverCounts[interaction.targetAccountId] || 0) + 1;
    }
    
    // Ordenar por contagem
    const topSenders = Object.entries(senderCounts)
      .map(([accountId, successCount]) => ({ accountId, successCount }))
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, 5);
    
    const topReceivers = Object.entries(receiverCounts)
      .map(([accountId, receiveCount]) => ({ accountId, receiveCount }))
      .sort((a, b) => b.receiveCount - a.receiveCount)
      .slice(0, 5);
    
    return {
      totalAccounts: this.accounts.size,
      totalInteractions,
      deliveryRate,
      openRate,
      replyRate,
      rescueRate,
      averageDeliveryTime,
      topSenders,
      topReceivers
    };
  }
  
  /**
   * Limpa interações antigas
   */
  public cleanupOldInteractions(olderThanDays = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let count = 0;
    
    for (const [id, interaction] of this.interactions.entries()) {
      if (interaction.createdAt < cutoffDate) {
        this.interactions.delete(id);
        count++;
      }
    }
    
    return count;
  }
}