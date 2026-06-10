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
$periodoOcorrenciaInicio = $input['periodoOcorrenciaInicio'] ?? '';
$periodoOcorrenciaFim = $input['periodoOcorrenciaFim'] ?? '';
$periodoEmissaoInicio = $input['periodoEmissaoInicio'] ?? '';
$periodoEmissaoFim = $input['periodoEmissaoFim'] ?? '';
$siglaEmit = $input['siglaEmit'] ?? [];

$conn = connect();

$params = [];
$paramIndex = 1;
$whereConditions = ["oc.codigo = 82"];

if (!empty($periodoOcorrenciaInicio)) {
    $whereConditions[] = 'oc.data_ocorrencia >= $' . $paramIndex++;
    $params[] = $periodoOcorrenciaInicio;
}
if (!empty($periodoOcorrenciaFim)) {
    $whereConditions[] = 'oc.data_ocorrencia <= $' . $paramIndex++;
    $params[] = $periodoOcorrenciaFim;
}
if (!empty($periodoEmissaoInicio)) {
    $whereConditions[] = 'cte.data_emissao >= $' . $paramIndex++;
    $params[] = $periodoEmissaoInicio;
}
if (!empty($periodoEmissaoFim)) {
    $whereConditions[] = 'cte.data_emissao <= $' . $paramIndex++;
    $params[] = $periodoEmissaoFim;
}
if (!empty($siglaEmit) && is_array($siglaEmit) && count($siglaEmit) > 0) {
    $placeholders = [];
    foreach ($siglaEmit as $s) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $s;
    }
    $whereConditions[] = 'cte.sigla_emit IN (' . implode(', ', $placeholders) . ')';
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

// Query para buscar CT-e retidos
$query = "
    SELECT DISTINCT ON (cte.seq_cte)
        cte.nro_cte,
        cte.ser_cte,
        TO_CHAR(cte.data_emissao, 'DD/MM/YYYY') AS data_emissao,
        TO_CHAR(oc.data_ocorrencia, 'DD/MM/YYYY') AS data_ocorrencia_82,
        cte.sigla_emit,
        cte.sigla_dest,
        cte.nome_emit,
        cte.nome_dest,
        cte.nome_pag,
        cte.peso_real,
        cte.vlr_merc,
        cte.vlr_frete,
        cte.qtde_vol,
        cte.ult_ocor,
        cte_emit.nome AS cidade_emit,
        cte_emit.uf AS uf_emit,
        cte_dest.nome AS cidade_dest,
        cte_dest.uf AS uf_dest
    FROM {$domain}_cte cte
    INNER JOIN {$domain}_cte_ocorrencia oc ON cte.seq_cte = oc.seq_cte
    LEFT JOIN cidade cte_emit ON cte.seq_cidade_emit = cte_emit.seq_cidade
    LEFT JOIN cidade cte_dest ON cte.seq_cidade_dest = cte_dest.seq_cidade
    {$whereClause}
    ORDER BY cte.seq_cte DESC, oc.data_ocorrencia DESC
";

$result = pg_query_params($conn, $query, $params);
if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro na query: ' . pg_last_error($conn)]);
}

$ctesRetidos = [];
$totais = [
    'total_retidos' => 0,
    'retidos_ativos' => 0,
    'retidos_resolvidos' => 0,
    'peso_total' => 0,
    'vlr_merc_total' => 0,
    'vlr_frete_total' => 0,
    'total_clientes' => 0
];
$clientesSet = [];
$serieDias = [];
$clientesQuantidade = [];

while ($row = pg_fetch_assoc($result)) {
    $isAtivo = (int)$row['ult_ocor'] === 82;
    $cte = [
        'nro_cte' => $row['nro_cte'],
        'ser_cte' => $row['ser_cte'],
        'data_emissao' => $row['data_emissao'],
        'data_ocorrencia_82' => $row['data_ocorrencia_82'],
        'sigla_emit' => $row['sigla_emit'],
        'sigla_dest' => $row['sigla_dest'],
        'nome_remetente' => $row['nome_emit'],
        'nome_destinatario' => $row['nome_dest'],
        'nome_pagador' => $row['nome_pag'],
        'cidade_emit' => $row['cidade_emit'],
        'uf_emit' => $row['uf_emit'],
        'cidade_dest' => $row['cidade_dest'],
        'uf_dest' => $row['uf_dest'],
        'peso_real' => (float)$row['peso_real'],
        'vlr_merc' => (float)$row['vlr_merc'],
        'vlr_frete' => (float)$row['vlr_frete'],
        'qt_vol' => (int)$row['qtde_vol'],
        'ult_ocor' => (int)$row['ult_ocor'],
        'is_ativo' => $isAtivo
    ];
    $ctesRetidos[] = $cte;

    $totais['total_retidos']++;
    if ($isAtivo) $totais['retidos_ativos']++;
    else $totais['retidos_resolvidos']++;
    $totais['peso_total'] += $cte['peso_real'];
    $totais['vlr_merc_total'] += $cte['vlr_merc'];
    $totais['vlr_frete_total'] += $cte['vlr_frete'];
    
    if ($cte['nome_pagador']) {
        $clientesSet[$cte['nome_pagador']] = true;
        if (!isset($clientesQuantidade[$cte['nome_pagador']])) {
            $clientesQuantidade[$cte['nome_pagador']] = 0;
        }
        $clientesQuantidade[$cte['nome_pagador']]++;
    }

    $dataOcorrencia = $cte['data_ocorrencia_82'];
    if (!isset($serieDias[$dataOcorrencia])) {
        $serieDias[$dataOcorrencia] = ['data' => $dataOcorrencia, 'retidos' => 0, 'resolvidos' => 0, 'peso' => 0];
    }
    if ($isAtivo) $serieDias[$dataOcorrencia]['retidos']++;
    else $serieDias[$dataOcorrencia]['resolvidos']++;
    $serieDias[$dataOcorrencia]['peso'] += $cte['peso_real'];
}

$totais['total_clientes'] = count($clientesSet);

// Preparar top 5 clientes
arsort($clientesQuantidade);
$topClientes = [];
$count = 0;
foreach ($clientesQuantidade as $nome => $qtd) {
    $topClientes[] = ['nome' => $nome, 'quantidade' => $qtd];
    $count++;
    if ($count >= 5) break;
}

// Preparar série cronológica
ksort($serieDias);
$serieCronologica = array_values($serieDias);

respondJson([
    'success' => true,
    'ctes_retidos' => $ctesRetidos,
    'serie_cronologica' => $serieCronologica,
    'totais' => $totais,
    'top_clientes' => $topClientes
]);
