<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../lib/ssw_loader.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth        = authenticateAndGetUser();
$domain      = $auth['domain'];
$currentUser = getCurrentUser();
$unidade     = strtoupper(trim($currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? ''));
$login       = $currentUser['username'] ?? '';

if (empty($unidade) || empty($domain)) {
    respondJson(['success' => false, 'message' => 'Unidade ou domínio não identificados.']);
}
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input       = getRequestInput();

$conn = connect();
global $g_sql;
$g_sql = $conn;

function runImpPropVeic(string $domain, string $modo = 'RECENTE'): array {
    $dom = strtoupper(trim((string)$domain));
    if ($dom === '' || !preg_match('/^[A-Z0-9_]+$/', $dom)) {
        return ['success' => false, 'message' => 'Domínio inválido para importação.'];
    }

    $phpBin = '/usr/bin/php';
    $script = '/var/www/html/imp_prop_veic.php';
    $cwd = '/var/www/html';
    if (!file_exists($phpBin)) return ['success' => false, 'message' => 'PHP bin não encontrado em /usr/bin/php.'];
    if (!file_exists($script)) return ['success' => false, 'message' => 'Script imp_prop_veic.php não encontrado em /var/www/html.'];

    $tmpDir = sys_get_temp_dir();
    if (!is_string($tmpDir) || trim($tmpDir) === '') $tmpDir = '/tmp';
    $logFile = rtrim($tmpDir, '/') . '/imp_prop_veic_' . strtolower($dom) . '_' . date('Ymd_His') . '_' . mt_rand(1000, 9999) . '.log';

    $cmd = 'cd ' . escapeshellarg($cwd)
        . ' && ' . escapeshellarg($phpBin)
        . ' ' . escapeshellarg($script)
        . ' ' . escapeshellarg($dom)
        . ' ' . escapeshellarg($modo);

    $descriptorspec = [
        0 => ['pipe', 'r'],
        1 => ['file', $logFile, 'w'],
        2 => ['file', $logFile, 'a'],
    ];

    $process = @proc_open($cmd, $descriptorspec, $pipes);
    if (!is_resource($process)) {
        return ['success' => false, 'message' => 'Falha ao iniciar processo de importação.'];
    }
    @fclose($pipes[0]);

    $timeoutSec = 120;
    $start = time();
    $timedOut = false;
    while (true) {
        $status = @proc_get_status($process);
        $running = is_array($status) ? (bool)($status['running'] ?? false) : false;
        if (!$running) break;
        if ((time() - $start) > $timeoutSec) {
            $timedOut = true;
            @proc_terminate($process);
            @usleep(200000);
            @proc_terminate($process, 9);
            break;
        }
        @usleep(120000);
    }

    $exitCode = @proc_close($process);

    if ($timedOut) {
        return ['success' => false, 'message' => 'Erro ao importar veículos: tempo excedido.', 'log_file' => $logFile];
    }

    $content = '';
    if (is_file($logFile)) {
        $c = @file_get_contents($logFile);
        if (is_string($c)) $content = $c;
    }

    $upper = strtoupper($content);
    $temFatal = (strpos($upper, 'PHP FATAL ERROR') !== false) || (strpos($upper, 'FATAL ERROR') !== false);
    if ($temFatal) {
        $tail = trim(substr($content, max(0, strlen($content) - 1200)));
        return [
            'success' => false,
            'message' => 'Erro ao importar veículos.',
            'exit_code' => (int)$exitCode,
            'log_file' => $logFile,
            'details' => $tail,
        ];
    }

    return ['success' => true];
}

function tabelaExisteImport($conn, string $tableName): bool {
    $t = strtolower(trim($tableName));
    if ($t === '') return false;
    $res = sql(
        "SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND lower(table_name) = lower($1)
         LIMIT 1",
        [$t],
        $conn
    );
    return ($res && pg_num_rows($res) > 0);
}

function getTabelaUnidadesDominioImport($conn, string $domain): string {
    $domain = strtolower(trim((string)$domain));
    $t1 = $domain . '_unidade';
    $t2 = $domain . '_unidades';
    if (tabelaExisteImport($conn, $t1)) return $t1;
    if (tabelaExisteImport($conn, $t2)) return $t2;
    return '';
}

function parseListaUnidadesCompartImport(string $csv): array {
    $csv = strtoupper(trim((string)$csv));
    if ($csv === '') return [];
    $parts = preg_split('/[,\s;]+/', $csv);
    if (!is_array($parts)) return [];
    $out = [];
    foreach ($parts as $p) {
        $u = strtoupper(trim((string)$p));
        if ($u === '') continue;
        if (!preg_match('/^[A-Z0-9]{2,5}$/', $u)) continue;
        $out[$u] = true;
    }
    return array_keys($out);
}

function buildMapaDestinoCompartilhadoImport($conn, string $tblUnidade): array {
    $map = [];
    $tblUnidade = strtolower(trim((string)$tblUnidade));
    if ($tblUnidade === '' || !tabelaExisteImport($conn, $tblUnidade)) return $map;
    $tblIdent = pg_escape_identifier($conn, $tblUnidade);
    $res = sql(
        "SELECT sigla, unidades_compart
         FROM {$tblIdent}
         WHERE COALESCE(TRIM(unidades_compart), '') <> ''",
        [],
        $conn
    );
    while ($res && ($row = pg_fetch_assoc($res))) {
        $main = strtoupper(trim((string)($row['sigla'] ?? '')));
        if ($main === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $main)) continue;
        $lista = parseListaUnidadesCompartImport((string)($row['unidades_compart'] ?? ''));
        foreach ($lista as $u) {
            if (!isset($map[$u])) $map[$u] = $main;
        }
    }
    return $map;
}

$acao = strtoupper(trim((string)($input['acao'] ?? '')));
$autoImportarVeiculos = (bool)($input['auto_importar_veiculos'] ?? false);
$ignorarVeiculosFaltantes = (bool)($input['ignorar_veiculos_faltantes'] ?? false);
$obrigarPlacasReaisRaw = $input['obrigar_placas_reais'] ?? false;
$obrigarPlacasReais = ($obrigarPlacasReaisRaw === true || $obrigarPlacasReaisRaw === 1 || $obrigarPlacasReaisRaw === '1' || strtoupper(trim((string)$obrigarPlacasReaisRaw)) === 'S');
if ($acao === 'EXCLUIR_INEXISTENTES') {
    $tabela = "{$domain}_carregamento";
    $tabelaCap = "{$domain}_carregamento_capacidade";
    @pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS data_finalizacao DATE");
    @pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS hora_finalizacao TIME");
    @pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS login_finalizacao VARCHAR(60)");
    @pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS simulado BOOLEAN DEFAULT FALSE");
    @pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS nro_linha INT");
    $origens = $input['origens_ssw'] ?? [];
    if (!is_array($origens)) $origens = [];
    $origens = array_values(array_unique(array_filter(array_map(function ($v) {
        $s = strtoupper(trim((string)$v));
        return $s !== '' ? $s : null;
    }, $origens))));

    if (empty($origens)) {
        respondJson(['success' => false, 'message' => 'Nenhuma origem_ssw informada para exclusão.']);
    }

    $unidadeEsc = pg_escape_string($conn, $unidade);
    $in = implode(',', array_map(function ($p) use ($conn) {
        return "'" . pg_escape_string($conn, $p) . "'";
    }, $origens));

    $loginEsc = pg_escape_string($conn, $login);
    $extra = '';
    if (tabelaExisteImport($conn, $tabelaCap)) {
        $extra = " AND NOT EXISTS (
            SELECT 1
            FROM {$tabelaCap} cap
            WHERE cap.unidade = {$tabela}.unidade
              AND cap.seq_carregamento = {$tabela}.seq_carregamento
              AND COALESCE(cap.simulado, FALSE) = TRUE
        )";
    }
    $resUpd = pg_query(
        $conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '{$loginEsc}'
         WHERE UPPER(unidade) = '{$unidadeEsc}'
           AND data_finalizacao IS NULL
           AND origem_ssw IS NOT NULL AND origem_ssw <> ''
           AND UPPER(origem_ssw) IN ({$in})
           {$extra}"
    );
    if ($resUpd === false) {
        respondJson(['success' => false, 'message' => 'Erro ao finalizar carregamentos inexistentes.']);
    }

    respondJson([
        'success' => true,
        'finalizados' => pg_affected_rows($resUpd),
    ]);
}

