import { ValidationCache } from '@/lib/utils/validation-cache';
import { TestConnectionResult } from '@/lib/utils/email-connection';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock para localStorage
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
    },
    key: (i: number) => Object.keys(store)[i] || null,
    length: Object.keys(store).length
  };
})();

// Mock global localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('ValidationCache', () => {
  let cache: ValidationCache;
  const mockKey = {
    email: 'test@example.com',
    imapHost: 'imap.example.com',
    imapPort: 993,
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
  };

  const mockSuccessResult: TestConnectionResult = {
    success: true,
    message: 'Conexão bem-sucedida',
    details: {
      imap: { success: true, message: 'IMAP conectado' },
      smtp: { success: true, message: 'SMTP conectado' },
      connectionType: 'real'
    }
  };

  const mockFailureResult: TestConnectionResult = {
    success: false,
    message: 'Falha na conexão',
    details: {
      imap: { success: false, message: 'Falha no IMAP' },
      smtp: { success: true, message: 'SMTP conectado' },
      connectionType: 'real',
      error: 'auth_failure'
    }
  };

  beforeEach(() => {
    // Limpar localStorage antes de cada teste
    localStorageMock.clear();
    
    // Criar nova instância do cache com TTL baixo para testes
    cache = new ValidationCache({
      defaultTTL: 300, // 300ms
      successTTL: 500, // 500ms
      failureTTL: 200, // 200ms
    });
  });

  it('deve armazenar e recuperar resultados do cache', () => {
    // Armazenar resultado
    cache.set(mockKey, mockSuccessResult);

    // Verificar se o cache contém o resultado
    expect(cache.has(mockKey)).toBe(true);

    // Recuperar resultado
    const result = cache.get(mockKey);
    expect(result).not.toBeNull();
    expect(result?.success).toBe(true);
    expect(result?.message).toBe('Conexão bem-sucedida');
    
    // Verificar se as propriedades de cache foram adicionadas
    expect(result?.details?.fromCache).toBe(true);
    expect(typeof result?.details?.cachedAt).toBe('number');
    expect(typeof result?.details?.expiresAt).toBe('number');
  });

  it('deve respeitar o tempo de expiração para resultados de sucesso', async () => {
    // Armazenar resultado de sucesso
    cache.set(mockKey, mockSuccessResult);
    
    // Verificar presença imediata
    expect(cache.has(mockKey)).toBe(true);
    
    // Aguardar expiração (500ms + margem)
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Verificar ausência após expiração
    expect(cache.has(mockKey)).toBe(false);
    expect(cache.get(mockKey)).toBeNull();
  });

  it('deve respeitar o tempo de expiração para resultados de falha', async () => {
    // Armazenar resultado de falha
    cache.set(mockKey, mockFailureResult);
    
    // Verificar presença imediata
    expect(cache.has(mockKey)).toBe(true);
    
    // Aguardar expiração (200ms + margem)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Verificar ausência após expiração
    expect(cache.has(mockKey)).toBe(false);
    expect(cache.get(mockKey)).toBeNull();
  });

  it('deve remover entradas específicas do cache', () => {
    // Armazenar múltiplas entradas
    cache.set(mockKey, mockSuccessResult);
    cache.set({...mockKey, email: 'other@example.com'}, mockFailureResult);
    
    // Verificar tamanho inicial
    expect(cache.size()).toBe(2);
    
    // Remover uma entrada específica
    expect(cache.remove(mockKey)).toBe(true);
    
    // Verificar que apenas a entrada específica foi removida
    expect(cache.size()).toBe(1);
    expect(cache.has(mockKey)).toBe(false);
    expect(cache.has({...mockKey, email: 'other@example.com'})).toBe(true);
  });

  it('deve limpar todo o cache', () => {
    // Armazenar múltiplas entradas
    cache.set(mockKey, mockSuccessResult);
    cache.set({...mockKey, email: 'other@example.com'}, mockFailureResult);
    
    // Verificar tamanho inicial
    expect(cache.size()).toBe(2);
    
    // Limpar todo o cache
    cache.clear();
    
    // Verificar que o cache está vazio
    expect(cache.size()).toBe(0);
  });

  it('deve desabilitar o cache quando configurado', () => {
    // Desabilitar o cache
    cache.setEnabled(false);
    
    // Tentar armazenar um resultado
    cache.set(mockKey, mockSuccessResult);
    
    // Verificar que nada foi armazenado
    expect(cache.has(mockKey)).toBe(false);
    expect(cache.get(mockKey)).toBeNull();
    
    // Habilitar o cache novamente
    cache.setEnabled(true);
    
    // Armazenar um resultado
    cache.set(mockKey, mockSuccessResult);
    
    // Verificar que agora foi armazenado
    expect(cache.has(mockKey)).toBe(true);
    expect(cache.get(mockKey)).not.toBeNull();
  });

  it('deve carregar e persistir dados no localStorage', () => {
    // Criar cache e armazenar dados
    const cache1 = new ValidationCache({
      storageKey: 'test_cache'
    });
    
    cache1.set(mockKey, mockSuccessResult);
    
    // Verificar que o localStorage contém os dados
    const storedData = localStorageMock.getItem('test_cache');
    expect(storedData).not.toBeNull();
    
    // Criar nova instância do cache que deve carregar do localStorage
    const cache2 = new ValidationCache({
      storageKey: 'test_cache'
    });
    
    // Verificar que os dados foram carregados
    expect(cache2.has(mockKey)).toBe(true);
    expect(cache2.get(mockKey)).not.toBeNull();
  });
});