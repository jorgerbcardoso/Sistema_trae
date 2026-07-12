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

$conn = connect();
$tabela = "{$domain}_cliente";

$res = @sql("DELETE FROM {$tabela} WHERE cnpj = $1", [$cnpj], $conn);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao excluir cliente.']);
}

$root = @realpath(__DIR__ . '/../../..');
$dirAbs = $root ? (rtrim($root, '/') . '/logos_clientes') : null;
$base = strtoupper($domain) . $cnpj;

if ($dirAbs) {
    @unlink($dirAbs . '/' . $base . '.png');
    @unlink($dirAbs . '/' . $base . '.jpg');
}

respondJson(['success' => true]);
