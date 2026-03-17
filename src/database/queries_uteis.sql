-- ============================================================================
-- QUERIES ÚTEIS - GERENCIAMENTO DE DOMÍNIOS E RECUPERAÇÃO DE SENHA
-- ============================================================================
-- Sistema Presto - PostgreSQL
-- ============================================================================

\c presto;

-- ============================================================================
-- 1. CONSULTAS: DOMÍNIOS
-- ============================================================================

-- Listar todos os domínios
SELECT 
    domain,
    name,
    modalidade,
    is_active,
    use_mock_data,
    CASE 
        WHEN favicon_url IS NOT NULL THEN '🎨 Personalizado'
        ELSE '🖼️  Padrão'
    END AS logo
FROM domains
ORDER BY domain;

-- Buscar domínio específico
SELECT * FROM domains WHERE domain = 'XXX';

-- Contar usuários por domínio
SELECT 
    d.domain,
    d.name,
    COUNT(u.id) AS total_usuarios,
    COUNT(CASE WHEN u.is_active = TRUE THEN 1 END) AS usuarios_ativos
FROM domains d
LEFT JOIN users u ON d.domain = u.domain
GROUP BY d.domain, d.name
ORDER BY d.domain;

-- ============================================================================
-- 2. CONSULTAS: USUÁRIOS
-- ============================================================================

-- Listar todos os usuários
SELECT 
    domain,
    username,
    email,
    full_name,
    is_active,
    is_admin,
    created_at
FROM users
ORDER BY domain, username;

-- Buscar usuário específico
SELECT * FROM users WHERE domain = 'XXX' AND username = 'presto';

-- Verificar usuários de um domínio
SELECT 
    username,
    email,
    full_name,
    is_active,
    is_admin
FROM users 
WHERE domain = 'ACV'
ORDER BY username;

-- Verificar hash de senha de um usuário
SELECT 
    domain,
    username,
    password_hash,
    LENGTH(password_hash) AS hash_length,
    CASE 
        WHEN password_hash LIKE '$2y$%' THEN 'Bcrypt'
        WHEN password_hash LIKE '$2a$%' THEN 'Bcrypt'
        ELSE 'Outro'
    END AS hash_type
FROM users 
WHERE domain = 'XXX' AND username = 'presto';

-- ============================================================================
-- 3. CONSULTAS: SESSÕES
-- ============================================================================

-- Listar sessões ativas
SELECT 
    s.token,
    s.domain,
    u.username,
    s.ip_address,
    s.created_at,
    s.expires_at,
    CASE 
        WHEN s.expires_at > CURRENT_TIMESTAMP THEN '✅ Válida'
        ELSE '❌ Expirada'
    END AS status
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.is_active = TRUE
ORDER BY s.created_at DESC;

-- Limpar sessões expiradas
DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;

-- Invalidar sessões de um usuário específico
DELETE FROM sessions WHERE user_id = (
    SELECT id FROM users WHERE domain = 'XXX' AND username = 'presto'
);

-- ============================================================================
-- 4. CONSULTAS: TOKENS DE RECUPERAÇÃO DE SENHA
-- ============================================================================

-- Listar todos os tokens
SELECT 
    prt.id,
    prt.token,
    u.domain,
    u.username,
    u.email,
    prt.expires_at,
    prt.used,
    prt.created_at,
    CASE 
        WHEN prt.used = TRUE THEN '🔒 Usado'
        WHEN prt.expires_at < CURRENT_TIMESTAMP THEN '⏰ Expirado'
        ELSE '✅ Válido'
    END AS status
FROM password_reset_tokens prt
JOIN users u ON prt.user_id = u.id
ORDER BY prt.created_at DESC;

-- Buscar último token criado
SELECT 
    prt.id,
    prt.token,
    u.domain,
    u.username,
    u.email,
    prt.expires_at,
    prt.used,
    prt.created_at
FROM password_reset_tokens prt
JOIN users u ON prt.user_id = u.id
ORDER BY prt.created_at DESC
LIMIT 1;

-- Verificar token específico
SELECT 
    prt.*,
    u.domain,
    u.username,
    u.email,
    CASE 
        WHEN prt.used = TRUE THEN '❌ JÁ USADO'
        WHEN prt.expires_at < CURRENT_TIMESTAMP THEN '❌ EXPIRADO'
        ELSE '✅ VÁLIDO'
    END AS status
FROM password_reset_tokens prt
JOIN users u ON prt.user_id = u.id
WHERE prt.token = 'SEU_TOKEN_AQUI';

-- Tokens válidos (não usados e não expirados)
SELECT 
    prt.token,
    u.domain,
    u.username,
    u.email,
    prt.expires_at
FROM password_reset_tokens prt
JOIN users u ON prt.user_id = u.id
WHERE prt.used = FALSE 
  AND prt.expires_at > CURRENT_TIMESTAMP
ORDER BY prt.created_at DESC;

