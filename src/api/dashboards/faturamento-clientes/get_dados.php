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

$params     = [];
$paramIndex = 1;
$whereConditions = ["cte.status <> 'C'"];

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

$totaisSelecionados = [
    'qtde_ctes'     => 0,
    'total_frete'   => 0.0,
    'total_merc'    => 0.0,
    'total_peso'    => 0.0,
    'total_volumes' => 0,
    'qtde_clientes' => 0,
    'qtde_cif'      => 0,
    'qtde_fob'      => 0,
];
foreach ($clientes as $c) {
    $totaisSelecionados['qtde_ctes']     += (int)($c['qtde_ctes'] ?? 0);
    $totaisSelecionados['total_frete']   += (float)($c['total_frete'] ?? 0);
    $totaisSelecionados['total_merc']    += (float)($c['total_merc'] ?? 0);
    $totaisSelecionados['total_peso']    += (float)($c['total_peso'] ?? 0);
    $totaisSelecionados['total_volumes'] += (int)($c['total_volumes'] ?? 0);
    $totaisSelecionados['qtde_clientes'] += 1;
    $totaisSelecionados['qtde_cif']      += (int)($c['qtde_cif'] ?? 0);
    $totaisSelecionados['qtde_fob']      += (int)($c['qtde_fob'] ?? 0);
}

// ============================================================
// TOTAIS GERAIS
// ============================================================
$queryTotais = "
    SELECT
        COUNT(*)                        AS qtde_ctes,
        SUM(cte.vlr_frete)              AS total_frete,
        SUM(cte.vlr_merc)               AS total_merc,
        SUM(cte.peso_real)              AS total_peso,
        SUM(cte.qtde_vol)               AS total_volumes,
        COUNT(DISTINCT cte.cnpj_pag)    AS qtde_clientes,
        COUNT(CASE WHEN cte.tp_frete = 'C' THEN 1 END) AS qtde_cif,
        COUNT(CASE WHEN cte.tp_frete = 'F' THEN 1 END) AS qtde_fob
    FROM {$domain}_cte cte
    {$whereClause}
";

$resultTotais = pg_query_params($conn, $queryTotais, $params);
if (!$resultTotais) {
    respondJson(['success' => false, 'message' => 'Erro na query totais: ' . pg_last_error($conn)]);
}
$rowTotais = pg_fetch_assoc($resultTotais);

// ============================================================
// EVOLUÇÃO MENSAL
// ============================================================
$queryEvolucao = "
    SELECT
        TO_CHAR(cte.data_emissao, 'YYYY-MM') AS mes,
        TO_CHAR(cte.data_emissao, 'Mon/YY')  AS mes_label,
        SUM(cte.vlr_frete)                    AS total_frete,
        COUNT(*)                              AS qtde_ctes
    FROM {$domain}_cte cte
    {$whereClause}
    GROUP BY TO_CHAR(cte.data_emissao, 'YYYY-MM'), TO_CHAR(cte.data_emissao, 'Mon/YY')
    ORDER BY mes ASC
";

$resultEvolucao = pg_query_params($conn, $queryEvolucao, $queryParams);
if (!$resultEvolucao) {
    respondJson(['success' => false, 'message' => 'Erro na query evolução: ' . pg_last_error($conn)]);
}

$evolucao = [];
while ($row = pg_fetch_assoc($resultEvolucao)) {
    $evolucao[] = [
        'mes'         => $row['mes'],
        'mes_label'   => $row['mes_label'],
        'total_frete' => (float)$row['total_frete'],
        'qtde_ctes'   => (int)$row['qtde_ctes'],
    ];
}

// ============================================================
// UNIDADES
// ============================================================
$queryUnidades = "
    SELECT
        cte.sigla_emit,
        SUM(cte.vlr_frete) AS total_frete,
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
            SUM(cte.vlr_frete)                           AS total_frete
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
            SUM(cte.vlr_frete)                    AS total_frete
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
        SUM(cte.vlr_frete)                    AS total_frete
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
    $unidadesSiglas[$sigla] = true;
}

respondJson([
    'success' => true,
    'data' => [
        'clientes'           => $clientes,
        'group_by'           => $groupBy,
        'totais'             => [
            'qtde_ctes'     => (int)($rowTotais['qtde_ctes'] ?? 0),
            'total_frete'   => (float)($rowTotais['total_frete'] ?? 0),
            'total_merc'    => (float)($rowTotais['total_merc'] ?? 0),
            'total_peso'    => (float)($rowTotais['total_peso'] ?? 0),
            'total_volumes' => (int)($rowTotais['total_volumes'] ?? 0),
            'qtde_clientes' => (int)($rowTotais['qtde_clientes'] ?? 0),
            'qtde_cif'      => (int)($rowTotais['qtde_cif'] ?? 0),
            'qtde_fob'      => (int)($rowTotais['qtde_fob'] ?? 0),
        ],
        'totais_selecionados' => [
            'qtde_ctes'     => (int)$totaisSelecionados['qtde_ctes'],
            'total_frete'   => (float)$totaisSelecionados['total_frete'],
            'total_merc'    => (float)$totaisSelecionados['total_merc'],
            'total_peso'    => (float)$totaisSelecionados['total_peso'],
            'total_volumes' => (int)$totaisSelecionados['total_volumes'],
            'qtde_clientes' => (int)$totaisSelecionados['qtde_clientes'],
            'qtde_cif'      => (int)$totaisSelecionados['qtde_cif'],
            'qtde_fob'      => (int)$totaisSelecionados['qtde_fob'],
        ],
        'evolucao'           => $evolucao,
        'unidades'           => $unidades,
        'evol_clientes'      => array_values($evolClientesRaw),
        'evol_clientes_keys' => $clientesNomes,
        'evol_unidades'      => array_values($evolUnidadesRaw),
        'evol_unidades_keys' => array_keys($unidadesSiglas),
    ],
]);
