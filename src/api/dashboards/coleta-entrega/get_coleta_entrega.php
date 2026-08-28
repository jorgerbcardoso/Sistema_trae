<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];
$g_sql  = connect();

$currentUser = getCurrentUser();
$unidade     = strtoupper(trim($currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? ''));

if (empty($unidade) || !preg_match('/^[A-Z0-9]{2,5}$/', $unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade do usuário inválida.']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input    = getRequestInput();
$view     = strtoupper(trim($input['view'] ?? '076'));
$step     = strtoupper(trim($input['step'] ?? 'RUN'));
$dataIni  = trim($input['data_ini'] ?? '');
$dataFin  = trim($input['data_fin'] ?? '');
$placa    = strtoupper(trim($input['placa'] ?? ''));

if (!in_array($view, ['076', 'ANDAMENTO', 'ROM'], true)) {
    respondJson(['success' => false, 'message' => 'View inválida.']);
}

ssw_login($domain);
set_time_limit(600);
ini_set('memory_limit', '512M');

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Erro fatal PHP: ' . $err['message'] . ' em ' . $err['file'] . ':' . $err['line']]);
    }
});

function parseXmlFromResponse($str) {
    $pos = strpos((string)$str, '<xml');
    if ($pos === false) return null;
    $xml = substr((string)$str, $pos);
    $end = strpos($xml, '</xml>');
    if ($end === false) return null;
    $xml = substr($xml, 0, $end) . '</xml>';
    return simplexml_load_string($xml) ?: null;
}

