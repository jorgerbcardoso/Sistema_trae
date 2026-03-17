<?php
/**
 * API de Troca de Senha do Próprio Usuário
 * POST /api/users/change-password.php
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { "current_password": "...", "new_password": "..." }
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
    
    $currentPassword = isset($input['current_password']) ? trim($input['current_password']) : null;
    $newPassword = isset($input['new_password']) ? trim($input['new_password']) : null;
    
    // Validações
    if (empty($currentPassword)) {
        returnError('Senha atual é obrigatória', 400);
    }
    
    if (empty($newPassword)) {
        returnError('Nova senha é obrigatória', 400);
    }
    
    if (strlen($newPassword) < 4) {
        returnError('Nova senha deve ter no mínimo 4 caracteres', 400);
    }
    
    if ($currentPassword === $newPassword) {
        returnError('A nova senha deve ser diferente da atual', 400);
    }
    
    $conn = getDBConnection();
    
    // Buscar senha atual do usuário
    $stmt = pg_prepare($conn, "get_password",
        "SELECT password_hash FROM users WHERE id = $1 AND is_active = TRUE");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "get_password", [$currentUser['id']]);
    
    if (!$result || pg_num_rows($result) === 0) {
        closeDBConnection($conn);
        returnError('Usuário não encontrado', 404);
    }
    
    $user = pg_fetch_assoc($result);
    
    // Verificar senha atual
    if (!password_verify($currentPassword, $user['password_hash'])) {
        closeDBConnection($conn);
        returnError('Senha atual incorreta', 401);
    }
    
    // Gerar hash da nova senha
    $newPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
    
    if (!$newPasswordHash) {
        throw new Exception('Erro ao gerar hash da nova senha');
    }
    
    // Atualizar senha
    $stmt = pg_prepare($conn, "update_password",
        "UPDATE users 
         SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar update: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "update_password", [$newPasswordHash, $currentUser['id']]);
    
    if (!$result) {
        throw new Exception('Erro ao atualizar senha: ' . pg_last_error($conn));
    }
    
    closeDBConnection($conn);
    
    returnSuccess([
        'message' => 'Senha alterada com sucesso'
    ]);
    
} catch (Exception $e) {
    error_log("[CHANGE-PASSWORD] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao alterar senha: ' . $e->getMessage(), 500);
}