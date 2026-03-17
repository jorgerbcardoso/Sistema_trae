-- ============================================================================
-- VERIFICAR ESTRUTURA DAS TABELAS: clients, client_configs e domains
-- ============================================================================
-- Este script mostra a estrutura completa das 3 tabelas antes da consolidação
-- ============================================================================

\c presto;

SELECT '════════════════════════════════════════════════════════════════' AS linha;
SELECT '🔍 VERIFICAÇÃO DA ESTRUTURA ATUAL DAS TABELAS' AS titulo;
SELECT '════════════════════════════════════════════════════════════════' AS linha;

-- ============================================================================
-- 1. VERIFICAR QUAIS TABELAS EXISTEM
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 1. VERIFICANDO EXISTÊNCIA DAS TABELAS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

SELECT 
    tablename AS tabela,
    CASE 
        WHEN tablename IN ('clients', 'client_configs', 'domains') THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END AS status
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('clients', 'client_configs', 'domains')
ORDER BY tablename;

-- ============================================================================
-- 2. ESTRUTURA DA TABELA: domains
-- ============================================================================

SELECT '' AS espaco;
SELECT '═══════════════ TABELA: domains ═══════════════' AS info;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

SELECT 
    column_name AS "Coluna",
    data_type AS "Tipo",
    character_maximum_length AS "Tamanho",
    is_nullable AS "Null?",
    column_default AS "Padrão"
FROM information_schema.columns
WHERE table_name = 'domains'
ORDER BY ordinal_position;

-- Dados da tabela domains
SELECT '' AS espaco;
SELECT '📊 DADOS EM domains:' AS info;
SELECT 
    domain,
    name,
    email,
    modalidade,
    controla_linhas,
    is_active
FROM domains
ORDER BY domain;

-- ============================================================================
-- 3. ESTRUTURA DA TABELA: clients
-- ============================================================================

SELECT '' AS espaco;
SELECT '═══════════════ TABELA: clients ═══════════════' AS info;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        -- Mostrar estrutura
        RAISE NOTICE 'Estrutura de clients:';
    ELSE
        RAISE NOTICE '⚠️  Tabela clients não existe';
    END IF;
END $$;

SELECT 
    column_name AS "Coluna",
    data_type AS "Tipo",
    character_maximum_length AS "Tamanho",
    is_nullable AS "Null?",
    column_default AS "Padrão"
FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;

-- Dados da tabela clients
SELECT '' AS espaco;
SELECT '📊 DADOS EM clients:' AS info;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        PERFORM * FROM clients LIMIT 1;
        RAISE NOTICE 'Total de registros: %', (SELECT COUNT(*) FROM clients);
    END IF;
END $$;

SELECT 
    id,
    domain,
    name,
    full_name,
    cnpj,
    email,
    phone,
    primary_color,
    secondary_color,
    active
FROM clients
ORDER BY domain;

-- ============================================================================
-- 4. ESTRUTURA DA TABELA: client_configs
-- ============================================================================

SELECT '' AS espaco;
SELECT '═══════════════ TABELA: client_configs ═══════════════' AS info;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs') THEN
        RAISE NOTICE 'Estrutura de client_configs:';
    ELSE
        RAISE NOTICE '⚠️  Tabela client_configs não existe';
    END IF;
END $$;

SELECT 
    column_name AS "Coluna",
    data_type AS "Tipo",
    character_maximum_length AS "Tamanho",
    is_nullable AS "Null?",
    column_default AS "Padrão"
FROM information_schema.columns
WHERE table_name = 'client_configs'
ORDER BY ordinal_position;

-- Dados da tabela client_configs
SELECT '' AS espaco;
SELECT '📊 DADOS EM client_configs:' AS info;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs') THEN
        PERFORM * FROM client_configs LIMIT 1;
        RAISE NOTICE 'Total de registros: %', (SELECT COUNT(*) FROM client_configs);
    END IF;
END $$;

SELECT 
    id,
    client_id,
    modules,
    features,
    dashboards,
    fiscal_year_start,
    currency
FROM client_configs
ORDER BY client_id;

-- ============================================================================
-- 5. RELACIONAMENTOS ENTRE AS TABELAS
-- ============================================================================

SELECT '' AS espaco;
SELECT '🔗 5. VERIFICANDO RELACIONAMENTOS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

-- Verificar FKs
SELECT
    tc.table_name AS "Tabela",
    kcu.column_name AS "Coluna",
    ccu.table_name AS "Ref. Tabela",
    ccu.column_name AS "Ref. Coluna",
    tc.constraint_name AS "Constraint"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('clients', 'client_configs', 'domains')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 6. COMPARAR DADOS ENTRE AS TABELAS
-- ============================================================================

SELECT '' AS espaco;
SELECT '📊 6. COMPARANDO DADOS ENTRE TABELAS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

DO $$
DECLARE
    domains_count INTEGER;
    clients_count INTEGER;
    configs_count INTEGER;
