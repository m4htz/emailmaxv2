/**
 * Implementação da automação de webmail para Yahoo Mail
 * Permite automação indetectável das operações no Yahoo Mail
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

interface YahooSelectors {
  // Selectors de login
  loginPage: {
    emailInput: string;
    nextButton: string;
    passwordInput: string;
    loginButton: string;
    staySignedInCheckbox: string;
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
    accountMenu: string;
    folderList: string;
  };
  // Selectors para composição de email
  compose: {
    toInput: string;
    subjectInput: string;
    bodyEditor: string;
    sendButton: string;
    discardButton: string;
    attachButton: string;
  };
}

/**
 * Classe para automação específica do Yahoo Mail
 * Implementa funcionalidades específicas do Yahoo Mail usando a classe base
 */
export class YahooAutomation extends BaseWebmailAutomation {
  private browser: any = null; // Tipo será do Playwright
  private page: any = null;
  private fingerprintGenerator: BrowserFingerprintGenerator;
  private humanBehavior: HumanBehaviorSimulator;
  private mockMode: boolean;
  
  // Selectors para elementos do Yahoo Mail
  private selectors: YahooSelectors = {
    loginPage: {
      emailInput: 'input[name="username"]',
      nextButton: 'input[name="signin"]',
      passwordInput: 'input[name="password"]',
      loginButton: 'button[name="verifyPassword"]',
      staySignedInCheckbox: 'input[name="persistent"]',
    },
    mailbox: {
      inboxSelector: 'a[data-test-folder-name="Inbox"]',
      composeButton: 'a[data-test-id="compose-button"]',
      refreshButton: 'button[title="Refresh"]',
      emailListItems: 'a[data-test-id="message-list-item"]',
      emailSubject: 'span[data-test-id="message-subject"]',
      emailBody: 'div[data-test-id="message-body"]',
      searchBox: 'input[placeholder="Search"]',
      accountMenu: 'button[aria-label="Account info"]',
      logoutButton: 'a[data-test-id="sign-out"]',
      folderList: 'ul[aria-label="Folder list"]',
    },
    compose: {
      toInput: 'input[id="message-to-field"]',
      subjectInput: 'input[data-test-id="compose-subject"]',
      bodyEditor: 'div[data-test-id="compose-editor"]',
      sendButton: 'button[data-test-id="compose-send-button"]',
      discardButton: 'button[title="Discard draft"]',
      attachButton: 'button[title="Attach files"]',
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
    this.fingerprintGenerator = new BrowserFingerprintGenerator({
      // Yahoo funciona melhor com Chrome e Firefox
      browserBase: Math.random() > 0.3 ? 'chrome' : 'firefox'
    });
    this.humanBehavior = new HumanBehaviorSimulator();
  }

  /**
   * Inicializa o navegador para automação do Yahoo Mail
   */
  public async initialize(): Promise<boolean> {
    if (this.mockMode) {
      // Modo de simulação para testes
      this.state = 'ready';
      console.log('Iniciando Yahoo Mail Automation em modo de simulação');
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
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security' // Para Yahoo que tem verificações de segurança adicionais
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
        
        // Remover métodos de detecção específicos do Yahoo
        if (window.ybar_detect_bot) {
          window.ybar_detect_bot = function() { return false; };
        }
        
        // Ocultar o uso de automação
        if (window.callPhantom) {
          delete window.callPhantom;
        }
        if (window.__nightmare) {
          delete window.__nightmare;
        }
        if (window.Buffer) {
          delete window.Buffer;
        }
      `);
      
      this.page = await context.newPage();
      
      // Configurar cookies se já tivermos uma sessão anterior
      if (this.account?.lastSession) {
        for (const [name, value] of Object.entries(this.account.lastSession.cookieData)) {
          await this.page.context().addCookies([{
            name,
            value,
            domain: '.yahoo.com',
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
      console.error('Erro ao inicializar navegador para Yahoo Mail:', error);
      this.state = 'error';
      return false;
    }
  }

  /**
   * Faz login no Yahoo Mail
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
      // Navegar para a página de login do Yahoo
      await this.page.goto('https://mail.yahoo.com/', { waitUntil: 'networkidle' });
      
      // Verificar se já estamos logados
      if (await this.isLoggedIn()) {
        this.state = 'ready';
        return this.createActionResult('login', true, undefined, { cached: true });
      }
      
      // Clicar no botão de login se estiver na página principal
      try {
        const signInButton = await this.page.$('a[data-ylk*="signin"]');
        if (signInButton) {
          await signInButton.click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle' });
        }
      } catch (e) {
        // Se não encontrar o botão, provavelmente já estamos na página de login
        console.log('Já na página de login ou botão não encontrado');
      }
      
      // Inserir email/nome de usuário
      await this.page.waitForSelector(this.selectors.loginPage.emailInput);
      await this.simulateHumanTyping(account.email, this.selectors.loginPage.emailInput);
      await this.randomDelay('short');
      
      // Clicar no botão de próximo
      await this.page.click(this.selectors.loginPage.nextButton);
      
      // Esperar pela tela de senha
      await this.page.waitForSelector(this.selectors.loginPage.passwordInput, { timeout: 10000 });
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

      // Verificar e marcar "Stay signed in" (aleatoriamente)
      try {
        const staySignedInCheckbox = await this.page.$(this.selectors.loginPage.staySignedInCheckbox);
        if (staySignedInCheckbox && Math.random() > 0.5) {
          await staySignedInCheckbox.click();
        }
      } catch (e) {
        console.log('Checkbox "Stay signed in" não encontrado');
      }
      
      // Clicar no botão de login
      await this.page.click(this.selectors.loginPage.loginButton);
      
      // Esperar a conclusão do login
      try {
        // Verificar redirecionamento para a caixa de entrada
        await this.page.waitForSelector(this.selectors.mailbox.composeButton, { timeout: 20000 });
      } catch (error) {
        // Verificar se há algum desafio de segurança ou erro de login
        const pageContent = await this.page.content();
        
        if (pageContent.includes('unusual activity') || pageContent.includes('verify your identity')) {
          this.state = 'error';
          return this.createActionResult('login', false, 'Desafio de segurança detectado');
        }
        
        if (pageContent.includes('wrong password') || pageContent.includes('invalid password')) {
          this.state = 'error';
          return this.createActionResult('login', false, 'Credenciais inválidas');
        }
        
        // Verificar se há verificação de telefone
        if (pageContent.includes('phone') && pageContent.includes('verify')) {
          this.state = 'error';
          return this.createActionResult('login', false, 'Verificação de telefone necessária');
        }
        
        this.state = 'error';
        return this.createActionResult('login', false, 'Erro desconhecido durante o login');
      }
      
      // Salvar cookies para reutilização posterior
      const cookies = await this.page.context().cookies();
      const cookieData: Record<string, string> = {};
      
      for (const cookie of cookies) {
        if (cookie.domain.includes('yahoo.com')) {
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
      console.error('Erro ao fazer login no Yahoo Mail:', error);
      this.state = 'error';
      return this.createActionResult('login', false, String(error));
    }
  }

  /**
   * Faz logout do Yahoo Mail
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
      // Verificar se estamos na página principal do Yahoo Mail
      const currentUrl = this.page.url();
      if (!currentUrl.includes('mail.yahoo.com')) {
        await this.page.goto('https://mail.yahoo.com/', { waitUntil: 'networkidle' });
        await this.randomDelay('medium');
      }
      
      // Clicar no menu da conta
      await this.page.click(this.selectors.mailbox.accountMenu);
      await this.randomDelay('short');
      
      // Clicar no botão de logout
      await this.page.click(this.selectors.mailbox.logoutButton);
      await this.page.waitForNavigation({ waitUntil: 'networkidle' });
      
      // Limpar cookies e armazenamento
      await this.page.context().clearCookies();
      
      this.state = 'ready';
      return this.createActionResult('logout', true);
    } catch (error) {
      console.error('Erro ao fazer logout do Yahoo Mail:', error);
      this.state = 'error';
      return this.createActionResult('logout', false, String(error));
    }
  }

  /**
   * Executa uma ação específica no Yahoo Mail
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
      // Verificar se estamos na página principal do Yahoo Mail
      const currentUrl = this.page.url();
      if (!currentUrl.includes('mail.yahoo.com')) {
        await this.page.goto('https://mail.yahoo.com/', { waitUntil: 'networkidle' });
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
        
        case 'create-folder':
          result = await this.createFolder(params);
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
      console.error(`Erro ao executar ação '${action}' no Yahoo Mail:`, error);
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
      // Se o botão de compor email estiver presente, estamos logados
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
      await this.page.keyboard.press('Tab'); // Mover para o campo de assunto
      await this.randomDelay('medium');
      
      // Preencher assunto
      await this.simulateHumanTyping(params.subject, this.selectors.compose.subjectInput);
      await this.page.keyboard.press('Tab'); // Mover para o corpo do email
      await this.randomDelay('medium');
      
      // Preencher corpo do email
      await this.simulateHumanTyping(params.body, this.selectors.compose.bodyEditor);
      await this.randomDelay('long');
      
      // Enviar email
      await this.page.click(this.selectors.compose.sendButton);
      
      // Esperar feedback de envio
      await this.page.waitForSelector('div[data-test-id="notifications"]', { timeout: 10000 });
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
        await this.search({ query: params.subject });
        
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

        // Mover mouse sobre o email para mostrar o menu de ações
        const emailBoundingBox = await emails[params.index].boundingBox();
        if (emailBoundingBox) {
          await this.page.hover(emails[params.index]);
          found = true;
        }
      } else if (params.subject) {
        // Procurar pelo assunto
        await this.search({ query: params.subject });
        
        // Verificar se há resultados
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        if (emails.length === 0) {
          return this.createActionResult(`mark-as-${action}`, false, 'Email não encontrado');
        }
        
        // Mover sobre o primeiro resultado
        await this.page.hover(emails[0]);
        found = true;
      }
      
      if (!found) {
        return this.createActionResult(`mark-as-${action}`, false, 'Email não encontrado ou não selecionável');
      }
      
      await this.randomDelay('short');
      
      // Realizar a ação correspondente
      let actionButtonSelector = '';
      
      switch (action) {
        case 'read':
          actionButtonSelector = 'button[title="Mark as read"]';
          break;
          
        case 'unread':
          actionButtonSelector = 'button[title="Mark as unread"]';
          break;
          
        case 'spam':
          actionButtonSelector = 'button[title="Mark as spam"]';
          break;
          
        case 'not-spam':
          // Para não-spam, primeiro precisamos ir para a pasta Spam
          await this.page.click('a[data-test-folder-name="Spam"]');
          await this.randomDelay('medium');
          
          // Procurar o email novamente
          if (params.subject) {
            await this.search({ query: params.subject });
          }
          
          const spamEmails = await this.page.$$(this.selectors.mailbox.emailListItems);
          if (spamEmails.length === 0) {
            return this.createActionResult(`mark-as-${action}`, false, 'Email não encontrado na pasta Spam');
          }
          
          await this.page.hover(spamEmails[0]);
          actionButtonSelector = 'button[title="Not spam"]';
          break;
      }
      
      // Clicar no botão da ação
      await this.page.click(actionButtonSelector);
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
      // Primeiro, encontrar e selecionar o email
      let emailSelected = false;
      
      if (params.index !== undefined) {
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        
        if (params.index >= emails.length) {
          return this.createActionResult('move-to-folder', false, 'Índice de email inválido');
        }
        
        // Selecionar o email via checkbox
        const checkbox = await emails[params.index].$('input[type="checkbox"]');
        if (checkbox) {
          await checkbox.click();
          emailSelected = true;
        } else {
          // Alternativa: hover e usar o menu de ações
          await this.page.hover(emails[params.index]);
          emailSelected = true;
        }
      } else if (params.subject) {
        // Procurar pelo assunto
        await this.search({ query: params.subject });
        
        // Verificar se há resultados
        const emails = await this.page.$$(this.selectors.mailbox.emailListItems);
        if (emails.length === 0) {
          return this.createActionResult('move-to-folder', false, 'Email não encontrado');
        }
        
        // Selecionar o primeiro resultado
        const checkbox = await emails[0].$('input[type="checkbox"]');
        if (checkbox) {
          await checkbox.click();
          emailSelected = true;
        } else {
          // Alternativa: hover e usar o menu de ações
          await this.page.hover(emails[0]);
          emailSelected = true;
        }
      }
      
      if (!emailSelected) {
        return this.createActionResult('move-to-folder', false, 'Email não encontrado ou não selecionável');
      }
      
      await this.randomDelay('short');
      
      // Clicar no botão de mover
      await this.page.click('button[title="Move"]');
      await this.randomDelay('short');
      
      // Procurar a pasta na lista que aparece
      const folderSelector = `button[title="${params.folder}"]`;
      
      try {
        await this.page.waitForSelector(folderSelector, { timeout: 5000 });
        await this.page.click(folderSelector);
      } catch (error) {
        // Se a pasta não for encontrada diretamente, procurar na lista completa
        await this.page.click('button[title="Show more..."]');
        await this.randomDelay('short');
        
        try {
          await this.page.waitForSelector(folderSelector, { timeout: 5000 });
          await this.page.click(folderSelector);
        } catch (nestedError) {
          return this.createActionResult('move-to-folder', false, `Pasta "${params.folder}" não encontrada`);
        }
      }
      
      // Esperar confirmação de movimento
      await this.randomDelay('medium');
      
      return this.createActionResult('move-to-folder', true);
    } catch (error) {
      console.error('Erro ao mover email para pasta:', error);
      return this.createActionResult('move-to-folder', false, String(error));
    }
  }

  /**
   * Criar nova pasta
   */
  private async createFolder(params: Record<string, any>): Promise<ActionResult> {
    if (!params.name) {
      return this.createActionResult('create-folder', false, 'Nome da pasta não especificado');
    }
    
    try {
      // Clicar no botão "+ Adicionar Nova Pasta"
      const newFolderButton = await this.page.$('button[title="Add new folder"]');
      if (!newFolderButton) {
        // Se o botão não for encontrado, tentar abrir o menu de pastas primeiro
        await this.page.click('button[title="Folders"]');
        await this.randomDelay('short');
        
        // Agora procurar o botão novamente
        const folderMenuButton = await this.page.$('button[title="Add new folder"]');
        if (!folderMenuButton) {
          return this.createActionResult('create-folder', false, 'Botão de adicionar pasta não encontrado');
        }
        
        await folderMenuButton.click();
      } else {
        await newFolderButton.click();
      }
      
      await this.randomDelay('short');
      
      // Digitiar o nome da pasta
      await this.simulateHumanTyping(params.name, 'input[placeholder="Folder name"]');
      
      // Clicar em OK/Save
      await this.page.click('button[type="submit"]');
      
      // Esperar confirmação
      await this.randomDelay('medium');
      
      return this.createActionResult('create-folder', true);
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      return this.createActionResult('create-folder', false, String(error));
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
      
      // Aguardar carregamento dos resultados (esperar pelo spinner desaparecer)
      await this.page.waitForSelector('div[role="progressbar"]', { timeout: 5000 }).catch(() => {});
      await this.page.waitForFunction(() => !document.querySelector('div[role="progressbar"]'), { timeout: 15000 }).catch(() => {});
      
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