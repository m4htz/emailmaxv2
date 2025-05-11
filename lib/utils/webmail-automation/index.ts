/**
 * Exportação centralizada da API de automação de webmail
 */

// Tipos básicos
export * from './types';

// Classes base
export { BaseWebmailAutomation } from './base-automation';
export { HumanBehaviorSimulator } from './human-behavior';
export { BrowserFingerprintGenerator } from './browser-fingerprint';

// Implementações específicas para cada webmail
export { GmailAutomation } from './gmail-automation';
export { OutlookAutomation } from './outlook-automation';
export { YahooAutomation } from './yahoo-automation';

// Sistema de navegação avançado
export { NavigationHandler } from './navigation-handler';
export { SessionManager } from './session-manager';
export { AdaptiveSelectors } from './adaptive-selectors';
export { WebmailController } from './webmail-controller';

// Sistema de interação humana
export { HumanInteraction } from './human-interaction';
export { InputManager } from './input-manager';

// Sistema de detecção automática de elementos
export {
  ElementDetector,
  createElementDetector,
  ElementPattern,
  DetectedElement
} from './element-detector';

// Sistema de gerenciamento de pastas e etiquetas
export {
  FolderManager,
  OrganizationItem,
  OrganizationItemType,
  FolderOperationResult,
  FolderOperationStatus,
  CreateFolderOptions
} from './folder-manager';

/**
 * Cria uma instância da automação apropriada para o provedor de webmail
 * @param provider Provedor de webmail (gmail, outlook, yahoo)
 * @param options Opções de configuração
 */
export function createWebmailAutomation(
  provider: 'gmail' | 'outlook' | 'yahoo',
  options: {
    isHeadless?: boolean;
    mockMode?: boolean;
    humanBehavior?: any;
  } = {}
) {
  switch (provider) {
    case 'gmail':
      return new GmailAutomation(options);

    case 'outlook':
      return new OutlookAutomation(options);

    case 'yahoo':
      return new YahooAutomation(options);

    default:
      throw new Error(`Provedor de webmail não suportado: ${provider}`);
  }
}

/**
 * Cria uma instância do controlador de webmail avançado
 * Recomendado para uso em produção
 * @param options Opções de configuração
 */
export function createWebmailController(options = {}) {
  return new WebmailController(options);
}

/**
 * Cria uma instância do sistema de interação humana
 * @param page Objeto da página do Playwright
 * @param options Opções de configuração
 */
export function createHumanInteraction(page: any, options = {}) {
  const behaviorSim = new HumanBehaviorSimulator();
  return new HumanInteraction(page, behaviorSim, options);
}

/**
 * Cria uma instância do gerenciador de entrada
 * @param page Objeto da página do Playwright
 * @param humanInteraction Instância opcional de HumanInteraction
 * @param options Opções de configuração
 */
export function createInputManager(page: any, humanInteraction?: HumanInteraction, options = {}) {
  return new InputManager(page, humanInteraction, options);
}

/**
 * Cria uma instância do gerenciador de pastas e etiquetas
 * @param provider Provedor de webmail (gmail, outlook, yahoo)
 * @param page Objeto da página do Playwright
 * @param options Opções adicionais
 */
export function createFolderManager(
  provider: WebmailProvider,
  page: any,
  options: {
    adaptiveSelectors?: AdaptiveSelectors;
    elementDetector?: ElementDetector;
    humanBehavior?: HumanBehaviorSimulator;
  } = {}
) {
  return new FolderManager({
    provider,
    page,
    ...options
  });
}