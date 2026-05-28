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

    $sql = "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao)
            VALUES ('{$unidadeEsc}', 0, '{$placaEsc}', '{$loginEsc}')";
    $res = pg_query($conn, $sql);
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao criar carregamento.']);
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
    $seqCtes = $input['seq_ctes'] ?? [];
    if (empty($placa) || empty($seqCtes) || !is_array($seqCtes)) {
        respondJson(['success' => false, 'message' => 'Placa ou CT-es inválidos.']);
    }
    $placaEsc = pg_escape_string($conn, $placa);

    pg_query($conn, 'BEGIN');
    $adicionados = 0;
    foreach ($seqCtes as $seqCte) {
        $seqCte = (int)$seqCte;
        if ($seqCte <= 0) continue;

        $check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = {$seqCte} LIMIT 1");
        if (pg_num_rows($check) > 0) continue;

        $sql = "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao)
                VALUES ('{$unidadeEsc}', {$seqCte}, '{$placaEsc}', '{$loginEsc}')";
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

respondJson(['success' => false, 'message' => 'Ação inválida.']);
