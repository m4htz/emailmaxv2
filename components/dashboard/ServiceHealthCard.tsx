"use client"

import React, { useState, useEffect } from 'react';
import { 
  ServerCrash, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Loader2, 
  Search,
  MailCheck, 
  GanttChartSquare,
  InfoIcon,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Cpu
} from 'lucide-react';
import { Card } from '@/components/ui/card';

// URL do microserviço
const VALIDATION_SERVICE_URL = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';

// URLs para os endpoints proxy internos (para evitar problemas de CORS)
const PROXY_HEALTH_ENDPOINT = '/api/validator/health';
const PROXY_PROVIDERS_ENDPOINT = '/api/validator/check-email-providers';

// URLs de fallback para mock em caso de falha do microserviço
const MOCK_HEALTH_ENDPOINT = '/api/validator/mock-status';
const MOCK_PROVIDERS_ENDPOINT = '/api/validator/mock-providers';

// Intervalo de atualização em milissegundos (30 segundos)
const REFRESH_INTERVAL = 30000;

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface HealthCheckResult {
  status: HealthStatus;
  version?: string;
  uptime?: {
    uptime_formatted: string;
    start_time: string;
  };
  resources?: {
    cpu: {
      percent: number;
    };
    memory: {
      percent: number;
    };
    disk: {
      percent: number;
    };
  };
  connectivity?: {
    overall_success: boolean;
    targets: Record<string, {
      success: boolean;
      message: string;
      response_time_ms?: number;
    }>;
  };
  response_time_ms?: number;
  providers?: Record<string, {
    imap: {
      success: boolean;
      message: string;
      response_time_ms?: number;
    };
    smtp: {
      success: boolean;
      message: string;
      response_time_ms?: number;
    };
  }>;
  error?: string;
  last_checked?: Date;
}

