import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

// Singleton para o cliente do navegador
const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default supabase