<?php
/**
 * ================================================================
 * SCRIPT: IMPORTAÇÃO DE CARREGAMENTOS EM PROCESSO (SSW0194) - BATCH
 * ================================================================
 * Objetivo:
 * - Importar automaticamente os carregamentos que estão sendo bipados
 *   no SSW (ssw0194) para o banco Presto, sem depender da tela do painel.
 * - Roda em todas as unidades que efetuam carregamento
 *   ([dominio]_unidade.efetua_carregamento = true).
 * - Reaproveita carregamentos abertos (mesma placa) ou cria novos.
 * - Finaliza carregamentos cuja saída já foi registrada no ssw0125 (PER).
 *
 * Escopo:
 * - Apenas transferências (tp_carregamento = 'T').
 * - Ignora carregamentos simulados.
 * - CT-es já existentes em outro carregamento ABERTO são preservados lá
 *   (sem conflito interativo; apenas registra em log).
 *
 * Execução via crontab (a cada 10 minutos):
 *   *[barra]10 * * * * php /var/www/html/src/imp_carregamentos_ssw.php >> /var/www/html/tmp/imp_carregamentos_ssw.log 2>&1
 *
 * Argumentos:
 *   $argv[1] (opcional) = DOMINIO (ex.: RVE). Se omitido, roda em todos os domínios ativos.
 *   $argv[2] (opcional) = UNIDADE (ex.: SSA). Se omitido, roda em todas as unidades com efetua_carregamento.
 * ================================================================
 */

if (php_sapi_name() !== 'cli') {
    header('HTTP/1.1 403 Forbidden');
    exit('Acesso restrito a CLI.');
}

require_once '/var/www/html/lib/presto.php';
require_once '/var/www/html/lib/ssw.php';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function echo_hr_imp(): void {
    echo str_repeat('=', 78) . "\n";
}

function pg_table_exists_imp($conn, string $tableName): bool {
    $t = strtolower(trim($tableName));
    if ($t === '') return false;
    $res = @pg_query_params($conn, "SELECT to_regclass($1) AS reg", [$t]);
    if (!$res || @pg_num_rows($res) === 0) return false;
    $val = @pg_fetch_result($res, 0, 0);
    return $val !== null && $val !== false && $val !== '';
}

function pg_col_exists_imp($conn, string $table, string $col): bool {
    $t = strtolower(trim($table));
    $c = strtolower(trim($col));
    if ($t === '' || $c === '') return false;
    $res = @pg_query_params(
        $conn,
        "SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND lower(table_name) = $1 AND lower(column_name) = $2
         LIMIT 1",
        [$t, $c]
    );
    return ($res && @pg_num_rows($res) > 0);
}

function normalizar_placa_imp(string $placa): string {
    $p = preg_replace('/[^A-Z0-9]/', '', strtoupper(trim((string)$placa)));
    return $p === null ? '' : $p;
}

function chave_match_imp(string $placa, string $dominio): string {
    $limpa = normalizar_placa_imp($placa);
    if ($limpa === '') return '';
    if (strtoupper($dominio) === 'RVE' && preg_match('/^[A-Z0-9]{3}[A-Z0-9]{4}$/', $limpa)) {
        return substr($limpa, 3, 4);
    }
    return $limpa;
}

function extrair_xml_imp($html): ?string {
    $html = (string)$html;
    if ($html === '') return null;
    $inicio = strpos($html, '<?xml');
    if ($inicio === false) $inicio = strpos($html, '<xml');
    if ($inicio === false) {
        $dec = @urldecode($html);
        if ($dec && $dec !== $html) {
            $inicio = strpos($dec, '<?xml');
            if ($inicio === false) $inicio = strpos($dec, '<xml');
            if ($inicio !== false) $html = $dec;
        }
    }
    if ($inicio === false) return null;
    $fim = strrpos($html, '</xml>');
    $tagFim = '</xml>';
    if ($fim === false) {
        $fim = strrpos($html, '</data>');
        $tagFim = '</data>';
    }
    if ($fim === false) return null;
    return substr($html, $inicio, ($fim + strlen($tagFim)) - $inicio);
}

function normalizar_numero_imp($v): float {
    $s = trim((string)$v);
    if ($s === '') return 0.0;
    $s = preg_replace('/[^0-9,\\.]/', '', $s);
    if ($s === '' || $s === null) return 0.0;
    if (strpos($s, ',') !== false) {
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
        return (float)$s;
    }
    if (preg_match('/^\\d{1,3}(\\.\\d{3})+$/', $s)) {
        $s = str_replace('.', '', $s);
    }
    return (float)$s;
}

function parse_unidades_csv_imp($csv): array {
    $csv = strtoupper(trim((string)$csv));
    if ($csv === '') return [];
    $parts = preg_split('/[,\s;]+/', $csv);
    if (!is_array($parts)) return [];
    $out = [];
    $seen = [];
    foreach ($parts as $p) {
        $u = strtoupper(trim((string)$p));
        if ($u === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $u)) continue;
        if (isset($seen[$u])) continue;
        $seen[$u] = true;
        $out[] = $u;
    }
    return $out;
}

function ordered_unique_imp($arr): array {
    if (!is_array($arr)) return [];
    $seen = [];
    $out = [];
    foreach ($arr as $v) {
        $u = strtoupper(trim((string)$v));
        if ($u === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $u)) continue;
        if (isset($seen[$u])) continue;
        $seen[$u] = true;
        $out[] = $u;
    }
    return $out;
}

/**
 * Encontra a linha (nro_linha) que melhor casa com a lista de destinos.
 */
