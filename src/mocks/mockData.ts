/**
 * Dados Mockados para Desenvolvimento
 * Usado quando USE_MOCK_DATA = true
 */

// Mock de Usuários
export const MOCK_USERS = [
  {
    id: 1,
    domain: 'XXX',
    username: 'presto',
    email: 'admin@webpresto.com.br',
    full_name: 'ADMINISTRADOR DO SISTEMA',
    unidade: 'MTZ',
    nro_setor: 1,
    is_active: true
  },
  {
    id: 2,
    domain: 'VCS',
    username: 'presto',
    email: 'presto@vcs.com.br',
    full_name: 'USUÁRIO PADRÃO',
    unidade: 'PIN',
    nro_setor: 1,
    is_active: true
  },
  {
    id: 3,
    domain: 'VCS',
    username: 'admin',
    email: 'admin@vcs.com.br',
    full_name: 'ADMINISTRADOR VCS',
    unidade: 'MTZ',
    nro_setor: 3,
    is_active: true
  },
  {
    id: 4,
    domain: 'VCS',
    username: 'joao.silva',
    email: 'joao.silva@vcs.com.br',
    full_name: 'JOÃO SILVA',
    unidade: 'PIN',
    nro_setor: 2,
    is_active: true
  },
  {
    id: 5,
    domain: 'VCS',
    username: 'maria.santos',
    email: 'maria.santos@vcs.com.br',
    full_name: 'MARIA SANTOS',
    unidade: 'CAM',
    nro_setor: 4,
    is_active: true
  },
  {
    id: 6,
    domain: 'VCS',
    username: 'carlos.oliveira',
    email: 'carlos.oliveira@vcs.com.br',
    full_name: 'CARLOS OLIVEIRA',
    unidade: 'SPA',
    nro_setor: 5,
    is_active: true
  },
  {
    id: 7,
    domain: 'ACV',
    username: 'admin',
    email: 'admin@aceville.com.br',
    full_name: 'ADMINISTRADOR ACEVILLE',
    unidade: 'MTZ',
    nro_setor: 1,
    is_active: true
  },
  {
    id: 8,
    domain: 'ACV',
    username: 'presto',
    email: 'presto@aceville.com.br',
    full_name: 'USUÁRIO PADRÃO',
    unidade: 'MTZ',
    nro_setor: 1,
    is_active: true
  },
  {
    id: 9,
    domain: 'ACV',
    username: 'financeiro',
    email: 'financeiro@aceville.com.br',
    full_name: 'SETOR FINANCEIRO',
    unidade: 'MTZ',
    nro_setor: 4,
    is_active: true
  },
  {
    id: 10,
    domain: 'ACV',
    username: 'operacional',
    email: 'operacional@aceville.com.br',
    full_name: 'SETOR OPERACIONAL',
    unidade: 'MTZ',
    nro_setor: 5,
    is_active: true
  },
  // ========================================
  // DOMÍNIO: DMN
  // ========================================
  {
    id: 11,
    domain: 'DMN',
    username: 'presto',
    email: 'presto@dmn.com.br',
    full_name: 'USUÁRIO PADRÃO',
    unidade: 'MTZ',
    nro_setor: 1, // ✅ ADICIONADO
    is_active: true
  },
  {
    id: 12,
    domain: 'DMN',
    username: 'admin',
    email: 'admin@dmn.com.br',
    full_name: 'ADMINISTRADOR DMN',
    unidade: 'MTZ',
    nro_setor: 1, // ✅ ADICIONADO
    is_active: true
  },
  {
    id: 13,
    domain: 'DMN',
    username: 'estoque',
    email: 'estoque@dmn.com.br',
    full_name: 'SETOR ESTOQUE',
    unidade: 'BHZ',
    nro_setor: 2, // ✅ ADICIONADO (setor diferente para teste)
    is_active: true
  },
  {
    id: 14,
    domain: 'DMN',
    username: 'compras',
    email: 'compras@dmn.com.br',
    full_name: 'SETOR COMPRAS',
    unidade: 'RJO',
    nro_setor: 3, // ✅ ADICIONADO (setor diferente para teste)
    is_active: true
  }
];

// Mock de Domínios
export const MOCK_DOMAINS = [
  {
    domain: 'XXX',
    name: 'Presto Tecnologia',
    client_name: 'SUPER ADMIN',
    website: 'https://webpresto.com.br',
    email: 'admin@webpresto.com.br',
    modalidade: 'CARGAS' as const,
    use_mock_data: true, // XXX sempre usa mock (desenvolvimento)
    favicon_url: 'https://webpresto.com.br/favicon.png', // Favicon padrão do Presto
    controla_linhas: false, // XXX não controla linhas (dados mockados)
    total_users: 1,
    total_permissions: 16,
    last_created: '2024-01-15',
    is_super_admin: true,
    is_active: true,
    ssw_domain: 'XXX',
    ssw_username: 'presto',
    ssw_password: 'web@pres',
    ssw_cpf: '11111160',
  },
  {
    domain: 'VCS',
    name: 'Viação Cruzeiro do Sul',
    client_name: 'Viação Cruzeiro do Sul',
    website: 'vcs.com.br',
    email: 'contato@vcs.com.br',
    modalidade: 'MISTA' as const,
    use_mock_data: true, // VCS usa mock (todos começam com MOCK)
    favicon_url: 'https://webpresto.com.br/favicon.png', // Usar favicon padrão do Presto
    controla_linhas: false, // VCS não controla linhas (dados mockados)
    total_users: 5,
    total_permissions: 13,
    last_created: '2025-01-20T10:00:00Z',
    is_super_admin: false,
    is_active: true,
    // Credenciais SSW (padrão)
    ssw_domain: 'VCS',
    ssw_username: 'presto',
    ssw_password: 'web@pres',
    ssw_cpf: '11111160'
  },
  {
    domain: 'ACV',
    name: 'Aceville Transportes',
    client_name: 'Aceville Transportes',
    website: 'acevilletransportes.com.br',
    email: 'contato@acevilletransportes.com.br',
    modalidade: 'CARGAS' as const,
    use_mock_data: false, // ✅ ACV usa BACKEND para dashboards (login sempre usa backend)
    favicon_url: 'https://webpresto.com.br/images/evochat/favicon_aceville.png', // Favicon da Aceville
    controla_linhas: false, // ACV não controla linhas (dados mockados)
    total_users: 4,
    total_permissions: 13,
    last_created: '2025-01-20T10:00:00Z',
    is_super_admin: false,
    is_active: true,
    // Credenciais SSW (padrão)
    ssw_domain: 'ACV',
    ssw_username: 'presto',
    ssw_password: 'web@pres',
    ssw_cpf: '11111160'
  },
  {
    domain: 'DMN',
    name: 'DMN Transportes',
    client_name: 'DMN Transportes',
    website: 'dmntransportes.com.br',
    email: 'contato@dmntransportes.com.br',
    modalidade: 'CARGAS' as const,
    use_mock_data: false, // ✅ DMN usa BACKEND
    favicon_url: 'https://webpresto.com.br/favicon.png', // Favicon padrão
    controla_linhas: false,
    total_users: 4,
    total_permissions: 13,
    last_created: '2025-01-20T10:00:00Z',
    is_super_admin: false,
    is_active: true,
    // Credenciais SSW (padrão)
    ssw_domain: 'DMN',
    ssw_username: 'presto',
    ssw_password: 'web@pres',
    ssw_cpf: '11111160'
  }
];

// Mock de Seções do Menu
export const MOCK_MENU_SECTIONS = [
  {
    id: 1,
    code: 'dashboards',
    name: 'DASHBOARDS',
    description: 'PAINÉIS ANALÍTICOS E INDICADORES',
    icon: 'BarChart3',
    display_order: 1
  },
  {
    id: 2,
    code: 'cadastros',
    name: 'CADASTROS',
    description: 'CADASTROS GERAIS DO SISTEMA',
    icon: 'FolderPlus',
    display_order: 2
  },
  {
    id: 3,
    code: 'operations',
    name: 'OPERAÇÕES',
    description: 'GESTÃO OPERACIONAL E PROCESSOS',
    icon: 'Cog',
    display_order: 3
  },
  {
    id: 4,
    code: 'reports',
    name: 'RELATÓRIOS',
    description: 'RELATÓRIOS GERENCIAIS E EXPORTAÇÕES',
    icon: 'FileText',
    display_order: 4
  },
  {
    id: 5,
    code: 'admin',
    name: 'ADMINISTRAÇÃO',
    description: 'GESTÃO DE DOMÍNIOS E PERMISSÕES',
    icon: 'Settings',
    display_order: 5
  },
  {
    id: 6,
    code: 'estoque',
    name: 'ESTOQUE',
    description: 'GESTÃO DE ESTOQUE E INVENTÁRIO',
    icon: 'Warehouse',
    display_order: 6
  },
  {
    id: 7,
    code: 'compras',
    name: 'COMPRAS',
    description: 'GESTÃO DE COMPRAS E FORNECEDORES',
    icon: 'ShoppingCart',
    display_order: 7
  }
];

// Mock de Itens do Menu
export const MOCK_MENU_ITEMS = [
  // Dashboards
  {
    id: 1,
    section_id: 1,
    code: 'dashboard_dre',
    name: 'DASHBOARD FINANCEIRO',
    description: 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO',
    icon: 'TrendingUp',
    route_path: '/dashboards/dre',
    component_path: 'dashboards/FinanceiroDashboard',
    is_available: true,
    status: 'active'
  },
  {
    id: 2,
    section_id: 1,
    code: 'dashboard_performance_entregas',
    name: 'PERFORMANCE DE ENTREGAS',
    description: 'ANÁLISE DE ENTREGAS E PRAZOS',
    icon: 'Truck',
    route_path: '/dashboards/performance-entregas',
    component_path: 'dashboards/PerformanceEntregas',
    is_available: true,
    status: 'active'
  },
  {
    id: 9,
    section_id: 1,
    code: 'dashboard_performance_coletas',
    name: 'PERFORMANCE DE COLETAS',
    description: 'ANÁLISE DE COLETAS E PRAZOS',
    icon: 'Package',
    route_path: '/dashboards/performance-coletas',
    component_path: 'dashboards/PerformanceColetas',
    is_available: true,
    status: 'active'
  },
  {
    id: 3,
    section_id: 1,
    code: 'dashboard_fluxo_caixa',
    name: 'FLUXO DE CAIXA',
    description: 'CONTROLE DE ENTRADAS E SAÍDAS',
    icon: 'DollarSign',
    route_path: '/dashboards/fluxo-caixa',
    component_path: 'dashboards/FluxoCaixa',
    is_available: false,
    status: 'development'
  },
  
  // Operações
  {
    id: 6,
    section_id: 2,
    code: 'op_linhas',
    name: 'CADASTRO DE LINHAS',
    description: 'GERENCIAR LINHAS DE TRANSPORTE',
    icon: 'Route',
    route_path: '/operacoes/linhas',
    component_path: 'operations/CadastroLinhas',
    is_available: false,
    status: 'development'
  },
  {
    id: 7,
    section_id: 2,
    code: 'op_veiculos',
    name: 'CADASTRO DE VEÍCULOS',
    description: 'GERENCIAR FROTA DE VEÍCULOS',
    icon: 'Truck',
    route_path: '/operacoes/veiculos',
    component_path: 'operations/CadastroVeiculos',
    is_available: false,
    status: 'development'
  },
  
  // Cadastros (seção 2 no contexto XXX, mas incluídos aqui para consistência)
  {
    id: 6,
    section_id: 2,
    code: 'cadastro_eventos',
    name: 'CADASTRO DE EVENTOS',
    description: 'GERENCIAR TIPOS DE DESPESAS E EVENTOS',
    icon: 'FolderPlus',
    route_path: '/cadastros/eventos',
    component_path: 'cadastros/CadastroEventos',
    is_available: true,
    status: 'active'
  },
  {
    id: 8,
    section_id: 2,
    code: 'cadastro_linhas',
    name: 'CADASTRO DE LINHAS',
    description: 'GERENCIAR LINHAS DE TRANSPORTE',
    icon: 'Route',
    route_path: '/cadastros/linhas',
    component_path: 'cadastros/CadastroLinhas',
    is_available: true,
    status: 'active'
  },
  {
    id: 19,
    section_id: 2,
    code: 'vendedores',
    name: 'CADASTRO DE VENDEDORES',
    description: 'IMPORTAÇÃO DOS VENDEDORES E DEFINIÇÃO DE SETORES',
    icon: 'UserCheck',
    route_path: '/cadastros/vendedores',
    component_path: 'cadastros/Vendedores',
    is_available: true,
    status: 'active'
  },
  
  // Operações
  {
    id: 35,
    section_id: 3,
    code: 'aprovacao_despesas',
    name: 'APROVAÇÃO DE DESPESAS',
    description: 'GERENCIAMENTO E APROVAÇÃO DE DESPESAS PENDENTES',
    icon: 'FileCheck',
    route_path: '/operacoes/aprovacao-despesas',
    component_path: 'operacoes/AprovacaoDespesas',
    is_available: true,
    status: 'active'
  },
  
  // Relatórios
  {
    id: 11,
    section_id: 4,
    code: 'rel_disponiveis',
    name: 'RELAÇÃO DE DISPONÍVEIS',
    description: 'VEÍCULOS E MOTORISTAS DISPONÍVEIS',
    icon: 'CheckSquare',
    route_path: '/relatorios/disponiveis',
    component_path: 'reports/RelacaoDisponiveis',
    is_available: false,
    status: 'development'
  },
  {
    id: 12,
    section_id: 4,
    code: 'rel_totais_vendedores',
    name: 'TOTAIS DE VENDEDORES POR UNIDADE',
    description: 'PLANILHA DE VENDAS POR VENDEDOR E UNIDADE DOS ÚLTIMOS 3 MESES',
    icon: 'FileText',
    route_path: '/relatorios/totais_vendedores',
    component_path: 'relatorios/TotaisVendedores',
    is_available: true,
    status: 'active'
  },
  {
    id: 13,
    section_id: 4,
    code: 'rel_tabelas_vencer',
    name: 'TABELAS A VENCER',
    description: 'RELATÓRIO DE TABELAS COM VENCIMENTO ATÉ O FIM DO MÊS',
    icon: 'FileSpreadsheet',
    route_path: '/relatorios/tabelas-vencer',
    component_path: 'relatorios/TabelasVencer',
    is_available: true,
    status: 'active'
  },
  
  // Administração
  {
    id: 15,
    section_id: 5,
    code: 'admin_usuarios',
    name: 'GESTÃO DE USUÁRIOS',
    description: 'GERENCIAR USUÁRIOS DO SISTEMA',
    icon: 'UserPlus',
    route_path: '/cadastros/usuarios',
    component_path: 'UserManagement',
    is_available: true,
    status: 'active'
  },
  {
    id: 16,
    section_id: 5,
    code: 'admin_dominios',
    name: 'GESTÃO DE DOMÍNIOS',
    description: 'GERENCIAR DOMÍNIOS E MODALIDADES',
    icon: 'Building2',
    route_path: '/admin/dominios',
    component_path: 'admin/GestaoDominios',
    is_available: true,
    status: 'active'
  },
  {
    id: 17,
    section_id: 5,
    code: 'admin_permissoes',
    name: 'GESTÃO DE PERMISSÕES',
    description: 'DEFINIR PERMISSÕES DE ACESSO POR USUÁRIO',
    icon: 'Shield',
    route_path: '/admin/permissoes',
    component_path: 'admin/GestaoPermissoes',
    is_available: true,
    status: 'active'
  },
  {
    id: 18,
    section_id: 5,
    code: 'admin_menu',
    name: 'GESTÃO DO MENU',
    description: 'GERENCIAR SEÇÕES E ITENS DO MENU DO SISTEMA',
    icon: 'Menu',
    route_path: '/admin/menu',
    component_path: 'admin/GestaoMenu',
    is_available: true,
    status: 'active'
  },

  // ESTOQUE
  {
    id: 20,
    section_id: 6,
    code: 'estoque_cadastro_estoques',
    name: 'CADASTRO DE ESTOQUES',
    description: 'GERENCIAR ESTOQUES (ALMOXARIFADOS)',
    icon: 'Warehouse',
    route_path: '/estoque/cadastro-estoques',
    component_path: 'estoque/CadastroEstoques',
    is_available: true,
    status: 'active'
  },
  {
    id: 21,
    section_id: 6,
    code: 'estoque_tipos_item',
    name: 'TIPOS DE ITEM',
    description: 'GERENCIAR TIPOS DE ITENS',
    icon: 'Grid3x3',
    route_path: '/estoque/cadastro-tipos-item',
    component_path: 'estoque/CadastroTiposItem',
    is_available: true,
    status: 'active'
  },
  {
    id: 22,
    section_id: 6,
    code: 'estoque_itens',
    name: 'CADASTRO DE ITENS',
    description: 'GERENCIAR ITENS DO ESTOQUE',
    icon: 'Box',
    route_path: '/estoque/cadastro-itens',
    component_path: 'estoque/CadastroItens',
    is_available: true,
    status: 'active'
  },
  {
    id: 23,
    section_id: 6,
    code: 'estoque_posicoes',
    name: 'POSIÇÕES DE ESTOQUE',
    description: 'GERENCIAR POSIÇÕES/LOCALIZAÇÕES',
    icon: 'MapPin',
    route_path: '/estoque/cadastro-posicoes',
    component_path: 'estoque/CadastroPosicoes',
    is_available: true,
    status: 'active'
  },
  {
    id: 24,
    section_id: 6,
    code: 'estoque_entrada',
    name: 'ENTRADA NO ESTOQUE',
    description: 'REGISTRAR ENTRADAS NO ESTOQUE',
    icon: 'ArrowDownCircle',
    route_path: '/estoque/entrada',
    component_path: 'estoque/EntradaEstoque',
    is_available: true,
    status: 'active'
  },
  {
    id: 25,
    section_id: 6,
    code: 'estoque_saida',
    name: 'SAÍDA DE ESTOQUE',
    description: 'REGISTRAR SAÍDAS DO ESTOQUE',
    icon: 'ArrowUpCircle',
    route_path: '/estoque/saida',
    component_path: 'estoque/SaidaEstoque',
    is_available: true,
    status: 'active'
  },
  {
    id: 26,
    section_id: 6,
    code: 'estoque_inventario',
    name: 'INVENTÁRIO',
    description: 'REALIZAR INVENTÁRIO DE ESTOQUE',
    icon: 'ClipboardList',
    route_path: '/estoque/inventario',
    component_path: 'estoque/Inventario',
    is_available: true,
    status: 'active'
  },
  {
    id: 27,
    section_id: 6,
    code: 'estoque_relatorio_movimentacao',
    name: 'RELATÓRIO DE MOVIMENTAÇÃO',
    description: 'HISTÓRICO DE MOVIMENTAÇÕES',
    icon: 'FileText',
    route_path: '/estoque/relatorio-movimentacao',
    component_path: 'estoque/RelatorioMovimentacao',
    is_available: true,
    status: 'active'
  },

  // COMPRAS
  {
    id: 28,
    section_id: 7,
    code: 'compras_dashboard',
    name: 'DASHBOARD DE COMPRAS',
    description: 'ANÁLISE E INDICADORES DE COMPRAS',
    icon: 'BarChart3',
    route_path: '/compras/dashboard',
    component_path: 'compras/DashboardCompras',
    is_available: true,
    status: 'active'
  },
  {
    id: 29,
    section_id: 7,
    code: 'compras_fornecedores',
    name: 'CADASTRO DE FORNECEDORES',
    description: 'GERENCIAR FORNECEDORES',
    icon: 'Users',
    route_path: '/compras/fornecedores',
    component_path: 'compras/Fornecedores',
    is_available: true,
    status: 'active'
  },
  {
    id: 30,
    section_id: 7,
    code: 'compras_cadastro_centros_custo',
    name: 'CENTROS DE CUSTO',
    description: 'GERENCIAR CENTROS DE CUSTO',
    icon: 'DollarSign',
    route_path: '/compras/cadastro-centros-custo',
    component_path: 'compras/CadastroCentrosCusto',
    is_available: true,
    status: 'active'
  },
  {
    id: 31,
    section_id: 7,
    code: 'compras_orcamentos',
    name: 'ORÇAMENTOS',
    description: 'GERENCIAR ORÇAMENTOS E COTAÇÕES',
    icon: 'FileText',
    route_path: '/compras/orcamentos',
    component_path: 'compras/CadastroOrcamentos',
    is_available: true,
    status: 'active'
  },
  {
    id: 33,
    section_id: 7,
    code: 'compras_ordens_compra',
    name: 'ORDENS DE COMPRA',
    description: 'GERENCIAR ORDENS DE COMPRA',
    icon: 'ShoppingBag',
    route_path: '/compras/ordens-compra',
    component_path: 'compras/CadastroOrdensCompra',
    is_available: true,
    status: 'active'
  },
  {
    id: 33,
    section_id: 7,
    code: 'compras_aprovacao_ordens',
    name: 'APROVAÇÃO DE ORDENS',
    description: 'APROVAR/REPROVAR ORDENS DE COMPRA',
    icon: 'CheckSquare',
    route_path: '/compras/aprovacao-ordens',
    component_path: 'compras/AprovacaoOrdensCompra',
    is_available: true,
    status: 'active'
  },
  {
    id: 34,
    section_id: 7,
    code: 'compras_pedidos',
    name: 'PEDIDOS',
    description: 'GERENCIAR PEDIDOS DE COMPRA (VIA ORÇAMENTO OU MANUAIS)',
    icon: 'Package',
    route_path: '/compras/pedidos',
    component_path: 'compras/Pedidos',
    is_available: true,
    status: 'active'
  },
  {
    id: 36,
    section_id: 7,
    code: 'compras_solicitacoes',
    name: 'SOLICITAÇÕES DE COMPRA',
    description: 'GERENCIAR SOLICITAÇÕES DE COMPRA',
    icon: 'ClipboardList',
    route_path: '/compras/solicitacoes-compra',
    component_path: 'compras/SolicitacoesCompra',
    is_available: true,
    status: 'active'
  }
];

