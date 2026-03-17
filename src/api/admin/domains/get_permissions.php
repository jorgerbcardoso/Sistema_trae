<?php
/**
 * API: Buscar Permissões do Domínio
 * GET /api/admin/domains/get_permissions.php?domain=XXX
 * 
 * Retorna os IDs dos itens de menu disponíveis para o domínio
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

    $authDomain = $user['domain'];

    // Verificar se é super admin (domínio XXX)
    if ($authDomain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE ACESSAR.'
        ]);
        exit();
    }

    // Receber parâmetro
    if (empty($_GET['domain'])) {
        msg('DOMÍNIO É OBRIGATÓRIO', 'error');
    }

    $targetDomain = strtoupper(trim($_GET['domain']));

    // Buscar IDs dos itens de menu do domínio
    $query = "
        SELECT id
        FROM domain_menu_items
        WHERE domain = $1
        ORDER BY id
    ";
    
    $result = sql($query, [$targetDomain]);
    
    $itemIds = [];
    while ($row = pg_fetch_assoc($result)) {
        $itemIds[] = (int)$row['id'];
    }

    echo json_encode([
        'success' => true,
        'domain' => $targetDomain,
        'item_ids' => $itemIds,
        'total' => count($itemIds)
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao buscar permissões: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO BUSCAR PERMISSÕES',
        'error' => $e->getMessage()
    ]);
}