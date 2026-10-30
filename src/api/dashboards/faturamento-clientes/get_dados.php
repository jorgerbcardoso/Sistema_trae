<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$input   = getRequestInput();
$filters = $input['filters'] ?? [];
$groupBy = isset($input['groupBy']) && $input['groupBy'] === 'clientes' ? 'clientes' : 'grupos';

$conn = connect();

$periodoIniRaw = (string)($filters['periodoEmissaoInicio'] ?? '');
$periodoFimRaw = (string)($filters['periodoEmissaoFim'] ?? '');
$evolucaoGranInput = strtolower(trim((string)($input['evolucao_gran'] ?? '')));

$evolucaoGran = 'mes';
try {
    $ini = $periodoIniRaw !== '' ? strtotime($periodoIniRaw) : null;
    $fim = $periodoFimRaw !== '' ? strtotime($periodoFimRaw) : null;
    if ($ini === null && $fim === null) {
        $fim = strtotime(date('Y-m-d'));
        $ini = strtotime('-30 days', $fim);
    } elseif ($ini === null && $fim !== null) {
        $ini = strtotime('-30 days', $fim);
    } elseif ($ini !== null && $fim === null) {
        $fim = strtotime(date('Y-m-d'));
    }
    if ($ini !== null && $fim !== null) {
        $dias = (int)floor(($fim - $ini) / 86400) + 1;
        if ($dias <= 62) $evolucaoGran = 'dia';
    }
} catch (Throwable $e) {
}
if ($evolucaoGranInput === 'dia' || $evolucaoGranInput === 'day') $evolucaoGran = 'dia';
if ($evolucaoGranInput === 'mes' || $evolucaoGranInput === 'month') $evolucaoGran = 'mes';

$costFields = [
    'custo_seguro',
    'custo_icms',
    'custo_pis_cofins',
    'custo_gris',
    'custo_pedagio',
    'custo_expedicao',
    'custo_transferencia',
    'custo_transbordo',
    'custo_vendedor',
    'custo_recepcao',
    'custo_desp_div',
    'custo_transferencia_real',
];
$costExprParts = [];
foreach ($costFields as $cf) {
    $col = preg_replace('/[^a-z0-9_]/i', '', (string)$cf);
    if ($col === '') continue;
    $costExprParts[] = "COALESCE(cte.{$col}, 0)";
}
$costExpr = '(' . implode(' + ', $costExprParts) . ')';

$buildEvolucao = function(string $where, array $params) use ($conn, $domain, $costExpr, $evolucaoGran): array {
    $selPeriodo = ($evolucaoGran === 'dia')
        ? "TO_CHAR(cte.data_emissao, 'YYYY-MM-DD') AS mes, TO_CHAR(cte.data_emissao, 'DD/MM') AS mes_label"
        : "TO_CHAR(cte.data_emissao, 'YYYY-MM') AS mes, TO_CHAR(cte.data_emissao, 'Mon/YY') AS mes_label";
    $grpPeriodo = ($evolucaoGran === 'dia')
        ? "TO_CHAR(cte.data_emissao, 'YYYY-MM-DD'), TO_CHAR(cte.data_emissao, 'DD/MM')"
        : "TO_CHAR(cte.data_emissao, 'YYYY-MM'), TO_CHAR(cte.data_emissao, 'Mon/YY')";
    $q = "
        SELECT
            {$selPeriodo},
            SUM(cte.vlr_frete)                    AS total_frete,
            SUM({$costExpr})                      AS total_custos,
            SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr}) AS total_resultado,
            SUM(COALESCE(cte.custo_seguro, 0))             AS custo_seguro,
            SUM(COALESCE(cte.custo_icms, 0))               AS custo_icms,
            SUM(COALESCE(cte.custo_pis_cofins, 0))         AS custo_pis_cofins,
            SUM(COALESCE(cte.custo_gris, 0))               AS custo_gris,
            SUM(COALESCE(cte.custo_pedagio, 0))            AS custo_pedagio,
            SUM(COALESCE(cte.custo_expedicao, 0))          AS custo_expedicao,
            SUM(COALESCE(cte.custo_transferencia, 0))      AS custo_transferencia,
            SUM(COALESCE(cte.custo_transbordo, 0))         AS custo_transbordo,
            SUM(COALESCE(cte.custo_vendedor, 0))           AS custo_vendedor,
            SUM(COALESCE(cte.custo_recepcao, 0))           AS custo_recepcao,
            SUM(COALESCE(cte.custo_desp_div, 0))           AS custo_desp_div,
            SUM(COALESCE(cte.custo_transferencia_real, 0)) AS custo_transferencia_real,
            COUNT(*)                                       AS qtde_ctes
        FROM {$domain}_cte cte
        {$where}
        GROUP BY {$grpPeriodo}
        ORDER BY mes ASC
    ";
    $res = pg_query_params($conn, $q, $params);
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro na query evolução: ' . pg_last_error($conn)]);
    }
    $out = [];
    while ($row = pg_fetch_assoc($res)) {
        $out[] = [
            'mes'         => $row['mes'],
            'mes_label'   => $row['mes_label'],
            'total_frete' => (float)($row['total_frete'] ?? 0),
            'total_custos' => (float)($row['total_custos'] ?? 0),
            'total_resultado' => (float)($row['total_resultado'] ?? 0),
            'custo_seguro' => (float)($row['custo_seguro'] ?? 0),
            'custo_icms' => (float)($row['custo_icms'] ?? 0),
            'custo_pis_cofins' => (float)($row['custo_pis_cofins'] ?? 0),
            'custo_gris' => (float)($row['custo_gris'] ?? 0),
            'custo_pedagio' => (float)($row['custo_pedagio'] ?? 0),
            'custo_expedicao' => (float)($row['custo_expedicao'] ?? 0),
            'custo_transferencia' => (float)($row['custo_transferencia'] ?? 0),
            'custo_transbordo' => (float)($row['custo_transbordo'] ?? 0),
            'custo_vendedor' => (float)($row['custo_vendedor'] ?? 0),
            'custo_recepcao' => (float)($row['custo_recepcao'] ?? 0),
            'custo_desp_div' => (float)($row['custo_desp_div'] ?? 0),
            'custo_transferencia_real' => (float)($row['custo_transferencia_real'] ?? 0),
            'qtde_ctes'   => (int)($row['qtde_ctes'] ?? 0),
        ];
    }
    return $out;
};

