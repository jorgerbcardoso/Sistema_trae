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
$tabelaCap          = "{$domain}_carregamento_capacidade";
$tabelaLinha        = "{$domain}_linha";

@pg_query($conn, "ALTER TABLE {$tabelaCarregamento} ADD COLUMN IF NOT EXISTS origem_criacao VARCHAR(20)");

// ─── Busca carregamentos agrupados por placa ──────────────────────────────────
// destino e unidades vêm direto da tabela (primeira linha não-nula por placa)
$sqlCarregamentos = "
    SELECT
        c.placa_provisoria,
        MAX(
            CASE
                WHEN UPPER(COALESCE(c.origem_criacao, '')) = 'SSW' THEN 3
                WHEN UPPER(COALESCE(c.origem_criacao, '')) = 'AUTO' THEN 2
                WHEN UPPER(COALESCE(c.origem_criacao, '')) = 'MANUAL' THEN 1
                ELSE 0
            END
        ) AS origem_rank,
        SUM(
            CASE
                WHEN (c.nro_cte::text ~ '^[0-9]+$' AND (c.nro_cte::text)::int > 0) THEN 1
                ELSE 0
            END
        ) AS total_ctes,
        MIN(c.data_inclusao)                    AS data_criacao,
        MIN(c.hora_inclusao)                    AS hora_criacao,
        MIN(c.login_inclusao)                   AS login_criacao,
        (SELECT destino  FROM {$tabelaCarregamento} WHERE unidade = \$1 AND placa_provisoria = c.placa_provisoria AND destino  IS NOT NULL AND destino  <> '' LIMIT 1) AS destino,
        (SELECT unidades FROM {$tabelaCarregamento} WHERE unidade = \$1 AND placa_provisoria = c.placa_provisoria AND unidades IS NOT NULL AND unidades <> '' LIMIT 1) AS paradas,
        v.capacidade_ton,
        v.capacidade_m3,
        cap.cap_ton,
        cap.cap_m3
    FROM {$tabelaCarregamento} c
    LEFT JOIN {$tabelaVeiculo} v
           ON UPPER(v.placa) = UPPER(c.placa_provisoria)
    LEFT JOIN {$tabelaCap} cap
           ON cap.unidade = \$1 AND cap.placa_provisoria = c.placa_provisoria
    WHERE c.unidade = \$1
    GROUP BY c.placa_provisoria, v.capacidade_ton, v.capacidade_m3, cap.cap_ton, cap.cap_m3
    ORDER BY MIN(c.data_inclusao) DESC, MIN(c.hora_inclusao) DESC
";

try {
    $resCarregamentos = sql($sqlCarregamentos, [$unidade], $conn);
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar carregamentos.']);
}

$carregamentos = [];
$idxPorPlaca   = [];

while ($resCarregamentos && ($row = pg_fetch_assoc($resCarregamentos))) {
    $placa = $row['placa_provisoria'] ?? '';
    if ($placa === '') continue;

    $destino = strtoupper(trim($row['destino'] ?? ''));
    // Fallback: extrai destino da placa fictícia (ex: SAO-CTB → CTB)
    if ($destino === '' && preg_match('/^[A-Z0-9]{2,5}-([A-Z0-9]{2,5})$/', $placa, $m)) {
        $destino = strtoupper($m[1]);
    }
    $paradas = $row['paradas'] ?? '';

    $capTon = $row['cap_ton'] !== null ? (float)$row['cap_ton'] : ($row['capacidade_ton'] !== null ? (float)$row['capacidade_ton'] : null);
    $capM3  = $row['cap_m3']  !== null ? (float)$row['cap_m3']  : ($row['capacidade_m3']  !== null ? (float)$row['capacidade_m3']  : null);
    $vlrMinFrete = null;

    if ($capTon === null || $capTon <= 0) $capTon = 27.0;
    if ($capM3  === null || $capM3  <= 0) $capM3  = 67.0;

    $idx = count($carregamentos);
    $idxPorPlaca[$placa] = $idx;
    $rank = (int)($row['origem_rank'] ?? 0);
    $origemCriacao = null;
    if ($rank >= 3) $origemCriacao = 'SSW';
    elseif ($rank === 2) $origemCriacao = 'AUTO';
    elseif ($rank === 1) $origemCriacao = 'MANUAL';
    else {
        if (preg_match('/^[A-Z0-9]{2,5}-[A-Z0-9]{2,5}$/', $placa)) $origemCriacao = 'AUTO';
        else $origemCriacao = 'MANUAL';
    }
    $carregamentos[] = [
        'placa_provisoria' => $placa,
        'origem_criacao'   => $origemCriacao,
        'total_ctes'       => (int)($row['total_ctes'] ?? 0),
        'data_criacao'     => $row['data_criacao'] ?? null,
        'hora_criacao'     => $row['hora_criacao'] ?? null,
        'login_criacao'    => $row['login_criacao'] ?? '',
        'capacidade_ton'   => $capTon,
        'capacidade_m3'    => $capM3,
        'vlr_min_frete'    => $vlrMinFrete,
        'destino'          => $destino !== '' ? $destino : null,
        'paradas'          => $paradas !== '' ? $paradas : null,
        'ctes'             => [],
    ];
}

if (count($carregamentos) === 0) {
    respondJson(['success' => true, 'carregamentos' => []]);
}

