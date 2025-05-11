/**
 * Implementação da automação de webmail para Gmail
 * Permite automação indetectável das operações no Gmail
 */

import { 
  WebmailAction, 
  WebmailAccount, 
  ActionResult,
  BrowserState
} from './types';
import { BaseWebmailAutomation } from './base-automation';
import { BrowserFingerprintGenerator } from './browser-fingerprint';
import { HumanBehaviorSimulator } from './human-behavior';

interface GmailSelectors {
  // Selectors de login
  loginPage: {
    emailInput: string;
    emailNextButton: string;
    passwordInput: string;
    passwordNextButton: string;
    staySignedInButton: string;
  };
  // Selectors da página principal
  mailbox: {
    inboxSelector: string;
    composeButton: string;
    refreshButton: string;
    emailListItems: string;
    emailSubject: string;
    emailBody: string;
    searchBox: string;
    logoutButton: string;
    accountButton: string;
  };
  // Selectors para composição de email
  compose: {
    toInput: string;
    subjectInput: string;
    bodyInput: string;
    sendButton: string;
    discardButton: string;
  };
}

/**
 * Classe para automação específica do Gmail
 * Implementa funcionalidades específicas do Gmail usando a classe base
 */
export class GmailAutomation extends BaseWebmailAutomation {
  private browser: any = null; // Tipo será do Playwright ou Puppeteer
  private page: any = null;
  private fingerprintGenerator: BrowserFingerprintGenerator;
  private humanBehavior: HumanBehaviorSimulator;
  private mockMode: boolean;
  
  // Selectors para elementos do Gmail
  private selectors: GmailSelectors = {
    loginPage: {
      emailInput: 'input[type="email"]',
      emailNextButton: '#identifierNext button',
      passwordInput: 'input[type="password"]',
      passwordNextButton: '#passwordNext button',
      staySignedInButton: '#stay-signed-in-button'
    },
    mailbox: {
      inboxSelector: 'a[href="https://mail.google.com/mail/u/0/#inbox"]',
      composeButton: 'div[role="button"][gh="cm"]',
      refreshButton: 'div[act="20"]',
      emailListItems: 'tr.zA',
      emailSubject: 'h2.hP',
      emailBody: 'div.a3s',
      searchBox: 'input[aria-label="Search mail"]',
      logoutButton: '#gb_71',
      accountButton: 'a[aria-label*="Google Account"]'
    },
    compose: {
      toInput: 'textarea[aria-label="To"]',
      subjectInput: 'input[aria-label="Subject"]',
      bodyInput: 'div[role="textbox"][aria-label="Message Body"]',
      sendButton: 'div[role="button"][aria-label*="Send"]',
      discardButton: 'div[role="button"][aria-label*="Discard"]'
    }
  };

  constructor(options: {
    isHeadless?: boolean;
    mockMode?: boolean;
    humanBehavior?: any;
  } = {}) {
    super({
      isHeadless: options.isHeadless !== undefined ? options.isHeadless : true,
      humanBehavior: options.humanBehavior
    });
    
    this.mockMode = options.mockMode !== undefined ? options.mockMode : false;
    this.fingerprintGenerator = new BrowserFingerprintGenerator();
    this.humanBehavior = new HumanBehaviorSimulator();
  }

