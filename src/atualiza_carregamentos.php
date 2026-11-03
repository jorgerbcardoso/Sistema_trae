<?php
/**
 * ================================================================
 * SCRIPT: ATUALIZAÇÃO DE CARREGAMENTOS (TRANSFERÊNCIA) - SISTEMA PRESTO
 * ================================================================
 * Objetivo (somente Transferência):
 * - Finalizar automaticamente carregamentos abertos quando o SSW indicar SAÍDA (SSW0125 PER).
 * - Alimentar carregamentos vazios (total_ctes = 0) inserindo os CT-es do SSW (SSW0125 CTRCS_MAN).
 *
 * Importante:
 * - Não recebe período: o script sempre busca TUDO que estiver (1) em aberto e (2) zerado.
 * - Em seguida, calcula automaticamente o período do SSW0125 (PER) por UNIDADE:
 *   dt_ini = data de inclusão do carregamento mais antigo do universo (abertos + zerados)
 *   dt_fin = data de inclusão do carregamento mais recente + 2 dias (limitado a hoje)
 *
 * Regra de escopo:
 * - Vale apenas para carregamentos de Transferência (tp_carregamento = 'T')
 * - Ignora simulações (cap.simulado = true)
 *
 * Regras atuais (mapa):
 * - Universo de trabalho:
 *   1) Abertos: data_finalizacao IS NULL AND cap.simulado = false
 *   2) Zerados: total_ctes = 0 (COUNT linhas onde nro_cte > 0) AND cap.simulado = false
 *   3) Apenas Transferência: tp_carregamento = 'T' (lido de [dominio]_carregamento_capacidade.tp_carregamento, com fallback por destino)
 * - Finalização automática:
 *   - SSW0125(PER) retorna f11 (saída). Se existe saída para a placa e o carregamento está aberto, finaliza no Presto.
 * - Alimentação de "zerados":
 *   - Usa manifestos retornados pelo PER (f17) e consulta SSW0125(CTRCS_MAN) para obter CTRCs do manifesto.
 *
 * Execução via crontab (exemplo):
 *   0 * * * * php /var/www/html/src/atualiza_carregamentos.php >> /var/www/html/tmp/atualiza_carregamentos.log 2>&1
 *
 * Argumentos:
 *   $argv[1] (opcional) = DOMINIO (ex.: RVE). Se omitido, roda em todos os domínios ativos.
 *   $argv[2] (opcional) = UNIDADE (ex.: SSA). Se omitido, roda em todas as unidades encontradas no universo.
 * ================================================================
 */
require_once '/var/www/html/lib/presto.php';
require_once '/var/www/html/lib/ssw.php';

function echo_hr() {
    echo "================================================================\n";
}

function isoDate(?DateTime $dt): string {
    return $dt ? $dt->format('Y-m-d') : '';
}

function dmyDate(?DateTime $dt): string {
    return $dt ? $dt->format('dmy') : '';
}

function clampDmyRange(DateTime $ini, DateTime $fim): array {
    $today = new DateTime(date('Y-m-d'));
    if ($fim->getTimestamp() > $today->getTimestamp()) $fim = $today;
    if ($fim->getTimestamp() < $ini->getTimestamp()) $fim = clone $ini;
    return [$ini, $fim];
}

