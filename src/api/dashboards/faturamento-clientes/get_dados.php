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

$queryRanking = "
    SELECT
        cte.cnpj_pag,
        cte.nome_pag,
        COUNT(*)                        AS qtde_ctes,
        SUM(cte.vlr_frete)              AS total_frete,
        SUM(cte.vlr_merc)               AS total_merc,
        SUM(cte.peso_real)              AS total_peso,
        SUM(cte.qtde_vol)               AS total_volumes,
        AVG(cte.vlr_frete)              AS ticket_medio,
        COUNT(CASE WHEN cte.tp_frete = 'C' THEN 1 END) AS qtde_cif,
        COUNT(CASE WHEN cte.tp_frete = 'F' THEN 1 END) AS qtde_fob
    FROM {$domain}_cte cte
    {$whereClauseClientes}
    GROUP BY cte.cnpj_pag, cte.nome_pag
    ORDER BY total_frete DESC
    LIMIT 10
";

$resultRanking = pg_query_params($conn, $queryRanking, $queryParams);
if (!$resultRanking) {
    respondJson(['success' => false, 'message' => 'Erro na query ranking: ' . pg_last_error($conn)]);
}

$clientes = [];
$totalGeralFrete = 0;
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
    ];
    $totalGeralFrete += (float)$row['total_frete'];
}

$queryTotais = "
    SELECT
        COUNT(*)                        AS qtde_ctes,
        SUM(cte.vlr_frete)              AS total_frete,
        SUM(cte.vlr_merc)               AS total_merc,
        SUM(cte.peso_real)              AS total_peso,
        SUM(cte.qtde_vol)               AS total_volumes,
        COUNT(DISTINCT cte.cnpj_pag)    AS qtde_clientes
    FROM {$domain}_cte cte
    {$whereClause}
";

$resultTotais = pg_query_params($conn, $queryTotais, $params);
if (!$resultTotais) {
    respondJson(['success' => false, 'message' => 'Erro na query totais: ' . pg_last_error($conn)]);
}
$rowTotais = pg_fetch_assoc($resultTotais);

$queryEvolucao = "
    SELECT
        TO_CHAR(cte.data_emissao, 'YYYY-MM') AS mes,
        TO_CHAR(cte.data_emissao, 'Mon/YY')  AS mes_label,
        SUM(cte.vlr_frete)                    AS total_frete,
        COUNT(*)                              AS qtde_ctes
    FROM {$domain}_cte cte
    {$whereClauseClientes}
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

$queryUnidades = "
    SELECT
        cte.sigla_emit,
        SUM(cte.vlr_frete) AS total_frete,
        COUNT(*)           AS qtde_ctes
    FROM {$domain}_cte cte
    {$whereClauseClientes}
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
$pi12c = $pi12;
if (count($cnpjsSelecionados) > 0) {
    $phs = [];
    foreach ($cnpjsSelecionados as $cnpj) { $phs[] = '$' . $pi12c++; $params12Clientes[] = $cnpj; }
    $where12Clientes = $where12 . ' AND cte.cnpj_pag IN (' . implode(', ', $phs) . ')';
} else {
    $where12Clientes = $where12;
}

$queryEvolClientes = "
    SELECT
        TO_CHAR(cte.data_emissao, 'YYYY-MM') AS mes,
        TO_CHAR(cte.data_emissao, 'Mon/YY')  AS mes_label,
        cte.cnpj_pag,
        cte.nome_pag,
        SUM(cte.vlr_frete)                    AS total_frete
    FROM {$domain}_cte cte
    {$where12Clientes}
    GROUP BY TO_CHAR(cte.data_emissao, 'YYYY-MM'), TO_CHAR(cte.data_emissao, 'Mon/YY'), cte.cnpj_pag, cte.nome_pag
    ORDER BY mes ASC
";

$resultEvolClientes = pg_query_params($conn, $queryEvolClientes, $params12Clientes);
if (!$resultEvolClientes) {
    respondJson(['success' => false, 'message' => 'Erro na query evolução clientes: ' . pg_last_error($conn)]);
}

$evolClientesRaw = [];
$clientesNomes   = [];
while ($row = pg_fetch_assoc($resultEvolClientes)) {
    $mes  = $row['mes'];
    $cnpj = $row['cnpj_pag'];
    $nome = $row['nome_pag'] ?: 'SEM NOME';
    if (!isset($evolClientesRaw[$mes])) $evolClientesRaw[$mes] = ['mes' => $mes, 'mes_label' => $row['mes_label']];
    $evolClientesRaw[$mes][$cnpj] = (float)$row['total_frete'];
    $clientesNomes[$cnpj] = $nome;
}

$queryEvolUnidades = "
    SELECT
        TO_CHAR(cte.data_emissao, 'YYYY-MM') AS mes,
        TO_CHAR(cte.data_emissao, 'Mon/YY')  AS mes_label,
        COALESCE(cte.sigla_emit, '-')         AS sigla,
        SUM(cte.vlr_frete)                    AS total_frete
    FROM {$domain}_cte cte
    {$where12Clientes}
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
        'clientes'      => $clientes,
        'totais'        => [
            'qtde_ctes'     => (int)($rowTotais['qtde_ctes'] ?? 0),
            'total_frete'   => (float)($rowTotais['total_frete'] ?? 0),
            'total_merc'    => (float)($rowTotais['total_merc'] ?? 0),
            'total_peso'    => (float)($rowTotais['total_peso'] ?? 0),
            'total_volumes' => (int)($rowTotais['total_volumes'] ?? 0),
            'qtde_clientes' => (int)($rowTotais['qtde_clientes'] ?? 0),
        ],
        'evolucao'          => $evolucao,
        'unidades'          => $unidades,
        'evol_clientes'     => array_values($evolClientesRaw),
        'evol_clientes_keys'=> $clientesNomes,
        'evol_unidades'     => array_values($evolUnidadesRaw),
        'evol_unidades_keys'=> array_keys($unidadesSiglas),
    ],
]);
