<?php
/**
 * ============================================
 * API - BUSCAR MENU DO USUÁRIO
 * ============================================
 *
 * Retorna estrutura completa do menu baseado em:
 * 1. Itens disponíveis para o domínio (domain_menu_items)
 * 2. Permissões do usuário (user_permissions)
 * 3. Agrupado por seções (menu_sections)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

try {
    // Verificar autenticação
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        msg('ERRO', $authResult['message']);
        exit();
    }

    $userDomain = $authResult['domain'];
    $userId = $authResult['user_id'] ?? 0;
    $isAdmin = $authResult['is_admin'] ?? false;
    $username = $authResult['username'] ?? '';

    // ✅ Se banco não configurado, retornar menu mock
    if (!isDatabaseConfigured()) {
        echo json_encode([
            'success' => true,
            'use_mock' => true,
            'sections' => getMockMenuSections()
        ]);
        exit();
    }

    // ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
    $g_sql = connect();

    // ✅ REGRA ESPECIAL: Usuário "presto" SEMPRE é admin (independente do campo no banco)
    if (strtolower($username) === 'presto') {
        $isAdmin = true;
    }

    // ✅ QUERY: Buscar menu do usuário com todas as informações
    // Retorna apenas itens que:
    // 1. Estão disponíveis no sistema (is_available = true)
    // 2. Estão liberados para o domínio (domain_menu_items)
    // 3. O usuário tem permissão (user_permissions) OU é admin
    $query = "SELECT DISTINCT ms.id as section_id, ms.code as section_code, ms.name as section_name,
                              ms.description as section_description, ms.icon as section_icon,
                              ms.display_order as section_order, mi.id as item_id,
                              mi.code as item_code, mi.name as item_name,
                              mi.description as item_description, mi.icon as item_icon,
                              mi.route_path, mi.component_path, mi.status, mi.ordem
                FROM menu_sections ms
               INNER JOIN menu_items mi ON mi.section_id = ms.id
               INNER JOIN domain_menu_items dmi ON dmi.id = mi.id AND dmi.domain = '$userDomain'
                LEFT JOIN user_permissions up ON up.id = mi.id AND up.user_id = '$userId'
               WHERE ms.is_active = TRUE
                 AND mi.is_available = TRUE
                 AND (up.id IS NOT NULL OR '$isAdmin' = '1')
               ORDER BY ms.display_order ASC, mi.ordem ASC, mi.name ASC";

    // ✅ PADRÃO OFICIAL: Usar sql() com $g_sql
    $result = sql($g_sql, $query);
    
    // Verificar se houve erro na query
    if (!$result) {
        msg('Erro ao buscar menu do usuário', 'error');
    }

    // ✅ Organizar resultado em estrutura hierárquica
    $sections = [];
    $sectionMap = [];

    while ($row = pg_fetch_assoc($result)) {
        $sectionId = (int)$row['section_id'];

        // Apenas Admins podem ver itens de administracao
        if (($row['section_code'] == 'admin') && (!$isAdmin))
          continue;

        // Itens que só podem ser visualizados no dominio XXX
        // Gestão de Domínios e Gestão do Menu
        if (($row['item_id'] == 13) || ($row['item_id'] == 15))
          if ($userDomain != 'XXX')
            continue;

        // Criar seção se não existir
        if (!isset($sectionMap[$sectionId])) {
            $sectionMap[$sectionId] = [
                'id' => $sectionId,
                'code' => $row['section_code'],
                'name' => $row['section_name'],
                'description' => $row['section_description'],
                'icon' => $row['section_icon'],
                'order' => (int)$row['section_order'],
                'items' => []
            ];
        }

        // Adicionar item à seção
        $sectionMap[$sectionId]['items'][] = [
            'id' => (int)$row['item_id'],
            'code' => $row['item_code'],
            'name' => $row['item_name'],
            'description' => $row['item_description'],
            'icon' => $row['item_icon'],
            'route' => $row['route_path'],
            'component' => $row['component_path'],
            'status' => $row['status']
        ];
    }

    pg_free_result($result);

    // Converter map para array
    $sections = array_values($sectionMap);

    // ✅ Log para debug
    error_log('✅ [GET_USER_MENU] Menu carregado: ' . count($sections) . ' seções para user_id=' . $userId . ', domain=' . $userDomain);

    echo json_encode([
        'success' => true,
        'use_mock' => false,
        'sections' => $sections,
        'user' => [
            'id' => $userId,
            'domain' => $userDomain,
            'is_admin' => $isAdmin
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    error_log('❌ [GET_USER_MENU] ERRO: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'use_mock' => true,
        'message' => $e->getMessage(),
        'sections' => getMockMenuSections()
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Retornar menu mock (fallback)
 */
