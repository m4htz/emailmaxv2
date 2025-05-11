/**
 * Script unificado para iniciar o Next.js e o microserviço de validação IMAP/SMTP
 * 
 * Este script inicia ambos os componentes simultaneamente e gerencia o ciclo de vida
 * dos processos, simplificando o fluxo de desenvolvimento.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Cores para saída no console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
};

// Diretório do microserviço
const validatorDir = path.join(__dirname, 'imap-smtp-validator');

// Processos em execução
let nextProcess = null;
let validatorProcess = null;

/**
 * Verifica se o Docker está instalado e disponível
 */
function checkDocker() {
  console.log(`${colors.blue}Verificando instalação do Docker...${colors.reset}`);
  
  try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf8' });
    console.log(`${colors.green}✓ Docker detectado:${colors.reset} ${dockerVersion.trim()}`);
    return true;
  } catch (error) {
    console.log(`${colors.yellow}⚠ Docker não encontrado, tentando Python...${colors.reset}`);
    return false;
  }
}

/**
 * Verifica se o Docker Compose está instalado e disponível
 */
function checkDockerCompose() {
  console.log(`${colors.blue}Verificando Docker Compose...${colors.reset}`);
  
  try {
    // Tente primeiro o comando padrão mais recente
    const dockerComposeVersion = execSync('docker compose version', { encoding: 'utf8' });
    console.log(`${colors.green}✓ Docker Compose detectado:${colors.reset} ${dockerComposeVersion.trim()}`);
    return 'docker compose';
  } catch (error) {
    try {
      // Tente o comando legado
      const legacyVersion = execSync('docker-compose --version', { encoding: 'utf8' });
      console.log(`${colors.green}✓ Docker Compose (legado) detectado:${colors.reset} ${legacyVersion.trim()}`);
      return 'docker-compose';
    } catch (err) {
      console.log(`${colors.yellow}⚠ Docker Compose não encontrado, tentando Python...${colors.reset}`);
      return false;
    }
  }
}

/**
 * Verifica se o Python está instalado e disponível
 */
function checkPython() {
  console.log(`${colors.blue}Verificando instalação do Python...${colors.reset}`);
  
  // Comandos para tentar encontrar o Python
  const pythonCommands = ['python', 'python3', 'py'];
  
  for (const cmd of pythonCommands) {
    try {
      const pythonVersion = execSync(`${cmd} --version`, { encoding: 'utf8' });
      console.log(`${colors.green}✓ Python detectado:${colors.reset} ${pythonVersion.trim()}`);
      return cmd;
    } catch (error) {
      // Continuar tentando com o próximo comando
    }
  }
  
  console.error(`${colors.red}✗ Python não encontrado!${colors.reset}`);
  console.log(`
${colors.yellow}Você precisa instalar o Docker ou o Python para iniciar o microserviço de validação.${colors.reset}
Para instalar o Python: https://www.python.org/downloads/
Para instalar o Docker: https://www.docker.com/products/docker-desktop/
`);
  return false;
}

/**
 * Verifica se o pip está instalado e disponível
 */
function checkPip(pythonCommand) {
  console.log(`${colors.blue}Verificando instalação do pip...${colors.reset}`);
  
  try {
    const pipVersion = execSync(`${pythonCommand} -m pip --version`, { encoding: 'utf8' });
    console.log(`${colors.green}✓ Pip detectado:${colors.reset} ${pipVersion.trim()}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Pip não encontrado!${colors.reset}`);
    console.log(`
${colors.yellow}Pip é necessário para instalar as dependências.${colors.reset}
Normalmente é instalado junto com o Python, mas você pode tentar instalá-lo com:
${pythonCommand} -m ensurepip
`);
    return false;
  }
}

/**
 * Verifica se o diretório do microserviço existe
 */
function checkValidatorDir() {
  console.log(`${colors.blue}Verificando diretório do microserviço...${colors.reset}`);
  
  if (fs.existsSync(validatorDir)) {
    const files = fs.readdirSync(validatorDir);
    
    // Verificar se os arquivos essenciais existem
    const essentialFiles = ['app.py', 'requirements.txt'];
    const missingFiles = essentialFiles.filter(file => !files.includes(file));
    
    if (missingFiles.length === 0) {
      console.log(`${colors.green}✓ Diretório do microserviço verificado:${colors.reset} ${validatorDir}`);
      return true;
    } else {
      console.error(`${colors.red}✗ Arquivos essenciais faltando: ${missingFiles.join(', ')}${colors.reset}`);
      return false;
    }
  } else {
    console.error(`${colors.red}✗ Diretório do microserviço não encontrado: ${validatorDir}${colors.reset}`);
    return false;
  }
}

