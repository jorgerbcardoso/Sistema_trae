<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

$input  = getRequestInput();
$data   = $input['data']  ?? '';
$tipo   = $input['tipo']  ?? '';
$filters = $input['filters'] ?? [];

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
    respondJson(['success' => false, 'message' => 'Data inválida']);
}

if (!in_array($tipo, ['agendados', 'no_prazo'])) {
    respondJson(['success' => false, 'message' => 'Tipo inválido. Use agendados ou no_prazo']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$conn = connect();

$params     = [];
$paramIndex = 1;
$whereConditions = [
    "cte.status <> 'C'",
    "cte.ult_ocor_agend = 15",
    "cte.data_prev_ent::date = $" . $paramIndex++,
];
$params[] = $data;

if ($tipo === 'no_prazo') {
    $whereConditions[] = "cte.data_entrega IS NOT NULL";
    $whereConditions[] = "cte.data_entrega <= cte.data_prev_ent";
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
    $whereConditions[] = 'cte.cnpj_pag = $' . $paramIndex++;
    $params[] = $filters['cnpjPagador'];
}
if (!empty($filters['cnpjDestinatario'])) {
    $whereConditions[] = 'cte.cnpj_dest = $' . $paramIndex++;
    $params[] = $filters['cnpjDestinatario'];
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

$query = "
    SELECT
        cte.ser_cte,
        cte.nro_cte,
        TO_CHAR(cte.data_emissao,  'DD/MM/YYYY') AS data_emissao,
        TO_CHAR(cte.data_prev_ent, 'DD/MM/YYYY') AS data_prev_ent,
        TO_CHAR(cte.data_prev_ent, 'YYYY-MM-DD') AS data_prev_ent_iso,
        cte.nome_pag,
        cte.nome_dest,
        cte.cnpj_dest,
        COALESCE(c.email, '') AS email_dest,
        CASE
            WHEN cte.ult_ocor IS NOT NULL AND cte.ult_ocor <> 0
            THEN LPAD(cte.ult_ocor::text, 2, '0') || ' - ' || COALESCE(ocor.descricao, '')
            ELSE ''
        END AS ult_ocor
    FROM {$domain}_cte cte
    LEFT JOIN {$domain}_cliente    c    ON cte.cnpj_dest = c.cnpj
    LEFT JOIN {$domain}_ocorrencia ocor ON cte.ult_ocor  = ocor.codigo
    {$whereClause}
    ORDER BY cte.cnpj_dest, cte.nome_dest, cte.data_emissao DESC
";

$result = pg_query_params($conn, $query, $params);

if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro na query: ' . pg_last_error($conn)]);
}

$ctes = [];
while ($row = pg_fetch_assoc($result)) {
    $ctes[] = [
        'ser_cte'           => $row['ser_cte'],
        'nro_cte'           => $row['nro_cte'],
        'data_emissao'      => $row['data_emissao'],
        'data_prev_ent'     => $row['data_prev_ent'],
        'data_prev_ent_iso' => $row['data_prev_ent_iso'],
        'nome_pag'          => $row['nome_pag'],
        'nome_dest'         => $row['nome_dest'],
        'cnpj_dest'         => $row['cnpj_dest'],
        'email_dest'        => $row['email_dest'],
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