-- Limpar tokens expirados e usados (mais de 7 dias)
DELETE FROM password_reset_tokens 
WHERE (used = TRUE OR expires_at < CURRENT_TIMESTAMP)
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Invalidar todos os tokens de um usuário
UPDATE password_reset_tokens 
SET used = TRUE 
WHERE user_id = (
    SELECT id FROM users WHERE domain = 'XXX' AND username = 'presto'
);

-- ============================================================================
-- 5. CONSULTAS: LOGS DE ACESSO
-- ============================================================================

-- Listar últimos logs
SELECT 
    al.id,
    u.domain,
    u.username,
    al.action,
    al.ip_address,
    al.created_at
FROM access_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 20;

-- Logs de um usuário específico
SELECT 
    action,
    ip_address,
    created_at
FROM access_logs
WHERE user_id = (
    SELECT id FROM users WHERE domain = 'XXX' AND username = 'presto'
)
ORDER BY created_at DESC;

-- Contar ações por tipo
SELECT 
    action,
    COUNT(*) AS total
FROM access_logs
GROUP BY action
ORDER BY total DESC;

-- Logs de recuperação de senha
SELECT 
    u.domain,
    u.username,
    u.email,
    al.action,
    al.ip_address,
    al.created_at
FROM access_logs al
JOIN users u ON al.user_id = u.id
WHERE al.action IN ('password_reset_requested', 'password_reset_completed')
ORDER BY al.created_at DESC;

-- Limpar logs antigos (mais de 90 dias)
DELETE FROM access_logs 
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- ============================================================================
-- 6. MANUTENÇÃO: CRIAR USUÁRIO DE TESTE
-- ============================================================================

-- Criar usuário de teste (senha: presto123)
INSERT INTO users (domain, username, password_hash, email, full_name, is_active, is_admin)
VALUES (
    'XXX',
    'teste',
    '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq',
    'teste@webpresto.com.br',
    'USUÁRIO DE TESTE',
    TRUE,
    FALSE
)
ON CONFLICT (domain, username) DO NOTHING;

-- ============================================================================
-- 7. MANUTENÇÃO: RESETAR SENHA DE USUÁRIO
-- ============================================================================

-- Resetar senha de um usuário para "presto123"
UPDATE users 
SET password_hash = '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq',
    updated_at = CURRENT_TIMESTAMP
WHERE domain = 'XXX' AND username = 'presto';

-- ============================================================================
-- 8. VERIFICAÇÕES: INTEGRIDADE DO BANCO
-- ============================================================================

-- Verificar usuários sem domínio válido
SELECT u.*
FROM users u
LEFT JOIN domains d ON u.domain = d.domain
WHERE d.domain IS NULL;

-- Verificar sessões sem usuário válido
SELECT s.*
FROM sessions s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;

-- Verificar sessões sem domínio válido
SELECT s.*
FROM sessions s
LEFT JOIN domains d ON s.domain = d.domain
WHERE d.domain IS NULL;

-- Verificar tokens sem usuário válido
SELECT prt.*
FROM password_reset_tokens prt
LEFT JOIN users u ON prt.user_id = u.id
WHERE u.id IS NULL;

-- ============================================================================
-- 9. ESTATÍSTICAS GERAIS
-- ============================================================================

-- Dashboard geral do sistema
SELECT 
    '🏢 Total de Domínios' AS metrica,
    COUNT(*)::TEXT AS valor
FROM domains
UNION ALL
SELECT 
    '✅ Domínios Ativos',
    COUNT(*)::TEXT
FROM domains WHERE is_active = TRUE
UNION ALL
SELECT 
    '👥 Total de Usuários',
    COUNT(*)::TEXT
FROM users
UNION ALL
SELECT 
    '✅ Usuários Ativos',
    COUNT(*)::TEXT
FROM users WHERE is_active = TRUE
UNION ALL
SELECT 
    '🔑 Sessões Ativas',
    COUNT(*)::TEXT
FROM sessions 
WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
UNION ALL
SELECT 
    '🔒 Tokens de Reset Válidos',
    COUNT(*)::TEXT
FROM password_reset_tokens 
WHERE used = FALSE AND expires_at > CURRENT_TIMESTAMP
UNION ALL
SELECT 
    '📋 Total de Logs',
    COUNT(*)::TEXT
FROM access_logs
UNION ALL
SELECT 
    '📊 Logs (Últimas 24h)',
    COUNT(*)::TEXT
FROM access_logs 
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours';

-- ============================================================================
-- 10. BACKUP: EXPORTAR DADOS
-- ============================================================================

-- Exportar domínios (para backup manual)
-- COPY (SELECT * FROM domains) TO '/tmp/domains_backup.csv' WITH CSV HEADER;

-- Exportar usuários (para backup manual)
-- COPY (SELECT * FROM users) TO '/tmp/users_backup.csv' WITH CSV HEADER;

-- Exportar logs (para análise)
-- COPY (
--     SELECT al.*, u.domain, u.username 
--     FROM access_logs al 
--     LEFT JOIN users u ON al.user_id = u.id 
--     WHERE al.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
-- ) TO '/tmp/access_logs_30days.csv' WITH CSV HEADER;

-- ============================================================================
-- FIM DAS QUERIES ÚTEIS
-- ============================================================================
