<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$input = getRequestInput();
$filters = $input['filters'] ?? [];
$limit = isset($input['limit']) ? (int)$input['limit'] : 2000;
$limit = max(1, min(20000, $limit));

$conn = connect();

$tableCte = "{$domain}_cte";
$tableCteOcor = "{$domain}_cte_ocorrencia";
$tableOcor = "{$domain}_ocorrencia";
$tableEmpParam = "{$domain}_emp_param";

$defaultOcorAgendamento = 15;
$ocorAgendamento = $defaultOcorAgendamento;
try {
    $resultEmpParam = sql("SELECT ocor_agendamento FROM {$tableEmpParam} LIMIT 1", [], $conn);
    $rowEmpParam = $resultEmpParam ? pg_fetch_assoc($resultEmpParam) : null;
    if ($rowEmpParam && $rowEmpParam['ocor_agendamento'] !== null && $rowEmpParam['ocor_agendamento'] !== '') {
        $ocorAgendamento = (int)$rowEmpParam['ocor_agendamento'];
    }
} catch (Exception $e) {
}

$params = [];
$paramIndex = 1;
$where = [];

$where[] = "cte.status <> 'C'";
$where[] = "(cte.tp_documento IS NULL OR LTRIM(cte.tp_documento) NOT ILIKE 'COMPLEMENTAR%')";
$where[] = "cte.data_entrega IS NULL";
$where[] = "cte.unid_atual IS NOT NULL AND BTRIM(cte.unid_atual) <> ''";
// Regra: não considerar CT-es já baixados/entregues (tipos de ocorrência B/E)
$where[] = "(om.tipo IS NULL OR UPPER(BTRIM(om.tipo)) NOT IN ('B', 'E'))";

if (!empty($filters['unidadeAtual']) && is_array($filters['unidadeAtual']) && count($filters['unidadeAtual']) > 0) {
    $placeholders = [];
    foreach ($filters['unidadeAtual'] as $sigla) {
        $sigla = strtoupper(trim((string)$sigla));
        if ($sigla === '') continue;
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $sigla;
    }
    if (count($placeholders) > 0) {
        $where[] = 'UPPER(cte.unid_atual) IN (' . implode(', ', $placeholders) . ')';
    }
}

if (!empty($filters['unidadeDestino']) && is_array($filters['unidadeDestino']) && count($filters['unidadeDestino']) > 0) {
    $placeholders = [];
    foreach ($filters['unidadeDestino'] as $sigla) {
        $sigla = strtoupper(trim((string)$sigla));
        if ($sigla === '') continue;
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $sigla;
    }
    if (count($placeholders) > 0) {
        $where[] = 'UPPER(cte.sigla_dest) IN (' . implode(', ', $placeholders) . ')';
    }
}

$periodoEmissaoInicio = trim((string)($filters['periodoEmissaoInicio'] ?? ''));
$periodoEmissaoFim = trim((string)($filters['periodoEmissaoFim'] ?? ''));
if ($periodoEmissaoInicio !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $periodoEmissaoInicio)) {
    $where[] = 'cte.data_emissao >= $' . $paramIndex++;
    $params[] = $periodoEmissaoInicio;
}
if ($periodoEmissaoFim !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $periodoEmissaoFim)) {
    $where[] = 'cte.data_emissao <= $' . $paramIndex++;
    $params[] = $periodoEmissaoFim;
}

$periodoPrevisaoInicio = trim((string)($filters['periodoPrevisaoInicio'] ?? ''));
$periodoPrevisaoFim = trim((string)($filters['periodoPrevisaoFim'] ?? ''));
if ($periodoPrevisaoInicio !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $periodoPrevisaoInicio)) {
    $where[] = 'cte.data_prev_ent >= $' . $paramIndex++;
    $params[] = $periodoPrevisaoInicio;
}
if ($periodoPrevisaoFim !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $periodoPrevisaoFim)) {
    $where[] = 'cte.data_prev_ent <= $' . $paramIndex++;
    $params[] = $periodoPrevisaoFim;
}

