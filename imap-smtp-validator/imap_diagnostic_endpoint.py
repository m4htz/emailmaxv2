"""
Endpoints de diagnóstico avançado para IMAP

Este módulo contém endpoints adicionais para o diagnóstico detalhado de problemas
de conexão IMAP, fornecendo informações mais detalhadas e orientações específicas.
"""
from flask import Blueprint, request, jsonify
from typing import Dict, Any

import imaplib
import ssl
import socket
import logging
import time

from imap_error_diagnostic import (
    diagnosticar_erro_imap,
    identificar_provedor,
    classificar_erro_imap,
    sanitizar_erro_imap
)

# Configurar blueprint para os endpoints
imap_diagnostic_bp = Blueprint('imap_diagnostic', __name__)

# Configurar logger
logger = logging.getLogger('emailmax-validator.imap-diagnostic-endpoints')

# Função auxiliar para realizar testes específicos de IMAP
def teste_imap_especifico(email: str, password: str, host: str, port: int, 
                         secure: bool = True, test_type: str = 'login') -> Dict[str, Any]:
    """
    Realiza um teste específico de IMAP para diagnosticar problemas.
    
    Args:
        email: Endereço de email
        password: Senha do email
        host: Host do servidor IMAP
        port: Porta do servidor IMAP
        secure: Se deve usar conexão segura (SSL/TLS)
        test_type: Tipo de teste a realizar (login, capabilities, folders, etc)
        
    Returns:
        Dict com resultados e diagnóstico detalhado
    """
    result = {
        'success': False,
        'message': '',
        'test_type': test_type,
        'diagnostics': {},
        'server_capabilities': [],
        'connection_info': {
            'response_time_ms': 0,
            'handshake_time_ms': 0
        }
    }
    
    try:
        # Medir tempo de resposta inicial
        start_time = time.time()
        
        # Inicializar conexão IMAP com medição de tempo
        if secure:
            imap = imaplib.IMAP4_SSL(host, port=port, timeout=30)
        else:
            imap = imaplib.IMAP4(host, port=port, timeout=30)
            
        # Medir tempo de handshake
        handshake_time = time.time() - start_time
        result['connection_info']['handshake_time_ms'] = round(handshake_time * 1000, 2)
        
        # Testar recursos do servidor
        if test_type in ['capabilities', 'all']:
            caps = imap.capabilities
            result['server_capabilities'] = [str(cap) for cap in caps]
            
            # Analisar recursos importantes
            has_idle = b'IDLE' in caps
            has_condstore = b'CONDSTORE' in caps
            has_enable = b'ENABLE' in caps
            has_id = b'ID' in caps
            
            result['server_features'] = {
                'idle_supported': has_idle,
                'condstore_supported': has_condstore,
                'enable_supported': has_enable,
                'id_supported': has_id
            }
        
        # Testar login se solicitado
        if test_type in ['login', 'all']:
            login_start = time.time()
            imap.login(email, password)
            login_time = time.time() - login_start
            result['connection_info']['login_time_ms'] = round(login_time * 1000, 2)
            result['success'] = True
            
            # Testar listagem de pastas se login bem-sucedido
            if test_type in ['folders', 'all']:
                folders_start = time.time()
                status, mailbox_list = imap.list()
                folders_time = time.time() - folders_start
                result['connection_info']['folders_time_ms'] = round(folders_time * 1000, 2)
                
                if status == 'OK':
                    # Decodificar e extrair nomes das pastas
                    mailboxes = []
                    for mailbox in mailbox_list:
                        if isinstance(mailbox, bytes):
                            try:
                                decoded = mailbox.decode('utf-8')
                                parts = decoded.split(' "." ')
                                if len(parts) > 1:
                                    mailbox_name = parts[1].strip('"')
                                    mailboxes.append(mailbox_name)
                            except Exception as e:
                                logger.warning(f"Erro ao decodificar caixa de correio: {e}")
                    
                    result['folders'] = {
                        'count': len(mailboxes),
                        'names': mailboxes
                    }
        
        # Tempo total do teste
        total_time = time.time() - start_time
        result['connection_info']['total_time_ms'] = round(total_time * 1000, 2)
        
        # Dados do servidor
        try:
            if hasattr(imap, 'welcome') and imap.welcome:
                welcome = imap.welcome.decode('utf-8') if isinstance(imap.welcome, bytes) else str(imap.welcome)
                result['server_info'] = {
                    'welcome_message': welcome
                }
                # Tentar extrair versão do servidor
                import re
                version_match = re.search(r'([^\s]+) IMAP4[^\s]* server', welcome)
                if version_match:
                    result['server_info']['server_type'] = version_match.group(1)
        except Exception as e:
            logger.warning(f"Erro ao extrair info do servidor: {e}")
        
        # Limpar conexão
        try:
            imap.logout()
        except:
            pass
            
        # Mensagem geral de sucesso
        if result['success']:
            result['message'] = f"Teste de {test_type} completado com sucesso"
        
    except Exception as e:
        # Tempo total em caso de erro
        total_time = time.time() - start_time
        result['connection_info']['total_time_ms'] = round(total_time * 1000, 2)
        
        # Diagnóstico detalhado em caso de erro
        diagnostico = diagnosticar_erro_imap(e, host, email)
        result['diagnostics'] = sanitizar_erro_imap(e, host, email)
        result['message'] = result['diagnostics']['message']
        
    return result

