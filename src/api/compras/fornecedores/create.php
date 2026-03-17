<?php
/**
 * API: Criar Fornecedor
 * POST /api/compras/fornecedores/create.php
 * 
 * Body: {
 *   "cnpj": "12.345.678/0001-90",
 *   "nome": "FORNECEDOR TESTE LTDA",
 *   "endereco": "RUA TESTE, 123",
 *   "bairro": "CENTRO",
 *   "seq_cidade": 123,
 *   "email": "contato@fornecedor.com",
 *   "telefone": "(11) 1234-5678",
 *   "ativo": "S"
 * }
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

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
    if (empty($data['cnpj'])) {
        throw new Exception('CNPJ É OBRIGATÓRIO');
    }
    if (empty($data['nome'])) {
        throw new Exception('NOME É OBRIGATÓRIO');
    }

    global $g_sql;

    // Verificar se CNPJ já existe
    $checkQuery = "SELECT seq_fornecedor FROM {$prefix}_fornecedor WHERE cnpj = $1";
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    $checkResult = sql($checkQuery, [strtoupper($data['cnpj'])], $g_sql);
    
    if (pg_num_rows($checkResult) > 0) {
        throw new Exception('CNPJ JÁ CADASTRADO');
    }

    // Inserir fornecedor
    $query = "
        INSERT INTO {$prefix}_fornecedor (
            cnpj,
            nome,
            endereco,
            bairro,
            seq_cidade,
            email,
            telefone,
            ativo,
            login_inclusao
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING seq_fornecedor
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
        $username
    ];
    
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    $result = sql($query, $params, $g_sql);
    $row = pg_fetch_assoc($result);
    $seq_fornecedor = (int)$row['seq_fornecedor'];

    // ✅ NÃO usar msg() em sucesso - apenas retornar JSON
    echo json_encode([
        'success' => true,
        'seq_fornecedor' => $seq_fornecedor
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao criar fornecedor: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}