// Mock de Permissões do Domínio XXX (super admin - acesso total)
export const MOCK_PERMISSIONS_XXX = MOCK_MENU_ITEMS.map(item => ({
  menu_item_id: item.id,
  can_access: true,
  can_create: true,
  can_edit: true,
  can_delete: true,
  can_export: true
}));

// Mock de Permissões do Domínio VCS (acesso limitado)
export const MOCK_PERMISSIONS_VCS = MOCK_MENU_ITEMS
  .filter(item => item.section_id !== 5) // Sem acesso à administração
  .map(item => ({
    menu_item_id: item.id,
    can_access: true,
    can_create: item.id === 1, // Apenas DRE pode criar
    can_edit: false,
    can_delete: false,
    can_export: true
  }));

// Mock de Menu Completo para XXX
export const MOCK_MENU_XXX = {
  sections: MOCK_MENU_SECTIONS.map(section => ({
    ...section,
    items: MOCK_MENU_ITEMS
      .filter(item => item.section_id === section.id)
      .map(item => {
        const permission = MOCK_PERMISSIONS_XXX.find(p => p.menu_item_id === item.id);
        return {
          ...item,
          permissions: permission
        };
      })
  }))
};

// Mock de Menu Completo para VCS
export const MOCK_MENU_VCS = {
  sections: [
    // ========================================
    // SEÇÃO: DASHBOARDS
    // ========================================
    {
      id: 1,
      code: 'dashboards',
      name: 'DASHBOARDS',
      description: 'PAINÉIS ANALÍTICOS E INDICADORES',
      icon: 'BarChart3',
      display_order: 1,
      items: [
        // Dashboard Financeiro (DRE)
        {
          id: 1,
          section_id: 1,
          code: 'dashboard_dre',
          name: 'DASHBOARD FINANCEIRO',
          description: 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO',
          icon: 'TrendingUp',
          route_path: '/financeiro/dashboard',
          component_path: 'dashboards/FinanceiroDashboard',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        },
        // Resultado das Linhas
        {
          id: 2,
          section_id: 1,
          code: 'dashboard_linhas',
          name: 'RESULTADO DAS LINHAS',
          description: 'RESULTADO OPERACIONAL POR LINHA DE TRANSPORTE',
          icon: 'Route',
          route_path: '/dashboards/linhas',
          component_path: 'dashboards/LinhasDashboard',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: false
          }
        },
        // Performance de Entregas
        {
          id: 3,
          section_id: 1,
          code: 'dashboard_performance_entregas',
          name: 'PERFORMANCE DE ENTREGAS',
          description: 'ANÁLISE DE ENTREGAS E PRAZOS',
          icon: 'Truck',
          route_path: '/dashboards/performance-entregas',
          component_path: 'dashboards/PerformanceEntregas',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        },
        // Performance de Coletas
        {
          id: 9,
          section_id: 1,
          code: 'dashboard_performance_coletas',
          name: 'PERFORMANCE DE COLETAS',
          description: 'ANÁLISE DE COLETAS E PRAZOS',
          icon: 'Package',
          route_path: '/dashboards/performance-coletas',
          component_path: 'dashboards/PerformanceColetas',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        },
        // Fluxo de Caixa
        {
          id: 4,
          section_id: 1,
          code: 'dashboard_fluxo_caixa',
          name: 'FLUXO DE CAIXA',
          description: 'CONTROLE DE ENTRADAS E SAÍDAS',
          icon: 'DollarSign',
          route_path: '/financeiro/fluxo-caixa',
          component_path: 'dashboards/FluxoCaixa',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        }
      ]
    },
    // ========================================
    // SEÇÃO: CADASTROS
    // ========================================
    {
      id: 2,
      code: 'cadastros',
      name: 'CADASTROS',
      description: 'CADASTROS GERAIS DO SISTEMA',
      icon: 'FolderPlus',
      display_order: 2,
      items: [
        // Cadastro de Eventos
        {
          id: 18,
          section_id: 2,
          code: 'cadastro_eventos',
          name: 'CADASTRO DE EVENTOS',
          description: 'GERENCIAR TIPOS DE DESPESAS E EVENTOS',
          icon: 'FolderPlus',
          route_path: '/cadastros/eventos',
          component_path: 'cadastros/CadastroEventos',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true
          }
        },
        // Grupos de Eventos
        {
          id: 21,
          section_id: 2,
          code: 'grupos_eventos',
          name: 'GRUPOS DE EVENTOS',
          description: 'GERENCIAR GRUPOS E ASSOCIAÇÕES DE EVENTOS',
          icon: 'FolderOpen',
          route_path: '/cadastros/grupos-eventos',
          component_path: 'cadastros/GruposEventos',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true
          }
        },
        // Cadastro de Linhas
        {
          id: 20,
          section_id: 2,
          code: 'cadastro_linhas',
          name: 'CADASTRO DE LINHAS',
          description: 'GERENCIAR LINHAS DE TRANSPORTE',
          icon: 'Route',
          route_path: '/cadastros/linhas',
          component_path: 'cadastros/CadastroLinhas',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: false
          }
        },
        // Cadastro de Vendedores
        {
          id: 22,
          section_id: 2,
          code: 'vendedores',
          name: 'CADASTRO DE VENDEDORES',
          description: 'IMPORTAÇÃO DOS VENDEDORES E DEFINIÇÃO DE SETORES',
          icon: 'UserCheck',
          route_path: '/cadastros/vendedores',
          component_path: 'cadastros/Vendedores',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: true,
            can_delete: false,
            can_export: false
          }
        }
      ]
    },
    // ========================================
    // SEÇÃO: OPERAÇÕES
    // ========================================
    {
      id: 3,
      code: 'operations',
      name: 'OPERAÇÕES',
      description: 'GESTÃO OPERACIONAL E PROCESSOS',
      icon: 'Cog',
      display_order: 3,
      items: [
        // Aprovação de Despesas
        {
          id: 35,
          section_id: 3,
          code: 'aprovacao_despesas',
          name: 'APROVAÇÃO DE DESPESAS',
          description: 'GERENCIAMENTO E APROVAÇÃO DE DESPESAS PENDENTES',
          icon: 'FileCheck',
          route_path: '/operacoes/aprovacao-despesas',
          component_path: 'operacoes/AprovacaoDespesas',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: true,
            can_delete: false,
            can_export: true
          }
        }
      ]
    },
    // ========================================
    // SEÇÃO: RELATÓRIOS
    // ========================================
    {
      id: 4,
      code: 'reports',
      name: 'RELATÓRIOS',
      description: 'RELATÓRIOS E CONFERÊNCIAS',
      icon: 'FileText',
      display_order: 4,
      items: [
        // Conferência de Saídas
        {
          id: 20,
          section_id: 4,
          code: 'conferencia_saidas',
          name: 'CONFERÊNCIA DE SAÍDAS',
          description: 'RELATÓRIO DE MANIFESTOS E SAÍDAS DE VEÍCULOS',
          icon: 'Truck',
          route_path: '/relatorios/conferencia-saidas',
          component_path: 'relatorios/ConferenciaSaidas',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        },
        // Controle de Transbordo
        {
          id: 21,
          section_id: 4,
          code: 'controle_transbordo',
          name: 'CONTROLE DE TRANSBORDO',
          description: 'RELAÇÃO E CONTROLE DE VOLUMES TRANSBORDADOS',
          icon: 'Package',
          route_path: '/relatorios/controle-transbordo',
          component_path: 'relatorios/ControleTransbordo',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        },
        {
          id: 13,
          section_id: 4,
          code: 'rel_tabelas_vencer',
          name: 'TABELAS A VENCER',
          description: 'RELATÓRIO DE TABELAS COM VENCIMENTO ATÉ O FIM DO MÊS',
          icon: 'FileSpreadsheet',
          route_path: '/relatorios/tabelas-vencer',
          component_path: 'relatorios/TabelasVencer',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        },
        // ✅ TOTAIS DE VENDEDORES (ADICIONADO)
        {
          id: 12,
          section_id: 4,
          code: 'rel_totais_vendedores',
          name: 'TOTAIS DE VENDEDORES POR UNIDADE',
          description: 'PLANILHA DE VENDAS POR VENDEDOR E UNIDADE DOS ÚLTIMOS 3 MESES',
          icon: 'FileText',
          route_path: '/relatorios/totais_vendedores',
          component_path: 'relatorios/TotaisVendedores',
          is_available: true,
          status: 'active',
          permissions: {
            can_access: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: true
          }
        }
      ]
    },
    // ========================================
    // SEÇÃO: ADMINISTRAÇÃO
    // ========================================
    {
      id: 5,
      code: 'admin',
      name: 'ADMINISTRAÇÃO',
      description: 'GESTÃO DE DOMÍNIOS E PERMISSÕES',
      icon: 'Settings',
      display_order: 5,
      items: [
        // Gestão de Domínios
        {
          ...MOCK_MENU_ITEMS.find(item => item.code === 'admin_dominios')!,
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true
          }
        },
        // Gestão de Permissões
        {
          ...MOCK_MENU_ITEMS.find(item => item.code === 'admin_permissoes')!,
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true
          }
        },
        // Gestão de Usu��rios
        {
          ...MOCK_MENU_ITEMS.find(item => item.code === 'admin_usuarios')!,
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true
          }
        }
      ]
    },
    // ========================================
    // SEÇÃO: ESTOQUE
    // ========================================
    {
      id: 6,
      code: 'estoque',
      name: 'ESTOQUE',
      description: 'GESTÃO DE ESTOQUE E INVENTÁRIO',
      icon: 'Warehouse',
      display_order: 6,
      items: MOCK_MENU_ITEMS
        .filter(item => item.section_id === 6)
        .map(item => ({
          ...item,
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true
          }
        }))
    },
    // ========================================
    // SEÇÃO: COMPRAS
    // ========================================
    {
      id: 7,
      code: 'compras',
      name: 'COMPRAS',
      description: 'GESTÃO DE COMPRAS E FORNECEDORES',
      icon: 'ShoppingCart',
      display_order: 7,
      items: MOCK_MENU_ITEMS
        .filter(item => item.section_id === 7)
        .map(item => ({
          ...item,
          permissions: {
            can_access: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true
          }
        }))
    }
  ]
};

// Mock de Permissões de Domínio (para gestão)
export const MOCK_DOMAIN_PERMISSIONS = {
  VCS: {
    dashboards: MOCK_MENU_ITEMS
      .filter(item => item.section_id === 1)
      .map(item => ({
        item_id: item.id,
        item_code: item.code,
        item_name: item.name,
        icon: item.icon,
        permissions: {
          can_access: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: true
        }
      })),
    cadastros: MOCK_MENU_ITEMS
      .filter(item => item.section_id === 2)
      .map(item => ({
        item_id: item.id,
        item_code: item.code,
        item_name: item.name,
        icon: item.icon,
        permissions: {
          can_access: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true
        }
      })),
    operations: MOCK_MENU_ITEMS
      .filter(item => item.section_id === 3)
      .map(item => ({
        item_id: item.id,
        item_code: item.code,
        item_name: item.name,
        icon: item.icon,
        permissions: {
          can_access: true,
          can_create: false,
          can_edit: true,
          can_delete: false,
          can_export: true
        }
      })),
    reports: MOCK_MENU_ITEMS
      .filter(item => item.section_id === 4)
      .map(item => ({
        item_id: item.id,
        item_code: item.code,
        item_name: item.name,
        icon: item.icon,
        permissions: {
          can_access: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: true
        }
      }))
  }
};

// Helper: Obter usuários customizados do localStorage
function getCustomUsers(): any[] {
  try {
    const stored = localStorage.getItem('presto_custom_users');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('❌ Erro ao ler usuários customizados:', error);
    return [];
  }
}

// Helper: Obter domínios customizados do localStorage
function getCustomDomains(): any[] {
  try {
    const stored = localStorage.getItem('presto_custom_domains');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('❌ Erro ao ler domínios customizados:', error);
    return [];
  }
}

// Helper: Simular delay de rede
export const mockDelay = (ms: number = 300) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Helper: Verificar credenciais
export const mockLogin = async (domain: string, username: string, password: string) => {
  await mockDelay(500);
  
  console.log('🔍 [mockLogin] Tentando login com:', { domain, username, password: '***' });
  
  // Combinar usuários base + customizados
  const customUsers = getCustomUsers();
  const allUsers = [...MOCK_USERS, ...customUsers];
  
  console.log('🔍 [mockLogin] Total de usuários disponíveis:', allUsers.length);
  console.log('🔍 [mockLogin] Usuários disponíveis:', allUsers.map(u => `${u.domain}/${u.username}`));
  
  const user = allUsers.find(
    u => u.domain.toLowerCase() === domain.toLowerCase() && 
         u.username.toLowerCase() === username.toLowerCase()
  );
  
  if (!user) {
    console.error('❌ [mockLogin] Usuário não encontrado:', { domain, username });
    console.error('❌ [mockLogin] Domínios disponíveis:', [...new Set(allUsers.map(u => u.domain))]);
    throw new Error('USUÁRIO NÃO ENCONTRADO');
  }
  
  console.log('✅ [mockLogin] Usuário encontrado:', user);
  
  // Aceitar APENAS a senha padrão "presto123"
  if (password !== 'presto123') {
    console.error('❌ [mockLogin] Senha incorreta fornecida');
    throw new Error('SENHA INCORRETA');
  }
  
  // Buscar nome do domínio (incluindo customizados)
  const customDomains = getCustomDomains();
  const allDomains = [...MOCK_DOMAINS, ...customDomains];
  const domainInfo = allDomains.find(d => d.domain === user.domain);
  const clientName = domainInfo?.name || `EMPRESA ${user.domain}`;
  
  return {
    success: true,
    token: `mock_token_${user.id}_${Date.now()}`,
    user: {
      id: user.id,
      domain: user.domain,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      unidade: user.unidade || 'MTZ',
      nro_setor: user.nro_setor || 1,
      client_name: clientName
    }
  };
};

