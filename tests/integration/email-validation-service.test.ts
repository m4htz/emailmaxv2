import { testEmailConnection, TestConnectionParams } from '@/lib/utils/email-connection';
import { ValidationCache } from '@/lib/utils/validation-cache';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mocks para fetch
global.fetch = jest.fn();

// Criar mock bem-sucedido
const createSuccessResponse = (customData = {}) => {
  return {
    json: jest.fn().mockResolvedValue({
      success: true,
      message: 'Conexão bem-sucedida',
      details: {
        imap: { success: true, message: 'IMAP conectado' },
        smtp: { success: true, message: 'SMTP conectado' },
        connectionType: 'real',
        ...customData
      }
    }),
    ok: true,
    status: 200
  };
};

// Criar mock de falha
const createFailureResponse = (customData = {}) => {
  return {
    json: jest.fn().mockResolvedValue({
      success: false,
      message: 'Falha na conexão',
      details: {
        imap: { success: false, message: 'Falha no IMAP' },
        smtp: { success: true, message: 'SMTP conectado' },
        connectionType: 'real',
        error: 'auth_failure',
        ...customData
      }
    }),
    ok: true,
    status: 200
  };
};

// Mock para local storage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Serviço de Validação de Email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    // Configurar variáveis de ambiente
    process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL = 'http://localhost:5000';
    process.env.EMAIL_VALIDATION_API_KEY = 'test_api_key';
  });

  const testParams: TestConnectionParams = {
    email: 'test@example.com',
    password: 'test-password',
    imapHost: 'imap.example.com',
    imapPort: 993,
    smtpHost: 'smtp.example.com',
    smtpPort: 587
  };

  it('deve testar uma conexão bem-sucedida', async () => {
    // Configurar mock do fetch para retornar sucesso
    (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse());

    // Chamar a função de teste
    const result = await testEmailConnection(testParams);

    // Verificar se fetch foi chamado corretamente
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/test-connection',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_api_key'
        }),
        body: expect.any(String)
      })
    );

    // Verificar a resposta
    expect(result.success).toBe(true);
    expect(result.message).toBe('Conexão bem-sucedida');
    expect(result.details?.imap?.success).toBe(true);
    expect(result.details?.smtp?.success).toBe(true);
  });

  it('deve lidar com falha de conexão', async () => {
    // Configurar mock do fetch para retornar falha
    (global.fetch as jest.Mock).mockResolvedValueOnce(createFailureResponse());

    // Chamar a função de teste
    const result = await testEmailConnection(testParams);

    // Verificar a resposta
    expect(result.success).toBe(false);
    expect(result.message).toBe('Falha na conexão');
    expect(result.details?.imap?.success).toBe(false);
    expect(result.details?.smtp?.success).toBe(true);
    expect(result.details?.error).toBe('auth_failure');
  });

  it('deve usar cache quando disponível', async () => {
    // Inicializar o cache
    const cache = new ValidationCache();
    
    // Adicionar um resultado no cache
    const cachedResult = {
      success: true,
      message: 'Resultado em cache',
      details: {
        imap: { success: true, message: 'IMAP em cache' },
        smtp: { success: true, message: 'SMTP em cache' },
        connectionType: 'cache'
      }
    };
    
    cache.set(testParams, cachedResult);
    
    // Chamar a função com useCache: true
    const result = await testEmailConnection(testParams, { useCache: true });
    
    // Não deve ter chamado a API
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Deve ter retornado o resultado em cache
    expect(result.success).toBe(true);
    expect(result.message).toBe('Resultado em cache');
    expect(result.details?.fromCache).toBe(true);
  });

  it('deve ignorar cache quando forceRefresh=true', async () => {
    // Inicializar o cache
    const cache = new ValidationCache();
    
    // Adicionar um resultado no cache
    const cachedResult = {
      success: true,
      message: 'Resultado em cache',
      details: {
        imap: { success: true, message: 'IMAP em cache' },
        smtp: { success: true, message: 'SMTP em cache' },
        connectionType: 'cache'
      }
    };
    
    cache.set(testParams, cachedResult);
    
    // Configurar mock do fetch para retornar sucesso
    (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse({
      message: 'Novo resultado da API'
    }));
    
    // Chamar a função com forceRefresh: true
    const result = await testEmailConnection(testParams, { 
      useCache: true,
      forceRefresh: true 
    });
    
    // Deve ter chamado a API apesar do cache
    expect(global.fetch).toHaveBeenCalled();
    
    // Deve ter retornado o novo resultado da API
    expect(result.success).toBe(true);
    expect(result.message).toBe('Conexão bem-sucedida');
    expect(result.details?.fromCache).toBeFalsy();
  });

  it('deve lidar com erro de rede', async () => {
    // Configurar mock do fetch para simular erro de rede
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    // Chamar a função de teste
    const result = await testEmailConnection(testParams);

    // Verificar a resposta
    expect(result.success).toBe(false);
    expect(result.message).toContain('Erro ao conectar');
    expect(result.details?.serviceError).toBe(true);
  });

  it('deve lidar com erro de servidor', async () => {
    // Configurar mock do fetch para simular resposta de erro do servidor
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: 'Internal server error' })
    });

    // Chamar a função de teste
    const result = await testEmailConnection(testParams);

    // Verificar a resposta
    expect(result.success).toBe(false);
    expect(result.message).toContain('Erro no servidor');
    expect(result.details?.serviceError).toBe(true);
  });

  it('deve armazenar o resultado no cache após teste bem-sucedido', async () => {
    // Limpar o cache
    localStorageMock.clear();
    
    // Configurar mock do fetch para retornar sucesso
    (global.fetch as jest.Mock).mockResolvedValueOnce(createSuccessResponse());

    // Chamar a função com useCache habilitado
    await testEmailConnection(testParams, { useCache: true });
    
    // Verificar se o valor foi armazenado no cache
    const cacheKey = ValidationCache.generateKey(testParams);
    expect(localStorageMock.getItem('email_validation_cache')).not.toBeNull();
    
    // Segunda chamada não deve usar a API
    (global.fetch as jest.Mock).mockClear();
    await testEmailConnection(testParams, { useCache: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});