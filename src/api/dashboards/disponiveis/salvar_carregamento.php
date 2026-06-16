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

$conn = connect();

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

    // Linha sentinela: nro_cte = 0 indica carregamento sem CT-es ainda
    $destinoSql = $destino !== '' ? "'" . pg_escape_string($conn, $destino) . "'" : 'NULL';
    $unidadesSql = $paradas !== '' ? "'" . pg_escape_string($conn, $paradas) . "'" : 'NULL';

    $res = pg_query($conn,
        "INSERT INTO {$tabela} (unidade, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, destino, unidades, origem_ssw, unidade_carregamento)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, {$destinoSql}, {$unidadesSql}, false, '" . pg_escape_string($conn, $unidade) . "')"
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao criar carregamento: ' . pg_last_error($conn)]);
    }

    respondJson(['success' => true]);
}

// ─── Ação: adicionar CT-es (apontamento manual e Hub) ─────────────────────────
if ($acao === 'adicionar_ctes') {
    $placa   = strtoupper(trim($input['placa'] ?? ''));
    $cteList = $input['ctes'] ?? [];

    if (empty($placa) || empty($cteList) || !is_array($cteList)) {
        respondJson(['success' => false, 'message' => 'Placa ou CT-es inválidos.']);
    }

    // Busca destino/unidades do carregamento existente (para replicar em cada linha)
    $destinoCarreg  = '';
    $unidadesCarreg = '';
    $resCarreg = pg_query($conn,
        "SELECT destino, unidades FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
         LIMIT 1"
    );
    if ($resCarreg && pg_num_rows($resCarreg) > 0) {
        $rowCarreg      = pg_fetch_assoc($resCarreg);
        $destinoCarreg  = $rowCarreg['destino']  ?? '';
        $unidadesCarreg = $rowCarreg['unidades'] ?? '';
    }

    pg_query($conn, 'BEGIN');
    $adicionados = 0;

    foreach ($cteList as $cteData) {
        $nroCte = (int)($cteData['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        // Evita duplicata
        $check = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND nro_cte = {$nroCte}
             LIMIT 1"
        );
        if ($check && pg_num_rows($check) > 0) continue;

        $serCte   = pg_escape_string($conn, strtoupper(trim($cteData['serCte'] ?? $cteData['ser_cte'] ?? '')));
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
             (unidade, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
              remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
              vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
              destino, unidades, origem_ssw, unidade_carregamento)
             VALUES
             ('" . pg_escape_string($conn, $unidade) . "', '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
              '{$serCte}', {$nroCte}, '{$destCte}', {$emissaoSql}, {$prevEntSql},
              '{$remetente}', '{$destinatar}', '{$pagador}', '{$cidade}',
              {$vlrMerc}, {$vlrFrete}, {$peso}, {$cubagem}, {$qtdeVol},
              '{$destEsc}', '{$unidEsc}', false, '{$unidCar}')"
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
        pg_query($conn,
            "INSERT INTO {$tabela} (unidade, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, origem_ssw, unidade_carregamento)
             VALUES ('" . pg_escape_string($conn, $unidade) . "', '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, false, '" . pg_escape_string($conn, $unidade) . "')"
        );
    }

    respondJson(['success' => true]);
}

// ─── Ação: excluir carregamento ───────────────────────────────────────────────
if ($acao === 'excluir_carregamento') {
    $placa = strtoupper(trim($input['placa'] ?? ''));
    if (empty($placa)) {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $res = pg_query($conn,
        "DELETE FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'"
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamento.']);
    }

    // Limpa capacidade também
    pg_query($conn,
        "DELETE FROM {$tabelaCap}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'"
    );

    respondJson(['success' => true]);
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

    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'"
    );
    if (!$res) respondJson(['success' => false, 'message' => 'Erro ao atualizar placa.']);

    // Atualiza na capacidade também
    pg_query($conn,
        "UPDATE {$tabelaCap}
         SET placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'"
    );

    respondJson(['success' => true]);
}

// ─── Ação: atualizar capacidade ───────────────────────────────────────────────
if ($acao === 'atualizar_capacidade') {
    $placa  = strtoupper(trim($input['placa'] ?? ''));
    $capTon = ($input['cap_ton'] !== '' && $input['cap_ton'] !== null) ? (float)$input['cap_ton'] : null;
    $capM3  = ($input['cap_m3']  !== '' && $input['cap_m3']  !== null) ? (float)$input['cap_m3']  : null;

    if (empty($placa)) respondJson(['success' => false, 'message' => 'Placa não informada.']);

    $capTonSql = $capTon !== null ? $capTon : 'NULL';
    $capM3Sql  = $capM3  !== null ? $capM3  : 'NULL';

    pg_query($conn, "
        CREATE TABLE IF NOT EXISTS {$tabelaCap} (
            unidade          VARCHAR(10) NOT NULL,
            placa_provisoria VARCHAR(20) NOT NULL,
            cap_ton          NUMERIC,
            cap_m3           NUMERIC,
            PRIMARY KEY (unidade, placa_provisoria)
        )
    ");

    pg_query($conn,
        "INSERT INTO {$tabelaCap} (unidade, placa_provisoria, cap_ton, cap_m3)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', '" . pg_escape_string($conn, $placa) . "', {$capTonSql}, {$capM3Sql})
         ON CONFLICT (unidade, placa_provisoria) DO UPDATE SET cap_ton = EXCLUDED.cap_ton, cap_m3 = EXCLUDED.cap_m3"
    );

    respondJson(['success' => true]);
}

// ─── Ação: excluir todos ──────────────────────────────────────────────────────
if ($acao === 'excluir_todos') {
    $res = pg_query($conn,
        "DELETE FROM {$tabela} WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'"
    );
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamentos.']);
    }
    respondJson(['success' => true]);
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);
