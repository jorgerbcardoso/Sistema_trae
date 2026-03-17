<?php
/**
 * API: Listar Domínios
 * GET /presto/api/admin/domains/list.php
 * 
 * Retorna todos os domínios cadastrados no sistema
 * Apenas usuários do domínio XXX podem acessar
 */

require_once __DIR__ . '/../../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('GET');

try {
    // Obter usuário autenticado
    $user = getCurrentUser();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'NÃO AUTENTICADO'
        ]);
        exit();
    }

    $domain = $user['domain'];

    // Verificar se é super admin (domínio XXX)
    if ($domain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE GERENCIAR DOMÍNIOS.'
        ]);
        exit();
    }

    // Buscar todos os domínios com informações básicas
    $query = "
        SELECT 
            d.domain,
            d.name,
            d.is_active,
            COUNT(DISTINCT u.id) as total_users,
            MAX(u.created_at) as last_created
        FROM domains d
        LEFT JOIN users u ON u.domain = d.domain
        GROUP BY d.domain, d.name, d.is_active
        ORDER BY d.domain
    ";
    
    $result = sql($query);
    
    $domainsResult = [];
    while ($row = pg_fetch_assoc($result)) {
        $domain_code = $row['domain'];
        
        // Contar itens de menu disponíveis para o domínio na tabela domain_menu_items
        $permQuery = "
            SELECT COUNT(*) as total_menu_items
            FROM domain_menu_items
            WHERE domain = $1
        ";
        $permResult = sql($permQuery, [$domain_code]);
        $permCount = pg_fetch_assoc($permResult);

        $domainsResult[] = [
            'domain' => $domain_code,
            'name' => $row['name'],
            'total_users' => (int)$row['total_users'],
            'total_permissions' => (int)($permCount['total_menu_items'] ?? 0),
            'last_created' => $row['last_created'],
            'is_super_admin' => $domain_code === 'XXX',
            'is_active' => pgBoolToPHP($row['is_active'])
        ];
    }

    echo json_encode([
        'success' => true,
        'domains' => $domainsResult,
        'total' => count($domainsResult)
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao listar domínios: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO LISTAR DOMÍNIOS',
        'error' => $e->getMessage()
    ]);
}