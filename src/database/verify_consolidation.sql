-- ============================================================================
-- VERIFICAÇÃO: Consolidação de Tabelas
-- ============================================================================
-- Este script verifica se a consolidação foi bem-sucedida
-- ============================================================================

\c presto;

SELECT '════════════════════════════════════════════════════════════════' AS linha;
SELECT '🔍 VERIFICAÇÃO DA CONSOLIDAÇÃO DE TABELAS' AS titulo;
SELECT '════════════════════════════════════════════════════════════════' AS linha;

-- ============================================================================
-- 1. VERIFICAR EXISTÊNCIA DAS TABELAS
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 1. VERIFICANDO EXISTÊNCIA DAS TABELAS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

SELECT 
    tablename AS tabela,
    CASE 
        WHEN tablename = 'domains' THEN '✅ PRINCIPAL (deve existir)'
        WHEN tablename IN ('clients', 'client_configs') THEN '⚠️  ANTIGA (deve ser removida após testes)'
        WHEN tablename LIKE '%_backup' THEN '📦 BACKUP (opcional)'
        ELSE '📊 OUTRA'
    END AS status
FROM pg_tables 
WHERE schemaname = 'public'
    AND (
        tablename IN ('domains', 'clients', 'client_configs')
        OR tablename LIKE '%_backup'
    )
ORDER BY 
    CASE 
        WHEN tablename = 'domains' THEN 1
        WHEN tablename IN ('clients', 'client_configs') THEN 2
        ELSE 3
    END,
    tablename;

-- ============================================================================
-- 2. VERIFICAR COLUNAS ADICIONADAS EM DOMAINS
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 2. VERIFICANDO NOVAS COLUNAS EM DOMAINS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

SELECT 
    column_name AS coluna,
    data_type AS tipo,
    CASE 
        WHEN column_name IN ('full_name', 'cnpj', 'phone', 'address', 'logo_light', 'logo_dark', 'primary_color', 'secondary_color') 
        THEN '✅ DE CLIENTS'
        WHEN column_name IN ('modules', 'features', 'dashboards', 'fiscal_year_start', 'currency')
        THEN '✅ DE CLIENT_CONFIGS'
        ELSE '📊 ORIGINAL'
    END AS origem
FROM information_schema.columns
WHERE table_name = 'domains'
    AND column_name IN (
        -- Colunas originais importantes
        'domain', 'name', 'email', 'modalidade', 'favicon_url', 'controla_linhas',
        -- Colunas de clients
        'full_name', 'cnpj', 'phone', 'address', 'logo_light', 'logo_dark', 
        'primary_color', 'secondary_color',
        -- Colunas de client_configs
        'modules', 'features', 'dashboards', 'fiscal_year_start', 'currency'
    )
ORDER BY 
    CASE 
        WHEN column_name = 'domain' THEN 1
        WHEN column_name IN ('full_name', 'cnpj', 'phone', 'address', 'logo_light', 'logo_dark', 'primary_color', 'secondary_color') THEN 2
        WHEN column_name IN ('modules', 'features', 'dashboards', 'fiscal_year_start', 'currency') THEN 3
        ELSE 4
    END,
    column_name;

-- ============================================================================
-- 3. VERIFICAR DADOS MIGRADOS (ESTATÍSTICAS)
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 3. VERIFICANDO DADOS MIGRADOS (ESTATÍSTICAS)...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

-- Total de domínios
SELECT 
    'Total de domínios' AS metrica,
    COUNT(*)::TEXT AS valor,
    '✅' AS status
FROM domains;

-- Colunas de CLIENTS
SELECT 
    'Domínios com full_name' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '⚠️' END AS status
FROM domains WHERE full_name IS NOT NULL;

SELECT 
    'Domínios com CNPJ' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE 'ℹ️' END AS status
FROM domains WHERE cnpj IS NOT NULL;

SELECT 
    'Domínios com telefone' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE 'ℹ️' END AS status
FROM domains WHERE phone IS NOT NULL;

SELECT 
    'Domínios com endereço' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE 'ℹ️' END AS status
FROM domains WHERE address IS NOT NULL;

SELECT 
    'Domínios com logo_light' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '⚠️' END AS status
FROM domains WHERE logo_light IS NOT NULL;

SELECT 
    'Domínios com logo_dark' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE 'ℹ️' END AS status
FROM domains WHERE logo_dark IS NOT NULL;

-- Colunas de CLIENT_CONFIGS
SELECT 
    'Domínios com modules' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '⚠️' END AS status
FROM domains WHERE modules IS NOT NULL;

SELECT 
    'Domínios com features' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '⚠️' END AS status
FROM domains WHERE features IS NOT NULL;

SELECT 
    'Domínios com dashboards' AS metrica,
    COUNT(*)::TEXT AS valor,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE 'ℹ️' END AS status
