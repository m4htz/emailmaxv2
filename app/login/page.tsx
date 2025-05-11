'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/lib/supabase/client.singleton';
import { useAuthStore } from '@/lib/store/authStore';
import { z } from 'zod';
import { AuthLogger, retryWithBackoff } from '@/lib/store/useAuth';

// Schema de validação para o formulário de login
const loginSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .min(5, 'Email muito curto')
    .max(255, 'Email muito longo'),
  password: z.string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(100, 'Senha muito longa')
});

// Tipo para os erros de validação de formulário
type FormErrors = {
  email?: string;
  password?: string;
  general?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loginAttempts = useRef(0);
  const maxLoginAttempts = 5;
  const formRef = useRef<HTMLFormElement>(null);
  const [loginDisabled, setLoginDisabled] = useState(false);
  const loginDisabledTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Medição de performance para login
  const perfMeasurementRef = useRef<{start: number, operation: string} | null>(null);

  const measurePerformance = (operation: string) => {
    perfMeasurementRef.current = {
      start: performance.now(),
      operation
    };

    return () => {
      if (perfMeasurementRef.current) {
        const duration = performance.now() - perfMeasurementRef.current.start;
        AuthLogger.debug(`[PERF] ${operation} levou ${duration.toFixed(2)}ms`);
      }
    };
  };

  // Nova implementação simplificada para verificação de autenticação
  useEffect(() => {
    // Inicializar o Zustand para evitar problemas de hidratação
    useAuthStore.persist.rehydrate();

    // Criar um timeout para garantir que a verificação não fique presa
    const timeoutId = setTimeout(() => {
      setCheckingAuth(false);
      AuthLogger.warn("Verificação de autenticação interrompida após timeout");
    }, 3000);

    // Verificar autenticação já no store
    if (isAuthenticated) {
      clearTimeout(timeoutId);
      AuthLogger.info("Usuário já autenticado, redirecionando");
      router.push('/overview');
      return;
    }

    // Verificar modo desenvolvimento (bypass de autenticação)
    if (process.env.NODE_ENV === 'development' && document.cookie.includes('dev_access_bypass=true')) {
      clearTimeout(timeoutId);
      AuthLogger.info("Modo de desenvolvimento com bypass de autenticação");
      
      // Configurar usuário de desenvolvimento
      setAuth(
        {
          id: 'dev-user-id',
          email: 'dev@example.com',
          name: 'Usuário Dev',
        },
        'fake-token-for-development'
      );
      
      router.push('/overview?dev_bypass=true');
      return;
    }

    // Função de verificação simplificada
    const checkSession = async () => {
      try {
        // Tentar obter a sessão do Supabase diretamente (sem retries ou código complexo)
        const { data } = await supabase.auth.getSession();

        if (data?.session) {
          // Sessão válida encontrada
          setAuth(
            {
              id: data.session.user.id,
              email: data.session.user.email || '',
              name: data.session.user.user_metadata?.name || 'Usuário',
            },
            data.session.access_token
          );
          router.push('/overview');
        } else {
          // Nenhuma sessão válida, mostrar tela de login
          setCheckingAuth(false);
        }
      } catch (error) {
        // Qualquer erro, mostrar tela de login
        AuthLogger.error("Erro ao verificar sessão:", error);
        setCheckingAuth(false);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Executar verificação
    checkSession();

    return () => clearTimeout(timeoutId);
  }, [router, isAuthenticated, setAuth]);

  // Efeito para gerar token CSRF
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const csrfToken = Math.random().toString(36).substring(2);
      sessionStorage.setItem('csrf_token', csrfToken);
    }
  }, []);

  // Validar e enviar o formulário
  const validateAndSubmit = () => {
    try {
      // Validar dados de entrada
      loginSchema.parse({ email, password });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: FormErrors = {};
        error.errors.forEach((err) => {
          if (err.path) {
            const field = err.path[0] as keyof FormErrors;
            formattedErrors[field] = err.message;
          }
        });
        setErrors(formattedErrors);
        return false;
      }
      setErrors({ general: 'Erro ao validar formulário' });
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Limpar erros anteriores
    setErrors({});

    // Verificar se o formulário é válido
    if (!validateAndSubmit()) {
      return;
    }

    // Verificar número de tentativas
    if (loginAttempts.current >= maxLoginAttempts) {
      setErrors({ general: 'Muitas tentativas de login. Tente novamente mais tarde.' });
      setLoginDisabled(true);

      // Habilitar novamente após 2 minutos
      if (loginDisabledTimeoutRef.current) {
        clearTimeout(loginDisabledTimeoutRef.current);
      }

      loginDisabledTimeoutRef.current = setTimeout(() => {
        setLoginDisabled(false);
        loginAttempts.current = 0;
      }, 2 * 60 * 1000);

      return;
    }

    setLoading(true);
    const perfEnd = measurePerformance('handleSignIn');

    try {
      const csrfToken = sessionStorage.getItem('csrf_token');
      const headers: Record<string, string> = {};

      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      // Tentar fazer login com retry em caso de falha temporária
      const { data, error } = await retryWithBackoff(
        async () => supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            redirectTo: `${window.location.origin}/overview`,
            headers
          }
        })
      );

      if (error) {
        loginAttempts.current += 1;
        throw error;
      }

      // Reset contador de tentativas em caso de sucesso
      loginAttempts.current = 0;

      if (data.user) {
        // Atualizar o estado de autenticação no store
        setAuth(
          {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || 'Usuário',
          },
          data.session?.access_token || ''
        );

        // Salvar sessão em cache
        if (data.session) {
          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutos

          sessionStorage.setItem('auth_cache', JSON.stringify({
            session: data.session,
            expiresAt: expiresAt.toISOString()
          }));
        }

        // Navegar para o dashboard
        router.push('/overview');
      }
    } catch (error: any) {
      AuthLogger.error('Erro de login:', error);

      // Classificar erros para feedback mais claro
      if (error.message?.includes('Invalid login credentials')) {
        setErrors({ general: 'Email ou senha incorretos' });
      } else if (error.message?.includes('Email not confirmed')) {
        setErrors({ general: 'Por favor, confirme seu email antes de fazer login' });
      } else if (error.message?.includes('network')) {
        setErrors({ general: 'Erro de conexão. Verifique sua internet e tente novamente' });
      } else {
        setErrors({ general: error.message || 'Erro ao fazer login' });
      }
    } finally {
      setLoading(false);
      perfEnd();
    }
  };

  const handleDirectAccess = () => {
    AuthLogger.info('Iniciando acesso direto...');
    const perfEnd = measurePerformance('handleDirectAccess');

    try {
      // Configurar usuário mock para desenvolvimento
      const mockUser = {
        id: 'dev-user-id',
        email: 'dev@example.com',
        name: 'Usuário Dev'
      };

      // Configurar cookie para acesso direto
      document.cookie = 'dev_access_bypass=true; path=/; max-age=86400';

      // Atualizar o estado de autenticação
      setAuth(mockUser, 'fake-token-for-development');
      AuthLogger.info('Estado de autenticação atualizado. Redirecionando...');

      // Redirecionar com parâmetro para sinalizar o bypass no middleware
      router.push('/overview?dev_bypass=true');
    } catch (error) {
      AuthLogger.error('Erro no acesso direto:', error);
      setErrors({ general: 'Falha no acesso direto. Tente novamente.' });
    } finally {
      perfEnd();
    }
  };

  // Componente de spinner para indicar carregamento
  const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
  );

  // Se estiver verificando autenticação, mostrar estado de carregamento
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-medium mb-2">Verificando autenticação...</h2>
          <p className="text-slate-500">Aguarde um momento</p>
          <button 
            onClick={() => setCheckingAuth(false)}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Continuar para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundColor: '#f8fafc'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '24rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        backgroundColor: 'white',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          marginBottom: '1.5rem',
          textAlign: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          EmailMax
        </h1>

        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={handleDirectAccess}
            type="button"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '2rem',
              width: '100%',
              borderRadius: '0.5rem',
              backgroundColor: loading ? '#84cc16' : '#16a34a',
              padding: '1rem 0',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
              textAlign: 'center',
              textDecoration: 'none',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
              animation: loading ? 'none' : 'pulse 2s infinite'
            }}
          >
            {loading ? (
              <LoadingSpinner />
            ) : (
              <>
                <span style={{ marginRight: '8px', fontSize: '1.5rem' }}>⚡</span>
                <span>ACESSO DIRETO</span>
              </>
            )}
          </button>
        )}

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}} />

        {errors.general && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
          }}>
            {errors.general}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSignIn} style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.25rem'
            }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Limpar erro ao começar a digitar
                if (errors.email) {
                  setErrors(prev => ({ ...prev, email: undefined }));
                }
              }}
              disabled={loading || loginDisabled}
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: errors.email ? '1px solid #ef4444' : '1px solid #d1d5db',
                backgroundColor: loginDisabled ? '#f3f4f6' : 'white'
              }}
            />
            {errors.email && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {errors.email}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.25rem'
            }}>
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                // Limpar erro ao começar a digitar
                if (errors.password) {
                  setErrors(prev => ({ ...prev, password: undefined }));
                }
              }}
              disabled={loading || loginDisabled}
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: errors.password ? '1px solid #ef4444' : '1px solid #d1d5db',
                backgroundColor: loginDisabled ? '#f3f4f6' : 'white'
              }}
            />
            {errors.password && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || loginDisabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              borderRadius: '0.375rem',
              backgroundColor: loginDisabled
                              ? '#94a3b8'
                              : loading ? '#93c5fd' : '#2563eb',
              padding: '0.625rem 0',
              color: 'white',
              cursor: (loading || loginDisabled) ? 'not-allowed' : 'pointer',
              border: 'none',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                <span style={{ marginLeft: '0.5rem' }}>Entrando...</span>
              </>
            ) : loginDisabled ? (
              'Login bloqueado temporariamente'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#4b5563'
        }}>
          <Link
            href="/auth/signup"
            style={{
              fontWeight: '500',
              color: '#2563eb',
              textDecoration: 'none'
            }}
          >
            Não tem uma conta? Registre-se
          </Link>
        </div>
      </div>
    </div>
  );
}