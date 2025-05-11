/**
 * Testes para o módulo FolderManager
 */

import { 
  FolderManager, 
  OrganizationItem, 
  FolderOperationResult 
} from '../../../../lib/utils/webmail-automation/folder-manager';
import { Page } from 'playwright';

// Mock para o objeto Page do Playwright
const createMockPage = () => {
  return {
    $: jest.fn(),
    $$: jest.fn(),
    evaluate: jest.fn(),
    waitForSelector: jest.fn(),
    waitForTimeout: jest.fn(),
    click: jest.fn(),
    fill: jest.fn(),
    goto: jest.fn(),
    waitForLoadState: jest.fn(),
  } as unknown as Page;
};

// Mocks para AdaptiveSelectors e ElementDetector
jest.mock('../../../../lib/utils/webmail-automation/adaptive-selectors', () => {
  return {
    AdaptiveSelectors: jest.fn().mockImplementation(() => {
      return {
        getSelector: jest.fn().mockImplementation((key) => {
          return Promise.resolve(`selector-for-${key}`);
        }),
        addSelector: jest.fn(),
      };
    }),
  };
});

jest.mock('../../../../lib/utils/webmail-automation/element-detector', () => {
  return {
    ElementDetector: jest.fn().mockImplementation(() => {
      return {
        detectElement: jest.fn().mockImplementation((type) => {
          return Promise.resolve({
            type,
            selector: `selector-for-${type}`,
            confidence: 0.9,
          });
        }),
        waitForElement: jest.fn(),
        clickElement: jest.fn(),
      };
    }),
    createElementDetector: jest.fn().mockImplementation(() => {
      return {
        detectElement: jest.fn().mockImplementation((type) => {
          return Promise.resolve({
            type,
            selector: `selector-for-${type}`,
            confidence: 0.9,
          });
        }),
        waitForElement: jest.fn(),
        clickElement: jest.fn(),
      };
    }),
  };
});

describe('FolderManager', () => {
  let mockPage: any;
  let folderManager: FolderManager;
  
  beforeEach(() => {
    mockPage = createMockPage();
    folderManager = new FolderManager({
      provider: 'gmail',
      page: mockPage,
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('deve ser inicializado corretamente', () => {
    expect(folderManager).toBeInstanceOf(FolderManager);
  });
  
  test('listFolders deve retornar as pastas do sistema por padrão', async () => {
    const folders = await folderManager.listFolders();
    
    // Deve ter pelo menos as pastas de sistema comuns
    expect(folders.length).toBeGreaterThan(0);
    
    // Verificar se as pastas básicas estão presentes
    const folderNames = folders.map(f => f.name);
    expect(folderNames).toContain('Inbox');
    expect(folderNames).toContain('Sent');
    expect(folderNames).toContain('Trash');
  });
  
  test('createFolder deve criar uma nova pasta com sucesso', async () => {
    // Configurar mocks para simular a interface de criação de pasta
    mockPage.waitForSelector.mockImplementation(() => {
      return { click: jest.fn(), fill: jest.fn() };
    });
    
    const result = await folderManager.createFolder('TestFolder');
    
    expect(result.status).toBe('success');
    expect(result.item).toBeDefined();
    if (result.item) {
      expect(result.item.name).toBe('TestFolder');
      expect(result.item.systemFolder).toBe(false);
    }
  });
  
  test('searchFolders deve retornar pastas correspondentes ao termo de busca', async () => {
    // Criar algumas pastas personalizadas para teste
    (folderManager as any).cachedFolders.set('test_folder', {
      id: 'test_folder',
      name: 'Test Folder',
      type: 'folder',
      systemFolder: false,
    });
    
    (folderManager as any).cachedFolders.set('another_test', {
      id: 'another_test',
      name: 'Another Test',
      type: 'folder',
      systemFolder: false,
    });
    
    (folderManager as any).cachedFolders.set('important', {
      id: 'important',
      name: 'Important',
      type: 'folder',
      systemFolder: true,
    });
    
    // Buscar pastas com "test"
    const results = await folderManager.searchFolders('test');
    
    expect(results.length).toBe(2);
    expect(results.map(f => f.name)).toContain('Test Folder');
    expect(results.map(f => f.name)).toContain('Another Test');
    expect(results.map(f => f.name)).not.toContain('Important');
  });
  
  test('getFolderDetails deve retornar detalhes de uma pasta específica', async () => {
    // Configurar uma pasta no cache para o teste
    const testFolder: OrganizationItem = {
      id: 'test_folder',
      name: 'Test Folder',
      type: 'folder',
      systemFolder: false,
      unreadCount: 5,
    };
    
    (folderManager as any).cachedFolders.set('test_folder', testFolder);
    
    // Obter detalhes da pasta
    const folder = await folderManager.getFolderDetails('test_folder');
    
    expect(folder).not.toBeNull();
    if (folder) {
      expect(folder.id).toBe('test_folder');
      expect(folder.name).toBe('Test Folder');
      expect(folder.unreadCount).toBe(5);
    }
  });
  
  test('renameFolder deve retornar erro para pastas do sistema', async () => {
    const result = await folderManager.renameFolder('inbox', 'New Inbox Name');
    
    expect(result.status).toBe('system_folder');
    expect(result.message).toContain('sistema');
  });
  
  test('deleteFolder deve retornar erro para pastas inexistentes', async () => {
    const result = await folderManager.deleteFolder('non_existent_folder');
    
    expect(result.status).toBe('not_found');
    expect(result.message).toContain('não encontrada');
  });
  
  test('moveEmailsToFolder deve verificar se a pasta de destino existe', async () => {
    // Configurar uma pasta no cache para o teste
    const testFolder: OrganizationItem = {
      id: 'destination_folder',
      name: 'Destination Folder',
      type: 'folder',
      systemFolder: false,
    };
    
    (folderManager as any).cachedFolders.set('destination_folder', testFolder);
    
    // Tentar mover emails para a pasta
    const result = await folderManager.moveEmailsToFolder(
      ['email1', 'email2'], 
      'destination_folder'
    );
    
    expect(result.status).toBe('success');
    expect(result.message).toContain('movido');
  });
  
  test('moveEmailsToFolder deve retornar erro para pasta inexistente', async () => {
    const result = await folderManager.moveEmailsToFolder(
      ['email1', 'email2'], 
      'non_existent_folder'
    );
    
    expect(result.status).toBe('not_found');
    expect(result.message).toContain('não encontrada');
  });
  
  test('setFolderColor só deve funcionar no Gmail', async () => {
    // Configurar folderManager para Yahoo
    const yahooFolderManager = new FolderManager({
      provider: 'yahoo',
      page: mockPage,
    });
    
    // Configurar uma pasta no cache para o teste
    const testFolder: OrganizationItem = {
      id: 'test_folder',
      name: 'Test Folder',
      type: 'folder',
      systemFolder: false,
    };
    
    (yahooFolderManager as any).cachedFolders.set('test_folder', testFolder);
    
    // Tentar definir cor no Yahoo
    const yahooResult = await yahooFolderManager.setFolderColor('test_folder', 'red');
    
    expect(yahooResult.status).toBe('error');
    expect(yahooResult.message).toContain('só são suportadas no Gmail');
    
    // Configurar uma pasta no cache do Gmail
    (folderManager as any).cachedFolders.set('test_folder', testFolder);
    
    // Tentar definir cor no Gmail
    const gmailResult = await folderManager.setFolderColor('test_folder', 'red');
    
    expect(gmailResult.status).toBe('success');
    expect(gmailResult.message).toContain('alterada para "red"');
  });
});