$params     = [];
$paramIndex = 1;
$whereConditions = ["cte.status <> 'C'"];
$whereConditions[] = "NOT (UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'PRES SERVICO' AND UPPER(BTRIM(COALESCE(cte.ser_cte, ''))) = '999')";

if (!empty($filters['periodoEmissaoInicio'])) {
    $whereConditions[] = 'cte.data_emissao >= $' . $paramIndex++;
    $params[] = $filters['periodoEmissaoInicio'];
}
if (!empty($filters['periodoEmissaoFim'])) {
    $whereConditions[] = 'cte.data_emissao <= $' . $paramIndex++;
    $params[] = $filters['periodoEmissaoFim'];
}
if (!empty($filters['tpFrete'])) {
    $whereConditions[] = 'cte.tp_frete = $' . $paramIndex++;
    $params[] = $filters['tpFrete'];
}
if (!empty($filters['siglaEmit']) && is_array($filters['siglaEmit']) && count($filters['siglaEmit']) > 0) {
    $placeholders = [];
    foreach ($filters['siglaEmit'] as $s) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $s;
    }
    $whereConditions[] = 'cte.sigla_emit IN (' . implode(', ', $placeholders) . ')';
}
if (!empty($filters['siglaDest']) && is_array($filters['siglaDest']) && count($filters['siglaDest']) > 0) {
    $placeholders = [];
    foreach ($filters['siglaDest'] as $s) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $s;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $placeholders) . ')';
}

$vendedorLogin = trim((string)($filters['vendedorLogin'] ?? ''));
if ($vendedorLogin !== '') {
    $tblVc = "{$domain}_vendedor_cliente";
    if ($vendedorLogin === '__sem_vendedor__') {
        $whereConditions[] = "NOT EXISTS (
            SELECT 1
            FROM {$tblVc} vc
            WHERE regexp_replace(COALESCE(vc.cnpj, ''), '\\\\D', '', 'g') = regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')
        )";
    } else {
        $whereConditions[] = "EXISTS (
            SELECT 1
            FROM {$tblVc} vc
            WHERE LOWER(BTRIM(vc.login)) = LOWER(BTRIM($" . $paramIndex++ . "))
              AND regexp_replace(COALESCE(vc.cnpj, ''), '\\\\D', '', 'g') = regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')
        )";
        $params[] = $vendedorLogin;
    }
}

$cnpjsSelecionados = !empty($filters['cnpjsPagadores']) && is_array($filters['cnpjsPagadores'])
    ? $filters['cnpjsPagadores']
    : [];

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

$queryParams      = $params;
$queryParamIndex  = $paramIndex;

if (count($cnpjsSelecionados) > 0) {
    $placeholders = [];
    foreach ($cnpjsSelecionados as $cnpj) {
        $placeholders[] = '$' . $queryParamIndex++;
        $queryParams[] = $cnpj;
    }
    $whereClauseClientes = $whereClause . ' AND cte.cnpj_pag IN (' . implode(', ', $placeholders) . ')';
} else {
    $whereClauseClientes = $whereClause;
}

$tblCliente = "{$domain}_cliente";
$tblUnidade = "{$domain}_unidade";

$colExists = function ($tbl, $col) use ($conn) {
    $res = null;
    try {
        $res = sql(
            "SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = lower($1)
               AND column_name = $2
             LIMIT 1",
            [$tbl, $col],
            $conn
        );
    } catch (Exception $e) {}
    return ($res && pg_num_rows($res) > 0);
};

$parseYmd = function ($s) {
    $s = trim((string)$s);
    if ($s === '') return null;
    $dt = DateTime::createFromFormat('Y-m-d', $s);
    if ($dt === false) return null;
    $dt->setTime(0, 0, 0);
    return $dt;
};

