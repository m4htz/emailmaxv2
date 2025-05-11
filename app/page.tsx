import { redirect } from 'next/navigation';

/**
 * Página inicial - redireciona para o dashboard
 *
 * Esta página redireciona o usuário para a rota /overview, onde o middleware
 * e o AuthGuard cuidarão da verificação de autenticação e redirecionamento
 * para login, se necessário.
 *
 * Obs: A verificação de autenticação ocorre no middleware de forma segura,
 * evitando ciclos de redirecionamento.
 */
export default function HomePage() {
  // Redirecionamos para /overview - o middleware fará a verificação de autenticação
  redirect('/overview');
} 