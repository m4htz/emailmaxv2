/**
 * Exemplo de utilização do sistema de interação humana
 * Demonstra simulação avançada de interações humanas com interfaces web
 */

import { HumanInteraction, ClickOptions, TypingOptions, ScrollOptions } from '../human-interaction';
import { HumanBehaviorSimulator } from '../human-behavior';
import { createWebmailAutomation } from '../index';

/**
 * Função principal do exemplo
 */
async function runHumanInteractionExample() {
  console.log('Iniciando exemplo de interação humana...');

  // Criar instância de automação (em modo de mock para testes)
  const automation = createWebmailAutomation('gmail', {
    isHeadless: false, // Visível para demonstração
    mockMode: true // Modo de simulação para teste
  });

  try {
    // Inicializar o navegador
    console.log('Inicializando navegador...');
    const initialized = await automation.initialize();
    
    if (!initialized) {
      throw new Error('Falha ao inicializar o navegador');
    }
    
    // Obter o objeto da página para inicializar o simulador de interações
    const page = (automation as any).page;
    
    if (!page) {
      throw new Error('Página não disponível');
    }
    
    // Criar o simulador de comportamento humano
    const behaviorSim = new HumanBehaviorSimulator({
      typingSpeed: {
        min: 190,  // Caracteres por minuto
        max: 240
      },
      readingSpeed: {
        min: 30,   // Milissegundos por caractere
        max: 50
      },
      cursorMovement: {
        maxDeviation: 60,  // Desvio máximo em pixels
        randomAcceleration: true
      }
    });
    
    // Criar o simulador de interações humanas
    const humanInteraction = new HumanInteraction(
      page,
      behaviorSim,
      {
        naturalMovements: true,
        realisticScrolling: true,
        jitterFactor: 0.4,
        emotionalState: 'calm',
        randomHesitation: true
      }
    );
    
    // Navegar para uma página de teste
    console.log('Navegando para a página de teste...');
    await page.goto('https://example.com', { waitUntil: 'networkidle' });
    await sleep(2000);
    
    // ======= DEMONSTRAÇÕES DE INTERAÇÃO =======
    
    // 1. Simulação de clique
    console.log('Demonstração 1: Clique em um link...');
    await humanInteraction.simulateClick('a', {
      doubleClick: false,
      hesitateBeforeClick: true
    });
    await sleep(3000);
    
    // 2. Demonstração de rolagem
    console.log('Demonstração 2: Rolagem suave...');
    await humanInteraction.simulateScroll({
      scrollDirection: 'down',
      scrollDistance: 300,
      smoothScrolling: true,
      pauseDuringScroll: true
    });
    await sleep(2000);
    
    // Rolar de volta para cima
    await humanInteraction.simulateScroll({
      scrollDirection: 'up',
      scrollDistance: 300,
      smoothScrolling: true
    });
    await sleep(2000);
    
    // 3. Demonstração de digitação em um campo de pesquisa imaginário
    console.log('Demonstração 3: Digitação com erros e correções...');
    // Nota: Este seletor pode não existir no example.com, é apenas ilustrativo
    const typingSucceeded = await humanInteraction.simulateTyping('input', 'exemplo de digitação humana', {
      errorCorrection: true
    });
    
    if (!typingSucceeded) {
      console.log('Campo não encontrado, criando um campo para demonstração...');
      // Criar um campo temporário para demonstração
      await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Digite aqui para teste';
        input.style.width = '300px';
        input.style.padding = '8px';
        input.style.margin = '20px';
        document.body.prepend(input);
      });
      
      // Agora tentar novamente
      await humanInteraction.simulateTyping('input', 'exemplo de digitação humana', {
        errorCorrection: true
      });
    }
    await sleep(3000);
    
    // 4. Demonstração de busca por texto e interação
    console.log('Demonstração 4: Interação com elemento por texto...');
    await humanInteraction.interactWithElementByText('More information');
    await sleep(3000);
    
    // 5. Demonstração de preenchimento de formulário
    console.log('Demonstração 5: Simulação de diferentes estados emocionais...');
    console.log('Estado: Apressado');
    humanInteraction.setEmotionalState('rushed');
    
    // Clique rápido e menos preciso
    await humanInteraction.simulateClick('a', { forceClick: false });
    await sleep(2000);
    
    console.log('Estado: Distraído');
    humanInteraction.setEmotionalState('distracted');
    
    // Rolagem errática
    await humanInteraction.simulateScroll({
      scrollDirection: 'down',
      scrollDistance: 200,
      oscillations: true
    });
    await sleep(2000);
    
    // Voltar para estado calmo
    console.log('Estado: Calmo (padrão)');
    humanInteraction.setEmotionalState('calm');
    
    console.log('Exemplo de interação humana concluído!');
  } catch (error) {
    console.error('Erro durante o exemplo:', error);
  } finally {
    // Fechar o navegador
    await automation.close();
  }
}

/**
 * Função auxiliar para aguardar um tempo específico
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Executar o exemplo se este arquivo for executado diretamente
if (require.main === module) {
  runHumanInteractionExample().catch(console.error);
}

export { runHumanInteractionExample };