/**
 * Sistema de detecção automática de elementos de interface para webmail
 * Utilizando reconhecimento de padrões, heurísticas e machine learning
 */

import { WebmailProvider } from './types';
import { AdaptiveSelectors, SelectorMap } from './adaptive-selectors';

/**
 * Elemento de interface detectado
 */
export interface DetectedElement {
  type: string;               // Tipo de elemento (botão, link, caixa de texto, etc)
  selector: string;           // Seletor CSS para acessar o elemento
  confidence: number;         // Nível de confiança (0-1)
  role?: string;              // Papel ARIA do elemento
  text?: string;              // Texto visível
  position?: {                // Posição na tela
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes?: {              // Atributos relevantes
    [key: string]: string;
  };
}

/**
 * Padrão de reconhecimento para elementos de interface
 */
export interface ElementPattern {
  type: string;               // Tipo de elemento a ser detectado
  provider: WebmailProvider | 'all';  // Provedor específico ou 'all' para todos
  selectors?: string[];       // Seletores CSS possíveis
  heuristics: {              // Regras heurísticas para identificação
    role?: string | string[];
    textContent?: string | RegExp;
    cssClasses?: string[];
    attributes?: { [key: string]: string | RegExp };
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    isNear?: string;         // Próximo a outro elemento
    relativeTo?: {           // Relativo a outro elemento
      element: string;
      position: 'above' | 'below' | 'left' | 'right';
      distance?: number;     // Distância máxima em pixels
    };
  };
  confidence: number;        // Confiança base (0-1) para este padrão
}

/**
 * Opções para a configuração do detector
 */
export interface ElementDetectorOptions {
  adaptiveSelectors?: AdaptiveSelectors; // Opcional, será criado se não fornecido
  provider: WebmailProvider;
  page: any;                  // Objeto de página do Playwright
  learningEnabled?: boolean;  // Se deve aprender novos padrões dinamicamente
  customPatterns?: ElementPattern[]; // Padrões personalizados
  minConfidence?: number;     // Confiança mínima (0-1) para considerar detectado
  locateTimeout?: number;     // Tempo máximo (ms) para localizar um elemento
  cacheDuration?: number;     // Duração (ms) para cache de elementos detectados
}

/**
 * Classe principal para detecção automática de elementos
 */
export class ElementDetector {
  private adaptiveSelectors: AdaptiveSelectors;
  private provider: WebmailProvider;
  private page: any;
  private patterns: ElementPattern[] = [];
  private elementCache: Map<string, { element: DetectedElement, timestamp: number }> = new Map();
  private options: Required<Omit<ElementDetectorOptions, 'adaptiveSelectors' | 'customPatterns'>> & {
    learningEnabled: boolean;
    minConfidence: number;
    locateTimeout: number;
    cacheDuration: number;
  };

  constructor(options: ElementDetectorOptions) {
    this.provider = options.provider;
    this.page = options.page;
    
    // Configurações padrão
    this.options = {
      provider: options.provider,
      page: options.page,
      learningEnabled: options.learningEnabled ?? true,
      minConfidence: options.minConfidence ?? 0.6,
      locateTimeout: options.locateTimeout ?? 10000,
      cacheDuration: options.cacheDuration ?? 60000 * 5, // 5 minutos padrão
    };

    // Usar AdaptiveSelectors fornecido ou criar um novo
    this.adaptiveSelectors = options.adaptiveSelectors || 
      new AdaptiveSelectors(this.provider, this.page);

    // Inicializar padrões de elementos
    this.initializePatterns();

    // Adicionar padrões personalizados se fornecidos
    if (options.customPatterns) {
      this.patterns = [...this.patterns, ...options.customPatterns];
    }
  }

