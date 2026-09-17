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

$statusEntrega = $input['statusEntrega'] ?? null;
$dataPrevisao = $input['dataPrevisao'] ?? null;
$unidade = $input['unidade'] ?? null;
$coluna = $input['coluna'] ?? null;
$tipo = $input['tipo'] ?? null;
$data = $input['data'] ?? null;

$periodoEmissaoInicio = $filters['periodoEmissaoInicio'] ?? ($input['periodoEmissaoInicio'] ?? null);
$periodoEmissaoFim = $filters['periodoEmissaoFim'] ?? ($input['periodoEmissaoFim'] ?? null);
$periodoPrevisaoInicio = $filters['periodoPrevisaoInicio'] ?? ($input['periodoPrevisaoInicio'] ?? null);
$periodoPrevisaoFim = $filters['periodoPrevisaoFim'] ?? ($input['periodoPrevisaoFim'] ?? null);
$unidadeDestino = $filters['unidadeDestino'] ?? ($input['unidadeDestino'] ?? []);
$cnpjPagador = $filters['cnpjPagador'] ?? ($input['cnpjPagador'] ?? null);
$cnpjDestinatario = $filters['cnpjDestinatario'] ?? ($input['cnpjDestinatario'] ?? null);

$limit = isset($input['limit']) ? (int)$input['limit'] : 10000;
$limit = max(1, min(10000, $limit));

if (shouldUseMockData($domain)) {
    respondJson(['success' => true, 'data' => ['rows' => [], 'totals' => ['count' => 0, 'vlr_merc' => 0, 'vlr_frete' => 0, 'peso_real' => 0]]]);
}

$conn = connect();

$params = [];
$paramIndex = 1;
$whereConditions = [];

$whereConditions[] = "cte.status <> 'C'";
$whereConditions[] = "(cte.tp_documento IS NULL OR LTRIM(cte.tp_documento) NOT ILIKE 'COMPLEMENTAR%')";
$whereConditions[] = "UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) <> 'REENTREGA'";
$whereConditions[] = "UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) <> 'MANUAL'";

if ($statusEntrega) {
    switch ($statusEntrega) {
        case 'entregue_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'entregue_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'pendente_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= CURRENT_DATE)";
            break;
        case 'pendente_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) < CURRENT_DATE)";
            break;
        case 'prazo_total':
            $whereConditions[] = "((cte.data_entrega IS NOT NULL AND cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)) OR (cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= CURRENT_DATE))";
            break;
        case 'atraso_total':
            $whereConditions[] = "((cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)) OR (cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) < CURRENT_DATE))";
            break;
    }
}

if ($coluna) {
    switch ($coluna) {
        case 'total':
            break;
        case 'entregues_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'entregues_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'pendentes_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= CURRENT_DATE)";
            break;
        case 'pendentes_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) < CURRENT_DATE)";
            break;
    }
}

if ($dataPrevisao) {
    $whereConditions[] = "cte.data_prev_ent::date = $" . $paramIndex++;
    $params[] = $dataPrevisao;
}

if ($unidade) {
    $whereConditions[] = "cte.sigla_dest = $" . $paramIndex++;
    $params[] = $unidade;
}

if ($tipo && $data) {
    switch ($tipo) {
        case 'entregas_dia':
            $whereConditions[] = "cte.data_entrega::date = $" . $paramIndex++;
            $params[] = $data;
            break;
        case 'previstos_dia':
            $whereConditions[] = "cte.data_prev_ent::date = $" . $paramIndex++;
            $params[] = $data;
            break;
        case 'entregues_dia':
            $whereConditions[] = "cte.data_prev_ent::date = $" . $paramIndex++;
            $params[] = $data;
            $whereConditions[] = "cte.data_entrega IS NOT NULL";
            $whereConditions[] = "cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)";
            break;
        case 'atrasadas_dia':
            $whereConditions[] = "cte.data_prev_ent::date = $" . $paramIndex++;
            $params[] = $data;
            $whereConditions[] = "(
                (cte.data_entrega IS NOT NULL AND cte.data_entrega::date > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)::date)
                OR
                (cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)::date < CURRENT_DATE)
            )";
            break;
    }
}

if (!$dataPrevisao && !$tipo) {
    if ($periodoEmissaoInicio) {
        $whereConditions[] = "cte.data_emissao >= $" . $paramIndex++;
        $params[] = $periodoEmissaoInicio;
    }
    if ($periodoEmissaoFim) {
        $whereConditions[] = "cte.data_emissao <= $" . $paramIndex++;
        $params[] = $periodoEmissaoFim;
    }
    if ($periodoPrevisaoInicio) {
        $whereConditions[] = "cte.data_prev_ent >= $" . $paramIndex++;
        $params[] = $periodoPrevisaoInicio;
    }
    if ($periodoPrevisaoFim) {
        $whereConditions[] = "cte.data_prev_ent <= $" . $paramIndex++;
        $params[] = $periodoPrevisaoFim;
    }
}