function extractHtmlCellText($s) {
    $dec = html_entity_decode((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if (preg_match('/<!--\\s*(.*?)\\s*-->/', $dec, $m)) return trim((string)$m[1]);
    if (preg_match('/<u>\\s*(.*?)\\s*<\\/u>/i', $dec, $m)) return trim(strip_tags((string)$m[1]));
    return trim(strip_tags($dec));
}

function parseIntPtBr($s) {
    $s = trim((string)$s);
    if ($s === '') return 0;
    $s = str_replace(['.', ',', ' '], ['', '', ''], $s);
    return (int)$s;
}

function parseMoedaPtBr($s) {
    $s = trim((string)$s);
    if ($s === '') return 0.0;
    $s = str_replace(['.', ' '], ['', ''], $s);
    $s = str_replace(',', '.', $s);
    return (float)$s;
}

function parse1440F2Ts($f2) {
    $f2 = trim((string)$f2);
    if ($f2 === '') return null;
    $dt = DateTime::createFromFormat('d/m/y H:i:s', $f2);
    if (!$dt) return null;
    return $dt->getTimestamp();
}

function extractDownloadActFromF8($f8raw) {
    $f8dec = html_entity_decode((string)$f8raw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if (preg_match("/ajaxEnvia\\s*\\(\\s*'\\s*([^']+)\\s*'\\s*\\)/", $f8dec, $mAct)) {
        $act = trim((string)($mAct[1] ?? ''));
        return $act !== '' ? $act : null;
    }
    return null;
}

function downloadFrom1440Act($act) {
    $act = trim((string)$act);
    if ($act === '') return null;
    $dummy = (string)((int)(microtime(true) * 1000));
    $html = (string)ssw_go('https://sistema.ssw.inf.br/bin/ssw1440?act=' . urlencode($act) . '&web_body=&dummy=' . $dummy);
    if ($html === '') return null;
    if (substr($html, 0, 5) === '<foc ') return null;

    if (!preg_match('/id=web_body[^>]*value="([^"]+)"/i', $html, $mVal)) {
        if (!preg_match('/name=web_body[^>]*value="([^"]+)"/i', $html, $mVal)) {
            return null;
        }
    }

    $decoded = urldecode((string)($mVal[1] ?? ''));
    $decoded = html_entity_decode((string)$decoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    if (!preg_match("/abrir\\s*\\(\\s*'([^']+)'\\s*,\\s*'[^']*'\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*'([^']+)'/i", $decoded, $mArq)) {
        if (!preg_match("/abrir\\s*\\(\\s*'([^']+)'\\s*,\\s*'([^']+)'/i", $decoded, $mArq2)) {
            return null;
        }
        $filename = trim((string)($mArq2[1] ?? ''));
        $path = trim((string)($mArq2[2] ?? ''));
    } else {
        $filename = trim((string)($mArq[1] ?? ''));
        $path = trim((string)($mArq[2] ?? ''));
    }

    if ($filename === '' || $path === '') return null;
    $file = (string)ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($filename) . '&filename=' . urlencode($filename) . '&path=' . urlencode($path) . '&down=1&nw=1');
    if ($file === '' || strlen($file) < 100) return null;

    return [
        'filename' => $filename,
        'path' => $path,
        'content' => $file,
    ];
}

if ($step !== 'RUN') {
    if ($step === 'START') {
        if (empty($dataIni) || empty($dataFin)) {
            respondJson(['success' => false, 'message' => 'Período obrigatório.']);
        }
        if (!preg_match('/^\d{2}\/\d{2}\/\d{2}$/', $dataIni) || !preg_match('/^\d{2}\/\d{2}\/\d{2}$/', $dataFin)) {
            respondJson(['success' => false, 'message' => 'Formato de data inválido. Use DD/MM/AA.']);
        }
        $dtIni = DateTime::createFromFormat('d/m/y', $dataIni);
        $dtFin = DateTime::createFromFormat('d/m/y', $dataFin);
        if (!$dtIni || !$dtFin) respondJson(['success' => false, 'message' => 'Data inválida.']);
        if ($dtFin < $dtIni) respondJson(['success' => false, 'message' => 'A data final não pode ser anterior à data inicial.']);
        $diffDias = $dtIni->diff($dtFin)->days;
        if ($diffDias > 31) respondJson(['success' => false, 'message' => 'O período não pode ser maior que 31 dias.']);

        $modo = ($diffDias === 0) ? 'DETALHE' : 'RESUMO';
        $dataIniSsw = str_replace('/', '', $dataIni);
        $dataFinSsw = str_replace('/', '', $dataFin);

        $login = strtolower(trim((string)($currentUser['username'] ?? '')));
        $baselineSeq = 0;
        $xmlBaseline = parseXmlFromResponse((string)ssw_go('https://sistema.ssw.inf.br/bin/ssw1440'));
        if ($xmlBaseline) {
            $rows = $xmlBaseline->xpath('rs/r') ?: [];
            foreach ($rows as $row) {
                $seqNum = (int)(string)($row->f0 ?? 0);
                $opcStr = (string)($row->f1 ?? '');
                if (substr($opcStr, 0, 3) !== '076') continue;
                $usrStr = strtolower(trim((string)($row->f3 ?? '')));
                if ($login !== '' && $usrStr !== $login) continue;
                $baselineSeq = max($baselineSeq, $seqNum);
            }
        }

        $url0216 = 'https://sistema.ssw.inf.br/bin/ssw0216?act=ENV'
            . '&f2=' . urlencode($unidade)
            . '&f3=' . urlencode($dataIniSsw)
            . '&f4=' . urlencode($dataFinSsw)
            . '&f7=' . urlencode($modo === 'DETALHE' ? 'R' : 'X')
            . '&t_email=N,';
        if (!empty($placa)) $url0216 .= '&f6=' . urlencode($placa);
        $str0216 = (string)ssw_go($url0216);
        if (substr($str0216, 0, 5) === '<foc ') {
            respondJson(['success' => false, 'message' => 'Erro SSW (0216): ' . $str0216]);
        }

        respondJson([
            'success' => true,
            'status' => 'queued',
            'modo' => $modo,
            'baseline_seq' => $baselineSeq,
            'request_start_ts' => time(),
        ]);
    }

    if ($step === 'POLL') {
        $baselineSeqIn = (int)($input['baseline_seq'] ?? 0);
        $requestStartTsIn = (int)($input['request_start_ts'] ?? 0);
        $login = strtolower(trim((string)($currentUser['username'] ?? '')));

        $t0 = microtime(true);
        $raw1440 = (string)ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
        $t1 = microtime(true);
        $ms1440 = (int)round(($t1 - $t0) * 1000);
        $xml = parseXmlFromResponse($raw1440);
        if (!$xml) {
            respondJson(['success' => true, 'status' => 'waiting', 'message' => 'SSW1440 indisponível no momento.', 'ms_1440' => $ms1440]);
        }

        $match = null;
        $bestScore = -1;
        $rows = $xml->xpath('rs/r') ?: [];
        $i = 0;
        foreach ($rows as $row) {
            if ($i++ >= 3000) break;
            $seqNum = (int)(string)($row->f0 ?? 0);
            $opcStr = ltrim((string)($row->f1 ?? ''));
            if (substr($opcStr, 0, 3) !== '076') continue;

            $usrStr = strtolower(trim((string)($row->f3 ?? '')));
            $userMatch = ($login !== '' && $usrStr === $login);
            $unitStr = strtoupper(trim((string)($row->f4 ?? '')));
            $unitMatch = ($unidade !== '' && strtoupper(trim((string)$unidade)) === $unitStr);
            if (!$userMatch && !$unitMatch) continue;

            $f2 = (string)($row->f2 ?? '');
            $f2ts = parse1440F2Ts($f2);
            $fresh = ($baselineSeqIn > 0 && $seqNum > $baselineSeqIn)
                || ($requestStartTsIn > 0 && $f2ts !== null && abs($f2ts - $requestStartTsIn) <= 6 * 3600);
            $score = ($userMatch ? 100 : 0) + ($unitMatch ? 50 : 0) + ($fresh ? 10 : 0);
            if ($score < $bestScore) continue;

            $sit = (string)($row->f6 ?? '');
            $f8 = (string)($row->f8 ?? '');
            $cand = [
                'seq' => $seqNum,
                'opc' => $opcStr,
                'usr' => (string)($row->f3 ?? ''),
                'f2' => $f2,
                'sit' => $sit,
                'download_act' => $f8 !== '' ? extractDownloadActFromF8($f8) : null,
            ];
            if ($score > $bestScore || ($score === $bestScore && $seqNum > (int)($match['seq'] ?? 0))) {
                $bestScore = $score;
                $match = $cand;
            }
            if ($bestScore >= 160 && ($match['sit'] ?? '') === 'Conclu&iacute;do' && !empty($match['download_act'])) break;
        }

        if (!$match) {
            respondJson(['success' => true, 'status' => 'waiting', 'ms_1440' => $ms1440]);
        }

        if (($match['sit'] ?? '') === 'Conclu&iacute;do') {
            respondJson(['success' => true, 'status' => 'ready', 'ms_1440' => $ms1440] + $match);
        }

        respondJson(['success' => true, 'status' => 'running', 'ms_1440' => $ms1440] + $match);
    }

    if ($step === 'DOWNLOAD') {
        $downloadActIn = trim((string)($input['download_act'] ?? ''));
        $modoIn = strtoupper(trim((string)($input['modo'] ?? '')));
        if ($downloadActIn === '') respondJson(['success' => false, 'message' => 'download_act obrigatório.']);

        $dl = downloadFrom1440Act($downloadActIn);
        if (!$dl || empty($dl['content']) || strlen((string)$dl['content']) < 100) {
            respondJson(['success' => false, 'message' => 'Arquivo do relatório 076 vazio ou inválido.']);
        }

        $file = (string)$dl['content'];
        $file = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
        $file = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file);
        $file = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));

        $modo = in_array($modoIn, ['DETALHE', 'RESUMO'], true) ? $modoIn : 'DETALHE';

        if ($modo === 'RESUMO') {
            $grupos = [];
            $p = 0;
            $n = strlen((string)$file);
            while ($p <= $n) {
                $nl = strpos((string)$file, "\n", $p);
                if ($nl === false) {
                    $ln = substr((string)$file, $p);
                    $p = $n + 1;
                } else {
                    $ln = substr((string)$file, $p, $nl - $p);
                    $p = $nl + 1;
                }
                $ln = trim((string)$ln);
                if ($ln === '') continue;
                $cols = str_getcsv($ln, ';');
                if (count($cols) < 15) continue;
                $tp = trim((string)($cols[0] ?? ''));
                if ($tp !== '2') continue;

                $placaCsv = strtoupper(trim((string)($cols[3] ?? '')));
                if ($placaCsv === '') continue;
                $coletasCsv = parseIntPtBr($cols[5] ?? '0');
                $entregasCsv = parseIntPtBr($cols[7] ?? '0');
                $pesoCsv = parseMoedaPtBr($cols[9] ?? '0');
                $volCsv = parseIntPtBr($cols[10] ?? '0');
                $valMercCsv = parseMoedaPtBr($cols[11] ?? '0');
                $freteCsv = parseMoedaPtBr($cols[12] ?? '0');
                $remVeicCsv = parseMoedaPtBr($cols[25] ?? '0');

                $grupos[] = [
                    'placa' => $placaCsv,
                    'coletas' => $coletasCsv,
                    'entregas' => $entregasCsv,
                    'total' => $coletasCsv + $entregasCsv,
                    'peso' => round($pesoCsv, 3),
                    'frete' => round($freteCsv, 2),
                    'valMerc' => round($valMercCsv, 2),
                    'vol' => $volCsv,
                    'contratado' => '',
                    'remuneracao' => round($remVeicCsv, 2),
                    'ctrcs' => [],
                ];
            }

            usort($grupos, fn($a, $b) => ($b['total'] <=> $a['total']) ?: ($b['frete'] <=> $a['frete']));

            $totalColetas = 0;
            $totalEntregas = 0;
            $totalPeso = 0.0;
            $totalFrete = 0.0;
            $totalValMerc = 0.0;
            $totalVol = 0;
            $totalRemuneracao = 0.0;
            foreach ($grupos as $g) {
                $totalColetas += (int)$g['coletas'];
                $totalEntregas += (int)$g['entregas'];
                $totalPeso += (float)$g['peso'];
                $totalFrete += (float)$g['frete'];
                $totalValMerc += (float)$g['valMerc'];
                $totalVol += (int)$g['vol'];
                $totalRemuneracao += (float)$g['remuneracao'];
            }

            respondJson([
                'success' => true,
                'mode' => 'RESUMO',
                'operacoes' => [],
                'grupos' => $grupos,
                'contratados' => [],
                'serieCronologica' => [],
                'totais' => [
                    'coletas' => $totalColetas,
                    'entregas' => $totalEntregas,
                    'total' => $totalColetas + $totalEntregas,
                    'placas' => count($grupos),
                    'peso' => round($totalPeso, 3),
                    'frete' => round($totalFrete, 2),
                    'valMerc' => round($totalValMerc, 2),
                    'vol' => $totalVol,
                    'remuneracao' => round($totalRemuneracao, 2),
                ],
            ]);
        }
        $runId = (string)((int)(microtime(true) * 1000));
        $login = strtolower(trim((string)($currentUser['username'] ?? '')));
        dbg_ce504($runId, 'step_download_ready_to_parse', ['downloadAct' => $downloadActIn, 'len' => strlen((string)$file), 'login' => $login]);
        goto __PARSE076__;
    }

    respondJson(['success' => false, 'message' => 'Step inválido.']);
}

