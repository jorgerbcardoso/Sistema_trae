<?php
/**
 * API de Desativação de Usuário (Soft Delete)
 * POST /api/users/delete.php
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
    $stmt = pg_prepare($conn, "get_user", 
        "SELECT id, domain, username, is_admin FROM users WHERE id = $1");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "get_user", [$userId]);
    
    if (!$result || pg_num_rows($result) === 0) {
        closeDBConnection($conn);
        returnError('Usuário não encontrado', 404);
    }
    
    $existingUser = pg_fetch_assoc($result);
    
    // ============================================
    // ✅ REGRA CRÍTICA: BLOQUEAR DELEÇÃO DO USUÁRIO "presto"
    // ============================================
    // NINGUÉM (nem super admin) pode deletar o usuário "presto"
    if (strtolower($existingUser['username']) === 'presto') {
        closeDBConnection($conn);
        returnError('Não é possível desativar o usuário PRESTO', 403);
    }
    
    // ✅ REGRA: Não pode deletar usuário "admin" (admin principal do domínio)
    if (strtolower($existingUser['username']) === 'admin') {
        closeDBConnection($conn);
        returnError('Não é possível desativar o usuário admin principal', 403);
    }
    
    // ============================================
    // VERIFICAR PERMISSÕES
    // ============================================
    
    // Não pode deletar a si mesmo
    if ($currentUser['id'] === $userId) {
        closeDBConnection($conn);
        returnError('Você não pode desativar sua própria conta', 403);
    }
    
    // Verificar se o usuário logado pode deletar este usuário
    $canDelete = false;
    
    // Super admin pode deletar qualquer usuário (exceto "presto" e "admin" que já foram bloqueados acima)
    if ($currentUser['is_super_admin']) {
        $canDelete = true;
    }
    // ✅ ADMIN PODE DELETAR QUALQUER USUÁRIO DO MESMO DOMÍNIO (incluindo outros admins)
    elseif ($currentUser['is_admin'] && $currentUser['domain'] === $existingUser['domain']) {
        $canDelete = true;
    }
    
    if (!$canDelete) {
        closeDBConnection($conn);
        returnError('Você não tem permissão para desativar este usuário', 403);
    }
    
    // ============================================
    // DESATIVAR USUÁRIO (SOFT DELETE)
    // ============================================
    $stmt = pg_prepare($conn, "deactivate_user",
        "UPDATE users 
         SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2
         RETURNING id, username, domain");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de desativação: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "deactivate_user", [
        phpBoolToPg(false), // is_active = false
        $userId
    ]);
    
    if (!$result) {
        throw new Exception('Erro ao desativar usuário: ' . pg_last_error($conn));
    }
    
    $deactivatedUser = pg_fetch_assoc($result);
    
    if (!$deactivatedUser) {
        throw new Exception('Erro ao confirmar desativação');
    }
    
    // ============================================
    // INVALIDAR SESSÕES DO USUÁRIO
    // ============================================
    $stmt = pg_prepare($conn, "delete_sessions",
        "DELETE FROM sessions WHERE user_id = $1");
    
    if ($stmt) {
        pg_execute($conn, "delete_sessions", [$userId]);
    }
    
    closeDBConnection($conn);
    
    // ✅ Usar msg() para enviar toast de sucesso
    msg('Usuário desativado com sucesso', 'success', 200, [
        'user_id' => $userId
    ]);
    
} catch (Exception $e) {
    error_log("[USERS-DELETE] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao desativar usuário: ' . $e->getMessage(), 500);
}