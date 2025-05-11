// Adicionar bibliotecas de testes e mocks globais para o Jest
require('@testing-library/jest-dom');

// Mock para process.env caso seja necessário
// Isso permite simular variáveis de ambiente em testes
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://etudixeocvoqcntiiuxd.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dWRpeGVvY3ZvcWNudGlpdXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4MTc4MjYsImV4cCI6MjA2MjM5MzgyNn0.4hDJhZ7TkbCl0Rhs5d4IzGptT2-ykBZjfva3fwys3sk',
  NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL: 'http://localhost:5000',
  EMAIL_VALIDATION_API_KEY: 'dev_key_change_me_in_production',
  NEXT_PUBLIC_USE_VALIDATION_CACHE: 'true'
};

// Mock para window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock para window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn()
});

// Mock para HTMLElement.prototype.scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock para IntersectionObserver
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock
});

// Mock para ResizeObserver
class ResizeObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock
});

// Mock para localStorage e sessionStorage
const storageMock = () => {
  let storage = {};
  return {
    getItem: key => storage[key] || null,
    setItem: (key, value) => {
      storage[key] = value.toString();
    },
    removeItem: key => {
      delete storage[key];
    },
    clear: () => {
      storage = {};
    },
    key: i => Object.keys(storage)[i] || null,
    get length() {
      return Object.keys(storage).length;
    }
  };
};

Object.defineProperty(window, 'localStorage', {
  value: storageMock()
});
Object.defineProperty(window, 'sessionStorage', {
  value: storageMock()
});

// Mock para console.error para evitar ruído nos testes
// Armazena a implementação original para restaurá-la depois caso necessário
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('React does not recognize'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Desativar console.warn nas mensagens específicas
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('validateDOMNesting'))
  ) {
    return;
  }
  originalConsoleWarn(...args);
}; 