function extract_xml_fragment(string $html): ?string {
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

function parse_dt_br(string $s): ?DateTime {
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

function parse_date_br(?string $v): ?string {
    $s = trim((string)$v);
    if ($s === '') return null;
    $dt = DateTime::createFromFormat('d/m/y', $s);
    if ($dt !== false) return $dt->format('Y-m-d');
    $dt = DateTime::createFromFormat('d/m/Y', $s);
    if ($dt !== false) return $dt->format('Y-m-d');
    return null;
}

function to_float($v): float {
    $s = trim((string)$v);
    if ($s === '') return 0.0;
    $s = preg_replace('/[^\d,\.\-]/', '', $s);
    if ($s === '' || $s === '-') return 0.0;
    if (strpos($s, ',') !== false) {
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
    } else if (strpos($s, '.') !== false && preg_match('/^\-?\d{1,3}(\.\d{3})+$/', $s) && !preg_match('/^\-?0\.\d+$/', $s)) {
        $s = str_replace('.', '', $s);
    }
    $n = (float)$s;
    return is_finite($n) ? $n : 0.0;
}

function pg_table_exists($conn, string $tableName): bool {
    $t = strtolower(trim($tableName));
    if ($t === '') return false;
    $res = @pg_query_params($conn, "SELECT to_regclass($1) AS reg", [$t]);
    if (!$res || @pg_num_rows($res) === 0) return false;
    $val = @pg_fetch_result($res, 0, 0);
    return ($val !== null && $val !== '');
}

function pg_cte_col_exists($conn, string $tblCte, string $col): bool {
    $c = strtolower(trim($col));
    if ($c === '') return false;
    $res = @pg_query_params(
        $conn,
        "SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = lower($1)
           AND column_name = $2
         LIMIT 1",
        [strtolower($tblCte), $c]
    );
    return ($res && @pg_num_rows($res) > 0);
}

function ssw_per_por_periodo(string $dominio, string $unidade, DateTime $ini, DateTime $fim): array {
    $ddIni = dmyDate($ini);
    $ddFim = dmyDate($fim);
    $url = "https://sistema.ssw.inf.br/bin/ssw0125?act=PER&t_sigla_origem=" . rawurlencode($unidade) .
        "&t_data_saida_ini=" . rawurlencode($ddIni) .
        "&t_data_saida_fin=" . rawurlencode($ddFim);

    $html = '';
    try {
        $html = ssw_go($url);
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Falha ao consultar SSW0125 (PER).'];
    }

    $xmlStr = extract_xml_fragment($html);
    if ($xmlStr === null) return ['success' => false, 'message' => 'SSW0125 (PER): retorno sem XML.'];
    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) return ['success' => false, 'message' => 'SSW0125 (PER): XML inválido.'];

    $placaParaInfo = [];
    $rows = $xml->xpath('//r');
    if ($rows && count($rows) > 0) {
        foreach ($rows as $r) {
            $f3 = strtoupper(trim((string)($r->f3 ?? '')));
            $f2 = strtoupper(trim((string)($r->f2 ?? '')));
            $placa = $f3 !== '' ? $f3 : $f2;
            if ($placa === '') continue;

            $f11 = trim((string)($r->f11 ?? ''));
            if ($f11 === '') continue;
            $dt = parse_dt_br($f11);
            if ($dt === null) continue;

            $f8Raw = trim((string)($r->f8 ?? ''));
            $f8Num = (int)preg_replace('/[^\d]/', '', $f8Raw);
            $f17 = trim((string)($r->f17 ?? ''));
            $seqMan = (string)preg_replace('/[^\d]/', '', $f17);

            if (!isset($placaParaInfo[$placa])) {
                $placaParaInfo[$placa] = ['saida' => $dt, 'qtd' => 0, 'manifestos' => []];
            }
            if ($dt->getTimestamp() < $placaParaInfo[$placa]['saida']->getTimestamp()) $placaParaInfo[$placa]['saida'] = $dt;
            if ($f8Num > 0) $placaParaInfo[$placa]['qtd'] += $f8Num;
            if ($seqMan !== '') $placaParaInfo[$placa]['manifestos'][$seqMan] = true;
        }
    }
    return ['success' => true, 'placas' => $placaParaInfo];
}

function ssw_ctr_cs_man(string $seqMan): array {
    $seqMan = trim((string)$seqMan);
    if ($seqMan === '') return ['success' => false, 'pairs' => [], 'cteXml' => []];
    $url = "https://sistema.ssw.inf.br/bin/ssw0125?act=CTRCS_MAN&seq_manifesto=" . rawurlencode($seqMan);
    $html = '';
    try {
        $html = ssw_go($url);
    } catch (Exception $e) {
        return ['success' => false, 'pairs' => [], 'cteXml' => []];
    }

    $xmlStr = extract_xml_fragment($html);
    if ($xmlStr === null) return ['success' => false, 'pairs' => [], 'cteXml' => []];
    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) return ['success' => false, 'pairs' => [], 'cteXml' => []];
    $rows = $xml->xpath('//r');
    if (!$rows || count($rows) === 0) return ['success' => true, 'pairs' => [], 'cteXml' => []];

    $pairs = [];
    $cteXml = [];
    foreach ($rows as $rm) {
        $f0 = strtoupper(trim((string)($rm->f0 ?? '')));
        if ($f0 === '') continue;
        $f0Clean = preg_replace('/[^A-Z0-9]/', '', $f0);
        $mC = null;
        if (!preg_match('/^([A-Z0-9]{3})(\d{6})/', $f0Clean, $mC)) continue;
        $ser = strtoupper((string)$mC[1]);
        $nro = (int)$mC[2];
        if ($ser === '' || $nro <= 0) continue;
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
                'data_emissao' => parse_date_br((string)($rm->f2 ?? '')),
                'data_prev_ent' => parse_date_br((string)($rm->f12 ?? '')),
                'vlr_merc' => to_float((string)($rm->f9 ?? '')),
                'vlr_frete' => to_float((string)($rm->f10 ?? '')),
                'peso' => to_float((string)($rm->f8 ?? '')),
                'cubagem' => 0.0,
                'qtde_vol' => (int)preg_replace('/[^\d]/', '', (string)($rm->f7 ?? '')),
            ];
        }
    }
    return ['success' => true, 'pairs' => $pairs, 'cteXml' => $cteXml];
}

