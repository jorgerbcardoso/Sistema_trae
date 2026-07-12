<?php
require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();
$search = trim((string)($input['search'] ?? ''));

$minSearchLen = 3;
$defaultLimit = 80;
$maxLimit = 500;
$limitIn = (int)($input['limit'] ?? $defaultLimit);
$limit = max(1, min($maxLimit, $limitIn));
$pageIn = (int)($input['page'] ?? 1);
$page = max(1, $pageIn);
$offset = ($page - 1) * $limit;

$sortFieldIn = strtolower(trim((string)($input['sort_field'] ?? 'data_ult_mvto')));
$sortDirIn = strtolower(trim((string)($input['sort_dir'] ?? 'desc')));
$sortDir = ($sortDirIn === 'asc') ? 'ASC' : 'DESC';

$allowedSort = [
    'data_ult_mvto' => 'c.data_ult_mvto',
    'nome' => 'c.nome',
    'cnpj' => 'c.cnpj',
    'cidade_nome' => 'cid.nome',
    'cidade_uf' => 'cid.uf',
    'email' => 'c.email',
    'agenda' => 'c.agenda',
];
$sortExpr = $allowedSort[$sortFieldIn] ?? $allowedSort['data_ult_mvto'];

if (mb_strlen($search) < $minSearchLen) {
    respondJson([
        'success' => true,
        'clientes' => [],
        'requires_search' => true,
        'min_search_len' => $minSearchLen,
        'limit' => $limit,
        'page' => 1,
        'total' => 0,
    ]);
}

$conn = connect();
$tabela = "{$domain}_cliente";

$where = [];
$params = [];
$p = 1;

if ($search !== '') {
    $where[] = "(c.cnpj ILIKE $" . $p . " OR c.nome ILIKE $" . $p . ")";
    $params[] = '%' . $search . '%';
    $p++;
}

$whereClause = count($where) ? ("WHERE " . implode(' AND ', $where)) : "";

$effectiveLimit = $limit + 1;
$sql = "
    SELECT
        c.cnpj,
        c.nome,
        c.seq_cidade,
        c.data_ult_mvto,
        c.agenda,
        c.email,
        cid.nome AS cidade_nome,
        cid.uf AS cidade_uf
    FROM {$tabela} c
    LEFT JOIN cidade cid ON cid.seq_cidade = c.seq_cidade
    {$whereClause}
    ORDER BY {$sortExpr} {$sortDir} NULLS LAST, COALESCE(c.nome, ''), c.cnpj
    LIMIT {$effectiveLimit}
    OFFSET {$offset}
";

$res = @sql($sql, $params, $conn);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao listar clientes.']);
}

$root = @realpath(__DIR__ . '/../../..');
$dirRel = '/sistema/logos_clientes';
$dirAbs = $root ? (rtrim($root, '/') . '/logos_clientes') : null;

$clientes = [];
while ($row = pg_fetch_assoc($res)) {
    $cnpjRaw = (string)($row['cnpj'] ?? '');
    $digits = preg_replace('/\D/', '', $cnpjRaw);
    $doc14 = str_pad($digits, 14, '0', STR_PAD_LEFT);
    $base = strtoupper($domain) . $doc14;

    $logoUrl = null;
    $logoExt = null;

    $pngPath = $dirAbs ? ($dirAbs . '/' . $base . '.png') : null;
    $jpgPath = $dirAbs ? ($dirAbs . '/' . $base . '.jpg') : null;
    if ($pngPath && @is_file($pngPath)) {
        $logoUrl = $dirRel . '/' . $base . '.png';
        $logoExt = 'png';
    } elseif ($jpgPath && @is_file($jpgPath)) {
        $logoUrl = $dirRel . '/' . $base . '.jpg';
        $logoExt = 'jpg';
    }

    $clientes[] = [
        'cnpj' => $digits,
        'nome' => $row['nome'] ?? '',
        'seq_cidade' => ($row['seq_cidade'] === null || $row['seq_cidade'] === '') ? null : (int)$row['seq_cidade'],
        'data_ult_mvto' => $row['data_ult_mvto'] ?? null,
        'agenda' => ((string)($row['agenda'] ?? '') === 't'),
        'email' => $row['email'] ?? '',
        'cidade_nome' => $row['cidade_nome'] ?? null,
        'cidade_uf' => $row['cidade_uf'] ?? null,
        'logo_url' => $logoUrl,
        'logo_ext' => $logoExt,
    ];
}

$truncated = false;
if (count($clientes) > $limit) {
    $truncated = true;
    $clientes = array_slice($clientes, 0, $limit);
}

respondJson([
    'success' => true,
    'clientes' => $clientes,
    'requires_search' => false,
    'min_search_len' => $minSearchLen,
    'limit' => $limit,
    'page' => $page,
    'sort_field' => $sortFieldIn,
    'sort_dir' => strtolower($sortDir),
    'truncated' => $truncated,
]);
