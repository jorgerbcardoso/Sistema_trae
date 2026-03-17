-- ============================================================================
-- MIGRAÇÃO SEGURA: Adicionar coluna use_mock_data
-- ============================================================================
-- Este script:
-- 1. Verifica dados existentes
-- 2. Adiciona a coluna se não existir
-- 3. Mostra o antes e depois
-- 4. Não perde nenhum dado
-- ============================================================================

\c presto;

\echo '========================================';
\echo '🔍 PASSO 1: VERIFICANDO DADOS EXISTENTES';
\echo '========================================';

-- Mostrar estrutura atual da tabela domains
\echo '';
\echo '📋 Colunas atuais da tabela DOMAINS:';
SELECT 
    column_name,
    data_type,
    COALESCE(column_default, 'NULL') AS default_value,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'domains'
ORDER BY ordinal_position;

\echo '';
\echo '📊 Domínios existentes no banco:';
SELECT 
    domain,
    name,
    client_name,
    modalidade,
    CASE 
        WHEN controla_linhas = TRUE THEN 'SIM'
        WHEN controla_linhas = FALSE THEN 'NÃO'
        ELSE 'NULL'
    END AS controla_linhas,
    is_active
FROM domains
ORDER BY domain;

\echo '';
\echo '📈 Total de registros:';
SELECT COUNT(*) AS total_dominios FROM domains;

-- ============================================================================
-- PASSO 2: VERIFICAR SE A COLUNA JÁ EXISTE
-- ============================================================================

\echo '';
\echo '========================================';
\echo '🔍 PASSO 2: VERIFICANDO COLUNA use_mock_data';
\echo '========================================';

DO $$ 
DECLARE
    coluna_existe BOOLEAN;
BEGIN
    -- Verificar se a coluna existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'domains' 
        AND column_name = 'use_mock_data'
    ) INTO coluna_existe;
    
    IF coluna_existe THEN
        RAISE NOTICE '⚠️  A coluna use_mock_data JÁ EXISTE na tabela domains';
        RAISE NOTICE '✅ Nenhuma ação necessária';
    ELSE
        RAISE NOTICE '❌ A coluna use_mock_data NÃO EXISTE';
        RAISE NOTICE '➡️  Será criada a seguir...';
    END IF;
END $$;

-- ============================================================================
-- PASSO 3: ADICIONAR A COLUNA (SE NÃO EXISTIR)
-- ============================================================================

\echo '';
\echo '========================================';
\echo '🔧 PASSO 3: ADICIONANDO COLUNA (se necessário)';
\echo '========================================';

DO $$ 
BEGIN
    -- Tentar adicionar a coluna
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'domains' 
        AND column_name = 'use_mock_data'
    ) THEN
        -- Adicionar coluna
        ALTER TABLE domains 
        ADD COLUMN use_mock_data BOOLEAN DEFAULT TRUE;
        
        RAISE NOTICE '✅ Coluna use_mock_data adicionada com sucesso!';
        RAISE NOTICE '📋 Tipo: BOOLEAN';
        RAISE NOTICE '🔧 Default: TRUE (todos os domínios usarão MOCK por padrão)';
    ELSE
        RAISE NOTICE '⚠️  Coluna já existe - pulando adição';
    END IF;
END $$;

-- Atualizar valores NULL para TRUE (se houver)
UPDATE domains 
SET use_mock_data = TRUE 
WHERE use_mock_data IS NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN domains.use_mock_data IS 
'Define se o domínio usa dados mockados (TRUE) ou dados reais do backend/API externa (FALSE). Default: TRUE';

-- ============================================================================
-- PASSO 4: CRIAR ÍNDICE PARA PERFORMANCE
-- ============================================================================

\echo '';
\echo '========================================';
\echo '⚡ PASSO 4: CRIANDO ÍNDICE PARA PERFORMANCE';
\echo '========================================';

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_domains_use_mock_data'
    ) THEN
        CREATE INDEX idx_domains_use_mock_data ON domains(use_mock_data);
        RAISE NOTICE '✅ Índice idx_domains_use_mock_data criado';
    ELSE
        RAISE NOTICE '⚠️  Índice já existe - pulando criação';
    END IF;