  /**
   * Inicializa os padrões de reconhecimento para elementos comuns em webmails
   */
  private initializePatterns(): void {
    // Padrões comuns para todos os provedores
    const commonPatterns: ElementPattern[] = [
      {
        type: 'composeButton',
        provider: 'all',
        heuristics: {
          role: ['button'],
          textContent: /compose|write|new|novo|escrever/i,
          position: 'left',
          attributes: {
            'aria-label': /compose|write|new|novo|escrever/i,
          },
        },
        confidence: 0.8,
      },
      {
        type: 'inboxFolder',
        provider: 'all',
        heuristics: {
          textContent: /inbox|entrada|caixa de entrada/i,
          position: 'left',
        },
        confidence: 0.7,
      },
      {
        type: 'searchBox',
        provider: 'all',
        heuristics: {
          role: ['searchbox', 'textbox'],
          attributes: {
            'placeholder': /search|buscar|pesquisar/i,
            'type': 'text',
          },
          position: 'top',
        },
        confidence: 0.7,
      },
      {
        type: 'emailList',
        provider: 'all',
        heuristics: {
          role: ['list', 'grid', 'table'],
          position: 'center',
        },
        confidence: 0.6,
      },
      {
        type: 'emailItem',
        provider: 'all',
        heuristics: {
          role: ['listitem', 'row'],
          relativeTo: {
            element: 'emailList',
            position: 'below',
          },
        },
        confidence: 0.6,
      },
    ];

    // Padrões específicos para o Gmail
    const gmailPatterns: ElementPattern[] = [
      {
        type: 'composeButton',
        provider: 'gmail',
        selectors: ['div[role="button"][gh="cm"]', 'div.T-I.T-I-KE'],
        heuristics: {
          role: 'button',
          position: 'left',
          cssClasses: ['T-I', 'T-I-KE'],
        },
        confidence: 0.9,
      },
      {
        type: 'settingsButton',
        provider: 'gmail',
        heuristics: {
          role: 'button',
          position: 'right',
          attributes: {
            'aria-label': /settings|configurações/i,
          },
        },
        confidence: 0.8,
      },
      {
        type: 'starredFolder',
        provider: 'gmail',
        heuristics: {
          textContent: /starred|com estrela/i,
          position: 'left',
          isNear: 'inboxFolder',
        },
        confidence: 0.8,
      },
    ];

    // Padrões específicos para o Outlook
    const outlookPatterns: ElementPattern[] = [
      {
        type: 'composeButton',
        provider: 'outlook',
        selectors: ['button[aria-label="New mail"]', 'button.ms-Button--commandBar:first-child'],
        heuristics: {
          role: 'button',
          position: 'left',
          textContent: /new|novo/i,
        },
        confidence: 0.9,
      },
      {
        type: 'folderList',
        provider: 'outlook',
        heuristics: {
          role: 'tree',
          position: 'left',
        },
        confidence: 0.8,
      },
    ];

    // Padrões específicos para o Yahoo
    const yahooPatterns: ElementPattern[] = [
      {
        type: 'composeButton',
        provider: 'yahoo',
        selectors: ['a[data-test-id="compose-button"]', 'a.p_R'],
        heuristics: {
          textContent: /compose|escrever/i,
          position: 'left',
        },
        confidence: 0.9,
      },
      {
        type: 'folderList',
        provider: 'yahoo',
        heuristics: {
          role: 'navigation',
          position: 'left',
        },
        confidence: 0.8,
      },
    ];

    // Combinar todos os padrões
    this.patterns = [
      ...commonPatterns,
      ...gmailPatterns,
      ...outlookPatterns,
      ...yahooPatterns,
    ];
  }

