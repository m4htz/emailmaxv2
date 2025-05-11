import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Mock do módulo @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: null
        }
      })
    }
  }))
}))

// Mock do NextResponse
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server') as any
  return {
    ...originalModule,
    NextResponse: {
      ...originalModule.NextResponse,
      next: jest.fn().mockImplementation(({ request }) => ({
        cookies: {
          set: jest.fn(),
          getAll: jest.fn().mockReturnValue([])
        },
        request
      })),
      redirect: jest.fn().mockImplementation((url) => ({
        url: typeof url === 'string' ? new URL(url, 'http://localhost') : url,
        cookies: {
          set: jest.fn(),
          getAll: jest.fn()
        }
      }))
    }
  }
})

// Salvar valor original de process.env.NODE_ENV
const originalNodeEnv = process.env.NODE_ENV

describe('Dev Bypass Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Configurar como desenvolvimento para testes
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    // Restaurar valor original
    process.env.NODE_ENV = originalNodeEnv
  })

  it('deve redirecionar URLs com parâmetro dev_bypass para URL limpa', async () => {
    // Criar uma requisição mock com parâmetro dev_bypass
    const url = new URL('http://localhost:3000/overview?dev_bypass=true')
    const request = new NextRequest(url, {
      headers: new Headers({
        cookie: ''
      })
    })

    // Executar o middleware
    const response = await updateSession(request) as any

    // Verificar se houve redirecionamento
    expect(NextResponse.redirect).toHaveBeenCalled()
    
    // Verificar se o parâmetro foi removido da URL
    expect(response.url.searchParams.has('dev_bypass')).toBeFalsy()
    
    // Verificar se o cookie foi definido
    expect(response.cookies.set).toHaveBeenCalledWith(
      'dev_access_bypass',
      'true',
      expect.objectContaining({
        path: '/',
        maxAge: 86400 // 1 dia em segundos
      })
    )
  })

  it('deve permitir acesso com cookie dev_access_bypass em ambiente de desenvolvimento', async () => {
    // Criar uma requisição mock com cookie de bypass
    const url = new URL('http://localhost:3000/overview')
    const request = new NextRequest(url, {
      headers: new Headers({
        cookie: 'dev_access_bypass=true'
      })
    })
    
    // Mock para simular a existência do cookie
    const cookiesMock = {
      get: jest.fn().mockReturnValue({ value: 'true' }),
      getAll: jest.fn().mockReturnValue([{ name: 'dev_access_bypass', value: 'true' }])
    }
    
    // Atribuir mock de cookies
    Object.defineProperty(request, 'cookies', {
      value: cookiesMock,
      writable: true
    })

    // Executar o middleware
    await updateSession(request)

    // Verificar que não houve redirecionamento para login
    expect(NextResponse.redirect).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/login'
      })
    )
  })

  it('deve redirecionar para login quando não há usuário nem bypass em produção', async () => {
    // Configurar como produção
    process.env.NODE_ENV = 'production'
    
    // Criar uma requisição mock para uma rota protegida
    const request = new NextRequest(new URL('http://localhost:3000/overview'), {
      headers: new Headers({
        cookie: 'dev_access_bypass=true'  // Mesmo com cookie, em produção não deve permitir
      })
    })
    
    // Mock para simular a existência do cookie
    const cookiesMock = {
      get: jest.fn().mockReturnValue({ value: 'true' }),
      getAll: jest.fn().mockReturnValue([{ name: 'dev_access_bypass', value: 'true' }])
    }
    
    // Atribuir mock de cookies
    Object.defineProperty(request, 'cookies', {
      value: cookiesMock,
      writable: true
    })

    // Executar o middleware
    const response = await updateSession(request) as any

    // Verificar se houve um redirecionamento para a página de login
    expect(NextResponse.redirect).toHaveBeenCalled()
    expect(response.url.pathname).toBe('/login')
    
    // Restaurar valor de desenvolvimento para outros testes
    process.env.NODE_ENV = 'development'
  })
})