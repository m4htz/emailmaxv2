import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MetricCard } from '@/components/ui/metric-card';
import { Mail, User, BarChart2 } from 'lucide-react';

describe('MetricCard', () => {
  it('deve renderizar corretamente com propriedades básicas', () => {
    render(
      <MetricCard
        title="Total de Emails"
        value="1.234"
        icon={Mail}
      />
    );

    // Verificar se o título está presente
    expect(screen.getByText('Total de Emails')).toBeInTheDocument();
    // Verificar se o valor está presente
    expect(screen.getByText('1.234')).toBeInTheDocument();
    // Verificar se o ícone está presente (difícil testar diretamente o SVG)
    // Então verificamos a presença do elemento e sua estrutura
    const card = screen.getByText('Total de Emails').closest('div');
    expect(card).toBeInTheDocument();
  });

  it('deve renderizar com tendência positiva', () => {
    render(
      <MetricCard
        title="Taxa de Abertura"
        value="45%"
        icon={BarChart2}
        trend={{ value: 12, positive: true }}
      />
    );

    // Verificar se o título está presente
    expect(screen.getByText('Taxa de Abertura')).toBeInTheDocument();
    // Verificar se o valor está presente
    expect(screen.getByText('45%')).toBeInTheDocument();
    // Verificar se a tendência está presente com o valor correto
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('deve renderizar com tendência negativa', () => {
    render(
      <MetricCard
        title="Taxa de Rejeição"
        value="3.2%"
        icon={BarChart2}
        trend={{ value: 5, positive: false }}
      />
    );

    // Verificar se o título está presente
    expect(screen.getByText('Taxa de Rejeição')).toBeInTheDocument();
    // Verificar se o valor está presente
    expect(screen.getByText('3.2%')).toBeInTheDocument();
    // Verificar se a tendência está presente com o valor correto
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('deve aceitar e aplicar classes CSS personalizadas', () => {
    const { container } = render(
      <MetricCard
        title="Usuários Ativos"
        value="532"
        icon={User}
        className="custom-test-class"
      />
    );

    // Verificar se a classe personalizada foi aplicada
    const cardElement = container.firstChild;
    expect(cardElement).toHaveClass('custom-test-class');
  });

  it('deve lidar com valores grandes corretamente', () => {
    render(
      <MetricCard
        title="Receita Total"
        value="R$ 1.234.567,89"
        icon={BarChart2}
      />
    );

    // Verificar se o valor longo é renderizado corretamente
    expect(screen.getByText('R$ 1.234.567,89')).toBeInTheDocument();
  });

  it('deve renderizar sem tendência quando não fornecida', () => {
    render(
      <MetricCard
        title="Métrica Simples"
        value="100"
        icon={BarChart2}
      />
    );

    // Verificar conteúdo básico
    expect(screen.getByText('Métrica Simples')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    
    // Verificar que não há elementos de tendência
    expect(screen.queryByText(/\+\d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\-\d+%/)).not.toBeInTheDocument();
  });
});