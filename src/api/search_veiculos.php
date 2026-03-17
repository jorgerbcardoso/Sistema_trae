<?php
/**
 * ================================================================
 * API: BUSCAR VEÍCULOS (AUTOCOMPLETE)
 * ================================================================
 * Retorna lista de veículos filtrados por placa, tipo ou proprietário
 * Requer autenticação via token
 * ✅ MODIFICADO: Se search vazio, retorna TODOS os veículos
 * Se search tiver 1-2 caracteres, retorna array vazio
 * Se search tiver 3+ caracteres, busca filtrada
 *
 * POST /api/search_veiculos.php
 * Body: { search: "ABC" } ou { search: "" } para todos
 * Response: JSON com array de veículos (limite 100)
 * ================================================================
 */

require_once __DIR__ . '/config.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

try {
    // ================================================================
    // AUTENTICAÇÃO
    // ================================================================
    $auth = authenticateAndGetUser();
    $user = $auth['user'];
    $domain = $auth['domain'];

    // ================================================================
    // RECEBER E PROCESSAR PARÂMETROS
    // ================================================================
    $input = getRequestInput();
    $search = $input['search'] ?? '';

    // ✅ MODIFICADO: Se search vazio, retornar TODOS os veículos
    // Se search tiver 1-2 caracteres (não vazio), retornar array vazio
    if (strlen($search) > 0 && strlen($search) < 3) {
        respondJson([
            'success' => true,
            'data' => []
        ]);
    }

    // ================================================================
    // CONECTAR AO BANCO
    // ================================================================
    $g_sql = connect();

    // ================================================================
    // BUSCAR VEÍCULOS
    // ================================================================
    $searchUpper = strtoupper(pg_escape_string($g_sql, $search));
    
    // ✅ MODIFICADO: Construir WHERE dinamicamente
    $whereClause = '';
    if (strlen($search) > 0) {
        $whereClause = "
            WHERE
                UPPER(v.placa) LIKE '%{$searchUpper}%'
                OR UPPER(v.tipo) LIKE '%{$searchUpper}%'
                OR UPPER(v.marca) LIKE '%{$searchUpper}%'
                OR UPPER(v.modelo) LIKE '%{$searchUpper}%'
                OR UPPER(p.nome) LIKE '%{$searchUpper}%'
        ";
    }
    
    $query = "
        SELECT
            v.placa,
            v.tipo,
            v.marca,
            v.modelo,
            p.nome AS proprietario,
            CASE
                WHEN v.tp_propriedade = 'A' THEN 'AGREGADO'
                WHEN v.tp_propriedade = 'F' THEN 'FROTA'
                WHEN v.tp_propriedade = 'T' THEN 'TERCEIRO'
                ELSE v.tp_propriedade
            END AS propriedade
        FROM {$domain}_veiculo v
        LEFT JOIN {$domain}_proprietario p ON v.cnpj_proprietario = p.cnpj
        {$whereClause}
        ORDER BY v.placa
        LIMIT 100
    ";

    $result = pg_query($g_sql, $query);

    if (!$result) {
        msg('Erro ao buscar veículos no banco de dados', 'error');
        respondJson(['success' => false], 500);
    }

    $veiculos = [];
    while ($row = pg_fetch_assoc($result)) {
        $veiculos[] = [
            'placa' => $row['placa'],
            'tipo' => $row['tipo'],
            'marca' => $row['marca'], // ✅ ADICIONADO
            'modelo' => $row['modelo'], // ✅ ADICIONADO
            'proprietario' => $row['proprietario'],
            'propriedade' => $row['propriedade']
        ];
    }

    // ================================================================
    // RESPOSTA DE SUCESSO
    // ================================================================
    respondJson([
        'success' => true,
        'data' => $veiculos
    ]);

} catch (Exception $e) {
    error_log('❌ [search_veiculos.php] ERRO: ' . $e->getMessage());
    error_log('❌ Stack trace: ' . $e->getTraceAsString());
    
    msg('Erro ao buscar veículos: ' . $e->getMessage(), 'error');
    respondJson([
        'success' => false
    ], 500);
}