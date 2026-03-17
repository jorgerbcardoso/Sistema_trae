<?php
/**
 * API: Buscar Permissões de um Usuário
 * GET /presto/api/admin/permissions/get_user_permissions.php?username=joao.silva&domain=VCS
 *
 * Retorna os IDs dos menu_items que o usuário tem permissão de acessar
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

    // Buscar permissões do usuário
    // A tabela user_permissions relaciona user_id com menu_item_id
    $query = "SELECT DISTINCT up.id
                FROM user_permissions up
               WHERE up.user_id = $1
               ORDER BY up.id";

    $result = sql($g_sql, $query, false, [$userId]);

    if (!$result) {
        throw new Exception('Erro ao buscar permissões: ' . pg_last_error($g_sql));
    }

    $itemIds = [];
    while ($row = pg_fetch_assoc($result)) {
        $itemIds[] = (int)$row['id'];
    }

    echo json_encode([
        'success' => true,
        'username' => $username,
        'item_ids' => $itemIds
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao buscar permissões do usuário: " . $e->getMessage());
    msg('ERRO AO BUSCAR PERMISSÕES DO USUÁRIO: ' . $e->getMessage(), 'error', 500);
}