// Helper: Obter menu do usuário
export const mockGetMenu = async (domain: string, username?: string) => {
  await mockDelay(300);
  
  // ========================================
  // REGRA 1: Domínio XXX + usuário "presto"
  // ========================================
  // Mostra TUDO: Domínios, Permissões, Usuários
  if (domain === 'XXX' && username === 'presto') {
    return { success: true, menu: MOCK_MENU_XXX };
  }
  
  // ========================================
  // REGRA 2: Domínio XXX + outros usuários
  // ========================================
  // Mostra menu padrão sem administração
  if (domain === 'XXX' && username !== 'presto') {
    return {
      success: true,
      menu: {
        sections: MOCK_MENU_XXX.sections.filter(s => s.code !== 'admin')
      }
    };
  }
  
  // ========================================
  // REGRA 3: Outros domínios
  // ========================================
  const isAdmin = username === 'presto' || username === 'admin';
  
  let menuData;
  
  if (isAdmin) {
    // ✅ Admin: Mostra seção administração MAS apenas com "Gestão de Usuários"
    menuData = {
      sections: MOCK_MENU_VCS.sections.map(section => {
        if (section.code === 'admin') {
          // Filtrar para manter APENAS admin_usuarios
          return {
            ...section,
            items: section.items.filter((item: any) => item.code === 'admin_usuarios')
          };
        }
        return section;
      })
    };
  } else {
    // ❌ Não-admin: Remove seção administração completamente
    menuData = {
      sections: MOCK_MENU_VCS.sections.filter(s => s.code !== 'admin')
    };
  }
  
  return { 
    success: true, 
    menu: menuData
  };
};

// Helper: Obter lista de usuários
export const mockGetUsers = async (domain: string) => {
  await mockDelay(300);
  
  const users = MOCK_USERS.filter(u => u.domain === domain);
  return {
    success: true,
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      is_active: u.is_active,
      created_at: '2025-01-20T10:00:00Z'
    })),
    total: users.length
  };
};

// Helper: Obter lista de domínios
export const mockGetDomains = async () => {
  await mockDelay(300);
  return {
    success: true,
    domains: MOCK_DOMAINS,
    total: MOCK_DOMAINS.length
  };
};

// Helper: Criar domínio
export const mockCreateDomain = async (domain: string) => {
  await mockDelay(500);
  
  if (MOCK_DOMAINS.find(d => d.domain === domain)) {
    throw new Error('DOMÍNIO JÁ EXISTE');
  }
  
  return {
    success: true,
    message: 'DOMÍNIO CRIADO COM SUCESSO',
    domain: domain,
    users_created: ['presto', 'admin'],
    default_password: 'presto123'
  };
};

// Helper: Obter permissões de um domínio
export const mockGetDomainPermissions = async (domain: string) => {
  await mockDelay(300);
  
  // Consolidar TODAS as funcionalidades em uma única lista
  const allItems = MOCK_MENU_ITEMS.map(item => ({
    item_id: item.id,
    item_code: item.code,
    item_name: item.name,
    section_name: MOCK_MENU_SECTIONS.find(s => s.id === item.section_id)?.name || '',
    icon: item.icon,
    permissions: {
      can_access: true,
      can_create: domain === 'VCS' ? (item.id === 1) : true,
      can_edit: domain === 'VCS' ? false : true,
      can_delete: domain === 'VCS' ? false : true,
      can_export: true
    }
  }));
  
  return {
    success: true,
    domain: domain,
    permissions: {
      all_functions: {
        section_name: 'TODAS AS FUNCIONALIDADES',
        items: allItems
      }
    }
  };
};

// Helper: Atualizar permissões
export const mockUpdateDomainPermissions = async (domain: string, permissions: any[]) => {
  await mockDelay(500);
  
  return {
    success: true,
    message: 'PERMISSÕES ATUALIZADAS COM SUCESSO',
    domain: domain,
    updated: permissions.length,
    inserted: 0
  };
};

// ============================================
// MOCK DE CT-ES (CONHECIMENTOS DE TRANSPORTE)
// ============================================

interface CTe {
  id: number;
  numero: string;
  data_emissao: string;
  data_previsao_entrega: string;
  data_entrega: string | null;
  unidade_destino: string;
  unidade_entregadora: string;
  cnpj_pagador: string;
  nome_pagador: string;
  cnpj_destinatario: string;
  nome_destinatario: string;
  valor: number;
  status: 'ENTREGUE' | 'PENDENTE';
}

// Função auxiliar para gerar data aleatória
function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

// Gerar dados mockados de CT-es
function generateMockCTes(): CTe[] {
  const ctes: CTe[] = [];
  const hoje = new Date();
  const diasAtras60 = new Date(hoje);
  diasAtras60.setDate(hoje.getDate() - 60);
  
  // ✅ CORRIGIDO: Unidades com sigla de 3 letras + nome
  const unidades = [
    { sigla: 'SPO', nome: 'SÃO PAULO', cnpj: '12.345.678/0001-90' },
    { sigla: 'RJO', nome: 'RIO DE JANEIRO', cnpj: '23.456.789/0001-80' },
    { sigla: 'BHZ', nome: 'BELO HORIZONTE', cnpj: '34.567.890/0001-70' },
    { sigla: 'CWB', nome: 'CURITIBA', cnpj: '45.678.901/0001-60' },
    { sigla: 'POA', nome: 'PORTO ALEGRE', cnpj: '56.789.012/0001-50' },
    { sigla: 'BSB', nome: 'BRASÍLIA', cnpj: '67.890.123/0001-40' }
  ];
  const pagadores = [
    { cnpj: '12.345.678/0001-90', nome: 'EMPRESA ABC LTDA' },
    { cnpj: '23.456.789/0001-80', nome: 'INDÚSTRIA XYZ S.A.' },
    { cnpj: '34.567.890/0001-70', nome: 'COMÉRCIO 123 EIRELI' },
    { cnpj: '45.678.901/0001-60', nome: 'DISTRIBUIDORA DELTA' },
    { cnpj: '55.666.777/0001-50', nome: 'LOGÍSTICA OMEGA' },
    { cnpj: '66.777.888/0001-40', nome: 'INDÚSTRIA SIGMA' },
  ];
  const destinatarios = [
    { cnpj: '56.789.012/0001-50', nome: 'LOJA ALPHA' },
    { cnpj: '67.890.123/0001-40', nome: 'MERCADO BETA' },
    { cnpj: '78.901.234/0001-30', nome: 'SUPERMERCADO GAMA' },
    { cnpj: '89.012.345/0001-20', nome: 'ATACADO OMEGA' },
    { cnpj: '90.123.456/0001-10', nome: 'VAREJO DELTA' },
    { cnpj: '01.234.567/0001-00', nome: 'DISTRIBUIDOR KAPPA' },
  ];
  
  // Gerar 3000 CT-es (10x mais volume)
  for (let i = 1; i <= 3000; i++) {
    const dataEmissao = randomDate(diasAtras60, hoje);
    const emissaoDate = new Date(dataEmissao);
    
    // Previsão de entrega: 3 a 7 dias após emissão
    const diasPrevisao = 3 + Math.floor(Math.random() * 5);
    let previsaoDate = new Date(emissaoDate);
    previsaoDate.setDate(emissaoDate.getDate() + diasPrevisao);
    let dataPrevisao = previsaoDate.toISOString().split('T')[0];
    
    // Determinar unidade primeiro para aplicar performance específica
    const unidadeIndex = Math.floor(Math.random() * unidades.length);
    const unidade = unidades[unidadeIndex];
    
    // Configurar performance desejada e taxa de entrega para cada unidade
    // Performance = (Entregues no Prazo / Total) * 100
    // Para atingir a performance, ajustamos tanto a taxa de entrega quanto a taxa de entrega no prazo
    
    let taxaEntrega = 0.85; // % de CT-es já entregues
    let performanceEntregues = 0.92; // % de entregues que estão no prazo
    
    // SPO: 92% de performance total (>90)
    if (unidade.sigla === 'SPO') {
      taxaEntrega = 0.95;
      performanceEntregues = 0.97; // 95% * 97% = 92.15%
    }
    // RJO: 91% de performance total (>90)
    else if (unidade.sigla === 'RJO') {
      taxaEntrega = 0.94;
      performanceEntregues = 0.97; // 94% * 97% = 91.18%
    }
    // BHZ: 93% de performance total (>90)
    else if (unidade.sigla === 'BHZ') {
      taxaEntrega = 0.96;
      performanceEntregues = 0.97; // 96% * 97% = 93.12%
    }
    // CWB: 65% de performance total (<70)
    else if (unidade.sigla === 'CWB') {
      taxaEntrega = 0.80;
      performanceEntregues = 0.81; // 80% * 81% = 64.8%
    }
    // POA: 78% de performance total (70-90)
    else if (unidade.sigla === 'POA') {
      taxaEntrega = 0.86;
      performanceEntregues = 0.91; // 86% * 91% = 78.26%
    }
    // BSB: 85% de performance total (70-90)
    else if (unidade.sigla === 'BSB') {
      taxaEntrega = 0.90;
      performanceEntregues = 0.94; // 90% * 94% = 84.6%
    }
    
    // Determinar se foi entregue baseado na taxa da unidade
    const foiEntregue = Math.random() < taxaEntrega;
    let dataEntrega: string | null = null;
    
    if (foiEntregue) {
      // Entregas baseadas na performance da unidade
      const entregueNoPrazo = Math.random() < performanceEntregues;
      
      if (entregueNoPrazo) {
        // Entregue antes ou na data prevista
        const diasAntecipacao = Math.floor(Math.random() * (diasPrevisao + 1));
        const entregaDate = new Date(emissaoDate);
        entregaDate.setDate(emissaoDate.getDate() + diasAntecipacao);
        dataEntrega = entregaDate.toISOString().split('T')[0];
      } else {
        // Entregue com atraso (1 a 5 dias após previsão)
        const diasAtraso = 1 + Math.floor(Math.random() * 5);
        const entregaDate = new Date(previsaoDate);
        entregaDate.setDate(previsaoDate.getDate() + diasAtraso);
        dataEntrega = entregaDate.toISOString().split('T')[0];
      }
    } else {
      // CT-e pendente - garantir que alguns estejam no prazo
      // 60% dos pendentes ainda no prazo, 40% atrasados
      const pendenteDentroOPrazo = Math.random() < 0.60;
      
      if (pendenteDentroOPrazo) {
        // Ajustar previsão para o futuro (próximos 7 dias)
        const diasFuturos = 1 + Math.floor(Math.random() * 7);
        const novaPrevisaoDate = new Date();
        novaPrevisaoDate.setDate(novaPrevisaoDate.getDate() + diasFuturos);
        dataPrevisao = novaPrevisaoDate.toISOString().split('T')[0];
      }
      // Se não, mantém a data de previsão original (que pode estar no passado)
    }
    
    const pagador = pagadores[Math.floor(Math.random() * pagadores.length)];
    const destinatario = destinatarios[Math.floor(Math.random() * destinatarios.length)];
    
    ctes.push({
      id: i,
      numero: `CTe-${String(i).padStart(6, '0')}`,
      data_emissao: dataEmissao,
      data_previsao_entrega: dataPrevisao,
      data_entrega: dataEntrega,
      unidade_destino: unidade.sigla, // ✅ Agora usa a sigla
      unidade_entregadora: unidade.sigla, // ✅ Agora usa a sigla
      cnpj_pagador: pagador.cnpj,
      nome_pagador: pagador.nome,
      cnpj_destinatario: destinatario.cnpj,
      nome_destinatario: destinatario.nome,
      valor: 500 + Math.random() * 5000,
      status: foiEntregue ? 'ENTREGUE' : 'PENDENTE'
    });
  }
  
  return ctes;
}

export const MOCK_CTES = generateMockCTes();

// ✅ DADOS FIXOS DE UNIDADES PARA BUSCA
const MOCK_UNIDADES = [
  { sigla: 'MTZ', nome: 'MATRIZ', cnpj: '00.000.000/0001-00' },
  { sigla: 'SPO', nome: 'SÃO PAULO', cnpj: '12.345.678/0001-90' },
  { sigla: 'RJO', nome: 'RIO DE JANEIRO', cnpj: '23.456.789/0001-80' },
  { sigla: 'BHZ', nome: 'BELO HORIZONTE', cnpj: '34.567.890/0001-70' },
  { sigla: 'CWB', nome: 'CURITIBA', cnpj: '45.678.901/0001-60' },
  { sigla: 'FLN', nome: 'FLORIANÓPOLIS', cnpj: '55.555.555/0001-55' },
  { sigla: 'POA', nome: 'PORTO ALEGRE', cnpj: '56.789.012/0001-50' },
  { sigla: 'BSB', nome: 'BRASÍLIA', cnpj: '67.890.123/0001-40' }
];

// API para buscar unidades de destino
export const mockSearchUnidades = async (termo: string) => {
  await mockDelay(300);
  
  // Filtrar unidades por sigla ou nome
  const termoUpper = termo.toUpperCase();
  const resultados = MOCK_UNIDADES.filter(unidade => 
    unidade.sigla.includes(termoUpper) || 
    unidade.nome.includes(termoUpper)
  );
  
  return {
    success: true,
    unidades: resultados,
    count: resultados.length
  };
};

// 🔒 API para buscar unidades FILTRADAS por permissão do usuário
export const mockSearchUnidadesFiltradas = async (termo: string, userUnidade: string) => {
  await mockDelay(300);
  
  const isMTZ = userUnidade === 'MTZ';
  
  if (isMTZ) {
    // ✅ Usuário MTZ: vê TODAS as unidades
    const termoUpper = termo.toUpperCase();
    const resultados = MOCK_UNIDADES.filter(unidade => 
      unidade.sigla.includes(termoUpper) || 
      unidade.nome.includes(termoUpper)
    );
    
    return {
      success: true,
      unidades: resultados,
      count: resultados.length,
      is_mtz: true
    };
  } else {
    // 🔒 Usuário não-MTZ: vê APENAS sua unidade
    const unidadeUsuario = MOCK_UNIDADES.find(u => u.sigla === userUnidade);
    
    return {
      success: true,
      unidades: unidadeUsuario ? [unidadeUsuario] : [],
      count: unidadeUsuario ? 1 : 0,
      is_mtz: false
    };
  }
};

// ✅ DADOS FIXOS DE CIDADES
const MOCK_CIDADES = [
  { seq_cidade: 1, nome: 'SÃO PAULO', uf: 'SP', codigo_ibge: 3550308 },
  { seq_cidade: 2, nome: 'RIO DE JANEIRO', uf: 'RJ', codigo_ibge: 3304557 },
  { seq_cidade: 3, nome: 'BELO HORIZONTE', uf: 'MG', codigo_ibge: 3106200 },
  { seq_cidade: 4, nome: 'CURITIBA', uf: 'PR', codigo_ibge: 4106902 },
  { seq_cidade: 5, nome: 'PORTO ALEGRE', uf: 'RS', codigo_ibge: 4314902 },
  { seq_cidade: 6, nome: 'BRASÍLIA', uf: 'DF', codigo_ibge: 5300108 },
  { seq_cidade: 7, nome: 'CAMPINAS', uf: 'SP', codigo_ibge: 3509502 },
  { seq_cidade: 8, nome: 'GUARULHOS', uf: 'SP', codigo_ibge: 3518800 },
  { seq_cidade: 9, nome: 'MANAUS', uf: 'AM', codigo_ibge: 1302603 },
  { seq_cidade: 10, nome: 'SALVADOR', uf: 'BA', codigo_ibge: 2927408 },
  { seq_cidade: 11, nome: 'FORTALEZA', uf: 'CE', codigo_ibge: 2304400 },
  { seq_cidade: 12, nome: 'RECIFE', uf: 'PE', codigo_ibge: 2611606 }
];

// API para buscar cidades
export const mockSearchCidades = async (search: string, uf?: string) => {
  await mockDelay(300);
  
  const searchUpper = search.toUpperCase();
  let resultados = MOCK_CIDADES.filter(cidade => 
    cidade.nome.includes(searchUpper)
  );
  
  if (uf) {
    resultados = resultados.filter(cidade => cidade.uf === uf.toUpperCase());
  }
  
  return {
    success: true,
    cidades: resultados.map(cidade => ({
      ...cidade,
      label: `${cidade.nome} - ${cidade.uf}`
    })),
    total: resultados.length
  };
};

