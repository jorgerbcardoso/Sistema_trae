-- ========================================
-- MIGRATION 009: CONTROLE DE TRANSBORDO
-- ========================================
-- 
-- Esta migration adiciona a funcionalidade de Controle de Transbordo
-- ao sistema PRESTO.
--
-- Data: Janeiro/2026
-- Autor: Sistema PRESTO
-- ========================================

-- ========================================
-- 1. ADICIONAR ITEM NO MENU
-- ========================================

INSERT INTO menu_items (
  name,
  description,
  icon,
  route,
  component_path,
  section_id,
  display_order,
  created_at,
  updated_at
) VALUES (
  'CONTROLE DE TRANSBORDO',
  'RELAÇÃO E CONTROLE DE VOLUMES TRANSBORDADOS',
  'Package',
  '/relatorios/controle-transbordo',
  'relatorios/ControleTransbordo',
  (SELECT id FROM menu_sections WHERE name = 'RELATÓRIOS' LIMIT 1),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM menu_items WHERE section_id = (SELECT id FROM menu_sections WHERE name = 'RELATÓRIOS' LIMIT 1)),
  NOW(),
  NOW()
);

-- ========================================
-- 2. VERIFICAÇÃO
-- ========================================

-- Verificar se o item foi criado corretamente
SELECT 
  mi.id,
  mi.name,
  mi.description,
  mi.icon,
  mi.route,
  mi.component_path,
  ms.name as section_name,
  mi.display_order
FROM menu_items mi
JOIN menu_sections ms ON mi.section_id = ms.id
WHERE mi.name = 'CONTROLE DE TRANSBORDO';

-- ========================================
-- 3. EXEMPLO DE CRIAÇÃO DA TABELA DE TRANSBORDO
-- ========================================
-- 
-- IMPORTANTE: Substitua [dominio] pelo código do domínio
-- Exemplo: acv_transbordo, rose_transbordo, etc.
-- 
-- Esta tabela deve ser criada para cada domínio que necessitar
-- da funcionalidade de Controle de Transbordo
-- ========================================

/*
-- Template para criação da tabela (executar para cada domínio)
CREATE TABLE IF NOT EXISTS [dominio]_transbordo (
  unidade VARCHAR(10) NOT NULL,
  mes INT NOT NULL,
  ano INT NOT NULL,
  origem VARCHAR(10) NOT NULL,
  destino VARCHAR(10) NOT NULL,
  qtde_cte INT DEFAULT 0,
  qtde_vol INT DEFAULT 0,
  peso_calc DECIMAL(10,2) DEFAULT 0, -- em TONELADAS
  part DECIMAL(5,2) DEFAULT 0,       -- participação em percentual
  frete_cif DECIMAL(12,2) DEFAULT 0,
  frete_fob DECIMAL(12,2) DEFAULT 0,
  frete_ter DECIMAL(12,2) DEFAULT 0,
  frete_total DECIMAL(12,2) DEFAULT 0,
  icms DECIMAL(12,2) DEFAULT 0,
  PRIMARY KEY (unidade, mes, ano, origem, destino)
);

-- Criar índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_[dominio]_transbordo_mes_ano ON [dominio]_transbordo(mes, ano);
CREATE INDEX IF NOT EXISTS idx_[dominio]_transbordo_unidade ON [dominio]_transbordo(unidade);
CREATE INDEX IF NOT EXISTS idx_[dominio]_transbordo_origem ON [dominio]_transbordo(origem);
CREATE INDEX IF NOT EXISTS idx_[dominio]_transbordo_destino ON [dominio]_transbordo(destino);

-- Comentários nas colunas
COMMENT ON COLUMN [dominio]_transbordo.unidade IS 'Unidade de transbordo';
COMMENT ON COLUMN [dominio]_transbordo.mes IS 'Mês de referência (1-12)';
COMMENT ON COLUMN [dominio]_transbordo.ano IS 'Ano de referência';
COMMENT ON COLUMN [dominio]_transbordo.origem IS 'Unidade de origem';
COMMENT ON COLUMN [dominio]_transbordo.destino IS 'Unidade de destino';
COMMENT ON COLUMN [dominio]_transbordo.qtde_cte IS 'Quantidade de CT-es';
COMMENT ON COLUMN [dominio]_transbordo.qtde_vol IS 'Quantidade de volumes';
COMMENT ON COLUMN [dominio]_transbordo.peso_calc IS 'Peso calculado em TONELADAS';
COMMENT ON COLUMN [dominio]_transbordo.part IS 'Participação percentual';
COMMENT ON COLUMN [dominio]_transbordo.frete_cif IS 'Valor do frete CIF';
COMMENT ON COLUMN [dominio]_transbordo.frete_fob IS 'Valor do frete FOB';
COMMENT ON COLUMN [dominio]_transbordo.frete_ter IS 'Valor do frete de terceiros';
COMMENT ON COLUMN [dominio]_transbordo.frete_total IS 'Valor total do frete';
COMMENT ON COLUMN [dominio]_transbordo.icms IS 'Valor do ICMS';

-- Dados de exemplo (opcional - para testes)
INSERT INTO [dominio]_transbordo (unidade, mes, ano, origem, destino, qtde_cte, qtde_vol, peso_calc, part, frete_cif, frete_fob, frete_ter, frete_total, icms)
VALUES
  ('CWB', 1, 2026, 'POA', 'GRU', 45, 1250, 18.50, 25.30, 12500.00, 8750.00, 3200.00, 24450.00, 2934.00),
  ('CWB', 1, 2026, 'FLN', 'GRU', 32, 890, 13.20, 18.10, 9800.00, 6200.00, 2100.00, 18100.00, 2172.00),
  ('GRU', 1, 2026, 'CWB', 'REC', 28, 750, 11.80, 16.20, 15600.00, 9400.00, 4800.00, 29800.00, 3576.00),
  ('CWB', 1, 2026, 'POA', 'RIO', 38, 1020, 15.60, 21.40, 11200.00, 7800.00, 2900.00, 21900.00, 2628.00),
  ('GRU', 1, 2026, 'RIO', 'FOR', 22, 580, 8.90, 12.20, 13800.00, 8200.00, 3600.00, 25600.00, 3072.00),
  ('CWB', 1, 2026, 'FLN', 'BSB', 18, 420, 6.80, 9.30, 8900.00, 5600.00, 1800.00, 16300.00, 1956.00);
*/

-- ========================================
-- 4. PERMISSÕES
-- ========================================

-- Dar permissão de acesso ao item do menu para todos os usuários
-- (ajuste conforme necessário para seu caso de uso)

-- Verificar permissões atuais
SELECT 
  u.username,
  u.is_admin,
  mi.name as menu_item,
  up.can_access,
  up.can_export
FROM users u
LEFT JOIN user_permissions up ON u.id = up.user_id
LEFT JOIN menu_items mi ON up.item_id = mi.id
WHERE mi.name = 'CONTROLE DE TRANSBORDO'
ORDER BY u.username;

-- ========================================
-- FIM DA MIGRATION
-- ========================================
