/**
 * Sistema adaptativo de seletores para interfaces de webmail
 * Fornece detecção dinâmica de elementos da interface, adaptando-se a mudanças nos seletores
 */

import { WebmailProvider } from './types';

/**
 * Interface para armazenamento de seletores por provedor
 */
export interface SelectorMap {
  [key: string]: string | string[];
}

/**
 * Classe que gerencia seletores adaptativos para interfaces de webmail
 * Permite identificar elementos mesmo quando os seletores mudam
 */
export class AdaptiveSelectors {
  private provider: WebmailProvider;
  private page: any; // Objeto de página do Playwright/Puppeteer
  private primarySelectors: SelectorMap = {};
  private fallbackSelectors: SelectorMap = {};
  private selectorCache: Map<string, string> = new Map();
  private lastVerificationTime: Map<string, number> = new Map();
  private verificationInterval: number = 1000 * 60 * 60; // 1 hora por padrão

  constructor(
    provider: WebmailProvider,
    page: any,
    options: {
      verificationInterval?: number; // Intervalo em ms para verificar seletores
      primarySelectors?: SelectorMap;
      fallbackSelectors?: SelectorMap;
    } = {}
  ) {
    this.provider = provider;
    this.page = page;
    this.verificationInterval = options.verificationInterval || this.verificationInterval;
    this.primarySelectors = options.primarySelectors || {};
    this.fallbackSelectors = options.fallbackSelectors || {};
    this.initializeDefaultSelectors();
  }

  /**
   * Inicializa seletores padrão baseados no provedor
   */
  private initializeDefaultSelectors(): void {
    switch (this.provider) {
      case 'gmail':
        this.setDefaultGmailSelectors();
        break;
      case 'outlook':
        this.setDefaultOutlookSelectors();
        break;
      case 'yahoo':
        this.setDefaultYahooSelectors();
        break;
    }
  }

  /**
   * Define seletores padrão para Gmail
   */
  private setDefaultGmailSelectors(): void {
    // Seletores primários - mais específicos e confiáveis
    this.primarySelectors = {
      ...this.primarySelectors,
      composeButton: 'div[role="button"][gh="cm"]',
      inboxLink: 'a[href="https://mail.google.com/mail/u/0/#inbox"]',
      emailListItems: 'tr.zA',
      searchBox: 'input[aria-label="Search mail"]',
      logoutButton: '#gb_71',
      accountButton: 'a[aria-label*="Google Account"]',
    };

    // Seletores alternativos para fallback
    this.fallbackSelectors = {
      ...this.fallbackSelectors,
      composeButton: [
        'div[gh="cm"]',
        'div[role="button"]:has(svg)',
        'div.T-I.T-I-KE'
      ],
      inboxLink: [
        'a[aria-label*="Inbox"]',
        'div[aria-label*="Inbox"]',
        'div.aim:first-child'
      ],
      emailListItems: [
        'div[role="row"]',
        'table.F > tbody > tr',
        'div.Cp tr'
      ],
      searchBox: [
        'input[name="q"]',
        'input.gb_1e',
        'input[placeholder*="Search"]'
      ]
    };
  }

  /**
   * Define seletores padrão para Outlook
   */
  private setDefaultOutlookSelectors(): void {
    // Seletores primários
    this.primarySelectors = {
      ...this.primarySelectors,
      composeButton: 'button[aria-label="New mail"]',
      inboxLink: 'div[title="Inbox"]',
      emailListItems: 'div[role="listitem"][aria-label*="message"]',
      searchBox: 'input[aria-label="Search"]',
      logoutButton: 'a[data-task="signout"]',
      accountButton: 'button[aria-label*="Account manager"]',
    };

    // Seletores alternativos
    this.fallbackSelectors = {
      ...this.fallbackSelectors,
      composeButton: [
        'button:has(i[data-icon-name="ComposeRegular"])',
        'button.ms-Button--commandBar:first-child',
        'button[title*="New"]'
      ],
      inboxLink: [
        'div[aria-label*="Inbox"]',
        'span[aria-label*="Inbox"]',
        'span.zXnCh'
      ],
      emailListItems: [
        'div.hcptT',
        'div[role="listitem"]',
        'div[draggable="true"]'
      ],
      searchBox: [
        'input[placeholder*="Search"]',
        'input[aria-label*="Search"]',
        'input.ms-SearchBox-field'
      ]
    };
  }

