<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

$currentUser = getCurrentUser();
$unidade     = strtoupper(trim($currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? ''));
$login       = $currentUser['username'] ?? '';

if (empty($unidade) || !preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Unidade ou domínio inválidos.']);
}

$input           = getRequestInput();
$placa           = strtoupper(trim($input['placa'] ?? ''));
$unidadeDestino  = strtoupper(trim($input['unidadeDestino'] ?? ''));
$paradas         = array_filter(array_map('strtoupper', array_map('trim', (array)($input['paradas'] ?? []))));

$conn        = connect();
$tabela      = "{$domain}_carregamento";
$tabelaCte   = "{$domain}_cte";
$tabelaLinha = "{$domain}_linha";
$tabelaVeiculo = "{$domain}_veiculo";
$tabelaCap   = "{$domain}_carregamento_capacidade";

$modoAutomatico = empty($placa) && empty($unidadeDestino);

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

function placaFicticia($placa) {
    if (empty($placa)) return true;
    return strpos($placa, '-') !== false;
}

function getCapacidadeVeiculo($conn, $tabelaVeiculo, $placa) {
    $capPesoKg = 27000.0;
    $capVolM3  = 67.0;
    if (placaFicticia($placa)) return [$capPesoKg, $capVolM3];
    try {
        $res = sql("SELECT capacidade_ton, capacidade_m3 FROM {$tabelaVeiculo} WHERE UPPER(placa) = UPPER($1) LIMIT 1", [$placa], $conn);
        if ($res && pg_num_rows($res) > 0) {
            $row = pg_fetch_assoc($res);
            $ton = parseNumero($row['capacidade_ton'] ?? null);
            $m3  = parseNumero($row['capacidade_m3'] ?? null);
            if ($ton > 0) $capPesoKg = $ton * 1000.0;
            if ($m3 > 0) $capVolM3  = $m3;
        }
    } catch (Exception $e) {
        return [$capPesoKg, $capVolM3];
    }
    return [$capPesoKg, $capVolM3];
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
            $col = strtolower($r['column_name']);
            $cols[] = $col;
        }
    } catch (Exception $e) {}

    $peso = in_array('peso_real', $cols, true) ? 'peso_real' : (in_array('peso', $cols, true) ? 'peso' : null);
    $cub  = in_array('cubagem', $cols, true) ? 'cubagem' : (in_array('vlr_cubagem', $cols, true) ? 'vlr_cubagem' : null);
    return [$peso, $cub];
}

function buscarSeqCtesDentroCapacidade($conn, $tabelaCarregamento, $tabelaCte, $unidade, $destinos, $pesoExpr, $cubExpr, $limitePesoKg, $limiteVolM3, $orderBySql) {
    if (count($destinos) === 0) return [];

    $params = [];
    $inParts = [];
    $i = 1;
    foreach ($destinos as $d) {
        $inParts[] = '$' . $i;
        $params[] = $d;
        $i++;
    }
    $unidadeIdx = $i;
    $params[] = $unidade;

    $sqlCtes = "
        SELECT c.seq_cte, {$pesoExpr} AS peso_val, {$cubExpr} AS cubagem_val
        FROM {$tabelaCte} c
        WHERE c.sigla_dest IN (" . implode(',', $inParts) . ")
          AND c.status NOT IN ('C','X')
          AND NOT EXISTS (
              SELECT 1 FROM {$tabelaCarregamento} t
              WHERE t.unidade = $" . $unidadeIdx . " AND t.seq_cte = c.seq_cte AND t.seq_cte > 0
          )
        {$orderBySql}
    ";

    $resCtes = sql($sqlCtes, $params, $conn);
    $seqCtes = [];
    $somaPeso = 0.0;
    $somaVol  = 0.0;

    while ($resCtes && ($r = pg_fetch_assoc($resCtes))) {
        $p = parseNumero($r['peso_val'] ?? null);
        $v = parseNumero($r['cubagem_val'] ?? null);
        if ($somaPeso + $p > $limitePesoKg || $somaVol + $v > $limiteVolM3) {
            break;
        }
        $somaPeso += $p;
        $somaVol  += $v;
        $seqCtes[] = (int)$r['seq_cte'];
    }

    return $seqCtes;
}