if ($acao === 'IMPORTAR_VEICULOS') {
    set_time_limit(600);
    $r = runImpPropVeic((string)$domain, 'RECENTE');
    respondJson($r);
}

try {
    require_ssw();
    ssw_login($domain);
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao inicializar integração: ' . $e->getMessage()]);
}
set_time_limit(600);

$importVeiculosRecentes = runImpPropVeic((string)$domain, 'RECENTE');
$importVeiculosRecentesOk = (bool)($importVeiculosRecentes['success'] ?? false);
$importVeiculosRecentesMsg = (string)($importVeiculosRecentes['message'] ?? '');

$tabela = "{$domain}_carregamento";
$tabelaVeiculo = "{$domain}_veiculo";
$tabelaCap = "{$domain}_carregamento_capacidade";
$tabelaLinha = "{$domain}_linha";
$domainUpper = strtoupper(trim((string)$domain));

$tblUnidade = getTabelaUnidadesDominioImport($conn, $domain);
$mapDestinoCompart = buildMapaDestinoCompartilhadoImport($conn, $tblUnidade);

@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS origem_criacao VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS data_finalizacao DATE");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS hora_finalizacao TIME");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS login_finalizacao VARCHAR(60)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS simulado BOOLEAN DEFAULT FALSE");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS nro_linha INT");

$seqName = "{$domain}_seq_carregamento_seq";
@pg_query($conn, "CREATE SEQUENCE IF NOT EXISTS {$seqName}");
@pg_query($conn, "ALTER TABLE {$tabela} ALTER COLUMN seq_carregamento SET DEFAULT nextval('{$seqName}')");

function nextSeqCarregamentoSsw($conn, $seqName) {
    $seqName = trim((string)$seqName);
    if ($seqName === '') return 0;
    $res = @pg_query($conn, "SELECT nextval('" . pg_escape_string($conn, $seqName) . "') AS seq");
    if (!$res || pg_num_rows($res) === 0) return 0;
    return (int)pg_fetch_result($res, 0, 0);
}

ssw_go("https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2={$unidade}&f3=101");
$html_placas = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194?act=PLACAS&prioritario=N");

$inicio_xml = strpos($html_placas, '<?xml');
if ($inicio_xml === false) {
    $inicio_xml = strpos($html_placas, '<xml');
}
if ($inicio_xml === false) {
    respondJson(['success' => false, 'message' => 'Não foi possível encontrar o XML com as placas no retorno do SSW.']);
}
$fim_xml = strrpos($html_placas, '</data>');
if ($fim_xml === false) {
    $fim_xml = strrpos($html_placas, '</xml>');
    $tag_fim = '</xml>';
} else {
    $tag_fim = '</data>';
}
if ($fim_xml === false) {
    respondJson(['success' => false, 'message' => 'XML de placas malformado no retorno do SSW.']);
}
$xml_string = substr($html_placas, $inicio_xml, ($fim_xml + strlen($tag_fim)) - $inicio_xml);

$xml = @simplexml_load_string($xml_string);
if ($xml === false) {
    respondJson(['success' => false, 'message' => 'Falha ao parsear o XML das placas do SSW.']);
}

$placas_ssw = [];
foreach ($xml->xpath('//f8') as $f8) {
    $placa = strtoupper(trim((string)$f8));
    if (!empty($placa)) {
        $placas_ssw[] = $placa;
    }
}
$matchesPlacas = [];
if (preg_match_all("/SR_IMP\\|([A-Z]{3}[A-Z0-9]{4})/i", $xml_string, $matchesPlacas)) {
    foreach (($matchesPlacas[1] ?? []) as $p) {
        $p = strtoupper(trim((string)$p));
        if ($p !== '') $placas_ssw[] = $p;
    }
}
$placas_ssw = array_values(array_unique($placas_ssw));

$veiculosFaltantes = [];
if ($domainUpper === 'RVE') {
    $sufixos = [];
    foreach ($placas_ssw as $p) {
        $p = strtoupper(trim((string)$p));
        if ($p === '') continue;
        if (!preg_match('/^[A-Z]{3}[A-Z0-9]{4}$/', $p)) continue;
        $suf = substr($p, 3, 4);
        if ($suf !== '') $sufixos[$suf] = true;
    }
    $sufixos = array_keys($sufixos);
    if (count($sufixos) > 0 && function_exists('imp_ssw_prop') && function_exists('imp_ssw_vei') && function_exists('imp_ssw_mot')) {
        $found = [];
        foreach (array_chunk($sufixos, 500) as $chunk) {
            $ph = [];
            $params = [];
            $i = 1;
            foreach ($chunk as $suf) {
                $ph[] = '$' . $i;
                $params[] = $suf;
                $i += 1;
            }
            if (empty($ph)) continue;
            $q = "SELECT DISTINCT RIGHT(UPPER(placa), 4) AS suf FROM {$tabelaVeiculo} WHERE RIGHT(UPPER(placa), 4) IN (" . implode(',', $ph) . ")";
            $r = @pg_query_params($conn, $q, $params);
            if ($r) {
                while ($row = pg_fetch_assoc($r)) {
                    $s = strtoupper(trim((string)($row['suf'] ?? '')));
                    if ($s !== '') $found[$s] = true;
                }
            }
        }
        $missing = [];
        foreach ($sufixos as $suf) {
            if (!isset($found[$suf])) $missing[] = $suf;
        }
        if (count($missing) > 0) {
            $veiculosFaltantes = $missing;
        }
    }
} else {
    $placasCheck = [];
    foreach ($placas_ssw as $p) {
        $p = strtoupper(trim((string)$p));
        if ($p === '') continue;
        if (!preg_match('/^[A-Z0-9]{7}$/', $p)) continue;
        $placasCheck[$p] = true;
    }
    $placasCheck = array_keys($placasCheck);
    if (count($placasCheck) > 0 && function_exists('imp_ssw_prop') && function_exists('imp_ssw_vei') && function_exists('imp_ssw_mot')) {
        $found = [];
        foreach (array_chunk($placasCheck, 500) as $chunk) {
            $ph = [];
            $params = [];
            $i = 1;
            foreach ($chunk as $placa) {
                $ph[] = '$' . $i;
                $params[] = $placa;
                $i += 1;
            }
            if (empty($ph)) continue;
            $q = "SELECT UPPER(placa) AS placa FROM {$tabelaVeiculo} WHERE UPPER(placa) IN (" . implode(',', $ph) . ")";
            $r = @pg_query_params($conn, $q, $params);
            if ($r) {
                while ($row = pg_fetch_assoc($r)) {
                    $pl = strtoupper(trim((string)($row['placa'] ?? '')));
                    if ($pl !== '') $found[$pl] = true;
                }
            }
        }
        $missing = [];
        foreach ($placasCheck as $placa) {
            if (!isset($found[$placa])) $missing[] = $placa;
        }
        if (count($missing) > 0) {
            $veiculosFaltantes = $missing;
        }
    }
}

$unidadeEsc = pg_escape_string($conn, $unidade);
$finalizadosSumiramSsw = 0;

if (empty($placas_ssw)) {
    $loginEsc = pg_escape_string($conn, $login);
    $resFinAll = @pg_query(
        $conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '{$loginEsc}'
         WHERE UPPER(unidade) = '{$unidadeEsc}'
           AND data_finalizacao IS NULL
           AND origem_ssw IS NOT NULL AND origem_ssw <> ''"
    );
    if ($resFinAll) $finalizadosSumiramSsw = (int)pg_affected_rows($resFinAll);
    respondJson([
        'success' => true,
        'message' => "Nenhum carregamento encontrado no SSW para esta unidade.",
        'logs' => [],
        'placas_ssw' => [],
        'finalizados_sumiram_ssw' => $finalizadosSumiramSsw,
    ]);
}

$logs = [];

$loginEsc   = pg_escape_string($conn, $login);