$tempoArmazemDe = trim((string)($filters['tempoArmazemDe'] ?? ''));
$tempoArmazemAte = trim((string)($filters['tempoArmazemAte'] ?? ''));
$baseDataArmazem = 'COALESCE(cte.data_chegada_unid, cte.data_inclusao, cte.data_emissao)';
if ($tempoArmazemDe !== '' && is_numeric($tempoArmazemDe)) {
    $where[] = "(CURRENT_DATE - {$baseDataArmazem}) >= $" . $paramIndex++;
    $params[] = (int)$tempoArmazemDe;
}
if ($tempoArmazemAte !== '' && is_numeric($tempoArmazemAte)) {
    $where[] = "(CURRENT_DATE - {$baseDataArmazem}) <= $" . $paramIndex++;
    $params[] = (int)$tempoArmazemAte;
}

$codigoUltOcor = trim((string)($filters['codigoUltOcor'] ?? ''));
if ($codigoUltOcor !== '' && is_numeric($codigoUltOcor)) {
    $where[] = "COALESCE(lo.codigo, cte.ult_ocor) = $" . $paramIndex++;
    $params[] = (int)$codigoUltOcor;
}

$tipoUltOcor = $filters['tipoUltOcor'] ?? null;
if ($tipoUltOcor !== null) {
    $arr = is_array($tipoUltOcor) ? $tipoUltOcor : [$tipoUltOcor];
    $arr = array_values(array_filter(array_map(function ($v) {
        return strtoupper(trim((string)$v));
    }, $arr), function ($v) {
        return $v !== '';
    }));
    if (count($arr) > 0) {
        $placeholders = [];
        foreach ($arr as $t) {
            $placeholders[] = '$' . $paramIndex++;
            $params[] = $t;
        }
        $where[] = "UPPER(COALESCE(om.tipo, '')) IN (" . implode(', ', $placeholders) . ")";
    }
}

$apenasAgendados = $filters['apenasAgendados'] ?? false;
if ($apenasAgendados === true || $apenasAgendados === 1 || $apenasAgendados === '1' || $apenasAgendados === 'true') {
    $where[] = "(cte.ult_ocor_agend = {$ocorAgendamento} AND cte.data_ult_ocor_agend IS NOT NULL)";
}

$whereClause = 'WHERE ' . implode(' AND ', $where);

