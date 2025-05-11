-- Migração para consolidar a estrutura da tabela email_accounts
-- e resolver conflitos entre diferentes versões

-- Verificar se a tabela existe
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_accounts') THEN
        -- Tabela existe, verificar e adicionar colunas que podem estar faltando
        
        -- Verificar coluna name
        IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.email_accounts'::regclass AND attname = 'name') THEN
            ALTER TABLE public.email_accounts ADD COLUMN name TEXT;
            COMMENT ON COLUMN public.email_accounts.name IS 'Nome amigável para a conta de email';
        END IF;

        -- Verificar coluna error_message
        IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.email_accounts'::regclass AND attname = 'error_message') THEN
            ALTER TABLE public.email_accounts ADD COLUMN error_message TEXT;
            COMMENT ON COLUMN public.email_accounts.error_message IS 'Mensagem de erro detalhada caso a conexão IMAP falhe';
        END IF;

        -- Verificar coluna auth_type
        IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.email_accounts'::regclass AND attname = 'auth_type') THEN
            ALTER TABLE public.email_accounts ADD COLUMN auth_type TEXT DEFAULT 'password' CHECK (auth_type IN ('password', 'oauth'));
            COMMENT ON COLUMN public.email_accounts.auth_type IS 'Tipo de autenticação: password (senha de aplicativo) ou oauth';
        END IF;

        -- Verificar coluna oauth_provider
        IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.email_accounts'::regclass AND attname = 'oauth_provider') THEN
            ALTER TABLE public.email_accounts ADD COLUMN oauth_provider TEXT;
            COMMENT ON COLUMN public.email_accounts.oauth_provider IS 'Provedor OAuth (gmail, outlook, etc.)';
        END IF;

        -- Verificar coluna oauth_expires_at
        IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.email_accounts'::regclass AND attname = 'oauth_expires_at') THEN
            ALTER TABLE public.email_accounts ADD COLUMN oauth_expires_at TIMESTAMP WITH TIME ZONE;
            COMMENT ON COLUMN public.email_accounts.oauth_expires_at IS 'Data/hora de expiração do token de acesso OAuth';
        END IF;

        -- Verificar coluna last_token_refresh
        IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.email_accounts'::regclass AND attname = 'last_token_refresh') THEN
            ALTER TABLE public.email_accounts ADD COLUMN last_token_refresh TIMESTAMP WITH TIME ZONE;
            COMMENT ON COLUMN public.email_accounts.last_token_refresh IS 'Última vez que o token foi renovado';
        END IF;

        -- Verificar/corrigir constraint do status
        -- Remover e recriar constraint para padronizar valores permitidos
        DO $$
        BEGIN
            -- Tenta remover constraint existente (se houver)
            BEGIN
                ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS email_accounts_status_check;
            EXCEPTION
                WHEN undefined_object THEN
                    -- Ignora caso constraint não exista
            END;

            -- Adiciona constraint padronizada
            ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_status_check 
            CHECK (status IN ('pending', 'connected', 'warming_up', 'error'));
        END;
        $$;

        -- Adicionar comentário para senha depreciada
        COMMENT ON COLUMN public.email_accounts.password IS 'Depreciado: Use secure_credentials para senhas';

        -- Adicionar comentário para toda tabela
        COMMENT ON TABLE public.email_accounts IS 'Armazena configurações de contas de email dos usuários';
        
    END IF;
END
$$;

-- Criar índices necessários que podem estar faltando
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON public.email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON public.email_accounts(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_oauth_expires 
ON public.email_accounts(oauth_expires_at) 
WHERE auth_type = 'oauth';

-- Verificar e criar função/trigger de atualização do timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verificar e criar o trigger para atualização do timestamp
DROP TRIGGER IF EXISTS update_email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER update_email_accounts_updated_at
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Verificar e criar o trigger para atualização do timestamp de token OAuth
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_token_refresh_timestamp'
    ) THEN
        CREATE OR REPLACE FUNCTION update_last_token_refresh()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.last_token_refresh = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER update_token_refresh_timestamp
        BEFORE UPDATE OF oauth_expires_at
        ON email_accounts
        FOR EACH ROW
        WHEN (OLD.oauth_expires_at IS DISTINCT FROM NEW.oauth_expires_at)
        EXECUTE FUNCTION update_last_token_refresh();
    END IF;
END
$$;

-- Verificar e aplicar políticas RLS (Row Level Security)
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Criar políticas RLS que podem estar faltando
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_accounts' 
        AND policyname = 'Usuários podem ver apenas suas próprias contas de email'
    ) THEN
        CREATE POLICY "Usuários podem ver apenas suas próprias contas de email"
        ON public.email_accounts FOR SELECT
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_accounts' 
        AND policyname = 'Usuários podem inserir apenas suas próprias contas de email'
    ) THEN
        CREATE POLICY "Usuários podem inserir apenas suas próprias contas de email"
        ON public.email_accounts FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_accounts' 
        AND policyname = 'Usuários podem atualizar apenas suas próprias contas de email'
    ) THEN
        CREATE POLICY "Usuários podem atualizar apenas suas próprias contas de email"
        ON public.email_accounts FOR UPDATE
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_accounts' 
        AND policyname = 'Usuários podem excluir apenas suas próprias contas de email'
    ) THEN
        CREATE POLICY "Usuários podem excluir apenas suas próprias contas de email"
        ON public.email_accounts FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Criar trigger para remover credenciais quando uma conta for excluída (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'email_account_delete_trigger'
    ) THEN
        CREATE OR REPLACE FUNCTION cleanup_credentials_on_account_delete()
        RETURNS TRIGGER AS $$
        BEGIN
          DELETE FROM secure_credentials WHERE account_id = OLD.id;
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER email_account_delete_trigger
        BEFORE DELETE ON email_accounts
        FOR EACH ROW
        EXECUTE FUNCTION cleanup_credentials_on_account_delete();
    END IF;
END
$$;