function encontrar_linha_imp(array $linhas, array $destinosRaw): ?array {
    if (count($linhas) === 0) return null;
    $destinosOrder = ordered_unique_imp($destinosRaw);
    if (count($destinosOrder) === 0) return null;

    $best = null;
    $bestScore = null;
    foreach ($linhas as $l) {
        $nro = (int)($l['nro_linha'] ?? 0);
        if ($nro <= 0) continue;
        $dest = strtoupper(trim((string)($l['sigla_dest'] ?? '')));
        if ($dest === '') continue;
        $inter = parse_unidades_csv_imp((string)($l['unidades'] ?? ''));
        $route = array_merge($inter, [$dest]);
        $idx = [];
        for ($i = 0; $i < count($route); $i++) $idx[$route[$i]] = $i;

        $missing = 0;
        $orderPenalty = 0;
        $lastIdx = -1;
        foreach ($destinosOrder as $u) {
            if (!isset($idx[$u])) { $missing++; continue; }
            $cur = (int)$idx[$u];
            if ($lastIdx >= 0 && $cur < $lastIdx) $orderPenalty++;
            $lastIdx = $cur;
        }
        if ($missing > 0) continue;

        $extraStops = max(0, count($route) - count($destinosOrder));
        $score = ($missing * 1000) + ($orderPenalty * 100) + ($extraStops * 10);
        if ($bestScore === null || $score < $bestScore) {
            $bestScore = $score;
            $best = [
                'nro_linha' => $nro,
                'sigla_dest' => $dest,
                'unidades' => implode(',', $inter),
            ];
        }
    }
    return $best;
}

function proximo_seq_imp($conn, string $domain): int {
    $seqName = strtolower($domain) . '_seq_carregamento_seq';
    @pg_query($conn, "CREATE SEQUENCE IF NOT EXISTS {$seqName}");
    $res = @pg_query($conn, "SELECT nextval('" . pg_escape_string($conn, $seqName) . "') AS seq");
    if (!$res || @pg_num_rows($res) === 0) return 0;
    return (int)@pg_fetch_result($res, 0, 0);
}

/**
 * Obtém a data/hora da primeira bipagem de uma placa no ssw0194 (f12).
 */
function obter_primeira_captura_imp(string $placaSsw): ?array {
    $placaSsw = normalizar_placa_imp($placaSsw);
    if ($placaSsw === '') return null;
    $url = "https://tms.ssw.inf.br/bin/ssw0194?act=VER_BAR2&placa=" . rawurlencode($placaSsw);
    $html = ssw_go($url);
    $xmlStr = extrair_xml_imp($html);
    if ($xmlStr === null) return null;
    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) return null;
    $nodes = $xml->xpath('//r/f12');
    if (!$nodes || count($nodes) === 0) return null;
    $minDt = null;
    foreach ($nodes as $n) {
        $s = trim((string)$n);
        if ($s === '') continue;
        $dt = DateTime::createFromFormat('d/m/y H:i:s', $s);
        if ($dt === false) continue;
        if ($minDt === null || $dt->getTimestamp() < $minDt->getTimestamp()) $minDt = $dt;
    }
    if ($minDt === null) return null;
    return ['data' => $minDt->format('Y-m-d'), 'hora' => $minDt->format('H:i:s')];
}

/**
 * Lista as saídas do ssw0125 (PER) para uma unidade (ontem e hoje).
 * Retorna array de ['placa','data','hora','raw'].
 */
function listar_saidas_imp(string $siglaOrigem): array {
    $siglaOrigem = strtoupper(trim((string)$siglaOrigem));
    if ($siglaOrigem === '') return [];
    $ini = date('dmy', strtotime('-1 day'));
    $fim = date('dmy');
    $url = "https://tms.ssw.inf.br/bin/ssw0125?act=PER"
        . "&t_sigla_origem=" . rawurlencode($siglaOrigem)
        . "&t_data_saida_ini=" . rawurlencode($ini)
        . "&t_data_saida_fin=" . rawurlencode($fim);
    $html = ssw_go($url);
    $xmlStr = extrair_xml_imp($html);
    if ($xmlStr === null) return [];
    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) return [];
    $rows = $xml->xpath('//r');
    if (!$rows) return [];
    $out = [];
    foreach ($rows as $r) {
        $f3 = strtoupper(trim((string)($r->f3 ?? '')));
        $f2 = strtoupper(trim((string)($r->f2 ?? '')));
        $f11 = trim((string)($r->f11 ?? ''));
        $status = strtoupper(trim(strip_tags((string)($r->f17 ?? ''))));
        if ($f11 === '' || strpos($status, 'CANCELADO') !== false) continue;
        $dt = DateTime::createFromFormat('d/m/y H:i', $f11);
        if (!$dt) continue;
        foreach (array_unique(array_filter([$f2, $f3])) as $placa) {
            $out[$placa . '|' . $dt->getTimestamp()] = [
                'placa' => $placa,
                'data' => $dt->format('Y-m-d'),
                'hora' => $dt->format('H:i:s'),
                'raw' => $f11,
            ];
        }
    }
    $out = array_values($out);
    usort($out, function ($a, $b) {
        $aTs = strtotime(($a['data'] ?? '') . ' ' . ($a['hora'] ?? '')) ?: 0;
        $bTs = strtotime(($b['data'] ?? '') . ' ' . ($b['hora'] ?? '')) ?: 0;
        return $aTs <=> $bTs;
    });
    return $out;
}

/**
 * Faz o parse do relatório do ssw0424 (texto) em CT-es agrupados por placa.
 */
