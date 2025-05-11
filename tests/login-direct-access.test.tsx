import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { jest } from '@jest/globals'

// Mocks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn()
  })
}))

// Mock do store de autenticação
jest.mock('@/lib/store/useAuth', () => ({
  useAuth: () => ({
    setAuth: jest.fn(),
    isAuthenticated: false
  })
}))

// Mock do store de autenticação original
jest.mock('@/lib/store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    setAuth: jest.fn()
  }))
}))

// Mock do cliente Supabase
jest.mock('@/lib/supabase', () => ({
  createBrowserClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('Mock error')
      })
    }
  }))
}))

// Importar os componentes apenas após configurar os mocks
import { LoginForm } from '@/components/ui/login-form'

// Mock para window.location.href
const originalWindowLocation = window.location
let locationHrefSpy: jest.SpyInstance

describe('Funcionalidade de Acesso Direto', () => {
  beforeEach(() => {
    // Mock para document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: ''
    })

    // Mock para window.location
    delete window.location
    window.location = { ...originalWindowLocation } as Location
    locationHrefSpy = jest.spyOn(window.location, 'href', 'set')
  })

  afterEach(() => {
    // Limpar mocks
    jest.clearAllMocks()
    
    // Restaurar window.location
    window.location = originalWindowLocation
  })

  it('deve configurar cookie e redirecionar quando o botão de acesso direto é clicado', () => {
    // Mock de ambiente de desenvolvimento
    process.env.NODE_ENV = 'development'
    
    // Renderizar componente
    render(<LoginForm />)
    
    // Encontrar e clicar no botão de acesso direto
    const directAccessButton = screen.getByText(/acesso direto/i)
    expect(directAccessButton).toBeInTheDocument()
    
    // Espiar document.cookie
    const cookieSpy = jest.spyOn(document, 'cookie', 'set')
    
    // Clicar no botão
    fireEvent.click(directAccessButton)
    
    // Verificar se o cookie foi configurado
    expect(cookieSpy).toHaveBeenCalledWith(
      expect.stringContaining('dev_access_bypass=true')
    )
    
    // Verificar redirecionamento usando setTimeout
    jest.runAllTimers()
    
    // Verificar se window.location.href foi configurado
    expect(locationHrefSpy).toHaveBeenCalledWith('/overview?dev_bypass=true')
  })
})

// Stub para document.createElement para simular o formulário
const mockForm = {
  method: '',
  action: '',
  appendChild: jest.fn(),
  submit: jest.fn()
}

const mockInput = {
  type: '',
  name: '',
  value: ''
}

// Stub para document.body.appendChild
jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
  if (tagName === 'form') return mockForm as unknown as HTMLElement
  if (tagName === 'input') return mockInput as unknown as HTMLElement
  return document.createElement(tagName)
})

jest.spyOn(document.body, 'appendChild').mockImplementation(() => document.body)