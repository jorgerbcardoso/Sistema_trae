<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

$currentUser = getCurrentUser();
$login       = $currentUser['username'] ?? '';

$input          = getRequestInput();
$unidadeRaw     = $input['unidade'] ?? ($currentUser['unidade_atual'] ?? ($currentUser['unidade'] ?? ''));
$unidade        = strtoupper(trim((string)$unidadeRaw));
if (preg_match('/^([A-Z0-9_]+)/', $unidade, $m)) {
    $unidade = $m[1];
}

if (empty($unidade) || !preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Unidade ou domínio inválidos.']);
}

$acao           = strtolower(trim($input['acao'] ?? ''));
$placa          = strtoupper(trim($input['placa'] ?? ''));
$unidadeDestino = strtoupper(trim($input['unidadeDestino'] ?? ''));
$paradas        = array_values(array_filter(array_map('strtoupper', array_map('trim', (array)($input['paradas'] ?? [])))));
$nroLinha       = (int)($input['nroLinha'] ?? 0);
$ctesDisponiveis = $input['ctesDisponiveis'] ?? [];   // array de objetos enviados pelo frontend
$forcarMinFreteRaw = $input['forcar_min_frete'] ?? false;
$forcarMinFrete = ($forcarMinFreteRaw === true || $forcarMinFreteRaw === 1 || $forcarMinFreteRaw === '1' || strtoupper(trim((string)$forcarMinFreteRaw)) === 'S');

$conn        = connect();
$tabela      = "{$domain}_carregamento";
$tabelaLinha = "{$domain}_linha";
$tabelaVeiculo = "{$domain}_veiculo";
$tabelaCap   = "{$domain}_carregamento_capacidade";
$tabelaUnidade = "{$domain}_unidade";

@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS origem_criacao VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS data_finalizacao DATE");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS hora_finalizacao TIME");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS login_finalizacao VARCHAR(60)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS adiado BOOLEAN DEFAULT FALSE");
@pg_query($conn, "ALTER TABLE {$tabelaLinha} ADD COLUMN IF NOT EXISTS multi_carr_diario BOOLEAN DEFAULT FALSE");
@pg_query($conn, "ALTER TABLE {$tabelaLinha} ADD COLUMN IF NOT EXISTS vlr_min_frete NUMERIC");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS simulado BOOLEAN DEFAULT FALSE");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS nro_linha INT");

$seqName = "{$domain}_seq_carregamento_seq";
@pg_query($conn, "CREATE SEQUENCE IF NOT EXISTS {$seqName}");
@pg_query($conn, "ALTER TABLE {$tabela} ALTER COLUMN seq_carregamento SET DEFAULT nextval('{$seqName}')");

function nextSeqCarregamentoAuto($conn, $seqName) {
    $seqName = trim((string)$seqName);
    if ($seqName === '') return 0;
    $res = @pg_query($conn, "SELECT nextval('" . pg_escape_string($conn, $seqName) . "') AS seq");
    if (!$res || pg_num_rows($res) === 0) return 0;
    return (int)pg_fetch_result($res, 0, 0);
}

$isDayActive = function($v): bool {
    if ($v === null) return false;
    if (is_bool($v)) return $v;
    $s = strtoupper(trim((string)$v));
    if ($s === '' || $s === '.' || $s === '0' || $s === 'F' || $s === 'FALSE' || $s === 'N' || $s === 'NAO' || $s === 'NÃO') {
        return false;
    }
    return true;
};

$unidadeTableOk = false;
$unidadeCompartColOk = false;
try {
    $resReg = sql("SELECT to_regclass($1) AS reg", [$tabelaUnidade], $conn);
    $val = $resReg ? pg_fetch_result($resReg, 0, 0) : null;
    $unidadeTableOk = ($val !== null && $val !== '');
    if ($unidadeTableOk) {
        $tUnid = strtolower($tabelaUnidade);
        $resCol = sql(
            "SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = 'unidades_compart'
             LIMIT 1",
            [$tUnid],
            $conn
        );
        $unidadeCompartColOk = ($resCol && pg_num_rows($resCol) > 0);
    }
} catch (Exception $e) {
    $unidadeTableOk = false;
    $unidadeCompartColOk = false;
}

$modoAutomatico = ($nroLinha > 0) && empty($unidadeDestino);

