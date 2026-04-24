<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../services/EmailService.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain   = $auth['domain'];
$username = $auth['username'];

$input        = getRequestInput();
$email        = trim($input['email']        ?? '');
$dataSugerida = trim($input['dataSugerida'] ?? '');
$cnpjDest     = trim($input['cnpjDest']     ?? '');
$ctes         = $input['ctes']              ?? [];

if (empty($email) || empty($dataSugerida) || empty($cnpjDest) || empty($ctes)) {
    respondJson(['success' => false, 'message' => 'Parâmetros obrigatórios ausentes']);
}

$conn = connect();

$result = pg_query_params(
    $conn,
    "SELECT nome FROM {$domain}_cliente WHERE cnpj = $1",
    [$cnpjDest]
);

$nomeDestinatario = 'Cliente';
if ($result && pg_num_rows($result) > 0) {
    $row = pg_fetch_assoc($result);
    $nomeDestinatario = $row['nome'] ?? 'Cliente';
}

pg_query_params(
    $conn,
    "UPDATE {$domain}_cliente SET email = $1 WHERE cnpj = $2",
    [$email, $cnpjDest]
);

$emailService = new EmailService();
$resultado = $emailService->sendSolicitacaoAgendamento(
    $email,
    $nomeDestinatario,
    $dataSugerida,
    $ctes,
    $domain,
    $username
);

if ($resultado['success']) {
    respondJson(['success' => true, 'message' => 'Solicitação de agendamento enviada com sucesso']);
} else {
    respondJson(['success' => false, 'message' => $resultado['message']]);
}
