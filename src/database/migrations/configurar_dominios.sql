-- ============================================================================
-- CONFIGURAÇÃO DE DOMÍNIOS: use_mock_data
-- ============================================================================
-- Use este script DEPOIS de executar add_use_mock_data_SAFE.sql
-- para configurar quais domínios usam MOCK e quais usam BACKEND REAL
-- ============================================================================

\c presto;

\echo '========================================';
\echo '⚙️  CONFIGURAÇÃO DE DOMÍNIOS';
\echo '========================================';
\echo '';

-- ============================================================================
-- CONFIGURAÇÃO ATUAL (ANTES DAS MUDANÇAS)
-- ============================================================================

\echo '📊 ESTADO ATUAL DOS DOMÍNIOS:';
\echo '';

SELECT 
    domain,
    name,
    modalidade,
    CASE use_mock_data 
        WHEN TRUE THEN '📊 MOCK DATA'
        WHEN FALSE THEN '🔗 BACKEND REAL'
        ELSE '❓ NÃO DEFINIDO'
    END AS modo_atual,
    CASE controla_linhas
        WHEN TRUE THEN 'SIM'
        WHEN FALSE THEN 'NÃO'
    END AS controla_linhas,
    is_active AS ativo
FROM domains
ORDER BY domain;

\echo '';
\echo '========================================';
\echo '🔧 ESCOLHA A CONFIGURAÇÃO DESEJADA';
\echo '========================================';
\echo '';
\echo '⚠️  ATENÇÃO: Descomente apenas UMA das opções abaixo!';
\echo '';

-- ============================================================================
-- OPÇÃO 1: TODOS OS DOMÍNIOS USANDO MOCK (DESENVOLVIMENTO/TESTES)
-- ============================================================================
-- Descomente as linhas abaixo para configurar TODOS os domínios para MOCK:

-- UPDATE domains SET use_mock_data = TRUE;
-- \echo '✅ Configurado: TODOS os domínios usarão MOCK DATA';

-- ============================================================================
-- OPÇÃO 2: TODOS OS DOMÍNIOS USANDO BACKEND REAL (PRODUÇÃO)
-- ============================================================================
-- Descomente as linhas abaixo para configurar TODOS os domínios para REAL:

-- UPDATE domains SET use_mock_data = FALSE;
-- \echo '✅ Configurado: TODOS os domínios usarão BACKEND REAL';

-- ============================================================================
-- OPÇÃO 3: CONFIGURAÇÃO INDIVIDUAL POR DOMÍNIO
-- ============================================================================
-- Descomente e ajuste os domínios que você quer alterar:

-- Domínio XXX (Sistema Presto) - Usar BACKEND REAL
-- UPDATE domains SET use_mock_data = FALSE WHERE domain = 'XXX';
-- \echo '✅ XXX configurado para BACKEND REAL';

-- Domínio VCS (Viação Cruzeiro do Sul) - Usar MOCK
-- UPDATE domains SET use_mock_data = TRUE WHERE domain = 'VCS';
-- \echo '✅ VCS configurado para MOCK DATA';

-- Domínio ACV (Aceville Transportes) - Usar MOCK
-- UPDATE domains SET use_mock_data = TRUE WHERE domain = 'ACV';
-- \echo '✅ ACV configurado para MOCK DATA';

-- ============================================================================
-- OPÇÃO 4: CONFIGURAÇÃO MISTA (RECOMENDADO PARA TRANSIÇÃO)
-- ============================================================================
-- Apenas domínio XXX em produção, demais em desenvolvimento
-- Descomente as linhas abaixo:

-- UPDATE domains SET use_mock_data = TRUE;  -- Todos para MOCK
-- UPDATE domains SET use_mock_data = FALSE WHERE domain = 'XXX';  -- XXX para REAL
-- \echo '✅ XXX configurado para BACKEND REAL';
-- \echo '✅ Demais domínios configurados para MOCK DATA';

-- ============================================================================
-- OPÇÃO 5: APENAS DOMÍNIOS SUPER ADMIN EM PRODUÇÃO
-- ============================================================================
-- Coloca apenas domínios super admin para usar backend real
-- Descomente as linhas abaixo:

-- UPDATE domains SET use_mock_data = TRUE;  -- Todos para MOCK
-- UPDATE domains SET use_mock_data = FALSE WHERE is_super_admin = TRUE;  -- Super admins para REAL
-- \echo '✅ Domínios SUPER ADMIN configurados para BACKEND REAL';
-- \echo '✅ Demais domínios configurados para MOCK DATA';

-- ============================================================================
-- ESTADO FINAL (DEPOIS DAS MUDANÇAS)
-- ============================================================================

\echo '';
\echo '========================================';
\echo '📊 ESTADO FINAL DOS DOMÍNIOS';
\echo '========================================';
\echo '';

SELECT 
    domain,
    name,
    CASE use_mock_data 
        WHEN TRUE THEN '📊 MOCK DATA'
        WHEN FALSE THEN '🔗 BACKEND REAL'
        ELSE '❓ NÃO DEFINIDO'
    END AS modo_final,
    CASE is_super_admin
        WHEN TRUE THEN '👑 SUPER ADMIN'
        ELSE '👤 CLIENTE'
    END AS tipo,
    modalidade,
    CASE controla_linhas
        WHEN TRUE THEN 'SIM'
        WHEN FALSE THEN 'NÃO'
    END AS controla_linhas
FROM domains
ORDER BY domain;

-- Estatísticas finais
\echo '';
\echo '========================================';
\echo '📈 ESTATÍSTICAS FINAIS';
\echo '========================================';
\echo '';

SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE use_mock_data = TRUE) AS usando_mock,
    COUNT(*) FILTER (WHERE use_mock_data = FALSE) AS usando_real
FROM domains;

\echo '';
\echo '========================================';
\echo '✅ CONFIGURAÇÃO CONCLUÍDA';
\echo '========================================';
\echo '';
\echo '🔍 Para verificar se está funcionando:';
\echo '   1. Faça login no sistema';
\echo '   2. Acesse o Dashboard Financeiro (DRE)';
\echo '   3. Verifique se os dados são MOCK ou REAL';
\echo '';
\echo '⚠️  Lembre-se:';
\echo '   - MOCK = Dados de exemplo/desenvolvimento';
\echo '   - REAL = Dados do backend/API externa';
\echo '';

-- ============================================================================
-- QUERIES ÚTEIS PARA VERIFICAÇÃO
-- ============================================================================

\echo '========================================';
\echo '📝 QUERIES ÚTEIS';
\echo '========================================';
\echo '';
\echo '-- Ver configuração de um domínio específico:';
\echo 'SELECT domain, name, use_mock_data FROM domains WHERE domain = ''XXX'';';
\echo '';
\echo '-- Ver todos os domínios usando MOCK:';
\echo 'SELECT domain, name FROM domains WHERE use_mock_data = TRUE;';
\echo '';
\echo '-- Ver todos os domínios usando REAL:';
\echo 'SELECT domain, name FROM domains WHERE use_mock_data = FALSE;';
\echo '';
\echo '-- Alterar um domínio específico:';
\echo 'UPDATE domains SET use_mock_data = FALSE WHERE domain = ''XXX'';';
\echo '';
