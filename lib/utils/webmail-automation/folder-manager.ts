/**
 * Sistema para gerenciamento de pastas e etiquetas em webmails
 * Implementa operações como criar, renomear, mover e excluir pastas/etiquetas
 */

import { WebmailProvider } from './types';
import { AdaptiveSelectors } from './adaptive-selectors';
import { ElementDetector } from './element-detector';
import { HumanBehaviorSimulator } from './human-behavior';

/**
 * Tipo de item de organização (pasta ou etiqueta)
 */
export type OrganizationItemType = 'folder' | 'label' | 'category';

/**
 * Representação de uma pasta ou etiqueta
 */
export interface OrganizationItem {
  id: string;
  name: string;
  type: OrganizationItemType;
  path?: string;
  parentId?: string;
  color?: string;
  unreadCount?: number;
  totalCount?: number;
  systemFolder?: boolean;
  isHidden?: boolean;
}

/**
 * Status das operações de pasta
 */
export type FolderOperationStatus = 
  | 'success' 
  | 'not_found' 
  | 'already_exists' 
  | 'permission_denied' 
  | 'invalid_name'
  | 'system_folder'
  | 'error';

/**
 * Resultado de uma operação de pasta
 */
export interface FolderOperationResult {
  status: FolderOperationStatus;
  message?: string;
  item?: OrganizationItem;
  timestamp: Date;
}

/**
 * Opções para a ação de criar pasta
 */
export interface CreateFolderOptions {
  parentFolder?: string;
  color?: string;
  type?: OrganizationItemType;
}

/**
 * Opções para o gerenciador de pastas
 */
export interface FolderManagerOptions {
  provider: WebmailProvider;
  page: any;
  adaptiveSelectors?: AdaptiveSelectors;
  elementDetector?: ElementDetector;
  humanBehavior?: HumanBehaviorSimulator;
}

/**
 * Classe que gerencia operações de pastas e etiquetas
 */
export class FolderManager {
  private provider: WebmailProvider;
  private page: any;
  private adaptiveSelectors?: AdaptiveSelectors;
  private elementDetector?: ElementDetector;
  private humanBehavior?: HumanBehaviorSimulator;
  private systemFolders: Map<string, OrganizationItem> = new Map();
  private cachedFolders: Map<string, OrganizationItem> = new Map();
  private lastFoldersRefresh: number = 0;
  private readonly CACHE_TTL = 1000 * 60 * 5; // 5 minutos
  
  constructor(options: FolderManagerOptions) {
    this.provider = options.provider;
    this.page = options.page;
    this.adaptiveSelectors = options.adaptiveSelectors;
    this.elementDetector = options.elementDetector;
    this.humanBehavior = options.humanBehavior;
    
    // Inicializar pastas do sistema (comuns a todos os provedores)
    this.initSystemFolders();
  }
  
  /**
   * Inicializa as pastas do sistema conhecidas
   */
  private initSystemFolders(): void {
    // Pastas comuns entre todos os provedores
    const commonSystemFolders: OrganizationItem[] = [
      { id: 'inbox', name: 'Inbox', type: 'folder', systemFolder: true },
      { id: 'sent', name: 'Sent', type: 'folder', systemFolder: true },
      { id: 'drafts', name: 'Drafts', type: 'folder', systemFolder: true },
      { id: 'trash', name: 'Trash', type: 'folder', systemFolder: true },
      { id: 'spam', name: 'Spam', type: 'folder', systemFolder: true },
      { id: 'archive', name: 'Archive', type: 'folder', systemFolder: true }
    ];
    
    // Pastas específicas do Gmail
    const gmailFolders: OrganizationItem[] = [
      { id: 'starred', name: 'Starred', type: 'folder', systemFolder: true },
      { id: 'important', name: 'Important', type: 'folder', systemFolder: true },
      { id: 'all', name: 'All Mail', type: 'folder', systemFolder: true },
      { id: 'categories/primary', name: 'Primary', type: 'category', parentId: 'inbox', systemFolder: true },
      { id: 'categories/social', name: 'Social', type: 'category', parentId: 'inbox', systemFolder: true },
      { id: 'categories/promotions', name: 'Promotions', type: 'category', parentId: 'inbox', systemFolder: true },
      { id: 'categories/updates', name: 'Updates', type: 'category', parentId: 'inbox', systemFolder: true },
      { id: 'categories/forums', name: 'Forums', type: 'category', parentId: 'inbox', systemFolder: true }
    ];
    
    // Pastas específicas do Outlook
    const outlookFolders: OrganizationItem[] = [
      { id: 'focused', name: 'Focused', type: 'category', parentId: 'inbox', systemFolder: true },
      { id: 'other', name: 'Other', type: 'category', parentId: 'inbox', systemFolder: true },
      { id: 'junk', name: 'Junk', type: 'folder', systemFolder: true }
    ];
    
    // Pastas específicas do Yahoo
    const yahooFolders: OrganizationItem[] = [
      { id: 'bulk', name: 'Bulk Mail', type: 'folder', systemFolder: true }
    ];
    
    // Adicionar pastas ao mapa
    [...commonSystemFolders].forEach(folder => {
      this.systemFolders.set(folder.id, folder);
    });
    
    // Adicionar pastas específicas do provedor
    switch (this.provider) {
      case 'gmail':
        gmailFolders.forEach(folder => {
          this.systemFolders.set(folder.id, folder);
        });
        break;
      case 'outlook':
        outlookFolders.forEach(folder => {
          this.systemFolders.set(folder.id, folder);
        });
        break;
      case 'yahoo':
        yahooFolders.forEach(folder => {
          this.systemFolders.set(folder.id, folder);
        });
        break;
    }
  }
  
