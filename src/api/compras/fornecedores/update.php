<?php
/**
 * API: Atualizar Fornecedor
 * PUT /api/compras/fornecedores/update.php
 * 
 * Body: {
 *   "seq_fornecedor": 1,
 *   "cnpj": "12.345.678/0001-90",
 *   "nome": "FORNECEDOR TESTE LTDA",
 *   ...
 * }
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
    
    // Receber dados JSON
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (!$data) {
        throw new Exception('DADOS INVÁLIDOS');
    }

    // Validar campos obrigatórios
    if (empty($data['seq_fornecedor'])) {
        throw new Exception('SEQ_FORNECEDOR É OBRIGATÓRIO');
    }
    if (empty($data['cnpj'])) {
        throw new Exception('CNPJ É OBRIGATÓRIO');
    }
    if (empty($data['nome'])) {
        throw new Exception('NOME É OBRIGATÓRIO');
    }

    global $g_sql;

    // Verificar se CNPJ já existe em outro registro
    $checkQuery = "SELECT seq_fornecedor FROM {$prefix}_fornecedor WHERE cnpj = $1 AND seq_fornecedor <> $2";
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    $checkResult = sql($checkQuery, [strtoupper($data['cnpj']), (int)$data['seq_fornecedor']], $g_sql);
    
    if (pg_num_rows($checkResult) > 0) {
        throw new Exception('CNPJ JÁ CADASTRADO PARA OUTRO FORNECEDOR');
    }

    // Atualizar fornecedor
    $query = "
        UPDATE {$prefix}_fornecedor SET
            cnpj = $1,
            nome = $2,
            endereco = $3,
            bairro = $4,
            seq_cidade = $5,
            email = $6,
            telefone = $7,
            ativo = $8,
            data_alteracao = CURRENT_DATE,
            hora_alteracao = CURRENT_TIME,
            login_alteracao = $9
        WHERE seq_fornecedor = $10
    ";
    
    $params = [
        strtoupper($data['cnpj']),
        strtoupper($data['nome']),
        !empty($data['endereco']) ? strtoupper($data['endereco']) : null,
        !empty($data['bairro']) ? strtoupper($data['bairro']) : null,
        !empty($data['seq_cidade']) ? (int)$data['seq_cidade'] : null,
        !empty($data['email']) ? strtoupper($data['email']) : null,
        !empty($data['telefone']) ? $data['telefone'] : null,
        !empty($data['ativo']) ? $data['ativo'] : 'S',
        $username,
        (int)$data['seq_fornecedor']
    ];
    
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    sql($query, $params, $g_sql);

    // ✅ NÃO usar msg() em sucesso - apenas retornar JSON
    echo json_encode([
        'success' => true
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao atualizar fornecedor: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}