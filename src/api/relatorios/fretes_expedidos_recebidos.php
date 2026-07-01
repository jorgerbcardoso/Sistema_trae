<?php
require_once __DIR__ . '/../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];
$g_sql = connect();

$input = getRequestInput();

$siglaUnid = strtoupper(trim((string)($input['sigla_unid'] ?? '')));
$cgcCliente = preg_replace('/\D+/', '', (string)($input['cgc_cliente'] ?? ''));
$tpCliente = strtoupper(trim((string)($input['tp_cliente'] ?? '')));

$emissaoIni = trim((string)($input['periodo_emissao_ini'] ?? ''));
$emissaoFim = trim((string)($input['periodo_emissao_fim'] ?? ''));
$entregaIni = trim((string)($input['periodo_entrega_ini'] ?? ''));
$entregaFim = trim((string)($input['periodo_entrega_fim'] ?? ''));

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
    return $s;
};

$fetch1440Rows = static function() use ($extractXml): array {
    $raw = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
    $xmlStr = $extractXml((string)$raw);
    $xml = @simplexml_load_string($xmlStr);
    if (!$xml) {
        return [];
    }

    $rows = [];
    for ($i = 0; $i <= 200; $i++) {
        $seq = $xml->xpath('rs/r/f0')[$i] ?? null;
        if ($seq === null) break;

        $rows[] = [
            'seq' => (int)$seq,
            'opc' => (string)($xml->xpath('rs/r/f1')[$i] ?? ''),
            'usr' => (string)($xml->xpath('rs/r/f3')[$i] ?? ''),
            'f4'  => (string)($xml->xpath('rs/r/f4')[$i] ?? ''),
            'sit' => (string)($xml->xpath('rs/r/f6')[$i] ?? ''),
            'f8'  => (string)($xml->xpath('rs/r/f8')[$i] ?? ''),
        ];
    }
    return $rows;
};

$isOpcFretes = static function(string $opc): bool {
    $opc = trim((string)$opc);
    if ($opc === '') return false;
    if (preg_match('/^\s*(\d{1,5})\s*/', $opc, $m)) {
        return ((int)$m[1]) === 453;
    }
    return false;
};

$rowsBefore = $fetch1440Rows();
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
ssw_go("https://sistema.ssw.inf.br/bin/ssw0057?$q");

$jobRow = null;
$deadline = time() + 30;

while (time() <= $deadline) {
    $rows = $fetch1440Rows();
    foreach ($rows as $r) {
        if (!$isOpcFretes((string)$r['opc'])) continue;
        if ((int)$r['seq'] <= $baselineSeq) continue;

        $status = $normStatus((string)$r['sit']);
        if ($status !== 'CONCLUIDO') continue;

        $jobRow = $r;
        break 2;
    }
    sleep(1);
}

if (!$jobRow) {
    $rowsNow = $fetch1440Rows();
    $sample = array_slice($rowsNow, 0, 10);
    $debug = array_map(static function($r) {
        return [
            'seq' => (int)($r['seq'] ?? 0),
            'opc' => (string)($r['opc'] ?? ''),
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

$downloadFromAct = static function(string $act) use ($extractXml): ?array {
    $dummy = (string)((int)(microtime(true) * 1000));
    $url = 'https://sistema.ssw.inf.br/bin/ssw1440?act=' . urlencode($act) . '&web_body=&dummy=' . $dummy;
    $html = (string)ssw_go($url);

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

    $file = (string)ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($filename) . '&filename=' . urlencode($filename) . '&path=' . urlencode($path) . '&down=1&nw=1');
    if ($file === '' || strlen($file) < 50) return null;

    return ['filename' => $filename, 'path' => $path, 'content' => $file];
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

$parseTxt = static function(string $content, string $tipo) use ($deriveBreaks, $splitByBreaks, $parseMoney, $parseIntBr): array {
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

        if (preg_match('/^UNIDADE\\s+(EXPEDIDORA|RECEBEDORA)\\s*:\\s*(.+)$/u', $trim, $mUn)) {
            $flush();
            $label = trim((string)$mUn[2]);
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

        if (preg_match('/^PERIODO\\s+DE\\s+EMISSAO\\s*:\\s*(.+)$/u', $trim, $mPer)) {
            $periodo = trim((string)$mPer[1]);
            if ($current) $current['periodo_emissao'] = $periodo;
            continue;
        }

        if (preg_match('/^-+\\+--\\+-+/u', $trim)) {
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

$exp = null;
$rec = null;
$downloads = [];

foreach ($acts as $act) {
    $dl = $downloadFromAct($act);
    if (!$dl) continue;
    $downloads[] = ['act' => $act, 'filename' => $dl['filename']];

    $fn = strtoupper($dl['filename']);
    if (strpos($fn, '_E.SSWWEB') !== false) {
        $exp = $parseTxt($dl['content'], 'E');
    } elseif (strpos($fn, '_R.SSWWEB') !== false) {
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
