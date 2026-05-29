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

ssw_login($domain);
set_time_limit(120);
ini_set('memory_limit', '256M');

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Erro fatal PHP: ' . $err['message'] . ' em ' . $err['file'] . ':' . $err['line']]);
    }
});

$str1440 = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
$str1440 = substr($str1440, strpos($str1440, '<xml'), strlen($str1440));
$str1440 = substr($str1440, 0, strpos($str1440, '</xml>')) . '</xml>';
$xml1440 = simplexml_load_string($str1440);

$encontrado  = false;
$nomeArq019  = null;
$pathArq019  = null;

if ($xml1440) {
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

        if ((substr($opc, 0, 3) == '019')
            && (($usr == 'presto') || ($usr == 'damasce1'))
            && ((string)$sit == 'Conclu&iacute;do')
            && ($unidF4 === strtoupper($sigla))
        ) {
            $encontrado = true;
            $f8dec = html_entity_decode((string)$f8);

            if (preg_match("/ajaxEnvia\s*\(\s*'DOW(\d+)'\s*\)/", $f8dec, $mDow)) {
                $htmlDow = ssw_go("https://sistema.ssw.inf.br/bin/ssw1440?act=DOW{$mDow[1]}");
                if (preg_match('/value="([^"]+)"/', $htmlDow, $mVal)) {
                    $decoded = urldecode($mVal[1]);
                    if (preg_match("/abrir\s*\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*\d+\s*,\s*\d+\s*,\s*'([^']+)'/", $decoded, $mArq)) {
                        $nomeArq019 = $mArq[1];
                        $pathArq019 = $mArq[2];
                    }
                }
            }
            break;
        }
    }
}

if (!$encontrado || !$nomeArq019 || !$pathArq019) {
    respondJson(['success' => false, 'message' => 'Relatório 019 não encontrado na fila do ssw1440. Execute o script de geração do relatório.']);
}

$file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$nomeArq019}&filename={$nomeArq019}&path={$pathArq019}&down=1&nw=1");

if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Arquivo do relatório 019 vazio ou inválido.']);
}

$file   = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
$file   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
$linhas = explode("\n", $file);