$destinosLinhaSet = [];
try {
    $resLinha = sql(
        "SELECT DISTINCT UPPER(sigla_dest) AS sigla_dest
         FROM {$tabelaLinha}
         WHERE UPPER(sigla_emit) = UPPER(\$1)
           AND COALESCE(sigla_dest, '') <> ''",
        [$unidade],
        $conn
    );
    while ($resLinha && ($r = pg_fetch_assoc($resLinha))) {
        $sd = strtoupper(trim((string)($r['sigla_dest'] ?? '')));
        if ($sd !== '') $destinosLinhaSet[$sd] = true;
    }
} catch (Exception $e) {
    $destinosLinhaSet = [];
}

function parseUnidadesCsvImportLinha($csv) {
    $csv = strtoupper(trim((string)$csv));
    if ($csv === '') return [];
    $parts = preg_split('/[,\s;]+/', $csv);
    if (!is_array($parts)) return [];
    $out = [];
    $seen = [];
    foreach ($parts as $p) {
        $u = strtoupper(trim((string)$p));
        if ($u === '') continue;
        if (!preg_match('/^[A-Z0-9]{2,5}$/', $u)) continue;
        if (isset($seen[$u])) continue;
        $seen[$u] = true;
        $out[] = $u;
    }
    return $out;
}

function orderedUniqueImportLinha($arr) {
    if (!is_array($arr)) return [];
    $seen = [];
    $out = [];
    foreach ($arr as $v) {
        $u = strtoupper(trim((string)$v));
        if ($u === '') continue;
        if (!preg_match('/^[A-Z0-9]{2,5}$/', $u)) continue;
        if (isset($seen[$u])) continue;
        $seen[$u] = true;
        $out[] = $u;
    }
    return $out;
}

function encontrarLinhaParaDestinosImport($linhas, $destinosRaw) {
    if (!is_array($linhas) || count($linhas) === 0) return null;
    $destinosOrder = orderedUniqueImportLinha($destinosRaw);
    if (count($destinosOrder) === 0) return null;

    $best = null;
    $bestScore = null;

    foreach ($linhas as $l) {
        $nro = (int)($l['nro_linha'] ?? 0);
        if ($nro <= 0) continue;
        $dest = strtoupper(trim((string)($l['sigla_dest'] ?? '')));
        if ($dest === '') continue;
        $inter = parseUnidadesCsvImportLinha((string)($l['unidades'] ?? ''));
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

$linhasOrigem = [];
try {
    $resLinhas = sql(
        "SELECT nro_linha, UPPER(sigla_dest) AS sigla_dest, COALESCE(unidades, '') AS unidades
         FROM {$tabelaLinha}
         WHERE UPPER(sigla_emit) = UPPER(\$1)",
        [$unidade],
        $conn
    );
    while ($resLinhas && ($r = pg_fetch_assoc($resLinhas))) {
        $linhasOrigem[] = $r;
    }
} catch (Exception $e) {
    $linhasOrigem = [];
}

function normalizarNumero($v) {
    $s = trim((string)$v);
    if ($s === '') return 0.0;
    $s = preg_replace('/[^0-9,\\.]/', '', $s);
    if ($s === '') return 0.0;
    if (strpos($s, ',') !== false) {
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
        return (float)$s;
    }
    return (float)$s;
}

function extrairXmlDoRetornoSsw($html) {
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

function obterPrimeiraCapturaSsw($placaSsw) {
    $placaSsw = strtoupper(trim((string)$placaSsw));
    if ($placaSsw === '') return null;

    $url = "https://sistema.ssw.inf.br/bin/ssw0194?act=VER_BAR2&placa=" . rawurlencode($placaSsw);
    $html = ssw_go($url);
    $xmlStr = extrairXmlDoRetornoSsw($html);
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
        if ($minDt === null || $dt->getTimestamp() < $minDt->getTimestamp()) {
            $minDt = $dt;
        }
    }
    if ($minDt === null) return null;

    return [
        'data' => $minDt->format('Y-m-d'),
        'hora' => $minDt->format('H:i:s'),
    ];
}

function listarSaidasAutorizadasSsw0125(string $siglaOrigem): array {
    $siglaOrigem = strtoupper(trim($siglaOrigem));
    if ($siglaOrigem === '') return [];

    $ini = date('dmy', strtotime('-1 day'));
    $fim = date('dmy');

    $url = "https://sistema.ssw.inf.br/bin/ssw0125?act=PER"
        . "&t_sigla_origem=" . rawurlencode($siglaOrigem)
        . "&t_data_saida_ini=" . rawurlencode($ini)
        . "&t_data_saida_fin=" . rawurlencode($fim);

    $html = ssw_go($url);
    $xmlStr = extrairXmlDoRetornoSsw($html);
    if ($xmlStr === null) return [];

    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) return [];

    $out = [];
    $rows = $xml->xpath('//r');
    if (!$rows) return [];

    foreach ($rows as $r) {
        $f3 = strtoupper(trim((string)($r->f3 ?? '')));
        $f2 = strtoupper(trim((string)($r->f2 ?? '')));
        $placa = $f3 !== '' ? $f3 : $f2;
        $f11 = trim((string)($r->f11 ?? ''));
        $f16raw = (string)($r->f16 ?? '');
        $f16 = strtoupper(trim(html_entity_decode($f16raw)));

        if ($placa === '' || $f11 === '') continue;
        if (strpos($f16, 'AUTORIZADO') === false) continue;

        $dt = DateTime::createFromFormat('d/m/y H:i', $f11);
        if (!$dt) continue;

        $out[] = [
            'placa' => $placa,
            'data' => $dt->format('Y-m-d'),
            'hora' => $dt->format('H:i:s'),
            'raw' => $f11,
        ];
    }

    return $out;
}

function parseRelatorioCarregamentos($texto) {
    $texto = mb_convert_encoding($texto, 'UTF-8', 'ISO-8859-1');
    $texto = str_replace("\r\n", "\n", str_replace("\r", "\n", $texto));
    $linhas = explode("\n", $texto);

    $porPlaca = [];
    $placaAtual = null;
    $anoBase = (int)date('Y');
    $mesBase = (int)date('m');

    $larguras = [12,5,5,10,12,5,6,5,5,20,20,20,14,3,14,11,7,6,2];
    $separador = '------------+-----+-----+----------+------------+-----+------+-----+-----+--------------------+--------------------+--------------------+--------------+---+--------------+-----------+-------+------+--';

    foreach ($linhas as $linha) {
        $linha = rtrim($linha, "\n");
        if ($linha === '') continue;

        if (preg_match('/PLACA:\\s*([A-Z0-9-]+)/', $linha, $m)) {
            $placaAtual = strtoupper(trim($m[1]));
            if (!isset($porPlaca[$placaAtual])) {
                $porPlaca[$placaAtual] = ['ctes' => [], 'destinos' => []];
            }
            if (preg_match('/(\\d{2})\\/(\\d{2})\\/(\\d{4})/', $linha, $d)) {
                $mesBase = (int)$d[2];
                $anoBase = (int)$d[3];
            }
            continue;
        }

        if ($placaAtual === null) continue;
        if (strpos($linha, $separador) !== false) continue;
        if (preg_match('/^TOTAIS:/', trim($linha))) continue;
        if (preg_match('/^TOTAL GERAL/', trim($linha))) continue;

        $ctrc = trim(substr($linha, 0, 13));
        if (!preg_match('/^[A-Z]{3}\\d{6}-\\d$/', $ctrc)) continue;

        $offset = 0;
        $cols = [];
        foreach ($larguras as $w) {
            $cols[] = rtrim(substr($linha, $offset, $w));
            $offset += $w + 1;
        }

        $ctrcRaw = $ctrc;
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

        $ser = substr($ctrcRaw, 0, 3);
        $nro = (int)substr($ctrcRaw, 3, 6);
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
            'vlr_merc'     => $merc,
            'vlr_frete'    => $frete,
            'peso'         => $kg,
            'cubagem'      => $m3,
        ];
    }

    return $porPlaca;
}

$placasLote = array_values(array_unique($placas_ssw));
$tamanhoLote = 25;
$carregamentos = [];

