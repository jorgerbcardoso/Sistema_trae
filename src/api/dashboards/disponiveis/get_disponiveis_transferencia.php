<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/disponiveis_lib.php';
require_once __DIR__ . '/processa_relatorios_ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth     = authenticateAndGetUser();
$domain   = $auth['domain'];
$g_sql    = connect();

$input  = getRequestInput();
$sigla  = strtoupper(trim($input['sigla'] ?? ''));

if (empty($sigla)) {
    respondJson(['success' => false, 'message' => 'Sigla inválida.']);
}

$linhas = getCtesDisponiveis($sigla, $domain);

// A busca pelos relatórios 0157 e 0083 precisa ser feita aqui também

$dadosProcessados = processarRelatoriosSSW($linhas, $linhas157, $linhas0083, $g_sql, $domain);

respondJson([
    'success' => true,
    'dados' => $dadosProcessados,
]);
