-- ============================================================================
-- MIGRAÇÃO: Consolidar tabelas clients e client_configs em domains
-- ============================================================================
-- Data: 2024-12-11
-- Descrição: Move todas as informações para a tabela domains e remove as antigas
-- ============================================================================

\c presto;

BEGIN;

-- ============================================================================
-- PASSO 1: ADICIONAR COLUNAS DE CLIENTS EM DOMAINS
-- ============================================================================

SELECT '🔧 Adicionando colunas de CLIENTS em DOMAINS...' AS status;

-- Colunas da tabela clients que não existem em domains
ALTER TABLE domains ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS logo_light TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS logo_dark TEXT;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#10b981';
ALTER TABLE domains ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#059669';

-- Comentários
COMMENT ON COLUMN domains.full_name IS 'Nome completo/razão social da empresa';
COMMENT ON COLUMN domains.cnpj IS 'CNPJ da empresa';
COMMENT ON COLUMN domains.phone IS 'Telefone de contato';
COMMENT ON COLUMN domains.address IS 'Endereço completo';
COMMENT ON COLUMN domains.logo_light IS 'URL do logo para tema claro';
COMMENT ON COLUMN domains.logo_dark IS 'URL do logo para tema escuro';
COMMENT ON COLUMN domains.primary_color IS 'Cor primária do tema (hex)';
COMMENT ON COLUMN domains.secondary_color IS 'Cor secundária do tema (hex)';

-- ============================================================================
-- PASSO 2: ADICIONAR COLUNAS DE CLIENT_CONFIGS EM DOMAINS
-- ============================================================================

SELECT '🔧 Adicionando colunas de CLIENT_CONFIGS em DOMAINS...' AS status;

-- Colunas da tabela client_configs
ALTER TABLE domains ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{"costs": true, "lines": true, "revenue": true, "overview": true, "profitability": true}'::jsonb;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"print": true, "dark_mode": true, "export_pdf": false, "export_excel": false}'::jsonb;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS dashboards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS fiscal_year_start INTEGER DEFAULT 1;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL';

-- Comentários
COMMENT ON COLUMN domains.modules IS 'Módulos habilitados (JSON): overview, revenue, costs, lines, profitability';
COMMENT ON COLUMN domains.features IS 'Features habilitadas (JSON): dark_mode, print, export_pdf, export_excel';
COMMENT ON COLUMN domains.dashboards IS 'Configuração de dashboards (JSON array)';
COMMENT ON COLUMN domains.fiscal_year_start IS 'Mês de início do ano fiscal (1-12)';
COMMENT ON COLUMN domains.currency IS 'Código da moeda (ISO 4217)';

-- ============================================================================
-- PASSO 3: MIGRAR DADOS DE CLIENTS PARA DOMAINS
-- ============================================================================

SELECT '📊 Migrando dados de CLIENTS para DOMAINS...' AS status;

DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        -- Migrar dados de clients para domains usando domain como chave
        UPDATE domains d
        SET 
            full_name = COALESCE(d.full_name, c.full_name),
            cnpj = COALESCE(d.cnpj, c.cnpj),
            phone = COALESCE(d.phone, c.phone),
            address = COALESCE(d.address, c.address),
            logo_light = COALESCE(d.logo_light, c.logo_light),
            logo_dark = COALESCE(d.logo_dark, c.logo_dark),
            primary_color = COALESCE(d.primary_color, c.primary_color, '#10b981'),
            secondary_color = COALESCE(d.secondary_color, c.secondary_color, '#059669'),
            email = COALESCE(d.email, c.email),
            updated_at = CURRENT_TIMESTAMP
        FROM clients c
        WHERE d.domain = c.domain;
        
        GET DIAGNOSTICS migrated_count = ROW_COUNT;
        RAISE NOTICE '✅ Migrados % registros de clients para domains', migrated_count;
    ELSE
        RAISE NOTICE '⚠️  Tabela clients não existe. Pulando migração.';
    END IF;
END $$;

-- ============================================================================
-- PASSO 4: MIGRAR DADOS DE CLIENT_CONFIGS PARA DOMAINS
-- ============================================================================

SELECT '📊 Migrando dados de CLIENT_CONFIGS para DOMAINS...' AS status;

DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs') THEN
        -- Migrar dados de client_configs para domains
        -- Usa JOIN com clients para pegar o domain
        UPDATE domains d
        SET 
            modules = COALESCE(cc.modules, d.modules),
            features = COALESCE(cc.features, d.features),
            dashboards = COALESCE(cc.dashboards, d.dashboards),
            fiscal_year_start = COALESCE(cc.fiscal_year_start, d.fiscal_year_start),
            currency = COALESCE(cc.currency, d.currency),
            updated_at = CURRENT_TIMESTAMP
        FROM client_configs cc
        INNER JOIN clients c ON cc.client_id = c.id
        WHERE d.domain = c.domain;
        
        GET DIAGNOSTICS migrated_count = ROW_COUNT;
        RAISE NOTICE '✅ Migrados % registros de client_configs para domains', migrated_count;
    ELSE
        RAISE NOTICE '⚠️  Tabela client_configs não existe. Pulando migração.';
    END IF;
END $$;

-- ============================================================================
-- PASSO 5: SINCRONIZAR LOGOS COM FAVICON
-- ============================================================================

SELECT '🔧 Sincronizando logos com favicon...' AS status;

-- Se logo_light existe mas favicon_url não, copiar
UPDATE domains
SET favicon_url = logo_light
WHERE favicon_url IS NULL 
    AND logo_light IS NOT NULL;

-- Se logo_light não existe mas favicon_url existe, copiar
UPDATE domains
SET logo_light = favicon_url
WHERE logo_light IS NULL 
    AND favicon_url IS NOT NULL;

-- Se logo_dark não existe, usar logo_light
UPDATE domains
SET logo_dark = logo_light
WHERE logo_dark IS NULL 
    AND logo_light IS NOT NULL;

-- ============================================================================
-- PASSO 6: ATUALIZAR MÓDULOS BASEADO EM CONTROLA_LINHAS
-- ============================================================================

SELECT '🔧 Atualizando módulos baseado em controla_linhas...' AS status;

-- Atualizar módulo "lines" baseado em controla_linhas
UPDATE domains
SET modules = jsonb_set(modules, '{lines}', controla_linhas::TEXT::jsonb)
WHERE controla_linhas IS NOT NULL;

-- ============================================================================
-- PASSO 7: VERIFICAR MIGRAÇÃO
-- ============================================================================

SELECT '═══════════════════════════════════════' AS linha;
SELECT '📊 VERIFICAÇÃO DA MIGRAÇÃO' AS titulo;
SELECT '═══════════════════════════════════════' AS linha;

-- Contar registros em domains
SELECT 
    'Total de domínios' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains;

-- Verificar colunas migradas de clients
SELECT 
    'Domínios com full_name' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
WHERE full_name IS NOT NULL;

SELECT 
    'Domínios com CNPJ' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
WHERE cnpj IS NOT NULL;

SELECT 
    'Domínios com telefone' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
WHERE phone IS NOT NULL;

SELECT 
    'Domínios com logo_light' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
WHERE logo_light IS NOT NULL;

-- Verificar colunas migradas de client_configs
SELECT 
    'Domínios com modules' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
WHERE modules IS NOT NULL;

SELECT 
    'Domínios com features' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
WHERE features IS NOT NULL;

-- Listar domínios com dados consolidados
SELECT 
    domain,
    name,
    CASE WHEN full_name IS NOT NULL THEN '✅' ELSE '❌' END AS full_name,
    CASE WHEN logo_light IS NOT NULL THEN '✅' ELSE '❌' END AS logo,
    CASE WHEN phone IS NOT NULL THEN '✅' ELSE '❌' END AS phone,
    CASE WHEN modules IS NOT NULL THEN '✅' ELSE '❌' END AS modules,
    CASE WHEN features IS NOT NULL THEN '✅' ELSE '❌' END AS features
FROM domains
ORDER BY domain;

-- ============================================================================
-- FINALIZAR
-- ============================================================================

SELECT '═══════════════════════════════════════' AS linha;
SELECT '✅ MIGRAÇÃO CONCLUÍDA!' AS status;
SELECT 'Tabelas consolidadas em: domains' AS info;
SELECT 'Colunas adicionadas: 13 (8 de clients + 5 de client_configs)' AS detalhes;
SELECT '⚠️  Tabelas antigas NÃO foram removidas ainda' AS aviso;
SELECT 'Execute a migração 003 para remover após testes' AS proximo_passo;
SELECT '═══════════════════════════════════════' AS linha;

COMMIT;
