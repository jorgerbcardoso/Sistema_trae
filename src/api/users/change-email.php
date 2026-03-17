<?php
/**
 * API de Troca de Email do Próprio Usuário
 * POST /api/users/change-email.php
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { "new_email": "...", "password": "..." }
 * Retorna: { "success": true, "message": "..." }
 */

require_once __DIR__ . '/../config.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Apenas POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    returnError('Método não permitido', 405);
}

// Requer autenticação
requireAuth();

try {
    $currentUser = getCurrentUser();
    
    // Ler dados do body
    $input = json_decode(file_get_contents('php://input'), true);
    
    $newEmail = isset($input['new_email']) ? strtolower(trim($input['new_email'])) : null;
    $password = isset($input['password']) ? trim($input['password']) : null;
    
    // Validações
    if (empty($newEmail)) {
        returnError('Novo email é obrigatório', 400);
    }
    
    if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        returnError('Email inválido', 400);
    }
    
    if (empty($password)) {
        returnError('Senha é obrigatória para confirmar a alteração', 400);
    }
    
    $conn = getDBConnection();
    
    // Buscar senha atual e email atual do usuário
    $stmt = pg_prepare($conn, "get_user",
        "SELECT password_hash, email FROM users WHERE id = $1 AND is_active = TRUE");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "get_user", [$currentUser['id']]);
    
    if (!$result || pg_num_rows($result) === 0) {
        closeDBConnection($conn);
        returnError('Usuário não encontrado', 404);
    }
    
    $user = pg_fetch_assoc($result);
    
    // Verificar se o novo email é diferente do atual
    if (strtolower($user['email']) === $newEmail) {
        closeDBConnection($conn);
        returnError('O novo email deve ser diferente do atual', 400);
    }
    
    // Verificar senha
    if (!password_verify($password, $user['password_hash'])) {
        closeDBConnection($conn);
        returnError('Senha incorreta', 401);
    }
    
    // Verificar se o novo email já existe no domínio
    $stmt = pg_prepare($conn, "check_email",
        "SELECT id FROM users WHERE domain = $1 AND email = $2 AND id != $3");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de verificação: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "check_email", [$currentUser['domain'], $newEmail, $currentUser['id']]);
    
    if (pg_num_rows($result) > 0) {
        closeDBConnection($conn);
        returnError('Este email já está em uso por outro usuário', 409);
    }
    
    // Atualizar email
    $stmt = pg_prepare($conn, "update_email",
        "UPDATE users 
         SET email = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar update: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "update_email", [$newEmail, $currentUser['id']]);
    
    if (!$result) {
        throw new Exception('Erro ao atualizar email: ' . pg_last_error($conn));
    }
    
    // Invalidar todas as sessões do usuário (forçar novo login)
    $stmt = pg_prepare($conn, "invalidate_sessions",
        "DELETE FROM sessions WHERE user_id = $1");
    
    if ($stmt) {
        pg_execute($conn, "invalidate_sessions", [$currentUser['id']]);
    }
    
    closeDBConnection($conn);
    
    returnSuccess([
        'message' => 'Email alterado com sucesso. Faça login novamente.',
        'new_email' => $newEmail
    ]);
    
} catch (Exception $e) {
    error_log("[CHANGE-EMAIL] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao alterar email: ' . $e->getMessage(), 500);
}