function getMockMenuSections() {
    return [
        [
            'id' => 1,
            'code' => 'dashboards',
            'name' => 'DASHBOARDS',
            'description' => 'PAINÉIS ANALÍTICOS E INDICADORES',
            'icon' => 'BarChart3',
            'order' => 1,
            'items' => [
                [
                    'id' => 1,
                    'code' => 'dashboard-financeiro',
                    'name' => 'Dashboard Financeiro',
                    'description' => 'Visão geral financeira com DRE e indicadores',
                    'icon' => 'TrendingUp',
                    'route' => '/dashboard-financeiro',
                    'component' => '/components/dashboards/DashboardFinanceiro',
                    'status' => 'active'
                ],
                [
                    'id' => 2,
                    'code' => 'dashboard-performance',
                    'name' => 'Dashboard Performance',
                    'description' => 'Análise de performance de entregas',
                    'icon' => 'Zap',
                    'route' => '/dashboard-performance',
                    'component' => '/components/dashboards/DashboardPerformance',
                    'status' => 'active'
                ]
            ]
        ],
        [
            'id' => 2,
            'code' => 'cadastros',
            'name' => 'CADASTROS',
            'description' => 'CADASTROS GERAIS DO SISTEMA',
            'icon' => 'FolderPlus',
            'order' => 2,
            'items' => [
                [
                    'id' => 3,
                    'code' => 'cadastro-eventos',
                    'name' => 'Cadastro de Eventos',
                    'description' => 'Gerenciamento de eventos do sistema',
                    'icon' => 'Calendar',
                    'route' => '/cadastros/eventos',
                    'component' => '/components/cadastros/CadastroEventos',
                    'status' => 'active'
                ],
                [
                    'id' => 4,
                    'code' => 'cadastro-linhas',
                    'name' => 'Cadastro de Linhas',
                    'description' => 'Gerenciamento de linhas de transporte',
                    'icon' => 'Route',
                    'route' => '/cadastros/linhas',
                    'component' => '/components/cadastros/CadastroLinhas',
                    'status' => 'active'
                ]
            ]
        ],
        [
            'id' => 5,
            'code' => 'admin',
            'name' => 'ADMINISTRAÇÃO',
            'description' => 'GESTÃO DE DOMÍNIOS E PERMISSÕES',
            'icon' => 'Settings',
            'order' => 5,
            'items' => [
                [
                    'id' => 8,
                    'code' => 'gestao-dominios',
                    'name' => 'Gestão de Domínios',
                    'description' => 'Administração de domínios/empresas',
                    'icon' => 'Building2',
                    'route' => '/admin/dominios',
                    'component' => '/components/admin/GestaoDominios',
                    'status' => 'active'
                ],
                [
                    'id' => 9,
                    'code' => 'gestao-permissoes',
                    'name' => 'Gestão de Permissões',
                    'description' => 'Controle de permissões de usuários',
                    'icon' => 'Shield',
                    'route' => '/admin/permissoes',
                    'component' => '/components/admin/GestaoPermissoes',
                    'status' => 'active'
                ],
                [
                    'id' => 10,
                    'code' => 'gestao-menu',
                    'name' => 'Gestão do Menu',
                    'description' => 'Configuração da estrutura do menu',
                    'icon' => 'Menu',
                    'route' => '/admin/menu',
                    'component' => '/components/admin/GestaoMenu',
                    'status' => 'active'
                ]
            ]
        ]
    ];
}