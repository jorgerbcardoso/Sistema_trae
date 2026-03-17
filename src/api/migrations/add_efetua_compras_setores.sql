-- ============================================
-- MIGRATION: Adicionar campo efetua_compras em setores
-- Data: 2026-03-01
-- Autor: Sistema PRESTO
-- ============================================
-- Descrição:
-- Adiciona coluna efetua_compras (boolean) na tabela de setores
-- para controlar quais setores são responsáveis por compras.
-- ============================================

-- ============================================
-- EXECUTAR PARA CADA DOMÍNIO
-- ============================================

-- ⚠️ SUBSTITUIR [DOMINIO] PELO DOMÍNIO REAL (ex: acv, vcs, dmn)

-- 1. Adicionar coluna efetua_compras
ALTER TABLE [dominio]_setores 
ADD COLUMN IF NOT EXISTS efetua_compras BOOLEAN DEFAULT FALSE;

-- 2. Comentário
COMMENT ON COLUMN [dominio]_setores.efetua_compras IS 
'Se TRUE, o setor é responsável por efetuar compras e pode ser selecionado em ordens de compra';

-- 3. Setor GERAL (nro_setor = 1) SEMPRE efetua compras
UPDATE [dominio]_setores 
SET efetua_compras = TRUE 
WHERE nro_setor = 1;

-- ============================================
-- EXEMPLOS DE CONFIGURAÇÃO
-- ============================================

-- Marcar setor específico como responsável por compras:
-- UPDATE [dominio]_setores SET efetua_compras = TRUE WHERE nro_setor = 2;

-- Listar todos os setores que efetuam compras:
-- SELECT nro_setor, descricao, efetua_compras FROM [dominio]_setores WHERE efetua_compras = TRUE;

-- ============================================
-- COMANDOS PARA APLICAR EM CADA DOMÍNIO
-- ============================================

-- ACV (Aceville)
ALTER TABLE acv_setores ADD COLUMN IF NOT EXISTS efetua_compras BOOLEAN DEFAULT FALSE;
UPDATE acv_setores SET efetua_compras = TRUE WHERE nro_setor = 1;

-- VCS
ALTER TABLE vcs_setores ADD COLUMN IF NOT EXISTS efetua_compras BOOLEAN DEFAULT FALSE;
UPDATE vcs_setores SET efetua_compras = TRUE WHERE nro_setor = 1;

-- DMN
ALTER TABLE dmn_setores ADD COLUMN IF NOT EXISTS efetua_compras BOOLEAN DEFAULT FALSE;
UPDATE dmn_setores SET efetua_compras = TRUE WHERE nro_setor = 1;

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar estrutura:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'acv_setores' AND column_name = 'efetua_compras';

-- Verificar dados:
-- SELECT nro_setor, descricao, efetua_compras FROM acv_setores ORDER BY nro_setor;
