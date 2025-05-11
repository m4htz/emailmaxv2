# Script PowerShell para iniciar o microserviço de validação IMAP/SMTP

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "  Iniciador do Microserviço de Validação" -ForegroundColor Cyan
Write-Host "           IMAP/SMTP - EmailMax" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

# Verificar Docker
Write-Host "Verificando instalação do Docker..." -NoNewline
try {
    $dockerVersion = docker --version
    Write-Host "`n✓ Docker detectado: " -ForegroundColor Green -NoNewline
    Write-Host "$dockerVersion"
}
catch {
    Write-Host "`n✗ Docker não encontrado!" -ForegroundColor Red
    Write-Host "`nVocê precisa instalar o Docker para executar o microserviço de validação." -ForegroundColor Yellow
    Write-Host "Visite https://www.docker.com/products/docker-desktop/ para baixar e instalar."
    exit
}

# Verificar Docker Compose
Write-Host "Verificando Docker Compose..." -NoNewline
try {
    $composeVersion = docker compose version
    Write-Host "`n✓ Docker Compose detectado: " -ForegroundColor Green -NoNewline
    Write-Host "$composeVersion"
    $composeCommand = "docker compose"
}
catch {
    try {
        $legacyVersion = docker-compose --version
        Write-Host "`n✓ Docker Compose (legado) detectado: " -ForegroundColor Green -NoNewline
        Write-Host "$legacyVersion"
        $composeCommand = "docker-compose"
    }
    catch {
        Write-Host "`n✗ Docker Compose não encontrado!" -ForegroundColor Red
        Write-Host "`nDocker Compose é necessário e normalmente vem instalado com o Docker Desktop." -ForegroundColor Yellow
        Write-Host "Se você instalou o Docker sem o Compose, consulte a documentação para instalar o Compose."
        exit
    }
}

# Verificar diretório do microserviço
$validatorDir = Join-Path $PSScriptRoot "imap-smtp-validator"
Write-Host "Verificando diretório do microserviço..." -NoNewline
if (Test-Path $validatorDir) {
    $files = Get-ChildItem -Path $validatorDir -File | Select-Object -ExpandProperty Name
    $essentialFiles = @("app.py", "docker-compose.yml", "Dockerfile", "requirements.txt")
    $missingFiles = $essentialFiles | Where-Object { $files -notcontains $_ }
    
    if ($missingFiles.Count -eq 0) {
        Write-Host "`n✓ Diretório do microserviço verificado: " -ForegroundColor Green -NoNewline
        Write-Host "$validatorDir"
    }
    else {
        Write-Host "`n✗ Arquivos essenciais faltando: $($missingFiles -join ', ')" -ForegroundColor Red
        exit
    }
}
else {
    Write-Host "`n✗ Diretório do microserviço não encontrado: $validatorDir" -ForegroundColor Red
    exit
}

# Iniciar o microserviço
Write-Host "`nIniciando microserviço de validação IMAP/SMTP..." -ForegroundColor Blue
Write-Host "Executando: $composeCommand up -d em $validatorDir`n"

# Salvar localização atual
$currentDir = Get-Location

# Navegar para o diretório do validador
Set-Location -Path $validatorDir

# Executar o comando
if ($composeCommand -eq "docker compose") {
    docker compose up -d
}
else {
    docker-compose up -d
}

# Verificar o resultado
$exitCode = $LASTEXITCODE
Set-Location -Path $currentDir

if ($exitCode -eq 0) {
    Write-Host "`n✓ Microserviço iniciado com sucesso!" -ForegroundColor Green
    Write-Host "`nInformações:" -ForegroundColor Cyan
    Write-Host "- Serviço disponível em: " -NoNewline
    Write-Host "http://localhost:5000" -ForegroundColor Green
    Write-Host "- API Key padrão: " -NoNewline
    Write-Host "dev_key_change_me_in_production" -ForegroundColor Yellow
    Write-Host "- Endpoints principais:"
    Write-Host "  * " -NoNewline
    Write-Host "GET" -ForegroundColor Cyan -NoNewline
    Write-Host "  /api/status - Verifica status do serviço"
    Write-Host "  * " -NoNewline
    Write-Host "POST" -ForegroundColor Cyan -NoNewline
    Write-Host " /api/test-connection - Testa conexão IMAP/SMTP"
    
    Write-Host "`nPara parar o serviço:" -ForegroundColor Yellow
    Write-Host "cd $validatorDir; $composeCommand down"
    
    Write-Host "`nO serviço agora está pronto para validar conexões de email!" -ForegroundColor Blue
}
else {
    Write-Host "`n✗ Falha ao iniciar o microserviço (código $exitCode)." -ForegroundColor Red
    Write-Host "`nVerifique se:"
    Write-Host "1. As portas necessárias estão disponíveis (5000)"
    Write-Host "2. Você tem permissões suficientes para executar containers Docker"
    Write-Host "3. Não há outros erros nos logs acima"
    
    Write-Host "`nTente executar os seguintes comandos em sequência:" -ForegroundColor Yellow
    Write-Host "cd $validatorDir"
    Write-Host "$composeCommand build"
    Write-Host "$composeCommand up"
}

# Pausa para que o usuário possa ver os resultados
Write-Host "`nPressione qualquer tecla para sair..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")