  /**
   * Detecta elementos na página atual com base nos padrões configurados
   * @param type Tipo específico de elemento a detectar, ou null para todos
   * @param forceRefresh Se deve ignorar o cache e forçar nova detecção
   * @returns Lista de elementos detectados, ordenados por confiança
   */
  public async detectElements(
    type?: string, 
    forceRefresh = false
  ): Promise<DetectedElement[]> {
    const now = Date.now();
    const cacheKey = type || 'all';

    // Verificar cache se não forçar atualização
    if (!forceRefresh && this.elementCache.has(cacheKey)) {
      const cached = this.elementCache.get(cacheKey)!;
      if (now - cached.timestamp < this.options.cacheDuration) {
        return [cached.element];
      }
    }

    // Filtrar padrões por tipo se especificado
    const patternsToCheck = type 
      ? this.patterns.filter(p => p.type === type)
      : this.patterns;

    // Filtrar padrões por provedor atual ou comuns a todos
    const filteredPatterns = patternsToCheck.filter(
      p => p.provider === this.provider || p.provider === 'all'
    );

    // Lista de resultados detectados
    const detectedElements: DetectedElement[] = [];

    // Analisar cada padrão de elemento
    for (const pattern of filteredPatterns) {
      // Verificar seletores conhecidos primeiro (mais rápido)
      if (pattern.selectors) {
        for (const selector of pattern.selectors) {
          try {
            const element = await this.page.$(selector);
            if (element) {
              const boundingBox = await element.boundingBox();
              const text = await element.textContent();
              
              detectedElements.push({
                type: pattern.type,
                selector,
                confidence: pattern.confidence,
                text,
                position: boundingBox ? {
                  x: boundingBox.x,
                  y: boundingBox.y,
                  width: boundingBox.width,
                  height: boundingBox.height,
                } : undefined,
              });
              
              break; // Encontrou elemento com este padrão, não precisa verificar outros seletores
            }
          } catch (error) {
            console.error(`Erro ao verificar seletor ${selector}:`, error);
          }
        }
      }

      // Se não encontrou com seletores, usar heurísticas
      if (!detectedElements.some(e => e.type === pattern.type)) {
        const element = await this.detectElementByHeuristics(pattern);
        if (element) {
          detectedElements.push(element);
        }
      }
    }

    // Ordenar por confiança (mais confiável primeiro)
    const sortedElements = detectedElements
      .sort((a, b) => b.confidence - a.confidence)
      .filter(e => e.confidence >= this.options.minConfidence);

    // Atualizar cache para cada tipo de elemento
    sortedElements.forEach(element => {
      this.elementCache.set(element.type, {
        element,
        timestamp: now
      });
    });

    // Se solicitado um tipo específico, filtrar somente esse tipo
    return type 
      ? sortedElements.filter(e => e.type === type)
      : sortedElements;
  }

