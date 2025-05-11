import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'EmailMax - Sistema de Gerenciamento e Automação de Email',
  description: 'Sistema de gerenciamento e automação de email com foco em aquecimento de contas via contas "seed" IMAP.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}