// ✅ DADOS FIXOS DE FORNECEDORES
const MOCK_FORNECEDORES = [
  {
    seq_fornecedor: 1,
    cnpj: '12.345.678/0001-90',
    nome: 'DISTRIBUIDORA ALFA LTDA',
    endereco: 'RUA DAS FLORES, 123',
    bairro: 'CENTRO',
    seq_cidade: 1,
    cidade_nome: 'SÃO PAULO',
    cidade_uf: 'SP',
    email: 'CONTATO@ALFA.COM.BR',
    telefone: '(11) 3456-7890',
    ativo: 'S',
    data_inclusao: '2024-01-15',
    hora_inclusao: '14:30',
    login_inclusao: 'admin',
    data_alteracao: null,
    hora_alteracao: null,
    login_alteracao: null
  },
  {
    seq_fornecedor: 2,
    cnpj: '23.456.789/0001-80',
    nome: 'COMERCIAL BETA S/A',
    endereco: 'AV PAULISTA, 1000',
    bairro: 'BELA VISTA',
    seq_cidade: 1,
    cidade_nome: 'SÃO PAULO',
    cidade_uf: 'SP',
    email: 'VENDAS@BETA.COM.BR',
    telefone: '(11) 2345-6789',
    ativo: 'S',
    data_inclusao: '2024-02-20',
    hora_inclusao: '09:15',
    login_inclusao: 'admin',
    data_alteracao: '2024-03-10',
    hora_alteracao: '16:45',
    login_alteracao: 'presto'
  },
  {
    seq_fornecedor: 3,
    cnpj: '34.567.890/0001-70',
    nome: 'INDUSTRIA GAMA EIRELI',
    endereco: 'RUA JOÃO PESSOA, 456',
    bairro: 'INDUSTRIAL',
    seq_cidade: 3,
    cidade_nome: 'BELO HORIZONTE',
    cidade_uf: 'MG',
    email: 'COMPRAS@GAMA.IND.BR',
    telefone: '(31) 3210-9876',
    ativo: 'S',
    data_inclusao: '2024-03-05',
    hora_inclusao: '11:20',
    login_inclusao: 'presto',
    data_alteracao: null,
    hora_alteracao: null,
    login_alteracao: null
  },
  {
    seq_fornecedor: 4,
    cnpj: '45.678.901/0001-60',
    nome: 'LOGÍSTICA DELTA TRANSPORTES',
    endereco: 'AV BRASIL, 2500',
    bairro: 'JARDIM DAS AMÉRICAS',
    seq_cidade: 4,
    cidade_nome: 'CURITIBA',
    cidade_uf: 'PR',
    email: 'LOGISTICA@DELTA.COM.BR',
    telefone: '(41) 3344-5566',
    ativo: 'N',
    data_inclusao: '2023-12-10',
    hora_inclusao: '08:00',
    login_inclusao: 'admin',
    data_alteracao: '2024-05-15',
    hora_alteracao: '10:30',
    login_alteracao: 'admin'
  },
  {
    seq_fornecedor: 5,
    cnpj: '56.789.012/0001-50',
    nome: 'MATERIAIS OMEGA COMÉRCIO',
    endereco: 'RUA DOS ANDRADAS, 789',
    bairro: 'CENTRO HISTÓRICO',
    seq_cidade: 5,
    cidade_nome: 'PORTO ALEGRE',
    cidade_uf: 'RS',
    email: 'OMEGA@MATERIAIS.COM',
    telefone: '(51) 3298-7654',
    ativo: 'S',
    data_inclusao: '2024-06-01',
    hora_inclusao: '13:45',
    login_inclusao: 'presto',
    data_alteracao: null,
    hora_alteracao: null,
    login_alteracao: null
  },
  {
    seq_fornecedor: 6,
    cnpj: '67.890.123/0001-40',
    nome: 'FORNECEDOR SIGMA LTDA',
    endereco: 'QUADRA 5, CONJUNTO A, LOTE 10',
    bairro: 'ASA SUL',
    seq_cidade: 6,
    cidade_nome: 'BRASÍLIA',
    cidade_uf: 'DF',
    email: 'SIGMA@FORNECEDOR.BR',
    telefone: '(61) 3245-8901',
    ativo: 'S',
    data_inclusao: '2024-07-12',
    hora_inclusao: '15:00',
    login_inclusao: 'admin',
    data_alteracao: null,
    hora_alteracao: null,
    login_alteracao: null
  }
];

// API para listar fornecedores
export const mockListFornecedores = async (filters: { search?: string; cidade?: string; page?: number; limit?: number }) => {
  await mockDelay(500);
  
  const { search = '', cidade = '', page = 1, limit = 200 } = filters;
  
  let resultados = [...MOCK_FORNECEDORES];
  
  // Filtro por nome ou CNPJ
  if (search) {
    const searchUpper = search.toUpperCase();
    resultados = resultados.filter(f => 
      f.nome.includes(searchUpper) || f.cnpj.includes(searchUpper)
    );
  }
  
  // Filtro por cidade
  if (cidade) {
    const cidadeUpper = cidade.toUpperCase();
    resultados = resultados.filter(f => 
      f.cidade_nome?.includes(cidadeUpper)
    );
  }
  
  // Paginação
  const total = resultados.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginados = resultados.slice(start, end);
  
  return {
    success: true,
    fornecedores: paginados,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  };
};

// API para criar fornecedor
export const mockCreateFornecedor = async (data: any) => {
  await mockDelay(500);
  
  // Validações
  if (!data.cnpj) {
    return { success: false, message: 'CNPJ É OBRIGATÓRIO' };
  }
  if (!data.nome) {
    return { success: false, message: 'NOME É OBRIGATÓRIO' };
  }
  
  // Verificar CNPJ duplicado
  const existente = MOCK_FORNECEDORES.find(f => f.cnpj === data.cnpj.toUpperCase());
  if (existente) {
    return { success: false, message: 'CNPJ JÁ CADASTRADO' };
  }
  
  const novoFornecedor = {
    seq_fornecedor: Math.max(...MOCK_FORNECEDORES.map(f => f.seq_fornecedor)) + 1,
    cnpj: data.cnpj.toUpperCase(),
    nome: data.nome.toUpperCase(),
    endereco: data.endereco ? data.endereco.toUpperCase() : null,
    bairro: data.bairro ? data.bairro.toUpperCase() : null,
    seq_cidade: data.seq_cidade || null,
    cidade_nome: null,
    cidade_uf: null,
    email: data.email ? data.email.toUpperCase() : null,
    telefone: data.telefone || null,
    ativo: data.ativo || 'S',
    data_inclusao: new Date().toISOString().split('T')[0],
    hora_inclusao: new Date().toTimeString().split(' ')[0].substring(0, 5),
    login_inclusao: 'mock_user',
    data_alteracao: null,
    hora_alteracao: null,
    login_alteracao: null
  };
  
  // Se tem cidade, buscar nome e UF
  if (data.seq_cidade) {
    const cidade = MOCK_CIDADES.find(c => c.seq_cidade === data.seq_cidade);
    if (cidade) {
      novoFornecedor.cidade_nome = cidade.nome;
      novoFornecedor.cidade_uf = cidade.uf;
    }
  }
  
  MOCK_FORNECEDORES.push(novoFornecedor);
  
  return {
    success: true,
    seq_fornecedor: novoFornecedor.seq_fornecedor
  };
};

// API para atualizar fornecedor
export const mockUpdateFornecedor = async (data: any) => {
  await mockDelay(500);
  
  const index = MOCK_FORNECEDORES.findIndex(f => f.seq_fornecedor === data.seq_fornecedor);
  
  if (index === -1) {
    return { success: false, message: 'FORNECEDOR NÃO ENCONTRADO' };
  }
  
  // Verificar CNPJ duplicado
  const duplicado = MOCK_FORNECEDORES.find(f => 
    f.cnpj === data.cnpj.toUpperCase() && f.seq_fornecedor !== data.seq_fornecedor
  );
  if (duplicado) {
    return { success: false, message: 'CNPJ JÁ CADASTRADO PARA OUTRO FORNECEDOR' };
  }
  
  // Atualizar
  MOCK_FORNECEDORES[index] = {
    ...MOCK_FORNECEDORES[index],
    cnpj: data.cnpj.toUpperCase(),
    nome: data.nome.toUpperCase(),
    endereco: data.endereco ? data.endereco.toUpperCase() : null,
    bairro: data.bairro ? data.bairro.toUpperCase() : null,
    seq_cidade: data.seq_cidade || null,
    email: data.email ? data.email.toUpperCase() : null,
    telefone: data.telefone || null,
    ativo: data.ativo || 'S',
    data_alteracao: new Date().toISOString().split('T')[0],
    hora_alteracao: new Date().toTimeString().split(' ')[0].substring(0, 5),
    login_alteracao: 'mock_user'
  };
  
  // Atualizar cidade
  if (data.seq_cidade) {
    const cidade = MOCK_CIDADES.find(c => c.seq_cidade === data.seq_cidade);
    if (cidade) {
      MOCK_FORNECEDORES[index].cidade_nome = cidade.nome;
      MOCK_FORNECEDORES[index].cidade_uf = cidade.uf;
    }
  }
  
  return { success: true };
};

// API para deletar fornecedor
export const mockDeleteFornecedor = async (seq_fornecedor: number) => {
  await mockDelay(500);
  
  const index = MOCK_FORNECEDORES.findIndex(f => f.seq_fornecedor === seq_fornecedor);
  
  if (index === -1) {
    return { success: false, message: 'FORNECEDOR NÃO ENCONTRADO' };
  }
  
  MOCK_FORNECEDORES.splice(index, 1);
  
  return { success: true };
};

// API para importar fornecedores
export const mockImportFornecedores = async () => {
  await mockDelay(1500);
  
  return {
    success: true,
    imported: 0,
    updated: 0,
    errors: [],
    message: 'FUNCIONALIDADE DE IMPORTAÇÃO EM DESENVOLVIMENTO'
  };
};

// ✅ MOCK DE CLIENTES UNIFICADO (serve para pagadores e destinatários)
const MOCK_CLIENTES = [
  { cnpj: '12.345.678/0001-90', nome: 'EMPRESA ABC LTDA', cidade: 'SAO PAULO - SP', dataUltMovimento: '20/12/25' },
  { cnpj: '23.456.789/0001-80', nome: 'INDUSTRIA XYZ S.A.', cidade: 'RIO DE JANEIRO - RJ', dataUltMovimento: '18/12/25' },
  { cnpj: '34.567.890/0001-70', nome: 'COMERCIO 123 EIRELI', cidade: 'BELO HORIZONTE - MG', dataUltMovimento: '15/12/25' },
  { cnpj: '45.678.901/0001-60', nome: 'DISTRIBUIDORA DELTA', cidade: 'CURITIBA - PR', dataUltMovimento: '22/12/25' },
  { cnpj: '55.666.777/0001-50', nome: 'LOGISTICA OMEGA', cidade: 'PORTO ALEGRE - RS', dataUltMovimento: '19/12/25' },
  { cnpj: '66.777.888/0001-40', nome: 'INDUSTRIA SIGMA', cidade: 'BRASILIA - DF', dataUltMovimento: '21/12/25' },
  { cnpj: '56.789.012/0001-50', nome: 'LOJA ALPHA', cidade: 'CAMPINAS - SP', dataUltMovimento: '17/12/25' },
  { cnpj: '67.890.123/0001-40', nome: 'MERCADO BETA', cidade: 'SANTOS - SP', dataUltMovimento: '16/12/25' },
  { cnpj: '78.901.234/0001-30', nome: 'SUPERMERCADO GAMA', cidade: 'SOROCABA - SP', dataUltMovimento: '14/12/25' },
  { cnpj: '89.012.345/0001-20', nome: 'ATACADO OMEGA', cidade: 'RIBEIRAO PRETO - SP', dataUltMovimento: '23/12/25' },
  { cnpj: '90.123.456/0001-10', nome: 'VAREJO DELTA', cidade: 'SAO JOSE DOS CAMPOS - SP', dataUltMovimento: '13/12/25' },
  { cnpj: '01.234.567/0001-00', nome: 'DISTRIBUIDOR KAPPA', cidade: 'GUARULHOS - SP', dataUltMovimento: '12/12/25' },
];

// API para buscar clientes (UNIFICADO - serve para pagadores e destinatários)
export const mockSearchClientes = async (termo: string) => {
  await mockDelay(300);
  
  // Filtrar por termo de busca
  const termoUpper = termo.toUpperCase();
  const resultados = MOCK_CLIENTES.filter(cliente => 
    cliente.nome.includes(termoUpper) || 
    cliente.cnpj.includes(termo) ||
    cliente.cidade.includes(termoUpper)
  );
  
  return {
    success: true,
    clientes: resultados.slice(0, 50),
    count: Math.min(resultados.length, 50)
  };
};

// ⚠️ DEPRECATED: Manter por compatibilidade (redireciona para mockSearchClientes)
export const mockSearchEmpresas = async (termo: string, tipo: 'pagador' | 'destinatario') => {
  return mockSearchClientes(termo);
};

// ============================================
// MOCK DE TIPOS DE ITEM (ESTOQUE)
// ============================================

interface TipoItem {
  seq_tipo_item: number;
  descricao: string;
  ativo: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_alteracao?: string;
  hora_alteracao?: string;
  login_alteracao?: string;
}

const MOCK_TIPOS_ITEM: TipoItem[] = [
  { seq_tipo_item: 1, descricao: 'COMBUSTÍVEL', ativo: 'S', data_inclusao: '2024-01-10', hora_inclusao: '08:30:00', login_inclusao: 'presto' },
  { seq_tipo_item: 2, descricao: 'PNEUS E CÂMARAS', ativo: 'S', data_inclusao: '2024-01-10', hora_inclusao: '08:35:00', login_inclusao: 'presto' },
  { seq_tipo_item: 3, descricao: 'LUBRIFICANTES', ativo: 'S', data_inclusao: '2024-01-10', hora_inclusao: '08:40:00', login_inclusao: 'presto' },
  { seq_tipo_item: 4, descricao: 'PEÇAS DE REPOSIÇÃO', ativo: 'S', data_inclusao: '2024-01-10', hora_inclusao: '08:45:00', login_inclusao: 'presto' },
  { seq_tipo_item: 5, descricao: 'FILTROS', ativo: 'S', data_inclusao: '2024-01-11', hora_inclusao: '09:00:00', login_inclusao: 'admin' },
  { seq_tipo_item: 6, descricao: 'MATERIAIS DE LIMPEZA', ativo: 'S', data_inclusao: '2024-01-11', hora_inclusao: '09:15:00', login_inclusao: 'admin' },
  { seq_tipo_item: 7, descricao: 'EQUIPAMENTOS DE SEGURANÇA', ativo: 'S', data_inclusao: '2024-01-12', hora_inclusao: '10:00:00', login_inclusao: 'presto' },
  { seq_tipo_item: 8, descricao: 'ACESSÓRIOS AUTOMOTIVOS', ativo: 'N', data_inclusao: '2024-01-12', hora_inclusao: '10:30:00', login_inclusao: 'admin', data_alteracao: '2024-01-20', hora_alteracao: '14:00:00', login_alteracao: 'presto' }
];

export const mockGetTiposItem = async () => {
  await mockDelay(400);
  return { success: true, data: MOCK_TIPOS_ITEM };
};

export const mockCreateTipoItem = async (data: any) => {
  await mockDelay(500);
  const novoTipo: TipoItem = {
    seq_tipo_item: Math.max(...MOCK_TIPOS_ITEM.map(t => t.seq_tipo_item)) + 1,
    descricao: data.descricao.toUpperCase(),
    ativo: data.ativo || 'S',
    data_inclusao: new Date().toISOString().split('T')[0],
    hora_inclusao: new Date().toTimeString().split(' ')[0],
    login_inclusao: 'presto'
  };
  MOCK_TIPOS_ITEM.push(novoTipo);
  return { success: true };
};

export const mockUpdateTipoItem = async (data: any) => {
  await mockDelay(500);
  const index = MOCK_TIPOS_ITEM.findIndex(t => t.seq_tipo_item === data.seq_tipo_item);
  if (index === -1) return { success: false, message: 'TIPO NÃO ENCONTRADO' };
  MOCK_TIPOS_ITEM[index] = {
    ...MOCK_TIPOS_ITEM[index],
    descricao: data.descricao.toUpperCase(),
    ativo: data.ativo,
    data_alteracao: new Date().toISOString().split('T')[0],
    hora_alteracao: new Date().toTimeString().split(' ')[0],
    login_alteracao: 'presto'
  };
  return { success: true };
};

// ============================================
// MOCK DE UNIDADES DE MEDIDA (ESTOQUE)
// ============================================

interface UnidadeMedida {
  seq_unidade_medida: number;
  descricao: string;
  sigla: string;
  ativo: string;
}

const MOCK_UNIDADES_MEDIDA: UnidadeMedida[] = [
  { seq_unidade_medida: 1, descricao: 'UNIDADE', sigla: 'UN', ativo: 'S' },
  { seq_unidade_medida: 2, descricao: 'LITROS', sigla: 'L', ativo: 'S' },
  { seq_unidade_medida: 3, descricao: 'QUILOGRAMAS', sigla: 'KG', ativo: 'S' },
  { seq_unidade_medida: 4, descricao: 'METROS', sigla: 'M', ativo: 'S' },
  { seq_unidade_medida: 5, descricao: 'CAIXA', sigla: 'CX', ativo: 'S' },
  { seq_unidade_medida: 6, descricao: 'PACOTE', sigla: 'PCT', ativo: 'S' },
  { seq_unidade_medida: 7, descricao: 'GALÃO', sigla: 'GAL', ativo: 'S' },
  { seq_unidade_medida: 8, descricao: 'PEÇA', sigla: 'PC', ativo: 'S' },
  { seq_unidade_medida: 9, descricao: 'CONJUNTO', sigla: 'CJ', ativo: 'S' },
  { seq_unidade_medida: 10, descricao: 'TONELADA', sigla: 'TON', ativo: 'S' },
  { seq_unidade_medida: 11, descricao: 'ROLO', sigla: 'RL', ativo: 'S' }
];

export const mockGetUnidadesMedida = async () => {
  await mockDelay(300);
  return { success: true, data: MOCK_UNIDADES_MEDIDA };
};

// ============================================
// MOCK DE ITENS (ESTOQUE)
// ============================================

interface Item {
  seq_item: number;
  codigo: string;
  codigo_fabricante: string;
  descricao: string;
  seq_tipo_item: number;
  seq_unidade_medida: number;
  vlr_item: number;
  estoque_minimo: number;
  estoque_maximo: number;
  ativo: string;
  tipo_descricao?: string;
  unidade_medida_sigla?: string;
  data_inclusao?: string;
  hora_inclusao?: string;
  login_inclusao?: string;
}

