-- ================================================================
-- POPULAR TABELA DE EVENTOS PARA TESTE
-- ================================================================
-- Este script popula a tabela [dominio]_evento com eventos de exemplo
-- para testar o lançamento SSW
-- ================================================================

-- IMPORTANTE: Substituir 'acv' pelo seu domínio real antes de executar

-- Inserir eventos de exemplo
INSERT INTO acv_evento (evento, descricao, ordem, considerar, tipo, grupo) 
VALUES 
  (101, 'COMPRA DE MERCADORIAS', 1, 'S', 'D', NULL),
  (102, 'FRETE SOBRE COMPRAS', 2, 'S', 'D', NULL),
  (103, 'DESPESAS COM COMBUSTÍVEL', 3, 'S', 'D', NULL),
  (104, 'MANUTENÇÃO DE VEÍCULOS', 4, 'S', 'D', NULL),
  (105, 'MATERIAL DE ESCRITÓRIO', 5, 'S', 'D', NULL),
  (106, 'SERVIÇOS DE TERCEIROS', 6, 'S', 'D', NULL),
  (107, 'DESPESAS COM TELEFONE', 7, 'S', 'D', NULL),
  (108, 'ENERGIA ELÉTRICA', 8, 'S', 'D', NULL),
  (109, 'ÁGUA E ESGOTO', 9, 'S', 'D', NULL),
  (110, 'ALUGUEL DE IMÓVEIS', 10, 'S', 'D', NULL)
ON CONFLICT (evento) DO NOTHING;

-- Verificar inserção
SELECT 
  evento,
  descricao,
  ordem,
  considerar,
  tipo
FROM acv_evento
ORDER BY evento;
