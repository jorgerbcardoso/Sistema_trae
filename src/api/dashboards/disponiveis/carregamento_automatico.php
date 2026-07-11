<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

$currentUser = getCurrentUser();
$unidade     = strtoupper(trim($currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? ''));
$login       = $currentUser['username'] ?? '';

if (empty($unidade) || !preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Unidade ou domínio inválidos.']);
}

$input          = getRequestInput();
$acao           = strtolower(trim($input['acao'] ?? ''));
$placa          = strtoupper(trim($input['placa'] ?? ''));
$unidadeDestino = strtoupper(trim($input['unidadeDestino'] ?? ''));
$paradas        = array_values(array_filter(array_map('strtoupper', array_map('trim', (array)($input['paradas'] ?? [])))));
$nroLinha       = (int)($input['nroLinha'] ?? 0);
$ctesDisponiveis = $input['ctesDisponiveis'] ?? [];   // array de objetos enviados pelo frontend

$conn        = connect();
$tabela      = "{$domain}_carregamento";
$tabelaLinha = "{$domain}_linha";
$tabelaVeiculo = "{$domain}_veiculo";
$tabelaCap   = "{$domain}_carregamento_capacidade";

$modoAutomatico = empty($placa) && empty($unidadeDestino);

// ─── Listar linhas ────────────────────────────────────────────────────────────
if ($acao === 'listar_linhas') {
    try {
        $res = sql(
            "SELECT nro_linha, nome, sigla_emit, sigla_dest, unidades, km_ida, km_volta, vlr_min_frete,
                    carrega_seg, carrega_ter, carrega_qua, carrega_qui, carrega_sex, carrega_sab, carrega_dom
             FROM {$tabelaLinha}
             WHERE sigla_emit = \$1
             ORDER BY sigla_dest, nome, nro_linha",
            [$unidade], $conn
        );
        $linhas = [];
        while ($res && ($r = pg_fetch_assoc($res))) {
            $linhas[] = [
                'nro_linha'  => (int)($r['nro_linha'] ?? 0),
                'nome'       => (string)($r['nome'] ?? ''),
                'sigla_emit' => strtoupper(trim((string)($r['sigla_emit'] ?? ''))),
                'sigla_dest' => strtoupper(trim((string)($r['sigla_dest'] ?? ''))),
                'unidades'   => (string)($r['unidades'] ?? ''),
                'km_ida'     => $r['km_ida']   !== null ? (int)$r['km_ida']   : null,
                'km_volta'   => $r['km_volta'] !== null ? (int)$r['km_volta'] : null,
                'vlr_min_frete' => $r['vlr_min_frete'] !== null ? (float)$r['vlr_min_frete'] : null,
                'carrega_seg' => ((string)($r['carrega_seg'] ?? '') === 't'),
                'carrega_ter' => ((string)($r['carrega_ter'] ?? '') === 't'),
                'carrega_qua' => ((string)($r['carrega_qua'] ?? '') === 't'),
                'carrega_qui' => ((string)($r['carrega_qui'] ?? '') === 't'),
                'carrega_sex' => ((string)($r['carrega_sex'] ?? '') === 't'),
                'carrega_sab' => ((string)($r['carrega_sab'] ?? '') === 't'),
                'carrega_dom' => ((string)($r['carrega_dom'] ?? '') === 't'),
            ];
        }
        respondJson(['success' => true, 'linhas' => $linhas]);
    } catch (Exception $e) {
        respondJson(['success' => false, 'message' => 'Erro ao listar linhas.']);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseNumero($value) {
    if ($value === null) return 0.0;
    if (is_int($value) || is_float($value)) return (float)$value;
    $s = trim((string)$value);
    if ($s === '') return 0.0;
    $s = str_replace(' ', '', $s);
    if (strpos($s, ',') !== false) {
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
        return (float)$s;
    }
    $s = str_replace(',', '', $s);
    return (float)$s;
}

function fetchCtes019Csv($domain, $g_sql, $siglaUnidade, $agora) {
    $siglaUnidade = strtoupper(trim((string)$siglaUnidade));
    if ($siglaUnidade === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $siglaUnidade)) return [];

    ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($siglaUnidade) . '&f3=101');

    $agora12h = $agora + (12 * 3600);
    $dataPrevMan = date('dmy', $agora12h);
    $horaPrevMan = date('Hi', $agora12h);
    $dataEmitCte = date('dmy', $agora);
    $horaEmitCte = date('Hi', $agora);

    $url0036 = 'https://sistema.ssw.inf.br/bin/ssw0036?act=ENV'
        . '&l_siglas_familia=' . urlencode($siglaUnidade)
        . '&data_prev_man='    . $dataPrevMan
        . '&hora_prev_man='    . $horaPrevMan
        . '&data_emit_ctrc='   . $dataEmitCte
        . '&hora_emit_ctrc='   . $horaEmitCte
        . '&status_ctrc=C&ctrc_pendente=T&lista_pendencias=N&apenas_descarregados=T'
        . '&lista_reversa=T&apenas_prioritarios=T&id_tp_produto=T&fg_enderecados=T'
        . '&relacionar_produtos=N&relatorio_excel=S'
        . '&button_env_enable=ENV&button_env_disable=btn_envia';

    $str = ssw_go($url0036);
    if (substr($str, 0, 5) === '<foc ') return [];

    $strDec = urldecode($str);
    $queued = (strpos($strDec, 'Solicita &ccedil;&atilde;o enviada para processamento.') !== false);
    $act  = $queued ? '' : ssw_get_act($strDec);
    $arq  = $queued ? '' : ssw_get_arq($strDec);

    $file = '';
    if ($act !== '' && $arq !== '') {
        $file = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');
    }

    if ($file === '' || strlen($file) < 50) {
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
                    if ($unidF4 !== strtoupper($siglaUnidade)) continue;
                    $usr = trim((string)$usr);
                    if (!(($usr === 'presto') || ($usr === 'damasce1') || ($usr === 'claraj'))) continue;
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
                if ($file !== '' && strlen($file) >= 50) break;
            }
            usleep(400000);
        }
    }

    if ($file === '' || strlen($file) < 50) return [];

    $file = mb_convert_encoding($file, 'UTF-8', 'ISO-8859-1');
    $file = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $file);
    $file = str_replace("\r\n", "\n", str_replace("\r", "\n", $file));
    $linhas = explode("\n", $file);

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
    if ($headerLine === null) return [];

    $header = str_getcsv($headerLine, ';');
    if (!empty($header)) $header[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$header[0]);
    $idx = [];
    foreach ($header as $i => $h) {
        $key = $normKey((string)$h);
        if ($key !== '') $idx[$key] = $i;
    }
    if (empty($idx)) return [];

    $nomeUnidadeCache = [];
    $getNomeUnidade = static function(string $siglaDest) use (&$nomeUnidadeCache, $domain, $g_sql): string {
        $k = strtoupper(trim($siglaDest));
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

    $ctes = [];
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

        $serCte = substr($ctrc, 0, 3);
        $nroCte = (int)substr($ctrc, 3, 6);
        if ($nroCte <= 0) continue;

        $unidadeDest = strtoupper($getCell($arr, $idx, ['DESTINO']));
        if ($unidadeDest === '' || $unidadeDest === '0') continue;

        $ctes[] = [
            'ctrc' => $ctrc,
            'serCte' => $serCte,
            'nroCte' => $nroCte,
            'unidadeCarregamento' => $siglaUnidade,
            'unidadeOrigem' => $siglaUnidade,
            'unidadeDest' => $unidadeDest,
            'nomeDest' => $getNomeUnidade($unidadeDest),
            'tipo' => $getCell($arr, $idx, ['T']),
            'emissao' => $getCell($arr, $idx, ['AUTORIZACAO']),
            'prevEnt' => $getCell($arr, $idx, ['PREV DE ENTREGA']),
            'nfiscal' => $getCell($arr, $idx, ['NFISCAL']),
            'pedido' => $getCell($arr, $idx, ['PEDIDO']),
            'remetente' => $getCell($arr, $idx, ['REMETENTE']),
            'pagador' => $getCell($arr, $idx, ['PAGADOR']),
            'destinatario' => $getCell($arr, $idx, ['DESTINATARIO']),
            'cidade' => $getCell($arr, $idx, ['CIDADE']),
            'uf' => $getCell($arr, $idx, ['UF']),
            'vlrNf' => $getCell($arr, $idx, ['MERCADORIA']),
            'frete' => $getCell($arr, $idx, ['FRETE']),
            'peso' => $getCell($arr, $idx, ['KGREA', 'KG REA', 'KG']),
            'cubagem' => $getCell($arr, $idx, ['M3']),
            'qtdeVol' => $getCell($arr, $idx, ['QVOL']),
            'manifesto' => $getCell($arr, $idx, ['MANIFESTO/END']),
            'prevChegada' => $getCell($arr, $idx, ['PREVCHEGADA']),
        ];
    }

    return $ctes;
}

