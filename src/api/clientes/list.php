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
$limit = 1000;
if (mb_strlen($search) < $minSearchLen) {
    respondJson([
        'success' => true,
        'clientes' => [],
        'requires_search' => true,
        'min_search_len' => $minSearchLen,
        'limit' => $limit,
    ]);
}

$conn = connect();
$tabela = "{$domain}_cliente";

$where = [];
$params = [];
$p = 1;

if ($search !== '') {
    $where[] = "(cnpj ILIKE $" . $p . " OR nome ILIKE $" . $p . ")";
    $params[] = '%' . $search . '%';
    $p++;
}

$sql = "
    SELECT
        cnpj,
        nome,
        seq_cidade,
        data_ult_mvto,
        agenda,
        email
    FROM {$tabela}
    " . (count($where) ? ("WHERE " . implode(' AND ', $where)) : "") . "
    ORDER BY COALESCE(nome, ''), cnpj
    LIMIT {$limit}
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
    $cnpj14 = str_pad($digits, 14, '0', STR_PAD_LEFT);
    $base = strtoupper($domain) . $cnpj14;

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
        'cnpj' => $cnpj14,
        'nome' => $row['nome'] ?? '',
        'seq_cidade' => ($row['seq_cidade'] === null || $row['seq_cidade'] === '') ? null : (int)$row['seq_cidade'],
        'data_ult_mvto' => $row['data_ult_mvto'] ?? null,
        'agenda' => ((string)($row['agenda'] ?? '') === 't'),
        'email' => $row['email'] ?? '',
        'logo_url' => $logoUrl,
        'logo_ext' => $logoExt,
    ];
}

respondJson([
    'success' => true,
    'clientes' => $clientes,
    'requires_search' => false,
    'min_search_len' => $minSearchLen,
    'limit' => $limit,
]);