$periodoIniDt = $parseYmd($periodoIniRaw);
$periodoFimDt = $parseYmd($periodoFimRaw);
if ($periodoIniDt === null || $periodoFimDt === null) {
    try {
        $iniTs = isset($ini) ? (int)$ini : strtotime('-30 days');
        $fimTs = isset($fim) ? (int)$fim : strtotime(date('Y-m-d'));
        $periodoIniDt = new DateTime(date('Y-m-d', $iniTs));
        $periodoFimDt = new DateTime(date('Y-m-d', $fimTs));
        $periodoIniDt->setTime(0, 0, 0);
        $periodoFimDt->setTime(0, 0, 0);
    } catch (Throwable $e) {
        $periodoIniDt = new DateTime(date('Y-m-d'));
        $periodoFimDt = new DateTime(date('Y-m-d'));
        $periodoIniDt->setTime(0, 0, 0);
        $periodoFimDt->setTime(0, 0, 0);
    }
}

$todayDt = new DateTime(date('Y-m-d'));
$todayDt->setTime(0, 0, 0);
$periodoFimCalc = (clone $periodoFimDt);
if ($periodoFimCalc->getTimestamp() > $todayDt->getTimestamp()) $periodoFimCalc = (clone $todayDt);

$businessDaysBetween = function (DateTime $a, DateTime $b): int {
    $start = (clone $a);
    $end = (clone $b);
    if ($start->getTimestamp() > $end->getTimestamp()) {
        $tmp = $start;
        $start = $end;
        $end = $tmp;
    }
    $start->setTime(0, 0, 0);
    $end->setTime(0, 0, 0);
    $cnt = 0;
    while ($start->getTimestamp() <= $end->getTimestamp()) {
        $dow = (int)$start->format('N');
        if ($dow >= 1 && $dow <= 5) $cnt += 1;
        $start->modify('+1 day');
    }
    return $cnt;
};

$businessDaysInMonth = function (int $year, int $month) use ($businessDaysBetween): int {
    $ini = DateTime::createFromFormat('Y-m-d', sprintf('%04d-%02d-01', $year, $month));
    if ($ini === false) return 0;
    $fim = (clone $ini);
    $fim->modify('last day of this month');
    return $businessDaysBetween($ini, $fim);
};

$metaPeriodoFromMensal = function (float $metaMensal) use ($businessDaysBetween, $businessDaysInMonth, $periodoIniDt, $periodoFimCalc): float {
    if (!is_finite($metaMensal) || $metaMensal <= 0) return 0.0;
    $ini = (clone $periodoIniDt);
    $fim = (clone $periodoFimCalc);
    if ($ini->getTimestamp() > $fim->getTimestamp()) {
        $tmp = $ini;
        $ini = $fim;
        $fim = $tmp;
    }
    $total = 0.0;
    $cursor = DateTime::createFromFormat('Y-m-d', $ini->format('Y-m-01'));
    if ($cursor === false) return 0.0;
    $cursor->setTime(0, 0, 0);
    while ($cursor->getTimestamp() <= $fim->getTimestamp()) {
        $year = (int)$cursor->format('Y');
        $month = (int)$cursor->format('m');
        $mIni = DateTime::createFromFormat('Y-m-d', sprintf('%04d-%02d-01', $year, $month));
        if ($mIni === false) break;
        $mFim = (clone $mIni);
        $mFim->modify('last day of this month');
        $pIni = ($ini->getTimestamp() > $mIni->getTimestamp()) ? (clone $ini) : (clone $mIni);
        $pFim = ($fim->getTimestamp() < $mFim->getTimestamp()) ? (clone $fim) : (clone $mFim);
        if ($pIni->getTimestamp() <= $pFim->getTimestamp()) {
            $bdPart = $businessDaysBetween($pIni, $pFim);
            $bdMonth = $businessDaysInMonth($year, $month);
            if ($bdMonth > 0 && $bdPart > 0) $total += $metaMensal * ((float)$bdPart / (float)$bdMonth);
        }
        $cursor->modify('+1 month');
    }
    return $total;
};

$estimativaFromPeriodo = function (float $receitaPeriodo) use ($businessDaysBetween, $businessDaysInMonth, $periodoIniDt, $periodoFimCalc): float {
    if (!is_finite($receitaPeriodo) || $receitaPeriodo <= 0) return 0.0;
    $ini = (clone $periodoIniDt);
    $fim = (clone $periodoFimCalc);
    if ($ini->getTimestamp() > $fim->getTimestamp()) {
        $tmp = $ini;
        $ini = $fim;
        $fim = $tmp;
    }
    if ($ini->format('Y-m') !== $fim->format('Y-m')) return $receitaPeriodo;
    $year = (int)$ini->format('Y');
    $month = (int)$ini->format('m');
    $bdPart = $businessDaysBetween($ini, $fim);
    $bdMonth = $businessDaysInMonth($year, $month);
    if ($bdPart <= 0 || $bdMonth <= 0) return $receitaPeriodo;
    return $receitaPeriodo * ((float)$bdMonth / (float)$bdPart);
};

