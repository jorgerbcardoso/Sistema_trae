-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO: Coluna use_mock_data
-- ============================================================================
-- Verifica se a coluna use_mock_data existe e mostra o estado atual
-- ============================================================================

\c presto;

-- ============================================================================
-- 1. VERIFICAR SE A COLUNA EXISTE
-- ============================================================================

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Coluna use_mock_data EXISTE'
        ELSE '❌ Coluna use_mock_data NÃO EXISTE'
    END AS status
FROM information_schema.columns
WHERE table_name = 'domains' 
AND column_name = 'use_mock_data';

-- ============================================================================
-- 2. ESTRUTURA DA TABELA DOMAINS
-- ============================================================================

SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'domains'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. ESTADO ATUAL DOS DOMÍNIOS
-- ============================================================================

-- Verificar se a coluna existe antes de consultar
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'domains' 
        AND column_name = 'use_mock_data'
    ) THEN
        -- Mostrar configuração de cada domínio
        RAISE NOTICE '========================================';
        RAISE NOTICE 'CONFIGURAÇÃO DOS DOMÍNIOS';
        RAISE NOTICE '========================================';
        
        PERFORM 
            domain || ' | ' || 
            name || ' | ' || 
            CASE use_mock_data 
                WHEN TRUE THEN '📊 MOCK' 
                WHEN FALSE THEN '🔗 REAL' 
                ELSE '❓ NULL' 
            END
        FROM domains
        ORDER BY domain;
        
    ELSE
        RAISE NOTICE '❌ Coluna use_mock_data não existe!';
        RAISE NOTICE 'Execute: psql -U postgres -d presto -f /database/migrations/add_use_mock_data_column.sql';
    END IF;
END $$;

-- Query alternativa (caso a coluna exista)
\echo '========================================';
\echo 'CONFIGURAÇÃO ATUAL DOS DOMÍNIOS';
\echo '========================================';

SELECT 
    domain,
    name,
    CASE use_mock_data 
        WHEN TRUE THEN '📊 USA MOCK DATA'
        WHEN FALSE THEN '🔗 USA BACKEND REAL'
        ELSE '❓ NÃO DEFINIDO'
    END AS modo_operacao,
    CASE controla_linhas
        WHEN TRUE THEN '✅ Controla Linhas'
        WHEN FALSE THEN '❌ Não Controla Linhas'
        ELSE '❓ Não Definido'
    END AS controle_linhas,
    modalidade,
    is_active
FROM domains
ORDER BY domain;

-- ============================================================================
-- 4. ESTATÍSTICAS
-- ============================================================================

\echo '========================================';
\echo 'ESTATÍSTICAS';
\echo '========================================';

SELECT 
    COUNT(*) FILTER (WHERE use_mock_data = TRUE) AS "Domínios usando MOCK",
    COUNT(*) FILTER (WHERE use_mock_data = FALSE) AS "Domínios usando REAL",
    COUNT(*) AS "Total de Domínios"
FROM domains;

-- ============================================================================
-- 5. ÍNDICES RELACIONADOS
-- ============================================================================

\echo '========================================';
\echo 'ÍNDICES NA TABELA DOMAINS';
\echo '========================================';

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'domains'
ORDER BY indexname;