$ctes           = [];
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

    $prevChegadaTs  = null;
    $atrasoTransf   = null;
    if ($emTransito && preg_match('/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/', $prevChegada, $mp)) {
        $anoAtual       = date('Y');
        $prevChegadaTs  = mktime((int)$mp[3], (int)$mp[4], 0, (int)$mp[2], (int)$mp[1], (int)$anoAtual);
        $diffSecs       = $agora - $prevChegadaTs;
        if ($diffSecs <= 0) {
            $atrasoTransf = 'verde';
        } elseif ($diffSecs <= 7200) {
            $atrasoTransf = 'amarelo';
        } elseif ($diffSecs <= 14400) {
            $atrasoTransf = 'laranja';
        } else {
            $atrasoTransf = 'vermelho';
        }
    }

    $indicadorSaida = null;
    $serMan = null;
    $nroMan = null;
    if (!empty($manifesto) && preg_match('/^([A-Z]{3})(\d{6})/', $manifesto, $mm)) {
        $serMan = $mm[1];
        $nroMan = (int)$mm[2];

        $qryMan = "SELECT data_emissao FROM {$domain}_manifesto WHERE ser_man = $1 AND nro_man = $2 LIMIT 1";
        $resMan = pg_query_params($g_sql, $qryMan, [$serMan, $nroMan]);
        $dataManEmissaoTs = null;

        if ($resMan && pg_num_rows($resMan) > 0) {
            $rowMan = pg_fetch_assoc($resMan);
            $dataManEmissaoTs = strtotime($rowMan['data_emissao']);
        }

        $refTs = $dataManEmissaoTs ?? $agora;

        if ($dataAutorTs !== null) {
            $diffDias = (int)(($dataAutorTs - $refTs) / 86400);
            if ($diffDias <= 1) {
                $indicadorSaida = 'verde';
            } elseif ($diffDias == 2) {
                $indicadorSaida = 'amarelo';
            } elseif ($diffDias == 3) {
                $indicadorSaida = 'laranja';
            } else {
                $indicadorSaida = 'vermelho';
            }
        } else {
            $diffDias = (int)(($agora - $refTs) / 86400);
            if ($diffDias <= 1) {
                $indicadorSaida = 'verde';
            } elseif ($diffDias == 2) {
                $indicadorSaida = 'amarelo';
            } elseif ($diffDias == 3) {
                $indicadorSaida = 'laranja';
            } else {
                $indicadorSaida = 'vermelho';
            }
        }
    } elseif ($dataAutorTs !== null) {
        $diffDias = (int)(($agora - $dataAutorTs) / 86400);
        if ($diffDias <= 1) {
            $indicadorSaida = 'verde';
        } elseif ($diffDias == 2) {
            $indicadorSaida = 'amarelo';
        } elseif ($diffDias == 3) {
            $indicadorSaida = 'laranja';
        } else {
            $indicadorSaida = 'vermelho';
        }
    }

    $ctes[] = [
        'ctrc'           => $ctrc,
        'serCte'         => $serCte,
        'nroCte'         => $nroCte,
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

$ontem = date('dmy', strtotime('yesterday'));
$hoje  = date('dmy');

$url0157 = 'https://sistema.ssw.inf.br/bin/ssw0157?act=ENV'
    . '&f2=' . urlencode($sigla)
    . '&f3=A'
    . '&f6=' . $ontem
    . '&f7=' . $hoje
    . '&f16=0&f17=1&f18=2';

$str157 = ssw_go($url0157);
if (substr($str157, 0, 5) === '<foc ') {
    respondJson(['success' => false, 'message' => 'Erro SSW (0157): ' . $str157]);
}

$str157   = urldecode($str157);
$act157   = ssw_get_act($str157);
$arq157   = ssw_get_arq($str157);
$file157   = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act157 . '&filename=' . $arq157 . '&path=&down=1&nw=0');
$file157   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file157));
$linhas157 = explode("\n", $file157);

$coletas    = [];
$blocoAtual = [];
$isResumo   = false;