// ============================================================
// RANKING: modo GRUPOS ou CLIENTES
// ============================================================
$TOP_N = isset($filters['topN']) ? (int)$filters['topN'] : 10;
if (!in_array($TOP_N, [10, 20], true)) $TOP_N = 10;
$isSelection = count($cnpjsSelecionados) > 0;

if ($groupBy === 'grupos') {
    $queryRanking = "
        SELECT
            COALESCE(gc.cnpj_principal, cte.cnpj_pag)                         AS chave,
            COALESCE(MAX(cli.nome), MAX(cte.nome_pag), COALESCE(gc.cnpj_principal, cte.cnpj_pag)) AS nome,
            COUNT(*)                                                         AS qtde_ctes,
            SUM(cte.vlr_frete)                                               AS total_frete,
            SUM({$costExpr})                                                 AS total_custos,
            SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr})                    AS total_resultado,
            SUM(cte.vlr_merc)                                                AS total_merc,
            SUM(cte.peso_real)                                               AS total_peso,
            SUM(cte.qtde_vol)                                                AS total_volumes,
            AVG(cte.vlr_frete)                                               AS ticket_medio,
            COUNT(CASE WHEN cte.tp_frete = 'C' THEN 1 END)                   AS qtde_cif,
            COUNT(CASE WHEN cte.tp_frete = 'F' THEN 1 END)                   AS qtde_fob,
            (MAX(CASE WHEN gc.cnpj_principal IS NULL THEN 0 ELSE 1 END) = 1) AS is_grupo
        FROM {$domain}_cte cte
        LEFT JOIN {$domain}_grupo_cliente gc ON cte.cnpj_pag = gc.cnpj
        LEFT JOIN {$domain}_cliente cli      ON cli.cnpj = COALESCE(gc.cnpj_principal, cte.cnpj_pag)
        {$whereClauseClientes}
        GROUP BY 1
        ORDER BY total_frete DESC
        " . ($isSelection ? "" : "LIMIT {$TOP_N}") . "
    ";

    $resultRanking = pg_query_params($conn, $queryRanking, $queryParams);
    if (!$resultRanking) {
        respondJson(['success' => false, 'message' => 'Erro na query ranking grupos: ' . pg_last_error($conn)]);
    }

    $clientes = [];
    while ($row = pg_fetch_assoc($resultRanking)) {
        $clientes[] = [
            'cnpj'          => $row['chave'],
            'nome'          => $row['nome'] ?: 'SEM NOME',
            'qtde_ctes'     => (int)$row['qtde_ctes'],
            'total_frete'   => (float)$row['total_frete'],
            'total_custos'  => (float)($row['total_custos'] ?? 0),
            'total_resultado' => (float)($row['total_resultado'] ?? 0),
            'total_merc'    => (float)$row['total_merc'],
            'total_peso'    => (float)$row['total_peso'],
            'total_volumes' => (int)$row['total_volumes'],
            'ticket_medio'  => (float)$row['ticket_medio'],
            'qtde_cif'      => (int)$row['qtde_cif'],
            'qtde_fob'      => (int)$row['qtde_fob'],
            'is_grupo'      => pgBoolToPHP($row['is_grupo'] ?? false),
        ];
    }

} else {
    // Modo CLIENTES: comportamento original
    $queryRanking = "
        SELECT
            cte.cnpj_pag,
            cte.nome_pag,
            COUNT(*)                                            AS qtde_ctes,
            SUM(cte.vlr_frete)                                  AS total_frete,
            SUM({$costExpr})                                    AS total_custos,
            SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr})       AS total_resultado,
            SUM(cte.vlr_merc)                                   AS total_merc,
            SUM(cte.peso_real)                                  AS total_peso,
            SUM(cte.qtde_vol)                                   AS total_volumes,
            AVG(cte.vlr_frete)                                  AS ticket_medio,
            COUNT(CASE WHEN cte.tp_frete = 'C' THEN 1 END)     AS qtde_cif,
            COUNT(CASE WHEN cte.tp_frete = 'F' THEN 1 END)     AS qtde_fob
        FROM {$domain}_cte cte
        {$whereClauseClientes}
        GROUP BY cte.cnpj_pag, cte.nome_pag
        ORDER BY total_frete DESC
        " . ($isSelection ? "" : "LIMIT {$TOP_N}") . "
    ";

    $resultRanking = pg_query_params($conn, $queryRanking, $queryParams);
    if (!$resultRanking) {
        respondJson(['success' => false, 'message' => 'Erro na query ranking: ' . pg_last_error($conn)]);
    }

    $clientes = [];
    while ($row = pg_fetch_assoc($resultRanking)) {
        $clientes[] = [
            'cnpj'          => $row['cnpj_pag'],
            'nome'          => $row['nome_pag'] ?: 'SEM NOME',
            'qtde_ctes'     => (int)$row['qtde_ctes'],
            'total_frete'   => (float)$row['total_frete'],
            'total_custos'  => (float)($row['total_custos'] ?? 0),
            'total_resultado' => (float)($row['total_resultado'] ?? 0),
            'total_merc'    => (float)$row['total_merc'],
            'total_peso'    => (float)$row['total_peso'],
            'total_volumes' => (int)$row['total_volumes'],
            'ticket_medio'  => (float)$row['ticket_medio'],
            'qtde_cif'      => (int)$row['qtde_cif'],
            'qtde_fob'      => (int)$row['qtde_fob'],
            'is_grupo'      => false,
        ];
    }
}

