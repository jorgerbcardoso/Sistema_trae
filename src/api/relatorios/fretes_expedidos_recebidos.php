<?php
require_once __DIR__ . '/../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];
$g_sql = connect();

$input = getRequestInput();

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Erro fatal PHP: ' . $err['message'] . ' em ' . $err['file'] . ':' . $err['line']], JSON_UNESCAPED_UNICODE);
    }
});

$step = strtoupper(trim((string)($input['step'] ?? 'RUN')));
if (!in_array($step, ['RUN', 'START', 'POLL', 'DOWNLOAD'], true)) $step = 'RUN';

$actIn = trim((string)($input['act'] ?? ''));

$allowedSswUsers = ['presto', 'damasce1', 'claraj'];
$normSswUser = static function(string $s): string {
    $s = html_entity_decode((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return strtolower(trim($s));
};

$siglaUnid = strtoupper(trim((string)($input['sigla_unid'] ?? '')));
$cgcCliente = preg_replace('/\D+/', '', (string)($input['cgc_cliente'] ?? ''));
$tpCliente = strtoupper(trim((string)($input['tp_cliente'] ?? '')));

$emissaoIni = trim((string)($input['periodo_emissao_ini'] ?? ''));
$emissaoFim = trim((string)($input['periodo_emissao_fim'] ?? ''));
$entregaIni = trim((string)($input['periodo_entrega_ini'] ?? ''));
$entregaFim = trim((string)($input['periodo_entrega_fim'] ?? ''));

$knownSiglas = null;
try {
    $resSiglas = sql("SELECT UPPER(sigla) AS sigla FROM {$domain}_unidade", [], $g_sql);
    if ($resSiglas) {
        $knownSiglas = [];
        while ($row = pg_fetch_assoc($resSiglas)) {
            $s = strtoupper(trim((string)($row['sigla'] ?? '')));
            if ($s !== '') $knownSiglas[$s] = true;
        }
    }
} catch (Throwable $e) {
    $knownSiglas = null;
}

$validDate = static function(string $s): bool {
    if ($s === '') return false;
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) === 1;
};

$diffDays = static function(string $ini, string $fim): int {
    $a = strtotime($ini);
    $b = strtotime($fim);
    if (!$a || !$b) return 0;
    $delta = (int)floor(($b - $a) / 86400);
    return $delta;
};

if ($siglaUnid !== '' && !preg_match('/^[A-Z0-9]{2,5}$/', $siglaUnid)) {
    respondJson(['success' => false, 'message' => 'Sigla da unidade inválida.']);
}

if ($cgcCliente !== '' && strlen($cgcCliente) < 11) {
    respondJson(['success' => false, 'message' => 'CNPJ/CPF do cliente inválido.']);
}

if ($tpCliente !== '' && !in_array($tpCliente, ['R', 'D', 'P'], true)) {
    respondJson(['success' => false, 'message' => 'Tipo de cliente inválido (use R, D ou P).']);
}

$hasEmissao = ($emissaoIni !== '' || $emissaoFim !== '');
$hasEntrega = ($entregaIni !== '' || $entregaFim !== '');

if (in_array($step, ['RUN', 'START'], true)) {
    if (!$hasEmissao && !$hasEntrega) {
        respondJson(['success' => false, 'message' => 'Informe pelo menos 1 período (emissão ou entrega).']);
    }

    if ($hasEmissao) {
        if (!$validDate($emissaoIni) || !$validDate($emissaoFim)) {
            respondJson(['success' => false, 'message' => 'Período de emissão inválido (informe início e fim).']);
        }
        if (strtotime($emissaoIni) > strtotime($emissaoFim)) {
            respondJson(['success' => false, 'message' => 'Período de emissão inválido (início maior que fim).']);
        }
        if ($diffDays($emissaoIni, $emissaoFim) > 31) {
            respondJson(['success' => false, 'message' => 'Período de emissão não pode ser maior que 31 dias.']);
        }
    }

    if ($hasEntrega) {
        if (!$validDate($entregaIni) || !$validDate($entregaFim)) {
            respondJson(['success' => false, 'message' => 'Período de entrega inválido (informe início e fim).']);
        }
        if (strtotime($entregaIni) > strtotime($entregaFim)) {
            respondJson(['success' => false, 'message' => 'Período de entrega inválido (início maior que fim).']);
        }
        if ($diffDays($entregaIni, $entregaFim) > 31) {
            respondJson(['success' => false, 'message' => 'Período de entrega não pode ser maior que 31 dias.']);
        }
    }
}

ssw_login($domain);
set_time_limit(180);
ini_set('memory_limit', '512M');

$extractXml = static function(string $s): string {
    $pos = stripos($s, '<xml');
    if ($pos === false) return $s;
    $s = substr($s, $pos);
    $end = stripos($s, '</xml>');
    if ($end === false) return $s;
    return substr($s, 0, $end) . '</xml>';
};

$normStatus = static function(string $s): string {
    $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $s = strtoupper(trim($s));
    $s = str_replace(['Á','À','Â','Ã','Ä'], 'A', $s);
    $s = str_replace(['É','È','Ê','Ë'], 'E', $s);
    $s = str_replace(['Í','Ì','Î','Ï'], 'I', $s);
    $s = str_replace(['Ó','Ò','Ô','Õ','Ö'], 'O', $s);
    $s = str_replace(['Ú','Ù','Û','Ü'], 'U', $s);
    $s = str_replace(['Ç'], 'C', $s);
    $s = str_replace(["\xc2\xa0", "\xa0"], ' ', $s);
    $s = preg_replace('/\s+/', ' ', $s);
    return $s;
};

$parse1440RowsByRegex = static function(string $raw): array {
    $raw = (string)$raw;
    if ($raw === '') return [];

    $decoded = html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    if (!preg_match_all('/<r>(.*?)<\/r>/s', $decoded, $mm)) {
        return [];
    }

    $rows = [];
    foreach ($mm[1] as $block) {
        $seq = null;
        $opc = '';
        $usr = '';
        $sit = '';
        $f8  = '';
        $f2  = '';

        if (preg_match('/<f0>(\d+)<\/f0>/', $block, $m0)) $seq = (int)$m0[1];
        if (preg_match('/<f1>(.*?)<\/f1>/s', $block, $m1)) $opc = trim(strip_tags((string)$m1[1]));
        if (preg_match('/<f2>(.*?)<\/f2>/s', $block, $m2)) $f2 = trim(strip_tags((string)$m2[1]));
        if (preg_match('/<f3>(.*?)<\/f3>/s', $block, $m3)) $usr = trim(strip_tags((string)$m3[1]));
        if (preg_match('/<f6>(.*?)<\/f6>/s', $block, $m6)) $sit = trim(strip_tags((string)$m6[1]));
        if (preg_match('/<f8>(.*?)<\/f8>/s', $block, $m8)) $f8 = (string)$m8[1];

        if (!$seq) continue;

        $rows[] = [
            'seq' => (int)$seq,
            'opc' => (string)$opc,
            'f2'  => (string)$f2,
            'usr' => (string)$usr,
            'sit' => (string)$sit,
            'f8'  => (string)$f8,
        ];
        if (count($rows) >= 200) break;
    }

    return $rows;
};

$parse1440RowsFromRaw = static function(string $raw) use ($extractXml, $parse1440RowsByRegex): array {
    $raw = (string)$raw;
    if ($raw === '') return [];

    $candidates = [$raw];

    $ud = urldecode($raw);
    if ($ud !== $raw) $candidates[] = $ud;

    $he = html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($he !== $raw) $candidates[] = $he;

    $udhe = urldecode($he);
    if ($udhe !== $he && $udhe !== $raw) $candidates[] = $udhe;

    foreach ($candidates as $cand) {
        $xmlOnly = $extractXml((string)$cand);
        $parsed = @simplexml_load_string($xmlOnly);
        if ($parsed) {
            $rows = [];
            for ($i = 0; $i <= 200; $i++) {
                $seq = $parsed->xpath('rs/r/f0')[$i] ?? null;
                if ($seq === null) break;

                $rows[] = [
                    'seq' => (int)$seq,
                    'opc' => (string)($parsed->xpath('rs/r/f1')[$i] ?? ''),
                    'f2'  => (string)($parsed->xpath('rs/r/f2')[$i] ?? ''),
                    'usr' => (string)($parsed->xpath('rs/r/f3')[$i] ?? ''),
                    'f4'  => (string)($parsed->xpath('rs/r/f4')[$i] ?? ''),
                    'sit' => (string)($parsed->xpath('rs/r/f6')[$i] ?? ''),
                    'f8'  => (string)($parsed->xpath('rs/r/f8')[$i] ?? ''),
                ];
            }
            if (!empty($rows)) return $rows;
        }

        $rxRows = $parse1440RowsByRegex($xmlOnly);
        if (!empty($rxRows)) return $rxRows;
    }

    return [];
};

$sswFetch = static function(string $url, int $tries = 3): string {
    $last = '';
    for ($i = 0; $i < $tries; $i++) {
        $s = (string)ssw_go($url);
        $last = $s;
        if ($s === '') {
            usleep(300000);
            continue;
        }
        if (stripos($s, '504 Gateway Time-out') !== false) {
            usleep(350000);
            continue;
        }
        return $s;
    }
    return (string)$last;
};

$lerXml1440 = static function() use ($extractXml, $sswFetch): ?SimpleXMLElement {
    $raw = (string)$sswFetch('https://sistema.ssw.inf.br/bin/ssw1440', 3);
    if ($raw === '') return null;
    if (stripos($raw, '504 Gateway Time-out') !== false) return null;
    $xmlStr = $extractXml($raw);
    if (stripos($xmlStr, '<xml') === false) return null;
    return @simplexml_load_string($xmlStr) ?: null;
};

$get1440Rows = static function() use ($parse1440RowsFromRaw, $sswFetch): array {
    $raw = (string)$sswFetch('https://sistema.ssw.inf.br/bin/ssw1440', 3);
    return $parse1440RowsFromRaw($raw);
};

$downloadFromAct = static function(string $act) use ($sswFetch): ?array {
    $dummy = (string)((int)(microtime(true) * 1000));
    $url = 'https://sistema.ssw.inf.br/bin/ssw1440?act=' . urlencode($act) . '&web_body=&dummy=' . $dummy;
    $t0 = microtime(true);
    $html = (string)$sswFetch($url, 3);
    $t1 = microtime(true);

    if (!preg_match('/id=web_body[^>]*value="([^"]+)"/', $html, $mVal)) {
        if (!preg_match('/name=web_body[^>]*value="([^"]+)"/', $html, $mVal)) {
            return null;
        }
    }

    $decoded = urldecode((string)$mVal[1]);
    if (!preg_match("/abrir\\s*\\(\\s*'([^']+)'\\s*,\\s*'[^']*'\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*'([^']+)'/", $decoded, $mArq)) {
        return null;
    }

    $filename = (string)$mArq[1];
    $path = (string)$mArq[2];
    if ($filename === '' || $path === '') return null;

    $t2 = microtime(true);
    $file = (string)$sswFetch('https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($filename) . '&filename=' . urlencode($filename) . '&path=' . urlencode($path) . '&down=1&nw=1', 3);
    $t3 = microtime(true);
    if ($file === '' || strlen($file) < 50) return null;

    return [
        'filename' => $filename,
        'path' => $path,
        'content' => $file,
        'timing_ms' => [
            'ssw1440_act' => (int)round(($t1 - $t0) * 1000),
            'ssw0424' => (int)round(($t3 - $t2) * 1000),
        ],
        'size_bytes' => [
            'ssw1440_html' => strlen($html),
            'file' => strlen($file),
        ],
    ];
};

$parseMoney = static function(string $s): float {
    $s = trim($s);
    if ($s === '') return 0.0;
    $neg = false;
    if (strpos($s, '-') !== false) $neg = true;
    $s = preg_replace('/[^0-9,\\.\\-]/', '', $s);
    $s = str_replace('.', '', $s);
    $s = str_replace(',', '.', $s);
    $v = (float)$s;
    return $neg ? -abs($v) : $v;
};

$parseIntBr = static function(string $s): int {
    $s = trim($s);
    if ($s === '') return 0;
    $s = preg_replace('/[^0-9\\-]/', '', str_replace('.', '', $s));
    return (int)$s;
};

$deriveBreaks = static function(string $delim): array {
    $plus = [];
    $len = strlen($delim);
    for ($i = 0; $i < $len; $i++) {
        if ($delim[$i] === '+') $plus[] = $i;
    }
    return $plus;
};

$splitByBreaks = static function(string $line, array $plus): array {
    $parts = [];
    $len = strlen($line);
    $starts = [0];
    foreach ($plus as $p) $starts[] = $p + 1;
    $ends = [];
    foreach ($plus as $p) $ends[] = $p;
    $ends[] = $len;

    $count = min(count($starts), count($ends));
    for ($i = 0; $i < $count; $i++) {
        $start = $starts[$i];
        $end = $ends[$i];
        if ($end < $start) $end = $start;
        $parts[] = trim(substr($line, $start, $end - $start));
    }
    return $parts;
};

$parseTxt = static function(string $content, string $tipo) use ($deriveBreaks, $splitByBreaks, $parseMoney, $parseIntBr, $knownSiglas): array {
    $content = mb_convert_encoding($content, 'UTF-8', 'ISO-8859-1');
    $content = str_replace("\r\n", "\n", str_replace("\r", "\n", $content));
    $content = str_replace("\f", "\n", $content);
    $content = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $content);

    $lines = explode("\n", $content);

    $groups = [];
    $current = null;
    $plus = [];
    $periodo = '';

    $flush = static function() use (&$groups, &$current) {
        if ($current && !empty($current['unidade_base_sigla'])) {
            $groups[] = $current;
        }
        $current = null;
    };

    foreach ($lines as $rawLine) {
        $line = rtrim((string)$rawLine);
        $trim = trim($line);
        if ($trim === '') continue;

        if (strpos($trim, 'UNIDADE ') === 0 && strpos($trim, ':') !== false) {
            if (strpos($trim, 'EXPEDIDORA') !== false || strpos($trim, 'RECEBEDORA') !== false) {
                $flush();
                $label = trim(substr($trim, strpos($trim, ':') + 1));
                $sigla = strtoupper(substr($label, 0, 3));
                $current = [
                    'tipo' => $tipo,
                    'unidade_base_sigla' => $sigla,
                    'unidade_base_nome' => $label,
                    'periodo_emissao' => $periodo,
                    'rows' => [],
                    'total' => null,
                ];
                continue;
            }
        }

        if (strpos($trim, 'PERIODO DE EMISSAO') === 0 && strpos($trim, ':') !== false) {
            $periodo = trim(substr($trim, strpos($trim, ':') + 1));
            if ($current) $current['periodo_emissao'] = $periodo;
            continue;
        }

        if ($trim[0] === '-' && strpos($trim, '+') !== false) {
            $plus = $deriveBreaks($trim);
            continue;
        }

        if (!$current || empty($plus)) {
            continue;
        }

        if (strpos($trim, 'TOTAL:') === 0) {
            $cols = $splitByBreaks($line, $plus);
            if (count($cols) >= 14) {
                $current['total'] = [
                    'quant_vol' => $parseIntBr((string)($cols[2] ?? '0')),
                    'quant_ctrc' => $parseIntBr((string)($cols[3] ?? '0')),
                    'peso_ton' => $parseMoney((string)($cols[4] ?? '0')),
                    'val_merc' => $parseMoney((string)($cols[5] ?? '0')),
                    'frete_cif' => $parseMoney((string)($cols[6] ?? '0')),
                    'frete_fob' => $parseMoney((string)($cols[7] ?? '0')),
                    'frete_ter' => $parseMoney((string)($cols[8] ?? '0')),
                    'frete_sub' => $parseMoney((string)($cols[9] ?? '0')),
                    'frete_tot' => $parseMoney((string)($cols[10] ?? '0')),
                    'frete_ctrc' => $parseMoney((string)($cols[11] ?? '0')),
                    'frete_vmerc_pct' => $parseMoney((string)($cols[12] ?? '0')),
                    'desc_pct' => $parseMoney((string)($cols[13] ?? '0')),
                ];
            }
            continue;
        }

        if ($trim[0] === '-') continue;

        $cols = $splitByBreaks($line, $plus);
        if (count($cols) < 10) continue;

        $unLabel = trim((string)($cols[0] ?? ''));
        $uf = strtoupper(trim((string)($cols[1] ?? '')));
        if ($unLabel === '' || $uf === '') continue;

        $sigla = strtoupper(substr($unLabel, 0, 3));
        if (!preg_match('/^[A-Z0-9]{3}$/', $sigla)) continue;
        if (is_array($knownSiglas) && !isset($knownSiglas[$sigla])) continue;

        $current['rows'][] = [
            'sigla' => $sigla,
            'unidade' => $unLabel,
            'uf' => $uf,
            'quant_vol' => $parseIntBr((string)($cols[2] ?? '0')),
            'quant_ctrc' => $parseIntBr((string)($cols[3] ?? '0')),
            'peso_ton' => $parseMoney((string)($cols[4] ?? '0')),
            'val_merc' => $parseMoney((string)($cols[5] ?? '0')),
            'frete_cif' => $parseMoney((string)($cols[6] ?? '0')),
            'frete_fob' => $parseMoney((string)($cols[7] ?? '0')),
            'frete_ter' => $parseMoney((string)($cols[8] ?? '0')),
            'frete_sub' => $parseMoney((string)($cols[9] ?? '0')),
            'frete_tot' => $parseMoney((string)($cols[10] ?? '0')),
            'frete_ctrc' => $parseMoney((string)($cols[11] ?? '0')),
            'frete_vmerc_pct' => $parseMoney((string)($cols[12] ?? '0')),
            'desc_pct' => $parseMoney((string)($cols[13] ?? '0')),
        ];
    }

    $flush();

    $by = [];
    $totals = [
        'quant_vol' => 0,
        'quant_ctrc' => 0,
        'peso_ton' => 0.0,
        'val_merc' => 0.0,
        'frete_tot' => 0.0,
        'frete_cif' => 0.0,
        'frete_fob' => 0.0,
        'frete_ter' => 0.0,
        'frete_sub' => 0.0,
    ];

    foreach ($groups as $g) {
        foreach (($g['rows'] ?? []) as $r) {
            $k = (string)$r['sigla'];
            if (!isset($by[$k])) {
                $by[$k] = [
                    'sigla' => $r['sigla'],
                    'unidade' => $r['unidade'],
                    'uf' => $r['uf'],
                    'quant_vol' => 0,
                    'quant_ctrc' => 0,
                    'peso_ton' => 0.0,
                    'val_merc' => 0.0,
                    'frete_cif' => 0.0,
                    'frete_fob' => 0.0,
                    'frete_ter' => 0.0,
                    'frete_sub' => 0.0,
                    'frete_tot' => 0.0,
                ];
            }
            $by[$k]['quant_vol'] += (int)$r['quant_vol'];
            $by[$k]['quant_ctrc'] += (int)$r['quant_ctrc'];
            $by[$k]['peso_ton'] += (float)$r['peso_ton'];
            $by[$k]['val_merc'] += (float)$r['val_merc'];
            $by[$k]['frete_cif'] += (float)$r['frete_cif'];
            $by[$k]['frete_fob'] += (float)$r['frete_fob'];
            $by[$k]['frete_ter'] += (float)$r['frete_ter'];
            $by[$k]['frete_sub'] += (float)$r['frete_sub'];
            $by[$k]['frete_tot'] += (float)$r['frete_tot'];
        }

        if (!empty($g['total'])) {
            $t = $g['total'];
            $totals['quant_vol'] += (int)$t['quant_vol'];
            $totals['quant_ctrc'] += (int)$t['quant_ctrc'];
            $totals['peso_ton'] += (float)$t['peso_ton'];
            $totals['val_merc'] += (float)$t['val_merc'];
            $totals['frete_tot'] += (float)$t['frete_tot'];
            $totals['frete_cif'] += (float)$t['frete_cif'];
            $totals['frete_fob'] += (float)$t['frete_fob'];
            $totals['frete_ter'] += (float)$t['frete_ter'];
            $totals['frete_sub'] += (float)$t['frete_sub'];
        }
    }

    $rowsAgg = array_values($by);
    usort($rowsAgg, static function($a, $b) {
        return ($b['frete_tot'] <=> $a['frete_tot']);
    });

    return [
        'totals' => $totals,
        'rows' => $rowsAgg,
        'groups' => $groups,
    ];
};

$inferTipoFromFilename = static function(string $filename): string {
    $fn = strtoupper((string)$filename);
    if (strpos($fn, '_E.SSWWEB') !== false) return 'R';
    if (strpos($fn, '_R.SSWWEB') !== false) return 'E';
    return 'E';
};

if ($step === 'DOWNLOAD') {
    if ($actIn === '') {
        respondJson(['success' => false, 'message' => 'Parâmetro act obrigatório para download.']);
    }

    $dl = $downloadFromAct($actIn);
    if (!$dl) {
        respondJson(['success' => false, 'message' => 'Não foi possível baixar o arquivo pelo ssw1440/ssw0424.']);
    }

    $tipo = $inferTipoFromFilename((string)$dl['filename']);
    $t0 = microtime(true);
    $data = $parseTxt((string)$dl['content'], $tipo);
    $t1 = microtime(true);

    respondJson([
        'success' => true,
        'kind' => $tipo === 'R' ? 'recebidos' : 'expedidos',
        'filename' => (string)$dl['filename'],
        'data' => $data,
        'meta' => [
            'timing_ms' => array_merge(($dl['timing_ms'] ?? []), [
                'parse' => (int)round(($t1 - $t0) * 1000),
            ]),
            'size_bytes' => ($dl['size_bytes'] ?? []),
        ],
    ]);
}

$isOpcFretes = static function(string $opc): bool {
    $opc = trim((string)$opc);
    if ($opc === '') return false;
    if (preg_match('/^\s*(\d{1,5})\s*/', $opc, $m)) {
        return ((int)$m[1]) === 453;
    }
    return false;
};

$extractActsFromF8 = static function(string $f8raw): array {
    $f8 = html_entity_decode((string)$f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $acts = [];
    if (preg_match_all("/ajaxEnvia\\('\\s*([^']+)\\s*'\\)/", $f8, $m)) {
        foreach ($m[1] as $act) {
            $act = trim((string)$act);
            if ($act !== '') $acts[] = $act;
        }
    }
    return array_values(array_unique($acts));
};

$parseF2Ts = static function(string $f2) : ?int {
    $f2 = trim((string)$f2);
    if ($f2 === '') return null;
    $dt = \DateTime::createFromFormat('d/m/y H:i:s', $f2);
    if (!$dt) return null;
    return $dt->getTimestamp();
};

if ($step === 'POLL') {
    $baselineSeqIn = (int)($input['baseline_seq'] ?? 0);
    $requestStartTsIn = (int)($input['request_start_ts'] ?? 0);

    if ($baselineSeqIn <= 0 || $requestStartTsIn <= 0) {
        respondJson(['success' => false, 'message' => 'Parâmetros inválidos para consulta de status (baseline_seq/request_start_ts).']);
    }

    $xml1440 = $lerXml1440();
    if (!$xml1440) {
        respondJson([
            'success' => false,
            'message' => 'Não foi possível ler a fila do SSW (1440) neste momento (erro/timeout do SSW).',
        ], 500);
    }

    $best = null;
    $bestSeq = -1;

    for ($i = 0; $i <= 200; $i++) {
        $seq = $xml1440->xpath('rs/r/f0')[$i] ?? null;
        $opc = $xml1440->xpath('rs/r/f1')[$i] ?? null;
        $usr = $xml1440->xpath('rs/r/f3')[$i] ?? null;
        $sit = $xml1440->xpath('rs/r/f6')[$i] ?? null;
        $f8  = $xml1440->xpath('rs/r/f8')[$i] ?? null;
        $f2  = $xml1440->xpath('rs/r/f2')[$i] ?? null;

        if ($seq === null) break;

        $seqVal = (int)$seq;
        if ($seqVal <= 0) continue;

        $opcStr = (string)$opc;
        if (substr(trim($opcStr), 0, 3) !== '453') continue;

        $usrStr = trim((string)$usr);
        $usrNorm = $normSswUser($usrStr);
        if (!in_array($usrNorm, $allowedSswUsers, true)) continue;

        $sitStr = (string)$sit;
        if ($sitStr !== 'Conclu&iacute;do') continue;

        $f8raw = (string)$f8;
        if ($f8raw === '') continue;

        $okBySeq = ($seqVal > $baselineSeqIn);
        $f2ts = $parseF2Ts((string)$f2);
        $okByTime = ($f2ts !== null && $f2ts >= ($requestStartTsIn - 120));
        if (!$okBySeq && !$okByTime) continue;

        $f8dec = html_entity_decode($f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $hasLinksOrNone = (stripos($f8dec, 'ajaxEnvia(') !== false) || (stripos($f8dec, 'Nenhum registro encontrado') !== false);
        if (!$hasLinksOrNone) continue;

        if ($seqVal > $bestSeq) {
            $bestSeq = $seqVal;
            $best = [
                'seq' => $seqVal,
                'opc' => $opcStr,
                'usr' => $usrStr,
                'sit' => $sitStr,
                'f8'  => $f8raw,
                'f2'  => (string)$f2,
            ];
        }
    }

    if (!$best) {
        respondJson([
            'success' => true,
            'status' => 'pending',
        ]);
    }

    $f8dec = html_entity_decode((string)($best['f8'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if (stripos($f8dec, 'Nenhum registro encontrado') !== false) {
        respondJson([
            'success' => true,
            'status' => 'ready',
            'result' => 'empty',
            'ssw_seq' => (int)($best['seq'] ?? 0),
        ]);
    }

    $acts = $extractActsFromF8((string)($best['f8'] ?? ''));
    respondJson([
        'success' => true,
        'status' => 'ready',
        'result' => 'links',
        'ssw_seq' => (int)($best['seq'] ?? 0),
        'acts' => $acts,
    ]);
}

if ($step === 'START') {
    $rowsBefore = $get1440Rows();
    $baselineSeq = 0;
    foreach ($rowsBefore as $r) {
        $baselineSeq = max($baselineSeq, (int)$r['seq']);
    }

    $params = [
        'act' => 'ENV',
        'cod_emp_ctb' => '01',
        'tp_unid' => 'A',
    ];

    if ($siglaUnid !== '') $params['sigla_unid'] = strtolower($siglaUnid);
    if ($cgcCliente !== '') $params['cgc_cliente'] = $cgcCliente;
    if ($tpCliente !== '') $params['tp_cliente'] = $tpCliente;
    if ($hasEmissao) {
        $params['data_emis_ini'] = date('dmy', strtotime($emissaoIni));
        $params['data_emis_fin'] = date('dmy', strtotime($emissaoFim));
    }
    if ($hasEntrega) {
        $params['data_ent_ini'] = date('dmy', strtotime($entregaIni));
        $params['data_ent_fin'] = date('dmy', strtotime($entregaFim));
    }

    $params['dummy'] = (string)((int)(microtime(true) * 1000));
    $q = http_build_query($params);
    $requestStartTs = time();

    $sswFetch("https://sistema.ssw.inf.br/bin/ssw0057?$q", 2);

    respondJson([
        'success' => true,
        'status' => 'started',
        'baseline_seq' => $baselineSeq,
        'request_start_ts' => $requestStartTs,
    ]);
}

$params = [
    'act' => 'ENV',
    'cod_emp_ctb' => '01',
    'tp_unid' => 'A',
];

if ($siglaUnid !== '') $params['sigla_unid'] = strtolower($siglaUnid);
if ($cgcCliente !== '') $params['cgc_cliente'] = $cgcCliente;
if ($tpCliente !== '') $params['tp_cliente'] = $tpCliente;
if ($hasEmissao) {
    $params['data_emis_ini'] = date('dmy', strtotime($emissaoIni));
    $params['data_emis_fin'] = date('dmy', strtotime($emissaoFim));
}
if ($hasEntrega) {
    $params['data_ent_ini'] = date('dmy', strtotime($entregaIni));
    $params['data_ent_fin'] = date('dmy', strtotime($entregaFim));
}

$params['dummy'] = (string)((int)(microtime(true) * 1000));

$q = http_build_query($params);
$requestStartTs = time();
$rowsBefore = $get1440Rows();
$baselineSeq = 0;
foreach ($rowsBefore as $r) {
    $baselineSeq = max($baselineSeq, (int)$r['seq']);
}
$sswFetch("https://sistema.ssw.inf.br/bin/ssw0057?$q", 2);

$jobRow = null;
$deadline = time() + 45;

while (time() <= $deadline) {
    $rows = $get1440Rows();

    $best = null;
    $bestSeq = -1;

    foreach ($rows as $r) {
        if (!$isOpcFretes((string)($r['opc'] ?? ''))) continue;

        $usrNorm = $normSswUser((string)($r['usr'] ?? ''));
        if ($usrNorm !== '' && !in_array($usrNorm, $allowedSswUsers, true)) continue;

        $status = $normStatus((string)($r['sit'] ?? ''));
        if (strpos($status, 'CONCLUIDO') === false) continue;

        $seq = (int)($r['seq'] ?? 0);
        if ($seq <= 0) continue;

        $f8raw = (string)($r['f8'] ?? '');
        if ($f8raw === '') continue;

        $f8dec = html_entity_decode($f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $hasLinksOrNone = (stripos($f8dec, 'ajaxEnvia(') !== false) || (stripos($f8dec, 'Nenhum registro encontrado') !== false);
        if (!$hasLinksOrNone) continue;

        $okBySeq = ($seq > $baselineSeq);
        $f2ts = $parseF2Ts((string)($r['f2'] ?? ''));
        $okByTime = ($f2ts !== null && $f2ts >= ($requestStartTs - 120));

        if (!$okBySeq && !$okByTime) continue;

        if ($seq > $bestSeq) {
            $best = $r;
            $bestSeq = $seq;
        }
    }

    if ($best) {
        $jobRow = $best;
        break;
    }

    sleep(1);
}

if (!$jobRow) {
    $rowsNow = $get1440Rows();
    $sample = array_slice($rowsNow, 0, 10);
    $debug = array_map(static function($r) {
        return [
            'seq' => (int)($r['seq'] ?? 0),
            'opc' => (string)($r['opc'] ?? ''),
            'f2'  => (string)($r['f2'] ?? ''),
            'usr' => (string)($r['usr'] ?? ''),
            'sit' => (string)($r['sit'] ?? ''),
        ];
    }, $sample);
    respondJson([
        'success' => false,
        'message' => 'Timeout aguardando o relatório na fila SSW 1440 (opção 453).',
        'debug' => [
            'baseline_seq' => $baselineSeq,
            'expected_opc' => 453,
            'request_start_ts' => $requestStartTs,
            'top_rows' => $debug,
        ],
    ]);
}

$f8 = html_entity_decode((string)$jobRow['f8'], ENT_QUOTES | ENT_HTML5, 'UTF-8');

$acts = [];
if (stripos($f8, 'Nenhum registro encontrado') !== false) {
    respondJson([
        'success' => true,
        'message' => 'Nenhum registro encontrado para os parâmetros informados.',
        'expedidos' => null,
        'recebidos' => null,
        'meta' => [
            'ssw_seq' => (int)$jobRow['seq'],
            'gerado_em' => date('c'),
        ],
    ]);
}

if (preg_match_all("/ajaxEnvia\\('\\s*([^']+)\\s*'\\)/", $f8, $m)) {
    foreach ($m[1] as $act) {
        $act = trim((string)$act);
        if ($act !== '') $acts[] = $act;
    }
}

$acts = array_values(array_unique($acts));

if (empty($acts)) {
    respondJson(['success' => false, 'message' => 'Não foi possível localizar links de download no ssw1440.']);
}

$rankAct = static function(string $act): int {
    $a = strtoupper($act);
    if (strpos($a, '_R.SSWWEB') !== false) return 1;
    if (strpos($a, '_E.SSWWEB') !== false) return 2;
    return 9;
};

usort($acts, static function($a, $b) use ($rankAct) {
    return ($rankAct((string)$a) <=> $rankAct((string)$b));
});

$exp = null;
$rec = null;
$downloads = [];

foreach ($acts as $act) {
    $dl = $downloadFromAct($act);
    if (!$dl) continue;
    $downloads[] = ['act' => $act, 'filename' => $dl['filename']];

    $tipo = $inferTipoFromFilename((string)$dl['filename']);
    if ($tipo === 'E') {
        $exp = $parseTxt($dl['content'], 'E');
    } elseif ($tipo === 'R') {
        $rec = $parseTxt($dl['content'], 'R');
    } else {
        if ($exp === null) $exp = $parseTxt($dl['content'], 'E');
        else if ($rec === null) $rec = $parseTxt($dl['content'], 'R');
    }
}

respondJson([
    'success' => true,
    'expedidos' => $exp,
    'recebidos' => $rec,
    'meta' => [
        'ssw_seq' => (int)$jobRow['seq'],
        'downloads' => $downloads,
        'gerado_em' => date('c'),
        'filtros' => [
            'sigla_unid' => $siglaUnid !== '' ? $siglaUnid : null,
            'cgc_cliente' => $cgcCliente !== '' ? $cgcCliente : null,
            'tp_cliente' => $tpCliente !== '' ? $tpCliente : null,
            'periodo_emissao_ini' => $emissaoIni,
            'periodo_emissao_fim' => $emissaoFim,
            'periodo_entrega_ini' => $hasEntrega ? $entregaIni : null,
            'periodo_entrega_fim' => $hasEntrega ? $entregaFim : null,
        ],
    ],
]);
