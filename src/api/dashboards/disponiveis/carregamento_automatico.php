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
$unidadeEsc  = pg_escape_string($conn, $unidade);
$loginEsc    = pg_escape_string($conn, $login);

$modoAutomatico = empty($placa) && empty($unidadeDestino);

if ($modoAutomatico) {
    $resLinhas = pg_query($conn, "SELECT sigla_emit, sigla_dest, unidades FROM {$tabelaLinha} WHERE UPPER(sigla_emit) = '{$unidadeEsc}' ORDER BY sigla_dest");
    if (!$resLinhas || pg_num_rows($resLinhas) === 0) {
        respondJson(['success' => false, 'message' => 'Nenhuma linha cadastrada com origem nesta unidade.']);
    }

    $linhas = [];
    while ($row = pg_fetch_assoc($resLinhas)) {
        $linhas[] = $row;
    }

    $resultados = [];

    foreach ($linhas as $linha) {
        $dest    = strtoupper(trim($linha['sigla_dest']));
        $paradasLinha = array_filter(array_map('strtoupper', array_map('trim', explode(',', $linha['unidades'] ?? ''))));
        $placaAuto = $unidade . '-' . $dest;
        $placaEsc  = pg_escape_string($conn, $placaAuto);

        $check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' LIMIT 1");
        if ($check && pg_num_rows($check) > 0) {
            $resultados[] = ['placa' => $placaAuto, 'status' => 'ignorado', 'msg' => 'Carregamento já existe.'];
            continue;
        }

        $destinosCarregamento = array_values(array_merge(array_values($paradasLinha), [$dest]));
        $placeholders = implode(',', array_map(fn($d) => "'" . pg_escape_string($conn, $d) . "'", $destinosCarregamento));

        $sqlCtes = "
            SELECT seq_cte FROM {$tabelaCte}
            WHERE UPPER(sigla_dest) IN ({$placeholders})
              AND status NOT IN ('C','X')
              AND seq_cte NOT IN (
                  SELECT seq_cte FROM {$tabela}
                  WHERE UPPER(unidade) = '{$unidadeEsc}' AND seq_cte > 0
              )
        ";
        $resCtes = pg_query($conn, $sqlCtes);
        $seqCtes = [];
        while ($r = pg_fetch_assoc($resCtes)) {
            $seqCtes[] = (int)$r['seq_cte'];
        }

        if (empty($seqCtes)) {
            $resultados[] = ['placa' => $placaAuto, 'status' => 'vazio', 'msg' => 'Nenhum CT-e disponível para este destino.'];
            continue;
        }

        pg_query($conn, 'BEGIN');
        pg_query($conn, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ('{$unidadeEsc}', 0, '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME)");
        foreach ($seqCtes as $seq) {
            pg_query($conn, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ('{$unidadeEsc}', {$seq}, '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME)");
        }
        pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = 0");
        pg_query($conn, 'COMMIT');

        $resultados[] = ['placa' => $placaAuto, 'status' => 'criado', 'msg' => count($seqCtes) . ' CT-e(s) adicionados.'];
    }

    $criados = count(array_filter($resultados, fn($r) => $r['status'] === 'criado'));
    respondJson(['success' => true, 'message' => "{$criados} carregamento(s) criado(s) automaticamente.", 'resultados' => $resultados]);
}

if (empty($unidadeDestino)) {
    respondJson(['success' => false, 'message' => 'Unidade de destino não informada.']);
}

$destEsc   = pg_escape_string($conn, $unidadeDestino);
$placaFinal = !empty($placa) ? $placa : ($unidade . '-' . $unidadeDestino);
$placaEsc   = pg_escape_string($conn, $placaFinal);

$check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' LIMIT 1");
if ($check && pg_num_rows($check) > 0) {
    respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaFinal}."]);

}

$destinosCarregamento = array_values(array_merge(array_values($paradas), [$unidadeDestino]));
$placeholders = implode(',', array_map(fn($d) => "'" . pg_escape_string($conn, $d) . "'", $destinosCarregamento));

$sqlCtes = "
    SELECT seq_cte FROM {$tabelaCte}
    WHERE UPPER(sigla_dest) IN ({$placeholders})
      AND status NOT IN ('C','X')
      AND seq_cte NOT IN (
          SELECT seq_cte FROM {$tabela}
          WHERE UPPER(unidade) = '{$unidadeEsc}' AND seq_cte > 0
      )
";
$resCtes = pg_query($conn, $sqlCtes);
$seqCtes = [];
while ($r = pg_fetch_assoc($resCtes)) {
    $seqCtes[] = (int)$r['seq_cte'];
}

if (empty($seqCtes)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível para os destinos informados.']);
}

pg_query($conn, 'BEGIN');
pg_query($conn, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ('{$unidadeEsc}', 0, '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME)");
foreach ($seqCtes as $seq) {
    pg_query($conn, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ('{$unidadeEsc}', {$seq}, '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME)");
}
pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = 0");
pg_query($conn, 'COMMIT');

respondJson(['success' => true, 'message' => count($seqCtes) . " CT-e(s) adicionados ao carregamento {$placaFinal}."]);