// #region debug-point coleta-entrega-504
function dbg_ce504_url() {
    static $cached = null;
    if ($cached !== null) return $cached;
    $cached = '';
    $envPath = __DIR__ . '/../../../../.dbg/coleta-entrega-504.env';
    if (is_file($envPath)) {
        $raw = @file_get_contents($envPath);
        if (is_string($raw) && $raw !== '') {
            foreach (preg_split('/\\r\\n|\\r|\\n/', $raw) as $ln) {
                $ln = trim((string)$ln);
                if ($ln === '' || strpos($ln, '=') === false) continue;
                [$k, $v] = explode('=', $ln, 2);
                if (trim($k) === 'DEBUG_SERVER_URL') {
                    $cached = trim((string)$v);
                    break;
                }
            }
        }
    }
    return $cached;
}

function dbg_ce504($runId, $event, $data = []) {
    $url = dbg_ce504_url();
    if ($url === '') return;
    $payload = [
        'ts' => (int)round(microtime(true) * 1000),
        'sessionId' => 'coleta-entrega-504',
        'runId' => (string)$runId,
        'event' => (string)$event,
        'data' => is_array($data) ? $data : ['value' => $data],
    ];
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            'timeout' => 2,
        ],
    ]);
    @file_get_contents($url, false, $ctx);
}
// #endregion debug-point coleta-entrega-504

