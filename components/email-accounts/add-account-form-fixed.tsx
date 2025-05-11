'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { testEmailConnection, TestConnectionResult } from '@/lib/utils/email-connection';
import { storeSecureCredential, CredentialType } from '@/lib/utils/secure-storage';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useEmailAccountsStore } from '@/lib/store';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Esquema de validação Zod
const accountFormSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  appPassword: z.string().min(8, { message: 'A senha de aplicativo deve ter pelo menos 8 caracteres' }),
  provider: z.string().min(1, { message: 'Selecione um provedor' }),
  imapHost: z.string().min(1, { message: 'Host IMAP é obrigatório' }),
  imapPort: z.coerce.number().int().positive({ message: 'Porta IMAP inválida' }),
  smtpHost: z.string().min(1, { message: 'Host SMTP é obrigatório' }),
  smtpPort: z.coerce.number().int().positive({ message: 'Porta SMTP inválida' }),
  name: z.string().optional(),
});

// Tipos para os valores do formulário
type AccountFormValues = z.infer<typeof accountFormSchema>;

// Lista de provedores comuns com configurações padrão
const commonProviders = [
  {
    value: 'gmail',
    label: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
  },
  {
    value: 'outlook',
    label: 'Outlook/Hotmail',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
  },
  {
    value: 'yahoo',
    label: 'Yahoo',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
  },
  {
    value: 'zoho',
    label: 'Zoho Mail',
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    smtpHost: 'smtp.zoho.com',
    smtpPort: 587,
  },
  {
    value: 'custom',
    label: 'Personalizado',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 587,
  },
];