# Endpoint para diagnóstico detalhado de IMAP
@imap_diagnostic_bp.route('/api/imap-diagnostic', methods=['POST'])
def imap_diagnostic():
    """
    Endpoint para diagnóstico detalhado de conexões IMAP.
    Executa testes específicos para entender problemas de conexão.
    """
    try:
        data = request.json
        
        # Validar parâmetros obrigatórios
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({
                'success': False,
                'message': 'Parâmetros incompletos. É necessário fornecer email e password.'
            }), 400
            
        email = data['email']
        password = data['password']
        host = data.get('imapHost')
        port = data.get('imapPort')
        secure = data.get('imapSecure', True)
        test_type = data.get('testType', 'all')
        
        # Auto-detecção se host/port não fornecidos
        if not host or not port:
            from app import detect_provider_config
            provider_settings = detect_provider_config(email)
            host = host or provider_settings['imap']['host']
            port = port or provider_settings['imap']['port']
            secure = secure if secure is not None else provider_settings['imap']['secure']
        
        # Converter port para inteiro
        port = int(port)
        
        # Executar teste específico
        result = teste_imap_especifico(
            email, password, host, port, secure, test_type
        )
        
        # Adicionar informações gerais ao resultado
        result['email'] = email
        result['server'] = {
            'host': host,
            'port': port,
            'secure': secure
        }
        
        # Identificar provedor para recomendações específicas
        provider = identificar_provedor(host, email)
        result['provider'] = provider
        
        # Incluir recomendações específicas por provedor
        if provider == 'gmail':
            result['provider_info'] = {
                'name': 'Gmail',
                'requires_app_password': True,
                'max_connections': 15,
                'official_docs': 'https://support.google.com/mail/answer/7126229'
            }
        elif provider == 'outlook':
            result['provider_info'] = {
                'name': 'Outlook/Microsoft 365',
                'requires_app_password': True,
                'max_connections': 20,
                'official_docs': 'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353'
            }
        elif provider == 'yahoo':
            result['provider_info'] = {
                'name': 'Yahoo Mail',
                'requires_app_password': True,
                'official_docs': 'https://help.yahoo.com/kb/SLN4075.html'
            }
            
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Erro ao processar diagnóstico IMAP: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'Erro interno do servidor: {str(e)}',
            'details': {}
        }), 500

# Endpoint para verificar recursos específicos de um servidor
@imap_diagnostic_bp.route('/api/imap-server-capabilities', methods=['POST'])
def imap_server_capabilities():
    """
    Verifica recursos/capabilities suportados por um servidor IMAP
    sem necessidade de autenticação
    """
    try:
        data = request.json
        
        # Validar parâmetros obrigatórios
        if not data or 'host' not in data:
            return jsonify({
                'success': False,
                'message': 'Parâmetro host é obrigatório'
            }), 400
            
        host = data['host']
        port = int(data.get('port', 993))
        secure = data.get('secure', True)
        
        result = {
            'success': False,
            'host': host,
            'port': port,
            'secure': secure,
            'capabilities': [],
            'server_info': {},
            'connection_time_ms': 0
        }
        
        # Medir tempo de resposta
        start_time = time.time()
        
        try:
            # Conectar ao servidor
            if secure:
                imap = imaplib.IMAP4_SSL(host, port=port, timeout=10)
            else:
                imap = imaplib.IMAP4(host, port=port, timeout=10)
                
            # Obter capabilities
            caps = imap.capabilities
            result['capabilities'] = [str(cap) for cap in caps]
            
            # Analisar recursos importantes
            result['features'] = {
                'idle_supported': b'IDLE' in caps,
                'condstore_supported': b'CONDSTORE' in caps,
                'enable_supported': b'ENABLE' in caps,
                'id_supported': b'ID' in caps,
                'sasl_supported': any(cap.startswith(b'AUTH=') for cap in caps)
            }
            
            # Obter mensagem de boas-vindas
            if hasattr(imap, 'welcome') and imap.welcome:
                welcome = imap.welcome.decode('utf-8') if isinstance(imap.welcome, bytes) else str(imap.welcome)
                result['server_info']['welcome_message'] = welcome
                # Tentar extrair versão do servidor
                import re
                version_match = re.search(r'([^\s]+) IMAP4[^\s]* server', welcome)
                if version_match:
                    result['server_info']['server_type'] = version_match.group(1)
                    
            # Verificar mecanismos SASL suportados
            sasl_methods = []
            for cap in caps:
                if cap.startswith(b'AUTH='):
                    sasl_methods.append(cap[5:].decode('utf-8'))
            result['features']['sasl_methods'] = sasl_methods
            
            # Desconectar
            imap.logout()
            result['success'] = True
            
        except Exception as e:
            result['error'] = str(e)
            result['error_type'] = classificar_erro_imap(e, host)
            
        # Calcular tempo total
        result['connection_time_ms'] = round((time.time() - start_time) * 1000, 2)
            
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Erro ao verificar capabilities: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'Erro interno do servidor: {str(e)}'
        }), 500

# Função para registrar os blueprints no app Flask
def register_diagnostic_endpoints(app):
    app.register_blueprint(imap_diagnostic_bp)
    logger.info("Endpoints de diagnóstico IMAP registrados")