import { createClient } from '@/lib/supabase/client';
import { getSecureCredential, CredentialType } from '@/lib/utils/secure-storage';
import { validationCache } from '@/lib/utils/validation-cache';

// Configuração do microserviço Python de validação IMAP/SMTP
const VALIDATION_SERVICE_URL = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';
const API_KEY = process.env.EMAIL_VALIDATION_API_KEY || 'dev_key_change_me_in_production';
const USE_CACHE = process.env.NEXT_PUBLIC_USE_VALIDATION_CACHE !== 'false'; // Habilitado por padrão

export interface EmailCredentials {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  details?: {
    imap?: {
      success: boolean;
      message?: string;
    },
    smtp?: {
      success: boolean;
      message?: string;
    },
    // Campos adicionais para detalhamento de erros e sinalizações
    error?: string;
    provider?: string;
    description?: string;
    connectionType?: string;
    serviceError?: boolean;
    netError?: boolean;
    microserviceUrl?: string;
    rawResponse?: string;
    // Campos específicos para cache
    fromCache?: boolean;
    cachedAt?: number;
    expiresAt?: number;
    age?: number; // Idade do cache em milissegundos
    [key: string]: any; // Para permitir propriedades adicionais flexíveis
  };
}

/**
 * Testa a conexão com uma conta de email usando o microserviço Python de validação IMAP/SMTP.
 * Suporta cache de resultados para melhorar performance e reduzir chamadas redundantes.
 * @param credentials Credenciais para testar a conexão
 * @param options Opções adicionais para o teste
 * @returns Resultado do teste de conexão
 */
