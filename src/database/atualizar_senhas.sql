-- ============================================================================
-- ATUALIZAR HASHES DE SENHA PARA "presto123"
-- ============================================================================
-- Use este script para atualizar apenas os hashes de senha sem recriar o banco
-- ============================================================================

\c presto;

\echo '========================================';
\echo '🔐 ATUALIZANDO HASHES DE SENHA';
\echo '========================================';
\echo '';

-- Mostrar senhas ANTES da atualização
\echo '📊 HASHES ANTES DA ATUALIZAÇÃO:';
SELECT 
    domain,
    username,
    CASE 
        WHEN password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' THEN '❌ HASH ERRADO (password)'
        WHEN password_hash = '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq' THEN '✅ HASH CORRETO (presto123)'
        ELSE '❓ HASH DESCONHECIDO'
    END AS status_hash
FROM users
ORDER BY domain, username;

\echo '';
\echo '========================================';
\echo '🔧 ATUALIZANDO PARA HASH CORRETO';
\echo '========================================';

-- Atualizar TODOS os usuários que têm o hash ERRADO
UPDATE users 
SET password_hash = '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq'
WHERE password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

\echo '';
\echo '✅ Hashes atualizados!';
\echo '';

-- Mostrar senhas DEPOIS da atualização
\echo '========================================';
\echo '📊 HASHES DEPOIS DA ATUALIZAÇÃO:';
\echo '========================================';
\echo '';

SELECT 
    domain,
    username,
    email,
    CASE 
        WHEN password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' THEN '❌ AINDA ERRADO'
        WHEN password_hash = '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq' THEN '✅ CORRETO'
        ELSE '❓ OUTRO HASH'
    END AS status_hash
FROM users
ORDER BY domain, username;

\echo '';
\echo '========================================';
\echo '📈 ESTATÍSTICAS:';
\echo '========================================';

SELECT 
    COUNT(*) AS total_usuarios,
    COUNT(*) FILTER (WHERE password_hash = '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq') AS com_hash_correto,
    COUNT(*) FILTER (WHERE password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi') AS com_hash_errado,
    COUNT(*) FILTER (WHERE password_hash NOT IN (
        '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    )) AS com_hash_customizado
FROM users;

\echo '';
\echo '========================================';
\echo '✅ ATUALIZAÇÃO CONCLUÍDA!';
\echo '========================================';
\echo '';
\echo '🔐 Credenciais para login:';
\echo '';
\echo 'Domínio: ACV';
\echo 'Usuário: presto (ou admin, financeiro, operacional)';
\echo 'Senha: presto123';
\echo '';
\echo 'Domínio: VCS';
\echo 'Usuário: presto (ou admin, joao.silva, maria.santos, carlos.oliveira)';
\echo 'Senha: presto123';
\echo '';
\echo 'Domínio: XXX';
\echo 'Usuário: presto';
\echo 'Senha: presto123';
\echo '';
\echo '========================================';
