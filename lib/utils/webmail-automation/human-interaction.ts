/**
 * Sistema avançado para emular interações humanas com interfaces web
 * Fornece simulação realista de cliques, rolagem e interações do mouse/teclado
 */

import { HumanBehaviorSimulator } from './human-behavior';

/**
 * Interface para configuração de interações humanas
 */
export interface HumanInteractionOptions {
  errorProbability?: number;        // Probabilidade de erros em interações
  naturalMovements?: boolean;       // Mover cursor de forma natural
  realisticScrolling?: boolean;     // Emular rolagem humana
  jitterFactor?: number;            // Fator de tremor do cursor
  inertiaSimulation?: boolean;      // Simular inércia em movimentos
  randomHesitation?: boolean;       // Pausas aleatórias durante interações
  fatigueFactor?: number;           // Fator para simular fadiga em interações longas
  emotionalState?: 'calm' | 'rushed' | 'distracted'; // Afeta a variabilidade
}

/**
 * Interface para configuração de cliques
 */
export interface ClickOptions {
  doubleClick?: boolean;            // Realizar clique duplo
  rightClick?: boolean;             // Usar botão direito
  dragAfterClick?: boolean;         // Arrastar após o clique
  releasePoint?: { x: number, y: number }; // Ponto para soltar (drag)
  hesitateBeforeClick?: boolean;    // Hesitar antes de clicar
  forceClick?: boolean;             // Ignorar movimentos naturais
}

/**
 * Interface para configuração de digitação
 */
export interface TypingOptions {
  errorCorrection?: boolean;        // Corrigir erros automaticamente
  customDelayMap?: Record<string, number>; // Atrasos específicos por caractere
  capsRandomization?: boolean;      // Possível erro de Caps Lock
  keyboardLayout?: 'qwerty' | 'azerty' | 'dvorak';  // Layout do teclado
  textRegions?: { start: number, end: number, factor: number }[]; // Regiões com velocidades diferentes
  pasteText?: boolean;              // Colar em vez de digitar
}

/**
 * Interface para configuração de rolagem
 */
export interface ScrollOptions {
  smoothScrolling?: boolean;        // Rolagem suave vs. em etapas
  scrollDistance?: number;          // Distância total de rolagem
  scrollDirection?: 'up' | 'down';  // Direção da rolagem
  scrollSpeed?: number;             // Velocidade de rolagem
  pauseDuringScroll?: boolean;      // Pausar durante a rolagem
  oscillations?: boolean;           // Rolar para frente e para trás
}

/**
 * Classe principal para simular interações humanas com interfaces web
 */
export class HumanInteraction {
  private behaviorSim: HumanBehaviorSimulator;
  private options: HumanInteractionOptions;
  private page: any; // Objeto página do Playwright
  private lastMousePosition: { x: number, y: number } = { x: 0, y: 0 };
  private fatigueLevel: number = 0; // Aumenta ao longo do tempo
  private keyboardMistakeMap: Record<string, string[]>; // Mapeamento de teclas adjacentes
  
  constructor(
    page: any,
    behaviorSim?: HumanBehaviorSimulator,
    options: HumanInteractionOptions = {}
  ) {
    this.page = page;
    this.behaviorSim = behaviorSim || new HumanBehaviorSimulator();
    
    // Configuração padrão
    this.options = {
      errorProbability: 0.02,
      naturalMovements: true,
      realisticScrolling: true,
      jitterFactor: 0.3,
      inertiaSimulation: true,
      randomHesitation: true,
      fatigueFactor: 0.0001,
      emotionalState: 'calm',
      ...options
    };
    
    // Inicializar mapa de erros de teclado (teclas adjacentes)
    this.initKeyboardMistakeMap();
  }
  
