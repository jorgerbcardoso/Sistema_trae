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
            . '&relacionar_produtos=N&relatorio_excel=N'
            . '&button_env_enable=ENV&button_env_disable=btn_envia';

        $str = ssw_go($url0036);

        if (substr($str, 0, 5) === '<foc ') {
            $resultadosPorUnidade[$siglaHub] = ['erro' => 'Erro SSW ao gerar relatório.', 'ctes' => []];
            continue;
        }

        $str  = urldecode($str);
        $act  = ssw_get_act($str);
        $arq  = ssw_get_arq($str);
        $file = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');
        $linhas = explode("\r", $file);

        $ctes = [];
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
                'unidadeOrigem'  => $siglaHub,
            ];
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