  /**
   * Detecta um elemento usando heurísticas complexas
   * @param pattern Padrão a ser usado para detecção
   * @returns Elemento detectado ou null se não encontrado
   */
  private async detectElementByHeuristics(
    pattern: ElementPattern
  ): Promise<DetectedElement | null> {
    try {
      // Lista de candidatos que podem corresponder ao elemento
      let candidates: any[] = [];
      const h = pattern.heuristics;
      
      // 1. Buscar por papel ARIA
      if (h.role) {
        const roles = Array.isArray(h.role) ? h.role : [h.role];
        for (const role of roles) {
          const elements = await this.page.$$(`[role="${role}"]`);
          candidates = [...candidates, ...elements];
        }
      }
      
      // 2. Buscar por conteúdo de texto
      if (h.textContent) {
        let textCandidates: any[] = [];
        
        if (typeof h.textContent === 'string') {
          // Texto exato
          textCandidates = await this.page.$$(`text="${h.textContent}"`);
        } else if (h.textContent instanceof RegExp) {
          // Expressão regular - precisa avaliar todos os elementos com texto
          const elements = await this.page.$$('body *');
          for (const element of elements) {
            const text = await element.textContent();
            if (text && h.textContent.test(text)) {
              textCandidates.push(element);
            }
          }
        }
        
        candidates = candidates.length ? 
          candidates.filter(c => textCandidates.includes(c)) : 
          textCandidates;
      }
      
      // 3. Buscar por classes CSS
      if (h.cssClasses && h.cssClasses.length && candidates.length) {
        candidates = await this.filterByClasses(candidates, h.cssClasses);
      }
      
      // 4. Buscar por atributos específicos
      if (h.attributes && Object.keys(h.attributes).length) {
        const attrCandidates: any[] = [];
        
        for (const [attr, value] of Object.entries(h.attributes)) {
          if (typeof value === 'string') {
            // Valor exato
            const elements = await this.page.$$(`[${attr}="${value}"]`);
            attrCandidates.push(...elements);
          } else if (value instanceof RegExp) {
            // Expressão regular - precisa avaliar um a um
            const elements = await this.page.$$(`[${attr}]`);
            for (const element of elements) {
              const attrValue = await element.getAttribute(attr);
              if (attrValue && value.test(attrValue)) {
                attrCandidates.push(element);
              }
            }
          }
        }
        
        candidates = candidates.length ? 
          candidates.filter(c => attrCandidates.includes(c)) : 
          attrCandidates;
      }
      
      // 5. Filtrar por posição na tela
      if (h.position && candidates.length) {
        candidates = await this.filterByPosition(candidates, h.position);
      }
      
      // 6. Filtrar por proximidade a outro elemento
      if (h.isNear && candidates.length) {
        const nearElements = await this.detectElements(h.isNear);
        if (nearElements.length) {
          candidates = await this.filterByProximity(candidates, nearElements[0]);
        }
      }
      
      // 7. Filtrar por posição relativa a outro elemento
      if (h.relativeTo && candidates.length) {
        const relativeElements = await this.detectElements(h.relativeTo.element);
        if (relativeElements.length) {
          candidates = await this.filterByRelativePosition(
            candidates, 
            relativeElements[0], 
            h.relativeTo.position,
            h.relativeTo.distance
          );
        }
      }
      
      // Se não encontrou candidatos, retornar null
      if (!candidates.length) {
        return null;
      }
      
      // Encontrou candidatos, selecionar o melhor
      const bestCandidate = candidates[0];
      
      // Extrair informações do melhor candidato
      const boundingBox = await bestCandidate.boundingBox();
      const text = await bestCandidate.textContent();
      const role = await bestCandidate.getAttribute('role');
      
      // Gerar um seletor único para este elemento
      const selector = await this.generateUniqueSelector(bestCandidate);
      
      // Calcular confiança final (baseado no padrão e em fatores adicionais)
      let confidence = pattern.confidence;
      
      // Ajustar confiança com base em fatores adicionais
      if (pattern.selectors && pattern.selectors.includes(selector)) {
        confidence += 0.2; // Aumentar se o seletor corresponde exatamente a um conhecido
      }
      
      if (text && h.textContent && 
          (typeof h.textContent === 'string' ? text === h.textContent : h.textContent.test(text))) {
        confidence += 0.1; // Aumentar se o texto corresponde exatamente
      }
      
      // Nunca exceder 1.0 de confiança
      confidence = Math.min(confidence, 1.0);
      
      // Criar o elemento detectado
      const detectedElement: DetectedElement = {
        type: pattern.type,
        selector,
        confidence,
        role,
        text,
        position: boundingBox ? {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        } : undefined,
      };
      
      // Adicionar aos seletores adaptativos para uso futuro
      this.adaptiveSelectors.addSelector(pattern.type, selector);
      
      return detectedElement;
    } catch (error) {
      console.error(`Erro ao detectar ${pattern.type} por heurísticas:`, error);
      return null;
    }
  }

  /**
   * Filtra elementos por classes CSS
   */
  private async filterByClasses(elements: any[], classes: string[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const element of elements) {
      const classList = await this.page.evaluate(
        (el: any) => Array.from(el.classList), 
        element
      );
      
      if (classes.some(cls => classList.includes(cls))) {
        results.push(element);
      }
    }
    
    return results;
  }

  /**
   * Filtra elementos por posição na tela
   */
  private async filterByPosition(
    elements: any[], 
    position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  ): Promise<any[]> {
    const viewportSize = await this.page.viewportSize();
    const midX = viewportSize.width / 2;
    const midY = viewportSize.height / 2;
    
    // Obter posições de todos os elementos
    const elementsWithPosition = await Promise.all(
      elements.map(async (el) => {
        const box = await el.boundingBox();
        if (!box) return { element: el, box: null };
        
        return { 
          element: el, 
          box,
          centerX: box.x + box.width / 2,
          centerY: box.y + box.height / 2,
        };
      })
    );
    
    // Filtrar elementos sem posição
    const validElements = elementsWithPosition.filter(e => e.box !== null);
    
    // Ordenar por posição
    switch (position) {
      case 'top':
        validElements.sort((a, b) => a.box!.y - b.box!.y);
        break;
      case 'bottom':
        validElements.sort((a, b) => b.box!.y - a.box!.y);
        break;
      case 'left':
        validElements.sort((a, b) => a.box!.x - b.box!.x);
        break;
      case 'right':
        validElements.sort((a, b) => b.box!.x - a.box!.x);
        break;
      case 'center':
        // Ordenar por distância ao centro
        validElements.sort((a, b) => {
          const distA = Math.sqrt(
            Math.pow(a.centerX! - midX, 2) + 
            Math.pow(a.centerY! - midY, 2)
          );
          const distB = Math.sqrt(
            Math.pow(b.centerX! - midX, 2) + 
            Math.pow(b.centerY! - midY, 2)
          );
          return distA - distB;
        });
        break;
    }
    
    // Retornar elementos ordenados
    return validElements.map(e => e.element);
  }

