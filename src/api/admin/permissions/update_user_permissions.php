<?php
/**
 * API: Atualizar Permissões de um Usuário
 * POST /presto/api/admin/permissions/update_user_permissions.php
 *
 * Body: {
 *   "username": "joao.silva",
 *   "domain": "VCS",
 *   "item_ids": [1, 2, 3, 4, 5]
 * }
 *
 * Atualiza as permissões de acesso de um usuário
 * Apenas usuários ADMIN podem acessar
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

    $currentUsername = $authResult['username'] ?? '';

    // Verificar se é admin
    if (!$isAdmin) {
        msg('ACESSO NEGADO. APENAS ADMINS PODEM ATUALIZAR PERMISSÕES.', 'error', 403);
        exit();
    }

    // Receber dados
    $input = json_decode(file_get_contents('php://input'), true);

    $username = isset($input['username']) ? trim($input['username']) : '';
    $domain = isset($input['domain']) ? strtoupper(trim($input['domain'])) : $userDomain;
    $itemIds = isset($input['item_ids']) ? $input['item_ids'] : [];

    if (empty($username)) {
        msg('USERNAME É OBRIGATÓRIO', 'error', 400);
        exit();
    }

    if (!is_array($itemIds)) {
        msg('ITEM_IDS DEVE SER UM ARRAY', 'error', 400);
        exit();
    }

    // Iniciar transação
    $g_sql = connect();
    sql ($g_sql, 'BEGIN');

    // Buscar ID do usuário
    $queryUser = "SELECT id FROM users WHERE username = $1 AND domain = $2 AND is_active = true";
    $resultUser = sql($g_sql, $queryUser, false, [$username, $domain]);

    if (!$resultUser || pg_num_rows($resultUser) === 0) {
        pg_query($g_sql, 'ROLLBACK');
        msg('USUÁRIO NÃO ENCONTRADO', 'error', 404);
        exit();
    }

    $user = pg_fetch_assoc($resultUser);
    $userId = $user['id'];

    // 1. Remover todas as permissões antigas do usuário
    $deleteQuery = "DELETE FROM user_permissions WHERE user_id = $1";
    $deleteResult = sql($g_sql, $deleteQuery, false, [$userId]);

    if (!$deleteResult) {
        pg_query($g_sql, 'ROLLBACK');
        throw new Exception('Erro ao remover permissões antigas: ' . pg_last_error($g_sql));
    }

    // 2. Inserir novas permissões
    if (!empty($itemIds))
      foreach ($itemIds as $itemId)
        sql ($g_sql, "INSERT INTO user_permissions VALUES ($itemId, $userId, current_date + current_time) ON CONFLICT DO NOTHING");

    // Commit da transação
    sql ($g_sql, 'COMMIT');

    echo json_encode([
        'success' => true,
        'message' => 'PERMISSÕES ATUALIZADAS COM SUCESSO',
        'username' => $username,
        'total_permissions' => count($itemIds)
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao atualizar permissões: " . $e->getMessage());
    msg('ERRO AO ATUALIZAR PERMISSÕES: ' . $e->getMessage(), 'error', 500);
}