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
$dataIni  = trim($input['data_ini'] ?? '');
$dataFin  = trim($input['data_fin'] ?? '');
$placa    = strtoupper(trim($input['placa'] ?? ''));

if (!in_array($view, ['076', 'ANDAMENTO', 'ROM'], true)) {
    respondJson(['success' => false, 'message' => 'View inválida.']);
}

ssw_login($domain);
set_time_limit(180);
ini_set('memory_limit', '256M');

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

$dataIniSsw = str_replace('/', '', $dataIni);
$dataFinSsw = str_replace('/', '', $dataFin);

$login = strtolower(trim((string)($currentUser['username'] ?? '')));
$baselineSeq = 0;
$xmlBaseline = parseXmlFromResponse((string)ssw_go('https://sistema.ssw.inf.br/bin/ssw1440'));
if ($xmlBaseline) {
    $rowsBase = $xmlBaseline->xpath('rs/r/f0') ?: [];
    foreach ($rowsBase as $seqNode) {
        $baselineSeq = max($baselineSeq, (int)(string)$seqNode);
    }
}

$url0216 = 'https://sistema.ssw.inf.br/bin/ssw0216?act=ENV'
    . '&f2=' . urlencode($unidade)
    . '&f3=' . urlencode($dataIniSsw)
    . '&f4=' . urlencode($dataFinSsw)
    . '&f7=R'
    . '&t_email=N,';

if (!empty($placa)) {
    $url0216 .= '&f6=' . urlencode($placa);
}

$str0216 = ssw_go($url0216);

if (substr($str0216, 0, 5) === '<foc ') {
    respondJson(['success' => false, 'message' => 'Erro SSW (0216): ' . $str0216]);
}

$seqRelatorio  = null;
$encontrado    = false;
$downloadAct = null;
$maxTentativas = 40;
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

function parseMoedaPtBr($s) {
    $s = trim((string)$s);
    if ($s === '') return 0.0;
    $s = str_replace(['.', ' '], ['', ''], $s);
    $s = str_replace(',', '.', $s);
    return (float)$s;
}

function parseIntPtBr($s) {
    $s = trim((string)$s);
    if ($s === '') return 0;
    $s = str_replace(['.', ',', ' '], ['', '', ''], $s);
    return (int)$s;
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

for ($tentativa = 0; $tentativa < $maxTentativas; $tentativa++) {
    sleep($intervalo);

    $xml1440 = lerXml1440();
    if (!$xml1440) continue;

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

    if ($encontrado) break;
}

if (!$encontrado || $seqRelatorio === null) {
    respondJson(['success' => false, 'message' => 'Relatório 076 não ficou pronto no tempo esperado. Tente novamente.']);
}

$dominioUpper = strtoupper($domain);
$file = null;

if ($downloadAct) {
    $dl = downloadFrom1440Act($downloadAct);
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
$linhas = explode("\n", $file);

$operacoes = [];
$contratadoPorPlacaDia = [];
$remuneracaoPorPlacaDia = [];

$placaAtual = null;
$contratadoAtual = null;
$diaAtual = null;
$tipoAtual = null;
$tipoCodigoAtual = null;
$colBounds = null;

foreach ($linhas as $linhaRaw) {
    $linha = rtrim($linhaRaw, "\r\n");
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
