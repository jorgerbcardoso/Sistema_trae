<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

$input   = getRequestInput();
$periodo = (int)($input['periodo'] ?? 7);
$filters = $input['filters'] ?? [];
$modo = strtoupper(trim((string)($input['modo'] ?? 'CTE')));
if (!in_array($modo, ['CTE', 'AGENDA'])) {
    $modo = 'CTE';
}

if (!in_array($periodo, [7, 15, 30])) {
    respondJson(['success' => false, 'message' => 'Período inválido. Use 7, 15 ou 30.']);
}

$g_sql = connect();

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$defaultOcorAgendamento = 15;
$ocorAgendamento = $defaultOcorAgendamento;

try {
    $resultEmpParam = sql("SELECT ocor_agendamento FROM {$domain}_emp_param LIMIT 1", [], $g_sql);
    $rowEmpParam = $resultEmpParam ? pg_fetch_assoc($resultEmpParam) : null;
    if ($rowEmpParam && $rowEmpParam['ocor_agendamento'] !== null && $rowEmpParam['ocor_agendamento'] !== '') {
        $ocorAgendamento = (int)$rowEmpParam['ocor_agendamento'];
    }
} catch (Exception $e) {
}

$params     = [];
$paramIndex = 1;
$whereConditions = [
    "cte.status <> 'C'",
    "(cte.tp_documento IS NULL OR LTRIM(cte.tp_documento) NOT ILIKE 'COMPLEMENTAR%')",
    "cte.ult_ocor_agend = {$ocorAgendamento}",
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

$agendaKeyExpr = "md5(COALESCE(cte.cnpj_emit::text,'') || '|' || COALESCE(cte.cep_entrega::text,'') || '|' || COALESCE(cte.endereco_entrega::text,''))";
$countExpr = ($modo === 'AGENDA') ? "COUNT(DISTINCT {$agendaKeyExpr})" : "COUNT(*)";

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
            cte.data_prev_ent::date AS dia,
            {$countExpr} AS total
        FROM {$domain}_cte cte
        WHERE {$whereClause}
          AND cte.data_prev_ent IS NOT NULL
        GROUP BY dia
    ),
    entregues AS (
        SELECT
            cte.data_prev_ent::date AS dia,
            {$countExpr} AS total
        FROM {$domain}_cte cte
        LEFT JOIN (
            SELECT codigo::text as codigo, MAX(tipo) as tipo
            FROM {$domain}_ocorrencia
            GROUP BY codigo::text
        ) oc ON oc.codigo = cte.ult_ocor::text
        WHERE {$whereClause}
          AND cte.data_prev_ent IS NOT NULL
          AND data_entrega IS NOT NULL
          AND (data_entrega <= cte.data_prev_ent OR COALESCE(cte.entrega_abonada, false) = TRUE OR oc.tipo = 'C')
        GROUP BY dia
    ),
    atrasados AS (
        SELECT
            cte.data_prev_ent::date AS dia,
            {$countExpr} AS total
        FROM {$domain}_cte cte
        LEFT JOIN (
            SELECT codigo::text as codigo, MAX(tipo) as tipo
            FROM {$domain}_ocorrencia
            GROUP BY codigo::text
        ) oc ON oc.codigo = cte.ult_ocor::text
        WHERE {$whereClause}
          AND cte.data_prev_ent IS NOT NULL
          AND cte.data_prev_ent::date < CURRENT_DATE
          AND (cte.data_entrega IS NULL OR cte.data_entrega > cte.data_prev_ent)
          AND (COALESCE(cte.entrega_abonada, false) = FALSE AND (oc.tipo IS DISTINCT FROM 'C'))
        GROUP BY dia
    )
    SELECT
        dias.dia,
        COALESCE(agendados.total, 0) AS agendados,
        COALESCE(entregues.total, 0) AS entregues,
        COALESCE(atrasados.total, 0) AS atrasados
    FROM dias
    LEFT JOIN agendados ON agendados.dia = dias.dia
    LEFT JOIN entregues ON entregues.dia  = dias.dia
    LEFT JOIN atrasados ON atrasados.dia  = dias.dia
    ORDER BY dias.dia ASC
";

$result = count($params) > 0
    ? pg_query_params($g_sql, $query, $params)
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
    $atrasados = (int)($row['atrasados'] ?? 0);
    $diasData[] = [
        'data'       => $row['dia'],
        'dia'        => date('d', $ts),
        'mes'        => date('m', $ts),
        'mesNome'    => $meses[date('m', $ts)] ?? '',
        'diaSemana'  => $diasSemana[(int)date('w', $ts)] ?? '',
        'agendados'  => $agendados,
        'entregues'  => $entregues,
        'atrasados'  => $atrasados,
    ];
}

respondJson([
    'success' => true,
    'data'    => ['diasData' => $diasData],
]);
