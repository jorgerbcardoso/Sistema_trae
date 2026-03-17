<?php
/**
 * ============================================
 * API - GET MENU WITH PERMISSIONS
 * ============================================
 * Endpoint: GET /api/menu/get_with_permissions.php
 */

require_once __DIR__ . '/../config.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Content-Type: application/json');

// Handle preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Apenas GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

try {
    // ============================================
    // OBTER E VALIDAR TOKEN
    // ============================================
    
    $token = null;
    
    // Método 1: getallheaders() (Apache)
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $token = $headers['authorization'];
        }
    }
    
    // Método 2: $_SERVER (Nginx e outros)
    if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    // Método 3: apache_request_headers()
    if (!$token && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    }
    
    // Remover "Bearer " do token se existir
    if ($token) {
        $token = str_replace('Bearer ', '', $token);
    }
    
    // ✅ VALIDAR TOKEN E BUSCAR USUÁRIO
    if (empty($token)) {
        throw new Exception('Token não fornecido');
    }
    
    // Buscar usuário pelo token
    requireAuth();
    $currentUser = getCurrentUser();
    
    $userDomain = $currentUser['domain'];
    $username = strtolower($currentUser['username']);
    $isAdmin = $currentUser['is_admin'];
    
    // 🔥 REGRA ESPECIAL: Usuário "presto" SEMPRE é admin (independente do campo no banco)
    if ($username === 'presto') {
        $isAdmin = true;
    }
    
    // 🔍 DEBUG: Logar informações do usuário
    error_log("=== MENU DEBUG ===");
    error_log("Domínio: " . $userDomain);
    error_log("Usuário: " . $username);
    error_log("Is Admin: " . ($isAdmin ? 'true' : 'false'));
    error_log("Is Super Admin: " . ($currentUser['is_super_admin'] ? 'true' : 'false'));
    error_log("================");
    
    // ========================================
    // BUSCAR MENU DO BANCO DE DADOS
    // ========================================
    
    global $g_sql;
    
    // Buscar seções ativas ordenadas
    $querySections = "
        SELECT id, code, name, description, icon, display_order 
        FROM menu_section 
        WHERE is_active = true 
        ORDER BY display_order
    ";
    
    $resultSections = sql($querySections, [], $g_sql);
    $menu = [];
    
    while ($section = pg_fetch_assoc($resultSections)) {
        $sectionId = $section['id'];
        
        // Buscar itens desta seção com permissões do usuário
        $queryItems = "
            SELECT 
                mi.id,
                mi.code,
                mi.name,
                mi.description,
                mi.icon,
                mi.route_path,
                mi.component_path,
                mi.is_available,
                mi.status,
                mi.display_order,
                COALESCE(p.can_access, false) as can_access,
                COALESCE(p.can_create, false) as can_create,
                COALESCE(p.can_edit, false) as can_edit,
                COALESCE(p.can_delete, false) as can_delete,
                COALESCE(p.can_export, false) as can_export
            FROM menu_item mi
            LEFT JOIN domain_permissions p ON mi.id = p.menu_item_id AND p.domain = $1
            WHERE mi.section_id = $2 
              AND mi.is_active = true
            ORDER BY mi.display_order
        ";
        
        $resultItems = sql($queryItems, [$userDomain, $sectionId], $g_sql);
        $items = [];
        
        while ($item = pg_fetch_assoc($resultItems)) {
            // Incluir apenas itens que o usuário tem permissão de acessar
            if ($item['can_access']) {
                $items[] = [
                    'id' => (int)$item['id'],
                    'code' => $item['code'],
                    'name' => $item['name'],
                    'description' => $item['description'],
                    'icon' => $item['icon'],
                    'route_path' => $item['route_path'],
                    'component_path' => $item['component_path'],
                    'is_available' => $item['is_available'] === 't',
                    'status' => $item['status'],
                    'permissions' => [
                        'can_access' => $item['can_access'] === 't',
                        'can_create' => $item['can_create'] === 't',
                        'can_edit' => $item['can_edit'] === 't',
                        'can_delete' => $item['can_delete'] === 't',
                        'can_export' => $item['can_export'] === 't'
                    ]
                ];
            }
        }
        
        // Incluir seção apenas se tiver itens visíveis
        if (!empty($items)) {
            $menu[] = [
                'section' => [
                    'id' => (int)$section['id'],
                    'code' => $section['code'],
                    'name' => $section['name'],
                    'description' => $section['description'],
                    'icon' => $section['icon'],
                    'display_order' => (int)$section['display_order']
                ],
                'items' => $items
            ];
        }
    }
    
    // Resposta de sucesso
    echo json_encode([
        'success' => true,
        'menu' => $menu,
        'message' => '✅ Menu carregado do banco de dados com permissões'
    ]);
    
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}