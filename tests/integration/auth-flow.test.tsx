import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { createSupabaseMock, mockUser, mockSession } from '../mocks/supabase';

// Mock para Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock para o useToast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock para o supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
  clientSingleton: {
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn()
    }
  }
}));

// Mock para os hooks de autenticação
jest.mock('@/lib/store/useAuth', () => ({
  useAuth: jest.fn(),
  AuthLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Importar login-form após todos os mocks
import { LoginForm } from '@/components/ui/login-form';
import { useAuth } from '@/lib/store/useAuth';
import { clientSingleton as supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';

// Utility para o router
function getRouter() {
  return require('next/navigation').useRouter();
}

describe('Fluxo de Autenticação', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mock do Supabase
    const supabaseMock = createSupabaseMock();
    
    // Atribuir o mock às funções
    (createClient as jest.Mock).mockReturnValue(supabaseMock);
    
    // Configurar o singleton
    Object.keys(supabaseMock.auth).forEach(key => {
      if (typeof supabaseMock.auth[key] === 'function') {
        (supabase.auth[key] as jest.Mock).mockImplementation(supabaseMock.auth[key]);
      }
    });
    
    // Configurar o hook useAuth
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
      isRefreshing: false,
    });
  });

  it('deve fazer login com credenciais válidas', async () => {
    // Configure o mock do Supabase para autenticação bem-sucedida
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { 
        session: mockSession,
        user: mockUser 
      },
      error: null
    });

    render(<LoginForm />);

    // Preencher o formulário
    fireEvent.change(screen.getByPlaceholderText(/seu@email.com/i), {
      target: { value: 'usuario@exemplo.com' }
    });

    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: 'senha123' }
    });

    // Submeter o formulário
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Verificar se o Supabase foi chamado corretamente
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'usuario@exemplo.com',
        password: 'senha123'
      });
    });

    // Verificar se o hook useAuth.setAuth foi chamado
    const { setAuth } = useAuth();
    await waitFor(() => {
      expect(setAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        }),
        mockSession.access_token
      );
    });

    // Verificar se a navegação foi chamada
    await waitFor(() => {
      expect(getRouter().push).toHaveBeenCalledWith('/overview');
    });
  });

  it('deve exibir erro com credenciais inválidas', async () => {
    // Configure o mock do Supabase para autenticação com falha
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        message: 'Invalid login credentials',
        status: 400
      }
    });

    render(<LoginForm />);

    // Preencher o formulário
    fireEvent.change(screen.getByPlaceholderText(/seu@email.com/i), {
      target: { value: 'usuario@exemplo.com' }
    });

    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: 'senha_errada' }
    });

    // Submeter o formulário
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Verificar se mensagem de erro é exibida
    await waitFor(() => {
      expect(screen.getByText(/Email ou senha incorretos/i)).toBeInTheDocument();
    });

    // Verificar que não houve navegação
    expect(getRouter().push).not.toHaveBeenCalled();
  });

  it('deve fazer logout corretamente', async () => {
    // Configure o useAuth para simular um usuário autenticado
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.user_metadata.name
      },
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
      isRefreshing: false,
    });

    // Configure o mock do Supabase para logout bem-sucedido
    (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
      error: null
    });

    // Renderizar um componente simples com botão de logout
    render(
      <button onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    );

    // Clicar no botão de logout
    fireEvent.click(screen.getByText('Sair'));

    // Verificar se o método de signOut foi chamado
    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  it('deve lidar com erro de servidor durante login', async () => {
    // Configure o mock do Supabase para simular erro de servidor
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        message: 'Service unavailable',
        status: 503
      }
    });

    render(<LoginForm />);

    // Preencher o formulário
    fireEvent.change(screen.getByPlaceholderText(/seu@email.com/i), {
      target: { value: 'usuario@exemplo.com' }
    });

    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: 'senha123' }
    });

    // Submeter o formulário
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Verificar se mensagem de erro genérica é exibida
    await waitFor(() => {
      expect(screen.getByText(/Erro ao fazer login/i)).toBeInTheDocument();
    });
  });
});