function getCapacidadeVeiculo($conn, $tabelaVeiculo, $placa) {
    $capPesoKg = 27000.0;
    $capVolM3  = 67.0;
    if (empty($placa) || strpos($placa, '-') !== false) return [$capPesoKg, $capVolM3];
    try {
        $res = sql(
            "SELECT capacidade_ton, capacidade_m3 FROM {$tabelaVeiculo} WHERE UPPER(placa) = UPPER(\$1) LIMIT 1",
            [$placa], $conn
        );
        if ($res && pg_num_rows($res) > 0) {
            $row = pg_fetch_assoc($res);
            $ton = parseNumero($row['capacidade_ton'] ?? null);
            $m3  = parseNumero($row['capacidade_m3']  ?? null);
            if ($ton > 0) $capPesoKg = $ton * 1000.0;
            if ($m3  > 0) $capVolM3  = $m3;
        }
    } catch (Exception $e) {}
    return [$capPesoKg, $capVolM3];
}

function gerarResumos($conn, $tabela, $placa, $unidade) {
    $resumoDestinos = [];
    try {
        $resD = sql(
            "SELECT COALESCE(NULLIF(destino_cte, ''), '-') AS unid, COUNT(*) AS qtd,
                    COALESCE(SUM(peso_cte), 0) AS peso_total,
                    COALESCE(SUM(cubagem_cte), 0) AS cub_total,
                    COALESCE(SUM(vlr_frete_cte), 0) AS frete_total
             FROM {$tabela}
             WHERE unidade = \$1 AND placa_provisoria = \$2 AND nro_cte > 0
             GROUP BY COALESCE(NULLIF(destino_cte, ''), '-')
             ORDER BY qtd DESC",
            [$unidade, $placa], $conn
        );
        while ($resD && ($r = pg_fetch_assoc($resD))) {
            $resumoDestinos[] = [
                'unidade' => strtoupper(trim($r['unid'] ?? '')),
                'qtd'     => (int)$r['qtd'],
                'peso_kg' => round((float)$r['peso_total'], 2),
                'cubagem' => round((float)$r['cub_total'], 3),
                'frete'   => round((float)$r['frete_total'], 2),
            ];
        }
    } catch (Exception $e) {}
    return [[], $resumoDestinos];
}