  /**
   * Inicializa o navegador para automação do Gmail
   */
  public async initialize(): Promise<boolean> {
    if (this.mockMode) {
      // Modo de simulação para testes
      this.state = 'ready';
      console.log('Iniciando Gmail Automation em modo de simulação');
      return true;
    }

    try {
      // Importar dinamicamente o Playwright
      const { chromium } = await import('playwright');
      
      // Gerar fingerprint do navegador
      const fingerprint = this.fingerprintGenerator.generateFingerprint();
      this.userAgent = fingerprint.userAgent;
      
      // Inicializar o navegador com as configurações apropriadas
      this.browser = await chromium.launch({
        headless: this.isHeadless,
        args: [
          `--user-agent=${this.userAgent}`,
          `--window-size=${fingerprint.screenResolution.width},${fingerprint.screenResolution.height}`,
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
      
      // Criar uma nova página
      const context = await this.browser.newContext({
        userAgent: this.userAgent,
        viewport: {
          width: fingerprint.screenResolution.width,
          height: fingerprint.screenResolution.height
        },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        colorScheme: 'light',
        locale: fingerprint.language,
        timezoneId: this.convertTimezoneOffsetToName(fingerprint.timezone),
        geolocation: undefined,
        permissions: []
      });
      
      // Aplicar scripts para injetar fingerprints
      await context.addInitScript(`
        // Ocultar que estamos em um ambiente automatizado
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => ${JSON.stringify(fingerprint.plugins)} });
        Object.defineProperty(navigator, 'languages', { get: () => ['${fingerprint.language}'] });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${fingerprint.hardwareConcurrency} });
        ${fingerprint.deviceMemory ? `Object.defineProperty(navigator, 'deviceMemory', { get: () => ${fingerprint.deviceMemory} });` : ''}
        
        // Simular canvas fingerprint consistente
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function() {
          const context = originalGetContext.apply(this, arguments);
          if (context && arguments[0] === '2d') {
            const originalFillText = context.fillText;
            context.fillText = function() {
              // Alteração sutil no rendering para produzir um hash específico
              arguments[1] += 0.00000001;
              return originalFillText.apply(this, arguments);
            };
          }
          return context;
        };
      `);
      
      this.page = await context.newPage();
      
      // Configurar cookies se já tivermos uma sessão anterior
      if (this.account?.lastSession) {
        for (const [name, value] of Object.entries(this.account.lastSession.cookieData)) {
          await this.page.context().addCookies([{
            name,
            value,
            domain: '.google.com',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: true,
            sameSite: 'Lax'
          }]);
        }
      }
      
      this.state = 'ready';
      return true;
    } catch (error) {
      console.error('Erro ao inicializar navegador para Gmail:', error);
      this.state = 'error';
      return false;
    }
  }

  /**
   * Faz login no Gmail
   */
  public async login(account: WebmailAccount): Promise<ActionResult> {
    if (this.mockMode) {
      // Simulação de login para testes
      this.account = account;
      return this.createActionResult('login', true);
    }

    this.account = account;
    this.state = 'navigating';
    
    try {
      // Navegar para a página de login do Gmail
      await this.page.goto('https://mail.google.com/', { waitUntil: 'networkidle' });
      
      // Verificar se já estamos logados
      if (await this.isLoggedIn()) {
        this.state = 'ready';
        return this.createActionResult('login', true, undefined, { cached: true });
      }
      
      // Inserir email
      await this.page.waitForSelector(this.selectors.loginPage.emailInput);
      await this.simulateHumanTyping(account.email, this.selectors.loginPage.emailInput);
      await this.randomDelay('short');
      
      // Clicar no botão de próximo
      await this.page.click(this.selectors.loginPage.emailNextButton);
      await this.page.waitForSelector(this.selectors.loginPage.passwordInput);
      await this.randomDelay('medium');
      
      // Obter senha com segurança
      let password = '';
      // Implementar integração com sistema de credenciais seguras
      if (account.usesOAuth) {
        // Implementar fluxo OAuth
        throw new Error('Autenticação OAuth ainda não implementada');
      } else {
        // Em produção, obter senha do vault seguro
        // Para desenvolvimento, usar uma senha temporária - NUNCA fazer isso em produção!
        password = 'senha_temporaria_para_desenvolvimento';
      }
      
      // Inserir senha
      await this.simulateHumanTyping(password, this.selectors.loginPage.passwordInput);
      await this.randomDelay('short');
      
      // Clicar no botão de próximo
      await this.page.click(this.selectors.loginPage.passwordNextButton);
      
      // Esperar a conclusão do login
      try {
        // Tentar localizar o botão de compor, que indica sucesso no login
        await this.page.waitForSelector(this.selectors.mailbox.composeButton, { timeout: 10000 });
      } catch (error) {
        // Verificar se há algum desafio de segurança ou erro de login
        const pageContent = await this.page.content();

        if (pageContent.includes('Verify it\'s you') || pageContent.includes('unusual activity')) {
          this.state = 'error';
          return this.createActionResult('login', false, 'Desafio de segurança detectado');
        }
        
        if (pageContent.includes('Wrong password') || pageContent.includes('couldn\'t find your Google Account')) {
          this.state = 'error';
          return this.createActionResult('login', false, 'Credenciais inválidas');
        }
        
        this.state = 'error';
        return this.createActionResult('login', false, 'Erro desconhecido durante o login');
      }
      
      // Salvar cookies para reutilização posterior
      const cookies = await this.page.context().cookies();
      const cookieData: Record<string, string> = {};
      
      for (const cookie of cookies) {
        if (cookie.domain.includes('google.com')) {
          cookieData[cookie.name] = cookie.value;
        }
      }
      
      // Atualizar as informações da sessão
      if (!this.account.lastSession) {
        this.account.lastSession = {
          cookieData,
          lastLogin: new Date(),
          lastActivity: new Date(),
          userAgent: this.userAgent,
          browserFingerprint: ''
        };
      } else {
        this.account.lastSession.cookieData = cookieData;
        this.account.lastSession.lastLogin = new Date();
        this.account.lastSession.lastActivity = new Date();
        this.account.lastSession.userAgent = this.userAgent;
      }
      
      this.state = 'ready';
      return this.createActionResult('login', true);
    } catch (error) {
      console.error('Erro ao fazer login no Gmail:', error);
      this.state = 'error';
      return this.createActionResult('login', false, String(error));
    }
  }

  /**
   * Faz logout do Gmail
   */
  public async logout(): Promise<ActionResult> {
    if (this.mockMode) {
      // Simulação de logout para testes
      return this.createActionResult('logout', true);
    }

    if (!this.page || this.state === 'closed') {
      return this.createActionResult('logout', false, 'Navegador não inicializado');
    }
    
    this.state = 'navigating';
    
    try {
      // Verificar se estamos na página do Gmail
      const currentUrl = this.page.url();
      if (!currentUrl.includes('mail.google.com')) {
        await this.page.goto('https://mail.google.com/', { waitUntil: 'networkidle' });
        await this.randomDelay('medium');
      }
      
      // Clicar no botão da conta
      await this.page.click(this.selectors.mailbox.accountButton);
      await this.randomDelay('short');
      
      // Clicar no botão de logout
      await this.page.click(this.selectors.mailbox.logoutButton);
      await this.page.waitForNavigation({ waitUntil: 'networkidle' });
      
      // Limpar cookies e armazenamento
      await this.page.context().clearCookies();
      
      this.state = 'ready';
      return this.createActionResult('logout', true);
    } catch (error) {
      console.error('Erro ao fazer logout do Gmail:', error);
      this.state = 'error';
      return this.createActionResult('logout', false, String(error));
    }
  }

  /**
   * Executa uma ação específica no Gmail
   */
  public async executeAction(action: WebmailAction, params: Record<string, any> = {}): Promise<ActionResult> {
    if (this.mockMode) {
      // Simulação de ações para testes
      return this.createActionResult(action, true, undefined, { mockMode: true, params });
    }

    if (!this.page || this.state === 'closed' || this.state === 'error') {
      return this.createActionResult(action, false, 'Navegador não está pronto');
    }
    
    if (!this.account) {
      return this.createActionResult(action, false, 'Conta não configurada');
    }
    
    this.state = 'interacting';
    
    try {
      // Verificar se estamos na página do Gmail
      const currentUrl = this.page.url();
      if (!currentUrl.includes('mail.google.com')) {
        await this.page.goto('https://mail.google.com/', { waitUntil: 'networkidle' });
        await this.randomDelay('medium');
      }
      
      // Executar a ação solicitada
      let result: ActionResult;
      
      switch (action) {
        case 'send-email':
          result = await this.sendEmail(params);
          break;
        
        case 'read-email':
          result = await this.readEmail(params);
          break;
        
        case 'mark-as-read':
          result = await this.markEmailAs(params, 'read');
          break;
        
        case 'mark-as-unread':
          result = await this.markEmailAs(params, 'unread');
          break;
        
        case 'mark-as-spam':
          result = await this.markEmailAs(params, 'spam');
          break;
        
        case 'mark-as-not-spam':
          result = await this.markEmailAs(params, 'not-spam');
          break;
        
        case 'move-to-folder':
          result = await this.moveToFolder(params);
          break;
        
        case 'search':
          result = await this.search(params);
          break;
        
        default:
          result = this.createActionResult(action, false, `Ação '${action}' não implementada`);
      }
      
      // Atualizar timestamp de última atividade
      if (this.account.lastSession) {
        this.account.lastSession.lastActivity = new Date();
      }
      
      this.state = 'ready';
      return result;
    } catch (error) {
      console.error(`Erro ao executar ação '${action}' no Gmail:`, error);
      this.state = 'error';
      return this.createActionResult(action, false, String(error));
    }
  }

  /**
   * Fecha o navegador
   */
  public async close(): Promise<void> {
    if (this.mockMode) {
      this.state = 'closed';
      return;
    }

    if (this.browser) {
      await this.browser.close();
    }
    
    this.browser = null;
    this.page = null;
    this.state = 'closed';
  }

  /**
   * Implementação da digitação humana
   */
  protected async simulateHumanTyping(text: string, fieldSelector: string): Promise<void> {
    if (this.mockMode) return;

    await this.page.waitForSelector(fieldSelector);
    
    // Obter delays para cada caractere
    const humanBehavior = new HumanBehaviorSimulator();
    const delays = humanBehavior.generateTypingDelays(text);
    
    // Simular possiveis erros de digitação
    const { textWithErrors, corrections } = humanBehavior.simulateTypingErrors(text);
    
    // Posição atual na string de saída
    let currentPos = 0;
    
    // Focar no campo
    await this.page.focus(fieldSelector);
    await this.randomDelay('short');
    
    // Digitar com possíveis erros e correções
    for (let i = 0; i < textWithErrors.length; i++) {
      // Verificar se há uma correção nesta posição
      const correction = corrections.find(c => c.pos === i);
      
      if (correction) {
        if (correction.type === 'backspace') {
          // Simular erro de digitação seguido de backspace
          await this.page.keyboard.press('Backspace');
          await this.randomDelay('short');
        }
      }
      
      // Digitar caractere
      await this.page.keyboard.type(textWithErrors[i]);
      
      // Esperar o delay apropriado
      await new Promise(resolve => setTimeout(resolve, delays[currentPos]));
      currentPos++;
    }
    
    // Pequena pausa após concluir a digitação
    await this.randomDelay('short');
  }

  /**
   * Implementação do movimento de cursor humano
   */
  protected async simulateHumanCursorMovement(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number
  ): Promise<void> {
    if (this.mockMode) return;

    // Gerar caminho do cursor
    const humanBehavior = new HumanBehaviorSimulator();
    const path = humanBehavior.generateCursorPath(startX, startY, endX, endY);
    
    // Mover cursor ao longo do caminho
    for (const point of path) {
      await this.page.mouse.move(point.x, point.y);
      await new Promise(resolve => setTimeout(resolve, point.timeOffset));
    }
  }

  /**
   * Verifica se já estamos logados
   */
  private async isLoggedIn(): Promise<boolean> {
    try {
      // Se o botão de compor estiver presente, estamos logados
      return await this.page.$(this.selectors.mailbox.composeButton) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enviar email
   */
  private async sendEmail(params: Record<string, any>): Promise<ActionResult> {
    if (!params.to || !params.subject || !params.body) {
      return this.createActionResult('send-email', false, 'Parâmetros incompletos');
    }
    
    try {
      // Clicar no botão de compor
      await this.page.click(this.selectors.mailbox.composeButton);
      await this.page.waitForSelector(this.selectors.compose.toInput);
      await this.randomDelay('medium');
      
      // Preencher destinatário
      await this.simulateHumanTyping(params.to, this.selectors.compose.toInput);
      await this.randomDelay('medium');
      
      // Preencher assunto
      await this.simulateHumanTyping(params.subject, this.selectors.compose.subjectInput);
      await this.randomDelay('medium');
      
      // Preencher corpo do email
      await this.simulateHumanTyping(params.body, this.selectors.compose.bodyInput);
      await this.randomDelay('long');
      
      // Enviar email
      await this.page.click(this.selectors.compose.sendButton);
      
      // Esperar pelo feedback de envio
      await this.page.waitForSelector('div[role="alert"][aria-live="assertive"]', { timeout: 10000 });
      await this.randomDelay('medium');
      
      return this.createActionResult('send-email', true);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return this.createActionResult('send-email', false, String(error));
    }
  }

  /**
   * Ler email
   */
  private async readEmail(params: Record<string, any>): Promise<ActionResult> {
    try {
      // Se o índice do email for fornecido, abrir o email correspondente
      if (params.index !== undefined) {
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        
        if (params.index >= emails.length) {
          return this.createActionResult('read-email', false, 'Índice de email inválido');
        }
        
        // Obter posição do email para mover o cursor
        const emailBoundingBox = await emails[params.index].boundingBox();
        if (emailBoundingBox) {
          const startX = this.page.viewportSize().width / 2;
          const startY = this.page.viewportSize().height / 2;
          const targetX = emailBoundingBox.x + emailBoundingBox.width / 2;
          const targetY = emailBoundingBox.y + emailBoundingBox.height / 2;
          
          await this.simulateHumanCursorMovement(startX, startY, targetX, targetY);
        }
        
        // Clicar no email
        await emails[params.index].click();
      } else if (params.subject) {
        // Se o assunto for fornecido, procurar por ele
        await this.search({ query: `subject:${params.subject}` });
        
        // Clicar no primeiro resultado
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        if (emails.length === 0) {
          return this.createActionResult('read-email', false, 'Email não encontrado');
        }
        
        await emails[0].click();
      } else {
        return this.createActionResult('read-email', false, 'Parâmetros insuficientes');
      }
      
      // Esperar carregamento do email
      await this.page.waitForSelector(this.selectors.mailbox.emailSubject);
      await this.page.waitForSelector(this.selectors.mailbox.emailBody);
      
      // Obter conteúdo do email
      const subject = await this.page.$eval(this.selectors.mailbox.emailSubject, (el: any) => el.textContent);
      const body = await this.page.$eval(this.selectors.mailbox.emailBody, (el: any) => el.textContent);
      
      // Simular tempo de leitura
      await this.simulateReadingTime((subject + body).length);
      
      return this.createActionResult('read-email', true, undefined, {
        subject,
        bodyPreview: body.substring(0, 200) + (body.length > 200 ? '...' : '')
      });
    } catch (error) {
      console.error('Erro ao ler email:', error);
      return this.createActionResult('read-email', false, String(error));
    }
  }

  /**
   * Marcar email como lido/não lido/spam/não spam
   */
  private async markEmailAs(params: Record<string, any>, action: 'read' | 'unread' | 'spam' | 'not-spam'): Promise<ActionResult> {
    try {
      // Primeiro, encontrar o email
      let found = false;
      
      if (params.index !== undefined) {
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        
        if (params.index >= emails.length) {
          return this.createActionResult(`mark-as-${action}`, false, 'Índice de email inválido');
        }
        
        // Selecionar o email pelo checkbox
        const checkbox = await emails[params.index].$('div[role="checkbox"]');
        if (checkbox) {
          await checkbox.click();
          found = true;
        }
      } else if (params.subject) {
        // Procurar pelo assunto
        await this.search({ query: `subject:${params.subject}` });
        
        // Verificar se há resultados
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        if (emails.length === 0) {
          return this.createActionResult(`mark-as-${action}`, false, 'Email não encontrado');
        }
        
        // Selecionar o primeiro resultado
        const checkbox = await emails[0].$('div[role="checkbox"]');
        if (checkbox) {
          await checkbox.click();
          found = true;
        }
      }
      
      if (!found) {
        return this.createActionResult(`mark-as-${action}`, false, 'Email não encontrado ou não selecionável');
      }
      
      // Realizar a ação correspondente
      switch (action) {
        case 'read':
          // Marcar como lido (botão com ícone de envelope)
          await this.page.click('div[aria-label="Mark as read"]');
          break;
          
        case 'unread':
          // Marcar como não lido (botão com ícone de envelope)
          await this.page.click('div[aria-label="Mark as unread"]');
          break;
          
        case 'spam':
          // Marcar como spam (botão com ícone de exclamação)
          await this.page.click('div[aria-label="Report spam"]');
          break;
          
        case 'not-spam':
          // Primeiro, ir para a pasta de spam
          await this.page.click('a[href$="#spam"]');
          await this.randomDelay('medium');
          
          // Selecionar o email novamente
          if (params.index !== undefined) {
            const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
            if (params.index >= emails.length) {
              return this.createActionResult(`mark-as-${action}`, false, 'Email não encontrado na pasta de spam');
            }
            
            const checkbox = await emails[params.index].$('div[role="checkbox"]');
            if (checkbox) {
              await checkbox.click();
            }
          } else if (params.subject) {
            // Procurar pelo assunto
            await this.search({ query: `subject:${params.subject} in:spam` });
            
            // Verificar se há resultados
            const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
            if (emails.length === 0) {
              return this.createActionResult(`mark-as-${action}`, false, 'Email não encontrado na pasta de spam');
            }
            
            // Selecionar o primeiro resultado
            const checkbox = await emails[0].$('div[role="checkbox"]');
            if (checkbox) {
              await checkbox.click();
            }
          }
          
          // Marcar como não spam
          await this.page.click('div[aria-label="Not spam"]');
          break;
      }
      
      // Aguardar feedback visual
      await this.randomDelay('medium');
      
      return this.createActionResult(`mark-as-${action}`, true);
    } catch (error) {
      console.error(`Erro ao marcar email como ${action}:`, error);
      return this.createActionResult(`mark-as-${action}`, false, String(error));
    }
  }

  /**
   * Mover email para uma pasta específica
   */
  private async moveToFolder(params: Record<string, any>): Promise<ActionResult> {
    if (!params.folder) {
      return this.createActionResult('move-to-folder', false, 'Pasta de destino não especificada');
    }
    
    try {
      // Primeiro, encontrar o email
      let found = false;
      
      if (params.index !== undefined) {
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        
        if (params.index >= emails.length) {
          return this.createActionResult('move-to-folder', false, 'Índice de email inválido');
        }
        
        // Selecionar o email pelo checkbox
        const checkbox = await emails[params.index].$('div[role="checkbox"]');
        if (checkbox) {
          await checkbox.click();
          found = true;
        }
      } else if (params.subject) {
        // Procurar pelo assunto
        await this.search({ query: `subject:${params.subject}` });
        
        // Verificar se há resultados
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        if (emails.length === 0) {
          return this.createActionResult('move-to-folder', false, 'Email não encontrado');
        }
        
        // Selecionar o primeiro resultado
        const checkbox = await emails[0].$('div[role="checkbox"]');
        if (checkbox) {
          await checkbox.click();
          found = true;
        }
      }
      
      if (!found) {
        return this.createActionResult('move-to-folder', false, 'Email não encontrado ou não selecionável');
      }
      
      // Clicar no botão de mover (botão com ícone de pasta)
      await this.page.click('div[aria-label="Move to"]');
      await this.randomDelay('short');
      
      // Na caixa de diálogo, selecionar a pasta de destino
      const folderSelector = `div[role="menuitem"][aria-label="${params.folder}"]`;
      
      try {
        await this.page.waitForSelector(folderSelector, { timeout: 5000 });
        await this.page.click(folderSelector);
      } catch (error) {
        // Se a pasta específica não for encontrada, tente clicar no campo de pesquisa
        // e digitar o nome da pasta
        await this.page.click('input[aria-label="Search folders"]');
        await this.simulateHumanTyping(params.folder, 'input[aria-label="Search folders"]');
        await this.randomDelay('short');
        
        // Tentar encontrar a pasta agora
        try {
          await this.page.waitForSelector(folderSelector, { timeout: 5000 });
          await this.page.click(folderSelector);
        } catch (nestedError) {
          return this.createActionResult('move-to-folder', false, `Pasta "${params.folder}" não encontrada`);
        }
      }
      
      // Aguardar feedback visual
      await this.randomDelay('medium');
      
      return this.createActionResult('move-to-folder', true);
    } catch (error) {
      console.error('Erro ao mover email para pasta:', error);
      return this.createActionResult('move-to-folder', false, String(error));
    }
  }

  /**
   * Pesquisar emails
   */
  private async search(params: Record<string, any>): Promise<ActionResult> {
    if (!params.query) {
      return this.createActionResult('search', false, 'Consulta de pesquisa não especificada');
    }
    
    try {
      // Clicar na caixa de pesquisa
      await this.page.click(this.selectors.mailbox.searchBox);
      await this.randomDelay('short');
      
      // Limpar a caixa de pesquisa (selecionar tudo e deletar)
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      await this.randomDelay('short');
      
      // Digitar a consulta
      await this.simulateHumanTyping(params.query, this.selectors.mailbox.searchBox);
      
      // Pressionar Enter
      await this.page.keyboard.press('Enter');
      
      // Aguardar resultados
      await this.page.waitForFunction(() => {
        // Verificar se a URL foi atualizada com os parâmetros de pesquisa
        return window.location.hash.includes('#search/');
      }, { timeout: 10000 });
      
      await this.randomDelay('medium');
      
      // Contar os resultados
      const results = await this.page.$$(this.selectors.mailbox.emailListItems);
      
      return this.createActionResult('search', true, undefined, {
        query: params.query,
        resultCount: results.length
      });
    } catch (error) {
      console.error('Erro ao pesquisar emails:', error);
      return this.createActionResult('search', false, String(error));
    }
  }

  /**
   * Converte offset de fuso horário para nome de timezone
   */
  private convertTimezoneOffsetToName(offset: string): string {
    // Mapeamento simples de offset para nomes comuns de timezone
    const timezoneMap: Record<string, string> = {
      '-12:00': 'Etc/GMT+12',
      '-11:00': 'Etc/GMT+11',
      '-10:00': 'Pacific/Honolulu',
      '-09:00': 'America/Anchorage',
      '-08:00': 'America/Los_Angeles',
      '-07:00': 'America/Denver',
      '-06:00': 'America/Chicago',
      '-05:00': 'America/New_York',
      '-04:00': 'America/Halifax',
      '-03:00': 'America/Sao_Paulo',
      '-02:00': 'Etc/GMT+2',
      '-01:00': 'Atlantic/Azores',
      '+00:00': 'Europe/London',
      '+01:00': 'Europe/Paris',
      '+02:00': 'Europe/Kiev',
      '+03:00': 'Europe/Moscow',
      '+04:00': 'Asia/Dubai',
      '+05:00': 'Asia/Karachi',
      '+05:30': 'Asia/Kolkata',
      '+06:00': 'Asia/Dhaka',
      '+07:00': 'Asia/Bangkok',
      '+08:00': 'Asia/Shanghai',
      '+09:00': 'Asia/Tokyo',
      '+10:00': 'Australia/Sydney',
      '+11:00': 'Pacific/Guadalcanal',
      '+12:00': 'Pacific/Auckland'
    };
    
    return timezoneMap[offset] || 'Etc/UTC';
  }
}