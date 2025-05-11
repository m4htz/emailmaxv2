'use client';

import { useEffect, useState } from 'react';
import { useWarmupStore, WarmupPlan } from '../../lib/store';
import { Button } from '../ui/button';
import { createBrowserClient } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export const WarmupPlanList = () => {
  const { plans, isLoading, error, setPlans, updatePlan, removePlan, setLoading, setError } = useWarmupStore();
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const supabase = createBrowserClient();

  // Carregar dados do Supabase
  useEffect(() => {
    const fetchWarmupPlans = async () => {
      try {
        setLoading(true);
        
        // Buscar planos de aquecimento
        const { data: warmupPlans, error: warmupError } = await supabase
          .from('warmup_plans')
          .select('id, name, account_id, start_date, daily_increment, max_daily_emails, current_daily_emails, status, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (warmupError) throw warmupError;
        
        // Mapear dados para o formato esperado pelo store
        const mappedPlans: WarmupPlan[] = warmupPlans?.map(plan => ({
          id: plan.id,
          name: plan.name,
          emailAccountId: plan.account_id,
          startDate: plan.start_date,
          dailyIncrement: plan.daily_increment || 3,
          maxDailyEmails: plan.max_daily_emails || 50,
          currentDailyEmails: plan.current_daily_emails || 0,
          status: plan.status as 'active' | 'paused' | 'completed' || 'paused',
          createdAt: plan.created_at,
          updatedAt: plan.updated_at || plan.created_at
        })) || [];
        
        setPlans(mappedPlans);
      } catch (err: any) {
        console.error('Erro ao buscar planos de aquecimento:', err);
        setError(err.message || 'Erro ao carregar planos de aquecimento');
      } finally {
        setLoading(false);
      }
    };

    fetchWarmupPlans();
  }, [setPlans, setLoading, setError, supabase]);

  // Atualizar status de um plano no Supabase
  const togglePlanStatus = async (id: string, currentStatus: 'active' | 'paused' | 'completed') => {
    try {
      setLoadingActionId(id);
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      
      // Atualizar no Supabase
      const { error } = await supabase
        .from('warmup_plans')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      
      // Atualizar na store local
      updatePlan(id, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Erro ao atualizar status do plano:', err);
      setError(err.message || 'Erro ao atualizar status do plano');
    } finally {
      setLoadingActionId(null);
    }
  };

  // Remover um plano
  const handleRemovePlan = async (id: string) => {
    try {
      setLoadingActionId(id);
      
      // Remover do Supabase
      const { error } = await supabase
        .from('warmup_plans')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Remover da store local
      removePlan(id);
    } catch (err: any) {
      console.error('Erro ao remover plano de aquecimento:', err);
      setError(err.message || 'Erro ao remover plano de aquecimento');
    } finally {
      setLoadingActionId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Carregando planos de aquecimento...</span>
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

  if (plans.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
            <path d="M9 12h.01"></path>
            <path d="M15 12h.01"></path>
            <path d="M10 16c.5.3 1.5.5 2 .5s1.5-.2 2-.5"></path>
            <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"></path>
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-1">Nenhum plano de aquecimento cadastrado</h3>
        <p className="text-slate-500 mb-4">
          Crie um plano de aquecimento para começar a aumentar a reputação das suas contas.
        </p>
        <Button asChild>
          <a href="/warmup/create">Criar Plano</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Planos de Aquecimento</h2>
      <div className="grid gap-4">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`p-4 border rounded-lg ${
              plan.status === 'active' 
                ? 'border-blue-500' 
                : plan.status === 'paused' 
                  ? 'border-amber-500' 
                  : 'border-gray-300'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">{plan.name}</h3>
                <p className="text-sm text-gray-500">
                  Incremento diário: {plan.dailyIncrement} emails
                </p>
                <p className="text-sm text-gray-500">
                  Progresso: {plan.currentDailyEmails} / {plan.maxDailyEmails} emails
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Iniciado em: {new Date(plan.startDate).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant={plan.status === 'active' ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => togglePlanStatus(plan.id, plan.status)}
                  disabled={loadingActionId === plan.id}
                >
                  {loadingActionId === plan.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {plan.status === 'active' ? 'Pausando...' : 'Ativando...'}</>
                  ) : (
                    plan.status === 'active' ? 'Pausar' : 'Ativar'
                  )}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleRemovePlan(plan.id)}
                  disabled={loadingActionId === plan.id}
                >
                  {loadingActionId === plan.id && plan.status !== 'active' ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Removendo</>
                  ) : (
                    'Remover'
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-2 flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${
                    plan.status === 'active' 
                      ? 'bg-blue-600' 
                      : plan.status === 'paused' 
                        ? 'bg-amber-500' 
                        : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.min((plan.currentDailyEmails / plan.maxDailyEmails) * 100, 100)}%` }}
                ></div>
              </div>
              <span className="ml-2 text-xs text-gray-500">
                {Math.min(Math.round((plan.currentDailyEmails / plan.maxDailyEmails) * 100), 100)}%
              </span>
            </div>
            <div className="mt-2">
              <span 
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                  plan.status === 'active' 
                    ? 'bg-blue-100 text-blue-800' 
                    : plan.status === 'paused' 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {plan.status === 'active' 
                  ? 'Ativo' 
                  : plan.status === 'paused' 
                    ? 'Pausado' 
                    : 'Concluído'
                }
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};