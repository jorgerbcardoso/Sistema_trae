<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

$input = getRequestInput();
$sigla = strtoupper(trim($input['sigla'] ?? ''));

if (empty($sigla) || !preg_match('/^[A-Z0-9]{2,5}$/', $sigla)) {
    respondJson(['success' => false, 'message' => 'Sigla inválida.']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

ssw_login($domain);
set_time_limit(60);

$str1440 = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
$str1440 = substr($str1440, strpos($str1440, '<xml'), strlen($str1440));
$str1440 = substr($str1440, 0, strpos($str1440, '</xml>')) . '</xml>';
$xml1440 = simplexml_load_string($str1440);

$seqArq = null;
$debugItens = [];

if ($xml1440) {
    for ($i = 0; $i <= 100; $i++) {
        $seq = $xml1440->xpath('rs/r/f0')[$i];
        $opc = $xml1440->xpath('rs/r/f1')[$i];
        $usr = $xml1440->xpath('rs/r/f3')[$i];
        $sit = $xml1440->xpath('rs/r/f6')[$i];

        if ($seq === null) break;

        $usr = trim((string)$usr);

        $f2  = (string)($xml1440->xpath('rs/r/f2')[$i]  ?? '');
        $f4  = (string)($xml1440->xpath('rs/r/f4')[$i]  ?? '');
        $f5  = (string)($xml1440->xpath('rs/r/f5')[$i]  ?? '');
        $f7  = (string)($xml1440->xpath('rs/r/f7')[$i]  ?? '');
        $f8  = (string)($xml1440->xpath('rs/r/f8')[$i]  ?? '');
        $f9  = (string)($xml1440->xpath('rs/r/f9')[$i]  ?? '');
        $f10 = (string)($xml1440->xpath('rs/r/f10')[$i] ?? '');

        $debugItens[] = [
            'seq' => trim((string)$seq),
            'opc' => (string)$opc,
            'usr' => $usr,
            'sit' => (string)$sit,
            'f2'  => $f2,
            'f4'  => $f4,
            'f5'  => $f5,
            'f7'  => $f7,
            'f8'  => $f8,
            'f9'  => $f9,
            'f10' => $f10,
        ];

        if ((substr($opc, 0, 3) == '081')
            && (($usr == 'presto') || ($usr == 'damasce1'))
            && ($sit == 'Conclu&iacute;do')
        ) {
            $seqArq = trim((string)$seq);
            break;
        }
    }
}

if ($seqArq === null) {
    respondJson([
        'success' => false,
        'message' => 'Relatório 081 não encontrado na fila do ssw1440.',
        'debug'   => $debugItens,
    ]);
}

$siglaUnidade = '';
foreach ($debugItens as $d) {
    if (substr($d['opc'], 0, 3) == '081') {
        $siglaUnidade = $d['f4'];
        break;
    }
}

$urlDow  = "https://sistema.ssw.inf.br/bin/ssw1440?act=DOW{$seqArq}";
$htmlDow = ssw_go($urlDow);

$nomeArq081 = null;
$pathArq081 = null;

if (preg_match("/abrir\s*\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*\d+\s*,\s*\d+\s*,\s*'([^']+)'/", urldecode($htmlDow), $mDow)) {
    $nomeArq081 = $mDow[1];
    $pathArq081 = $mDow[2];
}

if (!$nomeArq081 || !$pathArq081) {
    respondJson(['success' => false, 'message' => 'Não foi possível extrair o nome do arquivo 081 do ssw1440.', 'debug' => substr($htmlDow, 0, 500)]);
}

$file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$nomeArq081}&filename={$nomeArq081}&path={$pathArq081}&down=1&nw=1");

if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Arquivo do relatório 081 vazio ou inválido.', 'debug' => ['nomeArq' => $nomeArq081, 'path' => $pathArq081, 'fileLen' => strlen($file), 'fileHead' => substr($file, 0, 300)]]);
}

$file   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
$linhas = explode("\n", $file);

$ctes    = [];
$cabecalho = null;

