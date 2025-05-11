/**
 * Tipos base para o sistema de automação de webmail
 */

// Tipos de webmails suportados
export type WebmailProvider = 'gmail' | 'outlook' | 'yahoo';

// Estados possíveis para o navegador
export type BrowserState = 'initializing' | 'ready' | 'navigating' | 'interacting' | 'error' | 'closed';

// Interface para gestão de sessão
export interface SessionInfo {
  cookieData: Record<string, string>;
  lastLogin: Date;
  lastActivity: Date;
  userAgent: string;
  browserFingerprint: string;
}

// Configuração de interação humana
export interface HumanBehaviorConfig {
  // Velocidade de digitação em caracteres por minuto (média: 200-240)
  typingSpeed: {
    min: number;
    max: number;
  };
  // Tempo de leitura de email em ms por caractere (média: 30-60ms)
  readingSpeed: {
    min: number;
    max: number;
  };
  // Movimento do cursor (variação natural)
  cursorMovement: {
    // Desvio máximo de linha reta em pixels
    maxDeviation: number;
    // Aceleração aleatória
    randomAcceleration: boolean;
  };
  // Intervalos entre interações na interface em ms
  interactionDelays: {
    short: { min: number; max: number }; // 300-800ms
    medium: { min: number; max: number }; // 1000-3000ms
    long: { min: number; max: number }; // 3000-10000ms
  };
}

// Detalhes da conta de webmail
export interface WebmailAccount {
  id: string;
  provider: WebmailProvider;
  email: string;
  username?: string;
  // NÃO armazenar senha aqui, usar credenciais seguras
  usesOAuth: boolean;
  lastSession?: SessionInfo;
  behaviorProfile?: HumanBehaviorConfig;
}

// Ações possíveis em webmails
export type WebmailAction = 
  | 'login'
  | 'logout'
  | 'read-email'
  | 'send-email'
  | 'delete-email'
  | 'move-to-folder'
  | 'mark-as-read'
  | 'mark-as-unread'
  | 'mark-as-spam'
  | 'mark-as-not-spam'
  | 'create-folder'
  | 'search';

// Resultado de uma ação
export interface ActionResult {
  success: boolean;
  action: WebmailAction;
  timestamp: Date;
  error?: string;
  details?: Record<string, any>;
}

// Interface base para automação de webmail
export interface WebmailAutomation {
  initialize(): Promise<boolean>;
  login(account: WebmailAccount): Promise<ActionResult>;
  logout(): Promise<ActionResult>;
  getCurrentState(): BrowserState;
  executeAction(action: WebmailAction, params: Record<string, any>): Promise<ActionResult>;
  close(): Promise<void>;
}