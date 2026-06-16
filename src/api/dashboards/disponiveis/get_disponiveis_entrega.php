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

// Navega para a unidade correta antes de gerar o relatório
ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($sigla) . '&f3=101');

$agora12h    = time() + (12 * 3600);
$dataPrevMan = date('dmy', $agora12h);
$horaPrevMan = date('Hi', $agora12h);

$url0052 = 'https://sistema.ssw.inf.br/bin/ssw0052?act=ENV'
    . '&data_prev_man='      . $dataPrevMan
    . '&hora_prev_man='      . $horaPrevMan
    . '&tp_cliente_pag=T'
    . '&tp_pessoa_dest=A'
    . '&status_ctrc=C'
    . '&ent_dificil=T'
    . '&ctrc_pendente=T'
    . '&lista_pendencias=N'
    . '&lista_descarregados=T'
    . '&unid_dest_final=T'
    . '&lista_reversa=T'
    . '&a_so_agend_obrig=T'
    . '&apenas_prioritarios=T'
    . '&id_tp_produto=T'
    . '&fg_enderecados=T'
    . '&relacionar_produtos=N'
    . '&relatorio_excel=S'
    . '&button_env_enable=ENV';

$str0052 = ssw_go($url0052);

if (substr($str0052, 0, 5) === '<foc ') {
    respondJson(['success' => false, 'message' => 'Erro SSW ao gerar relatório 081: ' . $str0052]);
}

$file = null;

$str0052dec  = urldecode($str0052);
$queued081 = (strpos($str0052dec, 'Solicita &ccedil;&atilde;o enviada para processamento.') !== false);
$actImediato = ssw_get_act($str0052dec);
$arqImediato = ssw_get_arq($str0052dec);

if (!$queued081 && !empty($actImediato) && !empty($arqImediato)) {
    $file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$actImediato}&filename={$arqImediato}&path=&down=1&nw=1");
}

if (empty($file) || strlen($file) < 100) {
    $str1440 = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
    $str1440 = substr($str1440, strpos($str1440, '<xml'), strlen($str1440));
    $str1440 = substr($str1440, 0, strpos($str1440, '</xml>')) . '</xml>';
    $xml1440 = simplexml_load_string($str1440);

    $encontrado = false;
    $nomeArq081 = null;
    $pathArq081 = null;

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

            if ((substr($opc, 0, 3) == '081')
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
                            $nomeArq081 = $mArq[1];
                            $pathArq081 = $mArq[2];
                        }
                    }
                }
                break;
            }
        }
    }

    if (!$encontrado || !$nomeArq081 || !$pathArq081) {
        respondJson(['success' => false, 'message' => 'Relatório 081 não encontrado (nem gerado imediatamente nem na fila do ssw1440).']);
    }

    $file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$nomeArq081}&filename={$nomeArq081}&path={$pathArq081}&down=1&nw=1");
}

if (empty($file) || strlen($file) < 100) {
    respondJson(['success' => false, 'message' => 'Arquivo do relatório 081 vazio ou inválido.']);
}

$file   = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
$file   = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file);
$file   = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
$linhas = explode("\n", $file);

$ctes    = [];
$cabecalho = null;

foreach ($linhas as $linha) {
    $linha = trim($linha);
    if ($linha === '') continue;

    $arr = str_getcsv($linha, ';');

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

    if ($setor == 'SETOR') continue;

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
        'emissao'      => '',
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

$tblCte = "{$domain}_cte";
$emissaoPorCte = [];
$tblExists = false;
$chk = pg_query($g_sql, "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '{$tblCte}') AS ok");
if ($chk) {
    $tblExists = (pg_fetch_result($chk, 0, 0) === 't');
}

if ($tblExists && !empty($ctes)) {
    $pares = [];
    $seen = [];
    foreach ($ctes as $c) {
        $ser = (string)($c['serCte'] ?? '');
        $nro = (int)($c['nroCte'] ?? 0);
        if ($ser === '' || $nro <= 0) continue;
        $k = $ser . '|' . $nro;
        if (isset($seen[$k])) continue;
        $seen[$k] = true;
        $pares[] = [$ser, $nro];
    }

    foreach (array_chunk($pares, 500) as $chunk) {
        $params = [];
        $values = [];
        $p = 1;
        foreach ($chunk as $par) {
            $values[] = "($" . $p . ", $" . ($p + 1) . ")";
            $params[] = $par[0];
            $params[] = $par[1];
            $p += 2;
        }
        if (empty($values)) continue;

        $q = "
            WITH req(ser_cte, nro_cte) AS (VALUES " . implode(',', $values) . ")
            SELECT DISTINCT ON (c.ser_cte, c.nro_cte)
                c.ser_cte,
                c.nro_cte,
                TO_CHAR(c.data_emissao, 'DD/MM/YYYY') AS emissao
            FROM {$tblCte} c
            JOIN req r ON r.ser_cte = c.ser_cte AND r.nro_cte = c.nro_cte
            ORDER BY c.ser_cte, c.nro_cte, c.seq_cte DESC
        ";
        $resEmi = pg_query_params($g_sql, $q, $params);
        if ($resEmi) {
            while ($row = pg_fetch_assoc($resEmi)) {
                $k = ((string)($row['ser_cte'] ?? '')) . '|' . (int)($row['nro_cte'] ?? 0);
                $emissaoPorCte[$k] = (string)($row['emissao'] ?? '');
            }
        }
    }

    foreach ($ctes as &$c) {
        $k = ((string)($c['serCte'] ?? '')) . '|' . (int)($c['nroCte'] ?? 0);
        if (isset($emissaoPorCte[$k]) && $emissaoPorCte[$k] !== '') {
            $c['emissao'] = $emissaoPorCte[$k];
        }
    }
    unset($c);
}

respondJson([
    'success' => true,
    'data'    => [
        'ctes'     => $ctes,
        'sigla'    => $sigla,
        'geradoEm' => date('d/m/Y H:i:s'),
    ],
]);

