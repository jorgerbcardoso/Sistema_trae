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

$input          = getRequestInput();
$acao           = strtolower(trim($input['acao'] ?? ''));
$placa          = strtoupper(trim($input['placa'] ?? ''));
$unidadeDestino = strtoupper(trim($input['unidadeDestino'] ?? ''));
$paradas        = array_values(array_filter(array_map('strtoupper', array_map('trim', (array)($input['paradas'] ?? [])))));
$nroLinha       = (int)($input['nroLinha'] ?? 0);
$ctesDisponiveis = $input['ctesDisponiveis'] ?? [];   // array de objetos enviados pelo frontend

$conn        = connect();
$tabela      = "{$domain}_carregamento";
$tabelaLinha = "{$domain}_linha";
$tabelaVeiculo = "{$domain}_veiculo";
$tabelaCap   = "{$domain}_carregamento_capacidade";

$modoAutomatico = empty($placa) && empty($unidadeDestino);

// ─── Listar linhas ────────────────────────────────────────────────────────────
if ($acao === 'listar_linhas') {
    try {
        $res = sql(
            "SELECT nro_linha, nome, sigla_emit, sigla_dest, unidades, km_ida, km_volta
             FROM {$tabelaLinha}
             WHERE sigla_emit = \$1
             ORDER BY sigla_dest, nome, nro_linha",
            [$unidade], $conn
        );
        $linhas = [];
        while ($res && ($r = pg_fetch_assoc($res))) {
            $linhas[] = [
                'nro_linha'  => (int)($r['nro_linha'] ?? 0),
                'nome'       => (string)($r['nome'] ?? ''),
                'sigla_emit' => strtoupper(trim((string)($r['sigla_emit'] ?? ''))),
                'sigla_dest' => strtoupper(trim((string)($r['sigla_dest'] ?? ''))),
                'unidades'   => (string)($r['unidades'] ?? ''),
                'km_ida'     => $r['km_ida']   !== null ? (int)$r['km_ida']   : null,
                'km_volta'   => $r['km_volta'] !== null ? (int)$r['km_volta'] : null,
            ];
        }
        respondJson(['success' => true, 'linhas' => $linhas]);
    } catch (Exception $e) {
        respondJson(['success' => false, 'message' => 'Erro ao listar linhas.']);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function getCapacidadeVeiculo($conn, $tabelaVeiculo, $placa) {
    $capPesoKg = 27000.0;
    $capVolM3  = 67.0;
    if (empty($placa) || strpos($placa, '-') !== false) return [$capPesoKg, $capVolM3];
    try {
        $res = sql(
            "SELECT capacidade_ton, capacidade_m3 FROM {$tabelaVeiculo} WHERE UPPER(placa) = UPPER(\$1) LIMIT 1",
            [$placa], $conn
        );
        if ($res && pg_num_rows($res) > 0) {
            $row = pg_fetch_assoc($res);
            $ton = parseNumero($row['capacidade_ton'] ?? null);
            $m3  = parseNumero($row['capacidade_m3']  ?? null);
            if ($ton > 0) $capPesoKg = $ton * 1000.0;
            if ($m3  > 0) $capVolM3  = $m3;
        }
    } catch (Exception $e) {}
    return [$capPesoKg, $capVolM3];
}

function gerarResumos($conn, $tabela, $placa, $unidade) {
    $resumoUnidades = [];
    $resumoDestinos = [];
    try {
        $res = sql(
            "SELECT destino_cte AS unid, COUNT(*) AS qtd,
                    COALESCE(SUM(peso_cte), 0) AS peso_total,
                    COALESCE(SUM(cubagem_cte), 0) AS cub_total
             FROM {$tabela}
             WHERE unidade = \$1 AND placa_provisoria = \$2 AND nro_cte > 0
             GROUP BY destino_cte ORDER BY qtd DESC",
            [$unidade, $placa], $conn
        );
        while ($res && ($r = pg_fetch_assoc($res))) {
            $resumoDestinos[] = [
                'unidade' => strtoupper(trim($r['unid'] ?? '')),
                'qtd'     => (int)$r['qtd'],
                'peso_kg' => round((float)$r['peso_total'], 2),
                'cubagem' => round((float)$r['cub_total'], 3),
            ];
        }
    } catch (Exception $e) {}

    $totalQtd  = array_sum(array_column($resumoDestinos, 'qtd'));
    $totalPeso = array_sum(array_column($resumoDestinos, 'peso_kg'));
    $totalCub  = array_sum(array_column($resumoDestinos, 'cubagem'));
    if ($totalQtd > 0) {
        $resumoUnidades[] = [
            'unidade' => strtoupper($unidade),
            'qtd'     => $totalQtd,
            'peso_kg' => round($totalPeso, 2),
            'cubagem' => round($totalCub, 3),
        ];
    }
    return [$resumoUnidades, $resumoDestinos];
}

/**
 * Filtra CT-es disponíveis (vindos do frontend) para os destinos informados,
 * respeitando a capacidade do veículo.
 * Retorna array de objetos CT-e prontos para inserção.
 */
function filtrarCtesPorCapacidade($ctesDisponiveis, $destinos, $unidade, $limitePesoKg, $limiteVolM3) {
    // Ordena por prevEnt ASC, depois nroCte ASC
    usort($ctesDisponiveis, function($a, $b) {
        $pa = $a['prevEnt'] ?? '';
        $pb = $b['prevEnt'] ?? '';
        if ($pa !== $pb) return strcmp($pa, $pb);
        return (int)($a['nroCte'] ?? 0) - (int)($b['nroCte'] ?? 0);
    });

    $selecionados = [];
    $somaPeso     = 0.0;
    $somaVol      = 0.0;

    foreach ($ctesDisponiveis as $cte) {
        $nroCte      = (int)($cte['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        $unidDest    = strtoupper(trim($cte['unidadeDest'] ?? ''));
        $unidOrigem  = strtoupper(trim($cte['unidadeOrigem'] ?? ''));

        // Inclui se destino está na lista OU se é da própria unidade de origem
        $pertence = in_array($unidDest, $destinos, true) || $unidOrigem === $unidade;
        if (!$pertence) continue;

        $peso = parseNumero($cte['peso']    ?? 0);
        $cub  = parseNumero($cte['cubagem'] ?? 0);

        if ($somaPeso + $peso > $limitePesoKg || $somaVol + $cub > $limiteVolM3) break;

        $somaPeso += $peso;
        $somaVol  += $cub;
        $selecionados[] = $cte;
    }

    return $selecionados;
}

/**
 * Insere CT-es na tabela de carregamento com destino e unidades em cada linha.
 */
function inserirCtes($conn, $tabela, $unidade, $placa, $login, $destino, $unidades, $ctesSelecionados) {
    $inseridos = 0;
    foreach ($ctesSelecionados as $cteData) {
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

        $serCte   = pg_escape_string($conn, strtoupper(trim($cteData['serCte']      ?? '')));
        $destCte  = pg_escape_string($conn, strtoupper(trim($cteData['unidadeDest'] ?? '')));
        $emissao  = trim($cteData['emissao'] ?? '');
        $prevEnt  = trim($cteData['prevEnt'] ?? '');
        $remet    = pg_escape_string($conn, $cteData['remetente']    ?? '');
        $destin   = pg_escape_string($conn, $cteData['destinatario'] ?? '');
        $pagad    = pg_escape_string($conn, $cteData['pagador']      ?? '');
        $cidade   = pg_escape_string($conn, $cteData['cidade']       ?? '');
        $destEsc  = pg_escape_string($conn, $destino);
        $unidEsc  = pg_escape_string($conn, $unidades);

        $vlrMerc  = parseNumero($cteData['vlrNf']    ?? 0);
        $vlrFrete = parseNumero($cteData['frete']    ?? 0);
        $peso     = parseNumero($cteData['peso']     ?? 0);
        $cubagem  = parseNumero($cteData['cubagem']  ?? 0);
        $qtdeVol  = (int)($cteData['qtdeVol'] ?? 0);

        // Converte datas DD/MM/YYYY → formato PostgreSQL
        $emissaoSql = '';
        $prevEntSql = '';
        if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $emissao)) {
            $parts = explode('/', $emissao);
            $emissaoSql = "'" . $parts[2] . '-' . $parts[1] . '-' . $parts[0] . "'";
        } else {
            $emissaoSql = 'NULL';
        }
        if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $prevEnt)) {
            $parts = explode('/', $prevEnt);
            $prevEntSql = "'" . $parts[2] . '-' . $parts[1] . '-' . $parts[0] . "'";
        } else {
            $prevEntSql = 'NULL';
        }

        $res = pg_query($conn,
            "INSERT INTO {$tabela}
             (unidade, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
              remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
              vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
              destino, unidades)
             VALUES
             ('" . pg_escape_string($conn, $unidade) . "', '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
              '{$serCte}', {$nroCte}, '{$destCte}', {$emissaoSql}, {$prevEntSql},
              '{$remet}', '{$destin}', '{$pagad}', '{$cidade}',
              {$vlrMerc}, {$vlrFrete}, {$peso}, {$cubagem}, {$qtdeVol},
              '{$destEsc}', '{$unidEsc}')"
        );

        if (!$res) {
            return -1; // sinaliza erro
        }
        $inseridos++;
    }
    return $inseridos;
}