export async function testEmailConnection(
  credentials: EmailCredentials,
  options: {
    forceRefresh?: boolean, // Força a validação mesmo se existir cache
    useCache?: boolean // Habilita ou desabilita o cache para esta chamada específica
  } = {}
): Promise<TestConnectionResult> {
  if (!credentials) {
    return {
      success: false,
      message: 'Credenciais não fornecidas',
      details: { error: 'missing_credentials' }
    };
  }

  // Determinar se o cache deve ser utilizado
  const useCache = options.useCache !== undefined ? options.useCache : USE_CACHE;
  const forceRefresh = options.forceRefresh === true;

  try {
    // Criar chave para o cache baseada nas credenciais
    const cacheKey = {
      email: credentials.email,
      imapHost: credentials.imapHost,
      imapPort: credentials.imapPort,
      smtpHost: credentials.smtpHost,
      smtpPort: credentials.smtpPort
    };

    // Verificar se temos resultado em cache e se podemos usá-lo
    if (useCache && !forceRefresh && validationCache.has(cacheKey)) {
      console.log("Usando resultado de validação em cache para:", credentials.email);
      const cachedResult = validationCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    console.log("Iniciando teste de conexão com credenciais:", {
      email: credentials.email,
      imapHost: credentials.imapHost,
      imapPort: credentials.imapPort,
      smtpHost: credentials.smtpHost,
      smtpPort: credentials.smtpPort
    });

    // Se for Gmail, verificar formato da senha no cliente antes de enviar ao servidor
    if (credentials.imapHost === 'imap.gmail.com') {
      const cleanPassword = credentials.password.trim().replace(/\s+/g, ' ');
      const gmailPattern = /^[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}$/i;

      if (!gmailPattern.test(cleanPassword)) {
        console.warn("Formato de senha do Gmail incorreto:", cleanPassword);
        return {
          success: false,
          message: 'Formato de senha de aplicativo do Gmail inválido. O formato correto é: xxxx xxxx xxxx xxxx',
          details: {
            error: 'Formato de senha inválido',
            provider: 'gmail'
          }
        };
      }
    }

    try {
      console.log("Chamando microserviço de validação IMAP/SMTP:", VALIDATION_SERVICE_URL);

      // Verificar se o microserviço está configurado corretamente
      if (!VALIDATION_SERVICE_URL) {
        throw new Error('URL do microserviço de validação não configurada');
      }

      // Verificar se o microserviço está disponível com um timeout maior
      let fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), 15000); // Aumentado o timeout para 15 segundos para ambiente com alta latência

      // Primeiro, verificar se o microserviço está no ar com um health check rápido
      try {
        console.log(`Verificando disponibilidade do serviço de validação em ${VALIDATION_SERVICE_URL}`);

        // Tentativa #1: Health check básico com retry automático
        let healthCheckResponse = null;
        let attemptCount = 0;
        const maxAttempts = 2;

        while (attemptCount < maxAttempts && (!healthCheckResponse || !healthCheckResponse.ok)) {
          attemptCount++;

          try {
            // Tentar realizar um health check rápido primeiro (com timeout maior)
            healthCheckResponse = await fetch(`${VALIDATION_SERVICE_URL}/health`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(5000), // Timeout aumentado para 5 segundos
              cache: 'no-store' // Evitar caching do navegador
            });

            if (healthCheckResponse.ok) {
              console.log(`Health check bem-sucedido na tentativa ${attemptCount}`);
              break;
            } else {
              console.warn(`Health check falhou na tentativa ${attemptCount} com status ${healthCheckResponse.status}`);
              // Continuar para próxima tentativa ou alternativa
            }
          } catch (retryError) {
            console.warn(`Health check falhou na tentativa ${attemptCount}:`, retryError.message || retryError);
            // Pequena pausa entre tentativas
            if (attemptCount < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        // Se o health check falhou após todas as tentativas, tentar endpoint alternativo
        if (!healthCheckResponse || !healthCheckResponse.ok) {
          const status = healthCheckResponse ? healthCheckResponse.status : 'sem resposta';
          console.warn(`Microserviço de validação não respondeu ao health check após ${maxAttempts} tentativas (${status})`);

          // Tentativa #2: Endpoint de status alternativo
          try {
            console.log("Tentando endpoint alternativo /api/status...");
            const statusResponse = await fetch(`${VALIDATION_SERVICE_URL}/api/status`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
              },
              signal: AbortSignal.timeout(5000), // Timeout de 5 segundos para alternativa
              cache: 'no-store'
            });

            if (!statusResponse.ok) {
              throw new Error(`Endpoint alternativo retornou status ${statusResponse.status}`);
            } else {
              console.log("Endpoint de status respondeu corretamente, continuando mesmo sem health check");
            }
          } catch (statusError) {
            // Se ambos os endpoints falharem, tentar uma última alternativa antes de desistir
            try {
              console.log("Tentando acesso direto sem autenticação como última tentativa...");
              const baseResponse = await fetch(`${VALIDATION_SERVICE_URL}/`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
                cache: 'no-store'
              });

              // Se conseguirmos pelo menos alguma resposta do servidor, tentamos continuar
              if (baseResponse.status >= 200) {
                console.log("Servidor respondeu no endpoint base, continuando mesmo com health check falho");
              } else {
                throw new Error(`Servidor não respondeu adequadamente (${baseResponse.status})`);
              }
            } catch (baseError) {
              // Nenhuma das tentativas funcionou
              throw new Error(`Microserviço de validação IMAP/SMTP não está acessível após múltiplas tentativas`);
            }
          }
        } else {
          console.log("Health check bem-sucedido, continuando com a validação");
        }
      } catch (healthError: any) {
        // Se todas as verificações de disponibilidade falharem, retornar um erro específico
        clearTimeout(timeoutId);

        console.error("Erro ao verificar disponibilidade do serviço:", healthError.message || healthError);

        // Determinar tipo de erro para mensagem mais útil
        let errorType = 'service_unavailable';
        let errorMsg = "O serviço de validação IMAP/SMTP não está disponível no momento";

        // Análise detalhada do tipo de erro para melhor diagnóstico
        if (healthError.name === 'AbortError') {
          errorType = 'timeout';
          errorMsg = "Timeout ao conectar ao serviço de validação (15 segundos excedidos)";
        } else if (healthError.message && (
          healthError.message.includes('fetch') ||
          healthError.message.includes('Failed to fetch')
        )) {
          errorType = 'network_error';
          errorMsg = "Erro de rede ao tentar conectar ao serviço de validação";
        } else if (healthError.message && healthError.message.includes('ECONNREFUSED')) {
          errorType = 'connection_refused';
          errorMsg = "Conexão recusada ao serviço de validação (porta inacessível)";
        }

        // Gerar um objeto de erro detalhado com instruções claras
        return {
          success: false,
          message: errorMsg,
          details: {
            error: errorType,
            netError: true,
            serviceError: true,
            connectionType: 'error',
            microserviceUrl: VALIDATION_SERVICE_URL,
            errorMessage: healthError.message || "Serviço indisponível",
            statusCode: healthError.status || 'unknown',
            errorName: healthError.name || 'GenericError',
            errorStack: process.env.NODE_ENV === 'development' ? healthError.stack : undefined,
            lastAttempt: new Date().toISOString(),
            resolution: "Verifique se o serviço de validação está em execução corretamente",
            solutions: [
              "Execute o comando 'npm run validator:start' na raiz do projeto",
              "Ou 'cd imap-smtp-validator && docker-compose up -d' para iniciar o Docker",
              "Verifique se a porta 5000 está disponível e não bloqueada por firewall",
              "Certifique-se que o Docker está instalado e em execução (se estiver usando Docker)"
            ],
            developerInfo: process.env.NODE_ENV === 'development' ? {
              envVar: VALIDATION_SERVICE_URL ? 'NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL definida' : 'NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL não definida',
              defaultUrl: 'http://localhost:5000',
              cacheEnabled: USE_CACHE ? 'Cache habilitado' : 'Cache desabilitado'
            } : undefined
          }
        };
      }

      try {
        console.log("Enviando requisição de teste de conexão IMAP/SMTP...");

        // Tentar com timeout e retry automático
        let response = null;
        let attemptCount = 0;
        const maxAttempts = 2;

        while (attemptCount < maxAttempts && (!response || !response.ok)) {
          attemptCount++;

          try {
            console.log(`Tentativa ${attemptCount}/${maxAttempts} de teste de conexão...`);

            // Criar um controller separado para cada tentativa
            const attemptController = new AbortController();
            const attemptTimeoutId = setTimeout(() => attemptController.abort(), 12000);

            response = await fetch(`${VALIDATION_SERVICE_URL}/api/test-connection`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'X-Request-ID': `test-${Date.now()}-${Math.floor(Math.random() * 1000)}` // ID único para diagnóstico
              },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
                imapHost: credentials.imapHost,
                imapPort: credentials.imapPort,
                smtpHost: credentials.smtpHost,
                smtpPort: credentials.smtpPort,
                testImap: true,
                testSmtp: true,
                autodetect: true,
                timeout: 10000 // 10 segundos para timeout da conexão no servidor
              }),
              signal: attemptController.signal,
              cache: 'no-store' // Evitar cache
            });

            clearTimeout(attemptTimeoutId);

            if (response.ok) {
              console.log(`Requisição de teste bem-sucedida na tentativa ${attemptCount}`);
              break;
            } else {
              console.warn(`Requisição falhou na tentativa ${attemptCount} com status ${response.status}`);
              // Se for um erro 500 ou maior, tentar de novo
              if (response.status >= 500 && attemptCount < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo entre tentativas
                continue;
              }
              // Se não for servidor (4xx), não tenta novamente
              break;
            }
          } catch (retryError) {
            console.warn(`Erro na tentativa ${attemptCount}:`, retryError.message || retryError);
            // Pequena pausa entre tentativas
            if (attemptCount < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        clearTimeout(timeoutId);

        if (!response || !response.ok) {
          const status = response ? response.status : 'sem resposta';
          let errorText = 'Erro desconhecido';

          try {
            if (response) {
              errorText = await response.text();
            }
          } catch (textError) {
            console.error("Não foi possível ler resposta de erro:", textError);
          }

          console.error(`Erro na chamada do microserviço (${status}):`, errorText);

          return {
            success: false,
            message: `Falha na conexão com o serviço de validação: ${errorText || 'Erro desconhecido'}`,
            details: {
              error: errorText,
              statusCode: status,
              connectionType: 'error',
              attempts: attemptCount,
              microserviceUrl: VALIDATION_SERVICE_URL,
              timestamp: new Date().toISOString(),
              resolution: "Verifique se o microserviço está em execução e funcionando corretamente"
            }
          };
        }

        let data;
        try {
          // Tentar obter a resposta JSON
          const responseText = await response.text();

          // Verificar se a resposta está vazia ou não é JSON válido
          if (!responseText.trim()) {
            throw new Error("Resposta vazia do serviço");
          }

          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            // Log detalhado da resposta inválida para debug
            console.error("Resposta inválida do serviço (não é JSON válido):", responseText.substring(0, 500));
            throw new Error(`Falha ao parsear JSON: ${parseError.message}`);
          }
        } catch (jsonError) {
          console.error("Erro ao processar resposta JSON:", jsonError);

          // Tentar recuperar algum texto da resposta para diagnóstico
          let rawResponse = '';
          try {
            if (response && response.body) {
              // Se já consumimos o body acima no response.text(), não podemos ler de novo
              // Neste caso, usamos o que temos no erro
              if (jsonError instanceof Error && jsonError.message.includes('responseText')) {
                const match = jsonError.message.match(/responseText: "([^"]*)"/);
                if (match && match[1]) {
                  rawResponse = match[1];
                }
              }
            }
          } catch (bodyError) {
            console.error("Erro ao tentar ler corpo da resposta:", bodyError);
          }

          return {
            success: false,
            message: 'Resposta inválida do serviço de validação',
            details: {
              error: 'invalid_json_response',
              connectionType: 'error',
              rawResponse: rawResponse || 'Não foi possível recuperar a resposta original',
              errorMessage: jsonError instanceof Error ? jsonError.message : String(jsonError),
              timestamp: new Date().toISOString(),
              microserviceUrl: VALIDATION_SERVICE_URL,
              resolution: "Verifique se o microserviço está retornando respostas válidas"
            }
          };
        }

        // Formatar a resposta para o cliente
        const result: TestConnectionResult = {
          success: data.success,
          message: data.message,
          details: {
            ...data.details,
            connectionType: 'real'  // Indicar que este é um teste real
          }
        };

        console.log("Resultado do teste de conexão via microserviço:", result);

        // Registrar o resultado no banco de dados Supabase (para histórico)
        try {
          const supabase = createClient();
          await supabase.from('validation_logs').insert({
            account_id: null, // Será preenchido posteriormente se a conta for salva
            success: result.success,
            message: result.message,
            service: 'microservice'
          });
        } catch (logError) {
          console.error("Erro ao registrar log de validação:", logError);
          // Não impede o fluxo principal se o log falhar
        }

        // Armazenar resultado no cache se estiver habilitado
        if (useCache) {
          validationCache.set(cacheKey, result);
        }

        return result;

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error("Erro durante a requisição fetch:", fetchError);

        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout de 15 segundos ao tentar conectar ao serviço de validação');
        }

        // Redirecionar outros erros para o tratamento genérico de serviço
        throw fetchError;
      }

    } catch (serviceError: any) {
      console.error("Erro ao chamar microserviço de validação:", serviceError);

      // Tratar erros de rede específicos com análise detalhada
      let errorMessage = 'Não foi possível conectar ao serviço de validação de email.';
      let errorType = 'service_error';
      let errorCategory = 'generic';

      // Criar objeto de detalhes do erro com diagnóstico detalhado
      let errorDetails: TestConnectionResult['details'] = {
        error: serviceError.message || 'Erro na conexão com o serviço de validação',
        connectionType: 'error',
        serviceError: true,
        microserviceUrl: VALIDATION_SERVICE_URL,
        timestamp: new Date().toISOString(),
        errorName: serviceError.name || 'Error',
        errorStack: process.env.NODE_ENV === 'development' ? serviceError.stack : undefined
      };

      // Analisar detalhadamente o tipo de erro para mensagens específicas
      if (serviceError.name === 'AbortError' || serviceError.message?.includes('timeout')) {
        errorType = 'timeout';
        errorCategory = 'timeout';
        errorMessage = 'Timeout ao tentar conectar ao serviço de validação IMAP/SMTP.';
        errorDetails.resolution = "O serviço não respondeu no tempo esperado (15 segundos).";
      } else if (serviceError.message && (
        serviceError.message.includes('Failed to fetch') ||
        serviceError.message.includes('NetworkError') ||
        serviceError.message.includes('Network request failed')
      )) {
        errorType = 'network_error';
        errorCategory = 'network';
        errorMessage = 'O microserviço de validação IMAP/SMTP não está acessível.';
        errorDetails.resolution = "Verifique se o microserviço está em execução.";
        errorDetails.netError = true;
      } else if (serviceError.message && serviceError.message.includes('ECONNREFUSED')) {
        errorType = 'connection_refused';
        errorCategory = 'network';
        errorMessage = 'Conexão recusada ao tentar acessar o microserviço IMAP/SMTP.';
        errorDetails.resolution = "Verifique se a porta 5000 está disponível e se o serviço está em execução.";
        errorDetails.netError = true;
      } else if (serviceError.response) {
        // Erro com resposta HTTP
        errorType = `http_${serviceError.response.status || 'error'}`;
        errorCategory = 'http';
        errorMessage = `O serviço respondeu com status ${serviceError.response.status}: ${serviceError.message}`;
      }

      // Adicionar informações adicionais ao objeto de erro
      errorDetails.errorType = errorType;
      errorDetails.errorCategory = errorCategory;
      errorDetails.solutions = [
        "Execute 'npm run validator:start' na raiz do projeto",
        "Ou inicie o Docker com 'docker-compose up -d' no diretório imap-smtp-validator",
        "Verifique se a configuração NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL está correta",
        "Certifique-se que a porta 5000 (padrão) não está sendo usada por outro processo"
      ];

      // Criar objeto de resultado de erro formatado
      const errorResult = {
        success: false,
        message: errorMessage,
        details: errorDetails
      };

      // Não armazenamos erros de serviço no cache, pois podem ser temporários
      return errorResult;
    }
  } catch (error: any) {
    console.error("Erro geral no teste de conexão:", error);

    // Criar objeto de erro genérico mas com detalhes úteis
    return {
      success: false,
      message: `Erro ao testar conexão: ${error.message || 'Erro desconhecido'}`,
      details: {
        error: error.message || 'Erro desconhecido',
        errorName: error.name || 'Error',
        errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        errorType: 'general_error',
        timestamp: new Date().toISOString(),
        serviceUrl: VALIDATION_SERVICE_URL,
        resolution: "Ocorreu um erro inesperado. Verifique o console para mais informações.",
        suggestions: [
          "Reinicie o serviço de validação",
          "Verifique os logs do serviço para identificar problemas"
        ]
      }
    };
  }
}