$rowTotaisSel = null;

// ============================================================
// TOTAIS GERAIS
// ============================================================
$queryTotais = "
    SELECT
        COUNT(*)                        AS qtde_ctes,
        SUM(cte.vlr_frete)              AS total_frete,
        SUM({$costExpr})                AS total_custos,
        SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr}) AS total_resultado,
        SUM(cte.vlr_merc)               AS total_merc,
        SUM(cte.peso_real)              AS total_peso,
        SUM(cte.qtde_vol)               AS total_volumes,
        COUNT(DISTINCT cte.cnpj_pag)    AS qtde_clientes,
        COUNT(CASE WHEN cte.tp_frete = 'C' THEN 1 END) AS qtde_cif,
        COUNT(CASE WHEN cte.tp_frete = 'F' THEN 1 END) AS qtde_fob,
        SUM(COALESCE(cte.custo_seguro, 0))             AS custo_seguro,
        SUM(COALESCE(cte.custo_icms, 0))               AS custo_icms,
        SUM(COALESCE(cte.custo_pis_cofins, 0))         AS custo_pis_cofins,
        SUM(COALESCE(cte.custo_gris, 0))               AS custo_gris,
        SUM(COALESCE(cte.custo_pedagio, 0))            AS custo_pedagio,
        SUM(COALESCE(cte.custo_expedicao, 0))          AS custo_expedicao,
        SUM(COALESCE(cte.custo_transferencia, 0))      AS custo_transferencia,
        SUM(COALESCE(cte.custo_transbordo, 0))         AS custo_transbordo,
        SUM(COALESCE(cte.custo_vendedor, 0))           AS custo_vendedor,
        SUM(COALESCE(cte.custo_recepcao, 0))           AS custo_recepcao,
        SUM(COALESCE(cte.custo_desp_div, 0))           AS custo_desp_div,
        SUM(COALESCE(cte.custo_transferencia_real, 0)) AS custo_transferencia_real
    FROM {$domain}_cte cte
    {$whereClause}
";

$resultTotais = pg_query_params($conn, $queryTotais, $params);
if (!$resultTotais) {
    respondJson(['success' => false, 'message' => 'Erro na query totais: ' . pg_last_error($conn)]);
}
$rowTotais = pg_fetch_assoc($resultTotais);

$resultTotaisSel = pg_query_params($conn, $queryTotais, $queryParams);
if (!$resultTotaisSel) {
    respondJson(['success' => false, 'message' => 'Erro na query totais selecionados: ' . pg_last_error($conn)]);
}
$rowTotaisSel = pg_fetch_assoc($resultTotaisSel);

// ============================================================
// EVOLUÇÃO MENSAL (GERAL + SELECIONADOS)
// ============================================================
$evolucao = $buildEvolucao($whereClause, $queryParams);
$evolucaoSelecionados = $buildEvolucao($whereClauseClientes, $queryParams);

// ============================================================
// UNIDADES
// ============================================================
$queryUnidades = "
    SELECT
        cte.sigla_emit,
        SUM(cte.vlr_frete) AS total_frete,
        SUM({$costExpr})   AS total_custos,
        SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr}) AS total_resultado,
        COUNT(*)           AS qtde_ctes
    FROM {$domain}_cte cte
    {$whereClause}
    GROUP BY cte.sigla_emit
    ORDER BY total_frete DESC
    LIMIT 8
";

$resultUnidades = pg_query_params($conn, $queryUnidades, $queryParams);
if (!$resultUnidades) {
    respondJson(['success' => false, 'message' => 'Erro na query unidades: ' . pg_last_error($conn)]);
}

$unidades = [];
while ($row = pg_fetch_assoc($resultUnidades)) {
    $unidades[] = [
        'sigla'       => $row['sigla_emit'] ?: '-',
        'total_frete' => (float)$row['total_frete'],
        'total_custos' => (float)($row['total_custos'] ?? 0),
        'total_resultado' => (float)($row['total_resultado'] ?? 0),
        'qtde_ctes'   => (int)$row['qtde_ctes'],
    ];
}

// ============================================================
// EVOLUÇÃO 12 MESES POR CLIENTE/GRUPO
// ============================================================
$params12 = [];
$pi12 = 1;
$where12Conditions = ["cte.status <> 'C'", "cte.data_emissao >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'"];