// ─── Listar linhas ────────────────────────────────────────────────────────────
if ($acao === 'listar_linhas') {
    try {
        $joinUnidade = ($unidadeTableOk && $unidadeCompartColOk) ? "LEFT JOIN {$tabelaUnidade} u ON UPPER(BTRIM(u.sigla)) = UPPER(BTRIM({$tabelaLinha}.sigla_dest))" : "";
        $selCentralizadora = ($unidadeTableOk && $unidadeCompartColOk)
            ? "(CASE WHEN COALESCE(u.unidades_compart, '') <> '' THEN TRUE ELSE FALSE END) AS destino_centralizadora"
            : "FALSE AS destino_centralizadora";
        $res = sql(
            "SELECT nro_linha, nome, sigla_emit, sigla_dest, unidades, km_ida, km_volta, vlr_min_frete,
                    multi_carr_diario,
                    carrega_seg, carrega_ter, carrega_qua, carrega_qui, carrega_sex, carrega_sab, carrega_dom,
                    {$selCentralizadora}
             FROM {$tabelaLinha}
             {$joinUnidade}
             WHERE UPPER(BTRIM(sigla_emit)) = \$1
             ORDER BY sigla_dest, nome, nro_linha",
            [$unidade], $conn
        );
        if (!$res) {
            respondJson([
                'success' => false,
                'message' => 'Erro ao listar linhas.',
                'details' => pg_last_error($conn),
                'domain' => $domain,
                'unidade' => $unidade,
            ]);
        }
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
                'multi_carr_diario' => ((string)($r['multi_carr_diario'] ?? '') === 't'),
                'destino_centralizadora' => ((string)($r['destino_centralizadora'] ?? '') === 't'),
                'carrega_seg' => $isDayActive($r['carrega_seg'] ?? null),
                'carrega_ter' => $isDayActive($r['carrega_ter'] ?? null),
                'carrega_qua' => $isDayActive($r['carrega_qua'] ?? null),
                'carrega_qui' => $isDayActive($r['carrega_qui'] ?? null),
                'carrega_sex' => $isDayActive($r['carrega_sex'] ?? null),
                'carrega_sab' => $isDayActive($r['carrega_sab'] ?? null),
                'carrega_dom' => $isDayActive($r['carrega_dom'] ?? null),
            ];
        }
        respondJson(['success' => true, 'linhas' => $linhas]);
    } catch (Exception $e) {
        respondJson(['success' => false, 'message' => 'Erro ao listar linhas.']);
    }
}

if ($acao === 'adiar_linha') {
    if ($nroLinha <= 0) {
        respondJson(['success' => false, 'message' => 'Linha não informada.']);
    }

    $resLinha = null;
    try {
        $resLinha = sql(
            "SELECT sigla_dest, unidades
             FROM {$tabelaLinha}
             WHERE UPPER(BTRIM(sigla_emit)) = \$1 AND nro_linha = \$2
             LIMIT 1",
            [$unidade, $nroLinha],
            $conn
        );
    } catch (Exception $e) {}

    if (!$resLinha || pg_num_rows($resLinha) === 0) {
        respondJson(['success' => false, 'message' => 'Linha não encontrada para a unidade atual.']);
    }

    $linha = pg_fetch_assoc($resLinha);
    $dest = strtoupper(trim((string)($linha['sigla_dest'] ?? '')));
    if ($dest === '') {
        respondJson(['success' => false, 'message' => 'Linha inválida: destino não informado.']);
    }

    $placaAuto = $unidade . '-' . $dest;

    $check = sql("SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 AND data_finalizacao IS NULL LIMIT 1", [$unidade, $placaAuto], $conn);
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => true, 'message' => "Carregamento {$placaAuto} já existe."]);
    }

    $seqCarreg = nextSeqCarregamentoAuto($conn, $seqName);
    if ($seqCarreg <= 0) {
        respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
    }

    $unidadesCsv = strtoupper(trim((string)($linha['unidades'] ?? '')));

    pg_query($conn, 'BEGIN');
    try {
        @pg_query($conn, "
            CREATE TABLE IF NOT EXISTS {$tabelaCap} (
                unidade          VARCHAR(10) NOT NULL,
                seq_carregamento INT NOT NULL,
                placa_provisoria VARCHAR(20) NOT NULL,
                cap_ton          NUMERIC,
                cap_m3           NUMERIC,
                vlr_frete_carreteiro NUMERIC,
                simulado         BOOLEAN DEFAULT FALSE,
                nro_linha        INT,
                PRIMARY KEY (unidade, seq_carregamento)
            )
        ");
        $nroLinhaSql = ($nroLinha > 0) ? (string)$nroLinha : 'NULL';
        @pg_query($conn,
            "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, simulado, nro_linha)
             VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placaAuto) . "', FALSE, {$nroLinhaSql})
             ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, simulado = FALSE, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha)"
        );

        $ins = sql(
            "INSERT INTO {$tabela}
             (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              ser_cte, nro_cte, destino, unidades, origem_ssw, origem_criacao, unidade_carregamento, adiado)
             VALUES
             (\$1, \$2, \$3, \$4, CURRENT_DATE, CURRENT_TIME,
              '', 0, \$5, \$6, NULL, 'MANUAL', \$7, TRUE)",
            [$unidade, $seqCarreg, $placaAuto, $login, $dest, $unidadesCsv, $unidade],
            $conn
        );
        if (!$ins) {
            throw new Exception('Erro ao criar carregamento adiado.');
        }

        pg_query($conn, 'COMMIT');
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao adiar carregamento.']);
    }

    respondJson([
        'success' => true,
        'message' => 'Carregamento adiado criado.',
        'placa' => $placaAuto,
        'nro_linha' => $nroLinha,
        'destino' => $dest,
        'paradas' => $unidadesCsv !== '' ? preg_split('/[,\s;]+/', $unidadesCsv) : [],
    ]);
}

