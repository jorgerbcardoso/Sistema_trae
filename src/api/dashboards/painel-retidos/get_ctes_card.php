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
$cardId = $input['cardId'] ?? '';
$filters = $input['filters'] ?? [];
$periodoOcorrenciaInicio = $filters['periodoOcorrenciaInicio'] ?? '';
$periodoOcorrenciaFim = $filters['periodoOcorrenciaFim'] ?? '';
$periodoEmissaoInicio = $filters['periodoEmissaoInicio'] ?? '';
$periodoEmissaoFim = $filters['periodoEmissaoFim'] ?? '';
$siglaEmit = $filters['siglaEmit'] ?? [];

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

// Add filter for card type
if ($cardId === 'ativos') {
    $whereConditions[] = 'cte.ult_ocor = 82';
} elseif ($cardId === 'resolvidos') {
    $whereConditions[] = 'cte.ult_ocor != 82';
}

$conn = connect();

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

// Query to fetch CT-es
$query = "
    SELECT DISTINCT ON (cte.seq_cte)
        cte.nro_cte,
        cte.ser_cte,
        TO_CHAR(cte.data_emissao, 'DD/MM/YYYY') AS data_emissao,
        TO_CHAR(oc.data_ocorrencia, 'DD/MM/YYYY') AS data_ocorrencia_82,
        cte.sigla_emit,
        cte.sigla_dest,
        cte.nome_emit AS nome_remetente,
        cte.nome_dest AS nome_destinatario,
        cte.nome_pag AS nome_pagador,
        cte_emit.nome AS cidade_emit,
        cte_emit.uf AS uf_emit,
        cte_dest.nome AS cidade_dest,
        cte_dest.uf AS uf_dest,
        cte.peso_real,
        cte.vlr_merc,
        cte.vlr_frete,
        cte.qtde_vol AS qt_vol,
        cte.ult_ocor,
        (cte.ult_ocor = 82) AS is_ativo
    FROM {$domain}_cte cte
    INNER JOIN {$domain}_cte_ocorrencia oc ON cte.seq_cte = oc.seq_cte
    LEFT JOIN cidade cte_emit ON cte.seq_cidade_emit = cte_emit.seq_cidade
    LEFT JOIN cidade cte_dest ON cte.seq_cidade_dest = cte_dest.seq_cidade
    $whereClause
    ORDER BY cte.seq_cte DESC, oc.data_ocorrencia DESC
";

$result = pg_query_params($conn, $query, $params);
if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro na query: ' . pg_last_error($conn)]);
}

$ctes = [];
while ($row = pg_fetch_assoc($result)) {
    $ctes[] = [
        'nro_cte' => $row['nro_cte'],
        'ser_cte' => $row['ser_cte'],
        'data_emissao' => $row['data_emissao'],
        'data_ocorrencia_82' => $row['data_ocorrencia_82'],
        'sigla_emit' => $row['sigla_emit'],
        'sigla_dest' => $row['sigla_dest'],
        'nome_remetente' => $row['nome_remetente'],
        'nome_destinatario' => $row['nome_destinatario'],
        'nome_pagador' => $row['nome_pagador'],
        'cidade_emit' => $row['cidade_emit'],
        'uf_emit' => $row['uf_emit'],
        'cidade_dest' => $row['cidade_dest'],
        'uf_dest' => $row['uf_dest'],
        'peso_real' => (float)$row['peso_real'],
        'vlr_merc' => (float)$row['vlr_merc'],
        'vlr_frete' => (float)$row['vlr_frete'],
        'qt_vol' => (int)$row['qt_vol'],
        'ult_ocor' => (int)$row['ult_ocor'],
        'is_ativo' => (bool)$row['is_ativo']
    ];
}

respondJson([
    'success' => true,
    'ctes' => $ctes
]);