$flush157 = function() use (&$blocoAtual, &$coletas, $agora, $cidadeMap, $linhas0083) {
    if (empty($blocoAtual)) return;

    $linhaBloco = implode("\n", $blocoAtual);

    if (strpos($linhaBloco, 'CTRC GERADO') !== false) {
        $blocoAtual = [];
        return;
    }

    $cabecalho = $blocoAtual[0] ?? '';
    if (!preg_match('/^([A-Z]{3})\s+(\d+)\s+-/', $cabecalho, $mc)) {
        $blocoAtual = [];
        return;
    }
    $serColeta = $mc[1];
    $nroColeta = $mc[2];

    $remetente   = '';
    $cidadeRem   = '';
    $cidadeDest  = '';
    $ufDest      = '';
    $nomeDest    = '';
    $unidadeDest = '';
    $dataHoreLim = '';
    $coletada    = '';
    $valMerc     = '';
    $qtdeVol     = '';
    $peso        = '';

    foreach ($blocoAtual as $idx => $bl) {
        if (preg_match('/REME:\s*\S+\s+(.+?)\s{2,}/', $bl, $mr)) {
            $remetente = trim($mr[1]);
        }
        if (strpos($bl, 'DEST:') !== false) {
            $cidadeRaw = trim(substr($bl, 120, 25));
            if (!empty($cidadeRaw)) {
                $ufDest     = substr($cidadeRaw, strlen($cidadeRaw) - 2);
                $nomeDest   = trim(substr($cidadeRaw, 0, strlen($cidadeRaw) - 3));
                $cidadeDest = $cidadeRaw;
            }
        }
        if (preg_match('/DATA\/HORA LIMITE:\s*(\d{2}\/\d{2}\s+\d{2}:\d{2})/', $bl, $mdh)) {
            $dataHoreLim = trim($mdh[1]);
        }
        if (preg_match('/VAL MERC:\s*([\d.,]+)/', $bl, $mvm)) {
            $valMerc = trim($mvm[1]);
        }
        if (preg_match('/QTDE VOL:\s*(\d+)/', $bl, $mqv)) {
            $qtdeVol = trim($mqv[1]);
        }
        if (preg_match('/PESO\(KG\):\s*([\d.,]+)/', $bl, $mpe)) {
            $peso = trim($mpe[1]);
        }
        if (preg_match('/COLETADA:\s+(\d{2}\/\d{2}\s+\d{2}:\d{2})/', $bl, $mco)) {
            $coletada = trim($mco[1]);
        }
    }

    foreach ($linhas0083 as $linha)
    {
      if (strpos($linha, "$ufDest $nomeDest") !== false)
      {
        $unidadeDest = substr ($linha, 37, 3);
        break;
      }
    }

    $atrasoColeta = null;
    $limiteTs     = null;

    if (!empty($dataHoreLim) && preg_match('/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/', $dataHoreLim, $ml)) {
        $anoAtual = date('Y');
        $limiteTs = mktime((int)$ml[3], (int)$ml[4], 0, (int)$ml[2], (int)$ml[1], (int)$anoAtual);
    }

    if (!empty($coletada)) {
        $statusColeta = 'coletada';
        if ($limiteTs !== null && preg_match('/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/', $coletada, $mcc)) {
            $anoAtual   = date('Y');
            $coletadaTs = mktime((int)$mcc[3], (int)$mcc[4], 0, (int)$mcc[2], (int)$mcc[1], (int)$anoAtual);
            if ($coletadaTs > $limiteTs) {
                $statusColeta = 'coletada_atrasada';
                $diffMin      = (int)(($coletadaTs - $limiteTs) / 60);
                $atrasoColeta = $diffMin;
            }
        }
    } else {
        if ($limiteTs !== null && $agora > $limiteTs) {
            $statusColeta = 'atrasada';
            $diffMin      = (int)(($agora - $limiteTs) / 60);
            $atrasoColeta = $diffMin;
        }
    }

    $paraEntrega = (!empty($unidadeDest) && strtoupper($unidadeDest) === strtoupper($sigla));

    $coletas[] = [
        'serColeta'    => $serColeta,
        'nroColeta'    => $nroColeta,
        'remetente'    => $remetente,
        'cidadeRem'    => $cidadeRem,
        'cidadeDest'   => $cidadeDest,
        'unidadeDest'  => $unidadeDest,
        'paraEntrega'  => $paraEntrega,
        'dataHoreLim'  => $dataHoreLim,
        'coletada'     => $coletada,
        'valMerc'      => $valMerc,
        'qtdeVol'      => $qtdeVol,
        'peso'         => $peso,
        'statusColeta' => $statusColeta,
        'atrasoMin'    => $atrasoColeta,
    ];

    $blocoAtual = [];
};

foreach ($linhas157 as $linha) {
    if (strpos($linha, 'R E S U M O') !== false) {
        $flush157();
        $isResumo = true;
        continue;
    }
    if ($isResumo) continue;

    if (strpos($linha, 'RELACAO DAS COLETAS') !== false) continue;
    if (strpos($linha, 'PERIODO DE COLETA') !== false) continue;
    if (strpos($linha, 'ssw0157') !== false) continue;
    if (strpos($linha, 'PAG:') !== false) continue;
    if (preg_match('/^={5,}/', trim($linha))) continue;

    if (preg_match('/^([A-Z]{3})\s+(\d+)\s+-/', $linha)) {
        $flush157();
        $blocoAtual[] = $linha;
        continue;
    }

    if (!empty($blocoAtual)) {
        if (preg_match('/^-{10,}/', trim($linha))) {
            $flush157();
            continue;
        }
        $blocoAtual[] = $linha;
    }
}
$flush157();

respondJson([
    'success' => true,
    'data'    => [
        'ctes'           => $ctes,
        'coletas'        => $coletas,
        'sigla'          => $sigla,
        'geradoEm'       => date('d/m/Y H:i:s'),
    ],
]);
