import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent
} from '@/components/ui/card';

describe('Card Components', () => {
  it('deve renderizar Card com conteúdo e classes corretamente', () => {
    const { container } = render(
      <Card className="test-card-class">
        <div>Conteúdo do Card</div>
      </Card>
    );

    // Verificar se o conteúdo está presente
    expect(screen.getByText('Conteúdo do Card')).toBeInTheDocument();
    
    // Verificar se a classe personalizada foi aplicada
    expect(container.firstChild).toHaveClass('test-card-class');
    // Verificar se as classes padrão estão presentes
    expect(container.firstChild).toHaveClass('rounded-lg');
    expect(container.firstChild).toHaveClass('border');
    expect(container.firstChild).toHaveClass('bg-white');
  });

  it('deve renderizar CardHeader corretamente', () => {
    const { container } = render(
      <CardHeader className="test-header-class">
        <div>Conteúdo do Cabeçalho</div>
      </CardHeader>
    );

    // Verificar se o conteúdo está presente
    expect(screen.getByText('Conteúdo do Cabeçalho')).toBeInTheDocument();
    
    // Verificar se a classe personalizada foi aplicada
    expect(container.firstChild).toHaveClass('test-header-class');
    // Verificar se as classes padrão estão presentes
    expect(container.firstChild).toHaveClass('flex');
    expect(container.firstChild).toHaveClass('p-6');
  });

  it('deve renderizar CardTitle corretamente', () => {
    const { container } = render(
      <CardTitle className="test-title-class">Título do Card</CardTitle>
    );

    // Verificar se o conteúdo está presente
    expect(screen.getByText('Título do Card')).toBeInTheDocument();
    
    // Verificar se a classe personalizada foi aplicada
    expect(container.firstChild).toHaveClass('test-title-class');
    // Verificar se as classes padrão estão presentes
    expect(container.firstChild).toHaveClass('text-xl');
    expect(container.firstChild).toHaveClass('font-semibold');
    
    // Verificar se o elemento é um h3
    expect(container.querySelector('h3')).toBeInTheDocument();
  });

  it('deve renderizar CardDescription corretamente', () => {
    const { container } = render(
      <CardDescription className="test-desc-class">Descrição do Card</CardDescription>
    );

    // Verificar se o conteúdo está presente
    expect(screen.getByText('Descrição do Card')).toBeInTheDocument();
    
    // Verificar se a classe personalizada foi aplicada
    expect(container.firstChild).toHaveClass('test-desc-class');
    // Verificar se as classes padrão estão presentes
    expect(container.firstChild).toHaveClass('text-sm');
    expect(container.firstChild).toHaveClass('text-slate-500');
    
    // Verificar se o elemento é um p
    expect(container.querySelector('p')).toBeInTheDocument();
  });

  it('deve renderizar CardContent corretamente', () => {
    const { container } = render(
      <CardContent className="test-content-class">
        <div>Conteúdo principal</div>
      </CardContent>
    );

    // Verificar se o conteúdo está presente
    expect(screen.getByText('Conteúdo principal')).toBeInTheDocument();
    
    // Verificar se a classe personalizada foi aplicada
    expect(container.firstChild).toHaveClass('test-content-class');
    // Verificar se as classes padrão estão presentes
    expect(container.firstChild).toHaveClass('p-6');
    expect(container.firstChild).toHaveClass('pt-0');
  });

  it('deve renderizar CardFooter corretamente', () => {
    const { container } = render(
      <CardFooter className="test-footer-class">
        <div>Rodapé do Card</div>
      </CardFooter>
    );

    // Verificar se o conteúdo está presente
    expect(screen.getByText('Rodapé do Card')).toBeInTheDocument();
    
    // Verificar se a classe personalizada foi aplicada
    expect(container.firstChild).toHaveClass('test-footer-class');
    // Verificar se as classes padrão estão presentes
    expect(container.firstChild).toHaveClass('flex');
    expect(container.firstChild).toHaveClass('p-6');
    expect(container.firstChild).toHaveClass('pt-0');
  });

  it('deve renderizar um card completo com todos os componentes', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card de Exemplo</CardTitle>
          <CardDescription>Este é um card de exemplo completo</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Aqui está o conteúdo principal do card.</p>
          <p>Pode conter múltiplos elementos.</p>
        </CardContent>
        <CardFooter>
          <button>Botão 1</button>
          <button>Botão 2</button>
        </CardFooter>
      </Card>
    );

    // Verificar se todos os componentes estão presentes
    expect(screen.getByText('Card de Exemplo')).toBeInTheDocument();
    expect(screen.getByText('Este é um card de exemplo completo')).toBeInTheDocument();
    expect(screen.getByText('Aqui está o conteúdo principal do card.')).toBeInTheDocument();
    expect(screen.getByText('Pode conter múltiplos elementos.')).toBeInTheDocument();
    expect(screen.getByText('Botão 1')).toBeInTheDocument();
    expect(screen.getByText('Botão 2')).toBeInTheDocument();
  });
});