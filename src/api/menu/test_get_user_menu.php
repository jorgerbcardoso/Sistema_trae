<?php
/**
 * ============================================
 * TESTE - get_user_menu.php COM DEBUG COMPLETO
 * ============================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config.php';

try {
    global $g_sql;

    // ⚠️ HARDCODED PARA DEBUG
    $userDomain = 'DMN';
    $userId = 1; // ID do usuário presto no domínio DMN
    $isAdmin = true;
    $username = 'presto';

    // ✅ QUERY EXATA que está em get_user_menu.php
    $query = "SELECT DISTINCT ms.id as section_id, ms.code as section_code, ms.name as section_name,
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
                 AND (up.id IS NOT NULL OR '$isAdmin' = '1')
               ORDER BY ms.display_order ASC, mi.name ASC";

    $result = sql($g_sql, $query);

    // ✅ Organizar resultado (MESMO CÓDIGO DO get_user_menu.php)
    $sections = [];
    $sectionMap = [];
    $allRows = []; // Para debug

    while ($row = pg_fetch_assoc($result)) {
        $allRows[] = $row; // Debug
        $sectionId = (int)$row['section_id'];

        // Apenas Admins podem ver itens de administracao
        if (($row['section_code'] == 'admin') && (!$isAdmin))
          continue;

        // Itens que só podem ser visualizados no dominio XXX
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

    $sections = array_values($sectionMap);

    // ✅ Filtrar apenas seção de RELATÓRIOS para análise
    $relatoriosSection = null;
    foreach ($sections as $section) {
        if ($section['code'] === 'relatorios') {
            $relatoriosSection = $section;
            break;
        }
    }

    echo json_encode([
        'success' => true,
        'debug_params' => [
            'user_id' => $userId,
            'domain' => $userDomain,
            'is_admin' => $isAdmin,
            'username' => $username
        ],
        'total_rows_from_query' => count($allRows),
        'all_rows' => $allRows,
        'total_sections' => count($sections),
        'all_sections' => $sections,
        'relatorios_section' => $relatoriosSection,
        'relatorios_items_count' => $relatoriosSection ? count($relatoriosSection['items']) : 0
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
}
