/**
 * Mocks para o Supabase utilizados nos testes.
 * Este arquivo centraliza os mocks para garantir consistência entre os testes.
 */

// Mock de usuário padrão
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    name: 'Test User'
  }
};

// Mock de sessão padrão
export const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Date.now() + 3600000, // 1 hora no futuro
  user: mockUser
};

// Mock de conta de email
export const mockEmailAccount = {
  id: 'account-id-1',
  user_id: mockUser.id,
  email_address: 'test@example.com',
  display_name: 'Test Email Account',
  smtp_host: 'smtp.example.com',
  smtp_port: 587,
  imap_host: 'imap.example.com',
  imap_port: 993,
  smtp_username: 'test@example.com',
  imap_username: 'test@example.com',
  provider: 'gmail',
  connection_status: 'connected',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z'
};

// Mock de plano de aquecimento
export const mockWarmupPlan = {
  id: 'plan-id-1',
  account_id: 'account-id-1',
  user_id: mockUser.id,
  daily_volume: 5,
  reply_percentage: 70,
  active: true,
  status: 'active',
  start_date: '2023-01-01T00:00:00Z',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z'
};

// Mock de métrica de aquecimento
export const mockWarmupMetric = {
  id: 'metric-id-1',
  plan_id: 'plan-id-1',
  user_id: mockUser.id,
  emails_sent: 10,
  emails_delivered: 9,
  emails_opened: 7,
  emails_replied: 3,
  date: '2023-01-02',
  created_at: '2023-01-02T00:00:00Z'
};

// Array com múltiplas contas de email para testes
export const mockEmailAccounts = [
  mockEmailAccount,
  {
    ...mockEmailAccount,
    id: 'account-id-2',
    email_address: 'work@example.com',
    display_name: 'Work Email',
    provider: 'outlook'
  },
  {
    ...mockEmailAccount,
    id: 'account-id-3',
    email_address: 'personal@example.com',
    display_name: 'Personal Email',
    provider: 'gmail',
    connection_status: 'error'
  }
];

// Array com múltiplos planos de aquecimento para testes
export const mockWarmupPlans = [
  mockWarmupPlan,
  {
    ...mockWarmupPlan,
    id: 'plan-id-2',
    account_id: 'account-id-2',
    daily_volume: 10,
    status: 'paused'
  }
];

// Array com múltiplas métricas para testes
export const mockWarmupMetrics = [
  mockWarmupMetric,
  {
    ...mockWarmupMetric,
    id: 'metric-id-2',
    date: '2023-01-03',
    emails_sent: 12,
    emails_delivered: 12,
    emails_opened: 8,
    emails_replied: 4
  }
];

/**
 * Helper para criar mock de erro Supabase
 */
export const createSupabaseError = (message: string, code = 'unknown_error') => {
  return {
    message,
    code,
    details: null,
    hint: null
  };
};

/**
 * Helper para criar mock de resposta do Supabase
 */
export const createSupabaseResponse = <T>(data: T | null = null, error: any = null) => {
  return {
    data,
    error
  };
};

/**
 * Classe de mock para criar clientes Supabase para testes
 */
export class SupabaseMockBuilder {
  private authMock: any = {
    getSession: jest.fn().mockResolvedValue(createSupabaseResponse({ session: mockSession })),
    signInWithPassword: jest.fn().mockResolvedValue(createSupabaseResponse({ session: mockSession, user: mockUser })),
    signOut: jest.fn().mockResolvedValue(createSupabaseResponse({})),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    refreshSession: jest.fn().mockResolvedValue(createSupabaseResponse({ session: mockSession }))
  };

  private fromResults: Map<string, any> = new Map();

  /**
   * Configura o mock para auth
   */
  withAuth(authMock: any) {
    this.authMock = { ...this.authMock, ...authMock };
    return this;
  }

  /**
   * Configura o mock para tabela específica
   */
  withTable(table: string, mockData: any) {
    this.fromResults.set(table, mockData);
    return this;
  }

  /**
   * Configura o mock para email_accounts
   */
  withEmailAccounts(accounts = mockEmailAccounts) {
    return this.withTable('email_accounts', accounts);
  }

  /**
   * Configura o mock para warmup_plans
   */
  withWarmupPlans(plans = mockWarmupPlans) {
    return this.withTable('warmup_plans', plans);
  }

  /**
   * Configura o mock para warmup_metrics
   */
  withWarmupMetrics(metrics = mockWarmupMetrics) {
    return this.withTable('warmup_metrics', metrics);
  }

  /**
   * Constrói o cliente mockado
   */
  build() {
    // Mock básico para operações de banco de dados
    const dbQueryChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => {
        const tableName = (this as any)._table;
        const mockData = this.fromResults.get(tableName);
        
        if (Array.isArray(mockData) && mockData.length > 0) {
          return createSupabaseResponse(mockData[0]);
        }
        
        return createSupabaseResponse(null);
      }),
      maybeSingle: jest.fn().mockImplementation(() => {
        const tableName = (this as any)._table;
        const mockData = this.fromResults.get(tableName);
        
        if (Array.isArray(mockData) && mockData.length > 0) {
          return createSupabaseResponse(mockData[0]);
        }
        
        return createSupabaseResponse(null);
      }),
      then: jest.fn().mockImplementation((resolve) => {
        const tableName = (this as any)._table;
        const mockData = this.fromResults.get(tableName);
        resolve(createSupabaseResponse(mockData));
        return Promise.resolve(createSupabaseResponse(mockData));
      })
    };

    // Mock para from
    const from = jest.fn().mockImplementation((table: string) => {
      const chain = { ...dbQueryChain, _table: table };
      
      // Sobreescrever then para retornar dados específicos da tabela
      chain.then = jest.fn().mockImplementation((resolve) => {
        const mockData = this.fromResults.get(table);
        resolve(createSupabaseResponse(mockData));
        return Promise.resolve(createSupabaseResponse(mockData));
      });
      
      return chain;
    });

    // Cliente completo
    return {
      auth: this.authMock,
      from,
      rpc: jest.fn().mockImplementation((func) => ({
        ...dbQueryChain,
        _func: func
      }))
    };
  }
}

/**
 * Cria um mock padrão do Supabase para testes
 */
export const createSupabaseMock = () => {
  return new SupabaseMockBuilder()
    .withEmailAccounts()
    .withWarmupPlans()
    .withWarmupMetrics()
    .build();
};