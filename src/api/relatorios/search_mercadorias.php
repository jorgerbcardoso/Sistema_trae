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

$conn = connect();
$tbl = "{$domain}_mercadoria";

$term = removeAccents($search);

if ($term === '') {
    $res = sql(
        "SELECT codigo::int AS codigo, descricao
         FROM {$tbl}
         ORDER BY codigo
         LIMIT 80",
        [],
        $conn
    );
} else {
    $like = '%' . $term . '%';
    $res = sql(
        "SELECT codigo::int AS codigo, descricao
         FROM {$tbl}
         WHERE UPPER(descricao) LIKE UPPER($1)
            OR codigo::text LIKE $2
         ORDER BY codigo
         LIMIT 80",
        [$like, $like],
        $conn
    );
}

$rows = [];
while ($res && ($r = pg_fetch_assoc($res))) {
    $rows[] = [
        'codigo' => (int)($r['codigo'] ?? 0),
        'descricao' => (string)($r['descricao'] ?? ''),
    ];
}

respondJson([
    'success' => true,
    'mercadorias' => $rows,
]);

