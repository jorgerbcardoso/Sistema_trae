<?php
/**
 * API de Reativação de Usuário
 * POST /api/users/reactivate.php
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { "user_id": 123 }
 * Retorna: { "success": true }
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
    
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : null;
    
    // ============================================
    // VALIDAÇÕES
    // ============================================
    
    if (empty($userId)) {
        returnError('ID do usuário não fornecido', 400);
    }
    
    $conn = getDBConnection();
    
    // ============================================
    // VERIFICAR SE USUÁRIO EXISTE
    // ============================================
    $stmt = pg_prepare($conn, "get_user_reactivate", 
        "SELECT id, domain, username, full_name, is_admin, is_active FROM users WHERE id = $1");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "get_user_reactivate", [$userId]);
    
    if (!$result || pg_num_rows($result) === 0) {
        closeDBConnection($conn);
        returnError('Usuário não encontrado', 404);
    }
    
    $existingUser = pg_fetch_assoc($result);
    
    // ============================================
    // VERIFICAR PERMISSÕES
    // ============================================
    
    // Verificar se o usuário logado pode reativar este usuário
    $canReactivate = false;
    
    // Super admin pode reativar qualquer usuário
    if ($currentUser['is_super_admin']) {
        $canReactivate = true;
    }
    // Admin do mesmo domínio pode reativar usuários
    elseif ($currentUser['is_admin'] && $currentUser['domain'] === $existingUser['domain']) {
        $canReactivate = true;
    }
    
    if (!$canReactivate) {
        closeDBConnection($conn);
        returnError('Você não tem permissão para reativar este usuário', 403);
    }
    
    // ============================================
    // VERIFICAR SE USUÁRIO JÁ ESTÁ ATIVO
    // ============================================
    if (pgBoolToPHP($existingUser['is_active'])) {
        closeDBConnection($conn);
        returnError('Este usuário já está ativo', 400);
    }
    
    // ============================================
    // REATIVAR USUÁRIO
    // ============================================
    $stmt = pg_prepare($conn, "reactivate_user",
        "UPDATE users 
         SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2
         RETURNING id, username, full_name, domain");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de reativação: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "reactivate_user", [
        phpBoolToPg(true), // is_active = true
        $userId
    ]);
    
    if (!$result) {
        throw new Exception('Erro ao reativar usuário: ' . pg_last_error($conn));
    }
    
    $reactivatedUser = pg_fetch_assoc($result);
    
    if (!$reactivatedUser) {
        throw new Exception('Erro ao confirmar reativação');
    }
    
    closeDBConnection($conn);
    
    // ✅ Usar msg() para enviar toast de sucesso
    msg(sprintf('Usuário "%s" reativado com sucesso', $reactivatedUser['full_name']), 'success', 200, [
        'user_id' => $userId
    ]);
    
} catch (Exception $e) {
    error_log("[USERS-REACTIVATE] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao reativar usuário: ' . $e->getMessage(), 500);
}