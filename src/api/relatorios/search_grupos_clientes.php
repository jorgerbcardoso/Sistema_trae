<?php
require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtolower(trim((string)($auth['domain'] ?? '')));

if ($domain === '' || !preg_match('/^[a-z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.'], 400);
}

$input = getRequestInput();
$search = trim((string)($input['search'] ?? ''));

if (mb_strlen($search) < 2) {
    respondJson(['success' => true, 'grupos' => []]);
}

$conn = connect();
$tblGc = "{$domain}_grupo_cliente";
$tblCli = "{$domain}_cliente";

$s = removeAccents($search);
$digits = preg_replace('/\D/', '', $search);

$params = [];
$p = 1;
$where = [];

$where[] = "gc.cnpj_principal IS NOT NULL";

$where[] = "(UPPER(COALESCE(cli.nome, '')) LIKE UPPER($" . $p++ . ") OR regexp_replace(COALESCE(gc.cnpj_principal::text, ''), '\\\\D', '', 'g') LIKE $" . $p++ . ")";
$params[] = '%' . $s . '%';
$params[] = '%' . ($digits !== '' ? $digits : $s) . '%';

$sql = "
    SELECT DISTINCT
        regexp_replace(COALESCE(gc.cnpj_principal::text, ''), '\\\\D', '', 'g') AS cnpj,
        COALESCE(NULLIF(BTRIM(cli.nome), ''), regexp_replace(COALESCE(gc.cnpj_principal::text, ''), '\\\\D', '', 'g')) AS nome
    FROM {$tblGc} gc
    LEFT JOIN {$tblCli} cli ON cli.cnpj = gc.cnpj_principal
    WHERE " . implode(' AND ', $where) . "
    ORDER BY nome ASC
    LIMIT 50
";

$res = sql($sql, $params, $conn);
$out = [];
while ($res && ($row = pg_fetch_assoc($res))) {
    $out[] = [
        'cnpj' => (string)($row['cnpj'] ?? ''),
        'nome' => (string)($row['nome'] ?? ''),
    ];
}

respondJson(['success' => true, 'grupos' => $out]);

