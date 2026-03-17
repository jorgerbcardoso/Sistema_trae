-- ============================================================================
-- MIGRAÇÃO: Remover tabelas antigas clients e client_configs
-- ============================================================================
-- ⚠️ ATENÇÃO: Execute este script SOMENTE após confirmar que:
-- 1. A migração 002 foi executada com sucesso
-- 2. Todos os dados foram migrados corretamente para domains
-- 3. Todos os scripts PHP foram atualizados
-- 4. O sistema foi testado e está funcionando
-- ============================================================================

\c presto;

BEGIN;

-- ============================================================================
-- VERIFICAR SE AS TABELAS EXISTEM
-- ============================================================================

SELECT '🔍 VERIFICANDO TABELAS ANTES DE REMOVER...' AS status;

SELECT 
    tablename AS tabela,
    CASE 
        WHEN tablename IN ('clients', 'client_configs') THEN '⚠️  SERÁ REMOVIDA'
        WHEN tablename = 'domains' THEN '✅ SERÁ MANTIDA'
        ELSE '📊 OUTRA'
    END AS status
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('clients', 'client_configs', 'domains')
ORDER BY tablename;

-- ============================================================================
-- FAZER BACKUP DOS DADOS
-- ============================================================================

SELECT '📦 Criando backups das tabelas...' AS status;

