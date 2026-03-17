<?php
/**
 * API: Buscar Permissões de um Domínio
 * GET /presto/api/admin/permissions/get_domain_permissions.php?domain=CRZ
 *
 * Retorna todas as permissões de um domínio específico
 * Apenas usuários do domínio XXX podem acessar
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../Database.php';

try {
    // Verificar autenticação
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => $authResult['message']
        ]);
        exit();
    }

    $domain = $authResult['domain'];

    // Verificar se é super admin
    if ($domain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE GERENCIAR PERMISSÕES.'
        ]);
        exit();
    }

    // Receber domínio
    $targetDomain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : '';

    if (empty($targetDomain)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'DOMÍNIO É OBRIGATÓRIO'
        ]);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();

    // Buscar todas as funcionalidades com permissões do domínio
    $query = "
        SELECT
            ms.code as section_code,
            ms.name as section_name,
            mi.id as item_id,
            mi.code as item_code,
            mi.name as item_name,
            mi.icon,
            COALESCE(p.can_access, false) as can_access,
            COALESCE(p.can_create, false) as can_create,
            COALESCE(p.can_edit, false) as can_edit,
            COALESCE(p.can_delete, false) as can_delete,
            COALESCE(p.can_export, false) as can_export
        FROM menu_items mi
        JOIN menu_sections ms ON mi.section_id = ms.id
        LEFT JOIN permissions p ON mi.id = p.menu_item_id AND p.domain = $1
        WHERE ms.code != 'admin'
        ORDER BY ms.display_order, mi.display_order
    ";

    $result = pg_query_params($db, $query, [$targetDomain]);

    if (!$result) {
        throw new Exception('Erro ao buscar permissões');
    }

    // Agrupar por seção
    $permissions = [];
    while ($item = pg_fetch_assoc($result)) {
        $sectionCode = $item['section_code'];

        if (!isset($permissions[$sectionCode])) {
            $permissions[$sectionCode] = [
                'section_name' => $item['section_name'],
                'items' => []
            ];
        }

        $permissions[$sectionCode]['items'][] = [
            'item_id' => (int)$item['item_id'],
            'item_code' => $item['item_code'],
            'item_name' => $item['item_name'],
            'icon' => $item['icon'],
            'permissions' => [
                'can_access' => $item['can_access'] === 't' || $item['can_access'] === true,
                'can_create' => $item['can_create'] === 't' || $item['can_create'] === true,
                'can_edit' => $item['can_edit'] === 't' || $item['can_edit'] === true,
                'can_delete' => $item['can_delete'] === 't' || $item['can_delete'] === true,
                'can_export' => $item['can_export'] === 't' || $item['can_export'] === true
            ]
        ];
    }

    echo json_encode([
        'success' => true,
        'domain' => $targetDomain,
        'permissions' => $permissions
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao buscar permissões: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO BUSCAR PERMISSÕES',
        'error' => $e->getMessage()
    ]);
}