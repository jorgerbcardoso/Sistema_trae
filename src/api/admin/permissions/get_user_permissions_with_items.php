<?php
/**
 * API: Buscar Itens de Menu com Permissões do Usuário
 * GET /presto/api/admin/permissions/get_user_permissions_with_items.php?username=joao.silva&domain=VCS
 *
 * Retorna TODOS os menu_items disponíveis para o domínio
 * com indicação de quais o usuário tem marcado
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

    // Receber parâmetros
    $username = isset($_GET['username']) ? trim($_GET['username']) : '';
    $domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : $userDomain;

    if (empty($username)) {
        msg('USERNAME É OBRIGATÓRIO', 'error', 400);
        exit();
    }

    // ✅ Conectar ao banco
    $g_sql = connect();

    // Buscar ID do usuário
    $queryUser = "SELECT id FROM users WHERE username = $1 AND domain = $2 AND is_active = true";
    $resultUser = sql($g_sql, $queryUser, false, [$username, $domain]);

    if (!$resultUser || pg_num_rows($resultUser) === 0) {
        msg('USUÁRIO NÃO ENCONTRADO', 'error', 404);
        exit();
    }

    $user = pg_fetch_assoc($resultUser);
    $userId = $user['id'];

    // Buscar todos os menu_items disponíveis para o domínio
    // com LEFT JOIN para saber quais o usuário tem permissão
    $query = "
        SELECT
            mi.id,
            mi.name,
            mi.description,
            mi.created_at,
            CASE
                WHEN up.user_id IS NOT NULL THEN true
                ELSE false
            END as has_permission
        FROM menu_items mi
        INNER JOIN domain_menu_items dmi ON dmi.menu_item_id = mi.id
        LEFT OUTER JOIN user_permissions up ON (up.user_id = $1 AND up.menu_item_id = mi.id)
        WHERE dmi.domain = $2
            AND mi.is_available = true
            AND mi.status = 'active'
        ORDER BY mi.id
    ";

    $result = sql($g_sql, $query, false, [$userId, $domain]);

    if (!$result) {
        throw new Exception('Erro ao buscar itens: ' . pg_last_error($g_sql));
    }

    $items = [];
    $selectedIds = [];

    while ($row = pg_fetch_assoc($result)) {
        $hasPermission = pgBoolToPHP($row['has_permission']);

        $items[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'created_at' => $row['created_at'],
            'has_permission' => $hasPermission
        ];

        if ($hasPermission) {
            $selectedIds[] = (int)$row['id'];
        }
    }

    echo json_encode([
        'success' => true,
        'username' => $username,
        'items' => $items,
        'selected_ids' => $selectedIds
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao buscar permissões do usuário: " . $e->getMessage());
    msg('ERRO AO BUSCAR PERMISSÕES DO USUÁRIO: ' . $e->getMessage(), 'error', 500);
}