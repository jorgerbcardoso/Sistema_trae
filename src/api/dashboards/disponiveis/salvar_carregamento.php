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

$tabela = "{$domain}_carregamento";

$conn = connect();

$sqlCria = "
    CREATE TABLE IF NOT EXISTS {$tabela} (
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
$loginEsc   = pg_escape_string($conn, $login);

if ($acao === 'criar') {
    $placa = strtoupper(trim($input['placa'] ?? ''));
    if (empty($placa)) {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }
    $placaEsc = pg_escape_string($conn, $placa);

    $check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' LIMIT 1");
    if (pg_num_rows($check) > 0) {
        respondJson(['success' => false, 'message' => 'Já existe um carregamento com esta placa para sua unidade.']);
    }

    $destino  = strtoupper(trim($input['destino'] ?? ''));
    $paradas  = strtoupper(trim($input['paradas'] ?? ''));
    $destinoEsc = $destino !== '' ? pg_escape_string($conn, $destino) : '';
    $paradasEsc = $paradas !== '' ? pg_escape_string($conn, $paradas) : '';

    $sql = "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao)
            VALUES ('{$unidadeEsc}', 0, '{$placaEsc}', '{$loginEsc}')";
    $res = pg_query($conn, $sql);
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao criar carregamento.']);
    }

    if ($destinoEsc !== '' || $paradasEsc !== '') {
        pg_query($conn, "
            CREATE TABLE IF NOT EXISTS {$tabela}_capacidade (
                unidade          VARCHAR(10) NOT NULL,
                placa_provisoria VARCHAR(20) NOT NULL,
                cap_ton          NUMERIC,
                cap_m3           NUMERIC,
                destino          VARCHAR(10),
                paradas          TEXT,
                PRIMARY KEY (unidade, placa_provisoria)
            )
        ");
        pg_query($conn, "
            INSERT INTO {$tabela}_capacidade (unidade, placa_provisoria, destino, paradas)
            VALUES ('{$unidadeEsc}', '{$placaEsc}', " . ($destinoEsc !== '' ? "'{$destinoEsc}'" : 'NULL') . ", " . ($paradasEsc !== '' ? "'{$paradasEsc}'" : 'NULL') . ")
            ON CONFLICT (unidade, placa_provisoria) DO UPDATE SET destino = EXCLUDED.destino, paradas = EXCLUDED.paradas
        ");
    }

    respondJson(['success' => true]);
}

if ($acao === 'adicionar_cte') {
    $placa  = strtoupper(trim($input['placa'] ?? ''));
    $seqCte = (int)($input['seq_cte'] ?? 0);
    if (empty($placa) || $seqCte <= 0) {
        respondJson(['success' => false, 'message' => 'Placa ou CT-e inválido.']);
    }
    $placaEsc = pg_escape_string($conn, $placa);

    $check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = {$seqCte} LIMIT 1");
    if (pg_num_rows($check) > 0) {
        respondJson(['success' => false, 'message' => 'Este CT-e já está neste carregamento.']);
    }

    $sql = "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao)
            VALUES ('{$unidadeEsc}', {$seqCte}, '{$placaEsc}', '{$loginEsc}')";
    $res = pg_query($conn, $sql);
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao adicionar CT-e ao carregamento.']);
    }
    respondJson(['success' => true]);
}

if ($acao === 'adicionar_ctes') {
    $placa   = strtoupper(trim($input['placa'] ?? ''));
    $cteList = $input['ctes'] ?? [];
    if (empty($placa) || empty($cteList) || !is_array($cteList)) {
        respondJson(['success' => false, 'message' => 'Placa ou CT-es inválidos.']);
    }
    $placaEsc = pg_escape_string($conn, $placa);

    // Garante colunas novas existem
    $novasCols = [
        'ser_cte VARCHAR(5)', 'nro_cte INT', 'destino_cte VARCHAR(10)',
        'data_emissao_cte DATE', 'data_prev_ent_cte DATE',
        'remetente_cte TEXT', 'destinatario_cte TEXT', 'pagador_cte TEXT',
        'cidade_destino_cte TEXT', 'vlr_merc_cte NUMERIC', 'vlr_frete_cte NUMERIC',
        'peso_cte NUMERIC', 'cubagem_cte NUMERIC', 'qtde_vol_cte INT',
    ];
    foreach ($novasCols as $colDef) {
        $colName = explode(' ', $colDef)[0];
        pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS {$colName} " . implode(' ', array_slice(explode(' ', $colDef), 1)));
    }

    pg_query($conn, 'BEGIN');
    $adicionados = 0;
    foreach ($cteList as $cteData) {
        $seqCte = (int)($cteData['seqCte'] ?? $cteData['seq_cte'] ?? 0);
        $nroCte = (int)($cteData['nroCte'] ?? 0);
        if ($seqCte <= 0 && $nroCte <= 0) continue;
        // Usa seqCte como PK se disponível, senão nroCte como fallback temporário
        $idCte = $seqCte > 0 ? $seqCte : $nroCte;

        $check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = {$idCte} LIMIT 1");
        if (pg_num_rows($check) > 0) continue;

        $serCte      = pg_escape_string($conn, strtoupper(trim($cteData['serCte'] ?? '')));
        $destCte     = pg_escape_string($conn, strtoupper(trim($cteData['unidadeDest'] ?? $cteData['cidade'] ?? '')));
        $emissao     = pg_escape_string($conn, $cteData['emissao'] ?? '');
        $prevEnt     = pg_escape_string($conn, $cteData['prevEnt'] ?? '');
        $remetente   = pg_escape_string($conn, $cteData['remetente'] ?? '');
        $destinatar  = pg_escape_string($conn, $cteData['destinatario'] ?? '');
        $pagador     = pg_escape_string($conn, $cteData['pagador'] ?? '');
        $cidade      = pg_escape_string($conn, $cteData['cidade'] ?? '');
        $vlrMerc     = pg_escape_string($conn, preg_replace('/[^\d.,]/', '', $cteData['vlrNf'] ?? '0'));
        $vlrFrete    = pg_escape_string($conn, preg_replace('/[^\d.,]/', '', $cteData['frete'] ?? '0'));
        $peso        = pg_escape_string($conn, preg_replace('/[^\d.,]/', '', $cteData['peso'] ?? '0'));
        $cubagem     = pg_escape_string($conn, preg_replace('/[^\d.,]/', '', $cteData['cubagem'] ?? '0'));
        $qtdeVol     = (int)($cteData['qtdeVol'] ?? 0);

        $emissaoSql  = $emissao  ? "TO_DATE('{$emissao}', 'DD/MM/YYYY')"  : 'NULL';
        $prevEntSql  = $prevEnt  ? "TO_DATE('{$prevEnt}', 'DD/MM/YYYY')"  : 'NULL';

        $sql = "INSERT INTO {$tabela}
            (unidade, seq_cte, placa_provisoria, login_inclusao,
             ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
             remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
             vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte)
            VALUES
            ('{$unidadeEsc}', {$idCte}, '{$placaEsc}', '{$loginEsc}',
             '{$serCte}', {$nroCte}, '{$destCte}', {$emissaoSql}, {$prevEntSql},
             '{$remetente}', '{$destinatar}', '{$pagador}', '{$cidade}',
             " . (is_numeric(str_replace(',', '.', $vlrMerc)) ? str_replace(',', '.', $vlrMerc) : '0') . ",
             " . (is_numeric(str_replace(',', '.', $vlrFrete)) ? str_replace(',', '.', $vlrFrete) : '0') . ",
             " . (is_numeric(str_replace(',', '.', $peso)) ? str_replace(',', '.', $peso) : '0') . ",
             " . (is_numeric(str_replace(',', '.', $cubagem)) ? str_replace(',', '.', $cubagem) : '0') . ",
             {$qtdeVol})";
        $res = pg_query($conn, $sql);
        if (!$res) {
            pg_query($conn, 'ROLLBACK');
            respondJson(['success' => false, 'message' => 'Erro ao adicionar CT-es.']);
        }
        $adicionados++;
    }
    if ($adicionados > 0) {
        pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = 0");
    }
    pg_query($conn, 'COMMIT');
    respondJson(['success' => true, 'adicionados' => $adicionados]);
}

if ($acao === 'remover_cte') {
    $placa  = strtoupper(trim($input['placa'] ?? ''));
    $seqCte = (int)($input['seq_cte'] ?? 0);
    if (empty($placa) || $seqCte <= 0) {
        respondJson(['success' => false, 'message' => 'Placa ou CT-e inválido.']);
    }
    $placaEsc = pg_escape_string($conn, $placa);

    $sql = "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = {$seqCte}";
    $res = pg_query($conn, $sql);
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao remover CT-e.']);
    }

    $checkRestantes = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte > 0 LIMIT 1");
    if (pg_num_rows($checkRestantes) === 0) {
        pg_query($conn, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao) VALUES ('{$unidadeEsc}', 0, '{$placaEsc}', '{$loginEsc}')");
    }

    respondJson(['success' => true]);
}

