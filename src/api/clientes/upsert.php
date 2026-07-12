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
$doc = $digits;
if ($doc === '' || !(strlen($doc) === 11 || strlen($doc) === 14)) {
    respondJson(['success' => false, 'message' => 'Documento inválido (CPF 11 dígitos ou CNPJ 14 dígitos).']);
}

$nome = trim((string)($input['nome'] ?? ''));
$seqCidade = $input['seq_cidade'] ?? null;
$agendaIn = $input['agenda'] ?? false;
$agendaBool = false;
if (is_bool($agendaIn)) {
    $agendaBool = $agendaIn;
} elseif (is_int($agendaIn)) {
    $agendaBool = ($agendaIn === 1);
} elseif (is_string($agendaIn)) {
    $v = strtolower(trim($agendaIn));
    $agendaBool = in_array($v, ['1', 'true', 't', 'on', 'yes', 'sim'], true);
}
$agenda = $agendaBool ? 'true' : 'false';
$email = trim((string)($input['email'] ?? ''));

$seqCidadeSql = null;
if ($seqCidade !== null && $seqCidade !== '') {
    $seqCidadeSql = (int)$seqCidade;
}

$conn = connect();
$tabela = "{$domain}_cliente";

$sql = "
    INSERT INTO {$tabela} (cnpj, nome, seq_cidade, agenda, email)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (cnpj) DO UPDATE SET
        nome = EXCLUDED.nome,
        seq_cidade = EXCLUDED.seq_cidade,
        agenda = EXCLUDED.agenda,
        email = EXCLUDED.email
";

$params = [
    $doc,
    $nome !== '' ? $nome : null,
    $seqCidadeSql,
    $agenda,
    $email !== '' ? $email : null,
];

$res = @sql($sql, $params, $conn);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao salvar cliente.']);
}

respondJson(['success' => true]);
