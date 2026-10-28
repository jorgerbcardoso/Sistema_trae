<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$input = getRequestInput();
$search = trim((string)($input['search'] ?? ''));
$onlyWithMeta = (bool)($input['onlyWithMeta'] ?? false);
$limit = (int)($input['limit'] ?? 80);
if ($limit < 10) $limit = 10;
if ($limit > 200) $limit = 200;

$conn = connect();
$tblUni = "{$domain}_unidade";

$colExists = function ($tbl, $col) use ($conn) {
    $res = null;
    try {
        $res = sql(
            "SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = lower($1)
               AND column_name = $2
             LIMIT 1",
            [$tbl, $col],
            $conn
        );
    } catch (Exception $e) {}
    return ($res && pg_num_rows($res) > 0);
};

if (!$colExists($tblUni, 'meta_mensal')) {
    respondJson(['success' => false, 'message' => 'Tabela de unidades sem meta_mensal neste domínio.']);
}

$params = [];
$pi = 1;
$where = [];

if ($search !== '') {
    $where[] = "(u.sigla ILIKE $" . $pi . " OR u.nome ILIKE $" . $pi . " OR regexp_replace(u.cnpj, '\\\\D', '', 'g') LIKE regexp_replace($" . $pi . ", '\\\\D', '', 'g'))";
    $params[] = '%' . $search . '%';
    $pi++;
}
if ($onlyWithMeta) {
    $where[] = "COALESCE(u.meta_mensal, 0) > 0";
}

$whereClause = count($where) > 0 ? ('WHERE ' . implode(' AND ', $where)) : '';

$q = "
    SELECT
        u.sigla,
        u.nome,
        u.cnpj,
        COALESCE(u.meta_mensal, 0) AS meta_mensal
    FROM {$tblUni} u
    {$whereClause}
    ORDER BY (COALESCE(u.meta_mensal, 0) > 0) DESC, u.sigla ASC
    LIMIT {$limit}
";

$res = pg_query_params($conn, $q, $params);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar metas de unidades: ' . pg_last_error($conn)]);
}

$items = [];
while ($row = pg_fetch_assoc($res)) {
    $items[] = [
        'sigla' => (string)($row['sigla'] ?? ''),
        'nome' => (string)($row['nome'] ?? ''),
        'cnpj' => (string)($row['cnpj'] ?? ''),
        'meta_mensal' => (float)($row['meta_mensal'] ?? 0),
    ];
}

respondJson(['success' => true, 'items' => $items]);