  /**
   * Define seletores padrão para Yahoo
   */
  private setDefaultYahooSelectors(): void {
    // Seletores primários
    this.primarySelectors = {
      ...this.primarySelectors,
      composeButton: 'a[data-test-id="compose-button"]',
      inboxLink: 'a[data-test-folder-name="Inbox"]',
      emailListItems: 'a[data-test-id="message-list-item"]',
      searchBox: 'input[placeholder="Search"]',
      logoutButton: 'a[data-test-id="sign-out"]',
      accountButton: 'button[aria-label="Account info"]',
    };

    // Seletores alternativos
    this.fallbackSelectors = {
      ...this.fallbackSelectors,
      composeButton: [
        'a.p_R',
        'button[title*="Compose"]',
        'a:has(span[title="Compose"])'
      ],
      inboxLink: [
        'a[href*="folder/Inbox"]',
        'span[title="Inbox"]',
        'a.I_T.p_R'
      ],
      emailListItems: [
        'ul[role="list"] > li',
        'div[data-testid="virtual-list"] > div',
        'tr.J_x'
      ],
      searchBox: [
        'input.D_F',
        'input[type="text"][role="searchbox"]',
        'input[aria-label*="Search"]'
      ]
    };
  }

  /**
   * Adiciona seletores personalizados
   */
  public addSelector(key: string, primarySelector: string, fallbackSelectors: string[] = []): void {
    this.primarySelectors[key] = primarySelector;
    this.fallbackSelectors[key] = fallbackSelectors;
    // Limpar o cache para esse seletor quando adicionamos um novo
    this.selectorCache.delete(key);
  }

  /**
   * Obtém o seletor que funciona para um determinado elemento
   * Tenta o seletor primário e depois os fallbacks se necessário
   */
  public async getSelector(key: string): Promise<string | null> {
    // Verificar se temos o seletor em cache e se ainda não passou o tempo de verificação
    const now = Date.now();
    const cachedSelector = this.selectorCache.get(key);
    const lastVerification = this.lastVerificationTime.get(key) || 0;
    
    if (cachedSelector && (now - lastVerification < this.verificationInterval)) {
      return cachedSelector;
    }
    
    // Se não temos um seletor em cache ou precisamos verificar novamente
    try {
      // Tentar o seletor primário primeiro
      const primarySelector = this.primarySelectors[key];
      if (primarySelector && typeof primarySelector === 'string') {
        const elementExists = await this.page.$(primarySelector) !== null;
        if (elementExists) {
          this.selectorCache.set(key, primarySelector);
          this.lastVerificationTime.set(key, now);
          return primarySelector;
        }
      }
      
      // Se o primário falhar, tentar os alternativos
      const fallbacks = this.fallbackSelectors[key];
      if (fallbacks && Array.isArray(fallbacks)) {
        for (const fallbackSelector of fallbacks) {
          const elementExists = await this.page.$(fallbackSelector) !== null;
          if (elementExists) {
            this.selectorCache.set(key, fallbackSelector);
            this.lastVerificationTime.set(key, now);
            return fallbackSelector;
          }
        }
      }
      
      // Se não encontrou nenhum seletor funcionando
      return null;
    } catch (error) {
      console.error(`Erro ao verificar seletor para ${key}:`, error);
      return null;
    }
  }

  /**
   * Espera por um elemento usando a detecção adaptativa
   * Retorna o elemento quando encontrado ou null se o timeout for atingido
   */
  public async waitForElement(key: string, options: { timeout?: number } = {}): Promise<any | null> {
    const timeout = options.timeout || 10000; // 10 segundos por padrão
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const selector = await this.getSelector(key);
      
      if (selector) {
        try {
          // Tentar encontrar o elemento
          const element = await this.page.waitForSelector(selector, { timeout: 1000 });
          if (element) {
            return element;
          }
        } catch (e) {
          // Ignorar erros de timeout no loop interno
        }
      }
      
      // Esperar um pouco antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return null;
  }

  /**
   * Clica em um elemento usando detecção adaptativa
   */
  public async clickElement(key: string, options: { timeout?: number } = {}): Promise<boolean> {
    const element = await this.waitForElement(key, options);
    
    if (element) {
      await element.click();
      return true;
    }
    
    return false;
  }

