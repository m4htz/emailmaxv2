import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmailAccountCard } from '@/components/email-accounts/email-account-card';
import { jest } from '@jest/globals';

// Mock das dependências
jest.mock('next/link', () => {
  return ({ children, href, className }) => {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

// Mock para window.confirm
const originalConfirm = window.confirm;
let mockConfirmResult = true;

describe('EmailAccountCard', () => {
  // Configuração antes de cada teste
  beforeEach(() => {
    // Mock da função confirm
    window.confirm = jest.fn(() => mockConfirmResult);
  });

  // Limpeza após os testes
  afterEach(() => {
    window.confirm = originalConfirm;
    jest.clearAllMocks();
  });

  // Dados de teste
  const mockProps = {
    id: 'test-123',
    email: 'usuario@exemplo.com',
    description: 'Conta principal',
    status: 'active' as const,
    provider: 'gmail' as const,
    lastSync: '2023-10-20 15:30'
  };

  it('deve renderizar corretamente com todos os dados', () => {
    render(<EmailAccountCard {...mockProps} />);

    // Verificar se o email é exibido
    expect(screen.getByText('usuario@exemplo.com')).toBeInTheDocument();
    // Verificar se a descrição é exibida
    expect(screen.getByText('Conta principal')).toBeInTheDocument();
    // Verificar se o status é exibido
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    // Verificar se a última sincronização é exibida
    expect(screen.getByText('Última sincronização: 2023-10-20 15:30')).toBeInTheDocument();
    // Verificar se os botões de ação estão presentes
    expect(screen.getByText('Conexão')).toBeInTheDocument();
    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Excluir')).toBeInTheDocument();
  });

  it('deve renderizar corretamente com status inativo', () => {
    render(
      <EmailAccountCard
        {...mockProps}
        status="inactive"
      />
    );

    // Verificar se o status foi alterado
    expect(screen.getByText('Inativo')).toBeInTheDocument();
    // O resto do conteúdo deve permanecer o mesmo
    expect(screen.getByText('usuario@exemplo.com')).toBeInTheDocument();
  });

  it('deve renderizar corretamente com status de erro', () => {
    render(
      <EmailAccountCard
        {...mockProps}
        status="error"
      />
    );

    // Verificar se o status foi alterado
    expect(screen.getByText('Erro')).toBeInTheDocument();
  });

  it('deve renderizar corretamente com diferentes provedores', () => {
    // Teste para Outlook
    const { unmount } = render(
      <EmailAccountCard
        {...mockProps}
        provider="outlook"
      />
    );
    
    // Verificar se o provedor é representado corretamente (Outlook = "O")
    const outlookLogo = screen.getByText('O');
    expect(outlookLogo).toBeInTheDocument();
    
    // Limpar para o próximo teste
    unmount();
    
    // Teste para Yahoo
    render(
      <EmailAccountCard
        {...mockProps}
        provider="yahoo"
      />
    );
    
    // Verificar se o provedor é representado corretamente (Yahoo = "Y")
    const yahooLogo = screen.getByText('Y');
    expect(yahooLogo).toBeInTheDocument();
  });

  it('deve renderizar corretamente sem descrição opcional', () => {
    // Remover a descrição dos props
    const propsWithoutDescription = { ...mockProps };
    delete propsWithoutDescription.description;
    
    render(<EmailAccountCard {...propsWithoutDescription} />);
    
    // Verificar que o email está presente
    expect(screen.getByText('usuario@exemplo.com')).toBeInTheDocument();
    // Verificar que a descrição NÃO está presente
    expect(screen.queryByText('Conta principal')).not.toBeInTheDocument();
  });

  it('deve renderizar corretamente sem data de última sincronização', () => {
    // Remover a data de sincronização dos props
    const propsWithoutLastSync = { ...mockProps };
    delete propsWithoutLastSync.lastSync;
    
    render(<EmailAccountCard {...propsWithoutLastSync} />);
    
    // Verificar que o email está presente
    expect(screen.getByText('usuario@exemplo.com')).toBeInTheDocument();
    // Verificar que a última sincronização NÃO está presente
    expect(screen.queryByText(/Última sincronização/)).not.toBeInTheDocument();
  });

  it('deve ter links corretos para conexão e edição', () => {
    render(<EmailAccountCard {...mockProps} />);
    
    // Verificar se o link de conexão tem o href correto
    const connectionLink = screen.getByText('Conexão').closest('a');
    expect(connectionLink).toHaveAttribute('href', '/email-accounts/test-123/connection');
    
    // Verificar se o link de edição tem o href correto
    const editLink = screen.getByText('Editar').closest('a');
    expect(editLink).toHaveAttribute('href', '/email-accounts/test-123');
  });
});