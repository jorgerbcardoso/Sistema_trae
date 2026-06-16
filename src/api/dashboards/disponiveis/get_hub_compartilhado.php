<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];
$g_sql  = connect();

$input = getRequestInput();
$sigla = strtoupper(trim($input['sigla'] ?? ''));
$unidadesParam = $input['unidades'] ?? null;
$destino = strtoupper(trim($input['destino'] ?? ''));
$modo = strtolower(trim($input['modo'] ?? ''));

if (empty($sigla) || !preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Parâmetros inválidos.']);
}

$unidadesCompart = [];

if ($modo === 'sugestao') {
    if ($destino === '') {
        respondJson(['success' => true, 'unidades_sugeridas' => []]);
    }
    try {
        $tblLinha = $domain . '_linha';
        $resLinha = sql(
            "SELECT unidades FROM {$tblLinha} WHERE UPPER(sigla_emit) = UPPER($1) AND UPPER(sigla_dest) = UPPER($2) LIMIT 1",
            [$sigla, $destino],
            $g_sql
        );
        if ($resLinha && pg_num_rows($resLinha) > 0) {
            $row = pg_fetch_assoc($resLinha);
            $unidadesStr = $row['unidades'] ?? '';
            $lista = array_values(array_unique(array_filter(array_map(function($u) {
                $u = strtoupper(trim((string)$u));
                return preg_match('/^[A-Z0-9]{2,5}$/', $u) ? $u : null;
            }, explode(',', (string)$unidadesStr)))));
            respondJson(['success' => true, 'unidades_sugeridas' => $lista]);
        }
    } catch (Exception $e) {}
    respondJson(['success' => true, 'unidades_sugeridas' => []]);
}

if (is_array($unidadesParam)) {
    $unidadesCompart = array_values(array_unique(array_filter(array_map(function($u) {
        $u = strtoupper(trim((string)$u));
        return preg_match('/^[A-Z0-9]{2,5}$/', $u) ? $u : null;
    }, $unidadesParam))));
} else {
    if ($destino !== '') {
        try {
            $tblLinha = $domain . '_linha';
            $resLinha = sql(
                "SELECT unidades FROM {$tblLinha} WHERE UPPER(sigla_emit) = UPPER($1) AND UPPER(sigla_dest) = UPPER($2) LIMIT 1",
                [$sigla, $destino],
                $g_sql
            );
            if ($resLinha && pg_num_rows($resLinha) > 0) {
                $row = pg_fetch_assoc($resLinha);
                $unidadesStr = $row['unidades'] ?? '';
                $unidadesCompart = array_values(array_unique(array_filter(array_map(function($u) {
                    $u = strtoupper(trim((string)$u));
                    return preg_match('/^[A-Z0-9]{2,5}$/', $u) ? $u : null;
                }, explode(',', (string)$unidadesStr)))));
            }
        } catch (Exception $e) {}
    } else {
        $tblUnidade = $domain . '_unidade';
        $resUnidade = sql("SELECT unidades_compart FROM {$tblUnidade} WHERE UPPER(sigla) = UPPER($1) LIMIT 1", [$sigla], $g_sql);

        if ($resUnidade && pg_num_rows($resUnidade) > 0) {
            $row = pg_fetch_assoc($resUnidade);
            $unidadesCompart = array_filter(array_map('trim', explode(',', $row['unidades_compart'] ?? '')));
            $unidadesCompart = array_values(array_unique(array_filter(array_map(function($u) {
                $u = strtoupper(trim((string)$u));
                return preg_match('/^[A-Z0-9]{2,5}$/', $u) ? $u : null;
            }, $unidadesCompart))));
        }
    }
}

if (empty($unidadesCompart)) {
    respondJson(['success' => true, 'unidades' => [], 'dados' => []]);
}

ssw_login($domain);
set_time_limit(180);

$agora   = time();
$agora12h = $agora + (12 * 3600);

$resultadosPorUnidade = [];

