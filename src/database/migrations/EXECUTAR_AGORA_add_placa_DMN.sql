-- ============================================================================
-- ⚡ EXECUÇÃO IMEDIATA: ADICIONAR COLUNA PLACA NO DOMÍNIO DMN
-- Data: 04/03/2026
-- ============================================================================

-- ✅ 1. ADICIONAR COLUNA PLACA NA TABELA dmn_ordem_compra
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dmn_ordem_compra' 
        AND column_name = 'placa'
    ) THEN
        ALTER TABLE dmn_ordem_compra ADD COLUMN placa VARCHAR(10) NULL;
        RAISE NOTICE '✅ Coluna placa adicionada em dmn_ordem_compra';
    ELSE
        RAISE NOTICE '⚠️ Coluna placa já existe em dmn_ordem_compra';
    END IF;
END $$;

-- ✅ 2. CRIAR ÍNDICE PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_dmn_ordem_compra_placa ON dmn_ordem_compra(placa);

-- ✅ 3. VERIFICAR SE A COLUNA FOI CRIADA
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'dmn_ordem_compra' 
AND column_name = 'placa';

-- ✅ 4. (OPCIONAL) ADICIONAR COLUNA PLACA NA TABELA dmn_requisicao (caso ainda não exista)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dmn_requisicao' 
        AND column_name = 'placa'
    ) THEN
        ALTER TABLE dmn_requisicao ADD COLUMN placa VARCHAR(10) NULL;
        RAISE NOTICE '✅ Coluna placa adicionada em dmn_requisicao';
    ELSE
        RAISE NOTICE '⚠️ Coluna placa já existe em dmn_requisicao';
    END IF;
END $$;

-- ✅ 5. CRIAR ÍNDICE PARA REQUISIÇÃO
CREATE INDEX IF NOT EXISTS idx_dmn_requisicao_placa ON dmn_requisicao(placa);

-- ============================================================================
-- ✅ FINALIZADO - EXECUTE ESTE SCRIPT NO BANCO DO DOMÍNIO DMN
-- ============================================================================
