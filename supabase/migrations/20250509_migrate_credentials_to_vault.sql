-- Migração para transferir senhas do campo depreciado para o Supabase Vault (secure_credentials)
-- Esta migração transfere os dados com segurança e mantém compatibilidade com versões anteriores

-- Verificar se existem credenciais para migrar
DO $$
DECLARE
  v_account RECORD;
  v_vault_id UUID;
  v_success BOOLEAN;
  v_count INTEGER := 0;
BEGIN
  -- Verificar se a extensão supabase_vault está instalada
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault'
  ) THEN
    RAISE NOTICE 'Extensão supabase_vault não instalada. As senhas não serão migradas.';
    RETURN;
  END IF;

  -- Verificar se as tabelas necessárias existem
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_accounts'
  ) THEN
    RAISE NOTICE 'Tabela email_accounts não existe. Nada a migrar.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'secure_credentials'
  ) THEN
    RAISE NOTICE 'Tabela secure_credentials não existe. Nada a migrar.';
    RETURN;
  END IF;

  -- Analisar cada conta que tem senha armazenada no campo depreciado
  -- e que ainda não tem uma entrada correspondente na tabela secure_credentials
  FOR v_account IN 
    SELECT ea.id, ea.user_id, ea.email, ea.password 
    FROM email_accounts ea
    WHERE 
      ea.password IS NOT NULL AND 
      ea.password != '' AND 
      NOT EXISTS (
        SELECT 1 FROM secure_credentials sc 
        WHERE sc.account_id = ea.id AND sc.credential_type = 'password'
      )
  LOOP
    -- Ignorar contas que usam OAuth (não precisam de senha)
    CONTINUE WHEN (
      SELECT auth_type FROM email_accounts WHERE id = v_account.id
    ) = 'oauth';

    -- Migrar a senha para o Vault
    BEGIN
      -- Armazenar a senha no vault e obter o ID do segredo
      SELECT vault.create_secret(
        v_account.password, 
        CONCAT(v_account.id, ':password:smtp'),
        CONCAT('Senha SMTP para conta ', v_account.email)
      ) INTO v_vault_id;

      -- Criar registro na tabela secure_credentials
      INSERT INTO secure_credentials(
        user_id, account_id, credential_type, credential_key, vault_id
      )
      VALUES (
        v_account.user_id, 
        v_account.id, 
        'password', 
        'smtp', 
        v_vault_id
      );

      v_count := v_count + 1;
      
      -- Registrar sucesso
      RAISE NOTICE 'Migrada senha da conta %: %', v_account.id, v_account.email;
      
      -- Não apagar a senha original ainda, para manter compatibilidade
      -- Isso será feito em uma migração futura quando todas as partes do sistema
      -- forem atualizadas para usar a nova tabela secure_credentials
      
    EXCEPTION WHEN OTHERS THEN
      -- Registrar falha
      RAISE NOTICE 'Falha ao migrar senha da conta %: %. Erro: %', 
        v_account.id, v_account.email, SQLERRM;
    END;
  END LOOP;

  -- Relatório final
  RAISE NOTICE 'Migração concluída. % contas processadas.', v_count;
END;
$$;

-- Adicionar ou atualizar comentário para o campo depreciado
COMMENT ON COLUMN email_accounts.password IS 'DEPRECIADO: Não use para novas contas. As senhas estão sendo migradas para secure_credentials usando Supabase Vault.';

-- Criar função para obter senha via Vault, com fallback para campo depreciado
CREATE OR REPLACE FUNCTION get_account_password(
  p_user_id UUID,
  p_account_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_password TEXT;
  v_auth_type TEXT;
BEGIN
  -- Verificar se o usuário tem acesso à conta
  IF NOT EXISTS (
    SELECT 1 FROM email_accounts 
    WHERE id = p_account_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado à conta de email';
  END IF;
  
  -- Verificar tipo de autenticação da conta
  SELECT auth_type INTO v_auth_type
  FROM email_accounts
  WHERE id = p_account_id;
  
  -- Contas OAuth não usam senha
  IF v_auth_type = 'oauth' THEN
    RETURN NULL;
  END IF;

  -- Primeiro, tentar obter a senha do Vault (novo método)
  BEGIN
    SELECT get_secure_credential(p_user_id, p_account_id, 'password') 
    INTO v_password;
    
    -- Se conseguiu obter a senha do Vault, retornar
    IF v_password IS NOT NULL THEN
      RETURN v_password;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Se houver qualquer erro, continuar e tentar o fallback
    RAISE NOTICE 'Erro ao obter senha do Vault: %', SQLERRM;
  END;

  -- Fallback: tentar obter a senha do campo depreciado
  SELECT password INTO v_password
  FROM email_accounts
  WHERE id = p_account_id AND user_id = p_user_id;
  
  RETURN v_password;
END;
$$;

-- Criar função para verificar se a conta já foi migrada para o Vault
CREATE OR REPLACE FUNCTION is_account_password_in_vault(
  p_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM secure_credentials
    WHERE account_id = p_account_id AND credential_type = 'password'
  );
END;
$$;