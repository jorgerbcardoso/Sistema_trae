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
$tabelaCte          = "{$domain}_cte";
$tabelaCap          = "{$domain}_carregamento_capacidade";

function parseNumero($value) {
    if ($value === null) return 0.0;
    if (is_int($value) || is_float($value)) return (float)$value;
    $s = trim((string)$value);
    if ($s === '') return 0.0;
    $s = str_replace(' ', '', $s);
    if (strpos($s, ',') !== false) {
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
        return (float)$s;
    }
    $s = str_replace(',', '', $s);
    return (float)$s;
}

function getColunasCte($conn, $tabelaCte) {
    $cols = [];
    try {
        $resCols = sql(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
            [strtolower($tabelaCte)],
            $conn
        );
        while ($resCols && ($r = pg_fetch_assoc($resCols))) {
            $cols[] = strtolower($r['column_name']);
        }
    } catch (Exception $e) {}

    $peso = in_array('peso_real', $cols, true) ? 'peso_real' : (in_array('peso', $cols, true) ? 'peso' : null);
    $cub  = in_array('cubagem', $cols, true) ? 'cubagem' : (in_array('vlr_cubagem', $cols, true) ? 'vlr_cubagem' : null);
    return [$peso, $cub];
}

try {
    sql("
        CREATE TABLE IF NOT EXISTS {$tabelaCarregamento} (
            id               SERIAL PRIMARY KEY,
            unidade          VARCHAR(10) NOT NULL,
            seq_cte          INT NOT NULL,
            placa_provisoria VARCHAR(20) NOT NULL,
            data_inclusao    DATE NOT NULL DEFAULT CURRENT_DATE,
            hora_inclusao    TIME NOT NULL DEFAULT CURRENT_TIME,
            login_inclusao   VARCHAR(50) NOT NULL
        )
    ", [], $conn);

    sql("
        CREATE TABLE IF NOT EXISTS {$tabelaCap} (
            unidade VARCHAR(10) NOT NULL,
            placa_provisoria VARCHAR(20) NOT NULL,
            cap_ton NUMERIC,
            cap_m3 NUMERIC,
            PRIMARY KEY (unidade, placa_provisoria)
        )
    ", [], $conn);

    sql("ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS destino VARCHAR(10)", [], $conn);
    sql("ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS paradas TEXT", [], $conn);
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao preparar tabelas de carregamento.']);
}

list($colPeso, $colCubagem) = getColunasCte($conn, $tabelaCte);
$pesoSelect = $colPeso ? "ct.{$colPeso}" : "NULL";
$cubSelect  = $colCubagem ? "ct.{$colCubagem}" : "NULL";

$sqlCarregamentos = "
    SELECT
        c.placa_provisoria,
        COUNT(*) FILTER (WHERE c.seq_cte > 0) AS total_ctes,
        MIN(c.data_inclusao) AS data_criacao,
        MIN(c.hora_inclusao) AS hora_criacao,
        MIN(c.login_inclusao) AS login_criacao,
        v.capacidade_ton,
        v.capacidade_m3,
        cap.cap_ton,
        cap.cap_m3,
        cap.destino,
        cap.paradas
    FROM {$tabelaCarregamento} c
    LEFT JOIN {$tabelaVeiculo} v ON UPPER(v.placa) = UPPER(c.placa_provisoria)
    LEFT JOIN {$tabelaCap} cap
           ON cap.unidade = $1 AND cap.placa_provisoria = c.placa_provisoria
    WHERE c.unidade = $1
    GROUP BY c.placa_provisoria, v.capacidade_ton, v.capacidade_m3, cap.cap_ton, cap.cap_m3, cap.destino, cap.paradas
    ORDER BY MIN(c.data_inclusao) DESC, MIN(c.hora_inclusao) DESC
";

try {
    $resCarregamentos = sql($sqlCarregamentos, [$unidade], $conn);
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar carregamentos.']);
}

$carregamentos = [];
$idxPorPlaca = [];
while ($resCarregamentos && ($row = pg_fetch_assoc($resCarregamentos))) {
    $placa = $row['placa_provisoria'] ?? '';
    if ($placa === '') continue;

    $destino = strtoupper(trim($row['destino'] ?? ''));
    if ($destino === '' && preg_match('/^[A-Z0-9]{2,5}-([A-Z0-9]{2,5})$/', $placa, $m)) {
        $destino = strtoupper($m[1]);
    }
    $paradas = $row['paradas'] ?? '';

    $idx = count($carregamentos);
    $idxPorPlaca[$placa] = $idx;
    $carregamentos[] = [
        'placa_provisoria' => $placa,
        'total_ctes'       => (int)($row['total_ctes'] ?? 0),
        'data_criacao'     => $row['data_criacao'] ?? null,
        'hora_criacao'     => $row['hora_criacao'] ?? null,
        'login_criacao'    => $row['login_criacao'] ?? '',
        'capacidade_ton'   => $row['cap_ton'] !== null ? (float)$row['cap_ton'] : ($row['capacidade_ton'] !== null ? (float)$row['capacidade_ton'] : null),
        'capacidade_m3'    => $row['cap_m3']  !== null ? (float)$row['cap_m3']  : ($row['capacidade_m3']  !== null ? (float)$row['capacidade_m3']  : null),
        'destino'          => $destino !== '' ? $destino : null,
        'paradas'          => $paradas !== '' ? $paradas : null,
        'ctes'             => [],
    ];
}

if (count($carregamentos) === 0) {
    respondJson(['success' => true, 'carregamentos' => []]);
}

$sqlCtes = "
    SELECT
        c.placa_provisoria,
        c.seq_cte,
        c.login_inclusao,
        c.data_inclusao,
        c.hora_inclusao,
        ct.ser_cte,
        ct.nro_cte,
        ct.nome_dest  AS destinatario,
        ct.nome_emit  AS remetente,
        ct.sigla_dest AS cidade,
        {$pesoSelect} AS peso,
        {$cubSelect}  AS cubagem,
        ct.qtde_vol
    FROM {$tabelaCarregamento} c
    LEFT JOIN {$tabelaCte} ct ON ct.seq_cte = c.seq_cte
    WHERE c.unidade = $1
      AND c.seq_cte > 0
    ORDER BY c.placa_provisoria, c.data_inclusao, c.hora_inclusao
";

try {
    $resCtes = sql($sqlCtes, [$unidade], $conn);
    while ($resCtes && ($cteRow = pg_fetch_assoc($resCtes))) {
        $placa = $cteRow['placa_provisoria'] ?? '';
        if ($placa === '' || !isset($idxPorPlaca[$placa])) continue;
        $serCte = $cteRow['ser_cte'] ?? '';
        $nroCte = (int)($cteRow['nro_cte'] ?? 0);
        $ctrc   = $nroCte > 0 ? ($serCte . str_pad($nroCte, 6, '0', STR_PAD_LEFT)) : '';

        $pesoNum = $cteRow['peso'] !== null ? parseNumero($cteRow['peso']) : null;
        $cubNum  = $cteRow['cubagem'] !== null ? parseNumero($cteRow['cubagem']) : null;

        $carregamentos[$idxPorPlaca[$placa]]['ctes'][] = [
            'seq_cte'        => (int)($cteRow['seq_cte'] ?? 0),
            'login_inclusao' => $cteRow['login_inclusao'] ?? '',
            'data_inclusao'  => $cteRow['data_inclusao'] ?? null,
            'hora_inclusao'  => $cteRow['hora_inclusao'] ?? null,
            'ctrc'           => $ctrc,
            'nroCte'         => $nroCte,
            'destinatario'   => $cteRow['destinatario'] ?? '',
            'remetente'      => $cteRow['remetente'] ?? '',
            'cidade'         => $cteRow['cidade'] ?? '',
            'peso'           => $pesoNum !== null ? number_format((float)$pesoNum, 0, ',', '.') : '',
            'cubagem'        => $cubNum !== null ? number_format((float)$cubNum, 3, ',', '.') : '',
            'qtdeVol'        => $cteRow['qtde_vol'] ?? '',
        ];
    }
} catch (Exception $e) {}

respondJson(['success' => true, 'carregamentos' => $carregamentos]);
