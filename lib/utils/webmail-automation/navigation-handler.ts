/**
 * Sistema de navegação para interfaces de webmail
 * Implementa funções de navegação avançadas e resilientes para Gmail, Outlook e Yahoo
 */

import { WebmailProvider, BrowserState, ActionResult, WebmailAction } from './types';
import { AdaptiveSelectors } from './adaptive-selectors';
import { HumanBehaviorSimulator } from './human-behavior';

/**
 * Interface para as rotas de navegação específicas de cada provedor
 */
export interface NavigationRoutes {
  inbox: string;
  sent: string;
  drafts: string;
  spam: string;
  trash: string;
  starred: string;
  important?: string;
  archives?: string;
  [key: string]: string | undefined;
}

/**
 * Interface para as opções de navegação
 */
export interface NavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  humanizedNavigation?: boolean;
}

/**
 * Classe responsável pela navegação em interfaces de webmail
 * Fornece funções para navegar entre pastas e localizar elementos específicos
 */
export class NavigationHandler {
  private provider: WebmailProvider;
  private page: any; // Objeto página do Playwright
  private selectors: AdaptiveSelectors;
  private humanBehavior: HumanBehaviorSimulator;
  private browserState: BrowserState;
  private routes: NavigationRoutes;
  private baseUrl: string;
  private mockMode: boolean;

  constructor(
    provider: WebmailProvider,
    page: any,
    state: BrowserState,
    options: {
      mockMode?: boolean;
      humanBehavior?: HumanBehaviorSimulator;
      adaptiveSelectors?: AdaptiveSelectors;
    } = {}
  ) {
    this.provider = provider;
    this.page = page;
    this.browserState = state;
    this.mockMode = options.mockMode || false;
    this.humanBehavior = options.humanBehavior || new HumanBehaviorSimulator();
    
    // Inicializar seletores adaptativos se não fornecidos
    this.selectors = options.adaptiveSelectors || new AdaptiveSelectors(provider, page);
    
    // Configurar as rotas de navegação baseadas no provedor
    this.routes = this.initializeRoutes();
    this.baseUrl = this.getBaseUrl();
  }

  /**
   * Inicializa as rotas de navegação baseado no provedor
   */
  private initializeRoutes(): NavigationRoutes {
    switch (this.provider) {
      case 'gmail':
        return {
          inbox: 'https://mail.google.com/mail/u/0/#inbox',
          sent: 'https://mail.google.com/mail/u/0/#sent',
          drafts: 'https://mail.google.com/mail/u/0/#drafts',
          spam: 'https://mail.google.com/mail/u/0/#spam',
          trash: 'https://mail.google.com/mail/u/0/#trash',
          starred: 'https://mail.google.com/mail/u/0/#starred',
          important: 'https://mail.google.com/mail/u/0/#imp',
          archives: 'https://mail.google.com/mail/u/0/#all'
        };
      
      case 'outlook':
        return {
          inbox: 'https://outlook.live.com/mail/0/inbox',
          sent: 'https://outlook.live.com/mail/0/sentitems',
          drafts: 'https://outlook.live.com/mail/0/drafts',
          spam: 'https://outlook.live.com/mail/0/junkemail',
          trash: 'https://outlook.live.com/mail/0/deleteditems',
          starred: 'https://outlook.live.com/mail/0/inbox/filtermessages?focusSection=favorites',
          archives: 'https://outlook.live.com/mail/0/archive'
        };
      
      case 'yahoo':
        return {
          inbox: 'https://mail.yahoo.com/d/folders/1',
          sent: 'https://mail.yahoo.com/d/folders/2',
          drafts: 'https://mail.yahoo.com/d/folders/3',
          spam: 'https://mail.yahoo.com/d/folders/Bulk', 
          trash: 'https://mail.yahoo.com/d/folders/Trash',
          starred: 'https://mail.yahoo.com/d/folders/~Focused'
        };
      
      default:
        return {
          inbox: '',
          sent: '',
          drafts: '',
          spam: '',
          trash: '',
          starred: ''
        };
    }
  }

