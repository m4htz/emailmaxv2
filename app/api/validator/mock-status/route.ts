import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint que simula o status do microserviço de validação
 * Usado quando o microserviço está indisponível para testes de UI
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    version: '1.0.1-mock',
    system: {
      hostname: 'mock-validator',
      platform: 'mock-platform',
      python_version: '3.11.0'
    },
    resources: {
      cpu: {
        percent: 20.5,
        count: 4
      },
      memory: {
        percent: 15.3,
        total: 8589934592,
        available: 7274725376
      },
      disk: {
        percent: 40.2,
        total: 107374182400,
        free: 64162988236
      }
    },
    uptime: {
      start_time: new Date(Date.now() - 86400000).toISOString(), // 1 dia atrás
      current_time: new Date().toISOString(),
      uptime_seconds: 86400,
      uptime_formatted: '1d 0h 0m 0s'
    },
    connectivity: {
      overall_success: true,
      targets: {
        'dns.google': {
          success: true,
          response_time_ms: 15.4,
          message: 'Conectividade DNS OK'
        },
        'www.google.com': {
          success: true,
          response_time_ms: 85.2,
          message: 'Conectividade HTTPS OK'
        }
      }
    },
    response_time_ms: 4.5
  });
}