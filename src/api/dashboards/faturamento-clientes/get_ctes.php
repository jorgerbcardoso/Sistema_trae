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
$tipo    = $input['tipo']    ?? '';
$chave   = $input['chave']   ?? '';
$mes     = $input['mes']     ?? '';

$conn = connect();

$params     = [];
$paramIndex = 1;
$whereConditions = ["cte.status <> 'C'"];

if ($tipo === 'periodo' || $tipo === 'cliente' || $tipo === 'unidade') {
    if (!empty($filters['periodoEmissaoInicio'])) {
        $whereConditions[] = 'cte.data_emissao >= $' . $paramIndex++;
        $params[] = $filters['periodoEmissaoInicio'];
    }
    if (!empty($filters['periodoEmissaoFim'])) {
        $whereConditions[] = 'cte.data_emissao <= $' . $paramIndex++;
        $params[] = $filters['periodoEmissaoFim'];
    }
}

if ($tipo === 'evol_cliente' || $tipo === 'evol_unidade') {
    if ($mes !== '') {
        $whereConditions[] = "TO_CHAR(cte.data_emissao, 'YYYY-MM') = $" . $paramIndex++;
        $params[] = $mes;
    }
}

if (!empty($filters['tpFrete'])) {
    $whereConditions[] = 'cte.tp_frete = $' . $paramIndex++;
    $params[] = $filters['tpFrete'];
}
if (!empty($filters['siglaEmit']) && is_array($filters['siglaEmit']) && count($filters['siglaEmit']) > 0) {
    $phs = [];
    foreach ($filters['siglaEmit'] as $s) { $phs[] = '$' . $paramIndex++; $params[] = $s; }
    $whereConditions[] = 'cte.sigla_emit IN (' . implode(', ', $phs) . ')';
}
if (!empty($filters['siglaDest']) && is_array($filters['siglaDest']) && count($filters['siglaDest']) > 0) {
    $phs = [];
    foreach ($filters['siglaDest'] as $s) { $phs[] = '$' . $paramIndex++; $params[] = $s; }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $phs) . ')';
}

if ($tipo === 'cliente' || $tipo === 'evol_cliente') {
    if ($chave === '__demais__') {
        $cnpjsSelecionados = !empty($filters['cnpjsPagadores']) && is_array($filters['cnpjsPagadores'])
            ? $filters['cnpjsPagadores'] : [];
        if (count($cnpjsSelecionados) > 0) {
            $phs = [];
            foreach ($cnpjsSelecionados as $c) { $phs[] = '$' . $paramIndex++; $params[] = $c; }
            $whereConditions[] = 'cte.cnpj_pag NOT IN (' . implode(', ', $phs) . ')';
        }
    } else {
        $whereConditions[] = 'cte.cnpj_pag = $' . $paramIndex++;
        $params[] = $chave;
    }
} elseif ($tipo === 'unidade' || $tipo === 'evol_unidade') {
    if ($chave === '__demais__') {
        $whereConditions[] = 'cte.sigla_emit IS NULL OR cte.sigla_emit NOT IN (SELECT DISTINCT sigla_emit FROM ' . $domain . '_cte WHERE status <> \'C\' ORDER BY sigla_emit LIMIT 5)';
    } else {
        $whereConditions[] = 'cte.sigla_emit = $' . $paramIndex++;
        $params[] = $chave;
    }
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

$query = "
    SELECT
        cte.ser_cte,
        cte.nro_cte,
        TO_CHAR(cte.data_emissao, 'DD/MM/YYYY') AS data_emissao,
        COALESCE(cte.vlr_merc, 0)               AS vlr_merc,
        COALESCE(cte.peso_real, 0)              AS peso_real,
        COALESCE(cte.qtde_vol, 0)               AS qtde_vol,
        COALESCE(cte.vlr_frete, 0)              AS vlr_frete,
        cte.nome_pag,
        cte.nome_dest,
        cte.sigla_emit
    FROM {$domain}_cte cte
    {$whereClause}
    ORDER BY cte.data_emissao DESC, cte.nro_cte DESC
    LIMIT 500
";

$result = pg_query_params($conn, $query, $params);
if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro: ' . pg_last_error($conn)]);
}

$ctes = [];
$totVlrMerc  = 0;
$totPeso     = 0;
$totVol      = 0;
$totFrete    = 0;

while ($row = pg_fetch_assoc($result)) {
    $ctes[] = [
        'ser_cte'      => $row['ser_cte'],
        'nro_cte'      => $row['nro_cte'],
        'data_emissao' => $row['data_emissao'],
        'vlr_merc'     => (float)$row['vlr_merc'],
        'peso_real'    => (float)$row['peso_real'],
        'qtde_vol'     => (int)$row['qtde_vol'],
        'vlr_frete'    => (float)$row['vlr_frete'],
        'nome_pag'     => $row['nome_pag'],
        'nome_dest'    => $row['nome_dest'],
        'sigla_emit'   => $row['sigla_emit'],
    ];
    $totVlrMerc += (float)$row['vlr_merc'];
    $totPeso    += (float)$row['peso_real'];
    $totVol     += (int)$row['qtde_vol'];
    $totFrete   += (float)$row['vlr_frete'];
}

respondJson([
    'success' => true,
    'data' => [
        'ctes'   => $ctes,
        'total'  => count($ctes),
        'totais' => [
            'vlr_merc'  => $totVlrMerc,
            'peso_real' => $totPeso,
            'qtde_vol'  => $totVol,
            'vlr_frete' => $totFrete,
        ],
    ],
]);
