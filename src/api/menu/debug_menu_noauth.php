<?php
/**
 * ============================================
 * DEBUG - DIAGNÓSTICO DO MENU (SEM AUTH)
 * ============================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config.php';

try {
    global $g_sql;

    // ⚠️ HARDCODED PARA DEBUG - Alterar conforme necessário
    $userDomain = 'DMN';
    $userId = 1; // Ajustar para o ID do usuário presto no domínio DMN
    $isAdmin = true;

    // ========================================
    // 1. BUSCAR SEÇÃO DE RELATÓRIOS
    // ========================================
    $querySections = "SELECT * FROM menu_sections WHERE code ILIKE '%report%' OR name ILIKE '%RELAT%'";
    $resultSections = sql($g_sql, $querySections);
    $sections = [];
    while ($row = pg_fetch_assoc($resultSections)) {
        $sections[] = $row;
    }

    // ========================================
    // 2. BUSCAR TODOS OS ITENS DE RELATÓRIOS
    // ========================================
    $sectionIds = array_column($sections, 'id');
    $menuItems = [];
    if (!empty($sectionIds)) {
        $sectionIdsStr = implode(',', $sectionIds);
        $queryItems = "SELECT * FROM menu_items WHERE section_id IN ($sectionIdsStr) ORDER BY name";
        $resultItems = sql($g_sql, $queryItems);
        while ($row = pg_fetch_assoc($resultItems)) {
            $menuItems[] = $row;
        }
    }

    // ========================================
    // 3. VERIFICAR domain_menu_items PARA DMN
    // ========================================
    $itemIds = array_column($menuItems, 'id');
    $domainItems = [];
    $domainItemsAll = [];
    if (!empty($itemIds)) {
        $itemIdsStr = implode(',', $itemIds);
        
        // Itens de relatório que estão em domain_menu_items para DMN
        $queryDomain = "SELECT * FROM domain_menu_items WHERE domain = '$userDomain' AND id IN ($itemIdsStr)";
        $resultDomain = sql($g_sql, $queryDomain);
        while ($row = pg_fetch_assoc($resultDomain)) {
            $domainItems[] = $row;
        }
        
        // TODOS os itens de DMN (para ver o que tem)
        $queryDomainAll = "SELECT dmi.*, mi.name, mi.code, mi.section_id 
                           FROM domain_menu_items dmi 
                           LEFT JOIN menu_items mi ON mi.id = dmi.id 
                           WHERE domain = '$userDomain' 
                           ORDER BY dmi.id";
        $resultDomainAll = sql($g_sql, $queryDomainAll);
        while ($row = pg_fetch_assoc($resultDomainAll)) {
            $domainItemsAll[] = $row;
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
    // 5. TESTAR A QUERY ORIGINAL COM FILTRO DE RELATÓRIOS
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
                 AND (ms.code ILIKE '%report%' OR ms.name ILIKE '%RELAT%')
                 AND (up.id IS NOT NULL OR '$isAdmin' = '1')
               ORDER BY ms.display_order ASC, mi.name ASC";
    
    $resultOriginal = sql($g_sql, $queryOriginal);
    $queryResults = [];
    while ($row = pg_fetch_assoc($resultOriginal)) {
        $queryResults[] = $row;
    }

    // ========================================
    // 6. TESTAR SEM A CONDIÇÃO DE PERMISSÃO (só admin)
    // ========================================
    $queryNoPermCheck = "SELECT DISTINCT ms.id as section_id, ms.code as section_code, ms.name as section_name,
                              ms.description as section_description, ms.display_order as section_order,
                              mi.id as item_id, mi.code as item_code, mi.name as item_name
                FROM menu_sections ms
               INNER JOIN menu_items mi ON mi.section_id = ms.id
               INNER JOIN domain_menu_items dmi ON dmi.id = mi.id AND dmi.domain = '$userDomain'
               WHERE ms.is_active = TRUE
                 AND mi.is_available = TRUE
                 AND (ms.code ILIKE '%report%' OR ms.name ILIKE '%RELAT%')
               ORDER BY ms.display_order ASC, mi.name ASC";
    
    $resultNoPermCheck = sql($g_sql, $queryNoPermCheck);
    $queryNoPermCheckResults = [];
    while ($row = pg_fetch_assoc($resultNoPermCheck)) {
        $queryNoPermCheckResults[] = $row;
    }

    // ========================================
    // RESPOSTA
    // ========================================
    echo json_encode([
        'success' => true,
        'debug_params' => [
            'user_id' => $userId,
            'domain' => $userDomain,
            'is_admin' => $isAdmin
        ],
        'sections_found' => count($sections),
        'sections' => $sections,
        'menu_items_total' => count($menuItems),
        'menu_items' => $menuItems,
        'domain_items_for_reports' => count($domainItems),
        'domain_items_reports' => $domainItems,
        'all_domain_items_count' => count($domainItemsAll),
        'all_domain_items' => $domainItemsAll,
        'user_permissions_count' => count($userPermissions),
        'user_permissions' => $userPermissions,
        'query_with_permissions_count' => count($queryResults),
        'query_with_permissions' => $queryResults,
        'query_no_perm_check_count' => count($queryNoPermCheckResults),
        'query_no_perm_check' => $queryNoPermCheckResults
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
}