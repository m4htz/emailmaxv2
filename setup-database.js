// Script para criar as tabelas básicas no Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Erro: Variáveis de ambiente do Supabase não definidas.');
  console.error('Verifique se .env.local contém NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function setupDatabase() {
  console.log('Configurando banco de dados...');
  
  try {
    // Criar tabela email_accounts se não existir
    const { error: emailAccountsError } = await supabase
      .from('email_accounts')
      .select('id')
      .limit(1);
    
    if (emailAccountsError && emailAccountsError.message.includes('does not exist')) {
      console.log('Criando tabela email_accounts...');
      
      // Criar a tabela
      const { error: createError } = await supabase.rpc('create_email_accounts_table');
      
      if (createError) {
        console.log('Erro ao usar RPC. Tentando método alternativo para criar tabela email_accounts...');
        
        // Usando SQL direto
        const { error: sqlError } = await supabase
          .from('_database_setup')
          .insert({
            setup_key: 'email_accounts_table',
            created_at: new Date().toISOString()
          });
        
        if (sqlError) {
          console.error('Erro ao tentar criar tabela email_accounts:', sqlError);
          console.log('\nVocê precisa criar a tabela manualmente pelo Console do Supabase.');
          console.log('Acesse o console do Supabase em: https://app.supabase.com');
          console.log('\nNavegue até seu projeto e execute o SQL abaixo na seção SQL Editor:');
          console.log(`
-- Habilita a extensão UUID para geração de IDs únicos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela para armazenar as contas de email
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email TEXT NOT NULL,
  password TEXT,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL,
  status TEXT NOT NULL,
  user_id UUID NOT NULL,
  name TEXT,
  error_message TEXT,
  auth_type TEXT
);

-- Políticas para permitir acesso somente aos próprios dados do usuário
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can CRUD their own email accounts" 
  ON email_accounts FOR ALL 
  USING (auth.uid() = user_id);
`);
        } else {
          console.log('Solicitação para criar tabela enviada com sucesso.');
        }
      } else {
        console.log('Tabela email_accounts criada com sucesso!');
      }
    } else {
      console.log('Tabela email_accounts já existe.');
    }
    
    // Testar se há acesso à tabela
    const { data, error } = await supabase
      .from('email_accounts')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('Erro ao acessar tabela email_accounts:', error);
    } else {
      console.log('Acesso à tabela email_accounts bem-sucedido!');
      console.log('Configuração do banco de dados concluída.');
    }
  } catch (error) {
    console.error('Erro durante a configuração do banco de dados:', error);
  }
}

setupDatabase();