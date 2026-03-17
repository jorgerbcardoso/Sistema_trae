-- ================================================================
-- MIGRATION 008: POPULAR TABELA menu_items
-- ================================================================
-- Data: 2026-01-20
-- Descrição: Inserir todos os itens de menu do sistema baseado no mock atual
-- ================================================================

-- Limpar tabela antes de popular (caso já existam dados)
TRUNCATE TABLE menu_items RESTART IDENTITY CASCADE;

-- ================================================================
-- SEÇÃO: DASHBOARDS
-- ================================================================

-- 1. Dashboard Financeiro (DRE)
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'dashboard_dre',
    'DASHBOARD FINANCEIRO',
    'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO',
    'TrendingUp',
    '/dashboards/dre',
    'dashboards/FinanceiroDashboard',
    true,
    'active'
);

-- 2. Resultado das Linhas
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'dashboard_linhas',
    'RESULTADO DAS LINHAS',
    'RESULTADO OPERACIONAL POR LINHA DE TRANSPORTE',
    'Route',
    '/dashboards/linhas',
    'dashboards/LinhasDashboard',
    true,
    'active'
);

-- 3. Performance de Entregas
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'dashboard_performance_entregas',
    'PERFORMANCE DE ENTREGAS',
    'ANÁLISE DE ENTREGAS E PRAZOS',
    'Truck',
    '/dashboards/performance-entregas',
    'dashboards/PerformanceEntregas',
    true,
    'active'
);

-- 4. Performance de Coletas
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'dashboard_performance_coletas',
    'PERFORMANCE DE COLETAS',
    'ANÁLISE DE COLETAS E PRAZOS',
    'Package',
    '/dashboards/performance-coletas',
    'dashboards/PerformanceColetas',
    true,
    'active'
);

-- 5. Fluxo de Caixa (Em Desenvolvimento)
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'dashboard_fluxo_caixa',
    'FLUXO DE CAIXA',
    'CONTROLE DE ENTRADAS E SAÍDAS',
    'DollarSign',
    '/dashboards/fluxo-caixa',
    'dashboards/FluxoCaixa',
    false,
    'development'
);

-- ================================================================
-- SEÇÃO: CADASTROS
-- ================================================================

-- 6. Cadastro de Eventos
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'cadastro_eventos',
    'CADASTRO DE EVENTOS',
    'GERENCIAR TIPOS DE DESPESAS E EVENTOS',
    'FolderPlus',
    '/cadastros/eventos',
    'cadastros/CadastroEventos',
    true,
    'active'
);

-- 7. Grupos de Eventos
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'grupos_eventos',
    'GRUPOS DE EVENTOS',
    'GERENCIAR GRUPOS E ASSOCIAÇÕES DE EVENTOS',
    'FolderOpen',
    '/cadastros/grupos-eventos',
    'cadastros/GruposEventos',
    true,
    'active'
);

-- 8. Cadastro de Linhas
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'cadastro_linhas',
    'CADASTRO DE LINHAS',
    'GERENCIAR LINHAS DE TRANSPORTE',
    'Route',
    '/cadastros/linhas',
    'cadastros/CadastroLinhas',
    true,
    'active'
);

-- ================================================================
-- SEÇÃO: OPERAÇÕES (Em Desenvolvimento)
-- ================================================================

-- 9. Cadastro de Veículos (Em Desenvolvimento)
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'op_veiculos',
    'CADASTRO DE VEÍCULOS',
    'GERENCIAR FROTA DE VEÍCULOS',
    'Truck',
    '/operacoes/veiculos',
    'operations/CadastroVeiculos',
    false,
    'development'
);

-- ================================================================
-- SEÇÃO: RELATÓRIOS
-- ================================================================

-- 10. Conferência de Saídas
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'conferencia_saidas',
    'CONFERÊNCIA DE SAÍDAS',
    'RELATÓRIO DE MANIFESTOS E SAÍDAS DE VEÍCULOS',
    'Truck',
    '/relatorios/conferencia-saidas',
    'relatorios/ConferenciaSaidas',
    true,
    'active'
);

-- 11. Relação de Disponíveis (Em Desenvolvimento)
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'rel_disponiveis',
    'RELAÇÃO DE DISPONÍVEIS',
    'VEÍCULOS E MOTORISTAS DISPONÍVEIS',
    'CheckSquare',
    '/relatorios/disponiveis',
    'reports/RelacaoDisponiveis',
    false,
    'development'
);

-- ================================================================
-- SEÇÃO: ADMINISTRAÇÃO
-- ================================================================

-- 12. Gestão de Usuários
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'admin_usuarios',
    'GESTÃO DE USUÁRIOS',
    'GERENCIAR USUÁRIOS DO SISTEMA',
    'UserPlus',
    '/gerenciamento/usuarios',
    'UserManagement',
    true,
    'active'
);

-- 13. Gestão de Domínios
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'admin_dominios',
    'GESTÃO DE DOMÍNIOS',
    'GERENCIAR DOMÍNIOS E MODALIDADES',
    'Building2',
    '/admin/dominios',
    'admin/GestaoDominios',
    true,
    'active'
);

-- 14. Gestão de Permissões
INSERT INTO menu_items (
    code, name, description, icon, route_path, component_path, is_available, status
) VALUES (
    'admin_permissoes',
    'GESTÃO DE PERMISSÕES',
    'DEFINIR PERMISSÕES DE ACESSO POR DOMÍNIO',
    'Shield',
    '/admin/permissoes',
    'admin/GestaoPermissoes',
    true,
    'active'
);

-- ================================================================
-- VERIFICAR RESULTADOS
-- ================================================================

-- Ver todos os registros inseridos
SELECT 
    id,
    code,
    name,
    route_path,
    component_path,
    is_available,
    status
FROM menu_items
ORDER BY id;

-- Contagem por status
SELECT 
    status,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_available = true) as disponiveis,
    COUNT(*) FILTER (WHERE is_available = false) as indisponiveis
FROM menu_items
GROUP BY status
ORDER BY status;

-- ================================================================
-- OBSERVAÇÕES
-- ================================================================
-- 
-- 1. Total de itens: 14
-- 2. Ativos (active): 11 itens
-- 3. Em Desenvolvimento (development): 3 itens
-- 4. component_path: Caminho relativo dentro de /components
-- 5. route_path: Rota completa no React Router
-- 6. icon: Nome do componente do lucide-react
-- 
-- ================================================================
