<?php
require_once __DIR__ . '/ssw_loader.php';

function ssw_extract_xml_fragment(string $html): ?string {
    $html = (string)$html;
    if ($html === '') return null;
    $inicio = strpos($html, '<?xml');
    if ($inicio === false) $inicio = strpos($html, '<xml');
    if ($inicio === false) {
        $dec = @urldecode($html);
        if ($dec && $dec !== $html) {
            $inicio = strpos($dec, '<?xml');
            if ($inicio === false) $inicio = strpos($dec, '<xml');
            if ($inicio !== false) $html = $dec;
        }
    }
    if ($inicio === false) {
        $iniR = strpos($html, '<r>');
        if ($iniR === false) $iniR = strpos($html, '<r ');
        if ($iniR !== false) {
            $fimR = strrpos($html, '</r>');
            if ($fimR !== false) {
                $frag = substr($html, $iniR, ($fimR + 4) - $iniR);
                return "<xml>{$frag}</xml>";
            }
        }
        return null;
    }
    $fim = strrpos($html, '</xml>');
    $tagFim = '</xml>';
    if ($fim === false) {
        $fim = strrpos($html, '</data>');
        $tagFim = '</data>';
    }
    if ($fim === false) return null;
    return substr($html, $inicio, ($fim + strlen($tagFim)) - $inicio);
}

function ssw_parse_dt_br(string $s): ?DateTime {
    $s = trim((string)$s);
    if ($s === '') return null;
    $m = null;
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/', $s, $m)) {
        $dia = (int)$m[1];
        $mes = (int)$m[2];
        $anoRaw = (string)$m[3];
        $ano = strlen($anoRaw) === 2 ? (2000 + (int)$anoRaw) : (int)$anoRaw;
        $hh = (int)$m[4];
        $mm = (int)$m[5];
        $ss = isset($m[6]) ? (int)$m[6] : 0;
        $dt = DateTime::createFromFormat('Y-m-d H:i:s', sprintf('%04d-%02d-%02d %02d:%02d:%02d', $ano, $mes, $dia, $hh, $mm, $ss));
        return $dt ?: null;
    }
    foreach (['d/m/y H:i:s', 'd/m/Y H:i:s', 'd/m/y H:i', 'd/m/Y H:i'] as $f) {
        $dt = DateTime::createFromFormat($f, $s);
        if ($dt !== false) return $dt;
    }
    return null;
}

function ssw_parse_date_br(?string $v): ?string {
    $s = trim((string)$v);
    if ($s === '') return null;
    $dt = DateTime::createFromFormat('d/m/y', $s);
    if ($dt !== false) return $dt->format('Y-m-d');
    $dt = DateTime::createFromFormat('d/m/Y', $s);
    if ($dt !== false) return $dt->format('Y-m-d');
    return null;
}

function ssw_to_float($v): float {
    $s = trim((string)$v);
    if ($s === '') return 0.0;
    $s = str_replace(['.', ' '], ['', ''], $s);
    $s = str_replace(',', '.', $s);
    return (float)$s;
}

function ssw_table_exists($conn, string $tableName): bool {
    $t = strtolower(trim($tableName));
    if ($t === '') return false;
    $res = sql(
        "SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND lower(table_name) = lower($1)
         LIMIT 1",
        [$t],
        $conn
    );
    return ($res && pg_num_rows($res) > 0);
}

function ssw_cte_col_exists($conn, string $tblCte, string $col): bool {
    $c = strtolower(trim($col));
    if ($c === '') return false;
    $res = null;
    try {
        $res = sql(
            "SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = lower($1)
               AND column_name = $2
             LIMIT 1",
            [strtolower($tblCte), $c],
            $conn
        );
    } catch (Exception $e) {
        $res = null;
    }
    return ($res && pg_num_rows($res) > 0);
}