// Função para fazer fetch seguro com retries
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, timeout = 10000): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Se não for a primeira tentativa, esperar um tempo progressivo
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Retry ${attempt+1}/${retries}, aguardando ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Criar um timeout manual para cada tentativa
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Fazer a requisição com o timeout
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        }
      });
      
      // Limpar o timeout se chegou aqui
      clearTimeout(timeoutId);
      
      // Retornar resposta bem-sucedida
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt+1} failed: ${lastError.message}`);
      
      // Se for o último retry, relançar o erro
      if (attempt === retries - 1) {
        throw new Error(`Failed after ${retries} attempts: ${lastError.message}`);
      }
    }
  }
  
  // Não deveria chegar aqui, mas para satisfazer o TypeScript
  throw lastError || new Error('Unknown error in fetchWithRetry');
}

export const AddAccountForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [connectionCheckLoading, setConnectionCheckLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const { addAccount } = useEmailAccountsStore();

  // Estado para controlar disponibilidade do serviço
  const [microserviceStatus, setMicroserviceStatus] = useState<'checking' | 'available' | 'unavailable' | 'error'>('checking');
  const [microserviceErrorDetails, setMicroserviceErrorDetails] = useState<string | null>(null);

  // Inicializar o formulário
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      email: '',
      appPassword: '',
      provider: '',
      imapHost: '',
      imapPort: 993,
      smtpHost: '',
      smtpPort: 587,
      name: '',
    },
  });

  // Verificar se o Supabase está conectado ao carregar o componente
  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        setConnectionCheckLoading(true);
        // Fazer uma requisição simples para o Supabase
        const { data, error } = await supabase
          .from('email_accounts')
          .select('count')
          .limit(1)
          .throwOnError();
        
        // Verificar se a conexão foi bem-sucedida
        setSupabaseConnected(error ? false : true);
      } catch (error) {
        console.error('Erro ao verificar conexão com o Supabase:', error);
        setSupabaseConnected(false);
      } finally {
        setConnectionCheckLoading(false);
      }
    };

    checkSupabaseConnection();
  }, [supabase]);

  // Ao carregar o componente, verifica se o microserviço Python está disponível
  useEffect(() => {
    // Flag para controlar se o componente está montado
    let isMounted = true;
    
    // Lista para controlar timeouts e permitir limpeza adequada
    const timeoutIds: NodeJS.Timeout[] = [];
    
    // Usar localStorage para caching do status do microserviço entre carregamentos
    const cachedStatus = localStorage.getItem('microservice_status');
    const cachedTimestamp = localStorage.getItem('microservice_status_timestamp');
    
    // Se temos um cache recente (menos de 10 minutos), usar como valor inicial
    if (cachedStatus && cachedTimestamp) {
      const timestamp = parseInt(cachedTimestamp, 10);
      const now = Date.now();
      if (now - timestamp < 10 * 60 * 1000) {
        console.log("Usando status em cache para o microserviço:", cachedStatus);
        setMicroserviceStatus(cachedStatus as any);
      }
    }

    const checkMicroserviceAvailability = async () => {
      try {
        const serviceUrl = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';
        console.log("Verificando disponibilidade do microserviço:", serviceUrl);

        // Primeiro verificar se conseguimos até fazer uma requisição
        const healthEndpoint = `${serviceUrl}/health`;
        
        try {
          console.log("Tentando health check com retry automatizado...");
          
          // Usar nossa função de fetch com retry
          const healthResponse = await fetchWithRetry(
            healthEndpoint, 
            { method: 'GET' }, 
            3, // 3 retries 
            7000 // 7 segundos de timeout
          );
          
          // Se o componente não estiver mais montado, ignorar o resultado
          if (!isMounted) return;
          
          if (healthResponse.ok) {
            console.log("Health check do microserviço OK");
            setMicroserviceStatus('available');
            
            // Guardar em localStorage para futuras visitas
            localStorage.setItem('microservice_status', 'available');
            localStorage.setItem('microservice_status_timestamp', Date.now().toString());
            
            return; // Já temos o que precisamos, não precisa verificar api/status
          } else {
            console.warn(`Health check respondeu com status ${healthResponse.status}`);
            // Continuar para verificar endpoint alternativo
          }
        } catch (healthError) {
          // Se o componente não estiver mais montado, ignorar o erro  
          if (!isMounted) return;
          
          console.warn("Health check falhou, tentando rota de status completa:", 
            healthError instanceof Error ? healthError.message : 'Erro desconhecido');
          // Se o health check falhar, prosseguir com a verificação da rota de status
        }
        
        // Tentar endpoint alternativo se o health check falhar
        try {
          console.log("Tentando endpoint alternativo api/status...");
          
          // Usar fetchWithRetry também para o endpoint alternativo
          const statusResponse = await fetchWithRetry(
            `${serviceUrl}/api/status`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.EMAIL_VALIDATION_API_KEY || 'dev_key_change_me_in_production'}`
              }
            },
            2, // 2 retries
            10000 // 10 segundos de timeout (mais longo pois é autenticado)
          );
          
          // Se o componente não estiver mais montado, ignorar o resultado
          if (!isMounted) return;
          
          if (statusResponse.ok) {
            console.log("Status check do microserviço OK");
            setMicroserviceStatus('available');
            
            // Guardar em localStorage para futuras visitas
            localStorage.setItem('microservice_status', 'available');
            localStorage.setItem('microservice_status_timestamp', Date.now().toString());
          } else {
            console.warn("Status check respondeu com erro:", statusResponse.status);
            setMicroserviceStatus('unavailable');
            setMicroserviceErrorDetails(`Serviço respondeu com status ${statusResponse.status}`);
            
            // Guardar em localStorage
            localStorage.setItem('microservice_status', 'unavailable');
            localStorage.setItem('microservice_status_timestamp', Date.now().toString());
            
            // Mostrar toast de alerta apenas se o componente ainda estiver montado
            if (isMounted) {
              toast({
                title: "Microserviço de validação indisponível",
                description: (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p>O microserviço de validação IMAP/SMTP não está respondendo corretamente.</p>
                      <p className="text-sm mt-1">Verifique se o serviço está em execução em <code className="bg-gray-100 px-1 rounded">{serviceUrl}</code></p>
                      <div className="text-sm mt-2 font-medium">Solução:</div>
                      <div className="text-sm">Execute o microserviço usando um dos comandos:</div>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded block mt-1">npm run validator:start</code>
                      <div className="text-xs mt-2">ou no diretório do validador:</div>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded block mt-1">docker-compose up -d</code>
                    </div>
                  </div>
                ),
                duration: 15000,
              });
            }
          }
        } catch (statusError) {
          // Se o componente não estiver mais montado, ignorar o erro
          if (!isMounted) return;
          
          console.error("Erro ao verificar status do microserviço:", 
            statusError instanceof Error ? statusError.message : 'Erro desconhecido');
          
          // Configurar status de erro e notificar o usuário
          setMicroserviceStatus('error');
          
          const errorMessage = statusError instanceof Error ? statusError.message : 'Erro desconhecido';
          setMicroserviceErrorDetails(errorMessage);
          
          // Tentar determinar o tipo específico de erro
          let errorType = 'unknown';
          let errorCategory = 'connection';
          
          if (statusError instanceof Error) {
            if (statusError.name === 'AbortError') {
              errorType = 'timeout';
              errorCategory = 'timeout';
            } else if (statusError.message.includes('fetch') || statusError.message.includes('Failed to fetch')) {
              errorType = 'network';
              errorCategory = 'network';
            }
          }
          
          // Guardar em localStorage
          localStorage.setItem('microservice_status', 'error');
          localStorage.setItem('microservice_status_timestamp', Date.now().toString());
          
          // Mostrar toast de erro apenas se o componente ainda estiver montado
          if (isMounted) {
            toast({
              title: "Microserviço de validação inacessível",
              description: (
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p>Não foi possível conectar ao microserviço de validação IMAP/SMTP.</p>
                    <p className="text-sm mt-1">
                      {errorCategory === 'timeout' ? 
                        'O serviço não respondeu no tempo esperado (timeout).' : 
                        errorCategory === 'network' ?
                        'Parece haver um problema de rede ou o serviço não está em execução.' :
                        'Verifique se o serviço está em execução e sua rede está conectada.'}
                    </p>
                    <p className="text-xs mt-2 text-gray-600">
                      <span className="font-medium">Erro detectado:</span> {errorMessage}
                    </p>
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">URL:</span> {serviceUrl}
                    </p>
                    <div className="mt-3 border-t border-gray-200 pt-2">
                      <p className="text-sm font-medium">Solução:</p>
                      <p className="text-sm">Execute um dos comandos:</p>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded block mt-1">npm run validator:start</code>
                      <p className="text-xs mt-2">ou diretamente:</p>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded block mt-1">cd imap-smtp-validator && docker-compose up -d</code>
                    </div>
                  </div>
                </div>
              ),
              duration: 15000,
            });
          }
        }
      } catch (error) {
        // Se o componente não estiver mais montado, não fazer nada
        if (!isMounted) return;
        
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error("Erro ao verificar disponibilidade do microserviço:", errorMessage);
        
        // Configurar status de erro e guardar detalhes
        setMicroserviceStatus('error');
        setMicroserviceErrorDetails(errorMessage);
        
        // Guardar em localStorage
        localStorage.setItem('microservice_status', 'error');
        localStorage.setItem('microservice_status_timestamp', Date.now().toString());
      }
    };
    
    // Executar verificação imediatamente
    const mainTimeoutId = setTimeout(() => {
      checkMicroserviceAvailability();
    }, 100);  // Pequeno delay para deixar a interface renderizar primeiro
    
    timeoutIds.push(mainTimeoutId);
    
    // Função de cleanup para quando o componente for desmontado
    return () => {
      isMounted = false;
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [toast]);

  // Verificar se estamos em modo de desenvolvimento
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const serviceUrl = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL;
      
      if (!serviceUrl || serviceUrl === 'http://localhost:5000') {
        // Usar versão estável do toast para evitar problemas de referência
        setTimeout(() => {
          toast({
            title: "Ambiente de Desenvolvimento",
            description: (
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p>Utilizando microserviço de validação IMAP/SMTP no endereço padrão.</p>
                  <p className="text-sm mt-1">Configure a variável <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL</code> no arquivo <code className="bg-gray-100 px-1 rounded">.env.local</code> se necessário.</p>
                </div>
              </div>
            ),
            duration: 10000,
          });
        }, 500);
      }
    }
  }, [toast]);

  // Mudar configurações baseado no provedor selecionado
  const onProviderChange = useCallback((value: string) => {
    const provider = commonProviders.find(p => p.value === value);
    
    if (provider) {
      form.setValue('imapHost', provider.imapHost);
      form.setValue('imapPort', provider.imapPort);
      form.setValue('smtpHost', provider.smtpHost);
      form.setValue('smtpPort', provider.smtpPort);
    }
  }, [form]);

  // Testar conexão com a conta de email
  const testConnection = useCallback(async () => {
    try {
      // Verificar se há conexão com o Supabase
      if (supabaseConnected === false) {
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor Supabase. Verifique sua conexão com a internet.",
          variant: "destructive",
        });
        return;
      }

      const isValid = await form.trigger();
      if (!isValid) return;

      const values = form.getValues();
      
      // Verificar formato de senha do Gmail
      if (values.provider === 'gmail') {
        // Remover espaços extras, preservando apenas os espaços entre os 4 blocos
        const cleanedPassword = values.appPassword.trim().replace(/\s+/g, ' ');
        // Verificar padrão de senha do Gmail (4 blocos de 4 caracteres)
        const gmailPasswordPattern = /^[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}$/i;
        
        if (!gmailPasswordPattern.test(cleanedPassword)) {
          toast({
            title: "Formato de senha inválido",
            description: "Para o Gmail, a senha de aplicativo deve estar no formato: xxxx xxxx xxxx xxxx",
            variant: "destructive",
          });
          return;
        }
        
        // Atualizar o campo com a senha formatada corretamente
        form.setValue('appPassword', cleanedPassword);
      }
      
      setIsTestingConnection(true);

      // Preparar senha para Gmail (garantir formato correto)
      let password = values.appPassword;
      
      try {
        // Verificar se o microserviço está disponível
        const serviceUrl = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';
        console.log("Validando com microserviço Python em:", serviceUrl);
        
        // Testar conexão usando o serviço de validação Python
        // Utilizando sistema de cache
        const result = await testEmailConnection(
          {
          email: values.email,
          password: password,
          imapHost: values.imapHost,
          imapPort: values.imapPort,
          smtpHost: values.smtpHost,
          smtpPort: values.smtpPort
          },
          {
            forceRefresh: false, // Usar cache se disponível para testes frequentes
            useCache: true
          }
        );

        // Verificar se o resultado veio do cache
        const fromCache = result.details?.fromCache === true;

        // Verificar se o resultado indica erro com o serviço
        if (!result.success && result.details?.serviceError) {
          toast({
            title: "Serviço de validação indisponível",
            description: (
              <div className="space-y-2">
                <p>O microserviço de validação IMAP/SMTP não está acessível.</p>
                <p className="text-sm">Verifique se o microserviço Python está em execução na URL: <code className="bg-gray-100 px-1 rounded">{serviceUrl}</code></p>
                <p className="text-xs mt-2">Certifique-se de que o Docker está instalado e execute: <code className="bg-gray-100 px-1 rounded">cd imap-smtp-validator && docker-compose up -d</code></p>
              </div>
            ),
            variant: "destructive",
          });
          return;
        }

        if (result.success) {
          toast({
            title: `Conexão bem-sucedida${fromCache ? ' (cache)' : ''}`,
            
            description: (
              <div className="space-y-2">
                <p>{result.message}</p>
                {result.details && (
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      {result.details.imap?.success ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> :
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                      <span>IMAP: {result.details.imap?.message}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.details.smtp?.success ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> :
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                      <span>SMTP: {result.details.smtp?.message}</span>
                    </div>
                    {fromCache && (
                      <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span>Resultado obtido do cache. Para forçar nova validação, recarregue a página.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          });
        } else {
          const detailsContent = result.details ? (
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {result.details.imap?.success ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> :
                  <XCircle className="h-4 w-4 text-red-500" />
                }
                <span>IMAP: {result.details.imap?.message}</span>
              </div>
              <div className="flex items-center gap-2">
                {result.details.smtp?.success ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> :
                  <XCircle className="h-4 w-4 text-red-500" />
                }
                <span>SMTP: {result.details.smtp?.message}</span>
              </div>
              {fromCache && (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Resultado obtido do cache. Para forçar nova validação, recarregue a página.</span>
                </div>
              )}
            </div>
          ) : null;

          toast({
            title: `Erro ao conectar${fromCache ? ' (cache)' : ''}`,
            
            description: (
              <div>
                <p>{result.message || "Não foi possível conectar com os dados fornecidos."}</p>
                {detailsContent}
              </div>
            ),
            variant: "destructive",
          });
        }
      } catch (connectionError: any) {
        console.error('Erro no processo de teste de conexão:', connectionError);
        toast({
          title: "Erro ao testar conexão",
          description: connectionError.message || "Falha ao tentar testar conexão com o servidor de email.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      toast({
        title: "Erro ao conectar",
        description: error.message || "Não foi possível conectar com os dados fornecidos. Verifique as credenciais.",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  }, [form, supabaseConnected, toast]);

  // Enviar o formulário
  const onSubmit = useCallback(async (data: AccountFormValues) => {
    try {
      setIsSubmitting(true);

      // Verificar sessão e obter ID do usuário
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      let userId: string;
      
      if (sessionError || !sessionData.session) {
        // Em desenvolvimento, usar um ID de usuário fixo para testes
        if (process.env.NODE_ENV === 'development') {
          console.warn('Modo de desenvolvimento: usando ID de usuário temporário para teste');
          userId = '00000000-0000-0000-0000-000000000000'; // ID temporário para testes
        } else {
          throw new Error('Erro ao obter informações do usuário: ' + (sessionError?.message || 'Sessão de autenticação ausente!'));
        }
      } else {
        userId = sessionData.session.user.id;
      }

      // 1. Primeiro inserir a conta de email sem a senha
      const { data: accountData, error } = await supabase
        .from('email_accounts')
        .insert({
          email_address: data.email,
          smtp_host: data.smtpHost,
          smtp_port: data.smtpPort,
          imap_host: data.imapHost,
          imap_port: data.imapPort,
          connection_status: 'connected',
          display_name: data.name || data.email,
          provider: data.provider,
          smtp_username: data.email,
          smtp_password: '********',
          imap_username: data.email,
          imap_password: '********',
          user_id: userId
        })
        .select()
        .single();

      if (error) throw error;

      if (!accountData) {
        throw new Error('Erro ao criar conta: dados não retornados');
      }

      // 2. Armazenar credenciais de forma segura usando o Vault
      let credentialResult: string | null = null;
      
      if (process.env.NODE_ENV === 'development') {
        // Em desenvolvimento, simular o armazenamento de credenciais
        console.log('Modo de desenvolvimento: simulando armazenamento de credencial segura');
        credentialResult = 'dev-credential-id';
      } else {
        // Em produção, usar o vault
        credentialResult = await storeSecureCredential({
          userId: userId,
          accountId: accountData.id,
          credentialType: CredentialType.EMAIL_PASSWORD,
          credentialKey: 'app_password',
          value: data.appPassword
        });
      }

      if (!credentialResult) {
        // Rollback: excluir a conta se falhar ao armazenar a credencial
        await supabase
          .from('email_accounts')
          .delete()
          .eq('id', accountData.id);
          
        throw new Error('Erro ao armazenar credenciais de forma segura');
      }

      // 3. Adicionar a conta ao store local
      addAccount({
        id: accountData.id,
        email: accountData.email_address,
        name: accountData.display_name,
        provider: accountData.provider,
        imapHost: accountData.imap_host,
        imapPort: accountData.imap_port,
        smtpHost: accountData.smtp_host,
        smtpPort: accountData.smtp_port,
        username: accountData.email_address,
        isActive: accountData.connection_status === 'connected',
        createdAt: accountData.created_at
      });

      toast({
        title: "Conta adicionada",
        description: "Sua conta de email foi adicionada com sucesso.",
      });

      router.push('/email-accounts');
    } catch (error: any) {
      console.error('Erro ao adicionar conta:', error);
      toast({
        title: "Erro ao adicionar conta",
        description: error.message || "Ocorreu um erro ao adicionar sua conta de email.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [supabase, addAccount, toast, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Conta de Email</CardTitle>
        <CardDescription>
          Conecte uma nova conta de email ao sistema utilizando uma senha de aplicativo.
          <a
            href="https://support.google.com/accounts/answer/185833"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline ml-1"
          >
            Como criar uma senha de aplicativo?
          </a>
        </CardDescription>
      </CardHeader>

      {supabaseConnected === false && (
        <div className="mb-4 px-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro de conectividade</AlertTitle>
            <AlertDescription>
              Não foi possível conectar ao servidor Supabase. Verifique sua conexão com a internet ou
              contate o administrador do sistema. As funções de teste e adição de conta podem não funcionar corretamente.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Alerta para problemas com o microserviço */}
      {microserviceStatus === 'unavailable' && (
        <div className="mb-4 px-6">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Serviço de validação com problemas</AlertTitle>
            <AlertDescription>
              O microserviço de validação IMAP/SMTP está respondendo com erros.
              {microserviceErrorDetails && (
                <div className="text-xs mt-1 text-gray-600">{microserviceErrorDetails}</div>
              )}
              <div className="text-sm mt-2">
                Você pode tentar adicionar a conta, mas o teste de conexão pode falhar.
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {microserviceStatus === 'error' && (
        <div className="mb-4 px-6">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Serviço de validação indisponível</AlertTitle>
            <AlertDescription>
              <p>Não foi possível conectar ao microserviço de validação IMAP/SMTP.</p>
              {microserviceErrorDetails && (
                <div className="text-xs mt-1 text-gray-600">{microserviceErrorDetails}</div>
              )}
              <div className="text-sm mt-2 font-medium">Solução:</div>
              <div className="text-sm">Execute o microserviço usando um dos comandos:</div>
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded block mt-1">npm run validator:start</code>
              <div className="text-xs mt-2">ou no diretório do validador:</div>
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded block mt-1">docker-compose up -d</code>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço de Email</FormLabel>
                    <FormControl>
                      <Input placeholder="seuemail@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Conta (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Pessoal, Trabalho" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provedor de Email</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      onProviderChange(value);
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um provedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {commonProviders.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="appPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Senha de Aplicativo
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="text" 
                      placeholder={form.getValues().provider === 'gmail' ? "xxxx xxxx xxxx xxxx" : "Senha de aplicativo"} 
                      {...field} 
                      onChange={(e) => {
                        // Atualizar o valor
                        field.onChange(e);
                        
                        // Se for Gmail, auto-formatar a senha enquanto o usuário digita
                        if (form.getValues().provider === 'gmail') {
                          const rawValue = e.target.value.replace(/\s/g, '').toLowerCase();
                          
                          // Formatar em grupos de 4 caracteres
                          if (rawValue.length <= 16) {
                            let formatted = '';
                            for (let i = 0; i < rawValue.length; i++) {
                              if (i > 0 && i % 4 === 0) formatted += ' ';
                              formatted += rawValue[i];
                            }
                            
                            // Definir o valor formatado, mas apenas se for diferente
                            // para evitar loop infinito ou posição do cursor errada
                            if (formatted !== e.target.value) {
                              setTimeout(() => field.onChange(formatted), 0);
                            }
                          }
                        }
                      }}
                    />
                  </FormControl>
                  {form.getValues().provider === 'gmail' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Para o Gmail, use o formato exato: 16 letras em 4 grupos separados por espaços (xxxx xxxx xxxx xxxx)
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-medium">Configurações IMAP (Recebimento)</h3>
                
                <FormField
                  control={form.control}
                  name="imapHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host IMAP</FormLabel>
                      <FormControl>
                        <Input placeholder="imap.exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="imapPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porta IMAP</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="space-y-4">
                <h3 className="font-medium">Configurações SMTP (Envio)</h3>
                
                <FormField
                  control={form.control}
                  name="smtpHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host SMTP</FormLabel>
                      <FormControl>
                        <Input placeholder="smtp.exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="smtpPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porta SMTP</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          disabled={isSubmitting || isTestingConnection || connectionCheckLoading}
        >
          Cancelar
        </Button>
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={isSubmitting || isTestingConnection || connectionCheckLoading}
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando
              </>
            ) : (
              'Testar Conexão'
            )}
          </Button>
          <Button 
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting || isTestingConnection || connectionCheckLoading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              'Adicionar Conta'
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};