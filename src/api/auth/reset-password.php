<?php
/**
 * API de Resetar Senha
 * POST /api/auth/reset-password.php
 * 
 * Body: { "token": "...", "new_password": "..." }
 * Retorna: { "success": true, "message": "..." }
 */

require_once __DIR__ . '/../config.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
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

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['token']) || !isset($input['new_password'])) {
    returnError('Token e nova senha são obrigatórios', 400);
}

$token = trim($input['token']);
$newPassword = $input['new_password'];

if (empty($token) || empty($newPassword)) {
    returnError('Token e senha não podem estar vazios', 400);
}

// Validar senha (mínimo 4 caracteres - mesmo critério do sistema)
if (strlen($newPassword) < 4) {
    returnError('Senha deve ter no mínimo 4 caracteres', 400);
}

try {
    $conn = getDBConnection();
    
    // ============================================
    // 1. BUSCAR TOKEN E DADOS DO USUÁRIO
    // ============================================
    $stmt = pg_prepare($conn, "find_token",
        "SELECT 
            prt.id as token_id,
            prt.user_id,
            prt.expires_at,
            prt.used,
            u.username,
            u.email,
            u.domain,
            u.is_active
         FROM password_reset_tokens prt
         INNER JOIN users u ON prt.user_id = u.id
         WHERE prt.token = $1");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de token: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "find_token", [$token]);
    
    if (!$result) {
        throw new Exception('Erro ao executar query de token: ' . pg_last_error($conn));
    }
    
    if (pg_num_rows($result) === 0) {
        returnError('Token inválido ou expirado', 400);
    }
    
    $tokenData = pg_fetch_assoc($result);
    
    // ============================================
    // 2. VALIDAR TOKEN
    // ============================================
    
    // Verificar se token foi usado
    if (pgBoolToPHP($tokenData['used'])) {
        returnError('Este token já foi utilizado', 400);
    }
    
    // Verificar se token expirou
    $expiresAt = strtotime($tokenData['expires_at']);
    if ($expiresAt < time()) {
        returnError('Token expirado. Solicite uma nova recuperação de senha', 400);
    }
    
    // Verificar se usuário está ativo
    if (!pgBoolToPHP($tokenData['is_active'])) {
        returnError('Usuário inativo. Entre em contato com o suporte', 400);
    }
    
    // ============================================
    // 3. GERAR HASH DA NOVA SENHA
    // ============================================
    // 🔥 IMPORTANTE: Armazenar senha em MINÚSCULAS (case insensitive no login)
    $passwordHash = hashPassword(strtolower($newPassword));
    
    // ============================================
    // 4. ATUALIZAR SENHA DO USUÁRIO
    // ============================================
    $stmt = pg_prepare($conn, "update_password",
        "UPDATE users 
         SET password_hash = $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar atualização de senha: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "update_password", [$passwordHash, $tokenData['user_id']]);
    
    if (!$result) {
        throw new Exception('Erro ao atualizar senha: ' . pg_last_error($conn));
    }
    
    // ============================================
    // 5. MARCAR TOKEN COMO USADO
    // ============================================
    $stmt = pg_prepare($conn, "mark_token_used",
        "UPDATE password_reset_tokens 
         SET used = TRUE 
         WHERE id = $1");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar marcação de token: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "mark_token_used", [$tokenData['token_id']]);
    
    if (!$result) {
        throw new Exception('Erro ao marcar token como usado: ' . pg_last_error($conn));
    }
    
    // ============================================
    // 6. INVALIDAR SESSÕES ATIVAS DO USUÁRIO (segurança)
    // ============================================
    $stmt = pg_prepare($conn, "invalidate_sessions",
        "DELETE FROM sessions WHERE user_id = $1");
    
    if ($stmt) {
        pg_execute($conn, "invalidate_sessions", [$tokenData['user_id']]);
    }
    
    // ============================================
    // 7. REGISTRAR LOG DE AÇÃO
    // ============================================
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    $stmt = pg_prepare($conn, "log_action",
        "INSERT INTO access_logs (user_id, action, ip_address, user_agent, created_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)");
    
    if ($stmt) {
        pg_execute($conn, "log_action", [
            $tokenData['user_id'],
            'password_reset_completed',
            $ipAddress,
            $userAgent
        ]);
    }
    
    // ============================================
    // 8. RETORNAR SUCESSO
    // ============================================
    closeDBConnection($conn);
    
    error_log("[RESET-PASSWORD] Senha alterada com sucesso para usuário ID: " . $tokenData['user_id']);
    
    returnSuccess([
        'success' => true,
        'message' => 'Senha alterada com sucesso! Você já pode fazer login com sua nova senha',
        'domain' => $tokenData['domain']  // ✅ Retornar domínio para redirecionar para login correto
    ]);
    
} catch (Exception $e) {
    error_log("[RESET-PASSWORD] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao processar solicitação. Tente novamente.', 500);
}