function carregar_ctes_db($conn, string $domain, array $pairs): array {
    $tblCte = "{$domain}_cte";
    if (!pg_table_exists($conn, $tblCte)) return [];

    $cteInfo = [];
    $colDest = pg_cte_col_exists($conn, $tblCte, 'sigla_dest');
    $colCidade = pg_cte_col_exists($conn, $tblCte, 'seq_cidade_dest');
    $colEmit = pg_cte_col_exists($conn, $tblCte, 'nome_emit');
    $colDestinat = pg_cte_col_exists($conn, $tblCte, 'nome_dest');
    $colPag = pg_cte_col_exists($conn, $tblCte, 'nome_pag');
    $colEmissao = pg_cte_col_exists($conn, $tblCte, 'data_emissao');
    $colPrev = pg_cte_col_exists($conn, $tblCte, 'data_prev_ent');
    $colMerc = pg_cte_col_exists($conn, $tblCte, 'vlr_merc');
    $colFrete = pg_cte_col_exists($conn, $tblCte, 'vlr_frete');
    $colPesoReal = pg_cte_col_exists($conn, $tblCte, 'peso_real');
    $colPesoCalc = pg_cte_col_exists($conn, $tblCte, 'peso_calc');
    $colCub = pg_cte_col_exists($conn, $tblCte, 'cubagem');
    $colVol = pg_cte_col_exists($conn, $tblCte, 'qtde_vol');

    $selDest = $colDest ? "UPPER(BTRIM(cte.sigla_dest))" : "''";
    $joinCidade = $colCidade ? "LEFT JOIN cidade cid_dest ON cte.seq_cidade_dest = cid_dest.seq_cidade" : "";
    $selCidade = $colCidade ? "COALESCE(cid_dest.nome, '')" : "''";
    $selRemet = $colEmit ? "COALESCE(cte.nome_emit, '')" : "''";
    $selDestinatario = $colDestinat ? "COALESCE(cte.nome_dest, '')" : "''";
    $selPagador = $colPag ? "COALESCE(cte.nome_pag, '')" : "''";
    $selEmissao = $colEmissao ? "cte.data_emissao::date" : "NULL::date";
    $selPrev = $colPrev ? "cte.data_prev_ent::date" : "NULL::date";
    $selMerc = $colMerc ? "COALESCE(cte.vlr_merc, 0)" : "0";
    $selFrete = $colFrete ? "COALESCE(cte.vlr_frete, 0)" : "0";
    $selPeso = $colPesoReal ? "COALESCE(cte.peso_real, 0)" : ($colPesoCalc ? "COALESCE(cte.peso_calc, 0)" : "0");
    $selCub = $colCub ? "COALESCE(cte.cubagem, 0)" : "0";
    $selVol = $colVol ? "COALESCE(cte.qtde_vol, 0)" : "0";

    $pairsArr = array_values($pairs);
    foreach (array_chunk($pairsArr, 400) as $chunk) {
        $params = [];
        $vals = [];
        $p = 1;
        foreach ($chunk as $it) {
            $vals[] = "($" . $p . ", $" . ($p + 1) . ")";
            $params[] = (string)$it['ser'];
            $params[] = (int)$it['nro'];
            $p += 2;
        }
        if (count($vals) === 0) continue;
        $q = "
            WITH req(ser_cte, nro_cte) AS (VALUES " . implode(',', $vals) . ")
            SELECT
                req.ser_cte,
                req.nro_cte,
                {$selDest} AS destino_cte,
                {$selCidade} AS cidade_destino,
                {$selRemet} AS remetente,
                {$selDestinatario} AS destinatario,
                {$selPagador} AS pagador,
                {$selEmissao} AS data_emissao,
                {$selPrev} AS data_prev_ent,
                {$selMerc} AS vlr_merc,
                {$selFrete} AS vlr_frete,
                {$selPeso} AS peso,
                {$selCub} AS cubagem,
                {$selVol} AS qtde_vol
            FROM req
            JOIN {$tblCte} cte
              ON regexp_replace(upper(cte.ser_cte::text), '[^A-Z0-9]', '', 'g') = req.ser_cte
             AND CAST(NULLIF(regexp_replace(cte.nro_cte::text, '[^0-9]', '', 'g'), '') AS INT) = req.nro_cte
             AND NOT (
                   UPPER(BTRIM(COALESCE(cte.tp_documento::text, ''))) = 'PRES SERVICO'
               AND regexp_replace(upper(cte.ser_cte::text), '[^A-Z0-9]', '', 'g') = '999'
             )
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
    return $cteInfo;
}

function restore_zerado($conn, string $domain, string $unidade, string $login, array $car, array $manifestos, DateTime $dtSaida): array {
    $tabela = "{$domain}_carregamento";
    $seqCarreg = (int)($car['seq_carregamento'] ?? 0);
    $placa = strtoupper(trim((string)($car['placa'] ?? $car['placa_provisoria'] ?? '')));
    if ($seqCarreg <= 0 || $placa === '') return ['success' => false, 'added' => 0, 'message' => 'Carregamento inválido.'];

    $isRve = strtoupper($domain) === 'RVE';
    $pairs = [];
    $cteXml = [];
    $manifestosOk = 0;
    foreach ($manifestos as $seqMan) {
        $r = ssw_ctr_cs_man($seqMan);
        if (!$r['success']) continue;
        $manifestosOk++;
        $p = is_array($r['pairs']) ? $r['pairs'] : [];
        $x = is_array($r['cteXml']) ? $r['cteXml'] : [];
        foreach ($p as $k => $it) {
            $ser = strtoupper(trim((string)($it['ser'] ?? '')));
            if ($isRve && $ser === 'SAS') continue;
            $pairs[$k] = $it;
        }
        foreach ($x as $k => $it) {
            $ser = strtoupper(trim((string)($it['ser_cte'] ?? '')));
            if ($isRve && $ser === 'SAS') continue;
            if (!isset($cteXml[$k])) $cteXml[$k] = $it;
        }
    }

    if (count($pairs) === 0) {
        return ['success' => true, 'added' => 0, 'message' => 'Nenhum CT-e encontrado nos manifestos.', 'debug' => ['manifestos_ok' => $manifestosOk]];
    }

    $cteInfo = carregar_ctes_db($conn, $domain, $pairs);

    $cteAll = $cteXml;
    foreach ($cteInfo as $k => $rowC) {
        $cteAll[$k] = [
            'ser_cte' => (string)($rowC['ser_cte'] ?? ''),
            'nro_cte' => (int)($rowC['nro_cte'] ?? 0),
            'destino_cte' => (string)($rowC['destino_cte'] ?? ($cteXml[$k]['destino_cte'] ?? '')),
            'cidade_destino' => (string)($rowC['cidade_destino'] ?? ($cteXml[$k]['cidade_destino'] ?? '')),
            'remetente' => (string)($rowC['remetente'] ?? ($cteXml[$k]['remetente'] ?? '')),
            'destinatario' => (string)($rowC['destinatario'] ?? ($cteXml[$k]['destinatario'] ?? '')),
            'pagador' => (string)($rowC['pagador'] ?? ''),
            'data_emissao' => (string)($rowC['data_emissao'] ?? ($cteXml[$k]['data_emissao'] ?? '')),
            'data_prev_ent' => (string)($rowC['data_prev_ent'] ?? ($cteXml[$k]['data_prev_ent'] ?? '')),
            'vlr_merc' => to_float($rowC['vlr_merc'] ?? ($cteXml[$k]['vlr_merc'] ?? 0)),
            'vlr_frete' => to_float($rowC['vlr_frete'] ?? ($cteXml[$k]['vlr_frete'] ?? 0)),
            'peso' => to_float($rowC['peso'] ?? ($cteXml[$k]['peso'] ?? 0)),
            'cubagem' => to_float($rowC['cubagem'] ?? 0),
            'qtde_vol' => (int)($rowC['qtde_vol'] ?? ($cteXml[$k]['qtde_vol'] ?? 0)),
        ];
    }

    $dataSaida = $dtSaida->format('Y-m-d');
    $horaSaida = $dtSaida->format('H:i:s');

    $destinoCarreg = (string)($car['destino'] ?? '');
    $unidadesCarreg = (string)($car['unidades'] ?? '');
    $setoresEntregaCarreg = (string)($car['setores_entrega'] ?? '');
    $origemCriacao = strtoupper(trim((string)($car['origem_criacao'] ?? '')));
    if ($origemCriacao === '') $origemCriacao = 'SSW';

    @pg_query($conn, 'BEGIN');
    $added = 0;
    try {
        foreach ($cteAll as $rowC) {
            $ser = strtoupper(trim((string)($rowC['ser_cte'] ?? '')));
            $nro = (int)($rowC['nro_cte'] ?? 0);
            if ($ser === '' || $nro <= 0) continue;
            if ($isRve && $ser === 'SAS') continue;

            $resChk = @pg_query_params(
                $conn,
                "SELECT 1
                 FROM {$tabela}
                 WHERE unidade = $1
                   AND seq_carregamento = $2
                   AND UPPER(BTRIM(ser_cte)) = $3
                   AND nro_cte = $4
                 LIMIT 1",
                [$unidade, $seqCarreg, $ser, $nro]
            );
            if ($resChk && @pg_num_rows($resChk) > 0) continue;

            $destCte = strtoupper(trim((string)($rowC['destino_cte'] ?? '')));
            $emissaoVal = trim((string)($rowC['data_emissao'] ?? ''));
            $prevVal = trim((string)($rowC['data_prev_ent'] ?? ''));
            $emissaoSql = $emissaoVal !== '' ? ("'" . pg_escape_string($conn, $emissaoVal) . "'::date") : 'NULL';
            $prevSql = $prevVal !== '' ? ("'" . pg_escape_string($conn, $prevVal) . "'::date") : 'NULL';

            $vlrMerc = to_float($rowC['vlr_merc'] ?? 0);
            $vlrFrete = to_float($rowC['vlr_frete'] ?? 0);
            $peso = to_float($rowC['peso'] ?? 0);
            $cub = to_float($rowC['cubagem'] ?? 0);
            $vol = (int)($rowC['qtde_vol'] ?? 0);

            $remetente = pg_escape_string($conn, (string)($rowC['remetente'] ?? ''));
            $destinatario = pg_escape_string($conn, (string)($rowC['destinatario'] ?? ''));
            $pagador = pg_escape_string($conn, (string)($rowC['pagador'] ?? ''));
            $cidadeDest = pg_escape_string($conn, (string)($rowC['cidade_destino'] ?? ''));

            $qIns = "
                INSERT INTO {$tabela}
                (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                 ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                 remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                 vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                 destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento,
                 data_finalizacao, hora_finalizacao, login_finalizacao)
                VALUES
                ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
                 '" . pg_escape_string($conn, $ser) . "', {$nro}, '" . pg_escape_string($conn, $destCte) . "', {$emissaoSql}, {$prevSql},
                 '{$remetente}', '{$destinatario}', '{$pagador}', '{$cidadeDest}',
                 {$vlrMerc}, {$vlrFrete}, {$peso}, {$cub}, {$vol},
                 '" . pg_escape_string($conn, strtoupper(trim((string)$destinoCarreg))) . "', '" . pg_escape_string($conn, strtoupper(trim((string)$unidadesCarreg))) . "', '" . pg_escape_string($conn, (string)$setoresEntregaCarreg) . "', NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "',
                 '{$dataSaida}'::date, '{$horaSaida}'::time, '" . pg_escape_string($conn, $login) . "')
            ";
            $resIns = @pg_query($conn, $qIns);
            if (!$resIns) throw new Exception('insert');
            $added++;
        }

        if ($added > 0) {
            @pg_query_params(
                $conn,
                "DELETE FROM {$tabela}
                 WHERE unidade = $1
                   AND seq_carregamento = $2
                   AND COALESCE(nro_cte, 0) = 0",
                [$unidade, $seqCarreg]
            );
        }
        @pg_query($conn, 'COMMIT');
    } catch (Exception $e) {
        @pg_query($conn, 'ROLLBACK');
        return ['success' => false, 'added' => 0, 'message' => 'Falha ao inserir CT-es no carregamento.'];
    }

    return ['success' => true, 'added' => $added, 'debug' => ['manifestos_ok' => $manifestosOk]];
}

