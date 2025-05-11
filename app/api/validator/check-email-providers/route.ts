import { NextRequest, NextResponse } from 'next/server';

// URL do microserviço
const VALIDATION_SERVICE_URL = process.env.NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL || 'http://localhost:5000';
const API_KEY = process.env.EMAIL_VALIDATION_API_KEY || 'dev_key_change_me_in_production';

/**
 * Endpoint proxy para verificação de provedores de email
 * Previne problemas de CORS fazendo a requisição a partir do servidor Next.js
 */
export async function GET(request: NextRequest) {
  try {
    // Adicionar timeout para evitar requisições pendentes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${VALIDATION_SERVICE_URL}/api/check-email-providers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      signal: controller.signal,
      next: { revalidate: 0 } // Não cachear a resposta
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error: any) {
    console.error('[API Proxy] Erro ao acessar verificação de provedores:', error);
    
    // Tratamento específico para diferentes tipos de erros
    let statusCode = 500;
    let errorMessage = 'Erro interno no servidor ao tentar acessar o serviço de validação';
    
    if (error.name === 'AbortError') {
      statusCode = 504; // Gateway Timeout
      errorMessage = 'Tempo limite excedido ao tentar contatar o serviço de validação';
    } else if (error.cause?.code === 'ECONNREFUSED') {
      statusCode = 503; // Service Unavailable
      errorMessage = 'Serviço de validação indisponível ou não iniciado';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      providers: {},
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  }
}