for ($i = 0; $i < count($placasLote); $i += $tamanhoLote) {
    $chunk = array_slice($placasLote, $i, $tamanhoLote);
    if (empty($chunk)) continue;

    $act = 'SR_IMP|' . implode('|', array_map('rawurlencode', $chunk));
    $str_retorno = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194?act={$act}");
    $str_decodificada = urldecode($str_retorno);
    $act_download = ssw_get_act($str_decodificada);
    $arq_download = ssw_get_arq($str_decodificada);

    if (empty($act_download) || empty($arq_download)) {
        foreach ($chunk as $p) {
            $logs[] = ['placa' => $p, 'status' => 'erro', 'msg' => 'Não foi possível obter os parâmetros de download do relatório.'];
        }
        continue;
    }

    $relatorio = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act_download}&filename={$arq_download}&path=&down=1&nw=0");
    if (empty($relatorio) || strlen($relatorio) < 50) {
        foreach ($chunk as $p) {
            $logs[] = ['placa' => $p, 'status' => 'erro', 'msg' => 'Relatório vazio ou inválido.'];
        }
        continue;
    }

    $parsed = parseRelatorioCarregamentos($relatorio);
    foreach ($parsed as $placa => $data) {
        if (!isset($carregamentos[$placa])) $carregamentos[$placa] = ['ctes' => [], 'destinos' => []];
        $carregamentos[$placa]['ctes'] = array_merge($carregamentos[$placa]['ctes'], $data['ctes'] ?? []);
        $carregamentos[$placa]['destinos'] = array_merge($carregamentos[$placa]['destinos'], $data['destinos'] ?? []);
    }
}

$placasDoRelatorio = array_map(function($p) {
    return strtoupper(trim((string)$p));
}, array_keys($carregamentos));
$placasDoRelatorio = array_values(array_filter($placasDoRelatorio, function($p) { return $p !== ''; }));
$placas_ssw = array_values(array_unique(array_merge($placas_ssw, $placasDoRelatorio)));

if ($obrigarPlacasReais) {
    $placasCheck = array_values(array_unique(array_filter(array_map(function($p) {
        $s = strtoupper(trim((string)$p));
        return $s !== '' ? $s : null;
    }, $placas_ssw))));

    if ($domainUpper === 'RVE') {
        $placasSuf = [];
        $suffixes = [];
        foreach ($placasCheck as $p) {
            $p = strtoupper(trim((string)$p));
            if ($p === '') continue;
            $suf = strlen($p) >= 4 ? strtoupper(substr($p, -4)) : '';
            $placasSuf[] = ['placa' => $p, 'suf' => $suf];
            if ($suf !== '') $suffixes[$suf] = true;
        }

        $foundSuf = [];
        $suffixList = array_keys($suffixes);
        foreach (array_chunk($suffixList, 500) as $chunk) {
            $ph = [];
            $params = [];
            $i = 1;
            foreach ($chunk as $suf) {
                $ph[] = '$' . $i;
                $params[] = $suf;
                $i += 1;
            }
            if (empty($ph)) continue;
            $q = "SELECT DISTINCT RIGHT(UPPER(BTRIM(placa)), 4) AS suf
                  FROM {$tabelaVeiculo}
                  WHERE RIGHT(UPPER(BTRIM(placa)), 4) IN (" . implode(',', $ph) . ")";
            $r = sql($q, $params, $conn);
            if ($r) {
                while ($row = pg_fetch_assoc($r)) {
                    $s = strtoupper(trim((string)($row['suf'] ?? '')));
                    if ($s !== '') $foundSuf[$s] = true;
                }
            }
        }

        $missing = [];
        foreach ($placasSuf as $item) {
            $placa = (string)($item['placa'] ?? '');
            $suf = (string)($item['suf'] ?? '');
            if ($placa === '') continue;
            if ($suf === '' || !isset($foundSuf[$suf])) $missing[] = $placa;
        }
        $veiculosFaltantes = $missing;
    } else {
        $found = [];
        foreach (array_chunk($placasCheck, 500) as $chunk) {
            $ph = [];
            $params = [];
            $i = 1;
            foreach ($chunk as $placa) {
                $ph[] = '$' . $i;
                $params[] = $placa;
                $i += 1;
            }
            if (empty($ph)) continue;
            $q = "SELECT UPPER(placa) AS placa FROM {$tabelaVeiculo} WHERE UPPER(placa) IN (" . implode(',', $ph) . ")";
            $r = sql($q, $params, $conn);
            if ($r) {
                while ($row = pg_fetch_assoc($r)) {
                    $pl = strtoupper(trim((string)($row['placa'] ?? '')));
                    if ($pl !== '') $found[$pl] = true;
                }
            }
        }

        $missing = [];
        foreach ($placasCheck as $placa) {
            if (!isset($found[$placa])) $missing[] = $placa;
        }
        $veiculosFaltantes = $missing;
    }
}

