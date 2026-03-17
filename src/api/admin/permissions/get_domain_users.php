<?php
/**
 * API: Buscar Todos os Usuários de um Domínio
 * GET /presto/api/admin/permissions/get_domain_users.php?domain=VCS
 *
 * Retorna todos os usuários ativos do domínio
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
        http_response_code(401);
        msg($authResult['message'], 'error', 401);
        exit();
    }

    $userDomain = $authResult['domain'];
    $isAdmin = $authResult['is_admin'] ?? false;
    $currentUsername = $authResult['user']['username'] ?? ''; // ✅ CORRIGIDO: username está dentro de 'user'

    // Verificar se é admin
    if (!$isAdmin) {
        http_response_code(403);
        msg('ACESSO NEGADO. APENAS ADMINS PODEM ACESSAR.', 'error', 403);
        exit();
    }

    // Receber domínio
    $domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : $userDomain;

    // ✅ Conectar ao banco
    $g_sql = connect();

    // Buscar todos os usuários do domínio
    // 🔒 REGRA SIMPLES: 
    //    - Se logado como "presto" → mostrar "presto" na lista
    //    - Se logado como outro usuário → NÃO mostrar "presto" na lista
    //    - Na replicação → NUNCA mostrar "presto"
    $forReplication = isset($_GET['for_replication']) && $_GET['for_replication'] === 'true';
    
    $excludePresto = "";
    
    // Se NÃO for presto logado OU for para replicação, excluir presto
    if ($currentUsername !== 'presto' || $forReplication) {
        $excludePresto = "AND username != 'presto'";
    }
    
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
            $excludePresto
        ORDER BY username
    ";

    $result = sql($g_sql, $query, false, [$domain]);

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