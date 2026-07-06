<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

$input = getRequestInput();
$cardId  = (int)($input['cardId']  ?? 0);
$filters = $input['filters'] ?? [];

$conn = connect();

$params = [];
$paramIndex = 1;
$whereConditions = [];

$whereConditions[] = "cte.status <> 'C'";

$whereConditions[] = "(cte.tp_documento IS NULL OR cte.tp_documento NOT ILIKE '%COMPLEMENTAR%')";

if (!empty($filters['periodoEmissaoInicio'])) {
    $whereConditions[] = "cte.data_emissao >= $" . $paramIndex++;
    $params[] = $filters['periodoEmissaoInicio'];
}
if (!empty($filters['periodoEmissaoFim'])) {
    $whereConditions[] = "cte.data_emissao <= $" . $paramIndex++;
    $params[] = $filters['periodoEmissaoFim'];
}
if (!empty($filters['periodoPrevisaoInicio'])) {
    $whereConditions[] = "(CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) >= $" . $paramIndex++;
    $params[] = $filters['periodoPrevisaoInicio'];
}
if (!empty($filters['periodoPrevisaoFim'])) {
    $whereConditions[] = "(CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) <= $" . $paramIndex++;
    $params[] = $filters['periodoPrevisaoFim'];
}
if (!empty($filters['unidadeDestino']) && is_array($filters['unidadeDestino']) && count($filters['unidadeDestino']) > 0) {
    $placeholders = [];
    foreach ($filters['unidadeDestino'] as $sigla) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $sigla;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $placeholders) . ')';
}
if (!empty($filters['cnpjPagador'])) {
    $whereConditions[] = "cte.cnpj_pag = $" . $paramIndex++;
    $params[] = $filters['cnpjPagador'];
}
if (!empty($filters['cnpjDestinatario'])) {
    $whereConditions[] = "cte.cnpj_dest = $" . $paramIndex++;
    $params[] = $filters['cnpjDestinatario'];
}

$ocorAguardando = (strtoupper($domain) === 'RVE') ? 35 : 14;

switch ($cardId) {
    case 1:
        $whereConditions[] = "c.agenda = true";
        $whereConditions[] = "(cte.ult_ocor_agend IS NULL OR cte.ult_ocor_agend = 0)";
        $whereConditions[] = "cte.data_entrega IS NULL";
        break;
    case 2:
        $whereConditions[] = "cte.ult_ocor_agend = $ocorAguardando";
        $whereConditions[] = "cte.data_entrega IS NULL";
        break;
    case 3:
        $whereConditions[] = "cte.ult_ocor_agend = 15";
        $whereConditions[] = "(CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) >= CURRENT_DATE";
        $whereConditions[] = "cte.data_entrega IS NULL";
        break;
    case 4:
        $whereConditions[] = "cte.ult_ocor_agend = 15";
        $whereConditions[] = "cte.data_entrega IS NOT NULL";
        $whereConditions[] = "cte.data_entrega <= (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END)";
        break;
    case 5:
        $whereConditions[] = "((cte.data_entrega IS NULL AND (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) < CURRENT_DATE) OR (cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END)))";
        $whereConditions[] = "cte.ult_ocor_agend = 15";
        break;
    default:
        respondJson(['success' => false, 'message' => 'Card inválido']);
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

$query = "
    SELECT
        cte.ser_cte,
        cte.nro_cte,
        TO_CHAR(cte.data_emissao, 'DD/MM/YYYY')  AS data_emissao,
        TO_CHAR(cte.data_prev_ent, 'DD/MM/YYYY') AS data_prev_ent,
        TO_CHAR(cte.data_prev_ent, 'YYYY-MM-DD') AS data_prev_ent_iso,
        cte.nome_pag,
        cte.nome_dest,
        cte.cnpj_dest,
        COALESCE(c.email, '') AS email_dest,
        COALESCE(cte.nfs, '') AS nfs,
        CASE
            WHEN cte.ult_ocor IS NOT NULL AND cte.ult_ocor <> 0
            THEN LPAD(cte.ult_ocor::text, 2, '0') || ' - ' || COALESCE(ocor.descricao, '')
            ELSE ''
        END AS ult_ocor
    FROM {$domain}_cte cte
    LEFT JOIN {$domain}_cliente    c    ON cte.cnpj_dest = c.cnpj
    LEFT JOIN {$domain}_ocorrencia ocor ON cte.ult_ocor  = ocor.codigo
    $whereClause
    ORDER BY cte.cnpj_dest, cte.nome_dest, cte.data_emissao DESC
";

$result = pg_query_params($conn, $query, $params);

if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro na query: ' . pg_last_error($conn)]);
}

$ctes = [];
while ($row = pg_fetch_assoc($result)) {
    $ctes[] = [
        'ser_cte'      => $row['ser_cte'],
        'nro_cte'      => $row['nro_cte'],
        'data_emissao' => $row['data_emissao'],
        'data_prev_ent'=> $row['data_prev_ent'],
        'nome_pag'     => $row['nome_pag'],
        'nome_dest'    => $row['nome_dest'],
        'cnpj_dest'         => $row['cnpj_dest'],
        'email_dest'        => $row['email_dest'],
        'data_prev_ent_iso' => $row['data_prev_ent_iso'],
        'nfs'               => $row['nfs'],
        'ult_ocor'          => $row['ult_ocor'],
    ];
}

respondJson([
    'success' => true,
    'data' => [
        'ctes'  => $ctes,
        'total' => count($ctes),
    ],
]);
