-- ============================================================================
-- ⚡ FIX URGENTE: ADICIONAR COLUNA PLACA NO DOMÍNIO DMN
-- EXECUTAR IMEDIATAMENTE NO BANCO DE DADOS
-- ============================================================================

-- Tabela: dmn_ordem_compra
ALTER TABLE dmn_ordem_compra ADD COLUMN IF NOT EXISTS placa VARCHAR(10) NULL;
CREATE INDEX IF NOT EXISTS idx_dmn_ordem_compra_placa ON dmn_ordem_compra(placa);

-- Tabela: dmn_requisicao  
ALTER TABLE dmn_requisicao ADD COLUMN IF NOT EXISTS placa VARCHAR(10) NULL;
CREATE INDEX IF NOT EXISTS idx_dmn_requisicao_placa ON dmn_requisicao(placa);

-- Verificar
SELECT 'dmn_ordem_compra' AS tabela, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'dmn_ordem_compra' AND column_name = 'placa'
UNION ALL
SELECT 'dmn_requisicao' AS tabela, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'dmn_requisicao' AND column_name = 'placa';
