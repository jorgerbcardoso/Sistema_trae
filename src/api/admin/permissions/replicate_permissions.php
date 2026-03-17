<?php
/**
 * API: Replicar Permissões para Múltiplos Usuários
 * POST /presto/api/admin/permissions/replicate_permissions.php
 *
 * Body: {
 *   "from_username": "joao.silva",
 *   "to_usernames": ["maria.santos", "carlos.oliveira"],
 *   "domain": "VCS",
 *   "item_ids": [1, 2, 3, 4, 5]
 * }
 *
 * Replica as permissões de um usuário para múltiplos usuários
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

    // Verificar se é admin
    if (!$isAdmin) {
        msg('ACESSO NEGADO. APENAS ADMINS PODEM REPLICAR PERMISSÕES.', 'error', 403);
        exit();
    }

    // Receber dados
    $input = json_decode(file_get_contents('php://input'), true);

    $fromUsername = isset($input['from_username']) ? trim($input['from_username']) : '';
    $toUsernames = isset($input['to_usernames']) ? $input['to_usernames'] : [];
    $domain = isset($input['domain']) ? strtoupper(trim($input['domain'])) : $userDomain;
    $itemIds = isset($input['item_ids']) ? $input['item_ids'] : [];

    if (empty($fromUsername)) {
        msg('FROM_USERNAME É OBRIGATÓRIO', 'error', 400);
        exit();
    }

    if (!is_array($toUsernames) || empty($toUsernames)) {
        msg('TO_USERNAMES DEVE SER UM ARRAY NÃO VAZIO', 'error', 400);
        exit();
    }

    if (!is_array($itemIds)) {
        msg('ITEM_IDS DEVE SER UM ARRAY', 'error', 400);
        exit();
    }

    // ✅ Conectar ao banco
    $g_sql = connect();

    // Iniciar transação
    sql ($g_sql, 'BEGIN');

    $successCount = 0;
    $errors = [];

    // Para cada usuário destino, replicar as permissões
    foreach ($toUsernames as $toUsername) {
        try {
            // 🔒 REGRA CRÍTICA: NÃO permitir replicar para o usuário "presto"
            if ($toUsername === 'presto') {
                $errors[] = "Não é permitido replicar permissões para o usuário PRESTO";
                continue;
            }
            
            // Buscar ID do usuário destino
            $queryUser = "SELECT id FROM users WHERE username = $1 AND domain = $2 AND is_active = true";
            $resultUser = sql($g_sql, $queryUser, false, [$toUsername, $domain]);

            if (!$resultUser || pg_num_rows($resultUser) === 0) {
                $errors[] = "Usuário $toUsername não encontrado";
                continue;
            }

            $user = pg_fetch_assoc($resultUser);
            $userId = $user['id'];

            // 1. Remover todas as permissões antigas do usuário
            $deleteQuery = "DELETE FROM user_permissions WHERE user_id = $1";
            $deleteResult = sql($g_sql, $deleteQuery, false, [$userId]);

            if (!$deleteResult) {
                $errors[] = "Erro ao remover permissões de $toUsername";
                continue;
            }

            // 2. Inserir novas permissões
            if (!empty($itemIds))
              foreach ($itemIds as $itemId)
                sql ($g_sql, "INSERT INTO user_permissions VALUES ($itemId, $userId, current_date + current_time)");

            $successCount++;

        } catch (Exception $e) {
            $errors[] = "Erro ao processar $toUsername: " . $e->getMessage();
        }
    }

    // Commit da transação
    sql ($g_sql, 'COMMIT');

    $message = "PERMISSÕES REPLICADAS COM SUCESSO PARA $successCount USUÁRIO(S)";

    if (!empty($errors)) {
        $message .= ". ERROS: " . implode(", ", $errors);
    }

    echo json_encode([
        'success' => true,
        'message' => $message,
        'from_username' => $fromUsername,
        'success_count' => $successCount,
        'total_requested' => count($toUsernames),
        'errors' => $errors
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao replicar permissões: " . $e->getMessage());
    msg('ERRO AO REPLICAR PERMISSÕES: ' . $e->getMessage(), 'error', 500);
}