if ($acao === 'reativar_adiado') {
    $seqInput = (int)($input['seq_carregamento'] ?? $input['seqCarregamento'] ?? 0);
    $placaInput = strtoupper(trim((string)($input['placa'] ?? '')));

    if ($seqInput <= 0 && $placaInput === '') {
        respondJson(['success' => false, 'message' => 'Informe o carregamento.']);
    }

    $seq = $seqInput;
    if ($seq <= 0) {
        $resSeq = sql(
            "SELECT seq_carregamento
             FROM {$tabela}
             WHERE unidade = \$1
               AND UPPER(placa_provisoria) = UPPER(\$2)
               AND data_finalizacao IS NULL
             ORDER BY seq_carregamento DESC
             LIMIT 1",
            [$unidade, $placaInput],
            $conn
        );
        if (!$resSeq || pg_num_rows($resSeq) === 0) {
            respondJson(['success' => false, 'message' => 'Carregamento não encontrado.']);
        }
        $seq = (int)pg_fetch_result($resSeq, 0, 0);
    }

    $resCheck = sql(
        "SELECT
            BOOL_OR(COALESCE(adiado, FALSE)) AS adiado,
            SUM(CASE WHEN COALESCE(nro_cte, 0) > 0 THEN 1 ELSE 0 END) AS qtd_ctes
         FROM {$tabela}
         WHERE unidade = \$1 AND seq_carregamento = \$2 AND data_finalizacao IS NULL",
        [$unidade, $seq],
        $conn
    );
    if (!$resCheck || pg_num_rows($resCheck) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento não encontrado.']);
    }

    $row = pg_fetch_assoc($resCheck);
    $isAdiado = ((string)($row['adiado'] ?? '') === 't');
    $qtdCtes = (int)($row['qtd_ctes'] ?? 0);
    if (!$isAdiado) {
        respondJson(['success' => false, 'message' => 'Este carregamento não está marcado como adiado.']);
    }
    if ($qtdCtes > 0) {
        respondJson(['success' => false, 'message' => 'Não é possível reativar: o carregamento já possui CT-es.']);
    }

    pg_query($conn, 'BEGIN');
    try {
        sql("DELETE FROM {$tabela} WHERE unidade = \$1 AND seq_carregamento = \$2 AND data_finalizacao IS NULL", [$unidade, $seq], $conn);
        sql("DELETE FROM {$tabelaCap} WHERE unidade = \$1 AND seq_carregamento = \$2", [$unidade, $seq], $conn);
        pg_query($conn, 'COMMIT');
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao reativar carregamento.']);
    }

    respondJson(['success' => true, 'message' => 'Carregamento reativado.']);
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

function getCtesJaUsadosEmCarregamentos($conn, $tabela, $unidade) {
    $unidade = strtoupper(trim((string)$unidade));
    $set = [];
    try {
        $res = sql(
            "SELECT ser_cte, nro_cte
             FROM {$tabela}
             WHERE unidade = \$1
               AND data_finalizacao IS NULL
               AND (nro_cte::text ~ '^[0-9]+$' AND (nro_cte::text)::int > 0)",
            [$unidade],
            $conn
        );
        while ($res && ($r = pg_fetch_assoc($res))) {
            $ser = strtoupper(trim((string)($r['ser_cte'] ?? '')));
            $nro = (int)($r['nro_cte'] ?? 0);
            if ($ser === '' || $nro <= 0) continue;
            $set[$ser . '|' . $nro] = true;
        }
    } catch (Exception $e) {}
    return $set;
}

function getIntermediariasJaUsadas($conn, $tabela, $unidade) {
    $unidade = strtoupper(trim((string)$unidade));
    $usadas = [];
    $set = [];
    try {
        $resDest = sql(
            "SELECT DISTINCT destino
             FROM {$tabela}
             WHERE unidade = \$1
               AND data_finalizacao IS NULL
               AND destino IS NOT NULL
               AND TRIM(destino) <> ''",
            [$unidade],
            $conn
        );
        while ($resDest && ($r = pg_fetch_assoc($resDest))) {
            $d = strtoupper(trim((string)($r['destino'] ?? '')));
            if ($d === '') continue;
            $set[$d] = true;
        }

        $res = sql(
            "SELECT DISTINCT unidades
             FROM {$tabela}
             WHERE unidade = \$1
               AND data_finalizacao IS NULL
               AND unidades IS NOT NULL
               AND TRIM(unidades) <> ''",
            [$unidade],
            $conn
        );
        while ($res && ($r = pg_fetch_assoc($res))) {
            $csv = strtoupper(trim((string)($r['unidades'] ?? '')));
            if ($csv === '') continue;
            $arr = array_values(array_filter(array_map('trim', explode(',', $csv)), function($p) { return $p !== ''; }));
            foreach ($arr as $u) {
                $u = strtoupper(trim((string)$u));
                if ($u === '') continue;
                $set[$u] = true;
            }
        }
    } catch (Exception $e) {}
    foreach ($set as $k => $_) $usadas[] = $k;
    return $usadas;
}

function getOcupacaoPorUnidade($conn, $tabela, $tabelaCap, $unidade) {
    $unidade = strtoupper(trim((string)$unidade));
    $map = [];
    try {
        $res = sql(
            "SELECT c.placa_provisoria, c.destino, c.unidades
             FROM {$tabela} c
             LEFT JOIN {$tabelaCap} cap
                    ON cap.unidade = c.unidade AND cap.seq_carregamento = c.seq_carregamento
             WHERE c.unidade = \$1
               AND c.data_finalizacao IS NULL
               AND COALESCE(cap.simulado, FALSE) = FALSE",
            [$unidade],
            $conn
        );
        while ($res && ($r = pg_fetch_assoc($res))) {
            $placa = strtoupper(trim((string)($r['placa_provisoria'] ?? '')));
            if ($placa === '') continue;

            $dest = strtoupper(trim((string)($r['destino'] ?? '')));
            if ($dest !== '') {
                if (!isset($map[$dest])) $map[$dest] = [];
                $k = 'DESTINO|' . $placa;
                $map[$dest][$k] = ['placa' => $placa, 'tipo' => 'DESTINO'];
            }

            $csv = strtoupper(trim((string)($r['unidades'] ?? '')));
            if ($csv !== '') {
                $arr = array_values(array_filter(array_map('trim', explode(',', $csv)), function($p) { return $p !== ''; }));
                foreach ($arr as $u) {
                    $u = strtoupper(trim((string)$u));
                    if ($u === '') continue;
                    if (!isset($map[$u])) $map[$u] = [];
                    $k = 'INTERMEDIARIA|' . $placa;
                    if (!isset($map[$u][$k])) $map[$u][$k] = ['placa' => $placa, 'tipo' => 'INTERMEDIARIA'];
                }
            }
        }
    } catch (Exception $e) {}
    return $map;
}

function calcularTotaisPorDestino($ctesDisponiveis, $unidadeOrigem) {
    $unidadeOrigem = strtoupper(trim((string)$unidadeOrigem));
    $totals = [];
    foreach ((array)$ctesDisponiveis as $cte) {
        $unidRel019 = strtoupper(trim((string)($cte['unidadeCarregamento'] ?? $cte['unidade_carregamento'] ?? $cte['unidadeRelatorio'] ?? '')));
        if ($unidRel019 === '' || $unidRel019 !== $unidadeOrigem) continue;
        if (!empty($cte['emTransito'])) continue;

        $unidDest = strtoupper(trim((string)($cte['unidadeDest'] ?? $cte['destinoCte'] ?? $cte['destino_cte'] ?? $cte['destino'] ?? '')));
        if ($unidDest === '' || $unidDest === '0') continue;

        $domainUpper = '';
        if (isset($GLOBALS['domain'])) $domainUpper = strtoupper(trim((string)$GLOBALS['domain']));
        if ($domainUpper === 'RVE') {
            if (in_array($unidDest, ['SAL', 'DK4', 'TNE', 'DEV'], true)) continue;
            if ($unidadeOrigem === 'SAO' && $unidDest === 'CAM') continue;
            if ($unidadeOrigem === 'CAM' && $unidDest === 'SAO') continue;
        }

        if (!isset($totals[$unidDest])) $totals[$unidDest] = ['pesoKg' => 0.0, 'cubagem' => 0.0, 'frete' => 0.0];
        $totals[$unidDest]['pesoKg'] += (float)parseNumero($cte['peso'] ?? 0);
        $totals[$unidDest]['cubagem'] += (float)parseNumero($cte['cubagem'] ?? 0);
        $totals[$unidDest]['frete'] += (float)parseNumero($cte['frete'] ?? 0);
    }
    return $totals;
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
             WHERE unidade = \$1 AND placa_provisoria = \$2 AND nro_cte > 0 AND data_finalizacao IS NULL
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
function filtrarCtesPorCapacidade($ctesDisponiveis, $unidadeOrigem, $destinoFinal, $intermediarias, $limitePesoKg, $limiteVolM3, &$meta = null) {
    $unidadeOrigem = strtoupper(trim((string)$unidadeOrigem));
    $destinoFinal  = strtoupper(trim((string)$destinoFinal));
    $intermediarias = array_values(array_filter(array_map(function($u) {
        return strtoupper(trim((string)$u));
    }, (array)$intermediarias)));

    $ctesOcupados = [];
    if (isset($GLOBALS['ctesOcupados']) && is_array($GLOBALS['ctesOcupados'])) {
        $ctesOcupados = $GLOBALS['ctesOcupados'];
    }

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
    $totPeso = 0.0;
    $totVol  = 0.0;
    $totFrete = 0.0;
    foreach ($ctesDisponiveis as $cte) {
        $nroCte = (int)($cte['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        $unidRel019 = strtoupper(trim((string)($cte['unidadeCarregamento'] ?? $cte['unidade_carregamento'] ?? $cte['unidadeRelatorio'] ?? '')));
        if ($unidRel019 === '' || $unidRel019 !== $unidadeOrigem) continue;

        $unidDest = strtoupper(trim((string)($cte['unidadeDest'] ?? $cte['destinoCte'] ?? $cte['destino_cte'] ?? $cte['destino'] ?? '')));
        if ($unidDest === '' || !isset($idxDestino[$unidDest])) continue;

        $serCte = strtoupper(trim((string)($cte['serCte'] ?? $cte['ser_cte'] ?? '')));
        if ($serCte !== '') {
            $kUsed = $serCte . '|' . $nroCte;
            if (isset($ctesOcupados[$kUsed])) continue;
        }

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
    $somaFrete    = 0.0;
    $skippedByCap = 0;

    foreach ($filtrados as $cte) {
        $peso = parseNumero($cte['peso']    ?? 0);
        $cub  = parseNumero($cte['cubagem'] ?? 0);
        $frete = parseNumero($cte['frete'] ?? 0);

        $totPeso += $peso;
        $totVol  += $cub;
        $totFrete += $frete;

        if ($somaPeso + $peso > $limitePesoKg || $somaVol + $cub > $limiteVolM3) { $skippedByCap++; continue; }

        $somaPeso += $peso;
        $somaVol  += $cub;
        $somaFrete += $frete;
        $selecionados[] = $cte;
    }

    $qtdTotal = count($filtrados);
    $qtdSel = count($selecionados);
    $qtdSobra = max(0, $qtdTotal - $qtdSel);

    $meta = [
        'limite_peso_kg' => (float)$limitePesoKg,
        'limite_vol_m3'  => (float)$limiteVolM3,
        'usado_peso_kg'  => (float)$somaPeso,
        'usado_vol_m3'   => (float)$somaVol,
        'usado_frete'    => (float)$somaFrete,
        'total_peso_kg'  => (float)$totPeso,
        'total_vol_m3'   => (float)$totVol,
        'total_frete'    => (float)$totFrete,
        'qtd_total'      => (int)$qtdTotal,
        'qtd_sel'        => (int)$qtdSel,
        'qtd_sobra'      => (int)$qtdSobra,
        'peso_sobra_kg'  => max(0.0, (float)$totPeso - (float)$somaPeso),
        'vol_sobra_m3'   => max(0.0, (float)$totVol - (float)$somaVol),
        'frete_sobra'    => max(0.0, (float)$totFrete - (float)$somaFrete),
        'skipped_by_cap' => (int)$skippedByCap,
        'tem_sobra'      => ($qtdSobra > 0),
    ];

    return $selecionados;
}

/**
 * Insere CT-es na tabela de carregamento com destino e unidades em cada linha.
 */
function inserirCtes($conn, $tabela, $unidade, $placa, $login, $destino, $unidades, $ctesSelecionados, $nroLinha, $seqCarregamento) {
    $inseridos = 0;
    $nroLinhaSql = ((int)$nroLinha > 0) ? (int)$nroLinha : null;
    $seqCarregamento = (int)$seqCarregamento;
    if ($seqCarregamento <= 0) return -1;
    foreach ($ctesSelecionados as $cteData) {
        $nroCte = (int)($cteData['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        $serCteRaw = strtoupper(trim((string)($cteData['serCte'] ?? $cteData['ser_cte'] ?? '')));
        if ($serCteRaw === '') continue;
        $serCte = pg_escape_string($conn, $serCteRaw);

        // Evita duplicata (mesmo carregamento)
        $check = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND data_finalizacao IS NULL
               AND ser_cte = '{$serCte}'
               AND nro_cte = {$nroCte}
             LIMIT 1"
        );
        if ($check && pg_num_rows($check) > 0) continue;

        // Garante que o mesmo CT-e não esteja em outro carregamento
        $checkOutro = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND data_finalizacao IS NULL
               AND ser_cte = '{$serCte}'
               AND nro_cte = {$nroCte}
               AND placa_provisoria <> '" . pg_escape_string($conn, $placa) . "'
             LIMIT 1"
        );
        if ($checkOutro && pg_num_rows($checkOutro) > 0) continue;

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
             (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
              remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
              vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
              destino, unidades, origem_ssw, origem_criacao, unidade_carregamento)
             VALUES
             ('" . pg_escape_string($conn, $unidade) . "', {$seqCarregamento}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
              '{$serCte}', {$nroCte}, '{$destCte}', {$emissaoSql}, {$prevEntSql},
              '{$remet}', '{$destin}', '{$pagad}', '{$cidade}',
              {$vlrMerc}, {$vlrFrete}, {$peso}, {$cubagem}, {$qtdeVol},
              '{$destEsc}', '{$unidEsc}', NULL, 'AUTO', '{$unidCar}')"
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
        $joinUnidade = ($unidadeTableOk && $unidadeCompartColOk) ? "LEFT JOIN {$tabelaUnidade} u ON UPPER(BTRIM(u.sigla)) = UPPER(BTRIM({$tabelaLinha}.sigla_dest))" : "";
        $selCentralizadora = ($unidadeTableOk && $unidadeCompartColOk)
            ? "(CASE WHEN COALESCE(u.unidades_compart, '') <> '' THEN TRUE ELSE FALSE END) AS destino_centralizadora"
            : "FALSE AS destino_centralizadora";
            $resLinha = sql(
                "SELECT sigla_dest, unidades, vlr_min_frete,
                        carrega_seg, carrega_ter, carrega_qua, carrega_qui, carrega_sex, carrega_sab, carrega_dom,
                        {$selCentralizadora}
                 FROM {$tabelaLinha}
                 {$joinUnidade}
                 WHERE UPPER(BTRIM(sigla_emit)) = \$1 AND nro_linha = \$2
                 LIMIT 1",
                [$unidade, $nroLinha], $conn
            );
        } catch (Exception $e) {}

    if (!$resLinha || pg_num_rows($resLinha) === 0) {
        respondJson(['success' => false, 'message' => 'Linha não encontrada para a unidade atual.']);
    }

    $linha    = pg_fetch_assoc($resLinha);
    $dest     = strtoupper(trim($linha['sigla_dest'] ?? ''));
    $destinoCentralizadora = ((string)($linha['destino_centralizadora'] ?? '') === 't');
    if ($dest === '') {
        respondJson(['success' => false, 'message' => 'Linha inválida: destino não informado.']);
    }

    $placaAuto            = !empty($placa) ? $placa : ($unidade . '-' . $dest);
    $minFreteLinha        = ($linha['vlr_min_frete'] !== null && $linha['vlr_min_frete'] !== '') ? (float)$linha['vlr_min_frete'] : 0.0;

    $diaSemana = (int)date('w');
    $diaKeyByW = [
        0 => 'carrega_dom',
        1 => 'carrega_seg',
        2 => 'carrega_ter',
        3 => 'carrega_qua',
        4 => 'carrega_qui',
        5 => 'carrega_sex',
        6 => 'carrega_sab',
    ];
    $diaKey = $diaKeyByW[$diaSemana] ?? 'carrega_seg';
    $carregaHoje = ((string)($linha[$diaKey] ?? '') === 't');
    $ontemW = ($diaSemana + 6) % 7;
    $diaKeyOntem = $diaKeyByW[$ontemW] ?? 'carrega_seg';
    $carregaOntem = ((string)($linha[$diaKeyOntem] ?? '') === 't');
    if (!$carregaHoje && !$carregaOntem) {
        respondJson(['success' => false, 'message' => 'Esta linha não está configurada para carregar hoje.']);
    }

    $check = sql("SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 AND data_finalizacao IS NULL LIMIT 1", [$unidade, $placaAuto], $conn);
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => true, 'message' => "Carregamento {$placaAuto} já existe.", 'resultados' => [['placa' => $placaAuto, 'status' => 'ignorado', 'msg' => 'Carregamento já existe.']]]);
    }

    if (empty($ctesDisponiveis)) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível enviado pelo painel. Recarregue os dados e tente novamente.']);
    }

    $GLOBALS['ctesOcupados'] = getCtesJaUsadosEmCarregamentos($conn, $tabela, $unidade);

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

    $paradasLinhaBase = array_values(array_filter(array_map('strtoupper', array_map('trim', preg_split('/[,\s;]+/', (string)($linha['unidades'] ?? ''))))));

    if ($destinoCentralizadora) {
        $paradasLinha = array_values(array_unique(array_values(array_filter($paradasLinhaBase, function($u) use ($dest) {
            $u = strtoupper(trim((string)$u));
            if ($u === '') return false;
            if ($u === $dest) return false;
            return true;
        }))));
    } else {
        $usadasArr = getIntermediariasJaUsadas($conn, $tabela, $unidade);
        $usadasSet = [];
        foreach ($usadasArr as $u) $usadasSet[$u] = true;

        $paradasLinha = array_values(array_filter($paradasLinhaBase, function($u) use ($usadasSet, $dest) {
            $u = strtoupper(trim((string)$u));
            if ($u === '') return false;
            if ($u === $dest) return false;
            if (isset($usadasSet[$u])) return false;
            return true;
        }));
        $paradasLinha = array_values(array_unique($paradasLinha));

        $totaisPorDestino = calcularTotaisPorDestino($ctesDisponiveis, $unidade);
        usort($paradasLinha, function($a, $b) use ($totaisPorDestino) {
            $pa = (float)($totaisPorDestino[$a]['pesoKg'] ?? 0);
            $pb = (float)($totaisPorDestino[$b]['pesoKg'] ?? 0);
            if ($pa === $pb) return strcmp($a, $b);
            return ($pb <=> $pa);
        });
        $paradasLinha = array_slice($paradasLinha, 0, 2);
    }
    $paradasCsv = implode(',', $paradasLinha);

    $temIntermediarias = count($paradasLinha) > 0;
    if ($temIntermediarias) {
        $resDireta = null;
        try {
            $resDireta = sql(
                "SELECT carrega_seg, carrega_ter, carrega_qua, carrega_qui, carrega_sex, carrega_sab, carrega_dom
                 FROM {$tabelaLinha}
                 WHERE sigla_emit = \$1
                   AND sigla_dest = \$2
                   AND COALESCE(TRIM(unidades), '') = ''
                 LIMIT 1",
                [$unidade, $dest], $conn
            );
        } catch (Exception $e) {}

        $diretaCarregaHoje = false;
        if ($resDireta && pg_num_rows($resDireta) > 0) {
            $rowDireta = pg_fetch_assoc($resDireta);
            $diretaCarregaHoje = ((string)($rowDireta[$diaKey] ?? '') === 't');
        }

        if ($diretaCarregaHoje) {
            $pesoKg = 0.0;
            $cubM3  = 0.0;
            foreach ($ctesDisponiveis as $cte) {
                $unidRel019 = strtoupper(trim((string)($cte['unidadeCarregamento'] ?? $cte['unidade_carregamento'] ?? $cte['unidadeRelatorio'] ?? '')));
                if ($unidRel019 === '' || $unidRel019 !== $unidade) continue;

                if (!empty($cte['emTransito'])) continue;

                $unidDest = strtoupper(trim((string)($cte['unidadeDest'] ?? $cte['destinoCte'] ?? $cte['destino_cte'] ?? $cte['destino'] ?? '')));
                if ($unidDest === '' || $unidDest !== $dest) continue;

                $domainUpper = '';
                if (isset($GLOBALS['domain'])) $domainUpper = strtoupper(trim((string)$GLOBALS['domain']));
                if ($domainUpper === 'RVE') {
                    if (in_array($unidDest, ['SAL', 'DK4', 'TNE', 'DEV'], true)) continue;
                    if ($unidade === 'SAO' && $unidDest === 'CAM') continue;
                    if ($unidade === 'CAM' && $unidDest === 'SAO') continue;
                }

                $pesoKg += (float)parseNumero($cte['peso'] ?? 0);
                $cubM3  += (float)parseNumero($cte['cubagem'] ?? 0);
            }

            $ton = $pesoKg / 1000.0;
            if ($ton >= 27.0 || $cubM3 >= 67.0) {
                respondJson(['success' => false, 'message' => 'Linha direta já atinge a capacidade mínima (67m³ / 27t) para o destino final.']);
            }
        }
    }

    if ($minFreteLinha > 0) {
        $rota = array_values(array_filter(array_unique(array_merge([$dest], $paradasLinha))));
        $rotaIdx = array_flip($rota);
        $freteAtual = 0.0;
        foreach ($ctesDisponiveis as $cte) {
            $unidRel019 = strtoupper(trim((string)($cte['unidadeCarregamento'] ?? $cte['unidade_carregamento'] ?? $cte['unidadeRelatorio'] ?? '')));
            if ($unidRel019 === '' || $unidRel019 !== $unidade) continue;

            if (!empty($cte['emTransito'])) continue;

            $unidDest = strtoupper(trim((string)($cte['unidadeDest'] ?? $cte['destinoCte'] ?? $cte['destino_cte'] ?? $cte['destino'] ?? '')));
            if ($unidDest === '' || !isset($rotaIdx[$unidDest])) continue;

            $domainUpper = '';
            if (isset($GLOBALS['domain'])) $domainUpper = strtoupper(trim((string)$GLOBALS['domain']));
            if ($domainUpper === 'RVE') {
                if (in_array($unidDest, ['SAL', 'DK4', 'TNE', 'DEV'], true)) continue;
                if ($unidade === 'SAO' && $unidDest === 'CAM') continue;
                if ($unidade === 'CAM' && $unidDest === 'SAO') continue;
            }

            $freteAtual += (float)parseNumero($cte['frete'] ?? 0);
        }

        if ($freteAtual < $minFreteLinha && !$forcarMinFrete) {
            respondJson([
                'success' => false,
                'code' => 'MIN_FRETE',
                'message' => 'Frete atual abaixo do mínimo da linha.',
                'frete_atual' => $freteAtual,
                'min_frete' => $minFreteLinha,
            ]);
        }
    }

    list($limitePeso, $limiteVol) = getCapacidadeVeiculo($conn, $tabelaVeiculo, $placaAuto);
    $metaSel = null;
    $ctesSelecionados = filtrarCtesPorCapacidade($ctesDisponiveis, $unidade, $dest, $paradasLinha, $limitePeso, $limiteVol, $metaSel);

    if (empty($ctesSelecionados)) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível para os destinos desta linha.']);
    }

    $seqCarreg = nextSeqCarregamentoAuto($conn, $seqName);
    if ($seqCarreg <= 0) {
        respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
    }

    pg_query($conn, 'BEGIN');
    @pg_query($conn, "
        CREATE TABLE IF NOT EXISTS {$tabelaCap} (
            unidade          VARCHAR(10) NOT NULL,
            seq_carregamento INT NOT NULL,
            placa_provisoria VARCHAR(20) NOT NULL,
            cap_ton          NUMERIC,
            cap_m3           NUMERIC,
            vlr_frete_carreteiro NUMERIC,
            simulado         BOOLEAN DEFAULT FALSE,
            nro_linha        INT,
            PRIMARY KEY (unidade, seq_carregamento)
        )
    ");
    $nroLinhaSql = ($nroLinha > 0) ? (string)$nroLinha : 'NULL';
    @pg_query($conn,
        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, simulado, nro_linha)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placaAuto) . "', TRUE, {$nroLinhaSql})
         ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, simulado = TRUE, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha)"
    );

    $inseridos = inserirCtes($conn, $tabela, $unidade, $placaAuto, $login, $dest, $paradasCsv, $ctesSelecionados, $nroLinha, $seqCarreg);
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
        'nro_linha'       => $nroLinha,
        'destino'         => $dest,
        'paradas'         => $paradasLinha,
        'sobras'          => [
            'qtd' => (int)($metaSel['qtd_sobra'] ?? 0),
            'peso_kg' => round((float)($metaSel['peso_sobra_kg'] ?? 0.0), 2),
            'cubagem' => round((float)($metaSel['vol_sobra_m3'] ?? 0.0), 3),
            'frete' => round((float)($metaSel['frete_sobra'] ?? 0.0), 2),
        ],
        'capacidade'      => [
            'peso_kg' => round((float)($metaSel['limite_peso_kg'] ?? 0.0), 2),
            'cubagem' => round((float)($metaSel['limite_vol_m3'] ?? 0.0), 3),
        ],
        'uso'             => [
            'peso_kg' => round((float)($metaSel['usado_peso_kg'] ?? 0.0), 2),
            'cubagem' => round((float)($metaSel['usado_vol_m3'] ?? 0.0), 3),
            'frete' => round((float)($metaSel['usado_frete'] ?? 0.0), 2),
        ],
        'resumo_unidades' => $resumoUnidades,
        'resumo_destinos' => $resumoDestinos,
    ]);
}

