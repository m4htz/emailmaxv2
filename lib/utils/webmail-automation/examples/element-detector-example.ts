/**
 * Exemplo de uso do ElementDetector
 * Este arquivo demonstra a detecção automática de elementos de interface
 */

import { chromium, Page, Browser } from 'playwright';
import { ElementDetector, createElementDetector } from '../element-detector';
import { WebmailProvider } from '../types';
import { AdaptiveSelectors } from '../adaptive-selectors';

/**
 * Classe de exemplo para demonstrar o detector de elementos
 */
export class ElementDetectorDemo {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private detector: ElementDetector | null = null;
  private provider: WebmailProvider;

  constructor(provider: WebmailProvider = 'gmail') {
    this.provider = provider;
  }

  /**
   * Inicializa o navegador e o detector
   */
  public async initialize(isHeadless = false): Promise<boolean> {
    try {
      // Inicializar navegador
      this.browser = await chromium.launch({
        headless: isHeadless,
        // Adicionar slow-mo para visualizar melhor as ações em modo não-headless
        slowMo: isHeadless ? 0 : 50
      });
      
      // Criar página
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
      });
      
      this.page = await context.newPage();
      
      // Criar instância do AdaptiveSelectors
      const adaptiveSelectors = new AdaptiveSelectors(this.provider, this.page);
      
      // Criar detector de elementos
      this.detector = createElementDetector(this.provider, this.page, {
        adaptiveSelectors,
        learningEnabled: true,
        minConfidence: 0.6
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao inicializar ElementDetectorDemo:', error);
      return false;
    }
  }

  /**
   * Navega para o provedor de webmail
   */
  public async navigateToProvider(): Promise<boolean> {
    if (!this.page) {
      throw new Error('O navegador não foi inicializado');
    }
    
    try {
      switch (this.provider) {
        case 'gmail':
          await this.page.goto('https://mail.google.com/');
          break;
        case 'outlook':
          await this.page.goto('https://outlook.live.com/mail/');
          break;
        case 'yahoo':
          await this.page.goto('https://mail.yahoo.com/');
          break;
      }
      
      // Esperar pela página carregar completamente
      await this.page.waitForLoadState('networkidle');
      
      return true;
    } catch (error) {
      console.error(`Erro ao navegar para ${this.provider}:`, error);
      return false;
    }
  }

  /**
   * Detecta elementos na interface e mostra resultados
   */
  public async detectAndHighlightElements(types: string[] = []): Promise<void> {
    if (!this.page || !this.detector) {
      throw new Error('O navegador ou detector não foram inicializados');
    }
    
    // Se não forem especificados tipos, usar alguns comuns
    if (types.length === 0) {
      types = ['composeButton', 'inboxFolder', 'searchBox', 'emailList', 'emailItem'];
    }
    
    console.log(`Detectando elementos na interface do ${this.provider}...`);
    
    // Detectar cada tipo de elemento
    for (const type of types) {
      const element = await this.detector.detectElement(type);
      
      if (element) {
        console.log(`✅ Elemento detectado: ${type}`);
        console.log(`  - Seletor: ${element.selector}`);
        console.log(`  - Confiança: ${(element.confidence * 100).toFixed(1)}%`);
        if (element.text) {
          console.log(`  - Texto: ${element.text.substring(0, 50)}${element.text.length > 50 ? '...' : ''}`);
        }
        
        // Destacar elemento na página
        await this.highlightElement(element.selector);
      } else {
        console.log(`❌ Elemento não detectado: ${type}`);
      }
    }
    
    // Executar aprendizado de novos padrões
    console.log('\nAprendendo novos padrões da interface...');
    const newPatterns = await this.detector.learnNewPatterns();
    console.log(`Aprendidos ${newPatterns} novos padrões.`);
    
    // Detectar novamente após aprendizado
    if (newPatterns > 0) {
      console.log('\nRedetectando elementos após aprendizado:');
      
      for (const type of types) {
        const element = await this.detector.detectElement(type);
        
        if (element) {
          console.log(`✅ Elemento detectado após aprendizado: ${type}`);
          console.log(`  - Seletor: ${element.selector}`);
          console.log(`  - Confiança: ${(element.confidence * 100).toFixed(1)}%`);
          
          // Destacar elemento na página com cor diferente
          await this.highlightElement(element.selector, 'green');
        }
      }
    }
  }

