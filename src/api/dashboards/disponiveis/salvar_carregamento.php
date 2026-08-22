<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];
$input  = getRequestInput();
$acao   = $input['acao'] ?? '';

$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? $input['unidade']
    ?? ''
));
$login = $currentUser['username'] ?? $auth['user']['username'] ?? '';

if (empty($unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade do usuário não identificada.']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$tabela    = "{$domain}_carregamento";
$tabelaCap = "{$domain}_carregamento_capacidade";
$tabelaVeiculo = "{$domain}_veiculo";
$tabelaLinha = "{$domain}_linha";

$conn = connect();

@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS origem_criacao VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS data_finalizacao DATE");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS hora_finalizacao TIME");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS login_finalizacao VARCHAR(60)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS nro_linha INT");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS vlr_frete_carreteiro NUMERIC");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS simulado BOOLEAN DEFAULT FALSE");

$seqName = "{$domain}_seq_carregamento_seq";
@pg_query($conn, "CREATE SEQUENCE IF NOT EXISTS {$seqName}");
@pg_query($conn, "ALTER TABLE {$tabela} ALTER COLUMN seq_carregamento SET DEFAULT nextval('{$seqName}')");

function nextSeqCarregamento($conn, $seqName) {
    $seqName = trim((string)$seqName);
    if ($seqName === '') return 0;
    $res = @pg_query($conn, "SELECT nextval('" . pg_escape_string($conn, $seqName) . "') AS seq");
    if (!$res || pg_num_rows($res) === 0) return 0;
    return (int)pg_fetch_result($res, 0, 0);
}

function parseCsvSiglas($csv) {
    $s = strtoupper(trim((string)$csv));
    if ($s === '') return [];
    $parts = array_map('trim', explode(',', $s));
    $out = [];
    foreach ($parts as $p) {
        $p = strtoupper(trim((string)$p));
        if ($p === '') continue;
        if (!in_array($p, $out, true)) $out[] = $p;
    }
    return $out;
}

function getUnidadesOcupadasCarregamentos($conn, $tabela, $tabelaCap, $unidade) {
    $unidade = strtoupper(trim((string)$unidade));
    $map = [];
    try {
        $res = sql(
            "SELECT c.placa_provisoria, c.destino, c.unidades
             FROM {$tabela} c
             LEFT JOIN {$tabelaCap} cap
                    ON cap.unidade = c.unidade AND cap.seq_carregamento = c.seq_carregamento
             WHERE c.unidade = \$1
               AND c.data_finalizacao IS NULL
               AND COALESCE(cap.simulado, FALSE) = FALSE",
            [$unidade],
            $conn
        );
        while ($res && ($r = pg_fetch_assoc($res))) {
            $placa = strtoupper(trim((string)($r['placa_provisoria'] ?? '')));
            if ($placa === '') continue;

            $dest = strtoupper(trim((string)($r['destino'] ?? '')));
            if ($dest !== '') {
                if (!isset($map[$dest])) $map[$dest] = [];
                $k = 'DESTINO|' . $placa;
                $map[$dest][$k] = ['placa' => $placa, 'tipo' => 'DESTINO'];
            }

            $csv = strtoupper(trim((string)($r['unidades'] ?? '')));
            if ($csv !== '') {
                foreach (parseCsvSiglas($csv) as $u) {
                    if (!isset($map[$u])) $map[$u] = [];
                    $k = 'INTERMEDIARIA|' . $placa;
                    if (!isset($map[$u][$k])) $map[$u][$k] = ['placa' => $placa, 'tipo' => 'INTERMEDIARIA'];
                }
            }
        }
    } catch (Exception $e) {}
    return $map;
}

