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
$dataIni  = trim($input['data_ini'] ?? '');
$dataFin  = trim($input['data_fin'] ?? '');
$placa    = strtoupper(trim($input['placa'] ?? ''));

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

$url0216 = 'https://sistema.ssw.inf.br/bin/ssw0216?act=ENV'
    . '&f2=' . urlencode($unidade)
    . '&f3=' . urlencode($dataIniSsw)
    . '&f4=' . urlencode($dataFinSsw)
    . '&f7=E'
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
            && (($usr == 'presto') || ($usr == 'damasce1') || ($usr == 'claraj'))
        ) {
            if ($seqRelatorio === null) {
                $seqRelatorio = $seqNum;
            }

            if ($seqNum === $seqRelatorio && $sitStr === 'Conclu&iacute;do') {
                $encontrado = true;
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
$arqCsv       = 'CSV' . $dominioUpper . sprintf('%08d', $seqRelatorio) . '.sswweb';
$pathCsv      = '/usr/aws/jobs/' . $dominioUpper . '/';

$file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$arqCsv}&filename={$arqCsv}&path={$pathCsv}&down=1&nw=1");

if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Arquivo do relatório 076 vazio ou inválido.']);
}

$file   = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
$file   = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file);
$file   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
$linhas = explode("\n", $file);

$operacoes = [];

foreach ($linhas as $linha) {
    $linha = trim($linha);
    if ($linha === '') continue;

    $arr = str_getcsv($linha, ';');

    if (count($arr) < 24) continue;

    $placa_csv      = trim($arr[0]  ?? '');
    $tipoBaixa      = trim($arr[1]  ?? '');
    $dataBaixa      = trim($arr[2]  ?? '');
    $ctrc           = trim($arr[3]  ?? '');
    $nf             = trim($arr[4]  ?? '');
    $cnpjRemetente  = trim($arr[5]  ?? '');
    $nomeRemetente  = trim($arr[6]  ?? '');
    $cidadeRemetente = trim($arr[7] ?? '');
    $cnpjExpedidor  = trim($arr[8]  ?? '');
    $nomeExpedidor  = trim($arr[9]  ?? '');
    $cnpjDestinatario = trim($arr[10] ?? '');
    $nomeDestinatario = trim($arr[11] ?? '');
    $cnpjRecebedor  = trim($arr[12] ?? '');
    $nomeRecebedor  = trim($arr[13] ?? '');
    $cidadeEntrega  = trim($arr[14] ?? '');
    $cnpjPagador    = trim($arr[15] ?? '');
    $nomePagador    = trim($arr[16] ?? '');
    $ocorrencia     = trim($arr[17] ?? '');
    $dataOcorrencia = trim($arr[18] ?? '');
    $vlrCtrcOrigem  = trim($arr[19] ?? '');
    $set            = trim($arr[20] ?? '');
    $pesoCalculo    = trim($arr[21] ?? '');
    $qtVol          = trim($arr[22] ?? '');
    $valMerc        = trim($arr[23] ?? '');
    $icms           = trim($arr[24] ?? '');
    $vlrFrete       = trim($arr[25] ?? '');
    $baseCalc       = trim($arr[26] ?? '');
    $romaneio       = trim($arr[27] ?? '');
    $ctrbOs         = trim($arr[28] ?? '');

    if (empty($placa_csv) || empty($tipoBaixa) || empty($dataBaixa)) continue;
    if (!in_array($tipoBaixa, ['E', 'C'])) continue;
    if ($placa_csv === 'PLACA') continue;

    $vlrFreteNum    = (float) str_replace(['.', ','], ['', '.'], $vlrFrete);
    $vlrCtrcNum     = (float) str_replace(['.', ','], ['', '.'], $vlrCtrcOrigem);
    $ctrbOsNum      = (float) str_replace(['.', ','], ['', '.'], $ctrbOs);
    $pesoNum        = (float) str_replace(['.', ','], ['', '.'], $pesoCalculo);
    $valMercNum     = (float) str_replace(['.', ','], ['', '.'], $valMerc);
    $qtVolNum       = (int)   str_replace(['.', ','], ['', ''], $qtVol);

    $operacoes[] = [
        'placa'            => $placa_csv,
        'tipo'             => $tipoBaixa === 'E' ? 'ENTREGA' : 'COLETA',
        'tipoCodigo'       => $tipoBaixa,
        'dataBaixa'        => $dataBaixa,
        'ctrc'             => $ctrc,
        'nf'               => $nf,
        'nomeRemetente'    => $nomeRemetente,
        'cidadeRemetente'  => $cidadeRemetente,
        'nomeExpedidor'    => $nomeExpedidor,
        'nomeDestinatario' => $nomeDestinatario,
        'nomeRecebedor'    => $nomeRecebedor,
        'cidadeEntrega'    => $cidadeEntrega,
        'nomePagador'      => $nomePagador,
        'ocorrencia'       => $ocorrencia,
        'dataOcorrencia'   => $dataOcorrencia,
        'set'              => $set,
        'pesoCalculo'      => $pesoNum,
        'qtVol'            => $qtVolNum,
        'valMerc'          => $valMercNum,
        'vlrFrete'         => $vlrFreteNum,
        'romaneio'         => $romaneio,
        'nroCtrb'          => trim($ctrbOs),
    ];
}

$totalColetas  = 0;
$totalEntregas = 0;
$totalPeso     = 0.0;
$totalFrete    = 0.0;
$totalValMerc  = 0.0;
$totalVol      = 0;

$porPlaca    = [];
$porData     = [];

foreach ($operacoes as $op) {
    $pl = $op['placa'];
    $dt = $op['dataBaixa'];

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
            'ctrcs'    => [],
        ];
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
}

foreach ($porPlaca as &$g) {
    $g['peso']    = round($g['peso'], 3);
    $g['frete']   = round($g['frete'], 2);
    $g['valMerc'] = round($g['valMerc'], 2);
}
unset($g);

ksort($porData);
$serieCronologica = array_values($porData);

$placasOrdenadas = array_values($porPlaca);
usort($placasOrdenadas, fn($a, $b) => $b['total'] - $a['total']);

respondJson([
    'success'          => true,
    'operacoes'        => $operacoes,
    'grupos'           => $placasOrdenadas,
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
    ],
]);
