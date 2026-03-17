<?php
/**
 * API: Inativar/Reativar Fornecedor
 * PUT /api/compras/fornecedores/toggle-status.php
 * Body: { "seq_fornecedor": 1 }
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('PUT');

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
    $username = $user['username'];
    
    // ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
    $prefix = strtolower($domain);
    
    // Obter dados do body
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['seq_fornecedor']) || empty($input['seq_fornecedor'])) {
        throw new Exception('SEQ_FORNECEDOR NÃO INFORMADO');
    }

    $seq_fornecedor = (int)$input['seq_fornecedor'];

    global $g_sql;

    // Buscar status atual
    $queryCheck = "SELECT ativo FROM {$prefix}_fornecedor WHERE seq_fornecedor = $1";
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    $resultCheck = sql($queryCheck, [$seq_fornecedor], $g_sql);
    $fornecedor = pg_fetch_assoc($resultCheck);
    
    if (!$fornecedor) {
        throw new Exception('FORNECEDOR NÃO ENCONTRADO');
    }

    // Inverter status
    $novoStatus = $fornecedor['ativo'] === 'S' ? 'N' : 'S';
    $acao = $novoStatus === 'S' ? 'REATIVADO' : 'INATIVADO';

    // Atualizar status
    $query = "
        UPDATE {$prefix}_fornecedor 
        SET 
            ativo = $1,
            data_alteracao = CURRENT_DATE,
            hora_alteracao = CURRENT_TIME,
            login_alteracao = $2
        WHERE seq_fornecedor = $3
    ";
    
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    sql($query, [
        $novoStatus,
        strtoupper($username),
        $seq_fornecedor
    ], $g_sql);

    // ✅ NÃO usar msg() em sucesso - apenas retornar JSON
    echo json_encode([
        'success' => true,
        'novo_status' => $novoStatus
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao alterar status do fornecedor: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}