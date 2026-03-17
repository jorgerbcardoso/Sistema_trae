<?php
/**
 * API de Atualização de Usuário
 * POST /api/users/update.php
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { "user_id": 123, "full_name": "...", "email": "...", "password": "..." (opcional), "is_admin": false }
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
    
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : null;
    $fullName = isset($input['full_name']) ? strtoupper(trim($input['full_name'])) : null;
    $email = isset($input['email']) ? strtolower(trim($input['email'])) : null;
    $password = isset($input['password']) && !empty($input['password']) ? trim($input['password']) : null; // ✅ CORRIGIDO: NÃO converter senha para minúsculas!
    $isAdmin = isset($input['is_admin']) ? (bool)$input['is_admin'] : null;
    $unidade = isset($input['unidade']) ? strtoupper(trim($input['unidade'])) : null; // ✅ NOVO
    $trocaUnidade = isset($input['troca_unidade']) ? (bool)$input['troca_unidade'] : null; // ✅ NOVO
    $aprovaOrcamento = isset($input['aprova_orcamento']) ? (bool)$input['aprova_orcamento'] : null; // ✅ NOVO
    $nroSetor = isset($input['nro_setor']) ? (int)$input['nro_setor'] : null; // ✅ NOVO - Setor
    $nroSetorCompra = array_key_exists('nro_setor_compra', $input) ? (empty($input['nro_setor_compra']) ? null : (int)$input['nro_setor_compra']) : 'NOT_SET'; // ✅ NOVO - Setor para Compras (OPCIONAL)
    $unidades = isset($input['unidades']) ? strtoupper(trim($input['unidades'])) : null; // ✅ NOVO - Unidades permitidas (CSV)
    
    // ============================================
    // VALIDAÇÕES
    // ============================================
    
    if (empty($userId)) {
        returnError('ID do usuário não fornecido', 400);
    }
    
    if (empty($fullName)) {
        returnError('Nome completo é obrigatório', 400);
    }
    
    if (strlen($fullName) < 3) {
        returnError('Nome completo deve ter no mínimo 3 caracteres', 400);
    }
    
    if (empty($email)) {
        returnError('Email é obrigatório', 400);
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        returnError('Email inválido', 400);
    }
    
    if ($password !== null && strlen($password) < 4) {
        returnError('Senha deve ter no mínimo 4 caracteres', 400);
    }
    
    $conn = getDBConnection();
    
    // ============================================
    // VERIFICAR SE USUÁRIO EXISTE E PEGAR DADOS ATUAIS
    // ============================================
    $stmt = pg_prepare($conn, "get_user", 
        "SELECT id, domain, username, email, is_admin FROM users WHERE id = $1");
    
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
    // ✅ REGRA CRÍTICA: BLOQUEAR EDIÇÃO DO USUÁRIO "presto" (exceto por ele mesmo)
    // ============================================
    // NINGUÉM (nem super admin) pode editar o usuário "presto", EXCETO o próprio "presto"
    if (strtolower($existingUser['username']) === 'presto' && strtolower($currentUser['username']) !== 'presto') {
        closeDBConnection($conn);
        returnError('Não é possível editar o usuário PRESTO', 403);
    }
    
    // ============================================
    // VERIFICAR PERMISSÕES
    // ============================================
    
    // Verificar se o usuário logado pode editar este usuário
    $canEdit = false;
    
    // Super admin pode editar qualquer usuário (exceto "presto" que já foi bloqueado acima)
    if ($currentUser['is_super_admin']) {
        $canEdit = true;
    }
    // ✅ ADMIN PODE EDITAR QUALQUER USUÁRIO DO MESMO DOMÍNIO (incluindo outros admins)
    elseif ($currentUser['is_admin'] && $currentUser['domain'] === $existingUser['domain']) {
        $canEdit = true;
    }
    // Usuário pode editar a si mesmo (mas não pode mudar is_admin)
    elseif ($currentUser['id'] === $userId) {
        $canEdit = true;
        // Não pode alterar seu próprio is_admin
        if ($isAdmin !== null && $isAdmin !== pgBoolToPHP($existingUser['is_admin'])) {
            closeDBConnection($conn);
            returnError('Você não pode alterar seu próprio status de admin', 403);
        }
    }
    
    if (!$canEdit) {
        closeDBConnection($conn);
        returnError('Você não tem permissão para editar este usuário', 403);
    }
    
    // ============================================
    // VERIFICAR SE EMAIL JÁ EXISTE (para outro usuário)
    // ============================================
    if ($email !== $existingUser['email']) {
        $stmt = pg_prepare($conn, "check_email", 
            "SELECT id FROM users WHERE domain = $1 AND email = $2 AND id != $3");
        
        if (!$stmt) {
            throw new Exception('Erro ao preparar query de email: ' . pg_last_error($conn));
        }
        
        $result = pg_execute($conn, "check_email", [$existingUser['domain'], $email, $userId]);
        
        if (pg_num_rows($result) > 0) {
            closeDBConnection($conn);
            returnError('Email já está em uso por outro usuário', 409);
        }
    }
    
    // ============================================
    // ATUALIZAR USUÁRIO
    // ============================================
    
    $updates = [];
    $params = [];
    $paramIndex = 1;
    
    // Full name
    $updates[] = "full_name = $" . $paramIndex;
    $params[] = $fullName;
    $paramIndex++;
    
    // Email
    $updates[] = "email = $" . $paramIndex;
    $params[] = $email;
    $paramIndex++;
    
    // Is admin (se fornecido e permitido alterar)
    if ($isAdmin !== null) {
        $updates[] = "is_admin = $" . $paramIndex;
        $params[] = phpBoolToPg($isAdmin);
        $paramIndex++;
    }
    
    // ✅ NOVO: Unidade (se fornecida)
    if ($unidade !== null) {
        $updates[] = "unidade = $" . $paramIndex;
        $params[] = $unidade;
        $paramIndex++;
    }
    
    // ✅ NOVO: Troca Unidade (se fornecida)
    if ($trocaUnidade !== null) {
        $updates[] = "troca_unidade = $" . $paramIndex;
        $params[] = phpBoolToPg($trocaUnidade);
        $paramIndex++;
    }
    
    // ✅ NOVO: Aprova Orçamento (se fornecida)
    if ($aprovaOrcamento !== null) {
        $updates[] = "aprova_orcamento = $" . $paramIndex;
        $params[] = phpBoolToPg($aprovaOrcamento);
        $paramIndex++;
    }
    
    // ✅ NOVO: Setor (se fornecido)
    if ($nroSetor !== null) {
        $updates[] = "nro_setor = $" . $paramIndex;
        $params[] = $nroSetor;
        $paramIndex++;
    }
    
    // ✅ NOVO: Setor para Compras (se fornecido)
    if ($nroSetorCompra !== 'NOT_SET') {
        $updates[] = "nro_setor_compras = $" . $paramIndex;
        $params[] = $nroSetorCompra;
        $paramIndex++;
    }
    
    // ✅ NOVO: Unidades (se fornecida)
    if ($unidades !== null) {
        $updates[] = "unidades = $" . $paramIndex;
        $params[] = $unidades;
        $paramIndex++;
    }
    
    // Senha (se fornecida)
    if ($password !== null) {
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        
        if (!$passwordHash) {
            throw new Exception('Erro ao gerar hash da senha');
        }
        
        $updates[] = "password_hash = $" . $paramIndex;
        $params[] = $passwordHash;
        $paramIndex++;
    }
    
    // Updated at
    $updates[] = "updated_at = CURRENT_TIMESTAMP";
    
    // WHERE clause
    $params[] = $userId;
    $whereIndex = $paramIndex;
    
    $updateQuery = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = $" . $whereIndex . " RETURNING id, domain, username, email, full_name, is_active, is_admin, unidade, troca_unidade, aprova_orcamento, nro_setor, nro_setor_compras, unidades, updated_at";
    
    $stmt = pg_prepare($conn, "update_user", $updateQuery);
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query de update: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "update_user", $params);
    
    if (!$result) {
        throw new Exception('Erro ao atualizar usuário: ' . pg_last_error($conn));
    }
    
    $updatedUser = pg_fetch_assoc($result);
    
    if (!$updatedUser) {
        throw new Exception('Erro ao recuperar usuário atualizado');
    }
    
    closeDBConnection($conn);
    
    // ✅ Usar msg() para enviar toast de sucesso
    msg('Usuário atualizado com sucesso', 'success', 200, [
        'user' => [
            'id' => (int)$updatedUser['id'],
            'domain' => $updatedUser['domain'],
            'username' => $updatedUser['username'],
            'email' => $updatedUser['email'],
            'full_name' => $updatedUser['full_name'],
            'is_active' => pgBoolToPHP($updatedUser['is_active']),
            'is_admin' => pgBoolToPHP($updatedUser['is_admin']),
            'unidade' => $updatedUser['unidade'],
            'troca_unidade' => pgBoolToPHP($updatedUser['troca_unidade']),
            'aprova_orcamento' => pgBoolToPHP($updatedUser['aprova_orcamento']),
            'nro_setor' => isset($updatedUser['nro_setor']) ? (int)$updatedUser['nro_setor'] : null,
            'nro_setor_compra' => isset($updatedUser['nro_setor_compras']) ? (int)$updatedUser['nro_setor_compras'] : null,
            'unidades' => $updatedUser['unidades'], // ✅ NOVO - Unidades permitidas
            'updated_at' => $updatedUser['updated_at']
        ]
    ]);
    
} catch (Exception $e) {
    error_log("[USERS-UPDATE] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao atualizar usuário: ' . $e->getMessage(), 500);
}