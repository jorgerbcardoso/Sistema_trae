<?php
/**
 * API: Buscar Itens de Menu Disponíveis para o Domínio (Agrupados por Seção)
 * GET /presto/api/admin/permissions/get_available_items.php?domain=VCS
 *
 * Retorna os itens de menu que estão liberados para o domínio (domain_menu_items)
 * organizados por seções
 * Apenas usuários ADMIN podem acessar
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../middleware/auth.php';

try {
    // Verificar autenticação
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        msg($authResult['message'], 'error', 401);
        exit();
    }

    $userDomain = $authResult['domain'];
    $isAdmin = $authResult['is_admin'] ?? false;

    // Verificar se é admin
    if (!$isAdmin) {
        msg('ACESSO NEGADO. APENAS ADMINS PODEM ACESSAR.', 'error', 403);
        exit();
    }

    // Receber domínio
    $domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : $userDomain;

    // ✅ Conectar ao banco
    $g_sql = connect();

    // Buscar itens de menu disponíveis para o domínio
    // (itens que estão em domain_menu_items para este domínio)
    $query = "SELECT 
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
              INNER JOIN domain_menu_items dmi ON dmi.id = mi.id
              INNER JOIN menu_sections ms ON mi.section_id = ms.id
              WHERE dmi.domain = $1
                AND mi.is_available = true
                AND mi.status = 'active'
              ORDER BY ms.display_order, mi.id";

    $result = sql($g_sql, $query, false, [$domain]);

    if (!$result) {
        throw new Exception('Erro ao buscar itens: ' . pg_last_error($g_sql));
    }

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
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao buscar itens: " . $e->getMessage());
    msg('ERRO AO BUSCAR ITENS: ' . $e->getMessage(), 'error', 500);
}