const MOCK_ITENS: Item[] = [
  {
    seq_item: 1, codigo: 'ITEM001', codigo_fabricante: 'PETRO-DS10', descricao: 'ÓLEO DIESEL S10',
    seq_tipo_item: 1, seq_unidade_medida: 2, vlr_item: 5.85, estoque_minimo: 1000, estoque_maximo: 10000,
    ativo: 'S', tipo_descricao: 'COMBUSTÍVEL', unidade_medida_sigla: 'L',
    data_inclusao: '2024-01-10', hora_inclusao: '08:00:00', login_inclusao: 'presto'
  },
  {
    seq_item: 2, codigo: 'ITEM002', codigo_fabricante: 'MICH-29580R225', descricao: 'PNEU 295/80R22.5 MICHELIN',
    seq_tipo_item: 2, seq_unidade_medida: 1, vlr_item: 2850.00, estoque_minimo: 8, estoque_maximo: 50,
    ativo: 'S', tipo_descricao: 'PNEUS E CÂMARAS', unidade_medida_sigla: 'UN',
    data_inclusao: '2024-01-10', hora_inclusao: '08:15:00', login_inclusao: 'presto'
  },
  {
    seq_item: 3, codigo: 'ITEM003', codigo_fabricante: 'SHELL-15W40', descricao: 'ÓLEO LUBRIFICANTE 15W40 SHELL',
    seq_tipo_item: 3, seq_unidade_medida: 2, vlr_item: 28.50, estoque_minimo: 50, estoque_maximo: 200,
    ativo: 'S', tipo_descricao: 'LUBRIFICANTES', unidade_medida_sigla: 'L',
    data_inclusao: '2024-01-10', hora_inclusao: '08:30:00', login_inclusao: 'admin'
  },
  {
    seq_item: 4, codigo: 'ITEM004', codigo_fabricante: 'MANN-W950', descricao: 'FILTRO DE ÓLEO MANN W950',
    seq_tipo_item: 5, seq_unidade_medida: 1, vlr_item: 85.00, estoque_minimo: 10, estoque_maximo: 100,
    ativo: 'S', tipo_descricao: 'FILTROS', unidade_medida_sigla: 'UN',
    data_inclusao: '2024-01-11', hora_inclusao: '09:00:00', login_inclusao: 'presto'
  },
  {
    seq_item: 5, codigo: 'ITEM005', codigo_fabricante: 'K2442', descricao: 'FILTRO DE AR K2442',
    seq_tipo_item: 5, seq_unidade_medida: 1, vlr_item: 125.00, estoque_minimo: 8, estoque_maximo: 50,
    ativo: 'S', tipo_descricao: 'FILTROS', unidade_medida_sigla: 'UN',
    data_inclusao: '2024-01-11', hora_inclusao: '09:15:00', login_inclusao: 'admin'
  },
  {
    seq_item: 6, codigo: 'ITEM006', codigo_fabricante: 'OSRAM-H4', descricao: 'LÂMPADA H4 60/55W OSRAM',
    seq_tipo_item: 4, seq_unidade_medida: 1, vlr_item: 18.90, estoque_minimo: 20, estoque_maximo: 100,
    ativo: 'S', tipo_descricao: 'PEÇAS DE REPOSIÇÃO', unidade_medida_sigla: 'UN',
    data_inclusao: '2024-01-12', hora_inclusao: '10:00:00', login_inclusao: 'presto'
  },
  {
    seq_item: 7, codigo: 'ITEM007', codigo_fabricante: 'DET-5L', descricao: 'DETERGENTE AUTOMOTIVO 5L',
    seq_tipo_item: 6, seq_unidade_medida: 7, vlr_item: 42.00, estoque_minimo: 10, estoque_maximo: 50,
    ativo: 'S', tipo_descricao: 'MATERIAIS DE LIMPEZA', unidade_medida_sigla: 'GAL',
    data_inclusao: '2024-01-12', hora_inclusao: '10:30:00', login_inclusao: 'admin'
  },
  {
    seq_item: 8, codigo: 'ITEM008', codigo_fabricante: 'EXT-PQS6', descricao: 'EXTINTOR PQS 6KG',
    seq_tipo_item: 7, seq_unidade_medida: 1, vlr_item: 185.00, estoque_minimo: 5, estoque_maximo: 30,
    ativo: 'S', tipo_descricao: 'EQUIPAMENTOS DE SEGURANÇA', unidade_medida_sigla: 'UN',
    data_inclusao: '2024-01-13', hora_inclusao: '11:00:00', login_inclusao: 'presto'
  },
  {
    seq_item: 9, codigo: 'ITEM009', codigo_fabricante: 'GATES-K015578XS', descricao: 'CORREIA DENTADA GATES K015578XS',
    seq_tipo_item: 4, seq_unidade_medida: 1, vlr_item: 340.00, estoque_minimo: 3, estoque_maximo: 20,
    ativo: 'N', tipo_descricao: 'PEÇAS DE REPOSIÇÃO', unidade_medida_sigla: 'UN',
    data_inclusao: '2024-01-13', hora_inclusao: '11:30:00', login_inclusao: 'admin'
  }
];

export const mockGetItens = async (filters?: any) => {
  await mockDelay(400);
  let resultados = [...MOCK_ITENS];
  
  if (filters?.ativo) {
    resultados = resultados.filter(i => i.ativo === filters.ativo);
  }
  
  if (filters?.search) {
    const search = filters.search.toUpperCase();
    resultados = resultados.filter(i => 
      i.codigo.includes(search) || 
      i.descricao.includes(search) ||
      i.codigo_fabricante.includes(search)
    );
  }
  
  return { success: true, data: resultados };
};

export const mockCreateItem = async (data: any) => {
  await mockDelay(500);
  const novoItem: Item = {
    seq_item: Math.max(...MOCK_ITENS.map(i => i.seq_item)) + 1,
    codigo: data.codigo.toUpperCase(),
    codigo_fabricante: data.codigo_fabricante?.toUpperCase() || '',
    descricao: data.descricao.toUpperCase(),
    seq_tipo_item: data.seq_tipo_item || 0,
    seq_unidade_medida: data.seq_unidade_medida || 0,
    vlr_item: data.vlr_item || 0,
    estoque_minimo: data.estoque_minimo || 0,
    estoque_maximo: data.estoque_maximo || 0,
    ativo: data.ativo || 'S',
    data_inclusao: new Date().toISOString().split('T')[0],
    hora_inclusao: new Date().toTimeString().split(' ')[0],
    login_inclusao: 'presto'
  };
  MOCK_ITENS.push(novoItem);
  return { success: true };
};

export const mockUpdateItem = async (data: any) => {
  await mockDelay(500);
  const index = MOCK_ITENS.findIndex(i => i.seq_item === data.seq_item);
  if (index === -1) return { success: false, message: 'ITEM NÃO ENCONTRADO' };
  
  MOCK_ITENS[index] = {
    ...MOCK_ITENS[index],
    codigo: data.codigo.toUpperCase(),
    codigo_fabricante: data.codigo_fabricante?.toUpperCase() || '',
    descricao: data.descricao.toUpperCase(),
    seq_tipo_item: data.seq_tipo_item || 0,
    seq_unidade_medida: data.seq_unidade_medida || 0,
    vlr_item: data.vlr_item || 0,
    estoque_minimo: data.estoque_minimo || 0,
    estoque_maximo: data.estoque_maximo || 0,
    ativo: data.ativo
  };
  
  return { success: true };
};

export const mockDeleteItem = async (seq_item: number) => {
  await mockDelay(500);
  const index = MOCK_ITENS.findIndex(i => i.seq_item === seq_item);
  if (index === -1) return { success: false, message: 'ITEM NÃO ENCONTRADO' };
  
  MOCK_ITENS[index].ativo = 'N';
  return { success: true };
};

// ============================================
// MOCK DE ESTOQUES
// ============================================

interface Estoque {
  seq_estoque: number;
  descricao: string;
  seq_tipo_item: number;
  tipo_descricao: string;
  seq_posicao: number;
  posicao_descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total: number;
  unidade: string;
  ativo: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_alteracao?: string;
  hora_alteracao?: string;
  login_alteracao?: string;
  observacoes?: string;
}

const MOCK_ESTOQUES: Estoque[] = [
  {
    seq_estoque: 1, descricao: 'ÓLEO DIESEL S10', seq_tipo_item: 1, tipo_descricao: 'COMBUSTÍVEL', seq_posicao: 1, posicao_descricao: 'TANQUE PRINCIPAL',
    quantidade: 5000, unidade_medida: 'LITROS', valor_unitario: 5.85, valor_total: 29250.00, unidade: 'MTZ', ativo: 'S',
    data_inclusao: '2024-01-15', hora_inclusao: '08:00:00', login_inclusao: 'presto', observacoes: 'ESTOQUE MATRIZ'
  },
  {
    seq_estoque: 2, descricao: 'PNEU 295/80R22.5 MICHELIN', seq_tipo_item: 2, tipo_descricao: 'PNEUS E CÂMARAS', seq_posicao: 2, posicao_descricao: 'ALMOXARIFADO A',
    quantidade: 24, unidade_medida: 'UNIDADE', valor_unitario: 2850.00, valor_total: 68400.00, unidade: 'MTZ', ativo: 'S',
    data_inclusao: '2024-01-16', hora_inclusao: '09:30:00', login_inclusao: 'admin'
  },
  {
    seq_estoque: 3, descricao: 'ÓLEO LUBRIFICANTE 15W40 SHELL', seq_tipo_item: 3, tipo_descricao: 'LUBRIFICANTES', seq_posicao: 2, posicao_descricao: 'ALMOXARIFADO A',
    quantidade: 120, unidade_medida: 'LITROS', valor_unitario: 28.50, valor_total: 3420.00, unidade: 'PIN', ativo: 'S',
    data_inclusao: '2024-01-17', hora_inclusao: '10:15:00', login_inclusao: 'presto'
  },
  {
    seq_estoque: 4, descricao: 'FILTRO DE ÓLEO MANN W950', seq_tipo_item: 5, tipo_descricao: 'FILTROS', seq_posicao: 3, posicao_descricao: 'PRATELEIRA B-03',
    quantidade: 48, unidade_medida: 'UNIDADE', valor_unitario: 85.00, valor_total: 4080.00, unidade: 'MTZ', ativo: 'S',
    data_inclusao: '2024-01-18', hora_inclusao: '11:00:00', login_inclusao: 'admin'
  },
  {
    seq_estoque: 5, descricao: 'FILTRO DE AR K2442', seq_tipo_item: 5, tipo_descricao: 'FILTROS', seq_posicao: 3, posicao_descricao: 'PRATELEIRA B-03',
    quantidade: 36, unidade_medida: 'UNIDADE', valor_unitario: 125.00, valor_total: 4500.00, unidade: 'PIN', ativo: 'S',
    data_inclusao: '2024-01-18', hora_inclusao: '11:30:00', login_inclusao: 'presto'
  },
  {
    seq_estoque: 6, descricao: 'LÂMPADA H4 60/55W OSRAM', seq_tipo_item: 4, tipo_descricao: 'PEÇAS DE REPOSIÇÃO', seq_posicao: 4, posicao_descricao: 'GAVETA C-12',
    quantidade: 50, unidade_medida: 'UNIDADE', valor_unitario: 18.90, valor_total: 945.00, unidade: 'MTZ', ativo: 'S',
    data_inclusao: '2024-01-19', hora_inclusao: '14:00:00', login_inclusao: 'admin'
  },
  {
    seq_estoque: 7, descricao: 'DETERGENTE AUTOMOTIVO 5L', seq_tipo_item: 6, tipo_descricao: 'MATERIAIS DE LIMPEZA', seq_posicao: 5, posicao_descricao: 'ÁREA EXTERNA',
    quantidade: 30, unidade_medida: 'GALÃO', valor_unitario: 42.00, valor_total: 1260.00, unidade: 'PIN', ativo: 'S',
    data_inclusao: '2024-01-20', hora_inclusao: '08:45:00', login_inclusao: 'presto'
  },
  {
    seq_estoque: 8, descricao: 'EXTINTOR PQS 6KG', seq_tipo_item: 7, tipo_descricao: 'EQUIPAMENTOS DE SEGURANÇA', seq_posicao: 6, posicao_descricao: 'DEPÓSITO SEGURANÇA',
    quantidade: 15, unidade_medida: 'UNIDADE', valor_unitario: 185.00, valor_total: 2775.00, unidade: 'MTZ', ativo: 'S',
    data_inclusao: '2024-01-21', hora_inclusao: '09:00:00', login_inclusao: 'admin'
  },
  {
    seq_estoque: 9, descricao: 'CORREIA DENTADA GATES K015578XS', seq_tipo_item: 4, tipo_descricao: 'PEÇAS DE REPOSIÇÃO', seq_posicao: 2, posicao_descricao: 'ALMOXARIFADO A',
    quantidade: 12, unidade_medida: 'UNIDADE', valor_unitario: 340.00, valor_total: 4080.00, unidade: 'MTZ', ativo: 'N',
    data_inclusao: '2024-01-22', hora_inclusao: '10:30:00', login_inclusao: 'presto', data_alteracao: '2024-01-25', hora_alteracao: '16:00:00', login_alteracao: 'admin', observacoes: 'ITEM DESCONTINUADO'
  }
];

export const mockGetEstoques = async (filters?: any) => {
  await mockDelay(500);
  let resultados = [...MOCK_ESTOQUES];
  if (filters?.unidade && filters.unidade !== 'MTZ') {
    resultados = resultados.filter(e => e.unidade === filters.unidade);
  }
  if (filters?.ativo) {
    resultados = resultados.filter(e => e.ativo === filters.ativo);
  }
  if (filters?.seq_tipo_item) {
    resultados = resultados.filter(e => e.seq_tipo_item === filters.seq_tipo_item);
  }
  if (filters?.search) {
    const termo = filters.search.toUpperCase();
    resultados = resultados.filter(e => e.descricao.includes(termo) || e.tipo_descricao.includes(termo) || e.posicao_descricao.includes(termo));
  }
  return { success: true, data: resultados };
};

export const mockCreateEstoque = async (data: any) => {
  await mockDelay(600);
  const tipo = MOCK_TIPOS_ITEM.find(t => t.seq_tipo_item === data.seq_tipo_item);
  const novoEstoque: Estoque = {
    seq_estoque: Math.max(...MOCK_ESTOQUES.map(e => e.seq_estoque)) + 1,
    descricao: data.descricao.toUpperCase(),
    seq_tipo_item: data.seq_tipo_item,
    tipo_descricao: tipo?.descricao || 'TIPO NÃO ENCONTRADO',
    seq_posicao: data.seq_posicao,
    posicao_descricao: 'POSIÇÃO ' + data.seq_posicao,
    quantidade: data.quantidade || 0,
    unidade_medida: data.unidade_medida.toUpperCase(),
    valor_unitario: data.valor_unitario || 0,
    valor_total: (data.quantidade || 0) * (data.valor_unitario || 0),
    unidade: data.unidade || 'MTZ',
    ativo: data.ativo || 'S',
    data_inclusao: new Date().toISOString().split('T')[0],
    hora_inclusao: new Date().toTimeString().split(' ')[0],
    login_inclusao: 'presto',
    observacoes: data.observacoes?.toUpperCase()
  };
  MOCK_ESTOQUES.push(novoEstoque);
  return { success: true };
};

export const mockUpdateEstoque = async (data: any) => {
  await mockDelay(600);
  const index = MOCK_ESTOQUES.findIndex(e => e.seq_estoque === data.seq_estoque);
  if (index === -1) return { success: false, message: 'ESTOQUE NÃO ENCONTRADO' };
  const tipo = MOCK_TIPOS_ITEM.find(t => t.seq_tipo_item === data.seq_tipo_item);
  MOCK_ESTOQUES[index] = {
    ...MOCK_ESTOQUES[index],
    descricao: data.descricao.toUpperCase(),
    seq_tipo_item: data.seq_tipo_item,
    tipo_descricao: tipo?.descricao || MOCK_ESTOQUES[index].tipo_descricao,
    seq_posicao: data.seq_posicao,
    quantidade: data.quantidade,
    unidade_medida: data.unidade_medida.toUpperCase(),
    valor_unitario: data.valor_unitario,
    valor_total: data.quantidade * data.valor_unitario,
    unidade: data.unidade,
    ativo: data.ativo,
    data_alteracao: new Date().toISOString().split('T')[0],
    hora_alteracao: new Date().toTimeString().split(' ')[0],
    login_alteracao: 'presto',
    observacoes: data.observacoes?.toUpperCase()
  };
  return { success: true };
};

// ============================================
// MOCK DE INVENTÁRIOS DE ESTOQUE
// ============================================

interface Inventario {
  seq_inventario: number;
  nome_inventario: string;
  seq_estoque: number;
  status: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_conclusao: string | null;
  hora_conclusao: string | null;
  login_conclusao: string | null;
  nro_estoque?: string;
  estoque_descricao?: string;
  unidade?: string;
  qtd_posicoes?: number;
  qtd_contadas?: number;
}

interface InventarioPosicao {
  seq_inventario_posicao: number;
  seq_inventario: number;
  seq_posicao: number;
  saldo_sistema: number;
  saldo_contado: number;
  diferenca: number;
  rua?: string;
  altura?: string;
  coluna?: string;
  seq_item?: number;
  item_codigo?: string;
  item_descricao?: string;
  vlr_item?: number;
}

