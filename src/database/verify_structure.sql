-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO - ESTRUTURA DO BANCO DE DADOS
-- ============================================================================
-- Este script verifica se a estrutura do banco está correta
-- ============================================================================

\c presto;

-- ============================================================================
-- 1. VERIFICAR EXISTÊNCIA DAS TABELAS
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO TABELAS...' AS status;

SELECT 
    tablename AS tabela,
    CASE 
        WHEN tablename IN ('domains', 'users', 'sessions', 'password_reset_tokens', 'access_logs') 
        THEN '✅ EXISTE'
        ELSE '❌ NÃO ENCONTRADA'
    END AS status
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('domains', 'users', 'sessions', 'password_reset_tokens', 'access_logs')
ORDER BY tablename;

-- ============================================================================
-- 2. VERIFICAR ESTRUTURA DA TABELA DOMAINS
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO ESTRUTURA: domains' AS status;

SELECT 
    column_name AS coluna,
    data_type AS tipo,
    character_maximum_length AS tamanho,
    is_nullable AS nulo
FROM information_schema.columns
WHERE table_name = 'domains'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. VERIFICAR ESTRUTURA DA TABELA USERS
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO ESTRUTURA: users' AS status;

SELECT 
    column_name AS coluna,
    data_type AS tipo,
    character_maximum_length AS tamanho,
    is_nullable AS nulo
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- ============================================================================
-- 4. VERIFICAR FOREIGN KEYS
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO FOREIGN KEYS...' AS status;

SELECT
    tc.table_name AS tabela,
    kcu.column_name AS coluna,
    ccu.table_name AS tabela_referenciada,
    ccu.column_name AS coluna_referenciada,
    '✅ OK' AS status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('users', 'sessions', 'password_reset_tokens', 'access_logs')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 5. VERIFICAR ÍNDICES
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO ÍNDICES...' AS status;

SELECT
    schemaname AS schema,
    tablename AS tabela,
    indexname AS indice,
    '✅ OK' AS status
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('domains', 'users', 'sessions', 'password_reset_tokens', 'access_logs')
ORDER BY tablename, indexname;

-- ============================================================================
-- 6. VERIFICAR DADOS: Domínios
-- ============================================================================

SELECT 
    '📊 VERIFICANDO DADOS: Domínios' AS status;

SELECT 
    domain,
    name,
    modalidade,
    is_active,
    use_mock_data,
    CASE 
        WHEN favicon_url IS NOT NULL THEN '🎨 Logo Personalizada'
        ELSE '🖼️  Logo Padrão'
    END AS logo
FROM domains
ORDER BY domain;

-- ============================================================================
-- 7. VERIFICAR DADOS: Usuários por Domínio
-- ============================================================================

SELECT 
    '📊 VERIFICANDO DADOS: Usuários' AS status;

SELECT 
    domain,
    COUNT(*) AS total_usuarios,
    COUNT(CASE WHEN is_active = TRUE THEN 1 END) AS ativos,
    COUNT(CASE WHEN is_admin = TRUE THEN 1 END) AS admins
FROM users
GROUP BY domain
ORDER BY domain;

-- ============================================================================
-- 8. VERIFICAR INTEGRIDADE: Users.domain → Domains.domain
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO INTEGRIDADE: users.domain' AS status;

SELECT 
    u.domain,
    COUNT(u.id) AS total_usuarios,
    CASE 
        WHEN d.domain IS NOT NULL THEN '✅ VÁLIDO'
        ELSE '❌ DOMÍNIO NÃO EXISTE'
    END AS status
FROM users u
LEFT JOIN domains d ON u.domain = d.domain
GROUP BY u.domain, d.domain
ORDER BY u.domain;

-- ============================================================================
-- 9. VERIFICAR INTEGRIDADE: Sessions.domain → Domains.domain
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO INTEGRIDADE: sessions.domain' AS status;

SELECT 
    COUNT(*) AS total_sessoes,
    COUNT(CASE WHEN d.domain IS NOT NULL THEN 1 END) AS validas,
    COUNT(CASE WHEN d.domain IS NULL THEN 1 END) AS invalidas
FROM sessions s
LEFT JOIN domains d ON s.domain = d.domain;

-- ============================================================================
-- 10. VERIFICAR TABELAS DE RECUPERAÇÃO DE SENHA
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO: password_reset_tokens' AS status;

SELECT 
    COUNT(*) AS total_tokens,
    COUNT(CASE WHEN used = FALSE THEN 1 END) AS nao_usados,
    COUNT(CASE WHEN used = TRUE THEN 1 END) AS usados,
    COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) AS validos,
    COUNT(CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN 1 END) AS expirados
FROM password_reset_tokens;

-- ============================================================================
-- 11. VERIFICAR LOGS DE ACESSO
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO: access_logs' AS status;

SELECT 
    action AS acao,
    COUNT(*) AS total
FROM access_logs
GROUP BY action
ORDER BY total DESC;

-- ============================================================================
-- 12. VERIFICAR SENHAS DOS USUÁRIOS
-- ============================================================================

SELECT 
    '🔍 VERIFICANDO: Senhas dos Usuários' AS status;

SELECT 
    domain,
    username,
    CASE 
        WHEN password_hash LIKE '$2y$%' THEN '✅ BCRYPT'
        WHEN password_hash LIKE '$2a$%' THEN '✅ BCRYPT'
        WHEN password_hash LIKE '$2b$%' THEN '✅ BCRYPT'
        ELSE '⚠️ HASH DESCONHECIDO'
    END AS tipo_hash,
    LENGTH(password_hash) AS tamanho_hash
FROM users
ORDER BY domain, username;

-- ============================================================================
-- 13. RESUMO FINAL
-- ============================================================================

SELECT 
    '═══════════════════════════════════════' AS linha;

SELECT 
    '📊 RESUMO DO BANCO DE DADOS' AS titulo;

SELECT 
    '═══════════════════════════════════════' AS linha;

SELECT 
    'Total de Domínios' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
UNION ALL
SELECT 
    'Domínios Ativos' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
WHERE is_active = TRUE
UNION ALL
SELECT 
    'Total de Usuários' AS metrica,
    COUNT(*)::TEXT AS valor
FROM users
UNION ALL
SELECT 
    'Usuários Ativos' AS metrica,
    COUNT(*)::TEXT AS valor
FROM users
WHERE is_active = TRUE
UNION ALL
SELECT 
    'Sessões Ativas' AS metrica,
    COUNT(*)::TEXT AS valor
FROM sessions
WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
UNION ALL
SELECT 
    'Tokens de Reset Válidos' AS metrica,
    COUNT(*)::TEXT AS valor
FROM password_reset_tokens
WHERE used = FALSE AND expires_at > CURRENT_TIMESTAMP
UNION ALL
SELECT 
    'Total de Logs' AS metrica,
    COUNT(*)::TEXT AS valor
FROM access_logs;

SELECT 
    '═══════════════════════════════════════' AS linha;

SELECT 
    '✅ VERIFICAÇÃO CONCLUÍDA!' AS status;
