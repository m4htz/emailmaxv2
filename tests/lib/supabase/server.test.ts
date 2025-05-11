import { jest } from '@jest/globals'

// Mock para o módulo @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn()
    }
  }))
}))

// Mock para importação dinâmica de next/headers
// O mock precisa retornar uma Promise que resolva com um objeto contendo cookies
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn().mockImplementation(() => Promise.resolve({
    getAll: jest.fn(() => []),
    set: jest.fn()
  }))
}))

// Importação da função a ser testada (alterada para lib/supabase)
import { createClient } from '@/lib/supabase/server'

describe('Supabase Server Client', () => {
  beforeEach(() => {
    // Limpar mocks antes de cada teste
    jest.clearAllMocks()
  })

  it('deve carregar as variáveis de ambiente corretamente', async () => {
    // Armazenar os valores originais
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Verificar se as variáveis de ambiente estão definidas
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()

    // Restaurar os valores originais se necessário
    if (originalUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it('deve aceitar um cookieStore personalizado', async () => {
    const mockCookieStore = {
      getAll: jest.fn(() => []),
      set: jest.fn()
    }

    // Chamar createClient com cookieStore personalizado
    const client = await createClient(mockCookieStore)

    // Verificar se o cliente foi criado
    expect(client).toBeDefined()
  })

  it('deve funcionar quando next/headers falhar', async () => {
    // Modificar o mock de import para falhar
    jest.mock('next/headers', () => {
      throw new Error('Module not available')
    })

    // Deve usar um cookieStore vazio quando next/headers falhar
    const client = await createClient()

    // Verificar se o cliente foi criado mesmo com o erro
    expect(client).toBeDefined()
  })
}) 