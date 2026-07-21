<?php

set_time_limit(0);
ini_set('memory_limit', '768M');

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
requireAuth();

header('Content-Type: application/json; charset=utf-8');

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Erro fatal PHP: ' . $err['message']], JSON_UNESCAPED_UNICODE);
    }
});

$respondJson = static function(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
};

$inputRaw = file_get_contents('php://input');
$input = json_decode((string)$inputRaw, true);
if (!is_array($input)) $input = [];

$step = strtoupper(trim((string)($input['step'] ?? 'RUN')));
if (!in_array($step, ['RUN', 'START', 'POLL', 'DOWNLOAD'], true)) $step = 'RUN';

$allowedSswUsers = ['presto', 'damasce1', 'claraj'];
$normSswUser = static function(string $s): string {
    $s = html_entity_decode((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return strtolower(trim($s));
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

$extractXml = static function(string $html): string {
    $pos = strpos($html, '<xml');
    if ($pos === false) return '';
    $tail = substr($html, $pos);
    $end = strpos($tail, '</xml>');
    if ($end === false) return '';
    return substr($tail, 0, $end) . '</xml>';
};

$get1440Rows = static function() use ($sswFetch, $extractXml): array {
    $raw = (string)$sswFetch('https://sistema.ssw.inf.br/bin/ssw1440', 3);
    if ($raw === '' || stripos($raw, '504 Gateway Time-out') !== false) return [];
    $xmlStr = $extractXml($raw);
    if ($xmlStr === '') return [];
    $xml = @simplexml_load_string($xmlStr);
    if (!$xml) return [];

    $rows = [];
    for ($i = 0; $i <= 220; $i++) {
        $seq = $xml->xpath('rs/r/f0')[$i] ?? null;
        $opc = $xml->xpath('rs/r/f1')[$i] ?? null;
        $f2  = $xml->xpath('rs/r/f2')[$i] ?? null;
        $usr = $xml->xpath('rs/r/f3')[$i] ?? null;
        $f4  = $xml->xpath('rs/r/f4')[$i] ?? null;
        $sit = $xml->xpath('rs/r/f6')[$i] ?? null;
        $f8  = $xml->xpath('rs/r/f8')[$i] ?? null;
        if ($seq === null) break;
        $rows[] = [
            'seq' => (int)$seq,
            'opc' => (string)$opc,
            'f2'  => (string)$f2,
            'usr' => (string)$usr,
            'f4'  => (string)$f4,
            'sit' => (string)$sit,
            'f8'  => (string)$f8,
        ];
    }
    return $rows;
};

$parseF2Ts = static function(string $f2) : ?int {
    $f2 = trim((string)$f2);
    if ($f2 === '') return null;
    $dt = \DateTime::createFromFormat('d/m/y H:i:s', $f2);
    if (!$dt) return null;
    return $dt->getTimestamp();
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
    $s = trim(str_replace("\xC2\xA0", '', $s));
    if ($s === '') return 0.0;
    $neg = false;
    if (strpos($s, '-') !== false) $neg = true;
    $s = preg_replace('/[^0-9,\\.\\-]/', '', $s);
    $s = str_replace('.', '', $s);
    $s = str_replace(',', '.', $s);
    if ($s === '' || !is_numeric($s)) return 0.0;
    $v = (float)$s;
    return $neg ? -abs($v) : $v;
};

$parseCnpj = static function(string $v): string {
    $v = trim(str_replace("\xC2\xA0", '', $v));
    if ($v === '') return '';
    $v = preg_replace('/\D+/', '', $v);
    if ($v === '') return '';
    return substr($v, 0, 14);
};

$normKey = static function(string $s): string {
    return preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($s)));
};

$parseSsw0049Csv = static function(string $content) use ($parseMoney, $parseCnpj, $normKey): array {
    $content = mb_convert_encoding((string)$content, 'UTF-8', 'ISO-8859-1');
    $content = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $content);
    $content = str_replace("\r\n", "\n", str_replace("\r", "\n", $content));

    $lines = explode("\n", $content);
    $lines = array_values(array_filter($lines, static fn($l) => trim((string)$l) !== ''));

    $delimiter = ';';
    foreach ($lines as $l) {
        $t = trim((string)$l);
        if ($t === '') continue;
        if (strpos($t, ';') !== false) { $delimiter = ';'; break; }
        if (strpos($t, ',') !== false) { $delimiter = ','; break; }
    }

    $headerFat = [];
    $idxFat = [];
    $headerCte = [];
    $idxCte = [];

    $invoices = [];
    $currentIndex = -1;

    $totals = [
        'faturas' => 0,
        'ctes' => 0,
        'vlr_fatur_total' => 0.0,
        'saldo_total' => 0.0,
        'frete_ctes_total' => 0.0,
    ];

    $updatedAt = null;

    $getCell = static function(array $row, array $idx, array $candidates) use ($normKey): string {
        foreach ($candidates as $c) {
            $k = $normKey((string)$c);
            if (isset($idx[$k])) return trim((string)($row[$idx[$k]] ?? ''));
        }
        return '';
    };

    foreach ($lines as $l) {
        $row = str_getcsv($l, $delimiter);
        if (empty($row)) continue;
        $row[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$row[0]);

        $tipo = trim((string)($row[0] ?? ''));
        if ($tipo === '') continue;

        if ($tipo === '0') {
            if ($updatedAt === null) {
                $d = trim((string)($row[3] ?? ''));
                $h = trim((string)($row[4] ?? ''));
                $updatedAt = trim($d . ' ' . $h);
            }
            continue;
        }

        if ($tipo === '1') {
            $headerFat = $row;
            $idxFat = [];
            foreach ($headerFat as $i => $h) {
                $k = $normKey((string)$h);
                if ($k !== '') $idxFat[$k] = $i;
            }
            continue;
        }

        if ($tipo === '2') {
            $headerCte = $row;
            $idxCte = [];
            foreach ($headerCte as $i => $h) {
                $k = $normKey((string)$h);
                if ($k !== '') $idxCte[$k] = $i;
            }
            continue;
        }

        if ($tipo === '3') {
            if (empty($idxFat)) continue;

            $fatura = $getCell($row, $idxFat, ['FATURA']);
            $cnpj = $parseCnpj($getCell($row, $idxFat, ['CNPJ/CPF', 'CNPJCPF']));
            $cliente = $getCell($row, $idxFat, ['CLIENTE']);
            $tipoCobranca = $getCell($row, $idxFat, ['TIPO DE COBRANCA', 'TIPO DE COBRANÇA']);
            $bancoCarteira = $getCell($row, $idxFat, ['BANCO/CARTEIRA']);
            $periodicidade = $getCell($row, $idxFat, ['PERIODICIDADE']);
            $fil = $getCell($row, $idxFat, ['FIL']);
            $emissao = $getCell($row, $idxFat, ['EMISSAO']);
            $venc = $getCell($row, $idxFat, ['VENCIMEN', 'VENCIMENTO']);
            $pagamento = $getCell($row, $idxFat, ['PAGAMENTO']);
            $diasAtraso = $getCell($row, $idxFat, ['DIAS ATRASO']);
            $sit = $getCell($row, $idxFat, ['LIQUIDADA/ATRASADA']);
            $vlrFatur = $parseMoney($getCell($row, $idxFat, ['VLR FATUR', 'VLR FATUR.']));
            $vlrPago = $parseMoney($getCell($row, $idxFat, ['VLR PAGO']));
            $saldo = $parseMoney($getCell($row, $idxFat, ['SALDO']));
            $ultimaOc = $getCell($row, $idxFat, ['ULTIMA OCORRENCIA', 'ÚLTIMA OCORRÊNCIA']);
            $unidadeResp = $getCell($row, $idxFat, ['UNIDADE RESPONSAVEL', 'UNIDADE RESPONSÁVEL']);
            $vendedor = $getCell($row, $idxFat, ['VENDEDOR']);

            $inv = [
                'fatura' => $fatura,
                'cnpj' => $cnpj,
                'cliente' => $cliente,
                'tipo_cobranca' => $tipoCobranca,
                'banco_carteira' => $bancoCarteira,
                'periodicidade' => $periodicidade,
                'fil' => $fil,
                'emissao' => $emissao,
                'vencimento' => $venc,
                'pagamento' => $pagamento,
                'dias_atraso' => $diasAtraso,
                'situacao' => $sit,
                'vlr_fatur' => $vlrFatur,
                'vlr_pago' => $vlrPago,
                'saldo' => $saldo,
                'ultima_ocorrencia' => $ultimaOc,
                'unidade_responsavel' => $unidadeResp,
                'vendedor' => $vendedor,
                'ctes' => [],
                'ctes_total_frete' => 0.0,
                'ctes_total_contabil' => 0.0,
            ];

            $invoices[] = $inv;
            $currentIndex = count($invoices) - 1;

            $totals['faturas'] += 1;
            $totals['vlr_fatur_total'] += $vlrFatur;
            $totals['saldo_total'] += $saldo;

            continue;
        }

        if ($tipo === '4') {
            if (empty($idxCte)) continue;
            if ($currentIndex < 0 || !isset($invoices[$currentIndex])) continue;

            $frete = $parseMoney($getCell($row, $idxCte, ['VALOR FRETE']));
            $vlrContabil = $parseMoney($getCell($row, $idxCte, ['VALOR CONTABIL']));

            $cte = [
                'fatura' => $getCell($row, $idxCte, ['FATURA']),
                'emissao_fatura' => $getCell($row, $idxCte, ['EMISSAO FATURA']),
                'ctrc' => $getCell($row, $idxCte, ['CTRC']),
                'cte' => $getCell($row, $idxCte, ['CTE']),
                'data_emissao' => $getCell($row, $idxCte, ['DATA EMISSAO', 'DATA EMISSÃO']),
                'data_autorizacao' => $getCell($row, $idxCte, ['DATA AUTORIZACAO', 'DATA AUTORIZAÇÃO']),
                'valor_frete' => $frete,
                'lote_contabil' => $getCell($row, $idxCte, ['LOTE CONTABIL']),
                'valor_contabil' => $vlrContabil,
            ];

            $invoices[$currentIndex]['ctes'][] = $cte;
            $invoices[$currentIndex]['ctes_total_frete'] += $frete;
            $invoices[$currentIndex]['ctes_total_contabil'] += $vlrContabil;

            $totals['ctes'] += 1;
            $totals['frete_ctes_total'] += $frete;
            continue;
        }
    }

    $totals['vlr_fatur_total'] = round((float)$totals['vlr_fatur_total'], 2);
    $totals['saldo_total'] = round((float)$totals['saldo_total'], 2);
    $totals['frete_ctes_total'] = round((float)$totals['frete_ctes_total'], 2);

    for ($i = 0; $i < count($invoices); $i++) {
        $invoices[$i]['ctes_total_frete'] = round((float)($invoices[$i]['ctes_total_frete'] ?? 0), 2);
        $invoices[$i]['ctes_total_contabil'] = round((float)($invoices[$i]['ctes_total_contabil'] ?? 0), 2);
    }

    return [
        'totals' => $totals,
        'faturas' => $invoices,
        'updated_at' => $updatedAt,
    ];
};