function ssw_restore_ctes_carregamento($conn, string $domain, string $unidade, string $login, array $carBase, ?DateTime $dtRef = null): array {
    $placaReq = strtoupper(trim((string)($carBase['placa_provisoria'] ?? $carBase['placa'] ?? '')));
    $seqCarreg = (int)($carBase['seq_carregamento'] ?? 0);
    if ($placaReq === '' || $seqCarreg <= 0) {
        return ['success' => false, 'message' => 'Carregamento inválido.'];
    }

    $tabela = "{$domain}_carregamento";
    $tblCte = "{$domain}_cte";

    $dtBase = $dtRef;
    if ($dtBase === null) {
        $dataFinal = trim((string)($carBase['data_finalizacao'] ?? $carBase['data_final'] ?? ''));
        if ($dataFinal !== '' && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dataFinal, $m)) {
            $dtBase = DateTime::createFromFormat('Y-m-d', "{$m[1]}-{$m[2]}-{$m[3]}");
        } else {
            $dtBase = new DateTime();
        }
    }

    $ddmmaa = $dtBase->format('dmy');

    try {
        require_ssw();
        ssw_login($domain);
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Falha ao autenticar no SSW.'];
    }

    $url = "https://sistema.ssw.inf.br/bin/ssw0125?act=PER&t_sigla_origem=" . rawurlencode($unidade) .
        "&t_data_saida_ini=" . rawurlencode($ddmmaa) .
        "&t_data_saida_fin=" . rawurlencode($ddmmaa);

    $html = '';
    try {
        $html = ssw_go($url);
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Falha ao consultar o SSW.'];
    }

    $xmlStr = ssw_extract_xml_fragment($html);
    if ($xmlStr === null) {
        return ['success' => false, 'message' => 'SSW: retorno sem XML.'];
    }

    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) {
        return ['success' => false, 'message' => 'SSW: XML inválido.'];
    }

    $info = ['saida' => null, 'qtd' => 0, 'manifestos' => []];
    $rows = $xml->xpath('//r');
    if ($rows && count($rows) > 0) {
        foreach ($rows as $r) {
            $f3 = strtoupper(trim((string)($r->f3 ?? '')));
            $f2 = strtoupper(trim((string)($r->f2 ?? '')));
            $placa = $f3 !== '' ? $f3 : $f2;
            if ($placa !== $placaReq) continue;
            $f11 = trim((string)($r->f11 ?? ''));
            $dt = $f11 !== '' ? ssw_parse_dt_br($f11) : null;
            if ($dt !== null) {
                if ($info['saida'] === null || $dt->getTimestamp() < $info['saida']->getTimestamp()) $info['saida'] = $dt;
            }
            $f8Raw = trim((string)($r->f8 ?? ''));
            $f8Num = (int)preg_replace('/[^\d]/', '', $f8Raw);
            if ($f8Num > 0) $info['qtd'] += $f8Num;
            $f17 = trim((string)($r->f17 ?? ''));
            $seqMan = (string)preg_replace('/[^\d]/', '', $f17);
            if ($seqMan !== '') $info['manifestos'][$seqMan] = true;
        }
    }

    $qtdSsw = (int)($info['qtd'] ?? 0);
    $manifestos = isset($info['manifestos']) && is_array($info['manifestos']) ? array_keys($info['manifestos']) : [];

    $qtdPresto = 0;
    try {
        $filtroSerieRve = (strtoupper($domain) === 'RVE') ? " AND UPPER(COALESCE(ser_cte, '')) <> 'SAS'" : "";
        $resQtd = sql(
            "SELECT COUNT(*) AS qtd
             FROM {$tabela}
             WHERE unidade = $1
               AND seq_carregamento = $2
               AND nro_cte > 0
               {$filtroSerieRve}",
            [$unidade, $seqCarreg],
            $conn
        );
        if ($resQtd && pg_num_rows($resQtd) > 0) $qtdPresto = (int)pg_fetch_result($resQtd, 0, 0);
    } catch (Exception $e) {
        $qtdPresto = 0;
    }

    if (count($manifestos) === 0) {
        return [
            'success' => true,
            'qtd_ssw' => $qtdSsw,
            'qtd_presto' => $qtdPresto,
            'added' => 0,
            'debug' => ['manifestos_count' => 0, 'manifestos_xml_ok' => 0, 'pairs_count' => 0, 'cte_found_count' => 0],
        ];
    }

    if (!ssw_table_exists($conn, $tblCte)) {
        return ['success' => false, 'message' => 'Tabela de CT-es não encontrada no domínio.'];
    }

    $manifestosCount = count($manifestos);
    $manifestosXmlOk = 0;
    $pairs = [];
    $cteXml = [];
    foreach ($manifestos as $seqMan) {
        $seqMan = trim((string)$seqMan);
        if ($seqMan === '') continue;
        $urlMan = "https://sistema.ssw.inf.br/bin/ssw0125?act=CTRCS_MAN&seq_manifesto=" . rawurlencode($seqMan);
        $htmlMan = '';
        try {
            $htmlMan = ssw_go($urlMan);
        } catch (Exception $e) {
            $htmlMan = '';
        }
        $xmlManStr = ssw_extract_xml_fragment($htmlMan);
        if ($xmlManStr === null) continue;
        $xmlMan = @simplexml_load_string($xmlManStr);
        if ($xmlMan === false) continue;
        $manifestosXmlOk += 1;
        $rowsMan = $xmlMan->xpath('//r');
        if (!$rowsMan || count($rowsMan) === 0) continue;
        foreach ($rowsMan as $rm) {
            $f0 = strtoupper(trim((string)($rm->f0 ?? '')));
            if ($f0 === '') continue;
            $f0Clean = preg_replace('/[^A-Z0-9]/', '', $f0);
            if (!preg_match('/^([A-Z]{3})(\d{6})/', $f0Clean, $mC)) continue;
            $ser = strtoupper($mC[1]);
            $nro = (int)$mC[2];
            if ($nro <= 0) continue;
            $k = $ser . '|' . $nro;
            $pairs[$k] = ['ser' => $ser, 'nro' => $nro];
            if (!isset($cteXml[$k])) {
                $cteXml[$k] = [
                    'ser_cte' => $ser,
                    'nro_cte' => $nro,
                    'destino_cte' => '',
                    'cidade_destino' => trim((string)($rm->f5 ?? '')),
                    'remetente' => trim((string)($rm->f3 ?? '')),
                    'destinatario' => trim((string)($rm->f4 ?? '')),
                    'pagador' => '',
                    'data_emissao' => ssw_parse_date_br((string)($rm->f2 ?? '')),
                    'data_prev_ent' => ssw_parse_date_br((string)($rm->f12 ?? '')),
                    'vlr_merc' => ssw_to_float((string)($rm->f9 ?? '')),
                    'vlr_frete' => ssw_to_float((string)($rm->f10 ?? '')),
                    'peso' => ssw_to_float((string)($rm->f8 ?? '')),
                    'cubagem' => 0.0,
                    'qtde_vol' => (int)preg_replace('/[^\d]/', '', (string)($rm->f7 ?? '')),
                ];
            }
        }
    }
    $pairsCount = count($pairs);
    if ($pairsCount === 0) {
        return [
            'success' => true,
            'qtd_ssw' => $qtdSsw,
            'qtd_presto' => $qtdPresto,
            'added' => 0,
            'debug' => ['manifestos_count' => $manifestosCount, 'manifestos_xml_ok' => $manifestosXmlOk, 'pairs_count' => 0, 'cte_found_count' => 0],
        ];
    }

    $cteInfo = [];
    $joinCidade = ssw_cte_col_exists($conn, $tblCte, 'seq_cidade_dest') ? "LEFT JOIN cidade cid_dest ON cte.seq_cidade_dest = cid_dest.seq_cidade" : "";
    $selCidade = ssw_cte_col_exists($conn, $tblCte, 'seq_cidade_dest') ? "COALESCE(cid_dest.nome, '')" : "''";
    $selDest = ssw_cte_col_exists($conn, $tblCte, 'sigla_dest') ? "UPPER(BTRIM(cte.sigla_dest))" : "''";
    $selRemet = ssw_cte_col_exists($conn, $tblCte, 'nome_emit') ? "COALESCE(cte.nome_emit, '')" : "''";
    $selDestinat = ssw_cte_col_exists($conn, $tblCte, 'nome_dest') ? "COALESCE(cte.nome_dest, '')" : "''";
    $selPagador = ssw_cte_col_exists($conn, $tblCte, 'nome_pag') ? "COALESCE(cte.nome_pag, '')" : "''";
    $selEmissao = ssw_cte_col_exists($conn, $tblCte, 'data_emissao') ? "cte.data_emissao::date" : "NULL::date";
    $selPrev = ssw_cte_col_exists($conn, $tblCte, 'data_prev_ent') ? "cte.data_prev_ent::date" : "NULL::date";
    $selMerc = ssw_cte_col_exists($conn, $tblCte, 'vlr_merc') ? "COALESCE(cte.vlr_merc, 0)" : "0";
    $selFrete = ssw_cte_col_exists($conn, $tblCte, 'vlr_frete') ? "COALESCE(cte.vlr_frete, 0)" : "0";
    $selPeso = ssw_cte_col_exists($conn, $tblCte, 'peso_real')
        ? "COALESCE(cte.peso_real, 0)"
        : (ssw_cte_col_exists($conn, $tblCte, 'peso_calc') ? "COALESCE(cte.peso_calc, 0)" : "0");
    $selCub = ssw_cte_col_exists($conn, $tblCte, 'cubagem') ? "COALESCE(cte.cubagem, 0)" : "0";
    $selVol = ssw_cte_col_exists($conn, $tblCte, 'qtde_vol') ? "COALESCE(cte.qtde_vol, 0)" : "0";

    $pairsArr = array_values($pairs);
    foreach (array_chunk($pairsArr, 400) as $chunk) {
        $params = [];
        $vals = [];
        $p = 1;
        foreach ($chunk as $it) {
            $vals[] = '($' . $p . ', $' . ($p + 1) . ')';
            $params[] = (string)$it['ser'];
            $params[] = (int)$it['nro'];
            $p += 2;
        }
        if (count($vals) === 0) continue;
        $q = "
            WITH req(ser_cte, nro_cte) AS (VALUES " . implode(',', $vals) . ")
            SELECT req.ser_cte, req.nro_cte,
                   {$selDest} AS destino_cte, {$selCidade} AS cidade_destino,
                   {$selRemet} AS remetente, {$selDestinat} AS destinatario,
                   {$selPagador} AS pagador, {$selEmissao} AS data_emissao,
                   {$selPrev} AS data_prev_ent, {$selMerc} AS vlr_merc,
                   {$selFrete} AS vlr_frete, {$selPeso} AS peso,
                   {$selCub} AS cubagem, {$selVol} AS qtde_vol
            FROM req
            JOIN {$tblCte} cte
              ON regexp_replace(upper(cte.ser_cte::text), '[^A-Z0-9]', '', 'g') = req.ser_cte
             AND CAST(NULLIF(regexp_replace(cte.nro_cte::text, '[^0-9]', '', 'g'), '') AS INT) = req.nro_cte
            {$joinCidade}
        ";
        $resC = @pg_query_params($conn, $q, $params);
        if ($resC) {
            while ($rowC = pg_fetch_assoc($resC)) {
                $k = (string)($rowC['ser_cte'] ?? '') . '|' . (int)($rowC['nro_cte'] ?? 0);
                $cteInfo[$k] = $rowC;
            }
        }
    }
    $cteFoundCount = count($cteInfo);

    $cteAll = $cteXml;
    foreach ($cteInfo as $k => $rowC) {
        $cteAll[$k] = [
            'ser_cte' => (string)($rowC['ser_cte'] ?? ''),
            'nro_cte' => (int)($rowC['nro_cte'] ?? 0),
            'destino_cte' => (string)($rowC['destino_cte'] ?? ''),
            'cidade_destino' => (string)($rowC['cidade_destino'] ?? ($cteXml[$k]['cidade_destino'] ?? '')),
            'remetente' => (string)($rowC['remetente'] ?? ($cteXml[$k]['remetente'] ?? '')),
            'destinatario' => (string)($rowC['destinatario'] ?? ($cteXml[$k]['destinatario'] ?? '')),
            'pagador' => (string)($rowC['pagador'] ?? ''),
            'data_emissao' => (string)($rowC['data_emissao'] ?? ($cteXml[$k]['data_emissao'] ?? '')),
            'data_prev_ent' => (string)($rowC['data_prev_ent'] ?? ($cteXml[$k]['data_prev_ent'] ?? '')),
            'vlr_merc' => (float)($rowC['vlr_merc'] ?? ($cteXml[$k]['vlr_merc'] ?? 0)),
            'vlr_frete' => (float)($rowC['vlr_frete'] ?? ($cteXml[$k]['vlr_frete'] ?? 0)),
            'peso' => (float)($rowC['peso'] ?? ($cteXml[$k]['peso'] ?? 0)),
            'cubagem' => (float)($rowC['cubagem'] ?? 0),
            'qtde_vol' => (int)($rowC['qtde_vol'] ?? ($cteXml[$k]['qtde_vol'] ?? 0)),
        ];
    }

    $destinoCarreg = strtoupper(trim((string)($carBase['destino'] ?? '')));
    $unidadesCarreg = strtoupper(trim((string)($carBase['unidades'] ?? $carBase['paradas'] ?? '')));
    $setoresEntregaCarreg = trim((string)($carBase['setores_entrega'] ?? ''));
    $origemCriacao = strtoupper(trim((string)($carBase['origem_criacao'] ?? 'SSW')));
    if ($origemCriacao === '') $origemCriacao = 'SSW';

    $dataFinalStr = trim((string)($carBase['data_finalizacao'] ?? ''));
    if ($dataFinalStr === '') $dataFinalStr = $dtBase->format('Y-m-d');
    $horaFinalStr = trim((string)($carBase['hora_finalizacao'] ?? ''));
    if ($horaFinalStr === '') $horaFinalStr = ($info['saida'] instanceof DateTime) ? $info['saida']->format('H:i:s') : date('H:i:s');
    $loginFinalStr = trim((string)($carBase['login_finalizacao'] ?? ''));
    if ($loginFinalStr === '') $loginFinalStr = $login;

    $added = 0;
    if (count($cteAll) > 0) {
        @pg_query($conn, 'BEGIN');
        try {
            $unidadeEsc = pg_escape_string($conn, $unidade);
            $placaEsc = pg_escape_string($conn, $placaReq);
            $loginEsc = pg_escape_string($conn, $login);
            $destCarEsc = pg_escape_string($conn, $destinoCarreg);
            $unidCarEsc = pg_escape_string($conn, $unidadesCarreg);
            $setorCarEsc = pg_escape_string($conn, $setoresEntregaCarreg);
            $origemEsc = pg_escape_string($conn, $origemCriacao);
            $dataFinEsc = pg_escape_string($conn, $dataFinalStr);
            $horaFinEsc = pg_escape_string($conn, $horaFinalStr);
            $loginFinEsc = pg_escape_string($conn, $loginFinalStr);

            foreach ($cteAll as $rowC) {
                $ser = strtoupper(trim((string)($rowC['ser_cte'] ?? '')));
                $nro = (int)($rowC['nro_cte'] ?? 0);
                if ($ser === '' || $nro <= 0) continue;
                $check = @pg_query($conn,
                    "SELECT 1 FROM {$tabela}
                     WHERE unidade = '{$unidadeEsc}'
                       AND seq_carregamento = {$seqCarreg}
                       AND UPPER(BTRIM(ser_cte)) = '" . pg_escape_string($conn, $ser) . "'
                       AND nro_cte = {$nro}
                     LIMIT 1"
                );
                if ($check && pg_num_rows($check) > 0) continue;

                $destCte = strtoupper(trim((string)($rowC['destino_cte'] ?? '')));
                $destCteEsc = pg_escape_string($conn, $destCte);
                $emissaoVal = trim((string)($rowC['data_emissao'] ?? ''));
                $prevVal = trim((string)($rowC['data_prev_ent'] ?? ''));
                $emissaoSql = $emissaoVal !== '' ? "'" . pg_escape_string($conn, $emissaoVal) . "'::date" : 'NULL';
                $prevSql = $prevVal !== '' ? "'" . pg_escape_string($conn, $prevVal) . "'::date" : 'NULL';
                $vlrMerc = (float)($rowC['vlr_merc'] ?? 0);
                $vlrFrete = (float)($rowC['vlr_frete'] ?? 0);
                $peso = (float)($rowC['peso'] ?? 0);
                $cub = (float)($rowC['cubagem'] ?? 0);
                $vol = (int)($rowC['qtde_vol'] ?? 0);
                $remetente = pg_escape_string($conn, (string)($rowC['remetente'] ?? ''));
                $destinatario = pg_escape_string($conn, (string)($rowC['destinatario'] ?? ''));
                $pagador = pg_escape_string($conn, (string)($rowC['pagador'] ?? ''));
                $cidadeDest = pg_escape_string($conn, (string)($rowC['cidade_destino'] ?? ''));

                @pg_query($conn,
                    "INSERT INTO {$tabela}
                     (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                      ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                      remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                      vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                      destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento,
                      data_finalizacao, hora_finalizacao, login_finalizacao)
                     VALUES
                     ('{$unidadeEsc}', {$seqCarreg}, '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME,
                      '" . pg_escape_string($conn, $ser) . "', {$nro}, '{$destCteEsc}', {$emissaoSql}, {$prevSql},
                      '{$remetente}', '{$destinatario}', '{$pagador}', '{$cidadeDest}',
                      {$vlrMerc}, {$vlrFrete}, {$peso}, {$cub}, {$vol},
                      '{$destCarEsc}', '{$unidCarEsc}', '{$setorCarEsc}', NULL, '{$origemEsc}', '{$unidadeEsc}',
                      '{$dataFinEsc}'::date, '{$horaFinEsc}'::time, '{$loginFinEsc}')"
                );
                $added += 1;
            }

            if ($added > 0) {
                @pg_query($conn,
                    "DELETE FROM {$tabela}
                     WHERE unidade = '{$unidadeEsc}'
                       AND seq_carregamento = {$seqCarreg}
                       AND nro_cte = 0
                       AND data_finalizacao IS NULL"
                );
            }

            @pg_query($conn, 'COMMIT');
        } catch (Exception $e) {
            @pg_query($conn, 'ROLLBACK');
        }
    }

    return [
        'success' => true,
        'qtd_ssw' => $qtdSsw,
        'qtd_presto' => $qtdPresto,
        'added' => $added,
        'debug' => [
            'manifestos_count' => $manifestosCount,
            'manifestos_xml_ok' => $manifestosXmlOk,
            'pairs_count' => $pairsCount,
            'cte_found_count' => $cteFoundCount,
        ],
    ];
}

