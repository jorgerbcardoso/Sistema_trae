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
";

$res = @sql($sql, $params, $conn);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao listar clientes.']);
}

$docRoot = (string)($_SERVER['DOCUMENT_ROOT'] ?? '');
$dirRel = '/images/logos_clientes';
$dirAbs = rtrim($docRoot, '/') . $dirRel;

$clientes = [];
while ($row = pg_fetch_assoc($res)) {
    $cnpjRaw = (string)($row['cnpj'] ?? '');
    $digits = preg_replace('/\D/', '', $cnpjRaw);
    $cnpj14 = str_pad($digits, 14, '0', STR_PAD_LEFT);
    $base = strtoupper($domain) . $cnpj14;

    $logoUrl = null;
    $logoExt = null;

    $pngPath = $dirAbs . '/' . $base . '.png';
    $jpgPath = $dirAbs . '/' . $base . '.jpg';
    if ($docRoot !== '' && @is_file($pngPath)) {
        $logoUrl = $dirRel . '/' . $base . '.png';
        $logoExt = 'png';
    } elseif ($docRoot !== '' && @is_file($jpgPath)) {
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

respondJson(['success' => true, 'clientes' => $clientes]);

