<?php
/**
 * ================================================================
 * API: CLIENTES AGENDÁVEIS - ATUALIZAÇÃO
 * ================================================================
 * Atualiza o campo agenda na tabela [dominio]_cliente.
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtoupper(trim($auth['domain'] ?? ''));
$input = getRequestInput();

$cnpj = trim($input['cnpj'] ?? '');
$agenda = isset($input['agenda']) ? (bool) $input['agenda'] : null;

if ($cnpj === '') {
    returnError('CNPJ do cliente não informado', 400);
}

if ($agenda === null) {
    returnError('Valor de agenda não informado', 400);
}

$conn = connect();

$query = "
    UPDATE {$domain}_cliente
    SET agenda = $1
    WHERE cnpj = $2
";

$result = sql($query, [$agenda ? 't' : 'f', $cnpj], $conn);

if ($result === false || pg_affected_rows($result) === 0) {
    returnError('Cliente não encontrado para atualização', 404);
}

returnSuccess([
    'message' => 'Cliente agendável atualizado com sucesso',
    'cnpj' => $cnpj,
    'agenda' => $agenda,
]);
