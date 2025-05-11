import { TestConnectionResult } from '@/lib/utils/email-connection';

/**
 * Interface que representa uma entrada no cache de validação
 */
interface ValidationCacheEntry {
  result: TestConnectionResult;
  timestamp: number;
  expiresAt: number;
}

/**
 * Chave para identificar entradas no cache
 */
interface ValidationCacheKey {
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

/**
 * Configurações do sistema de cache
 */
interface CacheConfig {
  enabled: boolean;
  defaultTTL: number; // Tempo de vida em milissegundos
  successTTL: number; // TTL específico para resultados de sucesso
  failureTTL: number; // TTL específico para resultados de falha
  storageKey: string;
}

/**
 * Classe que implementa o cache de resultados de validação de conexão IMAP/SMTP
 */
export class ValidationCache {
  private config: CacheConfig;
  private cache: Map<string, ValidationCacheEntry>;
  private isStorageAvailable: boolean;

  /**
   * Construtor com valores padrão para configuração
   */
  constructor(config?: Partial<CacheConfig>) {
    // Configuração padrão
    this.config = {
      enabled: true,
      defaultTTL: 5 * 60 * 1000, // 5 minutos
      successTTL: 30 * 60 * 1000, // 30 minutos para sucessos
      failureTTL: 2 * 60 * 1000, // 2 minutos para falhas
      storageKey: 'emailmax_validation_cache',
      ...config
    };

    this.cache = new Map<string, ValidationCacheEntry>();
    this.isStorageAvailable = this.checkStorageAvailability();

    // Carregar cache do localStorage (se disponível)
    if (this.isStorageAvailable) {
      this.loadFromStorage();
    }
  }

  /**
   * Verifica se o localStorage está disponível
   */
  private checkStorageAvailability(): boolean {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }

    try {
      const testKey = '__validation_cache_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Gera uma chave única para cada configuração de validação
   */
  private generateCacheKey(key: ValidationCacheKey): string {
    return `${key.email}:${key.imapHost}:${key.imapPort}:${key.smtpHost}:${key.smtpPort}`;
  }

  /**
   * Carrega dados do cache do localStorage
   */
  private loadFromStorage(): void {
    try {
      const cachedData = localStorage.getItem(this.config.storageKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (parsed && typeof parsed === 'object') {
          // Converter o objeto em Map
          Object.entries(parsed).forEach(([key, value]) => {
            const entry = value as ValidationCacheEntry;
            
            // Verificar se a entrada expirou
            if (entry.expiresAt > Date.now()) {
              this.cache.set(key, entry);
            }
          });

          console.log(`Cache de validação carregado com ${this.cache.size} entradas válidas`);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cache de validação:', error);
      // Em caso de erro, limpar o cache para evitar problemas
      this.cache.clear();
      if (this.isStorageAvailable) {
        localStorage.removeItem(this.config.storageKey);
      }
    }
  }

  /**
   * Salva o cache atual no localStorage
   */
  private saveToStorage(): void {
    if (!this.isStorageAvailable) return;

    try {
      // Limpar entradas expiradas antes de salvar
      this.cleanExpiredEntries();

      // Converter Map para objeto para armazenamento
      const cacheObj: Record<string, ValidationCacheEntry> = {};
      this.cache.forEach((value, key) => {
        cacheObj[key] = value;
      });

      localStorage.setItem(this.config.storageKey, JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Erro ao salvar cache de validação:', error);
    }
  }

  /**
   * Remove entradas expiradas do cache
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        expiredKeys.push(key);
      }
    });

    // Remover entradas expiradas
    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`Removidas ${expiredKeys.length} entradas expiradas do cache`);
    }
  }

  /**
   * Determina o tempo de expiração com base no resultado
   */
  private getExpirationTime(result: TestConnectionResult): number {
    if (!result.success) {
      return Date.now() + this.config.failureTTL;
    }
    return Date.now() + this.config.successTTL;
  }

  /**
   * Armazena um resultado de validação no cache
   */
  set(key: ValidationCacheKey, result: TestConnectionResult): void {
    if (!this.config.enabled) return;

    const cacheKey = this.generateCacheKey(key);
    const expiresAt = this.getExpirationTime(result);
    
    const entry: ValidationCacheEntry = {
      result,
      timestamp: Date.now(),
      expiresAt
    };

    this.cache.set(cacheKey, entry);
    
    // Adicionar indicação que este resultado veio do cache
    if (result.details) {
      result.details.fromCache = true;
      result.details.cachedAt = entry.timestamp;
      result.details.expiresAt = expiresAt;
    }

    // Salvar no localStorage
    this.saveToStorage();
  }

  /**
   * Recupera um resultado de validação do cache
   * @returns O resultado em cache ou null se não estiver disponível/expirado
   */
  get(key: ValidationCacheKey): TestConnectionResult | null {
    if (!this.config.enabled) return null;

    // Limpar entradas expiradas periodicamente
    this.cleanExpiredEntries();

    const cacheKey = this.generateCacheKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) return null;

    // Verificar se a entrada expirou
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(cacheKey);
      this.saveToStorage();
      return null;
    }

    // Adicionar metadados do cache para depuração
    const result = {...entry.result};
    if (result.details) {
      result.details.fromCache = true;
      result.details.cachedAt = entry.timestamp;
      result.details.expiresAt = entry.expiresAt;
      result.details.age = Date.now() - entry.timestamp;
    }

    return result;
  }

  /**
   * Verifica se existe um resultado em cache válido para a chave
   */
  has(key: ValidationCacheKey): boolean {
    if (!this.config.enabled) return false;
    
    const cacheKey = this.generateCacheKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return false;
    
    // Verificar se a entrada expirou
    return entry.expiresAt > Date.now();
  }

  /**
   * Remove uma entrada específica do cache
   */
  remove(key: ValidationCacheKey): boolean {
    const cacheKey = this.generateCacheKey(key);
    const result = this.cache.delete(cacheKey);
    
    if (result && this.isStorageAvailable) {
      this.saveToStorage();
    }
    
    return result;
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
    
    if (this.isStorageAvailable) {
      localStorage.removeItem(this.config.storageKey);
    }
  }

  /**
   * Retorna o número de entradas válidas no cache
   */
  size(): number {
    this.cleanExpiredEntries();
    return this.cache.size;
  }

  /**
   * Habilita ou desabilita o cache
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Verifica se o cache está habilitado
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Atualiza as configurações do cache
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }
}

// Exportar instância singleton para uso em toda a aplicação
export const validationCache = new ValidationCache();