/**
 * Filtra CT-es disponíveis (vindos do frontend) para os destinos informados,
 * respeitando a capacidade do veículo.
 * Retorna array de objetos CT-e prontos para inserção.
 */
function filtrarCtesPorCapacidade($ctesDisponiveis, $unidadeOrigem, $destinoFinal, $intermediarias, $limitePesoKg, $limiteVolM3) {
    $unidadeOrigem = strtoupper(trim((string)$unidadeOrigem));
    $destinoFinal  = strtoupper(trim((string)$destinoFinal));
    $intermediarias = array_values(array_filter(array_map(function($u) {
        return strtoupper(trim((string)$u));
    }, (array)$intermediarias)));

    $prioridade = [];
    $addUnique = static function(array &$arr, string $v): void {
        $v = strtoupper(trim($v));
        if ($v === '') return;
        if (!in_array($v, $arr, true)) $arr[] = $v;
    };

    $addUnique($prioridade, $destinoFinal);
    foreach ($intermediarias as $u) $addUnique($prioridade, $u);

    $idxDestino = array_flip($prioridade);

    $parseDataKey = static function(string $s): int {
        $s = trim($s);
        if ($s === '') return 99991231;
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $s, $m)) return ((int)$m[3] * 10000) + ((int)$m[2] * 100) + (int)$m[1];
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{2})$/', $s, $m)) return ((int)('20' . $m[3]) * 10000) + ((int)$m[2] * 100) + (int)$m[1];
        return 99991231;
    };

    $filtrados = [];
    foreach ($ctesDisponiveis as $cte) {
        $nroCte = (int)($cte['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        $unidRel019 = strtoupper(trim((string)($cte['unidadeCarregamento'] ?? $cte['unidade_carregamento'] ?? $cte['unidadeRelatorio'] ?? '')));
        if ($unidRel019 === '' || $unidRel019 !== $unidadeOrigem) continue;

        $unidDest = strtoupper(trim((string)($cte['unidadeDest'] ?? $cte['destinoCte'] ?? $cte['destino_cte'] ?? $cte['destino'] ?? '')));
        if ($unidDest === '' || !isset($idxDestino[$unidDest])) continue;

        $domainUpper = '';
        if (isset($GLOBALS['domain'])) $domainUpper = strtoupper(trim((string)$GLOBALS['domain']));
        if ($domainUpper === 'RVE') {
            if (in_array($unidDest, ['SAL', 'DK4', 'TNE', 'DEV'], true)) continue;
            if ($unidadeOrigem === 'SAO' && $unidDest === 'CAM') continue;
            if ($unidadeOrigem === 'CAM' && $unidDest === 'SAO') continue;
        }

        $cte['_prio'] = $idxDestino[$unidDest];
        $filtrados[] = $cte;
    }

    usort($filtrados, function($a, $b) use ($parseDataKey) {
        $pa = (int)($a['_prio'] ?? 999);
        $pb = (int)($b['_prio'] ?? 999);
        if ($pa !== $pb) return $pa - $pb;

        $da = $parseDataKey((string)($a['prevEnt'] ?? ''));
        $db = $parseDataKey((string)($b['prevEnt'] ?? ''));
        if ($da !== $db) return $da - $db;
        return (int)($a['nroCte'] ?? 0) - (int)($b['nroCte'] ?? 0);
    });

    $selecionados = [];
    $somaPeso     = 0.0;
    $somaVol      = 0.0;

    foreach ($filtrados as $cte) {
        $peso = parseNumero($cte['peso']    ?? 0);
        $cub  = parseNumero($cte['cubagem'] ?? 0);

        if ($somaPeso + $peso > $limitePesoKg || $somaVol + $cub > $limiteVolM3) continue;

        $somaPeso += $peso;
        $somaVol  += $cub;
        $selecionados[] = $cte;
    }

    return $selecionados;
}

/**
 * Insere CT-es na tabela de carregamento com destino e unidades em cada linha.
 */
function inserirCtes($conn, $tabela, $unidade, $placa, $login, $destino, $unidades, $ctesSelecionados) {
    $inseridos = 0;
    foreach ($ctesSelecionados as $cteData) {
        $nroCte = (int)($cteData['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        // Evita duplicata
        $check = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND nro_cte = {$nroCte}
             LIMIT 1"
        );
        if ($check && pg_num_rows($check) > 0) continue;

        $serCte   = pg_escape_string($conn, strtoupper(trim($cteData['serCte']      ?? $cteData['ser_cte'] ?? '')));
        $destCte  = pg_escape_string($conn, strtoupper(trim($cteData['unidadeDest'] ?? $cteData['destinoCte'] ?? $cteData['destino_cte'] ?? $cteData['destino'] ?? '')));
        $unidCarRaw = strtoupper(trim(
            $cteData['unidadeCarregamento']
            ?? $cteData['unidade_carregamento']
            ?? $cteData['unidadeRelatorio']
            ?? ''
        ));
        if ($unidCarRaw === '') return -1;
        $unidCar  = pg_escape_string($conn, $unidCarRaw);
        $emissao  = trim($cteData['emissao'] ?? '');
        $prevEnt  = trim($cteData['prevEnt'] ?? '');
        if ($emissao !== '') {
            $emissao = preg_replace('/[^\d]/', '/', $emissao);
            $emissao = preg_replace('/\/+/', '/', trim($emissao, '/'));
        }
        if ($prevEnt !== '') {
            $prevEnt = preg_replace('/[^\d]/', '/', $prevEnt);
            $prevEnt = preg_replace('/\/+/', '/', trim($prevEnt, '/'));
        }
        $remet    = pg_escape_string($conn, $cteData['remetente']    ?? '');
        $destin   = pg_escape_string($conn, $cteData['destinatario'] ?? '');
        $pagad    = pg_escape_string($conn, $cteData['pagador']      ?? '');
        $cidade   = pg_escape_string($conn, $cteData['cidade']       ?? '');
        $destEsc  = pg_escape_string($conn, $destino);
        $unidEsc  = pg_escape_string($conn, $unidades);

        $vlrMerc  = parseNumero($cteData['vlrNf']    ?? 0);
        $vlrFrete = parseNumero($cteData['frete']    ?? 0);
        $peso     = parseNumero($cteData['peso']     ?? 0);
        $cubagem  = parseNumero($cteData['cubagem']  ?? 0);
        $qtdeVol  = (int)($cteData['qtdeVol'] ?? 0);

        $emissaoSql = 'NULL';
        $prevEntSql = 'NULL';
        $nowYear  = (int)date('Y');
        $nowMonth = (int)date('n');
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $emissao, $m)) {
            $emissaoSql = "'" . $m[3] . '-' . $m[2] . '-' . $m[1] . "'";
        } elseif (preg_match('/^(\d{2})\/(\d{2})$/', $emissao, $m)) {
            $y = $nowYear;
            $mm = (int)$m[2];
            if ($nowMonth >= 11 && $mm <= 2) $y = $nowYear + 1;
            $emissaoSql = "'" . $y . '-' . $m[2] . '-' . $m[1] . "'";
        }
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $prevEnt, $m)) {
            $prevEntSql = "'" . $m[3] . '-' . $m[2] . '-' . $m[1] . "'";
        } elseif (preg_match('/^(\d{2})\/(\d{2})$/', $prevEnt, $m)) {
            $y = $nowYear;
            $mm = (int)$m[2];
            if ($nowMonth >= 11 && $mm <= 2) $y = $nowYear + 1;
            $prevEntSql = "'" . $y . '-' . $m[2] . '-' . $m[1] . "'";
        }

        $res = pg_query($conn,
            "INSERT INTO {$tabela}
             (unidade, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
              remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
              vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
              destino, unidades, origem_ssw, unidade_carregamento)
             VALUES
             ('" . pg_escape_string($conn, $unidade) . "', '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
              '{$serCte}', {$nroCte}, '{$destCte}', {$emissaoSql}, {$prevEntSql},
              '{$remet}', '{$destin}', '{$pagad}', '{$cidade}',
              {$vlrMerc}, {$vlrFrete}, {$peso}, {$cubagem}, {$qtdeVol},
              '{$destEsc}', '{$unidEsc}', NULL, '{$unidCar}')"
        );

        if (!$res) {
            return -1; // sinaliza erro
        }
        $inseridos++;
    }
    return $inseridos;
}