if (!empty($filters['tpFrete'])) {
    $where12Conditions[] = 'cte.tp_frete = $' . $pi12++;
    $params12[] = $filters['tpFrete'];
}
if (!empty($filters['siglaEmit']) && is_array($filters['siglaEmit']) && count($filters['siglaEmit']) > 0) {
    $phs = [];
    foreach ($filters['siglaEmit'] as $s) { $phs[] = '$' . $pi12++; $params12[] = $s; }
    $where12Conditions[] = 'cte.sigla_emit IN (' . implode(', ', $phs) . ')';
}
if (!empty($filters['siglaDest']) && is_array($filters['siglaDest']) && count($filters['siglaDest']) > 0) {
    $phs = [];
    foreach ($filters['siglaDest'] as $s) { $phs[] = '$' . $pi12++; $params12[] = $s; }
    $where12Conditions[] = 'cte.sigla_dest IN (' . implode(', ', $phs) . ')';
}

$where12 = 'WHERE ' . implode(' AND ', $where12Conditions);

$params12Clientes = $params12;
$where12Clientes = $where12;

$evolClientesRaw = [];
$clientesNomes   = [];

if ($groupBy === 'grupos') {
    $queryEvolClientes = "
        SELECT
            TO_CHAR(cte.data_emissao, 'YYYY-MM')        AS mes,
            TO_CHAR(cte.data_emissao, 'Mon/YY')         AS mes_label,
            COALESCE(gc.cnpj_principal, cte.cnpj_pag)    AS chave,
            COALESCE(MAX(cli.nome), MAX(cte.nome_pag), COALESCE(gc.cnpj_principal, cte.cnpj_pag)) AS nome,
            SUM(cte.vlr_frete)                           AS total_frete,
            SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr}) AS total_resultado
        FROM {$domain}_cte cte
        LEFT JOIN {$domain}_grupo_cliente gc ON cte.cnpj_pag = gc.cnpj
        LEFT JOIN {$domain}_cliente cli      ON cli.cnpj = COALESCE(gc.cnpj_principal, cte.cnpj_pag)
        {$where12}
        GROUP BY 1, 2, 3
        ORDER BY mes ASC
    ";
} else {
    $queryEvolClientes = "
        SELECT
            TO_CHAR(cte.data_emissao, 'YYYY-MM') AS mes,
            TO_CHAR(cte.data_emissao, 'Mon/YY')  AS mes_label,
            cte.cnpj_pag                          AS chave,
            cte.nome_pag                          AS nome,
            SUM(cte.vlr_frete)                    AS total_frete,
            SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr}) AS total_resultado
        FROM {$domain}_cte cte
        {$where12}
        GROUP BY TO_CHAR(cte.data_emissao, 'YYYY-MM'), TO_CHAR(cte.data_emissao, 'Mon/YY'), cte.cnpj_pag, cte.nome_pag
        ORDER BY mes ASC
    ";
}

$resultEvolClientes = pg_query_params($conn, $queryEvolClientes, $params12Clientes);
if (!$resultEvolClientes) {
    respondJson(['success' => false, 'message' => 'Erro na query evolução clientes: ' . pg_last_error($conn)]);
}

while ($row = pg_fetch_assoc($resultEvolClientes)) {
    $mes   = $row['mes'];
    $chave = $row['chave'];
    $nome  = $row['nome'] ?: 'SEM NOME';
    if (!isset($evolClientesRaw[$mes])) $evolClientesRaw[$mes] = ['mes' => $mes, 'mes_label' => $row['mes_label']];
    $evolClientesRaw[$mes][$chave] = (float)$row['total_frete'];
    $evolClientesRaw[$mes]["{$chave}__resultado"] = (float)($row['total_resultado'] ?? 0);
    $clientesNomes[$chave] = $nome;
}

// ============================================================
// EVOLUÇÃO 12 MESES POR UNIDADE
// ============================================================
$queryEvolUnidades = "
    SELECT
        TO_CHAR(cte.data_emissao, 'YYYY-MM') AS mes,
        TO_CHAR(cte.data_emissao, 'Mon/YY')  AS mes_label,
        COALESCE(cte.sigla_emit, '-')         AS sigla,
        SUM(cte.vlr_frete)                    AS total_frete,
        SUM(COALESCE(cte.vlr_frete, 0) - {$costExpr}) AS total_resultado
    FROM {$domain}_cte cte
    {$where12}
    GROUP BY TO_CHAR(cte.data_emissao, 'YYYY-MM'), TO_CHAR(cte.data_emissao, 'Mon/YY'), COALESCE(cte.sigla_emit, '-')
    ORDER BY mes ASC
";

$resultEvolUnidades = pg_query_params($conn, $queryEvolUnidades, $params12Clientes);
if (!$resultEvolUnidades) {
    respondJson(['success' => false, 'message' => 'Erro na query evolução unidades: ' . pg_last_error($conn)]);
}

$evolUnidadesRaw = [];
$unidadesSiglas  = [];
while ($row = pg_fetch_assoc($resultEvolUnidades)) {
    $mes   = $row['mes'];
    $sigla = $row['sigla'];
    if (!isset($evolUnidadesRaw[$mes])) $evolUnidadesRaw[$mes] = ['mes' => $mes, 'mes_label' => $row['mes_label']];
    $evolUnidadesRaw[$mes][$sigla] = (float)$row['total_frete'];
    $evolUnidadesRaw[$mes]["{$sigla}__resultado"] = (float)($row['total_resultado'] ?? 0);
    $unidadesSiglas[$sigla] = true;
}

