/**
 * Controlador unificado para automação de webmail
 * Integra navegação, gestão de sessão e automação em uma interface única
 */

import { WebmailProvider, WebmailAccount, WebmailAction, ActionResult, BrowserState } from './types';
import { BaseWebmailAutomation } from './base-automation';
import { GmailAutomation } from './gmail-automation';
import { OutlookAutomation } from './outlook-automation';
import { YahooAutomation } from './yahoo-automation';
import { NavigationHandler } from './navigation-handler';
import { SessionManager } from './session-manager';
import { AdaptiveSelectors } from './adaptive-selectors';
import { HumanBehaviorSimulator } from './human-behavior';
import { ElementDetector, DetectedElement, createElementDetector } from './element-detector';

/**
 * Interface para as opções do controlador de webmail
 */
export interface WebmailControllerOptions {
  isHeadless?: boolean;
  mockMode?: boolean;
  sessionManager?: SessionManager;
  humanBehavior?: HumanBehaviorSimulator;
  sessionOptions?: {
    sessionDir?: string;
    encryptSessions?: boolean;
    sessionExpiryDays?: number;
  };
  detectorOptions?: {
    enabled?: boolean;
    learningEnabled?: boolean;
    minConfidence?: number;
  };
}

/**
 * Classe controladora principal que unifica todas as funcionalidades
 * de automação de webmail
 */
export class WebmailController {
  private automation: BaseWebmailAutomation | null = null;
  private navigation: NavigationHandler | null = null;
  private sessionManager: SessionManager;
  private account: WebmailAccount | null = null;
  private options: WebmailControllerOptions;
  private selectors: AdaptiveSelectors | null = null;
  private humanBehavior: HumanBehaviorSimulator;
  private mockMode: boolean;
  private elementDetector: ElementDetector | null = null;
  private elementDetectorEnabled: boolean;

  constructor(options: WebmailControllerOptions = {}) {
    this.options = options;
    this.mockMode = options.mockMode || false;
    this.humanBehavior = options.humanBehavior || new HumanBehaviorSimulator();
    this.elementDetectorEnabled = options.detectorOptions?.enabled ?? true;

    // Inicializar gerenciador de sessão
    this.sessionManager = options.sessionManager || new SessionManager({
      sessionDir: options.sessionOptions?.sessionDir,
      encryptSessions: options.sessionOptions?.encryptSessions,
      sessionExpiryDays: options.sessionOptions?.sessionExpiryDays
    });
  }

  /**
   * Inicializa o controlador com uma conta específica
   */
  public async initialize(account: WebmailAccount): Promise<boolean> {
    try {
      // Inicializar a conta com sessão persistente, se disponível
      const initializedAccount = await this.sessionManager.initializeAccountSession(account);
      this.account = initializedAccount;

      // Criar a instância de automação apropriada para o provedor
      this.automation = this.createAutomationInstance(initializedAccount.provider);
      
      // Inicializar a automação
      const initialized = await this.automation.initialize();

      if (initialized) {
        // Obter a página do navegador da automação
        const page = this.getPageFromAutomation();

        if (page) {
          // Inicializar seletores adaptativos
          this.selectors = new AdaptiveSelectors(account.provider, page);

          // Inicializar detector de elementos
          if (this.elementDetectorEnabled) {
            this.elementDetector = createElementDetector(account.provider, page, {
              adaptiveSelectors: this.selectors,
              learningEnabled: this.options.detectorOptions?.learningEnabled ?? true,
              minConfidence: this.options.detectorOptions?.minConfidence ?? 0.6
            });
          }

          // Inicializar navegação
          this.navigation = new NavigationHandler(
            account.provider,
            page,
            this.automation.getCurrentState(),
            {
              mockMode: this.mockMode,
              humanBehavior: this.humanBehavior,
              adaptiveSelectors: this.selectors
            }
          );
        }
      }
      
      return initialized;
    } catch (error) {
      console.error('Erro ao inicializar controlador de webmail:', error);
      return false;
    }
  }

