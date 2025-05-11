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

describe('Bypass Cookie Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'development'
  })
  
  it('deve manter o cookie de acesso bypass uma vez configurado', async () => {
    // Criar uma requisição mock com cookie já configurado
    const request = new NextRequest(new URL('http://localhost:3000/overview'), {
      headers: new Headers({
        cookie: 'dev_access_bypass=true'
      })
    })
    
    // Simular a presença do cookie
    request.cookies.get = jest.fn().mockReturnValue({ 
      name: 'dev_access_bypass', 
      value: 'true' 
    })
    
    request.cookies.getAll = jest.fn().mockReturnValue([{ 
      name: 'dev_access_bypass', 
      value: 'true' 
    }])
    
    // Executar o middleware
    const response = await updateSession(request)
    
    // Verificar que não houve redirecionamento e o acesso foi permitido
    expect(NextResponse.redirect).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/login'
      })
    )
    
    // Verificar que o cookie não foi modificado
    expect(response.cookies?.set).not.toHaveBeenCalledWith(
      'dev_access_bypass',
      expect.anything(),
      expect.anything()
    )
  })
  
  it('deve configurar cookie automaticamente com parâmetro URL', async () => {
    // Criar uma requisição mock com parâmetro URL e sem cookie
    const request = new NextRequest(
      new URL('http://localhost:3000/overview?dev_bypass=true'), 
      {
        headers: new Headers({
          cookie: ''
        })
      }
    )
    
    // Simular ausência de cookie
    request.cookies.get = jest.fn().mockReturnValue(undefined)
    request.cookies.getAll = jest.fn().mockReturnValue([])
    
    // Executar o middleware
    const response = await updateSession(request)
    
    // Verificar que fomos redirecionados para a URL limpa
    expect(NextResponse.redirect).toHaveBeenCalled()
    
    // Verificar que o cookie foi configurado
    expect(response.cookies.set).toHaveBeenCalledWith(
      'dev_access_bypass',
      'true',
      expect.objectContaining({
        path: '/'
      })
    )
  })
  
  it('deve manter redirecionamento para login em produção mesmo com parâmetros dev_bypass', async () => {
    // Configurar ambiente como produção
    process.env.NODE_ENV = 'production'
    
    // Criar uma requisição mock com parâmetro URL em produção
    const request = new NextRequest(
      new URL('http://localhost:3000/overview?dev_bypass=true'), 
      {
        headers: new Headers({
          cookie: ''
        })
      }
    )
    
    // Executar o middleware
    const response = await updateSession(request)
    
    // Verificar que redirecionamos para login
    expect(NextResponse.redirect).toHaveBeenCalled()
    expect(response.url.pathname).toBe('/login')
  })
})