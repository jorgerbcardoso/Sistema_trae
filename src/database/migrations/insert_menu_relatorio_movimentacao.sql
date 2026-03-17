-- ============================================================================
-- SCRIPT DE INSERÇÃO: Menu Relatório de Movimentação de Estoque
-- ============================================================================
-- Sistema: PRESTO
-- Módulo: Estoque
-- Data: 2025-01-30
-- ============================================================================

-- Inserir no menu principal (domínio ACV)
INSERT INTO acv_menu_sistema (seq_menu_pai, descricao, icone, ordem, componente, ativo, visivel)
VALUES (
  (SELECT seq_menu FROM acv_menu_sistema WHERE descricao = 'Relatórios' AND seq_menu_pai IS NULL LIMIT 1),
  'Movimentação de Estoque',
  'TrendingUp',
  40,
  'estoque/RelatorioMovimentacao',
  'S',
  'S'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- NOTAS:
-- ============================================================================
-- 1. O menu será inserido dentro do grupo "Relatórios"
-- 2. Ordem 40 para aparecer após outros relatórios existentes
-- 3. Componente: estoque/RelatorioMovimentacao (já registrado)
-- 4. Ícone: TrendingUp (do lucide-react)
-- ============================================================================
