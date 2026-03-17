-- ============================================================================
-- ATUALIZAÇÃO DE HASH CORRETO - Sistema Presto
-- ============================================================================
-- Hash gerado e validado em: 2024-12-08
-- Hash testado com password_verify() no servidor de produção
-- Senha: presto123
-- Hash: $2y$10$x2QYk3gDkEwVvdKOmDVnxOA.d.9rYSuyl0FRYcQlEhcJ1300x.Zmy
-- ============================================================================

BEGIN;

-- Mostrar estado ANTES
SELECT 
    '🔍 ANTES DA ATUALIZAÇÃO' as status,
    domain,
    username,
    LEFT(password_hash, 30) || '...' as hash_antigo
FROM users
ORDER BY domain, username;

-- ATUALIZAR COM O HASH CORRETO
UPDATE users
SET password_hash = '$2y$10$x2QYk3gDkEwVvdKOmDVnxOA.d.9rYSuyl0FRYcQlEhcJ1300x.Zmy',
    updated_at = CURRENT_TIMESTAMP
WHERE password_hash IS NOT NULL;

-- Mostrar estado DEPOIS
SELECT 
    '✅ APÓS ATUALIZAÇÃO' as status,
    domain,
    username,
    LEFT(password_hash, 30) || '...' as hash_novo,
    updated_at
FROM users
ORDER BY domain, username;

-- Resumo
SELECT 
    COUNT(*) as usuarios_atualizados,
    COUNT(DISTINCT domain) as dominios_afetados
FROM users
WHERE password_hash = '$2y$10$x2QYk3gDkEwVvdKOmDVnxOA.d.9rYSuyl0FRYcQlEhcJ1300x.Zmy';

COMMIT;

SELECT '🎉 TODAS AS SENHAS FORAM ATUALIZADAS PARA: presto123' as resultado;