$metaCliOk = $colExists($tblCliente, 'meta_mensal');
$metaUniOk = $colExists($tblUnidade, 'meta_mensal');

$metaCliMap = [];
if ($metaCliOk && count($clientes) > 0) {
    $keys = [];
    foreach ($clientes as $c) {
        $k = trim((string)($c['cnpj'] ?? ''));
        if ($k !== '') $keys[$k] = true;
    }
    $keys = array_keys($keys);
    if (count($keys) > 0) {
        $ph = [];
        $pp = [];
        $pi = 1;
        foreach ($keys as $k) { $ph[] = '$' . $pi++; $pp[] = $k; }
        $resM = @pg_query_params(
            $conn,
            "SELECT cnpj, COALESCE(meta_mensal, 0) AS meta_mensal
             FROM {$tblCliente}
             WHERE cnpj IN (" . implode(',', $ph) . ")",
            $pp
        );
        if ($resM) {
            while ($r = pg_fetch_assoc($resM)) {
                $k = trim((string)($r['cnpj'] ?? ''));
                $metaCliMap[$k] = (float)($r['meta_mensal'] ?? 0);
            }
        }
    }
}

foreach ($clientes as $i => $c) {
    $cnpj = trim((string)($c['cnpj'] ?? ''));
    $metaMensal = $metaCliOk ? (float)($metaCliMap[$cnpj] ?? 0) : 0.0;
    $metaPeriodo = $metaPeriodoFromMensal($metaMensal);
    $totalFrete = (float)($c['total_frete'] ?? 0);
    $clientes[$i]['meta_mensal'] = $metaMensal;
    $clientes[$i]['meta_periodo'] = $metaPeriodo;
    $clientes[$i]['pct_meta'] = ($metaPeriodo > 0) ? (($totalFrete / $metaPeriodo) * 100.0) : 0.0;
    $clientes[$i]['estimativa_frete'] = $estimativaFromPeriodo($totalFrete);
}

$metaUniMap = [];
if ($metaUniOk && count($unidades) > 0) {
    $keys = [];
    foreach ($unidades as $u) {
        $k = strtoupper(trim((string)($u['sigla'] ?? '')));
        if ($k !== '') $keys[$k] = true;
    }
    $keys = array_keys($keys);
    if (count($keys) > 0) {
        $ph = [];
        $pp = [];
        $pi = 1;
        foreach ($keys as $k) { $ph[] = '$' . $pi++; $pp[] = $k; }
        $resM = @pg_query_params(
            $conn,
            "SELECT UPPER(BTRIM(sigla)) AS sigla, COALESCE(meta_mensal, 0) AS meta_mensal
             FROM {$tblUnidade}
             WHERE UPPER(BTRIM(sigla)) IN (" . implode(',', $ph) . ")",
            $pp
        );
        if ($resM) {
            while ($r = pg_fetch_assoc($resM)) {
                $k = strtoupper(trim((string)($r['sigla'] ?? '')));
                $metaUniMap[$k] = (float)($r['meta_mensal'] ?? 0);
            }
        }
    }
}

foreach ($unidades as $i => $u) {
    $sigla = strtoupper(trim((string)($u['sigla'] ?? '')));
    $metaMensal = $metaUniOk ? (float)($metaUniMap[$sigla] ?? 0) : 0.0;
    $metaPeriodo = $metaPeriodoFromMensal($metaMensal);
    $totalFrete = (float)($u['total_frete'] ?? 0);
    $unidades[$i]['meta_mensal'] = $metaMensal;
    $unidades[$i]['meta_periodo'] = $metaPeriodo;
    $unidades[$i]['pct_meta'] = ($metaPeriodo > 0) ? (($totalFrete / $metaPeriodo) * 100.0) : 0.0;
    $unidades[$i]['estimativa_frete'] = $estimativaFromPeriodo($totalFrete);
}

$metaEmpresaMensal = 0.0;
if ($metaUniOk) {
    $resSum = @pg_query($conn, "SELECT SUM(COALESCE(meta_mensal, 0)) AS meta FROM {$tblUnidade}");
    if ($resSum && pg_num_rows($resSum) > 0) $metaEmpresaMensal = (float)(pg_fetch_result($resSum, 0, 0) ?? 0);
}
$metaEmpresaPeriodo = $metaPeriodoFromMensal((float)$metaEmpresaMensal);
$freteEmpresaPeriodo = (float)($rowTotais['total_frete'] ?? 0);
$pctMetaEmpresa = ($metaEmpresaPeriodo > 0) ? (($freteEmpresaPeriodo / $metaEmpresaPeriodo) * 100.0) : 0.0;
$estimativaEmpresa = $estimativaFromPeriodo($freteEmpresaPeriodo);

