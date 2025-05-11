import { createClient as createBrowserClient } from './client';
import { createClient as createServerClient } from './server';
import { createClient as createMiddlewareClient } from './middleware';

export {
  createBrowserClient,
  createServerClient,
  createMiddlewareClient
}

// Exportar um singleton do client do navegador para uso direto
import clientSingleton from './client.singleton';
export { clientSingleton };