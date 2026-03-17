<?php
/**
 * API: Deletar Fornecedor
 * DELETE /api/compras/fornecedores/delete.php?seq_fornecedor=1
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

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
    
    // ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
    $prefix = strtolower($domain);
    
    // Validar parâmetro
    if (!isset($_GET['seq_fornecedor']) || empty($_GET['seq_fornecedor'])) {
        throw new Exception('SEQ_FORNECEDOR NÃO INFORMADO');
    }

    $seq_fornecedor = (int)$_GET['seq_fornecedor'];

    global $g_sql;

    // Verificar se existem registros relacionados
    $checkQueries = [
        "SELECT COUNT(*) as total FROM {$prefix}_pedido WHERE seq_fornecedor = $1",
        "SELECT COUNT(*) as total FROM {$prefix}_orcamento_fornecedor WHERE seq_fornecedor = $1",
        "SELECT COUNT(*) as total FROM {$prefix}_orcamento_cotacao WHERE seq_fornecedor = $1"
    ];

    foreach ($checkQueries as $checkQuery) {
        // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
        $checkResult = sql($checkQuery, [$seq_fornecedor], $g_sql);
        $checkRow = pg_fetch_assoc($checkResult);
        
        if ((int)$checkRow['total'] > 0) {
            throw new Exception('NÃO É POSSÍVEL EXCLUIR. EXISTEM REGISTROS RELACIONADOS.');
        }
    }

    // Deletar fornecedor
    $query = "DELETE FROM {$prefix}_fornecedor WHERE seq_fornecedor = $1";
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    sql($query, [$seq_fornecedor], $g_sql);

    // ✅ NÃO usar msg() em sucesso - apenas retornar JSON
    echo json_encode([
        'success' => true
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao deletar fornecedor: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}