/**
 * Instala as dependências usando pip
 */
function installDependencies(pythonCommand) {
  console.log(`${colors.blue}Instalando dependências do microserviço...${colors.reset}`);
  
  try {
    // Mudar para o diretório do validador
    const currentDir = process.cwd();
    process.chdir(validatorDir);
    
    // Instalar dependências
    execSync(`${pythonCommand} -m pip install -r requirements.txt`, { 
      encoding: 'utf8',
      stdio: 'inherit'
    });
    
    // Voltar para o diretório original
    process.chdir(currentDir);
    
    console.log(`${colors.green}✓ Dependências instaladas com sucesso!${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Erro ao instalar dependências:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * Inicia o microserviço usando Docker Compose
 */
function startValidatorWithDocker(composeCommand) {
  console.log(`${colors.blue}Iniciando microserviço de validação IMAP/SMTP com Docker...${colors.reset}`);
  
  // Caminho para o diretório do microserviço e comando a executar
  const currentDir = process.cwd();
  process.chdir(validatorDir);
  
  const command = composeCommand.split(' ')[0];
  const args = [...composeCommand.split(' ').slice(1), 'up', '-d'];
  
  console.log(`Executando: ${command} ${args.join(' ')}`);
  
  try {
    // Inicia o processo Docker Compose
    execSync(`${composeCommand} up -d`, {
      stdio: 'inherit',
      shell: true
    });
    
    // Voltar para o diretório original
    process.chdir(currentDir);
    
    console.log(`${colors.green}✓ Microserviço iniciado com sucesso via Docker!${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Erro ao iniciar microserviço via Docker:${colors.reset}`, error.message);
    process.chdir(currentDir);
    return false;
  }
}

/**
 * Inicia o microserviço usando Python diretamente
 */
function startValidatorWithPython(pythonCommand) {
  console.log(`${colors.blue}Iniciando microserviço de validação IMAP/SMTP com Python...${colors.reset}`);
  
  // Definir variáveis de ambiente
  const env = {
    ...process.env,
    FLASK_APP: 'app.py',
    API_KEY: 'dev_key_change_me_in_production'
  };
  
  // Comando para iniciar o servidor Flask
  console.log(`Executando: ${pythonCommand} app.py`);
  
  // Inicia o processo Python
  validatorProcess = spawn(pythonCommand, ['app.py'], {
    env,
    stdio: 'pipe',
    shell: true,
    cwd: validatorDir
  });
  
  // Capturar saída do processo
  validatorProcess.stdout.on('data', (data) => {
    console.log(`${colors.cyan}[Validator] ${colors.reset}${data.toString().trim()}`);
  });
  
  validatorProcess.stderr.on('data', (data) => {
    console.error(`${colors.red}[Validator Error] ${colors.reset}${data.toString().trim()}`);
  });
  
  // Manipular eventos do processo
  validatorProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`
${colors.red}✗ O microserviço foi encerrado com código ${code}.${colors.reset}
`);
    }
    validatorProcess = null;
  });
  
  console.log(`${colors.green}✓ Processo do microserviço iniciado!${colors.reset}`);
  
  return true;
}

/**
 * Inicia o servidor Next.js
 */
function startNextJs() {
  console.log(`${colors.blue}Iniciando servidor Next.js...${colors.reset}`);
  
  // Inicia o processo Next.js
  nextProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    shell: true
  });
  
  // Capturar saída do processo
  nextProcess.stdout.on('data', (data) => {
    console.log(`${colors.brightGreen}[Next.js] ${colors.reset}${data.toString().trim()}`);
  });
  
  nextProcess.stderr.on('data', (data) => {
    console.error(`${colors.red}[Next.js Error] ${colors.reset}${data.toString().trim()}`);
  });
  
  // Manipular eventos do processo
  nextProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`
${colors.red}✗ O servidor Next.js foi encerrado com código ${code}.${colors.reset}
`);
    }
    nextProcess = null;
  });
  
  console.log(`${colors.green}✓ Processo do Next.js iniciado!${colors.reset}`);
  
  return true;
}

/**
 * Encerra todos os processos quando o script é encerrado
 */
function setupCleanup() {
  // Interceptar SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Encerrando processos...${colors.reset}`);
    
    // Encerrar processo do validador
    if (validatorProcess) {
      validatorProcess.kill('SIGINT');
    }
    
    // Encerrar processo do Next.js
    if (nextProcess) {
      nextProcess.kill('SIGINT');
    }
    
    // Desligar o Docker se estiver em uso
    if (!validatorProcess && fs.existsSync(validatorDir)) {
      try {
        const currentDir = process.cwd();
        process.chdir(validatorDir);
        console.log(`${colors.yellow}Desligando containers Docker...${colors.reset}`);
        execSync('docker compose down', { stdio: 'inherit' });
        process.chdir(currentDir);
      } catch (error) {
        // Ignorar erros de Docker Compose down
      }
    }

    // Se estiver executando em modo mock
    if (validatorProcess && process.argv.includes('--mock')) {
      console.log(`${colors.yellow}Encerrando serviço mock...${colors.reset}`);
    }
    
    console.log(`${colors.green}Processos encerrados. Até logo!${colors.reset}`);
    process.exit(0);
  });
}

