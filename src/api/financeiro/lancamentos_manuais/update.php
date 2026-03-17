<?php
/**
 * API: Atualizar Lançamento Manual de Receita
 * Atualiza um CT-e criado manualmente
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../middleware/auth.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        msg('Método não permitido', 'error');
    }
    
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => $authResult['message']
        ]);
        exit();
    }

    $dominio = strtolower($authResult['domain']);
    $username = $authResult['username'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Campos obrigatórios
    $nro_cte = $input['nro_cte'] ?? null;
    $ser_cte = $input['ser_cte'] ?? null;
    $data_emissao = $input['data_emissao'] ?? null;
    $sigla_emit = strtoupper($input['sigla_emit'] ?? '');
    $cnpj_pag = $input['cnpj_pag'] ?? null; // ✅ CNPJ do cliente (não código)
    $nome_pag = strtoupper($input['nome_pag'] ?? '');
    $peso_real = isset($input['peso_real']) ? round((float)$input['peso_real'], 3) : 0;
    $vlr_merc = isset($input['vlr_merc']) ? round((float)$input['vlr_merc'], 2) : 0;
    $vlr_frete = isset($input['vlr_frete']) ? round((float)$input['vlr_frete'], 2) : 0;
    $vlr_icms = isset($input['vlr_icms']) ? round((float)$input['vlr_icms'], 2) : 0;
    
    // Validações
    if (!$nro_cte || !$ser_cte) {
        msg('Número e série do CT-e são obrigatórios', 'error');
    }
    
    if (!$data_emissao) {
        msg('Data de emissão é obrigatória', 'error');
    }
    
    if (!$sigla_emit) {
        msg('Unidade é obrigatória', 'error');
    }
    
    if (!$cnpj_pag) {
        msg('Cliente é obrigatório', 'error');
    }
    
    // Conectar ao banco
    $conn = getDBConnection();
    @pg_query($conn, "SET TIMEZONE TO 'America/Sao_Paulo'");
    
    $tableName = "{$dominio}_cte";
    $clienteTable = "{$dominio}_cliente";
    
    // Verificar se o CT-e existe e é lançamento manual usando sql()
    $checkQuery = "
        SELECT COUNT(*) as count
        FROM {$tableName}
        WHERE nro_cte = $1 AND ser_cte = $2 AND tp_documento = 'MANUAL'
    ";
    
    $checkResult = sql($checkQuery, [$nro_cte, $ser_cte], $conn);
    
    if (!$checkResult) {
        closeDBConnection($conn);
        msg('Erro ao verificar lançamento: ' . pg_last_error($conn), 'error');
    }
    
    $exists = (int)pg_fetch_result($checkResult, 0, 0) > 0;
    
    if (!$exists) {
        closeDBConnection($conn);
        msg('Lançamento manual não encontrado', 'error');
    }
    
    // Buscar dados do cliente (seq_cidade e CNPJ) usando sql()
    $clienteQuery = "
        SELECT 
            seq_cidade,
            cnpj
        FROM {$clienteTable}
        WHERE cnpj = $1
    ";
    
    $clienteResult = sql($clienteQuery, [$cnpj_pag], $conn);
    
    if (!$clienteResult || pg_num_rows($clienteResult) === 0) {
        closeDBConnection($conn);
        msg('Cliente não encontrado', 'error');
    }
    
    $clienteData = pg_fetch_assoc($clienteResult);
    $seq_cidade = $clienteData['seq_cidade'];
    $cnpj_cliente = $clienteData['cnpj'];
    
    // Buscar CEP da faixa_cep usando sql()
    $cepQuery = "
        SELECT cep_ini
        FROM faixa_cep
        WHERE seq_cidade = $1
        LIMIT 1
    ";
    
    $cepResult = sql($cepQuery, [$seq_cidade], $conn);
    
    $cep_entrega = '';
    if ($cepResult && pg_num_rows($cepResult) > 0) {
        $cep_entrega = pg_fetch_result($cepResult, 0, 0);
    }
    
    // Atualizar CT-e com TODAS as colunas editáveis usando sql()
    $updateQuery = "
        UPDATE {$tableName}
        SET 
            seq_cidade_emit = $1,
            seq_cidade_dest = $2,
            seq_cidade_entr = $3,
            seq_cidade_pag = $4,
            cnpj_emit = $5,
            cnpj_dest = $6,
            cnpj_pag = $7,
            data_emissao = $8,
            data_prev_ent_ori = $9,
            data_prev_ent = $10,
            data_entrega = $11,
            sigla_emit = $12,
            sigla_dest = $13,
            peso_real = $14,
            peso_calc = $15,
            vlr_frete = $16,
            vlr_merc = $17,
            vlr_icms = $18,
            cep_entrega = $19,
            nome_emit = $20,
            nome_dest = $21,
            nome_pag = $22,
            custo_icms = $23,
            login_inclusao = $24
        WHERE nro_cte = $25 AND ser_cte = $26
        RETURNING 
            nro_cte,
            ser_cte,
            (ser_cte || TRIM(TO_CHAR(nro_cte, '000000'))) as cte_formatado
    ";
    
    $updateResult = sql($updateQuery, [
        $seq_cidade,                 // $1 - seq_cidade_emit
        $seq_cidade,                 // $2 - seq_cidade_dest
        $seq_cidade,                 // $3 - seq_cidade_entr
        $seq_cidade,                 // $4 - seq_cidade_pag
        $cnpj_cliente,               // $5 - cnpj_emit
        $cnpj_cliente,               // $6 - cnpj_dest
        $cnpj_cliente,               // $7 - cnpj_pag
        $data_emissao,               // $8 - data_emissao
        $data_emissao,               // $9 - data_prev_ent_ori
        $data_emissao,               // $10 - data_prev_ent
        $data_emissao,               // $11 - data_entrega
        $sigla_emit,                 // $12 - sigla_emit
        $sigla_emit,                 // $13 - sigla_dest
        $peso_real,                  // $14 - peso_real
        $peso_real,                  // $15 - peso_calc
        $vlr_frete,                  // $16 - vlr_frete
        $vlr_merc,                   // $17 - vlr_merc
        $vlr_icms,                   // $18 - vlr_icms
        $cep_entrega,                // $19 - cep_entrega
        $nome_pag,                   // $20 - nome_emit
        $nome_pag,                   // $21 - nome_dest
        $nome_pag,                   // $22 - nome_pag
        $vlr_icms,                   // $23 - custo_icms
        $username,                   // $24 - login_inclusao
        $nro_cte,                    // $25 - WHERE nro_cte
        $ser_cte                     // $26 - WHERE ser_cte
    ], $conn);
    
    if (!$updateResult) {
        closeDBConnection($conn);
        msg('Erro ao atualizar lançamento: ' . pg_last_error($conn), 'error');
    }
    
    $updatedRecord = pg_fetch_assoc($updateResult);
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'message' => 'Lançamento manual atualizado com sucesso',
        'lancamento' => [
            'nro_cte' => (int)$updatedRecord['nro_cte'],
            'ser_cte' => trim($updatedRecord['ser_cte']),
            'cte' => trim($updatedRecord['cte_formatado'])
        ]
    ]);
    
} catch (Exception $e) {
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    msg('Erro: ' . $e->getMessage(), 'error');
}