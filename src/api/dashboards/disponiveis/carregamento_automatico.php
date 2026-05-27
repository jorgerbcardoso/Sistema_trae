<?php
require_once __DIR__ . '/disponiveis_lib.php';

handleOptionsRequest();
validateRequestMethod('POST');

try {
    $auth   = authenticateAndGetUser();
    $domain = $auth['domain'];
    $user   = $auth['user'];
    $sigla  = $user['unidade_atual'];

    $input = getRequestInput();

    $placa          = $input['placa'] ?? null;
    $unidadeDestino = $input['unidadeDestino'] ?? null;
    $paradas        = $input['paradas'] ?? [];

    if (!$placa || !$unidadeDestino) {
        throw new Exception('Placa e unidade de destino são obrigatórios');
    }

    $g_sql = connect();

    $capacidade = getVeiculoCapacidade($g_sql, $placa);
    if (!$capacidade || !$capacidade['capacidade_ton'] || !$capacidade['capacidade_m3']) {
        throw new Exception('Veículo não encontrado ou sem os limites de peso e cubagem definidos.');
    }

    $pesoMax = $capacidade['capacidade_ton'] * 1000;
    $cubagemMax = $capacidade['capacidade_m3'];

    $ctes = [];
    $unidadeDestAtual = '';
    $nomeDestAtual    = '';

    foreach ($linhas as $linha) {
        if (strpos($linha, 'DESTINO FINAL:') !== false) {
            $parts = explode(' ', $linha);
            $unidadeDestAtual = trim($parts[2]);
            $nomeDestAtual = trim(implode(' ', array_slice($parts, 3)));
            continue;
        }

        $ctrc = trim(substr($linha, 0, 13));
        if (!preg_match('/^[A-Z]{3}\d{6}-\d$/', $ctrc)) continue;

        $ctes[] = [
            'ctrc' => $ctrc,
            'prevEnt' => trim(substr($linha, 22, 5)),
            'peso' => floatval(str_replace('.', '', str_replace(',', '.', trim(substr($linha, 100, 10))))),
            'cubagem' => floatval(str_replace(',', '.', trim(substr($linha, 111, 10)))),
            'unidadeDest' => $unidadeDestAtual,
        ];
    }

    usort($ctes, function($a, $b) use ($unidadeDestino) {
        $dataA = DateTime::createFromFormat('d/m', $a['prevEnt']);
        $dataB = DateTime::createFromFormat('d/m', $b['prevEnt']);
        if ($dataA != $dataB) {
            return $dataA < $dataB ? -1 : 1;
        }
        if ($a['unidadeDest'] == $unidadeDestino && $b['unidadeDest'] != $unidadeDestino) return -1;
        if ($a['unidadeDest'] != $unidadeDestino && $b['unidadeDest'] == $unidadeDestino) return 1;
        return 0;
    });

    $ctesSelecionados = [];
    $pesoTotal = 0;
    $cubagemTotal = 0;

    foreach ($ctes as $cte) {
        if ($pesoTotal + $cte['peso'] <= $pesoMax && $cubagemTotal + $cte['cubagem'] <= $cubagemMax) {
            $ctesSelecionados[] = $cte['ctrc'];
            $pesoTotal += $cte['peso'];
            $cubagemTotal += $cte['cubagem'];
        }
    }

    $placaEsc = pg_escape_string($g_sql, $placa);
    $loginEsc = pg_escape_string($g_sql, $user['username']);
    $unidadeEsc = pg_escape_string($g_sql, $sigla);
    $tabela = "{$domain}_carregamento";

    $check = pg_query($g_sql, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' LIMIT 1");
    if (pg_num_rows($check) > 0) {
        throw new Exception('Já existe um carregamento com esta placa para sua unidade.');
    }

    pg_query($g_sql, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao) VALUES ('{$unidadeEsc}', 0, '{$placaEsc}', '{$loginEsc}')");

    $values = [];
    foreach ($ctesSelecionados as $ctrc) {
        $seqCte = intval(substr($ctrc, 3, 6));
        $values[] = "('{$unidadeEsc}', {$seqCte}, '{$placaEsc}', '{$loginEsc}')";
    }

    if (!empty($values)) {
        pg_query($g_sql, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao) VALUES " . implode(',', $values));
    }

    respondJson(['success' => true, 'message' => count($ctesSelecionados) . ' CT-es adicionados ao novo carregamento ' . $placa]);

} catch (Exception $e) {
    error_log('❌ [carregamento_automatico.php] ' . $e->getMessage());
    respondJson(['success' => false, 'error' => $e->getMessage()], 500);
}