  /**
   * Inicializa mapa de teclas adjacentes para simular erros de digitação
   */
  private initKeyboardMistakeMap(): void {
    // Mapeamento QWERTY de teclas adjacentes
    this.keyboardMistakeMap = {
      'a': ['s', 'q', 'z', 'w'],
      'b': ['v', 'g', 'h', 'n'],
      'c': ['x', 'd', 'f', 'v'],
      'd': ['s', 'e', 'r', 'f', 'c', 'x'],
      'e': ['w', 'r', 'd', 's', '3', '4'],
      'f': ['d', 'r', 't', 'g', 'v', 'c'],
      'g': ['f', 't', 'y', 'h', 'b', 'v'],
      'h': ['g', 'y', 'u', 'j', 'n', 'b'],
      'i': ['u', 'o', 'k', 'j', '8', '9'],
      'j': ['h', 'u', 'i', 'k', 'm', 'n'],
      'k': ['j', 'i', 'o', 'l', 'm'],
      'l': ['k', 'o', 'p', ';'],
      'm': ['n', 'j', 'k', ','],
      'n': ['b', 'h', 'j', 'm'],
      'o': ['i', 'p', 'l', 'k', '9', '0'],
      'p': ['o', '[', ';', 'l', '0'],
      'q': ['w', 'a', '1', '2'],
      'r': ['e', 't', 'f', 'd', '4', '5'],
      's': ['a', 'd', 'w', 'x', 'z'],
      't': ['r', 'y', 'g', 'f', '5', '6'],
      'u': ['y', 'i', 'j', 'h', '7', '8'],
      'v': ['c', 'f', 'g', 'b'],
      'w': ['q', 'e', 's', 'a', '2', '3'],
      'x': ['z', 's', 'd', 'c'],
      'y': ['t', 'u', 'h', 'g', '6', '7'],
      'z': ['a', 's', 'x'],
      '0': ['9', 'p', 'o', '-'],
      '1': ['2', 'q', '`'],
      '2': ['1', '3', 'q', 'w'],
      '3': ['2', '4', 'w', 'e'],
      '4': ['3', '5', 'e', 'r'],
      '5': ['4', '6', 'r', 't'],
      '6': ['5', '7', 't', 'y'],
      '7': ['6', '8', 'y', 'u'],
      '8': ['7', '9', 'u', 'i'],
      '9': ['8', '0', 'i', 'o'],
      ' ': ['c', 'v', 'b', 'n', 'm']
    };
  }
  
  /**
   * Ajusta os fatores de interação com base no estado emocional configurado
   */
  private adjustFactorsForEmotionalState(): {
    delayFactor: number;
    errorFactor: number;
    movementJitter: number;
  } {
    switch (this.options.emotionalState) {
      case 'rushed':
        return {
          delayFactor: 0.7,  // Menos atrasos
          errorFactor: 1.5,  // Mais erros
          movementJitter: 1.2 // Movimentos mais rápidos e imprecisos
        };
        
      case 'distracted':
        return {
          delayFactor: 1.3,  // Mais pausas
          errorFactor: 2.0,  // Significativamente mais erros
          movementJitter: 1.8 // Movimentos erráticos
        };
        
      case 'calm':
      default:
        return {
          delayFactor: 1.0,
          errorFactor: 1.0,
          movementJitter: 1.0
        };
    }
  }
  
  /**
   * Atualiza o nível de fadiga em sessões longas
   */
  private updateFatigue(actionDuration: number): void {
    // Aumenta fadiga com base na duração da ação
    this.fatigueLevel += actionDuration * this.options.fatigueFactor!;
    
    // Limita a fadiga máxima a 1.0
    this.fatigueLevel = Math.min(1.0, this.fatigueLevel);
    
    // Recuperação gradual (quando não está realizando ações)
    setTimeout(() => {
      this.fatigueLevel = Math.max(0, this.fatigueLevel - 0.01);
    }, 5000);
  }
  
