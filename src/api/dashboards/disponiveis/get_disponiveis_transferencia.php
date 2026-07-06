<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth     = authenticateAndGetUser();
$domain   = $auth['domain'];
$g_sql    = connect();

$input  = getRequestInput();
$sigla  = strtoupper(trim($input['sigla'] ?? ''));

if (empty($sigla) || !preg_match('/^[A-Z0-9]{2,5}$/', $sigla)) {
    respondJson(['success' => false, 'message' => 'Sigla inválida.']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

function destinoBloqueadoRve(string $domain, string $siglaAtual, string $destino): bool {
    if (strtoupper(trim($domain)) !== 'RVE') return false;

    $siglaAtual = strtoupper(trim($siglaAtual));
    $destino = strtoupper(trim($destino));

    if ($destino === '') return false;

    $bloqueados = ['SAL', 'DK4', 'TNE', 'DEV'];
    if (in_array($destino, $bloqueados, true)) return true;

    if ($siglaAtual === 'SAO' && $destino === 'CAM') return true;
    if ($siglaAtual === 'CAM' && $destino === 'SAO') return true;

    return false;
}

ssw_login($domain);
set_time_limit(120);
ini_set('memory_limit', '256M');
$agora = time();

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Erro fatal PHP: ' . $err['message'] . ' em ' . $err['file'] . ':' . $err['line']]);
    }
});

function downloadRelatorio019($sigla, $agora) {
    $sigla = strtoupper(trim((string)$sigla));
    if ($sigla === '') return null;

    ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($sigla) . '&f3=101');

    $agora12h = $agora + (12 * 3600);
    $dataPrevMan = date('dmy', $agora12h);
    $horaPrevMan = date('Hi', $agora12h);
    $dataEmitCte = date('dmy', $agora);
    $horaEmitCte = date('Hi', $agora);

    $url0036 = 'https://sistema.ssw.inf.br/bin/ssw0036?act=ENV'
        . '&l_siglas_familia=' . urlencode($sigla)
        . '&data_prev_man='    . $dataPrevMan
        . '&hora_prev_man='    . $horaPrevMan
        . '&data_emit_ctrc='   . $dataEmitCte
        . '&hora_emit_ctrc='   . $horaEmitCte
        . '&status_ctrc=C&ctrc_pendente=T&lista_pendencias=N&apenas_descarregados=T'
        . '&lista_reversa=T&apenas_prioritarios=T&id_tp_produto=T&fg_enderecados=T'
        . '&relacionar_produtos=N&relatorio_excel=S'
        . '&button_env_enable=ENV&button_env_disable=btn_envia';

    $str = ssw_go($url0036);
    if (substr($str, 0, 5) === '<foc ') return null;

    $strDec = urldecode($str);
    $queued = (strpos($strDec, 'Solicita &ccedil;&atilde;o enviada para processamento.') !== false);

    $act = $queued ? '' : ssw_get_act($strDec);
    $arq = $queued ? '' : ssw_get_arq($strDec);

    if ($act !== '' && $arq !== '') {
        $file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act}&filename={$arq}&path=&down=1&nw=0");
        if (!empty($file) && strlen($file) >= 100) return $file;
    }

    for ($try = 0; $try < 10; $try++) {
        $str1440 = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
        $posXml = strpos($str1440, '<xml');
        if ($posXml !== false) {
            $str1440 = substr($str1440, $posXml);
            $endXml = strpos($str1440, '</xml>');
            if ($endXml !== false) $str1440 = substr($str1440, 0, $endXml) . '</xml>';
        }

        $xml1440 = simplexml_load_string($str1440);
        $nomeArq019 = null;
        $pathArq019 = null;

        if ($xml1440) {
            for ($i = 0; $i <= 120; $i++) {
                $seq = $xml1440->xpath('rs/r/f0')[$i];
                $opc = $xml1440->xpath('rs/r/f1')[$i];
                $usr = $xml1440->xpath('rs/r/f3')[$i];
                $f4  = $xml1440->xpath('rs/r/f4')[$i];
                $sit = $xml1440->xpath('rs/r/f6')[$i];
                $f8  = $xml1440->xpath('rs/r/f8')[$i];

                if ($seq === null) break;

                $unidF4 = strtoupper(trim((string)$f4));
                if ($unidF4 !== $sigla) continue;
                $usr = trim((string)$usr);
                if (!(($usr === 'presto') || ($usr === 'damasce1'))) continue;
                if ((string)$sit !== 'Conclu&iacute;do') continue;
                if (substr((string)$opc, 0, 3) !== '019') continue;

                $f8dec = html_entity_decode((string)$f8);
                if (preg_match("/ajaxEnvia\s*\(\s*'DOW(\d+)'\s*\)/", $f8dec, $mDow)) {
                    $htmlDow = ssw_go("https://sistema.ssw.inf.br/bin/ssw1440?act=DOW{$mDow[1]}");
                    if (preg_match('/value="([^"]+)"/', $htmlDow, $mVal)) {
                        $decoded = urldecode($mVal[1]);
                        if (preg_match("/abrir\s*\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*\d+\s*,\s*\d+\s*,\s*'([^']+)'/", $decoded, $mArq)) {
                            $nomeArq019 = $mArq[1];
                            $pathArq019 = $mArq[2];
                            break;
                        }
                    }
                }
            }
        }

        if ($nomeArq019 && $pathArq019) {
            $file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$nomeArq019}&filename={$nomeArq019}&path={$pathArq019}&down=1&nw=1");
            if (!empty($file) && strlen($file) >= 100) return $file;
        }

        usleep(400000);
    }

    return null;
}