// ─── Modo informado (destino manual) ─────────────────────────────────────────
if (empty($unidadeDestino)) {
    respondJson(['success' => false, 'message' => 'Unidade de destino não informada.']);
}

$placaFinal = !empty($placa) ? $placa : ($unidade . '-' . $unidadeDestino);

$ocupacao = getOcupacaoPorUnidade($conn, $tabela, $tabelaCap, $unidade);
$usadasSet = [];
foreach ($ocupacao as $u => $_v) $usadasSet[$u] = true;

$invalid = [];
foreach ($paradas as $p) {
    $p = strtoupper(trim((string)$p));
    if ($p === '') continue;
    if (isset($usadasSet[$p])) $invalid[] = $p;
}
$invalid = array_values(array_unique($invalid));
if (!empty($invalid)) {
    $det = [];
    foreach ($invalid as $u) {
        $occsMap = $ocupacao[$u] ?? null;
        if (!$occsMap || !is_array($occsMap) || count($occsMap) === 0) { $det[] = $u; continue; }
        $occs = array_values($occsMap);
        $destPlacas = [];
        $interPlacas = [];
        foreach ($occs as $o) {
            $tp = strtoupper(trim((string)($o['tipo'] ?? '')));
            $pl = strtoupper(trim((string)($o['placa'] ?? '')));
            if ($pl === '') continue;
            if ($tp === 'DESTINO') $destPlacas[] = $pl;
            else $interPlacas[] = $pl;
        }
        $destPlacas = array_values(array_unique($destPlacas));
        $interPlacas = array_values(array_unique($interPlacas));
        $parts = [];
        if (!empty($destPlacas)) $parts[] = 'destino: ' . implode(', ', $destPlacas);
        if (!empty($interPlacas)) $parts[] = 'intermediária: ' . implode(', ', $interPlacas);
        $det[] = $u . (empty($parts) ? '' : ' (' . implode('; ', $parts) . ')');
    }
    respondJson(['success' => false, 'message' => 'Parada(s) inválida(s): ' . implode(', ', $det) . '.']);
}

