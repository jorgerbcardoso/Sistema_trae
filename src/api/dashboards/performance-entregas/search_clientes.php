<?php
/**
 * ================================================================
 * API: BUSCAR CLIENTES (PAGADORES/DESTINATÁRIOS)
 * ================================================================
 * Busca clientes por nome
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/search_clientes.php
 * Body: { search: "texto" }
 * Response: JSON com lista de clientes
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

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
$search = trim($input['search'] ?? '');

// Validar: mínimo 2 caracteres
if (strlen($search) < 2) {
    respondJson([
        'success' => false,
        'message' => 'Digite pelo menos 2 caracteres para buscar'
    ]);
}

// ================================================================
// CONECTAR AO BANCO
// ================================================================
$g_sql = connect();

// ================================================================
// BUSCAR CLIENTES
// ================================================================
// ✅ Remover acentos do termo de busca (base não tem acentuação)
$searchUnaccented = removeAccents($search);

$query = "
    SELECT 
        c.cnpj,
        c.nome,
        COALESCE(cid.nome || ' - ' || cid.uf, '') AS cidade,
        TO_CHAR(c.data_ult_mvto, 'DD/MM/YY') AS data_ult_mvto
    FROM {$domain}_cliente c
    LEFT JOIN cidade cid ON c.seq_cidade = cid.seq_cidade
    WHERE UPPER(c.nome) LIKE UPPER($1)
    ORDER BY c.nome
";

$searchPattern = '%' . $searchUnaccented . '%';
$result = sql($g_sql, $query, false, [$searchPattern]);

$clientes = [];
while ($row = pg_fetch_assoc($result)) {
    $clientes[] = [
        'cnpj' => $row['cnpj'], // ✅ CNPJ é a chave primária
        'nome' => $row['nome'],
        'cidade' => $row['cidade'],
        'dataUltMovimento' => $row['data_ult_mvto']
    ];
}

// ================================================================
// RESPOSTA JSON
// ================================================================
respondJson([
    'success' => true,
    'clientes' => $clientes,
    'count' => count($clientes)
]);