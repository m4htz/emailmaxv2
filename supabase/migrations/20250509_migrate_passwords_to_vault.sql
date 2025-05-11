-- Migração para transferir senhas existentes para o Supabase Vault e remover campos depreciados
-- Esta migração move as senhas existentes para o Vault e adiciona funções de compatibilidade

-- Verificar se existem senhas para migrar
DO $$
DECLARE
  v_account RECORD;
  v_vault_id UUID;
  v_success BOOLEAN;
  v_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  -- Verificar se a extensão supabase_vault está instalada
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault'
  ) THEN
    RAISE NOTICE 'Extensão supabase_vault não instalada. As senhas não serão migradas.';
    RETURN;
  END IF;

  -- Criar função auxiliar para verificar se a coluna existe
  CREATE OR REPLACE FUNCTION column_exists(table_name text, column_name text) RETURNS boolean AS $$
  DECLARE
    exists boolean;
  BEGIN
    SELECT COUNT(*) > 0 INTO exists
    FROM information_schema.columns
    WHERE table_name = $1
    AND column_name = $2;
    RETURN exists;
  END;
  $$ LANGUAGE plpgsql;

  -- Migrar senhas da coluna 'password'
  IF column_exists('email_accounts', 'password') THEN
    FOR v_account IN 
      SELECT ea.id, ea.user_id, ea.email, ea.password 
      FROM email_accounts ea
      WHERE 
        ea.password IS NOT NULL AND 
        ea.password != '' AND 
        ea.password != '********' AND
        NOT EXISTS (
          SELECT 1 FROM secure_credentials sc 
          WHERE sc.account_id = ea.id AND sc.credential_type = 'password'
        )
    LOOP
      BEGIN
        -- Armazenar a senha no vault e obter o ID do segredo
        SELECT vault.create_secret(
          v_account.password, 
          CONCAT(v_account.id, ':password:main'),
          CONCAT('Senha para conta de email ', v_account.email)
        ) INTO v_vault_id;

        -- Criar registro na tabela secure_credentials
        INSERT INTO secure_credentials(
          user_id, account_id, credential_type, credential_key, vault_id
        )
        VALUES (
          v_account.user_id, 
          v_account.id, 
          'password', 
          'main', 
          v_vault_id
        );

        v_count := v_count + 1;
        
        -- Registrar sucesso
        RAISE NOTICE 'Migrada senha da conta %: %', v_account.id, v_account.email;
        
      EXCEPTION WHEN OTHERS THEN
        -- Registrar falha
        RAISE NOTICE 'Falha ao migrar senha da conta %: %. Erro: %', 
          v_account.id, v_account.email, SQLERRM;
        v_error_count := v_error_count + 1;
      END;
    END LOOP;
  END IF;

  -- Migrar senhas da coluna 'smtp_password'
  IF column_exists('email_accounts', 'smtp_password') THEN
    FOR v_account IN 
      SELECT ea.id, ea.user_id, ea.email, ea.smtp_password 
      FROM email_accounts ea
      WHERE 
        ea.smtp_password IS NOT NULL AND 
        ea.smtp_password != '' AND
        ea.smtp_password != '********' AND
        NOT EXISTS (
          SELECT 1 FROM secure_credentials sc 
          WHERE sc.account_id = ea.id AND sc.credential_type = 'smtp_password'
        )
    LOOP
      BEGIN
        -- Armazenar a senha no vault e obter o ID do segredo
        SELECT vault.create_secret(
          v_account.smtp_password, 
          CONCAT(v_account.id, ':smtp_password:main'),
          CONCAT('Senha SMTP para conta ', v_account.email)
        ) INTO v_vault_id;

        -- Criar registro na tabela secure_credentials
        INSERT INTO secure_credentials(
          user_id, account_id, credential_type, credential_key, vault_id
        )
        VALUES (
          v_account.user_id, 
          v_account.id, 
          'smtp_password', 
          'main', 
          v_vault_id
        );

        v_count := v_count + 1;
        
        -- Registrar sucesso
        RAISE NOTICE 'Migrada senha SMTP da conta %: %', v_account.id, v_account.email;
        
      EXCEPTION WHEN OTHERS THEN
        -- Registrar falha
        RAISE NOTICE 'Falha ao migrar senha SMTP da conta %: %. Erro: %', 
          v_account.id, v_account.email, SQLERRM;
        v_error_count := v_error_count + 1;
      END;
    END LOOP;
  END IF;

  -- Migrar senhas da coluna 'imap_password'
  IF column_exists('email_accounts', 'imap_password') THEN
    FOR v_account IN 
      SELECT ea.id, ea.user_id, ea.email, ea.imap_password 
      FROM email_accounts ea
      WHERE 
        ea.imap_password IS NOT NULL AND 
        ea.imap_password != '' AND
        ea.imap_password != '********' AND
        NOT EXISTS (
          SELECT 1 FROM secure_credentials sc 
          WHERE sc.account_id = ea.id AND sc.credential_type = 'imap_password'
        )
    LOOP
      BEGIN
        -- Armazenar a senha no vault e obter o ID do segredo
        SELECT vault.create_secret(
          v_account.imap_password, 
          CONCAT(v_account.id, ':imap_password:main'),
          CONCAT('Senha IMAP para conta ', v_account.email)
        ) INTO v_vault_id;

        -- Criar registro na tabela secure_credentials
        INSERT INTO secure_credentials(
          user_id, account_id, credential_type, credential_key, vault_id
        )
        VALUES (
          v_account.user_id, 
          v_account.id, 
          'imap_password', 
          'main', 
          v_vault_id
        );

        v_count := v_count + 1;
        
        -- Registrar sucesso
        RAISE NOTICE 'Migrada senha IMAP da conta %: %', v_account.id, v_account.email;
        
      EXCEPTION WHEN OTHERS THEN
        -- Registrar falha
        RAISE NOTICE 'Falha ao migrar senha IMAP da conta %: %. Erro: %', 
          v_account.id, v_account.email, SQLERRM;
        v_error_count := v_error_count + 1;
      END;
    END LOOP;
  END IF;

  -- Limpar função auxiliar
  DROP FUNCTION IF EXISTS column_exists;

  -- Relatório final
  RAISE NOTICE 'Migração concluída. % senhas migradas com sucesso, % erros.', v_count, v_error_count;
