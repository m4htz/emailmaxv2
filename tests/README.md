# Testes do EmailMaxV2

Este diretório contém os testes unitários, de integração e mocks para o projeto EmailMaxV2.

## Estrutura de Testes

```
tests/
├── components/          # Testes unitários para componentes de UI
├── integration/         # Testes de integração para fluxos principais
├── lib/                 # Testes para bibliotecas e utilitários
│   ├── store/           # Testes para os stores Zustand
│   ├── supabase/        # Testes para os clientes Supabase
│   └── utils/           # Testes para utilitários
├── mocks/               # Mocks reutilizáveis para testes
└── README.md            # Esta documentação
```

## Configuração

Os testes usam Jest como framework principal e @testing-library/react para testar componentes React. A configuração está definida no arquivo `jest.config.js` na raiz do projeto.

## Rodando os Testes

### Todos os Testes

```bash
npm test
```

### Testes Específicos

```bash
# Executar um arquivo de teste específico
npm test -- path/to/test/file.test.ts

# Executar testes que correspondem a um padrão
npm test -- -t 'nome do teste'

# Executar testes com geração de relatório de cobertura
npm run test:coverage

# Executar testes em modo watch (monitora alterações)
npm run test:watch
```

## Mocks

### Supabase

Criamos uma classe `SupabaseMockBuilder` para facilitar a criação de mocks do Supabase de forma consistente:

```typescript
import { createSupabaseMock } from '../mocks/supabase';

// Cria um mock padrão do Supabase
const supabaseMock = createSupabaseMock();

// Ou personalizar o mock
const customMock = new SupabaseMockBuilder()
  .withEmailAccounts([/* dados customizados */])
  .withAuth({
    signInWithPassword: jest.fn().mockResolvedValue(/* resposta customizada */)
  })
  .build();
```

### Microserviço de Validação

Para testar o microserviço de validação IMAP/SMTP, usamos mocks para o `fetch` global:

```typescript
// Simular uma resposta de sucesso
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({
    success: true,
    message: 'Conexão bem-sucedida',
    // ...detalhes adicionais
  })
});

// Simular um erro
global.fetch = jest.fn().mockRejectedValue(new Error('Falha de rede'));
```

## Testando Componentes UI

Para os componentes de UI, usamos @testing-library/react para renderizar e interagir com eles. Exemplo:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('deve renderizar corretamente', () => {
    render(<Button>Clique aqui</Button>);
    expect(screen.getByText('Clique aqui')).toBeInTheDocument();
  });
  
  it('deve chamar a função onClick quando clicado', () => {
    const onClickMock = jest.fn();
    render(<Button onClick={onClickMock}>Clique aqui</Button>);
    fireEvent.click(screen.getByText('Clique aqui'));
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
});
```

## Testando Hooks Personalizados

Para hooks personalizados, usamos `@testing-library/react-hooks` ou testamos indiretamente através de componentes. Exemplo:

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from '@/lib/store/useAuth';

describe('useAuth', () => {
  it('deve iniciar com o usuário não autenticado', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
  });
  
  it('deve autenticar o usuário corretamente', () => {
    const { result } = renderHook(() => useAuth());
    
    act(() => {
      result.current.setAuth(
        { id: '123', email: 'test@example.com' },
        'fake-token'
      );
    });
    
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

## Testes de Integração

Para testes de integração, combinamos mocks dos serviços externos (Supabase, fetch) com componentes reais para testar fluxos completos de usuário.

## Boas Práticas

1. **Isolamento**: Cada teste deve ser isolado e não depender de outros testes
2. **Mocks Consistentes**: Use os mocks definidos em `tests/mocks/` para consistência
3. **Cobertura**: Tente manter boa cobertura para componentes críticos e lógica de negócios
4. **Especificidade**: Teste comportamentos específicos, não implementações
5. **Clareza**: Nomeie seus testes de forma clara e descritiva

## Troubleshooting

### JSDOM e Problemas em Ambiente Node

Alguns comportamentos do navegador não estão disponíveis no JSDOM (ambiente de teste). Se tiver problemas com:

- `window.matchMedia`
- `IntersectionObserver`
- Animações CSS
- `localStorage` / `sessionStorage`

Crie mocks globais para esses recursos em `jest.setup.js`.

### Problemas de Importação Next.js

Para componentes Next.js como `useRouter`, `useSearchParams`, etc., sempre crie mocks específicos:

```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    // ...outros métodos necessários
  }),
  usePathname: () => '/current-path',
  useSearchParams: () => new URLSearchParams()
}));
```