const MOCK_INVENTARIOS: Inventario[] = [
  {
    seq_inventario: 1,
    nome_inventario: 'INVENTÁRIO GERAL - JANEIRO/2026',
    seq_estoque: 1,
    status: 'FINALIZADO',
    data_inclusao: '2026-01-15',
    hora_inclusao: '09:30:00',
    login_inclusao: 'presto',
    data_conclusao: '2026-01-16',
    hora_conclusao: '17:45:00',
    login_conclusao: 'presto',
    nro_estoque: 'EST001',
    estoque_descricao: 'ESTOQUE PRINCIPAL MTZ',
    unidade: 'MTZ',
    qtd_posicoes: 120,
    qtd_contadas: 120
  },
  {
    seq_inventario: 2,
    nome_inventario: 'INVENTÁRIO PARCIAL - RUA A',
    seq_estoque: 1,
    status: 'PENDENTE',
    data_inclusao: '2026-01-28',
    hora_inclusao: '08:00:00',
    login_inclusao: 'presto',
    data_conclusao: null,
    hora_conclusao: null,
    login_conclusao: null,
    nro_estoque: 'EST001',
    estoque_descricao: 'ESTOQUE PRINCIPAL MTZ',
    unidade: 'MTZ',
    qtd_posicoes: 24,
    qtd_contadas: 8
  },
  {
    seq_inventario: 3,
    nome_inventario: 'INVENTÁRIO MENSAL - DEZEMBRO/2025',
    seq_estoque: 2,
    status: 'FINALIZADO',
    data_inclusao: '2025-12-30',
    hora_inclusao: '14:00:00',
    login_inclusao: 'presto',
    data_conclusao: '2025-12-31',
    hora_conclusao: '18:00:00',
    login_conclusao: 'presto',
    nro_estoque: 'EST002',
    estoque_descricao: 'ESTOQUE SECUNDÁRIO FLN',
    unidade: 'FLN',
    qtd_posicoes: 80,
    qtd_contadas: 80
  }
];

const MOCK_INVENTARIO_POSICOES: InventarioPosicao[] = [
  {
    seq_inventario_posicao: 1,
    seq_inventario: 2,
    seq_posicao: 1,
    saldo_sistema: 150.00,
    saldo_contado: 148.00,
    diferenca: -2.00,
    rua: 'A',
    altura: '1',
    coluna: '01',
    seq_item: 1,
    item_codigo: 'ITEM001',
    item_descricao: 'PARAFUSO M10 X 50MM',
    vlr_item: 2.50
  },
  {
    seq_inventario_posicao: 2,
    seq_inventario: 2,
    seq_posicao: 2,
    saldo_sistema: 200.00,
    saldo_contado: 205.00,
    diferenca: 5.00,
    rua: 'A',
    altura: '1',
    coluna: '02',
    seq_item: 2,
    item_codigo: 'ITEM002',
    item_descricao: 'PORCA M10',
    vlr_item: 1.20
  },
  {
    seq_inventario_posicao: 3,
    seq_inventario: 2,
    seq_posicao: 3,
    saldo_sistema: 80.00,
    saldo_contado: 80.00,
    diferenca: 0.00,
    rua: 'A',
    altura: '1',
    coluna: '03',
    seq_item: 3,
    item_codigo: 'ITEM003',
    item_descricao: 'ARRUELA LISA M10',
    vlr_item: 0.80
  },
  {
    seq_inventario_posicao: 4,
    seq_inventario: 2,
    seq_posicao: 4,
    saldo_sistema: 45.00,
    saldo_contado: 0.00,
    diferenca: 0.00,
    rua: 'A',
    altura: '1',
    coluna: '04',
    seq_item: 4,
    item_codigo: 'ITEM004',
    item_descricao: 'REBITE POP 4.8MM',
    vlr_item: 0.50
  },
  {
    seq_inventario_posicao: 5,
    seq_inventario: 2,
    seq_posicao: 5,
    saldo_sistema: 120.00,
    saldo_contado: 0.00,
    diferenca: 0.00,
    rua: 'A',
    altura: '2',
    coluna: '01',
    seq_item: 5,
    item_codigo: 'ITEM005',
    item_descricao: 'GRAXA AUTOMOTIVA 500G',
    vlr_item: 18.50
  },
  {
    seq_inventario_posicao: 6,
    seq_inventario: 2,
    seq_posicao: 6,
    saldo_sistema: 75.00,
    saldo_contado: 0.00,
    diferenca: 0.00,
    rua: 'A',
    altura: '2',
    coluna: '02',
    seq_item: 6,
    item_codigo: 'ITEM006',
    item_descricao: 'ÓLEO MOTOR 15W40 1L',
    vlr_item: 25.90
  },
  {
    seq_inventario_posicao: 7,
    seq_inventario: 2,
    seq_posicao: 7,
    saldo_sistema: 30.00,
    saldo_contado: 0.00,
    diferenca: 0.00,
    rua: 'A',
    altura: '2',
    coluna: '03',
    seq_item: 7,
    item_codigo: 'ITEM007',
    item_descricao: 'FILTRO DE ÓLEO',
    vlr_item: 32.00
  },
  {
    seq_inventario_posicao: 8,
    seq_inventario: 2,
    seq_posicao: 8,
    saldo_sistema: 25.00,
    saldo_contado: 0.00,
    diferenca: 0.00,
    rua: 'A',
    altura: '2',
    coluna: '04',
    seq_item: 8,
    item_codigo: 'ITEM008',
    item_descricao: 'FILTRO DE AR',
    vlr_item: 48.50
  }
];

export const mockGetInventarios = async (filters?: any) => {
  await mockDelay(500);
  let resultados = [...MOCK_INVENTARIOS];
  
  if (filters?.status) {
    resultados = resultados.filter(inv => inv.status === filters.status);
  }
  
  if (filters?.seq_estoque) {
    resultados = resultados.filter(inv => inv.seq_estoque === parseInt(filters.seq_estoque));
  }
  
  return { success: true, data: resultados };
};

export const mockGetInventarioDetalhes = async (seqInventario: number) => {
  await mockDelay(500);
  const inventario = MOCK_INVENTARIOS.find(inv => inv.seq_inventario === seqInventario);
  
  if (!inventario) {
    return { success: false, message: 'Inventário não encontrado' };
  }
  
  const posicoes = MOCK_INVENTARIO_POSICOES.filter(p => p.seq_inventario === seqInventario);
  
  return {
    success: true,
    data: {
      ...inventario,
      posicoes
    }
  };
};

export const mockCreateInventario = async (data: any) => {
  await mockDelay(800);
  
  const novoInventario: Inventario = {
    seq_inventario: Math.max(...MOCK_INVENTARIOS.map(i => i.seq_inventario)) + 1,
    nome_inventario: data.nome_inventario.toUpperCase(),
    seq_estoque: parseInt(data.seq_estoque),
    status: 'PENDENTE',
    data_inclusao: new Date().toISOString().split('T')[0],
    hora_inclusao: new Date().toTimeString().split(' ')[0],
    login_inclusao: 'presto',
    data_conclusao: null,
    hora_conclusao: null,
    login_conclusao: null,
    nro_estoque: 'EST001',
    estoque_descricao: 'ESTOQUE PRINCIPAL MTZ',
    unidade: 'MTZ',
    qtd_posicoes: Math.floor(Math.random() * 50) + 10,
    qtd_contadas: 0
  };
  
  MOCK_INVENTARIOS.push(novoInventario);
  
  return {
    success: true,
    data: {
      seq_inventario: novoInventario.seq_inventario,
      qtd_posicoes: novoInventario.qtd_posicoes
    }
  };
};

export const mockUpdateInventarioContagens = async (data: any) => {
  await mockDelay(600);
  
  data.posicoes?.forEach((posicao: any) => {
    const index = MOCK_INVENTARIO_POSICOES.findIndex(
      p => p.seq_inventario_posicao === posicao.seq_inventario_posicao
    );
    
    if (index !== -1) {
      MOCK_INVENTARIO_POSICOES[index].saldo_contado = posicao.saldo_contado;
      MOCK_INVENTARIO_POSICOES[index].diferenca = 
        posicao.saldo_contado - MOCK_INVENTARIO_POSICOES[index].saldo_sistema;
    }
  });
  
  return { success: true, message: 'Contagens atualizadas com sucesso' };
};

export const mockFinalizarInventario = async (seqInventario: number) => {
  await mockDelay(1000);
  
  const index = MOCK_INVENTARIOS.findIndex(inv => inv.seq_inventario === seqInventario);
  
  if (index === -1) {
    return { success: false, message: 'Inventário não encontrado' };
  }
  
  if (MOCK_INVENTARIOS[index].status !== 'PENDENTE') {
    return { success: false, message: 'Inventário já foi finalizado' };
  }
  
  MOCK_INVENTARIOS[index].status = 'FINALIZADO';
  MOCK_INVENTARIOS[index].data_conclusao = new Date().toISOString().split('T')[0];
  MOCK_INVENTARIOS[index].hora_conclusao = new Date().toTimeString().split(' ')[0];
  MOCK_INVENTARIOS[index].login_conclusao = 'presto';
  
  return { success: true, message: 'Inventário finalizado com sucesso' };
};

export const mockDeleteInventario = async (seqInventario: number) => {
  await mockDelay(500);
  
  const index = MOCK_INVENTARIOS.findIndex(inv => inv.seq_inventario === seqInventario);
  
  if (index === -1) {
    return { success: false, message: 'Inventário não encontrado' };
  }
  
  if (MOCK_INVENTARIOS[index].status !== 'PENDENTE') {
    return { success: false, message: 'Apenas inventários pendentes podem ser cancelados' };
  }
  
  MOCK_INVENTARIOS.splice(index, 1);
  
  return { success: true, message: 'Inventário cancelado com sucesso' };
};

// ============================================
// MOCK DE EVENTOS (TIPOS DE DESPESAS)
// ============================================

interface Evento {
  evento: number;
  descricao: string;
  ordem: number;
  considerar: string;
  tipo: string; // N=Normal, I=Impostos, D=Depreciação, F=Despesas Financeiras
}

// Dados mockados de eventos por domínio
const MOCK_EVENTOS_BY_DOMAIN: Record<string, Evento[]> = {
  VCS: [
    { evento: 1, descricao: 'COMBUSTÍVEL', ordem: 1, considerar: 'S', tipo: 'N' },
    { evento: 2, descricao: 'PEDÁGIO', ordem: 2, considerar: 'S', tipo: 'N' },
    { evento: 3, descricao: 'MANUTENÇÃO', ordem: 3, considerar: 'S', tipo: 'N' },
    { evento: 4, descricao: 'ALIMENTAÇÃO', ordem: 4, considerar: 'S', tipo: 'N' },
    { evento: 5, descricao: 'HOSPEDAGEM', ordem: 5, considerar: 'S', tipo: 'N' },
    { evento: 6, descricao: 'SEGURO', ordem: 6, considerar: 'S', tipo: 'N' },
    { evento: 7, descricao: 'LAVAGEM', ordem: 7, considerar: 'N', tipo: 'N' },
    { evento: 8, descricao: 'DOCUMENTAÇÃO', ordem: 8, considerar: 'S', tipo: 'N' },
    { evento: 9, descricao: 'IMPOSTOS', ordem: 9, considerar: 'S', tipo: 'I' },
    { evento: 10, descricao: 'DEPRECIAÇÃO FROTA', ordem: 10, considerar: 'S', tipo: 'D' },
    { evento: 11, descricao: 'JUROS BANCÁRIOS', ordem: 11, considerar: 'S', tipo: 'F' }
  ],
  DMN: [
    { evento: 1, descricao: 'DIESEL', ordem: 1, considerar: 'S', tipo: 'N' },
    { evento: 2, descricao: 'PEDÁGIO', ordem: 2, considerar: 'S', tipo: 'N' },
    { evento: 3, descricao: 'ARLA 32', ordem: 3, considerar: 'S', tipo: 'N' },
    { evento: 4, descricao: 'MANUTENÇÃO PREVENTIVA', ordem: 4, considerar: 'S', tipo: 'N' },
    { evento: 5, descricao: 'MANUTENÇÃO CORRETIVA', ordem: 5, considerar: 'S', tipo: 'N' },
    { evento: 6, descricao: 'PNEUS', ordem: 6, considerar: 'S', tipo: 'N' },
    { evento: 7, descricao: 'SEGURO VIAGEM', ordem: 7, considerar: 'S', tipo: 'N' },
    { evento: 8, descricao: 'RASTREAMENTO', ordem: 8, considerar: 'S', tipo: 'N' },
    { evento: 9, descricao: 'IMPOSTOS FEDERAIS', ordem: 9, considerar: 'S', tipo: 'I' },
    { evento: 10, descricao: 'DEPRECIAÇÃO VEÍCULOS', ordem: 10, considerar: 'S', tipo: 'D' },
    { evento: 11, descricao: 'FINANCIAMENTOS', ordem: 11, considerar: 'S', tipo: 'F' }
  ],
  ACV: [
    { evento: 1, descricao: 'COMBUSTÍVEL', ordem: 1, considerar: 'S', tipo: 'N' },
    { evento: 2, descricao: 'PEDÁGIO', ordem: 2, considerar: 'S', tipo: 'N' },
    { evento: 3, descricao: 'MANUTENÇÃO', ordem: 3, considerar: 'S', tipo: 'N' },
    { evento: 4, descricao: 'ALIMENTAÇÃO MOTORISTA', ordem: 4, considerar: 'S', tipo: 'N' },
    { evento: 5, descricao: 'ESTADIA', ordem: 5, considerar: 'S', tipo: 'N' },
    { evento: 6, descricao: 'TRIBUTOS', ordem: 6, considerar: 'S', tipo: 'I' },
    { evento: 7, descricao: 'DEPRECIAÇÃO', ordem: 7, considerar: 'S', tipo: 'D' },
    { evento: 8, descricao: 'ENCARGOS FINANCEIROS', ordem: 8, considerar: 'S', tipo: 'F' }
  ],
  XXX: [
    { evento: 1, descricao: 'DESPESA OPERACIONAL', ordem: 1, considerar: 'S', tipo: 'N' },
    { evento: 2, descricao: 'DESPESA ADMINISTRATIVA', ordem: 2, considerar: 'S', tipo: 'N' },
    { evento: 3, descricao: 'DESPESA FINANCEIRA', ordem: 3, considerar: 'N', tipo: 'F' }
  ]
};

// Helper para obter storage key de eventos por domínio
function getEventosStorageKey(domain: string): string {
  return `presto_eventos_${domain.toLowerCase()}`;
}

// Helper para obter eventos customizados do localStorage
function getCustomEventos(domain: string): Evento[] {
  try {
    const stored = localStorage.getItem(getEventosStorageKey(domain));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('❌ Erro ao ler eventos customizados:', error);
    return [];
  }
}

// Helper para salvar eventos customizados no localStorage
function saveCustomEventos(domain: string, eventos: Evento[]): void {
  try {
    localStorage.setItem(getEventosStorageKey(domain), JSON.stringify(eventos));
  } catch (error) {
    console.error('❌ Erro ao salvar eventos customizados:', error);
  }
}

// API Mock: Listar eventos
export const mockGetEventos = async (domain: string) => {
  await mockDelay(300);
  
  // Tentar obter eventos customizados do localStorage
  const customEventos = getCustomEventos(domain);
  
  if (customEventos.length > 0) {
    // Se existem eventos customizados, usar eles
    return {
      success: true,
      eventos: customEventos,
      total: customEventos.length
    };
  }
  
  // Caso contrário, usar eventos base do domínio
  const eventos = MOCK_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [];
  
  return {
    success: true,
    eventos: eventos,
    total: eventos.length
  };
};

// API Mock: Criar evento
export const mockCreateEvento = async (domain: string, data: { descricao: string; ordem: number; considerar: string; tipo: string }) => {
  await mockDelay(500);
  
  // Obter eventos existentes
  let eventos = getCustomEventos(domain);
  
  // Se não existem eventos customizados, começar com os base
  if (eventos.length === 0) {
    eventos = [...(MOCK_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [])];
  }
  
  // Gerar próximo ID
  const nextId = eventos.length > 0 ? Math.max(...eventos.map(e => e.evento)) + 1 : 1;
  
  // Criar novo evento
  const novoEvento: Evento = {
    evento: nextId,
    descricao: data.descricao,
    ordem: data.ordem,
    considerar: data.considerar,
    tipo: data.tipo || 'N' // Usar o tipo enviado, default 'N'
  };
  
  // Adicionar à lista
  eventos.push(novoEvento);
  
  // Salvar no localStorage
  saveCustomEventos(domain, eventos);
  
  return {
    success: true,
    message: 'Evento criado com sucesso!',
    evento: novoEvento
  };
};

// API Mock: Atualizar evento
export const mockUpdateEvento = async (domain: string, eventoId: number, data: { descricao: string; ordem: number; considerar: string; tipo: string }) => {
  await mockDelay(500);
  
  // Obter eventos existentes
  let eventos = getCustomEventos(domain);
  
  // Se não existem eventos customizados, começar com os base
  if (eventos.length === 0) {
    eventos = [...(MOCK_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [])];
  }
  
  // Encontrar índice do evento
  const index = eventos.findIndex(e => e.evento === eventoId);
  
  if (index === -1) {
    throw new Error('Evento não encontrado');
  }
  
  // Atualizar evento
  eventos[index] = {
    evento: eventoId,
    descricao: data.descricao,
    ordem: data.ordem,
    considerar: data.considerar,
    tipo: data.tipo || eventos[index].tipo || 'N' // Usar o tipo enviado, ou manter existente, ou default 'N'
  };
  
  // Salvar no localStorage
  saveCustomEventos(domain, eventos);
  
  return {
    success: true,
    message: 'Evento atualizado com sucesso!',
    evento: eventos[index]
  };
};

// API Mock: Deletar evento
export const mockDeleteEvento = async (domain: string, eventoId: number) => {
  await mockDelay(500);
  
  // Obter eventos existentes
  let eventos = getCustomEventos(domain);
  
  // Se não existem eventos customizados, começar com os base
  if (eventos.length === 0) {
    eventos = [...(MOCK_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [])];
  }
  
  // Encontrar índice do evento
  const index = eventos.findIndex(e => e.evento === eventoId);
  
  if (index === -1) {
    throw new Error('Evento não encontrado');
  }
  
  // Remover evento
  eventos.splice(index, 1);
  
  // Salvar no localStorage
  saveCustomEventos(domain, eventos);
  
  return {
    success: true,
    message: 'Evento deletado com sucesso!'
  };
};

// ================================================================
// DASHBOARD PERFORMANCE DE ENTREGAS - FUNÇÕES DE MOCK SEPARADAS
// ================================================================

interface PerformanceFilters {
  periodoEmissaoInicio?: string;
  periodoEmissaoFim?: string;
  periodoPrevisaoInicio?: string;
  periodoPrevisaoFim?: string;
  unidadeDestino?: string[];
  cnpjPagador?: string;
  cnpjDestinatario?: string;
}