function parse_relatorio_imp($texto): array {
    if (!is_string($texto) || $texto === '') return [];
    $texto = @mb_convert_encoding($texto, 'UTF-8', 'ISO-8859-1');
    $texto = str_replace("\x0C", "\n", (string)$texto);
    $texto = str_replace("\r\n", "\n", str_replace("\r", "\n", $texto));
    $linhas = explode("\n", $texto);

    $porPlaca = [];
    $placaAtual = null;
    $anoBase = (int)date('Y');
    $mesBase = (int)date('m');

    $larguras = [12,5,5,10,12,5,6,5,5,20,20,20,14,3,14,11,7,6,2];
    $separador = '------------+-----+-----+----------+------------+-----+------+-----+-----+--------------------+--------------------+--------------------+--------------+---+--------------+-----------+-------+------+--';

    $parseBr = function (string $s): float {
        $s = trim($s);
        if ($s === '') return 0.0;
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
        $v = @(float)$s;
        return is_finite($v) ? $v : 0.0;
    };

    foreach ($linhas as $linha) {
        $linha = rtrim($linha, "\n");
        if (trim($linha) === '') continue;
        if (preg_match('/PLACA:\\s*([A-Z0-9-]+)/', $linha, $m)) {
            $placaAtual = normalizar_placa_imp($m[1]);
            if ($placaAtual !== '' && !isset($porPlaca[$placaAtual])) {
                $porPlaca[$placaAtual] = ['ctes' => [], 'destinos' => []];
            }
            if (preg_match('/(\\d{2})\\/(\\d{2})\\/(\\d{4})/', $linha, $d)) {
                $mesBase = (int)$d[2];
                $anoBase = (int)$d[3];
            }
            continue;
        }
        if ($placaAtual === null || !isset($porPlaca[$placaAtual])) continue;

        $linhaTrim = ltrim($linha);
        if (strpos($linhaTrim, $separador) !== false) continue;
        if (preg_match('/^TOTAIS:/', $linhaTrim) || preg_match('/^TOTAL GERAL/', $linhaTrim)) continue;
        if (!preg_match('/^([A-Z0-9]{3}\\d{6,7}-\\d{1,2})\\b/', $linhaTrim, $mC)) continue;

        $ctrcRaw = strtoupper(trim((string)$mC[1]));
        $emiss = $prevEnt = $qVol = $remet = $pagador = $destin = $locEnt = $uni = $merc = $frete = $kg = $m3 = '';

        $offset = 0;
        $cols = [];
        foreach ($larguras as $w) {
            $cols[] = rtrim(substr($linhaTrim, $offset, $w));
            $offset += $w + 1;
        }
        $emiss   = trim($cols[1] ?? '');
        $prevEnt = trim($cols[2] ?? '');
        $qVol    = trim($cols[6] ?? '');
        $remet   = trim($cols[9] ?? '');
        $pagador = trim($cols[10] ?? '');
        $destin  = trim($cols[11] ?? '');
        $locEnt  = trim($cols[12] ?? '');
        $uni     = strtoupper(trim($cols[13] ?? ''));
        $merc    = trim($cols[14] ?? '');
        $frete   = trim($cols[15] ?? '');
        $kg      = trim($cols[16] ?? '');
        $m3      = trim($cols[17] ?? '');

        if ($uni === '' || !preg_match('/^\\d{2}\\/\\d{2}$/', $emiss) || !preg_match('/^\\d{2}\\/\\d{2}$/', $prevEnt)) {
            $parts = preg_split('/\\s{2,}/', rtrim($linhaTrim));
            if (is_array($parts) && count($parts) >= 8) {
                $p1 = trim((string)($parts[1] ?? ''));
                $p2 = trim((string)($parts[2] ?? ''));
                if (!preg_match('/^\\d{2}\\/\\d{2}$/', $p1) && preg_match('/^(\\d{2}\\/\\d{2})\\s+(\\d{2}\\/\\d{2})$/', $p1, $mD)) {
                    $p2 = $mD[2];
                    $p1 = $mD[1];
                }
                if (preg_match('/^\\d{2}\\/\\d{2}$/', $p1)) $emiss = $p1;
                if (preg_match('/^\\d{2}\\/\\d{2}$/', $p2)) $prevEnt = $p2;
                $n = count($parts);
                $remet   = trim((string)($parts[$n - 10] ?? $remet));
                $pagador = trim((string)($parts[$n - 9] ?? $pagador));
                $destin  = trim((string)($parts[$n - 8] ?? $destin));
                $locEnt  = trim((string)($parts[$n - 7] ?? $locEnt));
                $uni     = strtoupper(trim((string)($parts[$n - 6] ?? $uni)));
                $merc    = trim((string)($parts[$n - 5] ?? $merc));
                $frete   = trim((string)($parts[$n - 4] ?? $frete));
                $kg      = trim((string)($parts[$n - 3] ?? $kg));
                $m3      = trim((string)($parts[$n - 2] ?? $m3));
                if ($n >= 14) {
                    $cand = trim((string)($parts[5] ?? ''));
                    if (preg_match('/^\\d+$/', $cand)) $qVol = $cand;
                }
            }
        }

        if (!preg_match('/^([A-Z0-9]{3})(\\d{6,7})-\\d{1,2}$/', $ctrcRaw, $mN)) continue;
        $ser = strtoupper($mN[1]);
        $nro = (int)$mN[2];
        if ($ser === '' || $nro <= 0) continue;

        $emissaoFull = null;
        if (preg_match('/^(\\d{2})\\/(\\d{2})$/', $emiss, $dm)) {
            $emissaoFull = sprintf('%02d/%02d/%04d', (int)$dm[1], (int)$dm[2], $anoBase);
        }
        $prevEntFull = null;
        if (preg_match('/^(\\d{2})\\/(\\d{2})$/', $prevEnt, $dm)) {
            $ano = $anoBase;
            $mes = (int)$dm[2];
            if ($mesBase >= 11 && $mes <= 2) $ano = $anoBase + 1;
            $prevEntFull = sprintf('%02d/%02d/%04d', (int)$dm[1], $mes, $ano);
        }

        if ($uni !== '') $porPlaca[$placaAtual]['destinos'][] = $uni;
        $porPlaca[$placaAtual]['ctes'][] = [
            'ser_cte'      => $ser,
            'nro_cte'      => $nro,
            'destino_cte'  => $uni,
            'emissao'      => $emissaoFull,
            'prev_ent'     => $prevEntFull,
            'remetente'    => $remet,
            'pagador'      => $pagador,
            'destinatario' => $destin,
            'cidade'       => $locEnt,
            'qtde_vol'     => (int)preg_replace('/\\D/', '', $qVol),
            'vlr_merc'     => $parseBr($merc),
            'vlr_frete'    => $parseBr($frete),
            'peso'         => $parseBr($kg),
            'cubagem'      => $parseBr($m3),
        ];
    }
    return $porPlaca;
}

// ----------------------------------------------------------------------------
// Início da execução
// ----------------------------------------------------------------------------

$dominioFiltro = strtoupper(trim((string)($argv[1] ?? '')));
$unidadeFiltro = strtoupper(trim((string)($argv[2] ?? '')));

echo_hr_imp();
echo "IMPORTAÇÃO DE CARREGAMENTOS EM PROCESSO (SSW0194) - BATCH\n";
echo_hr_imp();
echo "Data/Hora: " . date('d/m/Y H:i:s') . "\n";
echo "Domínio:   " . ($dominioFiltro !== '' ? $dominioFiltro : 'TODOS') . "\n";
echo "Unidade:   " . ($unidadeFiltro !== '' ? $unidadeFiltro : 'TODAS (efetua_carregamento = true)') . "\n";
echo_hr_imp();
echo "\n";

$g_sql = connect();
if (!$g_sql) {
    echo "❌ ERRO: não foi possível conectar no PostgreSQL.\n";
    exit(1);
}