END;
$$;

-- Adicionar funções de compatibilidade para obter senhas de diferentes campos
-- Estas funções ajudam na transição para o novo modelo de armazenamento

-- 1. Função para obter senha de qualquer campo com fallback
CREATE OR REPLACE FUNCTION get_email_account_password(
  p_account_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_auth_type TEXT;
  v_password TEXT;
BEGIN
  -- Obter ID do usuário proprietário da conta
  SELECT user_id, auth_type INTO v_user_id, v_auth_type
  FROM email_accounts
  WHERE id = p_account_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Conta de email não encontrada';
  END IF;
  
  -- Contas OAuth não usam senha
  IF v_auth_type = 'oauth' THEN
    RETURN NULL;
  END IF;

  -- Tentar obter do Vault primeiro (senha geral)
  BEGIN
    SELECT get_secure_credential(v_user_id, p_account_id, 'password') 
    INTO v_password;
    
    IF v_password IS NOT NULL THEN
      RETURN v_password;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro e continuar tentando outros métodos
  END;
  
  -- Tentar obter senha SMTP do Vault
  BEGIN
    SELECT get_secure_credential(v_user_id, p_account_id, 'smtp_password') 
    INTO v_password;
    
    IF v_password IS NOT NULL THEN
      RETURN v_password;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro e continuar tentando outros métodos
  END;
  
  -- Fallback para campo 'password' (depreciado)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'password'
  ) THEN
    SELECT password INTO v_password
    FROM email_accounts
    WHERE id = p_account_id;
    
    IF v_password IS NOT NULL AND v_password != '' AND v_password != '********' THEN
      RETURN v_password;
    END IF;
  END IF;
  
  -- Fallback para campo 'smtp_password' (depreciado)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'smtp_password'
  ) THEN
    SELECT smtp_password INTO v_password
    FROM email_accounts
    WHERE id = p_account_id;
    
    IF v_password IS NOT NULL AND v_password != '' AND v_password != '********' THEN
      RETURN v_password;
    END IF;
  END IF;
  
  -- Não foi possível encontrar a senha
  RAISE EXCEPTION 'Senha não encontrada para a conta %', p_account_id;
END;
$$;