try {
    require_ssw();
    if (!function_exists('ssw_login') || !function_exists('ssw_go')) {
        throw new Exception('Funções SSW (ssw_login/ssw_go) não disponíveis');
    }

    $domain = $_SERVER['HTTP_X_DOMAIN'] ?? null;
    if (!$domain) {
        $respondJson(['success' => false, 'message' => 'DOMÍNIO NÃO ESPECIFICADO'], 400);
    }

    $dominio = strtoupper((string)$domain);
    ssw_login($dominio);

    $fgData = strtoupper(trim((string)($input['rel_ana_fg_data'] ?? 'V')));
    if (!in_array($fgData, ['E', 'V', 'L', 'X'], true)) $fgData = 'V';

    $sitFat = strtoupper(trim((string)($input['rel_ana_sit_fat'] ?? 'T')));
    if (!in_array($sitFat, ['P', 'L', 'E', 'C', 'T'], true)) $sitFat = 'T';

    $iniDmy = '';
    $fimDmy = '';
    if (in_array($step, ['RUN', 'START'], true)) {
        $iniIso = trim((string)($input['rel_ana_per_pesq_ini'] ?? ''));
        $fimIso = trim((string)($input['rel_ana_per_pesq_fin'] ?? ''));
        if ($iniIso === '' || $fimIso === '') {
            $respondJson(['success' => false, 'message' => 'Informe data inicial e final (rel_ana_per_pesq_ini/rel_ana_per_pesq_fin).'], 400);
        }

        $iniDmy = date('dmy', strtotime($iniIso));
        $fimDmy = date('dmy', strtotime($fimIso));

        if (!preg_match('/^\d{6}$/', $iniDmy) || !preg_match('/^\d{6}$/', $fimDmy)) {
            $respondJson(['success' => false, 'message' => 'Período inválido para o SSW (datas).'], 400);
        }
    }

    $cnpjPag = $parseCnpj((string)($input['rel_ana_cgc'] ?? ''));
    $cnpjGrupo = $parseCnpj((string)($input['rel_ana_cgc_grupo'] ?? ''));

    $params = [
        'act' => 'ANA',
        'tp_arquivo' => 'C',
        'rel_ana_fg_data' => $fgData,
        'rel_ana_per_pesq_ini' => $iniDmy,
        'rel_ana_per_pesq_fin' => $fimDmy,
        'rel_ana_class_nro_fat' => 'X',
        'rel_ana_sit_fat' => $sitFat,
        'rel_ana_crit_adc' => 'T',
        'rel_ana_fg_fat_desc' => 'I',
        'rel_ana_fg_lista_ocor' => 'N',
        'rel_ana_fg_ctrc_fob_dir' => 'N',
        'tp_cobranca' => 'A',
        'rel_ana_vlr_max_fat' => '9.999.999,99',
        'rel_ana_periodicidade' => 'T',
        'rel_ana_arq_excel' => 'S',
        'rel_sin_fg_data' => $fgData,
        'rel_sin_per_pesq_ini' => $fimDmy,
        'rel_sin_per_pesq_fin' => $fimDmy,
        'rel_sin_classificacao' => 'F',
        'rel_sin_sit_fat' => $sitFat,
        'rel_sin_fg_fat_desc' => 'I',
        'dummy' => (string)((int)(microtime(true) * 1000)),
    ];

    if ($cnpjPag !== '') $params['rel_ana_cgc'] = $cnpjPag;
    if ($cnpjGrupo !== '') $params['rel_ana_cgc_grupo'] = $cnpjGrupo;

    $buildUrl = static function(array $params): string {
        return 'https://sistema.ssw.inf.br/bin/ssw0049?' . http_build_query($params);
    };

    $getActArq = static function(string $html): array {
        $act = function_exists('ssw_get_act') ? ssw_get_act($html) : '';
        $arq = function_exists('ssw_get_arq') ? ssw_get_arq($html) : '';
        $act = trim((string)$act);
        $arq = trim((string)$arq);
        if ($act !== '' && $arq !== '') return [$act, $arq];

        if (preg_match("/ssw0424\\?act=([^&\\s'\\\"]+).*?filename=([^&\\s'\\\"]+)/i", $html, $m)) {
            $a = trim((string)urldecode($m[1]));
            $f = trim((string)urldecode($m[2]));
            if ($a !== '' && $f !== '') return [$a, $f];
        }

        return ['', ''];
    };

    $tryImmediate = static function() use ($sswFetch, $buildUrl, $params, $getActArq, $parseSsw0049Csv): array {
        $t0 = microtime(true);
        $html = (string)$sswFetch($buildUrl($params), 3);
        $t1 = microtime(true);
        $html = urldecode((string)$html);

        if ($html === '' || stripos($html, '504 Gateway Time-out') !== false) {
            return [
                'kind' => 'error',
                'message' => 'Falha/timeout ao executar o SSW0049.',
                'http_status' => 502,
                'timing_ms' => ['ssw0049' => (int)round(($t1 - $t0) * 1000)],
            ];
        }

        if (stripos($html, 'Nenhum registro encontrado') !== false) {
            return [
                'kind' => 'empty',
                'timing_ms' => ['ssw0049' => (int)round(($t1 - $t0) * 1000)],
            ];
        }

        [$act, $arq] = $getActArq($html);
        if ($act !== '' && $arq !== '') {
            $t2 = microtime(true);
            $csvRaw = (string)$sswFetch("https://sistema.ssw.inf.br/bin/ssw0424?act={$act}&filename={$arq}&path=&down=1&nw=0", 3);
            $t3 = microtime(true);
            if ($csvRaw === '' || strlen($csvRaw) < 50) {
                return [
                    'kind' => 'error',
                    'message' => 'Não foi possível baixar o CSV do SSW0049 via ssw0424.',
                    'http_status' => 500,
                    'meta' => ['act' => $act, 'filename' => $arq],
                    'timing_ms' => [
                        'ssw0049' => (int)round(($t1 - $t0) * 1000),
                        'download' => (int)round(($t3 - $t2) * 1000),
                    ],
                ];
            }

            $parsed = $parseSsw0049Csv($csvRaw);
            return [
                'kind' => 'ready',
                'data' => $parsed,
                'meta' => [
                    'act' => $act,
                    'filename' => $arq,
                ],
                'timing_ms' => [
                    'ssw0049' => (int)round(($t1 - $t0) * 1000),
                    'download' => (int)round(($t3 - $t2) * 1000),
                ],
                'size_bytes' => [
                    'ssw0049_html' => strlen($html),
                    'csv' => strlen($csvRaw),
                ],
            ];
        }

        return [
            'kind' => 'queued',
            'timing_ms' => ['ssw0049' => (int)round(($t1 - $t0) * 1000)],
            'size_bytes' => ['ssw0049_html' => strlen($html)],
        ];
    };

    if ($step === 'DOWNLOAD') {
        $actIn = trim((string)($input['act'] ?? ''));
        if ($actIn === '') {
            $respondJson(['success' => false, 'message' => 'Parâmetro act obrigatório para download.'], 400);
        }

        $dl = $downloadFromAct($actIn);
        if (!$dl) {
            $respondJson(['success' => false, 'message' => 'Não foi possível baixar o arquivo pelo ssw1440/ssw0424.'], 500);
        }

        $t0 = microtime(true);
        $parsed = $parseSsw0049Csv((string)$dl['content']);
        $t1 = microtime(true);

        $respondJson([
            'success' => true,
            'status' => 'ready',
            'result' => 'data',
            'filename' => (string)$dl['filename'],
            'data' => $parsed,
            'meta' => [
                'programa' => 'ssw0049',
                'download' => [
                    'act' => $actIn,
                    'filename' => (string)$dl['filename'],
                    'path' => (string)$dl['path'],
                ],
                'timing_ms' => array_merge(($dl['timing_ms'] ?? []), [
                    'parse' => (int)round(($t1 - $t0) * 1000),
                ]),
                'size_bytes' => ($dl['size_bytes'] ?? []),
            ],
        ]);
    }

    if ($step === 'POLL') {
        $baselineSeqIn = (int)($input['baseline_seq'] ?? 0);
        $requestStartTsIn = (int)($input['request_start_ts'] ?? 0);
        if ($baselineSeqIn <= 0 || $requestStartTsIn <= 0) {
            $respondJson(['success' => false, 'message' => 'Parâmetros inválidos para consulta de status (baseline_seq/request_start_ts).'], 400);
        }

        $rows = $get1440Rows();
        if (empty($rows)) {
            $respondJson(['success' => false, 'message' => 'Não foi possível ler a fila do SSW (1440) neste momento.'], 500);
        }

        $best = null;
        $bestSeq = -1;
        foreach ($rows as $r) {
            $seqVal = (int)($r['seq'] ?? 0);
            if ($seqVal <= 0) continue;

            $opcStr = (string)($r['opc'] ?? '');
            if (substr(trim($opcStr), 0, 3) !== '441') continue;

            $usrNorm = $normSswUser((string)($r['usr'] ?? ''));
            if ($usrNorm !== '' && !in_array($usrNorm, $allowedSswUsers, true)) continue;

            $sitStr = (string)($r['sit'] ?? '');
            if ($sitStr !== 'Conclu&iacute;do') continue;

            $f8raw = (string)($r['f8'] ?? '');
            if ($f8raw === '') continue;

            $okBySeq = ($seqVal > $baselineSeqIn);
            $f2ts = $parseF2Ts((string)($r['f2'] ?? ''));
            $okByTime = ($f2ts !== null && $f2ts >= ($requestStartTsIn - 120));
            if (!$okBySeq && !$okByTime) continue;

            $f8dec = html_entity_decode($f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $hasLinksOrNone = (stripos($f8dec, 'ajaxEnvia(') !== false) || (stripos($f8dec, 'Nenhum registro encontrado') !== false);
            if (!$hasLinksOrNone) continue;

            if ($seqVal > $bestSeq) {
                $bestSeq = $seqVal;
                $best = $r;
            }
        }

        if (!$best) {
            $respondJson(['success' => true, 'status' => 'pending']);
        }

        $f8dec = html_entity_decode((string)($best['f8'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (stripos($f8dec, 'Nenhum registro encontrado') !== false) {
            $respondJson([
                'success' => true,
                'status' => 'ready',
                'result' => 'empty',
                'ssw_seq' => (int)($best['seq'] ?? 0),
            ]);
        }

        $acts = $extractActsFromF8((string)($best['f8'] ?? ''));
        $respondJson([
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
        foreach ($rowsBefore as $r) $baselineSeq = max($baselineSeq, (int)($r['seq'] ?? 0));
        $requestStartTs = time();

        $im = $tryImmediate();
        if (($im['kind'] ?? '') === 'empty') {
            $respondJson([
                'success' => true,
                'status' => 'ready',
                'result' => 'empty',
                'data' => [
                    'totals' => ['faturas' => 0, 'ctes' => 0, 'vlr_fatur_total' => 0, 'saldo_total' => 0, 'frete_ctes_total' => 0],
                    'faturas' => [],
                    'updated_at' => null,
                ],
                'meta' => [
                    'programa' => 'ssw0049',
                    'gerado_em' => date('c'),
                    'timing_ms' => ($im['timing_ms'] ?? []),
                ],
            ]);
        }
        if (($im['kind'] ?? '') === 'ready') {
            $respondJson([
                'success' => true,
                'status' => 'ready',
                'result' => 'data',
                'data' => $im['data'],
                'meta' => [
                    'programa' => 'ssw0049',
                    'act' => ($im['meta']['act'] ?? null),
                    'filename' => ($im['meta']['filename'] ?? null),
                    'gerado_em' => date('c'),
                    'timing_ms' => ($im['timing_ms'] ?? []),
                    'size_bytes' => ($im['size_bytes'] ?? []),
                ],
            ]);
        }
        if (($im['kind'] ?? '') === 'error') {
            $respondJson(
                ['success' => false, 'message' => (string)($im['message'] ?? 'Falha ao executar o SSW0049.')],
                (int)($im['http_status'] ?? 500)
            );
        }

        $respondJson([
            'success' => true,
            'status' => 'started',
            'baseline_seq' => $baselineSeq,
            'request_start_ts' => $requestStartTs,
            'meta' => [
                'programa' => 'ssw0049',
                'gerado_em' => date('c'),
                'timing_ms' => ($im['timing_ms'] ?? []),
            ],
        ]);
    }

    if ($step === 'RUN') {
        $rowsBefore = $get1440Rows();
        $baselineSeq = 0;
        foreach ($rowsBefore as $r) $baselineSeq = max($baselineSeq, (int)($r['seq'] ?? 0));
        $requestStartTs = time();

        $im = $tryImmediate();
        if (($im['kind'] ?? '') === 'empty') {
            $respondJson([
                'success' => true,
                'status' => 'ready',
                'result' => 'empty',
                'data' => [
                    'totals' => ['faturas' => 0, 'ctes' => 0, 'vlr_fatur_total' => 0, 'saldo_total' => 0, 'frete_ctes_total' => 0],
                    'faturas' => [],
                    'updated_at' => null,
                ],
                'meta' => [
                    'programa' => 'ssw0049',
                    'gerado_em' => date('c'),
                    'timing_ms' => ($im['timing_ms'] ?? []),
                ],
            ]);
        }
        if (($im['kind'] ?? '') === 'ready') {
            $respondJson([
                'success' => true,
                'status' => 'ready',
                'result' => 'data',
                'data' => $im['data'],
                'meta' => [
                    'programa' => 'ssw0049',
                    'act' => ($im['meta']['act'] ?? null),
                    'filename' => ($im['meta']['filename'] ?? null),
                    'gerado_em' => date('c'),
                    'timing_ms' => ($im['timing_ms'] ?? []),
                    'size_bytes' => ($im['size_bytes'] ?? []),
                ],
            ]);
        }
        if (($im['kind'] ?? '') === 'error') {
            $respondJson(
                ['success' => false, 'message' => (string)($im['message'] ?? 'Falha ao executar o SSW0049.')],
                (int)($im['http_status'] ?? 500)
            );
        }

        $deadline = time() + 45;
        while (time() <= $deadline) {
            $rows = $get1440Rows();
            $best = null;
            $bestSeq = -1;

            foreach ($rows as $r) {
                $seqVal = (int)($r['seq'] ?? 0);
                if ($seqVal <= 0) continue;
                $opcStr = (string)($r['opc'] ?? '');
                if (substr(trim($opcStr), 0, 3) !== '441') continue;
                $usrNorm = $normSswUser((string)($r['usr'] ?? ''));
                if ($usrNorm !== '' && !in_array($usrNorm, $allowedSswUsers, true)) continue;
                $sitStr = (string)($r['sit'] ?? '');
                if ($sitStr !== 'Conclu&iacute;do') continue;
                $f8raw = (string)($r['f8'] ?? '');
                if ($f8raw === '') continue;
                $okBySeq = ($seqVal > $baselineSeq);
                $f2ts = $parseF2Ts((string)($r['f2'] ?? ''));
                $okByTime = ($f2ts !== null && $f2ts >= ($requestStartTs - 120));
                if (!$okBySeq && !$okByTime) continue;
                $f8dec = html_entity_decode($f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                $hasLinksOrNone = (stripos($f8dec, 'ajaxEnvia(') !== false) || (stripos($f8dec, 'Nenhum registro encontrado') !== false);
                if (!$hasLinksOrNone) continue;
                if ($seqVal > $bestSeq) { $bestSeq = $seqVal; $best = $r; }
            }

            if ($best) {
                $f8dec = html_entity_decode((string)($best['f8'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
                if (stripos($f8dec, 'Nenhum registro encontrado') !== false) {
                    $respondJson([
                        'success' => true,
                        'status' => 'ready',
                        'result' => 'empty',
                        'data' => [
                            'totals' => ['faturas' => 0, 'ctes' => 0, 'vlr_fatur_total' => 0, 'saldo_total' => 0, 'frete_ctes_total' => 0],
                            'faturas' => [],
                            'updated_at' => null,
                        ],
                        'meta' => [
                            'programa' => 'ssw0049',
                            'ssw_seq' => (int)($best['seq'] ?? 0),
                            'gerado_em' => date('c'),
                        ],
                    ]);
                }

                $acts = $extractActsFromF8((string)($best['f8'] ?? ''));
                if (!empty($acts)) {
                    $dl = $downloadFromAct((string)$acts[0]);
                    if (!$dl) break;
                    $t0 = microtime(true);
                    $parsed = $parseSsw0049Csv((string)$dl['content']);
                    $t1 = microtime(true);
                    $respondJson([
                        'success' => true,
                        'status' => 'ready',
                        'result' => 'data',
                        'filename' => (string)$dl['filename'],
                        'data' => $parsed,
                        'meta' => [
                            'programa' => 'ssw0049',
                            'ssw_seq' => (int)($best['seq'] ?? 0),
                            'download' => [
                                'act' => (string)$acts[0],
                                'filename' => (string)$dl['filename'],
                                'path' => (string)$dl['path'],
                            ],
                            'timing_ms' => array_merge(($dl['timing_ms'] ?? []), [
                                'parse' => (int)round(($t1 - $t0) * 1000),
                            ]),
                            'size_bytes' => ($dl['size_bytes'] ?? []),
                            'gerado_em' => date('c'),
                        ],
                    ]);
                }
            }

            sleep(1);
        }

        $respondJson([
            'success' => false,
            'message' => 'Timeout aguardando o relatório na fila SSW 1440 (opção 441).',
            'debug' => [
                'baseline_seq' => $baselineSeq,
                'request_start_ts' => $requestStartTs,
                'expected_opc' => 441,
            ],
        ], 504);
    }

    $respondJson(['success' => false, 'message' => 'Requisição inválida.'], 400);
} catch (Throwable $e) {
    $respondJson(['success' => false, 'message' => $e->getMessage()], 500);
}