foreach ($placas_ssw as $placa) {
    $placa = strtoupper(trim((string)$placa));
    if ($placa === '') continue;

    if ($obrigarPlacasReais && in_array($placa, $veiculosFaltantes, true)) {
        $logs[] = ['placa' => $placa, 'status' => 'ignorado', 'msg' => 'Veículo não cadastrado. Placa ignorada (Obrigar placas reais).'];
        continue;
    }
    $placaEsc = pg_escape_string($conn, $placa);

    $placaProvisoriaSalvar = $placa;
    $destinoFromPlaca = null;
    $sufixoRve = null;
    $seqCarregRveAgrupado = 0;

    if ($domainUpper === 'RVE' && preg_match('/^[A-Z0-9]{3}[A-Z0-9]{4}$/', $placa)) {
        $destinoFromPlaca = substr($placa, 0, 3);
        $sufixoRve = substr($placa, 3, 4);
        if ($sufixoRve !== '') {
            $placaRealRve = '';
            $resVeic = sql(
                "SELECT placa FROM {$tabelaVeiculo} WHERE RIGHT(UPPER(BTRIM(placa)), 4) = \$1 ORDER BY (CASE WHEN UPPER(BTRIM(COALESCE(tipo, ''))) IN ('CAMINHAO','CAMINHÃO','CAMINHONETE','TRUCK','CARRETA') THEN 0 ELSE 1 END), LENGTH(BTRIM(placa)) ASC, UPPER(BTRIM(placa)) ASC LIMIT 1",
                [$sufixoRve],
                $conn
            );
            if ($resVeic && pg_num_rows($resVeic) > 0) {
                $rowV = pg_fetch_assoc($resVeic);
                $cand = strtoupper(trim((string)($rowV['placa'] ?? '')));
                if ($cand !== '') $placaRealRve = $cand;
            }

            $resCapMatch = sql(
                "SELECT cap.seq_carregamento, cap.placa_provisoria
                 FROM {$tabelaCap} cap
                 JOIN {$tabela} c
                   ON c.unidade = cap.unidade AND c.seq_carregamento = cap.seq_carregamento
                 WHERE cap.unidade = \$1
                   AND RIGHT(UPPER(BTRIM(cap.placa_provisoria)), 4) = \$2
                   AND COALESCE(cap.simulado, FALSE) = FALSE
                   AND c.data_finalizacao IS NULL
                 ORDER BY cap.seq_carregamento DESC
                 LIMIT 1",
                [$unidade, $sufixoRve],
                $conn
            );
            if ($resCapMatch && pg_num_rows($resCapMatch) > 0) {
                $seqCarregRveAgrupado = (int)pg_fetch_result($resCapMatch, 0, 0);
                $cand = strtoupper(trim((string)pg_fetch_result($resCapMatch, 0, 1)));
                if ($placaRealRve !== '') $placaProvisoriaSalvar = $placaRealRve;
                else if ($cand !== '') $placaProvisoriaSalvar = $cand;
            } else if ($placaRealRve !== '') {
                $placaProvisoriaSalvar = $placaRealRve;
            }
        }
    }

    $destinoFromPlacaEf = null;
    if ($destinoFromPlaca !== null && $destinoFromPlaca !== '') {
        $k = strtoupper(trim((string)$destinoFromPlaca));
        $destinoFromPlacaEf = (string)($mapDestinoCompart[$k] ?? $k);
        $destinoFromPlacaEf = strtoupper(trim((string)$destinoFromPlacaEf));
    }

    $placaProvEsc = pg_escape_string($conn, $placaProvisoriaSalvar);

    $captura = null;
    try {
        $captura = obterPrimeiraCapturaSsw($placa);
    } catch (Exception $e) {
        $captura = null;
    }

    $res_check = sql(
        "SELECT MIN((data_inclusao::timestamp + hora_inclusao::time)) AS inicio_ts, MAX(data_finalizacao) AS data_finalizacao
         FROM {$tabela}
         WHERE unidade = \$1 AND origem_ssw = \$2",
        [$unidade, $placa],
        $conn
    );
    $row_check = ($res_check && pg_num_rows($res_check) > 0) ? pg_fetch_assoc($res_check) : null;
    $inicioTs = $row_check ? (string)($row_check['inicio_ts'] ?? '') : '';
    $ja_existe = $inicioTs !== '';
    $dataInc = $inicioTs !== '' ? substr($inicioTs, 0, 10) : '';
    $horaInc = $inicioTs !== '' ? substr($inicioTs, 11, 8) : '';

    if (is_array($captura) && ($captura['data'] ?? '') !== '' && ($captura['hora'] ?? '') !== '') {
        $dataIncSql = "DATE '" . pg_escape_string($conn, (string)$captura['data']) . "'";
        $horaIncSql = "TIME '" . pg_escape_string($conn, (string)$captura['hora']) . "'";
    } else if ($dataInc !== '' && $horaInc !== '') {
        $dataIncSql = "DATE '" . pg_escape_string($conn, $dataInc) . "'";
        $horaIncSql = "TIME '" . pg_escape_string($conn, $horaInc) . "'";
    } else {
        $dataIncSql = 'CURRENT_DATE';
        $horaIncSql = 'CURRENT_TIME';
    }

    $seqCarreg = 0;
    if ($seqCarregRveAgrupado > 0) {
        $seqCarreg = $seqCarregRveAgrupado;
    } else if ($domainUpper === 'RVE' && $sufixoRve !== null && $sufixoRve !== '' && $placaProvisoriaSalvar !== '') {
        $resSeqPlaca = sql(
            "SELECT cap.seq_carregamento
             FROM {$tabelaCap} cap
             JOIN {$tabela} c
               ON c.unidade = cap.unidade AND c.seq_carregamento = cap.seq_carregamento
             WHERE cap.unidade = \$1
               AND UPPER(cap.placa_provisoria) = UPPER(\$2)
               AND COALESCE(cap.simulado, FALSE) = FALSE
               AND c.data_finalizacao IS NULL
             ORDER BY cap.seq_carregamento DESC
             LIMIT 1",
            [$unidade, $placaProvisoriaSalvar],
            $conn
        );
        if ($resSeqPlaca && pg_num_rows($resSeqPlaca) > 0) {
            $seqCarreg = (int)pg_fetch_result($resSeqPlaca, 0, 0);
            if ($seqCarreg > 0) $seqCarregRveAgrupado = $seqCarreg;
        }
    }
    $reaproveitandoPorPlaca = false;
    $origemCriacaoSalvar = 'SSW';
    if ($seqCarreg <= 0 && $placaProvisoriaSalvar !== '') {
        $resSeqExist = sql(
            "SELECT cap.seq_carregamento,
                    COALESCE(cap.simulado, FALSE) AS simulado
             FROM {$tabelaCap} cap
             JOIN {$tabela} c
               ON c.unidade = cap.unidade AND c.seq_carregamento = cap.seq_carregamento
             WHERE cap.unidade = \$1
               AND UPPER(cap.placa_provisoria) = UPPER(\$2)
               AND c.data_finalizacao IS NULL
             ORDER BY COALESCE(cap.simulado, FALSE) DESC, cap.seq_carregamento DESC
             LIMIT 1",
            [$unidade, $placaProvisoriaSalvar],
            $conn
        );
        if ($resSeqExist && pg_num_rows($resSeqExist) > 0) {
            $seqCarreg = (int)pg_fetch_result($resSeqExist, 0, 0);
            $reaproveitandoPorPlaca = $seqCarreg > 0;
            if ($reaproveitandoPorPlaca) {
                $resOrig = sql(
                    "SELECT origem_criacao
                     FROM {$tabela}
                     WHERE unidade = \$1
                       AND seq_carregamento = \$2
                     ORDER BY data_inclusao ASC, hora_inclusao ASC
                     LIMIT 1",
                    [$unidade, $seqCarreg],
                    $conn
                );
                if ($resOrig && pg_num_rows($resOrig) > 0) {
                    $tmp = strtoupper(trim((string)pg_fetch_result($resOrig, 0, 0)));
                    if ($tmp !== '') $origemCriacaoSalvar = $tmp;
                }
            }
        }
    }
    if ($seqCarreg <= 0 && $placaProvisoriaSalvar !== '') {
        $resSeqCar = sql(
            "SELECT seq_carregamento, origem_criacao
             FROM {$tabela}
             WHERE unidade = \$1
               AND UPPER(placa_provisoria) = UPPER(\$2)
               AND data_finalizacao IS NULL
             ORDER BY COALESCE(seq_carregamento, 0) DESC
             LIMIT 1",
            [$unidade, $placaProvisoriaSalvar],
            $conn
        );
        if ($resSeqCar && pg_num_rows($resSeqCar) > 0) {
            $rowSeqCar = pg_fetch_assoc($resSeqCar);
            $seqCarreg = (int)($rowSeqCar['seq_carregamento'] ?? 0);
            $reaproveitandoPorPlaca = $seqCarreg > 0;
            $tmp = strtoupper(trim((string)($rowSeqCar['origem_criacao'] ?? '')));
            if ($tmp !== '') $origemCriacaoSalvar = $tmp;
        }
    }
    if ($seqCarreg <= 0) {
        $resSeq = @pg_query($conn, "SELECT seq_carregamento FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND origem_ssw = '{$placaEsc}' AND seq_carregamento IS NOT NULL LIMIT 1");
        if ($resSeq && pg_num_rows($resSeq) > 0) {
            $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
        }
    }
    if ($seqCarreg <= 0) {
        $seqCarreg = nextSeqCarregamentoSsw($conn, $seqName);
        if ($seqCarreg <= 0) {
            $logs[] = ['placa' => $placa, 'status' => 'erro', 'msg' => 'Erro ao gerar seq_carregamento.'];
            continue;
        }
    }

    $resSimOrig = sql(
        "SELECT COALESCE(cap.simulado, FALSE) AS simulado
         FROM {$tabela} c
         LEFT JOIN {$tabelaCap} cap
                ON cap.unidade = c.unidade AND cap.seq_carregamento = c.seq_carregamento
         WHERE c.unidade = \$1
           AND c.origem_ssw = \$2
           AND c.data_finalizacao IS NULL
         ORDER BY c.data_inclusao ASC, c.hora_inclusao ASC
         LIMIT 1",
        [$unidade, $placa],
        $conn
    );
    if ($resSimOrig && pg_num_rows($resSimOrig) > 0) {
        $isSim = ((string)pg_fetch_result($resSimOrig, 0, 0) === 't');
        if ($isSim) {
            $logs[] = ['placa' => $placa, 'status' => 'ignorado', 'msg' => 'Carregamento simulado (Presto) não é alterado pela importação do SSW.'];
            continue;
        }
    }
    $resSimSeq = sql(
        "SELECT COALESCE(simulado, FALSE) AS simulado
         FROM {$tabelaCap}
         WHERE unidade = \$1 AND seq_carregamento = \$2
         LIMIT 1",
        [$unidade, $seqCarreg],
        $conn
    );
    if ($resSimSeq && pg_num_rows($resSimSeq) > 0) {
        $isSim = ((string)pg_fetch_result($resSimSeq, 0, 0) === 't');
        if ($isSim) {
            $logs[] = ['placa' => $placa, 'status' => 'ignorado', 'msg' => 'Carregamento simulado (Presto) não é alterado pela importação do SSW.'];
            continue;
        }
    }

    $info = $carregamentos[$placa] ?? null;
    $ctes = $info['ctes'] ?? [];

    $destinosRaw = array_filter(array_map('strtoupper', array_map('trim', $info['destinos'] ?? [])));
    $destinos = [];
    foreach ($destinosRaw as $d) {
        $k = strtoupper(trim((string)$d));
        if ($k === '') continue;
        $destinos[] = $k;
    }
    $destinoCar = null;
    $unidadesCarCsv = '';
    $nroLinhaCar = 0;
    $destUnicos = array_values(array_unique(array_filter($destinos)));
    $linhaDetectada = encontrarLinhaParaDestinosImport($linhasOrigem, $destinosRaw);
    if (is_array($linhaDetectada) && (int)($linhaDetectada['nro_linha'] ?? 0) > 0) {
        $nroLinhaCar = (int)$linhaDetectada['nro_linha'];
        $destFinal = strtoupper(trim((string)($linhaDetectada['sigla_dest'] ?? '')));
        $interFinal = parseUnidadesCsvImportLinha((string)($linhaDetectada['unidades'] ?? ''));

        $interClean = [];
        $seenInter = [];
        foreach ($interFinal as $u) {
            $um = strtoupper(trim((string)$u));
            if ($um === '' || $um === $destFinal) continue;
            if (isset($seenInter[$um])) continue;
            $seenInter[$um] = true;
            $interClean[] = $um;
        }

        $destinoCar = $destFinal !== '' ? $destFinal : null;
        $unidadesCarCsv = count($interClean) > 0 ? implode(',', $interClean) : '';
    } elseif (count($destUnicos) === 1) {
        $destinoCar = $destUnicos[0];
        $unidadesCarCsv = '';
    } elseif (count($destUnicos) > 1) {
        $candidatos = [];
        foreach ($destUnicos as $d) {
            if (isset($destinosLinhaSet[$d])) $candidatos[] = $d;
        }
        if (count($candidatos) === 1) {
            $destinoCar = $candidatos[0];
        } elseif (count($candidatos) > 1) {
            $freq = array_count_values($destinos);
            usort($candidatos, function($a, $b) use ($freq) {
                $fa = (int)($freq[$a] ?? 0);
                $fb = (int)($freq[$b] ?? 0);
                if ($fa === $fb) return strcmp($a, $b);
                return $fb <=> $fa;
            });
            $destinoCar = $candidatos[0] ?? null;
        } else {
            if ($destinoFromPlacaEf !== null && $destinoFromPlacaEf !== '' && in_array(strtoupper($destinoFromPlacaEf), $destUnicos, true)) {
                $destinoCar = strtoupper($destinoFromPlacaEf);
            } else {
                $freq = array_count_values($destinos);
                arsort($freq);
                $destinoCar = array_key_first($freq);
            }
        }

        $outras = array_values(array_filter($destUnicos, function($u) use ($destinoCar) { return $destinoCar ? ($u !== $destinoCar) : true; }));
        sort($outras);
        $unidadesCarCsv = implode(',', $outras);
    } else {
        if ($destinoFromPlacaEf !== null && $destinoFromPlacaEf !== '') {
            $destinoCar = strtoupper($destinoFromPlacaEf);
        }
        $unidadesCarCsv = '';
    }

    if ($nroLinhaCar <= 0 && $destinoCar !== null && $destinoCar !== '') {
        try {
            $resLinhaB = null;
            if (trim($unidadesCarCsv) !== '') {
                $resLinhaB = sql(
                    "SELECT nro_linha
                     FROM {$tabelaLinha}
                     WHERE UPPER(BTRIM(sigla_emit)) = \$1
                       AND UPPER(BTRIM(sigla_dest)) = \$2
                       AND regexp_replace(UPPER(COALESCE(unidades, '')), '\\s+', '', 'g') = regexp_replace(UPPER(\$3), '\\s+', '', 'g')
                     ORDER BY nro_linha DESC
                     LIMIT 1",
                    [$unidade, $destinoCar, $unidadesCarCsv],
                    $conn
                );
            }

            if (!$resLinhaB || pg_num_rows($resLinhaB) === 0) {
                $resLinhaB = sql(
                    "SELECT nro_linha
                     FROM {$tabelaLinha}
                     WHERE UPPER(BTRIM(sigla_emit)) = \$1
                       AND UPPER(BTRIM(sigla_dest)) = \$2
                     ORDER BY nro_linha DESC
                     LIMIT 1",
                    [$unidade, $destinoCar],
                    $conn
                );
            }

            if ($resLinhaB && pg_num_rows($resLinhaB) > 0) {
                $nroLinhaCar = (int)pg_fetch_result($resLinhaB, 0, 0);
            }
        } catch (Exception $e) {}
    }

    $destinoCarEsc = $destinoCar ? ("'" . pg_escape_string($conn, $destinoCar) . "'") : 'NULL';
    $unidadesCarEsc = ($unidadesCarCsv !== '') ? ("'" . pg_escape_string($conn, $unidadesCarCsv) . "'") : 'NULL';
    $nroLinhaCarEsc = ($nroLinhaCar > 0) ? (string)$nroLinhaCar : 'NULL';

    pg_query($conn, 'BEGIN');
    try {
        $inseridos = 0;
        $ignoradosEmOutro = 0;
        if ($reaproveitandoPorPlaca && $seqCarreg > 0) {
            $resDup = sql(
                "SELECT DISTINCT c.seq_carregamento
                 FROM {$tabela} c
                 WHERE c.unidade = \$1
                   AND c.data_finalizacao IS NULL
                   AND UPPER(COALESCE(c.origem_criacao, '')) = 'SSW'
                   AND UPPER(COALESCE(c.origem_ssw, '')) = UPPER(\$2)
                   AND COALESCE(c.seq_carregamento, 0) <> \$3",
                [$unidade, $placa, $seqCarreg],
                $conn
            );
            if ($resDup && pg_num_rows($resDup) > 0) {
                while ($rowDup = pg_fetch_assoc($resDup)) {
                    $seqDup = (int)($rowDup['seq_carregamento'] ?? 0);
                    if ($seqDup <= 0) continue;
                    sql("DELETE FROM {$tabela} WHERE unidade = \$1 AND seq_carregamento = \$2", [$unidade, $seqDup], $conn);
                    sql("DELETE FROM {$tabelaCap} WHERE unidade = \$1 AND seq_carregamento = \$2", [$unidade, $seqDup], $conn);
                }
            }
        }
        $resHdr = pg_query($conn,
            "UPDATE {$tabela}
             SET placa_provisoria = '{$placaProvEsc}',
                 origem_ssw = '{$placaEsc}',
                 seq_carregamento = " . ($seqCarregRveAgrupado > 0 ? (string)$seqCarreg : "CASE WHEN seq_carregamento IS NULL OR seq_carregamento = 0 THEN {$seqCarreg} ELSE seq_carregamento END") . ",
                 destino = {$destinoCarEsc},
                 unidades = {$unidadesCarEsc},
                 origem_criacao = '" . pg_escape_string($conn, $origemCriacaoSalvar) . "',
                 data_finalizacao = NULL,
                 hora_finalizacao = NULL,
                 login_finalizacao = NULL
             WHERE UPPER(unidade) = '{$unidadeEsc}'
               AND seq_carregamento = {$seqCarreg}"
        );
        if ($resHdr === false) throw new Exception(pg_last_error($conn));

        @pg_query($conn, "
            CREATE TABLE IF NOT EXISTS {$tabelaCap} (
                unidade          VARCHAR(10) NOT NULL,
                seq_carregamento INT NOT NULL,
                placa_provisoria VARCHAR(20) NOT NULL,
                cap_ton          NUMERIC,
                cap_m3           NUMERIC,
                vlr_frete_carreteiro NUMERIC,
                simulado         BOOLEAN DEFAULT FALSE,
                nro_linha        INT,
                PRIMARY KEY (unidade, seq_carregamento)
            )
        ");
        @pg_query($conn,
            "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, nro_linha)
             VALUES ('{$unidadeEsc}', {$seqCarreg}, '{$placaProvEsc}', {$nroLinhaCarEsc})
             ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha), simulado = FALSE"
        );

        if (empty($ctes)) {
            $resAny = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND seq_carregamento = {$seqCarreg} LIMIT 1");
            if (!$resAny || pg_num_rows($resAny) === 0) {
                $resInsSent = pg_query(
                    $conn,
                    "INSERT INTO {$tabela}
                     (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                      nro_cte, destino, unidades, origem_ssw, origem_criacao, unidade_carregamento)
                     VALUES
                     ('{$unidadeEsc}', {$seqCarreg}, '{$placaProvEsc}', '{$loginEsc}', {$dataIncSql}, {$horaIncSql},
                      0, {$destinoCarEsc}, {$unidadesCarEsc}, '{$placaEsc}', '" . pg_escape_string($conn, $origemCriacaoSalvar) . "', '{$unidadeEsc}')"
                );
                if (!$resInsSent) throw new Exception(pg_last_error($conn));
            }
        } else {
            foreach ($ctes as $cte_info) {
                $ser = pg_escape_string($conn, strtoupper(trim($cte_info['ser_cte'] ?? '')));
                $nro = (int)($cte_info['nro_cte'] ?? 0);
                if ($ser === '' || $nro <= 0) continue;

                $check_dup = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND seq_carregamento = {$seqCarreg} AND ser_cte = '{$ser}' AND nro_cte = {$nro} LIMIT 1");
                if ($check_dup && pg_num_rows($check_dup) > 0) {
                    $destinoCte = pg_escape_string($conn, strtoupper(trim($cte_info['destino_cte'] ?? '')));
                    $remetente  = pg_escape_string($conn, trim($cte_info['remetente'] ?? ''));
                    $pagador    = pg_escape_string($conn, trim($cte_info['pagador'] ?? ''));
                    $destinat   = pg_escape_string($conn, trim($cte_info['destinatario'] ?? ''));
                    $cidade     = pg_escape_string($conn, trim($cte_info['cidade'] ?? ''));

                    $emissao = trim($cte_info['emissao'] ?? '');
                    $prevEnt = trim($cte_info['prev_ent'] ?? '');
                    $emissaoSql = preg_match('/^\\d{2}\\/\\d{2}\\/\\d{4}$/', $emissao) ? "TO_DATE('{$emissao}', 'DD/MM/YYYY')" : 'NULL';
                    $prevEntSql = preg_match('/^\\d{2}\\/\\d{2}\\/\\d{4}$/', $prevEnt) ? "TO_DATE('{$prevEnt}', 'DD/MM/YYYY')" : 'NULL';

                    $vlrMerc  = normalizarNumero($cte_info['vlr_merc']  ?? 0);
                    $vlrFrete = normalizarNumero($cte_info['vlr_frete'] ?? 0);
                    $pesoVal  = normalizarNumero($cte_info['peso']      ?? 0);
                    $cubVal   = normalizarNumero($cte_info['cubagem']   ?? 0);
                    $qtdeVol  = (int)($cte_info['qtde_vol'] ?? 0);

                    $resUpdCte = pg_query($conn,
                        "UPDATE {$tabela}
                         SET placa_provisoria = '{$placaProvEsc}',
                             origem_ssw = '{$placaEsc}',
                             seq_carregamento = " . ($seqCarregRveAgrupado > 0 ? (string)$seqCarreg : "CASE WHEN seq_carregamento IS NULL OR seq_carregamento = 0 THEN {$seqCarreg} ELSE seq_carregamento END") . ",
                             destino = {$destinoCarEsc},
                             unidades = {$unidadesCarEsc},
                             destino_cte = '{$destinoCte}',
                             data_emissao_cte = {$emissaoSql},
                             data_prev_ent_cte = {$prevEntSql},
                             remetente_cte = '{$remetente}',
                             destinatario_cte = '{$destinat}',
                             pagador_cte = '{$pagador}',
                             cidade_destino_cte = '{$cidade}',
                             vlr_merc_cte = {$vlrMerc},
                             vlr_frete_cte = {$vlrFrete},
                             peso_cte = {$pesoVal},
                             cubagem_cte = {$cubVal},
                             qtde_vol_cte = {$qtdeVol},
                             origem_criacao = '" . pg_escape_string($conn, $origemCriacaoSalvar) . "',
                             data_finalizacao = NULL,
                             hora_finalizacao = NULL,
                             login_finalizacao = NULL
                         WHERE UPPER(unidade) = '{$unidadeEsc}'
                           AND seq_carregamento = {$seqCarreg}
                           AND ser_cte = '{$ser}'
                           AND nro_cte = {$nro}"
                    );
                    if (!$resUpdCte) throw new Exception(pg_last_error($conn));
                    continue;
                }

                $check_outro = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND data_finalizacao IS NULL AND ser_cte = '{$ser}' AND nro_cte = {$nro} AND COALESCE(seq_carregamento, 0) <> {$seqCarreg} LIMIT 1");
                if ($check_outro && pg_num_rows($check_outro) > 0) { $ignoradosEmOutro++; continue; }

                $destinoCte = pg_escape_string($conn, strtoupper(trim($cte_info['destino_cte'] ?? '')));
                $remetente  = pg_escape_string($conn, trim($cte_info['remetente'] ?? ''));
                $pagador    = pg_escape_string($conn, trim($cte_info['pagador'] ?? ''));
                $destinat   = pg_escape_string($conn, trim($cte_info['destinatario'] ?? ''));
                $cidade     = pg_escape_string($conn, trim($cte_info['cidade'] ?? ''));

                $emissao = trim($cte_info['emissao'] ?? '');
                $prevEnt = trim($cte_info['prev_ent'] ?? '');
                $emissaoSql = preg_match('/^\\d{2}\\/\\d{2}\\/\\d{4}$/', $emissao) ? "TO_DATE('{$emissao}', 'DD/MM/YYYY')" : 'NULL';
                $prevEntSql = preg_match('/^\\d{2}\\/\\d{2}\\/\\d{4}$/', $prevEnt) ? "TO_DATE('{$prevEnt}', 'DD/MM/YYYY')" : 'NULL';

                $vlrMerc  = normalizarNumero($cte_info['vlr_merc']  ?? 0);
                $vlrFrete = normalizarNumero($cte_info['vlr_frete'] ?? 0);
                $pesoVal  = normalizarNumero($cte_info['peso']      ?? 0);
                $cubVal   = normalizarNumero($cte_info['cubagem']   ?? 0);
                $qtdeVol  = (int)($cte_info['qtde_vol'] ?? 0);

                $resIns = pg_query($conn,
                    "INSERT INTO {$tabela}
                     (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                      destino, unidades,
                      ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                      remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                      vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                      origem_ssw, origem_criacao, unidade_carregamento)
                     VALUES
                     ('{$unidadeEsc}', {$seqCarreg}, '{$placaProvEsc}', '{$loginEsc}', {$dataIncSql}, {$horaIncSql},
                      {$destinoCarEsc}, {$unidadesCarEsc},
                      '{$ser}', {$nro}, '{$destinoCte}', {$emissaoSql}, {$prevEntSql},
                      '{$remetente}', '{$destinat}', '{$pagador}', '{$cidade}',
                      {$vlrMerc}, {$vlrFrete}, {$pesoVal}, {$cubVal}, {$qtdeVol},
                      '{$placaEsc}', '" . pg_escape_string($conn, $origemCriacaoSalvar) . "', '{$unidadeEsc}')"
                );
                if (!$resIns) throw new Exception(pg_last_error($conn));
                $inseridos++;
            }
        }

        pg_query($conn, 'COMMIT');
        $status = $ja_existe ? 'atualizado' : 'importado';
        $msg = ($placaProvisoriaSalvar !== $placa)
            ? "{$inseridos} CT-e(s) importado(s). Agrupado em {$placaProvisoriaSalvar}."
            : "{$inseridos} CT-e(s) importado(s).";
        if ($ignoradosEmOutro > 0) {
            $msg .= " {$ignoradosEmOutro} CT-e(s) ignorado(s) por já estarem em outro carregamento.";
        }
        $logs[] = ['placa' => $placa, 'status' => $status, 'msg' => $msg];
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        $logs[] = ['placa' => $placa, 'status' => 'erro', 'msg' => 'Erro ao salvar: ' . $e->getMessage()];
    }
}

