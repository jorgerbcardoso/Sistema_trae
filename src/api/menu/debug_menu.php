<?php
/**
 * ============================================
 * DEBUG - DIAGNÓSTICO DO MENU
 * ============================================
 * 
 * Retorna informações detalhadas sobre:
 * 1. Itens cadastrados em menu_items (seção RELATÓRIOS)
 * 2. Itens disponíveis em domain_menu_items para o domínio
 * 3. Permissões do usuário em user_permissions
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
        echo json_encode(['error' => $authResult['message']]);
        exit();
    }

    $userDomain = $authResult['domain'];
    $userId = $authResult['user_id'] ?? 0;
    $username = $authResult['username'] ?? '';
    $isAdmin = $authResult['is_admin'] ?? false;

    global $g_sql;

    // ========================================
    // 1. BUSCAR SEÇÃO DE RELATÓRIOS
    // ========================================
    $querySections = "SELECT * FROM menu_sections WHERE code = 'reports' OR name ILIKE '%RELAT%'";
    $resultSections = sql($g_sql, $querySections);
    $sections = [];
    while ($row = pg_fetch_assoc($resultSections)) {
        $sections[] = $row;
    }

    // ========================================
    // 2. BUSCAR ITENS DA SEÇÃO RELATÓRIOS
    // ========================================
    $sectionIds = array_column($sections, 'id');
    $sectionIdsStr = implode(',', $sectionIds);
    
    $queryItems = "SELECT * FROM menu_items WHERE section_id IN ($sectionIdsStr) ORDER BY name";
    $resultItems = sql($g_sql, $queryItems);
    $menuItems = [];
    while ($row = pg_fetch_assoc($resultItems)) {
        $menuItems[] = $row;
    }

    // ========================================
    // 3. VERIFICAR domain_menu_items
    // ========================================
    $itemIds = array_column($menuItems, 'id');
    $domainItems = [];
    if (!empty($itemIds)) {
        $itemIdsStr = implode(',', $itemIds);
        $queryDomain = "SELECT * FROM domain_menu_items WHERE domain = '$userDomain' AND id IN ($itemIdsStr)";
        $resultDomain = sql($g_sql, $queryDomain);
        while ($row = pg_fetch_assoc($resultDomain)) {
            $domainItems[] = $row;
        }
    }

    // ========================================
    // 4. VERIFICAR user_permissions
    // ========================================
    $userPermissions = [];
    if (!empty($itemIds)) {
        $itemIdsStr = implode(',', $itemIds);
        $queryPerms = "SELECT * FROM user_permissions WHERE user_id = '$userId' AND id IN ($itemIdsStr)";
        $resultPerms = sql($g_sql, $queryPerms);
        while ($row = pg_fetch_assoc($resultPerms)) {
            $userPermissions[] = $row;
        }
    }

    // ========================================
    // 5. TESTAR A QUERY ORIGINAL
    // ========================================
    $queryOriginal = "SELECT DISTINCT ms.id as section_id, ms.code as section_code, ms.name as section_name,
                              ms.description as section_description, ms.icon as section_icon,
                              ms.display_order as section_order, mi.id as item_id,
                              mi.code as item_code, mi.name as item_name,
                              mi.description as item_description, mi.icon as item_icon,
                              mi.route_path, mi.component_path, mi.status
                FROM menu_sections ms
               INNER JOIN menu_items mi ON mi.section_id = ms.id
               INNER JOIN domain_menu_items dmi ON dmi.id = mi.id AND dmi.domain = '$userDomain'
                LEFT JOIN user_permissions up ON up.id = mi.id AND up.user_id = '$userId'
               WHERE ms.is_active = TRUE
                 AND mi.is_available = TRUE
                 AND (ms.code = 'reports' OR ms.name ILIKE '%RELAT%')
                 AND (up.id IS NOT NULL OR '$isAdmin' = '1')
               ORDER BY ms.display_order ASC, mi.name ASC";
    
    $resultOriginal = sql($g_sql, $queryOriginal);
    $queryResults = [];
    while ($row = pg_fetch_assoc($resultOriginal)) {
        $queryResults[] = $row;
    }

    // ========================================
    // RESPOSTA
    // ========================================
    echo json_encode([
        'success' => true,
        'user_info' => [
            'user_id' => $userId,
            'username' => $username,
            'domain' => $userDomain,
            'is_admin' => $isAdmin
        ],
        'sections' => $sections,
        'menu_items_count' => count($menuItems),
        'menu_items' => $menuItems,
        'domain_items_count' => count($domainItems),
        'domain_items' => $domainItems,
        'user_permissions_count' => count($userPermissions),
        'user_permissions' => $userPermissions,
        'query_results_count' => count($queryResults),
        'query_results' => $queryResults
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