if ($acao === 'excluir_carregamento') {
    $placa = strtoupper(trim($input['placa'] ?? ''));
    if (empty($placa)) {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }
    $placaEsc = pg_escape_string($conn, $placa);

    $sql = "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}'";
    $res = pg_query($conn, $sql);
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamento.']);
    }
    respondJson(['success' => true]);
}

if ($acao === 'atualizar_placa') {
    $placaAntiga = strtoupper(trim($input['placa_antiga'] ?? ''));
    $placaNova   = strtoupper(trim($input['placa_nova'] ?? ''));
    if (empty($placaAntiga) || empty($placaNova)) {
        respondJson(['success' => false, 'message' => 'Placas não informadas.']);
    }
    $placaAntigaEsc = pg_escape_string($conn, $placaAntiga);
    $placaNovaEsc   = pg_escape_string($conn, $placaNova);
    $check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaNovaEsc}' LIMIT 1");
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaNova}."]);
    }
    $res = pg_query($conn, "UPDATE {$tabela} SET placa_provisoria = '{$placaNovaEsc}' WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaAntigaEsc}'");
    if (!$res) respondJson(['success' => false, 'message' => 'Erro ao atualizar placa.']);
    respondJson(['success' => true]);
}

if ($acao === 'atualizar_capacidade') {
    $placa  = strtoupper(trim($input['placa'] ?? ''));
    $capTon = $input['cap_ton'] !== '' && $input['cap_ton'] !== null ? (float)$input['cap_ton'] : null;
    $capM3  = $input['cap_m3']  !== '' && $input['cap_m3']  !== null ? (float)$input['cap_m3']  : null;
    if (empty($placa)) respondJson(['success' => false, 'message' => 'Placa não informada.']);
    $placaEsc  = pg_escape_string($conn, $placa);
    $capTonSql = $capTon !== null ? $capTon : 'NULL';
    $capM3Sql  = $capM3  !== null ? $capM3  : 'NULL';

    pg_query($conn, "
        CREATE TABLE IF NOT EXISTS {$tabela}_capacidade (
            unidade          VARCHAR(10) NOT NULL,
            placa_provisoria VARCHAR(20) NOT NULL,
            cap_ton          NUMERIC,
            cap_m3           NUMERIC,
            PRIMARY KEY (unidade, placa_provisoria)
        )
    ");
    pg_query($conn, "
        INSERT INTO {$tabela}_capacidade (unidade, placa_provisoria, cap_ton, cap_m3)
        VALUES ('{$unidadeEsc}', '{$placaEsc}', {$capTonSql}, {$capM3Sql})
        ON CONFLICT (unidade, placa_provisoria) DO UPDATE SET cap_ton = EXCLUDED.cap_ton, cap_m3 = EXCLUDED.cap_m3
    ");
    respondJson(['success' => true]);
}

if ($acao === 'excluir_todos') {
    $res = pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}'");
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamentos.']);
    }
    respondJson(['success' => true]);
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);