  /**
   * Simula clique humanizado em um elemento
   */
  public async simulateClick(
    selector: string, 
    options: ClickOptions = {}
  ): Promise<boolean> {
    try {
      // Localizar o elemento
      const element = await this.page.$(selector);
      if (!element) {
        return false;
      }
      
      const emotionalFactors = this.adjustFactorsForEmotionalState();
      
      // Obter a posição do elemento
      const boundingBox = await element.boundingBox();
      if (!boundingBox) {
        return false;
      }
      
      // Calcular ponto aleatório dentro do elemento para clicar
      const targetX = boundingBox.x + boundingBox.width * (0.3 + Math.random() * 0.4);
      const targetY = boundingBox.y + boundingBox.height * (0.3 + Math.random() * 0.4);
      
      // Decidir se vamos fazer um movimento natural ou não
      if (this.options.naturalMovements && !options.forceClick) {
        // Posição atual do mouse
        const { x: startX, y: startY } = this.lastMousePosition.x === 0 && this.lastMousePosition.y === 0
          ? { x: Math.random() * this.page.viewportSize().width, y: Math.random() * this.page.viewportSize().height }
          : this.lastMousePosition;
        
        // Gerar caminho realista para o cursor
        const jitter = this.options.jitterFactor! * emotionalFactors.movementJitter * (1 + this.fatigueLevel);
        const path = this.behaviorSim.generateCursorPath(startX, startY, targetX, targetY);
        
        // Aplicar tremor ao caminho
        const jitteredPath = path.map(point => ({
          x: point.x + (Math.random() - 0.5) * jitter * 10,
          y: point.y + (Math.random() - 0.5) * jitter * 10,
          timeOffset: point.timeOffset * (1 + (Math.random() - 0.5) * 0.2) // Variação no tempo
        }));
        
        // Reproduzir o movimento do cursor
        for (const point of jitteredPath) {
          await this.page.mouse.move(point.x, point.y);
          await new Promise(resolve => setTimeout(
            resolve, 
            point.timeOffset * emotionalFactors.delayFactor * (1 + this.fatigueLevel * 0.5)
          ));
        }
      } else {
        // Movimento direto
        await this.page.mouse.move(targetX, targetY);
      }
      
      // Atualizar última posição do mouse
      this.lastMousePosition = { x: targetX, y: targetY };
      
      // Hesitar antes de clicar?
      if (options.hesitateBeforeClick || (this.options.randomHesitation && Math.random() < 0.3)) {
        await new Promise(resolve => setTimeout(
          resolve, 
          this.behaviorSim.generateDelay('short') * emotionalFactors.delayFactor
        ));
      }
      
      // Realizar o clique
      if (options.rightClick) {
        await this.page.mouse.click(targetX, targetY, { button: 'right' });
      } else if (options.doubleClick) {
        await this.page.mouse.dblclick(targetX, targetY);
      } else {
        await this.page.mouse.click(targetX, targetY);
      }
      
      // Se for para arrastar depois do clique
      if (options.dragAfterClick && options.releasePoint) {
        await this.page.mouse.down();
        
        // Mesmo que tenhamos um ponto de destino, fazemos um movimento humano
        const dragPath = this.behaviorSim.generateCursorPath(
          targetX, targetY, 
          options.releasePoint.x, options.releasePoint.y
        );
        
        // Reproduzir o movimento de arrasto
        for (const point of dragPath) {
          await this.page.mouse.move(point.x, point.y);
          await new Promise(resolve => setTimeout(resolve, point.timeOffset * 1.5)); // Mais lento durante o arrasto
        }
        
        await this.page.mouse.up();
        
        // Atualizar última posição do mouse
        this.lastMousePosition = { 
          x: options.releasePoint.x, 
          y: options.releasePoint.y 
        };
      }
      
      // Aplicar efeito de fadiga
      this.updateFatigue(0.1);
      
      return true;
    } catch (error) {
      console.error('Erro ao simular clique:', error);
      return false;
    }
  }
  
