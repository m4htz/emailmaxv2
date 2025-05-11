'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from './authStore';
import { clientSingleton as supabase } from '@/lib/supabase';

// Estender interface Window para nossos flags globais
declare global {
  interface Window {
    __authPeriodicCheckLogged?: boolean;
    __authTokenRotationLogged?: boolean;
  }
}

/**
 * Utilitário para logging relacionado à autenticação
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

let currentLogLevel = process.env.NODE_ENV === 'development' ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;

export const AuthLogger = {
  setLogLevel: (level) => {
    currentLogLevel = level;
  },

  debug: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.debug(`[AUTH] ${message}`, ...args);
    }
  },

  info: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.info(`[AUTH] ${message}`, ...args);
    }
  },

  warn: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(`[AUTH] ${message}`, ...args);
    }
  },

  error: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error(`[AUTH] ${message}`, ...args);
    }
  }
};

/**
 * Função auxiliar para tentar operações com retry e backoff exponencial
 */
export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 500) {
  let retries = 0;
  let delay = initialDelay;

  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;

      if (retries >= maxRetries) {
        throw error;
      }

      // Backoff exponencial com jitter para evitar thundering herd
      const jitter = Math.random() * 200 - 100;
      delay = delay * 1.5 + jitter;

      AuthLogger.info(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em ${delay.toFixed(0)}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Funções para cache de sessão
 */
const cacheSession = (session) => {
  if (typeof window === 'undefined') return;

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Cache por 15 minutos

  sessionStorage.setItem('auth_cache', JSON.stringify({
    session,
    expiresAt: expiresAt.toISOString()
  }));

  AuthLogger.debug('Sessão armazenada em cache até', expiresAt.toLocaleString());
};

const getSessionFromCache = () => {
  if (typeof window === 'undefined') return null;

  const cached = sessionStorage.getItem('auth_cache');
  if (!cached) return null;

  try {
    const { session, expiresAt } = JSON.parse(cached);
    if (new Date(expiresAt) < new Date()) {
      AuthLogger.debug('Cache de sessão expirado, removendo');
      sessionStorage.removeItem('auth_cache');
      return null;
    }

    AuthLogger.debug('Usando sessão em cache');
    return session;
  } catch (error) {
    AuthLogger.error('Erro ao ler cache de sessão:', error);
    sessionStorage.removeItem('auth_cache');
    return null;
  }
};

/**
 * Hook personalizado para usar o store de autenticação com hidratação segura
 * e integração com Supabase
 */
// Manter contador de instâncias para debug e identificação de logs
let instanceCounter = 0;

export function useAuth() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const initializationCompleted = useRef(false);

  // Identificador único para esta instância do hook
  const instanceId = useRef(`auth-${++instanceCounter}`).current;

  // Obtém os valores e métodos do store
  const store = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    accessToken: state.accessToken,
    setAuth: state.setAuth,
    clearAuth: state.clearAuth
  }));

  /**
   * Função para verificar e sincronizar o estado de autenticação
   */
  const syncAuthState = useCallback(async () => {
    if (!initializationCompleted.current) {
      AuthLogger.warn('Tentativa de sincronizar estado durante inicialização, ignorando');
      return false;
    }

    const perfEnd = measureAuthPerformance('syncAuthState');
    try {
      // Verificar se há sessão ativa no Supabase
      const { data: { session } } = await retryWithBackoff(
        () => supabase.auth.getSession()
      );

      // Se temos uma sessão Supabase mas o estado do Zustand não está sincronizado
      if (session?.user && !store.isAuthenticated) {
        // Atualizar o estado local com os dados do usuário Supabase
        store.setAuth(
          {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || 'Usuário',
          },
          session.access_token
        );
        AuthLogger.info('Sessão Supabase restaurada no estado local');
        cacheSession(session);
        return true;
      }

      // Se não temos uma sessão Supabase mas o estado do Zustand acha que estamos autenticados
      if (!session && store.isAuthenticated) {
        AuthLogger.warn('Estado local de autenticação sem sessão correspondente, limpando...');
        store.clearAuth();
        return false;
      }

      return !!session; // Retorna verdadeiro se há uma sessão válida
    } catch (err) {
      AuthLogger.error('Erro ao verificar sessão do Supabase:', err);
      return false;
    } finally {
      perfEnd();
    }
  }, [store]);

  /**
   * Função para renovar uma sessão expirada
   */
  const refreshSession = useCallback(async () => {
    if (isRefreshing || !initializationCompleted.current) {
      AuthLogger.warn('Tentativa de renovar sessão durante inicialização ou outra renovação, ignorando');
      return false;
    }

    setIsRefreshing(true);
    const perfEnd = measureAuthPerformance('refreshSession');
    try {
      // Verificar se estamos em modo de desenvolvimento com bypass
      const hasDevBypass = typeof window !== 'undefined' &&
                          process.env.NODE_ENV === 'development' &&
                          document.cookie.includes('dev_access_bypass=true');

      // Em modo de desenvolvimento com bypass, não chegar realmente a fazer a chamada de refresh
      if (hasDevBypass) {
        AuthLogger.info('Modo de desenvolvimento com bypass de autenticação ativo - ignorando refresh de sessão');
        // Retornar true para não disparar erros na UI
        return true;
      }

      const { data, error } = await retryWithBackoff(
        () => supabase.auth.refreshSession()
      );

      if (error) {
        // Verificar se é um erro específico de sessão ausente em ambiente de desenvolvimento
        if (error.name === 'AuthSessionMissingError' &&
            process.env.NODE_ENV === 'development') {
          AuthLogger.warn('AuthSessionMissingError em ambiente de desenvolvimento - verificando bypass');

          // Verificar se o cookie de bypass está presente
          if (hasDevBypass) {
            AuthLogger.info('Modo de desenvolvimento com bypass ativo - ignorando erro de sessão ausente');
            return true;
          }
        }

        AuthLogger.error('Erro ao renovar sessão:', error);
        // Se ocorrer um erro na renovação, limpar estado de autenticação
        store.clearAuth();
        return false;
      }

      if (data.session) {
        // Atualizar o estado com a nova sessão
        store.setAuth(
          {
            id: data.session.user.id,
            email: data.session.user.email || '',
            name: data.session.user.user_metadata?.name || 'Usuário',
          },
          data.session.access_token
        );
        AuthLogger.info('Sessão renovada com sucesso');
        cacheSession(data.session);
        return true;
      }

      return false;
    } catch (err) {
      // Capturar erros específicos para tratamento diferenciado
      if (err instanceof Error) {
        // Verificar se é um erro específico de sessão ausente em ambiente de desenvolvimento
        if (err.name === 'AuthSessionMissingError' &&
            process.env.NODE_ENV === 'development' &&
            typeof window !== 'undefined' &&
            document.cookie.includes('dev_access_bypass=true')) {
          AuthLogger.info('AuthSessionMissingError em ambiente de desenvolvimento com bypass - ignorando');
          return true;
        }
      }

      AuthLogger.error('Erro durante renovação de sessão:', err);
      return false;
    } finally {
      setIsRefreshing(false);
      perfEnd();
    }
  }, [store, isRefreshing]);

  /**
   * Função para rotacionar refresh tokens periodicamente
   */
  const rotateRefreshToken = useCallback(async () => {
    if (!store.isAuthenticated || !initializationCompleted.current) return;

    // Verificar se estamos em modo de desenvolvimento com bypass
    const hasDevBypass = typeof window !== 'undefined' &&
                        process.env.NODE_ENV === 'development' &&
                        document.cookie.includes('dev_access_bypass=true');

    // Em modo de desenvolvimento com bypass, não fazer a rotação do token
    if (hasDevBypass) {
      AuthLogger.info('Modo de desenvolvimento com bypass - ignorando rotação de tokens');
      return;
    }

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        // Verificar se é um erro específico de sessão ausente em ambiente de desenvolvimento
        if (error.name === 'AuthSessionMissingError' &&
            process.env.NODE_ENV === 'development') {
          AuthLogger.warn('AuthSessionMissingError durante rotação de token em ambiente de desenvolvimento');
          return;
        }

        AuthLogger.error('Erro ao rotacionar refresh token:', error);
        return;
      }

      if (data.session) {
        AuthLogger.info('Refresh token rotacionado com sucesso');
        cacheSession(data.session);
      }
    } catch (err) {
      // Tratar erros específicos de sessão ausente
      if (err instanceof Error && err.name === 'AuthSessionMissingError' && process.env.NODE_ENV === 'development') {
        AuthLogger.warn('AuthSessionMissingError durante rotação de token em ambiente de desenvolvimento - ignorando');
        return;
      }

      AuthLogger.error('Erro ao rotacionar refresh token:', err);
    }
  }, [store.isAuthenticated]);

  // Efeito para hidratar o store e verificar autenticação com Supabase
  useEffect(() => {
    // Evitar múltiplas inicializações
    if (initializationCompleted.current) return;

    const initAuth = async () => {
      const perfEnd = measureAuthPerformance('initAuth');
      AuthLogger.info('Iniciando autenticação...');

      try {
        // Hidratar o store manualmente
        useAuthStore.persist.rehydrate();
        setIsHydrated(true);
        AuthLogger.debug('Store hidratado com sucesso');

        // Verificar se temos um cookie de bypass em desenvolvimento
        const hasDevBypass = document.cookie.includes('dev_access_bypass=true') &&
                            process.env.NODE_ENV === 'development';

        // Para desenvolvimento com bypass, não verificamos a sessão Supabase
        if (hasDevBypass) {
          AuthLogger.info('Modo de desenvolvimento com bypass de autenticação ativo');

          // Se não tivermos um usuário mockado no estado, mas temos o cookie de bypass,
          // configuramos um usuário mockado
          if (!store.isAuthenticated) {
            AuthLogger.debug('Configurando usuário de desenvolvimento...');
            store.setAuth(
              {
                id: 'dev-user-id',
                email: 'dev@example.com',
                name: 'Usuário Dev',
              },
              'fake-token-for-development'
            );
          }
        } else {
          // Verificar cache primeiro
          const cachedSession = getSessionFromCache();
          if (cachedSession && !store.isAuthenticated) {
            AuthLogger.info('Usando sessão em cache');
            store.setAuth(
              {
                id: cachedSession.user.id,
                email: cachedSession.user.email || '',
                name: cachedSession.user.user_metadata?.name || 'Usuário',
              },
              cachedSession.access_token
            );
          }

          // Sincronizar estado de autenticação com Supabase
          await syncAuthState();
        }
      } catch (error) {
        AuthLogger.error('Erro durante inicialização da autenticação:', error);
      } finally {
        initializationCompleted.current = true;
        setIsInitializing(false);
        perfEnd();
        AuthLogger.info('Inicialização da autenticação concluída');
      }
    };

    initAuth();

    // Configurar listener para eventos de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        AuthLogger.info('Evento de autenticação:', event);

        if (!initializationCompleted.current) {
          AuthLogger.warn('Ignorando evento de autenticação durante inicialização');
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          store.setAuth(
            {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 'Usuário',
            },
            session.access_token
          );
          cacheSession(session);
        } else if (event === 'SIGNED_OUT') {
          store.clearAuth();
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('auth_cache');
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          store.setAuth(
            {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 'Usuário',
            },
            session.access_token
          );
          cacheSession(session);
        }
      }
    );

    // Gerar token CSRF para proteção
    if (typeof window !== 'undefined') {
      const csrfToken = Math.random().toString(36).substring(2);
      sessionStorage.setItem('csrf_token', csrfToken);

      // Adicionar elemento meta para o token
      const meta = document.createElement('meta');
      meta.name = 'csrf-token';
      meta.content = csrfToken;
      document.head.appendChild(meta);

      AuthLogger.debug('Token CSRF gerado:', csrfToken);
    }

    // Limpar subscriber no cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, [store, syncAuthState]);

  // Verificar sessão periodicamente (a cada 5 minutos)
  useEffect(() => {
    if (!isHydrated || isInitializing) return;

    // Só registrar esta mensagem em modo de desenvolvimento
    // e apenas uma vez por instância usando o ID único
    if (process.env.NODE_ENV === 'development' && !window.__authPeriodicCheckLogged) {
      AuthLogger.debug(`[${instanceId}] Configurando verificação periódica de sessão`);
      window.__authPeriodicCheckLogged = true;
    }

    const checkInterval = setInterval(() => {
      syncAuthState();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(checkInterval);
  }, [isHydrated, syncAuthState, isInitializing]);

  // Rotação periódica de refresh token
  useEffect(() => {
    if (!isHydrated || !store.isAuthenticated || isInitializing) return;

    // Só registrar esta mensagem uma vez usando o ID único
    if (process.env.NODE_ENV === 'development' && !window.__authTokenRotationLogged) {
      AuthLogger.debug(`[${instanceId}] Configurando rotação periódica de refresh token`);
      window.__authTokenRotationLogged = true;
    }

    const rotationInterval = setInterval(() => {
      rotateRefreshToken();
    }, 6 * 60 * 60 * 1000); // 6 horas

    return () => clearInterval(rotationInterval);
  }, [isHydrated, store.isAuthenticated, rotateRefreshToken, isInitializing]);

  // Retorne um objeto de estado especial durante a inicialização
  if (isInitializing) {
    return {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      isRefreshing: false,
      isInitializing: true,
      setAuth: () => {},
      clearAuth: () => {},
      refreshSession: async () => false,
    };
  }

  return {
    ...store,
    isRefreshing,
    isInitializing: false,
    refreshSession,
  };
}

/**
 * Utility para medir performance de operações de autenticação
 */
const measureAuthPerformance = (operation) => {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    AuthLogger.debug(`[PERF] ${operation} levou ${duration.toFixed(2)}ms`);

    // Opcionalmente, enviar para um serviço de analytics
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'auth_performance', {
        event_category: 'performance',
        event_label: operation,
        value: Math.round(duration)
      });
    }
  };
}; 