<?php
/**
 * API: Criar Lançamento Manual de Receita
 * Cria um novo CT-e manualmente
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
    
    // ✅ Campos obrigatórios (usando CNPJ ao invés de código)
    $data_emissao = $input['data_emissao'] ?? null;
    $sigla_emit = strtoupper($input['sigla_emit'] ?? '');
    $cnpj_pag = $input['cnpj_pag'] ?? null; // ✅ CNPJ do cliente
    $nome_pag = strtoupper($input['nome_pag'] ?? '');
    $peso_real = isset($input['peso_real']) ? round((float)$input['peso_real'], 3) : 0;
    $vlr_merc = isset($input['vlr_merc']) ? round((float)$input['vlr_merc'], 2) : 0;
    $vlr_frete = isset($input['vlr_frete']) ? round((float)$input['vlr_frete'], 2) : 0;
    $vlr_icms = isset($input['vlr_icms']) ? round((float)$input['vlr_icms'], 2) : 0;
    
    // Validações
    if (!$data_emissao) {
        msg('Data de emissão é obrigatória', 'error');
    }
    
    if (!$sigla_emit) {
        msg('Unidade é obrigatória', 'error');
    }
    
    if (!$cnpj_pag) {
        msg('Cliente é obrigatório', 'error');
    }
    
    if (!$nome_pag) {
        msg('Nome do cliente é obrigatório', 'error');
    }
    
    // Conectar ao banco
    $conn = getDBConnection();
    @pg_query($conn, "SET TIMEZONE TO 'America/Sao_Paulo'");
    
    $tableName = "{$dominio}_cte";
    $clienteTable = "{$dominio}_cliente";
    
    // ✅ BUSCAR dados do cliente PELO CNPJ
    $clienteQuery = "
        SELECT 
            nome,
            seq_cidade,
            cnpj
        FROM {$clienteTable}
        WHERE cnpj = $1
    ";
    
    $clienteResult = sql($clienteQuery, [$cnpj_pag], $conn);
    
    // ✅ VALIDAÇÃO: Cliente DEVE existir na base
    if (!$clienteResult || pg_num_rows($clienteResult) === 0) {
        closeDBConnection($conn);
        error_log("Cliente não encontrado - CNPJ: {$cnpj_pag}, dominio: {$dominio}");
        msg('Cliente não encontrado na base de dados. CNPJ: ' . $cnpj_pag, 'error');
    }
    
    $clienteData = pg_fetch_assoc($clienteResult);
    $seq_cidade = $clienteData['seq_cidade'];
    $cnpj_cliente = $clienteData['cnpj'];
    $nome_cliente = $clienteData['nome']; // ✅ Usar o nome da base
    
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
    
    // Obter próximo número de CT-e para a série 'MAN' usando sql()
    $serieQuery = "
        SELECT COALESCE(MAX(nro_cte), 0) + 1 as proximo_numero
        FROM {$tableName}
        WHERE ser_cte = 'MAN'
    ";
    
    $serieResult = sql($serieQuery, [], $conn);
    
    if (!$serieResult) {
        closeDBConnection($conn);
        msg('Erro ao obter próximo número de CT-e: ' . pg_last_error($conn), 'error');
    }
    
    $proximoNumero = (int)pg_fetch_result($serieResult, 0, 0);
    
    // Inserir CT-e com TODAS as colunas usando sql()
    $insertQuery = "
        INSERT INTO {$tableName} (
            ser_cte,
            nro_cte,
            chave_cte,
            seq_cte_ssw,
            tp_documento,
            tp_frete,
            tp_cobr,
            seq_cidade_emit,
            seq_cidade_dest,
            seq_cidade_entr,
            seq_cidade_pag,
            cnpj_emit,
            cnpj_dest,
            cnpj_pag,
            placa_coleta,
            data_emissao,
            data_prev_ent_ori,
            data_prev_ent,
            data_entrega,
            sigla_emit,
            sigla_dest,
            cod_mercadoria,
            cod_especie,
            qtde_vol,
            cubagem,
            peso_real,
            peso_calc,
            vlr_frete,
            vlr_merc,
            vlr_icms,
            vlr_pis_cofins,
            vlr_expedicao,
            vlr_recepcao,
            status,
            motivo_cancel,
            observacao,
            data_inclusao,
            hora_inclusao,
            login_inclusao,
            nfs,
            tab_calc,
            cep_entrega,
            endereco_entrega,
            bairro_entrega,
            loc_dif_ent,
            nome_emit,
            nome_dest,
            nome_pag,
            custo_seguro,
            custo_icms,
            custo_pis_cofins,
            custo_gris,
            custo_pedagio,
            custo_expedicao,
            custo_transferencia,
            custo_transbordo,
            custo_vendedor,
            custo_recepcao,
            custo_desp_div,
            custo_transferencia_real
        ) VALUES (
            'MAN', $1, '', 0, 'MANUAL',
            'C', 'V',
            $2, $3, $4, $5,
            $6, $7, $8,
            'ARMAZEM',
            $9, $10, $11, $12,
            $13, $14,
            1, 1, 1, 0,
            $15, $16,
            $17, $18, $19, 0, 0, 0,
            'P', '', 'RECEITA INCLUÍDA MANUALMENTE',
            CURRENT_DATE, CURRENT_TIME, $20,
            '1/1', 'INFORMADO',
            $21, '', '', '',
            $22, $23, $24,
            0, $25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        )
        RETURNING 
            nro_cte,
            ser_cte,
            (ser_cte || TRIM(TO_CHAR(nro_cte, '000000'))) as cte_formatado
    ";
    
    $insertResult = sql($insertQuery, [
        $proximoNumero,              // $1 - nro_cte
        $seq_cidade,                 // $2 - seq_cidade_emit
        $seq_cidade,                 // $3 - seq_cidade_dest
        $seq_cidade,                 // $4 - seq_cidade_entr
        $seq_cidade,                 // $5 - seq_cidade_pag
        $cnpj_cliente,               // $6 - cnpj_emit
        $cnpj_cliente,               // $7 - cnpj_dest
        $cnpj_cliente,               // $8 - cnpj_pag
        $data_emissao,               // $9 - data_emissao
        $data_emissao,               // $10 - data_prev_ent_ori
        $data_emissao,               // $11 - data_prev_ent
        $data_emissao,               // $12 - data_entrega
        $sigla_emit,                 // $13 - sigla_emit
        $sigla_emit,                 // $14 - sigla_dest
        $peso_real,                  // $15 - peso_real
        $peso_real,                  // $16 - peso_calc
        $vlr_frete,                  // $17 - vlr_frete
        $vlr_merc,                   // $18 - vlr_merc
        $vlr_icms,                   // $19 - vlr_icms
        $username,                   // $20 - login_inclusao
        $cep_entrega,                // $21 - cep_entrega
        $nome_pag,                   // $22 - nome_emit
        $nome_pag,                   // $23 - nome_dest
        $nome_pag,                   // $24 - nome_pag
        $vlr_icms                    // $25 - custo_icms
    ], $conn);
    
    if (!$insertResult) {
        closeDBConnection($conn);
        msg('Erro ao criar lançamento: ' . pg_last_error($conn), 'error');
    }
    
    $newRecord = pg_fetch_assoc($insertResult);
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'message' => 'Lançamento manual criado com sucesso',
        'lancamento' => [
            'nro_cte' => (int)$newRecord['nro_cte'],
            'ser_cte' => trim($newRecord['ser_cte']),
            'cte' => trim($newRecord['cte_formatado'])
        ]
    ]);
    
} catch (Exception $e) {
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    msg('Erro: ' . $e->getMessage(), 'error');
}