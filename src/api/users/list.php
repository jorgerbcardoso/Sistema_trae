<?php
/**
 * API de Listagem de Usuários
 * GET /api/users/list.php?domain=XXX
 * 
 * Headers: Authorization: Bearer <token>
 * Retorna: { "success": true, "users": [...] }
 */

require_once __DIR__ . '/../config.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Apenas GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    returnError('Método não permitido', 405);
}

// Requer autenticação
requireAuth();

try {
    $currentUser = getCurrentUser();
    $domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : null;
    
    // Verificar se o domínio foi fornecido
    if (empty($domain)) {
        returnError('Domínio não fornecido', 400);
    }
    
    // Verificar se o usuário pode acessar este domínio
    if ($domain !== $currentUser['domain'] && !$currentUser['is_super_admin']) {
        returnError('Acesso negado a este domínio', 403);
    }
    
    $conn = getDBConnection();
    
    // ============================================
    // LISTAR USUÁRIOS DO DOMÍNIO
    // ============================================
    
    // Nome da tabela de setores com prefixo de domínio
    $tableSetores = $domain . '_setores';
    
    // ✅ CORREÇÃO: Usar pg_query_params() porque pg_prepare() cacheia queries
    $query = "SELECT 
            u.id,
            u.domain,
            u.username,
            u.email,
            u.full_name,
            u.is_active,
            u.is_admin,
            u.unidade,
            u.troca_unidade,
            u.aprova_orcamento,
            u.nro_setor,
            u.nro_setor_compras,
            u.unidades,
            s.descricao as setor_descricao,
            sc.descricao as setor_compra_descricao,
            u.created_at,
            u.last_login
         FROM users u
         LEFT JOIN {$tableSetores} s ON u.nro_setor = s.nro_setor
         LEFT JOIN {$tableSetores} sc ON u.nro_setor_compras = sc.nro_setor
         WHERE u.domain = $1
         ORDER BY 
             CASE WHEN u.username = 'admin' THEN 0 ELSE 1 END,
             u.is_admin DESC,
             u.full_name ASC";
    
    $result = pg_query_params($conn, $query, [$domain]);
    
    if (!$result) {
        $pgError = pg_last_error($conn);
        error_log("[USERS-LIST] Query Error: " . $pgError);
        error_log("[USERS-LIST] Query: " . $query);
        throw new Exception('Erro ao executar query: ' . $pgError);
    }
    
    $users = [];
    while ($row = pg_fetch_assoc($result)) {
        $users[] = [
            'id' => (int)$row['id'],
            'domain' => $row['domain'],
            'username' => $row['username'],
            'email' => $row['email'],
            'full_name' => $row['full_name'],
            'is_active' => pgBoolToPHP($row['is_active']),
            'is_admin' => pgBoolToPHP($row['is_admin']),
            'unidade' => $row['unidade'],
            'troca_unidade' => pgBoolToPHP($row['troca_unidade']),
            'aprova_orcamento' => pgBoolToPHP($row['aprova_orcamento']),
            'nro_setor' => isset($row['nro_setor']) ? (int)$row['nro_setor'] : null,
            'nro_setor_compra' => isset($row['nro_setor_compras']) ? (int)$row['nro_setor_compras'] : null,
            'unidades' => $row['unidades'], // ✅ NOVO - Unidades permitidas
            'setor_descricao' => $row['setor_descricao'] ?? null,
            'setor_compra_descricao' => $row['setor_compra_descricao'] ?? null,
            'created_at' => $row['created_at'],
            'last_login' => $row['last_login']
        ];
    }
    
    closeDBConnection($conn);
    
    returnSuccess([
        'users' => $users,
        'total' => count($users)
    ]);
    
} catch (Exception $e) {
    error_log("[USERS-LIST] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao listar usuários', 500);
}