// ─── Modo automático por linha ────────────────────────────────────────────────
if ($modoAutomatico) {
    if ($nroLinha <= 0) {
        respondJson(['success' => false, 'message' => 'Linha não informada.']);
    }

    $resLinha = null;
    try {
        $resLinha = sql(
            "SELECT sigla_dest, unidades FROM {$tabelaLinha} WHERE sigla_emit = \$1 AND nro_linha = \$2 LIMIT 1",
            [$unidade, $nroLinha], $conn
        );
    } catch (Exception $e) {}

    if (!$resLinha || pg_num_rows($resLinha) === 0) {
        respondJson(['success' => false, 'message' => 'Linha não encontrada para a unidade atual.']);
    }

    $linha    = pg_fetch_assoc($resLinha);
    $dest     = strtoupper(trim($linha['sigla_dest'] ?? ''));
    if ($dest === '') {
        respondJson(['success' => false, 'message' => 'Linha inválida: destino não informado.']);
    }

    $paradasLinha         = array_values(array_filter(array_map('strtoupper', array_map('trim', explode(',', $linha['unidades'] ?? '')))));
    $destinosCarregamento = array_values(array_unique(array_filter(array_merge($paradasLinha, [$dest]))));
    $placaAuto            = $unidade . '-' . $dest;
    $paradasCsv           = implode(',', $paradasLinha);

    $check = sql("SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 LIMIT 1", [$unidade, $placaAuto], $conn);
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => true, 'message' => "Carregamento {$placaAuto} já existe.", 'resultados' => [['placa' => $placaAuto, 'status' => 'ignorado', 'msg' => 'Carregamento já existe.']]]);
    }

    if (empty($ctesDisponiveis)) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível enviado pelo painel. Recarregue os dados e tente novamente.']);
    }

    list($limitePeso, $limiteVol) = getCapacidadeVeiculo($conn, $tabelaVeiculo, $placaAuto);
    $ctesSelecionados = filtrarCtesPorCapacidade($ctesDisponiveis, $destinosCarregamento, $unidade, $limitePeso, $limiteVol);

    if (empty($ctesSelecionados)) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível para os destinos desta linha.']);
    }

    pg_query($conn, 'BEGIN');

    $inseridos = inserirCtes($conn, $tabela, $unidade, $placaAuto, $login, $dest, $paradasCsv, $ctesSelecionados);
    if ($inseridos < 0) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao inserir CT-es: ' . pg_last_error($conn)]);
    }

    pg_query($conn, 'COMMIT');

    [$resumoUnidades, $resumoDestinos] = gerarResumos($conn, $tabela, $placaAuto, $unidade);

    respondJson([
        'success'         => true,
        'message'         => "{$inseridos} CT-e(s) adicionados ao carregamento {$placaAuto}.",
        'resultados'      => [['placa' => $placaAuto, 'status' => 'criado', 'msg' => "{$inseridos} CT-e(s) adicionados."]],
        'placa'           => $placaAuto,
        'resumo_unidades' => $resumoUnidades,
        'resumo_destinos' => $resumoDestinos,
    ]);
}

