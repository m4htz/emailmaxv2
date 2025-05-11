'use client';

import { useEffect, useState } from 'react';
import { useEmailAccountsStore, EmailAccount } from '../../lib/store';
import { Button } from '../ui/button';
import { createBrowserClient } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export const EmailAccountList = () => {
  const { accounts, isLoading, error, setAccounts, removeAccount, setLoading, setError } = useEmailAccountsStore();
  const supabase = createBrowserClient();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Carregar dados do Supabase
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('email_accounts')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) {
          throw error;
        }
        
        // Mapear dados do Supabase para o formato do store
        const mappedAccounts: EmailAccount[] = data.map((item: any) => ({
          id: item.id,
          email: item.email,
          name: item.name || item.email.split('@')[0],
          provider: getProviderName(item.imap_host || ''),
          imapHost: item.imap_host || '',
          imapPort: item.imap_port || 993,
          smtpHost: item.smtp_host || '',
          smtpPort: item.smtp_port || 587,
          username: item.username || item.email,
          isActive: item.status === 'connected',
          createdAt: item.created_at,
          lastChecked: item.last_checked
        }));
        
        setAccounts(mappedAccounts);
      } catch (err: any) {
        console.error('Erro ao buscar contas de email:', err);
        setError(err.message || 'Erro ao carregar contas de email');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [setAccounts, setLoading, setError, supabase]);

  // Função para obter nome do provedor baseado no host
  const getProviderName = (host: string): string => {
    if (host.includes('gmail')) return 'Gmail';
    if (host.includes('outlook') || host.includes('office365')) return 'Outlook';
    if (host.includes('yahoo')) return 'Yahoo';
    if (host.includes('hotmail')) return 'Hotmail';
    return 'Outro';
  };

  // Função para remover conta
  const handleRemoveAccount = async (id: string) => {
    try {
      setIsDeleting(id);
      
      // Remover do Supabase
      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', id);
        
      if (error) {
        throw error;
      }
      
      // Remover do store local
      removeAccount(id);
    } catch (err: any) {
      console.error('Erro ao remover conta:', err);
      setError(err.message || 'Erro ao remover conta');
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Carregando contas de email...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        Erro: {error}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
            <rect width="20" height="16" x="2" y="4" rx="2"></rect>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-1">Nenhuma conta de email cadastrada</h3>
        <p className="text-slate-500 mb-4">
          Adicione uma conta de email para começar a usar o sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Contas de Email</h2>
      <div className="grid gap-4">
        {accounts.map((account) => (
          <div 
            key={account.id} 
            className={`p-4 border rounded-lg ${account.isActive ? 'border-green-500' : 'border-gray-300'}`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">{account.name || account.email}</h3>
                <p className="text-sm text-gray-500">{account.email}</p>
                <p className="text-xs text-gray-400">Provedor: {account.provider}</p>
                {account.lastChecked && (
                  <p className="text-xs text-gray-400">
                    Última verificação: {new Date(account.lastChecked).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                >
                  <a href={`/email-accounts/${account.id}`}>Editar</a>
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleRemoveAccount(account.id)}
                  disabled={isDeleting === account.id}
                >
                  {isDeleting === account.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Removendo</>
                  ) : (
                    'Remover'
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-2">
              <span 
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                  account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {account.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};