$paradasCsv = implode(',', $paradas);

$check = sql("SELECT 1 FROM {$tabela} WHERE unidade = \$1 AND placa_provisoria = \$2 AND data_finalizacao IS NULL LIMIT 1", [$unidade, $placaFinal], $conn);
if ($check && pg_num_rows($check) > 0) {
    respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaFinal}."]);
}

if (empty($ctesDisponiveis)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível enviado pelo painel. Recarregue os dados e tente novamente.']);
}

$GLOBALS['ctesOcupados'] = getCtesJaUsadosEmCarregamentos($conn, $tabela, $unidade);

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
$metaSel = null;
$ctesSelecionados = filtrarCtesPorCapacidade($ctesDisponiveis, $unidade, $unidadeDestino, $paradas, $limitePeso, $limiteVol, $metaSel);

if (empty($ctesSelecionados)) {
    respondJson(['success' => false, 'message' => 'Nenhum CT-e disponível para os destinos informados.']);
}

$seqCarreg = nextSeqCarregamentoAuto($conn, $seqName);
if ($seqCarreg <= 0) {
    respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
}

pg_query($conn, 'BEGIN');
@pg_query($conn, "
    CREATE TABLE IF NOT EXISTS {$tabelaCap} (
        unidade          VARCHAR(10) NOT NULL,
        seq_carregamento INT NOT NULL,
        placa_provisoria VARCHAR(20) NOT NULL,
        cap_ton          NUMERIC,
        cap_m3           NUMERIC,
        vlr_frete_carreteiro NUMERIC,
        simulado         BOOLEAN DEFAULT FALSE,
        nro_linha        INT,
        PRIMARY KEY (unidade, seq_carregamento)
    )
");
@pg_query($conn,
    "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, simulado, nro_linha)
     VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placaFinal) . "', TRUE, NULL)
     ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, simulado = TRUE, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha)"
);