// ─── Modo informado (destino manual) ─────────────────────────────────────────
if (empty($unidadeDestino)) {
    respondJson(['success' => false, 'message' => 'Unidade de destino não informada.']);
}

$placaFinal = !empty($placa) ? $placa : ($unidade . '-' . $unidadeDestino);
$paradasCsv = implode(',', $paradas);

$check = sql("SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 LIMIT 1", [$unidade, $placaFinal], $conn);
if ($check && pg_num_rows($check) > 0) {
    respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaFinal}."]);
}

if (empty($ctesDisponiveis)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível enviado pelo painel. Recarregue os dados e tente novamente.']);
}

list($limitePeso, $limiteVol) = getCapacidadeVeiculo($conn, $tabelaVeiculo, $placaFinal);
$destinosManual   = array_values(array_unique(array_filter(array_merge($paradas, [$unidadeDestino]))));
$ctesSelecionados = filtrarCtesPorCapacidade($ctesDisponiveis, $destinosManual, $unidade, $limitePeso, $limiteVol);

if (empty($ctesSelecionados)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível para os destinos informados.']);
}

pg_query($conn, 'BEGIN');

$inseridos = inserirCtes($conn, $tabela, $unidade, $placaFinal, $login, $unidadeDestino, $paradasCsv, $ctesSelecionados);
if ($inseridos < 0) {
    pg_query($conn, 'ROLLBACK');
    respondJson(['success' => false, 'message' => 'Erro ao inserir CT-es: ' . pg_last_error($conn)]);
}

pg_query($conn, 'COMMIT');

[$resumoUnidades, $resumoDestinos] = gerarResumos($conn, $tabela, $placaFinal, $unidade);

respondJson([
    'success'         => true,
    'message'         => "{$inseridos} CT-e(s) adicionados ao carregamento {$placaFinal}.",
    'placa'           => $placaFinal,
    'resumo_unidades' => $resumoUnidades,
    'resumo_destinos' => $resumoDestinos,
]);