$baseQuery = "
WITH last_ocor AS (
    SELECT DISTINCT ON (o.seq_cte)
        o.seq_cte,
        o.unidade,
        o.codigo,
        o.complemento,
        COALESCE(o.data_ocorrencia, o.data_inclusao) AS data_ocorrencia,
        COALESCE(o.hora_ocorrencia, o.hora_inclusao) AS hora_ocorrencia
    FROM {$tableCteOcor} o
    ORDER BY
        o.seq_cte,
        COALESCE(o.data_ocorrencia, o.data_inclusao) DESC,
        COALESCE(o.hora_ocorrencia, o.hora_inclusao) DESC,
        o.data_inclusao DESC,
        o.hora_inclusao DESC
),
ocor_map AS (
    SELECT codigo::int AS codigo, MAX(descricao) AS descricao, MAX(tipo) AS tipo
    FROM {$tableOcor}
    GROUP BY codigo::int
),
base AS (
    SELECT
        cte.seq_cte,
        cte.ser_cte,
        cte.nro_cte,
        cte.tp_documento,
        COALESCE(cte.entrega_abonada, false) AS entrega_abonada,
        cte.data_emissao,
        cte.data_prev_ent,
        cte.data_chegada_unid,
        cte.unid_atual,
        cte.sigla_emit,
        cte.sigla_dest,
        cte.nome_emit,
        cte.nome_dest,
        cte.nome_pag,
        cte.qtde_vol,
        cte.cubagem,
        COALESCE(cte.peso_real, cte.peso_calc) AS peso,
        cte.vlr_frete,
        cte.vlr_merc,
        (CURRENT_DATE - {$baseDataArmazem})::int AS dias_armazem,
        CASE
          WHEN cte.data_prev_ent IS NULL THEN NULL
          ELSE (
            CURRENT_DATE - (
              CASE
                WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE
                WHEN UPPER(BTRIM(COALESCE(om.tipo, ''))) = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE
                ELSE cte.data_prev_ent
              END
            )
          )::int
        END AS dias_atraso_prev,
        cte.ult_ocor_agend,
        cte.data_ult_ocor_agend,
        cte.hora_ult_ocor_agend,
        CASE
          WHEN cte.ult_ocor_agend = {$ocorAgendamento} AND cte.data_ult_ocor_agend IS NOT NULL THEN TRUE
          ELSE FALSE
        END AS agendado,
        COALESCE(lo.codigo, cte.ult_ocor) AS ult_ocor_codigo,
        om.descricao AS ult_ocor_descricao,
        om.tipo AS ult_ocor_tipo,
        lo.data_ocorrencia AS ult_ocor_data,
        lo.hora_ocorrencia AS ult_ocor_hora,
        lo.complemento AS ult_ocor_complemento,
        CASE
          WHEN lo.data_ocorrencia IS NULL OR lo.hora_ocorrencia IS NULL THEN NULL
          ELSE (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - (lo.data_ocorrencia + lo.hora_ocorrencia))) / 3600.0)
        END AS horas_desde_ult_ocor
    FROM {$tableCte} cte
    LEFT JOIN last_ocor lo ON lo.seq_cte = cte.seq_cte
    LEFT JOIN ocor_map om ON om.codigo = COALESCE(lo.codigo, cte.ult_ocor)
    {$whereClause}
)
";

$rowsQuery = $baseQuery . "
SELECT
    seq_cte,
    ser_cte,
    nro_cte,
    tp_documento,
    entrega_abonada,
    data_emissao,
    data_prev_ent,
    data_chegada_unid,
    unid_atual,
    sigla_emit,
    sigla_dest,
    nome_emit,
    nome_dest,
    nome_pag,
    qtde_vol,
    cubagem,
    peso,
    vlr_frete,
    vlr_merc,
    dias_armazem,
    dias_atraso_prev,
    ult_ocor_agend,
    data_ult_ocor_agend,
    hora_ult_ocor_agend,
    agendado,
    ult_ocor_codigo,
    ult_ocor_descricao,
    ult_ocor_tipo,
    ult_ocor_data,
    ult_ocor_hora,
    ult_ocor_complemento,
    horas_desde_ult_ocor
FROM base
ORDER BY
    dias_armazem DESC NULLS LAST,
    data_prev_ent ASC NULLS LAST,
    seq_cte DESC
LIMIT {$limit}
";

$result = sql($rowsQuery, $params, $conn);
if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro ao consultar dados']);
}

