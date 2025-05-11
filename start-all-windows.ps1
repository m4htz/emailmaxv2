# Script PowerShell para iniciar o ambiente completo do EmailMaxV2

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "       EmailMax - Iniciador Unificado" -ForegroundColor Cyan
Write-Host "   Next.js + Microserviço de Validação" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

# Função para verificar se uma porta está em uso
function Test-PortInUse {
    param(
        [int]$Port
    )
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        return ($null -ne $connections)
    }
    catch {
        return $false
    }
}

# Verificar se as portas necessárias estão disponíveis
$nextPort = 3000
$validatorPort = 5000

if (Test-PortInUse -Port $nextPort) {
    Write-Host "❌ A porta $nextPort já está em uso. O servidor Next.js não poderá iniciar." -ForegroundColor Red
    Write-Host "Encerre o processo que está usando esta porta e tente novamente." -ForegroundColor Yellow
    exit 1
}

if (Test-PortInUse -Port $validatorPort) {
    Write-Host "❌ A porta $validatorPort já está em uso." -ForegroundColor Red
    Write-Host "Será necessário liberar esta porta ou usar o modo mock." -ForegroundColor Yellow
    
    $useMock = Read-Host -Prompt "Deseja continuar com o modo de simulação (mock)? (S/N)"
    if ($useMock -ne "S" -and $useMock -ne "s") {
        Write-Host "Operação cancelada pelo usuário." -ForegroundColor Yellow
        exit 1
    }
    $mockMode = $true
} else {
    $mockMode = $false
}

# Iniciar o microserviço (real ou mock)
if ($mockMode) {
    Write-Host "`n🔄 Iniciando o microserviço em modo de simulação (mock)..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "start-mock-service.js" -NoNewWindow
    
    # Pequena pausa para permitir que o serviço mock inicie
    Start-Sleep -Seconds 2
    
    Write-Host "✅ Serviço mock iniciado na porta $validatorPort" -ForegroundColor Green
    Write-Host "⚠️ MODO DE SIMULAÇÃO: As validações de email serão simuladas" -ForegroundColor Yellow
} else {
    Write-Host "`n🔄 Iniciando o microserviço de validação IMAP/SMTP..." -ForegroundColor Blue
    
    # Diretório do validador
    $validatorDir = Join-Path $PSScriptRoot "imap-smtp-validator"
    
    # Verificar se o Docker está disponível
    try {
        $dockerVersion = docker --version
        Write-Host "✅ Docker detectado: $dockerVersion" -ForegroundColor Green
        
        # Verificar Docker Compose
        try {
            $composeVersion = docker compose version
            $composeCommand = "docker compose"
        } catch {
            try {
                $legacyVersion = docker-compose --version
                $composeCommand = "docker-compose"
            } catch {
                Write-Host "❌ Docker Compose não encontrado!" -ForegroundColor Red
                Write-Host "Usando modo de simulação como fallback..." -ForegroundColor Yellow
                $mockMode = $true
                goto MockFallback
            }
        }
        
        # Salvar localização atual
        $currentDir = Get-Location
        
        # Iniciar o contêiner Docker
        Set-Location -Path $validatorDir
        Invoke-Expression "$composeCommand down"
        Invoke-Expression "$composeCommand up -d"
        $exitCode = $LASTEXITCODE
        Set-Location -Path $currentDir
        
        if ($exitCode -ne 0) {
            Write-Host "❌ Falha ao iniciar o microserviço via Docker (código $exitCode)" -ForegroundColor Red
            Write-Host "Usando modo de simulação como fallback..." -ForegroundColor Yellow
            $mockMode = $true
            goto MockFallback
        }
        
        Write-Host "✅ Microserviço iniciado com sucesso via Docker na porta $validatorPort" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker não encontrado!" -ForegroundColor Red
        Write-Host "Usando modo de simulação como fallback..." -ForegroundColor Yellow
        $mockMode = $true
        goto MockFallback
    }
}

# Label para o fallback de mock se necessário
:MockFallback
if ($mockMode) {
    Start-Process -FilePath "node" -ArgumentList "start-mock-service.js" -NoNewWindow
    Start-Sleep -Seconds 2
    Write-Host "✅ Serviço mock iniciado na porta $validatorPort" -ForegroundColor Green
    Write-Host "⚠️ MODO DE SIMULAÇÃO: As validações de email serão simuladas" -ForegroundColor Yellow
}

# Iniciar o servidor Next.js
Write-Host "`n🔄 Iniciando o servidor Next.js..." -ForegroundColor Blue
Write-Host "Servidor será disponibilizado em: http://localhost:$nextPort`n" -ForegroundColor Green

# Iniciar Next.js em um novo processo
Start-Process -FilePath "npx" -ArgumentList "next dev" -NoNewWindow

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "✅ Ambiente de desenvolvimento iniciado!" -ForegroundColor Green
Write-Host "`nServiços disponíveis:" -ForegroundColor Cyan
Write-Host "- Next.js: http://localhost:$nextPort" -ForegroundColor Green
Write-Host "- Microserviço de validação: http://localhost:$validatorPort" -ForegroundColor Green
if ($mockMode) {
    Write-Host "  (em modo de simulação)" -ForegroundColor Yellow
}
Write-Host "`nPressione Ctrl+C para encerrar os serviços" -ForegroundColor Yellow
Write-Host "===============================================`n" -ForegroundColor Cyan

# Manter o script em execução até que o usuário pressione Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    # Limpar ao sair
    Write-Host "`n🔄 Encerrando serviços..." -ForegroundColor Yellow
    
    # Encerrar o contêiner Docker se estiver usando
    if (-not $mockMode) {
        $validatorDir = Join-Path $PSScriptRoot "imap-smtp-validator"
        $currentDir = Get-Location
        Set-Location -Path $validatorDir
        Invoke-Expression "$composeCommand down"
        Set-Location -Path $currentDir
    }
    
    # Processo de limpeza adicional se necessário
    Write-Host "✅ Serviços encerrados. Até logo!" -ForegroundColor Green
}