  /**
   * Destaca um elemento na página
   */
  private async highlightElement(
    selector: string, 
    color: string = 'red',
    duration: number = 3000
  ): Promise<void> {
    if (!this.page) return;
    
    try {
      await this.page.evaluate(
        ({ selector, color }) => {
          const element = document.querySelector(selector);
          if (element) {
            const originalOutline = (element as HTMLElement).style.outline;
            const originalZIndex = (element as HTMLElement).style.zIndex;
            
            (element as HTMLElement).style.outline = `3px solid ${color}`;
            (element as HTMLElement).style.zIndex = '9999';
            
            setTimeout(() => {
              (element as HTMLElement).style.outline = originalOutline;
              (element as HTMLElement).style.zIndex = originalZIndex;
            }, 3000);
          }
        },
        { selector, color }
      );
    } catch (error) {
      console.error(`Erro ao destacar elemento ${selector}:`, error);
    }
  }

  /**
   * Testa a interação com elementos detectados
   */
  public async testInteraction(maxActions = 3): Promise<void> {
    if (!this.page || !this.detector) {
      throw new Error('O navegador ou detector não foram inicializados');
    }
    
    console.log('\nTestando interações com elementos detectados:');
    
    // Lista de possíveis ações para testar
    const actions = [
      { type: 'searchBox', action: async () => {
        const searchText = 'teste da busca automatizada';
        console.log(`Preenchendo campo de busca com: "${searchText}"`);
        
        // Obter seletor para a caixa de busca
        const searchBox = await this.detector!.detectElement('searchBox');
        
        if (searchBox) {
          await this.highlightElement(searchBox.selector, 'blue');
          await this.page!.fill(searchBox.selector, searchText);
          return true;
        }
        return false;
      }},
      { type: 'composeButton', action: async () => {
        console.log('Clicando no botão de compor email');
        
        // Usar o método clickElement do detector
        const success = await this.detector!.clickElement('composeButton', { 
          humanLike: true,
          timeout: 5000
        });
        
        if (success) {
          // Aguardar a janela de composição abrir
          await this.page!.waitForTimeout(2000);
          return true;
        }
        return false;
      }},
      { type: 'inboxFolder', action: async () => {
        console.log('Clicando na pasta Inbox');
        const success = await this.detector!.clickElement('inboxFolder', { 
          humanLike: true 
        });
        
        if (success) {
          // Aguardar a navegação
          await this.page!.waitForTimeout(2000);
          return true;
        }
        return false;
      }}
    ];
    
    // Executar algumas ações aleatórias
    let actionsPerformed = 0;
    const maxAttempts = 10; // Evitar loop infinito
    let attempts = 0;
    
    while (actionsPerformed < maxActions && attempts < maxAttempts) {
      attempts++;
      
      // Selecionar uma ação aleatória
      const actionIndex = Math.floor(Math.random() * actions.length);
      const { type, action } = actions[actionIndex];
      
      // Verificar se o elemento existe
      const element = await this.detector.detectElement(type);
      
      if (element) {
        console.log(`\nAção ${actionsPerformed + 1}/${maxActions}:`);
        const success = await action();
        
        if (success) {
          actionsPerformed++;
          console.log('✅ Ação completada com sucesso');
        } else {
          console.log('❌ Falha ao executar ação');
        }
      }
      
      // Pequena pausa entre ações
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Exporta os padrões aprendidos
   */
  public exportLearnedPatterns(): any {
    if (!this.detector) {
      throw new Error('O detector não foi inicializado');
    }
    
    return this.detector.exportLearnedPatterns();
  }

  /**
   * Fecha o navegador
   */
  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.detector = null;
    }
  }
}

/**
 * Função principal para executar a demonstração
 */
export async function runElementDetectorDemo(
  provider: WebmailProvider = 'gmail', 
  isHeadless = false
): Promise<void> {
  const demo = new ElementDetectorDemo(provider);
  
  try {
    console.log(`Iniciando demonstração do ElementDetector para ${provider}...`);
    await demo.initialize(isHeadless);
    await demo.navigateToProvider();
    
    // Pausa para permitir que a página carregue completamente e o usuário interaja se necessário
    console.log('Aguardando carregamento completo e possível login...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Detectar e destacar elementos
    await demo.detectAndHighlightElements();
    
    // Testar interações
    await demo.testInteraction(2);
    
    // Exportar padrões aprendidos
    const patterns = demo.exportLearnedPatterns();
    console.log('\nPadrões aprendidos:');
    console.log(JSON.stringify(patterns, null, 2));
    
  } catch (error) {
    console.error('Erro durante a demonstração:', error);
  } finally {
    // Mantém o navegador aberto em modo não-headless para inspeção manual
    if (!isHeadless) {
      console.log('\nNavegador mantido aberto para inspeção. Pressione Ctrl+C para encerrar.');
    } else {
      await demo.close();
    }
  }
}

// Se este arquivo for executado diretamente
if (require.main === module) {
  const provider = process.argv[2] as WebmailProvider || 'gmail';
  const isHeadless = process.argv.includes('--headless');
  
  runElementDetectorDemo(provider, isHeadless).catch(console.error);
}