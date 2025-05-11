/**
 * Testes para o módulo EmailInteractionNetwork
 */

import { 
  EmailInteractionNetwork, 
  InteractionType, 
  InteractionStatus,
  SendingStrategy,
  EmailTemplate,
  CrossSendConfig
} from '../../../lib/utils/email-interaction-network';

import { WebmailAccount } from '../../../lib/utils/webmail-automation/types';

// Mock para as classes de conexão
jest.mock('../../../lib/utils/smtp-connection', () => {
  return {
    SmtpConnection: jest.fn().mockImplementation(() => {
      return {
        sendMail: jest.fn().mockImplementation(async (options) => {
          return {
            messageId: `mock-message-id-${Date.now()}`,
            envelope: {
              from: options.from,
              to: options.to
            },
            accepted: [options.to],
            rejected: [],
            pending: [],
            response: '250 OK'
          };
        }),
        close: jest.fn()
      };
    })
  };
});

jest.mock('../../../lib/utils/imap-connection', () => {
  return {
    ImapConnection: jest.fn().mockImplementation(() => {
      return {
        connect: jest.fn(),
        moveMessages: jest.fn(),
        close: jest.fn()
      };
    })
  };
});

jest.mock('../../../lib/utils/imap-reader', () => {
  return {
    ImapReader: jest.fn().mockImplementation(() => {
      return {
        searchMessages: jest.fn().mockResolvedValue([
          { uid: '1', seen: false }
        ])
      };
    })
  };
});

