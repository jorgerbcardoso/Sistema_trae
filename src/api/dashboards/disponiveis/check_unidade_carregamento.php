<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

$input  = getRequestInput();
$sigla  = strtoupper(trim($input['sigla'] ?? ''));

if (empty($sigla)) {
    respondJson(['success' => false, 'message' => 'Sigla não informada.']);
}

global $g_sql;
if (!isset($g_sql) || !$g_sql) {
    $g_sql = getDBConnection();
}

$tblUnidade = $domain . '_unidade';

$result = sql("SELECT efetua_carregamento FROM $tblUnidade WHERE UPPER(sigla) = UPPER($1) LIMIT 1", [$sigla], $g_sql);

if (!$result || pg_num_rows($result) === 0) {
    respondJson(['success' => true, 'efetua_carregamento' => true]);
}

$row = pg_fetch_assoc($result);
$efetua = ($row['efetua_carregamento'] === 't' || $row['efetua_carregamento'] === true);

respondJson(['success' => true, 'efetua_carregamento' => $efetua]);