/**
 * Testa a conexão com uma conta de email usando credenciais armazenadas no Vault
 * @param userId ID do usuário para autorização
 * @param accountId ID da conta de email
 * @param options Opções adicionais para o teste
 * @returns Resultado do teste de conexão
 */
export async function testEmailConnectionWithStoredCredentials(
  userId: string,
  accountId: string,
  options: {
    forceRefresh?: boolean, // Força a validação mesmo se existir cache
    useCache?: boolean // Habilita ou desabilita o cache para esta chamada específica
  } = {}
): Promise<TestConnectionResult> {
  if (!userId || !accountId) {
    return {
      success: false,
      message: 'Parâmetros de usuário ou conta ausentes',
      details: { error: 'missing_parameters' }
    };
  }

  try {
    const supabase = createClient();

    // 1. Obter os dados da conta
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single();

    if (accountError || !account) {
      throw new Error('Conta de email não encontrada ou acesso negado');
    }

    // 2. Obter as credenciais armazenadas no vault
    const password = await getSecureCredential(
      userId,
      accountId,
      CredentialType.EMAIL_PASSWORD
    );

    if (!password) {
      throw new Error('Credenciais não encontradas');
    }

    // 3. Testar a conexão usando as credenciais recuperadas com suporte a cache
    const result = await testEmailConnection(
      {
        email: account.email_address,
        password,
        imapHost: account.imap_host,
        imapPort: account.imap_port,
        smtpHost: account.smtp_host,
        smtpPort: account.smtp_port
      },
      options
    );

    // 4. Registrar o resultado no banco de dados apenas se for um teste real (não cache)
    if (!result.details?.fromCache) {
      try {
        await supabase.from('validation_logs').insert({
          account_id: accountId,
          success: result.success,
          message: result.message,
          service: 'microservice'
        });
      } catch (logError) {
        console.error("Erro ao registrar log de validação:", logError);
        // Não impede o fluxo principal se o log falhar
      }
    }

    return result;
  } catch (error: any) {
    console.error('Erro ao testar conexão com credenciais armazenadas:', error);
    return {
      success: false,
      message: error.message || 'Erro ao acessar credenciais armazenadas'
    };
  }
} 