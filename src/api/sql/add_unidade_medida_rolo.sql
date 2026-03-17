-- ============================================================================
-- ADICIONAR UNIDADE DE MEDIDA: ROLO
-- Data: 2026-03-08
-- Descrição: Adiciona a unidade de medida "ROLO" (sigla: R) na tabela de 
--            unidades de medida de todos os domínios
-- ============================================================================

-- ✅ MÉTODO RECOMENDADO: Usar o script exec_all_domains.php
-- Este script automatiza a execução em todos os domínios ativos
--
-- Executar no terminal:
-- cd /var/www/html/sistema/api
-- php exec_all_domains.php "INSERT INTO $_unidade_medida (seq_unidade_medida, descricao, sigla, ativo, login_inclusao) VALUES (11, 'ROLO', 'R', 'S', 'SISTEMA') ON CONFLICT (seq_unidade_medida) DO NOTHING"
--
-- O caractere $ será substituído automaticamente pelo prefixo de cada domínio:
-- - acv_unidade_medida
-- - vcs_unidade_medida
-- - ssw_unidade_medida
-- - xxx_unidade_medida

-- ============================================================================
-- MÉTODO ALTERNATIVO: Execução manual por domínio
-- ============================================================================
-- Use apenas se não puder executar o script exec_all_domains.php

-- ============================================================================
-- DOMÍNIO: XXX (PADRÃO)
-- ============================================================================
INSERT INTO xxx_unidade_medida (seq_unidade_medida, descricao, sigla, ativo, login_inclusao)
VALUES (11, 'ROLO', 'R', 'S', 'SISTEMA')
ON CONFLICT (seq_unidade_medida) DO NOTHING;

-- ============================================================================
-- DOMÍNIO: VCS (VCSLOG)
-- ============================================================================
INSERT INTO vcs_unidade_medida (seq_unidade_medida, descricao, sigla, ativo, login_inclusao)
VALUES (11, 'ROLO', 'R', 'S', 'SISTEMA')
ON CONFLICT (seq_unidade_medida) DO NOTHING;

-- ============================================================================
-- DOMÍNIO: ACV (ACEVILLE)
-- ============================================================================
INSERT INTO acv_unidade_medida (seq_unidade_medida, descricao, sigla, ativo, login_inclusao)
VALUES (11, 'ROLO', 'R', 'S', 'SISTEMA')
ON CONFLICT (seq_unidade_medida) DO NOTHING;

-- ============================================================================
-- DOMÍNIO: SSW (SISTEMA INTERNO SSW)
-- ============================================================================
INSERT INTO ssw_unidade_medida (seq_unidade_medida, descricao, sigla, ativo, login_inclusao)
VALUES (11, 'ROLO', 'R', 'S', 'SISTEMA')
ON CONFLICT (seq_unidade_medida) DO NOTHING;

-- ============================================================================
-- VERIFICAÇÃO: Listar todas as unidades de medida após inserção
-- ============================================================================
-- SELECT domain, descricao, sigla FROM (
--     SELECT 'XXX' as domain, descricao, sigla FROM xxx_unidade_medida WHERE sigla = 'R'
--     UNION ALL
--     SELECT 'VCS' as domain, descricao, sigla FROM vcs_unidade_medida WHERE sigla = 'R'
--     UNION ALL
--     SELECT 'ACV' as domain, descricao, sigla FROM acv_unidade_medida WHERE sigla = 'R'
--     UNION ALL
--     SELECT 'SSW' as domain, descricao, sigla FROM ssw_unidade_medida WHERE sigla = 'R'
-- ) AS unidades
-- ORDER BY domain;

-- ============================================================================
-- ROLLBACK (caso necessário)
-- ============================================================================
-- DELETE FROM xxx_unidade_medida WHERE seq_unidade_medida = 11;
-- DELETE FROM vcs_unidade_medida WHERE seq_unidade_medida = 11;
-- DELETE FROM acv_unidade_medida WHERE seq_unidade_medida = 11;
-- DELETE FROM ssw_unidade_medida WHERE seq_unidade_medida = 11;