foreach ($linhas as $linha) {
    $linha = trim($linha);
    if ($linha === '') continue;

    $arr = str_getcsv($linha, ';');

    if ($cabecalho === null) {
        $cabecalho = $arr;
        continue;
    }

    if (count($arr) < 10) continue;

    $setor       = trim($arr[0]  ?? '');
    $ctrc        = trim($arr[2]  ?? '');
    $pagador     = trim($arr[7]  ?? '');
    $destinata   = trim($arr[8]  ?? '');
    $endereco    = trim($arr[9]  ?? '');
    $cidade      = trim($arr[10] ?? '');
    $bairro      = trim($arr[11] ?? '');
    $cep         = trim($arr[12] ?? '');
    $previ       = trim($arr[13] ?? '');
    $agendamento = trim($arr[14] ?? '');
    $nfiscal     = trim($arr[15] ?? '');
    $valMerc     = trim($arr[16] ?? '');
    $kgRea       = trim($arr[17] ?? '');
    $m3          = trim($arr[18] ?? '');
    $qVol        = trim($arr[20] ?? '');
    $frete       = trim($arr[22] ?? '');
    $codUltOcor  = trim($arr[23] ?? '');
    $descUltOcor = trim($arr[24] ?? '');
    $dataUltOcor = trim($arr[25] ?? '');
    $flagB       = trim($arr[26] ?? '');
    $prevChegada = trim($arr[27] ?? '');
    $manifesto   = trim($arr[28] ?? '');
    $cnpjDest    = trim($arr[30] ?? '');

    if (!preg_match('/^[A-Z]{3}\d{6}-\d$/', $ctrc)) continue;

    $isEmTransito = !empty($prevChegada) && strpos(strtoupper($prevChegada), 'HOJE') !== false;

    $hoje     = date('d/m/y');
    $prevDate = '';
    if (!empty($previ)) {
        $parts = explode('/', $previ);
        if (count($parts) === 3) {
            $prevDate = $parts[0] . '/' . $parts[1];
        }
    }

    $diasAtraso    = 0;
    $atrasoEntrega = null;
    if (!empty($previ) && !$isEmTransito) {
        $partes = explode('/', $previ);
        if (count($partes) === 3) {
            $tsPrevi = mktime(0, 0, 0, (int)$partes[1], (int)$partes[0], (int)('20' . $partes[2]));
            $tsHoje  = mktime(0, 0, 0, (int)date('m'), (int)date('d'), (int)date('Y'));
            $diasAtraso = (int)floor(($tsHoje - $tsPrevi) / 86400);
            if ($diasAtraso <= 0) {
                $atrasoEntrega = 'verde';
            } elseif ($diasAtraso <= 2) {
                $atrasoEntrega = 'amarelo';
            } elseif ($diasAtraso <= 5) {
                $atrasoEntrega = 'laranja';
            } else {
                $atrasoEntrega = 'vermelho';
            }
        }
    }

    $serCte = substr($ctrc, 0, 3);
    $nroCte = (int)substr($ctrc, 3, 6);

    $ctes[] = [
        'ctrc'         => $ctrc,
        'serCte'       => $serCte,
        'nroCte'       => $nroCte,
        'setor'        => $setor,
        'nfiscal'      => $nfiscal,
        'pagador'      => $pagador,
        'destinatario' => $destinata,
        'cnpjDest'     => $cnpjDest,
        'endereco'     => $endereco,
        'cidade'       => $cidade,
        'bairro'       => $bairro,
        'cep'          => $cep,
        'prevEnt'      => $prevDate ?: $previ,
        'agendamento'  => $agendamento,
        'vlrMerc'      => $valMerc,
        'peso'         => $kgRea,
        'cubagem'      => $m3,
        'qtdeVol'      => $qVol,
        'frete'        => $frete,
        'codUltOcor'   => $codUltOcor,
        'descUltOcor'  => $descUltOcor,
        'dataUltOcor'  => $dataUltOcor,
        'agendObrig'   => ($flagB === 'S'),
        'prevChegada'  => $prevChegada,
        'manifesto'    => $manifesto,
        'diasAtraso'   => $diasAtraso,
        'emTransito'   => $isEmTransito,
        'atrasoEntrega'=> $atrasoEntrega,
    ];
}

respondJson([
    'success' => true,
    'data'    => [
        'ctes'     => $ctes,
        'sigla'    => $sigla,
        'geradoEm' => date('d/m/Y H:i:s'),
    ],
]);