BEGIN
    -- Contar registros
    SELECT COUNT(*) INTO domains_count FROM domains;
    
    RAISE NOTICE 'Registros em domains: %', domains_count;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        SELECT COUNT(*) INTO clients_count FROM clients;
        RAISE NOTICE 'Registros em clients: %', clients_count;
        
        -- Verificar correspondência
        IF domains_count = clients_count THEN
            RAISE NOTICE '✅ Número de registros compatível';
        ELSE
            RAISE WARNING '⚠️  Número de registros diferente!';
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs') THEN
        SELECT COUNT(*) INTO configs_count FROM client_configs;
        RAISE NOTICE 'Registros em client_configs: %', configs_count;
    END IF;
END $$;

-- Comparar dados domain por domain
SELECT '' AS espaco;
SELECT '📊 Comparação por domínio:' AS info;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        -- OK, pode fazer o JOIN
        RAISE NOTICE 'Fazendo comparação detalhada...';
    ELSE
        RAISE NOTICE '⚠️  Tabela clients não existe, pulando comparação';
    END IF;
END $$;

SELECT 
    d.domain AS "Domínio",
    d.name AS "Nome (domains)",
    c.name AS "Nome (clients)",
    c.full_name AS "Full Name",
    c.cnpj AS "CNPJ",
    c.phone AS "Telefone",
    CASE WHEN c.domain IS NOT NULL THEN '✅' ELSE '❌' END AS "Em clients"
FROM domains d
LEFT JOIN clients c ON d.domain = c.domain
ORDER BY d.domain;

-- ============================================================================
-- 7. VERIFICAR COLUNAS QUE SERÃO MIGRADAS
-- ============================================================================

SELECT '' AS espaco;
SELECT '📋 7. COLUNAS QUE SERÃO MIGRADAS...' AS status;
SELECT '────────────────────────────────────────────────────────────────' AS linha;

SELECT '' AS espaco;
SELECT 'DE CLIENTS PARA DOMAINS:' AS info;
SELECT '  ✅ full_name       (TEXT)' AS coluna
UNION ALL SELECT '  ✅ cnpj            (VARCHAR(18))'
UNION ALL SELECT '  ✅ phone           (VARCHAR(20))'
UNION ALL SELECT '  ✅ address         (TEXT)'
UNION ALL SELECT '  ✅ logo_light      (TEXT)'
UNION ALL SELECT '  ✅ logo_dark       (TEXT)'
UNION ALL SELECT '  ✅ primary_color   (VARCHAR(7))'
UNION ALL SELECT '  ✅ secondary_color (VARCHAR(7))';

SELECT '' AS espaco;
SELECT 'DE CLIENT_CONFIGS PARA DOMAINS:' AS info;
SELECT '  ✅ modules            (JSONB)' AS coluna
UNION ALL SELECT '  ✅ features           (JSONB)'
UNION ALL SELECT '  ✅ dashboards         (JSONB)'
UNION ALL SELECT '  ✅ fiscal_year_start  (INTEGER)'
UNION ALL SELECT '  ✅ currency           (VARCHAR(3))';

-- ============================================================================
-- 8. RESUMO E PRÓXIMOS PASSOS
-- ============================================================================

SELECT '' AS espaco;
SELECT '════════════════════════════════════════════════════════════════' AS linha;
SELECT '✅ RESUMO DA VERIFICAÇÃO' AS titulo;
SELECT '════════════════════════════════════════════════════════════════' AS linha;

DO $$
DECLARE
    domains_ok BOOLEAN;
    clients_ok BOOLEAN;
    configs_ok BOOLEAN;
BEGIN
    domains_ok := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'domains');
    clients_ok := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients');
    configs_ok := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs');
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Status das Tabelas:';
    
    IF domains_ok THEN
        RAISE NOTICE '  ✅ domains: EXISTE (% registros)', (SELECT COUNT(*) FROM domains);
    ELSE
        RAISE NOTICE '  ❌ domains: NÃO EXISTE';
    END IF;
    
    IF clients_ok THEN
        RAISE NOTICE '  ✅ clients: EXISTE (% registros)', (SELECT COUNT(*) FROM clients);
    ELSE
        RAISE NOTICE '  ❌ clients: NÃO EXISTE';
    END IF;
    
    IF configs_ok THEN
        RAISE NOTICE '  ✅ client_configs: EXISTE (% registros)', (SELECT COUNT(*) FROM client_configs);
    ELSE
        RAISE NOTICE '  ❌ client_configs: NÃO EXISTE';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Próximos Passos:';
    
    IF domains_ok AND clients_ok AND configs_ok THEN
        RAISE NOTICE '  1️⃣  Executar migração 002 (consolidação)';
        RAISE NOTICE '  2️⃣  Executar verify_consolidation.sql';
        RAISE NOTICE '  3️⃣  Testar sistema';
        RAISE NOTICE '  4️⃣  Executar migração 003 (remover tabelas antigas)';
    ELSIF domains_ok AND NOT clients_ok THEN
        RAISE NOTICE '  ✅ Consolidação já realizada!';
        RAISE NOTICE '  ℹ️  Tabelas antigas já foram removidas';
    ELSE
        RAISE NOTICE '  ⚠️  Estrutura do banco parece incompleta';
    END IF;
    
    RAISE NOTICE '';
END $$;

SELECT '════════════════════════════════════════════════════════════════' AS linha;
SELECT '✅ VERIFICAÇÃO CONCLUÍDA!' AS status;
SELECT '════════════════════════════════════════════════════════════════' AS linha;
