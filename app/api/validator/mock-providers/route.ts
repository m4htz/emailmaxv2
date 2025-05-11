import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint que simula verificação de provedores de email
 * Usado quando o microserviço está indisponível para testes de UI
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Todos os provedores acessíveis (Simulado)",
    providers: {
      Gmail: {
        imap: {
          success: true,
          response_time_ms: 125.4,
          message: "Conectividade IMAP OK"
        },
        smtp: {
          success: true,
          response_time_ms: 175.8,
          message: "Conectividade SMTP OK"
        }
      },
      Outlook: {
        imap: {
          success: true,
          response_time_ms: 145.2,
          message: "Conectividade IMAP OK"
        },
        smtp: {
          success: true,
          response_time_ms: 165.3,
          message: "Conectividade SMTP OK"
        }
      },
      Yahoo: {
        imap: {
          success: true,
          response_time_ms: 195.7,
          message: "Conectividade IMAP OK"
        },
        smtp: {
          success: true,
          response_time_ms: 215.6,
          message: "Conectividade SMTP OK"
        }
      }
    },
    timestamp: new Date().toISOString()
  });
}