  /**
   * Retorna a URL base para o provedor
   */
  private getBaseUrl(): string {
    switch (this.provider) {
      case 'gmail':
        return 'https://mail.google.com';
      case 'outlook':
        return 'https://outlook.live.com';
      case 'yahoo':
        return 'https://mail.yahoo.com';
      default:
        return '';
    }
  }

  /**
   * Obtém o estado atual do navegador
   */
  public getState(): BrowserState {
    return this.browserState;
  }

  /**
   * Atualiza o estado do navegador
   */
  public setState(state: BrowserState): void {
    this.browserState = state;
  }

  /**
   * Navega para a URL especificada com comportamento humano simulado
   */
  public async navigateTo(url: string, options: NavigationOptions = {}): Promise<boolean> {
    if (this.mockMode) {
      console.log(`Simulando navegação para: ${url}`);
      return true;
    }

    if (this.browserState === 'closed' || this.browserState === 'error') {
      console.error('Navegador não está pronto para navegação.');
      return false;
    }

    try {
      this.setState('navigating');
      
      const timeout = options.timeout || 30000;
      const waitUntil = options.waitUntil || 'networkidle';
      
      // Adicionar comportamento humanizado na navegação, se solicitado
      if (options.humanizedNavigation) {
        // Simular um pequeno atraso antes de navegar
        await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));
      }
      
      // Fazer a navegação
      await this.page.goto(url, { 
        timeout, 
        waitUntil 
      });
      
      // Após a navegação, simular tempo de leitura da página
      if (options.humanizedNavigation) {
        const pageContent = await this.page.content();
        const readTime = this.humanBehavior.calculateReadingTime(Math.min(1000, pageContent.length / 10));
        await new Promise(resolve => setTimeout(resolve, readTime));
      }
      
