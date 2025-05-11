/**
 * Sistema avançado para gerenciamento de entradas em interfaces web
 * Coordena interações de teclado, mouse e toque com padrões realistas
 */

import { HumanInteraction } from './human-interaction';
import { HumanBehaviorSimulator } from './human-behavior';

/**
 * Interface para configuração do InputManager
 */
export interface InputManagerOptions {
  useHumanInteraction?: boolean;     // Ativar simulação de interações humanas
  inputDelay?: number;               // Atraso base entre interações
  randomizationFactor?: number;      // Fator para aleatorização de interações
  useShortcuts?: boolean;            // Permitir uso de atalhos de teclado
  avoidDetection?: boolean;          // Usar técnicas para evitar detecção
  recordInteractions?: boolean;      // Registrar interações para análise
  customInputPatterns?: any;         // Padrões personalizados de input
}

/**
 * Tipos de ação para controle de teclado
 */
export type KeyboardAction = 
  | 'press'         // Pressionar e soltar uma tecla
  | 'down'          // Manter tecla pressionada
  | 'up'            // Soltar tecla
  | 'type'          // Digitar texto
  | 'shortcut';     // Executar atalho de teclado

/**
 * Interface para atalhos de teclado
 */
export interface KeyboardShortcut {
  name: string;
  keys: string[];
  description?: string;
}

/**
 * Classe responsável por gerenciar entradas em interfaces web
 * Fornece métodos para interação coordenada com teclado, mouse e toque
 */
export class InputManager {
  private humanInteraction: HumanInteraction;
  private page: any; // Objeto página do Playwright
  private keyboardShortcuts: Map<string, KeyboardShortcut>;
  private options: InputManagerOptions;
  private keyDownStates: Map<string, boolean>; // Teclas pressionadas atualmente
  private lastActionTime: number = 0;
  private interactionHistory: Array<{
    action: string;
    timestamp: number;
    details: any;
  }> = [];
  
  constructor(
    page: any,
    humanInteraction?: HumanInteraction,
    options: InputManagerOptions = {}
  ) {
    this.page = page;
    
    // Criar instância de HumanInteraction se não fornecida
    if (humanInteraction) {
      this.humanInteraction = humanInteraction;
    } else {
      this.humanInteraction = new HumanInteraction(page, new HumanBehaviorSimulator());
    }
    
    // Configuração padrão
    this.options = {
      useHumanInteraction: true,
      inputDelay: 50,
      randomizationFactor: 0.3,
      useShortcuts: true,
      avoidDetection: true,
      recordInteractions: false,
      ...options
    };
    
    // Inicializar coleções
    this.keyboardShortcuts = new Map<string, KeyboardShortcut>();
    this.keyDownStates = new Map<string, boolean>();
    
    // Inicializar atalhos comuns
    this.initializeCommonShortcuts();
  }
  
  /**
   * Inicializa atalhos de teclado comuns
   */
  private initializeCommonShortcuts(): void {
    const commonShortcuts: KeyboardShortcut[] = [
      { name: 'copy', keys: ['Control', 'c'], description: 'Copiar' },
      { name: 'paste', keys: ['Control', 'v'], description: 'Colar' },
      { name: 'cut', keys: ['Control', 'x'], description: 'Recortar' },
      { name: 'selectAll', keys: ['Control', 'a'], description: 'Selecionar tudo' },
      { name: 'undo', keys: ['Control', 'z'], description: 'Desfazer' },
      { name: 'redo', keys: ['Control', 'y'], description: 'Refazer' },
      { name: 'reload', keys: ['F5'], description: 'Recarregar página' },
      { name: 'save', keys: ['Control', 's'], description: 'Salvar' },
      { name: 'find', keys: ['Control', 'f'], description: 'Buscar' }
    ];
    
    // Adicionar atalhos à coleção
    for (const shortcut of commonShortcuts) {
      this.keyboardShortcuts.set(shortcut.name, shortcut);
    }
  }
  
  /**
   * Adiciona um novo atalho de teclado
   */
  public addShortcut(name: string, keys: string[], description?: string): void {
    this.keyboardShortcuts.set(name, { name, keys, description });
  }
  
