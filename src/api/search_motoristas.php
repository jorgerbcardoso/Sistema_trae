<?php
require_once __DIR__ . '/config.php';

handleOptionsRequest();
validateRequestMethod('POST');

try {
    $auth = authenticateAndGetUser();
    $domain = $auth['domain'];
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
        respondJson(['success' => false, 'data' => []]);
    }

    $input = getRequestInput();
    $search = strtoupper(trim((string)($input['search'] ?? '')));
    if ($search !== '' && strlen($search) < 3) {
        respondJson(['success' => true, 'data' => []]);
    }

    $conn = connect();
    $tbl = "{$domain}_motorista";
    $searchEsc = pg_escape_string($conn, $search);
    $where = '';
    if ($search !== '') {
        $where = "
            WHERE
                UPPER(COALESCE(nome, '')) LIKE '%{$searchEsc}%'
                OR COALESCE(cpf, '') LIKE '%{$searchEsc}%'
        ";
    }

    $q = "
        SELECT
            cpf,
            nome,
            ddd,
            fone
        FROM {$tbl}
        {$where}
        ORDER BY nome
        LIMIT 100
    ";
    $res = @pg_query($conn, $q);
    if (!$res) {
        respondJson(['success' => true, 'data' => []]);
    }

    $out = [];
    while ($row = pg_fetch_assoc($res)) {
        $out[] = [
            'cpf' => preg_replace('/\D+/', '', (string)($row['cpf'] ?? '')),
            'nome' => (string)($row['nome'] ?? ''),
            'ddd' => (string)($row['ddd'] ?? ''),
            'fone' => (string)($row['fone'] ?? ''),
        ];
    }

    respondJson(['success' => true, 'data' => $out]);
} catch (Exception $e) {
    respondJson(['success' => true, 'data' => []]);
}