      this.setState('ready');
      return true;
    } catch (error) {
      console.error(`Erro ao navegar para ${url}:`, error);
      this.setState('error');
      return false;
    }
  }

  /**
   * Navega para uma pasta específica usando rotas predefinidas
   */
  public async navigateToFolder(folder: string, options: NavigationOptions = {}): Promise<ActionResult> {
    if (this.mockMode) {
      return {
        action: 'navigate',
        success: true,
        timestamp: new Date(),
        details: { folder, mockMode: true }
      };
    }

    // Verificar se a pasta existe nas rotas definidas
    const folderRoute = this.routes[folder];
    if (!folderRoute) {
      return {
        action: 'navigate',
        success: false,
        timestamp: new Date(),
        error: `Pasta "${folder}" não encontrada nas rotas definidas`
      };
    }

    try {
      // Tentar navegar usando URL direta
      const navigated = await this.navigateTo(folderRoute, options);
      
      if (navigated) {
        return {
          action: 'navigate',
          success: true,
          timestamp: new Date(),
          details: { folder, method: 'direct-url' }
        };
      }
      
      // Se a navegação direta falhar, tentar usando seletores
      // Verificar se já estamos na página principal
      const currentUrl = this.page.url();
      if (!currentUrl.includes(this.baseUrl)) {
        await this.navigateTo(this.baseUrl, options);
      }
      
      // Encontrar e clicar no link da pasta usando seletores adaptativos
      const folderSelector = await this.getFolderSelector(folder);
      if (folderSelector) {
        await this.selectors.clickElement(folderSelector, { 
          timeout: options.timeout 
        });
        
        // Esperar pela navegação ser concluída
        await this.page.waitForLoadState('networkidle', { 
          timeout: options.timeout || 10000 
        });
        
        return {
          action: 'navigate',
          success: true,
          timestamp: new Date(),
          details: { folder, method: 'selector-click' }
        };
      }
      
      return {
        action: 'navigate',
        success: false,
        timestamp: new Date(),
        error: `Não foi possível navegar para a pasta "${folder}"`
      };
    } catch (error) {
      console.error(`Erro ao navegar para a pasta ${folder}:`, error);
      return {
        action: 'navigate',
        success: false,
        timestamp: new Date(),
        error: String(error)
      };
    }
  }

  /**
   * Obtém o seletor específico para uma pasta
   */
  private async getFolderSelector(folder: string): Promise<string | null> {
    switch (this.provider) {
      case 'gmail':
        switch (folder) {
          case 'inbox': return 'a[href$="#inbox"]';
          case 'sent': return 'a[href$="#sent"]';
          case 'drafts': return 'a[href$="#drafts"]';
          case 'spam': return 'a[href$="#spam"]';
          case 'trash': return 'a[href$="#trash"]';
          case 'starred': return 'a[href$="#starred"]';
          default: return null;
        }
        
      case 'outlook':
        switch (folder) {
          case 'inbox': return 'div[title="Inbox"]';
          case 'sent': return 'div[title="Sent Items"]';
          case 'drafts': return 'div[title="Drafts"]';
          case 'spam': return 'div[title="Junk Email"]';
          case 'trash': return 'div[title="Deleted Items"]';
          case 'starred': return 'div[title="Favorites"]';
          default: return null;
        }
        
      case 'yahoo':
        switch (folder) {
          case 'inbox': return 'a[data-test-folder-name="Inbox"]';
          case 'sent': return 'a[data-test-folder-name="Sent"]';
          case 'drafts': return 'a[data-test-folder-name="Drafts"]';
          case 'spam': return 'a[data-test-folder-name="Bulk"]';
          case 'trash': return 'a[data-test-folder-name="Trash"]';
          case 'starred': return 'a[data-test-folder-name="~Focused"]';
          default: return null;
        }
        
      default:
        return null;
    }
  }

  /**
   * Executa uma atualização (refresh) na página atual
   */
  public async refreshPage(): Promise<ActionResult> {
    if (this.mockMode) {
      return {
        action: 'refresh',
        success: true,
        timestamp: new Date(),
        details: { mockMode: true }
      };
    }

    try {
      this.setState('navigating');
      
      // Tentar primeiro usar o botão de atualização na interface
      const refreshSelector = await this.selectors.getSelector('refreshButton');
      
      if (refreshSelector) {
        // Clicar no botão de atualização usando seletores adaptativos
        await this.selectors.clickElement('refreshButton');
      } else {
        // Se não encontrar o botão, usar o método nativo do navegador
        await this.page.reload({ waitUntil: 'networkidle' });
      }
      
      // Aguardar carregamento completo
      await this.page.waitForLoadState('networkidle');
      
      this.setState('ready');
      return {
        action: 'refresh',
        success: true,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Erro ao atualizar a página:', error);
      this.setState('error');
      return {
        action: 'refresh',
        success: false,
        timestamp: new Date(),
        error: String(error)
      };
    }
  }

  /**
   * Verifica se estamos em uma determinada pasta/rota
   */
  public async isInFolder(folder: string): Promise<boolean> {
    if (this.mockMode) return true;

    try {
      const currentUrl = this.page.url();
      const expectedRoute = this.routes[folder];
      
      if (!expectedRoute) return false;
      
      // Verificar URL
      if (currentUrl.includes(expectedRoute) || 
          (folder === 'inbox' && currentUrl.includes(this.baseUrl) && !currentUrl.includes('/'))) {
        return true;
      }
      
      // Se a verificação de URL falhar, verificar elementos visuais
      switch (this.provider) {
        case 'gmail':
          if (folder === 'inbox') {
            return await this.page.$('div.G-atb:contains("Primary")') !== null;
          }
          break;
          
        case 'outlook':
          // Verificar o título da pasta selecionada
          const folderTitle = await this.page.$(`div[role="heading"]:has-text("${folder}")`);
          return folderTitle !== null;
          
        case 'yahoo':
          // Verificar se a pasta está ativa/selecionada
          const activeFolder = await this.page.$(`a[data-test-folder-name="${folder}"][aria-selected="true"]`);
          return activeFolder !== null;
      }
      
      return false;
    } catch (error) {
      console.error(`Erro ao verificar se está na pasta ${folder}:`, error);
      return false;
    }
  }

  /**
   * Volta para a página anterior
   */
  public async goBack(options: NavigationOptions = {}): Promise<ActionResult> {
    if (this.mockMode) {
      return {
        action: 'back',
        success: true,
        timestamp: new Date(),
        details: { mockMode: true }
      };
    }

    try {
      this.setState('navigating');
      
      // Verificar primeiro se há um botão de voltar na interface
      const backButton = await this.page.$('button[aria-label="Back"]') || 
                         await this.page.$('button[title="Back"]') || 
                         await this.page.$('a[aria-label="Back"]');
      
      if (backButton) {
        await backButton.click();
      } else {
        // Usar navegação do navegador
        await this.page.goBack({ waitUntil: options.waitUntil || 'networkidle' });
      }
      
      // Aguardar carregamento completo
      await this.page.waitForLoadState('networkidle');
      
      this.setState('ready');
      return {
        action: 'back',
        success: true,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Erro ao voltar para a página anterior:', error);
      this.setState('error');
      return {
        action: 'back',
        success: false,
        timestamp: new Date(),
        error: String(error)
      };
    }
  }

  /**
   * Espera por um elemento na página usando seletores adaptativos
   */
  public async waitForElement(elementKey: string, options: { timeout?: number } = {}): Promise<any | null> {
    if (this.mockMode) return {};

    return await this.selectors.waitForElement(elementKey, options);
  }

  /**
   * Executa uma busca na interface do webmail
   */
  public async search(query: string): Promise<ActionResult> {
    if (this.mockMode) {
      return {
        action: 'search',
        success: true,
        timestamp: new Date(),
        details: { query, mockMode: true }
      };
    }

    try {
      // Obter o seletor da caixa de pesquisa
      const searchBoxSelector = await this.selectors.getSelector('searchBox');
      
      if (!searchBoxSelector) {
        return {
          action: 'search',
          success: false,
          timestamp: new Date(),
          error: 'Caixa de pesquisa não encontrada'
        };
      }

      // Clicar na caixa de pesquisa
      await this.page.click(searchBoxSelector);
      await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));
      
      // Limpar a caixa de pesquisa (selecionar tudo e deletar)
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');
      await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));
      
      // Digitar a consulta com digitação humanizada
      const delays = this.humanBehavior.generateTypingDelays(query);
      
      for (let i = 0; i < query.length; i++) {
        await this.page.keyboard.type(query[i]);
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
      
      // Pressionar Enter
      await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('medium')));
      await this.page.keyboard.press('Enter');
      
      // Aguardar resultados
      try {
        // Aguardar pelo carregamento dos resultados de pesquisa
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });

        // Verificar se a pesquisa foi bem-sucedida com base no provedor
        if (this.provider === 'gmail') {
          await this.page.waitForFunction(() => {
            return window.location.hash.includes('#search/');
          }, { timeout: 10000 });
        } else if (this.provider === 'outlook') {
          await this.page.waitForSelector('div[role="region"][aria-label="Message list"]', { timeout: 10000 });
        } else if (this.provider === 'yahoo') {
          // Aguardar que o spinner de carregamento desapareça
          await this.page.waitForSelector('div[role="progressbar"]', { timeout: 5000 }).catch(() => {});
          await this.page.waitForFunction(() => !document.querySelector('div[role="progressbar"]'), { timeout: 10000 }).catch(() => {});
        }
      } catch (error) {
        // Ignorar erros de timeout ao aguardar resultados
        console.warn('Timeout ao esperar resultados da pesquisa, continuando...');
      }
      
      // Contar os resultados (usando seletores específicos por provedor)
      let emailListSelector: string;
      
      switch (this.provider) {
        case 'gmail':
          emailListSelector = 'tr.zA';
          break;
        case 'outlook':
          emailListSelector = 'div[role="listitem"][aria-label*="message"]';
          break;
        case 'yahoo':
          emailListSelector = 'a[data-test-id="message-list-item"]';
          break;
        default:
          emailListSelector = '';
      }
      
      const results = emailListSelector ? await this.page.$$(emailListSelector) : [];
      
      return {
        action: 'search',
        success: true,
        timestamp: new Date(),
        details: {
          query,
          resultCount: results.length
        }
      };
    } catch (error) {
      console.error('Erro ao realizar pesquisa:', error);
      return {
        action: 'search',
        success: false,
        timestamp: new Date(),
        error: String(error)
      };
    }
  }

  /**
   * Cria uma pasta personalizada
   */
  public async createFolder(folderName: string): Promise<ActionResult> {
    if (this.mockMode) {
      return {
        action: 'create-folder',
        success: true,
        timestamp: new Date(),
        details: { folderName, mockMode: true }
      };
    }

    try {
      // Implementação específica por provedor
      switch (this.provider) {
        case 'gmail':
          await this.createFolderGmail(folderName);
          break;
        case 'outlook':
          await this.createFolderOutlook(folderName);
          break;
        case 'yahoo':
          await this.createFolderYahoo(folderName);
          break;
        default:
          throw new Error(`Criação de pasta não implementada para ${this.provider}`);
      }

      return {
        action: 'create-folder',
        success: true,
        timestamp: new Date(),
        details: { folderName }
      };
    } catch (error) {
      console.error(`Erro ao criar pasta ${folderName}:`, error);
      return {
        action: 'create-folder',
        success: false,
        timestamp: new Date(),
        error: String(error)
      };
    }
  }

  /**
   * Implementação específica para Gmail
   */
  private async createFolderGmail(folderName: string): Promise<void> {
    // Encontrar o link "More" na barra lateral
    const moreLink = await this.page.$('div.aim:has-text("More")');
    if (moreLink) {
      await moreLink.click();
      await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));
    }

    // Clicar em "Create new label"
    const createNewLabel = await this.page.$('div.n6:has-text("Create new label")');
    await createNewLabel.click();
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('medium')));

    // Preencher o nome da pasta/etiqueta
    await this.page.fill('input[aria-label="Please enter a new label name:"]', folderName);
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));

    // Clicar em Criar
    await this.page.click('button[name="ok"]');
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('medium')));
  }

  /**
   * Implementação específica para Outlook
   */
  private async createFolderOutlook(folderName: string): Promise<void> {
    // Clicar com o botão direito na árvore de pastas
    await this.page.click('div[role="tree"][aria-label="Folder pane"]', { button: 'right' });
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));

    // Clicar em "New folder"
    await this.page.click('button[aria-label="New folder"]');
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));

    // Digitar o nome da pasta
    await this.page.fill('input[aria-label="Folder name"]', folderName);
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));

    // Clicar em Criar
    await this.page.click('button[aria-label="Create"]');
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('medium')));
  }

  /**
   * Implementação específica para Yahoo
   */
  private async createFolderYahoo(folderName: string): Promise<void> {
    // Clicar no botão "+ Adicionar Nova Pasta"
    const newFolderButton = await this.page.$('button[title="Add new folder"]');
    if (!newFolderButton) {
      // Se o botão não for encontrado, tentar abrir o menu de pastas primeiro
      await this.page.click('button[title="Folders"]');
      await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));
      
      // Agora procurar o botão novamente
      const folderMenuButton = await this.page.$('button[title="Add new folder"]');
      if (!folderMenuButton) {
        throw new Error('Botão de adicionar pasta não encontrado');
      }
      
      await folderMenuButton.click();
    } else {
      await newFolderButton.click();
    }
    
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));
    
    // Digitar o nome da pasta
    await this.page.fill('input[placeholder="Folder name"]', folderName);
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('short')));
    
    // Clicar em OK/Save
    await this.page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, this.humanBehavior.generateDelay('medium')));
  }
}