foreach ($unidadesCompart as $siglaHub) {
    if (!preg_match('/^[A-Z0-9]{2,5}$/', $siglaHub)) continue;

    try {
        ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($siglaHub) . '&f3=101');

        $dataPrevMan = date('dmy', $agora12h);
        $horaPrevMan = date('Hi', $agora12h);
        $dataEmitCte = date('dmy', $agora);
        $horaEmitCte = date('Hi', $agora);

        $url0036 = 'https://sistema.ssw.inf.br/bin/ssw0036?act=ENV'
            . '&l_siglas_familia=' . urlencode($siglaHub)
            . '&data_prev_man='    . $dataPrevMan
            . '&hora_prev_man='    . $horaPrevMan
            . '&data_emit_ctrc='   . $dataEmitCte
            . '&hora_emit_ctrc='   . $horaEmitCte
            . '&status_ctrc=C&ctrc_pendente=T&lista_pendencias=N&apenas_descarregados=T'
            . '&lista_reversa=T&apenas_prioritarios=T&id_tp_produto=T&fg_enderecados=T'
            . '&relacionar_produtos=N&relatorio_excel=S'
            . '&button_env_enable=ENV&button_env_disable=btn_envia';

        $str = ssw_go($url0036);

        if (substr($str, 0, 5) === '<foc ') {
            $resultadosPorUnidade[$siglaHub] = ['erro' => 'Erro SSW ao gerar relatório.', 'ctes' => []];
            continue;
        }

        $strDec  = urldecode($str);
        $queued  = (strpos($strDec, 'Solicita &ccedil;&atilde;o enviada para processamento.') !== false);
        $act  = $queued ? '' : ssw_get_act($strDec);
        $arq  = $queued ? '' : ssw_get_arq($strDec);

        $file = '';
        if ($act !== '' && $arq !== '') {
            $file = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');
        }

        if (empty($file) || strlen($file) < 100) {
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
                        if ($unidF4 !== strtoupper($siglaHub)) continue;
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
                    if (!empty($file) && strlen($file) >= 100) break;
                }
                usleep(400000);
            }
        }

        $file = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
        $file = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file);
        $file = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
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
                if ($manifesto !== '' && preg_match('/^([A-Z]{3})(\d{6})/', $manifesto, $mm)) {
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
                    $diffDias = $dataAutorTs !== null ? (int)(($dataAutorTs - $refTs) / 86400) : (int)(($agora - $refTs) / 86400);
                    if ($diffDias <= 1) $indicadorSaida = 'verde';
                    elseif ($diffDias == 2) $indicadorSaida = 'amarelo';
                    elseif ($diffDias == 3) $indicadorSaida = 'laranja';
                    else $indicadorSaida = 'vermelho';
                } elseif ($dataAutorTs !== null) {
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
                    'unidadeCarregamento' => $siglaHub,
                    'unidadeOrigem'  => $siglaHub,
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
                    if ($diffSecs <= 0)          $atrasoTransf = 'verde';
                    elseif ($diffSecs <= 7200)   $atrasoTransf = 'amarelo';
                    elseif ($diffSecs <= 14400)  $atrasoTransf = 'laranja';
                    else                         $atrasoTransf = 'vermelho';
                }

                $indicadorSaida = null;
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
                    $diffDias = $dataAutorTs !== null ? (int)(($dataAutorTs - $refTs) / 86400) : (int)(($agora - $refTs) / 86400);
                    if ($diffDias <= 1)      $indicadorSaida = 'verde';
                    elseif ($diffDias == 2)  $indicadorSaida = 'amarelo';
                    elseif ($diffDias == 3)  $indicadorSaida = 'laranja';
                    else                     $indicadorSaida = 'vermelho';
                } elseif ($dataAutorTs !== null) {
                    $diffDias = (int)(($agora - $dataAutorTs) / 86400);
                    if ($diffDias <= 1)      $indicadorSaida = 'verde';
                    elseif ($diffDias == 2)  $indicadorSaida = 'amarelo';
                    elseif ($diffDias == 3)  $indicadorSaida = 'laranja';
                    else                     $indicadorSaida = 'vermelho';
                }

                if (trim((string)$unidadeDestAtual) === '0') continue;

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
                    'unidadeCarregamento' => $siglaHub,
                    'unidadeOrigem'  => $siglaHub,
                ];
            }
        }

        $resultadosPorUnidade[$siglaHub] = ['ctes' => $ctes, 'erro' => null];

    } catch (Exception $e) {
        $resultadosPorUnidade[$siglaHub] = ['erro' => $e->getMessage(), 'ctes' => []];
    }
}

respondJson([
    'success'  => true,
    'unidades' => $unidadesCompart,
    'dados'    => $resultadosPorUnidade,
]);