// ─── Ação: criar carregamento manual (linha sentinela com nro_cte = 0) ────────
if ($acao === 'criar') {
    $placa   = strtoupper(trim($input['placa'] ?? ''));
    $destino = strtoupper(trim($input['destino'] ?? ''));
    $paradas = strtoupper(trim($input['paradas'] ?? ''));

    if (empty($placa)) {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $check = sql(
        "SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 LIMIT 1",
        [$unidade, $placa], $conn
    );
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => false, 'message' => 'Já existe um carregamento com esta placa para sua unidade.']);
    }

    $ocupadas = getUnidadesOcupadasCarregamentos($conn, $tabela, $tabelaCap, $unidade);
    $invalid = [];
    foreach (parseCsvSiglas($paradas) as $p) {
        if (isset($ocupadas[$p])) $invalid[] = $p;
    }
    if (!empty($invalid)) {
        $det = [];
        foreach ($invalid as $u) {
            $occsMap = $ocupadas[$u] ?? null;
            if (!$occsMap || !is_array($occsMap) || count($occsMap) === 0) { $det[] = $u; continue; }
            $occs = array_values($occsMap);
            $destPlacas = [];
            $interPlacas = [];
            foreach ($occs as $o) {
                $tp = strtoupper(trim((string)($o['tipo'] ?? '')));
                $pl = strtoupper(trim((string)($o['placa'] ?? '')));
                if ($pl === '') continue;
                if ($tp === 'DESTINO') $destPlacas[] = $pl;
                else $interPlacas[] = $pl;
            }
            $destPlacas = array_values(array_unique($destPlacas));
            $interPlacas = array_values(array_unique($interPlacas));
            $parts = [];
            if (!empty($destPlacas)) $parts[] = 'destino: ' . implode(', ', $destPlacas);
            if (!empty($interPlacas)) $parts[] = 'intermediária: ' . implode(', ', $interPlacas);
            $det[] = $u . (empty($parts) ? '' : ' (' . implode('; ', $parts) . ')');
        }
        respondJson(['success' => false, 'message' => 'Parada(s) inválida(s): ' . implode(', ', $det) . '.']);
    }

    // Linha sentinela: nro_cte = 0 indica carregamento sem CT-es ainda
    $destinoSql = $destino !== '' ? "'" . pg_escape_string($conn, $destino) . "'" : 'NULL';
    $unidadesSql = $paradas !== '' ? "'" . pg_escape_string($conn, $paradas) . "'" : 'NULL';

    $seqCarreg = nextSeqCarregamento($conn, $seqName);
    if ($seqCarreg <= 0) {
        respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
    }

    $res = pg_query($conn,
        "INSERT INTO {$tabela} (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, destino, unidades, origem_ssw, origem_criacao, unidade_carregamento)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, {$destinoSql}, {$unidadesSql}, NULL, 'MANUAL', '" . pg_escape_string($conn, $unidade) . "')"
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao criar carregamento: ' . pg_last_error($conn)]);
    }

    @pg_query($conn, "
        CREATE TABLE IF NOT EXISTS {$tabelaCap} (
            unidade          VARCHAR(10) NOT NULL,
            seq_carregamento INT NOT NULL,
            placa_provisoria VARCHAR(20) NOT NULL,
            cap_ton          NUMERIC,
            cap_m3           NUMERIC,
            vlr_frete_carreteiro NUMERIC,
            simulado         BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (unidade, seq_carregamento)
        )
    ");
    @pg_query($conn,
        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, simulado)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', FALSE)
         ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, simulado = FALSE"
    );

    respondJson(['success' => true, 'seq_carregamento' => $seqCarreg]);
}

