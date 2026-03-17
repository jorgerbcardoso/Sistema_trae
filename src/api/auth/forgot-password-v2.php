<?php
/**
 * API de Esqueci Minha Senha - Solicitar Token (SEM TABELA EXTRA)
 * POST /api/auth/forgot-password.php
 * 
 * VERSÃO ALTERNATIVA: Usa JWT assinado ao invés de armazenar no banco
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
            'message' => 'Se o email existir em nossa base, você receberá um link para redefinir sua senha'
        ]);
    }
    
    $domainData = pg_fetch_assoc($result);
    
    // ============================================
    // 2. BUSCAR USUÁRIO POR EMAIL E DOMÍNIO
    // ============================================
    $stmt = pg_prepare($conn, "find_user",
        "SELECT id, username, email, full_name, is_active 
         FROM users 
         WHERE domain = $1 AND email = $2");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de usuário: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "find_user", [$domain, $email]);
    
    if (!$result) {
        throw new Exception('Erro ao executar query de usuário: ' . pg_last_error($conn));
    }
    
    if (pg_num_rows($result) === 0) {
        // Não revelar se usuário existe ou não (segurança)
        usleep(random_int(500000, 1000000));
        returnSuccess([
            'message' => 'Se o email existir em nossa base, você receberá um link para redefinir sua senha'
        ]);
    }
    
    $user = pg_fetch_assoc($result);
    
    // Verificar se usuário está ativo
    if (!pgBoolToPHP($user['is_active'])) {
        // Não revelar se usuário está inativo (segurança)
        usleep(random_int(500000, 1000000));
        returnSuccess([
            'message' => 'Se o email existir em nossa base, você receberá um link para redefinir sua senha'
        ]);
    }
    
    // ============================================
    // 3. GERAR TOKEN JWT ASSINADO (SEM BANCO)
    // ============================================
    // Token contém: user_id, email, domain, expiration
    // Assinado com JWT_SECRET para evitar falsificação
    
    $expiresAt = time() + 3600; // 1 hora
    
    $payload = [
        'user_id' => (int)$user['id'],
        'email' => $email,
        'domain' => $domain,
        'type' => 'password_reset',
        'exp' => $expiresAt,
        'iat' => time()
    ];
    
    // Criar token assinado (JWT simplificado)
    $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payloadEncoded = base64_encode(json_encode($payload));
    $signature = hash_hmac('sha256', "$header.$payloadEncoded", JWT_SECRET, true);
    $signatureEncoded = base64_encode($signature);
    
    $token = "$header.$payloadEncoded.$signatureEncoded";
    
    // ============================================
    // 4. ENVIAR EMAIL DE RECUPERAÇÃO
    // ============================================
    require_once __DIR__ . '/../services/EmailService.php';
    
    $emailService = new EmailService();
    $emailResult = $emailService->sendPasswordResetEmail(
        $user['email'],
        $user['full_name'] ?? $user['username'],
        $token,
        $domain
    );
    
    if (!$emailResult['success']) {
        error_log("[FORGOT-PASSWORD] Erro ao enviar email: " . $emailResult['message']);
        // Não revelar o erro ao usuário (segurança), mas logar
    }
    
    // ============================================
    // 5. RETORNAR SUCESSO (sempre igual para segurança)
    // ============================================
    closeDBConnection($conn);
    
    returnSuccess([
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
