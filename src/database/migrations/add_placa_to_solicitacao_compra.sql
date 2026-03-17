-- ============================================================================
-- MIGRATION: ADICIONAR COLUNA PLACA NA TABELA SOLICITACAO_COMPRA
-- Data: 04/03/2026
-- Objetivo: Registrar placa do veículo nas solicitações de compra para análise de custo
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
        WHERE table_name = '[dominio]_solicitacao_compra' 
        AND column_name = 'placa'
    ) THEN
        -- Adicionar a coluna
        ALTER TABLE [dominio]_solicitacao_compra 
        ADD COLUMN placa VARCHAR(10) NULL;
        
        RAISE NOTICE 'Coluna placa adicionada com sucesso na tabela [dominio]_solicitacao_compra';
    ELSE
        RAISE NOTICE 'Coluna placa já existe na tabela [dominio]_solicitacao_compra';
    END IF;
END $$;

-- ✅ ADICIONAR ÍNDICE PARA MELHOR PERFORMANCE (opcional)
CREATE INDEX IF NOT EXISTS idx_[dominio]_solicitacao_compra_placa 
ON [dominio]_solicitacao_compra(placa);

-- ============================================================================
-- EXEMPLO DE USO PARA DOMÍNIO ESPECÍFICO:
-- ============================================================================
-- Para DMN:
-- ALTER TABLE dmn_solicitacao_compra ADD COLUMN placa VARCHAR(10) NULL;
-- CREATE INDEX IF NOT EXISTS idx_dmn_solicitacao_compra_placa ON dmn_solicitacao_compra(placa);

-- Para ACV:
-- ALTER TABLE acv_solicitacao_compra ADD COLUMN placa VARCHAR(10) NULL;
-- CREATE INDEX IF NOT EXISTS idx_acv_solicitacao_compra_placa ON acv_solicitacao_compra(placa);
