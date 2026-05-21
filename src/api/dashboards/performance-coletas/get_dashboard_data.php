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

    $dataIni = $filters['periodoInicio'] ?? '';
    $dataFim = $filters['periodoFim']    ?? '';

    if (empty($dataIni) || empty($dataFim)) {
        respondJson(['success' => false, 'error' => 'Informe as datas de início e fim do período de lançamento.'], 400);
    }

    $tp_periodo = 'I';

    $ini = new DateTime($dataIni);
    $fim = new DateTime($dataFim);
    $diff = $ini->diff($fim)->days;

    if ($diff > 31) {
        respondJson(['success' => false, 'error' => 'O período não pode ser maior que 31 dias.'], 400);
    }

    $data_ini_dmy = $ini->format('dmy');
    $data_fim_dmy = $fim->format('dmy');

    $g_sql = connect();

    $total = fetchColetasSSW($g_sql, $domain, $data_ini_dmy, $data_fim_dmy, $tp_periodo);

    error_log("✅ [get_dashboard_data.php] fetchColetasSSW: $total coletas importadas para $domain ($data_ini_dmy a $data_fim_dmy, tp=$tp_periodo)");

    $cards         = getColetasCountBySituacao($g_sql, 'tmp_coleta_rt', $filters);
    $analiseDiaria = getColetasAnaliseDiaria($g_sql, $diff + 1, 'tmp_coleta_rt');
    $evolucao      = getColetasEvolucao($g_sql, $diff + 1, 'tmp_coleta_rt');
    $comparativo   = getColetasComparativo($g_sql, $domain, 'tmp_coleta_rt');
    $coletas       = getColetasRaw($g_sql, 'tmp_coleta_rt');

    respondJson([
        'success' => true,
        'data' => [
            'cards'           => $cards,
            'analiseDiaria'   => $analiseDiaria,
            'evolucao'        => $evolucao,
            'comparativo'     => $comparativo,
            'coletas'         => $coletas,
            'total_importado' => $total,
        ]
    ]);

} catch (Exception $e) {
    error_log('❌ [get_dashboard_data.php] ' . $e->getMessage());
    respondJson(['success' => false, 'error' => $e->getMessage()], 500);
}
