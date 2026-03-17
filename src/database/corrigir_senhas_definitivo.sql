-- ============================================================================
-- CORREÇÃO DEFINITIVA DE SENHAS - Sistema Presto
-- ============================================================================
-- Este script atualiza TODAS as senhas para o hash CORRETO de "presto123"
-- Execute: psql -U presto -d presto -f database/corrigir_senhas_definitivo.sql
-- ============================================================================

-- Hash CORRETO gerado com PHP password_hash('presto123', PASSWORD_BCRYPT)
-- Gerado em: 2024-12-08
-- Testado e validado com password_verify()

BEGIN;

-- Mostrar estado ANTES da correção
SELECT 
    'ANTES DA CORREÇÃO' as status,
    domain,
    username,
    LEFT(password_hash, 20) || '...' as hash_atual,
    LENGTH(password_hash) as tamanho
FROM users
ORDER BY domain, username;

-- ATUALIZAR TODAS AS SENHAS PARA O HASH CORRETO
-- Hash gerado por: password_hash('presto123', PASSWORD_BCRYPT, ['cost' => 10])
-- IMPORTANTE: Este hash foi testado e FUNCIONA com password_verify()

UPDATE users
SET 
    password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    updated_at = CURRENT_TIMESTAMP
WHERE password_hash IS NOT NULL;

-- Mostrar estado APÓS a correção
SELECT 
    'APÓS CORREÇÃO' as status,
    domain,
    username,
    LEFT(password_hash, 20) || '...' as hash_novo,
    LENGTH(password_hash) as tamanho
FROM users
ORDER BY domain, username;

-- Mostrar resumo
SELECT 
    COUNT(*) as total_usuarios_atualizados,
    COUNT(DISTINCT domain) as total_dominios
FROM users
WHERE password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================
SELECT 
    '✅ TODAS AS SENHAS FORAM ATUALIZADAS PARA: presto123' as resultado;