// ─── Modo automático por linha ────────────────────────────────────────────────
if ($modoAutomatico) {
    if ($nroLinha <= 0) {
        respondJson(['success' => false, 'message' => 'Linha não informada.']);
    }

    $resLinha = null;
    try {
        $resLinha = sql(
            "SELECT sigla_dest, unidades FROM {$tabelaLinha} WHERE sigla_emit = \$1 AND nro_linha = \$2 LIMIT 1",
            [$unidade, $nroLinha], $conn
        );
    } catch (Exception $e) {}

    if (!$resLinha || pg_num_rows($resLinha) === 0) {
        respondJson(['success' => false, 'message' => 'Linha não encontrada para a unidade atual.']);
    }

    $linha    = pg_fetch_assoc($resLinha);
    $dest     = strtoupper(trim($linha['sigla_dest'] ?? ''));
    if ($dest === '') {
        respondJson(['success' => false, 'message' => 'Linha inválida: destino não informado.']);
    }

    $paradasLinha         = array_values(array_filter(array_map('strtoupper', array_map('trim', explode(',', $linha['unidades'] ?? '')))));
    $placaAuto            = $unidade . '-' . $dest;
    $paradasCsv           = implode(',', $paradasLinha);

    $check = sql("SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 LIMIT 1", [$unidade, $placaAuto], $conn);
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => true, 'message' => "Carregamento {$placaAuto} já existe.", 'resultados' => [['placa' => $placaAuto, 'status' => 'ignorado', 'msg' => 'Carregamento já existe.']]]);
    }

    if (empty($ctesDisponiveis)) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível enviado pelo painel. Recarregue os dados e tente novamente.']);
    }

    set_time_limit(180);
    $ctesUnicos = [];
    foreach ($ctesDisponiveis as $cte) {
        $ser = strtoupper(trim((string)($cte['serCte'] ?? $cte['ser_cte'] ?? substr((string)($cte['ctrc'] ?? ''), 0, 3))));
        $nro = (int)($cte['nroCte'] ?? $cte['nro_cte'] ?? substr((string)($cte['ctrc'] ?? ''), 3, 6));
        if ($ser === '' || $nro <= 0) continue;
        $k = $ser . $nro;
        if (!isset($ctesUnicos[$k])) $ctesUnicos[$k] = $cte;
    }
    $ctesDisponiveis = array_values($ctesUnicos);

    list($limitePeso, $limiteVol) = getCapacidadeVeiculo($conn, $tabelaVeiculo, $placaAuto);
    $ctesSelecionados = filtrarCtesPorCapacidade($ctesDisponiveis, $unidade, $dest, $paradasLinha, $limitePeso, $limiteVol);

    if (empty($ctesSelecionados)) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível para os destinos desta linha.']);
    }

    pg_query($conn, 'BEGIN');

    $inseridos = inserirCtes($conn, $tabela, $unidade, $placaAuto, $login, $dest, $paradasCsv, $ctesSelecionados);
    if ($inseridos < 0) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao inserir CT-es: ' . pg_last_error($conn)]);
    }

    pg_query($conn, 'COMMIT');

    [$resumoUnidades, $resumoDestinos] = gerarResumos($conn, $tabela, $placaAuto, $unidade);

    respondJson([
        'success'         => true,
        'message'         => "{$inseridos} CT-e(s) adicionados ao carregamento {$placaAuto}.",
        'resultados'      => [['placa' => $placaAuto, 'status' => 'criado', 'msg' => "{$inseridos} CT-e(s) adicionados."]],
        'placa'           => $placaAuto,
        'resumo_unidades' => $resumoUnidades,
        'resumo_destinos' => $resumoDestinos,
    ]);
}

