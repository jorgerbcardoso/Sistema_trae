<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../lib/ssw_loader.php';

handleOptionsRequest();
validateRequestMethod('POST');

$noCacheHeaders = static function(): void {
    if (headers_sent()) return;
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
};

$noCacheHeaders();

$auth = authenticateAndGetUser();
$domain = $auth['domain'];
$g_sql = connect();

$input = getRequestInput();
$step = strtoupper(trim((string)($input['step'] ?? 'RUN')));
if (!in_array($step, ['RUN', 'START', 'POLL', 'DOWNLOAD'], true)) $step = 'RUN';

require_ssw();
ssw_login($domain);
set_time_limit(180);
ini_set('memory_limit', '768M');

$tpFrete = strtoupper(trim((string)($input['f7'] ?? $input['tp_frete'] ?? 'T')));
$situacaoFiltro = strtoupper(trim((string)($input['f8'] ?? $input['situacao'] ?? 'T')));
$unidInclusao = strtoupper(trim((string)($input['f11'] ?? $input['unid_inclusao'] ?? '')));
$unidOrigem = strtoupper(trim((string)($input['f13'] ?? $input['unid_origem'] ?? '')));
$usuarioInclusao = trim((string)($input['f14'] ?? $input['usuario'] ?? ''));
$cnpjPagador = trim((string)($input['f16'] ?? $input['cnpj_pagador'] ?? ''));
$periodoIniIso = trim((string)($input['periodo_ini'] ?? $input['periodo_inclusao_inicio'] ?? $input['inicio'] ?? ''));
$periodoFimIso = trim((string)($input['periodo_fim'] ?? $input['periodo_inclusao_fim'] ?? $input['fim'] ?? ''));
$includeComparisons = (bool)($input['include_comparisons'] ?? true);

$digitsOnly = static function(string $s): string {
    return preg_replace('/\D+/', '', (string)$s);
};

$parseSciToDigits = static function(string $s): string {
    $s = trim((string)$s);
    $s = str_replace([' ', "\xc2\xa0", "\xa0"], '', $s);
    if ($s === '') return '';
    if (preg_match('/^\d+$/', $s)) return $s;
    if (preg_match('/^([0-9]+)(?:,([0-9]+))?E\+(\d+)$/i', $s, $m)) {
        $int = (string)$m[1];
        $frac = (string)($m[2] ?? '');
        $exp = (int)$m[3];
        $digits = $int . $frac;
        $fracLen = strlen($frac);
        $zeros = $exp - $fracLen;
        if ($zeros >= 0) return $digits . str_repeat('0', $zeros);
        $cut = strlen($digits) + $zeros;
        if ($cut <= 0) return '0';
        return substr($digits, 0, $cut);
    }
    if (preg_match('/^([0-9]+)(?:\.([0-9]+))?E\+(\d+)$/i', $s, $m)) {
        $int = (string)$m[1];
        $frac = (string)($m[2] ?? '');
        $exp = (int)$m[3];
        $digits = $int . $frac;
        $fracLen = strlen($frac);
        $zeros = $exp - $fracLen;
        if ($zeros >= 0) return $digits . str_repeat('0', $zeros);
        $cut = strlen($digits) + $zeros;
        if ($cut <= 0) return '0';
        return substr($digits, 0, $cut);
    }
    return $digitsOnly($s);
};

$cnpjDigits = $digitsOnly($cnpjPagador);
if ($cnpjDigits === '' && trim($cnpjPagador) !== '') {
    $cnpjDigits = $parseSciToDigits($cnpjPagador);
}

$validIso = static function(string $iso): bool {
    return $iso !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $iso) === 1;
};

$parseBrDateToIso = static function(string $s): string {
    $s = trim((string)$s);
    if ($s === '') return '';
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $s, $m)) {
        return "{$m[3]}-{$m[2]}-{$m[1]}";
    }
    return '';
};

if (!$validIso($periodoIniIso)) {
    $try = $parseBrDateToIso($periodoIniIso);
    if ($try !== '') $periodoIniIso = $try;
}
if (!$validIso($periodoFimIso)) {
    $try = $parseBrDateToIso($periodoFimIso);
    if ($try !== '') $periodoFimIso = $try;
}

if (!$validIso($periodoIniIso) || !$validIso($periodoFimIso)) {
    respondJson(['success' => false, 'message' => 'Informe período de inclusão (início e fim).']);
}
if (strtotime($periodoIniIso) > strtotime($periodoFimIso)) {
    respondJson(['success' => false, 'message' => 'Período inválido (início maior que fim).']);
}

$toDmy = static function(string $iso): string {
    $ts = strtotime($iso);
    if (!$ts) return '';
    return date('dmy', $ts);
};

$f17 = $toDmy($periodoIniIso);
$f18 = $toDmy($periodoFimIso);

if ($tpFrete !== '' && !in_array($tpFrete, ['C', 'F', 'T'], true)) {
    respondJson(['success' => false, 'message' => 'Tipo de frete inválido (use C, F ou T).']);
}
if ($situacaoFiltro !== '' && !in_array($situacaoFiltro, ['C', 'D', 'F', 'E', 'K', 'T'], true)) {
    respondJson(['success' => false, 'message' => 'Situação inválida (use C, D, F, E, K ou T).']);
}
if ($unidInclusao !== '' && !preg_match('/^[A-Z0-9]{2,5}$/', $unidInclusao)) {
    respondJson(['success' => false, 'message' => 'Unidade de inclusão inválida.']);
}
if ($unidOrigem !== '' && !preg_match('/^[A-Z0-9]{2,5}$/', $unidOrigem)) {
    respondJson(['success' => false, 'message' => 'Unidade de origem inválida.']);
}

