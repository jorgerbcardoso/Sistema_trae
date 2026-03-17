-- ============================================================================
-- MIGRAÇÃO: Adicionar coluna use_mock_data na tabela domains
-- ============================================================================
-- Data: 08/12/2024
-- Descrição: Adiciona controle para definir se o domínio usa dados mockados
--            ou dados reais do backend/API externa
-- ============================================================================

\c presto;

-- Verificar se a coluna já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'domains' 
        AND column_name = 'use_mock_data'
    ) THEN
        -- Adicionar coluna
        ALTER TABLE domains 
        ADD COLUMN use_mock_data BOOLEAN DEFAULT TRUE;
        
        RAISE NOTICE '✅ Coluna use_mock_data adicionada com sucesso!';
    ELSE
        RAISE NOTICE '⚠️  Coluna use_mock_data já existe!';
    END IF;
END $$;

-- Atualizar todos os domínios existentes para usar mock por padrão
UPDATE domains 
SET use_mock_data = TRUE 
WHERE use_mock_data IS NULL;

-- Adicionar comentário na coluna
COMMENT ON COLUMN domains.use_mock_data IS 
'Define se o domínio usa dados mockados (TRUE) ou dados reais do backend (FALSE)';

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_domains_use_mock_data 
ON domains(use_mock_data);

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Listar todos os domínios com a nova configuração
SELECT 
    domain,
    name,
    modalidade,
    use_mock_data,
    controla_linhas,
    is_active
FROM domains
ORDER BY domain;

-- Exibir resumo
SELECT '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!' AS status;
SELECT 
    'Total de domínios configurados: ' || COUNT(*) AS info
FROM domains;

SELECT 
    'Domínios usando MOCK: ' || COUNT(*) AS mock_count
FROM domains 
WHERE use_mock_data = TRUE;

SELECT 
    'Domínios usando BACKEND REAL: ' || COUNT(*) AS real_count
FROM domains 
WHERE use_mock_data = FALSE;