  /**
   * Preenche um campo de entrada usando detecção adaptativa
   */
  public async fillInputField(
    key: string, 
    text: string, 
    options: { humanTyping?: boolean, timeout?: number } = {}
  ): Promise<boolean> {
    const element = await this.waitForElement(key, options);
    
    if (element) {
      if (options.humanTyping) {
        // Aqui assumimos que existe um método para simular a digitação humana
        await this.page.focus(await this.getSelector(key));
        
        // Digitar caractere por caractere com atrasos variáveis
        for (const char of text) {
          await this.page.keyboard.type(char);
          const delay = 80 + Math.random() * 120; // 80-200ms entre teclas
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Preenchimento direto
        await element.fill(text);
      }
      return true;
    }
    
    return false;
  }

  /**
   * Tenta identificar elementos por características visuais
   * Útil quando todos os seletores falham e precisamos encontrar elementos por posição/aparência
   */
  public async identifyElementByVisualAttributes(
    key: string, 
    attributes: {
      text?: string;
      position?: 'top' | 'bottom' | 'left' | 'right';
      cssAttributes?: Record<string, string>;
      ariaRole?: string;
    }
  ): Promise<any | null> {
    // Implementação baseada em caracterísitcas visuais e posicionais
    try {
      let candidates: any[] = [];
      
      // Procurar por texto visível
      if (attributes.text) {
        const textElements = await this.page.$$(`text=${attributes.text}`);
        candidates = [...candidates, ...textElements];
      }
      
      // Procurar por papel ARIA
      if (attributes.ariaRole) {
        const roleElements = await this.page.$$(`[role="${attributes.ariaRole}"]`);
        candidates = [...candidates, ...roleElements];
      }
      
      // Filtrar por atributos CSS
      if (attributes.cssAttributes && candidates.length > 0) {
        const filteredCandidates = [];
        
        for (const element of candidates) {
          let matches = true;
          
          for (const [property, value] of Object.entries(attributes.cssAttributes)) {
            const style = await this.page.evaluate(
              (el: any, prop: string) => getComputedStyle(el)[prop], 
              element, 
              property
            );
            
            if (style !== value) {
              matches = false;
              break;
            }
          }
          
          if (matches) {
            filteredCandidates.push(element);
          }
        }
        
        candidates = filteredCandidates;
      }
      
      // Filtrar por posição na tela
      if (attributes.position && candidates.length > 0) {
        const viewportSize = await this.page.viewportSize();
        const middleX = viewportSize.width / 2;
        const middleY = viewportSize.height / 2;
        
        candidates.sort(async (a, b) => {
          const boxA = await a.boundingBox();
          const boxB = await b.boundingBox();
          
          if (!boxA || !boxB) return 0;
          
          switch (attributes.position) {
            case 'top':
              return boxA.y - boxB.y;
            case 'bottom':
              return boxB.y - boxA.y;
            case 'left':
              return boxA.x - boxB.x;
            case 'right':
              return boxB.x - boxA.x;
            default:
              return 0;
          }
        });
      }
      
      // Retornar o primeiro candidato ou null
      return candidates.length > 0 ? candidates[0] : null;
    } catch (error) {
      console.error(`Erro ao identificar elemento ${key} por atributos visuais:`, error);
      return null;
    }
  }

  /**
   * Aprende novos seletores dinamicamente analisando a estrutura da interface
   */
  public async learnNewSelectors(): Promise<boolean> {
    if (!this.page) {
      return false;
    }
    
    try {
      // Tentar identificar elementos de interface comum com base na função e aparência
      
      // Exemplo: detectar botão de composição/novo email
      const composeButton = await this.identifyElementByVisualAttributes('composeButton', {
        ariaRole: 'button',
        position: 'left',
        cssAttributes: {
          'font-weight': 'bold'
        }
      });
      
      if (composeButton) {
        // Extrair um seletor único para este elemento
        const selector = await this.page.evaluate((el: any) => {
          // Função para gerar seletor único
          const generateSelector = (element: any): string => {
            if (element.id) {
              return `#${element.id}`;
            }
            
            if (element.role) {
              return `[role="${element.role}"]`;
            }
            
            let selector = element.tagName.toLowerCase();
            
            // Adicionar classes
            if (element.classList && element.classList.length) {
              selector += `.${Array.from(element.classList).join('.')}`;
            }
            
            // Adicionar atributos importantes
            ['aria-label', 'data-test-id', 'title'].forEach(attr => {
              if (element.hasAttribute(attr)) {
                selector += `[${attr}="${element.getAttribute(attr)}"]`;
              }
            });
            
            return selector;
          };
          
          return generateSelector(el);
        }, composeButton);
        
        if (selector && selector !== '') {
          // Adicionar o novo seletor aprendido ao nosso conjunto
          this.addSelector('composeButton', selector);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao aprender novos seletores:', error);
      return false;
    }
  }
}