$dominioFiltro = strtoupper(trim((string)($argv[1] ?? '')));
$unidadeFiltro = strtoupper(trim((string)($argv[2] ?? '')));

echo_hr();
echo "ATUALIZAÇÃO DE CARREGAMENTOS (TRANSFERÊNCIA) - SISTEMA PRESTO\n";
echo_hr();
echo "Data/Hora: " . date('d/m/Y H:i:s') . "\n";
echo "Domínio:   " . ($dominioFiltro !== '' ? $dominioFiltro : 'TODOS') . "\n";
echo "Unidade:   " . ($unidadeFiltro !== '' ? $unidadeFiltro : 'TODAS') . "\n";
echo_hr();
echo "\n";

$g_sql = connect();
if (!$g_sql) {
    echo "❌ ERRO: não foi possível conectar no PostgreSQL.\n";
    exit(1);
}

$qDomains = "SELECT domain FROM domains WHERE domain NOT IN ('XXX','EVI') AND is_active = true";
if ($dominioFiltro !== '') $qDomains .= " AND domain = '" . pg_escape_string($g_sql, $dominioFiltro) . "'";
$resDomains = sql($g_sql, $qDomains);
if (!$resDomains) {
    echo "❌ ERRO: falha ao ler tabela domains.\n";
    exit(1);
}