-- 2. Função para obter senha SMTP com fallback
CREATE OR REPLACE FUNCTION get_smtp_password(
  p_account_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_auth_type TEXT;
  v_password TEXT;
BEGIN
  -- Obter ID do usuário proprietário da conta
  SELECT user_id, auth_type INTO v_user_id, v_auth_type
  FROM email_accounts
  WHERE id = p_account_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Conta de email não encontrada';
  END IF;
  
  -- Contas OAuth não usam senha
  IF v_auth_type = 'oauth' THEN
    RETURN NULL;
  END IF;

  -- Tentar obter senha SMTP do Vault
  BEGIN
    SELECT get_secure_credential(v_user_id, p_account_id, 'smtp_password') 
    INTO v_password;
    
    IF v_password IS NOT NULL THEN
      RETURN v_password;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro e continuar tentando outros métodos
  END;
  
  -- Tentar obter senha geral do Vault como fallback
  BEGIN
    SELECT get_secure_credential(v_user_id, p_account_id, 'password') 
    INTO v_password;
    
    IF v_password IS NOT NULL THEN
      RETURN v_password;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro e continuar tentando outros métodos
  END;
  
  -- Fallback para campo 'smtp_password' (depreciado)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'smtp_password'
  ) THEN
    SELECT smtp_password INTO v_password
    FROM email_accounts
    WHERE id = p_account_id;
    
    IF v_password IS NOT NULL AND v_password != '' AND v_password != '********' THEN
      RETURN v_password;
    END IF;
  END IF;
  
  -- Fallback para campo 'password' (depreciado)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'password'
  ) THEN
    SELECT password INTO v_password
    FROM email_accounts
    WHERE id = p_account_id;
    
    IF v_password IS NOT NULL AND v_password != '' AND v_password != '********' THEN
      RETURN v_password;
    END IF;
  END IF;
  
  -- Não foi possível encontrar a senha
  RAISE EXCEPTION 'Senha SMTP não encontrada para a conta %', p_account_id;
END;
$$;

-- 3. Função para obter senha IMAP com fallback
CREATE OR REPLACE FUNCTION get_imap_password(
  p_account_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_auth_type TEXT;
  v_password TEXT;
BEGIN
  -- Obter ID do usuário proprietário da conta
  SELECT user_id, auth_type INTO v_user_id, v_auth_type
  FROM email_accounts
  WHERE id = p_account_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Conta de email não encontrada';
  END IF;
  
  -- Contas OAuth não usam senha
  IF v_auth_type = 'oauth' THEN
    RETURN NULL;
  END IF;

  -- Tentar obter senha IMAP do Vault
  BEGIN
    SELECT get_secure_credential(v_user_id, p_account_id, 'imap_password') 
    INTO v_password;
    
    IF v_password IS NOT NULL THEN
      RETURN v_password;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro e continuar tentando outros métodos
  END;
  
  -- Tentar obter senha geral do Vault como fallback
  BEGIN
    SELECT get_secure_credential(v_user_id, p_account_id, 'password') 
    INTO v_password;
    
    IF v_password IS NOT NULL THEN
      RETURN v_password;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro e continuar tentando outros métodos
  END;
  
  -- Fallback para campo 'imap_password' (depreciado)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'imap_password'
  ) THEN
    SELECT imap_password INTO v_password
    FROM email_accounts
    WHERE id = p_account_id;
    
    IF v_password IS NOT NULL AND v_password != '' AND v_password != '********' THEN
      RETURN v_password;
    END IF;
  END IF;
  
  -- Fallback para campo 'password' (depreciado)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'password'
  ) THEN
    SELECT password INTO v_password
    FROM email_accounts
    WHERE id = p_account_id;
    
    IF v_password IS NOT NULL AND v_password != '' AND v_password != '********' THEN
      RETURN v_password;
    END IF;
  END IF;
  
  -- Não foi possível encontrar a senha
  RAISE EXCEPTION 'Senha IMAP não encontrada para a conta %', p_account_id;
END;
$$;

-- Adicionar comentários para os campos depreciados
DO $$
BEGIN
  -- Comentário para o campo password
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'password'
  ) THEN
    COMMENT ON COLUMN email_accounts.password IS 'DEPRECIADO: Não use diretamente. Use funções get_email_account_password, get_smtp_password ou get_imap_password.';
  END IF;
  
  -- Comentário para o campo smtp_password
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'smtp_password'
  ) THEN
    COMMENT ON COLUMN email_accounts.smtp_password IS 'DEPRECIADO: Não use diretamente. Use a função get_smtp_password.';
  END IF;
  
  -- Comentário para o campo imap_password
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_accounts' AND column_name = 'imap_password'
  ) THEN
    COMMENT ON COLUMN email_accounts.imap_password IS 'DEPRECIADO: Não use diretamente. Use a função get_imap_password.';
  END IF;
END;
$$;