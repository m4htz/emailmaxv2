import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddAccountForm } from '@/components/email-accounts/add-account-form';
import { jest } from '@jest/globals';

// Mocks necessários
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { 
          session: { 
            user: { 
              id: 'test-user-id',
              email: 'test@example.com'
            } 
          } 
        },
        error: null
      })
    },
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: 'account-id-1',
        email_address: 'test@example.com',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        imap_host: 'imap.example.com',
        imap_port: 993,
        connection_status: 'connected',
        display_name: 'Test Account',
        provider: 'gmail',
        smtp_username: 'test@example.com',
        imap_username: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
      },
      error: null
    }),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    throwOnError: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  }),
}));

jest.mock('@/lib/store', () => ({
  useEmailAccountsStore: () => ({
    addAccount: jest.fn(),
  }),
}));

jest.mock('@/lib/utils/email-connection', () => ({
  testEmailConnection: jest.fn().mockImplementation(async () => ({
    success: true,
    message: 'Conexão bem-sucedida',
    details: {
      imap: { success: true, message: 'IMAP conectado' },
      smtp: { success: true, message: 'SMTP conectado' },
      connectionType: 'real'
    }
  }))
}));

jest.mock('@/lib/utils/secure-storage', () => ({
  storeSecureCredential: jest.fn().mockResolvedValue('credential-id-123'),
  CredentialType: {
    EMAIL_PASSWORD: 'email_password'
  }
}));

// Mock para fetch API (verificação de microserviço)
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({ status: 'online' })
});

// Mock para o window.setTimeout
jest.useFakeTimers();