// ─── Ação: iniciar simulação (vira carregamento real no TMS) ──────────────────
if ($acao === 'iniciar_simulacao') {
    $seqCarreg = (int)($input['seq_carregamento'] ?? 0);
    $placaNova = strtoupper(trim((string)($input['placa'] ?? '')));

    if ($seqCarreg <= 0) {
        respondJson(['success' => false, 'message' => 'seq_carregamento não informado.']);
    }
    if ($placaNova === '') {
        respondJson(['success' => false, 'message' => 'Placa verdadeira não informada.']);
    }

    $resV = sql(
        "SELECT placa FROM {$tabelaVeiculo} WHERE UPPER(placa) = UPPER(\$1) LIMIT 1",
        [$placaNova],
        $conn
    );
    if (!$resV || pg_num_rows($resV) === 0) {
        respondJson(['success' => false, 'message' => 'Placa não encontrada no cadastro de veículos.']);
    }

    $resCap = sql(
        "SELECT COALESCE(simulado, FALSE) AS simulado
         FROM {$tabelaCap}
         WHERE unidade = \$1 AND seq_carregamento = \$2
         LIMIT 1",
        [$unidade, $seqCarreg],
        $conn
    );
    if (!$resCap || pg_num_rows($resCap) === 0) {
        respondJson(['success' => false, 'message' => 'Registro de capacidade não encontrado para este carregamento.']);
    }
    $isSim = ((string)pg_fetch_result($resCap, 0, 0) === 't');
    if (!$isSim) {
        respondJson(['success' => false, 'message' => 'Este carregamento já não está mais como simulado.']);
    }

    $resDup = sql(
        "SELECT 1
         FROM {$tabela} c
         LEFT JOIN {$tabelaCap} cap
                ON cap.unidade = c.unidade AND cap.seq_carregamento = c.seq_carregamento
         WHERE c.unidade = \$1
           AND c.data_finalizacao IS NULL
           AND UPPER(c.placa_provisoria) = UPPER(\$2)
           AND c.seq_carregamento <> \$3
           AND COALESCE(cap.simulado, FALSE) = FALSE
         LIMIT 1",
        [$unidade, $placaNova, $seqCarreg],
        $conn
    );
    if ($resDup && pg_num_rows($resDup) > 0) {
        respondJson(['success' => false, 'message' => 'Já existe um carregamento em andamento com esta placa.']);
    }

    $destinoCarreg = null;
    $unidadesCarreg = null;
    $resInfo = sql(
        "SELECT destino, unidades
         FROM {$tabela}
         WHERE unidade = \$1
           AND seq_carregamento = \$2
           AND data_finalizacao IS NULL
         ORDER BY data_inclusao ASC, hora_inclusao ASC
         LIMIT 1",
        [$unidade, $seqCarreg],
        $conn
    );
    if ($resInfo && pg_num_rows($resInfo) > 0) {
        $rowI = pg_fetch_assoc($resInfo);
        $destinoCarreg = ($rowI['destino'] ?? null);
        $unidadesCarreg = ($rowI['unidades'] ?? null);
        $destinoCarreg = ($destinoCarreg !== null && trim((string)$destinoCarreg) !== '') ? strtoupper(trim((string)$destinoCarreg)) : null;
        $unidadesCarreg = ($unidadesCarreg !== null && trim((string)$unidadesCarreg) !== '') ? strtoupper(trim((string)$unidadesCarreg)) : null;
    }

    pg_query($conn, 'BEGIN');
    try {
        sql(
            "DELETE FROM {$tabela}
             WHERE unidade = \$1
               AND seq_carregamento = \$2
               AND data_finalizacao IS NULL",
            [$unidade, $seqCarreg],
            $conn
        );

        sql(
            "UPDATE {$tabelaCap}
             SET placa_provisoria = \$1,
                 simulado = FALSE
             WHERE unidade = \$2
               AND seq_carregamento = \$3",
            [$placaNova, $unidade, $seqCarreg],
            $conn
        );

        sql(
            "INSERT INTO {$tabela}
             (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              nro_cte, destino, unidades, origem_ssw, origem_criacao, unidade_carregamento)
             VALUES
             (\$1, \$2, \$3, \$4, CURRENT_DATE, CURRENT_TIME,
              0, \$5, \$6, NULL, 'AUTO', \$7)",
            [$unidade, $seqCarreg, $placaNova, $login, $destinoCarreg, $unidadesCarreg, $unidade],
            $conn
        );

        pg_query($conn, 'COMMIT');
        respondJson(['success' => true]);
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao iniciar simulação.']);
    }
}

