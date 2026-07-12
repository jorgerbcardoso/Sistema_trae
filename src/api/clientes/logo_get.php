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
$cnpjIn = (string)($input['cnpj'] ?? '');
$digits = preg_replace('/\D/', '', $cnpjIn);
$cnpj = str_pad($digits, 14, '0', STR_PAD_LEFT);

if ($cnpj === '' || strlen($cnpj) !== 14) {
    respondJson(['success' => false, 'message' => 'CNPJ inválido.']);
}

$docRoot = (string)($_SERVER['DOCUMENT_ROOT'] ?? '');
$dirRel = '/images/logos_clientes';
$dirAbs = rtrim($docRoot, '/') . $dirRel;
$base = strtoupper($domain) . $cnpj;

$png = $dirAbs . '/' . $base . '.png';
$jpg = $dirAbs . '/' . $base . '.jpg';

$url = null;
$ext = null;
$size = null;

if ($docRoot !== '' && @is_file($png)) {
    $url = $dirRel . '/' . $base . '.png';
    $ext = 'png';
    $size = @filesize($png) ?: null;
} elseif ($docRoot !== '' && @is_file($jpg)) {
    $url = $dirRel . '/' . $base . '.jpg';
    $ext = 'jpg';
    $size = @filesize($jpg) ?: null;
}

respondJson([
    'success' => true,
    'exists' => $url !== null,
    'url' => $url,
    'ext' => $ext,
    'size' => $size,
]);