// ✅ MOCK: CARDS (APLICA TODOS OS FILTROS)
export const mockGetPerformanceCards = async (filters: PerformanceFilters) => {
  await mockDelay(300);
  
  let filteredCTes = [...MOCK_CTES];
  
  // Aplicar TODOS os filtros
  if (filters.periodoEmissaoInicio) {
    filteredCTes = filteredCTes.filter(cte => cte.data_emissao >= filters.periodoEmissaoInicio!);
  }
  if (filters.periodoEmissaoFim) {
    filteredCTes = filteredCTes.filter(cte => cte.data_emissao <= filters.periodoEmissaoFim!);
  }
  if (filters.periodoPrevisaoInicio) {
    filteredCTes = filteredCTes.filter(cte => cte.data_previsao_entrega >= filters.periodoPrevisaoInicio!);
  }
  if (filters.periodoPrevisaoFim) {
    filteredCTes = filteredCTes.filter(cte => cte.data_previsao_entrega <= filters.periodoPrevisaoFim!);
  }
  if (filters.unidadeDestino && filters.unidadeDestino.length > 0) {
    filteredCTes = filteredCTes.filter(cte => filters.unidadeDestino!.includes(cte.unidade_destino));
  }
  if (filters.cnpjPagador) {
    filteredCTes = filteredCTes.filter(cte => cte.cnpj_pagador === filters.cnpjPagador);
  }
  if (filters.cnpjDestinatario) {
    filteredCTes = filteredCTes.filter(cte => cte.cnpj_destinatario === filters.cnpjDestinatario);
  }

  const hoje = new Date().toISOString().split('T')[0];

  const entreguesNoPrazo = filteredCTes.filter(cte => cte.data_entrega && cte.data_entrega <= cte.data_previsao_entrega).length;
  const entreguesEmAtraso = filteredCTes.filter(cte => cte.data_entrega && cte.data_entrega > cte.data_previsao_entrega).length;
  const pendentesEmAtraso = filteredCTes.filter(cte => !cte.data_entrega && cte.data_previsao_entrega < hoje).length;
  const pendentesNoPrazo = filteredCTes.filter(cte => !cte.data_entrega && cte.data_previsao_entrega >= hoje).length;
  const total = filteredCTes.length || 1; // Evitar divisão por zero

  const deliveryGroups = [
    {
      label: 'Entregues no Prazo',
      count: entreguesNoPrazo,
      percentage: (entreguesNoPrazo / total) * 100,
      color: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
      chartColor: '#10b981',
      emptyColor: '#dcfce7',
      emptyColorDark: '#064e3b',
      hoverColor: 'hover:bg-green-200 dark:hover:bg-green-800'
    },
    {
      label: 'Entregues em Atraso',
      count: entreguesEmAtraso,
      percentage: (entreguesEmAtraso / total) * 100,
      color: 'text-yellow-700 dark:text-yellow-300',
      bgColor: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800',
      chartColor: '#f59e0b',
      emptyColor: '#fef3c7',
      emptyColorDark: '#713f12',
      hoverColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-800'
    },
    {
      label: 'Pendentes no Prazo',
      count: pendentesNoPrazo,
      percentage: (pendentesNoPrazo / total) * 100,
      color: 'text-blue-700 dark:text-blue-300',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
      chartColor: '#3b82f6',
      emptyColor: '#dbeafe',
      emptyColorDark: '#1e3a8a',
      hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-800'
    },
    {
      label: 'Pendentes em Atraso',
      count: pendentesEmAtraso,
      percentage: (pendentesEmAtraso / total) * 100,
      color: 'text-red-700 dark:text-red-300',
      bgColor: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800',
      chartColor: '#ef4444',
      emptyColor: '#fee2e2',
      emptyColorDark: '#7f1d1d',
      hoverColor: 'hover:bg-red-200 dark:hover:bg-red-800'
    }
  ];

  return {
    success: true,
    data: { deliveryGroups }
  };
};

// ✅ MOCK: EVOLUÇÃO DA PERFORMANCE (APLICA TODOS EXCETO PERÍODOS)
export const mockGetPerformanceEvolucao = async (filters: PerformanceFilters, periodo: 7 | 15 | 30 = 30) => {
  await mockDelay(300);
  
  let filteredCTes = [...MOCK_CTES];
  
  // ❌ NÃO APLICAR: Períodos de Emissão e Previsão
  
  // Aplicar apenas: Unidade, CNPJ Pagador, CNPJ Destinatário
  if (filters.unidadeDestino && filters.unidadeDestino.length > 0) {
    filteredCTes = filteredCTes.filter(cte => filters.unidadeDestino!.includes(cte.unidade_destino));
  }
  if (filters.cnpjPagador) {
    filteredCTes = filteredCTes.filter(cte => cte.cnpj_pagador === filters.cnpjPagador);
  }
  if (filters.cnpjDestinatario) {
    filteredCTes = filteredCTes.filter(cte => cte.cnpj_destinatario === filters.cnpjDestinatario);
  }

  // ✅ GERAR dados APENAS para dias COM CT-e (não todos os dias)
  const performanceData: Array<{ data: string; previstos: number; noPrazo: number; performance: number }> = [];
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1); // ✅ TERMINA EM ONTEM
  
  for (let i = periodo; i >= 1; i--) {
    const dia = new Date(ontem);
    dia.setDate(ontem.getDate() - i + 1); // Ajuste para contar 30 dias até ontem
    const diaSemana = dia.getDay(); // 0=domingo, 6=sábado
    
    // ✅ Pula domingos e alguns sábados (simula dias sem CT-e)
    if (diaSemana === 0 || (diaSemana === 6 && Math.random() > 0.5)) {
      continue;
    }
    
    // ✅ Pula aleatoriamente alguns dias (20% de chance)
    if (Math.random() < 0.2) {
      continue;
    }
    
    // Formatar DD/MM
    const dataStr = `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}`;
    
    // Gerar dados com oscilação realista
    const total = Math.floor(Math.random() * 20) + 15; // 15-35
    
    // Oscilação com padrão de fim de semana
    let basePercentage = 85;
    
    if (diaSemana === 5 || diaSemana === 6) {
      basePercentage = 75; // Fim de semana
    }
    
    // Variação aleatória de -10 a +10
    const variation = (Math.random() * 20) - 10;
    const percentage = Math.max(60, Math.min(98, basePercentage + variation));
    
    const onTime = Math.round((total * percentage) / 100);
    
    performanceData.push({
      data: dataStr,
      previstos: total,
      noPrazo: onTime,
      performance: Math.round(percentage * 10) / 10
    });
  }

  return {
    success: true,
    data: { performanceData }
  };
};

// ✅ MOCK: COMPARATIVO DE UNIDADES (APLICA TODOS EXCETO UNIDADES)
export const mockGetPerformanceComparativo = async (filters: PerformanceFilters) => {
  await mockDelay(300);
  
  let filteredCTes = [...MOCK_CTES];
  
  // Aplicar todos EXCETO unidades de destino
  if (filters.periodoEmissaoInicio) {
    filteredCTes = filteredCTes.filter(cte => cte.data_emissao >= filters.periodoEmissaoInicio!);
  }
  if (filters.periodoEmissaoFim) {
    filteredCTes = filteredCTes.filter(cte => cte.data_emissao <= filters.periodoEmissaoFim!);
  }
  if (filters.periodoPrevisaoInicio) {
    filteredCTes = filteredCTes.filter(cte => cte.data_previsao_entrega >= filters.periodoPrevisaoInicio!);
  }
  if (filters.periodoPrevisaoFim) {
    filteredCTes = filteredCTes.filter(cte => cte.data_previsao_entrega <= filters.periodoPrevisaoFim!);
  }
  // ❌ NÃO APLICAR: Unidade de Destino
  if (filters.cnpjPagador) {
    filteredCTes = filteredCTes.filter(cte => cte.cnpj_pagador === filters.cnpjPagador);
  }
  if (filters.cnpjDestinatario) {
    filteredCTes = filteredCTes.filter(cte => cte.cnpj_destinatario === filters.cnpjDestinatario);
  }

  // Agrupar por unidade
  const hoje = new Date().toISOString().split('T')[0];
  const unitData = new Map<string, { 
    total: number; 
    entreguesNoPrazo: number;
    entreguesEmAtraso: number;
    pendentesNoPrazo: number;
    pendentesEmAtraso: number;
  }>();
  
  filteredCTes.forEach(cte => {
    const existing = unitData.get(cte.unidade_destino) || { 
      total: 0, 
      entreguesNoPrazo: 0,
      entreguesEmAtraso: 0,
      pendentesNoPrazo: 0,
      pendentesEmAtraso: 0
    };
    existing.total++;
    
    // Classificar
    if (cte.data_entrega) {
      if (cte.data_entrega <= cte.data_previsao_entrega) {
        existing.entreguesNoPrazo++;
      } else {
        existing.entreguesEmAtraso++;
      }
    } else {
      if (cte.data_previsao_entrega < hoje) {
        existing.pendentesEmAtraso++;
      } else {
        existing.pendentesNoPrazo++;
      }
    }
    
    unitData.set(cte.unidade_destino, existing);
  });

  // Converter para array e ordenar por performance
  const unitPerformances = Array.from(unitData.entries())
    .map(([unidade, data]) => {
      const performance = data.total > 0 ? (data.entreguesNoPrazo / data.total) * 100 : 0;
      return {
        unidade: unidade,
        sigla: unidade.split(' - ')[0] || unidade.substring(0, 3).toUpperCase(),
        total: data.total,
        entreguesNoPrazo: data.entreguesNoPrazo,
        entreguesEmAtraso: data.entreguesEmAtraso,
        pendentesNoPrazo: data.pendentesNoPrazo,
        pendentesEmAtraso: data.pendentesEmAtraso,
        performance: Math.round(performance * 10) / 10
      };
    })
    .sort((a, b) => b.performance - a.performance || b.total - a.total);

  return {
    success: true,
    data: { unitPerformances }
  };
};

// ✅ MOCK: ANÁLISE DIÁRIA (INDEPENDENTE DOS FILTROS)
export const mockGetAnaliseDiaria = async (periodo: 7 | 15 | 30) => {
  await mockDelay(300);
  
  const diasData = [];
  const hoje = new Date();
  
  // Gerar dados para os últimos N dias até ONTEM
  for (let i = periodo; i >= 1; i--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);
    
    const diaSemana = data.getDay(); // 0 = domingo, 1 = segunda, etc
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    
    const mesesNome = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    
    // Simular dados realistas
    // Domingos e feriados = poucos ou zero entregas
    const isDomingo = diaSemana === 0;
    const isSabado = diaSemana === 6;
    
    let entregasDia = 0;
    let previstosDia = 0;
    let entreguesDia = 0;
    
    if (isDomingo) {
      // Domingo: sem entregas
      entregasDia = 0;
      previstosDia = 0;
      entreguesDia = 0;
    } else if (isSabado) {
      // Sábado: reduzido
      entregasDia = Math.floor(Math.random() * 15) + 5; // 5-20
      previstosDia = Math.floor(Math.random() * 12) + 3; // 3-15
      entreguesDia = Math.floor(previstosDia * (Math.random() * 0.3 + 0.7)); // 70-100% dos previstos
    } else {
      // Dias úteis: movimento normal
      entregasDia = Math.floor(Math.random() * 40) + 20; // 20-60
      previstosDia = Math.floor(Math.random() * 35) + 15; // 15-50
      
      // Performance varia: 60-100%
      const performanceAleatoria = Math.random() * 0.4 + 0.6; // 0.6 a 1.0
      entreguesDia = Math.min(Math.floor(previstosDia * performanceAleatoria), previstosDia);
    }
    
    diasData.push({
      dia: dia,
      mes: mes,
      mesNome: mesesNome[parseInt(mes) - 1],
      diaSemana: diasSemana[diaSemana],
      data: `${ano}-${mes}-${dia}`,
      entregasDia: entregasDia,
      previstosDia: previstosDia,
      entreguesDia: entreguesDia
    });
  }
  
  return {
    success: true,
    data: { diasData }
  };
};

// ================================================================
// MOCK DATA: GRUPOS DE EVENTOS
// ================================================================

interface GrupoEvento {
  grupo: number;
  descricao: string;
}

interface EventoComGrupo extends Evento {
  grupo: number;
  grupo_descricao: string;
}

// Mock inicial de grupos de eventos por domínio
const MOCK_GRUPOS_EVENTOS_BY_DOMAIN: { [domain: string]: GrupoEvento[] } = {
  VCS: [
    { grupo: 0, descricao: 'Sem Grupo' },
    { grupo: 1, descricao: 'Despesas Operacionais' },
    { grupo: 2, descricao: 'Tributos e Impostos' },
    { grupo: 3, descricao: 'Despesas Financeiras' }
  ],
  ACV: [
    { grupo: 0, descricao: 'Sem Grupo' },
    { grupo: 1, descricao: 'Custos Diretos' },
    { grupo: 2, descricao: 'Custos Indiretos' }
  ],
  XXX: [
    { grupo: 0, descricao: 'Sem Grupo' }
  ]
};

// Helper para obter storage key de grupos por domínio
function getGruposStorageKey(domain: string): string {
  return `presto_grupos_eventos_${domain.toLowerCase()}`;
}

// Helper para obter grupos customizados do localStorage
function getCustomGrupos(domain: string): GrupoEvento[] {
  try {
    const stored = localStorage.getItem(getGruposStorageKey(domain));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('❌ Erro ao ler grupos customizados:', error);
    return [];
  }
}

// Helper para salvar grupos customizados no localStorage
function saveCustomGrupos(domain: string, grupos: GrupoEvento[]): void {
  try {
    localStorage.setItem(getGruposStorageKey(domain), JSON.stringify(grupos));
  } catch (error) {
    console.error('❌ Erro ao salvar grupos customizados:', error);
  }
}

// Helper para obter storage key de associações grupo-evento
function getAssociacoesStorageKey(domain: string): string {
  return `presto_associacoes_eventos_${domain.toLowerCase()}`;
}

// Helper para obter associações customizadas do localStorage
function getCustomAssociacoes(domain: string): { [eventoId: number]: number } {
  try {
    const stored = localStorage.getItem(getAssociacoesStorageKey(domain));
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('❌ Erro ao ler associações customizadas:', error);
    return {};
  }
}

// Helper para salvar associações customizadas no localStorage
function saveCustomAssociacoes(domain: string, associacoes: { [eventoId: number]: number }): void {
  try {
    localStorage.setItem(getAssociacoesStorageKey(domain), JSON.stringify(associacoes));
  } catch (error) {
    console.error('❌ Erro ao salvar associações customizadas:', error);
  }
}

// API Mock: Listar grupos de eventos
export const mockGetGruposEventos = async (domain: string) => {
  await mockDelay(300);
  
  // Tentar obter grupos customizados do localStorage
  let customGrupos = getCustomGrupos(domain);
  
  if (customGrupos.length > 0) {
    return {
      success: true,
      grupos: customGrupos
    };
  }
  
  // Caso contrário, usar grupos base do domínio e salvar no localStorage
  const grupos = MOCK_GRUPOS_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [
    { grupo: 0, descricao: 'Sem Grupo' }
  ];
  
  // ✅ CORREÇÃO: Salvar grupos base no localStorage na primeira carga
  saveCustomGrupos(domain, grupos);
  
  return {
    success: true,
    grupos: grupos
  };
};

// API Mock: Criar grupo de eventos
export const mockCreateGrupoEvento = async (domain: string, descricao: string) => {
  await mockDelay(500);
  
  // Obter grupos existentes
  let grupos = getCustomGrupos(domain);
  
  // Se não existem grupos customizados, começar com os base
  if (grupos.length === 0) {
    grupos = [...(MOCK_GRUPOS_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [
      { grupo: 0, descricao: 'Sem Grupo' }
    ])];
  }
  
  // Gerar próximo ID
  const nextId = grupos.length > 0 ? Math.max(...grupos.map(g => g.grupo)) + 1 : 1;
  
  // Criar novo grupo
  const novoGrupo: GrupoEvento = {
    grupo: nextId,
    descricao: descricao
  };
  
  // Adicionar à lista
  grupos.push(novoGrupo);
  
  // Salvar no localStorage
  saveCustomGrupos(domain, grupos);
  
  return {
    success: true,
    message: 'Grupo criado com sucesso!',
    grupo: novoGrupo
  };
};

// API Mock: Atualizar grupo de eventos
export const mockUpdateGrupoEvento = async (domain: string, grupoId: number, descricao: string) => {
  await mockDelay(500);
  
  console.log('🔵 mockUpdateGrupoEvento chamado:', { domain, grupoId, descricao });
  
  // Obter grupos existentes
  let grupos = getCustomGrupos(domain);
  
  console.log('🔵 Grupos do localStorage:', grupos);
  
  // Se não existem grupos customizados, começar com os base E SALVAR
  if (grupos.length === 0) {
    grupos = [...(MOCK_GRUPOS_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [])];
    console.log('🔵 Usando grupos base:', grupos);
    // ✅ CORREÇÃO: Salvar grupos base antes de continuar
    saveCustomGrupos(domain, grupos);
  }
  
  // Encontrar índice do grupo
  const index = grupos.findIndex(g => g.grupo === grupoId);
  
  console.log('🔵 Índice encontrado:', index, 'para grupoId:', grupoId);
  
  if (index === -1) {
    console.error('❌ Grupo não encontrado! Grupos disponíveis:', grupos.map(g => g.grupo));
    return {
      success: false,
      error: 'Grupo não encontrado'
    };
  }
  
  // Atualizar grupo
  grupos[index] = {
    grupo: grupoId,
    descricao: descricao
  };
  
  console.log('🔵 Grupo atualizado:', grupos[index]);
  
  // Salvar no localStorage
  saveCustomGrupos(domain, grupos);
  
  console.log('✅ Salvo no localStorage com sucesso!');
  
  return {
    success: true,
    message: 'Grupo atualizado com sucesso!',
    grupo: grupos[index]
  };
};