// ─── Ação: adicionar CT-es (apontamento manual e Hub) ─────────────────────────
if ($acao === 'adicionar_ctes') {
    $placa   = strtoupper(trim($input['placa'] ?? ''));
    $cteList = $input['ctes'] ?? [];

    if (empty($placa) || empty($cteList) || !is_array($cteList)) {
        respondJson(['success' => false, 'message' => 'Placa ou CT-es inválidos.']);
    }

    // Busca destino/unidades do carregamento existente (para replicar em cada linha)
    $seqCarreg = 0;
    $destinoCarreg  = '';
    $unidadesCarreg = '';
    $origemCriacao  = '';
    $resCarreg = pg_query($conn,
        "SELECT seq_carregamento, destino, unidades, origem_criacao FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND data_finalizacao IS NULL
         LIMIT 1"
    );
    if ($resCarreg && pg_num_rows($resCarreg) > 0) {
        $rowCarreg      = pg_fetch_assoc($resCarreg);
        $seqCarreg      = (int)($rowCarreg['seq_carregamento'] ?? 0);
        $destinoCarreg  = $rowCarreg['destino']  ?? '';
        $unidadesCarreg = $rowCarreg['unidades'] ?? '';
        $origemCriacao  = strtoupper(trim($rowCarreg['origem_criacao'] ?? ''));
    }
    if ($origemCriacao === '') $origemCriacao = 'MANUAL';

    if ($seqCarreg <= 0) {
        $seqCarreg = nextSeqCarregamento($conn, $seqName);
        if ($seqCarreg <= 0) {
            respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
        }
        @pg_query($conn,
            "UPDATE {$tabela}
             SET seq_carregamento = {$seqCarreg}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND data_finalizacao IS NULL"
        );
        @pg_query($conn,
            "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria)
             VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "')
             ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria"
        );
    }

    if ($seqCarreg > 0) {
        @pg_query($conn,
            "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria)
             VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "')
             ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria"
        );
    }

    pg_query($conn, 'BEGIN');
    $adicionados = 0;

    foreach ($cteList as $cteData) {
        $nroCte = (int)($cteData['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        $serCteRaw = strtoupper(trim((string)($cteData['serCte'] ?? $cteData['ser_cte'] ?? '')));
        if ($serCteRaw === '') continue;
        $serCte = pg_escape_string($conn, $serCteRaw);

        // Evita duplicata (mesmo carregamento)
        $check = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND ser_cte = '{$serCte}'
               AND nro_cte = {$nroCte}
             LIMIT 1"
        );
        if ($check && pg_num_rows($check) > 0) continue;

        $checkOutro = pg_query($conn,
            "SELECT placa_provisoria FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND ser_cte = '{$serCte}'
               AND nro_cte = {$nroCte}
               AND placa_provisoria <> '" . pg_escape_string($conn, $placa) . "'
             LIMIT 1"
        );
        if ($checkOutro && pg_num_rows($checkOutro) > 0) {
            $rowOutro = pg_fetch_assoc($checkOutro);
            $placaOutro = (string)($rowOutro['placa_provisoria'] ?? '');
            pg_query($conn, 'ROLLBACK');
            respondJson(['success' => false, 'message' => "CT-e {$serCteRaw}{$nroCte} já está no carregamento {$placaOutro}."]);
        }

        $destCte  = pg_escape_string($conn, strtoupper(trim($cteData['unidadeDest'] ?? $cteData['destinoCte'] ?? $cteData['destino_cte'] ?? $cteData['destino'] ?? '')));
        $unidCarRaw = strtoupper(trim(
            $cteData['unidadeCarregamento']
            ?? $cteData['unidade_carregamento']
            ?? $cteData['unidadeRelatorio']
            ?? ''
        ));
        if ($unidCarRaw === '') {
            pg_query($conn, 'ROLLBACK');
            respondJson(['success' => false, 'message' => 'Unidade de carregamento não informada para o CT-e ' . $serCte . $nroCte . '.']);
        }
        $unidCar  = pg_escape_string($conn, $unidCarRaw);
        $emissaoRaw = trim($cteData['emissao'] ?? '');
        $prevEntRaw = trim($cteData['prevEnt'] ?? '');
        if ($emissaoRaw !== '') {
            $emissaoRaw = preg_replace('/[^\d]/', '/', $emissaoRaw);
            $emissaoRaw = preg_replace('/\/+/', '/', trim($emissaoRaw, '/'));
        }
        if ($prevEntRaw !== '') {
            $prevEntRaw = preg_replace('/[^\d]/', '/', $prevEntRaw);
            $prevEntRaw = preg_replace('/\/+/', '/', trim($prevEntRaw, '/'));
        }
        $emissao  = pg_escape_string($conn, $emissaoRaw);
        $prevEnt  = pg_escape_string($conn, $prevEntRaw);
        $remetente  = pg_escape_string($conn, $cteData['remetente'] ?? '');
        $destinatar = pg_escape_string($conn, $cteData['destinatario'] ?? '');
        $pagador    = pg_escape_string($conn, $cteData['pagador'] ?? '');
        $cidade     = pg_escape_string($conn, $cteData['cidade'] ?? '');

        $vlrMerc  = str_replace(',', '.', preg_replace('/[^\d.,]/', '', $cteData['vlrNf']  ?? '0'));
        $vlrFrete = str_replace(',', '.', preg_replace('/[^\d.,]/', '', $cteData['frete']  ?? '0'));
        $peso     = str_replace(',', '.', preg_replace('/[^\d.,]/', '', $cteData['peso']   ?? '0'));
        $cubagem  = str_replace(',', '.', preg_replace('/[^\d.,]/', '', $cteData['cubagem'] ?? '0'));
        $qtdeVol  = (int)($cteData['qtdeVol'] ?? 0);

        $vlrMerc  = is_numeric($vlrMerc)  ? (float)$vlrMerc  : 0;
        $vlrFrete = is_numeric($vlrFrete) ? (float)$vlrFrete : 0;
        $peso     = is_numeric($peso)     ? (float)$peso     : 0;
        $cubagem  = is_numeric($cubagem)  ? (float)$cubagem  : 0;

        $emissaoSql = 'NULL';
        $prevEntSql = 'NULL';
        $nowYear  = (int)date('Y');
        $nowMonth = (int)date('n');
        if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $emissaoRaw)) {
            $emissaoSql = "TO_DATE('" . $emissao . "', 'DD/MM/YYYY')";
        } elseif (preg_match('/^(\d{2})\/(\d{2})$/', $emissaoRaw, $m)) {
            $y = $nowYear;
            $mm = (int)$m[2];
            if ($nowMonth >= 11 && $mm <= 2) $y = $nowYear + 1;
            $emissaoSql = "TO_DATE('" . $m[1] . '/' . $m[2] . '/' . $y . "', 'DD/MM/YYYY')";
        }
        if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $prevEntRaw)) {
            $prevEntSql = "TO_DATE('" . $prevEnt . "', 'DD/MM/YYYY')";
        } elseif (preg_match('/^(\d{2})\/(\d{2})$/', $prevEntRaw, $m)) {
            $y = $nowYear;
            $mm = (int)$m[2];
            if ($nowMonth >= 11 && $mm <= 2) $y = $nowYear + 1;
            $prevEntSql = "TO_DATE('" . $m[1] . '/' . $m[2] . '/' . $y . "', 'DD/MM/YYYY')";
        }

        $destEsc  = pg_escape_string($conn, $destinoCarreg);
        $unidEsc  = pg_escape_string($conn, $unidadesCarreg);

        $res = pg_query($conn,
            "INSERT INTO {$tabela}
             (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
              remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
              vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
              destino, unidades, origem_ssw, origem_criacao, unidade_carregamento)
             VALUES
             ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
              '{$serCte}', {$nroCte}, '{$destCte}', {$emissaoSql}, {$prevEntSql},
              '{$remetente}', '{$destinatar}', '{$pagador}', '{$cidade}',
              {$vlrMerc}, {$vlrFrete}, {$peso}, {$cubagem}, {$qtdeVol},
              '{$destEsc}', '{$unidEsc}', NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '{$unidCar}')"
        );

        if (!$res) {
            pg_query($conn, 'ROLLBACK');
            respondJson(['success' => false, 'message' => 'Erro ao adicionar CT-es: ' . pg_last_error($conn)]);
        }
        $adicionados++;
    }

    // Remove sentinela (nro_cte = 0) se adicionou CT-es reais
    if ($adicionados > 0) {
        pg_query($conn,
            "DELETE FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND nro_cte = 0"
        );
    }

    pg_query($conn, 'COMMIT');
    respondJson(['success' => true, 'adicionados' => $adicionados]);
}

