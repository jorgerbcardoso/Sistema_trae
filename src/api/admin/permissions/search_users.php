<?php
/**
 * API: Buscar Usuários
 * GET /presto/api/admin/permissions/search_users.php?search=joao&domain=VCS
 *
 * Busca usuários por login ou nome
 * Apenas usuários ADMIN podem acessar
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../middleware/auth.php';

try {
    // Verificar autenticação
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        msg($authResult['message'], 'error', 401);
        exit();
    }

    $userDomain = $authResult['domain'];
    $isAdmin = $authResult['is_admin'] ?? false;
    $currentUsername = $authResult['user']['username'] ?? ''; // ✅ CORRIGIDO: username está dentro de 'user'

    // Verificar se é admin
    if (!$isAdmin) {
        msg('ACESSO NEGADO. APENAS ADMINS PODEM BUSCAR USUÁRIOS.', 'error', 403);
        exit();
    }

    // Receber parâmetros
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : $userDomain;

    if (empty($search)) {
        msg('TERMO DE BUSCA É OBRIGATÓRIO', 'error', 400);
        exit();
    }

    if (strlen($search) < 2) {
        msg('TERMO DE BUSCA DEVE TER NO MÍNIMO 2 CARACTERES', 'error', 400);
        exit();
    }

    // ✅ Conectar ao banco
    $g_sql = connect();

    // Buscar usuários
    // 🔒 REGRA SIMPLES: 
    //    - Se logado como "presto" → mostrar "presto" na busca
    //    - Se logado como outro usuário → NÃO mostrar "presto" na busca
    //    - Na replicação → NUNCA mostrar "presto"
    $forReplication = isset($_GET['for_replication']) && $_GET['for_replication'] === 'true';
    
    $excludePresto = "";
    
    // Se NÃO for presto logado OU for para replicação, excluir presto
    if ($currentUsername !== 'presto' || $forReplication) {
        $excludePresto = "AND username != 'presto'";
    }
    
    $searchParam = '%' . strtoupper($search) . '%';

    $query = "
        SELECT
            username,
            full_name as name,
            email,
            domain,
            is_admin,
            unidade
        FROM users
        WHERE domain = $1
            AND is_active = true
            AND (
                UPPER(username) LIKE $2
                OR UPPER(full_name) LIKE $2
            )
            $excludePresto
        ORDER BY username
        LIMIT 20
    ";

    $result = sql($g_sql, $query, false, [$domain, $searchParam]);

    if (!$result) {
        throw new Exception('Erro ao buscar usuários: ' . pg_last_error($g_sql));
    }

    $users = [];
    while ($row = pg_fetch_assoc($result)) {
        $users[] = [
            'username' => $row['username'],
            'name' => $row['name'],
            'email' => $row['email'],
            'domain' => $row['domain'],
            'is_admin' => pgBoolToPHP($row['is_admin']),
            'unidade' => $row['unidade']
        ];
    }

    echo json_encode([
        'success' => true,
        'users' => $users
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao buscar usuários: " . $e->getMessage());
    msg('ERRO AO BUSCAR USUÁRIOS: ' . $e->getMessage(), 'error', 500);
}