<?php

require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtoupper(trim($auth['domain'] ?? ''));

if (!preg_match('/^[A-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido'], 400);
}

$input = getRequestInput();
$cnpjs = $input['cnpjs'] ?? [];
if (!is_array($cnpjs)) $cnpjs = [];

$clean = [];
foreach ($cnpjs as $c) {
    $d = preg_replace('/\D+/', '', (string)$c);
    if (strlen($d) === 14) $clean[$d] = true;
}
$list = array_keys($clean);

if (count($list) === 0) {
    respondJson(['success' => true, 'data' => ['items' => []]]);
}

$conn = connect();

$values = [];
$params = [];
$i = 1;
foreach ($list as $cnpj) {
    $values[] = '($' . $i . ')';
    $params[] = $cnpj;
    $i++;
}

$sql = "
    WITH inp(cnpj) AS (
        VALUES " . implode(', ', $values) . "
    )
    SELECT
        inp.cnpj,
        COALESCE(gc.cnpj_principal, inp.cnpj) AS cnpj_principal,
        COALESCE(principal.nome, cli.nome, '') AS nome_principal,
        (gc.cnpj_principal IS NOT NULL) AS is_grupo
    FROM inp
    LEFT JOIN {$domain}_grupo_cliente gc ON gc.cnpj = inp.cnpj
    LEFT JOIN {$domain}_cliente principal ON principal.cnpj = gc.cnpj_principal
    LEFT JOIN {$domain}_cliente cli ON cli.cnpj = inp.cnpj
";

$res = pg_query_params($conn, $sql, $params);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao consultar grupos de clientes'], 500);
}

$items = [];
while ($row = pg_fetch_assoc($res)) {
    $items[] = [
        'cnpj' => preg_replace('/\D+/', '', (string)($row['cnpj'] ?? '')),
        'cnpj_principal' => preg_replace('/\D+/', '', (string)($row['cnpj_principal'] ?? '')),
        'nome_principal' => (string)($row['nome_principal'] ?? ''),
        'is_grupo' => pgBoolToPHP($row['is_grupo'] ?? false),
    ];
}

respondJson(['success' => true, 'data' => ['items' => $items]]);