// ─── Ação: remover CT-e ───────────────────────────────────────────────────────
if ($acao === 'remover_cte') {
    $placa  = strtoupper(trim($input['placa'] ?? ''));
    $nroCte = (int)($input['seq_cte'] ?? $input['nro_cte'] ?? 0);

    if (empty($placa) || $nroCte <= 0) {
        respondJson(['success' => false, 'message' => 'Placa ou CT-e inválido.']);
    }

    $seqCarreg = 0;
    $resSeq = @pg_query($conn,
        "SELECT seq_carregamento FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND data_finalizacao IS NULL
         LIMIT 1"
    );
    if ($resSeq && pg_num_rows($resSeq) > 0) {
        $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
    }
    if ($seqCarreg <= 0) {
        $seqCarreg = nextSeqCarregamento($conn, $seqName);
        if ($seqCarreg > 0) {
            @pg_query($conn,
                "UPDATE {$tabela}
                 SET seq_carregamento = {$seqCarreg}
                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                   AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
                   AND data_finalizacao IS NULL"
            );
        }
    }

    $res = pg_query($conn,
        "DELETE FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND nro_cte = {$nroCte}"
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao remover CT-e.']);
    }

    // Se ficou sem CT-es, reinsere sentinela para manter o carregamento visível
    $checkRestantes = pg_query($conn,
        "SELECT 1 FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND nro_cte > 0
         LIMIT 1"
    );
    if (!$checkRestantes || pg_num_rows($checkRestantes) === 0) {
        $origemCriacao = '';
        $resOrig = pg_query($conn,
            "SELECT origem_criacao FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
             LIMIT 1"
        );
        if ($resOrig && pg_num_rows($resOrig) > 0) {
            $rowO = pg_fetch_assoc($resOrig);
            $origemCriacao = strtoupper(trim($rowO['origem_criacao'] ?? ''));
        }
        if ($origemCriacao === '') $origemCriacao = 'MANUAL';
        pg_query($conn,
            "INSERT INTO {$tabela} (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, origem_ssw, origem_criacao, unidade_carregamento)
             VALUES ('" . pg_escape_string($conn, $unidade) . "', " . ((int)$seqCarreg) . ", '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "')"
        );
    }

    respondJson(['success' => true]);
}

