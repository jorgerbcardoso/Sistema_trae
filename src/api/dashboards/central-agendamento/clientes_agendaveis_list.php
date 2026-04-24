<?php
/**
 * ================================================================
 * API: CLIENTES AGENDÁVEIS - LISTAGEM
 * ================================================================
 * Lista clientes do domínio para configuração de agendamento recorrente.
 * - Limite fixo de 500 registros
 * - Clientes com agenda=true aparecem primeiro
 * - Permite busca por nome ou cidade
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtoupper(trim($auth['domain'] ?? ''));
$input = getRequestInput();

$search = trim($input['search'] ?? '');
$limit = 500;

$searchUnaccented = removeAccents($search);
$params = [];
$where = '';

if ($searchUnaccented !== '') {
    $where = "
        WHERE (
            UPPER(COALESCE(c.nome, '')) LIKE UPPER($1)
            OR UPPER(COALESCE(cid.nome, '')) LIKE UPPER($1)
            OR UPPER(COALESCE(cid.nome, '') || ' - ' || COALESCE(cid.uf, '')) LIKE UPPER($1)
        )
    ";
    $params[] = '%' . $searchUnaccented . '%';
}

$query = "
    SELECT
        c.cnpj,
        COALESCE(c.nome, '') AS nome,
        c.seq_cidade,
        COALESCE(cid.nome || ' - ' || cid.uf, '') AS cidade,
        COALESCE(c.agenda, false) AS agenda
    FROM {$domain}_cliente c
    LEFT JOIN cidade cid ON cid.seq_cidade = c.seq_cidade
    {$where}
    ORDER BY
        COALESCE(c.agenda, false) DESC,
        COALESCE(c.nome, '') ASC
    LIMIT {$limit}
";

$conn = connect();
$result = sql($query, $params, $conn);

$clientes = [];
while ($row = pg_fetch_assoc($result)) {
    $clientes[] = [
        'cnpj' => $row['cnpj'],
        'nome' => $row['nome'],
        'cidade' => $row['cidade'],
        'seqCidade' => $row['seq_cidade'] ? (int) $row['seq_cidade'] : null,
        'agenda' => pgBoolToPHP($row['agenda']),
    ];
}

returnSuccess([
    'clientes' => $clientes,
    'count' => count($clientes),
    'limit' => $limit,
]);
