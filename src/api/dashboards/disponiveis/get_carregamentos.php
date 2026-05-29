<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth    = authenticateAndGetUser();
$domain  = $auth['domain'];
$input   = getRequestInput();

$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? $input['unidade']
    ?? ''
));

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

pg_query($conn, "
        CREATE TABLE IF NOT EXISTS {$tabelaCarregamento}_capacidade (
            unidade VARCHAR(10) NOT NULL, placa_provisoria VARCHAR(20) NOT NULL,
            cap_ton NUMERIC, cap_m3 NUMERIC, PRIMARY KEY (unidade, placa_provisoria)
        )
    ");

$sqlCarregamentos = "
    SELECT
        c.placa_provisoria,
        COUNT(CASE WHEN c.seq_cte > 0 THEN 1 END) AS total_ctes,
        MIN(c.data_inclusao) AS data_criacao,
        MIN(c.hora_inclusao) AS hora_criacao,
        MIN(c.login_inclusao) AS login_criacao,
        v.capacidade_ton,
        v.capacidade_m3,
        cap.cap_ton,
        cap.cap_m3
    FROM {$tabelaCarregamento} c
    LEFT JOIN {$tabelaVeiculo} v ON UPPER(v.placa) = UPPER(c.placa_provisoria)
    LEFT JOIN {$tabelaCarregamento}_capacidade cap
           ON UPPER(cap.unidade) = '{$unidadeEsc}' AND cap.placa_provisoria = c.placa_provisoria
    WHERE UPPER(c.unidade) = '{$unidadeEsc}'
    GROUP BY c.placa_provisoria, v.capacidade_ton, v.capacidade_m3, cap.cap_ton, cap.cap_m3
    ORDER BY MIN(c.data_inclusao) DESC, MIN(c.hora_inclusao) DESC
";

$resCarregamentos = pg_query($conn, $sqlCarregamentos);
if (!$resCarregamentos) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar carregamentos.']);
}

$carregamentos = [];
while ($row = pg_fetch_assoc($resCarregamentos)) {
    $placa = $row['placa_provisoria'];

    $placaEsc   = pg_escape_string($conn, $placa);
    $tabelaCte  = "{$domain}_cte";
    $sqlCtes = "
        SELECT
            c.seq_cte,
            c.login_inclusao,
            c.data_inclusao,
            c.hora_inclusao,
            ct.ser_cte,
            ct.nro_cte,
            ct.nome_dest   AS destinatario,
            ct.nome_emit   AS remetente,
            ct.sigla_dest  AS cidade,
            ct.peso_real   AS peso,
            ct.cubagem,
            ct.qtde_vol
        FROM {$tabelaCarregamento} c
        LEFT JOIN {$tabelaCte} ct ON ct.seq_cte = c.seq_cte
        WHERE UPPER(c.unidade) = '{$unidadeEsc}'
          AND c.placa_provisoria = '{$placaEsc}'
          AND c.seq_cte > 0
        ORDER BY c.data_inclusao, c.hora_inclusao
    ";
    $resCtes = pg_query($conn, $sqlCtes);
    $ctes = [];
    while ($cteRow = pg_fetch_assoc($resCtes)) {
        $serCte = $cteRow['ser_cte'] ?? '';
        $nroCte = (int)($cteRow['nro_cte'] ?? 0);
        $ctrc   = $nroCte > 0 ? ($serCte . str_pad($nroCte, 6, '0', STR_PAD_LEFT)) : '';
        $ctes[] = [
            'seq_cte'        => (int)$cteRow['seq_cte'],
            'login_inclusao' => $cteRow['login_inclusao'],
            'data_inclusao'  => $cteRow['data_inclusao'],
            'hora_inclusao'  => $cteRow['hora_inclusao'],
            'ctrc'           => $ctrc,
            'nroCte'         => $nroCte,
            'destinatario'   => $cteRow['destinatario'] ?? '',
            'remetente'      => $cteRow['remetente'] ?? '',
            'cidade'         => $cteRow['cidade'] ?? '',
            'peso'           => $cteRow['peso'] !== null ? number_format((float)$cteRow['peso'], 0, ',', '.') : '',
            'cubagem'        => $cteRow['cubagem'] !== null ? number_format((float)$cteRow['cubagem'], 3, ',', '.') : '',
            'qtdeVol'        => $cteRow['qtde_vol'] ?? '',
        ];
    }

    $carregamentos[] = [
        'placa_provisoria' => $placa,
        'total_ctes'       => (int)$row['total_ctes'],
        'data_criacao'     => $row['data_criacao'],
        'hora_criacao'     => $row['hora_criacao'],
        'login_criacao'    => $row['login_criacao'],
        'capacidade_ton'   => $row['cap_ton'] !== null ? (float)$row['cap_ton'] : ($row['capacidade_ton'] !== null ? (float)$row['capacidade_ton'] : null),
        'capacidade_m3'    => $row['cap_m3']  !== null ? (float)$row['cap_m3']  : ($row['capacidade_m3']  !== null ? (float)$row['capacidade_m3']  : null),
        'ctes'             => $ctes,
    ];
}

respondJson(['success' => true, 'carregamentos' => $carregamentos]);
