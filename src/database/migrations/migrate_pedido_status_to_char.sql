-- ============================================================================
-- MIGRAÇÃO DE DADOS: Atualizar status de pedidos para CHAR(1)
-- ============================================================================
-- Objetivo: Converter status de pedidos de VARCHAR(20) para CHAR(1)
-- Valores antigos -> Novos:
--   'PENDENTE' -> 'P'
--   'APROVADO' -> 'E' (consideramos como ENTREGUE)
--   'ENTREGUE' -> 'E'
--   'FINALIZADO' -> 'E'
-- ============================================================================

-- ATUALIZAR TODOS OS PEDIDOS COM STATUS EM TEXTO PARA CHAR(1)
UPDATE [dominio]_pedido
SET status = CASE
    WHEN UPPER(status) IN ('PENDENTE', 'ABERTO', 'EM ANDAMENTO') THEN 'P'
    WHEN UPPER(status) IN ('APROVADO', 'ENTREGUE', 'FINALIZADO', 'CONCLUIDO', 'CONCLUÍDO') THEN 'E'
    ELSE 'P' -- Default: qualquer outro valor vira PENDENTE
END
WHERE LENGTH(status) > 1; -- Apenas atualiza se for texto longo

-- VERIFICAR RESULTADOS
SELECT 
    status,
    COUNT(*) as qtd
FROM [dominio]_pedido
GROUP BY status
ORDER BY status;
