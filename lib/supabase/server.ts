import { createServerClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

// Verificar variáveis de ambiente
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Lançar erro se as variáveis não estiverem definidas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Erro: Variáveis de ambiente do Supabase não definidas.')
  console.error('Verifique se .env.local contém NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const createClient = async (cookieStore?: any) => {
  // Verificar se estamos no App Router (next/headers disponível)
  let cookiesObject = cookieStore

  // Se não recebemos cookies e estamos no App Router, carregamos next/headers dinamicamente
  if (!cookiesObject) {
    try {
      // Importação dinâmica para evitar erro no Pages Router
      const { cookies } = await import('next/headers')
      cookiesObject = await cookies()
    } catch (error) {
      console.warn('Aviso: Não foi possível importar next/headers. Usando cookies vazios.')
      // Fornecer implementação padrão vazia para ambientes onde next/headers não está disponível
      cookiesObject = {
        getAll: () => [],
        set: () => {},
      }
    }
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookiesObject.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookiesObject.set(name, value, options)
            )
          } catch (error) {
            // A chamada setAll foi feita de um Server Component
            // ou os cookies não estão disponíveis
            // Isso pode ser ignorado se você tiver middleware
            // atualizando as sessões dos usuários
            console.warn('Aviso: Não foi possível definir cookies. Isso é esperado em alguns ambientes.')
          }
        },
      },
    }
  )
}

export default createClient 