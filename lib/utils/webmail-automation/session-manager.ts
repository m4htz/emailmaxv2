/**
 * Gerenciador de sessões para automação de webmail
 * Permite gerenciar sessões persistentes para diferentes contas de email
 */

import { WebmailAccount, SessionInfo, BrowserState } from './types';
import { BrowserFingerprintGenerator } from './browser-fingerprint';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Interface para opções do gerenciador de sessão
 */
export interface SessionManagerOptions {
  sessionDir?: string; // Diretório para armazenar sessões
  encryptSessions?: boolean; // Opção para criptografar dados da sessão
  encryptionKey?: string; // Chave para criptografia (se não fornecida, será gerada)
  renewFingerprint?: boolean; // Renovar fingerprint a cada login?
  sessionExpiryDays?: number; // Expirar sessão após X dias
}

/**
 * Classe responsável por gerenciar sessões para automação de webmail
 * Fornece persistência de cookies e dados de autenticação
 */
export class SessionManager {
  private sessionDir: string;
  private fingerprintGenerator: BrowserFingerprintGenerator;
  private encryptSessions: boolean;
  private encryptionKey: string;
  private renewFingerprint: boolean;
  private sessionExpiryDays: number;

  constructor(options: SessionManagerOptions = {}) {
    this.sessionDir = options.sessionDir || path.join(process.cwd(), '.sessions');
    this.encryptSessions = options.encryptSessions !== undefined ? options.encryptSessions : true;
    this.encryptionKey = options.encryptionKey || this.generateEncryptionKey();
    this.renewFingerprint = options.renewFingerprint !== undefined ? options.renewFingerprint : false;
    this.sessionExpiryDays = options.sessionExpiryDays || 7;
    this.fingerprintGenerator = new BrowserFingerprintGenerator();

    // Criar diretório de sessões se não existir
    this.ensureSessionDir();
  }

  /**
   * Garante que o diretório de sessões existe
   */
  private ensureSessionDir(): void {
    if (!fs.existsSync(this.sessionDir)) {
      try {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      } catch (error) {
        console.error(`Erro ao criar diretório de sessões: ${error}`);
      }
    }
  }

  /**
   * Gera uma chave de criptografia se não fornecida
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Criptografa dados de sessão
   */
  private encryptData(data: string): string {
    if (!this.encryptSessions) return data;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Descriptografa dados de sessão
   */
  private decryptData(data: string): string {
    if (!this.encryptSessions) return data;

    const [ivHex, encryptedData] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Gera um nome de arquivo seguro para a sessão
   */
  private getSessionFilename(account: WebmailAccount): string {
    // Usar hash do email e provedor para evitar caracteres especiais nos nomes de arquivo
    const hash = crypto
      .createHash('md5')
      .update(`${account.provider}:${account.email}`)
      .digest('hex');
    
    return `session_${hash}.json`;
  }

  /**
   * Salva uma sessão no sistema de arquivos
   */
  public async saveSession(account: WebmailAccount): Promise<boolean> {
    if (!account.lastSession) {
      console.error('Nenhuma sessão para salvar');
      return false;
    }

    try {
      const filename = this.getSessionFilename(account);
      const filePath = path.join(this.sessionDir, filename);

      // Dados da sessão com timestamp para expiração
      const sessionData = {
        ...account.lastSession,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.sessionExpiryDays * 24 * 60 * 60 * 1000).toISOString()
      };

      // Serializar e criptografar
      const serializedData = JSON.stringify(sessionData);
      const dataToSave = this.encryptSessions ? this.encryptData(serializedData) : serializedData;

      // Salvar no arquivo
      fs.writeFileSync(filePath, dataToSave, 'utf8');
      return true;
    } catch (error) {
      console.error(`Erro ao salvar sessão: ${error}`);
      return false;
    }
  }

  /**
   * Carrega uma sessão do sistema de arquivos
   */
  public async loadSession(account: WebmailAccount): Promise<SessionInfo | null> {
    try {
      const filename = this.getSessionFilename(account);
      const filePath = path.join(this.sessionDir, filename);

      // Verificar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        return null;
      }

      // Ler e descriptografar dados
      const encryptedData = fs.readFileSync(filePath, 'utf8');
      const decryptedData = this.encryptSessions ? this.decryptData(encryptedData) : encryptedData;
      const sessionData = JSON.parse(decryptedData);

      // Verificar expiração
      const expiresAt = new Date(sessionData.expiresAt);
      if (expiresAt < new Date()) {
        console.log(`Sessão expirada para ${account.email}`);
        this.deleteSession(account);
        return null;
      }

      // Se renovar fingerprint está ativado, atualize o user-agent
      if (this.renewFingerprint) {
        const fingerprint = this.fingerprintGenerator.generateFingerprint();
        sessionData.userAgent = fingerprint.userAgent;
        sessionData.browserFingerprint = fingerprint;
      }

      return sessionData;
    } catch (error) {
      console.error(`Erro ao carregar sessão: ${error}`);
      return null;
    }
  }