try {
    sql("
        CREATE TABLE IF NOT EXISTS {$tabela} (
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
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao preparar tabelas de carregamento.']);
}

list($colPeso, $colCubagem) = getColunasCte($conn, $tabelaCte);
$pesoExpr = $colPeso ? "c.{$colPeso}::text" : "'0'";
$cubExpr  = $colCubagem ? "c.{$colCubagem}::text" : "'0'";
$orderByCtes = "ORDER BY c.data_prev_ent ASC NULLS LAST, c.data_emissao ASC, c.seq_cte ASC";

if ($modoAutomatico) {
    $resLinhas = null;
    try {
        $resLinhas = sql("SELECT sigla_dest, unidades FROM {$tabelaLinha} WHERE sigla_emit = $1 ORDER BY sigla_dest", [$unidade], $conn);
    } catch (Exception $e) {}

    if (!$resLinhas || pg_num_rows($resLinhas) === 0) {
        respondJson(['success' => false, 'message' => 'Nenhuma linha cadastrada com origem nesta unidade.']);
    }

    $resultados = [];

    while ($linha = pg_fetch_assoc($resLinhas)) {
        $dest = strtoupper(trim($linha['sigla_dest'] ?? ''));
        if ($dest === '') continue;

        $paradasLinha = array_filter(array_map('strtoupper', array_map('trim', explode(',', $linha['unidades'] ?? ''))));
        $destinosCarregamento = array_values(array_unique(array_filter(array_merge($paradasLinha, [$dest]))));

        $placaAuto = $unidade . '-' . $dest;

        $check = sql("SELECT 1 FROM {$tabela} WHERE unidade = $1 AND placa_provisoria = $2 LIMIT 1", [$unidade, $placaAuto], $conn);
        if ($check && pg_num_rows($check) > 0) {
            $resultados[] = ['placa' => $placaAuto, 'status' => 'ignorado', 'msg' => 'Carregamento já existe.'];
            continue;
        }

        list($limitePeso, $limiteVol) = getCapacidadeVeiculo($conn, $tabelaVeiculo, $placaAuto);
        $seqCtes = buscarSeqCtesDentroCapacidade($conn, $tabela, $tabelaCte, $unidade, $destinosCarregamento, $pesoExpr, $cubExpr, $limitePeso, $limiteVol, $orderByCtes);

        if (empty($seqCtes)) {
            $resultados[] = ['placa' => $placaAuto, 'status' => 'vazio', 'msg' => 'Nenhum CT-e disponível ou dentro da capacidade para este destino.'];
            continue;
        }

        try {
            sql('BEGIN', [], $conn);

            sql("DELETE FROM {$tabela} WHERE unidade = $1 AND placa_provisoria = $2 AND seq_cte = 0", [$unidade, $placaAuto], $conn);
            sql(
                "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ($1, 0, $2, $3, CURRENT_DATE, CURRENT_TIME)",
                [$unidade, $placaAuto, $login],
                $conn
            );

            $capTon = $limitePeso / 1000.0;
            $capM3  = $limiteVol;
            sql(
                "INSERT INTO {$tabelaCap} (unidade, placa_provisoria, cap_ton, cap_m3)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (unidade, placa_provisoria) DO UPDATE SET cap_ton = EXCLUDED.cap_ton, cap_m3 = EXCLUDED.cap_m3",
                [$unidade, $placaAuto, $capTon, $capM3],
                $conn
            );

            $chunks = array_chunk($seqCtes, 500);
            foreach ($chunks as $chunk) {
                $params = [$unidade, $placaAuto, $login];
                $values = [];
                $idx = 4;
                foreach ($chunk as $seq) {
                    $values[] = "($1, $" . $idx . ", $2, $3, CURRENT_DATE, CURRENT_TIME)";
                    $params[] = (int)$seq;
                    $idx++;
                }
                sql(
                    "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES " . implode(', ', $values),
                    $params,
                    $conn
                );
            }

            sql('COMMIT', [], $conn);
        } catch (Exception $e) {
            try { sql('ROLLBACK', [], $conn); } catch (Exception $e2) {}
            $resultados[] = ['placa' => $placaAuto, 'status' => 'erro', 'msg' => 'Erro ao criar carregamento.'];
            continue;
        }

        $resultados[] = ['placa' => $placaAuto, 'status' => 'criado', 'msg' => count($seqCtes) . ' CT-e(s) adicionados.'];
    }

    $criados = count(array_filter($resultados, fn($r) => $r['status'] === 'criado'));
    respondJson(['success' => true, 'message' => "{$criados} carregamento(s) criado(s) automaticamente.", 'resultados' => $resultados]);
}

if (empty($unidadeDestino)) {
    respondJson(['success' => false, 'message' => 'Unidade de destino não informada.']);
}

$placaFinal = !empty($placa) ? $placa : ($unidade . '-' . $unidadeDestino);

$check = sql("SELECT 1 FROM {$tabela} WHERE unidade = $1 AND placa_provisoria = $2 LIMIT 1", [$unidade, $placaFinal], $conn);
if ($check && pg_num_rows($check) > 0) {
    respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaFinal}."]);

}

list($limitePeso, $limiteVol) = getCapacidadeVeiculo($conn, $tabelaVeiculo, $placaFinal);

$destinosManual = array_values(array_unique(array_filter(array_merge($paradas, [$unidadeDestino]))));
$seqCtes = buscarSeqCtesDentroCapacidade($conn, $tabela, $tabelaCte, $unidade, $destinosManual, $pesoExpr, $cubExpr, $limitePeso, $limiteVol, $orderByCtes);

if (empty($seqCtes)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível ou dentro da capacidade para os destinos informados.']);
}

try {
    sql('BEGIN', [], $conn);

    sql("DELETE FROM {$tabela} WHERE unidade = $1 AND placa_provisoria = $2 AND seq_cte = 0", [$unidade, $placaFinal], $conn);
    sql(
        "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ($1, 0, $2, $3, CURRENT_DATE, CURRENT_TIME)",
        [$unidade, $placaFinal, $login],
        $conn
    );

    $capTon = $limitePeso / 1000.0;
    $capM3  = $limiteVol;
    sql(
        "INSERT INTO {$tabelaCap} (unidade, placa_provisoria, cap_ton, cap_m3)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (unidade, placa_provisoria) DO UPDATE SET cap_ton = EXCLUDED.cap_ton, cap_m3 = EXCLUDED.cap_m3",
        [$unidade, $placaFinal, $capTon, $capM3],
        $conn
    );

    $chunks = array_chunk($seqCtes, 500);
    foreach ($chunks as $chunk) {
        $params = [$unidade, $placaFinal, $login];
        $values = [];
        $idx = 4;
        foreach ($chunk as $seq) {
            $values[] = "($1, $" . $idx . ", $2, $3, CURRENT_DATE, CURRENT_TIME)";
            $params[] = (int)$seq;
            $idx++;
        }
        sql(
            "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES " . implode(', ', $values),
            $params,
            $conn
        );
    }

    sql('COMMIT', [], $conn);
} catch (Exception $e) {
    try { sql('ROLLBACK', [], $conn); } catch (Exception $e2) {}
    respondJson(['success' => false, 'message' => 'Erro ao criar carregamento automático.']);
}

respondJson(['success' => true, 'message' => count($seqCtes) . " CT-e(s) adicionados ao carregamento {$placaFinal}."]);
