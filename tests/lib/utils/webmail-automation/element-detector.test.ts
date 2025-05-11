/**
 * Testes para o módulo ElementDetector
 */

import { ElementDetector, createElementDetector, ElementPattern } from '../../../../lib/utils/webmail-automation/element-detector';
import { Page } from 'playwright';

// Mock para o objeto Page do Playwright
const createMockPage = () => {
  return {
    $: jest.fn(),
    $$: jest.fn(),
    evaluate: jest.fn(),
    waitForSelector: jest.fn(),
    waitForTimeout: jest.fn(),
    hover: jest.fn(),
    click: jest.fn(),
    fill: jest.fn(),
    viewportSize: { width: 1280, height: 800 },
  } as unknown as Page;
};

// Mock para AdaptiveSelectors
jest.mock('../../../../lib/utils/webmail-automation/adaptive-selectors', () => {
  return {
    AdaptiveSelectors: jest.fn().mockImplementation(() => {
      return {
        getSelector: jest.fn().mockImplementation((key) => {
          // Simular que alguns seletores existem e outros não
          const mockSelectors: Record<string, string> = {
            composeButton: 'div[role="button"][gh="cm"]',
            inboxFolder: 'a[href="#inbox"]',
          };
          return Promise.resolve(mockSelectors[key] || null);
        }),
        addSelector: jest.fn(),
      };
    }),
  };
});

describe('ElementDetector', () => {
  let mockPage: any;
  let detector: ElementDetector;
  
  beforeEach(() => {
    mockPage = createMockPage();
    detector = createElementDetector('gmail', mockPage, {
      learningEnabled: true,
      minConfidence: 0.6,
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('deve ser inicializado corretamente', () => {
    expect(detector).toBeInstanceOf(ElementDetector);
  });
  
  test('detectElement deve retornar null quando nenhum elemento é encontrado', async () => {
    // Configurar mocks para simular que nenhum elemento é encontrado
    mockPage.$.mockResolvedValue(null);
    mockPage.$$.mockResolvedValue([]);
    
    const result = await detector.detectElement('nonExistentElement');
    expect(result).toBeNull();
  });
  
  test('detectElement deve encontrar elemento usando padrões existentes', async () => {
    // Configurar o mock para simular que um elemento é encontrado
    mockPage.$.mockImplementation((selector) => {
      if (selector === 'div[role="button"][gh="cm"]') {
        return { 
          boundingBox: () => Promise.resolve({ x: 10, y: 20, width: 100, height: 40 }),
          textContent: () => Promise.resolve('Compose'),
          getAttribute: () => Promise.resolve('button')
        };
      }
      return null;
    });
    
    const result = await detector.detectElement('composeButton');
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('composeButton');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.6);
  });
  
  test('waitForElement deve esperar até que o elemento seja detectado', async () => {
    // Primeiro retorna null, depois retorna um elemento
    mockPage.$.mockResolvedValueOnce(null)
             .mockResolvedValueOnce({
               boundingBox: () => Promise.resolve({ x: 10, y: 20, width: 100, height: 40 }),
               textContent: () => Promise.resolve('Compose'),
               getAttribute: () => Promise.resolve('button')
             });
    
    const result = await detector.waitForElement('composeButton', { timeout: 1000 });
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('composeButton');
    expect(mockPage.waitForTimeout).toHaveBeenCalled();
  });
  
  test('clickElement deve clicar no elemento detectado', async () => {
    // Mock para detectar elemento
    mockPage.$.mockResolvedValue({
      boundingBox: () => Promise.resolve({ x: 10, y: 20, width: 100, height: 40 }),
      textContent: () => Promise.resolve('Compose'),
      getAttribute: () => Promise.resolve('button')
    });
    
    mockPage.click.mockResolvedValue(undefined);
    
    const result = await detector.clickElement('composeButton');
    
    expect(result).toBe(true);
    expect(mockPage.click).toHaveBeenCalled();
  });
  
  test('clickElement deve retornar false quando elemento não for encontrado', async () => {
    mockPage.$.mockResolvedValue(null);
    
    const result = await detector.clickElement('nonExistentElement');
    
    expect(result).toBe(false);
    expect(mockPage.click).not.toHaveBeenCalled();
  });
  
  test('learnNewPatterns deve aprender novos padrões', async () => {
    // Mock para permitir encontrar botões proeminentes
    mockPage.$$.mockImplementation((selector) => {
      if (selector === 'button, [role="button"]') {
        return [
          {
            textContent: () => Promise.resolve('Compose'),
            boundingBox: () => Promise.resolve({ x: 10, y: 20, width: 150, height: 50 }),
            getAttribute: () => Promise.resolve('button')
          },
          {
            textContent: () => Promise.resolve('Send'),
            boundingBox: () => Promise.resolve({ x: 200, y: 300, width: 120, height: 40 }),
            getAttribute: () => Promise.resolve('button')
          }
        ];
      }
      return [];
    });
    
    // Mock para gerar seletores únicos
    mockPage.evaluate.mockImplementation(() => {
      return '#compose-button';
    });
    
    const newPatterns = await detector.learnNewPatterns();
    
    expect(newPatterns).toBeGreaterThan(0);
  });
  
  test('getSelector deve retornar seletor do AdaptiveSelectors se disponível', async () => {
    const selector = await detector.getSelector('composeButton');
    
    expect(selector).toBe('div[role="button"][gh="cm"]');
  });
  
  test('getSelector deve usar detecção se não houver seletor no AdaptiveSelectors', async () => {
    // Mock para AdaptiveSelectors não encontrar o seletor
    mockPage.$.mockImplementation((selector) => {
      if (selector === 'div[role="button"]') {
        return { 
          boundingBox: () => Promise.resolve({ x: 10, y: 20, width: 100, height: 40 }),
          textContent: () => Promise.resolve('Send'),
          getAttribute: () => Promise.resolve('button')
        };
      }
      return null;
    });
    
    // Mock para gerar seletor
    mockPage.evaluate.mockResolvedValue('div[role="button"]');
    
    const selector = await detector.getSelector('sendButton');
    
    expect(selector).not.toBeNull();
  });
  
  test('exportLearnedPatterns deve exportar padrões', () => {
    const exported = detector.exportLearnedPatterns();
    
    expect(exported).toHaveProperty('patterns');
    expect(exported).toHaveProperty('selectors');
    expect(exported).toHaveProperty('fallbackSelectors');
  });
  
  test('importLearnedPatterns deve importar padrões', () => {
    const patterns: ElementPattern[] = [
      {
        type: 'customButton',
        provider: 'gmail',
        heuristics: {
          role: 'button',
          textContent: 'Custom Button',
        },
        confidence: 0.9,
      }
    ];
    
    const count = detector.importLearnedPatterns({ patterns });
    
    expect(count).toBe(1);
  });
});