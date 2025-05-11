/**
 * Exemplo de utilização do InputManager
 * Demonstra uso coordenado de entradas de teclado, mouse e formulários
 */

import { InputManager } from '../input-manager';
import { HumanInteraction } from '../human-interaction';
import { HumanBehaviorSimulator } from '../human-behavior';
import { createWebmailAutomation } from '../index';

/**
 * Função principal do exemplo
 */
async function runInputManagerExample() {
  console.log('Iniciando exemplo do InputManager...');

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
    const behaviorSim = new HumanBehaviorSimulator();
    
    // Criar o simulador de interações humanas
    const humanInteraction = new HumanInteraction(
      page,
      behaviorSim,
      {
        naturalMovements: true,
        realisticScrolling: true
      }
    );
    
    // Criar o gerenciador de entradas
    const inputManager = new InputManager(
      page,
      humanInteraction,
      {
        useHumanInteraction: true,
        inputDelay: 80,
        randomizationFactor: 0.3,
        recordInteractions: true
      }
    );
    
    // Navegar para uma página de teste
    console.log('Navegando para a página de teste...');
    await page.goto('https://example.com', { waitUntil: 'networkidle' });
    await sleep(2000);
    
    // ======= DEMONSTRAÇÕES DE INPUT MANAGER =======
    
    // 1. Clique em link
    console.log('Demonstração 1: Clique em um link usando InputManager...');
    await inputManager.click('a', {
      humanized: true,
      button: 'left'
    });
    await sleep(3000);
    
    // 2. Combinação de teclas
    console.log('Demonstração 2: Combinação de teclas (Ctrl+F)...');
    await inputManager.pressKeys(['Control', 'f']);
    await sleep(2000);
    
    // Fechar a busca com Escape
    await inputManager.keyboardAction('press', 'Escape');
    await sleep(1000);
    
    // 3. Criar um formulário simples para demonstração
    console.log('Criando um formulário simples para demonstração...');
    await page.evaluate(() => {
      // Criar um formulário simples
      const form = document.createElement('form');
      form.id = 'test-form';
      form.style.margin = '20px';
      form.style.padding = '20px';
      form.style.border = '1px solid #ccc';
      
      // Campo de nome
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Nome: ';
      nameLabel.for = 'name-input';
      
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.id = 'name-input';
      nameInput.placeholder = 'Digite seu nome';
      nameInput.style.margin = '10px';
      nameInput.style.padding = '5px';
      nameInput.style.width = '200px';
      
      // Campo de email
      const emailLabel = document.createElement('label');
      emailLabel.textContent = 'Email: ';
      emailLabel.for = 'email-input';
      
      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.id = 'email-input';
      emailInput.placeholder = 'Digite seu email';
      emailInput.style.margin = '10px';
      emailInput.style.padding = '5px';
      emailInput.style.width = '200px';
      
      // Checkbox
      const checkboxContainer = document.createElement('div');
      checkboxContainer.style.margin = '10px 0';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'agree-checkbox';
      
      const checkboxLabel = document.createElement('label');
      checkboxLabel.textContent = 'Concordo com os termos';
      checkboxLabel.for = 'agree-checkbox';
      checkboxLabel.style.marginLeft = '5px';
      
      // Botão de envio
      const submitButton = document.createElement('button');
      submitButton.textContent = 'Enviar';
      submitButton.style.margin = '10px';
      submitButton.style.padding = '5px 10px';
      submitButton.type = 'button';
      
      // Montar o formulário
      checkboxContainer.appendChild(checkbox);
      checkboxContainer.appendChild(checkboxLabel);
      
      form.appendChild(nameLabel);
      form.appendChild(nameInput);
      form.appendChild(document.createElement('br'));
      form.appendChild(emailLabel);
      form.appendChild(emailInput);
      form.appendChild(document.createElement('br'));
      form.appendChild(checkboxContainer);
      form.appendChild(document.createElement('br'));
      form.appendChild(submitButton);
      
      // Adicionar ao documento
      document.body.prepend(form);
    });
    
    await sleep(1000);
    
    // 4. Preencher formulário usando o InputManager
    console.log('Demonstração 4: Preenchimento de formulário coordenado...');
    await inputManager.fillForm([
      { selector: '#name-input', type: 'text', value: 'João Silva' },
      { selector: '#email-input', type: 'text', value: 'joao.silva@exemplo.com' },
      { selector: '#agree-checkbox', type: 'checkbox' },
      { selector: 'button', type: 'button' }
    ]);
    
    await sleep(2000);
    
    // 5. Pressionar teclas especiais e atalhos
    console.log('Demonstração 5: Atalhos de teclado predefinidos...');
    
    // Primeiro, selecionar todo o texto do email (clicando no campo)
    await inputManager.click('#email-input');
    await sleep(500);
    
    // Selecionar tudo com Ctrl+A
    await inputManager.keyboardAction('shortcut', 'selectAll');
    await sleep(1000);
    
    // Copiar com Ctrl+C
    await inputManager.keyboardAction('shortcut', 'copy');
    await sleep(1000);
    
    // Clicar no campo de nome para colar lá
    await inputManager.click('#name-input');
    await sleep(500);
    
    // Selecionar tudo primeiro
    await inputManager.keyboardAction('shortcut', 'selectAll');
    await sleep(500);
    
    // Colar com Ctrl+V
    await inputManager.keyboardAction('shortcut', 'paste');
    await sleep(1500);
    
    // 6. Rolagem controlada
    console.log('Demonstração 6: Rolagem controlada...');
    await inputManager.scroll({
      direction: 'down',
      distance: 200,
      humanized: true
    });
    await sleep(2000);
    
    // 7. Verificar histórico de interações
    if (inputManager.getInteractionHistory().length > 0) {
      console.log('Histórico de interações registrado:');
      console.log(`Total de interações: ${inputManager.getInteractionHistory().length}`);
      
      // Mostrar as últimas 3 interações
      const history = inputManager.getInteractionHistory();
      const lastThree = history.slice(Math.max(0, history.length - 3));
      
      for (const interaction of lastThree) {
        console.log(`Ação: ${interaction.action}, Timestamp: ${new Date(interaction.timestamp).toISOString()}`);
      }
    }
    
    // Finalizar liberando todas as teclas
    await inputManager.releaseAllKeys();
    
    console.log('Exemplo do InputManager concluído!');
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
  runInputManagerExample().catch(console.error);
}

export { runInputManagerExample };