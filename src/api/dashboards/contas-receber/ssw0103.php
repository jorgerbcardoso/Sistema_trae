<?php

set_time_limit(0);
ini_set('memory_limit', '512M');

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
requireAuth();

header('Content-Type: application/json; charset=utf-8');

$respondJson = static function(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
};

$inputRaw = file_get_contents('php://input');
$input = json_decode((string)$inputRaw, true);
if (!is_array($input)) $input = [];

$step = strtoupper(trim((string)($input['step'] ?? 'RUN')));
if (!in_array($step, ['RUN', 'START', 'POLL'], true)) $step = 'RUN';

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

    $sswFetch = static function(string $url, int $tries = 6): string {
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
        $raw = (string)$sswFetch('https://sistema.ssw.inf.br/bin/ssw1440', 6);
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
        $html = (string)$sswFetch($url, 6);
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
        $file = (string)$sswFetch('https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($filename) . '&filename=' . urlencode($filename) . '&path=' . urlencode($path) . '&down=1&nw=1', 6);
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

        if (preg_match("/act=([^&\\s'\\\"]+).*?filename=([^&\\s'\\\"]+)/i", $html, $m2)) {
            $a = trim((string)urldecode($m2[1]));
            $f = trim((string)urldecode($m2[2]));
            if ($a !== '' && $f !== '') return [$a, $f];
        }

        return ['', ''];
    };

    $parse0103Csv = static function(string $csvRaw): array {
        $csv = mb_convert_encoding((string)$csvRaw, 'UTF-8', 'ISO-8859-1');
        $csv = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $csv);
        $csv = str_replace("\r\n", "\n", str_replace("\r", "\n", $csv));

        $lines = explode("\n", $csv);
        $lines = array_values(array_filter($lines, static fn($l) => trim((string)$l) !== ''));

        $delimiter = ';';
        foreach ($lines as $l) {
            if (strpos($l, ';') !== false) { $delimiter = ';'; break; }
            if (strpos($l, ',') !== false) { $delimiter = ','; break; }
        }

        $normKey = static function(string $s): string {
            $s = strtoupper(trim($s));
            $s = strtr($s, [
                'Á' => 'A', 'À' => 'A', 'Â' => 'A', 'Ã' => 'A',
                'É' => 'E', 'Ê' => 'E',
                'Í' => 'I',
                'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O',
                'Ú' => 'U',
                'Ç' => 'C',
            ]);
            $s = preg_replace('/[^A-Z0-9]+/', ' ', $s);
            $s = preg_replace('/\s+/', ' ', $s);
            return trim($s);
        };

        $header = [];
        $idx = [];
        foreach ($lines as $l) {
            $row = str_getcsv($l, $delimiter);
            if (empty($row)) continue;
            $row[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$row[0]);
            if (trim((string)$row[0]) !== '1') continue;
            $header = $row;
            foreach ($header as $i => $h) {
                $k = trim((string)$h);
                if ($k !== '') {
                    $idx[$k] = $i;
                    $idx[$normKey($k)] = $i;
                }
            }
            break;
        }

        if (empty($header) || empty($idx)) {
            throw new Exception('Não foi possível localizar o cabeçalho do CSV do SSW0103.');
        }

        $getCell = static function(array $row, array $idx, string $col) use ($normKey): string {
            $k = trim((string)$col);
            $kn = $normKey($k);
            if (!isset($idx[$k]) && !isset($idx[$kn])) return '';
            $pos = isset($idx[$k]) ? $idx[$k] : $idx[$kn];
            return trim((string)($row[$pos] ?? ''));
        };

        $toMoney = static function(string $v): float {
            $s = trim(str_replace("\xC2\xA0", '', $v));
            if ($s === '') return 0.0;
            $s = str_replace('R$', '', $s);
            $s = preg_replace('/\s+/', '', $s);
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
            if (!is_numeric($s)) return 0.0;
            return (float)$s;
        };

        $rowsOut = [];
        $freteTotal = 0.0;
        $updatedAt = null;
        foreach ($lines as $l) {
            $row = str_getcsv($l, $delimiter);
            if (empty($row)) continue;
            $row[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$row[0]);
            $tipo = trim((string)$row[0]);

            if ($tipo === '0' && $updatedAt === null) {
                if (isset($row[6]) && isset($row[7])) {
                    $d = trim((string)$row[6]);
                    $h = trim((string)$row[7]);
                    $updatedAt = trim($d . ' ' . $h);
                }
                continue;
            }

            if ($tipo !== '2') continue;

            $frete = $toMoney($getCell($row, $idx, 'FRETE'));
            $freteTotal += $frete;

            $rowsOut[] = [
                'em' => $getCell($row, $idx, 'EM'),
                'ctrc' => $getCell($row, $idx, 'CTRC'),
                'numero_cte' => $getCell($row, $idx, 'NUMERO CT-e/NFPS'),
                'pagador' => $getCell($row, $idx, 'PAGADOR'),
                'cnpj_pagador' => $getCell($row, $idx, 'CNPJ PAGADOR'),
                'cob' => $getCell($row, $idx, 'COB'),
                'dest' => $getCell($row, $idx, 'DEST'),
                'unidade_responsavel' => $getCell($row, $idx, 'UNIDADE RESPONSAVEL'),
                'filial_cobranca' => $getCell($row, $idx, 'FILIAL COBRANCA'),
                'unidade_cobranca' => mb_substr(trim((string)$getCell($row, $idx, 'FILIAL COBRANCA')), 0, 3, 'UTF-8'),
                'banco' => $getCell($row, $idx, 'BANCO'),
                'frete' => $frete,
                'emissao' => $getCell($row, $idx, 'EMISSAO'),
                'nfiscal' => $getCell($row, $idx, 'NFISCAL'),
                'tip' => $getCell($row, $idx, 'TIP'),
                'pre_fatu' => $getCell($row, $idx, 'PRE-FATU'),
                'ult_ocor' => $getCell($row, $idx, 'ULT. OCOR'),
                'chave_cte' => $getCell($row, $idx, 'CHAVE CTE'),
                'data_entrega' => $getCell($row, $idx, 'DATA ENTREGA'),
                'prev_entrega' => $getCell($row, $idx, 'PREVISAO DE ENTREGA'),
                'comp_entrega_escaneado' => $getCell($row, $idx, 'COMPROVANTE DE ENTREGA ESCANEADO'),
                'observacao' => $getCell($row, $idx, 'OBSERVACAO'),
            ];
        }

        return [
            'csv' => $csv,
            'updated_at' => $updatedAt,
            'totals' => [
                'ctes' => count($rowsOut),
                'frete_total' => round($freteTotal, 2),
            ],
            'rows' => $rowsOut,
        ];
    };

    $refFimDmy = date('dmy');
    $url = 'https://sistema.ssw.inf.br/bin/ssw0103?act=PES'
        . '&cod_emp_ctb=01'
        . '&t_data_ref_ini=010101'
        . '&t_data_ref_fim=' . urlencode($refFimDmy)
        . '&t_tp_fil=C'
        . '&t_tp_cliente=C'
        . '&t_tp_cli_fat=T'
        . '&t_situacao_ctrc=I'
        . '&t_periodicidade=T'
        . '&t_rel_lista=T'
        . '&t_cons_bloqueados=N'
        . '&t_cons_a_vista=N'
        . '&t_tp_classificacao=F'
        . '&t_excel=S'
        . '&t_ler_morto=N';

    if ($step === 'START' || $step === 'RUN') {
        $rowsBefore = $get1440Rows();
        $baselineSeq = 0;
        foreach ($rowsBefore as $r) $baselineSeq = max($baselineSeq, (int)($r['seq'] ?? 0));
        $requestStartTs = time();

        $html = (string)$sswFetch($url, 6);
        $html = urldecode((string)$html);

        [$act, $arq] = $getActArq($html);
        if ($act !== '' && $arq !== '') {
            $t0 = microtime(true);
            $csvRaw = (string)$sswFetch("https://sistema.ssw.inf.br/bin/ssw0424?act={$act}&filename={$arq}&path=&down=1&nw=0", 6);
            $t1 = microtime(true);
            if ($csvRaw === '' || strlen((string)$csvRaw) < 20) {
                $respondJson(['success' => false, 'message' => 'Arquivo CSV do SSW0103 vazio ou inválido.'], 500);
            }
            $parsed = $parse0103Csv((string)$csvRaw);
            $respondJson([
                'success' => true,
                'status' => 'ready',
                'result' => 'data',
                'meta' => [
                    'programa' => 'ssw0103',
                    'ref_fim_dmy' => $refFimDmy,
                    'ontem_dmy' => $refFimDmy,
                    'act' => $act,
                    'filename' => $arq,
                    'updated_at' => $parsed['updated_at'],
                    'gerado_em' => date('c'),
                    'timing_ms' => [
                        'download' => (int)round(($t1 - $t0) * 1000),
                    ],
                    'size_bytes' => [
                        'csv' => strlen((string)($parsed['csv'] ?? '')),
                    ],
                ],
                'totals' => $parsed['totals'],
                'rows' => $parsed['rows'],
            ]);
        }

        if ($step === 'RUN') {
            $respondJson([
                'success' => true,
                'status' => 'started',
                'baseline_seq' => $baselineSeq,
                'request_start_ts' => $requestStartTs,
                'meta' => [
                    'programa' => 'ssw0103',
                    'ref_fim_dmy' => $refFimDmy,
                    'ontem_dmy' => $refFimDmy,
                    'gerado_em' => date('c'),
                ],
            ]);
        }

        $respondJson([
            'success' => true,
            'status' => 'started',
            'baseline_seq' => $baselineSeq,
            'request_start_ts' => $requestStartTs,
            'meta' => [
                'programa' => 'ssw0103',
                'ref_fim_dmy' => $refFimDmy,
                'ontem_dmy' => $refFimDmy,
                'gerado_em' => date('c'),
            ],
        ]);
    }

    if ($step === 'POLL') {
        $baselineSeq = (int)($input['baseline_seq'] ?? 0);
        $requestStartTs = (int)($input['request_start_ts'] ?? 0);
        if ($baselineSeq <= 0 || $requestStartTs <= 0) {
            $respondJson(['success' => false, 'message' => 'baseline_seq/request_start_ts inválidos.'], 400);
        }

        $rows = $get1440Rows();
        $cands = [];
        foreach ($rows as $r) {
            $seqVal = (int)($r['seq'] ?? 0);
            if ($seqVal <= $baselineSeq) continue;
            $f2ts = $parseF2Ts((string)($r['f2'] ?? ''));
            if ($f2ts === null || $f2ts < ($requestStartTs - 120)) continue;
            $f8raw = (string)($r['f8'] ?? '');
            if ($f8raw === '') continue;
            $acts = $extractActsFromF8($f8raw);
            if (empty($acts)) continue;
            $cands[] = $r;
        }

        $prefer = array_values(array_filter($cands, static fn($r) => substr(trim((string)($r['opc'] ?? '')), 0, 3) === '441'));
        $scan = !empty($prefer) ? $prefer : $cands;

        foreach ($scan as $r) {
            $acts = $extractActsFromF8((string)($r['f8'] ?? ''));
            foreach ($acts as $act) {
                $dl = $downloadFromAct((string)$act);
                if (!$dl) continue;
                $t0 = microtime(true);
                $parsed = $parse0103Csv((string)$dl['content']);
                $t1 = microtime(true);
                $respondJson([
                    'success' => true,
                    'status' => 'ready',
                    'result' => 'data',
                    'meta' => [
                        'programa' => 'ssw0103',
                        'ref_fim_dmy' => $refFimDmy,
                        'ontem_dmy' => $refFimDmy,
                        'ssw_seq' => (int)($r['seq'] ?? 0),
                        'act' => null,
                        'filename' => (string)($dl['filename'] ?? ''),
                        'updated_at' => $parsed['updated_at'],
                        'gerado_em' => date('c'),
                        'timing_ms' => array_merge(
                            (array)($dl['timing_ms'] ?? []),
                            ['parse_csv' => (int)round(($t1 - $t0) * 1000)]
                        ),
                        'size_bytes' => array_merge(
                            (array)($dl['size_bytes'] ?? []),
                            ['csv' => strlen((string)($parsed['csv'] ?? ''))]
                        ),
                    ],
                    'totals' => $parsed['totals'],
                    'rows' => $parsed['rows'],
                ]);
            }
        }

        $respondJson([
            'success' => true,
            'status' => 'pending',
            'meta' => [
                'programa' => 'ssw0103',
                'ref_fim_dmy' => $refFimDmy,
                'ontem_dmy' => $refFimDmy,
                'gerado_em' => date('c'),
            ],
        ]);
    }

    $respondJson(['success' => false, 'message' => 'Requisição inválida.'], 400);
} catch (Throwable $e) {
    $respondJson(['success' => false, 'message' => $e->getMessage()], 500);
}
