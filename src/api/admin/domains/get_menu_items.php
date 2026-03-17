<?php
/**
 * API: Listar Itens de Menu Ativos Agrupados por Seção
 * GET /api/admin/domains/get_menu_items.php
 * 
 * Retorna todos os itens de menu com status 'active' organizados por seções
 * Apenas usuários do domínio XXX podem acessar
 */

require_once __DIR__ . '/../../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('GET');

try {
    // Obter usuário autenticado
    $user = getCurrentUser();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'NÃO AUTENTICADO'
        ]);
        exit();
    }

    $domain = $user['domain'];

    // Verificar se é super admin (domínio XXX)
    if ($domain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE ACESSAR.'
        ]);
        exit();
    }

    // ✅ PADRÃO OFICIAL: Usar global $g_sql
    global $g_sql;

    // Buscar itens de menu ativos
    $query = "
        SELECT 
            mi.id,
            mi.section_id,
            mi.code,
            mi.name,
            mi.description,
            mi.icon,
            mi.created_at,
            ms.code as section_code,
            ms.name as section_name,
            ms.description as section_description,
            ms.icon as section_icon,
            ms.display_order as section_order
        FROM menu_items mi
        INNER JOIN menu_sections ms ON mi.section_id = ms.id
        WHERE mi.status = 'active'
        ORDER BY ms.display_order, mi.id
    ";
    
    // ✅ PADRÃO OFICIAL: sql($query, $params, $conn)
    $result = sql($query, [], $g_sql);
    
    // Agrupar itens por seção
    $sections_map = [];
    while ($row = pg_fetch_assoc($result)) {
        $section_id = (int)$row['section_id'];
        
        // Criar seção se não existe
        if (!isset($sections_map[$section_id])) {
            $sections_map[$section_id] = [
                'id' => $section_id,
                'code' => $row['section_code'],
                'name' => $row['section_name'],
                'description' => $row['section_description'],
                'icon' => $row['section_icon'],
                'display_order' => (int)$row['section_order'],
                'items' => []
            ];
        }
        
        // Adicionar item à seção
        $sections_map[$section_id]['items'][] = [
            'id' => (int)$row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'description' => $row['description'],
            'icon' => $row['icon'],
            'section_id' => $section_id,
            'section_code' => $row['section_code'],
            'section_name' => $row['section_name'],
            'section_icon' => $row['section_icon'],
            'created_at' => $row['created_at']
        ];
    }
    
    // Converter para array indexado e ordenar por display_order
    $sections = array_values($sections_map);
    usort($sections, function($a, $b) {
        return $a['display_order'] - $b['display_order'];
    });

    echo json_encode([
        'success' => true,
        'sections' => $sections,
        'total' => count($sections)
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao listar itens de menu: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO LISTAR ITENS DE MENU',
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
