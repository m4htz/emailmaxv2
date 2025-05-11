/**
 * Implementação de comportamentos humanos realistas para automação
 * Inclui métodos para simular padrões de digitação, movimentos de mouse e tempo de leitura
 */

import { HumanBehaviorConfig } from './types';

/**
 * Classe responsável por simular comportamentos humanos realistas
 * Utilizada pelas classes de automação para tornar as interações mais naturais
 */
export class HumanBehaviorSimulator {
  private config: HumanBehaviorConfig;

  constructor(config: Partial<HumanBehaviorConfig> = {}) {
    // Configuração padrão
    const defaultConfig: HumanBehaviorConfig = {
      typingSpeed: {
        min: 180, // caracteres por minuto
        max: 250
      },
      readingSpeed: {
        min: 30, // ms por caractere
        max: 60
      },
      cursorMovement: {
        maxDeviation: 50, // pixels
        randomAcceleration: true
      },
      interactionDelays: {
        short: { min: 300, max: 800 },
        medium: { min: 1000, max: 3000 },
        long: { min: 3000, max: 10000 }
      }
    };

    // Mesclar configuração padrão com configuração personalizada
    this.config = {
      typingSpeed: { ...defaultConfig.typingSpeed, ...config.typingSpeed },
      readingSpeed: { ...defaultConfig.readingSpeed, ...config.readingSpeed },
      cursorMovement: { ...defaultConfig.cursorMovement, ...config.cursorMovement },
      interactionDelays: { ...defaultConfig.interactionDelays, ...config.interactionDelays }
    };
  }

  /**
   * Gera uma sequência de atrasos para digitação humana
   * @param text O texto a ser digitado
   * @returns Array de atrasos em ms para cada caractere
   */
  public generateTypingDelays(text: string): number[] {
    const { min, max } = this.config.typingSpeed;
    const avgSpeed = Math.random() * (max - min) + min; // Caracteres por minuto
    const baseDelay = 60000 / avgSpeed; // Converte para ms por caractere

    // Gerar atrasos com variação natural
    return Array.from({ length: text.length }, () => {
      // Variar 30% para mais ou para menos
      const variation = (Math.random() - 0.5) * 0.6;
      return Math.max(50, baseDelay * (1 + variation));
    });
  }

  /**
   * Gera uma trajetória de movimento de cursor realista entre dois pontos
   * Usa algoritmo de Bézier para criar movimentos naturais
   * @returns Array de pontos {x, y} para a trajetória
   */
  public generateCursorPath(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number
  ): Array<{ x: number, y: number, timeOffset: number }> {
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const numPoints = Math.max(5, Math.floor(distance / 10));
    const path: Array<{ x: number, y: number, timeOffset: number }> = [];
    
    // Calcular pontos de controle para curva de Bézier
    const controlPoint1 = {
      x: startX + (endX - startX) / 3 + (Math.random() - 0.5) * this.config.cursorMovement.maxDeviation,
      y: startY + (endY - startY) / 3 + (Math.random() - 0.5) * this.config.cursorMovement.maxDeviation
    };
    
    const controlPoint2 = {
      x: startX + 2 * (endX - startX) / 3 + (Math.random() - 0.5) * this.config.cursorMovement.maxDeviation,
      y: startY + 2 * (endY - startY) / 3 + (Math.random() - 0.5) * this.config.cursorMovement.maxDeviation
    };
    
    // Calcular as coordenadas em cada ponto da curva de Bézier
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      
      // Fórmula da curva de Bézier cúbica
      const x = Math.pow(1 - t, 3) * startX + 
                3 * Math.pow(1 - t, 2) * t * controlPoint1.x + 
                3 * (1 - t) * Math.pow(t, 2) * controlPoint2.x + 
                Math.pow(t, 3) * endX;
                
      const y = Math.pow(1 - t, 3) * startY + 
                3 * Math.pow(1 - t, 2) * t * controlPoint1.y + 
                3 * (1 - t) * Math.pow(t, 2) * controlPoint2.y + 
                Math.pow(t, 3) * endY;
      
      // Adicionar variação na velocidade
      let timeOffset;
      if (this.config.cursorMovement.randomAcceleration) {
        // Movimento acelerado no meio, lento no início e fim
        const speedFactor = 1 - 4 * Math.pow(t - 0.5, 2);
        timeOffset = i * (distance / numPoints) * (0.8 + 0.4 * speedFactor);
      } else {
        timeOffset = i * (distance / numPoints);
      }
      
      path.push({ x, y, timeOffset });
    }
    
    return path;
  }

  /**
   * Calcula o tempo de leitura realista para um texto
   * @param textLength Comprimento do texto a ser lido
   * @returns Tempo em ms para ler o texto
   */
  public calculateReadingTime(textLength: number): number {
    const { min, max } = this.config.readingSpeed;
    const msPerChar = Math.random() * (max - min) + min;
    
    // Limitar a um mínimo de 1s e máximo de 2min
    return Math.max(1000, Math.min(120000, textLength * msPerChar));
  }

  /**
   * Gera um atraso aleatório para interações
   * @param type Tipo de atraso (curto, médio ou longo)
   * @returns Tempo de atraso em ms
   */
  public generateDelay(type: 'short' | 'medium' | 'long' = 'short'): number {
    const { min, max } = this.config.interactionDelays[type];
    return Math.floor(Math.random() * (max - min) + min);
  }

  /**
   * Simula erros de digitação realistas
   * @param text Texto original a ser digitado
   * @returns Texto com possíveis erros de digitação que serão corrigidos
   */
  public simulateTypingErrors(text: string): { textWithErrors: string, corrections: Array<{ pos: number, type: 'backspace' | 'insert' | 'replace' }> } {
    // Probabilidade de erro de digitação (cerca de 2-5%)
    const errorRate = 0.03;
    const result: { textWithErrors: string, corrections: Array<{ pos: number, type: 'backspace' | 'insert' | 'replace' }> } = {
      textWithErrors: '',
      corrections: []
    };
    
    // Mapa de teclas adjacentes para erros realistas
    const adjacentKeys: Record<string, string[]> = {
      'a': ['s', 'q', 'z'],
      'b': ['v', 'g', 'h', 'n'],
      'c': ['x', 'd', 'f', 'v'],
      // ... adicionar mais mapeamentos de teclas adjacentes
    };
    
    let pos = 0;
    for (const char of text) {
      // Verificar se ocorrerá um erro
      if (Math.random() < errorRate) {
        // Decidir o tipo de erro
        const errorType = Math.random();
        
        if (errorType < 0.4) {
          // Erro de tecla adjacente
          const adjacent = adjacentKeys[char.toLowerCase()] || ['e', 'r', 't']; // Teclas padrão se não houver mapeamento
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
}