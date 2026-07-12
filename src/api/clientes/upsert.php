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

$nome = trim((string)($input['nome'] ?? ''));
$seqCidade = $input['seq_cidade'] ?? null;
$dataUlt = trim((string)($input['data_ult_mvto'] ?? ''));
$agenda = (bool)($input['agenda'] ?? false);
$email = trim((string)($input['email'] ?? ''));

$seqCidadeSql = null;
if ($seqCidade !== null && $seqCidade !== '') {
    $seqCidadeSql = (int)$seqCidade;
}

$dataUltSql = null;
if ($dataUlt !== '') {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataUlt)) {
        respondJson(['success' => false, 'message' => 'Data inválida (use YYYY-MM-DD).']);
    }
    $dataUltSql = $dataUlt;
}

$conn = connect();
$tabela = "{$domain}_cliente";

$sql = "
    INSERT INTO {$tabela} (cnpj, nome, seq_cidade, data_ult_mvto, agenda, email)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (cnpj) DO UPDATE SET
        nome = EXCLUDED.nome,
        seq_cidade = EXCLUDED.seq_cidade,
        data_ult_mvto = EXCLUDED.data_ult_mvto,
        agenda = EXCLUDED.agenda,
        email = EXCLUDED.email
";

$params = [
    $cnpj,
    $nome !== '' ? $nome : null,
    $seqCidadeSql,
    $dataUltSql,
    $agenda,
    $email !== '' ? $email : null,
];

$res = @sql($sql, $params, $conn);
if (!$res) {
    respondJson(['success' => false, 'message' => 'Erro ao salvar cliente.']);
}

respondJson(['success' => true]);