  /**
   * Cria a instância de automação apropriada para o provedor
   */
  private createAutomationInstance(provider: WebmailProvider): BaseWebmailAutomation {
    const commonOptions = {
      isHeadless: this.options.isHeadless !== undefined ? this.options.isHeadless : true,
      mockMode: this.mockMode,
      humanBehavior: this.humanBehavior
    };

    switch (provider) {
      case 'gmail':
        return new GmailAutomation(commonOptions);
      case 'outlook':
        return new OutlookAutomation(commonOptions);
      case 'yahoo':
        return new YahooAutomation(commonOptions);
      default:
        throw new Error(`Provedor não suportado: ${provider}`);
    }
  }

  /**
   * Extrai o objeto de página a partir da instância de automação
   */
  private getPageFromAutomation(): any {
    if (!this.automation) return null;
    
    // Acessar a propriedade 'page' da instância de automação
    // Nota: Isso assume que todas as classes de automação têm uma propriedade 'page'
    return (this.automation as any).page;
  }

  /**
   * Faz login na conta de webmail
   */
  public async login(): Promise<ActionResult> {
    if (!this.automation || !this.account) {
      return {
        action: 'login',
        success: false,
        timestamp: new Date(),
        error: 'Controlador não inicializado corretamente'
      };
    }

    // Executar o login
    const result = await this.automation.login(this.account);
    
    // Se o login for bem-sucedido, atualizar a sessão
    if (result.success && this.account.lastSession) {
      await this.sessionManager.updateSession(
        this.account,
        {
          lastLogin: new Date(),
          lastActivity: new Date()
        },
        this.automation.getCurrentState()
      );
      
      // Atualizar o estado do navegador no navegador
      if (this.navigation) {
        this.navigation.setState(this.automation.getCurrentState());
      }
    }
    
    return result;
  }

  /**
   * Faz logout da conta de webmail
   */
  public async logout(): Promise<ActionResult> {
    if (!this.automation) {
      return {
        action: 'logout',
        success: false,
        timestamp: new Date(),
        error: 'Controlador não inicializado'
      };
    }

    const result = await this.automation.logout();
    
    // Atualizar o estado do navegador no navegador
    if (this.navigation) {
      this.navigation.setState(this.automation.getCurrentState());
    }
    
    return result;
  }

  /**
   * Executa uma ação na interface do webmail
   */
  public async executeAction(action: WebmailAction, params: Record<string, any> = {}): Promise<ActionResult> {
    if (!this.automation || !this.account) {
      return {
        action,
        success: false,
        timestamp: new Date(),
        error: 'Controlador não inicializado corretamente'
      };
    }

    // Ações de navegação são tratadas pelo NavigationHandler
    if (action === 'navigate' && this.navigation) {
      const folder = params.folder || 'inbox';
      return await this.navigation.navigateToFolder(folder, params.options);
    }
    
    // Ação de pesquisa também é tratada pelo NavigationHandler
    if (action === 'search' && this.navigation) {
      return await this.navigation.search(params.query);
    }
    
    // Ação de atualizar página
    if (action === 'refresh' && this.navigation) {
      return await this.navigation.refreshPage();
    }
    
    // Ação de voltar
    if (action === 'back' && this.navigation) {
      return await this.navigation.goBack(params.options);
    }
    
    // Ação de criar pasta
    if (action === 'create-folder' && this.navigation) {
      return await this.navigation.createFolder(params.name);
    }
    
    // Para todas as outras ações, usar a automação base
    const result = await this.automation.executeAction(action, params);
    
    // Atualizar a sessão após a ação
    if (result.success && this.account.lastSession) {
      await this.sessionManager.updateSession(
        this.account,
        { lastActivity: new Date() },
        this.automation.getCurrentState()
      );
    }
    
    // Atualizar o estado do navegador no navegador
    if (this.navigation) {
      this.navigation.setState(this.automation.getCurrentState());
    }
    
    return result;
  }

  /**
   * Fecha o navegador e libera recursos
   */
  public async close(): Promise<void> {
    if (this.automation) {
      await this.automation.close();
    }

    this.automation = null;
    this.navigation = null;
    this.selectors = null;
    this.elementDetector = null;
  }

  /**
   * Obtém o estado atual do navegador
   */
  public getCurrentState(): BrowserState {
    if (!this.automation) {
      return 'closed';
    }
    return this.automation.getCurrentState();
  }

  /**
   * Verifica se o controlador está inicializado e pronto
   */
  public isReady(): boolean {
    return (
      this.automation !== null &&
      this.account !== null &&
      this.navigation !== null &&
      this.getCurrentState() === 'ready'
    );
  }

