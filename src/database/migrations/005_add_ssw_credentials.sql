-- ============================================
-- MIGRATION 005: Adicionar credenciais SSW
-- ============================================
-- Data: 2024-12-09
-- Descrição: Adiciona colunas para armazenar credenciais SSW
--            (usuário e senha) na tabela domains
-- ============================================

-- Adicionar colunas para credenciais SSW
ALTER TABLE domains 
ADD COLUMN IF NOT EXISTS ssw_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS ssw_password VARCHAR(255);

-- Comentários nas colunas
COMMENT ON COLUMN domains.ssw_username IS 'Usuário de autenticação SSW para integração';
COMMENT ON COLUMN domains.ssw_password IS 'Senha de autenticação SSW (deve ser criptografada)';

-- Atualizar domínios existentes com credenciais de exemplo (APENAS PARA DEV/TESTE)
-- IMPORTANTE: Remover ou ajustar isso em produção!
UPDATE domains 
SET 
  ssw_username = CASE 
    WHEN code = 'XXX' THEN 'presto_ssw'
    WHEN code = 'ACV' THEN 'aceville_ssw'
    WHEN code = 'VCS' THEN 'vcs_ssw'
    ELSE NULL
  END,
  ssw_password = CASE 
    WHEN code = 'XXX' THEN 'senha_ssw_presto'
    WHEN code = 'ACV' THEN 'senha_ssw_aceville'
    WHEN code = 'VCS' THEN 'senha_ssw_vcs'
    ELSE NULL
  END
WHERE code IN ('XXX', 'ACV', 'VCS');

-- Verificar alterações
SELECT 
  id,
  code,
  name,
  ssw_username,
  CASE 
    WHEN ssw_password IS NOT NULL THEN '********' 
    ELSE NULL 
  END as ssw_password_masked,
  is_active
FROM domains
ORDER BY code;

-- Log da migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 005 aplicada com sucesso!';
  RAISE NOTICE '   - Colunas ssw_username e ssw_password adicionadas';
  RAISE NOTICE '   - Credenciais de exemplo configuradas para domínios XXX, ACV e VCS';
  RAISE NOTICE '   ⚠️  IMPORTANTE: Em produção, use senhas fortes e criptografadas!';
END $$;