describe('AddAccountForm Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Configurar environment variables
    process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL = 'http://localhost:5000';
    process.env.NODE_ENV = 'development';
  });

  it('deve preencher e enviar o formulário corretamente', async () => {
    render(<AddAccountForm />);
    
    // Wait for the component to initialize and verify the title is displayed
    await waitFor(() => {
      expect(screen.getByText('Adicionar Conta de Email')).toBeInTheDocument();
    });

    // Fill in the form fields
    fireEvent.change(screen.getByPlaceholderText('seuemail@exemplo.com'), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Ex: Pessoal, Trabalho/i), {
      target: { value: 'Conta de Trabalho' }
    });
    
    // Selecionar provedor
    const providerSelect = screen.getByText('Selecione um provedor');
    fireEvent.click(providerSelect);
    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Gmail'));
    
    // Preencher senha
    fireEvent.change(screen.getByPlaceholderText(/xxxx xxxx xxxx xxxx/i), {
      target: { value: 'abcd efgh ijkl mnop' }
    });
    
    // IMAP fields should be auto-filled since we selected Gmail
    const imapHostInput = screen.getByLabelText('Host IMAP');
    const imapPortInput = screen.getByLabelText('Porta IMAP');
    const smtpHostInput = screen.getByLabelText('Host SMTP');
    const smtpPortInput = screen.getByLabelText('Porta SMTP');
    
    // Verify the default Gmail values were set
    expect(imapHostInput).toHaveValue('imap.gmail.com');
    expect(imapPortInput).toHaveValue(993);
    expect(smtpHostInput).toHaveValue('smtp.gmail.com');
    expect(smtpPortInput).toHaveValue(587);
    
    // Test connection
    const testButton = screen.getByText('Testar Conexão');
    fireEvent.click(testButton);
    
    // Add the account
    const addButton = screen.getByText('Adicionar Conta');
    fireEvent.click(addButton);
    
    // Wait for the form submission to complete
    await waitFor(() => {
      // Verify the mocked functions were called
      expect(useEmailAccountsStore().addAccount).toHaveBeenCalledWith(expect.objectContaining({
        email: 'test@example.com',
        provider: 'gmail',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
      }));
      
      // Verify that navigation was triggered to the accounts list
      expect(useRouter().push).toHaveBeenCalledWith('/email-accounts');
    });
  });

  it('deve validar os campos corretamente', async () => {
    render(<AddAccountForm />);

    // Tente enviar o formulário sem preencher nada
    const addButton = screen.getByText('Adicionar Conta');
    fireEvent.click(addButton);
    
    // Verificar mensagens de erro
    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
      expect(screen.getByText('A senha de aplicativo deve ter pelo menos 8 caracteres')).toBeInTheDocument();
      expect(screen.getByText('Selecione um provedor')).toBeInTheDocument();
      expect(screen.getByText('Host IMAP é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Host SMTP é obrigatório')).toBeInTheDocument();
    });

    // Preencher apenas o email incorretamente e verificar validação específica
    fireEvent.change(screen.getByPlaceholderText('seuemail@exemplo.com'), {
      target: { value: 'email-invalido' }
    });
    
    // Verificar erro de email inválido persiste
    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
    });
    
    // Corrigir o email e verificar que o erro desaparece
    fireEvent.change(screen.getByPlaceholderText('seuemail@exemplo.com'), {
      target: { value: 'email-valido@exemplo.com' }
    });
    
    // O erro de email deve desaparecer, mas outros permanecem
    await waitFor(() => {
      expect(screen.queryByText('Email inválido')).not.toBeInTheDocument();
      expect(screen.getByText('A senha de aplicativo deve ter pelo menos 8 caracteres')).toBeInTheDocument();
    });
  });

  it('deve exibir alerta quando o microserviço de validação está indisponível', async () => {
    // Alterar o mock do fetch para simular erro no microserviço
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    
    render(<AddAccountForm />);
    
    // Avançar os timers para permitir que os efeitos sejam executados
    jest.runAllTimers();
    
    // Como o toast é mockado, não podemos testá-lo diretamente
    // Verificamos que o fetch foi chamado com a URL correta
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/status',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer')
          })
        })
      );
    });
  });

  it('deve atualizar campos automaticamente ao selecionar provedores diferentes', async () => {
    render(<AddAccountForm />);
    
    // Selecionar provedor Gmail
    const providerSelect = screen.getByText('Selecione um provedor');
    fireEvent.click(providerSelect);
    await waitFor(() => {
      expect(screen.getByText('Gmail')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Gmail'));
    
    // Verificar valores padrão para Gmail
    expect(screen.getByLabelText('Host IMAP')).toHaveValue('imap.gmail.com');
    expect(screen.getByLabelText('Porta IMAP')).toHaveValue(993);
    expect(screen.getByLabelText('Host SMTP')).toHaveValue('smtp.gmail.com');
    expect(screen.getByLabelText('Porta SMTP')).toHaveValue(587);
    
    // Mudar para Outlook
    fireEvent.click(providerSelect);
    await waitFor(() => {
      expect(screen.getByText('Outlook/Hotmail')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Outlook/Hotmail'));
    
    // Verificar valores atualizados para Outlook
    expect(screen.getByLabelText('Host IMAP')).toHaveValue('outlook.office365.com');
    expect(screen.getByLabelText('Porta IMAP')).toHaveValue(993);
    expect(screen.getByLabelText('Host SMTP')).toHaveValue('smtp.office365.com');
    expect(screen.getByLabelText('Porta SMTP')).toHaveValue(587);
    
    // Mudar para Yahoo
    fireEvent.click(providerSelect);
    await waitFor(() => {
      expect(screen.getByText('Yahoo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Yahoo'));
    
    // Verificar valores atualizados para Yahoo
    expect(screen.getByLabelText('Host IMAP')).toHaveValue('imap.mail.yahoo.com');
    expect(screen.getByLabelText('Host SMTP')).toHaveValue('smtp.mail.yahoo.com');
  });
});

function useRouter() {
  return require('next/navigation').useRouter();
}

function useEmailAccountsStore() {
  return require('@/lib/store').useEmailAccountsStore();
}