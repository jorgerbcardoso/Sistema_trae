-- ============================================================================
-- SISTEMA PRESTO - INSERT MENU - MÓDULOS ESTOQUE E COMPRAS
-- ============================================================================
-- Data: 27/01/2026
-- Descrição: Comandos SQL para inserir seções e itens de menu
-- ============================================================================

-- ============================================================================
-- SEÇÃO: ESTOQUE
-- ============================================================================
INSERT INTO menu_sections (code, name, description, icon, display_order, is_active)
VALUES (
    'estoque',
    'ESTOQUE',
    'GESTÃO DE ESTOQUE E INVENTÁRIO',
    'Package',
    5,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- SEÇÃO: COMPRAS
-- ============================================================================
INSERT INTO menu_sections (code, name, description, icon, display_order, is_active)
VALUES (
    'compras',
    'COMPRAS',
    'GESTÃO DE COMPRAS E FORNECEDORES',
    'ShoppingCart',
    6,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- ITENS DO MENU - ESTOQUE
-- ============================================================================

-- Item: Cadastro de Estoques
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_cadastro_estoques',
    'CADASTRO DE ESTOQUES',
    'GERENCIAR ESTOQUES DA EMPRESA',
    'Warehouse',
    '/estoque/cadastro-estoques',
    'estoque/CadastroEstoques',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Cadastro de Posições
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_cadastro_posicoes',
    'CADASTRO DE POSIÇÕES',
    'GERENCIAR POSIÇÕES DOS ESTOQUES',
    'MapPin',
    '/estoque/cadastro-posicoes',
    'estoque/CadastroPosicoes',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Cadastro de Tipos de Item
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_cadastro_tipos_item',
    'CADASTRO DE TIPOS DE ITEM',
    'GERENCIAR CATEGORIAS DE ITENS',
    'Tag',
    '/estoque/cadastro-tipos-item',
    'estoque/CadastroTiposItem',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Cadastro de Itens
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_cadastro_itens',
    'CADASTRO DE ITENS',
    'GERENCIAR ITENS DO ESTOQUE',
    'Package',
    '/estoque/cadastro-itens',
    'estoque/CadastroItens',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Entrada no Estoque
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_entrada',
    'ENTRADA NO ESTOQUE',
    'REGISTRAR ENTRADAS DE MATERIAL',
    'ArrowDownCircle',
    '/estoque/entrada',
    'estoque/EntradaEstoque',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Saída do Estoque
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_saida',
    'SAÍDA DO ESTOQUE',
    'REGISTRAR SAÍDAS DE MATERIAL',
    'ArrowUpCircle',
    '/estoque/saida',
    'estoque/SaidaEstoque',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Inventário
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_inventario',
    'INVENTÁRIO',
    'GERENCIAR INVENTÁRIOS DE ESTOQUE',
    'ClipboardCheck',
    '/estoque/inventario',
    'estoque/Inventario',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Relatório de Movimentação
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'estoque_relatorio_movimentacao',
    'RELATÓRIO DE MOVIMENTAÇÃO',
    'HISTÓRICO DE MOVIMENTAÇÕES DO ESTOQUE',
    'FileText',
    '/estoque/relatorio-movimentacao',
    'estoque/RelatorioMovimentacao',
    (SELECT id FROM menu_sections WHERE code = 'estoque'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- ============================================================================
-- ITENS DO MENU - COMPRAS
-- ============================================================================

-- Item: Cadastro de Fornecedores
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'compras_cadastro_fornecedores',
    'CADASTRO DE FORNECEDORES',
    'GERENCIAR FORNECEDORES',
    'Truck',
    '/compras/cadastro-fornecedores',
    'compras/CadastroFornecedores',
    (SELECT id FROM menu_sections WHERE code = 'compras'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Cadastro de Centros de Custo
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'compras_cadastro_centros_custo',
    'CADASTRO DE CENTROS DE CUSTO',
    'GERENCIAR CENTROS DE CUSTO',
    'DollarSign',
    '/compras/cadastro-centros-custo',
    'compras/CadastroCentrosCusto',
    (SELECT id FROM menu_sections WHERE code = 'compras'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Ordens de Compra
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'compras_ordens_compra',
    'ORDENS DE COMPRA',
    'GERENCIAR ORDENS DE COMPRA',
    'FileText',
    '/compras/ordens-compra',
    'compras/CadastroOrdensCompra',
    (SELECT id FROM menu_sections WHERE code = 'compras'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Aprovação de Ordens
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'compras_aprovacao_ordens',
    'APROVAÇÃO DE ORDENS',
    'APROVAR/REPROVAR ORDENS DE COMPRA',
    'CheckSquare',
    '/compras/aprovacao-ordens',
    'compras/AprovacaoOrdensCompra',
    (SELECT id FROM menu_sections WHERE code = 'compras'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Orçamentos
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'compras_orcamentos',
    'ORÇAMENTOS',
    'GERENCIAR ORÇAMENTOS E COTAÇÕES',
    'Calculator',
    '/compras/orcamentos',
    'compras/CadastroOrcamentos',
    (SELECT id FROM menu_sections WHERE code = 'compras'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Aprovação de Orçamentos
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'compras_aprovacao_orcamentos',
    'APROVAÇÃO DE ORÇAMENTOS',
    'APROVAR ORÇAMENTOS E GERAR PEDIDOS',
    'CheckCircle',
    '/compras/aprovacao-orcamentos',
    'compras/AprovacaoOrcamentos',
    (SELECT id FROM menu_sections WHERE code = 'compras'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Item: Pedidos
INSERT INTO menu_items (code, name, description, icon, route_path, component_path, section_id, is_available, status)
VALUES (
    'compras_pedidos',
    'PEDIDOS',
    'GERENCIAR PEDIDOS DE COMPRA (VIA ORÇAMENTO OU MANUAIS)',
    'Package',
    '/compras/pedidos',
    'compras/Pedidos',
    (SELECT id FROM menu_sections WHERE code = 'compras'),
    true,
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    route_path = EXCLUDED.route_path,
    component_path = EXCLUDED.component_path,
    is_available = EXCLUDED.is_available,
    status = EXCLUDED.status,
    updated_at = NOW();

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
-- Verificar seções criadas
SELECT * FROM menu_sections WHERE code IN ('estoque', 'compras');

-- Verificar itens criados
SELECT mi.code, mi.name, ms.name as section_name
FROM menu_items mi
INNER JOIN menu_sections ms ON mi.section_id = ms.id
WHERE ms.code IN ('estoque', 'compras')
ORDER BY ms.display_order, mi.id;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
