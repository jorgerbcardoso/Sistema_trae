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

$root = @realpath(__DIR__ . '/../../..');
$dirRel = '/sistema/logos_clientes';
$dirAbs = $root ? (rtrim($root, '/') . '/logos_clientes') : null;
$base = strtoupper($domain) . $cnpj;

$png = $dirAbs ? ($dirAbs . '/' . $base . '.png') : null;
$jpg = $dirAbs ? ($dirAbs . '/' . $base . '.jpg') : null;

$url = null;
$ext = null;
$size = null;

if ($png && @is_file($png)) {
    $url = $dirRel . '/' . $base . '.png';
    $ext = 'png';
    $size = @filesize($png) ?: null;
} elseif ($jpg && @is_file($jpg)) {
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
