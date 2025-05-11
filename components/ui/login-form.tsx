'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/store/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { AuthLogger } from '@/lib/store/useAuth';

// Schema de validação para o formulário de login
const loginSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .min(3, 'Email muito curto')
    .max(255, 'Email muito longo'),
  password: z.string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(100, 'Senha muito longa')
});

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  // Controle de tentativas de login para rate limiting
  const loginAttempts = useRef(0);
  const maxLoginAttempts = 5;
  const loginDisabledTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [loginDisabled, setLoginDisabled] = useState(false);

  const { setAuth } = useAuth();
  const router = useRouter();
  const supabase = createBrowserClient();

  // Limpar mensagens de sucesso após um tempo
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Limpar o timeout ao desmontar o componente
  useEffect(() => {
    return () => {
      if (loginDisabledTimeoutRef.current) {
        clearTimeout(loginDisabledTimeoutRef.current);
      }
    };
  }, []);
  
  // Função auxiliar para validar campos
  const validateField = (field: 'email' | 'password', value: string) => {
    try {
      // Validar campo individual
      loginSchema.shape[field].parse(value);
      // Remover erro se existir
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Adicionar erro
        setErrors(prev => ({
          ...prev,
          [field]: error.errors[0].message
        }));
      }
      return false;
    }
  };

  // Validar formulário completo
  const validateForm = () => {
    try {
      loginSchema.parse({ email, password });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Resetar mensagens
    setErrors({});
    setSuccess(null);

    // Validar formulário
    if (!validateForm()) {
      return;
    }

    // Verificar limite de tentativas
    if (loginDisabled) {
      setErrors({ general: 'Muitas tentativas de login. Tente novamente mais tarde.' });
      return;
    }

    // Incrementar contador de tentativas
    loginAttempts.current += 1;
    if (loginAttempts.current >= maxLoginAttempts) {
      setErrors({ general: 'Muitas tentativas de login. Tente novamente mais tarde.' });
      setLoginDisabled(true);

      loginDisabledTimeoutRef.current = setTimeout(() => {
        setLoginDisabled(false);
        loginAttempts.current = 0;
      }, 2 * 60 * 1000); // 2 minutos de espera

      return;
    }

    setIsLoading(true);

    try {
      // Iniciar medição de desempenho
      const startTime = performance.now();
      AuthLogger.debug('Iniciando tentativa de login:', email);

      // Tenta o login através do Supabase
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Medir duração da operação
      const duration = performance.now() - startTime;
      AuthLogger.debug(`Login processado em ${duration.toFixed(2)}ms`);

      // Verifica se houve erro no Supabase
      if (supabaseError) {
        AuthLogger.error('Erro Supabase:', supabaseError.message);

        // Fallback para login de demonstração se estamos em ambiente de desenvolvimento
        if (process.env.NODE_ENV === 'development' &&
            email === 'teste@exemplo.com' &&
            password === 'senha123') {
          AuthLogger.info('Credenciais de teste válidas, autenticando...');

          // Simular delay da API
          await new Promise(resolve => setTimeout(resolve, 500));

          // Criar usuário de teste
          setAuth(
            {
              id: 'user-teste-123',
              email: email,
              name: 'Usuário de Teste',
            },
            'fake-jwt-token-123'
          );

          // Mostrar mensagem de sucesso
          setSuccess('Login de teste bem-sucedido!');

          // Redirecionar para dashboard após sucesso
          setTimeout(() => {
            AuthLogger.info('Redirecionando para dashboard após login de teste');
            router.push('/overview');
          }, 1000);

          return;
        }

        // Mensagens de erro específicas baseadas no tipo de erro
        if (supabaseError.message.includes('Invalid login credentials')) {
          setErrors({ general: 'Email ou senha incorretos. Verifique suas credenciais.' });
        } else if (supabaseError.message.includes('Email not confirmed')) {
          setErrors({ general: 'Conta não confirmada. Verifique seu email para confirmar sua conta.' });
        } else if (supabaseError.message.includes('rate limit')) {
          setErrors({ general: 'Muitas tentativas de login. Tente novamente mais tarde.' });
          setLoginDisabled(true);

          loginDisabledTimeoutRef.current = setTimeout(() => {
            setLoginDisabled(false);
          }, 1 * 60 * 1000); // 1 minuto de espera
        } else {
          setErrors({ general: 'Erro ao fazer login. Tente novamente mais tarde.' });
        }
        return;
      }

      // Se o login do Supabase foi bem-sucedido
      if (data.user) {
        AuthLogger.info('Autenticação Supabase bem-sucedida');

        // Resetar contador de tentativas
        loginAttempts.current = 0;

        // Atualizar o estado local com os dados do usuário Supabase
        setAuth(
          {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || 'Usuário',
          },
          data.session?.access_token || ''
        );

        // Mostrar mensagem de sucesso
        setSuccess('Login bem-sucedido!');

        // Redirecionar para dashboard após sucesso
        setTimeout(() => {
          AuthLogger.info('Redirecionando para dashboard após login');
          router.push('/overview');
        }, 1000);
      }
    } catch (err: any) {
      AuthLogger.error('Erro durante login:', err);
      setErrors({ general: 'Ocorreu um erro ao autenticar. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setEmail(value);
            validateField('email', value);
          }}
          onBlur={() => validateField('email', email)}
          required
          disabled={isLoading || loginDisabled}
          className={`w-full ${errors.email ? 'border-red-300 ring-red-200' : ''}`}
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1 flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" /> {errors.email}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setPassword(value);
            validateField('password', value);
          }}
          onBlur={() => validateField('password', password)}
          required
          disabled={isLoading || loginDisabled}
          className={`w-full ${errors.password ? 'border-red-300 ring-red-200' : ''}`}
        />
        {errors.password && (
          <p className="text-sm text-red-500 mt-1 flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" /> {errors.password}
          </p>
        )}
      </div>
      
      {errors.general && (
        <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm text-red-700 flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>{errors.general}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 p-3 rounded-md text-sm text-green-700 flex items-center">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
      
      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || loginDisabled || Object.keys(errors).length > 0}
      >
        {isLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Autenticando...</>
        ) : loginDisabled ? (
          'Muitas tentativas. Aguarde...'
        ) : (
          'Entrar'
        )}
      </Button>
      
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-md mb-4">
            <p className="text-sm text-slate-600 font-medium mb-1">Credenciais de teste (apenas desenvolvimento)</p>
            <p className="text-xs text-slate-500 mb-1">Email: teste@exemplo.com</p>
            <p className="text-xs text-slate-500">Senha: senha123</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 font-medium py-3"
              onClick={() => {
                setEmail('teste@exemplo.com');
                setPassword('senha123');
                setErrors({});
              }}
            >
              Preencher Credenciais
            </Button>

            <Button
              type="button"
              className="w-full bg-green-600 hover:bg-green-700 font-medium py-3"
              onClick={() => {
                AuthLogger.info('Acesso direto via login-form');

                try {
                  // Mostrar mensagem indicando acesso direto
                  setSuccess('Modo desenvolvimento ativado!');

                  // 1. Configurar cookie para acesso direto
                  document.cookie = 'dev_access_bypass=true; path=/; max-age=86400';

                  // 2. Simular um usuário autenticado
                  setAuth(
                    {
                      id: 'dev-user-id',
                      email: 'dev@example.com',
                      name: 'Usuário Dev'
                    },
                    'fake-token-for-development'
                  );

                  // 3. Redirecionar para dashboard após um pequeno delay
                  setTimeout(() => {
                    // Redirecionar diretamente com parâmetro
                    window.location.href = '/overview?dev_bypass=true';
                  }, 1000);
                } catch (error) {
                  AuthLogger.error('Erro no acesso direto:', error);
                  setErrors({ general: 'Erro ao ativar modo desenvolvimento' });
                }
              }}
            >
              ⚡ Acesso Direto
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};