$placasUp = array_values(array_unique(array_filter(array_map(function($p) {
    $s = strtoupper(trim((string)$p));
    return $s !== '' ? $s : null;
}, $placas_ssw))));
if (count($placasUp) > 0) {
    $saidas = [];
    try {
        $saidas = listarSaidasAutorizadasSsw0125($unidade);
    } catch (Exception $e) {
        $saidas = [];
    }

    foreach ($saidas as $s) {
        $p = strtoupper(trim((string)($s['placa'] ?? '')));
        $d = (string)($s['data'] ?? '');
        $h = (string)($s['hora'] ?? '');
        $raw = (string)($s['raw'] ?? '');
        if ($p === '' || $d === '' || $h === '') continue;

        $affected = 0;
        try {
            $resUp = sql(
                "UPDATE {$tabela}
                 SET data_finalizacao = \$3,
                     hora_finalizacao = \$4,
                     login_finalizacao = \$5
                 WHERE unidade = \$1
                   AND data_finalizacao IS NULL
                   AND UPPER(placa_provisoria) = UPPER(\$2)",
                [$unidade, $p, $d, $h, $login],
                $conn
            );
            if ($resUp) $affected = (int)pg_affected_rows($resUp);
        } catch (Exception $e) {
            $affected = 0;
        }

        if ($affected <= 0 && $domainUpper === 'RVE' && preg_match('/^[A-Z0-9]{4,10}$/', $p)) {
            $suf = substr($p, -4);
            if ($suf !== '') {
                try {
                    $resUp = sql(
                        "UPDATE {$tabela}
                         SET data_finalizacao = \$3,
                             hora_finalizacao = \$4,
                             login_finalizacao = \$5
                         WHERE unidade = \$1
                           AND data_finalizacao IS NULL
                           AND RIGHT(UPPER(placa_provisoria), 4) = RIGHT(UPPER(\$2), 4)",
                        [$unidade, $p, $d, $h, $login],
                        $conn
                    );
                    if ($resUp) $affected = (int)pg_affected_rows($resUp);
                } catch (Exception $e) {
                    $affected = 0;
                }
            }
        }

        if ($affected > 0) {
            $logs[] = ['placa' => $p, 'status' => 'aviso', 'msg' => "Carregamento finalizado automaticamente (manifesto autorizado em {$raw})."];
        }
    }

    $inUp = implode(',', array_map(function($p) use ($conn) {
        return "'" . pg_escape_string($conn, strtoupper(trim((string)$p))) . "'";
    }, $placasUp));
    $loginEsc = pg_escape_string($conn, $login);
    $resFin = @pg_query(
        $conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '{$loginEsc}'
         WHERE UPPER(unidade) = '{$unidadeEsc}'
           AND data_finalizacao IS NULL
           AND origem_ssw IS NOT NULL AND origem_ssw <> ''
           AND UPPER(origem_ssw) NOT IN ({$inUp})"
    );
    if ($resFin) $finalizadosSumiramSsw = (int)pg_affected_rows($resFin);
}