const ServiceHealthCard: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthCheckResult>({ 
    status: 'unknown',
    last_checked: new Date()
  });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para executar uma requisição com retries
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 2, retryDelayMs = 1000) => {
    let lastError: Error | null = null;

    // Função auxiliar para detectar erros de CORS
    const isCORSError = (err: any): boolean => {
      // Diferentes mensagens de erro de CORS em diferentes navegadores
      const corsErrorMessages = [
        'NetworkError',
        'Network request failed',
        'Failed to fetch',
        'CORS policy',
        'Access-Control-Allow-Origin',
        'Cross-Origin Request Blocked',
        'has been blocked by CORS policy'
      ];

      return (
        err.name === 'TypeError' &&
        corsErrorMessages.some(msg => err.message.includes(msg))
      );
    };

    // Função para determinar se devemos tentar novamente com base no tipo de erro
    const shouldRetry = (err: any): boolean => {
      // Se for um erro de CORS, não vale a pena tentar novamente
      if (isCORSError(err)) {
        return false;
      }

      // Se for um erro de timeout (AbortError), pode valer a pena tentar novamente
      if (err.name === 'AbortError') {
        return true;
      }

      // Para outros erros de rede, vale a pena tentar novamente
      return true;
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Aguardar um tempo antes de tentar novamente (exceto na primeira tentativa)
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }

        const response = await fetch(url, options);

        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (err: any) {
        lastError = err;

        // Melhorar a mensagem de erro para diferentes tipos de problemas
        if (isCORSError(err)) {
          // Se o URL for absoluto e externo, provavelmente é CORS
          const isExternalUrl = url.startsWith('http');

          if (isExternalUrl) {
            // Sugerir usar o proxy
            throw new Error(
              'Erro de CORS: O navegador bloqueou o acesso direto ao serviço. ' +
              'Use os endpoints proxy internos (/api/validator/...) em vez de acessar diretamente o microserviço.'
            );
          } else {
            // Se estamos usando o proxy e ainda temos erro, pode ser problema de configuração
            throw new Error(
              'Erro ao acessar o serviço. Verifique se o microserviço está em execução e acessível pelo servidor Next.js.'
            );
          }
        }

        // Determinar se devemos tentar novamente
        if (!shouldRetry(err) || attempt === maxRetries) {
          throw lastError;
        }

        // Registrar tentativa e razão
        const retryMessage = `Tentativa ${attempt + 1}/${maxRetries + 1} falhou: ${err.message}. ${shouldRetry(err) ? 'Tentando novamente...' : 'Não tentará novamente.'}`;
        console.warn(retryMessage);
      }
    }

    // Nunca deve chegar aqui, mas TypeScript precisa de um retorno
    throw lastError || new Error('Erro desconhecido durante tentativas de requisição');
  };

  // Função para verificar a saúde do microserviço
  const checkServiceHealth = async () => {
    try {
      setLoading(true);
      setError(null);

      // Configuração comum para as requisições
      const requestOptions = {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // Timeout de 5 segundos
        mode: 'cors' as RequestMode,
        credentials: 'omit' as RequestCredentials,
      };

      // Verificação de saúde básica com retry (usando endpoint proxy)
      let healthData;
      try {
        try {
          // Tentar o endpoint real do proxy
          healthData = await fetchWithRetry(
            `${PROXY_HEALTH_ENDPOINT}?detailed=true`,
            {
              method: 'GET',
              ...requestOptions
            }
          );
        } catch (realProxyError) {
          console.warn('Endpoint real indisponível, usando mock:', realProxyError);
          // Tentar fallback para o mock em caso de erro
          healthData = await fetchWithRetry(
            MOCK_HEALTH_ENDPOINT,
            {
              method: 'GET',
              ...requestOptions
            }
          );
        }
      } catch (healthErr: any) {
        console.error('Falha ao verificar saúde básica (real e mock):', healthErr);
        // Continuar com um objeto healthData básico em caso de falha
        healthData = {
          status: 'unhealthy',
          error: healthErr.message,
          isMock: true
        };
        throw healthErr; // Propagar erro para ser capturado pelo try/catch principal
      }

      // Verificação de provedores de email com retry (usando endpoint proxy)
      let providersData = {};
      try {
        let providersResult;
        try {
          // Tentar o endpoint real do proxy
          providersResult = await fetchWithRetry(
            PROXY_PROVIDERS_ENDPOINT,
            {
              method: 'GET',
              ...requestOptions
              // Não precisamos enviar o token de autenticação aqui, o proxy cuidará disso
            }
          );
        } catch (realProxyError) {
          console.warn('Endpoint real de provedores indisponível, usando mock:', realProxyError);
          // Tentar fallback para o mock em caso de erro
          providersResult = await fetchWithRetry(
            MOCK_PROVIDERS_ENDPOINT,
            {
              method: 'GET',
              ...requestOptions
            }
          );
        }
        providersData = providersResult.providers || {};
      } catch (providersErr) {
        console.warn('Falha ao verificar provedores de email (real e mock):', providersErr);
        // Não interromper o fluxo em caso de falha apenas na verificação de provedores
      }

      // Consolidar resultados
      setHealthData({
        ...healthData,
        providers: providersData,
        last_checked: new Date()
      });

    } catch (err: any) {
      console.error('Erro ao verificar saúde do microserviço:', err);

      // Tratamento específico para diferentes tipos de erros
      let errorMessage = 'Erro desconhecido ao verificar a saúde do serviço';

      if (err.name === 'AbortError') {
        errorMessage = 'A requisição excedeu o tempo limite. O serviço pode estar lento ou indisponível.';
      } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        errorMessage = 'Não foi possível conectar ao serviço. Verifique se o microserviço está em execução.';
      } else if (err.name === 'TypeError' && err.message.includes('NetworkError')) {
        errorMessage = 'Erro de CORS: O navegador bloqueou o acesso ao serviço. Verifique a configuração do servidor.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setHealthData({
        status: 'unhealthy',
        error: errorMessage,
        last_checked: new Date()
      });
    } finally {
      setLoading(false);
    }
  };

  // Efeito para verificar a saúde inicialmente e configurar o intervalo
  useEffect(() => {
    checkServiceHealth();

    // Configurar intervalo de atualização
    const interval = setInterval(checkServiceHealth, REFRESH_INTERVAL);

    // Limpar intervalo ao desmontar
    return () => clearInterval(interval);
  }, []);

  // Formatação do horário da última verificação
  const getLastCheckedFormatted = () => {
    if (!healthData.last_checked) return 'Nunca';
    
    const now = new Date();
    const lastChecked = new Date(healthData.last_checked);
    const diffSeconds = Math.floor((now.getTime() - lastChecked.getTime()) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds} segundos atrás`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutos atrás`;
    return `${Math.floor(diffSeconds / 3600)} horas atrás`;
  };

  // Determinar ícone com base no status
  const getStatusIcon = () => {
    switch (healthData.status) {
      case 'healthy':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <ServerCrash className="h-5 w-5 text-red-500" />;
      default:
        return loading 
          ? <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          : <InfoIcon className="h-5 w-5 text-slate-500" />;
    }
  };

  // Determinar a cor de fundo com base no status
  const getStatusColor = () => {
    switch (healthData.status) {
      case 'healthy':
        return 'bg-green-50 border-green-100';
      case 'degraded':
        return 'bg-yellow-50 border-yellow-100';
      case 'unhealthy':
        return 'bg-red-50 border-red-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  };

  // Determinar a mensagem de status
  const getStatusMessage = () => {
    switch (healthData.status) {
      case 'healthy':
        return 'O serviço está operando normalmente';
      case 'degraded':
        return 'O serviço está operando com limitações';
      case 'unhealthy':
        return healthData.error || 'O serviço está indisponível';
      default:
        return 'Verificando status do serviço...';
    }
  };

  return (
    <Card className={`p-4 transition-all duration-200 ${getStatusColor()}`}>
      {/* Cabeçalho do card */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <MailCheck className="h-5 w-5 text-blue-600" />
          <h3 className="font-medium">Validador IMAP/SMTP</h3>
        </div>
        <button 
          onClick={() => checkServiceHealth()} 
          className="p-1 rounded-full hover:bg-blue-100 text-blue-600"
          disabled={loading}
          title="Atualizar status"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Status principal */}
      <div className="flex items-center justify-between mt-3 mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="font-medium">
            {healthData.status === 'healthy' ? 'Online' : 
             healthData.status === 'degraded' ? 'Degradado' : 
             healthData.status === 'unhealthy' ? 'Offline' : 'Desconhecido'}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          Atualizado {getLastCheckedFormatted()}
        </span>
      </div>

      {/* Mensagem de status */}
      <div className={`text-sm mb-3 ${
        healthData.status === 'unhealthy'
          ? 'bg-red-50 border border-red-100 p-2 rounded-md text-red-600'
          : healthData.status === 'degraded'
            ? 'bg-yellow-50 border border-yellow-100 p-2 rounded-md text-yellow-600'
            : 'text-slate-600'
      }`}>
        {getStatusMessage()}

        {/* Mostrar mensagem de erro detalhada quando houver erro */}
        {error && (
          <div className="mt-2 p-2 bg-red-100 rounded-md text-xs text-red-700 font-mono overflow-auto max-h-24">
            {error}
          </div>
        )}

        {/* Exibir sugestão de solução quando estiver offline */}
        {healthData.status === 'unhealthy' && (
          <div className="mt-2 text-xs text-red-700">
            <p className="font-semibold mb-1">Possíveis soluções:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Verifique se o microserviço está em execução</li>
              <li>Execute <code className="bg-red-50 px-1 rounded">npm run validator:start</code></li>
              <li>Verifique se a URL do serviço está correta nas variáveis de ambiente</li>
              <li>Reinicie o servidor de desenvolvimento</li>
            </ul>
          </div>
        )}
      </div>

      {/* Métricas básicas */}
      {(healthData.resources || healthData.uptime) && (
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          {healthData.resources?.cpu && (
            <div className="bg-white rounded-md p-2 shadow-sm border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">CPU</div>
              <div className={`font-medium ${healthData.resources.cpu.percent > 80 ? 'text-red-600' : 'text-slate-700'}`}>
                {healthData.resources.cpu.percent.toFixed(1)}%
              </div>
            </div>
          )}
          {healthData.resources?.memory && (
            <div className="bg-white rounded-md p-2 shadow-sm border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Memória</div>
              <div className={`font-medium ${healthData.resources.memory.percent > 80 ? 'text-red-600' : 'text-slate-700'}`}>
                {healthData.resources.memory.percent.toFixed(1)}%
              </div>
            </div>
          )}
          {healthData.uptime && (
            <div className="bg-white rounded-md p-2 shadow-sm border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Uptime</div>
              <div className="font-medium text-slate-700 text-xs">
                {healthData.uptime.uptime_formatted}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão para expandir/recolher detalhes */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-center p-1 rounded-md text-xs text-slate-500 hover:bg-slate-100 transition-colors"
        >
          {expanded ? (
            <>
              <span>Menos detalhes</span>
              <ChevronUp className="ml-1 h-3 w-3" />
            </>
          ) : (
            <>
              <span>Mais detalhes</span>
              <ChevronDown className="ml-1 h-3 w-3" />
            </>
          )}
        </button>

        {healthData.isMock && (
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
            Simulado
          </span>
        )}
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="mt-3 space-y-4 text-sm animate-slideDown">
          {/* Status dos provedores de email */}
          {healthData.providers && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Status dos Provedores de Email</h4>
              <div className="space-y-1.5">
                {Object.entries(healthData.providers).map(([provider, status]) => (
                  <div key={provider} className="p-2 bg-white rounded-md shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{provider}</span>
                      <div className="flex space-x-2">
                        <span 
                          className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-full ${
                            status.imap.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          IMAP
                        </span>
                        <span 
                          className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-full ${
                            status.smtp.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          SMTP
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conectividade */}
          {healthData.connectivity && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Conectividade Externa</h4>
              <div className="space-y-1.5">
                {Object.entries(healthData.connectivity.targets || {}).map(([host, status]) => (
                  <div key={host} className="flex justify-between items-center text-xs p-2 bg-white rounded-md shadow-sm border border-slate-100">
                    <span>{host}</span>
                    <div className="flex items-center">
                      {status.response_time_ms && (
                        <span className="text-slate-500 mr-2">{status.response_time_ms}ms</span>
                      )}
                      <span className={`w-2 h-2 rounded-full ${status.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link para o painel completo e ações */}
          <div className="pt-2 space-y-2">
            <a
              href="/api/validator/health?detailed=true"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-2 px-4 bg-blue-50 text-blue-700 rounded-md text-xs hover:bg-blue-100 transition-colors"
            >
              <span>Ver Diagnóstico Detalhado</span>
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>

            <button
              onClick={() => {
                window.open('/api/validator/check-email-providers', '_blank');
              }}
              className="flex items-center justify-center w-full py-2 px-4 bg-green-50 text-green-700 rounded-md text-xs hover:bg-green-100 transition-colors"
            >
              <span>Verificar Status de Provedores</span>
              <GanttChartSquare className="ml-1 h-3 w-3" />
            </button>

            {/* Botão de reiniciar serviço (apenas visual, pois requer implementação no backend) */}
            <button
              onClick={() => {
                // No futuro, implementar chamada para reiniciar o serviço
                alert('Funcionalidade de reinício de serviço ainda não implementada.');
              }}
              className="flex items-center justify-center w-full py-2 px-4 bg-slate-50 text-slate-700 rounded-md text-xs hover:bg-slate-100 transition-colors"
            >
              <span>Reiniciar Serviço</span>
              <RefreshCw className="ml-1 h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ServiceHealthCard;