-- Backup de clients (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        DROP TABLE IF EXISTS clients_backup CASCADE;
        CREATE TABLE clients_backup AS SELECT * FROM clients;
        RAISE NOTICE '✅ Backup de clients criado: clients_backup (% registros)', (SELECT COUNT(*) FROM clients_backup);
    END IF;
END $$;

-- Backup de client_configs (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_configs') THEN
        DROP TABLE IF EXISTS client_configs_backup CASCADE;
        CREATE TABLE client_configs_backup AS SELECT * FROM client_configs;
        RAISE NOTICE '✅ Backup de client_configs criado: client_configs_backup (% registros)', (SELECT COUNT(*) FROM client_configs_backup);
    END IF;
END $$;

-- ============================================================================
-- VERIFICAR FOREIGN KEYS QUE APONTAM PARA CLIENTS
-- ============================================================================

SELECT '🔍 VERIFICANDO FOREIGN KEYS...' AS status;

SELECT
    tc.table_name AS tabela_origem,
    kcu.column_name AS coluna_origem,
    ccu.table_name AS tabela_referenciada,
    tc.constraint_name AS constraint_name,
    '⚠️  SERÁ REMOVIDA' AS status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name IN ('clients', 'client_configs')
ORDER BY tc.table_name;

-- ============================================================================
-- REMOVER FOREIGN KEYS DE TABELAS DEPENDENTES
-- ============================================================================

SELECT '🔧 Removendo foreign keys...' AS status;

DO $$
DECLARE
    r RECORD;
    removed_count INTEGER := 0;
BEGIN
    -- Remover FKs que apontam para clients
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'clients'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
        RAISE NOTICE '  ➜ Removida FK: %.%', r.table_name, r.constraint_name;
        removed_count := removed_count + 1;
    END LOOP;
    
    -- Remover FKs que apontam para client_configs
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'client_configs'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
        RAISE NOTICE '  ➜ Removida FK: %.%', r.table_name, r.constraint_name;
        removed_count := removed_count + 1;
    END LOOP;
    
    IF removed_count = 0 THEN
        RAISE NOTICE '  ℹ️  Nenhuma FK encontrada';
    ELSE
        RAISE NOTICE '✅ Total de FKs removidas: %', removed_count;
    END IF;
END $$;

-- ============================================================================
-- VERIFICAR TABELAS QUE TÊM COLUNAS REFERENCIANDO CLIENTS
-- ============================================================================

SELECT '📊 Tabelas com referências a clients:' AS info;

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Listar tabelas com client_id
    FOR r IN (
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE column_name = 'client_id'
            AND table_schema = 'public'
            AND table_name NOT IN ('clients', 'client_configs', 'clients_backup', 'client_configs_backup')
    ) LOOP
        RAISE NOTICE '  ⚠️  %.% (coluna client_id ainda existe)', r.table_name, r.column_name;
    END LOOP;
END $$;

-- ============================================================================
-- AVISO IMPORTANTE SOBRE TABELAS DEPENDENTES
-- ============================================================================

DO $$
BEGIN
    -- Verificar se existem tabelas que referenciam clients
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE column_name = 'client_id'
            AND table_schema = 'public'
            AND table_name NOT IN ('clients', 'client_configs', 'clients_backup', 'client_configs_backup')
    ) THEN
        RAISE WARNING '⚠️  ATENÇÃO: Existem tabelas com coluna client_id!';
        RAISE WARNING '⚠️  Após remover clients, essas colunas ficarão órfãs.';
        RAISE WARNING '⚠️  Considere migrar essas tabelas para usar domain ao invés de client_id.';
        RAISE WARNING '';
        RAISE WARNING 'Tabelas afetadas:';
        RAISE WARNING '  - audit_logs (client_id)';
        RAISE WARNING '  - units (client_id)';
        RAISE WARNING '';
        RAISE WARNING 'Sugestão: Adicionar coluna domain e migrar dados antes de remover clients.';
    END IF;
END $$;

-- ============================================================================
-- DROPAR AS TABELAS (COMENTADO POR SEGURANÇA)
-- ============================================================================

-- ⚠️ DESCOMENTE AS LINHAS ABAIXO SOMENTE APÓS:
-- 1. Confirmar que a migração está OK
-- 2. Resolver referências em audit_logs e units
-- 3. Fazer backup completo do banco

-- DROP TABLE IF EXISTS client_configs CASCADE;
-- DROP TABLE IF EXISTS clients CASCADE;

SELECT '⚠️  TABELAS NÃO FORAM REMOVIDAS (por segurança)' AS aviso;
SELECT 'Descomente as linhas DROP TABLE acima para remover' AS instrucao;

-- ============================================================================
-- SE VOCÊ DESCOMENTAR OS DROPs, ESTE SERÁ O RESULTADO:
-- ============================================================================

/*
SELECT '═══════════════════════════════════════' AS linha;
SELECT '✅ TABELAS REMOVIDAS COM SUCESSO!' AS status;
SELECT 'Tabelas removidas: clients, client_configs' AS info;
SELECT 'Backups criados: clients_backup, client_configs_backup' AS backup_info;
SELECT '═══════════════════════════════════════' AS linha;
*/

-- ============================================================================
-- VERIFICAR RESULTADO
-- ============================================================================

SELECT '═══════════════════════════════════════' AS linha;
SELECT '📊 STATUS ATUAL DAS TABELAS' AS titulo;
SELECT '═══════════════════════════════════════' AS linha;

SELECT 
    tablename AS tabela,
    CASE 
        WHEN tablename = 'domains' THEN '✅ PRINCIPAL'
        WHEN tablename LIKE '%_backup' THEN '📦 BACKUP'
        WHEN tablename IN ('clients', 'client_configs') THEN '⚠️  AINDA EXISTE'
        WHEN tablename IN ('audit_logs', 'units') THEN '📊 DEPENDENTE'
        ELSE '📊 OUTRA'
    END AS tipo
FROM pg_tables 
WHERE schemaname = 'public'
    AND (
        tablename IN ('domains', 'clients', 'client_configs', 'audit_logs', 'units')
        OR tablename LIKE '%_backup'
    )
ORDER BY 
    CASE 
        WHEN tablename = 'domains' THEN 1
        WHEN tablename IN ('clients', 'client_configs') THEN 2
        WHEN tablename LIKE '%_backup' THEN 3
        ELSE 4
    END,
    tablename;

-- ============================================================================
-- PRÓXIMOS PASSOS
-- ============================================================================

SELECT '═══════════════════════════════════════' AS linha;
SELECT '📝 PRÓXIMOS PASSOS' AS titulo;
SELECT '═══════════════════════════════════════' AS linha;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '1️⃣  Verificar se migração 002 foi bem-sucedida';
    RAISE NOTICE '   $ sudo -u postgres psql -f verify_consolidation.sql';
    RAISE NOTICE '';
    RAISE NOTICE '2️⃣  Migrar tabelas dependentes (audit_logs, units)';
    RAISE NOTICE '   - Adicionar coluna domain nessas tabelas';
    RAISE NOTICE '   - Migrar dados: UPDATE ... SET domain = (SELECT domain FROM clients WHERE id = client_id)';
    RAISE NOTICE '   - Remover coluna client_id';
    RAISE NOTICE '';
    RAISE NOTICE '3️⃣  Testar sistema completamente';
    RAISE NOTICE '   - Testar todas as APIs';
    RAISE NOTICE '   - Verificar se não há erros';
    RAISE NOTICE '';
    RAISE NOTICE '4️⃣  Descomentar DROP TABLE neste script';
    RAISE NOTICE '   - Editar arquivo 003_drop_old_tables.sql';
    RAISE NOTICE '   - Descomentar linhas DROP TABLE';
    RAISE NOTICE '   - Executar novamente';
    RAISE NOTICE '';
    RAISE NOTICE '5️⃣  Remover backups (após algumas semanas)';
    RAISE NOTICE '   DROP TABLE clients_backup;';
    RAISE NOTICE '   DROP TABLE client_configs_backup;';
    RAISE NOTICE '';
END $$;

SELECT '═══════════════════════════════════════' AS linha;

COMMIT;

-- ============================================================================
-- PARA RESTAURAR OS BACKUPS (se necessário):
-- ============================================================================

/*
ROLLBACK;

-- Recriar tabelas a partir dos backups
CREATE TABLE clients AS SELECT * FROM clients_backup;
CREATE TABLE client_configs AS SELECT * FROM client_configs_backup;

-- Recriar constraints e índices (você precisará do schema original)
*/