  /**
   * Registra uma interação no histórico
   */
  private recordInteraction(action: string, details: any): void {
    if (!this.options.recordInteractions) return;
    
    this.interactionHistory.push({
      action,
      timestamp: Date.now(),
      details
    });
    
    // Limitar o tamanho do histórico para evitar consumo excessivo de memória
    if (this.interactionHistory.length > 1000) {
      this.interactionHistory.shift();
    }
  }
  
  /**
   * Calcula atraso natural entre interações
   */
  private calculateDelay(): number {
    const baseDelay = this.options.inputDelay || 50;
    const randomFactor = this.options.randomizationFactor || 0.3;
    
    // Adicionar variação aleatória
    return baseDelay * (1 + (Math.random() - 0.5) * 2 * randomFactor);
  }
  
  /**
   * Executa uma ação de teclado com padrão humanizado
   */
  public async keyboardAction(
    action: KeyboardAction,
    input: string,
    options: {
      modifiers?: string[];
      delay?: number;
    } = {}
  ): Promise<boolean> {
    try {
      // Calcular atraso natural
      const delay = options.delay || this.calculateDelay();
      
      // Aplicar atraso desde a última ação
      const timeSinceLastAction = Date.now() - this.lastActionTime;
      if (timeSinceLastAction < delay) {
        await new Promise(resolve => setTimeout(resolve, delay - timeSinceLastAction));
      }
      
      // Preparar modificadores (Ctrl, Alt, Shift, etc.)
      const modifiers = options.modifiers || [];
      
      // Executar ação específica
      switch (action) {
        case 'press':
          // Pressionar teclas modificadoras
          for (const modifier of modifiers) {
            await this.page.keyboard.down(modifier);
            this.keyDownStates.set(modifier, true);
          }
          
          // Pressionar e soltar a tecla principal
          await this.page.keyboard.press(input);
          
          // Soltar teclas modificadoras
          for (const modifier of modifiers) {
            await this.page.keyboard.up(modifier);
            this.keyDownStates.set(modifier, false);
          }
          break;
          
        case 'down':
          await this.page.keyboard.down(input);
          this.keyDownStates.set(input, true);
          break;
          
        case 'up':
          await this.page.keyboard.up(input);
          this.keyDownStates.set(input, false);
          break;
          
        case 'type':
          if (this.options.useHumanInteraction) {
            // Usar simulação de digitação humana em campo ativo
            const activeElement = await this.page.evaluateHandle(() => document.activeElement);
            if (activeElement) {
              // Criar seletor para o elemento ativo
              const uniqueId = 'temp-id-' + Math.random().toString(36).substring(2);
              await this.page.evaluate((el, id) => el.setAttribute('data-input-id', id), activeElement, uniqueId);
              
              // Usar simulação humana
              await this.humanInteraction.simulateTyping(`[data-input-id="${uniqueId}"]`, input);
              
              // Remover o atributo temporário
              await this.page.evaluate((el) => el.removeAttribute('data-input-id'), activeElement);
            } else {
              // Fallback para digitação normal
              await this.page.keyboard.type(input);
            }
          } else {
            // Digitação normal
            await this.page.keyboard.type(input);
          }
          break;
          
        case 'shortcut':
          // Usar atalho predefinido pelo nome
          const shortcut = this.keyboardShortcuts.get(input);
          if (shortcut) {
            // Pressionar todas as teclas do atalho
            for (const key of shortcut.keys) {
              await this.page.keyboard.down(key);
              this.keyDownStates.set(key, true);
            }
            
            // Pequena pausa
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Soltar todas as teclas do atalho (na ordem inversa)
            for (let i = shortcut.keys.length - 1; i >= 0; i--) {
              await this.page.keyboard.up(shortcut.keys[i]);
              this.keyDownStates.set(shortcut.keys[i], false);
            }
          } else {
            console.warn(`Atalho não encontrado: ${input}`);
            return false;
          }
          break;
      }
      
      // Atualizar timestamp da última ação
      this.lastActionTime = Date.now();
      
      // Registrar interação
      this.recordInteraction(`keyboard_${action}`, { input, modifiers });
      
      return true;
    } catch (error) {
      console.error(`Erro ao executar ação de teclado (${action}):`, error);
      return false;
    }
  }
  
