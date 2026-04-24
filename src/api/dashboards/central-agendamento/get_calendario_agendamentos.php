<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

$input   = getRequestInput();
$periodo = (int)($input['periodo'] ?? 7);
$filters = $input['filters'] ?? [];

if (!in_array($periodo, [7, 15, 30])) {
    respondJson(['success' => false, 'message' => 'Período inválido. Use 7, 15 ou 30.']);
}

$g_sql = connect();

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$params     = [];
$paramIndex = 1;
$whereConditions = [
    "cte.status <> 'C'",
    "cte.ult_ocor_agend = 15",
];

if (!empty($filters['unidadeDestino']) && is_array($filters['unidadeDestino']) && count($filters['unidadeDestino']) > 0) {
    $placeholders = [];
    foreach ($filters['unidadeDestino'] as $sigla) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $sigla;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $placeholders) . ')';
}
if (!empty($filters['cnpjPagador'])) {
    $whereConditions[] = 'cte.cnpj_pag = $' . $paramIndex++;
    $params[] = $filters['cnpjPagador'];
}
if (!empty($filters['cnpjDestinatario'])) {
    $whereConditions[] = 'cte.cnpj_dest = $' . $paramIndex++;
    $params[] = $filters['cnpjDestinatario'];
}

$whereClause = implode(' AND ', $whereConditions);

$query = "
    WITH dias AS (
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '{$periodo} days',
            CURRENT_DATE + INTERVAL '7 days',
            '1 day'::interval
        )::date AS dia
    ),
    agendados AS (
        SELECT
            data_prev_ent::date AS dia,
            COUNT(*) AS total
        FROM {$domain}_cte cte
        WHERE {$whereClause}
          AND data_prev_ent IS NOT NULL
        GROUP BY data_prev_ent::date
    ),
    entregues AS (
        SELECT
            data_prev_ent::date AS dia,
            COUNT(*) AS total
        FROM {$domain}_cte cte
        WHERE {$whereClause}
          AND data_prev_ent IS NOT NULL
          AND data_entrega IS NOT NULL
          AND data_entrega <= data_prev_ent
        GROUP BY data_prev_ent::date
    )
    SELECT
        dias.dia,
        COALESCE(agendados.total, 0) AS agendados,
        COALESCE(entregues.total, 0) AS entregues
    FROM dias
    LEFT JOIN agendados ON agendados.dia = dias.dia
    LEFT JOIN entregues ON entregues.dia  = dias.dia
    ORDER BY dias.dia ASC
";

$allParams = array_merge($params, $params);
$result = count($allParams) > 0
    ? pg_query_params($g_sql, $query, $allParams)
    : pg_query($g_sql, $query);

if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro na query: ' . pg_last_error($g_sql)]);
}

$meses = [
    '01' => 'JAN', '02' => 'FEV', '03' => 'MAR', '04' => 'ABR',
    '05' => 'MAI', '06' => 'JUN', '07' => 'JUL', '08' => 'AGO',
    '09' => 'SET', '10' => 'OUT', '11' => 'NOV', '12' => 'DEZ',
];
$diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

$diasData = [];
while ($row = pg_fetch_assoc($result)) {
    $ts        = strtotime($row['dia']);
    $agendados = (int)$row['agendados'];
    $entregues = (int)$row['entregues'];
    $diasData[] = [
        'data'       => $row['dia'],
        'dia'        => date('d', $ts),
        'mes'        => date('m', $ts),
        'mesNome'    => $meses[date('m', $ts)] ?? '',
        'diaSemana'  => $diasSemana[(int)date('w', $ts)] ?? '',
        'agendados'  => $agendados,
        'entregues'  => $entregues,
    ];
}

respondJson([
    'success' => true,
    'data'    => ['diasData' => $diasData],
]);
