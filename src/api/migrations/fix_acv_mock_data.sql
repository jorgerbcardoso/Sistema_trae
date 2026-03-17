-- ============================================
-- FIX: Configuração use_mock_data para ACV
-- ============================================
-- Este script verifica e corrige a configuração
-- de use_mock_data para o domínio ACV
-- ============================================

-- 1. VERIFICAR ESTADO ATUAL
SELECT 
    id,
    domain,
    name,
    use_mock_data,
    controla_linhas,
    is_active,
    updated_at
FROM domains
WHERE domain = 'ACV';

-- 2. ATUALIZAR para usar dados REAIS (não mockados)
UPDATE domains
SET 
    use_mock_data = FALSE,
    updated_at = NOW()
WHERE domain = 'ACV';

-- 3. VERIFICAR DEPOIS DA ATUALIZAÇÃO
SELECT 
    id,
    domain,
    name,
    use_mock_data,
    controla_linhas,
    is_active,
    updated_at
FROM domains
WHERE domain = 'ACV';

-- 4. VERIFICAR TODOS OS DOMÍNIOS
SELECT 
    id,
    domain,
    name,
    use_mock_data,
    controla_linhas,
    is_active
FROM domains
ORDER BY domain;

-- ============================================
-- COMANDOS INDIVIDUAIS PARA TESTE RÁPIDO
-- ============================================

-- Forçar ACV usar dados REAIS
-- UPDATE domains SET use_mock_data = FALSE WHERE domain = 'ACV';

-- Forçar ACV usar dados MOCKADOS
-- UPDATE domains SET use_mock_data = TRUE WHERE domain = 'ACV';

-- Ver status de ACV
-- SELECT domain, use_mock_data, is_active FROM domains WHERE domain = 'ACV';
