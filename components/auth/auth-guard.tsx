'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store/useAuth';
import { AuthLogger } from '@/lib/store/useAuth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [redirectTriggered, setRedirectTriggered] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Não fazer nada até que a inicialização da autenticação esteja completa
    if (isInitializing) {
      AuthLogger.debug('AuthGuard: Aguardando inicialização da autenticação');
      return;
    }

    // Limpar timeout anterior se existir
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }

    // Timeout mais longo para garantir que o estado foi carregado corretamente
    redirectTimeoutRef.current = setTimeout(() => {
      AuthLogger.debug(`AuthGuard: Verificação concluída, autenticado: ${isAuthenticated}`);
      setIsLoading(false);

      // Verificar autenticação e redirecionar apenas se ainda não tiver redirecionado
      if (!isAuthenticated && !redirectTriggered) {
        AuthLogger.info('AuthGuard: Usuário não autenticado, redirecionando para login');
        setRedirectTriggered(true);
        router.push('/login');
      }
    }, 300);

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, router, isInitializing, redirectTriggered]);

  // Animação de carregamento
  const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
  );

  // Mostrar indicador de carregamento enquanto verifica autenticação
  if (isLoading || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <LoadingSpinner />
          <h2 className="text-xl font-medium mb-2">Verificando autenticação...</h2>
          <p className="text-slate-500">Aguarde um momento enquanto verificamos sua sessão</p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, mostrar mensagem de redirecionamento
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <LoadingSpinner />
          <h2 className="text-xl font-medium mb-2">Redirecionando...</h2>
          <p className="text-slate-500">Você será redirecionado para a página de login</p>
        </div>
      </div>
    );
  }

  // Se estiver autenticado, renderizar os filhos (conteúdo protegido)
  return <>{children}</>;
} 