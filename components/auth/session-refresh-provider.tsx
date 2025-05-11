'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/store/useAuth';
import { useToast } from '@/components/ui/use-toast';

interface SessionRefreshProviderProps {
  children: React.ReactNode;
}

/**
 * Componente que gerencia a renovação automática de sessões do Supabase
 * Deve ser incluído no layout principal da aplicação
 */
export function SessionRefreshProvider({ children }: SessionRefreshProviderProps) {
  const { isAuthenticated, isRefreshing, refreshSession, user } = useAuth();
  const { toast } = useToast();
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [sessionError, setSessionError] = useState<Error | null>(null);
  
  // Função para verificar e renovar a sessão
  const checkAndRefreshSession = async () => {
    try {
      // Se o usuário não estiver autenticado, não há sessão para renovar
      if (!isAuthenticated || !user) return;

      // Tentativa de renovação da sessão
      const success = await refreshSession();
      setLastCheck(new Date());

      if (!success) {
        console.warn('Falha ao renovar sessão - pode expirar em breve');

        // Verificar se estamos em modo de desenvolvimento
        if (process.env.NODE_ENV === 'development' && document.cookie.includes('dev_access_bypass=true')) {
          console.log('Modo de desenvolvimento com bypass de autenticação ativo - ignorando erro de sessão');
          return;
        }

        // Notificar o usuário apenas se esta não for uma renovação automática em segundo plano
        toast({
          title: 'Atenção',
          description: 'Sua sessão pode expirar em breve. Recomendamos fazer login novamente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao verificar/renovar sessão:', error);
      setSessionError(error instanceof Error ? error : new Error(String(error)));

      // Verificar se é um erro específico de sessão ausente em ambiente de desenvolvimento
      if (error instanceof Error &&
          error.name === 'AuthSessionMissingError' &&
          process.env.NODE_ENV === 'development' &&
          document.cookie.includes('dev_access_bypass=true')) {
        console.log('AuthSessionMissingError em ambiente de desenvolvimento com bypass - ignorando');
        return;
      }

      toast({
        title: 'Erro de sessão',
        description: 'Ocorreu um erro ao renovar sua sessão. Por favor, tente fazer login novamente.',
        variant: 'destructive',
      });
    }
  };

  // Efeito para verificar a sessão periodicamente
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Verificar imediatamente ao montar o componente
    checkAndRefreshSession();
    
    // Configurar verificação periódica (a cada 30 minutos)
    const refreshInterval = setInterval(() => {
      checkAndRefreshSession();
    }, 30 * 60 * 1000); // 30 minutos
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, user?.id]);

  // Efeito para registrar mensagens de debug (apenas em desenvolvimento)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (isAuthenticated && user) {
        console.log(`SessionRefreshProvider: Monitorando sessão para usuário ${user.id}`);
        if (isRefreshing) {
          console.log('SessionRefreshProvider: Renovando sessão...');
        }
        if (lastCheck) {
          console.log(`SessionRefreshProvider: Última verificação em ${lastCheck.toLocaleString()}`);
        }
        if (sessionError) {
          console.error('SessionRefreshProvider: Erro na verificação:', sessionError);
        }
      } else {
        console.log('SessionRefreshProvider: Nenhum usuário autenticado');
      }
    }
  }, [isAuthenticated, user, isRefreshing, lastCheck, sessionError]);

  // Renderizar apenas os filhos - este componente não tem UI
  return <>{children}</>;
}