<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$input   = getRequestInput();
$filters = $input['filters'] ?? [];
$search  = trim($input['search'] ?? '');

$conn = connect();

$params     = [];
$paramIndex = 1;
$whereConditions = ["cte.status <> 'C'"];

if (!empty($filters['periodoEmissaoInicio'])) {
    $whereConditions[] = 'cte.data_emissao >= $' . $paramIndex++;
    $params[] = $filters['periodoEmissaoInicio'];
}
if (!empty($filters['periodoEmissaoFim'])) {
    $whereConditions[] = 'cte.data_emissao <= $' . $paramIndex++;
    $params[] = $filters['periodoEmissaoFim'];
}
if (!empty($filters['tpFrete'])) {
    $whereConditions[] = 'cte.tp_frete = $' . $paramIndex++;
    $params[] = $filters['tpFrete'];
}
if (!empty($filters['siglaEmit']) && is_array($filters['siglaEmit']) && count($filters['siglaEmit']) > 0) {
    $placeholders = [];
    foreach ($filters['siglaEmit'] as $s) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $s;
    }
    $whereConditions[] = 'cte.sigla_emit IN (' . implode(', ', $placeholders) . ')';
}
if (!empty($filters['siglaDest']) && is_array($filters['siglaDest']) && count($filters['siglaDest']) > 0) {
    $placeholders = [];
    foreach ($filters['siglaDest'] as $s) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $s;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $placeholders) . ')';
}

if ($search !== '') {
    $whereConditions[] = 'UPPER(cte.nome_pag) LIKE UPPER($' . $paramIndex++ . ')';
    $params[] = '%' . $search . '%';
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

$query = "
    SELECT
        cte.cnpj_pag                AS cnpj,
        cte.nome_pag                AS nome,
        SUM(cte.vlr_frete)          AS total_frete
    FROM {$domain}_cte cte
    {$whereClause}
    GROUP BY cte.cnpj_pag, cte.nome_pag
    ORDER BY total_frete DESC
    LIMIT 20
";

$result = pg_query_params($conn, $query, $params);
if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro: ' . pg_last_error($conn)]);
}

$clientes = [];
while ($row = pg_fetch_assoc($result)) {
    $clientes[] = [
        'cnpj'        => $row['cnpj'],
        'nome'        => $row['nome'] ?: 'SEM NOME',
        'total_frete' => (float)$row['total_frete'],
    ];
}

respondJson(['success' => true, 'clientes' => $clientes]);