// API Mock: Deletar grupo de eventos
export const mockDeleteGrupoEvento = async (domain: string, grupoId: number) => {
  await mockDelay(500);
  
  if (grupoId === 0) {
    return {
      success: false,
      error: 'Não é possível excluir o grupo padrão (0)'
    };
  }
  
  // Obter grupos existentes
  let grupos = getCustomGrupos(domain);
  
  // Se não existem grupos customizados, começar com os base
  if (grupos.length === 0) {
    grupos = [...(MOCK_GRUPOS_EVENTOS_BY_DOMAIN[domain.toUpperCase()] || [])];
  }
  
  // Encontrar índice do grupo
  const index = grupos.findIndex(g => g.grupo === grupoId);
  
  if (index === -1) {
    return {
      success: false,
      error: 'Grupo não encontrado'
    };
  }
  
  // Remover grupo
  grupos.splice(index, 1);
  
  // Salvar no localStorage
  saveCustomGrupos(domain, grupos);
  
  // Remover associações dos eventos (definir grupo = 0)
  const associacoes = getCustomAssociacoes(domain);
  Object.keys(associacoes).forEach(eventoId => {
    if (associacoes[Number(eventoId)] === grupoId) {
      associacoes[Number(eventoId)] = 0;
    }
  });
  saveCustomAssociacoes(domain, associacoes);
  
  return {
    success: true,
    message: 'Grupo deletado com sucesso!'
  };
};

// API Mock: Listar todos os eventos com informação de grupo
export const mockGetTodosEventosComGrupo = async (domain: string) => {
  await mockDelay(300);
  
  // Obter eventos
  const eventosResult = await mockGetEventos(domain);
  const eventos = eventosResult.eventos || [];
  
  // Obter grupos
  const gruposResult = await mockGetGruposEventos(domain);
  const grupos = gruposResult.grupos || [];
  
  // Obter associações
  const associacoes = getCustomAssociacoes(domain);
  
  // Criar mapa de grupos para lookup rápido
  const gruposMap = new Map(grupos.map(g => [g.grupo, g.descricao]));
  
  // Combinar eventos com informação de grupo
  const eventosComGrupo: EventoComGrupo[] = eventos.map(evento => {
    const grupoId = associacoes[evento.evento] ?? 0;
    return {
      ...evento,
      grupo: grupoId,
      grupo_descricao: gruposMap.get(grupoId) || 'Sem Grupo'
    };
  });
  
  return {
    success: true,
    eventos: eventosComGrupo
  };
};

// API Mock: Associar evento a grupo
export const mockAssociarEventoAGrupo = async (domain: string, grupoId: number, eventoId: number) => {
  await mockDelay(300);
  
  // Obter associações existentes
  const associacoes = getCustomAssociacoes(domain);
  
  // Atualizar associação
  associacoes[eventoId] = grupoId;
  
  // Salvar no localStorage
  saveCustomAssociacoes(domain, associacoes);
  
  return {
    success: true,
    message: 'Evento associado ao grupo com sucesso!'
  };
};

// API Mock: Desassociar evento de grupo (volta para grupo 0)
export const mockDesassociarEventoDeGrupo = async (domain: string, eventoId: number) => {
  await mockDelay(300);
  
  // Obter associações existentes
  const associacoes = getCustomAssociacoes(domain);
  
  // Definir grupo = 0
  associacoes[eventoId] = 0;
  
  // Salvar no localStorage
  saveCustomAssociacoes(domain, associacoes);
  
  return {
    success: true,
    message: 'Evento desassociado do grupo com sucesso!'
  };
};

// ========================================
// MOCKS: PERFORMANCE DE COLETAS
// ========================================

import type { ColetasFilters, PerformanceCards, DayDataColetas, EvolucaoDataColetas, UnidadePerformanceColetas } from '../services/performanceColetasService';

// ✅ MOCK: CARDS DE PERFORMANCE DE COLETAS
export const mockGetPerformanceCardsColetas = async (filters: ColetasFilters): Promise<PerformanceCards> => {
  await mockDelay(300);
  
  return {
    precastradas: 45,
    cadastradas: 128,
    comandadas: 87,
    coletadas: 234,
    total: 494
  };
};

// ✅ MOCK: ANÁLISE DIÁRIA DE COLETAS
export const mockGetAnaliseDiariaColetas = async (filters: ColetasFilters): Promise<DayDataColetas[]> => {
  await mockDelay(300);
  
  const dias: DayDataColetas[] = [];
  const hoje = new Date();
  
  // Gerar dados para os últimos 30 dias
  for (let i = 29; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    
    const programadas = Math.floor(Math.random() * 30) + 10; // 10-40
    const realizadas = Math.floor(Math.random() * 25) + 5; // 5-30
    const noPrazo = Math.floor(realizadas * (0.7 + Math.random() * 0.25)); // 70-95% no prazo
    
    dias.push({
      data: data.toISOString().split('T')[0],
      coletasRealizadas: realizadas,
      coletasProgramadas: programadas,
      coletadasNoPrazo: noPrazo,
      performance: programadas > 0 ? Math.round((noPrazo / programadas) * 100) : 0
    });
  }
  
  return dias;
};

// ✅ MOCK: EVOLUÇÃO DA PERFORMANCE DE COLETAS
export const mockGetEvolucaoPerformanceColetas = async (filters: ColetasFilters): Promise<EvolucaoDataColetas[]> => {
  await mockDelay(300);
  
  const dados: EvolucaoDataColetas[] = [];
  const hoje = new Date();
  
  // Gerar dados para os últimos 30 dias
  for (let i = 29; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    
    const programadas = Math.floor(Math.random() * 30) + 10; // 10-40
    const noPrazo = Math.floor(programadas * (0.7 + Math.random() * 0.25)); // 70-95% no prazo
    
    dados.push({
      data: data.toISOString().split('T')[0], // Formato YYYY-MM-DD
      performance: programadas > 0 ? (noPrazo / programadas) * 100 : 0
    });
  }
  
  return dados;
};

// ✅ MOCK: COMPARATIVO POR UNIDADES COLETADORAS
export const mockGetComparativoUnidadesColetas = async (filters: ColetasFilters): Promise<UnidadePerformanceColetas[]> => {
  await mockDelay(300);
  
  const unidades = [
    { sigla: 'VCS', nome: 'VITÓRIA DA CONQUISTA' },
    { sigla: 'SSA', nome: 'SALVADOR' },
    { sigla: 'ITA', nome: 'ITABUNA' },
    { sigla: 'ILH', nome: 'ILHÉUS' },
    { sigla: 'JEQ', nome: 'JEQUIÉ' },
    { sigla: 'BRU', nome: 'BRUMADO' },
    { sigla: 'FEI', nome: 'FEIRA DE SANTANA' },
    { sigla: 'POR', nome: 'PORTO SEGURO' },
    { sigla: 'GUA', nome: 'GUANAMBI' },
    { sigla: 'CAM', nome: 'CAMAÇARI' }
  ];
  
  return unidades.map(u => {
    const qtdeColetas = Math.floor(Math.random() * 150) + 50; // 50-200
    const programadas = Math.floor(qtdeColetas * 0.8); // ~80% programadas
    const comandadas = Math.floor(programadas * 0.6); // ~60% comandadas
    const coletadas = Math.floor(comandadas * (0.7 + Math.random() * 0.25)); // 70-95% coletadas
    const noPrazo = Math.floor(coletadas * (0.75 + Math.random() * 0.2)); // 75-95% no prazo
    
    return {
      unidade: u.nome,
      sigla: u.sigla,
      qtdeColetas,
      programadas,
      comandadas,
      coletadas,
      noPrazo,
      performance: qtdeColetas > 0 ? Math.round((noPrazo / qtdeColetas) * 100) : 0
    };
  });
};

// ============================================
// MOCK: TABELAS A VENCER
// ============================================

export interface TabelaVencer {
  vendedor: string;
  cnpj: string;
  nome: string;
  unidade: string;
  tp_tab: string;
  qtde_tab: number;
  vig_atual: string;
}

export const mockGetTabelasVencer = async (): Promise<{
  success: boolean;
  data: TabelaVencer[];
  total: number;
  periodo: { inicio: string; fim: string };
}> => {
  // Simular delay pesado (operação demorada)
  await mockDelay(2500);
  
  const vendedores = ['JOAO.SILVA', 'MARIA.SANTOS', 'PEDRO.COSTA', 'ANA.OLIVEIRA', 'CARLOS.SOUZA', 'SEM VENDEDOR'];
  const unidades = ['VCS', 'SSA', 'ITA', 'ILH', 'JEQ', 'BRU', 'FEI'];
  const tiposTabs = ['Frete Peso', 'Frete Valor', 'Redespacho', 'Balcão', 'Expresso'];
  
  const empresas = [
    { cnpj: '12345678000190', nome: 'EMPRESA ABC LTDA' },
    { cnpj: '23456789000101', nome: 'TRANSPORTES XYZ S/A' },
    { cnpj: '34567890000112', nome: 'LOGISTICA MASTER EIRELI' },
    { cnpj: '45678901000123', nome: 'COMERCIO E INDUSTRIA BETA' },
    { cnpj: '56789012000134', nome: 'DISTRIBUIDORA GAMA LTDA' },
    { cnpj: '67890123000145', nome: 'SERVICOS DELTA ME' },
    { cnpj: '78901234000156', nome: 'ATACADO EPSILON LTDA' },
    { cnpj: '89012345000167', nome: 'VAREJO OMEGA S/A' },
    { cnpj: '90123456000178', nome: 'TECH INNOVATIONS LTDA' },
    { cnpj: '01234567000189', nome: 'FAST DELIVERY EXPRESS' },
    { cnpj: '11223344000155', nome: 'MEGA TRANSPORTES RAPIDOS' },
    { cnpj: '22334455000166', nome: 'SUPER LOGISTICA INTELIGENTE' },
    { cnpj: '33445566000177', nome: 'PRIME CARGO SOLUTIONS' },
    { cnpj: '44556677000188', nome: 'ULTRA FREIGHT SERVICES' },
    { cnpj: '55667788000199', nome: 'EXCELLENCE SHIPPING CO' },
    { cnpj: '66778899000100', nome: 'GLOBAL TRANSPORT PARTNERS' },
    { cnpj: '77889900000111', nome: 'SMART LOGISTICS GROUP' },
    { cnpj: '88990011000122', nome: 'DYNAMIC CARGO EXPRESS' },
    { cnpj: '99001122000133', nome: 'RELIABLE FREIGHT SYSTEMS' },
    { cnpj: '10111213000144', nome: 'PREMIUM DELIVERY NETWORK' }
  ];
  
  const dados: TabelaVencer[] = [];
  
  // Gerar entre 25-35 registros
  const qtdeRegistros = Math.floor(Math.random() * 11) + 25;
  
  for (let i = 0; i < qtdeRegistros; i++) {
    const empresa = empresas[Math.floor(Math.random() * empresas.length)];
    const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
    const unidade = unidades[Math.floor(Math.random() * unidades.length)];
    const tipoTab = tiposTabs[Math.floor(Math.random() * tiposTabs.length)];
    const qtdeTabs = Math.floor(Math.random() * 20) + 1;
    
    // Gerar data de vencimento até o fim do mês
    const hoje = new Date();
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const diaVencimento = Math.floor(Math.random() * (ultimoDiaMes - hoje.getDate() + 1)) + hoje.getDate();
    const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento);
    const vigAtual = dataVencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    
    dados.push({
      vendedor: vendedor,
      cnpj: empresa.cnpj,
      nome: empresa.nome,
      unidade: unidade,
      tp_tab: tipoTab,
      qtde_tab: qtdeTabs,
      vig_atual: vigAtual
    });
  }
  
  // Ordenar por vendedor e nome
  dados.sort((a, b) => {
    if (a.vendedor !== b.vendedor) return a.vendedor.localeCompare(b.vendedor);
    return a.nome.localeCompare(b.nome);
  });
  
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const inicioFormatado = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fimFormatado = ultimoDia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  return {
    success: true,
    data: dados,
    total: dados.length,
    periodo: {
      inicio: inicioFormatado,
      fim: fimFormatado
    }
  };
};

// ============================================
// MOCK: GESTÃO DO MENU
// ============================================

// Variáveis globais para simular banco de dados
let mockMenuSections = [...MOCK_MENU_SECTIONS];
let mockMenuItems = [...MOCK_MENU_ITEMS];
let nextSectionId = 7;
let nextItemId = 35;

// Helper: Obter todas as seções com seus itens
export const mockGetAllMenu = async () => {
  await mockDelay(300);
  
  const menuData = mockMenuSections.map(section => ({
    section: {
      id: section.id,
      code: section.code,
      name: section.name,
      description: section.description || null,
      icon: section.icon,
      display_order: section.display_order,
      is_active: true
    },
    items: mockMenuItems
      .filter(item => item.section_id === section.id)
      .map(item => ({
        id: item.id,
        section_id: item.section_id,
        code: item.code,
        name: item.name,
        description: item.description || null,
        icon: item.icon,
        route_path: item.route_path,
        component_path: item.component_path,
        is_available: item.is_available,
        status: item.status
      }))
  }));
  
  return {
    success: true,
    data: menuData
  };
};

// Helper: Criar seção
export const mockCreateSection = async (data: any) => {
  await mockDelay(500);
  
  // Validar código único
  if (mockMenuSections.find(s => s.code === data.code)) {
    throw new Error('Código da seção já existe');
  }
  
  const newSection = {
    id: nextSectionId++,
    code: data.code.toUpperCase(),
    name: data.name.toUpperCase(),
    description: data.description ? data.description.toUpperCase() : null,
    icon: data.icon || 'Menu',
    display_order: data.display_order || 1
  };
  
  mockMenuSections.push(newSection);
  
  return {
    success: true,
    message: 'Seção criada com sucesso',
    id: newSection.id
  };
};

// Helper: Atualizar seção
export const mockUpdateSection = async (data: any) => {
  await mockDelay(500);
  
  const index = mockMenuSections.findIndex(s => s.id === data.id);
  if (index === -1) {
    throw new Error('Seção não encontrada');
  }
  
  // Validar código único (exceto própria seção)
  if (mockMenuSections.find(s => s.code === data.code && s.id !== data.id)) {
    throw new Error('Código da seção já existe em outra seção');
  }
  
  mockMenuSections[index] = {
    ...mockMenuSections[index],
    code: data.code.toUpperCase(),
    name: data.name.toUpperCase(),
    description: data.description ? data.description.toUpperCase() : null,
    icon: data.icon || 'Menu',
    display_order: data.display_order || 1
  };
  
  return {
    success: true,
    message: 'Seção atualizada com sucesso'
  };
};

// Helper: Excluir seção
export const mockDeleteSection = async (id: number) => {
  await mockDelay(500);
  
  const section = mockMenuSections.find(s => s.id === id);
  if (!section) {
    throw new Error('Seção não encontrada');
  }
  
  // Verificar se tem itens
  const hasItems = mockMenuItems.some(item => item.section_id === id);
  if (hasItems) {
    throw new Error('Não é possível excluir seção com itens. Exclua os itens primeiro.');
  }
  
  mockMenuSections = mockMenuSections.filter(s => s.id !== id);
  
  return {
    success: true,
    message: 'Seção excluída com sucesso'
  };
};

// Helper: Criar item de menu
export const mockCreateMenuItem = async (data: any) => {
  await mockDelay(500);
  
  // Validar seção existe
  if (!mockMenuSections.find(s => s.id === data.section_id)) {
    throw new Error('Seção não encontrada');
  }
  
  // Validar código único
  if (mockMenuItems.find(i => i.code === data.code)) {
    throw new Error('Código do item já existe');
  }
  
  const newItem = {
    id: nextItemId++,
    section_id: data.section_id,
    code: data.code.toLowerCase(),
    name: data.name.toUpperCase(),
    description: data.description ? data.description.toUpperCase() : null,
    icon: data.icon || 'FileText',
    route_path: data.route_path.toLowerCase(),
    component_path: data.component_path,
    is_available: data.is_available ?? true,
    status: data.status || 'development'
  };
  
  mockMenuItems.push(newItem);
  
  return {
    success: true,
    message: 'Item criado com sucesso',
    id: newItem.id
  };
};

// Helper: Atualizar item de menu
export const mockUpdateMenuItem = async (data: any) => {
  await mockDelay(500);
  
  const index = mockMenuItems.findIndex(i => i.id === data.id);
  if (index === -1) {
    throw new Error('Item não encontrado');
  }
  
  // Validar seção existe
  if (!mockMenuSections.find(s => s.id === data.section_id)) {
    throw new Error('Seção não encontrada');
  }
  
  // Validar código único (exceto próprio item)
  if (mockMenuItems.find(i => i.code === data.code && i.id !== data.id)) {
    throw new Error('Código do item já existe em outro item');
  }
  
  mockMenuItems[index] = {
    ...mockMenuItems[index],
    section_id: data.section_id,
    code: data.code.toLowerCase(),
    name: data.name.toUpperCase(),
    description: data.description ? data.description.toUpperCase() : null,
    icon: data.icon || 'FileText',
    route_path: data.route_path.toLowerCase(),
    component_path: data.component_path,
    is_available: data.is_available ?? true,
    status: data.status || 'development'
  };
  
  return {
    success: true,
    message: 'Item atualizado com sucesso'
  };
};

// Helper: Excluir item de menu
export const mockDeleteMenuItem = async (id: number) => {
  await mockDelay(500);
  
  const item = mockMenuItems.find(i => i.id === id);
  if (!item) {
    throw new Error('Item não encontrado');
  }
  
  mockMenuItems = mockMenuItems.filter(i => i.id !== id);
  
  return {
    success: true,
    message: 'Item excluído com sucesso'
  };
};