$file = downloadRelatorio019($sigla, $agora);
if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Relatório 019 não encontrado (nem gerado imediatamente nem na fila do ssw1440).']);
}

$file   = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
$file   = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file);
$file   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
$linhas = explode("\n", $file);

$ctes = [];

$normKey = static function(string $s): string {
    return preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($s)));
};
$getCell = static function(array $row, array $idx, array $candidates) use ($normKey): string {
    foreach ($candidates as $c) {
        $k = $normKey($c);
        if (isset($idx[$k])) return trim((string)($row[$idx[$k]] ?? ''));
    }
    return '';
};

$headerLine = null;
foreach ($linhas as $l) {
    $t = trim((string)$l);
    if ($t === '') continue;
    if (strpos($t, ';') !== false && stripos($t, 'CTRC/GAI/PAL') !== false) {
        $headerLine = $t;
        break;
    }
}

if ($headerLine !== null) {
    $header = str_getcsv($headerLine, ';');
    if (!empty($header)) {
        $header[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$header[0]);
    }
    $idx = [];
    foreach ($header as $i => $h) {
        $key = $normKey((string)$h);
        if ($key !== '') $idx[$key] = $i;
    }

    $nomeUnidadeCache = [];
    $getNomeUnidade = static function(string $siglaUnid) use (&$nomeUnidadeCache, $domain, $g_sql): string {
        $k = strtoupper(trim($siglaUnid));
        if ($k === '') return '';
        if (array_key_exists($k, $nomeUnidadeCache)) return (string)$nomeUnidadeCache[$k];
        $res = sql("SELECT nome FROM {$domain}_unidade WHERE UPPER(sigla) = UPPER($1) LIMIT 1", [$k], $g_sql);
        $nome = '';
        if ($res && pg_num_rows($res) > 0) {
            $row = pg_fetch_assoc($res);
            $nome = (string)($row['nome'] ?? '');
        }
        $nomeUnidadeCache[$k] = $nome;
        return $nome;
    };

    $headerFound = false;
    foreach ($linhas as $linha) {
        $linha = trim((string)$linha);
        if ($linha === '') continue;
        if (!$headerFound) {
            if ($linha === $headerLine) $headerFound = true;
            continue;
        }

        $arr = str_getcsv($linha, ';');
        if (count($arr) < 5) continue;

        $ctrc = $getCell($arr, $idx, ['CTRC/GAI/PAL']);
        if (!preg_match('/^[A-Z]{3}\d{6}-\d$/', $ctrc)) continue;

        $tipo        = $getCell($arr, $idx, ['T']);
        $autor       = $getCell($arr, $idx, ['AUTORIZACAO']);
        $previ       = $getCell($arr, $idx, ['PREV DE ENTREGA']);
        $nfiscal     = $getCell($arr, $idx, ['NFISCAL']);
        $pedido      = $getCell($arr, $idx, ['PEDIDO']);
        $remetente   = $getCell($arr, $idx, ['REMETENTE']);
        $pagador     = $getCell($arr, $idx, ['PAGADOR']);
        $destinatar  = $getCell($arr, $idx, ['DESTINATARIO']);
        $cidade      = $getCell($arr, $idx, ['CIDADE']);
        $uf          = $getCell($arr, $idx, ['UF']);
        $mercadoria  = $getCell($arr, $idx, ['MERCADORIA']);
        $frete       = $getCell($arr, $idx, ['FRETE']);
        $peso        = $getCell($arr, $idx, ['KGREA', 'KG REA', 'KG']);
        $m3          = $getCell($arr, $idx, ['M3']);
        $qvol        = $getCell($arr, $idx, ['QVOL']);
        $manifesto   = $getCell($arr, $idx, ['MANIFESTO/END']);
        $prevChegada = $getCell($arr, $idx, ['PREVCHEGADA']);

        $unidadeDest = strtoupper($getCell($arr, $idx, ['DESTINO']));
        if ($unidadeDest === '0') continue;
        if (destinoBloqueadoRve($domain, $sigla, $unidadeDest)) continue;
        $nomeDest    = $getNomeUnidade($unidadeDest);

        $emTransito = $prevChegada !== '';

        $serCte = substr($ctrc, 0, 3);
        $nroCte = (int)substr($ctrc, 3, 6);

        $dataAutorTs = null;
        if ($autor !== '') {
            if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $autor, $ma)) {
                $dataAutorTs = mktime(0, 0, 0, (int)$ma[2], (int)$ma[1], (int)$ma[3]);
            } elseif (preg_match('/^(\d{2})\/(\d{2})\/(\d{2})$/', $autor, $ma)) {
                $dataAutorTs = mktime(0, 0, 0, (int)$ma[2], (int)$ma[1], (int)('20' . $ma[3]));
            }
        }

        $atrasoTransf = null;
        if ($emTransito && $prevChegada !== '') {
            $ts = null;
            if (preg_match('/^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2}))?$/', $prevChegada, $mp)) {
                $yy = strlen($mp[3]) === 2 ? (int)('20' . $mp[3]) : (int)$mp[3];
                $hh = isset($mp[4]) ? (int)$mp[4] : 0;
                $mi = isset($mp[5]) ? (int)$mp[5] : 0;
                $ts = mktime($hh, $mi, 0, (int)$mp[2], (int)$mp[1], $yy);
            }
            if ($ts !== null) {
                $diffSecs = $agora - $ts;
                if ($diffSecs <= 0) $atrasoTransf = 'verde';
                elseif ($diffSecs <= 7200) $atrasoTransf = 'amarelo';
                elseif ($diffSecs <= 14400) $atrasoTransf = 'laranja';
                else $atrasoTransf = 'vermelho';
            }
        }

        $indicadorSaida = null;
        if ($dataAutorTs !== null) {
            $diffDias = (int)(($agora - $dataAutorTs) / 86400);
            if ($diffDias <= 1) $indicadorSaida = 'verde';
            elseif ($diffDias == 2) $indicadorSaida = 'amarelo';
            elseif ($diffDias == 3) $indicadorSaida = 'laranja';
            else $indicadorSaida = 'vermelho';
        }

        $ctes[] = [
            'ctrc'           => $ctrc,
            'serCte'         => $serCte,
            'nroCte'         => $nroCte,
            'unidadeCarregamento' => $sigla,
            'unidadeOrigem'  => $sigla,
            'tipo'           => $tipo,
            'emissao'        => $autor,
            'prevEnt'        => $previ,
            'nfiscal'        => $nfiscal,
            'pedido'         => $pedido,
            'remetente'      => $remetente,
            'pagador'        => $pagador,
            'destinatario'   => $destinatar,
            'cidade'         => $cidade,
            'uf'             => $uf,
            'vlrNf'          => $mercadoria,
            'frete'          => $frete,
            'peso'           => $peso,
            'cubagem'        => $m3,
            'qtdeVol'        => trim((string)$qvol),
            'manifesto'      => $manifesto,
            'prevChegada'    => $prevChegada,
            'emTransito'     => $emTransito,
            'unidadeDest'    => $unidadeDest,
            'nomeDest'       => $nomeDest,
            'indicadorSaida' => $indicadorSaida,
            'atrasoTransf'   => $atrasoTransf,
        ];
    }
} else {
    $unidadeDestAtual = '';
    $nomeDestAtual    = '';
    $isResumo         = false;

    foreach ($linhas as $linha) {
        if (strpos($linha, 'CTRCS DISPONIVEIS PARA TRANSFERENCIA') !== false) continue;
        if (strpos($linha, 'CHEGADA PREVISTA') !== false) continue;
        if (strpos($linha, 'CTRC/GAI/PAL') !== false) continue;
        if (strpos($linha, '------------+') !== false) continue;
        if (strpos($linha, 'ssw0036') !== false) continue;
        if (strpos($linha, 'PAG:') !== false) continue;

        if (strpos($linha, 'TOTAL GERAL') !== false) {
            $isResumo = true;
        }
        if ($isResumo) continue;

        if (preg_match('/DESTINO FINAL:\s*([A-Z0-9]{2,5})\s+(.+)/', $linha, $m)) {
            $unidadeDestAtual = trim($m[1]);
            $nomeDestAtual    = trim($m[2]);
            continue;
        }

        if (preg_match('/^\s*TOTAL CTRCS\s+-\s+(NO ARMAZEM|EM TRANSITO)/', $linha)) {
            continue;
        }

        $ctrc = trim(substr($linha, 0, 13));
        if (!preg_match('/^[A-Z]{3}\d{6}-\d$/', $ctrc)) continue;

        $tipo        = trim(substr($linha, 14, 1));
        $autor       = trim(substr($linha, 16, 5));
        $previ       = trim(substr($linha, 22, 5));
        $nfiscal     = trim(substr($linha, 28, 10));
        $pedido      = trim(substr($linha, 39, 12));
        $remetente   = trim(substr($linha, 52, 10));
        $pagador     = trim(substr($linha, 63, 14));
        $destinatar  = trim(substr($linha, 78, 10));
        $cidade      = trim(substr($linha, 89, 9));
        $uf          = trim(substr($linha, 99, 2));
        $mercadoria  = trim(substr($linha, 106, 14));
        $frete       = trim(substr($linha, 121, 11));
        $peso        = trim(substr($linha, 133, 7));
        $m3          = trim(substr($linha, 141, 6));
        $qvol        = trim(substr($linha, 148, 7));
        $manifesto   = trim(substr($linha, 162, 9));
        $prevChegada = trim(substr($linha, 174, 12));

        $emTransito = !empty($prevChegada);

        $serCte = substr($ctrc, 0, 3);
        $nroCte = (int)substr($ctrc, 3, 6);

        $dataAutorTs = null;
        if (!empty($autor) && preg_match('/^(\d{2})\/(\d{2})$/', $autor, $ma)) {
            $anoAtual    = date('Y');
            $dataAutorTs = mktime(0, 0, 0, (int)$ma[2], (int)$ma[1], (int)$anoAtual);
        }

        $atrasoTransf = null;
        if ($emTransito && preg_match('/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/', $prevChegada, $mp)) {
            $anoAtual      = date('Y');
            $prevChegadaTs = mktime((int)$mp[3], (int)$mp[4], 0, (int)$mp[2], (int)$mp[1], (int)$anoAtual);
            $diffSecs      = $agora - $prevChegadaTs;
            if ($diffSecs <= 0) $atrasoTransf = 'verde';
            elseif ($diffSecs <= 7200) $atrasoTransf = 'amarelo';
            elseif ($diffSecs <= 14400) $atrasoTransf = 'laranja';
            else $atrasoTransf = 'vermelho';
        }

        $indicadorSaida = null;
        if ($dataAutorTs !== null) {
            $diffDias = (int)(($agora - $dataAutorTs) / 86400);
            if ($diffDias <= 1) $indicadorSaida = 'verde';
            elseif ($diffDias == 2) $indicadorSaida = 'amarelo';
            elseif ($diffDias == 3) $indicadorSaida = 'laranja';
            else $indicadorSaida = 'vermelho';
        }

        if (trim((string)$unidadeDestAtual) === '0') continue;
        if (destinoBloqueadoRve($domain, $sigla, (string)$unidadeDestAtual)) continue;

        $ctes[] = [
            'ctrc'           => $ctrc,
            'serCte'         => $serCte,
            'nroCte'         => $nroCte,
            'unidadeCarregamento' => $sigla,
            'unidadeOrigem'  => $sigla,
            'tipo'           => $tipo,
            'emissao'        => $autor,
            'prevEnt'        => $previ,
            'nfiscal'        => $nfiscal,
            'pedido'         => $pedido,
            'remetente'      => $remetente,
            'pagador'        => $pagador,
            'destinatario'   => $destinatar,
            'cidade'         => $cidade,
            'uf'             => $uf,
            'vlrNf'          => $mercadoria,
            'frete'          => $frete,
            'peso'           => $peso,
            'cubagem'        => $m3,
            'qtdeVol'        => trim($qvol),
            'manifesto'      => $manifesto,
            'prevChegada'    => $prevChegada,
            'emTransito'     => $emTransito,
            'unidadeDest'    => $unidadeDestAtual,
            'nomeDest'       => $nomeDestAtual,
            'indicadorSaida' => $indicadorSaida,
            'atrasoTransf'   => $atrasoTransf,
        ];
    }
}

