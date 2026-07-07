<?php

require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod(['GET', 'POST']);

$auth = authenticateAndGetUser();
$domain = strtoupper(trim($auth['domain'] ?? ''));

$tableEmpParam = "{$domain}_emp_param";
$tableOcor = "{$domain}_ocorrencia";

$conn = connect();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = strtolower(trim($_GET['action'] ?? 'params'));

    if ($action === 'ocorrencias') {
        $search = trim($_GET['search'] ?? '');
        $limitRaw = $_GET['limit'] ?? 50;
        $limit = (int) $limitRaw;
        if ($limit <= 0) {
            $limit = 50;
        }
        if ($limit > 200) {
            $limit = 200;
        }

        $where = '';
        $params = [];
        $limitPlaceholder = '$1';

        if ($search !== '') {
            $s = '%' . removeAccents($search) . '%';
            $where = "WHERE (CAST(o.codigo AS TEXT) ILIKE $1 OR UPPER(remove_accents(COALESCE(o.descricao, ''))) LIKE UPPER($1))";
            $params[] = $s;
            $limitPlaceholder = '$2';
        }

        $params[] = $limit;

        $query = "
            SELECT o.codigo, COALESCE(o.descricao, '') AS descricao, COALESCE(o.tipo, '') AS tipo
            FROM {$tableOcor} o
            {$where}
            ORDER BY COALESCE(o.descricao, '') ASC
            LIMIT {$limitPlaceholder}::int
        ";

        $result = sql($query, $params, $conn);

        $ocorrencias = [];
        while ($row = pg_fetch_assoc($result)) {
            $ocorrencias[] = [
                'codigo' => (int) $row['codigo'],
                'descricao' => $row['descricao'],
                'tipo' => $row['tipo'],
            ];
        }

        returnSuccess([
            'ocorrencias' => $ocorrencias,
            'count' => count($ocorrencias),
        ]);
    }

    $result = sql("SELECT ocor_aguardando_agendamento, ocor_agendamento, ocor_chegada_unid_dest, ocor_cte_retido FROM {$tableEmpParam} LIMIT 1", [], $conn);
    $row = pg_fetch_assoc($result);

    if (!$row) {
        sql("INSERT INTO {$tableEmpParam} (ocor_aguardando_agendamento, ocor_agendamento, ocor_chegada_unid_dest, ocor_cte_retido) VALUES (NULL, NULL, NULL, NULL)", [], $conn);
        $row = [
            'ocor_aguardando_agendamento' => null,
            'ocor_agendamento' => null,
            'ocor_chegada_unid_dest' => null,
            'ocor_cte_retido' => null,
        ];
    }

    returnSuccess([
        'params' => [
            'ocor_aguardando_agendamento' => $row['ocor_aguardando_agendamento'] !== null ? (int) $row['ocor_aguardando_agendamento'] : null,
            'ocor_agendamento' => $row['ocor_agendamento'] !== null ? (int) $row['ocor_agendamento'] : null,
            'ocor_chegada_unid_dest' => $row['ocor_chegada_unid_dest'] !== null ? (int) $row['ocor_chegada_unid_dest'] : null,
            'ocor_cte_retido' => $row['ocor_cte_retido'] !== null ? (int) $row['ocor_cte_retido'] : null,
        ],
    ]);
}

$input = getRequestInput();

$ocorAguardando = isset($input['ocor_aguardando_agendamento']) && $input['ocor_aguardando_agendamento'] !== '' ? (int) $input['ocor_aguardando_agendamento'] : null;
$ocorAgendamento = isset($input['ocor_agendamento']) && $input['ocor_agendamento'] !== '' ? (int) $input['ocor_agendamento'] : null;
$ocorChegada = isset($input['ocor_chegada_unid_dest']) && $input['ocor_chegada_unid_dest'] !== '' ? (int) $input['ocor_chegada_unid_dest'] : null;
$ocorCteRetido = isset($input['ocor_cte_retido']) && $input['ocor_cte_retido'] !== '' ? (int) $input['ocor_cte_retido'] : null;

$existsResult = sql("SELECT 1 FROM {$tableEmpParam} LIMIT 1", [], $conn);
$exists = (bool) pg_fetch_assoc($existsResult);

if (!$exists) {
    sql(
        "INSERT INTO {$tableEmpParam} (ocor_aguardando_agendamento, ocor_agendamento, ocor_chegada_unid_dest, ocor_cte_retido) VALUES ($1, $2, $3, $4)",
        [$ocorAguardando, $ocorAgendamento, $ocorChegada, $ocorCteRetido],
        $conn
    );
} else {
    sql(
        "UPDATE {$tableEmpParam} SET ocor_aguardando_agendamento = $1, ocor_agendamento = $2, ocor_chegada_unid_dest = $3, ocor_cte_retido = $4",
        [$ocorAguardando, $ocorAgendamento, $ocorChegada, $ocorCteRetido],
        $conn
    );
}

returnSuccess([
    'message' => 'Parâmetros atualizados com sucesso',
]);
