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

$tblCli = "{$domain}_cliente";
$tblGc = "{$domain}_grupo_cliente";

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

if (!$colExists($tblCli, 'meta_mensal')) {
    respondJson(['success' => false, 'message' => 'Tabela de clientes sem meta_mensal neste domínio.']);
}

$params = [];
$pi = 1;
$where = [];

if ($search !== '') {
    $where[] = "(c.nome ILIKE $" . $pi . " OR regexp_replace(c.cnpj, '\\\\D', '', 'g') LIKE regexp_replace($" . $pi . ", '\\\\D', '', 'g'))";
    $params[] = '%' . $search . '%';
    $pi++;
}

if ($onlyWithMeta) {
    $where[] = "COALESCE(c.meta_mensal, 0) > 0";
}

$whereElig = "(gc.cnpj_principal IS NULL OR gc.cnpj_principal = c.cnpj)";
if (count($where) > 0) {
    $whereClause = "WHERE {$whereElig} AND " . implode(' AND ', $where);
} else {
    $whereClause = "WHERE {$whereElig}";
}

$q = "
    SELECT
        c.cnpj,
        c.nome,
        COALESCE(c.meta_mensal, 0) AS meta_mensal,
        (EXISTS (SELECT 1 FROM {$tblGc} g2 WHERE g2.cnpj_principal = c.cnpj LIMIT 1)) AS is_principal_grupo
    FROM {$tblCli} c
    LEFT JOIN {$tblGc} gc
           ON gc.cnpj = c.cnpj
    {$whereClause}
    ORDER BY (COALESCE(c.meta_mensal, 0) > 0) DESC, c.nome ASC
    LIMIT {$limit}
";

$res = pg_query_params($conn, $q, $params);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar metas de clientes: ' . pg_last_error($conn)]);
}

$items = [];
while ($row = pg_fetch_assoc($res)) {
    $items[] = [
        'cnpj' => (string)($row['cnpj'] ?? ''),
        'nome' => (string)($row['nome'] ?? ''),
        'meta_mensal' => (float)($row['meta_mensal'] ?? 0),
        'is_principal_grupo' => pgBoolToPHP($row['is_principal_grupo'] ?? false),
    ];
}

respondJson(['success' => true, 'items' => $items]);