// ─── Ação: remover múltiplos CT-es ─────────────────────────────────────────────
if ($acao === 'remover_ctes') {
    $placa = strtoupper(trim($input['placa'] ?? ''));
    $seqs  = $input['seq_ctes'] ?? $input['nro_ctes'] ?? [];

    if (empty($placa) || !is_array($seqs)) {
        respondJson(['success' => false, 'message' => 'Placa ou lista de CT-es inválida.']);
    }

    $ids = [];
    foreach ($seqs as $v) {
        $n = (int)$v;
        if ($n > 0) $ids[] = $n;
    }
    $ids = array_values(array_unique($ids));
    if (count($ids) === 0) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e válido informado.']);
    }

    $seqCarreg = 0;
    $resSeq = @pg_query($conn,
        "SELECT seq_carregamento FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND data_finalizacao IS NULL
         LIMIT 1"
    );
    if ($resSeq && pg_num_rows($resSeq) > 0) {
        $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
    }
    if ($seqCarreg <= 0) {
        $seqCarreg = nextSeqCarregamento($conn, $seqName);
        if ($seqCarreg > 0) {
            @pg_query($conn,
                "UPDATE {$tabela}
                 SET seq_carregamento = {$seqCarreg}
                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                   AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
                   AND data_finalizacao IS NULL"
            );
        }
    }

    pg_query($conn, 'BEGIN');
    $idsSql = implode(',', $ids);
    $res = pg_query($conn,
        "DELETE FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND nro_cte IN ({$idsSql})"
    );

    if (!$res) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao remover CT-es.']);
    }

    $removidos = pg_affected_rows($res);

    $checkRestantes = pg_query($conn,
        "SELECT 1 FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND nro_cte > 0
         LIMIT 1"
    );
    if (!$checkRestantes || pg_num_rows($checkRestantes) === 0) {
        $origemCriacao = '';
        $resOrig = pg_query($conn,
            "SELECT origem_criacao FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
             LIMIT 1"
        );
        if ($resOrig && pg_num_rows($resOrig) > 0) {
            $rowO = pg_fetch_assoc($resOrig);
            $origemCriacao = strtoupper(trim($rowO['origem_criacao'] ?? ''));
        }
        if ($origemCriacao === '') $origemCriacao = 'MANUAL';
        $checkSent = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND nro_cte = 0
             LIMIT 1"
        );
        if (!$checkSent || pg_num_rows($checkSent) === 0) {
            pg_query($conn,
                "INSERT INTO {$tabela} (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, origem_ssw, origem_criacao, unidade_carregamento)
                 VALUES ('" . pg_escape_string($conn, $unidade) . "', " . ((int)$seqCarreg) . ", '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "')"
            );
        }
    }

    pg_query($conn, 'COMMIT');
    respondJson(['success' => true, 'removidos' => $removidos]);
}

// ─── Ação: excluir carregamento ───────────────────────────────────────────────
if ($acao === 'excluir_carregamento') {
    $placa = strtoupper(trim($input['placa'] ?? ''));
    if (empty($placa)) {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '" . pg_escape_string($conn, $login) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND data_finalizacao IS NULL"
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao finalizar carregamento.']);
    }

    $affected = pg_affected_rows($res);
    if ($affected <= 0) {
        respondJson(['success' => true, 'already' => true]);
    }
    respondJson(['success' => true, 'updated' => $affected]);
}