$loginScript = 'sistema';

while ($rowD = pg_fetch_array($resDomains)) {
    $domain = strtoupper(trim((string)($rowD['domain'] ?? '')));
    if ($domain === '') continue;

    echo_hr();
    echo "DOMÍNIO {$domain}\n";
    echo_hr();

    $tblCar = "{$domain}_carregamento";
    $tblCap = "{$domain}_carregamento_capacidade";

    if (!pg_table_exists($g_sql, $tblCar) || !pg_table_exists($g_sql, $tblCap)) {
        echo "⚠️  Tabelas não encontradas ({$tblCar} / {$tblCap}). Pulando.\n\n";
        continue;
    }

    try {
        ssw_login($domain);
    } catch (Exception $e) {
        echo "❌ Falha ao autenticar no SSW. Pulando domínio.\n\n";
        continue;
    }

    $qUniv = "
        WITH g AS (
            SELECT
                t.unidade,
                UPPER(t.placa_provisoria) AS placa,
                t.seq_carregamento,
                MIN((t.data_inclusao::timestamp + t.hora_inclusao::time)) AS dt_inclusao,
                MAX(t.data_finalizacao) AS data_finalizacao,
                MAX(t.hora_finalizacao) AS hora_finalizacao,
                MAX(t.login_finalizacao) AS login_finalizacao,
                MAX(COALESCE(t.destino, '')) AS destino,
                MAX(COALESCE(t.unidades, '')) AS unidades,
                MAX(COALESCE(t.setores_entrega, '')) AS setores_entrega,
                MAX(COALESCE(t.origem_criacao, '')) AS origem_criacao,
                COUNT(*) FILTER (WHERE COALESCE(t.nro_cte, 0) > 0) AS total_ctes
            FROM {$tblCar} t
            WHERE UPPER(COALESCE(t.placa_provisoria, '')) <> ''
            " . ($unidadeFiltro !== '' ? (" AND UPPER(t.unidade) = '" . pg_escape_string($g_sql, $unidadeFiltro) . "'") : "") . "
            GROUP BY t.unidade, UPPER(t.placa_provisoria), t.seq_carregamento
        )
        SELECT
            g.*,
            COALESCE(cap.simulado, FALSE) AS simulado,
            COALESCE(
                cap.tp_carregamento,
                (CASE WHEN EXISTS (
                    SELECT 1 FROM {$tblCar} x
                    WHERE x.unidade = g.unidade
                      AND x.seq_carregamento IS NOT DISTINCT FROM g.seq_carregamento
                      AND TRIM(COALESCE(x.destino, '')) <> ''
                ) THEN 'T' ELSE 'E' END)
            ) AS tp_carregamento
        FROM g
        LEFT JOIN {$tblCap} cap
               ON cap.unidade = g.unidade
              AND cap.seq_carregamento IS NOT DISTINCT FROM g.seq_carregamento
        WHERE COALESCE(cap.simulado, FALSE) = FALSE
          AND COALESCE(
                cap.tp_carregamento,
                (CASE WHEN EXISTS (
                    SELECT 1 FROM {$tblCar} x
                    WHERE x.unidade = g.unidade
                      AND x.seq_carregamento IS NOT DISTINCT FROM g.seq_carregamento
                      AND TRIM(COALESCE(x.destino, '')) <> ''
                ) THEN 'T' ELSE 'E' END)
          ) = 'T'
          AND (g.data_finalizacao IS NULL OR g.total_ctes = 0)
        ORDER BY g.unidade, g.dt_inclusao
    ";

    $resUniv = @pg_query($g_sql, $qUniv);
    if (!$resUniv) {
        echo "❌ ERRO: falha ao montar universo de carregamentos.\n\n";
        continue;
    }

    $porUnidade = [];
    while ($r = pg_fetch_assoc($resUniv)) {
        $u = strtoupper(trim((string)($r['unidade'] ?? '')));
        if ($u === '') continue;
        if (!isset($porUnidade[$u])) $porUnidade[$u] = [];
        $porUnidade[$u][] = $r;
    }

    if (count($porUnidade) === 0) {
        echo "✅ Nenhum carregamento para processar (transferência) neste domínio.\n\n";
        continue;
    }

    $conjuntoPorPlaca = [];
    try {
        $qConj = "
            SELECT
                (SELECT placa_provisoria FROM {$tblCar} c1 WHERE c1.unidade = cap.unidade AND c1.seq_carregamento = cap.seq_carregamento LIMIT 1) AS placa1,
                (SELECT placa_provisoria FROM {$tblCar} c2 WHERE c2.unidade = cap.unidade AND c2.seq_carregamento = cap.seq_carregamento_conjunto LIMIT 1) AS placa2
            FROM {$tblCap} cap
            WHERE COALESCE(cap.seq_carregamento_conjunto, 0) > 0
        ";
        $resConj = @pg_query($g_sql, $qConj);
        while ($resConj && ($rc = pg_fetch_assoc($resConj))) {
            $p1 = strtoupper(trim((string)($rc['placa1'] ?? '')));
            $p2 = strtoupper(trim((string)($rc['placa2'] ?? '')));
            if ($p1 === '' || $p2 === '' || $p1 === $p2) continue;
            $conjuntoPorPlaca[$p1] = [$p1, $p2];
            $conjuntoPorPlaca[$p2] = [$p1, $p2];
        }
    } catch (Exception $e) {
        $conjuntoPorPlaca = [];
    }

    $dtMinGlobal = null;
    $dtMaxGlobal = null;
    foreach ($porUnidade as $u => $items) {
        foreach ($items as $it) {
            $dtInclRaw = trim((string)($it['dt_inclusao'] ?? ''));
            if ($dtInclRaw === '') continue;
            $dtIncl = null;
            try { $dtIncl = new DateTime($dtInclRaw); } catch (Exception $e) { $dtIncl = null; }
            if (!$dtIncl) continue;
            if ($dtMinGlobal === null || $dtIncl->getTimestamp() < $dtMinGlobal->getTimestamp()) $dtMinGlobal = $dtIncl;
            if ($dtMaxGlobal === null || $dtIncl->getTimestamp() > $dtMaxGlobal->getTimestamp()) $dtMaxGlobal = $dtIncl;
        }
    }

    if ($dtMinGlobal === null || $dtMaxGlobal === null) {
        echo "⚠️  Não foi possível determinar período por data de inclusão.\n\n";
        continue;
    }

    $fimGlobal = clone $dtMaxGlobal;
    $fimGlobal->modify('+2 days');
    [$dtMinGlobal, $fimGlobal] = clampDmyRange($dtMinGlobal, $fimGlobal);

    $unidadePer = $unidadeFiltro !== '' ? $unidadeFiltro : '';
    echo "📅 Período SSW0125(PER): " . $dtMinGlobal->format('d/m/Y') . " → " . $fimGlobal->format('d/m/Y') . "\n";

    $placaParaInfoGlobal = [];
    $erroPer = '';
    $chunkIni = clone $dtMinGlobal;
    $chunkIni->setTime(0, 0, 0);
    $dtFim = clone $fimGlobal;
    $dtFim->setTime(0, 0, 0);
    $iPer = 0;

    while ($chunkIni->getTimestamp() <= $dtFim->getTimestamp()) {
        $chunkFim = clone $chunkIni;
        $chunkFim->modify('+30 days');
        if ($chunkFim->getTimestamp() > $dtFim->getTimestamp()) $chunkFim = clone $dtFim;

        $iPer++;
        echo "   - PER {$iPer}: " . $chunkIni->format('d/m/Y') . " → " . $chunkFim->format('d/m/Y') . "\n";

        $per = ssw_per_por_periodo($domain, $unidadePer, $chunkIni, $chunkFim);
        if (!$per['success']) {
            $erroPer = (string)($per['message'] ?? 'Falha ao consultar SSW0125 (PER).');
            break;
        }

        $placasChunk = is_array($per['placas'] ?? null) ? $per['placas'] : [];
        foreach ($placasChunk as $placa => $info) {
            $placa = strtoupper(trim((string)$placa));
            if ($placa === '') continue;

            if (!isset($placaParaInfoGlobal[$placa])) {
                $placaParaInfoGlobal[$placa] = ['saida' => null, 'qtd' => 0, 'manifestos' => []];
            }

            $dtSaida = $info['saida'] ?? null;
            if ($dtSaida instanceof DateTime) {
                $cur = $placaParaInfoGlobal[$placa]['saida'] ?? null;
                if (!($cur instanceof DateTime) || $dtSaida->getTimestamp() < $cur->getTimestamp()) {
                    $placaParaInfoGlobal[$placa]['saida'] = $dtSaida;
                }
            }

            $placaParaInfoGlobal[$placa]['qtd'] += (int)($info['qtd'] ?? 0);
            $mans = $info['manifestos'] ?? null;
            if (is_array($mans)) {
                foreach ($mans as $seqMan => $_) {
                    $seqMan = (string)$seqMan;
                    if ($seqMan === '') continue;
                    $placaParaInfoGlobal[$placa]['manifestos'][$seqMan] = true;
                }
            }
        }

        $chunkIni = clone $chunkFim;
        $chunkIni->modify('+1 day');
        $chunkIni->setTime(0, 0, 0);
    }

    if ($erroPer !== '') {
        echo "❌ {$erroPer}\n\n";
        continue;
    }
    echo "\n";

    foreach ($porUnidade as $unidade => $items) {
        echo "🔎 Unidade {$unidade}:\n";
        $abertos = [];
        $zerados = [];

        foreach ($items as $it) {
            $placa = strtoupper(trim((string)($it['placa'] ?? '')));
            $seq = (int)($it['seq_carregamento'] ?? 0);
            $total = (int)($it['total_ctes'] ?? 0);
            $dataFinal = trim((string)($it['data_finalizacao'] ?? ''));

            if ($dataFinal === '') $abertos[$placa] = true;
            if ($total <= 0) $zerados[] = $it;
        }

        $cntAbertos = count($abertos);
        $cntZerados = count($zerados);
        echo "   - Abertos: {$cntAbertos}\n";
        echo "   - Zerados: {$cntZerados}\n";
        $placaParaInfo = $placaParaInfoGlobal;

        $finalizados = 0;
        foreach ($abertos as $placa => $_) {
            if (!isset($placaParaInfo[$placa])) continue;
            $info = $placaParaInfo[$placa];
            $dtSaida = $info['saida'] ?? null;
            if (!($dtSaida instanceof DateTime)) continue;

            $placasFinalizar = isset($conjuntoPorPlaca[$placa]) ? $conjuntoPorPlaca[$placa] : [$placa];
            foreach ($placasFinalizar as $pf) {
                $pf = strtoupper(trim((string)$pf));
                if ($pf === '') continue;
                $data = $dtSaida->format('Y-m-d');
                $hora = $dtSaida->format('H:i:s');
                $qUpd = "
                    UPDATE {$tblCar} t
                    SET data_finalizacao = '{$data}'::date,
                        hora_finalizacao = '{$hora}'::time,
                        login_finalizacao = '" . pg_escape_string($g_sql, $loginScript) . "'
                    WHERE t.unidade = '" . pg_escape_string($g_sql, $unidade) . "'
                      AND UPPER(t.placa_provisoria) = '" . pg_escape_string($g_sql, $pf) . "'
                      AND t.data_finalizacao IS NULL
                      AND COALESCE(
                            (SELECT cap.tp_carregamento
                             FROM {$tblCap} cap
                             WHERE cap.unidade = t.unidade
                               AND cap.seq_carregamento IS NOT DISTINCT FROM t.seq_carregamento
                             LIMIT 1),
                            (CASE WHEN EXISTS (
                                SELECT 1 FROM {$tblCar} x
                                WHERE x.unidade = t.unidade
                                  AND x.seq_carregamento IS NOT DISTINCT FROM t.seq_carregamento
                                  AND TRIM(COALESCE(x.destino, '')) <> ''
                            ) THEN 'T' ELSE 'E' END)
                      ) = 'T'
                ";
                $resUpd = @pg_query($g_sql, $qUpd);
                if ($resUpd) $finalizados += (int)pg_affected_rows($resUpd);
            }
        }
        echo "   ✅ Finalizados: {$finalizados}\n";

        $restoredTotal = 0;
        foreach ($zerados as $car) {
            $placa = strtoupper(trim((string)($car['placa'] ?? '')));
            $seq = (int)($car['seq_carregamento'] ?? 0);
            if ($placa === '' || $seq <= 0) continue;
            if (!isset($placaParaInfo[$placa])) continue;

            $info = $placaParaInfo[$placa];
            $dtSaida = $info['saida'] ?? null;
            if (!($dtSaida instanceof DateTime)) continue;

            $manifestos = isset($info['manifestos']) && is_array($info['manifestos']) ? array_keys($info['manifestos']) : [];
            if (count($manifestos) === 0) continue;

            $res = restore_zerado($g_sql, $domain, $unidade, $loginScript, $car, $manifestos, $dtSaida);
            if ($res['success'] && (int)($res['added'] ?? 0) > 0) {
                $restoredTotal += (int)$res['added'];
                echo "   📦 Restore: {$placa} (seq {$seq}) +{$res['added']} CT-es\n";
            }
        }
        echo "   ✅ CT-es restaurados (total linhas): {$restoredTotal}\n\n";
    }
}

echo_hr();
echo "FIM\n";
echo_hr();