  /**
   * Executa uma combinação de teclas
   */
  public async pressKeys(keys: string[]): Promise<boolean> {
    try {
      // Pressionar todas as teclas
      for (const key of keys) {
        await this.page.keyboard.down(key);
        this.keyDownStates.set(key, true);
      }
      
      // Pequena pausa
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
      
      // Soltar todas as teclas (na ordem inversa)
      for (let i = keys.length - 1; i >= 0; i--) {
        await this.page.keyboard.up(keys[i]);
        this.keyDownStates.set(keys[i], false);
      }
      
      // Atualizar timestamp da última ação
      this.lastActionTime = Date.now();
      
      // Registrar interação
      this.recordInteraction('press_keys', { keys });
      
      return true;
    } catch (error) {
      console.error('Erro ao pressionar combinação de teclas:', error);
      
      // Garantir que todas as teclas sejam liberadas em caso de erro
      for (const key of keys) {
        if (this.keyDownStates.get(key)) {
          await this.page.keyboard.up(key).catch(() => {});
          this.keyDownStates.set(key, false);
        }
      }
      
      return false;
    }
  }
  
  /**
   * Digita texto em um campo com padrão humanizado
   */
  public async typeText(
    selector: string,
    text: string
  ): Promise<boolean> {
    if (this.options.useHumanInteraction) {
      return this.humanInteraction.simulateTyping(selector, text);
    } else {
      try {
        // Focar e limpar o campo
        await this.page.focus(selector);
        await this.page.fill(selector, '');
        
        // Digitar texto com atrasos entre teclas
        for (let i = 0; i < text.length; i++) {
          await this.page.type(selector, text[i], { delay: this.calculateDelay() });
        }
        
        // Registrar interação
        this.recordInteraction('type_text', { selector, textLength: text.length });
        
        return true;
      } catch (error) {
        console.error('Erro ao digitar texto:', error);
        return false;
      }
    }
  }
  
  /**
   * Realiza clique em um elemento com padrão humanizado
   */
  public async click(
    selector: string,
    options: {
      button?: 'left' | 'right' | 'middle';
      doubleClick?: boolean;
      humanized?: boolean;
    } = {}
  ): Promise<boolean> {
    // Usar interação humana se ativado nas opções
    if (this.options.useHumanInteraction && options.humanized !== false) {
      return this.humanInteraction.simulateClick(selector, {
        doubleClick: options.doubleClick || false,
        rightClick: options.button === 'right'
      });
    } else {
      try {
        if (options.doubleClick) {
          await this.page.dblclick(selector);
        } else {
          await this.page.click(selector, { 
            button: options.button || 'left',
            delay: this.calculateDelay()
          });
        }
        
        // Registrar interação
        this.recordInteraction('click', { 
          selector, 
          button: options.button || 'left',
          doubleClick: options.doubleClick || false
        });
        
        return true;
      } catch (error) {
        console.error('Erro ao clicar em elemento:', error);
        return false;
      }
    }
  }
  
  /**
   * Realiza rolagem de página com padrão humanizado
   */
  public async scroll(
    options: {
      direction?: 'up' | 'down';
      distance?: number;
      humanized?: boolean;
      selector?: string; // Opcional: rolar dentro de elemento específico
    } = {}
  ): Promise<boolean> {
    // Usar interação humana se ativado nas opções
    if (this.options.useHumanInteraction && options.humanized !== false) {
      return this.humanInteraction.simulateScroll({
        scrollDirection: options.direction || 'down',
        scrollDistance: options.distance || 300
      });
    } else {
      try {
        const distance = options.distance || 300;
        const selector = options.selector;
        const deltaY = options.direction === 'up' ? -distance : distance;
        
        if (selector) {
          // Rolar dentro de um elemento específico
          await this.page.$eval(
            selector,
            (element, scrollAmount) => {
              element.scrollBy(0, scrollAmount);
            },
            deltaY
          );
        } else {
          // Rolar a página
          await this.page.mouse.wheel(0, deltaY);
        }
        
        // Registrar interação
        this.recordInteraction('scroll', { 
          direction: options.direction || 'down',
          distance
        });
        
        return true;
      } catch (error) {
        console.error('Erro ao realizar rolagem:', error);
        return false;
      }
    }
  }
  