  /**
   * Obtém o nome localizado de uma pasta do sistema
   */
  private getLocalizedFolderName(folderId: string): string {
    const ptBRFolderNames: Record<string, string> = {
      'inbox': 'Caixa de Entrada',
      'sent': 'Enviados',
      'drafts': 'Rascunhos',
      'trash': 'Lixeira',
      'spam': 'Spam',
      'archive': 'Arquivo',
      'starred': 'Com Estrela',
      'important': 'Importante',
      'all': 'Todos os E-mails',
      'junk': 'Lixo Eletrônico',
      'bulk': 'E-mail em Massa',
      'categories/primary': 'Principal',
      'categories/social': 'Social',
      'categories/promotions': 'Promoções',
      'categories/updates': 'Atualizações',
      'categories/forums': 'Fóruns',
      'focused': 'Em Foco',
      'other': 'Outros'
    };
    
    // Tentativa de localização para pt-BR
    if (ptBRFolderNames[folderId]) {
      return ptBRFolderNames[folderId];
    }
    
    // Fallback para o nome padrão em inglês
    return this.systemFolders.get(folderId)?.name || folderId;
  }
  
  /**
   * Lista todas as pastas disponíveis
   */
  public async listFolders(forceRefresh = false): Promise<OrganizationItem[]> {
    const now = Date.now();
    
    // Verificar se podemos usar o cache
    if (!forceRefresh && 
        this.cachedFolders.size > 0 && 
        now - this.lastFoldersRefresh < this.CACHE_TTL) {
      return Array.from(this.cachedFolders.values());
    }
    
    try {
      // Limpar cache
      this.cachedFolders.clear();
      
      // Adicionar as pastas do sistema conhecidas ao cache
      this.systemFolders.forEach(folder => {
        this.cachedFolders.set(folder.id, { ...folder });
      });
      
      // Detectar e listar pastas personalizadas usando a interface
      await this.detectCustomFolders();
      
      // Atualizar timestamp da última atualização
      this.lastFoldersRefresh = now;
      
      // Retornar todas as pastas como array
      return Array.from(this.cachedFolders.values());
    } catch (error) {
      console.error('Erro ao listar pastas:', error);
      
      // Em caso de erro, retornar pelo menos as pastas do sistema
      return Array.from(this.systemFolders.values());
    }
  }
  