$rows = [];
while ($row = pg_fetch_assoc($result)) {
    $rows[] = [
        'seq_cte' => (int)($row['seq_cte'] ?? 0),
        'ser_cte' => (string)($row['ser_cte'] ?? ''),
        'nro_cte' => (int)($row['nro_cte'] ?? 0),
        'tp_documento' => $row['tp_documento'] ?? null,
        'entrega_abonada' => ($row['entrega_abonada'] ?? '') === 't',
        'data_emissao' => $row['data_emissao'] ?? null,
        'data_prev_ent' => $row['data_prev_ent'] ?? null,
        'data_chegada_unid' => $row['data_chegada_unid'] ?? null,
        'unid_atual' => $row['unid_atual'] ?? null,
        'sigla_emit' => $row['sigla_emit'] ?? null,
        'sigla_dest' => $row['sigla_dest'] ?? null,
        'nome_emit' => $row['nome_emit'] ?? null,
        'nome_dest' => $row['nome_dest'] ?? null,
        'nome_pag' => $row['nome_pag'] ?? null,
        'qtde_vol' => $row['qtde_vol'] !== null ? (int)$row['qtde_vol'] : null,
        'cubagem' => $row['cubagem'] !== null ? (float)$row['cubagem'] : null,
        'peso' => $row['peso'] !== null ? (float)$row['peso'] : null,
        'vlr_frete' => $row['vlr_frete'] !== null ? (float)$row['vlr_frete'] : null,
        'vlr_merc' => $row['vlr_merc'] !== null ? (float)$row['vlr_merc'] : null,
        'dias_armazem' => $row['dias_armazem'] !== null ? (int)$row['dias_armazem'] : null,
        'dias_atraso_prev' => $row['dias_atraso_prev'] !== null ? (int)$row['dias_atraso_prev'] : null,
        'agendado' => ($row['agendado'] ?? '') === 't',
        'ult_ocor_codigo' => $row['ult_ocor_codigo'] !== null ? (int)$row['ult_ocor_codigo'] : null,
        'ult_ocor_tipo' => $row['ult_ocor_tipo'] ?? null,
        'ult_ocor_descricao' => $row['ult_ocor_descricao'] ?? null,
        'ult_ocor_data' => $row['ult_ocor_data'] ?? null,
        'ult_ocor_hora' => $row['ult_ocor_hora'] ?? null,
        'ult_ocor_complemento' => $row['ult_ocor_complemento'] ?? null,
        'horas_desde_ult_ocor' => $row['horas_desde_ult_ocor'] !== null ? (float)$row['horas_desde_ult_ocor'] : null,
    ];
}

$summaryQuery = $baseQuery . "
SELECT
    COUNT(*)::int AS total,
    SUM(CASE WHEN agendado THEN 1 ELSE 0 END)::int AS agendados,
    SUM(CASE WHEN dias_armazem >= 4 THEN 1 ELSE 0 END)::int AS parados4,
    SUM(CASE WHEN dias_armazem >= 8 THEN 1 ELSE 0 END)::int AS parados8,
    SUM(CASE WHEN COALESCE(dias_atraso_prev, 0) > 0 THEN 1 ELSE 0 END)::int AS atraso_prev,
    SUM(CASE WHEN UPPER(COALESCE(ult_ocor_tipo, '')) = 'C' THEN 1 ELSE 0 END)::int AS pend_cliente,
    SUM(CASE WHEN UPPER(COALESCE(ult_ocor_tipo, '')) = 'P' THEN 1 ELSE 0 END)::int AS pend_transportadora,
    SUM(CASE WHEN COALESCE(ult_ocor_codigo, 0) = 0 THEN 1 ELSE 0 END)::int AS sem_ocorrencia,
    COALESCE(SUM(COALESCE(vlr_merc, 0)), 0)::numeric AS total_vlr_merc,
    COALESCE(SUM(COALESCE(vlr_frete, 0)), 0)::numeric AS total_vlr_frete,
    COALESCE(AVG(COALESCE(dias_armazem, 0)), 0)::numeric AS avg_dias_armazem,
    COALESCE(AVG(COALESCE(horas_desde_ult_ocor, 0)), 0)::numeric AS avg_horas_ult_ocor
FROM base
";