if (is_array($unidadeDestino) && count($unidadeDestino) > 0) {
    $phs = [];
    foreach ($unidadeDestino as $s) {
        $phs[] = '$' . $paramIndex++;
        $params[] = $s;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $phs) . ')';
}

if ($cnpjPagador) {
    $whereConditions[] = "cte.cnpj_pag = $" . $paramIndex++;
    $params[] = $cnpjPagador;
}
if ($cnpjDestinatario) {
    $whereConditions[] = "cte.cnpj_dest = $" . $paramIndex++;
    $params[] = $cnpjDestinatario;
}

$whereClause = count($whereConditions) > 0 ? ('WHERE ' . implode(' AND ', $whereConditions)) : '';

$usarPrevisaoReal = (bool)($tipo || $dataPrevisao);
$exprDataPrev = $usarPrevisaoReal
    ? "cte.data_prev_ent"
    : "(CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE cte.data_prev_ent END)";
$exprPrazoComp = $usarPrevisaoReal
    ? "cte.data_prev_ent"
    : "(CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' OR UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'REENTREGA' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)";

$query = "
    SELECT
        cte.sigla_dest AS unid_atual,
        cte.ser_cte,
        cte.nro_cte,
        to_char(($exprDataPrev), 'DD/MM/YY') AS prev,
        CASE WHEN cte.data_entrega IS NULL THEN '' ELSE to_char(cte.data_entrega, 'DD/MM/YY') END AS entrega,
        CASE WHEN cte.data_entrega IS NULL THEN current_date - ($exprPrazoComp) ELSE cte.data_entrega - ($exprPrazoComp) END AS atraso,
        CASE
            WHEN cte.ult_ocor IS NULL OR cte.ult_ocor::text = '' THEN ''
            WHEN ocor.descricao IS NULL OR ocor.descricao = '' THEN cte.ult_ocor::text
            ELSE cte.ult_ocor::text || ' - ' || ocor.descricao
        END AS ult_ocor,
        CASE WHEN cte.data_ult_ocor IS NULL THEN '' ELSE to_char(cte.data_ult_ocor, 'DD/MM/YY') END AS data_ult_ocor,
        COALESCE(cte.vlr_merc, 0) AS vlr_merc,
        COALESCE(cte.vlr_frete, 0) AS vlr_frete,
        COALESCE(cte.peso_real, 0) AS peso_real
    FROM {$domain}_cte cte
    LEFT JOIN (
        SELECT codigo::text as codigo, MAX(tipo) as tipo, MAX(descricao) as descricao
        FROM {$domain}_ocorrencia
        GROUP BY codigo::text
    ) ocor ON ocor.codigo = cte.ult_ocor::text
    {$whereClause}
    ORDER BY cte.ser_cte, cte.nro_cte
    LIMIT {$limit}
";

$result = sql($query, $params, $conn);
if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar conhecimentos']);
}

$rows = [];
$totVlrMerc = 0.0;
$totVlrFrete = 0.0;
$totPeso = 0.0;
while ($row = pg_fetch_assoc($result)) {
    $vlrMerc = (float)$row['vlr_merc'];
    $vlrFrete = (float)$row['vlr_frete'];
    $peso = (float)$row['peso_real'];
    $totVlrMerc += $vlrMerc;
    $totVlrFrete += $vlrFrete;
    $totPeso += $peso;

    $rows[] = [
        'unid_atual' => $row['unid_atual'],
        'ser_cte' => $row['ser_cte'],
        'nro_cte' => $row['nro_cte'],
        'prev' => $row['prev'],
        'entrega' => $row['entrega'],
        'atraso' => (int)$row['atraso'],
        'ult_ocor' => $row['ult_ocor'],
        'data_ult_ocor' => $row['data_ult_ocor'],
        'vlr_merc' => $vlrMerc,
        'vlr_frete' => $vlrFrete,
        'peso_real' => $peso,
    ];
}

respondJson([
    'success' => true,
    'data' => [
        'rows' => $rows,
        'totals' => [
            'count' => count($rows),
            'vlr_merc' => $totVlrMerc,
            'vlr_frete' => $totVlrFrete,
            'peso_real' => $totPeso,
        ]
    ]
]);

