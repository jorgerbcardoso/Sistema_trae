-- ============================================================================
-- MIGRATION: ADICIONAR COLUNA PLACA NA TABELA ORDEM_COMPRA
-- Data: 04/03/2026
-- Objetivo: Registrar placa do veículo nas ordens de compra para análise de custo
-- ============================================================================

-- Para cada domínio, executar:
-- Substitua [dominio] pelo prefixo do cliente (ex: acv, dmn, etc)

-- ✅ ADICIONAR COLUNA PLACA (caso não exista)
DO $$ 
BEGIN
    -- Verificar se a coluna já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = '[dominio]_ordem_compra' 
        AND column_name = 'placa'
    ) THEN
        -- Adicionar a coluna
        ALTER TABLE [dominio]_ordem_compra 
        ADD COLUMN placa VARCHAR(10) NULL;
        
        RAISE NOTICE 'Coluna placa adicionada com sucesso na tabela [dominio]_ordem_compra';
    ELSE
        RAISE NOTICE 'Coluna placa já existe na tabela [dominio]_ordem_compra';
    END IF;
END $$;

-- ✅ ADICIONAR ÍNDICE PARA MELHOR PERFORMANCE (opcional)
CREATE INDEX IF NOT EXISTS idx_[dominio]_ordem_compra_placa 
ON [dominio]_ordem_compra(placa);

-- ============================================================================
-- EXEMPLO DE USO PARA DOMÍNIO ESPECÍFICO:
-- ============================================================================
-- Para DMN:
-- ALTER TABLE dmn_ordem_compra ADD COLUMN placa VARCHAR(10) NULL;
-- CREATE INDEX IF NOT EXISTS idx_dmn_ordem_compra_placa ON dmn_ordem_compra(placa);

-- Para ACV:
-- ALTER TABLE acv_ordem_compra ADD COLUMN placa VARCHAR(10) NULL;
-- CREATE INDEX IF NOT EXISTS idx_acv_ordem_compra_placa ON acv_ordem_compra(placa);
