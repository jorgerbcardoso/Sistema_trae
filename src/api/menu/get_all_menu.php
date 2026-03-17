<?php
/**
 * ================================================================
 * API: BUSCAR TODAS AS SEÇÕES E ITENS DO MENU
 * ================================================================
 * Endpoint: /api/menu/get_all_menu.php
 * Método: GET
 * Retorna: Todas as seções com seus respectivos itens
 * ================================================================
 */

require_once '../config.php';

// ✅ Headers automáticos já são enviados pelo frontend via getDefaultHeaders()
// X-Domain, X-Unidade, Authorization

setupCORS();
handleOptionsRequest();

try {
    // ✅ PADRÃO OFICIAL: Usar global $g_sql
    global $g_sql;
    
    // 1. Buscar todas as seções
    $sqlSections = "
        SELECT 
            id,
            code,
            name,
            description,
            icon,
            display_order,
            is_active
        FROM menu_sections
        ORDER BY display_order, id
    ";
    
    // ✅ PADRÃO OFICIAL: sql($query, $params, $conn)
    $resultSections = sql($sqlSections, [], $g_sql);
    $sections = pg_fetch_all($resultSections);
    
    if (!$sections) {
        $sections = [];
    }
    
    // 2. Buscar todos os itens de menu
    $sqlItems = "
        SELECT 
            id,
            section_id,
            code,
            name,
            description,
            icon,
            route_path,
            component_path,
            is_available,
            ordem,
            status
        FROM menu_items
        ORDER BY section_id, ordem, id
    ";
    
    // ✅ PADRÃO OFICIAL: sql($query, $params, $conn)
    $resultItems = sql($sqlItems, [], $g_sql);
    $items = pg_fetch_all($resultItems);
    
    if (!$items) {
        $items = [];
    }
    
    // Organizar itens por seção
    $menuData = [];
    
    foreach ($sections as $section) {
        $sectionItems = array_filter($items, function($item) use ($section) {
            return $item['section_id'] == $section['id'];
        });
        
        // Converter valores booleanos
        $section['is_active'] = pgBoolToPHP($section['is_active']);
        
        $menuData[] = [
            'section' => [
                'id' => (int)$section['id'],
                'code' => $section['code'],
                'name' => $section['name'],
                'description' => $section['description'],
                'icon' => $section['icon'],
                'display_order' => (int)$section['display_order'],
                'is_active' => $section['is_active']
            ],
            'items' => array_values(array_map(function($item) {
                return [
                    'id' => (int)$item['id'],
                    'section_id' => (int)$item['section_id'],
                    'code' => $item['code'],
                    'name' => $item['name'],
                    'description' => $item['description'],
                    'icon' => $item['icon'],
                    'route_path' => $item['route_path'],
                    'component_path' => $item['component_path'],
                    'is_available' => pgBoolToPHP($item['is_available']),
                    'ordem' => (int)$item['ordem'],
                    'status' => $item['status']
                ];
            }, $sectionItems))
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $menuData
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar menu: ' . $e->getMessage()
    ]);
}