  /**
   * Simula digitação humanizada em um campo
   */
  public async simulateTyping(
    selector: string,
    text: string,
    options: TypingOptions = {}
  ): Promise<boolean> {
    try {
      // Localizar o elemento
      const element = await this.page.$(selector);
      if (!element) {
        return false;
      }
      
      const emotionalFactors = this.adjustFactorsForEmotionalState();
      
      // Colar texto em vez de digitar?
      if (options.pasteText) {
        await element.click();
        await this.page.keyboard.press('Control+a'); // Selecionar tudo
        await new Promise(resolve => setTimeout(
          resolve, 
          this.behaviorSim.generateDelay('short')
        ));
        
        // Colar o texto diretamente
        await element.fill(text);
        return true;
      }
      
      // Focar no elemento
      await element.click();
      
      // Gerar atrasos para digitação humana
      const delays = this.behaviorSim.generateTypingDelays(text);
      
      // Simular possíveis erros se a correção estiver ativada
      if (options.errorCorrection !== false) {
        const { textWithErrors, corrections } = this.simulateTypingErrors(
          text, 
          emotionalFactors.errorFactor * (1 + this.fatigueLevel)
        );
        
        // Mapear posições de correção para facilitar a verificação
        const correctionMap = new Map<number, { type: string }>();
        corrections.forEach(corr => {
          correctionMap.set(corr.pos, { type: corr.type });
        });
        
        // Digitação com possíveis erros e correções
        let currentPos = 0;
        for (let i = 0; i < textWithErrors.length; i++) {
          // Verificar se há uma correção nesta posição
          const correction = correctionMap.get(i);
          
          if (correction && correction.type === 'backspace') {
            // Simular erro e correção: digitar um caractere errado, apagar e digitar o correto
            await this.page.keyboard.press('Backspace');
            await new Promise(resolve => setTimeout(
              resolve, 
              this.behaviorSim.generateDelay('short') * emotionalFactors.delayFactor
            ));
          }
          
          // Digitar o caractere
          await this.page.keyboard.type(textWithErrors[i]);
          
          // Esperar o delay correspondente
          await new Promise(resolve => setTimeout(
            resolve, 
            delays[currentPos] * emotionalFactors.delayFactor * (1 + this.fatigueLevel * 0.3)
          ));
          
          currentPos++;
        }
      } else {
        // Digitação sem correção de erros (mais simples)
        for (let i = 0; i < text.length; i++) {
          await this.page.keyboard.type(text[i]);
          
          // Usar delay personalizado se disponível
          const delay = options.customDelayMap && options.customDelayMap[text[i]] 
            ? options.customDelayMap[text[i]] 
            : delays[i];
            
          await new Promise(resolve => setTimeout(
            resolve, 
            delay * emotionalFactors.delayFactor
          ));
        }
      }
      
      // Aplicar efeito de fadiga proporcional ao tamanho do texto
      this.updateFatigue(text.length * 0.001);
      
      return true;
    } catch (error) {
      console.error('Erro ao simular digitação:', error);
      return false;
    }
  }
  
  /**
   * Personalização da simulação de erros de digitação
   * Extensão da simulação básica, mas com mais opções
   */
  private simulateTypingErrors(
    text: string,
    errorFactor: number = 1.0
  ): { 
    textWithErrors: string, 
    corrections: Array<{ pos: number, type: 'backspace' | 'insert' | 'replace' }> 
  } {
    // Probabilidade de erro ajustada pelo fator
    const errorRate = 0.03 * errorFactor;
    
    const result = {
      textWithErrors: '',
      corrections: [] as Array<{ pos: number, type: 'backspace' | 'insert' | 'replace' }>
    };
    
    let pos = 0;
    for (const char of text) {
      // Verificar se ocorrerá um erro
      if (Math.random() < errorRate) {
        // Decidir o tipo de erro
        const errorType = Math.random();
        
        if (errorType < 0.4) {
          // Erro de tecla adjacente
          const adjacent = this.keyboardMistakeMap[char.toLowerCase()] || ['e', 'r', 't'];
          const wrongChar = adjacent[Math.floor(Math.random() * adjacent.length)];
          
          result.textWithErrors += wrongChar;
          result.corrections.push({ pos, type: 'backspace' });
          result.textWithErrors += char;
          pos += 2;
        } else if (errorType < 0.7) {
          // Duplicação de caractere
          result.textWithErrors += char + char;
          result.corrections.push({ pos: pos + 1, type: 'backspace' });
          pos += 2;
        } else if (errorType < 0.9) {
          // Inversão de caracteres (se não for o último)
          if (pos < text.length - 1) {
            const nextChar = text[pos + 1];
            result.textWithErrors += nextChar + char;
            pos += 2;
            // Pular o próximo caractere pois já o incluímos
            continue;
          } else {
            // Omissão e correção para último caractere
            result.corrections.push({ pos, type: 'insert' });
            result.textWithErrors += char;
            pos += 1;
          }
        } else {
          // Omissão e correção
          result.corrections.push({ pos, type: 'insert' });
          result.textWithErrors += char;
          pos += 1;
        }
      } else {
        // Digitação normal
        result.textWithErrors += char;
        pos += 1;
      }
    }
    
    return result;
  }
  
