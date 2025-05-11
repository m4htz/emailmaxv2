#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo de diagnóstico avançado para erros IMAP

Este módulo fornece ferramentas para diagnóstico detalhado de erros IMAP,
oferecendo mensagens mais amigáveis e soluções específicas para cada tipo de erro.
"""

import re
import logging
import imaplib
import socket
import ssl

# Configurar logger
logger = logging.getLogger('emailmax-validator.imap-diagnostic')

# Catálogo de erros IMAP comuns por provedor
GMAIL_ERRORS = {
    "AUTHENTICATE failed": {
        "causa": "Falha na autenticação com o Gmail",
        "solucao": [
            "Verifique se a 'Verificação em duas etapas' está ativada e se você está usando uma senha de aplicativo",
            "Verifique se a opção 'Permitir aplicativos menos seguros' está ativada (se aplicável)",
            "Confirme que o email e senha estão corretos"
        ]
    },
    "Invalid credentials": {
        "causa": "Credenciais inválidas para o Gmail",
        "solucao": [
            "Para contas com autenticação de dois fatores: use uma senha de aplicativo",
            "Verifique se o formato da senha de app é correto (16 caracteres em grupos de 4)",
            "Tente gerar uma nova senha de aplicativo"
        ]
    },
    "Application-specific password required": {
        "causa": "Senha de aplicativo necessária para o Gmail",
        "solucao": [
            "Acesse sua conta Google > Segurança > Senhas de app > Gere uma nova senha",
            "Use o formato exato fornecido pelo Google (xxxx xxxx xxxx xxxx)",
            "Para mais informações: https://support.google.com/accounts/answer/185833"
        ]
    },
    "Web login required": {
        "causa": "Login via navegador necessário para o Gmail",
        "solucao": [
            "Faça login através de um navegador para confirmar a identidade",
            "Verifique se há alguma notificação de segurança pendente na sua conta Google",
            "Após o login no navegador, espere alguns minutos e tente novamente"
        ]
    },
    "Too many simultaneous connections": {
        "causa": "Muitas conexões simultâneas ao Gmail",
        "solucao": [
            "Feche outras aplicações que possam estar usando IMAP com esta conta",
            "Espere alguns minutos antes de tentar novamente",
            "O Gmail limita a 15 conexões IMAP simultâneas por conta"
        ]
    }
}

OUTLOOK_ERRORS = {
    "AUTHENTICATE failed": {
        "causa": "Falha na autenticação com o servidor Outlook/Office 365",
        "solucao": [
            "Verifique se MFA está ativado e use uma senha de aplicativo",
            "Confirme que o email e senha estão corretos",
            "Verifique as configurações de segurança da sua conta Microsoft"
        ]
    },
    "SYS/TEMP_FAIL": {
        "causa": "Falha temporária no servidor Outlook/Office 365",
        "solucao": [
            "Esta é uma falha temporária do servidor. Tente novamente em alguns minutos",
            "Verifique o status dos serviços Microsoft: https://portal.office.com/servicestatus"
        ]
    },
    "LIMIT/MAX_CONN": {
        "causa": "Limite de conexões atingido no Outlook/Office 365",
        "solucao": [
            "Feche outras aplicações que possam estar usando IMAP com esta conta",
            "Espere alguns minutos antes de tentar novamente"
        ]
    }
}

YAHOO_ERRORS = {
    "AUTHENTICATE failed": {
        "causa": "Falha na autenticação com o Yahoo Mail",
        "solucao": [
            "Verifique se 'Permitir apps que usam login menos seguro' está ativado",
            "Utilize uma senha de aplicativo se tiver verificação em duas etapas ativada",
            "Acesse as configurações de segurança da sua conta Yahoo"
        ]
    },
    "LOGIN failed": {
        "causa": "Login falhou no Yahoo Mail",
        "solucao": [
            "O Yahoo pode exigir senhas de aplicativo. Gere uma em sua conta",
            "Verifique as configurações de segurança em account.yahoo.com",
            "Confirme se a conta não está bloqueada por tentativas de login suspeitas"
        ]
    }
}

GENERIC_ERRORS = {
    "AUTHENTICATE failed": {
        "causa": "Falha na autenticação com o servidor de email",
        "solucao": [
            "Verifique se o email e senha estão corretos",
            "Verifique se a autenticação de dois fatores está ativada e se necessita de senha de app",
            "Alguns provedores podem bloquear aplicativos de terceiros por segurança"
        ]
    },
    "LOGIN failed": {
        "causa": "Falha no login IMAP",
        "solucao": [
            "Verifique se o email e senha estão corretos",
            "Confirme se o servidor IMAP está correto para seu provedor",
            "Verifique configurações de segurança da sua conta de email"
        ]
    },
    "STARTTLS": {
        "causa": "Problema na inicialização de conexão segura STARTTLS",
        "solucao": [
            "Verifique se o servidor suporta STARTTLS",
            "Tente usar uma conexão SSL/TLS direta (porta 993) ao invés de STARTTLS",
            "Pode haver um problema de certificado com o servidor"
        ]
    },
    "socket error": {
        "causa": "Erro de conexão de rede",
        "solucao": [
            "Verifique sua conexão com a internet",
            "Confirme se o host e porta do servidor IMAP estão corretos",
            "Verifique se seu provedor não está bloqueando conexões"
        ]
    },
    "connection refused": {
        "causa": "Conexão recusada pelo servidor",
        "solucao": [
            "Verifique se o servidor IMAP está online",
            "Confirme se o host e porta estão corretos",
            "Alguns provedores podem bloquear tentativas de conexão de certos IPs"
        ]
    },
    "CONNECTION": {
        "causa": "Problema de conexão com o servidor IMAP",
        "solucao": [
            "Verifique sua conexão com a internet",
            "Confirme se o host e porta do servidor IMAP estão corretos",
            "O servidor pode estar temporariamente indisponível"
        ]
    },
    "timeout": {
        "causa": "Tempo limite excedido na conexão IMAP",
        "solucao": [
            "Verifique sua conexão com a internet",
            "O servidor pode estar com alta carga ou não responder",
            "Tente novamente mais tarde ou use um timeout maior"
        ]
    },
    "SSL": {
        "causa": "Problema na conexão SSL/TLS",
        "solucao": [
            "Verifique se o servidor suporta SSL/TLS na porta configurada",
            "Pode haver um problema com o certificado do servidor",
            "Tente usar uma porta diferente ou configuração SSL diferente"
        ]
    },
    "certificate": {
        "causa": "Problema com certificado SSL do servidor",
        "solucao": [
            "O certificado do servidor pode estar expirado ou inválido",
            "Em ambiente de desenvolvimento, você pode tentar desabilitar verificação de certificado",
            "Em produção, verifique se o servidor tem um certificado válido"
        ]
    },
    "revocation": {
        "causa": "Verificação de revogação de certificado SSL falhou",
        "solucao": [
            "Problemas com OCSP (Online Certificate Status Protocol)",
            "Pode ser necessário desativar a verificação de revogação em ambiente de teste",
            "Em produção, confirme que o certificado do servidor é válido"
        ]
    },
    "Too many simultaneous connections": {
        "causa": "Muitas conexões IMAP simultâneas",
        "solucao": [
            "Feche outras aplicações que possam estar usando IMAP com esta conta",
            "Espere alguns minutos antes de tentar novamente",
            "A maioria dos provedores limita o número de conexões por conta"
        ]
    }
}

# Padrões de erro para extração de detalhes
ERROR_PATTERNS = [
    # IMAP4.error genérico
    (r"(?i)AUTHENTICATE failed", "authentication"),
    (r"(?i)LOGIN failed", "authentication"),
    (r"(?i)Invalid credentials", "credentials"),
    (r"(?i)password", "credentials"),
    (r"(?i)Application-specific password", "app_password"),
    
    # Erros de certificado SSL
    (r"(?i)certificate", "ssl_certificate"),
    (r"(?i)SSL|TLS|STARTTLS", "ssl_connection"),
    
    # Erros de conexão
    (r"(?i)timeout", "timeout"),
    (r"(?i)Too many simultaneous", "rate_limit"),
    (r"(?i)connection refused", "connection_refused"),
    (r"(?i)socket", "socket"),
    
    # Erros específicos de servidores
    (r"(?i)Web login", "web_login_required"),
    (r"(?i)LIMIT/MAX_CONN", "connection_limit"),
    (r"(?i)SYS/TEMP_FAIL", "temporary_failure"),
    
    # Erros de acesso
    (r"(?i)denied|prohibited|disallowed", "access_denied"),
    (r"(?i)blocked|block", "blocked"),
    (r"(?i)throttl", "throttled"),
    (r"(?i)banned", "banned")
]

def identificar_provedor(host, email):
    """
    Identifica o provedor de email com base no host ou endereço de email
    """
    host = host.lower()
    domain = email.split('@')[-1].lower() if email else ""
    
    if "gmail" in host or "google" in host or "gmail" in domain:
        return "gmail"
    elif "outlook" in host or "office365" in host or "hotmail" in host or "live" in host or any(d in domain for d in ["outlook.com", "hotmail.com", "live.com", "office365.com", "microsoft.com"]):
        return "outlook"
    elif "yahoo" in host or "yahoo" in domain:
        return "yahoo"
    
    return "generic"

def classificar_erro_imap(erro, host=None, email=None):
    """
    Classifica um erro IMAP e retorna o tipo de erro
    """
    erro_str = str(erro).lower()
    
    # Verifica padrões de erro conhecidos
    for pattern, error_type in ERROR_PATTERNS:
        if re.search(pattern, erro_str, re.IGNORECASE):
            return error_type
    
    # Se nenhum padrão específico for encontrado
    if isinstance(erro, imaplib.IMAP4.error):
        return "imap_protocol"
    elif isinstance(erro, ssl.SSLError):
        return "ssl_error"
    elif isinstance(erro, socket.timeout):
        return "timeout"
    elif isinstance(erro, socket.error):
        return "socket_error"
    elif isinstance(erro, ConnectionRefusedError):
        return "connection_refused"
    
    return "unknown"

def obter_catalogo_provedor(provedor):
    """
    Retorna o catálogo de erros para um provedor específico
    """
    if provedor == "gmail":
        return GMAIL_ERRORS
    elif provedor == "outlook":
        return OUTLOOK_ERRORS
    elif provedor == "yahoo":
        return YAHOO_ERRORS
    
    return GENERIC_ERRORS

def diagnosticar_erro_imap(erro, host=None, email=None):
    """
    Diagnostica um erro IMAP e retorna informações detalhadas e soluções
    
    Args:
        erro (Exception): O erro IMAP capturado
        host (str, optional): O host do servidor IMAP
        email (str, optional): O endereço de email
        
    Returns:
        dict: Diagnóstico detalhado com causa e soluções
    """
    erro_str = str(erro)
    erro_type = classificar_erro_imap(erro, host, email)
    provedor = identificar_provedor(host, email) if host or email else "generic"
    catalogo = obter_catalogo_provedor(provedor)
    
    # Logging para debug
    logger.debug(f"Diagnosticando erro IMAP: {erro_str}")
    logger.debug(f"Tipo de erro classificado: {erro_type}")
    logger.debug(f"Provedor identificado: {provedor}")
    
    # Procurar correspondência no catálogo de erros
    diagnostico = None
    for pattern, info in catalogo.items():
        if pattern.lower() in erro_str.lower():
            diagnostico = info
            break
    
    # Se não encontrou específico, usa o genérico
    if not diagnostico and provedor != "generic":
        catalogo = GENERIC_ERRORS
        for pattern, info in catalogo.items():
            if pattern.lower() in erro_str.lower():
                diagnostico = info
                break
    
    # Se ainda não encontrou, cria um diagnóstico genérico
    if not diagnostico:
        diagnostico = {
            "causa": "Erro IMAP não classificado",
            "solucao": [
                "Verifique se as credenciais estão corretas",
                "Confirme as configurações do servidor IMAP (host, porta, SSL/TLS)",
                "Verifique sua conexão com a internet"
            ]
        }
    
    # Adicionar detalhes técnicos para diagnóstico
    resultado = {
        "erro_original": erro_str,
        "tipo_erro": erro_type,
        "provedor": provedor,
        "causa": diagnostico["causa"],
        "solucoes": diagnostico["solucao"],
        "detalhes_tecnicos": {
            "classe_erro": erro.__class__.__name__
        }
    }
    
    # Adicionar detalhes específicos por tipo de erro
    if erro_type == "authentication":
        resultado["authentication_details"] = {
            "requer_senha_app": "app_password" in erro_str.lower() or provedor == "gmail",
            "verificar_2fa": True
        }
    elif erro_type == "ssl_error":
        resultado["ssl_details"] = {
            "verificar_certificado": "certificate" in erro_str.lower(),
            "verificar_porta_ssl": True
        }
    elif erro_type == "connection_refused":
        resultado["connection_details"] = {
            "verificar_firewall": True,
            "verificar_ip_bloqueado": True
        }
    
    return resultado

def verificar_erro_comum(host, erro_str):
    """
    Verifica se o erro é um problema comum específico
    """
    erro_lower = erro_str.lower()
    
    # Erros de certificado
    if "certificate" in erro_lower and "verify" in erro_lower:
        return {
            "problema_comum": True,
            "tipo": "certificado_ssl",
            "mensagem": "Problema de verificação de certificado SSL",
            "solucao": "Em ambiente de desenvolvimento, você pode desabilitar temporariamente a verificação de certificado"
        }
    
    # Bloqueio por região/IP
    if ("access" in erro_lower and "denied" in erro_lower) or "blocked" in erro_lower:
        return {
            "problema_comum": True,
            "tipo": "bloqueio_acesso",
            "mensagem": "Possível bloqueio de acesso por região ou IP",
            "solucao": "Alguns provedores bloqueiam acessos de determinadas regiões ou IPs. Tente usar um proxy ou VPN."
        }
    
    # Rate limiting
    if "too many" in erro_lower or "rate" in erro_lower or "limit" in erro_lower:
        return {
            "problema_comum": True,
            "tipo": "rate_limiting",
            "mensagem": "Limite de taxa de conexões atingido",
            "solucao": "Reduza o número de tentativas ou aguarde alguns minutos antes de tentar novamente"
        }
    
    # Problemas de DNS
    if "resolve" in erro_lower or "dns" in erro_lower:
        return {
            "problema_comum": True,
            "tipo": "problema_dns",
            "mensagem": "Problema de resolução DNS para o servidor",
            "solucao": f"Verifique se o host '{host}' está correto e pode ser resolvido pela rede"
        }
    
    return {
        "problema_comum": False
    }

def gerar_mensagem_amigavel(diagnostico):
    """
    Gera uma mensagem de erro amigável com base no diagnóstico
    """
    tipo_erro = diagnostico["tipo_erro"]
    provedor = diagnostico["provedor"].capitalize()
    
    # Mensagens personalizadas por tipo de erro
    if tipo_erro == "authentication":
        return f"Erro de autenticação com {provedor}: {diagnostico['causa']}. " + \
               "Verifique suas credenciais e configurações de segurança da conta."
               
    elif tipo_erro == "credentials":
        if provedor == "Gmail":
            return f"Credenciais inválidas para {provedor}. Se você usa autenticação de dois fatores, " + \
                   "certifique-se de usar uma senha de aplicativo no formato correto (xxxx xxxx xxxx xxxx)."
        else:
            return f"Credenciais inválidas para {provedor}. Verifique seu email e senha."
            
    elif tipo_erro == "app_password":
        return f"É necessário usar uma senha de aplicativo para {provedor}. " + \
               "Ative a verificação em duas etapas e crie uma senha de aplicativo específica."
               
    elif tipo_erro == "ssl_connection":
        return f"Erro na conexão segura com {provedor}. " + \
               "Verifique as configurações SSL/TLS e a porta do servidor."
               
    elif tipo_erro == "timeout":
        return f"Tempo limite excedido ao conectar com {provedor}. " + \
               "Verifique sua conexão de internet ou tente novamente mais tarde."
               
    elif tipo_erro == "connection_refused":
        return f"Conexão recusada pelo servidor {provedor}. " + \
               "Verifique se o servidor está online e se as configurações de host e porta estão corretas."
               
    else:
        return f"Erro ao conectar com {provedor}: {diagnostico['causa']}. " + \
               "Verifique as configurações e tente novamente."

# Função para sanitizar e formatar erros IMAP para o cliente
def sanitizar_erro_imap(erro, host=None, email=None):
    """
    Sanitiza erros IMAP para retornar mensagens amigáveis ao usuário.
    Remove informações sensíveis e fornece sugestões úteis.
    
    Args:
        erro (Exception): O erro IMAP original
        host (str, optional): O host do servidor IMAP
        email (str, optional): O endereço de email
        
    Returns:
        dict: Erro formatado com mensagem amigável
    """
    # Gera diagnóstico detalhado
    diagnostico = diagnosticar_erro_imap(erro, host, email)
    
    # Verifica se é um problema comum com solução específica
    erro_comum = verificar_erro_comum(host, str(erro))
    
    # Gera mensagem amigável
    mensagem = gerar_mensagem_amigavel(diagnostico)
    
    # Estrutura a resposta
    resultado = {
        "error_type": diagnostico["tipo_erro"],
        "message": mensagem,
        "solutions": diagnostico["solucoes"],
        "technical_details": {
            "provider": diagnostico["provedor"],
            "error_class": diagnostico["detalhes_tecnicos"]["classe_erro"]
        }
    }
    
    # Adiciona informações de problema comum se aplicável
    if erro_comum["problema_comum"]:
        resultado["common_issue"] = {
            "type": erro_comum["tipo"],
            "solution": erro_comum["solucao"]
        }
    
    return resultado