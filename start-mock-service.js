/**
 * Script para simular o microserviço de validação IMAP/SMTP quando Docker ou Python não estão disponíveis
 * 
 * Este script cria um servidor HTTP básico que responde às chamadas da aplicação principal
 * retornando respostas mockadas, permitindo o desenvolvimento sem o microserviço real.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Cores para saída no console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
};

// Configurações do servidor
const PORT = process.env.PORT || 5000;
const HOST = 'localhost';
const API_KEY = process.env.API_KEY || 'dev_key_change_me_in_production';

// Armazenamento de credenciais testadas (para simular cache)
const testedCredentials = {};

// Respostas mockadas
const mockResponses = {
  // Resposta padrão para teste de conexão bem-sucedido
  successConnectionTest: {
    success: true,
    message: 'Conexão IMAP e SMTP estabelecida com sucesso',
    details: {
      imap: {
        success: true,
        message: 'Conexão IMAP bem-sucedida',
        mailboxes: ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam']
      },
      smtp: {
        success: true,
        message: 'Conexão SMTP bem-sucedida'
      },
      connectionType: 'mock',
      provider: 'generic'
    }
  },
  
  // Resposta para teste de conexão com falha
  failedConnectionTest: {
    success: false,
    message: 'Falha ao conectar aos servidores IMAP/SMTP',
    details: {
      imap: {
        success: false,
        message: 'Falha na autenticação IMAP'
      },
      smtp: {
        success: false,
        message: 'Falha na autenticação SMTP'
      },
      connectionType: 'mock',
      error: 'authentication_failed'
    }
  },
  
  // Resposta para erro de validação (formato de credenciais inválido)
  validationError: {
    success: false,
    message: 'Credenciais inválidas',
    details: {
      error: 'validation_error',
      connectionType: 'mock'
    }
  }
};

// Endpoints conhecidos
const ENDPOINTS = {
  TEST_CONNECTION: '/api/test-connection',
  HEALTH_CHECK: '/health'
};

/**
 * Função para registrar log com timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
  const prefix = `${colors.cyan}[${timestamp}]${colors.reset}`;
  
  switch (type) {
    case 'error':
      console.error(`${prefix} ${colors.red}ERROR:${colors.reset} ${message}`);
      break;
    case 'success':
      console.log(`${prefix} ${colors.green}SUCCESS:${colors.reset} ${message}`);
      break;
    case 'warning':
      console.log(`${prefix} ${colors.yellow}WARNING:${colors.reset} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

/**
 * Processa a requisição de teste de conexão
 */
function handleTestConnection(requestBody) {
  // Verificar se tem todas as informações necessárias
  if (!requestBody.email || !requestBody.password || 
      !requestBody.imapHost || !requestBody.smtpHost) {
    return mockResponses.validationError;
  }
  
  // Verificar se já testamos estas credenciais antes
  const credKey = `${requestBody.email}:${requestBody.imapHost}:${requestBody.imapPort}`;
  
  if (testedCredentials[credKey]) {
    log(`Usando resposta em cache para ${requestBody.email}`, 'info');
    return testedCredentials[credKey];
  }
  
  // Simulação: Emails que terminam com "fail@test.com" sempre falham
  let response;
  if (requestBody.email.endsWith('fail@test.com')) {
    response = mockResponses.failedConnectionTest;
  } 
  // Simulação: Gmail verifica formato da senha
  else if (requestBody.imapHost.includes('gmail.com')) {
    // Verificar formato da senha do Gmail (xxxx xxxx xxxx xxxx)
    const gmailPattern = /^[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}$/i;
    if (!gmailPattern.test(requestBody.password)) {
      response = {
        success: false,
        message: 'Formato de senha de aplicativo do Gmail inválido',
        details: {
          error: 'invalid_app_password_format',
          provider: 'gmail',
          connectionType: 'mock'
        }
      };
    } else {
      response = mockResponses.successConnectionTest;
      response.details.provider = 'gmail';
    }
  } 
  // Comportamento padrão: 80% de chance de sucesso
  else {
    response = Math.random() < 0.8 
      ? mockResponses.successConnectionTest 
      : mockResponses.failedConnectionTest;
  }
  
  // Armazenar a resposta para uso futuro
  testedCredentials[credKey] = response;
  
  // Adicionar detalhes específicos
  response.details.email = requestBody.email;
  response.details.imapHost = requestBody.imapHost;
  response.details.smtpHost = requestBody.smtpHost;
  
  return response;
}