  /**
   * Deleta uma sessão do sistema de arquivos
   */
  public deleteSession(account: WebmailAccount): boolean {
    try {
      const filename = this.getSessionFilename(account);
      const filePath = path.join(this.sessionDir, filename);

      // Verificar se o arquivo existe antes de tentar excluir
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return true;
    } catch (error) {
      console.error(`Erro ao deletar sessão: ${error}`);
      return false;
    }
  }

  /**
   * Verifica se existe sessão salva para a conta
   */
  public hasSession(account: WebmailAccount): boolean {
    const filename = this.getSessionFilename(account);
    const filePath = path.join(this.sessionDir, filename);
    return fs.existsSync(filePath);
  }

  /**
   * Limpa sessões expiradas
   */
  public cleanExpiredSessions(): number {
    try {
      let cleanedCount = 0;
      const files = fs.readdirSync(this.sessionDir);

      for (const file of files) {
        if (!file.startsWith('session_') || !file.endsWith('.json')) continue;

        const filePath = path.join(this.sessionDir, file);
        const encryptedData = fs.readFileSync(filePath, 'utf8');
        
        try {
          const decryptedData = this.encryptSessions ? this.decryptData(encryptedData) : encryptedData;
          const sessionData = JSON.parse(decryptedData);
          
          // Verificar expiração
          const expiresAt = new Date(sessionData.expiresAt);
          if (expiresAt < new Date()) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        } catch (parseError) {
          // Se não conseguir descriptografar ou analisar, considerar inválido e remover
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error(`Erro ao limpar sessões expiradas: ${error}`);
      return 0;
    }
  }

  /**
   * Inicializa uma conta com sessão salva se disponível
   */
  public async initializeAccountSession(account: WebmailAccount): Promise<WebmailAccount> {
    // Criar uma cópia da conta para não modificar a original
    const accountCopy = { ...account };

    // Tentar carregar a sessão
    const sessionInfo = await this.loadSession(accountCopy);
    if (sessionInfo) {
      accountCopy.lastSession = sessionInfo;
      console.log(`Sessão carregada para ${accountCopy.email}`);
    } else {
      // Se não tiver sessão, gerar um novo fingerprint
      const fingerprint = this.fingerprintGenerator.generateFingerprint({
        uniqueIdentifier: `${accountCopy.provider}:${accountCopy.email}`
      });
      
      // Inicializar sessão vazia com fingerprint
      accountCopy.lastSession = {
        cookieData: {},
        lastLogin: new Date(0), // Data antiga para forçar novo login
        lastActivity: new Date(0),
        userAgent: fingerprint.userAgent,
        browserFingerprint: fingerprint.userAgent
      };
      console.log(`Nova sessão criada para ${accountCopy.email}`);
    }

    return accountCopy;
  }

  /**
   * Atualiza os dados de uma sessão existente
   */
  public async updateSession(
    account: WebmailAccount, 
    updates: Partial<SessionInfo>,
    browserState: BrowserState
  ): Promise<WebmailAccount> {
    // Criar uma cópia da conta para não modificar a original
    const accountCopy = { ...account };
    
    // Se não tiver uma sessão, inicializar
    if (!accountCopy.lastSession) {
      accountCopy.lastSession = {
        cookieData: {},
        lastLogin: new Date(),
        lastActivity: new Date(),
        userAgent: '',
        browserFingerprint: ''
      };
    }
    
    // Aplicar as atualizações
    accountCopy.lastSession = {
      ...accountCopy.lastSession,
      ...updates,
      lastActivity: new Date() // Sempre atualizar a data da última atividade
    };
    
    // Se o estado do navegador for "ready", salvar a sessão
    if (browserState === 'ready') {
      await this.saveSession(accountCopy);
    }
    
    return accountCopy;
  }
}