respondJson([
    'success' => true,
    'data' => [
        'clientes'           => $clientes,
        'group_by'           => $groupBy,
      'evolucao_gran'      => $evolucaoGran,
        'totais'             => [
            'qtde_ctes'     => (int)($rowTotais['qtde_ctes'] ?? 0),
            'total_frete'   => (float)($rowTotais['total_frete'] ?? 0),
            'meta_mensal'   => (float)$metaEmpresaMensal,
            'meta_periodo'  => (float)$metaEmpresaPeriodo,
            'pct_meta'      => (float)$pctMetaEmpresa,
            'estimativa_frete' => (float)$estimativaEmpresa,
            'total_custos'  => (float)($rowTotais['total_custos'] ?? 0),
            'total_resultado' => (float)($rowTotais['total_resultado'] ?? 0),
            'total_merc'    => (float)($rowTotais['total_merc'] ?? 0),
            'total_peso'    => (float)($rowTotais['total_peso'] ?? 0),
            'total_volumes' => (int)($rowTotais['total_volumes'] ?? 0),
            'qtde_clientes' => (int)($rowTotais['qtde_clientes'] ?? 0),
            'qtde_cif'      => (int)($rowTotais['qtde_cif'] ?? 0),
            'qtde_fob'      => (int)($rowTotais['qtde_fob'] ?? 0),
            'custo_seguro'  => (float)($rowTotais['custo_seguro'] ?? 0),
            'custo_icms'    => (float)($rowTotais['custo_icms'] ?? 0),
            'custo_pis_cofins' => (float)($rowTotais['custo_pis_cofins'] ?? 0),
            'custo_gris'    => (float)($rowTotais['custo_gris'] ?? 0),
            'custo_pedagio' => (float)($rowTotais['custo_pedagio'] ?? 0),
            'custo_expedicao' => (float)($rowTotais['custo_expedicao'] ?? 0),
            'custo_transferencia' => (float)($rowTotais['custo_transferencia'] ?? 0),
            'custo_transbordo' => (float)($rowTotais['custo_transbordo'] ?? 0),
            'custo_vendedor' => (float)($rowTotais['custo_vendedor'] ?? 0),
            'custo_recepcao' => (float)($rowTotais['custo_recepcao'] ?? 0),
            'custo_desp_div' => (float)($rowTotais['custo_desp_div'] ?? 0),
            'custo_transferencia_real' => (float)($rowTotais['custo_transferencia_real'] ?? 0),
        ],
        'totais_selecionados' => [
            'qtde_ctes'     => (int)($rowTotaisSel['qtde_ctes'] ?? 0),
            'total_frete'   => (float)($rowTotaisSel['total_frete'] ?? 0),
            'total_custos'  => (float)($rowTotaisSel['total_custos'] ?? 0),
            'total_resultado' => (float)($rowTotaisSel['total_resultado'] ?? 0),
            'total_merc'    => (float)($rowTotaisSel['total_merc'] ?? 0),
            'total_peso'    => (float)($rowTotaisSel['total_peso'] ?? 0),
            'total_volumes' => (int)($rowTotaisSel['total_volumes'] ?? 0),
            'qtde_clientes' => (int)($rowTotaisSel['qtde_clientes'] ?? 0),
            'qtde_cif'      => (int)($rowTotaisSel['qtde_cif'] ?? 0),
            'qtde_fob'      => (int)($rowTotaisSel['qtde_fob'] ?? 0),
            'custo_seguro'  => (float)($rowTotaisSel['custo_seguro'] ?? 0),
            'custo_icms'    => (float)($rowTotaisSel['custo_icms'] ?? 0),
            'custo_pis_cofins' => (float)($rowTotaisSel['custo_pis_cofins'] ?? 0),
            'custo_gris'    => (float)($rowTotaisSel['custo_gris'] ?? 0),
            'custo_pedagio' => (float)($rowTotaisSel['custo_pedagio'] ?? 0),
            'custo_expedicao' => (float)($rowTotaisSel['custo_expedicao'] ?? 0),
            'custo_transferencia' => (float)($rowTotaisSel['custo_transferencia'] ?? 0),
            'custo_transbordo' => (float)($rowTotaisSel['custo_transbordo'] ?? 0),
            'custo_vendedor' => (float)($rowTotaisSel['custo_vendedor'] ?? 0),
            'custo_recepcao' => (float)($rowTotaisSel['custo_recepcao'] ?? 0),
            'custo_desp_div' => (float)($rowTotaisSel['custo_desp_div'] ?? 0),
            'custo_transferencia_real' => (float)($rowTotaisSel['custo_transferencia_real'] ?? 0),
        ],
        'evolucao'           => $evolucao,
        'evolucao_selecionados' => $evolucaoSelecionados,
        'unidades'           => $unidades,
        'evol_clientes'      => array_values($evolClientesRaw),
        'evol_clientes_keys' => $clientesNomes,
        'evol_unidades'      => array_values($evolUnidadesRaw),
        'evol_unidades_keys' => array_keys($unidadesSiglas),
    ],
]);
