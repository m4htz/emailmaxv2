// Script para criar as tabelas no Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente manualmente de .env.local
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Erro: Variáveis de ambiente do Supabase não definidas.');
  console.error('Verifique se .env.local contém NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Ler todos os arquivos de migração
const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort(); // Ordenar para garantir que sejam aplicados na ordem correta

// Função para aplicar as migrações
async function applyMigrations() {
  console.log('Iniciando aplicação das migrações...');

  for (const file of migrationFiles) {
    console.log(`Aplicando migração: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    // Quebrar o arquivo SQL em comandos separados
    const commands = sql.split(';').filter(cmd => cmd.trim() !== '');
    
    for (const command of commands) {
      if (command.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: command });
          
          if (error) {
            console.error(`Erro ao executar comando SQL de ${file}:`, error.message);
            console.error('Comando:', command);
            // Continuar mesmo com erros para tentar aplicar o máximo de comandos possível
          }
        } catch (err) {
          console.error(`Exceção ao executar comando SQL de ${file}:`, err);
          console.error('Comando:', command);
          // Continuar mesmo com erros
        }
      }
    }
    
    console.log(`Migração ${file} aplicada.`);
  }
  
  console.log('Todas as migrações foram processadas.');
}

// Função alternativa para criar tabelas diretamente
async function createBasicTables() {
  console.log('Criando tabelas básicas diretamente...');
  
  // Habilitar UUID
  try {
    const { error: uuidError } = await supabase.rpc('exec_sql', { 
      sql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' 
    });
    if (uuidError) console.error('Erro ao habilitar UUID:', uuidError.message);
  } catch (e) {
    console.error('Erro ao habilitar UUID:', e);
  }
  
  // Criar tabela email_accounts
  try {
    const { error } = await supabase.rpc('exec_sql', { 
      sql: `
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
        status TEXT NOT NULL CHECK (status IN ('connected', 'warming_up', 'error')),
        user_id UUID NOT NULL,
        last_checked TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        name TEXT,
        auth_type TEXT CHECK (auth_type IN ('password', 'oauth')),
        oauth_refresh_token TEXT,
        oauth_access_token TEXT,
        oauth_expires_at TIMESTAMP WITH TIME ZONE
      )`
    });
    if (error) {
      console.error('Erro ao criar tabela email_accounts:', error.message);
      // Tentar um esquema mais simples se falhar
      const { error: simpleError } = await supabase.rpc('exec_sql', { 
        sql: `
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
          user_id UUID NOT NULL
        )`
      });
      if (simpleError) console.error('Erro ao criar tabela email_accounts simplificada:', simpleError.message);
      else console.log('Tabela email_accounts (versão simplificada) criada com sucesso!');
    } else {
      console.log('Tabela email_accounts criada com sucesso!');
    }
  } catch (e) {
    console.error('Erro ao criar tabela email_accounts:', e);
  }

  // Criar função para atualizar o updated_at
  try {
    const { error } = await supabase.rpc('exec_sql', { 
      sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
         NEW.updated_at = NOW();
         RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;`
    });
    if (error) console.error('Erro ao criar função update_updated_at_column:', error.message);
    else console.log('Função update_updated_at_column criada com sucesso!');
  } catch (e) {
    console.error('Erro ao criar função update_updated_at_column:', e);
  }

  // Adicionar trigger para email_accounts
  try {
    const { error } = await supabase.rpc('exec_sql', { 
      sql: `
      CREATE TRIGGER update_email_accounts_updated_at
      BEFORE UPDATE ON email_accounts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();`
    });
    if (error) console.error('Erro ao criar trigger para email_accounts:', error.message);
    else console.log('Trigger para email_accounts criado com sucesso!');
  } catch (e) {
    console.error('Erro ao criar trigger para email_accounts:', e);
  }

  // Habilitar RLS
  try {
    const { error } = await supabase.rpc('exec_sql', { 
      sql: `ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;`
    });
    if (error) console.error('Erro ao habilitar RLS para email_accounts:', error.message);
    else console.log('RLS para email_accounts habilitado com sucesso!');
  } catch (e) {
    console.error('Erro ao habilitar RLS para email_accounts:', e);
  }

  // Adicionar política RLS
  try {
    const { error } = await supabase.rpc('exec_sql', { 
      sql: `
      CREATE POLICY "User can CRUD their own email accounts" 
      ON email_accounts FOR ALL 
      USING (auth.uid() = user_id);`
    });
    if (error) console.error('Erro ao criar política RLS para email_accounts:', error.message);
    else console.log('Política RLS para email_accounts criada com sucesso!');
  } catch (e) {
    console.error('Erro ao criar política RLS para email_accounts:', e);
  }

  console.log('Processo de criação de tabelas concluído.');
}

// Tentar criar a função exec_sql
async function createExecSqlFunction() {
  try {
    const { error } = await supabase.from('_temp_test').select('*').limit(1);
    
    if (error && error.message.includes('exec_sql')) {
      console.log('Função exec_sql não existe. Tentando outro método...');
      return false;
    }
    return true;
  } catch (e) {
    console.error('Erro ao verificar função exec_sql:', e);
    return false;
  }
}

// Função principal
async function main() {
  try {
    console.log('Conectando ao Supabase...');

    // Verificar se a função exec_sql existe
    const hasExecSql = await createExecSqlFunction();
    
    if (hasExecSql) {
      // Tentar aplicar migrações completas
      await applyMigrations();
    } else {
      // Criar tabelas básicas diretamente
      await createBasicTables();
    }

    console.log('Processo concluído com sucesso!');
  } catch (error) {
    console.error('Erro durante o processo:', error);
  }
}

// Executar script
main();