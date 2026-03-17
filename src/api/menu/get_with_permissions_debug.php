<?php
/**
 * ============================================
 * DEBUG VERSION - Menu API
 * ============================================
 * Use este arquivo temporariamente para debug
 */

// Headers CORS permissivos
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Log de debug
error_log("==================== DEBUG MENU API ====================");
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
error_log("REQUEST_URI: " . $_SERVER['REQUEST_URI']);

// Tentar pegar o token de todas as formas possíveis
$debug_info = [
    'headers_getallheaders' => function_exists('getallheaders') ? getallheaders() : 'não disponível',
    'server_http_authorization' => $_SERVER['HTTP_AUTHORIZATION'] ?? 'não disponível',
    'all_server_vars' => array_filter($_SERVER, function($key) {
        return strpos($key, 'HTTP_') === 0 || strpos($key, 'AUTH') !== false;
    }, ARRAY_FILTER_USE_KEY)
];

error_log("DEBUG INFO: " . json_encode($debug_info, JSON_PRETTY_PRINT));

// Versão simplificada - NÃO VALIDA TOKEN (apenas para debug)
$mockMenu = [
    'sections' => [
        [
            'code' => 'dashboards',
            'name' => 'DASHBOARDS',
            'icon' => 'BarChart3',
            'items' => [
                [
                    'id' => 1,
                    'code' => 'dashboard_dre',
                    'name' => 'DASHBOARD FINANCEIRO',
                    'description' => 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO',
                    'icon' => 'TrendingUp',
                    'route_path' => '/financeiro/dashboard',
                    'component_path' => 'dashboards/FinanceiroDashboard',
                    'is_available' => true,
                    'status' => 'active',
                    'permissions' => [
                        'can_access' => true,
                        'can_create' => false,
                        'can_edit' => false,
                        'can_delete' => false,
                        'can_export' => true
                    ]
                ],
                [
                    'id' => 2,
                    'code' => 'dashboard_performance_entregas',
                    'name' => 'PERFORMANCE DE ENTREGAS',
                    'description' => 'ANÁLISE DE ENTREGAS E PRAZOS',
                    'icon' => 'Truck',
                    'route_path' => '/dashboards/performance-entregas',
                    'component_path' => 'dashboards/PerformanceEntregas',
                    'is_available' => false,
                    'status' => 'development',
                    'permissions' => [
                        'can_access' => false,
                        'can_create' => false,
                        'can_edit' => false,
                        'can_delete' => false,
                        'can_export' => false
                    ]
                ]
            ]
        ],
        [
            'code' => 'operations',
            'name' => 'OPERAÇÕES',
            'icon' => 'Package',
            'items' => [
                [
                    'id' => 6,
                    'code' => 'op_linhas',
                    'name' => 'CADASTRO DE LINHAS',
                    'description' => 'GERENCIAR LINHAS DE TRANSPORTE',
                    'icon' => 'Route',
                    'route_path' => '/operacoes/linhas',
                    'component_path' => 'operations/CadastroLinhas',
                    'is_available' => false,
                    'status' => 'development',
                    'permissions' => [
                        'can_access' => false,
                        'can_create' => false,
                        'can_edit' => false,
                        'can_delete' => false,
                        'can_export' => false
                    ]
                ],
                [
                    'id' => 7,
                    'code' => 'op_veiculos',
                    'name' => 'CADASTRO DE VEÍCULOS',
                    'description' => 'GERENCIAR FROTA DE VEÍCULOS',
                    'icon' => 'Truck',
                    'route_path' => '/operacoes/veiculos',
                    'component_path' => 'operations/CadastroVeiculos',
                    'is_available' => false,
                    'status' => 'development',
                    'permissions' => [
                        'can_access' => false,
                        'can_create' => false,
                        'can_edit' => false,
                        'can_delete' => false,
                        'can_export' => false
                    ]
                ]
            ]
        ],
        [
            'code' => 'reports',
            'name' => 'RELATÓRIOS',
            'icon' => 'FileText',
            'items' => [
                [
                    'id' => 11,
                    'code' => 'rel_disponiveis',
                    'name' => 'RELAÇÃO DE DISPONÍVEIS',
                    'description' => 'VEÍCULOS E MOTORISTAS DISPONÍVEIS',
                    'icon' => 'CheckSquare',
                    'route_path' => '/relatorios/disponiveis',
                    'component_path' => 'reports/RelacaoDisponiveis',
                    'is_available' => false,
                    'status' => 'development',
                    'permissions' => [
                        'can_access' => false,
                        'can_create' => false,
                        'can_edit' => false,
                        'can_delete' => false,
                        'can_export' => false
                    ]
                ]
            ]
        ],
        [
            'code' => 'admin',
            'name' => 'ADMINISTRAÇÃO',
            'icon' => 'Settings',
            'items' => [
                [
                    'id' => 15,
                    'code' => 'admin_usuarios',
                    'name' => 'GESTÃO DE USUÁRIOS',
                    'description' => 'GERENCIAR USUÁRIOS DO SISTEMA',
                    'icon' => 'UserPlus',
                    'route_path' => '/cadastros/usuarios',
                    'component_path' => 'UserManagement',
                    'is_available' => true,
                    'status' => 'active',
                    'permissions' => [
                        'can_access' => true,
                        'can_create' => true,
                        'can_edit' => true,
                        'can_delete' => true,
                        'can_export' => false
                    ]
                ],
                [
                    'id' => 16,
                    'code' => 'admin_dominios',
                    'name' => 'GESTÃO DE DOMÍNIOS',
                    'description' => 'GERENCIAR DOMÍNIOS E MODALIDADES',
                    'icon' => 'Building2',
                    'route_path' => '/admin/dominios',
                    'component_path' => 'admin/GestaoDominios',
                    'is_available' => true,
                    'status' => 'active',
                    'permissions' => [
                        'can_access' => true,
                        'can_create' => true,
                        'can_edit' => true,
                        'can_delete' => true,
                        'can_export' => false
                    ]
                ],
                [
                    'id' => 17,
                    'code' => 'admin_permissoes',
                    'name' => 'GESTÃO DE PERMISSÕES',
                    'description' => 'DEFINIR PERMISSÕES DE ACESSO POR DOMÍNIO',
                    'icon' => 'Shield',
                    'route_path' => '/admin/permissoes',
                    'component_path' => 'admin/GestaoPermissoes',
                    'is_available' => true,
                    'status' => 'active',
                    'permissions' => [
                        'can_access' => false,
                        'can_edit' => true,
                        'can_delete' => false,
                        'can_export' => false
                    ]
                ]
            ]
        ]
    ]
];

echo json_encode([
    'success' => true,
    'menu' => $mockMenu,
    'message' => '⚠️ DEBUG MODE - SEM VALIDAÇÃO DE TOKEN',
    'debug' => $debug_info
]);