/**
 * Função principal
 */
async function main() {
  console.log(`
${colors.brightCyan}==========================================${colors.reset}
${colors.brightCyan}       EmailMax - Iniciador Unificado    ${colors.reset}
${colors.brightCyan}   Next.js + Microserviço de Validação   ${colors.reset}
${colors.brightCyan}==========================================${colors.reset}
  `);
  
  // Configurar limpeza ao encerrar
  setupCleanup();
  
  // Verificar requisitos do validador
  const validatorDirOk = checkValidatorDir();
  if (!validatorDirOk) {
    console.error(`${colors.red}✗ Não é possível continuar sem o diretório do microserviço.${colors.reset}`);
    return;
  }
  
  // Tentar iniciar o validador com Docker
  let validatorStarted = false;
  const dockerInstalled = checkDocker();
  
  if (dockerInstalled) {
    const composeCommand = checkDockerCompose();
    if (composeCommand) {
      validatorStarted = startValidatorWithDocker(composeCommand);
    }
  }
  
  // Se Docker falhar, tentar com Python
  if (!validatorStarted) {
    const pythonCommand = checkPython();
    if (pythonCommand) {
      const pipInstalled = checkPip(pythonCommand);
      if (pipInstalled) {
        const dependenciesInstalled = installDependencies(pythonCommand);
        if (dependenciesInstalled) {
          validatorStarted = startValidatorWithPython(pythonCommand);
        }
      }
    }
  }
  
  // Se o validador não iniciou, tentar com o modo de mock
  if (!validatorStarted) {
    console.log(`${colors.yellow}⚠ Não foi possível iniciar o microserviço de validação.${colors.reset}`);
    console.log(`${colors.yellow}⚠ Tentando iniciar em modo de simulação (mock)...${colors.reset}`);

    try {
      // Iniciar o serviço mock
      const mockScript = path.join(__dirname, 'start-mock-service.js');
      if (fs.existsSync(mockScript)) {
        validatorProcess = spawn('node', [mockScript], {
          stdio: 'pipe',
          shell: true
        });

        // Capturar saída do processo mock
        validatorProcess.stdout.on('data', (data) => {
          console.log(`${colors.magenta}[Mock Validator] ${colors.reset}${data.toString().trim()}`);
        });

        validatorProcess.stderr.on('data', (data) => {
          console.error(`${colors.red}[Mock Validator Error] ${colors.reset}${data.toString().trim()}`);
        });

        // Manipular eventos do processo mock
        validatorProcess.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            console.error(`${colors.red}✗ O serviço mock foi encerrado com código ${code}.${colors.reset}`);
          }
          validatorProcess = null;
        });

        console.log(`${colors.green}✓ Serviço mock iniciado com sucesso!${colors.reset}`);
        console.log(`${colors.yellow}⚠ MODO DE SIMULAÇÃO: As validações de email serão simuladas.${colors.reset}`);
        validatorStarted = true;
      } else {
        console.error(`${colors.red}✗ Arquivo do serviço mock não encontrado: ${mockScript}${colors.reset}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`${colors.red}✗ Falha ao iniciar serviço mock:${colors.reset}`, error.message);
      process.exit(1);
    }
  }
  
  // Iniciar o servidor Next.js
  startNextJs();
  
  console.log(`
${colors.brightCyan}==========================================${colors.reset}
${colors.green}✓ Ambiente de desenvolvimento iniciado!${colors.reset}

${colors.cyan}Serviços disponíveis:${colors.reset}
- Next.js: ${colors.brightGreen}http://localhost:3000${colors.reset}
- Microserviço de validação: ${colors.brightGreen}http://localhost:5000${colors.reset}

${colors.yellow}Para encerrar:${colors.reset} Pressione Ctrl+C

${colors.brightCyan}==========================================${colors.reset}
  `);
}

// Executar o script
main().catch(error => {
  console.error(`${colors.red}Erro inesperado:${colors.reset}`, error);
  process.exit(1);
});