FROM domains WHERE dashboards IS NOT NULL;

-- ============================================================================
-- 4. VISUALIZAR DADOS CONSOLIDADOS POR DOMÍNIO
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 4. VISUALIZANDO DADOS CONSOLIDADOS POR DOMÍNIO...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

SELECT 
    domain AS "Domínio",
    name AS "Nome",
    CASE WHEN full_name IS NOT NULL THEN '✅' ELSE '❌' END AS "Full Name",
    CASE WHEN cnpj IS NOT NULL THEN '✅' ELSE '❌' END AS "CNPJ",
    CASE WHEN logo_light IS NOT NULL THEN '✅' ELSE '❌' END AS "Logo",
    CASE WHEN phone IS NOT NULL THEN '✅' ELSE '❌' END AS "Tel",
    CASE WHEN modules IS NOT NULL THEN '✅' ELSE '❌' END AS "Modules",
    CASE WHEN features IS NOT NULL THEN '✅' ELSE '❌' END AS "Features",
    modalidade AS "Modal"
FROM domains
ORDER BY domain;

-- ============================================================================
-- 5. VERIFICAR INTEGRIDADE DOS DADOS
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 5. VERIFICANDO INTEGRIDADE DOS DADOS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

-- Domínios sem logo
SELECT 
    'Domínios sem logo_light nem favicon' AS problema,
    COUNT(*)::TEXT AS quantidade,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK'
        ELSE '⚠️  ATENÇÃO'
    END AS status
FROM domains
WHERE logo_light IS NULL AND favicon_url IS NULL;

-- Domínios sem nome
SELECT 
    'Domínios sem name' AS problema,
    COUNT(*)::TEXT AS quantidade,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK'
        ELSE '❌ ERRO'
    END AS status
FROM domains
WHERE name IS NULL OR name = '';

-- Domínios inativos
SELECT 
    'Domínios inativos' AS problema,
    COUNT(*)::TEXT AS quantidade,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK'
        ELSE 'ℹ️  INFO'
    END AS status
FROM domains
WHERE is_active = FALSE;

-- Domínios sem modules
SELECT 
    'Domínios sem modules' AS problema,
    COUNT(*)::TEXT AS quantidade,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK'
        ELSE '⚠️  ATENÇÃO'
    END AS status
FROM domains
WHERE modules IS NULL;

-- Domínios sem features
SELECT 
    'Domínios sem features' AS problema,
    COUNT(*)::TEXT AS quantidade,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK'
        ELSE '⚠️  ATENÇÃO'
    END AS status
FROM domains
WHERE features IS NULL;

-- ============================================================================
-- 6. COMPARAR COM TABELAS ORIGINAIS (se existirem)
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 6. COMPARANDO COM TABELAS ORIGINAIS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

DO $$
DECLARE
    clients_count INTEGER;
    domains_count INTEGER;
    client_configs_count INTEGER;
BEGIN
    -- Verificar clients
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        SELECT COUNT(*) INTO clients_count FROM clients;
        SELECT COUNT(*) INTO domains_count FROM domains;
        
        RAISE NOTICE 'Registros em clients: %', clients_count;
        RAISE NOTICE 'Registros em domains: %', domains_count;
        
        IF clients_count = domains_count THEN
            RAISE NOTICE '✅ Número de registros compatível';
        ELSE
            RAISE WARNING '⚠️  Diferença no número de registros!';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  Tabela clients não existe (já foi removida)';
    END IF;
    
    RAISE NOTICE '';
    
    -- Verificar client_configs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs') THEN
        SELECT COUNT(*) INTO client_configs_count FROM client_configs;
        RAISE NOTICE 'Registros em client_configs: %', client_configs_count;
        
        -- Verificar quantos domains têm modules configurados
        SELECT COUNT(*) INTO domains_count FROM domains WHERE modules IS NOT NULL;
        RAISE NOTICE 'Domínios com modules: %', domains_count;
    ELSE
        RAISE NOTICE '⚠️  Tabela client_configs não existe (já foi removida)';
    END IF;
END $$;

-- ============================================================================
-- 7. VERIFICAR BACKUPS
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 7. VERIFICANDO BACKUPS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

DO $$
BEGIN
    -- Verificar clients_backup
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients_backup') THEN
        RAISE NOTICE '✅ Backup de clients existe';
        RAISE NOTICE '   Total de registros: %', (SELECT COUNT(*) FROM clients_backup);
    ELSE
        RAISE NOTICE '⚠️  Backup de clients não existe';
    END IF;
    
    -- Verificar client_configs_backup
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs_backup') THEN
        RAISE NOTICE '✅ Backup de client_configs existe';
        RAISE NOTICE '   Total de registros: %', (SELECT COUNT(*) FROM client_configs_backup);
    ELSE
        RAISE NOTICE '⚠️  Backup de client_configs não existe';
    END IF;