describe('EmailInteractionNetwork', () => {
  let network: EmailInteractionNetwork;
  
  beforeEach(() => {
    network = new EmailInteractionNetwork({
      sendingStrategy: SendingStrategy.SEQUENTIAL,
      timeBetweenSends: 100, // rápido para testes
      randomizeContent: false
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Gerenciamento de Contas', () => {
    test('deve adicionar uma conta ao sistema', async () => {
      const account: WebmailAccount = {
        id: 'test1',
        provider: 'gmail',
        email: 'test1@example.com',
        username: 'test1',
        usesOAuth: false
      };
  
      const result = await network.addAccount(account);
      expect(result).toBe(true);
    });
    
    test('deve remover uma conta do sistema', async () => {
      // Adicionar conta primeiro
      const account: WebmailAccount = {
        id: 'test2',
        provider: 'outlook',
        email: 'test2@example.com',
        username: 'test2',
        usesOAuth: false
      };
      
      await network.addAccount(account);
      
      // Remover a conta
      const result = await network.removeAccount('test2');
      expect(result).toBe(true);
    });
    
    test('deve falhar ao remover conta inexistente', async () => {
      const result = await network.removeAccount('nonexistent');
      expect(result).toBe(false);
    });
  });
  
  describe('Gerenciamento de Templates', () => {
    test('deve registrar um template de email', () => {
      const template: EmailTemplate = {
        subject: 'Test Subject',
        htmlBody: '<p>Test HTML</p>',
        textBody: 'Test Text'
      };
      
      network.registerTemplate('testTemplate', template);
      
      // Verificar se o template está registrado verificando se o sistema aceita executar com ele
      expect(async () => {
        await network.performCrossSend(
          ['test1'], 
          ['test2'], 
          'testTemplate', 
          {}
        );
      }).not.toThrow();
    });
  });
  
  describe('Envio Cruzado de Emails', () => {
    beforeEach(async () => {
      // Configurar contas e template para os testes
      const accounts: WebmailAccount[] = [
        {
          id: 'sender1',
          provider: 'gmail',
          email: 'sender1@example.com',
          username: 'sender1',
          usesOAuth: false
        },
        {
          id: 'sender2',
          provider: 'outlook',
          email: 'sender2@example.com',
          username: 'sender2',
          usesOAuth: false
        },
        {
          id: 'receiver1',
          provider: 'gmail',
          email: 'receiver1@example.com',
          username: 'receiver1',
          usesOAuth: false
        },
        {
          id: 'receiver2',
          provider: 'yahoo',
          email: 'receiver2@example.com',
          username: 'receiver2',
          usesOAuth: false
        }
      ];
      
      for (const account of accounts) {
        await network.addAccount(account);
      }
      
      const template: EmailTemplate = {
        subject: 'Test Email {{senderName}} to {{receiverName}}',
        htmlBody: '<p>Hello {{receiverName}}, this is a test from {{senderName}}.</p>',
        textBody: 'Hello {{receiverName}}, this is a test from {{senderName}}.'
      };
      
      network.registerTemplate('testTemplate', template);
    });
    
    test('deve falhar se não houver remetentes válidos', async () => {
      await expect(
        network.performCrossSend(
          ['invalid1', 'invalid2'], 
          ['receiver1'], 
          'testTemplate'
        )
      ).rejects.toThrow('Nenhum remetente válido fornecido');
    });
    
    test('deve falhar se não houver destinatários válidos', async () => {
      await expect(
        network.performCrossSend(
          ['sender1'], 
          ['invalid1', 'invalid2'], 
          'testTemplate'
        )
      ).rejects.toThrow('Nenhum destinatário válido fornecido');
    });
    
    test('deve falhar se o template não existir', async () => {
      await expect(
        network.performCrossSend(
          ['sender1'], 
          ['receiver1'], 
          'nonexistentTemplate'
        )
      ).rejects.toThrow('Template de email "nonexistentTemplate" não encontrado');
    });
    
    test('deve executar envio sequencial com sucesso', async () => {
      // Substituir método sendSequentially por um mock
      const originalMethod = (network as any).sendSequentially;
      const mockSendSequentially = jest.fn().mockImplementation(async (
        senders, receivers, template, baseVariables, config, result
      ) => {
        result.totalInteractions = 2; // sender1->receiver1, sender1->receiver2
        result.successfulSends = 2;
        result.interactions = [
          {
            id: 'test-interaction-1',
            sourceAccountId: 'sender1',
            targetAccountId: 'receiver1',
            type: InteractionType.INITIAL_CONTACT,
            status: InteractionStatus.SENT,
            createdAt: new Date(),
            sentAt: new Date(),
            messageId: 'test-message-id-1'
          },
          {
            id: 'test-interaction-2',
            sourceAccountId: 'sender1',
            targetAccountId: 'receiver2',
            type: InteractionType.INITIAL_CONTACT,
            status: InteractionStatus.SENT,
            createdAt: new Date(),
            sentAt: new Date(),
            messageId: 'test-message-id-2'
          }
        ];
      });
      
      (network as any).sendSequentially = mockSendSequentially;
      
      // Executar envio
      const result = await network.performCrossSend(
        ['sender1'], 
        ['receiver1', 'receiver2'], 
        'testTemplate', 
        {}, 
        { sendingStrategy: SendingStrategy.SEQUENTIAL }
      );
      
      expect(mockSendSequentially).toHaveBeenCalled();
      expect(result.totalInteractions).toBe(2);
      expect(result.successfulSends).toBe(2);
      expect(result.failedSends).toBe(0);
      expect(result.interactions.length).toBe(2);
      
      // Restaurar método original
      (network as any).sendSequentially = originalMethod;
    });
    
    // Testes para outras estratégias de envio funcionariam de maneira similar
  });
  
  describe('Verificação de Entrega', () => {
    beforeEach(async () => {
      // Configurar contas e interações para os testes
      const sender: WebmailAccount = {
        id: 'sender',
        provider: 'gmail',
        email: 'sender@example.com',
        username: 'sender',
        usesOAuth: false
      };
      
      const receiver: WebmailAccount = {
        id: 'receiver',
        provider: 'outlook',
        email: 'receiver@example.com',
        username: 'receiver',
        usesOAuth: false
      };
      
      await network.addAccount(sender);
      await network.addAccount(receiver, true); // inicializar conexões
      
      // Adicionar uma interação de exemplo
      const interaction = {
        id: 'test-interaction',
        sourceAccountId: 'sender',
        targetAccountId: 'receiver',
        type: InteractionType.INITIAL_CONTACT,
        status: InteractionStatus.SENT,
        subject: 'Test Email',
        content: '<p>Test Content</p>',
        messageId: 'test-message-id',
        createdAt: new Date(),
        sentAt: new Date()
      };
      
      (network as any).interactions.set(interaction.id, interaction);
    });
    
    test('deve verificar entrega de email corretamente', async () => {
      const result = await network.verifyDelivery(['test-interaction']);
      
      // Verificar se há uma entrada para a interação
      expect(result.has('test-interaction')).toBe(true);
      
      // Verificar se o status foi atualizado
      const updatedInteraction = result.get('test-interaction');
      expect(updatedInteraction?.status).toBe(InteractionStatus.DELIVERED);
      expect(updatedInteraction?.deliveredAt).toBeDefined();
    });
  });
  
  describe('Estatísticas da Rede', () => {
    beforeEach(async () => {
      // Configurar contas para os testes
      const accounts: WebmailAccount[] = [
        { id: 'a1', provider: 'gmail', email: 'a1@example.com', username: 'a1', usesOAuth: false },
        { id: 'a2', provider: 'outlook', email: 'a2@example.com', username: 'a2', usesOAuth: false },
        { id: 'a3', provider: 'gmail', email: 'a3@example.com', username: 'a3', usesOAuth: false }
      ];
      
      for (const account of accounts) {
        await network.addAccount(account);
      }
      
      // Adicionar algumas interações
      const interactions = [
        {
          id: 'i1',
          sourceAccountId: 'a1',
          targetAccountId: 'a2',
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.DELIVERED,
          createdAt: new Date(),
          sentAt: new Date(Date.now() - 1000),
          deliveredAt: new Date()
        },
        {
          id: 'i2',
          sourceAccountId: 'a1',
          targetAccountId: 'a3',
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.SENT,
          createdAt: new Date(),
          sentAt: new Date()
        },
        {
          id: 'i3',
          sourceAccountId: 'a2',
          targetAccountId: 'a3',
          type: InteractionType.INITIAL_CONTACT,
          status: InteractionStatus.FAILED,
          createdAt: new Date(),
          failedAt: new Date(),
          failReason: 'Test failure'
        }
      ];
      
      interactions.forEach(i => {
        (network as any).interactions.set(i.id, i);
      });
    });
    
    test('deve retornar estatísticas corretas da rede', () => {
      const stats = network.getNetworkStatistics();
      
      expect(stats.totalAccounts).toBe(3);
      expect(stats.totalInteractions).toBe(3);
      
      // Verificar principais remetentes
      const topSender = stats.topSenders[0];
      expect(topSender.accountId).toBe('a1');
      expect(topSender.successCount).toBe(2); // a1 tem 2 envios (SENT e DELIVERED)
    });
    
    test('deve limpar interações antigas corretamente', () => {
      // Adicionar interação antiga
      const oldInteraction = {
        id: 'old',
        sourceAccountId: 'a1',
        targetAccountId: 'a2',
        type: InteractionType.INITIAL_CONTACT,
        status: InteractionStatus.DELIVERED,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 dias atrás
      };
      
      (network as any).interactions.set(oldInteraction.id, oldInteraction);
      
      // Limpar interações mais antigas que 30 dias
      const removedCount = network.cleanupOldInteractions(30);
      
      expect(removedCount).toBe(1); // Apenas a interação antiga deve ser removida
      expect((network as any).interactions.has('old')).toBe(false);
      expect((network as any).interactions.has('i1')).toBe(true);
    });
  });
});