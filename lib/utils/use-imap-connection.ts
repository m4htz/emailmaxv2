import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getSecureCredential, CredentialType } from '@/lib/utils/secure-storage';

// Configuração do microserviço Python de validação IMAP/SMTP
const VALIDATION_SERVICE_URL = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';
const API_KEY = process.env.EMAIL_VALIDATION_API_KEY || 'dev_key_change_me_in_production';

interface UseImapConnectionOptions {
  accountId: string;
  debug?: boolean;
}

interface ImapConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  lastChecked: Date | null;
  mailboxes: string[];
}

interface ImapConnectionResult {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  state: ImapConnectionState;
}

/**
 * Hook para gerenciar conexões IMAP
 * Permite conectar, desconectar e verificar status da conexão
 */
export const useImapConnection = (options: UseImapConnectionOptions): ImapConnectionResult => {
  const { accountId, debug = false } = options;
  const supabase = createClient();
  
  const [state, setState] = useState<ImapConnectionState>({
    isConnecting: false,
    isConnected: false,
    error: null,
    lastChecked: null,
    mailboxes: []
  });

  // Função para conectar ao servidor IMAP
  const connect = async (): Promise<boolean> => {
    try {
      if (state.isConnecting) {
        return false; // Evitar múltiplas conexões simultâneas
      }
      
      setState(prev => ({ ...prev, isConnecting: true, error: null }));
      
      // Primeiro, obter dados da conta
      const { data: account, error: accountError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('id', accountId)
        .single();
      
      if (accountError || !account) {
        console.error('Erro ao obter dados da conta:', accountError);
        setState(prev => ({ 
          ...prev, 
          isConnecting: false, 
          error: 'Conta de email não encontrada' 
        }));
        return false;
      }
      
      if (debug) {
        console.log('Dados da conta recuperados:', {
          email: account.email_address,
          imapHost: account.imap_host,
          imapPort: account.imap_port
        });
      }
      
      // Recuperar credenciais
      let password: string;
      try {
        password = await getSecureCredential(
          account.user_id,
          accountId,
          CredentialType.EMAIL_PASSWORD
        );
      } catch (credError) {
        console.error('Erro ao obter credenciais:', credError);
        setState(prev => ({ 
          ...prev, 
          isConnecting: false, 
          error: 'Erro ao recuperar credenciais. Tente reconectar sua conta.' 
        }));
        return false;
      }
      
      if (!password) {
        setState(prev => ({ 
          ...prev, 
          isConnecting: false, 
          error: 'Credenciais não encontradas. Configure a conta novamente.' 
        }));
        return false;
      }
      
      // Se for Gmail, verificar se a senha parece ser uma senha de aplicativo
      if (account.imap_host.includes('gmail') && password.length < 16) {
        console.warn('Aviso: A senha do Gmail pode não ser uma senha de aplicativo válida');
      }
      
      // Testar conexão IMAP usando o microserviço Python
      let attempt = 0;
      const MAX_ATTEMPTS = 3; // Total de tentativas (inicial + 2 retries)
      let lastError = '';

      while (attempt < MAX_ATTEMPTS) {
        try {
          const currentAttempt = attempt + 1;
          console.log(`Tentativa ${currentAttempt}/${MAX_ATTEMPTS} de conexão IMAP para ${account.email_address}`);
          
          // Verificar se o serviço está disponível antes de fazer a chamada principal
          try {
            const healthCheck = await fetch(`${VALIDATION_SERVICE_URL}/health`, {
              method: 'GET',
              signal: AbortSignal.timeout(2000)
            }).catch(() => null);

            if (!healthCheck || !healthCheck.ok) {
              throw new Error("Serviço de validação indisponível");
            }
          } catch (healthError) {
            console.error(`Erro no health check (tentativa ${currentAttempt}/${MAX_ATTEMPTS}):`, healthError);
            lastError = "O serviço de validação IMAP não está acessível no momento. Verifique se o microserviço está em execução.";

            // Incrementar o contador de tentativas
            attempt++;

            // Verificar se já esgotamos todas as tentativas
            if (attempt >= MAX_ATTEMPTS) {
              console.error(`Máximo de tentativas (${MAX_ATTEMPTS}) atingido. Desistindo da conexão.`);
              break;
            }

            // Esperar antes de tentar novamente (backoff exponencial)
            const backoffTime = Math.min(1500 * Math.pow(2, attempt - 1), 8000); // Limite máximo de 8 segundos
            console.log(`Aguardando ${backoffTime}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }

          // Se o health check passar, tenta a conexão IMAP real
          const response = await fetch(`${VALIDATION_SERVICE_URL}/api/test-connection`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
              email: account.email_address,
              password,
              imapHost: account.imap_host,
              imapPort: account.imap_port,
              testImap: true,
              testSmtp: false,
              autodetect: false,
              retry: attempt > 0  // Sinalizando que é uma tentativa de retry
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erro no microserviço (tentativa ${currentAttempt}/${MAX_ATTEMPTS}):`, errorText);
            lastError = `Erro ao chamar serviço de validação: ${response.status} ${errorText}`;

            // Incrementar o contador de tentativas
            attempt++;

            // Verificar se já esgotamos todas as tentativas
            if (attempt >= MAX_ATTEMPTS) {
              console.error(`Máximo de tentativas (${MAX_ATTEMPTS}) atingido. Desistindo da conexão.`);
              break;
            }

            // Esperar antes de tentar novamente (backoff exponencial)
            const backoffTime = Math.min(1500 * Math.pow(2, attempt - 1), 8000); // Limite máximo de 8 segundos
            console.log(`Aguardando ${backoffTime}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
          
          const data = await response.json();
          
          if (!data || !data.success) {
            console.error(`Falha na conexão IMAP (tentativa ${currentAttempt}/${MAX_ATTEMPTS}):`, data?.message);
            lastError = data?.message || 'Erro ao conectar ao servidor IMAP';

            // Incrementar o contador de tentativas
            attempt++;

            // Verificar se já esgotamos todas as tentativas
            if (attempt >= MAX_ATTEMPTS) {
              console.error(`Máximo de tentativas (${MAX_ATTEMPTS}) atingido. Desistindo da conexão.`);
              break;
            }

            // Esperar antes de tentar novamente (backoff exponencial)
            const backoffTime = Math.min(1500 * Math.pow(2, attempt - 1), 8000); // Limite máximo de 8 segundos
            console.log(`Aguardando ${backoffTime}ms antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
          
          // Se chegou aqui, conexão bem-sucedida
          // Lista de caixas de email (mailboxes) se disponível
          const mailboxes = data.details?.imap?.mailboxes || [];
          
          // Atualizar status da conta no banco de dados
          await supabase
            .from('email_accounts')
            .update({
              status: 'connected',
              last_checked: new Date().toISOString(),
              error_message: null
            })
            .eq('id', accountId);
          
          setState(prev => ({ 
            ...prev, 
            isConnecting: false, 
            isConnected: true, 
            error: null,
            lastChecked: new Date(),
            mailboxes
          }));
          
          return true;
        } catch (e) {
          console.error(`Exceção na tentativa ${retryCount + 1} de conexão IMAP:`, e);
          lastError = e.message || 'Erro desconhecido ao conectar IMAP';
          retryCount++;
          
          // Esperar antes de tentar novamente
          if (retryCount <= MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
          }
        }
      }
      
      // Se chegou aqui, todas as tentativas falharam
      console.error(`Falha após ${MAX_ATTEMPTS} tentativas de conexão IMAP`);

      // Armazenar o erro na conta
      await supabase
        .from('email_accounts')
        .update({
          status: 'error',
          error_message: lastError,
          last_checked: new Date().toISOString(),
          retry_count: MAX_ATTEMPTS
        })
        .eq('id', accountId);
      
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isConnected: false,
        error: lastError || 'Falha na conexão IMAP após múltiplas tentativas'
      }));
      
      return false;
    } catch (error: any) {
      console.error('Erro ao conectar IMAP:', error);
      
      // Atualizar status da conta com o erro
      try {
        await supabase
          .from('email_accounts')
          .update({
            status: 'error',
            error_message: error.message || 'Erro desconhecido',
            last_checked: new Date().toISOString()
          })
          .eq('id', accountId);
      } catch (dbError) {
        console.error('Erro ao atualizar status da conta:', dbError);
      }
      
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error.message || 'Erro desconhecido ao conectar IMAP' 
      }));
      return false;
    }
  };
  
  // Função para desconectar do servidor IMAP
  const disconnect = async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isConnected: false, mailboxes: [] }));
      return true;
    } catch (error: any) {
      console.error('Erro ao desconectar IMAP:', error);
      return false;
    }
  };

  // Verificar status inicial da conexão ao montar o componente
  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        const { data: account } = await supabase
          .from('email_accounts')
          .select('status, last_checked')
          .eq('id', accountId)
          .single();
          
        if (account && account.status === 'connected') {
          setState(prev => ({ 
            ...prev, 
            isConnected: true,
            lastChecked: account.last_checked ? new Date(account.last_checked) : null
          }));
        }
      } catch (error) {
        console.error('Erro ao verificar status da conexão IMAP:', error);
      }
    };
    
    checkConnectionStatus();
    
    // Limpar conexão ao desmontar
    return () => {
      disconnect();
    };
  }, [accountId]);
  
  return {
    connect,
    disconnect,
    state
  };
}; 