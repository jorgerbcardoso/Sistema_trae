<?php
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '120');

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
$dia     = $input['dia']     ?? '';
$excluirCnpjs = (isset($input['excluir_cnpjs']) && is_array($input['excluir_cnpjs'])) ? $input['excluir_cnpjs'] : [];
$excluirGrupos = (isset($input['excluir_grupos']) && is_array($input['excluir_grupos'])) ? $input['excluir_grupos'] : [];
$excluirSiglas = (isset($input['excluir_siglas']) && is_array($input['excluir_siglas'])) ? $input['excluir_siglas'] : [];

$conn = connect();

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

$params     = [];
$paramIndex = 1;
$whereConditions = ["cte.status <> 'C'"];

if ($tipo === 'periodo' || $tipo === 'cliente' || $tipo === 'unidade' || $tipo === 'grupo') {
    if (!empty($filters['periodoEmissaoInicio'])) {
        $whereConditions[] = 'cte.data_emissao >= $' . $paramIndex++;
        $params[] = $filters['periodoEmissaoInicio'];
    }
    if (!empty($filters['periodoEmissaoFim'])) {
        $whereConditions[] = 'cte.data_emissao <= $' . $paramIndex++;
        $params[] = $filters['periodoEmissaoFim'];
    }
}

if ($dia !== '' && ($tipo === 'evol_cliente' || $tipo === 'evol_unidade' || $tipo === 'cliente' || $tipo === 'unidade' || $tipo === 'grupo' || $tipo === 'periodo')) {
    $whereConditions[] = "cte.data_emissao = $" . $paramIndex++;
    $params[] = $dia;
} elseif ($mes !== '' && ($tipo === 'evol_cliente' || $tipo === 'evol_unidade' || $tipo === 'cliente' || $tipo === 'unidade' || $tipo === 'grupo' || $tipo === 'periodo')) {
    $whereConditions[] = "TO_CHAR(cte.data_emissao, 'YYYY-MM') = $" . $paramIndex++;
    $params[] = $mes;
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

if ($tipo === 'grupo') {
    $cnpjPrincipal = pg_escape_string($conn, $chave);
    $whereConditions[] = "cte.cnpj_pag IN (
        SELECT cnpj FROM {$domain}_grupo_cliente WHERE cnpj_principal = '{$cnpjPrincipal}'
    )";
} elseif ($tipo === 'cliente' || $tipo === 'evol_cliente') {
    if ($chave === '__demais__') {
        $hasExplicitExclusion = (count($excluirCnpjs) > 0) || (count($excluirGrupos) > 0);

        if ($hasExplicitExclusion) {
            if (count($excluirCnpjs) > 0) {
                $phs = [];
                foreach ($excluirCnpjs as $c) { $phs[] = '$' . $paramIndex++; $params[] = $c; }
                $whereConditions[] = 'cte.cnpj_pag NOT IN (' . implode(', ', $phs) . ')';
            }
            if (count($excluirGrupos) > 0) {
                $phs = [];
                foreach ($excluirGrupos as $g) { $phs[] = '$' . $paramIndex++; $params[] = $g; }
                $whereConditions[] = 'cte.cnpj_pag NOT IN (SELECT cnpj FROM ' . $domain . '_grupo_cliente WHERE cnpj_principal IN (' . implode(', ', $phs) . '))';
            }
        } else {
            $cnpjsSelecionados = !empty($filters['cnpjsPagadores']) && is_array($filters['cnpjsPagadores'])
                ? $filters['cnpjsPagadores'] : [];
            if (count($cnpjsSelecionados) > 0) {
                $phs = [];
                foreach ($cnpjsSelecionados as $c) { $phs[] = '$' . $paramIndex++; $params[] = $c; }
                $whereConditions[] = 'cte.cnpj_pag NOT IN (' . implode(', ', $phs) . ')';
            }
        }
    } else {
        $whereConditions[] = 'cte.cnpj_pag = $' . $paramIndex++;
        $params[] = $chave;
    }
} elseif ($tipo === 'unidade' || $tipo === 'evol_unidade') {
    if ($chave === '__demais__') {
        if (count($excluirSiglas) > 0) {
            $phs = [];
            foreach ($excluirSiglas as $s) { $phs[] = '$' . $paramIndex++; $params[] = $s; }
            $whereConditions[] = '(cte.sigla_emit IS NULL OR cte.sigla_emit NOT IN (' . implode(', ', $phs) . '))';
        } else {
            $whereConditions[] = 'cte.sigla_emit IS NULL';
        }
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
        COALESCE(cte.custo_seguro, 0)           AS custo_seguro,
        COALESCE(cte.custo_icms, 0)             AS custo_icms,
        COALESCE(cte.custo_pis_cofins, 0)       AS custo_pis_cofins,
        COALESCE(cte.custo_gris, 0)             AS custo_gris,
        COALESCE(cte.custo_pedagio, 0)          AS custo_pedagio,
        COALESCE(cte.custo_expedicao, 0)        AS custo_expedicao,
        COALESCE(cte.custo_transferencia, 0)    AS custo_transferencia,
        COALESCE(cte.custo_transbordo, 0)       AS custo_transbordo,
        COALESCE(cte.custo_vendedor, 0)         AS custo_vendedor,
        COALESCE(cte.custo_recepcao, 0)         AS custo_recepcao,
        COALESCE(cte.custo_desp_div, 0)         AS custo_desp_div,
        COALESCE(cte.custo_transferencia_real, 0) AS custo_transferencia_real,
        {$costExpr}                             AS total_custos,
        (COALESCE(cte.vlr_frete, 0) - {$costExpr}) AS resultado,
        cte.nome_pag,
        cte.nome_dest,
        cte.sigla_emit
    FROM {$domain}_cte cte
    {$whereClause}
    ORDER BY cte.data_emissao DESC, cte.nro_cte DESC
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
$totCustos   = 0;
$totResultado = 0;
$totCostBreak = [];
foreach ($costFields as $cf) { $totCostBreak[$cf] = 0.0; }

while ($row = pg_fetch_assoc($result)) {
    $ctes[] = [
        'ser_cte'      => $row['ser_cte'],
        'nro_cte'      => $row['nro_cte'],
        'data_emissao' => $row['data_emissao'],
        'vlr_merc'     => (float)$row['vlr_merc'],
        'peso_real'    => (float)$row['peso_real'],
        'qtde_vol'     => (int)$row['qtde_vol'],
        'vlr_frete'    => (float)$row['vlr_frete'],
        'total_custos' => (float)($row['total_custos'] ?? 0),
        'resultado'    => (float)($row['resultado'] ?? 0),
        'custo_seguro' => (float)($row['custo_seguro'] ?? 0),
        'custo_icms'   => (float)($row['custo_icms'] ?? 0),
        'custo_pis_cofins' => (float)($row['custo_pis_cofins'] ?? 0),
        'custo_gris'   => (float)($row['custo_gris'] ?? 0),
        'custo_pedagio' => (float)($row['custo_pedagio'] ?? 0),
        'custo_expedicao' => (float)($row['custo_expedicao'] ?? 0),
        'custo_transferencia' => (float)($row['custo_transferencia'] ?? 0),
        'custo_transbordo' => (float)($row['custo_transbordo'] ?? 0),
        'custo_vendedor' => (float)($row['custo_vendedor'] ?? 0),
        'custo_recepcao' => (float)($row['custo_recepcao'] ?? 0),
        'custo_desp_div' => (float)($row['custo_desp_div'] ?? 0),
        'custo_transferencia_real' => (float)($row['custo_transferencia_real'] ?? 0),
        'nome_pag'     => $row['nome_pag'],
        'nome_dest'    => $row['nome_dest'],
        'sigla_emit'   => $row['sigla_emit'],
    ];
    $totVlrMerc += (float)$row['vlr_merc'];
    $totPeso    += (float)$row['peso_real'];
    $totVol     += (int)$row['qtde_vol'];
    $totFrete   += (float)$row['vlr_frete'];
    $totCustos  += (float)($row['total_custos'] ?? 0);
    $totResultado += (float)($row['resultado'] ?? 0);
    foreach ($costFields as $cf) {
        $k = preg_replace('/[^a-z0-9_]/i', '', (string)$cf);
        if ($k === '') continue;
        $totCostBreak[$cf] += (float)($row[$k] ?? 0);
    }
}

$payload = [
    'success' => true,
    'data' => [
        'ctes'   => $ctes,
        'total'  => count($ctes),
        'totais' => [
            'vlr_merc'  => $totVlrMerc,
            'peso_real' => $totPeso,
            'qtde_vol'  => $totVol,
            'vlr_frete' => $totFrete,
            'total_custos' => $totCustos,
            'total_resultado' => $totResultado,
            'custo_seguro' => (float)($totCostBreak['custo_seguro'] ?? 0),
            'custo_icms' => (float)($totCostBreak['custo_icms'] ?? 0),
            'custo_pis_cofins' => (float)($totCostBreak['custo_pis_cofins'] ?? 0),
            'custo_gris' => (float)($totCostBreak['custo_gris'] ?? 0),
            'custo_pedagio' => (float)($totCostBreak['custo_pedagio'] ?? 0),
            'custo_expedicao' => (float)($totCostBreak['custo_expedicao'] ?? 0),
            'custo_transferencia' => (float)($totCostBreak['custo_transferencia'] ?? 0),
            'custo_transbordo' => (float)($totCostBreak['custo_transbordo'] ?? 0),
            'custo_vendedor' => (float)($totCostBreak['custo_vendedor'] ?? 0),
            'custo_recepcao' => (float)($totCostBreak['custo_recepcao'] ?? 0),
            'custo_desp_div' => (float)($totCostBreak['custo_desp_div'] ?? 0),
            'custo_transferencia_real' => (float)($totCostBreak['custo_transferencia_real'] ?? 0),
        ],
    ],
];

$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Erro ao serializar dados: ' . json_last_error_msg()]);
    exit;
}

http_response_code(200);
header('Content-Type: application/json; charset=utf-8');
header('Content-Length: ' . mb_strlen($json, '8bit'));
echo $json;
exit;