END $$;

-- ============================================================================
-- 8. DADOS DETALHADOS POR DOMÍNIO
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 8. DADOS DETALHADOS POR DOMÍNIO...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

SELECT 
    domain AS "Dom",
    name AS "Nome",
    COALESCE(phone, '-') AS "Telefone",
    COALESCE(SUBSTRING(cnpj, 1, 18), '-') AS "CNPJ",
    primary_color AS "Cor 1°",
    modalidade AS "Modal",
    CASE WHEN controla_linhas THEN 'Sim' ELSE 'Não' END AS "Linhas",
    CASE WHEN is_active THEN '✅' ELSE '❌' END AS "Ativo"
FROM domains
ORDER BY domain;

-- ============================================================================
-- 9. VERIFICAR MÓDULOS E FEATURES
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 9. VERIFICANDO MÓDULOS E FEATURES...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

-- Mostrar modules por domínio
SELECT 
    domain,
    modules->>'overview' AS overview,
    modules->>'revenue' AS revenue,
    modules->>'costs' AS costs,
    modules->>'lines' AS lines,
    modules->>'profitability' AS profitability
FROM domains
WHERE modules IS NOT NULL
ORDER BY domain;

-- Mostrar features por domínio
SELECT 
    domain,
    features->>'dark_mode' AS dark_mode,
    features->>'print' AS print,
    features->>'export_pdf' AS pdf,
    features->>'export_excel' AS excel
FROM domains
WHERE features IS NOT NULL
ORDER BY domain;

-- ============================================================================
-- 10. RESUMO FINAL
-- ============================================================================

SELECT '' AS espaco;
SELECT '════════════════════════════════════════════════════════════════' AS linha;
SELECT '✅ RESUMO DA VERIFICAÇÃO' AS titulo;
SELECT '════════════════════════════════════════════════════════════════' AS linha;

-- Estatísticas gerais
WITH stats AS (
    SELECT 
        COUNT(*) AS total_dominios,
        COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) AS com_full_name,
        COUNT(CASE WHEN logo_light IS NOT NULL THEN 1 END) AS com_logo,
        COUNT(CASE WHEN modules IS NOT NULL THEN 1 END) AS com_modules,
        COUNT(CASE WHEN features IS NOT NULL THEN 1 END) AS com_features,
        COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) AS com_telefone,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) AS ativos
    FROM domains
)
SELECT 
    'Total de domínios' AS metrica,
    total_dominios::TEXT AS valor
FROM stats
UNION ALL
SELECT 'Com full_name', com_full_name::TEXT FROM stats
UNION ALL
SELECT 'Com logo_light', com_logo::TEXT FROM stats
UNION ALL
SELECT 'Com modules', com_modules::TEXT FROM stats
UNION ALL
SELECT 'Com features', com_features::TEXT FROM stats
UNION ALL
SELECT 'Com telefone', com_telefone::TEXT FROM stats
UNION ALL
SELECT 'Domínios ativos', ativos::TEXT FROM stats;

-- Status das tabelas
SELECT '' AS espaco;
SELECT '🗄️  Status das Tabelas:' AS info;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'domains') 
        THEN '  ✅ domains: EXISTE (consolidada)'
        ELSE '  ❌ domains: NÃO EXISTE'
    END AS status
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') 
        THEN '  ⚠️  clients: AINDA EXISTE (remover após testes)'
        ELSE '  ✅ clients: REMOVIDA'
    END
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs') 
        THEN '  ⚠️  client_configs: AINDA EXISTE (remover após testes)'
        ELSE '  ✅ client_configs: REMOVIDA'
    END
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name LIKE '%_backup') 
        THEN '  ✅ backups: EXISTEM'
        ELSE '  ⚠️  backups: NÃO EXISTEM'
    END;

-- Próximos passos
SELECT '' AS espaco;
SELECT '🎯 Próximos Passos:' AS titulo;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('clients', 'client_configs')) THEN
        RAISE NOTICE '  1️⃣  Testar todas as APIs do sistema';
        RAISE NOTICE '  2️⃣  Verificar se não há erros nos logs';
        RAISE NOTICE '  3️⃣  Migrar tabelas dependentes (audit_logs, units)';
        RAISE NOTICE '  4️⃣  Executar migração 003 para remover tabelas antigas';
    ELSE
        RAISE NOTICE '  ✅ Consolidação completa!';
        RAISE NOTICE '  ✅ Tabelas antigas já foram removidas';
        RAISE NOTICE '  ℹ️  Considere remover os backups após algumas semanas';
    END IF;
END $$;

SELECT '════════════════════════════════════════════════════════════════' AS linha;
SELECT '✅ VERIFICAÇÃO CONCLUÍDA!' AS status;
SELECT '════════════════════════════════════════════════════════════════' AS linha;