// ─── Ação: deletar carregamento (exclusão física) ─────────────────────────────
if ($acao === 'deletar_carregamento') {
    $placa = strtoupper(trim((string)($input['placa'] ?? '')));
    if ($placa === '') {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $seqCarreg = 0;
    $resSeq = sql(
        "SELECT seq_carregamento
         FROM {$tabela}
         WHERE unidade = \$1
           AND placa_provisoria = \$2
           AND data_finalizacao IS NULL
         ORDER BY COALESCE(seq_carregamento, 0) DESC
         LIMIT 1",
        [$unidade, $placa],
        $conn
    );
    if ($resSeq && pg_num_rows($resSeq) > 0) {
        $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
    }

    $resDel = sql(
        "DELETE FROM {$tabela}
         WHERE unidade = \$1
           AND placa_provisoria = \$2
           AND data_finalizacao IS NULL",
        [$unidade, $placa],
        $conn
    );
    if (!$resDel) {
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamento.']);
    }

    $deleted = pg_affected_rows($resDel);

    // Remove parâmetros associados (capacidade) se existir
    if ($seqCarreg > 0) {
        @pg_query($conn,
            "DELETE FROM {$tabelaCap}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND seq_carregamento = " . ((int)$seqCarreg)
        );
    } else {
        @pg_query($conn,
            "DELETE FROM {$tabelaCap}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'"
        );
    }

    respondJson(['success' => true, 'deleted' => $deleted]);
}

// ─── Ação: atualizar placa ────────────────────────────────────────────────────
if ($acao === 'atualizar_placa') {
    $placaAntiga = strtoupper(trim($input['placa_antiga'] ?? ''));
    $placaNova   = strtoupper(trim($input['placa_nova'] ?? ''));

    if (empty($placaAntiga) || empty($placaNova)) {
        respondJson(['success' => false, 'message' => 'Placas não informadas.']);
    }

    $check = pg_query($conn,
        "SELECT 1 FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         LIMIT 1"
    );
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaNova}."]);
    }

    $seqCarreg = 0;
    $resSeq = @pg_query($conn,
        "SELECT seq_carregamento FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'
           AND data_finalizacao IS NULL
         LIMIT 1"
    );
    if ($resSeq && pg_num_rows($resSeq) > 0) {
        $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
    }

    $whereCar = ($seqCarreg > 0)
        ? ("seq_carregamento = " . (int)$seqCarreg . " AND data_finalizacao IS NULL")
        : ("placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'");

    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND {$whereCar}"
    );
    if (!$res) respondJson(['success' => false, 'message' => 'Erro ao atualizar placa.']);

    // Atualiza na capacidade também
    $whereCap = ($seqCarreg > 0)
        ? ("seq_carregamento = " . (int)$seqCarreg)
        : ("placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'");

    pg_query($conn,
        "UPDATE {$tabelaCap}
         SET placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND {$whereCap}"
    );

    respondJson(['success' => true]);
}

