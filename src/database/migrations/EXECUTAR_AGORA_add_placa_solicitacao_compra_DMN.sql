-- ============================================================================
-- ⚡ EXECUÇÃO IMEDIATA: ADICIONAR COLUNA PLACA NA TABELA dmn_solicitacao_compra
-- Data: 04/03/2026
-- ============================================================================

-- ✅ ADICIONAR COLUNA PLACA
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dmn_solicitacao_compra' 
        AND column_name = 'placa'
    ) THEN
        ALTER TABLE dmn_solicitacao_compra ADD COLUMN placa VARCHAR(10) NULL;
        RAISE NOTICE '✅ Coluna placa adicionada em dmn_solicitacao_compra';
    ELSE
        RAISE NOTICE '⚠️ Coluna placa já existe em dmn_solicitacao_compra';
    END IF;
END $$;

-- ✅ CRIAR ÍNDICE PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_dmn_solicitacao_compra_placa ON dmn_solicitacao_compra(placa);

-- ✅ VERIFICAR SE A COLUNA FOI CRIADA
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'dmn_solicitacao_compra' 
AND column_name = 'placa';

-- ============================================================================
-- ✅ FINALIZADO - EXECUTE ESTE SCRIPT NO BANCO DO DOMÍNIO DMN
-- ============================================================================
