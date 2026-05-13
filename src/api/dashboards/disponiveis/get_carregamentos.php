<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];
$user   = $auth['user'];
$unidade = strtoupper(trim($user['unidade'] ?? ''));

if (empty($unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade do usuário não identificada.']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$conn = connect();

$tabelaCarregamento = "{$domain}_carregamento";
$tabelaVeiculo      = "{$domain}_veiculo";

$sqlCria = "
    CREATE TABLE IF NOT EXISTS {$tabelaCarregamento} (
        id              SERIAL PRIMARY KEY,
        unidade         VARCHAR(10) NOT NULL,
        seq_cte         INT NOT NULL,
        placa_provisoria VARCHAR(20) NOT NULL,
        data_inclusao   DATE NOT NULL DEFAULT CURRENT_DATE,
        hora_inclusao   TIME NOT NULL DEFAULT CURRENT_TIME,
        login_inclusao  VARCHAR(50) NOT NULL
    )
";
pg_query($conn, $sqlCria);

$unidadeEsc = pg_escape_string($conn, $unidade);

$sqlCarregamentos = "
    SELECT
        c.placa_provisoria,
        COUNT(CASE WHEN c.seq_cte > 0 THEN 1 END) AS total_ctes,
        MIN(c.data_inclusao) AS data_criacao,
        MIN(c.hora_inclusao) AS hora_criacao,
        MIN(c.login_inclusao) AS login_criacao,
        v.capacidade_ton,
        v.capacidade_m3
    FROM {$tabelaCarregamento} c
    LEFT JOIN {$tabelaVeiculo} v ON UPPER(v.placa) = UPPER(c.placa_provisoria)
    WHERE UPPER(c.unidade) = '{$unidadeEsc}'
    GROUP BY c.placa_provisoria, v.capacidade_ton, v.capacidade_m3
    ORDER BY MIN(c.data_inclusao) DESC, MIN(c.hora_inclusao) DESC
";

$resCarregamentos = pg_query($conn, $sqlCarregamentos);
if (!$resCarregamentos) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar carregamentos.']);
}

$carregamentos = [];
while ($row = pg_fetch_assoc($resCarregamentos)) {
    $placa = $row['placa_provisoria'];

    $placaEsc = pg_escape_string($conn, $placa);
    $sqlCtes = "
        SELECT seq_cte, login_inclusao, data_inclusao, hora_inclusao
        FROM {$tabelaCarregamento}
        WHERE UPPER(unidade) = '{$unidadeEsc}'
          AND placa_provisoria = '{$placaEsc}'
          AND seq_cte > 0
        ORDER BY data_inclusao, hora_inclusao
    ";
    $resCtes = pg_query($conn, $sqlCtes);
    $ctes = [];
    while ($cteRow = pg_fetch_assoc($resCtes)) {
        $ctes[] = [
            'seq_cte'        => (int)$cteRow['seq_cte'],
            'login_inclusao' => $cteRow['login_inclusao'],
            'data_inclusao'  => $cteRow['data_inclusao'],
            'hora_inclusao'  => $cteRow['hora_inclusao'],
        ];
    }

    $carregamentos[] = [
        'placa_provisoria' => $placa,
        'total_ctes'       => (int)$row['total_ctes'],
        'data_criacao'     => $row['data_criacao'],
        'hora_criacao'     => $row['hora_criacao'],
        'login_criacao'    => $row['login_criacao'],
        'capacidade_ton'   => $row['capacidade_ton'] !== null ? (float)$row['capacidade_ton'] : null,
        'capacidade_m3'    => $row['capacidade_m3']  !== null ? (float)$row['capacidade_m3']  : null,
        'ctes'             => $ctes,
    ];
}

respondJson(['success' => true, 'carregamentos' => $carregamentos]);