  /**
   * Preenche formulário completo com interações humanizadas
   */
  public async fillForm(
    formFields: Array<{
      selector: string;
      type: 'text' | 'checkbox' | 'radio' | 'select' | 'button';
      value?: string;
    }>
  ): Promise<boolean> {
    try {
      if (this.options.useHumanInteraction) {
        // Converter para formato aceito pela instância HumanInteraction
        const formattedFields = formFields.map(field => {
          const action = field.type === 'text' ? 'type' : 'click';
          return {
            selector: field.selector,
            type: field.type === 'text' ? 'input' : field.type,
            value: field.value,
            action
          };
        });
        
        // Usar método HumanInteraction para preenchimento natural
        return await this.humanInteraction.fillForm(formattedFields);
      } else {
        // Preenchimento mais direto
        for (const field of formFields) {
          switch (field.type) {
            case 'text':
              if (field.value) {
                await this.page.fill(field.selector, field.value);
              }
              break;
              
            case 'checkbox':
            case 'radio':
              await this.page.check(field.selector);
              break;
              
            case 'select':
              if (field.value) {
                await this.page.selectOption(field.selector, field.value);
              }
              break;
              
            case 'button':
              await this.page.click(field.selector);
              break;
          }
          
          // Atraso entre interações
          await new Promise(resolve => setTimeout(resolve, this.calculateDelay()));
        }
        
        // Registrar interação
        this.recordInteraction('fill_form', { formFields: formFields.length });
        
        return true;
      }
    } catch (error) {
      console.error('Erro ao preencher formulário:', error);
      return false;
    }
  }
  
  /**
   * Interage com um elemento identificado pelo texto exibido
   */
  public async interactByText(
    text: string,
    action: 'click' | 'hover' | 'rightClick' | 'doubleClick' = 'click'
  ): Promise<boolean> {
    if (this.options.useHumanInteraction) {
      return this.humanInteraction.interactWithElementByText(text, action);
    } else {
      try {
        // Localizar elemento pelo texto
        const element = await this.page.getByText(text);
        
        if (!element) {
          return false;
        }
        
        // Executar ação no elemento
        switch (action) {
          case 'click':
            await element.click();
            break;
          case 'hover':
            await element.hover();
            break;
          case 'rightClick':
            await element.click({ button: 'right' });
            break;
          case 'doubleClick':
            await element.dblclick();
            break;
        }
        
        // Registrar interação
        this.recordInteraction('interact_by_text', { text, action });
        
        return true;
      } catch (error) {
        console.error(`Erro ao interagir com texto "${text}":`, error);
        return false;
      }
    }
  }
  
  /**
   * Obtém o histórico de interações
   */
  public getInteractionHistory(): Array<{
    action: string;
    timestamp: number;
    details: any;
  }> {
    return [...this.interactionHistory];
  }
  
  /**
   * Limpa o histórico de interações
   */
  public clearInteractionHistory(): void {
    this.interactionHistory = [];
  }
  
  /**
   * Verifica e libera todas as teclas pressionadas
   * Importante chamar isso ao encerrar para evitar teclas "travadas"
   */
  public async releaseAllKeys(): Promise<void> {
    for (const [key, isDown] of this.keyDownStates.entries()) {
      if (isDown) {
        await this.page.keyboard.up(key).catch(() => {});
        this.keyDownStates.set(key, false);
      }
    }
  }
  
  /**
   * Configura as opções do gerenciador de entrada
   */
  public setOptions(options: Partial<InputManagerOptions>): void {
    this.options = {
      ...this.options,
      ...options
    };
  }
}