$inseridos = inserirCtes($conn, $tabela, $unidade, $placaFinal, $login, $unidadeDestino, $paradasCsv, $ctesSelecionados, 0, $seqCarreg);
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
    'nro_linha'       => 0,
    'destino'         => $unidadeDestino,
    'paradas'         => $paradas,
    'sobras'          => [
        'qtd' => (int)($metaSel['qtd_sobra'] ?? 0),
        'peso_kg' => round((float)($metaSel['peso_sobra_kg'] ?? 0.0), 2),
        'cubagem' => round((float)($metaSel['vol_sobra_m3'] ?? 0.0), 3),
        'frete' => round((float)($metaSel['frete_sobra'] ?? 0.0), 2),
    ],
    'capacidade'      => [
        'peso_kg' => round((float)($metaSel['limite_peso_kg'] ?? 0.0), 2),
        'cubagem' => round((float)($metaSel['limite_vol_m3'] ?? 0.0), 3),
    ],
    'uso'             => [
        'peso_kg' => round((float)($metaSel['usado_peso_kg'] ?? 0.0), 2),
        'cubagem' => round((float)($metaSel['usado_vol_m3'] ?? 0.0), 3),
        'frete' => round((float)($metaSel['usado_frete'] ?? 0.0), 2),
    ],
    'resumo_unidades' => $resumoUnidades,
    'resumo_destinos' => $resumoDestinos,
]);
