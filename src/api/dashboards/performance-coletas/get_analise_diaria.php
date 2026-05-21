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
    $limite  = (new DateTime())->modify('+3 days');
    $ini     = (new DateTime())->modify('-30 days');
    $data_ini_dmy = $ini->format('dmy');
    $data_fim_dmy = $hoje->format('dmy');

    $g_sql = connect();

    $total = fetchColetasSSW($g_sql, $domain, $data_ini_dmy, $data_fim_dmy, 'I');

    error_log("✅ [get_analise_diaria.php] fetchColetasSSW: $total coletas para $domain ($data_ini_dmy a $data_fim_dmy)");

    $filtersCalendario = array_diff_key($filters, array_flip(['periodoInicio', 'periodoFim']));
    $extraWhere = buildExtraWhereCalendario($g_sql, $filtersCalendario);

    $limiteStr     = $limite->format('Y-m-d');
    $analiseDiaria = array_filter(
        getColetasAnaliseDiaria($g_sql, 34, 'tmp_coleta_rt', $extraWhere),
        fn($d) => $d['data'] <= $limiteStr
    );
    $coletas = array_filter(
        getColetasRaw($g_sql, 'tmp_coleta_rt', $extraWhere),
        function($c) use ($limiteStr) {
            $parts = explode('/', $c['data_limite']);
            if (count($parts) === 3) {
                $iso = $parts[2] . '-' . $parts[1] . '-' . $parts[0];
                return $iso <= $limiteStr;
            }
            return $c['data_limite'] <= $limiteStr;
        }
    );

    respondJson([
        'success' => true,
        'data'    => [
            'analiseDiaria'   => array_values($analiseDiaria),
            'coletas'         => array_values($coletas),
            'total_importado' => $total,
        ]
    ]);

} catch (Exception $e) {
    error_log('❌ [get_analise_diaria.php] ' . $e->getMessage());
    respondJson(['success' => false, 'error' => $e->getMessage()], 500);
}