$ontem = date('dmy', strtotime('yesterday'));
$hoje  = date('dmy');

$param0166 = 'act=FIL_COL'
    . '&f2=' . urlencode(strtoupper($domain))
    . '&f14=' . $ontem
    . '&f15=' . $hoje
    . '&f16=I'
    . '&f17=E'
    . '&f19=' . urlencode($sigla);

$str166 = ssw_go('https://sistema.ssw.inf.br/bin/ssw0166?' . $param0166);

if (strpos($str166, 'Sem movimento de coletas') !== false) {
    $coletas = [];
} else {
    if (substr($str166, 0, 5) === '<foc ') {
        respondJson(['success' => false, 'message' => 'Erro SSW (0166): ' . $str166]);
    }

    $extractDownloadParams0166 = static function(string $html): ?array {
        $mVal = null;
        if (preg_match('/\\bid\\s*=\\s*web_body\\b[^>]*\\bvalue\\s*=\\s*"([^"]*)"/i', $html, $m)) $mVal = $m[1];
        elseif (preg_match('/\\bname\\s*=\\s*web_body\\b[^>]*\\bvalue\\s*=\\s*"([^"]*)"/i', $html, $m)) $mVal = $m[1];
        elseif (preg_match("/\\bid\\s*=\\s*web_body\\b[^>]*\\bvalue\\s*=\\s*'([^']*)'/i", $html, $m)) $mVal = $m[1];
        elseif (preg_match("/\\bname\\s*=\\s*web_body\\b[^>]*\\bvalue\\s*=\\s*'([^']*)'/i", $html, $m)) $mVal = $m[1];

        $decoded = $mVal !== null ? urldecode((string)$mVal) : urldecode($html);
        if (!preg_match("/abrir\\s*\\(\\s*'([^']+)'\\s*,\\s*'([^']+)'/i", $decoded, $m2)) {
            return null;
        }
        $act = trim((string)$m2[1]);
        $filename = trim((string)$m2[2]);
        if ($act === '' || $filename === '') return null;
        return ['act' => $act, 'filename' => $filename];
    };

    $params0166 = $extractDownloadParams0166($str166);
    if (!$params0166) {
        respondJson(['success' => false, 'message' => 'Erro SSW (0166): parâmetros de download não encontrados.']);
    }

    $act166 = urlencode((string)$params0166['act']);
    $arq166 = urlencode((string)$params0166['filename']);
    $file166 = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act166}&filename={$arq166}&path=&down=1&nw=1");

    if (empty($file166) || strlen($file166) < 100) {
        respondJson(['success' => false, 'message' => 'Arquivo do relatório 0166 vazio ou inválido.']);
    }

    $file166 = mb_convert_encoding($file166, 'UTF-8', 'ISO-8859-1');
    $file166 = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file166);
    $file166 = str_replace("\r\n", "\n", str_replace("\r", "\n", $file166));
    $linhas166 = explode("\n", $file166);

    $coletas = [];
    $paresCidadeUf = [];

    $parseDataHora = static function(string $data, string $hora): ?int {
        $data = trim($data);
        $hora = trim($hora);
        if ($data === '') return null;
        if (!preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $data, $md)) return null;
        $h = 0;
        $m = 0;
        if ($hora !== '' && preg_match('/^(\d{2}):(\d{2})$/', $hora, $mh)) {
            $h = (int)$mh[1];
            $m = (int)$mh[2];
        }
        return mktime($h, $m, 0, (int)$md[2], (int)$md[1], (int)$md[3]);
    };

    foreach ($linhas166 as $linha) {
        $linha = trim((string)$linha);
        if ($linha === '') continue;

        $arr = str_getcsv($linha, ';');
        if (count($arr) < 35) continue;
        if (trim((string)$arr[0]) !== '3') continue;

        $serColeta  = strtoupper(trim((string)($arr[1] ?? '')));
        $nroColeta  = trim((string)($arr[2] ?? ''));
        $remetente  = trim((string)($arr[7] ?? ''));
        $ctrcGerado = trim((string)($arr[17] ?? ''));

        if ($ctrcGerado !== '') continue;

        $cidadeDest = trim((string)($arr[20] ?? ''));
        $ufDest     = strtoupper(trim((string)($arr[21] ?? '')));

        $pesoReal = trim((string)($arr[25] ?? ''));
        $pesoCalc = trim((string)($arr[24] ?? ''));
        $peso     = $pesoReal !== '' ? $pesoReal : $pesoCalc;

        $qtdeVol  = trim((string)($arr[27] ?? ''));
        $valMerc  = trim((string)($arr[28] ?? ''));

        $limiteData = trim((string)($arr[30] ?? ''));
        $limiteHora = trim((string)($arr[31] ?? ''));
        $coletData  = trim((string)($arr[32] ?? ''));
        $coletHora  = trim((string)($arr[33] ?? ''));

        $dataHoreLim = $limiteData !== '' ? trim($limiteData . ' ' . $limiteHora) : '';
        $coletada    = $coletData !== '' ? trim($coletData . ' ' . $coletHora) : '';

        $limiteTs   = $parseDataHora($limiteData, $limiteHora);
        $coletadaTs = $parseDataHora($coletData, $coletHora);

        $statusColeta = 'pendente';
        $atrasoMin    = null;

        if ($coletData !== '') {
            $statusColeta = 'coletada';
            if ($limiteTs !== null && $coletadaTs !== null && $coletadaTs > $limiteTs) {
                $statusColeta = 'coletada_atrasada';
                $atrasoMin = (int)(($coletadaTs - $limiteTs) / 60);
            }
        } else {
            if ($limiteTs !== null && $agora > $limiteTs) {
                $statusColeta = 'atrasada';
                $atrasoMin = (int)(($agora - $limiteTs) / 60);
            }
        }

        $unidadeDest = '';
        if ($cidadeDest !== '' && $ufDest !== '') {
            $k = strtoupper($cidadeDest) . '|' . $ufDest;
            $paresCidadeUf[$k] = ['cidade' => $cidadeDest, 'uf' => $ufDest];
        }

        $coletas[] = [
            'serColeta'    => $serColeta,
            'nroColeta'    => $nroColeta,
            'remetente'    => $remetente,
            'cidadeRem'    => '',
            'cidadeDest'   => $cidadeDest,
            'ufDest'       => $ufDest,
            'unidadeDest'  => $unidadeDest,
            'paraEntrega'  => false,
            'dataHoreLim'  => $dataHoreLim,
            'coletada'     => $coletada,
            'valMerc'      => $valMerc,
            'qtdeVol'      => $qtdeVol,
            'peso'         => $peso,
            'statusColeta' => $statusColeta,
            'atrasoMin'    => $atrasoMin,
        ];
    }

    if (!empty($paresCidadeUf)) {
        $cidadeSeqMap = [];

        $pairs = [];
        $params = [];
        $pi = 1;
        foreach ($paresCidadeUf as $p) {
            $pairs[] = '($' . $pi . ', $' . ($pi + 1) . ')';
            $params[] = $p['cidade'];
            $params[] = $p['uf'];
            $pi += 2;
        }

        try {
            $resCid = sql(
                'WITH v(nome, uf) AS (VALUES ' . implode(', ', $pairs) . ')
                 SELECT v.nome, v.uf, c.seq_cidade
                   FROM v
                   LEFT JOIN cidade c
                     ON regexp_replace(unaccent(UPPER(c.nome)), \'\\s+\', \' \', \'g\') = regexp_replace(unaccent(UPPER(v.nome)), \'\\s+\', \' \', \'g\')
                    AND UPPER(c.uf) = UPPER(v.uf)',
                $params,
                $g_sql
            );
        } catch (Throwable $e) {
            $resCid = sql(
                'WITH v(nome, uf) AS (VALUES ' . implode(', ', $pairs) . ')
                 SELECT v.nome, v.uf, c.seq_cidade
                   FROM v
                   LEFT JOIN cidade c
                     ON regexp_replace(UPPER(c.nome), \'\\s+\', \' \', \'g\') = regexp_replace(UPPER(v.nome), \'\\s+\', \' \', \'g\')
                    AND UPPER(c.uf) = UPPER(v.uf)',
                $params,
                $g_sql
            );
        }

        if ($resCid && pg_num_rows($resCid) > 0) {
            while ($r = pg_fetch_assoc($resCid)) {
                $nome = strtoupper(trim((string)($r['nome'] ?? '')));
                $uf   = strtoupper(trim((string)($r['uf'] ?? '')));
                $seq  = isset($r['seq_cidade']) ? (int)$r['seq_cidade'] : 0;
                if ($nome !== '' && $uf !== '' && $seq > 0) {
                    $cidadeSeqMap[$nome . '|' . $uf] = $seq;
                }
            }
        }

        $seqs = array_values(array_unique(array_values($cidadeSeqMap)));
        $seqUnidadeMap = [];
        if (!empty($seqs)) {
            $ph = [];
            $paramsSeq = [];
            $pi = 1;
            foreach ($seqs as $seqCidade) {
                $seqCidade = (int)$seqCidade;
                if ($seqCidade <= 0) continue;
                $ph[] = '$' . $pi;
                $paramsSeq[] = $seqCidade;
                $pi++;
            }
            $resParam = !empty($ph)
                ? sql("SELECT seq_cidade, unidade FROM {$domain}_cid_param WHERE seq_cidade IN (" . implode(',', $ph) . ")", $paramsSeq, $g_sql)
                : false;
            if ($resParam && pg_num_rows($resParam) > 0) {
                while ($r = pg_fetch_assoc($resParam)) {
                    $seq = isset($r['seq_cidade']) ? (int)$r['seq_cidade'] : 0;
                    $un  = strtoupper(trim((string)($r['unidade'] ?? '')));
                    if ($seq > 0 && $un !== '') $seqUnidadeMap[$seq] = $un;
                }
            }
        }

        foreach ($coletas as $i => $c) {
            $nome = strtoupper(trim((string)($c['cidadeDest'] ?? '')));
            $uf   = strtoupper(trim((string)($c['ufDest'] ?? '')));
            if ($nome === '' || $uf === '') continue;
            $seq = $cidadeSeqMap[$nome . '|' . $uf] ?? 0;
            if ($seq > 0) {
                $u = $seqUnidadeMap[$seq] ?? '';
                if ($u !== '') {
                    $coletas[$i]['unidadeDest'] = $u;
                    $coletas[$i]['paraEntrega'] = (strtoupper($u) === strtoupper($sigla));
                }
            }
        }
    }
}

respondJson([
    'success' => true,
    'data'    => [
        'ctes'           => $ctes,
        'coletas'        => $coletas,
        'sigla'          => $sigla,
        'geradoEm'       => date('d/m/Y H:i:s'),
    ],
]);