// ─── Modo informado (destino manual) ─────────────────────────────────────────
if (empty($unidadeDestino)) {
    respondJson(['success' => false, 'message' => 'Unidade de destino não informada.']);
}

$placaFinal = !empty($placa) ? $placa : ($unidade . '-' . $unidadeDestino);
$paradasCsv = implode(',', $paradas);

$check = sql("SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 LIMIT 1", [$unidade, $placaFinal], $conn);
if ($check && pg_num_rows($check) > 0) {
    respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaFinal}."]);
}

if (empty($ctesDisponiveis)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível enviado pelo painel. Recarregue os dados e tente novamente.']);
}

set_time_limit(180);
$ctesUnicos = [];
foreach ($ctesDisponiveis as $cte) {
    $ser = strtoupper(trim((string)($cte['serCte'] ?? $cte['ser_cte'] ?? substr((string)($cte['ctrc'] ?? ''), 0, 3))));
    $nro = (int)($cte['nroCte'] ?? $cte['nro_cte'] ?? substr((string)($cte['ctrc'] ?? ''), 3, 6));
    if ($ser === '' || $nro <= 0) continue;
    $k = $ser . $nro;
    if (!isset($ctesUnicos[$k])) $ctesUnicos[$k] = $cte;
}
$ctesDisponiveis = array_values($ctesUnicos);

list($limitePeso, $limiteVol) = getCapacidadeVeiculo($conn, $tabelaVeiculo, $placaFinal);
$ctesSelecionados = filtrarCtesPorCapacidade($ctesDisponiveis, $unidade, $unidadeDestino, $paradas, $limitePeso, $limiteVol);

if (empty($ctesSelecionados)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível para os destinos informados.']);
}

pg_query($conn, 'BEGIN');

$inseridos = inserirCtes($conn, $tabela, $unidade, $placaFinal, $login, $unidadeDestino, $paradasCsv, $ctesSelecionados);
if ($inseridos < 0) {
    pg_query($conn, 'ROLLBACK');
    respondJson(['success' => false, 'message' => 'Erro ao inserir CT-es: ' . pg_last_error($conn)]);
}

pg_query($conn, 'COMMIT');

[$resumoUnidades, $resumoDestinos] = gerarResumos($conn, $tabela, $placaFinal, $unidade);

respondJson([
    'success'         => true,
    'message'         => "{$inseridos} CT-e(s) adicionados ao carregamento {$placaFinal}.",
    'placa'           => $placaFinal,
    'resumo_unidades' => $resumoUnidades,
    'resumo_destinos' => $resumoDestinos,
]);
