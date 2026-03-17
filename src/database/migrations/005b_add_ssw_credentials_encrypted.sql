-- ============================================
-- MIGRATION 005B: Adicionar credenciais SSW (COM CRIPTOGRAFIA)
-- ============================================
-- Data: 2024-12-09
-- Descrição: Adiciona colunas para armazenar credenciais SSW
--            com criptografia usando pgcrypto
-- ============================================

-- Habilitar extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Adicionar colunas para credenciais SSW
ALTER TABLE domains 
ADD COLUMN IF NOT EXISTS ssw_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS ssw_password_encrypted TEXT;

-- Comentários nas colunas
COMMENT ON COLUMN domains.ssw_username IS 'Usuário de autenticação SSW para integração';
COMMENT ON COLUMN domains.ssw_password_encrypted IS 'Senha de autenticação SSW criptografada com AES256';

-- Chave de criptografia (MUDAR ISSO EM PRODUÇÃO!)
-- IMPORTANTE: Armazenar essa chave em variável de ambiente, NÃO no banco!
DO $$
DECLARE
  encryption_key TEXT := 'Web@presto1234_SSW_ENCRYPTION_KEY_2024'; -- MUDAR EM PRODUÇÃO!
BEGIN
  -- Inserir credenciais criptografadas para domínios de teste
  UPDATE domains 
  SET 
    ssw_username = CASE 
      WHEN code = 'XXX' THEN 'presto_ssw'
      WHEN code = 'ACV' THEN 'aceville_ssw'
      WHEN code = 'VCS' THEN 'vcs_ssw'
      ELSE NULL
    END,
    ssw_password_encrypted = CASE 
      WHEN code = 'XXX' THEN encode(encrypt('senha_ssw_presto', encryption_key, 'aes'), 'base64')
      WHEN code = 'ACV' THEN encode(encrypt('senha_ssw_aceville', encryption_key, 'aes'), 'base64')
      WHEN code = 'VCS' THEN encode(encrypt('senha_ssw_vcs', encryption_key, 'aes'), 'base64')
      ELSE NULL
    END
  WHERE code IN ('XXX', 'ACV', 'VCS');
  
  RAISE NOTICE '✅ Credenciais SSW criptografadas com sucesso!';
END $$;

-- Função helper para CRIPTOGRAFAR senhas SSW
CREATE OR REPLACE FUNCTION encrypt_ssw_password(
  plain_password TEXT,
  encryption_key TEXT DEFAULT 'Web@presto1234_SSW_ENCRYPTION_KEY_2024'
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(encrypt(plain_password, encryption_key, 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função helper para DESCRIPTOGRAFAR senhas SSW
CREATE OR REPLACE FUNCTION decrypt_ssw_password(
  encrypted_password TEXT,
  encryption_key TEXT DEFAULT 'Web@presto1234_SSW_ENCRYPTION_KEY_2024'
) RETURNS TEXT AS $$
BEGIN
  RETURN convert_from(decrypt(decode(encrypted_password, 'base64'), encryption_key, 'aes'), 'utf-8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar alterações (mostrando senha descriptografada apenas para teste)
SELECT 
  id,
  code,
  name,
  ssw_username,
  decrypt_ssw_password(ssw_password_encrypted) as ssw_password_decrypted,
  is_active
FROM domains
WHERE ssw_password_encrypted IS NOT NULL
ORDER BY code;

-- Log da migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 005B aplicada com sucesso!';
  RAISE NOTICE '   - Extensão pgcrypto habilitada';
  RAISE NOTICE '   - Colunas ssw_username e ssw_password_encrypted adicionadas';
  RAISE NOTICE '   - Funções encrypt_ssw_password() e decrypt_ssw_password() criadas';
  RAISE NOTICE '   - Credenciais de exemplo criptografadas para domínios XXX, ACV e VCS';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '   1. Mude a chave de criptografia em PRODUÇÃO!';
  RAISE NOTICE '   2. Armazene a chave em variável de ambiente';
  RAISE NOTICE '   3. Nunca commite a chave no Git';
END $$;
