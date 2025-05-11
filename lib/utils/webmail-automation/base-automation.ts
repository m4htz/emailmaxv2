/**
 * Classe base para implementação de automação de webmail
 * Define a estrutura e funcionalidades comuns a todos os provedores
 */

import { 
  WebmailAutomation, 
  WebmailAction,
  WebmailAccount, 
  ActionResult,
  BrowserState,
  HumanBehaviorConfig
} from './types';

// Configuração padrão de comportamento humano
const DEFAULT_HUMAN_BEHAVIOR: HumanBehaviorConfig = {
  typingSpeed: {
    min: 180,
    max: 250
  },
  readingSpeed: {
    min: 30,
    max: 60
  },
  cursorMovement: {
    maxDeviation: 50,
    randomAcceleration: true
  },
  interactionDelays: {
    short: { min: 300, max: 800 },
    medium: { min: 1000, max: 3000 },
    long: { min: 3000, max: 10000 }
  }
};

/**
 * Classe base abstrata que implementa funcionalidades comuns
 * de automação de webmail independentes do provedor
 */
export abstract class BaseWebmailAutomation implements WebmailAutomation {
  protected state: BrowserState = 'initializing';
  protected account: WebmailAccount | null = null;
  protected isHeadless: boolean;
  protected humanBehavior: HumanBehaviorConfig;
  protected userAgent: string = '';
  protected cookies: Record<string, string> = {};
  
  constructor(options: {
    isHeadless?: boolean;
    humanBehavior?: Partial<HumanBehaviorConfig>;
  } = {}) {
    this.isHeadless = options.isHeadless ?? true;
    this.humanBehavior = { 
      ...DEFAULT_HUMAN_BEHAVIOR,
      ...options.humanBehavior 
    };
  }

  // Método para inicializar o navegador e ambiente
  public abstract initialize(): Promise<boolean>;
  
  // Método para fazer login no webmail
  public abstract login(account: WebmailAccount): Promise<ActionResult>;
  
  // Método para fazer logout
  public abstract logout(): Promise<ActionResult>;
  
  // Executa uma ação específica no webmail
  public abstract executeAction(action: WebmailAction, params: Record<string, any>): Promise<ActionResult>;
  
  // Fecha o navegador
  public abstract close(): Promise<void>;
  
  // Retorna o estado atual do navegador
  public getCurrentState(): BrowserState {
    return this.state;
  }
  
  // Métodos utilitários que podem ser usados pelas implementações concretas
  
  /**
   * Simula digitação humana com velocidade variável e possíveis erros de digitação
   * @param text Texto a ser digitado
   * @param fieldSelector Seletor CSS do campo onde será digitado
   */
  protected abstract simulateHumanTyping(text: string, fieldSelector: string): Promise<void>;
  
  /**
   * Simula movimento de cursor humano entre dois pontos
   * @param startX Coordenada X inicial
   * @param startY Coordenada Y inicial
   * @param endX Coordenada X final
   * @param endY Coordenada Y final
   */
  protected abstract simulateHumanCursorMovement(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number
  ): Promise<void>;
  
  /**
   * Simula tempo de espera para leitura de conteúdo
   * @param textLength Comprimento do texto a ser "lido"
   */
  protected async simulateReadingTime(textLength: number): Promise<void> {
    const { min, max } = this.humanBehavior.readingSpeed;
    const msPerChar = Math.random() * (max - min) + min;
    const readTime = Math.max(1000, Math.min(60000, textLength * msPerChar));
    
    return new Promise(resolve => setTimeout(resolve, readTime));
  }
  
  /**
   * Gera um atraso aleatório entre ações
   * @param type Tipo de atraso (curto, médio ou longo)
   */
  protected async randomDelay(type: 'short' | 'medium' | 'long' = 'short'): Promise<void> {
    const { min, max } = this.humanBehavior.interactionDelays[type];
    const delay = Math.floor(Math.random() * (max - min) + min);
    
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Cria um resultado de ação padronizado
   */
  protected createActionResult(action: WebmailAction, success: boolean, error?: string, details?: Record<string, any>): ActionResult {
    return {
      action,
      success,
      timestamp: new Date(),
      error,
      details
    };
  }
}