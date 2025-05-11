# Guia de Erros e Diagnóstico IMAP

Este documento fornece informações detalhadas sobre erros comuns do IMAP, suas causas e soluções. É um guia útil para desenvolvedores trabalhando com o microserviço de validação de email EmailMax.

## Introdução

O protocolo IMAP (Internet Message Access Protocol) é utilizado para acessar caixas de email remotamente. Embora seja um protocolo robusto, diversos problemas podem ocorrer durante a conexão, autenticação, e operações com caixas de email.

Este guia documenta os tipos comuns de erros, suas possíveis causas e soluções recomendadas.

## Categorias de Erros IMAP

### 1. Erros de Autenticação

| Erro | Descrição | Causas Comuns | Soluções |
|------|-----------|---------------|----------|
| `AUTHENTICATE failed` | Falha genérica de autenticação | Credenciais incorretas, método de autenticação não suportado | Verificar credenciais, tentar outro método de autenticação |
| `[AUTHENTICATIONFAILED]` | Falha específica de autenticação | Senha incorreta | Verificar senha, verificar se necessita senha de aplicativo |
| `Invalid credentials` | Credenciais inválidas | Email ou senha incorretos | Verificar email e senha |
| `Application-specific password required` | Senha de aplicativo necessária | Conta com 2FA habilitado | Gerar senha de aplicativo nas configurações da conta |
| `Authentication failed` | Falha na autenticação | Múltiplas causas possíveis | Verificar credenciais, verificar configurações de segurança |

### 2. Erros de Conexão

| Erro | Descrição | Causas Comuns | Soluções |
|------|-----------|---------------|----------|
| `Connection refused` | Servidor recusou conexão | Servidor offline, porta incorreta, firewall | Verificar host e porta, verificar firewall |
| `[UNAVAILABLE]` | Servidor temporariamente indisponível | Manutenção do servidor, sobrecarga | Tentar novamente mais tarde |
| `socket error` | Erro de socket | Problemas de rede, timeout | Verificar conexão de internet, verificar firewall |
| `Connection timed out` | Tempo limite excedido | Servidor lento ou não respondendo | Aumentar timeout, verificar conexão |
| `Too many simultaneous connections` | Muitas conexões | Limite de conexões do servidor atingido | Reduzir número de conexões, fechar conexões não utilizadas |

### 3. Erros SSL/TLS

| Erro | Descrição | Causas Comuns | Soluções |
|------|-----------|---------------|----------|
| `SSL_ERROR_SSL` | Erro genérico SSL | Problema na negociação SSL | Verificar configuração SSL |
| `certificate verify failed` | Falha na verificação do certificado | Certificado auto-assinado, expirado | Usar verificação de certificado correta |
| `STARTTLS` | Erro na inicialização STARTTLS | STARTTLS não suportado | Usar SSL direto (porta 993) |
| `[INSECURE]` | Conexão insegura | Servidor requer conexão segura | Usar SSL/TLS |

### 4. Erros Específicos de Provedores

#### Gmail

| Erro | Descrição | Soluções |
|------|-----------|----------|
| `Application-specific password required` | Gmail exige senha de app | Gerar senha de app em https://myaccount.google.com/apppasswords |
| `Web login required` | Login via navegador necessário | Fazer login no navegador primeiro para confirmar identidade |
| `Account disabled` | Conta desativada por segurança | Verificar notificações de segurança na conta Google |

#### Outlook/Office 365

| Erro | Descrição | Soluções |
|------|-----------|----------|
| `SYS/TEMP_FAIL` | Falha temporária do servidor | Tentar novamente mais tarde |
| `LIMIT/MAX_CONN` | Limite de conexões atingido | Reduzir número de conexões |
| `[THROTTLED]` | Throttling aplicado | Reduzir frequência de requisições |

#### Yahoo

| Erro | Descrição | Soluções |
|------|-----------|----------|
| `LOGIN failed` | Falha no login | Verificar configurações de "apps menos seguros" |
| `[UNAVAILABLE]` | Serviço indisponível | Tentar novamente mais tarde |

## Dicas de Solução de Problemas

### Verificações Básicas

1. **Credenciais**: Verifique se o email e senha estão corretos
2. **Configuração de Servidor**: Confirme host e porta corretos
3. **Rede**: Verifique se não há bloqueios de firewall ou rede

### Gmail

- É necessário ativar a verificação em duas etapas
- Use uma senha de aplicativo específica para IMAP
- O formato correto é: `xxxx xxxx xxxx xxxx` (16 caracteres em 4 grupos)

### Outlook/Office 365

- Use seu endereço de email completo como nome de usuário
- Se MFA estiver ativo, use uma senha de aplicativo
- Algumas contas corporativas têm IMAP desabilitado por política

### Yahoo

- Habilite "Permitir apps que usam login menos seguro"
- Use senha de aplicativo se tiver verificação em duas etapas

## Exemplos de Uso da API de Diagnóstico

### Diagnóstico IMAP Avançado

Endpoint: `POST /api/imap-diagnostic`

Requisição:
```json
{
  "email": "usuario@gmail.com",
  "password": "senha_aplicativo",
  "imapHost": "imap.gmail.com",
  "imapPort": 993,
  "testType": "all"
}
```

Este endpoint fornece:
- Diagnóstico detalhado de erros
- Soluções recomendadas
- Suporte específico para Gmail, Outlook e Yahoo
- Informações de tempo de resposta e capabilities do servidor

### Verificação de Capabilities

Endpoint: `POST /api/imap-server-capabilities`

Requisição:
```json
{
  "host": "imap.gmail.com",
  "port": 993
}
```

Este endpoint verifica recursos suportados pelo servidor sem autenticação:
- Suporte a IDLE (para push email)
- Mecanismos SASL suportados
- Outros recursos relevantes do servidor

## Referências

- [RFC 3501 - IMAP Protocol](https://tools.ietf.org/html/rfc3501)
- [Google Workspace IMAP Settings](https://support.google.com/mail/answer/7126229)
- [Microsoft 365 IMAP Settings](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353)
- [Yahoo Mail IMAP Settings](https://help.yahoo.com/kb/SLN4075.html)