$rotas = [];
$rotaPorIdx = [];
foreach ($carregamentos as $idx => $car) {
    $dest = strtoupper(trim((string)($car['destino'] ?? '')));
    if ($dest === '') continue;
    $paradasStr = (string)($car['paradas'] ?? '');
    $paradasArr = array_filter(array_map('trim', explode(',', strtoupper($paradasStr))), function($p) { return $p !== ''; });
    $paradasNorm = implode(',', $paradasArr);
    $key = $dest . '|' . $paradasNorm;
    $rotaPorIdx[$idx] = $key;
    $rotas[$key] = ['dest' => $dest, 'paradas' => $paradasNorm];
}

if (count($rotas) > 0) {
    $valuesSql = [];
    $paramsLinhas = [$unidade];
    $p = 2;
    foreach ($rotas as $r) {
        $valuesSql[] = '($' . $p . ', $' . ($p + 1) . ')';
        $paramsLinhas[] = $r['dest'];
        $paramsLinhas[] = $r['paradas'];
        $p += 2;
    }

    $sqlLinhas = "
        SELECT
            l.sigla_dest,
            COALESCE(l.unidades, '') AS unidades,
            l.vlr_min_frete
        FROM {$tabelaLinha} l
        INNER JOIN (VALUES " . implode(', ', $valuesSql) . ") AS v(sigla_dest, unidades)
            ON v.sigla_dest = l.sigla_dest
           AND v.unidades = COALESCE(l.unidades, '')
        WHERE l.sigla_emit = \$1
    ";

    try {
        $resLinhas = sql($sqlLinhas, $paramsLinhas, $conn);
        $minPorRota = [];
        while ($resLinhas && ($lr = pg_fetch_assoc($resLinhas))) {
            $k = strtoupper(trim((string)($lr['sigla_dest'] ?? ''))) . '|' . (string)($lr['unidades'] ?? '');
            $minPorRota[$k] = ($lr['vlr_min_frete'] !== null && $lr['vlr_min_frete'] !== '') ? (float)$lr['vlr_min_frete'] : null;
        }
        foreach ($rotaPorIdx as $idx => $key) {
            if (array_key_exists($key, $minPorRota)) {
                $carregamentos[$idx]['vlr_min_frete'] = $minPorRota[$key];
            }
        }
    } catch (Exception $e) {
    }
}

// ─── Busca CT-es de cada carregamento ─────────────────────────────────────────
$sqlCtes = "
    SELECT
        c.placa_provisoria,
        c.nro_cte,
        c.ser_cte,
        c.destino_cte,
        c.data_emissao_cte,
        c.data_prev_ent_cte,
        c.remetente_cte,
        c.destinatario_cte,
        c.pagador_cte,
        c.cidade_destino_cte,
        c.vlr_merc_cte,
        c.vlr_frete_cte,
        c.peso_cte,
        c.cubagem_cte,
        c.qtde_vol_cte,
        c.login_inclusao,
        c.data_inclusao,
        c.hora_inclusao
    FROM {$tabelaCarregamento} c
    WHERE c.unidade = \$1
      AND (c.nro_cte::text ~ '^[0-9]+$' AND (c.nro_cte::text)::int > 0)
    ORDER BY c.placa_provisoria, c.data_inclusao, c.hora_inclusao
";

try {
    $resCtes = sql($sqlCtes, [$unidade], $conn);
    while ($resCtes && ($cteRow = pg_fetch_assoc($resCtes))) {
        $placa = $cteRow['placa_provisoria'] ?? '';
        if ($placa === '' || !isset($idxPorPlaca[$placa])) continue;

        $serCte = $cteRow['ser_cte'] ?? '';
        $nroCte = $cteRow['nro_cte'] !== null ? (int)$cteRow['nro_cte'] : 0;
        $ctrc   = ($nroCte > 0 && $serCte !== '') ? ($serCte . str_pad($nroCte, 6, '0', STR_PAD_LEFT)) : '';

        $carregamentos[$idxPorPlaca[$placa]]['ctes'][] = [
            'seq_cte'        => $nroCte,   // compatibilidade com frontend (usa seq_cte como ID)
            'nroCte'         => $nroCte,
            'ser_cte'        => $serCte,
            'ctrc'           => $ctrc,
            'destino_cte'    => strtoupper(trim($cteRow['destino_cte'] ?? '')),
            'data_emissao'   => $cteRow['data_emissao_cte'] ?? '',
            'data_prev_ent'  => $cteRow['data_prev_ent_cte'] ?? '',
            'remetente'      => $cteRow['remetente_cte'] ?? '',
            'destinatario'   => $cteRow['destinatario_cte'] ?? '',
            'pagador'        => $cteRow['pagador_cte'] ?? '',
            'cidade'         => $cteRow['cidade_destino_cte'] ?? '',
            'vlr_merc'       => $cteRow['vlr_merc_cte'] ?? '',
            'vlr_frete'      => $cteRow['vlr_frete_cte'] ?? '',
            'peso'           => $cteRow['peso_cte'] ?? '',
            'cubagem'        => $cteRow['cubagem_cte'] ?? '',
            'qtde_vol'       => $cteRow['qtde_vol_cte'] ?? '',
            'login_inclusao' => $cteRow['login_inclusao'] ?? '',
            'data_inclusao'  => $cteRow['data_inclusao'] ?? null,
            'hora_inclusao'  => $cteRow['hora_inclusao'] ?? null,
        ];
    }
} catch (Exception $e) {}

respondJson(['success' => true, 'carregamentos' => $carregamentos]);
