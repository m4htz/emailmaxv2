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

export const AddAccountForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [connectionCheckLoading, setConnectionCheckLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const { addAccount } = useEmailAccountsStore();

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

  // Estado para controlar disponibilidade do serviço
  const [microserviceStatus, setMicroserviceStatus] = useState<'checking' | 'available' | 'unavailable' | 'error'>('checking');
  const [microserviceErrorDetails, setMicroserviceErrorDetails] = useState<string | null>(null);

  // Ao carregar o componente, verifica se o microserviço Python está disponível
  useEffect(() => {
    // Flag para evitar atualizações de estado após desmontagem do componente
    let isMounted = true;
    // Referência ao controller para poder controlar aborto manual
    let controllerRef: AbortController | null = new AbortController();
    // Armazenar IDs de timeout para limpeza adequada
    const timeoutIds: NodeJS.Timeout[] = [];

    // Status de disponibilidade armazenado em localStorage para manter entre refreshes da página
    // Se em uma checagem anterior já tínhamos confirmado o status do serviço
    const cachedServiceStatus = localStorage.getItem('microservice_status');
    const cachedTimestamp = localStorage.getItem('microservice_status_timestamp');

    // Se temos um status recente (menos de 30 minutos), usamos ele inicialmente
    if (cachedServiceStatus && cachedTimestamp) {
      const timestamp = parseInt(cachedTimestamp, 10);
      const now = Date.now();
      // Cache válido por 30 minutos
      if (now - timestamp < 30 * 60 * 1000) {
        console.log("Usando status em cache para o microserviço:", cachedServiceStatus);
        setMicroserviceStatus(cachedServiceStatus as any);
      }
    }

    // Implementar um sistema de retry para o timeout principal
    let retryCount = 0;
    const MAX_RETRIES = 2;

    // Função para agendar timeout com retries
    const scheduleTimeout = () => {
      const timeoutId = setTimeout(() => {
        if (controllerRef) {
          // Se ainda temos retries disponíveis
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`Timeout atingido, retry ${retryCount}/${MAX_RETRIES}...`);
            // Não abortar na primeira vez, dar mais chances
          } else {
            // Abortar apenas no último retry
            console.log("Todos os retries esgotados, abortando requisição");
            if (controllerRef) {
              controllerRef.abort();
              controllerRef = null;
            }
          }
        }
      }, 15000 + (retryCount * 5000)); // Aumentar timeout a cada retry (15s, 20s, 25s)

      // Guardar referência para limpeza
      timeoutIds.push(timeoutId);
      return timeoutId;
    };

    // Iniciar o primeiro timeout
    const mainTimeoutId = scheduleTimeout();

    // Adicionar à lista para limpeza
    timeoutIds.push(mainTimeoutId);

    const checkMicroserviceAvailability = async () => {
      try {
        if (!controllerRef || !isMounted) return;

        const serviceUrl = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';
        console.log("Verificando disponibilidade do microserviço:", serviceUrl);

        // Primeiro verificar se conseguimos até fazer uma requisição
        const healthEndpoint = `${serviceUrl}/health`;

        // Tentar a rota de health com abordagem que não usa AbortSignal.timeout
        // que pode causar problemas com React
        try {
          // Criando um timeout manual para esta requisição específica
          let healthTimedOut = false;
          const healthTimeoutId = setTimeout(() => {
            healthTimedOut = true;
            // Não usar abort aqui, apenas marcar como expired
          }, 5000); // 5 segundos para health check

          // Adicionar à lista para limpeza
          timeoutIds.push(healthTimeoutId);

          // Executar fetch com signal do controller principal
          const healthResponse = await fetch(healthEndpoint, {
            signal: controllerRef.signal,
            method: 'GET',
            cache: 'no-store' // Evitar cache do navegador
          });

          // Limpar o timeout
          clearTimeout(healthTimeoutId);

          // Verificar se não expirou e componente ainda está montado
          if (!healthTimedOut && isMounted) {
            if (healthResponse.ok) {
              console.log("Health check do microserviço OK");
              // Marcar microserviço como disponível
              setMicroserviceStatus('available');
            } else {
              throw new Error(`Health check respondeu com status ${healthResponse.status}`);
            }
          }
        } catch (healthError) {
          // Verificar se componente ainda está montado
          if (!isMounted) return;

          console.warn("Health check falhou, tentando rota de status completa");
          // Se o health check falhar, prosseguir com a verificação da rota de status
        }

        // Verificação principal de status com autenticação (fallback)
        try {
          // Verificar se o componente ainda está montado e controller disponível
          if (!isMounted || !controllerRef) return;

          // Timeout específico para esta operação
          let statusTimedOut = false;
          const statusTimeoutId = setTimeout(() => {
            statusTimedOut = true;
          }, 5000); // 5 segundos

          // Adicionar à lista para limpeza
          timeoutIds.push(statusTimeoutId);

          const response = await fetch(`${serviceUrl}/api/status`, {
            signal: controllerRef.signal, // Usar referência ao controller
            headers: {
              'Authorization': `Bearer ${process.env.EMAIL_VALIDATION_API_KEY || 'dev_key_change_me_in_production'}`
            },
            cache: 'no-store' // Evitar caching
          });

          // Limpar o timeout específico
          clearTimeout(statusTimeoutId);

          // Verificar se o componente ainda está montado
          if (!isMounted) return;

          if (response.ok) {
            console.log("Microserviço de validação está disponível");
            setMicroserviceStatus('available');
          } else {
            console.warn("Microserviço de validação respondeu com erro:", response.status);
            setMicroserviceStatus('unavailable');
            setMicroserviceErrorDetails(`Serviço respondeu com status ${response.status}`);

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
          // Verificar se componente ainda está montado
          if (!isMounted) return;

          console.error("Erro ao verificar status do microserviço:", statusError);
          // Prosseguir com o mesmo tratamento de erro principal abaixo
          throw statusError; // Repassar o erro para o tratamento geral abaixo
        }
      } catch (error: any) {
        // Verificar se o componente ainda está montado
        if (!isMounted) return;

        // Limpar todos os timeouts registrados
        timeoutIds.forEach(id => clearTimeout(id));

        console.error("Erro ao verificar disponibilidade do microserviço:", error);

        // Determinar tipo de erro para mensagem mais útil
        let errorType = 'unknown';
        let errorMessage = error.message || 'Erro desconhecido';
        let errorCategory = 'connection';

        if (error.name === 'AbortError') {
          errorType = 'timeout';
          errorMessage = 'Timeout ao conectar ao serviço (10 segundos excedidos)';
          errorCategory = 'timeout';
        } else if (error.message && (
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError')
        )) {
          errorType = 'network';
          errorMessage = 'Falha na conexão de rede';
          errorCategory = 'network';
        } else if (error.message && error.message.includes('ECONNREFUSED')) {
          errorType = 'connection_refused';
          errorMessage = 'Conexão recusada (porta inacessível)';
          errorCategory = 'network';
        }

        // Apenas definir estados se o componente estiver montado
        if (isMounted) {
          setMicroserviceStatus('error');
          setMicroserviceErrorDetails(errorMessage);
        }

        const serviceUrl = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';

        // Mostrar toast com instruções claras para o usuário (apenas se componente estiver montado)
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
    };

    // Executar a verificação do microserviço
    checkMicroserviceAvailability();

    // Função de limpeza para quando o componente for desmontado
    return () => {
      // Sinalizar que o componente foi desmontado
      isMounted = false;

      // Limpar todos os timeouts
      timeoutIds.forEach(id => clearTimeout(id));

      // Abortar controller se ainda existir
      if (controllerRef) {
        try {
          controllerRef.abort();
        } catch (err) {
          // Ignorar erros durante a limpeza
          console.warn("Erro ao abortar controller durante desmontagem:", err);
        }
        controllerRef = null;
      }
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