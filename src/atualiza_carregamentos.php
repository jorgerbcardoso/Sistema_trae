<?php
/**
 * ================================================================
 * SCRIPT: ATUALIZAÇÃO DE CARREGAMENTOS (TRANSFERÊNCIA) - SISTEMA PRESTO
 * ================================================================
 * Objetivo (somente Transferência):
 * - Sincronizar carregamentos recentes, abertos ou finalizados, com saídas do SSW0125.
 * - Agrupar por placa e data/hora de saída (f11), importar os CT-es dos manifestos do grupo
 *   e atualizar a finalização do carregamento com o horário da saída.
 *
 * Importante:
 * - Reprocessa todas as cargas abertas e as finalizadas nos últimos 7 dias.
 * - O período do SSW0125 (PER) é calculado por unidade, usando a inclusão mais antiga e
 *   a mais recente do universo da unidade (mais 2 dias, limitado a hoje).
 *
 * Regra de escopo:
 * - Vale apenas para carregamentos de Transferência (tp_carregamento = 'T')
 * - Ignora simulações (cap.simulado = true)
 *
 * - Regras:
 *   - Apenas transferências não simuladas.
 *   - A placa Presto pode corresponder a f2 ou f3 no PER.
 *   - Registros com a mesma placa e f11 formam um agrupamento de manifestos.
 *   - O identificador dos manifestos é lido de f18; f17 é o status da linha.
 *   - A associação dos agrupamentos às cargas respeita a cronologia de saída.
 *   - No domínio RVE a placa Presto é fictícia e combina apenas os 4 últimos
 *     caracteres com a placa real do veículo; cargas com o mesmo sufixo são
 *     combinadas no mesmo cenário de saída.
 *   - Agrupamentos da PER (placa + saída f11) dos últimos 2 dias que não possuem
 *     carregamento correspondente no Presto são criados a partir dos manifestos
 *     (f18). Nunca cria carga sem CT-es.
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

function normalizar_placa_sync_carregamento(string $placa): string {
    return strtoupper((string)preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($placa))));
}

/**
 * Chave de casamento entre a placa do carregamento Presto e a placa do ssw0125.
 * No domínio RVE a placa Presto é fictícia (prefixo = destino) e apenas os 4
 * últimos caracteres coincidem com a placa real do veículo.
 */
function chave_match_sync_carregamento(string $placa, string $dominio): string {
    $limpa = normalizar_placa_sync_carregamento($placa);
    if ($limpa === '') return '';
    if (strtoupper($dominio) === 'RVE' && preg_match('/^[A-Z0-9]{3}[A-Z0-9]{4}$/', $limpa)) {
        return substr($limpa, 3, 4);
    }
    return $limpa;
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

    $viagensPorPlaca = [];
    $rows = $xml->xpath('//r');
    if ($rows && count($rows) > 0) {
        foreach ($rows as $r) {
            $status = strtoupper(trim(strip_tags((string)($r->f17 ?? ''))));
            if (strpos($status, 'CANCELADO') !== false) continue;

            $f3 = strtoupper(trim((string)($r->f3 ?? '')));
            $f2 = strtoupper(trim((string)($r->f2 ?? '')));
            // Placas reais exatamente como vêm do ssw0125 (para gravar na criação).
            $placasReais = array_values(array_unique(array_filter([
                normalizar_placa_sync_carregamento($f2),
                normalizar_placa_sync_carregamento($f3),
            ])));
            // No RVE a placa real do ssw0125 casa com a placa fictícia do Presto
            // apenas pelos 4 últimos caracteres (chave de casamento).
            $placas = array_values(array_unique(array_filter([
                chave_match_sync_carregamento($f2, $dominio),
                chave_match_sync_carregamento($f3, $dominio),
            ])));
            if (count($placas) === 0) continue;

            $f11 = trim((string)($r->f11 ?? ''));
            if ($f11 === '') continue;
            $dt = parse_dt_br($f11);
            if ($dt === null) continue;

            $f8Raw = trim((string)($r->f8 ?? ''));
            $f8Num = (int)preg_replace('/[^\d]/', '', $f8Raw);
            $seqManRaw = trim((string)($r->f18 ?? ''));
            $seqMan = preg_match('/^\d+$/', $seqManRaw) ? $seqManRaw : '';
            $ts = $dt->getTimestamp();

            foreach ($placas as $placa) {
                if (!isset($viagensPorPlaca[$placa][$ts])) {
                    $viagensPorPlaca[$placa][$ts] = [
                        'saida' => $dt,
                        'qtd' => 0,
                        'manifestos' => [],
                        'placas' => [],
                    ];
                }
                foreach ($placasReais as $pr) {
                    if ($pr !== '') $viagensPorPlaca[$placa][$ts]['placas'][$pr] = true;
                }
                if ($f8Num > 0) $viagensPorPlaca[$placa][$ts]['qtd'] += $f8Num;
                if ($seqMan !== '') $viagensPorPlaca[$placa][$ts]['manifestos'][$seqMan] = true;
            }
        }
    }

    foreach ($viagensPorPlaca as &$viagens) {
        ksort($viagens, SORT_NUMERIC);
    }
    unset($viagens);

    return ['success' => true, 'placas' => $viagensPorPlaca];
}

