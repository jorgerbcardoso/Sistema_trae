<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/lib.php';

handleOptionsRequest();
validateRequestMethod('POST');

try {
    $auth   = authenticateAndGetUser();
    $domain = $auth['domain'];

    $input   = getRequestInput();
    $filters = $input['filters'] ?? [];

    $hoje    = new DateTime();
    $ini     = (new DateTime())->modify('-30 days');
    $data_ini_dmy = $ini->format('dmy');
    $data_fim_dmy = $hoje->format('dmy');

    $g_sql = connect();

    $total = fetchColetasSSW($g_sql, $domain, $data_ini_dmy, $data_fim_dmy, 'I');

    error_log("✅ [get_analise_diaria.php] fetchColetasSSW: $total coletas para $domain ($data_ini_dmy a $data_fim_dmy)");

    $analiseDiaria = getColetasAnaliseDiaria($g_sql, 30, 'tmp_coleta_rt');

    respondJson([
        'success' => true,
        'data'    => [
            'analiseDiaria'   => $analiseDiaria,
            'total_importado' => $total,
        ]
    ]);

} catch (Exception $e) {
    error_log('❌ [get_analise_diaria.php] ' . $e->getMessage());
    respondJson(['success' => false, 'error' => $e->getMessage()], 500);
}