$qDomains = "SELECT domain FROM domains WHERE domain NOT IN ('XXX','EVI') AND is_active = true";
if ($dominioFiltro !== '') {
    $qDomains .= " AND domain = '" . pg_escape_string($g_sql, $dominioFiltro) . "'";
}
$resDomains = @pg_query($g_sql, $qDomains);
if (!$resDomains) {
    echo "❌ ERRO: falha ao ler tabela domains.\n";
    exit(1);
}

$loginScript = 'sistema';
$totalCriados = 0;
$totalAtualizados = 0;
$totalCtes = 0;
$totalFinalizados = 0;

while ($rowD = pg_fetch_assoc($resDomains)) {
    $domain = strtoupper(trim((string)($rowD['domain'] ?? '')));
    if ($domain === '') continue;

    echo_hr_imp();
    echo "DOMÍNIO {$domain}\n";
    echo_hr_imp();

    $tblCar = strtolower($domain) . '_carregamento';
    $tblCap = strtolower($domain) . '_carregamento_capacidade';
    $tblLinha = strtolower($domain) . '_linha';
    $tblVeic = strtolower($domain) . '_veiculo';

    $tblUnidade = '';
    foreach ([strtolower($domain) . '_unidade', strtolower($domain) . '_unidades'] as $t) {
        if (pg_table_exists_imp($g_sql, $t)) { $tblUnidade = $t; break; }
    }
    if ($tblUnidade === '') {
        echo "⚠️  Tabela de unidade não encontrada. Pulando domínio.\n\n";
        continue;
    }
    if (!pg_table_exists_imp($g_sql, $tblCar) || !pg_table_exists_imp($g_sql, $tblCap)) {
        echo "⚠️  Tabelas {$tblCar}/{$tblCap} não encontradas. Pulando domínio.\n\n";
        continue;
    }

    // Garante colunas usadas pelo script.
    @pg_query($g_sql, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS origem_criacao VARCHAR(20)");
    @pg_query($g_sql, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS origem_ssw VARCHAR(20)");
    @pg_query($g_sql, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS data_finalizacao DATE");
    @pg_query($g_sql, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS hora_finalizacao TIME");
    @pg_query($g_sql, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS login_finalizacao VARCHAR(60)");
    @pg_query($g_sql, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS simulado BOOLEAN DEFAULT FALSE");
    @pg_query($g_sql, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS tp_carregamento VARCHAR(1)");

    // Autentica no SSW para o domínio.
    try {
        ssw_login($domain);
    } catch (Exception $e) {
        echo "❌ Falha ao autenticar no SSW ({$domain}). Pulando domínio.\n\n";
        continue;
    }

    // Unidades que efetuam carregamento.
    $temColEfetua = pg_col_exists_imp($g_sql, $tblUnidade, 'efetua_carregamento');
    $qUnid = "SELECT UPPER(TRIM(sigla)) AS sigla
              FROM {$tblUnidade}
              WHERE COALESCE(TRIM(sigla), '') <> ''";
    if ($temColEfetua) {
        $qUnid .= " AND COALESCE(efetua_carregamento, FALSE) = TRUE";
    }
    if ($unidadeFiltro !== '') {
        $qUnid .= " AND UPPER(TRIM(sigla)) = '" . pg_escape_string($g_sql, $unidadeFiltro) . "'";
    }
    $resUnid = @pg_query($g_sql, $qUnid);
    if (!$resUnid || @pg_num_rows($resUnid) === 0) {
        if ($unidadeFiltro !== '') {
            echo "ℹ️  Nenhuma unidade '{$unidadeFiltro}'"
                . ($temColEfetua ? " com efetua_carregamento = true" : "")
                . " encontrada. Verifique se a sigla está correta (2º argumento = UNIDADE, não data).\n\n";
        } else {
            echo "ℹ️  Nenhuma unidade" . ($temColEfetua ? " com efetua_carregamento = true" : "") . " encontrada.\n\n";
        }
        continue;
    }

    $unidades = [];
    while ($ru = pg_fetch_assoc($resUnid)) {
        $u = strtoupper(trim((string)($ru['sigla'] ?? '')));
        if ($u !== '') $unidades[] = $u;
    }
    $unidades = array_values(array_unique($unidades));

    // Linhas da origem (para determinar nro_linha/destino).
    $linhasPorUnidade = [];
    if (pg_table_exists_imp($g_sql, $tblLinha)) {
        $resLinhas = @pg_query($g_sql,
            "SELECT UPPER(sigla_emit) AS sigla_emit, nro_linha, UPPER(sigla_dest) AS sigla_dest, COALESCE(unidades,'') AS unidades
             FROM {$tblLinha}"
        );
        while ($resLinhas && ($rl = pg_fetch_assoc($resLinhas))) {
            $emit = strtoupper(trim((string)($rl['sigla_emit'] ?? '')));
            if ($emit === '') continue;
            if (!isset($linhasPorUnidade[$emit])) $linhasPorUnidade[$emit] = [];
            $linhasPorUnidade[$emit][] = $rl;
        }
    }

    foreach ($unidades as $unidade) {
        echo "🔎 Unidade {$unidade}:\n";
        $unidadeEsc = pg_escape_string($g_sql, $unidade);

        try {
            // Troca para a unidade no SSW.
            ssw_go("https://tms.ssw.inf.br/bin/menu01?act=TRO&f2={$unidade}&f3=101");

            // 1) Lista de placas sendo carregadas (PREP_IMP).
            $htmlPlacas = ssw_go("https://tms.ssw.inf.br/bin/ssw0194?act=PREP_IMP&prioritario=N&restrito=");
            $xmlStr = extrair_xml_imp($htmlPlacas);
            if ($xmlStr === null) {
                echo "   ⚠️  Sem XML no retorno do PREP_IMP. Pulando unidade.\n";
                continue;
            }
            $xml = @simplexml_load_string($xmlStr);
            if ($xml === false) {
                echo "   ⚠️  XML inválido no PREP_IMP. Pulando unidade.\n";
                continue;
            }

            $placasSsw = [];
            foreach ($xml->xpath('//r') as $r) {
                $placa = normalizar_placa_imp((string)($r->f0 ?? ''));
                if ($placa === '') $placa = normalizar_placa_imp((string)($r->f8 ?? ''));
                if ($placa !== '') $placasSsw[] = $placa;
            }
            // Fallback: tenta extrair placas de tags f8 ou do texto.
            if (empty($placasSsw)) {
                foreach ($xml->xpath('//f8') as $f8) {
                    $p = normalizar_placa_imp((string)$f8);
                    if ($p !== '') $placasSsw[] = $p;
                }
                if (preg_match_all("/SR_IMP\\|([A-Z]{3}[A-Z0-9]{4})/i", $xmlStr, $mP)) {
                    foreach (($mP[1] ?? []) as $p) {
                        $p = normalizar_placa_imp($p);
                        if ($p !== '') $placasSsw[] = $p;
                    }
                }
            }
            $placasSsw = array_values(array_unique($placasSsw));
            echo "   - Placas em bipagem: " . count($placasSsw) . "\n";
            if (empty($placasSsw)) {
                echo "   ✅ Nada a importar.\n\n";
                continue;
            }

            // 2) Baixa o relatório (SR_IMP) em lotes de 25 e parseia CT-es por placa.
            $carregamentos = [];
            $tamanhoLote = 25;
            for ($i = 0; $i < count($placasSsw); $i += $tamanhoLote) {
                $chunk = array_slice($placasSsw, $i, $tamanhoLote);
                if (empty($chunk)) continue;
                $act = 'SR_IMP|' . implode('|', array_map('rawurlencode', $chunk));
                $strRetorno = ssw_go("https://tms.ssw.inf.br/bin/ssw0194?act={$act}");
                $strDec = urldecode($strRetorno);
                $actDownload = ssw_get_act($strDec);
                $arqDownload = ssw_get_arq($strDec);
                if ((empty($actDownload) || empty($arqDownload))
                    && preg_match("/abrir\\s*\\(\\s*'([^']+\\.sswweb)'\\s*,\\s*'([^']+\\.sswweb)'/i", $strDec, $mAbrir)) {
                    $actDownload = trim((string)($mAbrir[1] ?? ''));
                    $arqDownload = trim((string)($mAbrir[2] ?? ''));
                }
                if (empty($actDownload) || empty($arqDownload)) continue;

                $relatorio = ssw_go("https://tms.ssw.inf.br/bin/ssw0424?act={$actDownload}&filename={$arqDownload}&path=&down=1&nw=0");
                if (empty($relatorio) || strlen($relatorio) < 50) continue;

                $parsed = parse_relatorio_imp($relatorio);
                foreach ($parsed as $placa => $data) {
                    $pk = normalizar_placa_imp($placa);
                    if ($pk === '') continue;
                    if (!isset($carregamentos[$pk])) $carregamentos[$pk] = ['ctes' => [], 'destinos' => []];
                    $carregamentos[$pk]['ctes'] = array_merge($carregamentos[$pk]['ctes'], $data['ctes'] ?? []);
                    $carregamentos[$pk]['destinos'] = array_merge($carregamentos[$pk]['destinos'], $data['destinos'] ?? []);
                }
            }

            // 3) Para cada placa, cria/atualiza o carregamento no Presto.
            $placasProcessadas = array_values(array_unique(array_merge(
                $placasSsw,
                array_map('strval', array_keys($carregamentos))
            )));
            $criadosUnidade = 0;
            $atualizadosUnidade = 0;
            $ctesUnidade = 0;
            $isRve = (strtoupper($domain) === 'RVE');

            foreach ($placasProcessadas as $placa) {
                $placa = normalizar_placa_imp($placa);
                if ($placa === '') continue;

                $placaProvisoria = $placa;
                $sufixoRve = null;

                // RVE: resolve a placa real pelo sufixo.
                if ($isRve && preg_match('/^[A-Z0-9]{3}[A-Z0-9]{4}$/', $placa)) {
                    $sufixoRve = substr($placa, 3, 4);
                    if (pg_table_exists_imp($g_sql, $tblVeic) && $sufixoRve !== '') {
                        $resV = @pg_query_params($g_sql,
                            "SELECT placa FROM {$tblVeic}
                             WHERE RIGHT(UPPER(BTRIM(placa)), 4) = $1
                               AND UPPER(BTRIM(COALESCE(tipo,''))) <> 'CAVALO'
                             ORDER BY LENGTH(BTRIM(placa)) ASC, UPPER(BTRIM(placa)) ASC
                             LIMIT 1",
                            [$sufixoRve]
                        );
                        if ($resV && @pg_num_rows($resV) > 0) {
                            $cand = normalizar_placa_imp((string)@pg_fetch_result($resV, 0, 0));
                            if ($cand !== '') $placaProvisoria = $cand;
                        }
                    }
                }

                $placaProvEsc = pg_escape_string($g_sql, $placaProvisoria);
                $placaEsc = pg_escape_string($g_sql, $placa);
                $loginEsc = pg_escape_string($g_sql, $loginScript);

                // Reaproveita carregamento ABERTO da mesma placa (provisória).
                $seqCarreg = 0;
                $resSeq = @pg_query_params($g_sql,
                    "SELECT seq_carregamento FROM {$tblCar}
                     WHERE unidade = $1
                       AND UPPER(placa_provisoria) = UPPER($2)
                     GROUP BY seq_carregamento
                     HAVING MAX(data_finalizacao) IS NULL
                     ORDER BY COALESCE(seq_carregamento, 0) DESC
                     LIMIT 1",
                    [$unidade, $placaProvisoria]
                );
                if ($resSeq && @pg_num_rows($resSeq) > 0) {
                    $seqCarreg = (int)@pg_fetch_result($resSeq, 0, 0);
                }
                $reaproveitando = ($seqCarreg > 0);

                if ($seqCarreg <= 0) {
                    $seqCarreg = proximo_seq_imp($g_sql, $domain);
                    if ($seqCarreg <= 0) {
                        echo "   ❌ {$placa}: falha ao gerar seq_carregamento.\n";
                        continue;
                    }
                }

                // Ignora carregamentos simulados.
                $resSim = @pg_query_params($g_sql,
                    "SELECT COALESCE(simulado, FALSE) FROM {$tblCap}
                     WHERE unidade = $1 AND seq_carregamento = $2 LIMIT 1",
                    [$unidade, $seqCarreg]
                );
                if ($resSim && @pg_num_rows($resSim) > 0) {
                    $isSim = (string)@pg_fetch_result($resSim, 0, 0);
                    if ($isSim === 't' || $isSim === 'true' || $isSim === '1') {
                        echo "   ⏭️  {$placa}: carregamento simulado; ignorado.\n";
                        continue;
                    }
                }

                // Data/hora de inclusão: preserva a existente; senão usa a primeira bipagem.
                $dataIncSql = 'CURRENT_DATE';
                $horaIncSql = 'CURRENT_TIME';
                $resInc = @pg_query_params($g_sql,
                    "SELECT MIN((data_inclusao::timestamp + hora_inclusao::time)) AS inicio_ts
                     FROM {$tblCar}
                     WHERE unidade = $1 AND seq_carregamento = $2",
                    [$unidade, $seqCarreg]
                );
                if ($resInc && @pg_num_rows($resInc) > 0) {
                    $incTs = trim((string)@pg_fetch_result($resInc, 0, 0));
                    if ($incTs !== '') {
                        $dataIncSql = "DATE '" . pg_escape_string($g_sql, substr($incTs, 0, 10)) . "'";
                        $horaIncSql = "TIME '" . pg_escape_string($g_sql, substr($incTs, 11, 8)) . "'";
                    }
                }
                if ($dataIncSql === 'CURRENT_DATE') {
                    $captura = obter_primeira_captura_imp($placa);
                    if (is_array($captura) && !empty($captura['data']) && !empty($captura['hora'])) {
                        $dataIncSql = "DATE '" . pg_escape_string($g_sql, $captura['data']) . "'";
                        $horaIncSql = "TIME '" . pg_escape_string($g_sql, $captura['hora']) . "'";
                    }
                }

                // Determina destino e nro_linha a partir dos CT-es.
                $info = $carregamentos[$placa] ?? null;
                // RVE: agrupa CT-es de placas com o mesmo sufixo.
                if (($info === null || empty($info['ctes'])) && $isRve && $sufixoRve !== null) {
                    foreach ($carregamentos as $kChave => $vChave) {
                        $kUp = normalizar_placa_imp((string)$kChave);
                        if ($kUp === '' || strlen($kUp) < 4) continue;
                        if (substr($kUp, -4) === $sufixoRve) {
                            if ($info === null) $info = ['ctes' => [], 'destinos' => []];
                            $info['ctes'] = array_merge($info['ctes'], is_array($vChave['ctes'] ?? null) ? $vChave['ctes'] : []);
                            $info['destinos'] = array_merge($info['destinos'], is_array($vChave['destinos'] ?? null) ? $vChave['destinos'] : []);
                        }
                    }
                }
                $ctes = is_array($info['ctes'] ?? null) ? $info['ctes'] : [];
                $destinosRaw = array_map('strtoupper', array_map('trim', is_array($info['destinos'] ?? null) ? $info['destinos'] : []));
                $destinosRaw = array_values(array_filter($destinosRaw, function ($d) { return $d !== ''; }));

                $destinoCar = null;
                $unidadesCarCsv = '';
                $nroLinhaCar = 0;
                $destUnicos = array_values(array_unique($destinosRaw));
                $linhasOrigem = $linhasPorUnidade[$unidade] ?? [];
                $linhaDet = encontrar_linha_imp($linhasOrigem, $destinosRaw);
                if (is_array($linhaDet) && (int)($linhaDet['nro_linha'] ?? 0) > 0) {
                    $nroLinhaCar = (int)$linhaDet['nro_linha'];
                    $destFinal = strtoupper(trim((string)($linhaDet['sigla_dest'] ?? '')));
                    $interFinal = parse_unidades_csv_imp((string)($linhaDet['unidades'] ?? ''));
                    $interClean = [];
                    $seenInter = [];
                    foreach ($interFinal as $u) {
                        $um = strtoupper(trim((string)$u));
                        if ($um === '' || $um === $destFinal || isset($seenInter[$um])) continue;
                        $seenInter[$um] = true;
                        $interClean[] = $um;
                    }
                    $destinoCar = $destFinal !== '' ? $destFinal : null;
                    $unidadesCarCsv = count($interClean) > 0 ? implode(',', $interClean) : '';
                } elseif (count($destUnicos) === 1) {
                    $destinoCar = $destUnicos[0];
                } elseif (count($destUnicos) > 1) {
                    $freq = array_count_values($destinosRaw);
                    arsort($freq);
                    $destinoCar = array_key_first($freq);
                    $outras = array_values(array_filter($destUnicos, function ($u) use ($destinoCar) {
                        return $destinoCar ? ($u !== $destinoCar) : true;
                    }));
                    sort($outras);
                    $unidadesCarCsv = implode(',', $outras);
                }

                $destinoCarEsc = $destinoCar ? ("'" . pg_escape_string($g_sql, $destinoCar) . "'") : 'NULL';
                $unidadesCarEsc = ($unidadesCarCsv !== '') ? ("'" . pg_escape_string($g_sql, $unidadesCarCsv) . "'") : 'NULL';
                $nroLinhaCarEsc = $nroLinhaCar > 0 ? (string)$nroLinhaCar : 'NULL';

                // Cria/atualiza o cabeçalho (capacidade).
                @pg_query($g_sql,
                    "INSERT INTO {$tblCap} (unidade, seq_carregamento, placa_provisoria, nro_linha, simulado, tp_carregamento)
                     VALUES ('{$unidadeEsc}', {$seqCarreg}, '{$placaProvEsc}', {$nroLinhaCarEsc}, FALSE, 'T')
                     ON CONFLICT (unidade, seq_carregamento) DO UPDATE
                        SET placa_provisoria = EXCLUDED.placa_provisoria,
                            nro_linha = COALESCE(EXCLUDED.nro_linha, {$tblCap}.nro_linha),
                            simulado = FALSE,
                            tp_carregamento = COALESCE({$tblCap}.tp_carregamento, 'T')"
                );

                // Atualiza o cabeçalho das linhas do carregamento.
                @pg_query($g_sql,
                    "UPDATE {$tblCar}
                     SET placa_provisoria = '{$placaProvEsc}',
                         origem_ssw = '{$placaEsc}',
                         destino = COALESCE(NULLIF(destino,''), {$destinoCarEsc}),
                         unidades = COALESCE(NULLIF(unidades,''), {$unidadesCarEsc}),
                         origem_criacao = 'SSW'
                     WHERE unidade = '{$unidadeEsc}' AND seq_carregamento = {$seqCarreg}"
                );

                if (empty($ctes)) {
                    // Sentinela: garante pelo menos uma linha (nro_cte = 0).
                    $resAny = @pg_query($g_sql, "SELECT 1 FROM {$tblCar} WHERE unidade = '{$unidadeEsc}' AND seq_carregamento = {$seqCarreg} LIMIT 1");
                    if (!$resAny || @pg_num_rows($resAny) === 0) {
                        @pg_query($g_sql,
                            "INSERT INTO {$tblCar}
                             (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                              nro_cte, destino, unidades, origem_ssw, origem_criacao, unidade_carregamento)
                             VALUES
                             ('{$unidadeEsc}', {$seqCarreg}, '{$placaProvEsc}', '{$loginEsc}', {$dataIncSql}, {$horaIncSql},
                              0, {$destinoCarEsc}, {$unidadesCarEsc}, '{$placaEsc}', 'SSW', '{$unidadeEsc}')"
                        );
                    }
                    echo "   📋 {$placa} (seq {$seqCarreg}): sem CT-es no relatório; cabeçalho mantido.\n";
                    continue;
                }

                // Insere/atualiza cada CT-e (transação por placa).
                @pg_query($g_sql, 'BEGIN');
                $inseridos = 0;
                $atualizados = 0;
                $ignoradosOutro = 0;
                try {
                    foreach ($ctes as $cte_info) {
                        $ser = pg_escape_string($g_sql, strtoupper(trim((string)($cte_info['ser_cte'] ?? ''))));
                        $nro = (int)($cte_info['nro_cte'] ?? 0);
                        if ($ser === '' || $nro <= 0) continue;

                        $destinoCte = pg_escape_string($g_sql, strtoupper(trim((string)($cte_info['destino_cte'] ?? ''))));
                        $remetente  = pg_escape_string($g_sql, trim((string)($cte_info['remetente'] ?? '')));
                        $pagador    = pg_escape_string($g_sql, trim((string)($cte_info['pagador'] ?? '')));
                        $destinat   = pg_escape_string($g_sql, trim((string)($cte_info['destinatario'] ?? '')));
                        $cidade     = pg_escape_string($g_sql, trim((string)($cte_info['cidade'] ?? '')));
                        $emissao    = trim((string)($cte_info['emissao'] ?? ''));
                        $prevEnt    = trim((string)($cte_info['prev_ent'] ?? ''));
                        $emissaoSql = preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $emissao) ? "TO_DATE('" . pg_escape_string($g_sql, $emissao) . "', 'DD/MM/YYYY')" : 'NULL';
                        $prevEntSql = preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $prevEnt) ? "TO_DATE('" . pg_escape_string($g_sql, $prevEnt) . "', 'DD/MM/YYYY')" : 'NULL';
                        $vlrMerc  = normalizar_numero_imp($cte_info['vlr_merc']  ?? 0);
                        $vlrFrete = normalizar_numero_imp($cte_info['vlr_frete'] ?? 0);
                        $pesoVal  = normalizar_numero_imp($cte_info['peso']      ?? 0);
                        $cubVal   = normalizar_numero_imp($cte_info['cubagem']   ?? 0);
                        $qtdeVol  = (int)($cte_info['qtde_vol'] ?? 0);

                        // Já existe neste carregamento? Atualiza.
                        $dup = @pg_query($g_sql, "SELECT 1 FROM {$tblCar} WHERE unidade = '{$unidadeEsc}' AND seq_carregamento = {$seqCarreg} AND ser_cte = '{$ser}' AND nro_cte = {$nro} LIMIT 1");
                        if ($dup && @pg_num_rows($dup) > 0) {
                            @pg_query($g_sql,
                                "UPDATE {$tblCar}
                                 SET placa_provisoria = '{$placaProvEsc}', origem_ssw = '{$placaEsc}',
                                     destino = {$destinoCarEsc}, unidades = {$unidadesCarEsc},
                                     destino_cte = '{$destinoCte}', data_emissao_cte = {$emissaoSql}, data_prev_ent_cte = {$prevEntSql},
                                     remetente_cte = '{$remetente}', destinatario_cte = '{$destinat}', pagador_cte = '{$pagador}',
                                     cidade_destino_cte = '{$cidade}', vlr_merc_cte = {$vlrMerc}, vlr_frete_cte = {$vlrFrete},
                                     peso_cte = {$pesoVal}, cubagem_cte = {$cubVal}, qtde_vol_cte = {$qtdeVol},
                                     bipado = TRUE, origem_criacao = 'SSW',
                                     data_finalizacao = NULL, hora_finalizacao = NULL, login_finalizacao = NULL
                                 WHERE unidade = '{$unidadeEsc}' AND seq_carregamento = {$seqCarreg} AND ser_cte = '{$ser}' AND nro_cte = {$nro}"
                            );
                            $atualizados++;
                            continue;
                        }

                        // CT-e já está em OUTRO carregamento ABERTO? Ignora (não move em batch).
                        $outro = @pg_query($g_sql, "SELECT seq_carregamento FROM {$tblCar} WHERE unidade = '{$unidadeEsc}' AND data_finalizacao IS NULL AND ser_cte = '{$ser}' AND nro_cte = {$nro} AND COALESCE(seq_carregamento,0) <> {$seqCarreg} ORDER BY COALESCE(seq_carregamento,0) DESC LIMIT 1");
                        if ($outro && @pg_num_rows($outro) > 0) {
                            $ignoradosOutro++;
                            continue;
                        }

                        $resIns = @pg_query($g_sql,
                            "INSERT INTO {$tblCar}
                             (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                              destino, unidades, ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                              remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                              vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                              bipado, origem_ssw, origem_criacao, unidade_carregamento)
                             VALUES
                             ('{$unidadeEsc}', {$seqCarreg}, '{$placaProvEsc}', '{$loginEsc}', {$dataIncSql}, {$horaIncSql},
                              {$destinoCarEsc}, {$unidadesCarEsc}, '{$ser}', {$nro}, '{$destinoCte}', {$emissaoSql}, {$prevEntSql},
                              '{$remetente}', '{$destinat}', '{$pagador}', '{$cidade}',
                              {$vlrMerc}, {$vlrFrete}, {$pesoVal}, {$cubVal}, {$qtdeVol},
                              TRUE, '{$placaEsc}', 'SSW', '{$unidadeEsc}')"
                        );
                        if ($resIns) $inseridos++;
                    }
                    @pg_query($g_sql, 'COMMIT');
                } catch (Exception $e) {
                    @pg_query($g_sql, 'ROLLBACK');
                    echo "   ❌ {$placa} (seq {$seqCarreg}): " . $e->getMessage() . "\n";
                    continue;
                }

                $totalProc = $inseridos + $atualizados;
                if (!$reaproveitando) $criadosUnidade++;
                else $atualizadosUnidade++;
                $ctesUnidade += $totalProc;

                $msg = "{$placa} (seq {$seqCarreg}): {$totalProc} CT-e(s)";
                if ($inseridos > 0) $msg .= " [+{$inseridos} novos]";
                if ($atualizados > 0) $msg .= " [{$atualizados} atualizados]";
                if ($ignoradosOutro > 0) $msg .= " [{$ignoradosOutro} em outro carregamento]";
                if (!$reaproveitando) $msg .= " — NOVO";
                echo "   ✅ {$msg}\n";
            }

            $totalCriados += $criadosUnidade;
            $totalAtualizados += $atualizadosUnidade;
            $totalCtes += $ctesUnidade;

            // 4) Finaliza carregamentos cuja saída já foi registrada no ssw0125.
            $saidas = listar_saidas_imp($unidade);
            $finUnidade = 0;
            foreach ($saidas as $s) {
                $p = normalizar_placa_imp((string)($s['placa'] ?? ''));
                $d = (string)($s['data'] ?? '');
                $h = (string)($s['hora'] ?? '');
                if ($p === '' || $d === '' || $h === '') continue;

                $resUp = @pg_query_params($g_sql,
                    "WITH candidata AS (
                        SELECT t.seq_carregamento
                        FROM {$tblCar} t
                        WHERE t.unidade = $1
                          AND t.data_finalizacao IS NULL
                          AND UPPER(t.placa_provisoria) = UPPER($2)
                          AND ($3::date + $4::time) >= ((t.data_inclusao::timestamp + t.hora_inclusao::time) - interval '5 minutes')
                          AND COALESCE((SELECT cap.tp_carregamento FROM {$tblCap} cap
                                        WHERE cap.unidade = t.unidade AND cap.seq_carregamento = t.seq_carregamento LIMIT 1),
                                       (CASE WHEN EXISTS (SELECT 1 FROM {$tblCar} x
                                                          WHERE x.unidade = t.unidade AND x.seq_carregamento = t.seq_carregamento
                                                            AND TRIM(COALESCE(x.destino,'')) <> '')
                                             THEN 'T' ELSE 'E' END)) = 'T'
                        ORDER BY t.data_inclusao, t.hora_inclusao, t.seq_carregamento
                        LIMIT 1
                     )
                     UPDATE {$tblCar} t
                     SET data_finalizacao = $3, hora_finalizacao = $4, login_finalizacao = $5
                     FROM candidata c
                     WHERE t.unidade = $1 AND t.seq_carregamento = c.seq_carregamento AND t.data_finalizacao IS NULL",
                    [$unidade, $p, $d, $h, $loginScript]
                );
                $aff = $resUp ? (int)@pg_affected_rows($resUp) : 0;

                // RVE: tenta casar pelo sufixo de 4 caracteres.
                if ($aff <= 0 && $isRve && strlen($p) >= 4) {
                    $suf = substr($p, -4);
                    $resUp2 = @pg_query_params($g_sql,
                        "WITH candidata AS (
                            SELECT t.seq_carregamento
                            FROM {$tblCar} t
                            WHERE t.unidade = $1
                              AND t.data_finalizacao IS NULL
                              AND char_length(BTRIM(COALESCE(t.placa_provisoria,''))) = 4
                              AND UPPER(BTRIM(COALESCE(t.placa_provisoria,''))) = RIGHT(UPPER($2), 4)
                              AND ($3::date + $4::time) >= ((t.data_inclusao::timestamp + t.hora_inclusao::time) - interval '5 minutes')
                              AND COALESCE((SELECT cap.tp_carregamento FROM {$tblCap} cap
                                            WHERE cap.unidade = t.unidade AND cap.seq_carregamento = t.seq_carregamento LIMIT 1),
                                           (CASE WHEN EXISTS (SELECT 1 FROM {$tblCar} x
                                                              WHERE x.unidade = t.unidade AND x.seq_carregamento = t.seq_carregamento
                                                                AND TRIM(COALESCE(x.destino,'')) <> '')
                                                 THEN 'T' ELSE 'E' END)) = 'T'
                            ORDER BY t.data_inclusao, t.hora_inclusao, t.seq_carregamento
                            LIMIT 1
                         )
                         UPDATE {$tblCar} t
                         SET data_finalizacao = $3, hora_finalizacao = $4, login_finalizacao = $5
                         FROM candidata c
                         WHERE t.unidade = $1 AND t.seq_carregamento = c.seq_carregamento AND t.data_finalizacao IS NULL",
                        [$unidade, $p, $d, $h, $loginScript]
                    );
                    $aff = $resUp2 ? (int)@pg_affected_rows($resUp2) : 0;
                }
                if ($aff > 0) {
                    $finUnidade++;
                    echo "   🏁 {$p}: finalizado (saída " . (string)($s['raw'] ?? '') . ").\n";
                }
            }
            $totalFinalizados += $finUnidade;

            echo "   📊 Criados: {$criadosUnidade} | Atualizados: {$atualizadosUnidade} | CT-es: {$ctesUnidade} | Finalizados: {$finUnidade}\n\n";
        } catch (Exception $e) {
            echo "   ❌ Erro na unidade {$unidade}: " . $e->getMessage() . "\n\n";
            continue;
        }
    }
}

echo_hr_imp();
echo "RESUMO GERAL\n";
echo_hr_imp();
echo "Carregamentos criados:    {$totalCriados}\n";
echo "Carregamentos atualizados: {$totalAtualizados}\n";
echo "CT-es processados:        {$totalCtes}\n";
echo "Carregamentos finalizados: {$totalFinalizados}\n";
echo_hr_imp();
echo "FIM\n";
echo_hr_imp();