respondJson([
    'success' => true,
    'obrigar_placas_reais' => $obrigarPlacasReais,
    'veiculos_faltantes' => $veiculosFaltantes,
    'import_veiculos_recentes' => [
        'success' => $importVeiculosRecentesOk,
        'message' => $importVeiculosRecentesOk ? '' : ($importVeiculosRecentesMsg !== '' ? $importVeiculosRecentesMsg : 'Erro ao importar veículos recentes.'),
    ],
    'placas_ssw' => $placas_ssw,
    'finalizados_sumiram_ssw' => $finalizadosSumiramSsw,
    'logs' => $logs,
]);

/*
 * =========================================================================
 *  SCRIPT SQL DE CORREÇÃO — ITEM 7: UPDATE nro_linha EM [dominio]_carregamento
 * =========================================================================
 *
 * Substitua [dominio] pelo prefixo do cliente (ex.: rve, acv, vix etc.)
 * e execute os blocos abaixo SEPARADAMENTE no PostgreSQL (descomente cada
 * bloco antes de rodar).
 *
 * -----------------------------------------------------------------------
 * PASSO 1 — Atualizações por match exato (unidade, dest, CSV das paradas)
 * -----------------------------------------------------------------------
 * Atualiza nro_linha + destino para carregamentos SEM linha, onde
 * conseguimos casar exatamente (sigla_emit, sigla_dest, unidades) com
 * uma linha já cadastrada.
 *
 * UPDATE [dominio]_carregamento c
 * SET nro_linha = l.nro_linha,
 *     destino    = l.sigla_dest
 * FROM [dominio]_linha l
 * WHERE COALESCE(c.nro_linha, 0) = 0
 *   AND UPPER(l.sigla_emit) = UPPER(c.unidade)
 *   AND UPPER(l.sigla_dest) = UPPER(COALESCE(c.destino, ''))
 *   AND COALESCE(NULLIF(UPPER(TRIM(BOTH ',' FROM l.unidades)), ''), '***')
 *     = COALESCE(NULLIF(UPPER(TRIM(BOTH ',' FROM c.unidades)), ''), '***');
 *
 * -----------------------------------------------------------------------
 * PASSO 2 — Heurística complementar (match por emit + dest, se CSV diferir)
 * -----------------------------------------------------------------------
 * Cobre carregamentos ainda sem linha após PASSO 1.
 * Pega a linha mais recente (maior nro_linha) com mesma origem/destino.
 *
 * WITH matches AS (
 *     SELECT
 *         c.seq_carregamento,
 *         c.placa_provisoria,
 *         (
 *             SELECT l.nro_linha
 *             FROM [dominio]_linha l
 *             WHERE UPPER(l.sigla_emit) = UPPER(c.unidade)
 *               AND UPPER(l.sigla_dest) = UPPER(COALESCE(c.destino, ''))
 *             ORDER BY l.nro_linha DESC
 *             LIMIT 1
 *         ) AS nro_linha_sugerida
 *     FROM [dominio]_carregamento c
 *     WHERE COALESCE(c.nro_linha, 0) = 0
 *       AND COALESCE(c.destino, '') <> ''
 *     GROUP BY c.seq_carregamento, c.placa_provisoria, c.unidade, c.destino
 * )
 * UPDATE [dominio]_carregamento c
 * SET nro_linha = m.nro_linha_sugerida,
 *     destino   = COALESCE((SELECT UPPER(l2.sigla_dest)
 *                            FROM [dominio]_linha l2
 *                            WHERE l2.nro_linha = m.nro_linha_sugerida), c.destino)
 * FROM matches m
 * WHERE COALESCE(c.nro_linha, 0) = 0
 *   AND m.nro_linha_sugerida IS NOT NULL
 *   AND c.seq_carregamento = m.seq_carregamento;
 *
 * -----------------------------------------------------------------------
 * PASSO 3 — CASO ESPECÍFICO RVE: seq_carregamento = 71  (MTZ → SOR)
 * -----------------------------------------------------------------------
 * Força nro_linha para a linha MTZ→SOR e coluna destino = 'SOR',
 * corrigindo o problema atual onde ele aparece com destino LVR.
 *
 * Use UMA das duas opções abaixo (deixe a outra comentada):
 *
 * -- Opção A: Se você sabe qual o nro_linha da linha MTZ → SOR:
 * UPDATE rve_carregamento
 * SET nro_linha = 9999,       -- ← COLOQUE AQUI o nro_linha REAL de MTZ→SOR
 *     destino   = 'SOR'
 * WHERE seq_carregamento = 71
 *   AND unidade = 'MTZ';
 *
 * -- Opção B: Busca automaticamente a linha MTZ→SOR (maior nro_linha):
 * UPDATE rve_carregamento c
 * SET nro_linha = (
 *         SELECT l.nro_linha
 *         FROM rve_linha l
 *         WHERE UPPER(l.sigla_emit) = 'MTZ'
 *           AND UPPER(l.sigla_dest) = 'SOR'
 *         ORDER BY l.nro_linha DESC
 *         LIMIT 1
 *     ),
 *     destino = 'SOR'
 * WHERE c.seq_carregamento = 71
 *   AND c.unidade = 'MTZ';
 *
 * -----------------------------------------------------------------------
 * PASSO 4 — OPCIONAL (pós-associação): sobrescreve destino usando SEMPRE
 * a sigla_dest da linha associada (garante consistência histórica).
 * -----------------------------------------------------------------------
 *
 * UPDATE [dominio]_carregamento c
 * SET destino = (SELECT UPPER(l.sigla_dest)
 *                FROM [dominio]_linha l
 *                WHERE l.nro_linha = c.nro_linha
 *                LIMIT 1)
 * WHERE COALESCE(c.nro_linha, 0) > 0
 *   AND EXISTS (SELECT 1 FROM [dominio]_linha l WHERE l.nro_linha = c.nro_linha);
 *
 * =========================================================================
 */