  /**
   * Simula operação de rolagem (scroll) humanizada
   */
  public async simulateScroll(
    options: ScrollOptions = {}
  ): Promise<boolean> {
    try {
      const emotionalFactors = this.adjustFactorsForEmotionalState();
      
      // Valores padrão
      const direction = options.scrollDirection || 'down';
      const distance = options.scrollDistance || 500;
      const speed = options.scrollSpeed || 1.0;
      const smooth = options.smoothScrolling !== false;
      
      // Converter direção em valor de delta Y
      const deltaYSign = direction === 'down' ? 1 : -1;
      
      if (smooth) {
        // Rolagem suave
        const steps = Math.floor(Math.abs(distance) / (10 + Math.random() * 10)); // Número de etapas
        const baseDelay = 10 / speed; // Tempo entre etapas
        
        for (let i = 0; i < steps; i++) {
          // Calcular delta Y com variação para parecer mais humano
          const progress = i / steps;
          let stepMultiplier = 1.0;
          
          // Aceleração/desaceleração natural
          if (progress < 0.2) {
            // Início: aceleração gradual
            stepMultiplier = progress * 5; // 0 a 1
          } else if (progress > 0.8) {
            // Fim: desaceleração gradual
            stepMultiplier = (1 - progress) * 5; // 1 a 0
          }
          
          // Adicionar oscilações se configurado
          if (options.oscillations && Math.random() < 0.1) {
            // 10% de chance de momentaneamente ir no sentido oposto
            await this.page.mouse.wheel(0, -deltaYSign * Math.random() * 20);
            await new Promise(resolve => setTimeout(resolve, baseDelay * 2));
          }
          
          // Aplicar o scroll
          const delta = deltaYSign * Math.max(5, Math.floor(distance / steps * stepMultiplier));
          await this.page.mouse.wheel(0, delta);
          
          // Atraso variável entre rolagens
          const delay = baseDelay * (0.7 + Math.random() * 0.6) * emotionalFactors.delayFactor;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Pausas ocasionais durante a rolagem
          if (options.pauseDuringScroll && Math.random() < 0.05) {
            const pauseDuration = this.behaviorSim.generateDelay('medium');
            await new Promise(resolve => setTimeout(resolve, pauseDuration));
          }
        }
      } else {
        // Rolagem em etapas maiores (menos natural, mais rápida)
        const numJumps = 3 + Math.floor(Math.random() * 3); // 3 a 5 etapas
        const deltaPerJump = distance / numJumps;
        
        for (let i = 0; i < numJumps; i++) {
          // Aplicar o scroll
          await this.page.mouse.wheel(0, deltaYSign * deltaPerJump);
          
          // Atraso entre etapas
          const delay = this.behaviorSim.generateDelay('medium') * emotionalFactors.delayFactor;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Aplicar efeito de fadiga
      this.updateFatigue(distance * 0.0002);
      
      return true;
    } catch (error) {
      console.error('Erro ao simular rolagem:', error);
      return false;
    }
  }
  
  /**
   * Simula sequência completa de preenchimento de formulário
   * Combina vários tipos de interação para uma experiência natural
   */
  public async fillForm(
    formData: Array<{
      selector: string;
      type: 'input' | 'checkbox' | 'select' | 'radio' | 'button';
      value?: string;
      action?: 'click' | 'type' | 'select';
    }>
  ): Promise<boolean> {
    try {
      // Preencher campos na ordem informada
      for (const field of formData) {
        // Pequeno atraso entre campos
        await new Promise(resolve => setTimeout(
          resolve, 
          this.behaviorSim.generateDelay('medium')
        ));
        
        switch (field.type) {
          case 'input':
            if (field.value) {
              await this.simulateTyping(field.selector, field.value);
            }
            break;
            
          case 'checkbox':
          case 'radio':
          case 'button':
            await this.simulateClick(field.selector);
            break;
            
          case 'select':
            // Clicar para abrir o dropdown
            await this.simulateClick(field.selector);
            await new Promise(resolve => setTimeout(
              resolve, 
              this.behaviorSim.generateDelay('medium')
            ));
            
            // Clicar na opção se valor especificado
            if (field.value) {
              const optionSelector = `${field.selector} option[value="${field.value}"], ${field.selector} option:contains("${field.value}")`;
              await this.simulateClick(optionSelector);
            }
            break;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao preencher formulário:', error);
      return false;
    }
  }
  
  /**
   * Simula interação com a interface com base em elementos visuais
   * Busca elementos por texto ou posicionamento relativo
   */
  public async interactWithElementByText(
    text: string,
    action: 'click' | 'hover' | 'rightClick' | 'doubleClick' = 'click'
  ): Promise<boolean> {
    try {
      // Encontrar elemento com o texto especificado
      const elements = await this.page.$$(`text="${text.replace(/"/g, '\\"')}"`);
      
      if (elements.length === 0) {
        return false;
      }
      
      // Simular ação no primeiro elemento encontrado
      const element = elements[0];
      const boundingBox = await element.boundingBox();
      
      if (!boundingBox) {
        return false;
      }
      
      // Ponto central do elemento
      const centerX = boundingBox.x + boundingBox.width / 2;
      const centerY = boundingBox.y + boundingBox.height / 2;
      
      // Movimento do cursor
      if (this.options.naturalMovements) {
        const path = this.behaviorSim.generateCursorPath(
          this.lastMousePosition.x || this.page.viewportSize().width / 2,
          this.lastMousePosition.y || this.page.viewportSize().height / 2,
          centerX,
          centerY
        );
        
        for (const point of path) {
          await this.page.mouse.move(point.x, point.y);
          await new Promise(resolve => setTimeout(resolve, point.timeOffset));
        }
      } else {
        await this.page.mouse.move(centerX, centerY);
      }
      
      // Atualizar posição do cursor
      this.lastMousePosition = { x: centerX, y: centerY };
      
      // Executar ação
      switch (action) {
        case 'click':
          await this.page.mouse.click(centerX, centerY);
          break;
        case 'hover':
          // Já movemos o cursor, não precisa fazer mais nada
          break;
        case 'rightClick':
          await this.page.mouse.click(centerX, centerY, { button: 'right' });
          break;
        case 'doubleClick':
          await this.page.mouse.dblclick(centerX, centerY);
          break;
      }
      
      return true;
    } catch (error) {
      console.error(`Erro ao interagir com elemento contendo texto "${text}":`, error);
      return false;
    }
  }
  
  /**
   * Reseta o nível de fadiga do simulador
   * Útil quando há pausas significativas na automação
   */
  public resetFatigue(): void {
    this.fatigueLevel = 0;
  }
  
  /**
   * Configura o estado emocional para simulação
   */
  public setEmotionalState(state: 'calm' | 'rushed' | 'distracted'): void {
    this.options.emotionalState = state;
  }
}