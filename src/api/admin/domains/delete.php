<?php
/**
 * API: Deletar Domínio
 * DELETE /presto/api/admin/domains/delete.php
 * 
 * Remove um domínio e todos os seus usuários
 * Apenas usuários do domínio XXX podem acessar
 */

require_once __DIR__ . '/../../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('DELETE');

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

    // Verificar se é super admin
    if ($domain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE DELETAR DOMÍNIOS.'
        ]);
        exit();
    }

    // Receber dados
    $data = getRequestInput();

    if (empty($data['domain'])) {
        msg('DOMÍNIO É OBRIGATÓRIO', 'error');
    }

    $domainToDelete = strtoupper(trim($data['domain']));

    // Não permitir deletar XXX
    if ($domainToDelete === 'XXX') {
        msg('NÃO É POSSÍVEL DELETAR O DOMÍNIO SUPER ADMIN (XXX)', 'error');
    }

    // Iniciar transação
    sql('BEGIN');

    try {
        // ✅ Deletar registros da nova tabela domain_menu_items
        $deleteMenuItems = "DELETE FROM domain_menu_items WHERE domain = $1";
        sql($deleteMenuItems, [$domainToDelete]);

        // Deletar usuários
        $deleteUsers = "DELETE FROM users WHERE domain = $1";
        $resultUsers = sql($deleteUsers, [$domainToDelete]);
        $deletedUsers = pg_affected_rows($resultUsers);

        // Deletar domínio
        $deleteDomain = "DELETE FROM domains WHERE domain = $1";
        sql($deleteDomain, [$domainToDelete]);

        // Commitar transação
        sql('COMMIT');

        echo json_encode([
            'success' => true,
            'message' => 'DOMÍNIO DELETADO COM SUCESSO',
            'domain' => $domainToDelete,
            'users_deleted' => $deletedUsers
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    } catch (Exception $e) {
        sql('ROLLBACK');
        throw $e;
    }

} catch (Exception $e) {
    error_log("Erro ao deletar domínio: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO DELETAR DOMÍNIO',
        'error' => $e->getMessage()
    ]);
}