if ($view !== '076') {
    $strTroca = ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($unidade) . '&f3=101');
    if (substr((string)$strTroca, 0, 5) === '<foc ') {
        respondJson(['success' => false, 'message' => 'Erro SSW (troca unidade): ' . (string)$strTroca]);
    }

    $romXmlRaw = ssw_go('https://sistema.ssw.inf.br/bin/ssw0198?act=ROM');
    if (substr((string)$romXmlRaw, 0, 5) === '<foc ') {
        respondJson(['success' => false, 'message' => 'Erro SSW (0198): ' . (string)$romXmlRaw]);
    }

    $xml = parseXmlFromResponse((string)$romXmlRaw);
    if (!$xml) {
        respondJson(['success' => false, 'message' => 'Resposta inválida do SSW (0198 ROM).']);
    }

    $rows = $xml->xpath('rs/r') ?: [];
    $romaneios = [];
    $totRom = 0;
    $totCtrcs = 0;
    $totFalta = 0;
    $placas = [];

    foreach ($rows as $r) {
        $rom = extractHtmlCellText((string)($r->f0 ?? ''));
        if ($rom === '') continue;

        $pl = extractHtmlCellText((string)($r->f1 ?? ''));
        $carreta = extractHtmlCellText((string)($r->f2 ?? ''));
        $inclusaoRaw = trim((string)($r->f3 ?? ''));
        $marcaModelo = trim(html_entity_decode((string)($r->f4 ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $motorista = trim(html_entity_decode((string)($r->f5 ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $qtCtrcs = (int)trim((string)($r->f6 ?? '0'));
        $faltaOcor = (int)trim((string)($r->f7 ?? '0'));
        $unidadeInfo = trim(html_entity_decode((string)($r->f8 ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $erroHtml = html_entity_decode((string)($r->f14 ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $erro = trim(strip_tags((string)$erroHtml));
        $seqRom = trim((string)($r->f17 ?? ''));

        $romaneios[] = [
            'romaneio' => $rom,
            'placa' => $pl,
            'carreta' => $carreta,
            'inclusao' => $inclusaoRaw,
            'marcaModelo' => $marcaModelo,
            'motorista' => $motorista,
            'qtdeCtrcs' => $qtCtrcs,
            'faltaOcorrencia' => $faltaOcor,
            'unidade' => $unidadeInfo,
            'seqRomaneio' => $seqRom,
            'erro' => $erro,
        ];

        $totRom++;
        $totCtrcs += $qtCtrcs;
        $totFalta += $faltaOcor;
        if ($pl !== '') $placas[$pl] = true;
    }

    usort($romaneios, function($a, $b) {
        return strcmp((string)($b['inclusao'] ?? ''), (string)($a['inclusao'] ?? ''));
    });

    respondJson([
        'success' => true,
        'view' => 'ANDAMENTO',
        'romaneios' => $romaneios,
        'totais' => [
            'romaneios' => $totRom,
            'ctrcs' => $totCtrcs,
            'faltaOcorrencia' => $totFalta,
            'veiculos' => count($placas),
        ],
    ]);
}

if (empty($dataIni) || empty($dataFin)) {
    respondJson(['success' => false, 'message' => 'Período obrigatório.']);
}

if (!preg_match('/^\d{2}\/\d{2}\/\d{2}$/', $dataIni) || !preg_match('/^\d{2}\/\d{2}\/\d{2}$/', $dataFin)) {
    respondJson(['success' => false, 'message' => 'Formato de data inválido. Use DD/MM/AA.']);
}

$dtIni = DateTime::createFromFormat('d/m/y', $dataIni);
$dtFin = DateTime::createFromFormat('d/m/y', $dataFin);

if (!$dtIni || !$dtFin) {
    respondJson(['success' => false, 'message' => 'Data inválida.']);
}

if ($dtFin < $dtIni) {
    respondJson(['success' => false, 'message' => 'A data final não pode ser anterior à data inicial.']);
}

$diffDias = $dtIni->diff($dtFin)->days;
if ($diffDias > 31) {
    respondJson(['success' => false, 'message' => 'O período não pode ser maior que 31 dias.']);
}

$modo = ($diffDias === 0) ? 'DETALHE' : 'RESUMO';

$dataIniSsw = str_replace('/', '', $dataIni);
$dataFinSsw = str_replace('/', '', $dataFin);

$login = strtolower(trim((string)($currentUser['username'] ?? '')));
$runId = (string)((int)(microtime(true) * 1000));
dbg_ce504($runId, 'request_start', [
    'view' => $view,
    'modo' => $modo,
    'unidade' => $unidade,
    'login' => $login,
    'data_ini' => $dataIni,
    'data_fin' => $dataFin,
    'placa' => $placa,
]);
$baselineSeq = 0;
$t0 = microtime(true);
$baselineRaw = (string)ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
$t1 = microtime(true);
$xmlBaseline = parseXmlFromResponse($baselineRaw);
dbg_ce504($runId, 'ssw1440_baseline_done', [
    'ms' => (int)round(($t1 - $t0) * 1000),
    'raw_len' => strlen($baselineRaw),
    'xml_ok' => (bool)$xmlBaseline,
]);
if ($xmlBaseline) {
    $rowsBase = $xmlBaseline->xpath('rs/r/f0') ?: [];
    foreach ($rowsBase as $seqNode) {
        $baselineSeq = max($baselineSeq, (int)(string)$seqNode);
    }
}
dbg_ce504($runId, 'baseline_seq', ['baselineSeq' => $baselineSeq]);

$url0216 = 'https://sistema.ssw.inf.br/bin/ssw0216?act=ENV'
    . '&f2=' . urlencode($unidade)
    . '&f3=' . urlencode($dataIniSsw)
    . '&f4=' . urlencode($dataFinSsw)
    . '&f7=' . urlencode($modo === 'DETALHE' ? 'R' : 'X')
    . '&t_email=N,';

if (!empty($placa)) {
    $url0216 .= '&f6=' . urlencode($placa);
}

$t0 = microtime(true);
$str0216 = (string)ssw_go($url0216);
$t1 = microtime(true);
dbg_ce504($runId, 'ssw0216_env_done', [
    'ms' => (int)round(($t1 - $t0) * 1000),
    'resp_prefix' => substr($str0216, 0, 80),
]);

if (substr($str0216, 0, 5) === '<foc ') {
    respondJson(['success' => false, 'message' => 'Erro SSW (0216): ' . $str0216]);
}

$seqRelatorio  = null;
$encontrado    = false;
$downloadAct = null;
$maxTentativas = 80;
$intervalo     = 3;

function lerXml1440() {
    $str = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
    $pos = strpos($str, '<xml');
    if ($pos === false) return null;
    $str = substr($str, $pos);
    $end = strpos($str, '</xml>');
    if ($end === false) return null;
    $str = substr($str, 0, $end) . '</xml>';
    return simplexml_load_string($str) ?: null;
}

for ($tentativa = 0; $tentativa < $maxTentativas; $tentativa++) {
    sleep($intervalo);

    $t0 = microtime(true);
    $xml1440 = lerXml1440();
    $t1 = microtime(true);
    dbg_ce504($runId, 'poll_1440', [
        'tentativa' => $tentativa + 1,
        'ms' => (int)round(($t1 - $t0) * 1000),
        'xml_ok' => (bool)$xml1440,
    ]);
    if (!$xml1440) continue;

    $found = false;
    $foundSit = '';
    $foundSeq = 0;
    $foundUsr = '';
    $foundOpc = '';
    for ($i = 0; $i <= 100; $i++) {
        $seq = $xml1440->xpath('rs/r/f0')[$i];
        $opc = $xml1440->xpath('rs/r/f1')[$i];
        $usr = $xml1440->xpath('rs/r/f3')[$i];
        $sit = $xml1440->xpath('rs/r/f6')[$i];

        if ($seq === null) break;

        $usr    = trim((string)$usr);
        $sitStr = (string)$sit;
        $seqNum = (int)(string)$seq;

        if ((substr((string)$opc, 0, 3) == '076')
            && ($seqNum > $baselineSeq)
            && ($login === '' || strtolower($usr) === $login)
        ) {
            $seqRelatorio = $seqNum;
            $found = true;
            $foundSit = $sitStr;
            $foundSeq = $seqNum;
            $foundUsr = $usr;
            $foundOpc = (string)$opc;
            if ($sitStr === 'Conclu&iacute;do') {
                $encontrado = true;
                $f8 = $xml1440->xpath('rs/r/f8')[$i] ?? null;
                if ($f8) {
                    $f8dec = html_entity_decode((string)$f8, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    if (preg_match("/ajaxEnvia\\s*\\(\\s*'\\s*([^']+)\\s*'\\s*\\)/", $f8dec, $mAct)) {
                        $downloadAct = trim((string)($mAct[1] ?? ''));
                    }
                }
            }
            break;
        }
    }

    dbg_ce504($runId, 'poll_match', [
        'tentativa' => $tentativa + 1,
        'found' => $found,
        'seq' => $foundSeq,
        'usr' => $foundUsr,
        'opc' => $foundOpc,
        'sit' => $foundSit,
        'downloadAct' => $downloadAct,
        'encontrado' => $encontrado,
    ]);

    if ($encontrado) break;
}

if (!$encontrado || $seqRelatorio === null) {
    respondJson(['success' => false, 'message' => 'Relatório 076 não ficou pronto no tempo esperado. Tente novamente.']);
}

$dominioUpper = strtoupper($domain);
$file = null;

if ($downloadAct) {
    dbg_ce504($runId, 'download_start', ['downloadAct' => $downloadAct, 'seqRelatorio' => $seqRelatorio]);
    $t0 = microtime(true);
    $dl = downloadFrom1440Act($downloadAct);
    $t1 = microtime(true);
    dbg_ce504($runId, 'download_done', [
        'ms' => (int)round(($t1 - $t0) * 1000),
        'ok' => (bool)$dl,
        'filename' => (string)($dl['filename'] ?? ''),
        'path' => (string)($dl['path'] ?? ''),
        'len' => $dl && isset($dl['content']) ? strlen((string)$dl['content']) : 0,
    ]);
    if ($dl && !empty($dl['content'])) {
        $file = (string)$dl['content'];
    }
}

if (empty($file) || strlen($file) < 100) {
    $pathJobs = '/usr/aws/jobs/' . $dominioUpper . '/';
    $suffix = sprintf('%08d', $seqRelatorio) . '.sswweb';
    $candidates = [
        'REL' . $dominioUpper . $suffix,
        'TXT' . $dominioUpper . $suffix,
        'CSV' . $dominioUpper . $suffix,
    ];
    foreach ($candidates as $cand) {
        $try = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$cand}&filename={$cand}&path={$pathJobs}&down=1&nw=1");
        if (!empty($try) && strlen($try) >= 100) {
            $file = $try;
            break;
        }
    }
}

if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Arquivo do relatório 076 vazio ou inválido.']);
}

$file   = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
$file   = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file);
$file   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
dbg_ce504($runId, 'file_normalized', ['len' => strlen((string)$file), 'modo' => $modo]);

if ($modo === 'RESUMO') {
    $t0 = microtime(true);
    $grupos = [];
    $p = 0;
    $n = strlen((string)$file);
    while ($p <= $n) {
        $nl = strpos((string)$file, "\n", $p);
        if ($nl === false) {
            $ln = substr((string)$file, $p);
            $p = $n + 1;
        } else {
            $ln = substr((string)$file, $p, $nl - $p);
            $p = $nl + 1;
        }
        $ln = trim((string)$ln);
        if ($ln === '') continue;
        $cols = str_getcsv($ln, ';');
        if (count($cols) < 15) continue;
        $tp = trim((string)($cols[0] ?? ''));
        if ($tp !== '2') continue;

        $placaCsv = strtoupper(trim((string)($cols[3] ?? '')));
        if ($placaCsv === '') continue;
        $coletasCsv = parseIntPtBr($cols[5] ?? '0');
        $entregasCsv = parseIntPtBr($cols[7] ?? '0');
        $pesoCsv = parseMoedaPtBr($cols[9] ?? '0');
        $volCsv = parseIntPtBr($cols[10] ?? '0');
        $valMercCsv = parseMoedaPtBr($cols[11] ?? '0');
        $freteCsv = parseMoedaPtBr($cols[12] ?? '0');
        $remVeicCsv = parseMoedaPtBr($cols[25] ?? '0');

        $grupos[] = [
            'placa' => $placaCsv,
            'coletas' => $coletasCsv,
            'entregas' => $entregasCsv,
            'total' => $coletasCsv + $entregasCsv,
            'peso' => round($pesoCsv, 3),
            'frete' => round($freteCsv, 2),
            'valMerc' => round($valMercCsv, 2),
            'vol' => $volCsv,
            'contratado' => '',
            'remuneracao' => round($remVeicCsv, 2),
            'ctrcs' => [],
        ];
    }

    usort($grupos, fn($a, $b) => ($b['total'] <=> $a['total']) ?: ($b['frete'] <=> $a['frete']));

    $totalColetas = 0;
    $totalEntregas = 0;
    $totalPeso = 0.0;
    $totalFrete = 0.0;
    $totalValMerc = 0.0;
    $totalVol = 0;
    $totalRemuneracao = 0.0;
    foreach ($grupos as $g) {
        $totalColetas += (int)$g['coletas'];
        $totalEntregas += (int)$g['entregas'];
        $totalPeso += (float)$g['peso'];
        $totalFrete += (float)$g['frete'];
        $totalValMerc += (float)$g['valMerc'];
        $totalVol += (int)$g['vol'];
        $totalRemuneracao += (float)$g['remuneracao'];
    }

    respondJson([
        'success' => true,
        'mode' => 'RESUMO',
        'operacoes' => [],
        'grupos' => $grupos,
        'contratados' => [],
        'serieCronologica' => [],
        'totais' => [
            'coletas' => $totalColetas,
            'entregas' => $totalEntregas,
            'total' => $totalColetas + $totalEntregas,
            'placas' => count($grupos),
            'peso' => round($totalPeso, 3),
            'frete' => round($totalFrete, 2),
            'valMerc' => round($totalValMerc, 2),
            'vol' => $totalVol,
            'remuneracao' => round($totalRemuneracao, 2),
        ],
    ]);
}

__PARSE076__:
$operacoes = [];
$contratadoPorPlacaDia = [];
$remuneracaoPorPlacaDia = [];

$placaAtual = null;
$contratadoAtual = null;
$diaAtual = null;
$tipoAtual = null;
$tipoCodigoAtual = null;
$colBounds = null;

{
    $t0Parse = microtime(true);
    dbg_ce504($runId, 'parse_txt_start', ['len' => strlen((string)$file)]);
    $p = 0;
    $n = strlen((string)$file);
    while ($p <= $n) {
        $nl = strpos((string)$file, "\n", $p);
        if ($nl === false) {
            $linha = substr((string)$file, $p);
            $p = $n + 1;
        } else {
            $linha = substr((string)$file, $p, $nl - $p);
            $p = $nl + 1;
        }
        $linha = rtrim((string)$linha, "\r\n");
    if (trim($linha) === '') continue;

    if (preg_match('/^VEICULO:\\s*([A-Z0-9]{7})\\b.*?CONTRATADO:\\s*(.+?)\\s*$/i', $linha, $m)) {
        $placaAtual = strtoupper(trim($m[1]));
        $contratadoAtual = trim($m[2]);
        $diaAtual = null;
        $tipoAtual = null;
        $tipoCodigoAtual = null;
        $colBounds = null;
        continue;
    }

    if (preg_match('/^DIA\\s+(\\d{2}\\/\\d{2}\\/\\d{2})\\s+(COLETA|ENTREGA)\\s*$/i', trim($linha), $m)) {
        $diaAtual = trim($m[1]);
        $tipoAtual = strtoupper(trim($m[2]));
        $tipoCodigoAtual = $tipoAtual === 'COLETA' ? 'C' : 'E';
        if ($placaAtual && $contratadoAtual) {
            $contratadoPorPlacaDia[$placaAtual . '|' . $diaAtual] = $contratadoAtual;
        }
        continue;
    }

    if (strpos($linha, '---') !== false && strpos($linha, '+') !== false) {
        if (preg_match('/^-{3,}\\+/', trim($linha))) {
            $bounds = [];
            $len = strlen($linha);
            $plus = [];
            for ($i = 0; $i < $len; $i++) {
                if ($linha[$i] === '+') $plus[] = $i;
            }
            if (count($plus) >= 5) {
                $start = 0;
                foreach ($plus as $p) {
                    $bounds[] = [$start, $p];
                    $start = $p + 1;
                }
                $bounds[] = [$start, $len];
                $colBounds = $bounds;
            }
        }
        continue;
    }

    if ($placaAtual && $diaAtual && preg_match('/\\*\\*\\*REMUNERACAO DO DIA:\\s*([0-9\\.,]+)\\s*$/i', $linha, $m)) {
        $valor = parseMoedaPtBr($m[1]);
        $remuneracaoPorPlacaDia[$placaAtual . '|' . $diaAtual] = $valor;
        continue;
    }

    if (!$placaAtual || !$diaAtual || !$tipoCodigoAtual || !$colBounds) continue;

    if (stripos($linha, 'CTRC') === 0) continue;
    if (stripos(trim($linha), 'SUB-TOTAL') === 0) continue;
    if (stripos(trim($linha), 'TOTAL') === 0) continue;
    if (stripos(trim($linha), 'BASE DE CALCULO') === 0) continue;
    if (stripos(trim($linha), 'DIARIA') === 0) continue;

    $cols = [];
    foreach ($colBounds as $b) {
        $seg = substr($linha, $b[0], $b[1] - $b[0]);
        $cols[] = trim($seg);
    }

    $ctrc = $cols[0] ?? '';
    if ($ctrc === '' || !preg_match('/^[A-Z0-9]{3,}[0-9]{3,}-[0-9]+$/', $ctrc)) continue;

    $nf = $cols[1] ?? '';
    $remetente = $cols[2] ?? '';
    $expedidor = $cols[3] ?? '';
    $recebedor = $cols[4] ?? '';
    $pesoStr = $cols[8] ?? '';
    $volStr = $cols[9] ?? '';
    $valMercStr = $cols[10] ?? '';
    $vlrFreteStr = $cols[11] ?? '';
    $romaneio = $cols[14] ?? '';
    $ctrbOs = $cols[15] ?? '';

    $pesoNum = parseMoedaPtBr($pesoStr);
    $volNum = parseIntPtBr($volStr);
    $valMercNum = parseMoedaPtBr($valMercStr);
    $vlrFreteNum = parseMoedaPtBr($vlrFreteStr);

    $keyPd = $placaAtual . '|' . $diaAtual;
    $operacoes[] = [
        'placa'            => $placaAtual,
        'tipo'             => $tipoAtual,
        'tipoCodigo'       => $tipoCodigoAtual,
        'dataBaixa'        => $diaAtual,
        'ctrc'             => $ctrc,
        'nf'               => $nf,
        'nomeRemetente'    => $remetente,
        'nomeExpedidor'    => $expedidor,
        'nomeDestinatario' => $recebedor,
        'nomeRecebedor'    => $recebedor,
        'cidadeEntrega'    => '',
        'nomePagador'      => '',
        'ocorrencia'       => '',
        'dataOcorrencia'   => '',
        'set'              => '',
        'pesoCalculo'      => $pesoNum,
        'qtVol'            => $volNum,
        'valMerc'          => $valMercNum,
        'vlrFrete'         => $vlrFreteNum,
        'romaneio'         => $romaneio,
        'nroCtrb'          => $ctrbOs,
        'contratado'       => $contratadoPorPlacaDia[$keyPd] ?? $contratadoAtual ?? '',
        'remuneracaoDia'   => $remuneracaoPorPlacaDia[$keyPd] ?? 0.0,
    ];
    }
}
dbg_ce504($runId, 'parse_txt_done', [
    'ms' => isset($t0Parse) ? (int)round((microtime(true) - $t0Parse) * 1000) : null,
    'operacoes' => count($operacoes),
]);

$totalColetas  = 0;
$totalEntregas = 0;
$totalPeso     = 0.0;
$totalFrete    = 0.0;
$totalValMerc  = 0.0;
$totalVol      = 0;
$totalRemuneracao = 0.0;

$porPlaca    = [];
$porData     = [];
$porContratado = [];
$remSeen = [];
$remSeenContratado = [];

foreach ($operacoes as $op) {
    $pl = $op['placa'];
    $dt = $op['dataBaixa'];
    $contratado = trim((string)($op['contratado'] ?? ''));
    if ($contratado === '') $contratado = 'N/I';
    $remKey = $pl . '|' . $dt;
    $remDia = (float)($op['remuneracaoDia'] ?? 0.0);
    if ($remDia > 0 && empty($remSeen[$remKey])) {
        $totalRemuneracao += $remDia;
        $remSeen[$remKey] = true;
    }
    $remKeyContr = $contratado . '|' . $remKey;
    if ($remDia > 0 && empty($remSeenContratado[$remKeyContr])) {
        $remSeenContratado[$remKeyContr] = true;
    }

    if ($op['tipoCodigo'] === 'C') $totalColetas++;
    if ($op['tipoCodigo'] === 'E') $totalEntregas++;
    $totalPeso    += $op['pesoCalculo'];
    $totalFrete   += $op['vlrFrete'];
    $totalValMerc += $op['valMerc'];
    $totalVol     += $op['qtVol'];

    if (!isset($porPlaca[$pl])) {
        $porPlaca[$pl] = [
            'placa'    => $pl,
            'coletas'  => 0,
            'entregas' => 0,
            'total'    => 0,
            'peso'     => 0.0,
            'frete'    => 0.0,
            'valMerc'  => 0.0,
            'vol'      => 0,
            'contratado' => $contratado,
            'remuneracao' => 0.0,
            'ctrcs'    => [],
        ];
    }
    if ($contratado !== 'N/I' && ($porPlaca[$pl]['contratado'] === 'N/I' || $porPlaca[$pl]['contratado'] === '')) {
        $porPlaca[$pl]['contratado'] = $contratado;
    }
    $seenPlaca = $porPlaca[$pl]['_remSeen'] ?? [];
    if ($remDia > 0 && empty($seenPlaca[$dt])) {
        $porPlaca[$pl]['_remSeen'] = $seenPlaca;
        $porPlaca[$pl]['_remSeen'][$dt] = true;
        $porPlaca[$pl]['remuneracao'] += $remDia;
    }
    if ($op['tipoCodigo'] === 'C') $porPlaca[$pl]['coletas']++;
    if ($op['tipoCodigo'] === 'E') $porPlaca[$pl]['entregas']++;
    $porPlaca[$pl]['total']++;
    $porPlaca[$pl]['peso']    += $op['pesoCalculo'];
    $porPlaca[$pl]['frete']   += $op['vlrFrete'];
    $porPlaca[$pl]['valMerc'] += $op['valMerc'];
    $porPlaca[$pl]['vol']     += $op['qtVol'];
    $porPlaca[$pl]['ctrcs'][]  = $op;

    if (!isset($porData[$dt])) {
        $porData[$dt] = ['data' => $dt, 'coletas' => 0, 'entregas' => 0, 'frete' => 0.0, 'peso' => 0.0];
    }
    if ($op['tipoCodigo'] === 'C') $porData[$dt]['coletas']++;
    if ($op['tipoCodigo'] === 'E') $porData[$dt]['entregas']++;
    $porData[$dt]['frete'] += $op['vlrFrete'];
    $porData[$dt]['peso']  += $op['pesoCalculo'];

    if (!isset($porContratado[$contratado])) {
        $porContratado[$contratado] = [
            'contratado' => $contratado,
            'placas' => [],
            'coletas' => 0,
            'entregas' => 0,
            'total' => 0,
            'peso' => 0.0,
            'frete' => 0.0,
            'valMerc' => 0.0,
            'vol' => 0,
            'remuneracao' => 0.0,
            '_remSeen' => [],
        ];
    }
    $porContratado[$contratado]['placas'][$pl] = true;
    if ($op['tipoCodigo'] === 'C') $porContratado[$contratado]['coletas']++;
    if ($op['tipoCodigo'] === 'E') $porContratado[$contratado]['entregas']++;
    $porContratado[$contratado]['total']++;
    $porContratado[$contratado]['peso'] += $op['pesoCalculo'];
    $porContratado[$contratado]['frete'] += $op['vlrFrete'];
    $porContratado[$contratado]['valMerc'] += $op['valMerc'];
    $porContratado[$contratado]['vol'] += $op['qtVol'];
    if ($remDia > 0 && empty($porContratado[$contratado]['_remSeen'][$remKey])) {
        $porContratado[$contratado]['_remSeen'][$remKey] = true;
        $porContratado[$contratado]['remuneracao'] += $remDia;
    }
}

foreach ($porPlaca as &$g) {
    $g['peso']    = round($g['peso'], 3);
    $g['frete']   = round($g['frete'], 2);
    $g['valMerc'] = round($g['valMerc'], 2);
    $g['remuneracao'] = round($g['remuneracao'], 2);
    unset($g['_remSeen']);
}
unset($g);

ksort($porData);
$serieCronologica = array_values($porData);

$placasOrdenadas = array_values($porPlaca);
usort($placasOrdenadas, fn($a, $b) => $b['total'] - $a['total']);

$contratadosOrdenados = array_values($porContratado);
foreach ($contratadosOrdenados as &$c) {
    $c['placas'] = count($c['placas']);
    $c['peso'] = round($c['peso'], 3);
    $c['frete'] = round($c['frete'], 2);
    $c['valMerc'] = round($c['valMerc'], 2);
    $c['remuneracao'] = round($c['remuneracao'], 2);
    unset($c['_remSeen']);
}
unset($c);
usort($contratadosOrdenados, fn($a, $b) => ($b['remuneracao'] <=> $a['remuneracao']) ?: ($b['total'] <=> $a['total']));

respondJson([
    'success'          => true,
    'mode'             => 'DETALHE',
    'operacoes'        => $operacoes,
    'grupos'           => $placasOrdenadas,
    'contratados'      => $contratadosOrdenados,
    'serieCronologica' => $serieCronologica,
    'totais'           => [
        'coletas'  => $totalColetas,
        'entregas' => $totalEntregas,
        'total'    => count($operacoes),
        'placas'   => count($porPlaca),
        'peso'     => round($totalPeso, 3),
        'frete'    => round($totalFrete, 2),
        'valMerc'  => round($totalValMerc, 2),
        'vol'      => $totalVol,
        'remuneracao' => round($totalRemuneracao, 2),
    ],
]);
