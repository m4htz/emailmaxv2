/**
 * Exemplo de uso do FolderManager
 * Demonstra a gestão de pastas e etiquetas em diferentes provedores de webmail
 */

import { chromium, Page, Browser } from 'playwright';
import { FolderManager, CreateFolderOptions } from '../folder-manager';
import { WebmailProvider } from '../types';
import { AdaptiveSelectors } from '../adaptive-selectors';
import { ElementDetector, createElementDetector } from '../element-detector';

/**
 * Classe de demonstração do gerenciador de pastas
 */
export class FolderManagerDemo {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private folderManager: FolderManager | null = null;
  private provider: WebmailProvider;
  private adaptiveSelectors: AdaptiveSelectors | null = null;
  private elementDetector: ElementDetector | null = null;

  constructor(provider: WebmailProvider = 'gmail') {
    this.provider = provider;
  }

  /**
   * Inicializa o navegador e o gerenciador de pastas
   */
  public async initialize(isHeadless = false): Promise<boolean> {
    try {
      // Inicializar navegador
      this.browser = await chromium.launch({
        headless: isHeadless,
        // Slow-mo para visualizar melhor as ações em modo não-headless
        slowMo: isHeadless ? 0 : 50
      });
      
      // Criar página
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
      });
      
      this.page = await context.newPage();
      
      // Criar instâncias dos componentes auxiliares
      this.adaptiveSelectors = new AdaptiveSelectors(this.provider, this.page);
      
      this.elementDetector = createElementDetector(this.provider, this.page, {
        adaptiveSelectors: this.adaptiveSelectors,
        learningEnabled: true
      });
      
      // Inicializar o gerenciador de pastas
      this.folderManager = new FolderManager({
        provider: this.provider,
        page: this.page,
        adaptiveSelectors: this.adaptiveSelectors,
        elementDetector: this.elementDetector
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao inicializar FolderManagerDemo:', error);
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
   * Lista e exibe todas as pastas
   */
  public async listAllFolders(): Promise<void> {
    if (!this.folderManager) {
      throw new Error('O gerenciador de pastas não foi inicializado');
    }
    
    console.log(`\nListando pastas do ${this.provider}...`);
    
    const folders = await this.folderManager.listFolders(true);
    
    // Agrupar pastas por tipo
    const systemFolders = folders.filter(f => f.systemFolder);
    const userFolders = folders.filter(f => !f.systemFolder);
    
    // Mostrar pastas do sistema
    console.log('\nPastas do sistema:');
    systemFolders.forEach(folder => {
      console.log(`- ${folder.name} (${folder.type}, ID: ${folder.id})`);
    });
    
    // Mostrar pastas do usuário
    console.log('\nPastas personalizadas:');
    if (userFolders.length === 0) {
      console.log('  Nenhuma pasta personalizada encontrada.');
    } else {
      userFolders.forEach(folder => {
        const parentInfo = folder.parentId ? ` (dentro de: ${folder.parentId})` : '';
        console.log(`- ${folder.name} (${folder.type}, ID: ${folder.id})${parentInfo}`);
      });
    }
  }

  /**
   * Cria uma nova pasta
   */
  public async createNewFolder(
    folderName: string, 
    options?: CreateFolderOptions
  ): Promise<void> {
    if (!this.folderManager) {
      throw new Error('O gerenciador de pastas não foi inicializado');
    }
    
    console.log(`\nCriando pasta "${folderName}"...`);
    
    const result = await this.folderManager.createFolder(folderName, options);
    
    if (result.status === 'success') {
      console.log(`✅ ${result.message}`);
      
      if (result.item) {
        console.log(`Detalhes da pasta criada:`);
        console.log(`- Nome: ${result.item.name}`);
        console.log(`- ID: ${result.item.id}`);
        console.log(`- Tipo: ${result.item.type}`);
        if (result.item.parentId) {
          console.log(`- Pasta pai: ${result.item.parentId}`);
        }
      }
    } else {
      console.log(`❌ ${result.message}`);
    }
  }

  /**
   * Executa uma série de operações para demonstrar as capacidades
   */
  public async runFolderOperationsDemo(): Promise<void> {
    if (!this.folderManager) {
      throw new Error('O gerenciador de pastas não foi inicializado');
    }
    
    console.log(`\n=== Demonstração de Operações com Pastas no ${this.provider} ===`);
    
    // 1. Listar pastas iniciais
    await this.listAllFolders();
    
    // 2. Criar uma nova pasta
    const testFolderName = `Teste Automação ${new Date().getTime().toString().slice(-4)}`;
    await this.createNewFolder(testFolderName);
    
    // 3. Atualizar lista após criação
    console.log('\nAtualizando lista de pastas após criação...');
    await this.listAllFolders();
    
    // 4. Buscar pastas que contenham "teste"
    console.log('\nBuscando pastas que contenham "teste"...');
    const searchResults = await this.folderManager.searchFolders('teste');
    
    searchResults.forEach(folder => {
      console.log(`- ${folder.name} (${folder.type}, ID: ${folder.id})`);
    });
    
    // 5. Se encontrou a pasta de teste, tentar criar uma subpasta
    if (searchResults.length > 0) {
      const testFolder = searchResults[0];
      
      // Criar subpasta
      const subfolderName = `Subpasta de ${testFolder.name}`;
      console.log(`\nCriando subpasta "${subfolderName}"...`);
      
      const subfolderResult = await this.folderManager.createFolder(subfolderName, {
        parentFolder: testFolder.name,
        type: 'folder'
      });
      
      if (subfolderResult.status === 'success') {
        console.log(`✅ ${subfolderResult.message}`);
      } else {
        console.log(`❌ ${subfolderResult.message}`);
      }
      
      // Atualizar lista novamente
      await this.listAllFolders();
    }
    
    // 6. Simular mover emails para uma pasta
    if (searchResults.length > 0) {
      const targetFolder = searchResults[0];
      console.log(`\nSimulando mover emails para a pasta "${targetFolder.name}"...`);
      
      const mockEmailIds = ['email1', 'email2', 'email3'];
      const moveResult = await this.folderManager.moveEmailsToFolder(mockEmailIds, targetFolder.id);
      
      if (moveResult.status === 'success') {
        console.log(`✅ ${moveResult.message}`);
      } else {
        console.log(`❌ ${moveResult.message}`);
      }
    }
    
    console.log('\nDemonstração concluída!');
  }

  /**
   * Fecha o navegador
   */
  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.folderManager = null;
      this.adaptiveSelectors = null;
      this.elementDetector = null;
    }
  }
}

/**
 * Função principal para executar a demonstração
 */
export async function runFolderManagerDemo(
  provider: WebmailProvider = 'gmail',
  isHeadless = false
): Promise<void> {
  const demo = new FolderManagerDemo(provider);
  
  try {
    console.log(`Iniciando demonstração do FolderManager para ${provider}...`);
    await demo.initialize(isHeadless);
    await demo.navigateToProvider();
    
    // Pausa para permitir que a página carregue completamente e o usuário interaja se necessário
    console.log('Aguardando carregamento completo e possível login...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Executar demonstração de operações com pastas
    await demo.runFolderOperationsDemo();
    
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
  
  runFolderManagerDemo(provider, isHeadless).catch(console.error);
}