  /**
   * Verifica se o usuário está logado
   */
  public isLoggedIn(): boolean {
    if (!this.isReady()) return false;
    
    // Verificar se temos uma sessão ativa com lastLogin recente
    if (this.account?.lastSession) {
      const lastLogin = new Date(this.account.lastSession.lastLogin);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Se o último login foi há menos de uma hora, consideramos logado
      return lastLogin > oneHourAgo;
    }
    
    return false;
  }

  /**
   * Obtém a conta atualmente configurada
   */
  public getAccount(): WebmailAccount | null {
    return this.account;
  }

  /**
   * Espera por um elemento na interface usando seletores adaptativos ou detector automático
   */
  public async waitForElement(elementKey: string, options: {
    timeout?: number,
    useDetector?: boolean,
    minConfidence?: number
  } = {}): Promise<any | null> {
    // Usar detector de elementos se disponível e solicitado
    if (this.elementDetector && (options.useDetector ?? this.elementDetectorEnabled)) {
      const element = await this.elementDetector.waitForElement(elementKey, {
        timeout: options.timeout,
        minConfidence: options.minConfidence
      });

      if (element) {
        const page = this.getPageFromAutomation();
        if (page) {
          return await page.$(element.selector);
        }
      }
      return null;
    }

    // Fallback para navegação tradicional com seletores adaptativos
    if (!this.navigation || !this.selectors) return null;
    return await this.navigation.waitForElement(elementKey, options);
  }

  /**
   * Detecta um elemento específico na interface
   */
  public async detectElement(elementType: string, options: {
    forceRefresh?: boolean,
    minConfidence?: number
  } = {}): Promise<DetectedElement | null> {
    if (!this.elementDetector) return null;

    return await this.elementDetector.detectElement(elementType);
  }

  /**
   * Detecta múltiplos elementos na interface atual
   */
  public async detectElements(options: {
    types?: string[],
    forceRefresh?: boolean,
    minConfidence?: number
  } = {}): Promise<Record<string, DetectedElement | null>> {
    if (!this.elementDetector) return {};

    const result: Record<string, DetectedElement | null> = {};

    // Se não forem especificados tipos, usar uma lista padrão de elementos comuns
    const types = options.types || [
      'composeButton', 'inboxFolder', 'searchBox',
      'emailList', 'settingsButton', 'accountButton'
    ];

    // Detectar cada tipo de elemento
    for (const type of types) {
      result[type] = await this.elementDetector.detectElement(type);
    }

    return result;
  }

  /**
   * Aprende novos padrões de elementos da interface atual
   */
  public async learnNewPatterns(): Promise<number> {
    if (!this.elementDetector) return 0;
    return await this.elementDetector.learnNewPatterns();
  }

  /**
   * Clica em um elemento detectado automaticamente
   */
  public async clickDetectedElement(elementType: string, options: {
    humanLike?: boolean,
    timeout?: number,
    minConfidence?: number
  } = {}): Promise<boolean> {
    if (!this.elementDetector) return false;

    return await this.elementDetector.clickElement(elementType, {
      timeout: options.timeout,
      humanLike: options.humanLike
    });
  }

  /**
   * Obtém URL atual do navegador
   */
  public async getCurrentUrl(): Promise<string | null> {
    const page = this.getPageFromAutomation();
    if (!page) return null;
    
    try {
      return await page.url();
    } catch (error) {
      console.error('Erro ao obter URL atual:', error);
      return null;
    }
  }

  /**
   * Aguarda carregamento completo da página
   */
  public async waitForPageLoad(options: { timeout?: number, state?: 'load' | 'domcontentloaded' | 'networkidle' } = {}): Promise<boolean> {
    const page = this.getPageFromAutomation();
    if (!page) return false;
    
    try {
      await page.waitForLoadState(options.state || 'networkidle', { 
        timeout: options.timeout || 30000 
      });
      return true;
    } catch (error) {
      console.error('Erro ao aguardar carregamento da página:', error);
      return false;
    }
  }

  /**
   * Tira um screenshot do estado atual
   */
  public async takeScreenshot(path: string): Promise<boolean> {
    const page = this.getPageFromAutomation();
    if (!page) return false;
    
    try {
      await page.screenshot({ path });
      return true;
    } catch (error) {
      console.error('Erro ao tirar screenshot:', error);
      return false;
    }
  }
}