$summaryRes = sql($summaryQuery, $params, $conn);
$summaryRow = $summaryRes ? pg_fetch_assoc($summaryRes) : null;
$summary = [
    'total' => $summaryRow ? (int)($summaryRow['total'] ?? 0) : 0,
    'agendados' => $summaryRow ? (int)($summaryRow['agendados'] ?? 0) : 0,
    'parados4' => $summaryRow ? (int)($summaryRow['parados4'] ?? 0) : 0,
    'parados8' => $summaryRow ? (int)($summaryRow['parados8'] ?? 0) : 0,
    'atraso_prev' => $summaryRow ? (int)($summaryRow['atraso_prev'] ?? 0) : 0,
    'pend_cliente' => $summaryRow ? (int)($summaryRow['pend_cliente'] ?? 0) : 0,
    'pend_transportadora' => $summaryRow ? (int)($summaryRow['pend_transportadora'] ?? 0) : 0,
    'sem_ocorrencia' => $summaryRow ? (int)($summaryRow['sem_ocorrencia'] ?? 0) : 0,
    'total_vlr_merc' => $summaryRow ? (float)($summaryRow['total_vlr_merc'] ?? 0) : 0.0,
    'total_vlr_frete' => $summaryRow ? (float)($summaryRow['total_vlr_frete'] ?? 0) : 0.0,
    'avg_dias_armazem' => $summaryRow ? (float)($summaryRow['avg_dias_armazem'] ?? 0) : 0.0,
    'avg_horas_ult_ocor' => $summaryRow ? (float)($summaryRow['avg_horas_ult_ocor'] ?? 0) : 0.0,
];

$unitStatsQuery = $baseQuery . "
SELECT
    UPPER(COALESCE(unid_atual, '')) AS unid_atual,
    COUNT(*)::int AS total,
    SUM(CASE WHEN agendado THEN 1 ELSE 0 END)::int AS agendados,
    SUM(CASE WHEN dias_armazem >= 4 THEN 1 ELSE 0 END)::int AS parados4,
    SUM(CASE WHEN dias_armazem >= 8 THEN 1 ELSE 0 END)::int AS parados8,
    SUM(CASE WHEN COALESCE(dias_atraso_prev, 0) > 0 THEN 1 ELSE 0 END)::int AS atraso_prev,
    SUM(CASE WHEN UPPER(COALESCE(ult_ocor_tipo, '')) = 'C' THEN 1 ELSE 0 END)::int AS pend_cliente,
    SUM(CASE WHEN UPPER(COALESCE(ult_ocor_tipo, '')) = 'P' THEN 1 ELSE 0 END)::int AS pend_transportadora,
    SUM(CASE WHEN COALESCE(ult_ocor_codigo, 0) = 0 THEN 1 ELSE 0 END)::int AS sem_ocorrencia,
    SUM(CASE WHEN dias_armazem <= 1 THEN 1 ELSE 0 END)::int AS b_0_1,
    SUM(CASE WHEN dias_armazem BETWEEN 2 AND 3 THEN 1 ELSE 0 END)::int AS b_2_3,
    SUM(CASE WHEN dias_armazem BETWEEN 4 AND 7 THEN 1 ELSE 0 END)::int AS b_4_7,
    SUM(CASE WHEN dias_armazem BETWEEN 8 AND 15 THEN 1 ELSE 0 END)::int AS b_8_15,
    SUM(CASE WHEN dias_armazem >= 16 THEN 1 ELSE 0 END)::int AS b_16p,
    COALESCE(SUM(COALESCE(vlr_merc, 0)), 0)::numeric AS total_vlr_merc,
    COALESCE(SUM(COALESCE(vlr_frete, 0)), 0)::numeric AS total_vlr_frete,
    COALESCE(AVG(COALESCE(dias_armazem, 0)), 0)::numeric AS avg_dias_armazem,
    COALESCE(MAX(COALESCE(dias_armazem, 0)), 0)::int AS max_dias_armazem,
    COALESCE(AVG(COALESCE(horas_desde_ult_ocor, 0)), 0)::numeric AS avg_horas_ult_ocor
FROM base
GROUP BY UPPER(COALESCE(unid_atual, ''))
ORDER BY total DESC, unid_atual ASC
";

