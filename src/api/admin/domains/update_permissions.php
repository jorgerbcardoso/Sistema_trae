<?php
/**
 * API: Atualizar Permissões do Domínio
 * POST /api/admin/domains/update_permissions.php
 * 
 * Atualiza os itens de menu disponíveis para o domínio
 * Apenas usuários do domínio XXX podem acessar
 */

require_once __DIR__ . '/../../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

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
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE ATUALIZAR PERMISSÕES.'
        ]);
        exit();
    }

    // Receber dados
    $data = getRequestInput();

    if (empty($data['domain'])) {
        msg('DOMÍNIO É OBRIGATÓRIO', 'error');
    }

    if (!isset($data['item_ids']) || !is_array($data['item_ids'])) {
        msg('LISTA DE IDS É OBRIGATÓRIA', 'error');
    }

    $targetDomain = strtoupper(trim($data['domain']));
    $itemIds = $data['item_ids'];

    // Verificar se o domínio existe
    $checkQuery = "SELECT COUNT(*) as total FROM domains WHERE domain = $1";
    $result = sql($checkQuery, [$targetDomain]);
    $exists = pg_fetch_assoc($result);

    if ($exists['total'] == 0) {
        msg('DOMÍNIO NÃO ENCONTRADO', 'error');
    }

    // Iniciar transação
    sql('BEGIN');

    try {
        // Deletar todas as permissões atuais do domínio
        $deleteQuery = "DELETE FROM domain_menu_items WHERE domain = $1";
        sql($deleteQuery, [$targetDomain]);

        // Inserir novas permissões
        if (count($itemIds) > 0) {
            // Preparar valores para INSERT em massa
            $values = [];
            $params = [$targetDomain];
            $paramIndex = 2;
            
            foreach ($itemIds as $itemId) {
                $values[] = "($1, $" . $paramIndex . ")";
                $params[] = (int)$itemId;
                $paramIndex++;
            }
            
            $insertQuery = "
                INSERT INTO domain_menu_items (domain, id)
                VALUES " . implode(', ', $values);
            
            sql($insertQuery, $params);
        }

        // Commitar transação
        sql('COMMIT');

        echo json_encode([
            'success' => true,
            'message' => 'PERMISSÕES ATUALIZADAS COM SUCESSO',
            'domain' => $targetDomain,
            'total_items' => count($itemIds)
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    } catch (Exception $e) {
        sql('ROLLBACK');
        throw $e;
    }

} catch (Exception $e) {
    error_log("Erro ao atualizar permissões: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO ATUALIZAR PERMISSÕES',
        'error' => $e->getMessage()
    ]);
}
