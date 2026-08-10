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

    if (preg_match('/(?:id|name)=web_body[^>]*value="([^"]+)"/i', $t1, $mVal)) {
        $decoded = urldecode((string)($mVal[1] ?? ''));
        $decoded = html_entity_decode((string)$decoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        if (preg_match("/abrir\\s*\\(\\s*'([^']+)'\\s*,\\s*'([^']*)'\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*'([^']*)'\\s*(?:,\\s*(\\d+)\\s*)?\\)/i", $decoded, $mArq)) {
            $act = trim((string)($mArq[1] ?? ''));
            $filename = trim((string)($mArq[2] ?? ''));
            $pathStr = trim((string)($mArq[3] ?? ''));
            $pathNum = trim((string)($mArq[4] ?? ''));
            if ($act !== '' && $filename === '') $filename = $act;
            $pathParam = $pathStr !== '' ? $pathStr : ($pathNum !== '' ? $pathNum : '');

            if ($act !== '') {
                $dlUrl = 'https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($act) . '&filename=' . urlencode($filename) . '&down=1&nw=1';
                if ($pathParam !== '') $dlUrl .= '&path=' . urlencode($pathParam);

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
                'message' => 'SSW gerou o relatório, mas o Presto não conseguiu localizar/baixar o arquivo (ssw0424).',
            ];
        }
        return ['ok' => false, 'raw' => '', 'message' => $msg];
    }
    return ['ok' => false, 'raw' => '', 'message' => 'SSW retornou uma resposta inesperada.'];
};

$fetched = $fetchCsvOrMessage($url);
if (!$fetched['ok']) {
    respondJson(['success' => false, 'message' => (string)$fetched['message']]);
}
$raw = (string)$fetched['raw'];

$raw = html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
$raw = str_replace(["\r\n", "\r"], ["\n", "\n"], $raw);

$start = stripos($raw, 'COTACAO;');
if ($start !== false) {
    $raw = substr($raw, $start);
}

$raw = preg_replace("/^\xEF\xBB\xBF/", '', $raw);
$lines = preg_split('/\n+/', trim($raw));
if (!$lines || count($lines) < 2) {
    respondJson(['success' => false, 'message' => 'Planilha inválida ou vazia retornada pelo SSW.']);
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
        if (($row['status_kind'] ?? '') === 'CONTRAT') $agg[$key]['contratadas']++;
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

$parsedCurrent = $parseReport($raw, true);
if (!$parsedCurrent['ok']) {
    respondJson(['success' => false, 'message' => (string)($parsedCurrent['message'] ?? 'Falha ao interpretar planilha do SSW.')]);
}

$comparisons = null;
if ($includeComparisons) {
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

    $comparisons = [
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
}

$res = [
    'success' => true,
    'meta' => [
        'ssw_url' => $url,
        'truncated' => (bool)($parsedCurrent['meta']['truncated'] ?? false),
        'max_rows' => (int)($parsedCurrent['meta']['max_rows'] ?? 0),
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
    'totals' => $parsedCurrent['totals'],
    'byStatus' => $parsedCurrent['byStatus'],
    'byUser' => $parsedCurrent['byUser'],
    'byUnidadeInclusao' => $parsedCurrent['byUnidadeInclusao'],
    'byCliente' => $parsedCurrent['byCliente'],
    'rows' => $parsedCurrent['rows'],
    'comparisons' => $comparisons,
];

respondJson($res);
