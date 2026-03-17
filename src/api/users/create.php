<?php
/**
 * API de Criação de Usuário
 * POST /api/users/create.php
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { "domain": "XXX", "username": "...", "full_name": "...", "email": "...", "password": "...", "is_admin": false }
 * Retorna: { "success": true, "user": {...} }
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
    
    $domain = isset($input['domain']) ? strtoupper(trim($input['domain'])) : null;
    $username = isset($input['username']) ? strtolower(trim($input['username'])) : null;
    $fullName = isset($input['full_name']) ? strtoupper(trim($input['full_name'])) : null;
    $email = isset($input['email']) ? strtolower(trim($input['email'])) : null;
    $password = isset($input['password']) ? trim($input['password']) : null; // NÃO converter para minúscula!
    $isAdmin = isset($input['is_admin']) ? (bool)$input['is_admin'] : false;
    $unidade = isset($input['unidade']) ? strtoupper(trim($input['unidade'])) : null; // ✅ OBRIGATÓRIO - SEM PADRÃO
    $trocaUnidade = isset($input['troca_unidade']) ? (bool)$input['troca_unidade'] : true; // ✅ NOVO - padrão true
    $aprovaOrcamento = isset($input['aprova_orcamento']) ? (bool)$input['aprova_orcamento'] : false; // ✅ NOVO - padrão false
    $nroSetor = isset($input['nro_setor']) ? (int)$input['nro_setor'] : 1; // ✅ NOVO - padrão setor GERAL
    $nroSetorCompra = isset($input['nro_setor_compra']) && !empty($input['nro_setor_compra']) ? (int)$input['nro_setor_compra'] : null; // ✅ NOVO - Setor para Compras (OPCIONAL)
    $unidades = isset($input['unidades']) ? strtoupper(trim($input['unidades'])) : null; // ✅ NOVO - unidades permitidas (separadas por vírgula)
    
    // ============================================
    // VALIDAÇÕES
    // ============================================
    
    // Validar domínio
    if (empty($domain)) {
        msg('Domínio não fornecido', 'error', 400);
    }
    
    // Verificar se o usuário pode criar usuários neste domínio
    if ($domain !== $currentUser['domain'] && !$currentUser['is_super_admin']) {
        msg('Acesso negado a este domínio', 'error', 403);
    }
    
    // Validar campos obrigatórios
    if (empty($username)) {
        msg('Username é obrigatório', 'error', 400);
    }
    
    if (strlen($username) < 3) {
        msg('Username deve ter no mínimo 3 caracteres', 'error', 400);
    }
    
    if (empty($fullName)) {
        msg('Nome completo é obrigatório', 'error', 400);
    }
    
    if (strlen($fullName) < 3) {
        msg('Nome completo deve ter no mínimo 3 caracteres', 'error', 400);
    }
    
    if (empty($email)) {
        msg('Email é obrigatório', 'error', 400);
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        msg('Email inválido', 'error', 400);
    }
    
    if (empty($password)) {
        msg('Senha é obrigatória', 'error', 400);
    }
    
    if (strlen($password) < 4) {
        msg('Senha deve ter no mínimo 4 caracteres', 'error', 400);
    }
    
    // ✅ VALIDAR UNIDADE (OBRIGATÓRIO)
    if (empty($unidade)) {
        msg('Unidade é obrigatória', 'error', 400);
    }
    
    // Usernames reservados
    $reservedUsernames = ['presto', 'system', 'root', 'superuser'];
    if (in_array($username, $reservedUsernames)) {
        msg('Username reservado', 'error', 400);
    }
    
    $conn = getDBConnection();
    
    // ============================================
    // VERIFICAR SE DOMÍNIO EXISTE
    // ============================================
    $stmt = pg_prepare($conn, "check_domain", "SELECT domain FROM domains WHERE domain = $1");
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de domínio: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "check_domain", [$domain]);
    if (!$result || pg_num_rows($result) === 0) {
        closeDBConnection($conn);
        msg('Domínio não encontrado', 'error', 404);
    }
    
    // ============================================
    // VERIFICAR SE USERNAME JÁ EXISTE NO DOMÍNIO
    // ============================================
    $stmt = pg_prepare($conn, "check_username", 
        "SELECT id FROM users WHERE domain = $1 AND username = $2");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de username: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "check_username", [$domain, $username]);
    
    if (pg_num_rows($result) > 0) {
        closeDBConnection($conn);
        msg('Username já existe neste domínio', 'error', 409);
    }
    
    // ============================================
    // VERIFICAR SE EMAIL JÁ EXISTE NO DOMÍNIO
    // ============================================
    $stmt = pg_prepare($conn, "check_email", 
        "SELECT id FROM users WHERE domain = $1 AND email = $2");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de email: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "check_email", [$domain, $email]);
    
    if (pg_num_rows($result) > 0) {
        closeDBConnection($conn);
        msg('Email já existe neste domínio', 'error', 409);
    }
    
    // ============================================
    // CRIAR HASH DA SENHA (bcrypt cost 10)
    // ============================================
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
    
    if (!$passwordHash) {
        throw new Exception('Erro ao gerar hash da senha');
    }
    
    // ============================================
    // INSERIR USUÁRIO
    // ============================================
    $stmt = pg_prepare($conn, "insert_user",
        "INSERT INTO users (
            domain,
            username,
            password_hash,
            email,
            full_name,
            is_active,
            is_admin,
            unidade,
            troca_unidade,
            aprova_orcamento,
            nro_setor,
            nro_setor_compras,
            unidades,
            created_at,
            updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id, domain, username, email, full_name, is_active, is_admin, unidade, troca_unidade, aprova_orcamento, nro_setor, nro_setor_compras, unidades, created_at");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de insert: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "insert_user", [
        $domain,
        $username,
        $passwordHash,
        $email,
        $fullName,
        phpBoolToPg(true), // is_active = true
        phpBoolToPg($isAdmin), // is_admin
        $unidade, // ✅ NOVO
        phpBoolToPg($trocaUnidade), // ✅ NOVO
        phpBoolToPg($aprovaOrcamento), // ✅ NOVO
        $nroSetor, // ✅ NOVO - Setor
        $nroSetorCompra, // ✅ NOVO - Setor para Compras (OPCIONAL)
        $unidades // ✅ NOVO - Unidades permitidas (CSV)
    ]);
    
    if (!$result) {
        throw new Exception('Erro ao inserir usuário: ' . pg_last_error($conn));
    }
    
    $newUser = pg_fetch_assoc($result);
    
    if (!$newUser) {
        throw new Exception('Erro ao recuperar usuário criado');
    }
    
    closeDBConnection($conn);
    
    // ✅ Usar msg() para enviar toast de sucesso
    msg('Usuário criado com sucesso', 'success', 200, [
        'user' => [
            'id' => (int)$newUser['id'],
            'domain' => $newUser['domain'],
            'username' => $newUser['username'],
            'email' => $newUser['email'],
            'full_name' => $newUser['full_name'],
            'is_active' => pgBoolToPHP($newUser['is_active']),
            'is_admin' => pgBoolToPHP($newUser['is_admin']),
            'unidade' => $newUser['unidade'],
            'troca_unidade' => pgBoolToPHP($newUser['troca_unidade']),
            'aprova_orcamento' => pgBoolToPHP($newUser['aprova_orcamento']),
            'nro_setor' => isset($newUser['nro_setor']) ? (int)$newUser['nro_setor'] : null,
            'nro_setor_compra' => isset($newUser['nro_setor_compras']) ? (int)$newUser['nro_setor_compras'] : null,
            'unidades' => $newUser['unidades'], // ✅ NOVO - Unidades permitidas
            'created_at' => $newUser['created_at']
        ]
    ]);
    
} catch (Exception $e) {
    error_log("[USERS-CREATE] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao criar usuário: ' . $e->getMessage(), 500);
}