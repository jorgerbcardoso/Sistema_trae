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

$query = '';
if ($modo === 'AGENDA') {
    $query = "
        WITH dias AS (
            SELECT generate_series(
                CURRENT_DATE - INTERVAL '{$periodo} days',
                CURRENT_DATE + INTERVAL '7 days',
                '1 day'::interval
            )::date AS dia
        ),
        base AS (
            SELECT
                cte.data_prev_ent::date AS dia,
                {$agendaKeyExpr} AS agenda_id,
                cte.data_entrega AS data_entrega,
                (CASE
                    WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE
                    WHEN oc.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE
                    ELSE cte.data_prev_ent
                END) AS prev_eff
            FROM {$domain}_cte cte
            LEFT JOIN (
                SELECT codigo::text as codigo, MAX(tipo) as tipo
                FROM {$domain}_ocorrencia
                GROUP BY codigo::text
            ) oc ON oc.codigo = cte.ult_ocor::text
            WHERE {$whereClause}
              AND cte.data_prev_ent IS NOT NULL
        ),
        agenda_stats AS (
            SELECT
                dia,
                agenda_id,
                BOOL_AND(data_entrega IS NOT NULL) AS all_delivered,
                BOOL_OR((data_entrega IS NOT NULL) AND (data_entrega > prev_eff)) AS any_late,
                BOOL_OR((data_entrega IS NULL) AND (prev_eff::date < CURRENT_DATE)) AS any_pending_late
            FROM base
            GROUP BY dia, agenda_id
        ),
        agg AS (
            SELECT
                dia,
                COUNT(*) AS agendados,
                COUNT(*) FILTER (WHERE all_delivered AND NOT any_late) AS entregues,
                COUNT(*) FILTER (WHERE (NOT all_delivered) AND any_pending_late) AS atrasados_sem_entrega,
                COUNT(*) FILTER (WHERE all_delivered AND any_late) AS entregues_com_atraso
            FROM agenda_stats
            GROUP BY dia
        )
        SELECT
            dias.dia,
            COALESCE(agg.agendados, 0) AS agendados,
            COALESCE(agg.entregues, 0) AS entregues,
            COALESCE(agg.atrasados_sem_entrega, 0) AS atrasados_sem_entrega,
            COALESCE(agg.entregues_com_atraso, 0) AS entregues_com_atraso,
            (COALESCE(agg.atrasados_sem_entrega, 0) + COALESCE(agg.entregues_com_atraso, 0)) AS atrasados
        FROM dias
        LEFT JOIN agg ON agg.dia = dias.dia
        ORDER BY dias.dia ASC
    ";
} else {
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
              AND data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN oc.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)
            GROUP BY dia
        ),
        atrasados_sem_entrega AS (
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
              AND cte.data_entrega IS NULL
              AND (COALESCE(cte.entrega_abonada, false) = FALSE AND (oc.tipo IS DISTINCT FROM 'C') AND UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) <> 'REENTREGA')
            GROUP BY dia
        ),
        entregues_com_atraso AS (
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
              AND cte.data_entrega IS NOT NULL
              AND cte.data_entrega > cte.data_prev_ent
              AND (COALESCE(cte.entrega_abonada, false) = FALSE AND (oc.tipo IS DISTINCT FROM 'C') AND UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) <> 'REENTREGA')
            GROUP BY dia
        )
        SELECT
            dias.dia,
            COALESCE(agendados.total, 0) AS agendados,
            COALESCE(entregues.total, 0) AS entregues,
            COALESCE(atrasados_sem_entrega.total, 0) AS atrasados_sem_entrega,
            COALESCE(entregues_com_atraso.total, 0) AS entregues_com_atraso,
            (COALESCE(atrasados_sem_entrega.total, 0) + COALESCE(entregues_com_atraso.total, 0)) AS atrasados
        FROM dias
        LEFT JOIN agendados ON agendados.dia = dias.dia
        LEFT JOIN entregues ON entregues.dia  = dias.dia
        LEFT JOIN atrasados_sem_entrega ON atrasados_sem_entrega.dia = dias.dia
        LEFT JOIN entregues_com_atraso ON entregues_com_atraso.dia = dias.dia
        ORDER BY dias.dia ASC
    ";
}

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
    $atrasadosSemEntrega = (int)($row['atrasados_sem_entrega'] ?? 0);
    $entreguesComAtraso  = (int)($row['entregues_com_atraso'] ?? 0);
    $atrasados = (int)($row['atrasados'] ?? ($atrasadosSemEntrega + $entreguesComAtraso));
    $diasData[] = [
        'data'       => $row['dia'],
        'dia'        => date('d', $ts),
        'mes'        => date('m', $ts),
        'mesNome'    => $meses[date('m', $ts)] ?? '',
        'diaSemana'  => $diasSemana[(int)date('w', $ts)] ?? '',
        'agendados'  => $agendados,
        'entregues'  => $entregues,
        'atrasados_sem_entrega' => $atrasadosSemEntrega,
        'entregues_com_atraso'  => $entreguesComAtraso,
        'atrasados'  => $atrasados,
    ];
}

respondJson([
    'success' => true,
    'data'    => ['diasData' => $diasData],
]);