  /**
   * Filtra elementos pela proximidade a outro elemento
   */
  private async filterByProximity(
    elements: any[], 
    reference: DetectedElement, 
    maxDistance = 200
  ): Promise<any[]> {
    if (!reference.position) {
      return elements;
    }
    
    const refCenter = {
      x: reference.position.x + reference.position.width / 2,
      y: reference.position.y + reference.position.height / 2
    };
    
    // Calcular distância para cada elemento
    const elementsWithDistance = await Promise.all(
      elements.map(async (el) => {
        const box = await el.boundingBox();
        if (!box) return { element: el, distance: Infinity };
        
        const elCenter = {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2
        };
        
        const distance = Math.sqrt(
          Math.pow(elCenter.x - refCenter.x, 2) + 
          Math.pow(elCenter.y - refCenter.y, 2)
        );
        
        return { element: el, distance };
      })
    );
    
    // Filtrar por distância máxima e ordenar do mais próximo ao mais distante
    return elementsWithDistance
      .filter(e => e.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map(e => e.element);
  }

  /**
   * Filtra elementos por posição relativa a outro elemento
   */
  private async filterByRelativePosition(
    elements: any[],
    reference: DetectedElement,
    position: 'above' | 'below' | 'left' | 'right',
    maxDistance = 200
  ): Promise<any[]> {
    if (!reference.position) {
      return elements;
    }
    
    const refBox = reference.position;
    
    // Filtrar elementos pela posição relativa
    const validElements = await Promise.all(
      elements.map(async (el) => {
        const box = await el.boundingBox();
        if (!box) return { element: el, valid: false, distance: Infinity };
        
        let valid = false;
        let distance = Infinity;
        
        switch (position) {
          case 'above':
            valid = box.y + box.height <= refBox.y;
            distance = refBox.y - (box.y + box.height);
            break;
          case 'below':
            valid = box.y >= refBox.y + refBox.height;
            distance = box.y - (refBox.y + refBox.height);
            break;
          case 'left':
            valid = box.x + box.width <= refBox.x;
            distance = refBox.x - (box.x + box.width);
            break;
          case 'right':
            valid = box.x >= refBox.x + refBox.width;
            distance = box.x - (refBox.x + refBox.width);
            break;
        }
        
        return { element: el, valid, distance };
      })
    );
    
    // Filtrar elementos válidos dentro da distância máxima
    return validElements
      .filter(e => e.valid && e.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map(e => e.element);
  }

  /**
   * Gera um seletor CSS único para o elemento
   */
  private async generateUniqueSelector(element: any): Promise<string> {
    return await this.page.evaluate((el: any) => {
      // Função auxiliar para verificar se um seletor é único
      const isUnique = (selector: string): boolean => {
        return document.querySelectorAll(selector).length === 1;
      };
      
      // Tentar ID primeiro
      if (el.id) {
        const selector = `#${el.id}`;
        if (isUnique(selector)) return selector;
      }
      
      // Tentar com atributos específicos
      const importantAttrs = [
        'data-test-id',
        'data-testid',
        'data-automation-id',
        'data-qa',
        'aria-label',
        'name',
        'title'
      ];
      
      for (const attr of importantAttrs) {
        if (el.hasAttribute(attr)) {
          const value = el.getAttribute(attr);
          const selector = `[${attr}="${value}"]`;
          if (isUnique(selector)) return selector;
        }
      }
      
      // Tentar com tag e classes
      if (el.classList.length) {
        const classes = Array.from(el.classList).join('.');
        const selector = `${el.tagName.toLowerCase()}.${classes}`;
        if (isUnique(selector)) return selector;
      }
      
      // Tentar com tag e atributo role
      if (el.hasAttribute('role')) {
        const selector = `${el.tagName.toLowerCase()}[role="${el.getAttribute('role')}"]`;
        if (isUnique(selector)) return selector;
      }
      
      // Construir seletor com caminho de hierarquia
      let current = el;
      let selector = el.tagName.toLowerCase();
      let unique = false;
      
      // Adicionar classes se presentes
      if (el.classList.length) {
        selector += `.${Array.from(el.classList).join('.')}`;
      }
      
      // Verificar se já é único
      unique = isUnique(selector);
      
      // Se não for único, construir hierarquia
      while (!unique && current.parentElement) {
        let parentSelector = current.parentElement.tagName.toLowerCase();
        
        // Adicionar id do pai se disponível
        if (current.parentElement.id) {
          parentSelector = `#${current.parentElement.id}`;
        } 
        // Ou classes do pai
        else if (current.parentElement.classList.length) {
          parentSelector += `.${Array.from(current.parentElement.classList).join('.')}`;
        }
        
        // Adicionar índice do filho para maior especificidade
        const siblings = Array.from(current.parentElement.children);
        const index = siblings.indexOf(current);
        
        selector = `${parentSelector} > ${selector}`;
        // Ou com índice se ainda não for único
        if (!isUnique(selector)) {
          selector = `${parentSelector} > :nth-child(${index + 1})`;
        }
        
        // Verificar se agora é único
        unique = isUnique(selector);
        
        // Subir na hierarquia
        current = current.parentElement;
        
        // Evitar seletores muito longos
        if (selector.length > 200) {
          break;
        }
      }
      
      return selector;
    }, element);
  }

  /**
   * Detecta um elemento específico por tipo
   * @param type Tipo de elemento a detectar
   * @returns O elemento detectado ou null se não encontrado
   */
  public async detectElement(type: string): Promise<DetectedElement | null> {
    const elements = await this.detectElements(type);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Espera pela detecção de um elemento e retorna quando encontrado
   * @param type Tipo de elemento a esperar
   * @param options Opções adicionais
   * @returns O elemento detectado ou null se o timeout for atingido
   */
  public async waitForElement(
    type: string, 
    options: { 
      timeout?: number,
      minConfidence?: number 
    } = {}
  ): Promise<DetectedElement | null> {
    const timeout = options.timeout || this.options.locateTimeout;
    const minConfidence = options.minConfidence || this.options.minConfidence;
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = await this.detectElement(type);
      
      if (element && element.confidence >= minConfidence) {
        return element;
      }
      
      // Esperar um pouco antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return null;
  }

  /**
   * Clica em um elemento detectado por tipo
   * @param type Tipo do elemento a clicar
   * @param options Opções adicionais
   * @returns Sucesso da operação
   */
  public async clickElement(
    type: string, 
    options: { 
      timeout?: number, 
      humanLike?: boolean 
    } = {}
  ): Promise<boolean> {
    const element = await this.waitForElement(type, { timeout: options.timeout });
    
    if (!element) {
      return false;
    }
    
    try {
      if (options.humanLike) {
        // Mover o mouse naturalmente e depois clicar
        await this.page.hover(element.selector);
        // Pequena pausa antes de clicar (comportamento humano)
        await this.page.waitForTimeout(100 + Math.random() * 300);
      }
      
      await this.page.click(element.selector);
      return true;
    } catch (error) {
      console.error(`Erro ao clicar no elemento ${type}:`, error);
      return false;
    }
  }

  /**
   * Aprende novos padrões analisando a estrutura da interface
   * @returns Número de novos padrões aprendidos
   */
  public async learnNewPatterns(): Promise<number> {
    if (!this.options.learningEnabled) {
      return 0;
    }
    
    let newPatternsCount = 0;
    
    try {
      // Analisar elementos importantes na página
      
      // 1. Encontrar botões proeminentes
      const buttons = await this.page.$$('button, [role="button"]');
      
      for (const button of buttons.slice(0, 10)) { // Limitar aos 10 primeiros para eficiência
        const text = await button.textContent();
        const box = await button.boundingBox();
        
        if (!text || !box) continue;
        
        // Verificar se é um botão grande ou proeminente
        const isProminent = box.width > 100 || box.height > 40;
        const textLower = text.toLowerCase().trim();
        
        // Detectar botões de ação importantes
        if (isProminent) {
          // Verificar se já temos um padrão para este tipo de botão
          let type = '';
          
          if (/compos|write|new|novo|escrever/i.test(textLower)) {
            type = 'composeButton';
          } else if (/send|enviar/i.test(textLower)) {
            type = 'sendButton';
          } else if (/save|salvar/i.test(textLower)) {
            type = 'saveButton';
          } else if (/delete|excluir|remover/i.test(textLower)) {
            type = 'deleteButton';
          } else if (/cancel|cancelar/i.test(textLower)) {
            type = 'cancelButton';
          } else if (/reply|responder/i.test(textLower)) {
            type = 'replyButton';
          } else if (/forward|encaminhar/i.test(textLower)) {
            type = 'forwardButton';
          }
          
          if (type && !this.patterns.some(p => p.type === type && p.provider === this.provider)) {
            // Gerar seletor para este botão
            const selector = await this.generateUniqueSelector(button);
            
            // Criar novo padrão
            const newPattern: ElementPattern = {
              type,
              provider: this.provider,
              selectors: [selector],
              heuristics: {
                role: 'button',
                textContent: new RegExp(textLower, 'i'),
              },
              confidence: 0.8,
            };
            
            this.patterns.push(newPattern);
            newPatternsCount++;
            
            // Adicionar ao AdaptiveSelectors também
            this.adaptiveSelectors.addSelector(type, selector);
          }
        }
      }
      
      // 2. Encontrar listas de emails ou mensagens
      const lists = await this.page.$$('[role="list"], [role="grid"], [role="table"]');
      
      for (const list of lists) {
        const children = await list.$$(':scope > *');
        
        // Verificar se esta lista tem vários filhos semelhantes (provável lista de emails)
        if (children.length > 3) {
          const selector = await this.generateUniqueSelector(list);
          
          // Verificar se já temos um padrão para lista de emails
          if (!this.patterns.some(p => 
            p.type === 'emailList' && 
            p.provider === this.provider &&
            p.selectors?.includes(selector)
          )) {
            // Adicionar seletor a um padrão existente ou criar novo
            const existingPattern = this.patterns.find(p => 
              p.type === 'emailList' && p.provider === this.provider
            );
            
            if (existingPattern && existingPattern.selectors) {
              existingPattern.selectors.push(selector);
            } else {
              this.patterns.push({
                type: 'emailList',
                provider: this.provider,
                selectors: [selector],
                heuristics: {
                  role: ['list', 'grid', 'table'],
                },
                confidence: 0.7,
              });
            }
            
            // Adicionar ao AdaptiveSelectors
            this.adaptiveSelectors.addSelector('emailList', selector);
            newPatternsCount++;
          }
          
          // Analisar um item da lista para identificar padrão de item de email
          if (children.length > 0) {
            const itemSelector = await this.generateUniqueSelector(children[0]);
            
            if (!this.patterns.some(p => 
              p.type === 'emailItem' && 
              p.provider === this.provider &&
              p.selectors?.includes(itemSelector)
            )) {
              const existingPattern = this.patterns.find(p => 
                p.type === 'emailItem' && p.provider === this.provider
              );
              
              if (existingPattern && existingPattern.selectors) {
                existingPattern.selectors.push(itemSelector);
              } else {
                this.patterns.push({
                  type: 'emailItem',
                  provider: this.provider,
                  selectors: [itemSelector],
                  heuristics: {
                    role: ['listitem', 'row', 'article'],
                  },
                  confidence: 0.7,
                });
              }
              
              this.adaptiveSelectors.addSelector('emailItem', itemSelector);
              newPatternsCount++;
            }
          }
        }
      }
      
      // 3. Encontrar caixa de pesquisa
      const searchInputs = await this.page.$$('input[type="text"], input[type="search"], [role="searchbox"]');
      
      for (const input of searchInputs) {
        const placeholder = await input.getAttribute('placeholder');
        const ariaLabel = await input.getAttribute('aria-label');
        
        if ((placeholder && /search|busca|pesquisa/i.test(placeholder)) ||
            (ariaLabel && /search|busca|pesquisa/i.test(ariaLabel))) {
          
          const selector = await this.generateUniqueSelector(input);
          
          if (!this.patterns.some(p => 
            p.type === 'searchBox' && 
            p.provider === this.provider &&
            p.selectors?.includes(selector)
          )) {
            const existingPattern = this.patterns.find(p => 
              p.type === 'searchBox' && p.provider === this.provider
            );
            
            if (existingPattern && existingPattern.selectors) {
              existingPattern.selectors.push(selector);
            } else {
              this.patterns.push({
                type: 'searchBox',
                provider: this.provider,
                selectors: [selector],
                heuristics: {
                  role: ['searchbox', 'textbox'],
                  attributes: {
                    'placeholder': /search|busca|pesquisa/i,
                  },
                },
                confidence: 0.8,
              });
            }
            
            this.adaptiveSelectors.addSelector('searchBox', selector);
            newPatternsCount++;
          }
        }
      }
      
    } catch (error) {
      console.error('Erro ao aprender novos padrões:', error);
    }
    
    return newPatternsCount;
  }

  /**
   * Exporta todos os padrões e seletores aprendidos
   * Útil para persistir o conhecimento entre sessões
   */
  public exportLearnedPatterns(): {
    patterns: ElementPattern[],
    selectors: SelectorMap,
    fallbackSelectors: SelectorMap
  } {
    // Obter seletores do AdaptiveSelectors
    const exportedSelectors = {} as SelectorMap;
    const exportedFallbackSelectors = {} as SelectorMap;
    
    // Executar exportação em cada padrão
    const filteredPatterns = this.patterns.filter(
      p => p.provider === this.provider || p.provider === 'all'
    );
    
    return {
      patterns: filteredPatterns,
      selectors: exportedSelectors,
      fallbackSelectors: exportedFallbackSelectors
    };
  }

  /**
   * Importa padrões e seletores previamente exportados
   * @param data Dados exportados anteriormente
   * @returns Número de padrões importados
   */
  public importLearnedPatterns(data: {
    patterns?: ElementPattern[],
    selectors?: SelectorMap,
    fallbackSelectors?: SelectorMap
  }): number {
    let count = 0;
    
    if (data.patterns) {
      // Importar padrões, evitando duplicatas
      data.patterns.forEach(pattern => {
        if (!this.patterns.some(p => 
          p.type === pattern.type && 
          p.provider === pattern.provider
        )) {
          this.patterns.push(pattern);
          count++;
        }
      });
    }
    
    if (data.selectors) {
      // Importar seletores para o AdaptiveSelectors
      Object.entries(data.selectors).forEach(([key, value]) => {
        if (typeof value === 'string') {
          this.adaptiveSelectors.addSelector(key, value);
        }
      });
    }
    
    return count;
  }

  /**
   * Obtém o seletor para um tipo de elemento específico
   * @param type Tipo de elemento
   * @returns Seletor CSS ou null se não encontrado
   */
  public async getSelector(type: string): Promise<string | null> {
    // Verificar se temos um seletor adaptativo
    const adaptiveSelector = await this.adaptiveSelectors.getSelector(type);
    if (adaptiveSelector) {
      return adaptiveSelector;
    }
    
    // Usar detecção se não encontrou um seletor adaptativo
    const element = await this.detectElement(type);
    return element ? element.selector : null;
  }
}

/**
 * Factory function para criar um ElementDetector
 */
export function createElementDetector(
  provider: WebmailProvider,
  page: any,
  options: Omit<ElementDetectorOptions, 'provider' | 'page'> = {}
): ElementDetector {
  return new ElementDetector({
    provider,
    page,
    ...options
  });
}