$params = [
    'act' => 'PES',
    'f6'  => 'E',
    'f7'  => $tpFrete ?: 'T',
    'f8'  => $situacaoFiltro ?: 'T',
    'f9'  => 'N',
    'f11' => $unidInclusao,
    'f13' => $unidOrigem,
    'f14' => $usuarioInclusao,
    'f16' => $cnpjDigits,
    'f17' => $f17,
    'f18' => $f18,
];

foreach ($params as $k => $v) {
    if ($v === '' || $v === null) unset($params[$k]);
}

// Garantir parâmetro fixo exigido pelo SSW (mesmo que o chamador tente omitir/alterar)
$params['f6'] = 'E';

$url = 'https://sistema.ssw.inf.br/bin/ssw1601?' . http_build_query($params);
$extractPlainMessage = static function(string $raw): string {
    $s = (string)$raw;
    $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $s = preg_replace('/<br\s*\/?>/i', "\n", $s);
    $s = strip_tags($s);
    $s = str_replace(["\xc2\xa0", "\xa0"], ' ', $s);
    $s = preg_replace('/[ \t]+/', ' ', $s);
    $s = preg_replace('/\n{3,}/', "\n\n", $s);
    return trim((string)$s);
};

$sswFetch = static function(string $u, int $tries = 3): string {
    $last = '';
    for ($i = 0; $i < $tries; $i++) {
        $s = (string)ssw_go($u);
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
    $pos = stripos($html, '<xml');
    if ($pos === false) return '';
    $tail = substr($html, $pos);
    $end = stripos($tail, '</xml>');
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

    $nodes = $xml->xpath('rs/r');
    if (!is_array($nodes) || empty($nodes)) return [];

    $rows = [];
    foreach ($nodes as $node) {
        if (!$node) continue;
        $rows[] = [
            'seq' => (int)($node->f0 ?? 0),
            'opc' => (string)($node->f1 ?? ''),
            'f2'  => (string)($node->f2 ?? ''),
            'usr' => (string)($node->f3 ?? ''),
            'f4'  => (string)($node->f4 ?? ''),
            'sit' => (string)($node->f6 ?? ''),
            'f8'  => (string)($node->f8 ?? ''),
        ];
    }
    return $rows;
};

$parseF2Ts = static function(string $f2): ?int {
    $f2 = trim((string)$f2);
    if ($f2 === '') return null;
    $formats = [
        'd/m/y H:i:s',
        'd/m/y H:i',
        'd/m/Y H:i:s',
        'd/m/Y H:i',
    ];
    foreach ($formats as $fmt) {
        $dt = \DateTime::createFromFormat($fmt, $f2);
        if ($dt) return $dt->getTimestamp();
    }
    return null;
};

$normSswStatus = static function(string $s): string {
    $s = trim((string)$s);
    $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if (function_exists('iconv')) {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        if (is_string($ascii) && $ascii !== '') $s = $ascii;
    } else {
        $s = str_replace(['Á','À','Â','Ã','Ä'], 'A', $s);
        $s = str_replace(['É','È','Ê','Ë'], 'E', $s);
        $s = str_replace(['Í','Ì','Î','Ï'], 'I', $s);
        $s = str_replace(['Ó','Ò','Ô','Õ','Ö'], 'O', $s);
        $s = str_replace(['Ú','Ù','Û','Ü'], 'U', $s);
        $s = str_replace(['Ç'], 'C', $s);
        $s = str_replace(['á','à','â','ã','ä'], 'a', $s);
        $s = str_replace(['é','è','ê','ë'], 'e', $s);
        $s = str_replace(['í','ì','î','ï'], 'i', $s);
        $s = str_replace(['ó','ò','ô','õ','ö'], 'o', $s);
        $s = str_replace(['ú','ù','û','ü'], 'u', $s);
        $s = str_replace(['ç'], 'c', $s);
    }
    $s = strtolower($s);
    $s = preg_replace('/[^a-z]/', '', $s);
    return (string)$s;
};

$extractActsFromF8 = static function(string $f8raw): array {
    $f8 = html_entity_decode((string)$f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $acts = [];
    if (preg_match_all("/ajaxEnvia\\s*\\(\\s*'\\s*([^']+)\\s*'\\s*\\)/i", $f8, $m)) {
        foreach ($m[1] as $act) {
            $act = trim((string)$act);
            if ($act !== '') $acts[] = $act;
        }
    }
    return array_values(array_unique($acts));
};

$extractOpcCode = static function(string $opcRaw): string {
    $opc = html_entity_decode((string)$opcRaw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $opc = str_replace(["\xc2\xa0", "\xa0"], ' ', $opc);
    $opc = trim(preg_replace('/\s+/', ' ', $opc));
    if ($opc === '') return '';
    if (preg_match('/\d{1,3}/', $opc, $m)) {
        return str_pad((string)$m[0], 3, '0', STR_PAD_LEFT);
    }
    return substr($opc, 0, 3);
};

$normalizeRequestStartTs = static function(int $v): int {
    if ($v <= 0) return 0;
    if ($v > 20000000000) return (int)floor($v / 1000);
    return $v;
};

$downloadFrom1440Act = static function(string $act) use ($sswFetch): ?array {
    $dummy = (string)((int)(microtime(true) * 1000));
    $url1440 = 'https://sistema.ssw.inf.br/bin/ssw1440?act=' . urlencode($act) . '&web_body=&dummy=' . $dummy;
    $t0 = microtime(true);
    $html = (string)$sswFetch($url1440, 3);
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
    $file = (string)$sswFetch(
        'https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($filename) . '&filename=' . urlencode($filename) . '&path=' . urlencode($path) . '&down=1&nw=1',
        3
    );
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

$tryImmediate = static function(string $u) use ($sswFetch, $extractPlainMessage): array {
    $t0 = microtime(true);
    $raw1 = (string)$sswFetch($u, 3);
    $t1 = microtime(true);
    $t1s = trim((string)$raw1);
    if ($t1s === '') {
        return [
            'kind' => 'error',
            'message' => 'SSW não retornou conteúdo.',
            'http_status' => 502,
            'timing_ms' => ['ssw1601' => (int)round(($t1 - $t0) * 1000)],
        ];
    }

    $t1s = html_entity_decode($t1s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $t1s = str_replace(["\r\n", "\r"], ["\n", "\n"], $t1s);
    $csvStart = stripos($t1s, 'COTACAO;');
    if ($csvStart !== false) {
        return [
            'kind' => 'ready',
            'raw' => substr($t1s, $csvStart),
            'timing_ms' => ['ssw1601' => (int)round(($t1 - $t0) * 1000)],
        ];
    }

    $htmlDec = urldecode((string)$t1s);
    $htmlDec = html_entity_decode((string)$htmlDec, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if (stripos($htmlDec, 'Nenhum registro encontrado') !== false) {
        return [
            'kind' => 'empty',
            'timing_ms' => ['ssw1601' => (int)round(($t1 - $t0) * 1000)],
        ];
    }

    $queuedSignals = [
        'Solicitação enviada para processamento',
        'Solicita&ccedil;&atilde;o enviada para processamento',
        'enviada para processamento',
        'fila',
        'ssw1440',
    ];
    foreach ($queuedSignals as $sig) {
        if (stripos($htmlDec, $sig) !== false) {
            return [
                'kind' => 'queued',
                'timing_ms' => ['ssw1601' => (int)round(($t1 - $t0) * 1000)],
                'size_bytes' => ['ssw1601_html' => strlen($htmlDec)],
            ];
        }
    }

    $act = function_exists('ssw_get_act') ? trim((string)ssw_get_act($htmlDec)) : '';
    $arq = function_exists('ssw_get_arq') ? trim((string)ssw_get_arq($htmlDec)) : '';

    if ($act === '' || $arq === '') {
        if (preg_match('/(?:id|name)=web_body[^>]*value="([^"]+)"/i', $t1s, $mVal)) {
            $decoded = urldecode((string)($mVal[1] ?? ''));
            $decoded = html_entity_decode((string)$decoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (preg_match("/abrir\\s*\\(\\s*'([^']+)'\\s*,\\s*'([^']*)'/i", $decoded, $mArq)) {
                $act = trim((string)($mArq[1] ?? ''));
                $arq = trim((string)($mArq[2] ?? ''));
                if ($act !== '' && $arq === '') $arq = $act;
            }
        }
    }

    if ($act !== '' && $arq !== '') {
        $dlUrl = 'https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($act) . '&filename=' . urlencode($arq) . '&path=&down=1&nw=1';
        $t2 = microtime(true);
        $raw2 = (string)$sswFetch($dlUrl, 3);
        $t3 = microtime(true);
        $t2s = trim((string)$raw2);
        if ($t2s !== '') {
            $t2s = html_entity_decode($t2s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $t2s = str_replace(["\r\n", "\r"], ["\n", "\n"], $t2s);
            $csvStart2 = stripos($t2s, 'COTACAO;');
            if ($csvStart2 !== false) {
                return [
                    'kind' => 'ready',
                    'raw' => substr($t2s, $csvStart2),
                    'timing_ms' => [
                        'ssw1601' => (int)round(($t1 - $t0) * 1000),
                        'download' => (int)round(($t3 - $t2) * 1000),
                    ],
                ];
            }
        }
    }

    $msg = $extractPlainMessage($htmlDec);
    if ($msg !== '') {
        return [
            'kind' => 'error',
            'message' => $msg,
            'http_status' => 500,
            'timing_ms' => ['ssw1601' => (int)round(($t1 - $t0) * 1000)],
        ];
    }
    return [
        'kind' => 'error',
        'message' => 'SSW retornou uma resposta inesperada.',
        'http_status' => 500,
        'timing_ms' => ['ssw1601' => (int)round(($t1 - $t0) * 1000)],
    ];
};

$fetchCsvOrMessage = static function(string $u) use ($extractPlainMessage): array {
    $raw1 = (string)ssw_go($u);
    $t1 = trim((string)$raw1);
    if ($t1 === '') return ['ok' => false, 'raw' => '', 'message' => 'SSW não retornou conteúdo.'];

    $t1 = html_entity_decode($t1, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $t1 = str_replace(["\r\n", "\r"], ["\n", "\n"], $t1);

    $csvStart = stripos($t1, 'COTACAO;');
    if ($csvStart !== false) {
        return ['ok' => true, 'raw' => substr($t1, $csvStart), 'message' => ''];
    }

    $htmlDec = urldecode((string)$t1);
    $act = function_exists('ssw_get_act') ? trim((string)ssw_get_act($htmlDec)) : '';
    $arq = function_exists('ssw_get_arq') ? trim((string)ssw_get_arq($htmlDec)) : '';

    if ($act === '' || $arq === '') {
        if (preg_match('/(?:id|name)=web_body[^>]*value="([^"]+)"/i', $t1, $mVal)) {
            $decoded = urldecode((string)($mVal[1] ?? ''));
            $decoded = html_entity_decode((string)$decoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (preg_match("/abrir\\s*\\(\\s*'([^']+)'\\s*,\\s*'([^']*)'/i", $decoded, $mArq)) {
                $act = trim((string)($mArq[1] ?? ''));
                $arq = trim((string)($mArq[2] ?? ''));
                if ($act !== '' && $arq === '') $arq = $act;
            }
        }
    }

    if ($act !== '' && $arq !== '') {
        $dlUrl = 'https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($act) . '&filename=' . urlencode($arq) . '&path=&down=1&nw=1';
        $raw2 = (string)ssw_go($dlUrl);
        $t2 = trim((string)$raw2);
        if ($t2 !== '') {
            $t2 = html_entity_decode($t2, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $t2 = str_replace(["\r\n", "\r"], ["\n", "\n"], $t2);
            $csvStart2 = stripos($t2, 'COTACAO;');
            if ($csvStart2 !== false) {
                return ['ok' => true, 'raw' => substr($t2, $csvStart2), 'message' => ''];
            }
        }
    }

    $only = trim(preg_replace('/\s+/', ' ', $t1));
    if (preg_match('#^https?://[^\s]+$#i', $only)) {
        $raw2 = (string)ssw_go($only);
        $t2 = trim((string)$raw2);
        $t2 = html_entity_decode($t2, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t2 = str_replace(["\r\n", "\r"], ["\n", "\n"], $t2);
        $csvStart2 = stripos($t2, 'COTACAO;');
        if ($csvStart2 !== false) {
            return ['ok' => true, 'raw' => substr($t2, $csvStart2), 'message' => ''];
        }
        $msg2 = $extractPlainMessage($t2);
        if ($msg2 !== '') return ['ok' => false, 'raw' => '', 'message' => $msg2];
    }

    $msg = $extractPlainMessage($t1);
    if ($msg !== '') {
        if (stripos($msg, 'relatório gerado com sucesso') !== false || stripos($msg, 'relatorio gerado com sucesso') !== false) {
            return [
                'ok' => false,
                'raw' => '',
                'message' => 'Relatório gerado, mas não foi possível baixar o arquivo para leitura.',
            ];
        }
        return ['ok' => false, 'raw' => '', 'message' => $msg];
    }
    return ['ok' => false, 'raw' => '', 'message' => 'SSW retornou uma resposta inesperada.'];
};

$normStr = static function(string $s): string {
    $s = html_entity_decode((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $s = str_replace(["\xc2\xa0", "\xa0"], ' ', $s);
    $s = preg_replace('/\s+/', ' ', $s);
    return trim((string)$s);
};

$normStatus = static function(string $s) use ($normStr): string {
    $s = strtoupper($normStr($s));
    $s = str_replace(['Á','À','Â','Ã','Ä'], 'A', $s);
    $s = str_replace(['É','È','Ê','Ë'], 'E', $s);
    $s = str_replace(['Í','Ì','Î','Ï'], 'I', $s);
    $s = str_replace(['Ó','Ò','Ô','Õ','Ö'], 'O', $s);
    $s = str_replace(['Ú','Ù','Û','Ü'], 'U', $s);
    $s = str_replace(['Ç'], 'C', $s);
    $s = preg_replace('/\s+/', ' ', $s);
    return trim((string)$s);
};

$parseBrFloat = static function(string $s): float {
    $v = trim((string)$s);
    if ($v === '') return 0.0;
    $v = str_replace([' ', "\xc2\xa0", "\xa0"], '', $v);
    $v = str_replace('.', '', $v);
    $v = str_replace(',', '.', $v);
    $n = (float)$v;
    return is_finite($n) ? $n : 0.0;
};

$parseDateTimeBrToIso = static function(string $s): string {
    $s = trim((string)$s);
    if ($s === '') return '';
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/', $s, $m)) {
        return "{$m[3]}-{$m[2]}-{$m[1]} {$m[4]}:{$m[5]}";
    }
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $s, $m)) {
        return "{$m[3]}-{$m[2]}-{$m[1]}";
    }
    return '';
};

$finalizeAgg = static function(array $agg, callable $labelFn = null): array {
    $out = [];
    foreach ($agg as $k => $v) {
        $cot = (int)($v['cotacoes'] ?? 0);
        $ctrc = (int)($v['ctrc_emi'] ?? 0);
        $out[] = [
            'key' => (string)$k,
            'label' => $labelFn ? (string)$labelFn((string)$k) : (string)$k,
            'cotacoes' => $cot,
            'contratadas' => (int)($v['contratadas'] ?? 0),
            'ctrc_emi' => $ctrc,
            'potencial' => (float)($v['potencial'] ?? 0.0),
            'convertido' => (float)($v['convertido'] ?? 0.0),
            'conversao' => $cot > 0 ? ($ctrc / $cot) : 0.0,
        ];
    }
    usort($out, static fn($a, $b) => ($b['cotacoes'] <=> $a['cotacoes']) ?: strcmp($a['label'], $b['label']));
    return $out;
};

$parseReport = static function(string $raw, bool $withRows) use ($parseSciToDigits, $normStr, $normStatus, $parseBrFloat, $parseDateTimeBrToIso, $finalizeAgg): array {
    $raw = html_entity_decode((string)$raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $raw = str_replace(["\r\n", "\r"], ["\n", "\n"], $raw);
    $start = stripos($raw, 'COTACAO;');
    if ($start !== false) $raw = substr($raw, $start);
    $raw = preg_replace("/^\xEF\xBB\xBF/", '', $raw);
    $lines = preg_split('/\n+/', trim((string)$raw));
    if (!$lines || count($lines) < 2) {
        return [
            'ok' => false,
            'message' => 'Planilha inválida ou vazia retornada pelo SSW.',
        ];
    }

    $header = str_getcsv((string)$lines[0], ';');
    $headerNorm = array_map(static fn($h) => strtoupper(trim((string)$h)), $header);
    $idx = [];
    foreach ($headerNorm as $i => $h) {
        if ($h === '') continue;
        $idx[$h] = (int)$i;
    }

    $col = static function(string $name) use ($idx): ?int {
        $k = strtoupper(trim($name));
        return array_key_exists($k, $idx) ? (int)$idx[$k] : null;
    };
    $get = static function(array $fields, ?int $i): string {
        if ($i === null) return '';
        return (string)($fields[$i] ?? '');
    };

    $cCotacao = $col('COTACAO');
    $cUnidIncl = $col('UNIDADE INCLUSAO');
    $cUserIncl = $col('USUARIO INCLUSAO');
    $cCnpjPag = $col('CNPJ PAGADOR');
    $cNomePag = $col('NOME PAGADOR');
    $cOrigem = $col('ORIGEM');
    $cDestino = $col('DESTINO');
    $cTipoFrete = $col('TIPO FRETE');
    $cValorNf = $col('VALOR NF');
    $cPeso = $col('PESO');
    $cCubagem = $col('CUBAGEM');
    $cPropostaAtual = $col('PROPOSTA ATUAL');
    $cSituacao = $col('SITUACAO');
    $cCtrc = $col('CTRC');
    $cDataIncl = $col('DATA HORA INCLUSAO');
    $cValidade = $col('VALIDADE');
    $cDataEmiCtrc = $col('DATA EMISSAO CTRC');
    $cFreteCtrc = $col('FRETE CTRC');
    $cVendedor = $col('VENDEDOR');

    $totals = [
        'cotacoes' => 0,
        'cotado' => 0,
        'contrat' => 0,
        'cot_fix' => 0,
        'ctrc_emi' => 0,
        'potencial' => 0.0,
        'convertido' => 0.0,
    ];

    $byStatus = [];
    $byUser = [];
    $byUnid = [];
    $byCliente = [];
    $rows = [];
    $truncated = false;
    $maxRows = $withRows ? 6000 : 0;

    $addAgg = static function(array &$agg, string $key, array $row) : void {
        if (!isset($agg[$key])) {
            $agg[$key] = [
                'key' => $key,
                'cotacoes' => 0,
                'contratadas' => 0,
                'ctrc_emi' => 0,
                'potencial' => 0.0,
                'convertido' => 0.0,
            ];
        }
        $agg[$key]['cotacoes']++;
        $agg[$key]['potencial'] += (float)($row['proposta_atual'] ?? 0.0);
        if (($row['status_kind'] ?? '') === 'CONTRAT' || ($row['status_kind'] ?? '') === 'CTRC_EMI') $agg[$key]['contratadas']++;
        if (($row['status_kind'] ?? '') === 'CTRC_EMI') {
            $agg[$key]['ctrc_emi']++;
            $agg[$key]['convertido'] += (float)($row['frete_ctrc'] ?? 0.0);
        }
    };

    for ($li = 1; $li < count($lines); $li++) {
        $line = trim((string)$lines[$li]);
        if ($line === '') continue;
        $fields = str_getcsv($line, ';');
        if (!$fields || count($fields) < 5) continue;

        $situ = $normStatus($get($fields, $cSituacao));
        if ($situ === '' || $situ === 'SITUACAO') continue;

        $statusKind = 'OUTRO';
        if ($situ === 'COTADO') $statusKind = 'COTADO';
        else if ($situ === 'CONTRAT') $statusKind = 'CONTRAT';
        else if ($situ === 'COT FIX') $statusKind = 'CONTRAT';
        else if ($situ === 'CTRC EMI') $statusKind = 'CTRC_EMI';

        $prop = $parseBrFloat($get($fields, $cPropostaAtual));
        $freteCtrc = $parseBrFloat($get($fields, $cFreteCtrc));

        $totals['cotacoes']++;
        $totals['potencial'] += $prop;
        if ($statusKind === 'COTADO') $totals['cotado']++;
        if ($situ === 'CONTRAT') $totals['contrat']++;
        if ($situ === 'COT FIX') $totals['cot_fix']++;
        if ($statusKind === 'CTRC_EMI') {
            $totals['ctrc_emi']++;
            $totals['convertido'] += $freteCtrc;
        }

        if ($withRows) {
            $cotacao = $normStr($get($fields, $cCotacao));
            $unidInc = strtoupper(substr($normStr($get($fields, $cUnidIncl)), 0, 5));
            $usrInc = $normStr($get($fields, $cUserIncl));
            $cnpjPag = $parseSciToDigits($get($fields, $cCnpjPag));
            $nomePag = $normStr($get($fields, $cNomePag));
            $origem = $normStr($get($fields, $cOrigem));
            $destino = $normStr($get($fields, $cDestino));
            $tpFr = strtoupper($normStr($get($fields, $cTipoFrete)));
            $valorNf = $parseBrFloat($get($fields, $cValorNf));
            $peso = $parseBrFloat($get($fields, $cPeso));
            $cub = $parseBrFloat($get($fields, $cCubagem));
            $ctrc = $normStr($get($fields, $cCtrc));
            $dtIncl = $parseDateTimeBrToIso($get($fields, $cDataIncl));
            $dtVal = $parseDateTimeBrToIso($get($fields, $cValidade));
            $dtEmi = $parseDateTimeBrToIso($get($fields, $cDataEmiCtrc));
            $vendedor = $normStr($get($fields, $cVendedor));

            $row = [
                'cotacao' => $cotacao,
                'unidade_inclusao' => $unidInc,
                'usuario_inclusao' => $usrInc,
                'cnpj_pagador' => $cnpjPag,
                'nome_pagador' => $nomePag,
                'vendedor' => $vendedor,
                'origem' => $origem,
                'destino' => $destino,
                'tipo_frete' => $tpFr,
                'valor_nf' => $valorNf,
                'peso' => $peso,
                'cubagem' => $cub,
                'proposta_atual' => $prop,
                'situacao' => $situ,
                'status_kind' => $statusKind,
                'ctrc' => $ctrc,
                'data_inclusao' => $dtIncl,
                'validade' => $dtVal,
                'data_emissao_ctrc' => $dtEmi,
                'frete_ctrc' => $freteCtrc,
            ];

            $rows[] = $row;
            $addAgg($byStatus, $situ, $row);
            if ($usrInc !== '') $addAgg($byUser, strtolower($usrInc), $row);
            if ($unidInc !== '') $addAgg($byUnid, $unidInc, $row);
            $clienteKey = $cnpjPag !== '' ? $cnpjPag : ($nomePag !== '' ? $nomePag : '');
            if ($clienteKey !== '') $addAgg($byCliente, $clienteKey, $row);

            if (count($rows) >= $maxRows) {
                $truncated = true;
                break;
            }
        }
    }

    return [
        'ok' => true,
        'totals' => [
            ...$totals,
            'conversao' => $totals['cotacoes'] > 0 ? ($totals['ctrc_emi'] / $totals['cotacoes']) : 0.0,
        ],
        'rows' => $rows,
        'byStatus' => $withRows ? $finalizeAgg($byStatus) : [],
        'byUser' => $withRows ? $finalizeAgg($byUser) : [],
        'byUnidadeInclusao' => $withRows ? $finalizeAgg($byUnid) : [],
        'byCliente' => $withRows ? $finalizeAgg($byCliente) : [],
        'meta' => [
            'truncated' => $truncated,
            'max_rows' => $withRows ? $maxRows : 0,
        ],
    ];
};

$buildResponse = static function(array $parsed, ?array $comparisons) use ($url, $tpFrete, $situacaoFiltro, $unidInclusao, $unidOrigem, $usuarioInclusao, $cnpjDigits, $f17, $f18, $domain, $g_sql): array {
    if (isset($parsed['rows']) && is_array($parsed['rows']) && count($parsed['rows']) > 0) {
        $tblVc = "{$domain}_vendedor_cliente";
        $digits = static function(string $s): string {
            return preg_replace('/\D+/', '', (string)$s);
        };

        $cnpjsSet = [];
        foreach ($parsed['rows'] as $r) {
            $c = $digits((string)($r['cnpj_pagador'] ?? ''));
            if ($c !== '') $cnpjsSet[$c] = true;
        }

        $map = [];
        if (count($cnpjsSet) > 0) {
            $tblReg = "public.{$tblVc}";
            $resChk = @pg_query_params($g_sql, "SELECT to_regclass($1) AS reg", [$tblReg]);
            $tblExists = false;
            if ($resChk && pg_num_rows($resChk) > 0) {
                $reg = pg_fetch_assoc($resChk);
                $tblExists = isset($reg['reg']) && $reg['reg'] !== null && $reg['reg'] !== '';
            }

            if ($tblExists) {
                $cnpjs = array_keys($cnpjsSet);
                foreach (array_chunk($cnpjs, 500) as $chunk) {
                    $params = [];
                    $ph = [];
                    $p = 1;
                    foreach ($chunk as $c) {
                        $ph[] = '$' . $p;
                        $params[] = (string)$c;
                        $p++;
                    }
                    if (empty($ph)) continue;
                    $q = "
                        SELECT
                            LOWER(BTRIM(login)) AS login,
                            regexp_replace(COALESCE(cnpj, ''), '\\\\D', '', 'g') AS cnpj_digits
                        FROM {$tblVc}
                        WHERE regexp_replace(COALESCE(cnpj, ''), '\\\\D', '', 'g') IN (" . implode(',', $ph) . ")
                    ";
                    $res = @pg_query_params($g_sql, $q, $params);
                    if ($res) {
                        while ($row = pg_fetch_assoc($res)) {
                            $c = (string)($row['cnpj_digits'] ?? '');
                            $login = trim((string)($row['login'] ?? ''));
                            if ($c !== '' && $login !== '' && !isset($map[$c])) {
                                $map[$c] = $login;
                            }
                        }
                    }
                }
            }
        }

        foreach ($parsed['rows'] as $i => $r) {
            $c = $digits((string)($r['cnpj_pagador'] ?? ''));
            $parsed['rows'][$i]['vendedor_login'] = ($c !== '' && isset($map[$c])) ? (string)$map[$c] : '';
        }
    }

    return [
        'success' => true,
        'meta' => [
            'ssw_url' => $url,
            'truncated' => (bool)($parsed['meta']['truncated'] ?? false),
            'max_rows' => (int)($parsed['meta']['max_rows'] ?? 0),
        ],
        'filters' => [
            'f7' => $tpFrete,
            'f8' => $situacaoFiltro,
            'f11' => $unidInclusao,
            'f13' => $unidOrigem,
            'f14' => $usuarioInclusao,
            'f16' => $cnpjDigits,
            'f17' => $f17,
            'f18' => $f18,
        ],
        'totals' => $parsed['totals'] ?? null,
        'byStatus' => $parsed['byStatus'] ?? [],
        'byUser' => $parsed['byUser'] ?? [],
        'byUnidadeInclusao' => $parsed['byUnidadeInclusao'] ?? [],
        'byCliente' => $parsed['byCliente'] ?? [],
        'rows' => $parsed['rows'] ?? [],
        'comparisons' => $comparisons,
    ];
};

$emptyParsed = static function(): array {
    return [
        'ok' => true,
        'totals' => [
            'cotacoes' => 0,
            'cotado' => 0,
            'contrat' => 0,
            'cot_fix' => 0,
            'ctrc_emi' => 0,
            'potencial' => 0.0,
            'convertido' => 0.0,
            'conversao' => 0.0,
        ],
        'rows' => [],
        'byStatus' => [],
        'byUser' => [],
        'byUnidadeInclusao' => [],
        'byCliente' => [],
        'meta' => ['truncated' => false, 'max_rows' => 0],
    ];
};

$computeComparisons = static function() use ($includeComparisons, $periodoFimIso, $periodoIniIso, $params, $fetchCsvOrMessage, $parseReport): ?array {
    if (!$includeComparisons) return null;

    $lenDays = (int)floor((strtotime($periodoFimIso) - strtotime($periodoIniIso)) / 86400) + 1;
    if ($lenDays < 1) $lenDays = 1;

    $prevEnd = date('Y-m-d', strtotime($periodoIniIso . ' -1 day'));
    $prevStart = date('Y-m-d', strtotime($prevEnd . " -" . ($lenDays - 1) . " day"));

    $yearStart = date('Y-m-d', strtotime($periodoIniIso . ' -1 year'));
    $yearEnd = date('Y-m-d', strtotime($periodoFimIso . ' -1 year'));

    $mkParams = static function(array $baseParams, string $startIso, string $endIso): array {
        $baseParams['f17'] = date('dmy', strtotime($startIso));
        $baseParams['f18'] = date('dmy', strtotime($endIso));
        return $baseParams;
    };

    $fetch = static function(array $p) use ($fetchCsvOrMessage): array {
        $u = 'https://sistema.ssw.inf.br/bin/ssw1601?' . http_build_query($p);
        return [$u, $fetchCsvOrMessage($u)];
    };

    $pPrev = $mkParams($params, $prevStart, $prevEnd);
    [$urlPrev, $prevFetched] = $fetch($pPrev);
    $prevParsed = (($prevFetched['ok'] ?? false) === true) ? $parseReport((string)($prevFetched['raw'] ?? ''), false) : ['ok' => false];

    $pYear = $mkParams($params, $yearStart, $yearEnd);
    [$urlYear, $yearFetched] = $fetch($pYear);
    $yearParsed = (($yearFetched['ok'] ?? false) === true) ? $parseReport((string)($yearFetched['raw'] ?? ''), false) : ['ok' => false];

    return [
        'prev_period' => [
            'periodo_ini' => $prevStart,
            'periodo_fim' => $prevEnd,
            'totals' => $prevParsed['ok'] ? $prevParsed['totals'] : null,
            'ssw_url' => $urlPrev,
        ],
        'year_ago' => [
            'periodo_ini' => $yearStart,
            'periodo_fim' => $yearEnd,
            'totals' => $yearParsed['ok'] ? $yearParsed['totals'] : null,
            'ssw_url' => $urlYear,
        ],
    ];
};

$opcQueue = '002';

if ($step === 'DOWNLOAD') {
    $actIn = trim((string)($input['act'] ?? ''));
    if ($actIn === '') respondJson(['success' => false, 'message' => 'Parâmetro act é obrigatório para download.'], 400);
    $dl = $downloadFrom1440Act($actIn);
    if (!$dl) respondJson(['success' => false, 'message' => 'Não foi possível baixar o relatório pela fila (ssw1440).'], 500);

    $parsed = $parseReport((string)$dl['content'], true);
    if (!$parsed['ok']) respondJson(['success' => false, 'message' => (string)($parsed['message'] ?? 'Falha ao interpretar planilha do SSW.')], 500);
    $comparisons = $computeComparisons();
    $res = $buildResponse($parsed, $comparisons);
    $res['status'] = 'ready';
    $res['result'] = 'data';
    $res['meta']['download'] = [
        'act' => $actIn,
        'filename' => (string)($dl['filename'] ?? ''),
        'path' => (string)($dl['path'] ?? ''),
    ];
    respondJson($res);
}

if ($step === 'POLL') {
    $baselineSeqIn = (int)($input['baseline_seq'] ?? 0);
    $requestStartTsIn = $normalizeRequestStartTs((int)($input['request_start_ts'] ?? 0));
    if ($baselineSeqIn <= 0 || $requestStartTsIn <= 0) {
        respondJson(['success' => false, 'message' => 'Parâmetros inválidos para consulta de status (baseline_seq/request_start_ts).'], 400);
    }

    $rows = $get1440Rows();
    if (empty($rows)) respondJson(['success' => false, 'message' => 'Não foi possível ler a fila do sistema (1440) neste momento.'], 500);

    $best = null;
    $bestSeq = -1;
    foreach ($rows as $r) {
        $seqVal = (int)($r['seq'] ?? 0);
        if ($seqVal <= 0) continue;
        $opcStr = (string)($r['opc'] ?? '');
        if ($extractOpcCode($opcStr) !== $opcQueue) continue;
        $sitStr = (string)($r['sit'] ?? '');
        if ($normSswStatus($sitStr) !== 'concluido') continue;
        $f8raw = (string)($r['f8'] ?? '');
        if ($f8raw === '') continue;

        $okBySeq = ($seqVal > $baselineSeqIn);
        $f2ts = $parseF2Ts((string)($r['f2'] ?? ''));
        $okByTime = ($f2ts !== null && $f2ts >= ($requestStartTsIn - 120));
        if (!$okBySeq && !$okByTime) continue;

        $f8dec = html_entity_decode($f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $hasLinksOrNone = (preg_match('/ajaxEnvia\s*\(/i', $f8dec) === 1) || (stripos($f8dec, 'Nenhum registro encontrado') !== false);
        if (!$hasLinksOrNone) continue;

        if ($seqVal > $bestSeq) {
            $bestSeq = $seqVal;
            $best = $r;
        }
    }

    if (!$best) respondJson(['success' => true, 'status' => 'pending']);

    $f8dec = html_entity_decode((string)($best['f8'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if (stripos($f8dec, 'Nenhum registro encontrado') !== false) {
        $res = $buildResponse($emptyParsed(), null);
        $res['status'] = 'ready';
        $res['result'] = 'empty';
        $res['meta']['ssw_seq'] = (int)($best['seq'] ?? 0);
        respondJson($res);
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
    if (empty($rowsBefore)) respondJson(['success' => false, 'message' => 'Não foi possível ler a fila do sistema (1440) neste momento.'], 500);
    $baselineSeq = 0;
    foreach ($rowsBefore as $r) $baselineSeq = max($baselineSeq, (int)($r['seq'] ?? 0));
    $requestStartTs = time();

    $im = $tryImmediate($url);
    if (($im['kind'] ?? '') === 'empty') {
        $res = $buildResponse($emptyParsed(), null);
        $res['status'] = 'ready';
        $res['result'] = 'empty';
        respondJson($res);
    }
    if (($im['kind'] ?? '') === 'ready') {
        $parsed = $parseReport((string)($im['raw'] ?? ''), true);
        if (!$parsed['ok']) respondJson(['success' => false, 'message' => (string)($parsed['message'] ?? 'Falha ao interpretar planilha do SSW.')], 500);
        $comparisons = $computeComparisons();
        $res = $buildResponse($parsed, $comparisons);
        $res['status'] = 'ready';
        $res['result'] = 'data';
        $res['meta']['timing_ms'] = ($im['timing_ms'] ?? []);
        respondJson($res);
    }
    if (($im['kind'] ?? '') === 'error') {
        respondJson(['success' => false, 'message' => (string)($im['message'] ?? 'Falha ao executar o relatório.')], (int)($im['http_status'] ?? 500));
    }

    respondJson([
        'success' => true,
        'status' => 'started',
        'baseline_seq' => $baselineSeq,
        'request_start_ts' => $requestStartTs,
    ]);
}

if ($step === 'RUN') {
    $start = $tryImmediate($url);
    if (($start['kind'] ?? '') === 'empty') {
        $res = $buildResponse($emptyParsed(), null);
        respondJson($res);
    }
    if (($start['kind'] ?? '') === 'ready') {
        $parsed = $parseReport((string)($start['raw'] ?? ''), true);
        if (!$parsed['ok']) respondJson(['success' => false, 'message' => (string)($parsed['message'] ?? 'Falha ao interpretar planilha do SSW.')], 500);
        $comparisons = $computeComparisons();
        $res = $buildResponse($parsed, $comparisons);
        respondJson($res);
    }
    if (($start['kind'] ?? '') === 'error') {
        respondJson(['success' => false, 'message' => (string)($start['message'] ?? 'Falha ao executar o relatório.')], (int)($start['http_status'] ?? 500));
    }

    $rowsBefore = $get1440Rows();
    if (empty($rowsBefore)) respondJson(['success' => false, 'message' => 'Não foi possível ler a fila do sistema (1440) neste momento.'], 500);
    $baselineSeq = 0;
    foreach ($rowsBefore as $r) $baselineSeq = max($baselineSeq, (int)($r['seq'] ?? 0));
    $requestStartTs = time();

    $deadline = time() + 70;
    while (time() <= $deadline) {
        $rows = $get1440Rows();
        $best = null;
        $bestSeq = -1;
        foreach ($rows as $r) {
            $seqVal = (int)($r['seq'] ?? 0);
            if ($seqVal <= 0) continue;
            $opcStr = (string)($r['opc'] ?? '');
            if ($extractOpcCode($opcStr) !== $opcQueue) continue;
            $sitStr = (string)($r['sit'] ?? '');
            if ($normSswStatus($sitStr) !== 'concluido') continue;
            $f8raw = (string)($r['f8'] ?? '');
            if ($f8raw === '') continue;
            $okBySeq = ($seqVal > $baselineSeq);
            $f2ts = $parseF2Ts((string)($r['f2'] ?? ''));
            $okByTime = ($f2ts !== null && $f2ts >= ($requestStartTs - 120));
            if (!$okBySeq && !$okByTime) continue;
            $f8dec = html_entity_decode($f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $hasLinksOrNone = (preg_match('/ajaxEnvia\s*\(/i', $f8dec) === 1) || (stripos($f8dec, 'Nenhum registro encontrado') !== false);
            if (!$hasLinksOrNone) continue;
            if ($seqVal > $bestSeq) { $bestSeq = $seqVal; $best = $r; }
        }

        if ($best) {
            $f8dec = html_entity_decode((string)($best['f8'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (stripos($f8dec, 'Nenhum registro encontrado') !== false) {
                $res = $buildResponse($emptyParsed(), null);
                respondJson($res);
            }

            $acts = $extractActsFromF8((string)($best['f8'] ?? ''));
            if (!empty($acts)) {
                $dl = $downloadFrom1440Act((string)$acts[0]);
                if ($dl) {
                    $parsed = $parseReport((string)$dl['content'], true);
                    if (!$parsed['ok']) break;
                    $comparisons = $computeComparisons();
                    $res = $buildResponse($parsed, $comparisons);
                    respondJson($res);
                }
            }
        }
        sleep(1);
    }

    respondJson(['success' => false, 'message' => 'Timeout aguardando o relatório na fila do sistema (1440).'], 504);
}

respondJson(['success' => false, 'message' => 'Requisição inválida.'], 400);