END $$;

-- ============================================================================
-- PASSO 5: VERIFICAR RESULTADO FINAL
-- ============================================================================

\echo '';
\echo '========================================';
\echo '✅ PASSO 5: VERIFICANDO RESULTADO FINAL';
\echo '========================================';

-- Mostrar estrutura atualizada
\echo '';
\echo '📋 Estrutura ATUALIZADA da tabela DOMAINS:';
SELECT 
    column_name,
    data_type,
    COALESCE(column_default, 'NULL') AS default_value,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'domains'
ORDER BY ordinal_position;

-- Mostrar dados com a nova coluna
\echo '';
\echo '📊 Domínios com a nova coluna use_mock_data:';
SELECT 
    domain,
    name,
    modalidade,
    CASE use_mock_data 
        WHEN TRUE THEN '📊 MOCK'
        WHEN FALSE THEN '🔗 REAL'
        ELSE '❓ NULL'
    END AS modo_dados,
    CASE controla_linhas
        WHEN TRUE THEN '✅ SIM'
        WHEN FALSE THEN '❌ NÃO'
        ELSE '❓ NULL'
    END AS controla_linhas,
    CASE is_active
        WHEN TRUE THEN '✅ ATIVO'
        WHEN FALSE THEN '❌ INATIVO'
        ELSE '❓ NULL'
    END AS status
FROM domains
ORDER BY domain;

-- Estatísticas finais
\echo '';
\echo '========================================';
\echo '📈 ESTATÍSTICAS FINAIS';
\echo '========================================';

SELECT 
    COUNT(*) AS total_dominios,
    COUNT(*) FILTER (WHERE use_mock_data = TRUE) AS usando_mock,
    COUNT(*) FILTER (WHERE use_mock_data = FALSE) AS usando_real,
    COUNT(*) FILTER (WHERE use_mock_data IS NULL) AS nao_definido
FROM domains;

-- Listar índices criados
\echo '';
\echo '🔍 Índices na tabela DOMAINS:';
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'domains'
ORDER BY indexname;

-- ============================================================================
-- PASSO 6: ORIENTAÇÕES FINAIS
-- ============================================================================

\echo '';
\echo '========================================';
\echo '📝 ORIENTAÇÕES FINAIS';
\echo '========================================';
\echo '';
\echo '✅ Migração concluída com sucesso!';
\echo '';
\echo '🔧 Para alterar um domínio específico:';
\echo '   UPDATE domains SET use_mock_data = FALSE WHERE domain = ''XXX'';';
\echo '';
\echo '🔧 Para alterar todos os domínios:';
\echo '   UPDATE domains SET use_mock_data = FALSE;';
\echo '';
\echo '🔍 Para verificar configuração atual:';
\echo '   SELECT domain, name, use_mock_data FROM domains;';
\echo '';
\echo '📊 Comportamento atual:';
\echo '   - use_mock_data = TRUE  → Dashboard retorna dados MOCKADOS';
\echo '   - use_mock_data = FALSE → Dashboard retorna dados REAIS do backend';
\echo '';
\echo '⚠️  IMPORTANTE:';
\echo '   Todos os domínios foram configurados com use_mock_data = TRUE';
\echo '   Isso significa que TODOS estão usando dados MOCKADOS';
\echo '';
\echo '========================================';

-- ============================================================================
-- SCRIPT DE TESTE (OPCIONAL - COMENTADO)
-- ============================================================================

-- Para testar, descomente as linhas abaixo:

-- Testar mudança para backend real em um domínio específico
-- UPDATE domains SET use_mock_data = FALSE WHERE domain = 'XXX';
-- SELECT domain, name, use_mock_data FROM domains WHERE domain = 'XXX';

-- Voltar para mock
-- UPDATE domains SET use_mock_data = TRUE WHERE domain = 'XXX';
-- SELECT domain, name, use_mock_data FROM domains WHERE domain = 'XXX';
