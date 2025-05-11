import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/supabase'

export function createClient(request: NextRequest) {
  // Evitar processamento para recursos estáticos
  if (shouldSkipMiddleware(request.nextUrl.pathname)) {
    return {
      supabase: null,
      supabaseResponse: NextResponse.next()
    };
  }

  // Criar uma resposta não modificada
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, supabaseResponse }
}

export async function updateSession(request: NextRequest) {
  // Evitar processamento para recursos estáticos
  if (shouldSkipMiddleware(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Registrar a rota solicitada para debugging (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] Processando rota: ${request.nextUrl.pathname}`);
  }

  const { supabase, supabaseResponse } = createClient(request)

  // Se o cliente Supabase não foi criado (para recursos estáticos), retornar resposta padrão
  if (!supabase) {
    return supabaseResponse;
  }

  // Verificar se está em ambiente de desenvolvimento
  const isDev = process.env.NODE_ENV === 'development';

  // Verificar parâmetro dev_bypass na URL
  const hasDevBypassParam = request.nextUrl.searchParams.has('dev_bypass');

  // Verificar cookie de acesso direto
  const devBypassCookie = request.cookies.get('dev_access_bypass')?.value === 'true';

  // Se estamos em modo de desenvolvimento e temos o parâmetro dev_bypass na URL
  // redirecionar para a mesma URL sem o parâmetro mas configurando o cookie
  if (isDev && hasDevBypassParam) {
    console.log('[Middleware] Detectado parâmetro dev_bypass, redirecionando e configurando cookie');

    // Clonar a URL atual
    const cleanUrl = request.nextUrl.clone();
    // Remover o parâmetro dev_bypass
    cleanUrl.searchParams.delete('dev_bypass');

    // Criar resposta de redirecionamento
    const response = NextResponse.redirect(cleanUrl);

    // Configurar cookie de bypass para requisições futuras
    response.cookies.set('dev_access_bypass', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 // 1 dia
    });

    console.log('[Middleware] Redirecionando para:', cleanUrl.toString());
    return response;
  }

  // IMPORTANTE: NÃO REMOVER auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Verificar se temos acesso bypass por cookie
  const hasDevBypass = isDev && devBypassCookie;

  // Se a rota é a página inicial, redirecionar para overview sempre
  if (request.nextUrl.pathname === '/') {
    console.log('[Middleware] Redirecionando página inicial para /overview');
    const url = request.nextUrl.clone();
    url.pathname = '/overview';
    return NextResponse.redirect(url);
  }

  // Verificar se o usuário não está autenticado e não está tentando acessar páginas públicas
  // Em modo de desenvolvimento, permitir acesso direto se o cookie estiver presente
  if (
    !user &&
    !isPublicRoute(request.nextUrl.pathname) &&
    !hasDevBypass
  ) {
    // Evitar loops de redirecionamento
    if (request.nextUrl.pathname === '/login') {
      console.log('[Middleware] Já estamos na página de login, não redirecionando');
      return supabaseResponse;
    }

    // Redirecionar para a página de login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    console.log(`[Middleware] Usuário não autenticado acessando rota protegida: ${request.nextUrl.pathname}, redirecionando para login`);
    return NextResponse.redirect(url);
  }

  // Para usuários autenticados tentando acessar a página de login, redirecionar para dashboard
  if (user && request.nextUrl.pathname === '/login') {
    console.log('[Middleware] Usuário autenticado tentando acessar /login, redirecionando para dashboard');
    const url = request.nextUrl.clone();
    url.pathname = '/overview';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// Função auxiliar para determinar se uma rota é pública
function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/login',
    '/auth/signup',
    '/auth/callback',
    '/auth/reset-password',
    '/auth',
    '/api/health',
  ];

  return publicRoutes.some(route => pathname.startsWith(route));
}

// Função auxiliar para verificar se o middleware deve ser ignorado
function shouldSkipMiddleware(pathname: string): boolean {
  // Arquivos estáticos e recursos que não precisam de autenticação
  return pathname.startsWith('/_next') ||
         pathname.startsWith('/favicon.ico') ||
         /\.(svg|png|jpg|jpeg|gif|webp|css|js)$/.test(pathname);
}

export const config = {
  matcher: [
    /*
     * Corresponde a todos os caminhos de requisição exceto pelos que começam com:
     * - _next/static (arquivos estáticos)
     * - _next/image (arquivos de otimização de imagem)
     * - favicon.ico (arquivo de favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};