function ssw_viagem_para_carregamento(array $viagens, DateTime $dtInclusao, array $viagensUtilizadas = []): ?array {
    $candidatas = [];
    $limiteInferior = $dtInclusao->getTimestamp() - (5 * 60);
    foreach ($viagens as $ts => $viagem) {
        if (isset($viagensUtilizadas[(string)$ts])) continue;
        $saida = $viagem['saida'] ?? null;
        if (!($saida instanceof DateTime) || $saida->getTimestamp() < $limiteInferior) continue;
        $candidatas[] = $viagem;
    }
    if (count($candidatas) === 0) return null;

    usort($candidatas, function($a, $b) {
        $aDt = $a['saida'] instanceof DateTime ? $a['saida']->getTimestamp() : PHP_INT_MAX;
        $bDt = $b['saida'] instanceof DateTime ? $b['saida']->getTimestamp() : PHP_INT_MAX;
        return $aDt <=> $bDt;
    });
    return $candidatas[0];
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

function restore_zerado($conn, string $domain, string $unidade, string $login, array $car, array $manifestos, DateTime $dtSaida, ?DateTime $dtInclusao = null): array {
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

    // Data/hora de inclusão dos CT-es restaurados.
    // REGRA CRÍTICA: a inclusão de um carregamento é o seu INÍCIO (primeira
    // leitura/bipagem — ssw0194), e corresponde ao MIN(data_inclusao) das suas
    // linhas. Para um carregamento JÁ EXISTENTE essa data nunca pode mudar, por
    // isso os CT-es restaurados herdam o MIN(data_inclusao) já gravado na carga
    // (mesma regra do importador oficial). Somente numa carga nova (sem linhas)
    // usa-se a data/hora da saída. Nunca se usa CURRENT_DATE para sobrescrever.
    $anchorInc = null;
    $resAnchor = @pg_query_params(
        $conn,
        "SELECT MIN((data_inclusao::timestamp + hora_inclusao::time)) AS anchor
         FROM {$tabela}
         WHERE unidade = $1 AND seq_carregamento = $2",
        [$unidade, $seqCarreg]
    );
    if ($resAnchor && pg_num_rows($resAnchor) > 0) {
        $anchorVal = pg_fetch_result($resAnchor, 0, 0);
        if ($anchorVal !== null && $anchorVal !== '') {
            try { $anchorInc = new DateTime((string)$anchorVal); } catch (Exception $e) { $anchorInc = null; }
        }
    }

    $dataIncSql = 'CURRENT_DATE';
    $horaIncSql = 'CURRENT_TIME';
    if ($anchorInc instanceof DateTime) {
        $dataIncSql = "'" . $anchorInc->format('Y-m-d') . "'::date";
        $horaIncSql = "'" . $anchorInc->format('H:i:s') . "'::time";
    } elseif ($dtInclusao instanceof DateTime) {
        $dataIncSql = "'" . $dtInclusao->format('Y-m-d') . "'::date";
        $horaIncSql = "'" . $dtInclusao->format('H:i:s') . "'::time";
    }

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
                ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', {$dataIncSql}, {$horaIncSql},
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

/**
 * Cria um carregamento novo no Presto a partir de um agrupamento (placa + saída)
 * do ssw0125 que não possui carregamento correspondente: gera o seq, cria o
 * cabeçalho em _carregamento_capacidade e insere os CT-es dos manifestos.
 * Se os manifestos não tiverem CT-es, desfaz o cabeçalho (não cria carga vazia).
 */
function criar_carregamento_ssw($conn, string $domain, string $unidade, string $login, string $placa, string $seqName, array $manifestos, DateTime $dtSaida): array {
    $tabela = "{$domain}_carregamento";
    $tabelaCap = "{$domain}_carregamento_capacidade";
    $placa = strtoupper(trim($placa));
    if ($placa === '' || count($manifestos) === 0) {
        return ['success' => false, 'added' => 0, 'message' => 'Dados insuficientes para criar o carregamento.'];
    }

    @pg_query($conn, "CREATE SEQUENCE IF NOT EXISTS {$seqName}");
    $resSeq = @pg_query($conn, "SELECT nextval('" . pg_escape_string($conn, $seqName) . "') AS seq");
    if (!$resSeq || pg_num_rows($resSeq) === 0) {
        return ['success' => false, 'added' => 0, 'message' => 'Falha ao gerar seq_carregamento.'];
    }
    $seq = (int)pg_fetch_result($resSeq, 0, 0);
    if ($seq <= 0) return ['success' => false, 'added' => 0, 'message' => 'seq_carregamento inválido.'];

    $resCap = @pg_query_params(
        $conn,
        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, nro_linha, tp_carregamento, simulado)
         VALUES ($1, $2, $3, 0, 'T', FALSE)
         ON CONFLICT (unidade, seq_carregamento) DO NOTHING",
        [$unidade, $seq, $placa]
    );
    if (!$resCap) {
        return ['success' => false, 'added' => 0, 'message' => 'Falha ao criar o cabeçalho do carregamento.'];
    }
    // Se nada foi inserido, o seq já existia em outra carga: abortar para não
    // misturar CT-es de um carregamento existente.
    if (pg_affected_rows($resCap) <= 0) {
        return ['success' => false, 'added' => 0, 'seq' => $seq, 'message' => 'seq_carregamento já existente; criação abortada.'];
    }

    $car = [
        'seq_carregamento' => $seq,
        'placa' => $placa,
        'placa_provisoria' => $placa,
        'destino' => '',
        'unidades' => '',
        'setores_entrega' => '',
        'origem_criacao' => 'SSW',
    ];
    $res = restore_zerado($conn, $domain, $unidade, $login, $car, $manifestos, $dtSaida, $dtSaida);
    if (!$res['success'] || (int)($res['added'] ?? 0) <= 0) {
        @pg_query_params($conn, "DELETE FROM {$tabelaCap} WHERE unidade = $1 AND seq_carregamento = $2", [$unidade, $seq]);
        @pg_query_params($conn, "DELETE FROM {$tabela} WHERE unidade = $1 AND seq_carregamento = $2", [$unidade, $seq]);
        return ['success' => false, 'added' => 0, 'seq' => $seq, 'message' => 'Nenhum CT-e novo nos manifestos; carregamento não criado.'];
    }

    // Preenche destino/unidades a partir dos CT-es inseridos e localiza a linha.
    try {
        $destinos = [];
        $resDest = @pg_query_params(
            $conn,
            "SELECT DISTINCT UPPER(BTRIM(destino_cte)) AS d
             FROM {$tabela}
             WHERE unidade = $1 AND seq_carregamento = $2
               AND COALESCE(nro_cte, 0) > 0
               AND COALESCE(TRIM(destino_cte), '') <> ''",
            [$unidade, $seq]
        );
        while ($resDest && ($rd = pg_fetch_assoc($resDest))) {
            $d = strtoupper(trim((string)($rd['d'] ?? '')));
            if ($d !== '') $destinos[$d] = true;
        }
        $destinos = array_keys($destinos);
        sort($destinos);
        if (count($destinos) > 0) {
            $destinoCar = $destinos[0];
            $unidadesCsv = implode(',', array_slice($destinos, 1));
            @pg_query_params(
                $conn,
                "UPDATE {$tabela} SET destino = $3, unidades = $4
                 WHERE unidade = $1 AND seq_carregamento = $2",
                [$unidade, $seq, $destinoCar, $unidadesCsv]
            );

            if (count($destinos) === 1 && pg_table_exists($conn, "{$domain}_linha")) {
                $resLinha = @pg_query_params(
                    $conn,
                    "SELECT nro_linha FROM {$domain}_linha
                     WHERE UPPER(BTRIM(sigla_emit)) = $1 AND UPPER(BTRIM(sigla_dest)) = $2
                     ORDER BY nro_linha DESC LIMIT 1",
                    [$unidade, $destinoCar]
                );
                if ($resLinha && pg_num_rows($resLinha) > 0) {
                    $nroLinha = (int)pg_fetch_result($resLinha, 0, 0);
                    if ($nroLinha > 0) {
                        @pg_query_params($conn, "UPDATE {$tabelaCap} SET nro_linha = $3 WHERE unidade = $1 AND seq_carregamento = $2", [$unidade, $seq, $nroLinha]);
                    }
                }
            }
        }
    } catch (Exception $e) {
        // best-effort: o carregamento já existe com os CT-es inseridos
    }

    return ['success' => true, 'added' => (int)$res['added'], 'seq' => $seq];
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
          AND (
                g.data_finalizacao IS NULL
                OR g.dt_inclusao::date >= CURRENT_DATE - INTERVAL '7 days'
          )
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
    $conjuntoPorSeq = [];
    try {
        $qConj = "
            SELECT
                cap.unidade AS unidade,
                cap.seq_carregamento AS seq1,
                cap.seq_carregamento_conjunto AS seq2,
                (SELECT placa_provisoria FROM {$tblCar} c1 WHERE c1.unidade = cap.unidade AND c1.seq_carregamento = cap.seq_carregamento LIMIT 1) AS placa1,
                (SELECT placa_provisoria FROM {$tblCar} c2 WHERE c2.unidade = cap.unidade AND c2.seq_carregamento = cap.seq_carregamento_conjunto LIMIT 1) AS placa2
            FROM {$tblCap} cap
            WHERE COALESCE(cap.seq_carregamento_conjunto, 0) > 0
        ";
        $resConj = @pg_query($g_sql, $qConj);
        while ($resConj && ($rc = pg_fetch_assoc($resConj))) {
            $seq1 = (int)($rc['seq1'] ?? 0);
            $seq2 = (int)($rc['seq2'] ?? 0);
            $p1 = strtoupper(trim((string)($rc['placa1'] ?? '')));
            $p2 = strtoupper(trim((string)($rc['placa2'] ?? '')));
            if ($p1 === '' || $p2 === '' || $p1 === $p2) continue;
            $conjuntoPorPlaca[$p1] = [$p1, $p2];
            $conjuntoPorPlaca[$p2] = [$p1, $p2];
            if ($seq1 > 0 && $seq2 > 0 && $seq1 !== $seq2) {
                $conjuntoPorSeq[$seq1] = $seq2;
                $conjuntoPorSeq[$seq2] = $seq1;
            }
        }
    } catch (Exception $e) {
        $conjuntoPorPlaca = [];
        $conjuntoPorSeq = [];
    }

    foreach ($porUnidade as $unidade => $items) {
        echo "🔎 Unidade {$unidade}:\n";
        $cargas = [];
        $cntAbertos = 0;
        $cntZerados = 0;

        foreach ($items as $it) {
            $placa = normalizar_placa_sync_carregamento((string)($it['placa'] ?? ''));
            $seq = (int)($it['seq_carregamento'] ?? 0);
            $total = (int)($it['total_ctes'] ?? 0);
            $dataFinal = trim((string)($it['data_finalizacao'] ?? ''));
            $dtInclRaw = trim((string)($it['dt_inclusao'] ?? ''));
            $dtIncl = null;
            try { $dtIncl = $dtInclRaw !== '' ? new DateTime($dtInclRaw) : null; } catch (Exception $e) { $dtIncl = null; }

            if ($dataFinal === '') $cntAbertos++;
            if ($total <= 0) $cntZerados++;
            if ($seq <= 0 || $placa === '' || !($dtIncl instanceof DateTime)) continue;

            $it['_placa_normalizada'] = $placa;
            $it['_chave_match'] = chave_match_sync_carregamento((string)($it['placa'] ?? ''), $domain);
            $it['_dt_inclusao'] = $dtIncl;
            $cargas[] = $it;
        }

        echo "   - Abertos: {$cntAbertos}\n";
        echo "   - Zerados: {$cntZerados}\n";
        echo "   - Carregamentos para sincronizar: " . count($cargas) . "\n";
        usort($cargas, function($a, $b) {
            return $a['_dt_inclusao']->getTimestamp() <=> $b['_dt_inclusao']->getTimestamp();
        });

        $dtMinUnidade = null;
        $dtMaxUnidade = null;
        foreach ($items as $it) {
            $dtInclRaw = trim((string)($it['dt_inclusao'] ?? ''));
            if ($dtInclRaw === '') continue;
            try { $dtIncl = new DateTime($dtInclRaw); } catch (Exception $e) { $dtIncl = null; }
            if (!$dtIncl) continue;
            if ($dtMinUnidade === null || $dtIncl->getTimestamp() < $dtMinUnidade->getTimestamp()) $dtMinUnidade = $dtIncl;
            if ($dtMaxUnidade === null || $dtIncl->getTimestamp() > $dtMaxUnidade->getTimestamp()) $dtMaxUnidade = $dtIncl;
        }
        if ($dtMinUnidade === null || $dtMaxUnidade === null) {
            echo "   ⚠️  Não foi possível determinar o período de inclusão.\n\n";
            continue;
        }

        $fimUnidade = clone $dtMaxUnidade;
        $fimUnidade->modify('+2 days');
        [$dtMinUnidade, $fimUnidade] = clampDmyRange($dtMinUnidade, $fimUnidade);
        echo "   📅 SSW0125(PER) {$unidade}: " . $dtMinUnidade->format('d/m/Y') . " → " . $fimUnidade->format('d/m/Y') . "\n";

        $placaParaInfo = [];
        $erroPer = '';
        $chunkIni = clone $dtMinUnidade;
        $chunkIni->setTime(0, 0, 0);
        $dtFim = clone $fimUnidade;
        $dtFim->setTime(0, 0, 0);
        $iPer = 0;
        while ($chunkIni->getTimestamp() <= $dtFim->getTimestamp()) {
            $chunkFim = clone $chunkIni;
            $chunkFim->modify('+30 days');
            if ($chunkFim->getTimestamp() > $dtFim->getTimestamp()) $chunkFim = clone $dtFim;

            $iPer++;
            echo "      - PER {$iPer}: " . $chunkIni->format('d/m/Y') . " → " . $chunkFim->format('d/m/Y') . "\n";
            $per = ssw_per_por_periodo($domain, $unidade, $chunkIni, $chunkFim);
            if (!$per['success']) {
                $erroPer = (string)($per['message'] ?? 'Falha ao consultar SSW0125 (PER).');
                break;
            }

            foreach (($per['placas'] ?? []) as $placa => $viagens) {
                $placa = strtoupper(trim((string)$placa));
                if ($placa === '' || !is_array($viagens)) continue;
                if (!isset($placaParaInfo[$placa])) $placaParaInfo[$placa] = [];
                foreach ($viagens as $ts => $viagem) {
                    $ts = (int)$ts;
                    if ($ts <= 0) continue;
                    if (!isset($placaParaInfo[$placa][$ts])) {
                        $placaParaInfo[$placa][$ts] = $viagem;
                        continue;
                    }
                    $placaParaInfo[$placa][$ts]['qtd'] += (int)($viagem['qtd'] ?? 0);
                    foreach (($viagem['manifestos'] ?? []) as $seqMan => $_) {
                        $placaParaInfo[$placa][$ts]['manifestos'][(string)$seqMan] = true;
                    }
                    foreach (($viagem['placas'] ?? []) as $pr => $_) {
                        $placaParaInfo[$placa][$ts]['placas'][(string)$pr] = true;
                    }
                }
            }

            $chunkIni = clone $chunkFim;
            $chunkIni->modify('+1 day');
            $chunkIni->setTime(0, 0, 0);
        }
        if ($erroPer !== '') {
            echo "   ❌ {$erroPer}; nenhuma atualização será feita para esta unidade.\n\n";
            continue;
        }
        echo "   - Placas no PER: " . count($placaParaInfo) . "\n";

        $isRve = strtoupper($domain) === 'RVE';
        $viagensUtilizadasPorChave = [];
        $finalizacoesAtualizadas = 0;
        $restoredTotal = 0;
        $semSaidaCorrespondente = 0;
        $semManifesto = 0;
        $criadosTotal = 0;

        // No RVE, cargas com o mesmo sufixo (4 últimos caracteres) referenciam o
        // mesmo veículo e são combinadas no mesmo cenário de saída. Nos demais
        // domínios cada carga é processada individualmente (uma saída por carga).
        $grupos = [];
        foreach ($cargas as $idx => $car) {
            $chave = (string)($car['_chave_match'] ?? '');
            if ($chave === '') continue;
            $grupoKey = $isRve ? $chave : ($chave . '#' . $idx);
            $grupos[$grupoKey][] = $car;
        }

        foreach ($grupos as $grupoCargas) {
            $chave = (string)($grupoCargas[0]['_chave_match'] ?? '');
            if ($chave === '') continue;

            $viagens = $placaParaInfo[$chave] ?? [];
            if (count($viagens) === 0) {
                $semSaidaCorrespondente += count($grupoCargas);
                $placaLog = (string)($grupoCargas[0]['_placa_normalizada'] ?? $chave);
                echo "   ⚠️  Sem saída PER para a chave {$chave} ({$placaLog}).\n";
                continue;
            }

            $dtIncl = null;
            foreach ($grupoCargas as $gc) {
                $dt = $gc['_dt_inclusao'] ?? null;
                if ($dt instanceof DateTime && ($dtIncl === null || $dt->getTimestamp() < $dtIncl->getTimestamp())) {
                    $dtIncl = $dt;
                }
            }
            if (!($dtIncl instanceof DateTime)) continue;

            $viagem = ssw_viagem_para_carregamento(
                $viagens,
                $dtIncl,
                $viagensUtilizadasPorChave[$chave] ?? []
            );
            $dtSaida = $viagem['saida'] ?? null;
            if (!($dtSaida instanceof DateTime)) {
                $semSaidaCorrespondente += count($grupoCargas);
                echo "   ⚠️  Sem agrupamento cronológico disponível para a chave {$chave}.\n";
                continue;
            }

            $tsSaida = $dtSaida->getTimestamp();
            $viagensUtilizadasPorChave[$chave][(string)$tsSaida] = true;
            $dataSaida = $dtSaida->format('Y-m-d');
            $horaSaida = $dtSaida->format('H:i:s');
            $saidaFmt = $dtSaida->format('d/m/Y H:i:s');

            $manifestos = isset($viagem['manifestos']) && is_array($viagem['manifestos'])
                ? array_keys($viagem['manifestos'])
                : [];

            foreach ($grupoCargas as $car) {
                $placa = (string)($car['_placa_normalizada'] ?? '');
                $seq = (int)($car['seq_carregamento'] ?? 0);
                if ($seq <= 0) continue;

                $resUpd = @pg_query_params(
                    $g_sql,
                    "UPDATE {$tblCar} t
                     SET data_finalizacao = $3::date,
                         hora_finalizacao = $4::time,
                         login_finalizacao = CASE
                             WHEN t.data_finalizacao IS NULL THEN $5
                             ELSE t.login_finalizacao
                         END
                     WHERE t.unidade = $1
                       AND t.seq_carregamento = $2
                       AND (
                           t.data_finalizacao IS DISTINCT FROM $3::date
                           OR t.hora_finalizacao IS DISTINCT FROM $4::time
                       )",
                    [$unidade, $seq, $dataSaida, $horaSaida, $loginScript]
                );
                if (!$resUpd) {
                    echo "   ❌ Falha ao atualizar finalização de {$placa} (seq {$seq}).\n";
                    continue;
                }
                $finalizacoesAtualizadas += (int)pg_affected_rows($resUpd);

                if (count($manifestos) === 0) {
                    $semManifesto++;
                    echo "   ⚠️  Saída atualizada; nenhum identificador de manifesto em f18 para {$placa} (seq {$seq}).\n";
                    continue;
                }

                $car['data_finalizacao'] = $dataSaida;
                $car['hora_finalizacao'] = $horaSaida;
                $car['login_finalizacao'] = $loginScript;
                $res = restore_zerado($g_sql, $domain, $unidade, $loginScript, $car, $manifestos, $dtSaida);
                if ($res['success'] && (int)($res['added'] ?? 0) > 0) {
                    $restoredTotal += (int)$res['added'];
                    echo "   📦 Sincronizado: {$placa} (seq {$seq}) saída {$saidaFmt} "
                        . count($manifestos) . " manifesto(s), +{$res['added']} CT-es.\n";
                } elseif ($res['success']) {
                    echo "   ✅ Sincronizado: {$placa} (seq {$seq}) saída {$saidaFmt}; "
                        . count($manifestos) . " manifesto(s), nenhum CT-e novo.\n";
                } else {
                    echo "   ❌ Falha ao sincronizar {$placa} (seq {$seq}): "
                        . (string)($res['message'] ?? 'erro não identificado') . "\n";
                }
            }
        }

        // Criação de carregamentos a partir de agrupamentos da PER sem carga
        // correspondente no Presto. Só considera saídas dos últimos 2 dias e
        // agrupamentos com CT-es nos manifestos (f18) — nunca cria carga vazia.
        $limiteCriacao = new DateTime('today');
        $limiteCriacao->modify('-2 days');
        $seqName = "{$domain}_seq_carregamento_seq";
        foreach ($placaParaInfo as $chave => $viagens) {
            if (!is_array($viagens)) continue;
            foreach ($viagens as $ts => $viagem) {
                $ts = (int)$ts;
                if ($ts <= 0) continue;
                if (isset($viagensUtilizadasPorChave[$chave][(string)$ts])) continue;
                if ($ts < $limiteCriacao->getTimestamp()) continue;

                $dtSaida = $viagem['saida'] ?? null;
                if (!($dtSaida instanceof DateTime)) continue;

                $manifestos = isset($viagem['manifestos']) && is_array($viagem['manifestos'])
                    ? array_keys($viagem['manifestos'])
                    : [];
                if (count($manifestos) === 0) continue;

                $placaReal = '';
                foreach (($viagem['placas'] ?? []) as $pr => $_) {
                    $pr = strtoupper(trim((string)$pr));
                    if ($pr !== '') { $placaReal = $pr; break; }
                }
                if ($placaReal === '') $placaReal = strtoupper((string)$chave);
                if ($placaReal === '') continue;

                $dataSaidaCria = $dtSaida->format('Y-m-d');
                $horaSaidaCria = $dtSaida->format('H:i:s');

                // Idempotência: não recria se já existe carregamento para esta
                // placa (no RVE, pelo sufixo) com a mesma data/hora de finalização.
                $chaveCria = $isRve ? substr($placaReal, -4) : $placaReal;
                $condPlaca = $isRve
                    ? "RIGHT(UPPER(BTRIM(placa_provisoria)), 4) = \$1"
                    : "UPPER(BTRIM(placa_provisoria)) = \$1";
                $resJa = @pg_query_params(
                    $g_sql,
                    "SELECT 1 FROM {$tblCar}
                     WHERE unidade = \$2
                       AND {$condPlaca}
                       AND data_finalizacao = \$3::date
                       AND hora_finalizacao = \$4::time
                     LIMIT 1",
                    [$chaveCria, $unidade, $dataSaidaCria, $horaSaidaCria]
                );
                if ($resJa && pg_num_rows($resJa) > 0) {
                    $viagensUtilizadasPorChave[$chave][(string)$ts] = true;
                    continue;
                }

                $saidaFmt = $dtSaida->format('d/m/Y H:i:s');
                $resCria = criar_carregamento_ssw(
                    $g_sql, $domain, $unidade, $loginScript, $placaReal, $seqName, $manifestos, $dtSaida
                );
                if (!empty($resCria['success'])) {
                    $criadosTotal++;
                    $restoredTotal += (int)($resCria['added'] ?? 0);
                    $viagensUtilizadasPorChave[$chave][(string)$ts] = true;
                    echo "   🆕 Criado: {$placaReal} (seq " . (int)($resCria['seq'] ?? 0) . ") saída {$saidaFmt} "
                        . count($manifestos) . " manifesto(s), +" . (int)($resCria['added'] ?? 0) . " CT-es.\n";
                } else {
                    echo "   ⚠️  Não criado carregamento {$placaReal} saída {$saidaFmt}: "
                        . (string)($resCria['message'] ?? 'erro não identificado') . "\n";
                }
            }
        }

        echo "   ✅ Finalizações atualizadas: {$finalizacoesAtualizadas}\n";
        echo "   ✅ CT-es acrescentados: {$restoredTotal}\n";
        echo "   ✅ Carregamentos criados: {$criadosTotal}\n";
        echo "   ⚠️  Cargas sem saída correspondente: {$semSaidaCorrespondente}; sem manifesto f18: {$semManifesto}\n\n";
    }
}

echo_hr();
echo "FIM\n";
echo_hr();
