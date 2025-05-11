# Validação IMAP/SMTP para EmailMax

Este documento descreve como configurar e utilizar o microserviço de validação IMAP/SMTP para o sistema EmailMax.

## Visão Geral

O microserviço de validação IMAP/SMTP é um componente independente que fornece validação de conexões de email, permitindo:

- Testar conexões IMAP (para recebimento de emails)
- Testar conexões SMTP (para envio de emails)
- Validar credenciais de email
- Detectar configurações automáticas para provedores comuns
- Fornecer feedback detalhado sobre problemas de conexão

## Requisitos

Para executar o microserviço, você pode escolher entre duas opções:

### Opção 1: Docker
- Docker Desktop instalado
- Docker Compose disponível

### Opção 2: Python (Recomendado para Desenvolvimento)
- Python 3.8+ instalado
- Pip instalado
- Pacotes listados em `requirements.txt`

## Inicialização Rápida

### Novo Script Unificado
```bash
# Usando script unificado para iniciar tudo de uma vez
npm run dev:all

# Usando script unificado com monitoramento automático de arquivos Python
# (reinicia o microserviço automaticamente quando alterações são detectadas)
npm run dev:all:watch
```

### Usando Docker
```bash
# Iniciando o microserviço usando Docker
npm run validator:start

# Iniciando o app Next.js junto com o microserviço
npm run dev:with-validator
```

### Usando Python Diretamente
```bash
# Iniciando o microserviço diretamente com Python
npm run validator:start-python

# Ou, em outro terminal, inicie a aplicação Next.js
npm run dev
```

## Configuração

O microserviço usa as seguintes configurações que podem ser definidas em `.env.local`:

```env
# URL do microserviço (usado pelo frontend)
NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL=http://localhost:5000

# Chave de API para o microserviço
EMAIL_VALIDATION_API_KEY=dev_key_change_me_in_production

# Desabilitar uso de Edge Functions
USE_EDGE_FUNCTIONS=false
```

## Endpoints da API

O microserviço expõe os seguintes endpoints:

- `GET /api/status` - Verifica se o serviço está online
- `POST /api/test-connection` - Testa conexão IMAP/SMTP
- `POST /api/check-server` - Verificação básica de servidor
- `POST /api/verify-email-domain` - Verifica domínio de email

### Testando uma Conexão

Exemplo de requisição para `/api/test-connection`:

```json
{
  "email": "usuario@exemplo.com",
  "password": "senha_ou_senha_app",
  "imapHost": "imap.exemplo.com",
  "imapPort": 993,
  "smtpHost": "smtp.exemplo.com",
  "smtpPort": 587,
  "testImap": true,
  "testSmtp": true,
  "autodetect": true
}
```

Headers necessários:
```
Content-Type: application/json
Authorization: Bearer dev_key_change_me_in_production
```

## Desenvolvimento Rápido

Para agilizar o desenvolvimento, os seguintes atalhos estão disponíveis:

1. **Checklist de teste rápido**
   - Verificar status do serviço: `curl http://localhost:5000/api/status`
   - Testar uma conta Gmail predefinida: `npm run test:gmail`

2. **Autorreinicialização do microserviço**
   - Use o script `npm run validator:watch` que reinicia automaticamente o serviço quando houver mudanças nos arquivos
   - Ou use `npm run dev:all:watch` para iniciar ambos os serviços com monitoramento

## Solução de Problemas

### O Microserviço não Inicia
1. Verifique se o Python 3.8+ está instalado corretamente
2. Verifique se a porta 5000 não está sendo usada por outro aplicativo
3. Execute com modo verboso: `npm run validator:start:debug`

### Problemas com Conexão IMAP/SMTP
1. Verifique se as credenciais estão corretas
2. Para Gmail, use uma "Senha de Aplicativo", não sua senha normal
3. Verifique se o provedor permite acesso IMAP/SMTP (alguns exigem ativação)
4. Verifique firewall ou bloqueios de rede

### Erro ao Testar Conexão
Caso receba erros específicos, consulte o guia rápido:

| Erro | Possível Causa | Solução |
|------|----------------|---------|
| "Authentication failed" | Senha incorreta | Verifique credenciais, gere senha de app |
| "Cannot connect to server" | Problema de rede | Verifique firewalls, portas e DNS |
| "Timeout" | Resposta lenta | Aumente timeout ou tente mais tarde |

## Execução Manual

Se precisar executar o microserviço manualmente:

### Com Python Diretamente (Recomendado)
```bash
cd imap-smtp-validator
pip install -r requirements.txt
python app.py
```

### Com Docker
```bash
cd imap-smtp-validator
docker compose up -d
```

## Usando com Provedores Comuns

### Gmail
1. Habilite "Acesso a app menos seguro" ou use a autenticação de dois fatores
2. Gere uma "Senha de aplicativo" em https://myaccount.google.com/apppasswords
3. Use o formato específico: `xxxx xxxx xxxx xxxx` (16 caracteres em 4 grupos)

### Outlook/Office 365
1. Use seu email completo como nome de usuário
2. Use sua senha normal ou uma senha de app se tiver autenticação de dois fatores

### Yahoo
1. Habilite "Permitir apps que usam login menos seguro"
2. Gere uma senha de aplicativo nas configurações de segurança da conta

## Desenvolvimento

Para modificar o microserviço:

1. Edite os arquivos em `imap-smtp-validator/`
2. Use o modo de autorreinicialização para ver mudanças em tempo real: `npm run validator:watch`
3. Consulte o arquivo `TASKS.md` para ver as próximas melhorias planejadas

---

Para mais detalhes, consulte a documentação na pasta `docs/` ou o arquivo de tarefas `TASKS.md`.