$unitStatsRes = sql($unitStatsQuery, $params, $conn);
$unitStats = [];
if ($unitStatsRes) {
    while ($r = pg_fetch_assoc($unitStatsRes)) {
        $unitStats[] = [
            'unid_atual' => $r['unid_atual'] ?? '',
            'total' => (int)($r['total'] ?? 0),
            'agendados' => (int)($r['agendados'] ?? 0),
            'parados4' => (int)($r['parados4'] ?? 0),
            'parados8' => (int)($r['parados8'] ?? 0),
            'atraso_prev' => (int)($r['atraso_prev'] ?? 0),
            'pend_cliente' => (int)($r['pend_cliente'] ?? 0),
            'pend_transportadora' => (int)($r['pend_transportadora'] ?? 0),
            'sem_ocorrencia' => (int)($r['sem_ocorrencia'] ?? 0),
            'b_0_1' => (int)($r['b_0_1'] ?? 0),
            'b_2_3' => (int)($r['b_2_3'] ?? 0),
            'b_4_7' => (int)($r['b_4_7'] ?? 0),
            'b_8_15' => (int)($r['b_8_15'] ?? 0),
            'b_16p' => (int)($r['b_16p'] ?? 0),
            'total_vlr_merc' => (float)($r['total_vlr_merc'] ?? 0),
            'total_vlr_frete' => (float)($r['total_vlr_frete'] ?? 0),
            'avg_dias_armazem' => (float)($r['avg_dias_armazem'] ?? 0),
            'max_dias_armazem' => (int)($r['max_dias_armazem'] ?? 0),
            'avg_horas_ult_ocor' => (float)($r['avg_horas_ult_ocor'] ?? 0),
        ];
    }
}

$unitMotivosQuery = $baseQuery . "
SELECT
    UPPER(COALESCE(unid_atual, '')) AS unid_atual,
    UPPER(COALESCE(ult_ocor_tipo, '')) AS tipo,
    COUNT(*)::int AS total
FROM base
GROUP BY UPPER(COALESCE(unid_atual, '')), UPPER(COALESCE(ult_ocor_tipo, ''))
ORDER BY total DESC
";

$unitMotivosRes = sql($unitMotivosQuery, $params, $conn);
$unitMotivos = [];
if ($unitMotivosRes) {
    while ($r = pg_fetch_assoc($unitMotivosRes)) {
        $unitMotivos[] = [
            'unid_atual' => $r['unid_atual'] ?? '',
            'tipo' => $r['tipo'] ?? '',
            'total' => (int)($r['total'] ?? 0),
        ];
    }
}

$unitTopOcQuery = $baseQuery . "
SELECT
    UPPER(COALESCE(unid_atual, '')) AS unid_atual,
    ult_ocor_codigo::int AS codigo,
    UPPER(COALESCE(ult_ocor_tipo, '')) AS tipo,
    MAX(COALESCE(ult_ocor_descricao, '')) AS descricao,
    COUNT(*)::int AS total
FROM base
WHERE ult_ocor_codigo IS NOT NULL
GROUP BY UPPER(COALESCE(unid_atual, '')), ult_ocor_codigo::int, UPPER(COALESCE(ult_ocor_tipo, ''))
ORDER BY total DESC
LIMIT 300
";

$unitTopOcRes = sql($unitTopOcQuery, $params, $conn);
$unitTopOcorrencias = [];
if ($unitTopOcRes) {
    while ($r = pg_fetch_assoc($unitTopOcRes)) {
        $unitTopOcorrencias[] = [
            'unid_atual' => $r['unid_atual'] ?? '',
            'codigo' => (int)($r['codigo'] ?? 0),
            'tipo' => $r['tipo'] ?? '',
            'descricao' => $r['descricao'] ?? '',
            'total' => (int)($r['total'] ?? 0),
        ];
    }
}

respondJson([
    'success' => true,
    'ocorAgendamento' => $ocorAgendamento,
    'limit' => $limit,
    'rows' => $rows,
    'summary' => $summary,
    'unitStats' => $unitStats,
    'unitMotivos' => $unitMotivos,
    'unitTopOcorrencias' => $unitTopOcorrencias,
]);