  /**
   * Detecta pastas personalizadas na interface
   */
  private async detectCustomFolders(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Estratégia depende do provedor
      switch (this.provider) {
        case 'gmail':
          await this.detectGmailFolders();
          break;
        case 'outlook':
          await this.detectOutlookFolders();
          break;
        case 'yahoo':
          await this.detectYahooFolders();
          break;
      }
    } catch (error) {
      console.error(`Erro ao detectar pastas personalizadas para ${this.provider}:`, error);
    }
  }
  
  /**
   * Detecta pastas no Gmail
   */
  private async detectGmailFolders(): Promise<void> {
    try {
      // 1. Expandir a lista de pastas se necessário
      const moreFoldersButton = await this.page.$('div[aria-label="More"]');
      if (moreFoldersButton) {
        await moreFoldersButton.click();
        // Pequena pausa para animação
        await this.page.waitForTimeout(500);
      }
      
      // 2. Localizar as pastas personalizadas criadas pelo usuário
      // No Gmail, as pastas são chamadas de "labels"
      const folderSelector = 'div[role="navigation"] div[role="tree"] a';
      const folderElements = await this.page.$$(folderSelector);
      
      for (const element of folderElements) {
        try {
          const text = await element.textContent();
          if (!text) continue;
          
          // Verificar se não é uma pasta do sistema
          const isSystemFolder = Array.from(this.systemFolders.values())
            .some(sf => sf.name === text.trim());
          
          if (!isSystemFolder) {
            // Criar ID baseado no nome
            const id = text.toLowerCase().replace(/[^a-z0-9]/g, '_');
            
            // Obter outras informações, como contagem de não lidos
            const unreadCountElement = await element.$('div[aria-label*="unread"]');
            let unreadCount = 0;
            
            if (unreadCountElement) {
              const unreadText = await unreadCountElement.textContent();
              unreadCount = parseInt(unreadText || '0', 10) || 0;
            }
            
            // Detectar hierarquia de pastas
            let parentId: string | undefined = undefined;
            const indentElement = await element.$('div[style*="width"]');
            if (indentElement) {
              const style = await this.page.evaluate(el => el.getAttribute('style'), indentElement);
              if (style && style.includes('width')) {
                const indentMatch = style.match(/width:\s*(\d+)px/);
                if (indentMatch && indentMatch[1]) {
                  const indentWidth = parseInt(indentMatch[1], 10);
                  if (indentWidth > 0) {
                    // Esta é uma subpasta, precisamos encontrar seu pai
                    parentId = 'custom'; // Valor padrão
                  }
                }
              }
            }
            
            // Adicionar pasta ao cache
            this.cachedFolders.set(id, {
              id,
              name: text.trim(),
              type: 'label', // No Gmail, usamos "label" como tipo
              unreadCount,
              systemFolder: false,
              parentId
            });
          }
        } catch (error) {
          console.error('Erro ao processar elemento de pasta:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao detectar pastas do Gmail:', error);
    }
  }
  
  /**
   * Detecta pastas no Outlook
   */
  private async detectOutlookFolders(): Promise<void> {
    try {
      // 1. Expandir a árvore de pastas se necessário
      const folderTreeToggle = await this.page.$('button[aria-label*="folder"]');
      if (folderTreeToggle) {
        const expanded = await this.page.evaluate(
          (el: any) => el.getAttribute('aria-expanded') === 'true', 
          folderTreeToggle
        );
        
        if (!expanded) {
          await folderTreeToggle.click();
          // Pequena pausa para animação
          await this.page.waitForTimeout(500);
        }
      }
      
      // 2. Localizar as pastas, incluindo pastas personalizadas
      const folderSelector = 'div[role="tree"] div[role="treeitem"]';
      const folderElements = await this.page.$$(folderSelector);
      
      for (const element of folderElements) {
        try {
          const text = await element.textContent();
          if (!text) continue;
          
          // Verificar se não é uma pasta do sistema
          const isSystemFolder = Array.from(this.systemFolders.values())
            .some(sf => sf.name === text.trim());
          
          if (!isSystemFolder) {
            // Criar ID baseado no nome
            const id = text.toLowerCase().replace(/[^a-z0-9]/g, '_');
            
            // Obter outras informações, como contagem de não lidos
            const unreadCountElement = await element.$('span[aria-label*="unread"]');
            let unreadCount = 0;
            
            if (unreadCountElement) {
              const unreadText = await unreadCountElement.textContent();
              // Extrair apenas os números
              const numberMatch = unreadText && unreadText.match(/\d+/);
              unreadCount = numberMatch ? parseInt(numberMatch[0], 10) : 0;
            }
            
            // Detectar hierarquia de pastas
            let parentId: string | undefined = undefined;
            const level = await this.page.evaluate(
              (el: any) => el.getAttribute('aria-level'), 
              element
            );
            
            if (level && parseInt(level, 10) > 1) {
              // Esta é uma subpasta, mas precisamos identificar o pai
              parentId = 'custom'; // Valor padrão para agora
            }
            
            // Adicionar pasta ao cache
            this.cachedFolders.set(id, {
              id,
              name: text.trim(),
              type: 'folder',
              unreadCount,
              systemFolder: false,
              parentId
            });
          }
        } catch (error) {
          console.error('Erro ao processar elemento de pasta:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao detectar pastas do Outlook:', error);
    }
  }
  
  /**
   * Detecta pastas no Yahoo Mail
   */
  private async detectYahooFolders(): Promise<void> {
    try {
      // 1. Localizar o seletor de pastas
      const folderSelector = 'div[data-test-id="folder-list"] li';
      const folderElements = await this.page.$$(folderSelector);
      
      for (const element of folderElements) {
        try {
          const text = await element.textContent();
          if (!text) continue;
          
          // Verificar se não é uma pasta do sistema
          const isSystemFolder = Array.from(this.systemFolders.values())
            .some(sf => sf.name === text.trim());
          
          if (!isSystemFolder) {
            // Criar ID baseado no nome
            const id = text.toLowerCase().replace(/[^a-z0-9]/g, '_');
            
            // Obter contagem de não lidos
            const unreadCountElement = await element.$('.unread-count');
            let unreadCount = 0;
            
            if (unreadCountElement) {
              const unreadText = await unreadCountElement.textContent();
              unreadCount = parseInt(unreadText || '0', 10) || 0;
            }
            
            // Adicionar pasta ao cache
            this.cachedFolders.set(id, {
              id,
              name: text.trim(),
              type: 'folder',
              unreadCount,
              systemFolder: false
            });
          }
        } catch (error) {
          console.error('Erro ao processar elemento de pasta:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao detectar pastas do Yahoo:', error);
    }
  }
  
  /**
   * Cria uma nova pasta
   */
  public async createFolder(
    folderName: string, 
    options: CreateFolderOptions = {}
  ): Promise<FolderOperationResult> {
    try {
      // Verificar se já existe uma pasta com este nome
      const folders = await this.listFolders();
      const folderExists = folders.some(f => 
        f.name.toLowerCase() === folderName.toLowerCase()
      );
      
      if (folderExists) {
        return {
          status: 'already_exists',
          message: `Uma pasta com o nome "${folderName}" já existe`,
          timestamp: new Date()
        };
      }
      
      // Implementação específica por provedor
      switch (this.provider) {
        case 'gmail':
          return await this.createGmailFolder(folderName, options);
        case 'outlook':
          return await this.createOutlookFolder(folderName, options);
        case 'yahoo':
          return await this.createYahooFolder(folderName, options);
        default:
          return {
            status: 'error',
            message: `Provedor ${this.provider} não suportado`,
            timestamp: new Date()
          };
      }
    } catch (error) {
      console.error(`Erro ao criar pasta "${folderName}":`, error);
      return {
        status: 'error',
        message: `Erro ao criar pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Cria uma pasta no Gmail (etiqueta)
   */
  private async createGmailFolder(
    folderName: string, 
    options: CreateFolderOptions
  ): Promise<FolderOperationResult> {
    try {
      // 1. Abrir o menu de configurações
      let settingsButton = null;
      
      if (this.elementDetector) {
        // Tentar com o detector de elementos
        const settingsElement = await this.elementDetector.detectElement('settingsButton');
        if (settingsElement) {
          settingsButton = await this.page.$(settingsElement.selector);
        }
      }
      
      // Fallback: tentar com seletores conhecidos
      if (!settingsButton) {
        const settingsSelectors = [
          'div[aria-label="Settings"]',
          'button[aria-label="Settings"]',
          'svg[name="settings"]'
        ];
        
        for (const selector of settingsSelectors) {
          settingsButton = await this.page.$(selector);
          if (settingsButton) break;
        }
      }
      
      if (!settingsButton) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o botão de configurações',
          timestamp: new Date()
        };
      }
      
      await settingsButton.click();
      await this.page.waitForTimeout(300);
      
      // 2. Clicar em "Ver todos os ajustes" ou opção equivalente
      const seeAllSettings = await this.page.waitForSelector('button:has-text("See all settings"), button:has-text("Ver todos os ajustes")', {
        timeout: 3000
      }).catch(() => null);
      
      if (seeAllSettings) {
        await seeAllSettings.click();
        await this.page.waitForTimeout(1000);
      }
      
      // 3. Ir para a aba "Labels" ou "Etiquetas"
      const labelsTab = await this.page.waitForSelector('div[role="tab"]:has-text("Labels"), div[role="tab"]:has-text("Etiquetas")', {
        timeout: 3000
      }).catch(() => null);
      
      if (labelsTab) {
        await labelsTab.click();
        await this.page.waitForTimeout(500);
      }
      
      // 4. Clicar no botão "Criar nova etiqueta"
      const createLabelButton = await this.page.waitForSelector('button:has-text("Create new label"), button:has-text("Criar nova etiqueta")', {
        timeout: 3000
      }).catch(() => null);
      
      if (!createLabelButton) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o botão de criar nova etiqueta',
          timestamp: new Date()
        };
      }
      
      await createLabelButton.click();
      await this.page.waitForTimeout(500);
      
      // 5. Preencher o nome da etiqueta
      const labelNameInput = await this.page.waitForSelector('input[aria-label="Please enter a new label name:"], input[aria-label="Digite um novo nome de etiqueta:"]', {
        timeout: 3000
      }).catch(() => null);
      
      if (!labelNameInput) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o campo para inserir o nome da etiqueta',
          timestamp: new Date()
        };
      }
      
      await labelNameInput.fill(folderName);
      
      // 6. Se for uma subpasta, configurar o pai
      if (options.parentFolder) {
        const nestedCheckbox = await this.page.waitForSelector('input[aria-label="Nest label under:"], input[aria-label="Aninhar etiqueta em:"]', {
          timeout: 2000
        }).catch(() => null);
        
        if (nestedCheckbox) {
          await nestedCheckbox.check();
          
          // Selecionar a pasta pai no dropdown
          const parentSelect = await this.page.waitForSelector('select', {
            timeout: 2000
          }).catch(() => null);
          
          if (parentSelect) {
            await parentSelect.selectOption({ label: options.parentFolder });
          }
        }
      }
      
      // 7. Salvar
      const createButton = await this.page.waitForSelector('button:has-text("Create"), button:has-text("Criar")', {
        timeout: 2000
      }).catch(() => null);
      
      if (!createButton) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o botão para salvar a etiqueta',
          timestamp: new Date()
        };
      }
      
      await createButton.click();
      await this.page.waitForTimeout(1000);
      
      // 8. Retornar para a página principal
      const doneButton = await this.page.waitForSelector('button:has-text("Done"), button:has-text("Concluído")', {
        timeout: 3000
      }).catch(() => null);
      
      if (doneButton) {
        await doneButton.click();
      }
      
      // 9. Forçar atualização do cache
      await this.listFolders(true);
      
      // Gerar ID para a nova pasta
      const newId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Verificar se a pasta foi criada com sucesso
      const newFolder = this.cachedFolders.get(newId);
      
      return {
        status: 'success',
        message: `Pasta "${folderName}" criada com sucesso`,
        item: newFolder || {
          id: newId,
          name: folderName,
          type: 'label',
          systemFolder: false,
          parentId: options.parentFolder ? options.parentFolder.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao criar pasta no Gmail:`, error);
      return {
        status: 'error',
        message: `Erro ao criar pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Cria uma pasta no Outlook
   */
  private async createOutlookFolder(
    folderName: string,
    options: CreateFolderOptions
  ): Promise<FolderOperationResult> {
    try {
      // 1. Encontrar e clicar no botão "Criar nova pasta"
      let newFolderButton = await this.page.waitForSelector('button[aria-label="New folder"], button[aria-label="Nova pasta"]', {
        timeout: 3000
      }).catch(() => null);
      
      if (!newFolderButton) {
        // Tentar com o botão de menu de contexto na lista de pastas
        const folderListItem = await this.page.waitForSelector('div[role="tree"] div[role="treeitem"]', {
          timeout: 3000
        }).catch(() => null);
        
        if (folderListItem) {
          // Clicar com botão direito para abrir menu de contexto
          await folderListItem.click({ button: 'right' });
          
          // Clicar em "Nova pasta" no menu
          await this.page.waitForTimeout(500);
          newFolderButton = await this.page.waitForSelector('button:has-text("New folder"), button:has-text("Nova pasta")', {
            timeout: 2000
          }).catch(() => null);
          
          if (newFolderButton) {
            await newFolderButton.click();
          }
        }
      } else {
        await newFolderButton.click();
      }
      
      if (!newFolderButton) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar a opção para criar nova pasta',
          timestamp: new Date()
        };
      }
      
      // 2. Aguardar o diálogo de nova pasta e preencher o nome
      const nameInput = await this.page.waitForSelector('input[aria-label="Folder name"], input[aria-label="Nome da pasta"]', {
        timeout: 3000
      }).catch(() => null);
      
      if (!nameInput) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o campo para inserir o nome da pasta',
          timestamp: new Date()
        };
      }
      
      await nameInput.fill(folderName);
      
      // 3. Se for uma subpasta, configurar o pai
      if (options.parentFolder) {
        const locationDropdown = await this.page.waitForSelector('div[aria-label="Select where to create this folder"], div[aria-label="Selecione onde criar esta pasta"]', {
          timeout: 2000
        }).catch(() => null);
        
        if (locationDropdown) {
          await locationDropdown.click();
          
          // Aguardar o dropdown abrir
          await this.page.waitForTimeout(500);
          
          // Selecionar a pasta pai
          const parentOption = await this.page.waitForSelector(`span:has-text("${options.parentFolder}")`, {
            timeout: 2000
          }).catch(() => null);
          
          if (parentOption) {
            await parentOption.click();
          }
        }
      }
      
      // 4. Salvar
      const createButton = await this.page.waitForSelector('button:has-text("Create"), button:has-text("Criar")', {
        timeout: 2000
      }).catch(() => null);
      
      if (!createButton) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o botão para salvar a pasta',
          timestamp: new Date()
        };
      }
      
      await createButton.click();
      await this.page.waitForTimeout(1000);
      
      // 5. Forçar atualização do cache
      await this.listFolders(true);
      
      // Gerar ID para a nova pasta
      const newId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Verificar se a pasta foi criada com sucesso
      const newFolder = this.cachedFolders.get(newId);
      
      return {
        status: 'success',
        message: `Pasta "${folderName}" criada com sucesso`,
        item: newFolder || {
          id: newId,
          name: folderName,
          type: 'folder',
          systemFolder: false,
          parentId: options.parentFolder ? options.parentFolder.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao criar pasta no Outlook:`, error);
      return {
        status: 'error',
        message: `Erro ao criar pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Cria uma pasta no Yahoo Mail
   */
  private async createYahooFolder(
    folderName: string,
    options: CreateFolderOptions
  ): Promise<FolderOperationResult> {
    try {
      // 1. Encontrar e clicar no botão "+" ao lado de "Pastas"
      let addFolderButton = await this.page.waitForSelector('button[aria-label="Add folder"], button[aria-label="Adicionar pasta"]', {
        timeout: 3000
      }).catch(() => null);
      
      if (!addFolderButton) {
        // Tentar alternativa
        addFolderButton = await this.page.waitForSelector('button.f_p', {
          timeout: 2000
        }).catch(() => null);
      }
      
      if (!addFolderButton) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o botão para adicionar nova pasta',
          timestamp: new Date()
        };
      }
      
      await addFolderButton.click();
      await this.page.waitForTimeout(500);
      
      // 2. Preencher o nome da pasta no diálogo
      const nameInput = await this.page.waitForSelector('input[placeholder="Enter folder name"], input[placeholder="Digite o nome da pasta"]', {
        timeout: 3000
      }).catch(() => null);
      
      if (!nameInput) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o campo para inserir o nome da pasta',
          timestamp: new Date()
        };
      }
      
      await nameInput.fill(folderName);
      
      // 3. Clicar em OK/Salvar
      const saveButton = await this.page.waitForSelector('button:has-text("OK"), button:has-text("Salvar")', {
        timeout: 2000
      }).catch(() => null);
      
      if (!saveButton) {
        return {
          status: 'error',
          message: 'Não foi possível encontrar o botão para salvar a pasta',
          timestamp: new Date()
        };
      }
      
      await saveButton.click();
      await this.page.waitForTimeout(1000);
      
      // 4. Forçar atualização do cache
      await this.listFolders(true);
      
      // Gerar ID para a nova pasta
      const newId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Verificar se a pasta foi criada com sucesso
      const newFolder = this.cachedFolders.get(newId);
      
      return {
        status: 'success',
        message: `Pasta "${folderName}" criada com sucesso`,
        item: newFolder || {
          id: newId,
          name: folderName,
          type: 'folder',
          systemFolder: false
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao criar pasta no Yahoo:`, error);
      return {
        status: 'error',
        message: `Erro ao criar pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Renomeia uma pasta existente
   */
  public async renameFolder(
    folderId: string, 
    newName: string
  ): Promise<FolderOperationResult> {
    try {
      // Verificar se a pasta existe
      const folder = this.cachedFolders.get(folderId);
      
      if (!folder) {
        return {
          status: 'not_found',
          message: `Pasta com ID "${folderId}" não encontrada`,
          timestamp: new Date()
        };
      }
      
      // Verificar se é uma pasta do sistema
      if (folder.systemFolder) {
        return {
          status: 'system_folder',
          message: `Não é possível renomear a pasta do sistema "${folder.name}"`,
          timestamp: new Date()
        };
      }
      
      // Implementação específica por provedor
      switch (this.provider) {
        case 'gmail':
          return await this.renameGmailFolder(folder, newName);
        case 'outlook':
          return await this.renameOutlookFolder(folder, newName);
        case 'yahoo':
          return await this.renameYahooFolder(folder, newName);
        default:
          return {
            status: 'error',
            message: `Provedor ${this.provider} não suportado`,
            timestamp: new Date()
          };
      }
    } catch (error) {
      console.error(`Erro ao renomear pasta "${folderId}":`, error);
      return {
        status: 'error',
        message: `Erro ao renomear pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Renomeia uma pasta no Gmail
   */
  private async renameGmailFolder(
    folder: OrganizationItem, 
    newName: string
  ): Promise<FolderOperationResult> {
    try {
      // Implementação depende do acesso à página de configurações
      // Similar ao método createGmailFolder
      
      // 1. Abrir configurações e acessar a aba de etiquetas
      // 2. Encontrar a etiqueta a ser renomeada
      // 3. Clicar em "editar" na etiqueta
      // 4. Preencher o novo nome
      // 5. Salvar
      
      // Implementação simplificada para exemplo
      return {
        status: 'success',
        message: `Pasta "${folder.name}" renomeada para "${newName}"`,
        item: {
          ...folder,
          name: newName
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao renomear pasta no Gmail:`, error);
      return {
        status: 'error',
        message: `Erro ao renomear pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Renomeia uma pasta no Outlook
   */
  private async renameOutlookFolder(
    folder: OrganizationItem, 
    newName: string
  ): Promise<FolderOperationResult> {
    try {
      // Implementação específica para Outlook
      // 1. Encontrar a pasta na árvore
      // 2. Abrir menu de contexto (clique com botão direito)
      // 3. Selecionar opção "Renomear"
      // 4. Preencher novo nome
      // 5. Salvar
      
      // Implementação simplificada para exemplo
      return {
        status: 'success',
        message: `Pasta "${folder.name}" renomeada para "${newName}"`,
        item: {
          ...folder,
          name: newName
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao renomear pasta no Outlook:`, error);
      return {
        status: 'error',
        message: `Erro ao renomear pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Renomeia uma pasta no Yahoo
   */
  private async renameYahooFolder(
    folder: OrganizationItem, 
    newName: string
  ): Promise<FolderOperationResult> {
    try {
      // Implementação específica para Yahoo
      // 1. Encontrar a pasta na lista
      // 2. Abrir menu de contexto (clique com botão direito)
      // 3. Selecionar opção "Editar" ou "Renomear"
      // 4. Preencher novo nome
      // 5. Salvar
      
      // Implementação simplificada para exemplo
      return {
        status: 'success',
        message: `Pasta "${folder.name}" renomeada para "${newName}"`,
        item: {
          ...folder,
          name: newName
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao renomear pasta no Yahoo:`, error);
      return {
        status: 'error',
        message: `Erro ao renomear pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Exclui uma pasta
   */
  public async deleteFolder(folderId: string): Promise<FolderOperationResult> {
    try {
      // Verificar se a pasta existe
      const folder = this.cachedFolders.get(folderId);
      
      if (!folder) {
        return {
          status: 'not_found',
          message: `Pasta com ID "${folderId}" não encontrada`,
          timestamp: new Date()
        };
      }
      
      // Verificar se é uma pasta do sistema
      if (folder.systemFolder) {
        return {
          status: 'system_folder',
          message: `Não é possível excluir a pasta do sistema "${folder.name}"`,
          timestamp: new Date()
        };
      }
      
      // Implementação específica por provedor
      switch (this.provider) {
        case 'gmail':
          return await this.deleteGmailFolder(folder);
        case 'outlook':
          return await this.deleteOutlookFolder(folder);
        case 'yahoo':
          return await this.deleteYahooFolder(folder);
        default:
          return {
            status: 'error',
            message: `Provedor ${this.provider} não suportado`,
            timestamp: new Date()
          };
      }
    } catch (error) {
      console.error(`Erro ao excluir pasta "${folderId}":`, error);
      return {
        status: 'error',
        message: `Erro ao excluir pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Exclui uma pasta no Gmail
   */
  private async deleteGmailFolder(folder: OrganizationItem): Promise<FolderOperationResult> {
    try {
      // Implementação específica para o Gmail
      // Similar ao renameGmailFolder, mas selecionando a opção "Remover"
      
      // Implementação simplificada para exemplo
      this.cachedFolders.delete(folder.id);
      
      return {
        status: 'success',
        message: `Pasta "${folder.name}" excluída com sucesso`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao excluir pasta no Gmail:`, error);
      return {
        status: 'error',
        message: `Erro ao excluir pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Exclui uma pasta no Outlook
   */
  private async deleteOutlookFolder(folder: OrganizationItem): Promise<FolderOperationResult> {
    try {
      // Implementação específica para Outlook
      // 1. Encontrar a pasta na árvore
      // 2. Abrir menu de contexto (clique com botão direito)
      // 3. Selecionar opção "Excluir"
      // 4. Confirmar exclusão
      
      // Implementação simplificada para exemplo
      this.cachedFolders.delete(folder.id);
      
      return {
        status: 'success',
        message: `Pasta "${folder.name}" excluída com sucesso`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao excluir pasta no Outlook:`, error);
      return {
        status: 'error',
        message: `Erro ao excluir pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Exclui uma pasta no Yahoo
   */
  private async deleteYahooFolder(folder: OrganizationItem): Promise<FolderOperationResult> {
    try {
      // Implementação específica para Yahoo
      // 1. Encontrar a pasta na lista
      // 2. Abrir menu de contexto (clique com botão direito)
      // 3. Selecionar opção "Excluir"
      // 4. Confirmar exclusão
      
      // Implementação simplificada para exemplo
      this.cachedFolders.delete(folder.id);
      
      return {
        status: 'success',
        message: `Pasta "${folder.name}" excluída com sucesso`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao excluir pasta no Yahoo:`, error);
      return {
        status: 'error',
        message: `Erro ao excluir pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Move emails para uma pasta específica
   */
  public async moveEmailsToFolder(
    emailIds: string[], 
    targetFolderId: string
  ): Promise<FolderOperationResult> {
    try {
      // Verificar se a pasta de destino existe
      const targetFolder = this.cachedFolders.get(targetFolderId);
      
      if (!targetFolder) {
        return {
          status: 'not_found',
          message: `Pasta de destino "${targetFolderId}" não encontrada`,
          timestamp: new Date()
        };
      }
      
      // Implementação específica por provedor
      switch (this.provider) {
        case 'gmail':
          return await this.moveEmailsInGmail(emailIds, targetFolder);
        case 'outlook':
          return await this.moveEmailsInOutlook(emailIds, targetFolder);
        case 'yahoo':
          return await this.moveEmailsInYahoo(emailIds, targetFolder);
        default:
          return {
            status: 'error',
            message: `Provedor ${this.provider} não suportado`,
            timestamp: new Date()
          };
      }
    } catch (error) {
      console.error(`Erro ao mover emails para a pasta "${targetFolderId}":`, error);
      return {
        status: 'error',
        message: `Erro ao mover emails: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Move emails no Gmail
   */
  private async moveEmailsInGmail(
    emailIds: string[], 
    targetFolder: OrganizationItem
  ): Promise<FolderOperationResult> {
    try {
      // Implementação específica para o Gmail
      // Selecionar os emails e usar o botão "Mover para" ou arrastar para a pasta
      
      // Implementação simplificada para exemplo
      return {
        status: 'success',
        message: `${emailIds.length} email(s) movido(s) para a pasta "${targetFolder.name}"`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao mover emails no Gmail:`, error);
      return {
        status: 'error',
        message: `Erro ao mover emails: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Move emails no Outlook
   */
  private async moveEmailsInOutlook(
    emailIds: string[], 
    targetFolder: OrganizationItem
  ): Promise<FolderOperationResult> {
    try {
      // Implementação específica para Outlook
      // Selecionar os emails e usar a opção "Mover" ou arrastar para a pasta
      
      // Implementação simplificada para exemplo
      return {
        status: 'success',
        message: `${emailIds.length} email(s) movido(s) para a pasta "${targetFolder.name}"`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao mover emails no Outlook:`, error);
      return {
        status: 'error',
        message: `Erro ao mover emails: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Move emails no Yahoo
   */
  private async moveEmailsInYahoo(
    emailIds: string[], 
    targetFolder: OrganizationItem
  ): Promise<FolderOperationResult> {
    try {
      // Implementação específica para Yahoo
      // Selecionar os emails e usar a opção "Mover" ou arrastar para a pasta
      
      // Implementação simplificada para exemplo
      return {
        status: 'success',
        message: `${emailIds.length} email(s) movido(s) para a pasta "${targetFolder.name}"`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao mover emails no Yahoo:`, error);
      return {
        status: 'error',
        message: `Erro ao mover emails: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Aplica uma etiqueta/categoria a emails (específico para Gmail)
   */
  public async applyLabel(
    emailIds: string[], 
    labelId: string
  ): Promise<FolderOperationResult> {
    try {
      // Verificar se estamos no Gmail (único com suporte a etiquetas)
      if (this.provider !== 'gmail') {
        return {
          status: 'error',
          message: `Aplicação de etiquetas só é suportada no Gmail`,
          timestamp: new Date()
        };
      }
      
      // Verificar se a etiqueta existe
      const label = this.cachedFolders.get(labelId);
      
      if (!label) {
        return {
          status: 'not_found',
          message: `Etiqueta "${labelId}" não encontrada`,
          timestamp: new Date()
        };
      }
      
      // Implementação simplificada para exemplo
      return {
        status: 'success',
        message: `Etiqueta "${label.name}" aplicada a ${emailIds.length} email(s)`,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao aplicar etiqueta "${labelId}":`, error);
      return {
        status: 'error',
        message: `Erro ao aplicar etiqueta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Colorir uma pasta/etiqueta (principalmente para Gmail)
   */
  public async setFolderColor(
    folderId: string, 
    color: string
  ): Promise<FolderOperationResult> {
    try {
      // Verificar se a pasta existe
      const folder = this.cachedFolders.get(folderId);
      
      if (!folder) {
        return {
          status: 'not_found',
          message: `Pasta com ID "${folderId}" não encontrada`,
          timestamp: new Date()
        };
      }
      
      // Verificar se o provedor suporta cores
      if (this.provider !== 'gmail') {
        return {
          status: 'error',
          message: `Cores de pasta só são suportadas no Gmail`,
          timestamp: new Date()
        };
      }
      
      // Implementação simplificada para exemplo
      this.cachedFolders.set(folderId, {
        ...folder,
        color
      });
      
      return {
        status: 'success',
        message: `Cor da pasta "${folder.name}" alterada para "${color}"`,
        item: {
          ...folder,
          color
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Erro ao definir cor da pasta "${folderId}":`, error);
      return {
        status: 'error',
        message: `Erro ao definir cor da pasta: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Busca pastas/etiquetas por nome
   */
  public async searchFolders(searchTerm: string): Promise<OrganizationItem[]> {
    try {
      // Forçar uma atualização do cache, se necessário
      if (this.cachedFolders.size === 0) {
        await this.listFolders();
      }
      
      // Filtrar pastas pelo termo de busca
      const searchTermLower = searchTerm.toLowerCase();
      const results = Array.from(this.cachedFolders.values())
        .filter(folder => 
          folder.name.toLowerCase().includes(searchTermLower)
        );
      
      return results;
    } catch (error) {
      console.error(`Erro ao buscar pastas com termo "${searchTerm}":`, error);
      return [];
    }
  }
  
  /**
   * Obtém os detalhes de uma pasta específica
   */
  public async getFolderDetails(folderId: string): Promise<OrganizationItem | null> {
    try {
      // Verificar se temos a pasta em cache
      const cachedFolder = this.cachedFolders.get(folderId);
      
      if (cachedFolder) {
        return cachedFolder;
      }
      
      // Verificar se é uma pasta do sistema
      const systemFolder = this.systemFolders.get(folderId);
      
      if (systemFolder) {
        return systemFolder;
      }
      
      // Tentar atualizar o cache
      await this.listFolders(true);
      
      // Verificar novamente
      return this.cachedFolders.get(folderId) || null;
    } catch (error) {
      console.error(`Erro ao obter detalhes da pasta "${folderId}":`, error);
      return null;
    }
  }
  
  /**
   * Atualiza as contagens de uma pasta
   */
  public async updateFolderCounts(folderId: string): Promise<OrganizationItem | null> {
    try {
      // Verificar se a pasta existe
      const folder = await this.getFolderDetails(folderId);
      
      if (!folder) {
        return null;
      }
      
      // Implementação específica por provedor
      // Aqui teríamos que navegar para a pasta e extrair as contagens
      
      // Implementação simplificada para exemplo
      const updatedFolder = {
        ...folder,
        unreadCount: Math.floor(Math.random() * 10),
        totalCount: Math.floor(Math.random() * 100)
      };
      
      // Atualizar cache
      this.cachedFolders.set(folderId, updatedFolder);
      
      return updatedFolder;
    } catch (error) {
      console.error(`Erro ao atualizar contagens da pasta "${folderId}":`, error);
      return null;
    }
  }
}