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

if ($xml1440) {
    for ($i = 0; $i <= 100; $i++) {
        $seq = $xml1440->xpath('rs/r/f0')[$i];
        $opc = $xml1440->xpath('rs/r/f1')[$i];
        $usr = $xml1440->xpath('rs/r/f3')[$i];
        $sit = $xml1440->xpath('rs/r/f6')[$i];

        if ($seq === null) break;

        $usr = trim((string)$usr);

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
    respondJson(['success' => false, 'message' => 'Relatório 081 não encontrado na fila do ssw1440. Tente novamente em alguns instantes.']);
}

$seqFmt  = str_pad((int)$seqArq, 9, '0', STR_PAD_LEFT);
$nomeArq = $domain . $seqFmt . '.txt';

$file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$nomeArq}&filename={$nomeArq}&path=/usr/aws/jobs/{$domain}/&down=1&nw=1");

if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Arquivo do relatório 081 vazio ou inválido.']);
}

$file   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
$linhas = explode("\n", $file);

$ctes        = [];
$setorAtual  = '';
$nomeSetor   = '';
$emTransito  = false;

$SKIP_PATTERNS = [
    'CTRCS DISPONIVEIS PARA ENTREGA',
    'COM OS QUE CHEGAM ATEH',
    'ssw0052',
    'UNIDADE:',
    'CTRC REV/DEV',
    '---+---',
    '-------------+',
    'PAG:',
];

foreach ($linhas as $linha) {
    $skip = false;
    foreach ($SKIP_PATTERNS as $pat) {
        if (strpos($linha, $pat) !== false) { $skip = true; break; }
    }
    if ($skip) continue;

    if (trim($linha) === '') continue;

    if (preg_match('/^SETOR:\s*([A-Z0-9]{2,5})\s*(.*)?$/', trim($linha), $ms)) {
        $setorAtual = trim($ms[1]);
        $nomeSetor  = trim($ms[2] ?? '');
        $emTransito = false;
        continue;
    }

    if (preg_match('/^\s*\*{4}\s*(NO ARMAZEM|EM TRANSITO)/', $linha, $mt)) {
        $emTransito = (strpos($mt[1], 'EM TRANSITO') !== false);
        continue;
    }

    if (preg_match('/INSTRUCAO ENTREGA/', $linha)) continue;

    $ctrc = trim(substr($linha, 2, 12));
    if (!preg_match('/^[A-Z]{3}\d{6}-\d$/', $ctrc)) continue;

    $revDev      = trim(substr($linha, 14, 10));
    $nfiscal     = trim(substr($linha, 25, 9));
    $pagador     = trim(substr($linha, 35, 9));
    $destinata   = trim(substr($linha, 45, 9));
    $endereco    = trim(substr($linha, 55, 18));
    $cidade      = trim(substr($linha, 73, 6));
    $bairro      = trim(substr($linha, 80, 6));
    $cep         = trim(substr($linha, 87, 9));
    $previ       = trim(substr($linha, 97, 5));
    $agendamento = trim(substr($linha, 103, 11));
    $valMerc     = trim(substr($linha, 115, 9));
    $kgRea       = trim(substr($linha, 125, 6));
    $m3          = trim(substr($linha, 132, 5));
    $qVol        = trim(substr($linha, 138, 6));
    $frete       = trim(substr($linha, 145, 6));
    $ultOcor     = trim(substr($linha, 152, 8));
    $flagB       = trim(substr($linha, 161, 1));
    $prevChegada = trim(substr($linha, 163, 11));
    $manifesto   = trim(substr($linha, 175, 13));
    $servAdic    = trim(substr($linha, 189, 8));
    $per         = trim(substr($linha, 198, 3));

    $isEmTransito = !empty($prevChegada) && strpos($prevChegada, 'HOJE') !== false;

    $atrasoEntrega = null;
    if (!empty($per)) {
        $diasAtraso = (int)$per;
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

    $serCte = substr($ctrc, 0, 3);
    $nroCte = (int)substr($ctrc, 3, 6);

    $ctes[] = [
        'ctrc'         => $ctrc,
        'serCte'       => $serCte,
        'nroCte'       => $nroCte,
        'setor'        => $setorAtual,
        'nomeSetor'    => $nomeSetor,
        'nfiscal'      => $nfiscal,
        'pagador'      => $pagador,
        'destinatario' => $destinata,
        'endereco'     => $endereco,
        'cidade'       => $cidade,
        'bairro'       => $bairro,
        'cep'          => $cep,
        'prevEnt'      => $previ,
        'agendamento'  => $agendamento,
        'vlrMerc'      => $valMerc,
        'peso'         => $kgRea,
        'cubagem'      => $m3,
        'qtdeVol'      => $qVol,
        'frete'        => $frete,
        'ultOcor'      => $ultOcor,
        'agendObrig'   => $flagB === 'S',
        'prevChegada'  => $prevChegada,
        'manifesto'    => $manifesto,
        'servAdic'     => $servAdic,
        'diasAtraso'   => (int)$per,
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