// ─── Ação: atualizar capacidade ───────────────────────────────────────────────
if ($acao === 'atualizar_capacidade') {
    $placa  = strtoupper(trim($input['placa'] ?? ''));
    $seqCarreg = (int)($input['seq_carregamento'] ?? 0);
    $capTon = ($input['cap_ton'] !== '' && $input['cap_ton'] !== null) ? (float)$input['cap_ton'] : null;
    $capM3  = ($input['cap_m3']  !== '' && $input['cap_m3']  !== null) ? (float)$input['cap_m3']  : null;
    $vlrMinFrete = ($input['vlr_min_frete'] !== '' && $input['vlr_min_frete'] !== null) ? (float)$input['vlr_min_frete'] : null;
    $vlrFreteCarreteiro = ($input['vlr_frete_carreteiro'] !== '' && $input['vlr_frete_carreteiro'] !== null) ? (float)$input['vlr_frete_carreteiro'] : null;
    $destinoLinha = strtoupper(trim((string)($input['destino'] ?? '')));
    $paradasLinha = strtoupper(trim((string)($input['paradas'] ?? $input['unidades'] ?? '')));

    if (empty($placa)) respondJson(['success' => false, 'message' => 'Placa não informada.']);

    $capTonSql = $capTon !== null ? $capTon : 'NULL';
    $capM3Sql  = $capM3  !== null ? $capM3  : 'NULL';
    $vlrTerSql = $vlrFreteCarreteiro !== null ? $vlrFreteCarreteiro : 'NULL';

    if ($seqCarreg <= 0) {
        $resSeq = @pg_query($conn,
            "SELECT seq_carregamento FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND data_finalizacao IS NULL
             LIMIT 1"
        );
        if ($resSeq && pg_num_rows($resSeq) > 0) {
            $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
        }
    }
    if ($seqCarreg <= 0) {
        $seqCarreg = nextSeqCarregamento($conn, $seqName);
        if ($seqCarreg <= 0) respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
        @pg_query($conn,
            "UPDATE {$tabela}
             SET seq_carregamento = {$seqCarreg}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND data_finalizacao IS NULL"
        );
    }

    pg_query($conn, "
        CREATE TABLE IF NOT EXISTS {$tabelaCap} (
            unidade          VARCHAR(10) NOT NULL,
            seq_carregamento INT NOT NULL,
            placa_provisoria VARCHAR(20) NOT NULL,
            cap_ton          NUMERIC,
            cap_m3           NUMERIC,
            vlr_frete_carreteiro NUMERIC,
            simulado         BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (unidade, seq_carregamento)
        )
    ");

    pg_query($conn,
        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, cap_ton, cap_m3, vlr_frete_carreteiro)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', " . ((int)$seqCarreg) . ", '" . pg_escape_string($conn, $placa) . "', {$capTonSql}, {$capM3Sql}, {$vlrTerSql})
         ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, cap_ton = EXCLUDED.cap_ton, cap_m3 = EXCLUDED.cap_m3, vlr_frete_carreteiro = EXCLUDED.vlr_frete_carreteiro"
    );

    if (strpos($placa, '-') === false) {
        $resVeic = @pg_query($conn,
            "UPDATE {$tabelaVeiculo}
             SET capacidade_ton = {$capTonSql},
                 capacidade_m3 = {$capM3Sql}
             WHERE UPPER(placa) = UPPER('" . pg_escape_string($conn, $placa) . "')"
        );
        if ($resVeic === false) {
            @pg_query($conn,
                "UPDATE {$tabelaVeiculo}
                 SET capacidade_ton = {$capTonSql},
                     capacidade_m3 = {$capM3Sql}
                 WHERE UPPER(placa) = UPPER('" . pg_escape_string($conn, $placa) . "')"
            );
        }
    }

    $atualizouLinha = false;
    if ($vlrMinFrete !== null && $destinoLinha !== '') {
        $vlrMinSql = $vlrMinFrete;
        $paradasNorm = $paradasLinha;
        $paradasNorm = preg_replace('/\s+/', ' ', trim($paradasNorm));
        $resLinha = @pg_query($conn,
            "UPDATE {$tabelaLinha}
             SET vlr_min_frete = {$vlrMinSql}
             WHERE sigla_emit = '" . pg_escape_string($conn, $unidade) . "'
               AND sigla_dest = '" . pg_escape_string($conn, $destinoLinha) . "'
               AND COALESCE(unidades, '') = '" . pg_escape_string($conn, $paradasNorm) . "'"
        );
        if ($resLinha && pg_affected_rows($resLinha) > 0) $atualizouLinha = true;
    }

    respondJson(['success' => true, 'atualizou_linha' => $atualizouLinha]);
}

// ─── Ação: excluir todos ──────────────────────────────────────────────────────
if ($acao === 'excluir_todos') {
    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '" . pg_escape_string($conn, $login) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL"
    );
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao finalizar carregamentos.']);
    }
    respondJson(['success' => true, 'updated' => pg_affected_rows($res)]);
}

// ─── Ação: finalizar carregamento ─────────────────────────────────────────────
if ($acao === 'finalizar_carregamento') {
    $placa = strtoupper(trim((string)($input['placa'] ?? '')));
    if ($placa === '') {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '" . pg_escape_string($conn, $login) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND data_finalizacao IS NULL"
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao finalizar carregamento.']);
    }

    $affected = pg_affected_rows($res);
    if ($affected <= 0) {
        respondJson(['success' => true, 'already' => true]);
    }

    respondJson(['success' => true, 'updated' => $affected]);
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);
