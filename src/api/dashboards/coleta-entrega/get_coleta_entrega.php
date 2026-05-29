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
    . '&f7=R'
    . '&t_email=N,';

if (!empty($placa)) {
    $url0216 .= '&f6=' . urlencode($placa);
}

$str0216 = ssw_go($url0216);

if (substr($str0216, 0, 5) === '<foc ') {
    respondJson(['success' => false, 'message' => 'Erro SSW (0216): ' . $str0216]);
}

$encontrado  = false;
$nomeArq216  = null;
$pathArq216  = null;
$maxTentativas = 40;
$intervalo     = 3;

for ($tentativa = 0; $tentativa < $maxTentativas; $tentativa++) {
    sleep($intervalo);

    $str1440 = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');

    $posXml = strpos($str1440, '<xml');
    if ($posXml === false) continue;

    $str1440 = substr($str1440, $posXml);
    $posEnd  = strpos($str1440, '</xml>');
    if ($posEnd === false) continue;

    $str1440 = substr($str1440, 0, $posEnd) . '</xml>';
    $xml1440 = simplexml_load_string($str1440);
    if (!$xml1440) continue;

    for ($i = 0; $i <= 100; $i++) {
        $seq = $xml1440->xpath('rs/r/f0')[$i];
        $opc = $xml1440->xpath('rs/r/f1')[$i];
        $usr = $xml1440->xpath('rs/r/f3')[$i];
        $f4  = $xml1440->xpath('rs/r/f4')[$i];
        $sit = $xml1440->xpath('rs/r/f6')[$i];
        $f8  = $xml1440->xpath('rs/r/f8')[$i];

        if ($seq === null) break;

        $usr    = trim((string)$usr);
        $unidF4 = strtoupper(trim((string)$f4));
        $sitStr = (string)$sit;

        if ((substr($opc, 0, 3) == '216')
            && (($usr == 'presto') || ($usr == 'damasce1'))
            && ($unidF4 === strtoupper($unidade))
        ) {
            if ($sitStr === 'Conclu&iacute;do') {
                $encontrado = true;
                $f8dec = html_entity_decode((string)$f8);

                if (preg_match("/ajaxEnvia\s*\(\s*'DOW(\d+)'\s*\)/", $f8dec, $mDow)) {
                    $htmlDow = ssw_go("https://sistema.ssw.inf.br/bin/ssw1440?act=DOW{$mDow[1]}");
                    if (preg_match('/value="([^"]+)"/', $htmlDow, $mVal)) {
                        $decoded = urldecode($mVal[1]);
                        if (preg_match("/abrir\s*\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*\d+\s*,\s*\d+\s*,\s*'([^']+)'/", $decoded, $mArq)) {
                            $nomeArq216 = $mArq[1];
                            $pathArq216 = $mArq[2];
                        }
                    }
                }
            }
            break;
        }
    }

    if ($encontrado) break;
}

if (!$encontrado || !$nomeArq216 || !$pathArq216) {
    respondJson(['success' => false, 'message' => 'Relatório 216 não ficou pronto no tempo esperado. Tente novamente.']);
}

$file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$nomeArq216}&filename={$nomeArq216}&path={$pathArq216}&down=1&nw=1");

if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Arquivo do relatório 216 vazio ou inválido.']);
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

    $percCtrb = 0;
    if ($vlrFreteNum > 0 && $ctrbOsNum > 0) {
        $percCtrb = round(($ctrbOsNum / $vlrFreteNum) * 100, 2);
    }

    $operacoes[] = [
        'placa'            => $placa_csv,
        'tipo'             => $tipoBaixa === 'E' ? 'ENTREGA' : 'COLETA',
        'tipoCodigo'       => $tipoBaixa,
        'dataBaixa'        => $dataBaixa,
        'ctrc'             => $ctrc,
        'nf'               => $nf,
        'cnpjRemetente'    => $cnpjRemetente,
        'nomeRemetente'    => $nomeRemetente,
        'cidadeRemetente'  => $cidadeRemetente,
        'nomeExpedidor'    => $nomeExpedidor,
        'nomeDestinatario' => $nomeDestinatario,
        'nomeRecebedor'    => $nomeRecebedor,
        'cidadeEntrega'    => $cidadeEntrega,
        'nomePagador'      => $nomePagador,
        'ocorrencia'       => $ocorrencia,
        'dataOcorrencia'   => $dataOcorrencia,
        'vlrCtrcOrigem'    => $vlrCtrcNum,
        'set'              => $set,
        'pesoCalculo'      => $pesoNum,
        'qtVol'            => $qtVolNum,
        'valMerc'          => $valMercNum,
        'icms'             => (float) str_replace(['.', ','], ['', '.'], $icms),
        'vlrFrete'         => $vlrFreteNum,
        'baseCalc'         => (float) str_replace(['.', ','], ['', '.'], $baseCalc),
        'romaneio'         => $romaneio,
        'ctrbOs'           => $ctrbOsNum,
        'percCtrb'         => $percCtrb,
    ];
}

$totalColetas   = 0;
$totalEntregas  = 0;
$totalPeso      = 0.0;
$totalFrete     = 0.0;
$totalValMerc   = 0.0;
$totalCtrbOs    = 0.0;
$totalVol       = 0;

foreach ($operacoes as $op) {
    if ($op['tipoCodigo'] === 'C') $totalColetas++;
    if ($op['tipoCodigo'] === 'E') $totalEntregas++;
    $totalPeso    += $op['pesoCalculo'];
    $totalFrete   += $op['vlrFrete'];
    $totalValMerc += $op['valMerc'];
    $totalCtrbOs  += $op['ctrbOs'];
    $totalVol     += $op['qtVol'];
}

$percCtrbGeral = 0;
if ($totalFrete > 0 && $totalCtrbOs > 0) {
    $percCtrbGeral = round(($totalCtrbOs / $totalFrete) * 100, 2);
}

respondJson([
    'success'       => true,
    'operacoes'     => $operacoes,
    'totais'        => [
        'coletas'      => $totalColetas,
        'entregas'     => $totalEntregas,
        'total'        => count($operacoes),
        'peso'         => round($totalPeso, 3),
        'frete'        => round($totalFrete, 2),
        'valMerc'      => round($totalValMerc, 2),
        'ctrbOs'       => round($totalCtrbOs, 2),
        'vol'          => $totalVol,
        'percCtrb'     => $percCtrbGeral,
    ],
]);