/**
 * Cria o servidor HTTP
 */
const server = http.createServer((req, res) => {
  // Adicionar CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Lidar com requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Health Check - endpoint simples para verificar se o serviço está online
  if (req.url === ENDPOINTS.HEALTH_CHECK && req.method === 'GET') {
    log(`Health check recebido`, 'info');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Serviço mock de validação IMAP/SMTP operacional',
      mode: 'mock',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Verificar se é a rota de teste de conexão
  if (req.url === ENDPOINTS.TEST_CONNECTION && req.method === 'POST') {
    // Verificar API Key
    const authHeader = req.headers.authorization || '';
    const providedKey = authHeader.replace('Bearer ', '');

    if (providedKey !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized', message: 'API Key inválida' }));
      log(`Tentativa de acesso não autorizado - API Key inválida`, 'error');
      return;
    }
    
    // Processar dados da requisição
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const requestBody = JSON.parse(body);
        log(`Requisição recebida para testar ${requestBody.email}`, 'info');
        
        // Adicionar atraso artificial para simular processamento (200-800ms)
        const delay = Math.floor(Math.random() * 600) + 200;
        
        setTimeout(() => {
          // Processar o teste de conexão
          const result = handleTestConnection(requestBody);
          
          if (result.success) {
            log(`Teste bem-sucedido para ${requestBody.email}`, 'success');
          } else {
            log(`Teste falhou para ${requestBody.email}: ${result.message}`, 'warning');
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }, delay);
        
      } catch (error) {
        log(`Erro ao processar requisição: ${error.message}`, 'error');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'invalid_request',
          message: 'Formato de requisição inválido' 
        }));
      }
    });
  } else {
    // Rota não encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'not_found',
      message: 'Endpoint não encontrado' 
    }));
    log(`Tentativa de acesso a endpoint não suportado: ${req.url}`, 'warning');
  }
});

// Iniciar o servidor
server.listen(PORT, HOST, () => {
  console.log(`
${colors.brightCyan}==========================================${colors.reset}
${colors.brightCyan}     MOCK - Serviço de Validação IMAP    ${colors.reset}
${colors.brightCyan}==========================================${colors.reset}

${colors.green}Servidor mock iniciado em:${colors.reset} http://${HOST}:${PORT}
${colors.yellow}MODO DE SIMULAÇÃO${colors.reset}: Todas as validações são simuladas

${colors.blue}Endpoints disponíveis:${colors.reset}
- POST ${ENDPOINTS.TEST_CONNECTION} - Simula validação de contas de email

${colors.yellow}Nota:${colors.reset} Este é um servidor de simulação para desenvolvimento
quando Docker ou Python não estão disponíveis. As respostas são mockadas.

${colors.brightCyan}==========================================${colors.reset}
  `);
});

// Tratamento de erros e encerramento
process.on('SIGINT', () => {
  log('Servidor mock sendo encerrado...', 'info');
  server.close(() => {
    log('Servidor mock encerrado com sucesso', 'success');
    process.exit(0);
  });
});

server.on('error', (error) => {
  log(`Erro no servidor: ${error.message}`, 'error');
  
  // Verificar se o erro é por causa da porta já estar em uso
  if (error.code === 'EADDRINUSE') {
    log(`A porta ${PORT} já está em uso. Isto pode significar que:`, 'error');
    log(`1. O serviço real de validação já está rodando`, 'error');
    log(`2. Outra aplicação está usando a porta ${PORT}`, 'error');
    log(`Tente encerrar o processo existente ou alterar a porta`, 'error');
  }
  
  process.exit(1);
});