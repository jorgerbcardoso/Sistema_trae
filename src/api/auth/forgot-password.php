<?php
/**
 * API de Esqueci Minha Senha - Solicitar Token
 * POST /api/auth/forgot-password.php
 * 
 * Body: { "email": "email@exemplo.com", "domain": "DOM" }
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

if (!isset($input['email']) || !isset($input['domain'])) {
    returnError('Email e domínio são obrigatórios', 400);
}

$email = trim($input['email']);
$domain = strtoupper(trim($input['domain']));

if (empty($email) || empty($domain)) {
    returnError('Email e domínio não podem estar vazios', 400);
}

// Validar formato do domínio (3 letras maiúsculas)
if (!preg_match('/^[A-Z]{3}$/', $domain)) {
    returnError('Domínio deve ter exatamente 3 letras maiúsculas', 400);
}

// Validar email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    returnError('Email inválido', 400);
}

try {
    $conn = getDBConnection();
    
    // ============================================
    // 1. VERIFICAR SE DOMÍNIO EXISTE E ESTÁ ATIVO
    // ============================================
    $stmt = pg_prepare($conn, "check_domain", 
        "SELECT domain, name FROM domains WHERE domain = $1 AND is_active = TRUE");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de domínio: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "check_domain", [$domain]);
    
    if (!$result) {
        throw new Exception('Erro ao executar query de domínio: ' . pg_last_error($conn));
    }
    
    if (pg_num_rows($result) === 0) {
        // Não revelar se domínio existe ou não (segurança)
        usleep(random_int(500000, 1000000));
        returnSuccess([
            'success' => true,
            'message' => 'Se o email existir em nossa base, você receberá um link para redefinir sua senha'
        ]);
    }
    
    $domainData = pg_fetch_assoc($result);
    
    // ============================================
    // 2. BUSCAR USUÁRIO POR EMAIL E DOMÍNIO
    // ============================================
    error_log("[FORGOT-PASSWORD] Buscando usuário: email='{$email}', domain='{$domain}'");
    
    $stmt = pg_prepare($conn, "find_user",
        "SELECT id, username, email, full_name, is_active 
         FROM users 
         WHERE domain = $1 AND UPPER(email) = UPPER($2)");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de usuário: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "find_user", [$domain, $email]);
    
    if (!$result) {
        throw new Exception('Erro ao executar query de usuário: ' . pg_last_error($conn));
    }
    
    $numUsers = pg_num_rows($result);
    error_log("[FORGOT-PASSWORD] Usuários encontrados: {$numUsers}");
    
    if ($numUsers === 0) {
        error_log("[FORGOT-PASSWORD] Usuário não encontrado - retornando mensagem genérica");
        // Não revelar se usuário existe ou não (segurança)
        usleep(random_int(500000, 1000000));
        returnSuccess([
            'success' => true,
            'message' => 'Se o email existir em nossa base, você receberá um link para redefinir sua senha'
        ]);
    }
    
    $user = pg_fetch_assoc($result);
    error_log("[FORGOT-PASSWORD] Usuário encontrado: ID={$user['id']}, is_active={$user['is_active']}");
    
    // Verificar se usuário está ativo
    if (!pgBoolToPHP($user['is_active'])) {
        error_log("[FORGOT-PASSWORD] Usuário inativo - retornando mensagem genérica");
        // Não revelar se usuário está inativo (segurança)
        usleep(random_int(500000, 1000000));
        returnSuccess([
            'success' => true,
            'message' => 'Se o email existir em nossa base, você receberá um link para redefinir sua senha'
        ]);
    }
    
    error_log("[FORGOT-PASSWORD] Usuário ativo - prosseguindo com criação do token");
    
    // ============================================
    // 3. GERAR TOKEN DE RECUPERAÇÃO
    // ============================================
    $token = bin2hex(random_bytes(32)); // 64 caracteres hexadecimais
    $expiresAt = date('Y-m-d H:i:s', time() + 3600); // 1 hora
    
    // ============================================
    // 4. INVALIDAR TOKENS ANTERIORES DO USUÁRIO
    // ============================================
    $stmt = pg_prepare($conn, "invalidate_tokens",
        "UPDATE password_reset_tokens 
         SET used = TRUE 
         WHERE user_id = $1 AND used = FALSE");
    
    if ($stmt) {
        pg_execute($conn, "invalidate_tokens", [$user['id']]);
    }
    
    // ============================================
    // 5. CRIAR NOVO TOKEN
    // ============================================
    $stmt = pg_prepare($conn, "create_token",
        "INSERT INTO password_reset_tokens (user_id, token, expires_at, used) 
         VALUES ($1, $2, $3, FALSE)");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar inserção de token: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "create_token", [$user['id'], $token, $expiresAt]);
    
    if (!$result) {
        throw new Exception('Erro ao criar token de recuperação: ' . pg_last_error($conn));
    }
    
    // ============================================
    // 6. ENVIAR EMAIL DE RECUPERAÇÃO
    // ============================================
    error_log("[FORGOT-PASSWORD] Iniciando envio de email para: " . $user['email']);
    
    require_once __DIR__ . '/../services/EmailService.php';
    
    $emailService = new EmailService();
    error_log("[FORGOT-PASSWORD] EmailService instanciado, chamando sendPasswordResetEmail()");
    
    $emailResult = $emailService->sendPasswordResetEmail(
        $user['email'],
        $user['full_name'] ?? $user['username'],
        $token,
        $domain
    );
    
    error_log("[FORGOT-PASSWORD] Resultado do envio: " . json_encode($emailResult));
    
    if (!$emailResult['success']) {
        error_log("[FORGOT-PASSWORD] Erro ao enviar email: " . $emailResult['message']);
        // 🔥 TEMPORÁRIO: RETORNAR ERRO PARA DEBUG
        closeDBConnection($conn);
        returnError('ERRO EMAIL: ' . $emailResult['message'], 500);
    }
    
    // ============================================
    // 7. REGISTRAR LOG DE AÇÃO
    // ============================================
    // TODO: Criar tabela access_logs antes de descomentar
    /*
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    $stmt = pg_prepare($conn, "log_action",
        "INSERT INTO access_logs (user_id, action, ip_address, user_agent, created_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)");
    
    if ($stmt) {
        pg_execute($conn, "log_action", [
            $user['id'],
            'password_reset_requested',
            $ipAddress,
            $userAgent
        ]);
    }
    */
    
    // ============================================
    // 8. RETORNAR SUCESSO (sempre igual para segurança)
    // ============================================
    closeDBConnection($conn);
    
    returnSuccess([
        'success' => true,
        'message' => 'Se o email existir em nossa base, você receberá um link para redefinir sua senha',
        'expires_in' => '1 hora'
    ]);
    
} catch (Exception $e) {
    error_log("[FORGOT-PASSWORD] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao processar solicitação. Tente novamente.', 500);
}