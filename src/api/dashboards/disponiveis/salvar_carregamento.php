<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../lib/ssw_loader.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];
$input  = getRequestInput();
$acao   = $input['acao'] ?? '';

$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $input['unidade']
    ?? $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? ''
));
$login = $currentUser['username'] ?? $auth['user']['username'] ?? '';

if (empty($unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade do usuário não identificada.']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$tabela    = "{$domain}_carregamento";
$tabelaCap = "{$domain}_carregamento_capacidade";
$tabelaVeiculo = "{$domain}_veiculo";
$tabelaLinha = "{$domain}_linha";

$conn = connect();

@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS origem_criacao VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS data_finalizacao DATE");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS hora_finalizacao TIME");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS login_finalizacao VARCHAR(60)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS setores_entrega TEXT");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS setor_cte VARCHAR(30)");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS bipado BOOLEAN DEFAULT FALSE");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS data_inicio_bipagem DATE");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS hora_inicio_bipagem TIME");
@pg_query($conn, "ALTER TABLE {$tabela} ADD COLUMN IF NOT EXISTS login_inicio_bipagem VARCHAR(60)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS vlr_frete_carreteiro NUMERIC");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS simulado BOOLEAN DEFAULT FALSE");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS nro_linha INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS seq_carregamento_conjunto INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS placa_definitiva VARCHAR(10)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS placa_carreta VARCHAR(10)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS cpf_motorista VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS ddd_motorista VARCHAR(5)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS fone_motorista VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS qtde_pallets INT");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS conferente VARCHAR(80)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS ajudantes VARCHAR(120)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS doca VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tabelaCap} ADD COLUMN IF NOT EXISTS tp_carregamento VARCHAR(1)");

$seqName = "{$domain}_seq_carregamento_seq";
@pg_query($conn, "CREATE SEQUENCE IF NOT EXISTS {$seqName}");
@pg_query($conn, "ALTER TABLE {$tabela} ALTER COLUMN seq_carregamento SET DEFAULT nextval('{$seqName}')");

function nextSeqCarregamento($conn, $seqName) {
    $seqName = trim((string)$seqName);
    if ($seqName === '') return 0;
    $res = @pg_query($conn, "SELECT nextval('" . pg_escape_string($conn, $seqName) . "') AS seq");
    if (!$res || pg_num_rows($res) === 0) return 0;
    return (int)pg_fetch_result($res, 0, 0);
}

// Resolve o tipo do carregamento (T=Transferência / E=Entrega).
// Sempre considera a coluna tp_carregamento; fallback para o destino do carregamento.
function resolverTpCarregamento($conn, $tabela, $tabelaCap, $unidade, $seqCarreg, $destinoFallback = '') {
    $unidade = strtoupper(trim((string)$unidade));
    $seqCarreg = (int)$seqCarreg;
    $tp = '';
    if ($seqCarreg > 0) {
        try {
            $res = sql(
                "SELECT tp_carregamento FROM {$tabelaCap} WHERE unidade = \$1 AND seq_carregamento = \$2 LIMIT 1",
                [$unidade, $seqCarreg],
                $conn
            );
            if ($res && pg_num_rows($res) > 0) {
                $tp = strtoupper(trim((string)pg_fetch_result($res, 0, 0)));
            }
        } catch (Exception $e) {}
        if ($tp !== 'T' && $tp !== 'E') {
            try {
                $res2 = sql(
                    "SELECT destino FROM {$tabela}
                     WHERE unidade = \$1 AND seq_carregamento = \$2
                     ORDER BY (CASE WHEN COALESCE(destino, '') <> '' THEN 0 ELSE 1 END)
                     LIMIT 1",
                    [$unidade, $seqCarreg],
                    $conn
                );
                if ($res2 && pg_num_rows($res2) > 0) {
                    $dest = trim((string)pg_fetch_result($res2, 0, 0));
                    $tp = ($dest === '') ? 'E' : 'T';
                }
            } catch (Exception $e) {}
        }
    }
    if ($tp !== 'T' && $tp !== 'E') {
        $tp = (trim((string)$destinoFallback) === '') ? 'E' : 'T';
    }
    return $tp;
}

function parseCsvSiglas($csv) {
    $s = strtoupper(trim((string)$csv));
    if ($s === '') return [];
    $parts = array_map('trim', explode(',', $s));
    $out = [];
    foreach ($parts as $p) {
        $p = strtoupper(trim((string)$p));
        if ($p === '') continue;
        if (!in_array($p, $out, true)) $out[] = $p;
    }
    return $out;
}

function getUnidadesOcupadasCarregamentos($conn, $tabela, $tabelaCap, $unidade) {
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
                foreach (parseCsvSiglas($csv) as $u) {
                    if (!isset($map[$u])) $map[$u] = [];
                    $k = 'INTERMEDIARIA|' . $placa;
                    if (!isset($map[$u][$k])) $map[$u][$k] = ['placa' => $placa, 'tipo' => 'INTERMEDIARIA'];
                }
            }
        }
    } catch (Exception $e) {}
    return $map;
}

// ─── Helper: atualizar CT-es do TMS ANTES de finalizar (falha NÃO bloqueia) ──
function _atualizarCtesAntesFinalizar($conn, $domain, $tabela, $tabelaCap, $seqName, $unidade, $login, $placa) {
    try {
        $unidadeEsc = pg_escape_string($conn, $unidade);
        $loginEsc   = pg_escape_string($conn, $login);
        $placaEsc   = pg_escape_string($conn, strtoupper(trim((string)$placa)));
        if ($placaEsc === '') return null;

        $resCarBase = null;
        try {
            $resCarBase = sql(
                "SELECT
                    seq_carregamento, destino, unidades, setores_entrega, origem_criacao,
                    data_finalizacao, hora_finalizacao, login_finalizacao,
                    data_inclusao, hora_inclusao
                 FROM {$tabela}
                 WHERE unidade = \$1 AND UPPER(placa_provisoria) = \$2
                 ORDER BY data_inclusao DESC, hora_inclusao DESC
                 LIMIT 1",
                [$unidade, strtoupper(trim((string)$placa))],
                $conn
            );
        } catch (Exception $e) {}
        if (!$resCarBase || pg_num_rows($resCarBase) === 0) return null;

        $rowBase = pg_fetch_assoc($resCarBase);
        $seqCarreg = (int)($rowBase['seq_carregamento'] ?? 0);
        $destinoCarreg = (string)($rowBase['destino'] ?? '');
        $unidadesCarreg = (string)($rowBase['unidades'] ?? '');
        $setoresEntregaCarreg = (string)($rowBase['setores_entrega'] ?? '');
        $origemCriacao = strtoupper(trim((string)($rowBase['origem_criacao'] ?? '')));
        if ($origemCriacao === '') $origemCriacao = 'SSW';

        $dtHoje = new DateTime();
        $dtIni = (clone $dtHoje)->modify('-4 days');
        $ddIni = $dtIni->format('dmy');
        $ddFin = $dtHoje->format('dmy');

        $extractXml = function ($html) {
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
        };
        $parseDt = function ($s) {
            $s = trim((string)$s);
            if ($s === '') return null;
            if (preg_match('/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/', $s, $m)) {
                $dia = (int)$m[1]; $mes = (int)$m[2];
                $anoRaw = (string)$m[3]; $ano = strlen($anoRaw) === 2 ? (2000 + (int)$anoRaw) : (int)$anoRaw;
                $hh = (int)$m[4]; $mm = (int)$m[5]; $ss = isset($m[6]) ? (int)$m[6] : 0;
                $dt = DateTime::createFromFormat('Y-m-d H:i:s', sprintf('%04d-%02d-%02d %02d:%02d:%02d', $ano, $mes, $dia, $hh, $mm, $ss));
                return $dt ?: null;
            }
            foreach (['d/m/y H:i:s', 'd/m/Y H:i:s', 'd/m/y H:i', 'd/m/Y H:i'] as $f) {
                $dt = DateTime::createFromFormat($f, $s);
                if ($dt !== false) return $dt;
            }
            return null;
        };

        require_once __DIR__ . '/../../lib/ssw_loader.php';
        try { require_ssw(); } catch (Exception $e) {}
        try { ssw_login($domain); } catch (Exception $e) { return false; }

        $url = "https://sistema.ssw.inf.br/bin/ssw0125?act=PER&t_sigla_origem=" . rawurlencode($unidade) .
               "&t_data_saida_ini=" . rawurlencode($ddIni) .
               "&t_data_saida_fin=" . rawurlencode($ddFin);

        $xmlStr = null;
        try {
            $html = ssw_go($url);
            $xmlStr = $extractXml($html);
        } catch (Exception $e) {
            $xmlStr = null;
        }

        if ($xmlStr === null) return null;
        $xml = @simplexml_load_string($xmlStr);
        if ($xml === false) return null;

        $info = ['saida' => null, 'qtd' => 0, 'manifestos' => []];
        $rows = $xml->xpath('//r');
        if ($rows && count($rows) > 0) {
            $domainUpper = strtoupper((string)$domain);
            $cleanPlacaReq = preg_replace('/[^A-Z0-9]/', '', strtoupper(trim((string)$placa)));
            $keyReq = ($domainUpper === 'RVE') ? substr($cleanPlacaReq, -4) : $cleanPlacaReq;

            $regF3 = [];
            $regF2 = [];
            foreach ($rows as $r) {
                $f3 = strtoupper(trim((string)($r->f3 ?? '')));
                $f2 = strtoupper(trim((string)($r->f2 ?? '')));
                $f11 = trim((string)($r->f11 ?? ''));
                $dt = $f11 !== '' ? $parseDt($f11) : null;
                $f8Raw = trim((string)($r->f8 ?? ''));
                $f8Num = (int)preg_replace('/[^\d]/', '', $f8Raw);
                $f16 = strtoupper(trim((string)($r->f16 ?? '')));
                $f17 = trim((string)($r->f17 ?? ''));
                $mans = [];
                if ($f17 !== '') {
                    $mm = null;
                    if (preg_match_all('/\d+/', $f17, $mm)) {
                        foreach (($mm[0] ?? []) as $sx) {
                            $sx = (string)$sx;
                            if ($sx !== '') $mans[$sx] = true;
                        }
                    }
                }

                $reg = [
                    'dt' => $dt,
                    'ts' => ($dt instanceof DateTime) ? $dt->getTimestamp() : 0,
                    'status' => $f16,
                    'qtd' => $f8Num,
                    'manifestos' => $mans,
                ];

                if ($f3 !== '') {
                    $cleanF3 = preg_replace('/[^A-Z0-9]/', '', $f3);
                    $keyF3 = ($domainUpper === 'RVE') ? substr($cleanF3, -4) : $cleanF3;
                    if ($keyF3 !== '' && $keyF3 === $keyReq) $regF3[] = $reg;
                } elseif ($f2 !== '') {
                    $cleanF2 = preg_replace('/[^A-Z0-9]/', '', $f2);
                    $keyF2 = ($domainUpper === 'RVE') ? substr($cleanF2, -4) : $cleanF2;
                    if ($keyF2 !== '' && $keyF2 === $keyReq) $regF2[] = $reg;
                }
            }

            $cands = count($regF3) > 0 ? $regF3 : $regF2;
            if (count($cands) > 0) {
                $best = null;
                foreach ($cands as $x) {
                    if (strpos((string)($x['status'] ?? ''), 'AUTORIZADO') === false) continue;
                    if ($best === null || (int)($x['ts'] ?? 0) > (int)($best['ts'] ?? 0)) $best = $x;
                }
                if ($best === null) {
                    foreach ($cands as $x) {
                        if (strpos((string)($x['status'] ?? ''), 'ENCERRADO') === false) continue;
                        if ($best === null || (int)($x['ts'] ?? 0) > (int)($best['ts'] ?? 0)) $best = $x;
                    }
                }
                if ($best === null) {
                    foreach ($cands as $x) {
                        if ($best === null || (int)($x['ts'] ?? 0) > (int)($best['ts'] ?? 0)) $best = $x;
                    }
                }

                if ($best !== null) {
                    $info['saida'] = $best['dt'] ?? null;
                    $info['qtd'] = (int)($best['qtd'] ?? 0);
                    $mans = $best['manifestos'] ?? [];
                    if (is_array($mans)) {
                        foreach (array_keys($mans) as $sx) {
                            $sx = (string)$sx;
                            if ($sx !== '') $info['manifestos'][$sx] = true;
                        }
                    }
                }
            }
        }

        $manifestos = isset($info['manifestos']) && is_array($info['manifestos']) ? array_keys($info['manifestos']) : [];
        if (count($manifestos) === 0) return null;

        $tblCte = "{$domain}_cte";
        $cteTableOk = false;
        try {
            $resReg = sql("SELECT to_regclass($1) AS reg", [$tblCte], $conn);
            $val = $resReg ? pg_fetch_result($resReg, 0, 0) : null;
            $cteTableOk = ($val !== null && $val !== '');
        } catch (Exception $e) {}
        if (!$cteTableOk) return null;

        $horaFinalDb = trim((string)($rowBase['hora_finalizacao'] ?? ''));
        $loginFinalDb = trim((string)($rowBase['login_finalizacao'] ?? ''));
        $dtFinal = $info['saida'] instanceof DateTime ? $info['saida'] : new DateTime();
        $dataFinalStr = $dtFinal->format('Y-m-d');
        $horaFinalStr = $horaFinalDb !== '' ? $horaFinalDb : $dtFinal->format('H:i:s');
        $loginFinalStr = $loginFinalDb !== '' ? $loginFinalDb : $login;

        $colCache = [];
        $cteCol = function (string $col) use (&$colCache, $conn, $tblCte): bool {
            $c = strtolower(trim($col));
            if ($c === '') return false;
            if (isset($colCache[$c])) return (bool)$colCache[$c];
            try {
                $res = sql(
                    "SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = lower($1) AND column_name = $2
                     LIMIT 1",
                    [strtolower($tblCte), $c],
                    $conn
                );
            } catch (Exception $e) { $res = null; }
            $ok = ($res && pg_num_rows($res) > 0);
            $colCache[$c] = $ok;
            return $ok;
        };
        $toFloat = function ($v) {
            $s = trim((string)$v);
            if ($s === '') return 0.0;
            $s = preg_replace('/[^\d,\.\-]/', '', $s);
            if ($s === '' || $s === '-') return 0.0;
            $hasComma = (strpos($s, ',') !== false);
            $hasDot = (strpos($s, '.') !== false);
            if ($hasComma) {
                $s = str_replace('.', '', $s);
                $s = str_replace(',', '.', $s);
            } else if ($hasDot && preg_match('/^\-?\d{1,3}(\.\d{3})+$/', $s) && !preg_match('/^\-?0\.\d+$/', $s)) {
                $s = str_replace('.', '', $s);
            }
            return (float)$s;
        };
        $parseDateBr = function ($v) {
            $s = trim((string)$v);
            if ($s === '') return null;
            $dt = DateTime::createFromFormat('d/m/y', $s);
            if ($dt !== false) return $dt->format('Y-m-d');
            $dt = DateTime::createFromFormat('d/m/Y', $s);
            if ($dt !== false) return $dt->format('Y-m-d');
            return null;
        };

        $pairs = [];
        $cteXml = [];
        foreach ($manifestos as $seqMan) {
            $seqMan = trim((string)$seqMan);
            if ($seqMan === '') continue;
            $urlMan = "https://sistema.ssw.inf.br/bin/ssw0125?act=CTRCS_MAN&seq_manifesto=" . rawurlencode($seqMan);
            $htmlMan = '';
            try { $htmlMan = ssw_go($urlMan); } catch (Exception $e) { continue; }
            $xmlManStr = $extractXml($htmlMan);
            if ($xmlManStr === null) continue;
            $xmlMan = @simplexml_load_string($xmlManStr);
            if ($xmlMan === false) continue;
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
                        'ser_cte' => $ser, 'nro_cte' => $nro, 'destino_cte' => '',
                        'cidade_destino' => trim((string)($rm->f5 ?? '')),
                        'remetente' => trim((string)($rm->f3 ?? '')),
                        'destinatario' => trim((string)($rm->f4 ?? '')),
                        'pagador' => '',
                        'data_emissao' => $parseDateBr((string)($rm->f2 ?? '')),
                        'data_prev_ent' => $parseDateBr((string)($rm->f12 ?? '')),
                        'vlr_merc' => $toFloat((string)($rm->f9 ?? '')),
                        'vlr_frete' => $toFloat((string)($rm->f10 ?? '')),
                        'peso' => $toFloat((string)($rm->f8 ?? '')),
                        'cubagem' => 0.0,
                        'qtde_vol' => (int)preg_replace('/[^\d]/', '', (string)($rm->f7 ?? '')),
                    ];
                }
            }
        }
        if (count($pairs) === 0) {
            return ['dt' => $dtFinal, 'from_f11' => ($info['saida'] instanceof DateTime)];
        }

        if ($seqCarreg <= 0) {
            $seqCarreg = nextSeqCarregamento($conn, $seqName);
            if ($seqCarreg > 0) {
                @pg_query($conn,
                    "UPDATE {$tabela} SET seq_carregamento = {$seqCarreg}
                     WHERE unidade = '{$unidadeEsc}' AND UPPER(placa_provisoria) = '{$placaEsc}'"
                );
                $tpCarregAtualiza = (trim($destinoCarreg) === '') ? 'E' : 'T';
                @pg_query($conn,
                    "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, nro_linha, tp_carregamento)
                     VALUES ('{$unidadeEsc}', {$seqCarreg}, '{$placaEsc}', NULL, '{$tpCarregAtualiza}')
                     ON CONFLICT (unidade, seq_carregamento) DO NOTHING"
                );
            }
        }

        $cteInfo = [];
        if ($seqCarreg > 0 && count($pairs) > 0) {
            $joinCidade = $cteCol('seq_cidade_dest') ? "LEFT JOIN cidade cid_dest ON cte.seq_cidade_dest = cid_dest.seq_cidade" : "";
            $selCidade = $cteCol('seq_cidade_dest') ? "COALESCE(cid_dest.nome, '')" : "''";
            $selDest = $cteCol('sigla_dest') ? "UPPER(BTRIM(cte.sigla_dest))" : "''";
            $selRemet = $cteCol('nome_emit') ? "COALESCE(cte.nome_emit, '')" : "''";
            $selDestinat = $cteCol('nome_dest') ? "COALESCE(cte.nome_dest, '')" : "''";
            $selPagador = $cteCol('nome_pag') ? "COALESCE(cte.nome_pag, '')" : "''";
            $selEmissao = $cteCol('data_emissao') ? "cte.data_emissao::date" : "NULL::date";
            $selPrev = $cteCol('data_prev_ent') ? "cte.data_prev_ent::date" : "NULL::date";
            $selMerc = $cteCol('vlr_merc') ? "COALESCE(cte.vlr_merc, 0)" : "0";
            $selFrete = $cteCol('vlr_frete') ? "COALESCE(cte.vlr_frete, 0)" : "0";
            $selPeso = $cteCol('peso_real')
                ? "COALESCE(cte.peso_real, 0)"
                : ($cteCol('peso_calc') ? "COALESCE(cte.peso_calc, 0)" : "0");
            $selCub = $cteCol('cubagem') ? "COALESCE(cte.cubagem, 0)" : "0";
            $selVol = $cteCol('qtde_vol') ? "COALESCE(cte.qtde_vol, 0)" : "0";

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
        }
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
                'vlr_merc' => $toFloat($rowC['vlr_merc'] ?? ($cteXml[$k]['vlr_merc'] ?? 0)),
                'vlr_frete' => $toFloat($rowC['vlr_frete'] ?? ($cteXml[$k]['vlr_frete'] ?? 0)),
                'peso' => $toFloat($rowC['peso'] ?? ($cteXml[$k]['peso'] ?? 0)),
                'cubagem' => $toFloat($rowC['cubagem'] ?? 0),
                'qtde_vol' => (int)($rowC['qtde_vol'] ?? ($cteXml[$k]['qtde_vol'] ?? 0)),
            ];
        }
        $added = 0;
        if (count($cteAll) > 0) {
            @pg_query($conn, 'BEGIN');
            try {
                foreach ($cteAll as $rowC) {
                    $ser = strtoupper(trim((string)($rowC['ser_cte'] ?? '')));
                    $nro = (int)($rowC['nro_cte'] ?? 0);
                    if ($ser === '' || $nro <= 0) continue;
                    $check = @pg_query($conn,
                        "SELECT 1 FROM {$tabela}
                         WHERE unidade = '{$unidadeEsc}'
                           AND (
                                (seq_carregamento IS NOT NULL AND seq_carregamento = {$seqCarreg})
                                OR UPPER(placa_provisoria) = '{$placaEsc}'
                           )
                           AND UPPER(BTRIM(ser_cte)) = '" . pg_escape_string($conn, $ser) . "'
                           AND nro_cte = {$nro}
                         LIMIT 1"
                    );
                    if ($check && pg_num_rows($check) > 0) {
                        // Linha já existe: sincroniza valores do documento (_cte) quando o gravado for menor/zerado
                        corrigirValoresDocCte(
                            $conn, $tabela, $unidadeEsc, $ser, $nro,
                            $toFloat($rowC['vlr_merc'] ?? 0),
                            $toFloat($rowC['vlr_frete'] ?? 0),
                            $toFloat($rowC['peso'] ?? 0),
                            $toFloat($rowC['cubagem'] ?? 0),
                            (int)($rowC['qtde_vol'] ?? 0)
                        );
                        continue;
                    }
                    $destCte = strtoupper(trim((string)($rowC['destino_cte'] ?? '')));
                    $destCteEsc = pg_escape_string($conn, $destCte);
                    $emissaoVal = trim((string)($rowC['data_emissao'] ?? ''));
                    $prevVal = trim((string)($rowC['data_prev_ent'] ?? ''));
                    $emissaoSql = $emissaoVal !== '' ? "'" . pg_escape_string($conn, $emissaoVal) . "'::date" : 'NULL';
                    $prevSql = $prevVal !== '' ? "'" . pg_escape_string($conn, $prevVal) . "'::date" : 'NULL';
                    $vlrMerc = $toFloat($rowC['vlr_merc'] ?? 0);
                    $vlrFrete = $toFloat($rowC['vlr_frete'] ?? 0);
                    $peso = $toFloat($rowC['peso'] ?? 0);
                    $cub = $toFloat($rowC['cubagem'] ?? 0);
                    $vol = (int)($rowC['qtde_vol'] ?? 0);
                    $remetente = pg_escape_string($conn, (string)($rowC['remetente'] ?? ''));
                    $destinatario = pg_escape_string($conn, (string)($rowC['destinatario'] ?? ''));
                    $pagador = pg_escape_string($conn, (string)($rowC['pagador'] ?? ''));
                    $cidadeDest = pg_escape_string($conn, (string)($rowC['cidade_destino'] ?? ''));
                    $destCarEsc = pg_escape_string($conn, strtoupper(trim((string)$destinoCarreg)));
                    $unidCarEsc = pg_escape_string($conn, strtoupper(trim((string)$unidadesCarreg)));
                    $setorCarEsc = pg_escape_string($conn, (string)$setoresEntregaCarreg);
                    $origemEsc = pg_escape_string($conn, $origemCriacao);
                    $dataFinEsc = pg_escape_string($conn, $dataFinalStr);
                    $horaFinEsc = pg_escape_string($conn, $horaFinalStr);
                    $loginFinEsc = pg_escape_string($conn, $loginFinalStr);

                    @pg_query($conn,
                        "INSERT INTO {$tabela}
                         (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                          ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                          remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                          vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                          destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento,
                          data_finalizacao, hora_finalizacao, login_finalizacao)
                         VALUES
                         ('{$unidadeEsc}', " . ($seqCarreg > 0 ? $seqCarreg : 'NULL') . ", '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME,
                          '" . pg_escape_string($conn, $ser) . "', {$nro}, '{$destCteEsc}', {$emissaoSql}, {$prevSql},
                          '{$remetente}', '{$destinatario}', '{$pagador}', '{$cidadeDest}',
                          {$vlrMerc}, {$vlrFrete}, {$peso}, {$cub}, {$vol},
                          '{$destCarEsc}', '{$unidCarEsc}', '{$setorCarEsc}', NULL, '{$origemEsc}', '{$unidadeEsc}',
                          '{$dataFinEsc}'::date, '{$horaFinEsc}'::time, '{$loginFinEsc}')"
                    );
                    $added += 1;
                }
                @pg_query($conn,
                    "UPDATE {$tabela}
                     SET data_finalizacao = '{$dataFinEsc}'::date,
                         hora_finalizacao = '{$horaFinEsc}'::time,
                         login_finalizacao = '{$loginFinEsc}'
                     WHERE unidade = '{$unidadeEsc}'
                       AND UPPER(placa_provisoria) = '{$placaEsc}'
                       AND data_finalizacao IS NULL"
                );
                if ($added > 0) {
                    @pg_query($conn,
                        "DELETE FROM {$tabela}
                         WHERE unidade = '{$unidadeEsc}'
                           AND UPPER(placa_provisoria) = '{$placaEsc}'
                           AND nro_cte = 0
                           AND (seq_carregamento IS NULL OR seq_carregamento = {$seqCarreg})
                           AND data_finalizacao IS NULL"
                    );
                }
                @pg_query($conn, 'COMMIT');
            } catch (Exception $e) {
                @pg_query($conn, 'ROLLBACK');
                return null;
            }
        }
        return ['dt' => $dtFinal, 'from_f11' => ($info['saida'] instanceof DateTime)];
    } catch (Exception $e) {
        return null;
    }
}

// ─── Ação: criar carregamento manual (linha sentinela com nro_cte = 0) ────────
if ($acao === 'criar') {
    $placa   = strtoupper(trim($input['placa'] ?? ''));
    $destino = strtoupper(trim($input['destino'] ?? ''));
    $paradas = strtoupper(trim($input['paradas'] ?? ''));
    $setoresEntrega = '';
    $origemCriacao = strtoupper(trim((string)($input['origem_criacao'] ?? 'MANUAL')));
    if (!in_array($origemCriacao, ['MANUAL', 'AUTO', 'SSW'], true)) $origemCriacao = 'MANUAL';
    if ($destino === '') {
        $setoresEntrega = $paradas;
        $paradas = '';
    }

    if (empty($placa)) {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $ignorarTravas = ($origemCriacao === 'MANUAL' && $destino !== '');
    if (!$ignorarTravas) {
        $check = sql(
            "SELECT 1
               FROM {$tabela}
              WHERE unidade = \$1
                AND placa_provisoria = \$2
                AND data_finalizacao IS NULL
              LIMIT 1",
            [$unidade, $placa], $conn
        );
        if ($check && pg_num_rows($check) > 0) {
            respondJson(['success' => false, 'message' => 'Já existe um carregamento com esta placa para sua unidade.']);
        }

        $ocupadas = getUnidadesOcupadasCarregamentos($conn, $tabela, $tabelaCap, $unidade);
        $invalid = [];
        foreach (parseCsvSiglas($paradas) as $p) {
            if (isset($ocupadas[$p])) $invalid[] = $p;
        }
        if (!empty($invalid)) {
            $det = [];
            foreach ($invalid as $u) {
                $occsMap = $ocupadas[$u] ?? null;
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
    }

    pg_query($conn, 'BEGIN');
    $dupKey = $unidade . '|' . $placa . '|' . $destino . '|' . $paradas . '|' . $setoresEntrega;
    sql(
        "SELECT pg_advisory_xact_lock((('x'||substr(md5(\$1),1,16))::bit(64)::bigint))",
        [$dupKey],
        $conn
    );
    $resDup = sql(
        "SELECT seq_carregamento
           FROM {$tabela}
          WHERE unidade = \$1
            AND placa_provisoria = \$2
            AND COALESCE(destino, '') = \$3
            AND COALESCE(unidades, '') = \$4
            AND COALESCE(setores_entrega, '') = \$5
            AND data_finalizacao IS NULL
          ORDER BY seq_carregamento DESC
          LIMIT 1",
        [$unidade, $placa, $destino, $paradas, $setoresEntrega],
        $conn
    );
    if ($resDup && pg_num_rows($resDup) > 0) {
        $seqExist = (int)pg_fetch_result($resDup, 0, 0);
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => true, 'seq_carregamento' => $seqExist, 'duplicado' => true]);
    }

    // Linha sentinela: nro_cte = 0 indica carregamento sem CT-es ainda
    $destinoSql = $destino !== '' ? "'" . pg_escape_string($conn, $destino) . "'" : 'NULL';
    $unidadesSql = $paradas !== '' ? "'" . pg_escape_string($conn, $paradas) . "'" : 'NULL';
    $setoresSql = $setoresEntrega !== '' ? "'" . pg_escape_string($conn, $setoresEntrega) . "'" : 'NULL';

    $seqCarreg = nextSeqCarregamento($conn, $seqName);
    if ($seqCarreg <= 0) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
    }

    $res = pg_query($conn,
        "INSERT INTO {$tabela} (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, {$destinoSql}, {$unidadesSql}, {$setoresSql}, NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "')"
    );

    if (!$res) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao criar carregamento: ' . pg_last_error($conn)]);
    }

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
    $tpCarreg = ($destino === '') ? 'E' : 'T';
    @pg_query($conn,
        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, simulado, nro_linha, tp_carregamento)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', TRUE, NULL, '{$tpCarreg}')
         ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, simulado = TRUE, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha), tp_carregamento = '{$tpCarreg}'"
    );

    pg_query($conn, 'COMMIT');
    respondJson(['success' => true, 'seq_carregamento' => $seqCarreg]);
}

// ─── Ação: iniciar simulação (vira carregamento real no TMS) ──────────────────
if ($acao === 'iniciar_simulacao') {
    $seqCarreg = (int)($input['seq_carregamento'] ?? 0);
    $placaNova = strtoupper(trim((string)($input['placa'] ?? '')));

    if ($seqCarreg <= 0) {
        respondJson(['success' => false, 'message' => 'seq_carregamento não informado.']);
    }
    if ($placaNova === '') {
        respondJson(['success' => false, 'message' => 'Placa verdadeira não informada.']);
    }

    $resV = sql(
        "SELECT placa FROM {$tabelaVeiculo} WHERE UPPER(placa) = UPPER(\$1) LIMIT 1",
        [$placaNova],
        $conn
    );
    if (!$resV || pg_num_rows($resV) === 0) {
        respondJson(['success' => false, 'message' => 'Placa não encontrada no cadastro de veículos.']);
    }

    $resCap = sql(
        "SELECT COALESCE(simulado, FALSE) AS simulado
         FROM {$tabelaCap}
         WHERE unidade = \$1 AND seq_carregamento = \$2
         LIMIT 1",
        [$unidade, $seqCarreg],
        $conn
    );
    if (!$resCap || pg_num_rows($resCap) === 0) {
        respondJson(['success' => false, 'message' => 'Registro de capacidade não encontrado para este carregamento.']);
    }
    $isSim = ((string)pg_fetch_result($resCap, 0, 0) === 't');
    if (!$isSim) {
        respondJson(['success' => false, 'message' => 'Este carregamento já não está mais como simulado.']);
    }

    $resDup = sql(
        "SELECT 1
         FROM {$tabela} c
         LEFT JOIN {$tabelaCap} cap
                ON cap.unidade = c.unidade AND cap.seq_carregamento = c.seq_carregamento
         WHERE c.unidade = \$1
           AND c.data_finalizacao IS NULL
           AND UPPER(c.placa_provisoria) = UPPER(\$2)
           AND c.seq_carregamento <> \$3
           AND COALESCE(cap.simulado, FALSE) = FALSE
         LIMIT 1",
        [$unidade, $placaNova, $seqCarreg],
        $conn
    );
    if ($resDup && pg_num_rows($resDup) > 0) {
        respondJson(['success' => false, 'message' => 'Já existe um carregamento em andamento com esta placa.']);
    }

    $destinoCarreg = null;
    $unidadesCarreg = null;
    $resInfo = sql(
        "SELECT destino, unidades
         FROM {$tabela}
         WHERE unidade = \$1
           AND seq_carregamento = \$2
           AND data_finalizacao IS NULL
         ORDER BY data_inclusao ASC, hora_inclusao ASC
         LIMIT 1",
        [$unidade, $seqCarreg],
        $conn
    );
    if ($resInfo && pg_num_rows($resInfo) > 0) {
        $rowI = pg_fetch_assoc($resInfo);
        $destinoCarreg = ($rowI['destino'] ?? null);
        $unidadesCarreg = ($rowI['unidades'] ?? null);
        $destinoCarreg = ($destinoCarreg !== null && trim((string)$destinoCarreg) !== '') ? strtoupper(trim((string)$destinoCarreg)) : null;
        $unidadesCarreg = ($unidadesCarreg !== null && trim((string)$unidadesCarreg) !== '') ? strtoupper(trim((string)$unidadesCarreg)) : null;
    }

    pg_query($conn, 'BEGIN');
    try {
        sql(
            "UPDATE {$tabelaCap}
             SET placa_provisoria = \$1,
                 simulado = FALSE
             WHERE unidade = \$2
               AND seq_carregamento = \$3",
            [$placaNova, $unidade, $seqCarreg],
            $conn
        );

        sql(
            "UPDATE {$tabela}
             SET placa_provisoria = \$1
             WHERE unidade = \$2
               AND seq_carregamento = \$3",
            [$placaNova, $unidade, $seqCarreg],
            $conn
        );

        if (strtoupper(trim((string)$domain)) === 'RVE') {
            sql(
                "DELETE FROM {$tabela}
                 WHERE unidade = \$1
                   AND seq_carregamento = \$2
                   AND COALESCE(nro_cte, 0) <> 0",
                [$unidade, $seqCarreg],
                $conn
            );
        }

        pg_query($conn, 'COMMIT');
        respondJson(['success' => true]);
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao iniciar simulação.']);
    }
}

// ─── Ação: adicionar CT-es (apontamento manual e Hub) ─────────────────────────
if ($acao === 'adicionar_ctes') {
    $seqCarInput = (int)($input['seq_carregamento'] ?? 0);
    $placa   = strtoupper(trim((string)($input['placa'] ?? '')));
    $cteList = $input['ctes'] ?? [];

    if (($seqCarInput <= 0 && $placa === '') || empty($cteList) || !is_array($cteList)) {
        respondJson(['success' => false, 'message' => 'Carregamento ou CT-es inválidos.']);
    }

    // Busca destino/unidades do carregamento existente (para replicar em cada linha)
    $seqCarreg = 0;
    $placaDb = '';
    $destinoCarreg  = '';
    $unidadesCarreg = '';
    $setoresEntregaCarreg = '';
    $origemCriacao  = '';
    $identSql = ($seqCarInput > 0)
        ? ("seq_carregamento = " . (int)$seqCarInput)
        : ("placa_provisoria = '" . pg_escape_string($conn, $placa) . "'");
    $resCarreg = pg_query($conn,
        "SELECT seq_carregamento, placa_provisoria, destino, unidades, setores_entrega, origem_criacao FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL
           AND {$identSql}
         LIMIT 1"
    );
    if ($resCarreg && pg_num_rows($resCarreg) > 0) {
        $rowCarreg      = pg_fetch_assoc($resCarreg);
        $seqCarreg      = (int)($rowCarreg['seq_carregamento'] ?? 0);
        $placaDb        = strtoupper(trim((string)($rowCarreg['placa_provisoria'] ?? '')));
        $destinoCarreg  = $rowCarreg['destino']  ?? '';
        $unidadesCarreg = $rowCarreg['unidades'] ?? '';
        $setoresEntregaCarreg = $rowCarreg['setores_entrega'] ?? '';
        $origemCriacao  = strtoupper(trim($rowCarreg['origem_criacao'] ?? ''));
    } else {
        respondJson(['success' => false, 'message' => 'Carregamento não encontrado.']);
    }
    if ($origemCriacao === '') $origemCriacao = 'MANUAL';

    // Tipo do carregamento (T/E): sempre considerar a coluna tp_carregamento do pai
    $tpCarregCarreg = resolverTpCarregamento($conn, $tabela, $tabelaCap, $unidade, $seqCarreg, $destinoCarreg);

    if ($seqCarInput > 0) $seqCarreg = $seqCarInput;
    if ($placa === '' && $placaDb !== '') $placa = $placaDb;

    if ($seqCarreg <= 0 && $seqCarInput <= 0) {
        $seqCarreg = nextSeqCarregamento($conn, $seqName);
        if ($seqCarreg <= 0) {
            respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
        }
        @pg_query($conn,
            "UPDATE {$tabela}
             SET seq_carregamento = {$seqCarreg}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND data_finalizacao IS NULL"
        );
        @pg_query($conn,
            "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, nro_linha, tp_carregamento)
             VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', NULL, '{$tpCarregCarreg}')
             ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha), tp_carregamento = COALESCE({$tabelaCap}.tp_carregamento, EXCLUDED.tp_carregamento)"
        );
    }

    if ($seqCarreg > 0 && $placa !== '') {
        @pg_query($conn,
            "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, nro_linha, tp_carregamento)
             VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', NULL, '{$tpCarregCarreg}')
             ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha), tp_carregamento = COALESCE({$tabelaCap}.tp_carregamento, EXCLUDED.tp_carregamento)"
        );
    }

    pg_query($conn, 'BEGIN');
    $adicionados = 0;
    $ignorados = 0;

    foreach ($cteList as $cteData) {
        $nroCte = (int)($cteData['nroCte'] ?? 0);
        if ($nroCte <= 0) continue;

        $serCteRaw = strtoupper(trim((string)($cteData['serCte'] ?? $cteData['ser_cte'] ?? '')));
        if ($serCteRaw === '') continue;
        $serCte = pg_escape_string($conn, $serCteRaw);

        // Evita duplicata (mesmo carregamento)
        $jaNoMesmo = false;
        $check = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND seq_carregamento = {$seqCarreg}
               AND data_finalizacao IS NULL
               AND ser_cte = '{$serCte}'
               AND nro_cte = {$nroCte}
             LIMIT 1"
        );
        if ($check && pg_num_rows($check) > 0) $jaNoMesmo = true;

        if (!$jaNoMesmo) {
            $checkOutro = pg_query($conn,
                "SELECT placa_provisoria FROM {$tabela}
                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                   AND ser_cte = '{$serCte}'
                   AND nro_cte = {$nroCte}
                   AND data_finalizacao IS NULL
                   AND seq_carregamento <> {$seqCarreg}
                 LIMIT 1"
            );
            if ($checkOutro && pg_num_rows($checkOutro) > 0) {
                $ignorados++;
                continue;
            }
        }

        $destCteRaw = strtoupper(trim((string)($cteData['unidadeDest'] ?? $cteData['destinoCte'] ?? $cteData['destino_cte'] ?? $cteData['destino'] ?? '')));
        $destCteRaw = preg_replace('/[^A-Z0-9]/', '', $destCteRaw);
        if (!is_string($destCteRaw)) $destCteRaw = '';
        $destCteRaw = substr($destCteRaw, 0, 30);
        $destCte  = pg_escape_string($conn, $destCteRaw);
        $setorCteRaw = strtoupper(trim((string)($cteData['setor'] ?? $cteData['setor_cte'] ?? '')));
        $setorCteRaw = preg_replace('/[^A-Z0-9]/', '', $setorCteRaw);
        if (!is_string($setorCteRaw)) $setorCteRaw = '';
        if ($setorCteRaw === '' && $destCteRaw !== '') $setorCteRaw = $destCteRaw;
        $setorCteRaw = substr($setorCteRaw, 0, 30);
        $setorCteEsc = pg_escape_string($conn, $setorCteRaw);

        if ($jaNoMesmo) {
            $setorUpd = $setorCteRaw !== '' ? ("'{$setorCteEsc}'") : 'setor_cte';
            $destUpd  = $destCteRaw !== '' ? ("'{$destCte}'") : 'destino_cte';
            @pg_query($conn,
                "UPDATE {$tabela}
                 SET setor_cte = {$setorUpd},
                     destino_cte = {$destUpd}
                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                   AND seq_carregamento = {$seqCarreg}
                   AND data_finalizacao IS NULL
                   AND ser_cte = '{$serCte}'
                   AND nro_cte = {$nroCte}"
            );
            continue;
        }
        $unidCarRaw = strtoupper(trim(
            $cteData['unidadeCarregamento']
            ?? $cteData['unidade_carregamento']
            ?? $cteData['unidadeRelatorio']
            ?? ''
        ));
        if ($unidCarRaw === '') $unidCarRaw = $unidade;
        $unidCar  = pg_escape_string($conn, $unidCarRaw);
        $emissaoRaw = trim($cteData['emissao'] ?? '');
        $prevEntRaw = trim($cteData['prevEnt'] ?? '');
        if ($emissaoRaw !== '') {
            $emissaoRaw = preg_replace('/[^\d]/', '/', $emissaoRaw);
            $emissaoRaw = preg_replace('/\/+/', '/', trim($emissaoRaw, '/'));
        }
        if ($prevEntRaw !== '') {
            $prevEntRaw = preg_replace('/[^\d]/', '/', $prevEntRaw);
            $prevEntRaw = preg_replace('/\/+/', '/', trim($prevEntRaw, '/'));
        }
        $emissao  = pg_escape_string($conn, $emissaoRaw);
        $prevEnt  = pg_escape_string($conn, $prevEntRaw);
        $remetente  = pg_escape_string($conn, $cteData['remetente'] ?? '');
        $destinatar = pg_escape_string($conn, $cteData['destinatario'] ?? '');
        $pagador    = pg_escape_string($conn, $cteData['pagador'] ?? '');
        $cidade     = pg_escape_string($conn, $cteData['cidade'] ?? '');

        $vlrMerc  = parseNumeroBr($cteData['vlrNf']  ?? '0');
        $vlrFrete = parseNumeroBr($cteData['frete']  ?? '0');
        $peso     = parseNumeroBr($cteData['peso']   ?? '0');
        $cubagem  = parseNumeroBr($cteData['cubagem'] ?? '0');
        $qtdeVol  = (int)($cteData['qtdeVol'] ?? 0);

        $vlrMerc  = is_numeric($vlrMerc)  ? (float)$vlrMerc  : 0;
        $vlrFrete = is_numeric($vlrFrete) ? (float)$vlrFrete : 0;
        $peso     = is_numeric($peso)     ? (float)$peso     : 0;
        $cubagem  = is_numeric($cubagem)  ? (float)$cubagem  : 0;

        $emissaoSql = 'NULL';
        $prevEntSql = 'NULL';
        $nowYear  = (int)date('Y');
        $nowMonth = (int)date('n');
        if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $emissaoRaw)) {
            $emissaoSql = "TO_DATE('" . $emissao . "', 'DD/MM/YYYY')";
        } elseif (preg_match('/^(\d{2})\/(\d{2})$/', $emissaoRaw, $m)) {
            $y = $nowYear;
            $mm = (int)$m[2];
            if ($nowMonth >= 11 && $mm <= 2) $y = $nowYear + 1;
            $emissaoSql = "TO_DATE('" . $m[1] . '/' . $m[2] . '/' . $y . "', 'DD/MM/YYYY')";
        }
        if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $prevEntRaw)) {
            $prevEntSql = "TO_DATE('" . $prevEnt . "', 'DD/MM/YYYY')";
        } elseif (preg_match('/^(\d{2})\/(\d{2})$/', $prevEntRaw, $m)) {
            $y = $nowYear;
            $mm = (int)$m[2];
            if ($nowMonth >= 11 && $mm <= 2) $y = $nowYear + 1;
            $prevEntSql = "TO_DATE('" . $m[1] . '/' . $m[2] . '/' . $y . "', 'DD/MM/YYYY')";
        }

        $destEsc  = pg_escape_string($conn, $destinoCarreg);
        $unidEsc  = pg_escape_string($conn, $unidadesCarreg);
        $setoresEsc = pg_escape_string($conn, $setoresEntregaCarreg);

        $res = pg_query($conn,
            "INSERT INTO {$tabela}
             (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
              ser_cte, nro_cte, destino_cte, setor_cte, data_emissao_cte, data_prev_ent_cte,
              remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
              vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
              destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento)
             VALUES
             ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
              '{$serCte}', {$nroCte}, '{$destCte}', '{$setorCteEsc}', {$emissaoSql}, {$prevEntSql},
              '{$remetente}', '{$destinatar}', '{$pagador}', '{$cidade}',
              {$vlrMerc}, {$vlrFrete}, {$peso}, {$cubagem}, {$qtdeVol},
              '{$destEsc}', '{$unidEsc}', '{$setoresEsc}', NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '{$unidCar}')"
        );

        if (!$res) {
            pg_query($conn, 'ROLLBACK');
            respondJson(['success' => false, 'message' => 'Erro ao adicionar CT-es: ' . pg_last_error($conn)]);
        }
        $adicionados++;
    }

    // Remove sentinela (nro_cte = 0) se adicionou CT-es reais
    if ($adicionados > 0) {
        pg_query($conn,
            "DELETE FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND seq_carregamento = {$seqCarreg}
               AND nro_cte = 0
               AND data_finalizacao IS NULL"
        );
    }

    if (preg_match('/^[A-Z0-9]{2,5}$/', $placa)) {
        @pg_query($conn,
            "UPDATE {$tabela}
             SET setor_cte = regexp_replace(COALESCE(setor_cte, ''), '[^A-Z0-9]', '', 'g'),
                 destino_cte = regexp_replace(COALESCE(destino_cte, ''), '[^A-Z0-9]', '', 'g')
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND seq_carregamento = {$seqCarreg}
               AND data_finalizacao IS NULL
            "
        );
        @pg_query($conn,
            "UPDATE {$tabela}
             SET setor_cte = destino_cte
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND seq_carregamento = {$seqCarreg}
               AND data_finalizacao IS NULL
               AND COALESCE(setor_cte, '') = ''
               AND COALESCE(destino_cte, '') <> ''"
        );
    }

    pg_query($conn, 'COMMIT');
    respondJson(['success' => true, 'adicionados' => $adicionados, 'ignorados' => $ignorados]);
}

// ─── Ação: remover CT-e ───────────────────────────────────────────────────────
if ($acao === 'remover_cte') {
    $seqCarInput = (int)($input['seq_carregamento'] ?? 0);
    $placa  = strtoupper(trim((string)($input['placa'] ?? '')));
    $nroCte = (int)($input['seq_cte'] ?? $input['nro_cte'] ?? 0);

    if ($nroCte <= 0 || ($seqCarInput <= 0 && $placa === '')) {
        respondJson(['success' => false, 'message' => 'Parâmetros inválidos.']);
    }

    $identSql = ($seqCarInput > 0)
        ? ("seq_carregamento = " . (int)$seqCarInput)
        : ("placa_provisoria = '" . pg_escape_string($conn, $placa) . "'");

    $seqCarreg = 0;
    $placaDb = '';
    $destinoCarreg = '';
    $unidadesCarreg = '';
    $setoresEntregaCarreg = '';
    $origemCriacaoCarreg = '';

    $resMeta = @pg_query($conn,
        "SELECT seq_carregamento, placa_provisoria, destino, unidades, setores_entrega, origem_criacao
         FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL
           AND {$identSql}
         LIMIT 1"
    );
    if (!$resMeta || pg_num_rows($resMeta) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento não encontrado.']);
    }
    $rowM = pg_fetch_assoc($resMeta);
    $seqCarreg = (int)($rowM['seq_carregamento'] ?? 0);
    $placaDb = strtoupper(trim((string)($rowM['placa_provisoria'] ?? '')));
    $destinoCarreg = (string)($rowM['destino'] ?? '');
    $unidadesCarreg = (string)($rowM['unidades'] ?? '');
    $setoresEntregaCarreg = (string)($rowM['setores_entrega'] ?? '');
    $origemCriacaoCarreg = strtoupper(trim((string)($rowM['origem_criacao'] ?? '')));

    $placaUse = $placa !== '' ? $placa : $placaDb;
    if ($placaUse === '') {
        respondJson(['success' => false, 'message' => 'Placa não encontrada para este carregamento.']);
    }

    $res = pg_query($conn,
        "DELETE FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL
           AND {$identSql}
           AND nro_cte = {$nroCte}"
    );
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao remover CT-e.']);
    }
    $removidos = pg_affected_rows($res);

    $checkRestantes = pg_query($conn,
        "SELECT 1 FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL
           AND {$identSql}
           AND nro_cte > 0
         LIMIT 1"
    );
    if (!$checkRestantes || pg_num_rows($checkRestantes) === 0) {
        $temEmAndamento = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND data_finalizacao IS NULL
               AND {$identSql}
             LIMIT 1"
        );
        if ($temEmAndamento && pg_num_rows($temEmAndamento) > 0) {
            $origemCriacao = $origemCriacaoCarreg !== '' ? $origemCriacaoCarreg : 'MANUAL';
            $destinoSql = $destinoCarreg !== '' ? "'" . pg_escape_string($conn, $destinoCarreg) . "'" : 'NULL';
            $unidadesSql = $unidadesCarreg !== '' ? "'" . pg_escape_string($conn, $unidadesCarreg) . "'" : 'NULL';
            $setoresSql = $setoresEntregaCarreg !== '' ? "'" . pg_escape_string($conn, $setoresEntregaCarreg) . "'" : 'NULL';
            pg_query($conn,
                "INSERT INTO {$tabela} (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento)
                 VALUES ('" . pg_escape_string($conn, $unidade) . "', " . ((int)$seqCarreg) . ", '" . pg_escape_string($conn, $placaUse) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, {$destinoSql}, {$unidadesSql}, {$setoresSql}, NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "')"
            );
        }
    }

    respondJson(['success' => true, 'removidos' => $removidos]);
}

if ($acao === 'remover_ctes') {
    $seqCarInput = (int)($input['seq_carregamento'] ?? 0);
    $placa  = strtoupper(trim((string)($input['placa'] ?? '')));
    $seqsIn = $input['seq_ctes'] ?? $input['seqs'] ?? $input['ctes'] ?? [];

    if (is_string($seqsIn)) {
        $seqsIn = preg_split('/[^0-9]+/', $seqsIn);
    }
    if (!is_array($seqsIn)) $seqsIn = [];

    if ($seqCarInput <= 0 && $placa === '') {
        respondJson(['success' => false, 'message' => 'seq_carregamento inválido.']);
    }

    $ids = [];
    foreach ($seqsIn as $v) {
        $n = (int)$v;
        if ($n > 0) $ids[] = $n;
    }
    $ids = array_values(array_unique($ids));
    if (count($ids) === 0) {
        respondJson(['success' => false, 'message' => 'Nenhum CT-e válido informado.']);
    }

    $identSql = ($seqCarInput > 0)
        ? ("seq_carregamento = " . (int)$seqCarInput)
        : ("placa_provisoria = '" . pg_escape_string($conn, $placa) . "'");

    $seqCarreg = 0;
    $placaDb = '';
    $destinoCarreg = '';
    $unidadesCarreg = '';
    $setoresEntregaCarreg = '';
    $origemCriacaoCarreg = '';
    $resMeta = @pg_query($conn,
        "SELECT seq_carregamento, placa_provisoria, destino, unidades, setores_entrega, origem_criacao
         FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL
           AND {$identSql}
         LIMIT 1"
    );
    if (!$resMeta || pg_num_rows($resMeta) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento não encontrado.']);
    }
    $rowM = pg_fetch_assoc($resMeta);
    $seqCarreg = (int)($rowM['seq_carregamento'] ?? 0);
    $placaDb = strtoupper(trim((string)($rowM['placa_provisoria'] ?? '')));
    $destinoCarreg = (string)($rowM['destino'] ?? '');
    $unidadesCarreg = (string)($rowM['unidades'] ?? '');
    $setoresEntregaCarreg = (string)($rowM['setores_entrega'] ?? '');
    $origemCriacaoCarreg = strtoupper(trim((string)($rowM['origem_criacao'] ?? '')));

    $placaUse = $placa !== '' ? $placa : $placaDb;
    if ($placaUse === '') {
        respondJson(['success' => false, 'message' => 'Placa não encontrada para este carregamento.']);
    }

    pg_query($conn, 'BEGIN');
    $idsSql = implode(',', $ids);
    $res = pg_query($conn,
        "DELETE FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL
           AND {$identSql}
           AND nro_cte IN ({$idsSql})"
    );

    if (!$res) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao remover CT-es.']);
    }

    $removidos = pg_affected_rows($res);

    $checkRestantes = pg_query($conn,
        "SELECT 1 FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND nro_cte > 0
           AND data_finalizacao IS NULL
           AND {$identSql}
         LIMIT 1"
    );
    if (!$checkRestantes || pg_num_rows($checkRestantes) === 0) {
        $temEmAndamento = pg_query($conn,
            "SELECT 1 FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND data_finalizacao IS NULL
               AND {$identSql}
             LIMIT 1"
        );
        if ($temEmAndamento && pg_num_rows($temEmAndamento) > 0) {
            $origemCriacao = $origemCriacaoCarreg !== '' ? $origemCriacaoCarreg : 'MANUAL';
            $destinoSql = $destinoCarreg !== '' ? "'" . pg_escape_string($conn, $destinoCarreg) . "'" : 'NULL';
            $unidadesSql = $unidadesCarreg !== '' ? "'" . pg_escape_string($conn, $unidadesCarreg) . "'" : 'NULL';
            $setoresSql = $setoresEntregaCarreg !== '' ? "'" . pg_escape_string($conn, $setoresEntregaCarreg) . "'" : 'NULL';
            pg_query($conn,
                "INSERT INTO {$tabela} (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte, destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento)
                 VALUES ('" . pg_escape_string($conn, $unidade) . "', " . ((int)$seqCarreg) . ", '" . pg_escape_string($conn, $placaUse) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME, 0, {$destinoSql}, {$unidadesSql}, {$setoresSql}, NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "')"
            );
        }
    }

    pg_query($conn, 'COMMIT');
    respondJson(['success' => true, 'removidos' => $removidos]);
}

// ─── Ação: excluir carregamento ───────────────────────────────────────────────
if ($acao === 'excluir_carregamento') {
    $placa = strtoupper(trim($input['placa'] ?? ''));
    if (empty($placa)) {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '" . pg_escape_string($conn, $login) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
           AND data_finalizacao IS NULL"
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao finalizar carregamento.']);
    }

    $affected = pg_affected_rows($res);
    if ($affected <= 0) {
        respondJson(['success' => true, 'already' => true]);
    }
    respondJson(['success' => true, 'updated' => $affected]);
}

// ─── Ação: deletar carregamento (exclusão física) ─────────────────────────────
if ($acao === 'deletar_carregamento') {
    $placa = strtoupper(trim((string)($input['placa'] ?? '')));
    $seqCarregInput = (int)($input['seq_carregamento'] ?? 0);
    if ($placa === '') {
        if ($seqCarregInput <= 0) respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $seqCarreg = 0;
    if ($seqCarregInput > 0) {
        $seqCarreg = $seqCarregInput;
    } else {
        $resSeq = sql(
            "SELECT seq_carregamento
             FROM {$tabela}
             WHERE unidade = \$1
               AND placa_provisoria = \$2
             ORDER BY COALESCE(seq_carregamento, 0) DESC
             LIMIT 1",
            [$unidade, $placa],
            $conn
        );
        if ($resSeq && pg_num_rows($resSeq) > 0) {
            $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
        }
    }

    $resDel = null;
    if ($seqCarreg > 0) {
        $resDel = sql(
            "DELETE FROM {$tabela}
             WHERE unidade = \$1
               AND seq_carregamento = \$2
               AND data_finalizacao IS NULL",
            [$unidade, $seqCarreg],
            $conn
        );
    } else {
        $resDel = sql(
            "DELETE FROM {$tabela}
             WHERE unidade = \$1
               AND placa_provisoria = \$2
               AND data_finalizacao IS NULL",
            [$unidade, $placa],
            $conn
        );
    }
    if (!$resDel) {
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamento.']);
    }

    $deleted = pg_affected_rows($resDel);

    // Remove parâmetros associados (capacidade) se existir
    if ($deleted > 0) {
        if ($seqCarreg > 0) {
            @pg_query($conn,
                "DELETE FROM {$tabelaCap}
                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                   AND seq_carregamento = " . ((int)$seqCarreg)
            );
        } elseif ($placa !== '') {
            // Protegemos o delete por placa da tabelaCap apenas se o carregamento está em andamento
            $seqsCap = sql(
                "SELECT DISTINCT COALESCE(c.seq_carregamento, 0) AS s
                 FROM {$tabela} c
                 WHERE c.unidade = \$1
                   AND UPPER(c.placa_provisoria) = UPPER(\$2)
                   AND c.data_finalizacao IS NULL",
                [$unidade, $placa],
                $conn
            );
            $toDeleteCap = [];
            if ($seqsCap) {
                while ($r = pg_fetch_assoc($seqsCap)) {
                    $v = (int)($r['s'] ?? 0);
                    if ($v > 0) $toDeleteCap[] = $v;
                }
            }
            if (!empty($toDeleteCap)) {
                $in = implode(',', array_map('intval', array_unique($toDeleteCap)));
                @pg_query($conn,
                    "DELETE FROM {$tabelaCap}
                     WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                       AND seq_carregamento IN ({$in})"
                );
            }
        }
    }

    respondJson(['success' => true, 'deleted' => $deleted]);
}

if ($acao === 'deletar_todos_entrega') {
    $resSeq = sql(
        "SELECT DISTINCT COALESCE(seq_carregamento, 0) AS seq_carregamento
         FROM {$tabela}
         WHERE unidade = \$1
           AND data_finalizacao IS NULL
           AND COALESCE(destino, '') = ''
           AND COALESCE(setores_entrega, '') <> ''",
        [$unidade],
        $conn
    );
    $seqs = [];
    if ($resSeq) {
        while ($r = pg_fetch_assoc($resSeq)) {
            $s = (int)($r['seq_carregamento'] ?? 0);
            if ($s > 0) $seqs[] = $s;
        }
    }
    $seqs = array_values(array_unique($seqs));

    pg_query($conn, 'BEGIN');
    try {
        $resDel = sql(
            "DELETE FROM {$tabela}
             WHERE unidade = \$1
               AND data_finalizacao IS NULL
               AND COALESCE(destino, '') = ''
               AND COALESCE(setores_entrega, '') <> ''",
            [$unidade],
            $conn
        );
        if (!$resDel) {
            pg_query($conn, 'ROLLBACK');
            respondJson(['success' => false, 'message' => 'Erro ao excluir carregamentos de entrega.']);
        }
        $deleted = pg_affected_rows($resDel);

        $deletedCap = 0;
        if (!empty($seqs)) {
            $in = implode(',', array_map('intval', $seqs));
            $capRes = @pg_query($conn,
                "DELETE FROM {$tabelaCap}
                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                   AND seq_carregamento IN ({$in})"
            );
            if ($capRes) $deletedCap = pg_affected_rows($capRes);
        }

        pg_query($conn, 'COMMIT');
        respondJson([
            'success' => true,
            'deleted' => $deleted,
            'deleted_cap' => $deletedCap,
            'carregamentos' => count($seqs),
        ]);
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamentos de entrega.']);
    }
}

// ─── Ação: deletar carregamento finalizado (exclusão física) ──────────────────
if ($acao === 'deletar_carregamento_finalizado') {
    $placa = strtoupper(trim((string)($input['placa'] ?? '')));
    $seqCarreg = (int)($input['seq_carregamento'] ?? 0);
    if ($placa === '' && $seqCarreg <= 0) {
        respondJson(['success' => false, 'message' => 'Placa ou seq_carregamento não informado.']);
    }

    if ($seqCarreg > 0) {
        $resDel = sql(
            "DELETE FROM {$tabela}
             WHERE unidade = \$1
               AND seq_carregamento = \$2
               AND data_finalizacao IS NOT NULL",
            [$unidade, $seqCarreg],
            $conn
        );
        if (!$resDel) {
            respondJson(['success' => false, 'message' => 'Erro ao excluir carregamento finalizado.']);
        }
        $deleted = pg_affected_rows($resDel);
        sql(
            "DELETE FROM {$tabelaCap}
             WHERE unidade = \$1
               AND seq_carregamento = \$2",
            [$unidade, $seqCarreg],
            $conn
        );
        respondJson(['success' => true, 'deleted' => $deleted]);
    }

    $resDel = sql(
        "DELETE FROM {$tabela}
         WHERE unidade = \$1
           AND placa_provisoria = \$2
           AND data_finalizacao IS NOT NULL",
        [$unidade, $placa],
        $conn
    );
    if (!$resDel) {
        respondJson(['success' => false, 'message' => 'Erro ao excluir carregamento finalizado.']);
    }
    $deleted = pg_affected_rows($resDel);
    sql(
        "DELETE FROM {$tabelaCap}
         WHERE unidade = \$1
           AND placa_provisoria = \$2",
        [$unidade, $placa],
        $conn
    );
    respondJson(['success' => true, 'deleted' => $deleted]);
}

// ─── Ação: atualizar placa ────────────────────────────────────────────────────
if ($acao === 'atualizar_placa') {
    $placaAntiga = strtoupper(trim($input['placa_antiga'] ?? ''));
    $placaNova   = strtoupper(trim($input['placa_nova'] ?? ''));

    if (empty($placaAntiga) || empty($placaNova)) {
        respondJson(['success' => false, 'message' => 'Placas não informadas.']);
    }

    $check = pg_query($conn,
        "SELECT 1 FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         LIMIT 1"
    );
    if ($check && pg_num_rows($check) > 0) {
        respondJson(['success' => false, 'message' => "Já existe um carregamento com a placa {$placaNova}."]);
    }

    $seqCarreg = 0;
    $resSeq = @pg_query($conn,
        "SELECT seq_carregamento FROM {$tabela}
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'
           AND data_finalizacao IS NULL
         LIMIT 1"
    );
    if ($resSeq && pg_num_rows($resSeq) > 0) {
        $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
    }

    $whereCar = ($seqCarreg > 0)
        ? ("seq_carregamento = " . (int)$seqCarreg . " AND data_finalizacao IS NULL")
        : ("placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'");

    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND {$whereCar}"
    );
    if (!$res) respondJson(['success' => false, 'message' => 'Erro ao atualizar placa.']);

    // Atualiza na capacidade também
    $whereCap = ($seqCarreg > 0)
        ? ("seq_carregamento = " . (int)$seqCarreg)
        : ("placa_provisoria = '" . pg_escape_string($conn, $placaAntiga) . "'");

    pg_query($conn,
        "UPDATE {$tabelaCap}
         SET placa_provisoria = '" . pg_escape_string($conn, $placaNova) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND {$whereCap}"
    );

    respondJson(['success' => true]);
}

// ─── Ação: atualizar capacidade ───────────────────────────────────────────────
if ($acao === 'atualizar_capacidade') {
    $placa  = strtoupper(trim($input['placa'] ?? ''));
    $seqCarreg = (int)($input['seq_carregamento'] ?? 0);
    $capTon = ($input['cap_ton'] !== '' && $input['cap_ton'] !== null) ? (float)$input['cap_ton'] : null;
    $capM3  = ($input['cap_m3']  !== '' && $input['cap_m3']  !== null) ? (float)$input['cap_m3']  : null;
    $vlrMinFrete = ($input['vlr_min_frete'] !== '' && $input['vlr_min_frete'] !== null) ? (float)$input['vlr_min_frete'] : null;
    $vlrFreteCarreteiro = ($input['vlr_frete_carreteiro'] !== '' && $input['vlr_frete_carreteiro'] !== null) ? (float)$input['vlr_frete_carreteiro'] : null;
    $destinoLinha = strtoupper(trim((string)($input['destino'] ?? '')));
    $paradasLinha = strtoupper(trim((string)($input['paradas'] ?? $input['unidades'] ?? '')));
    $nroLinha = ($input['nro_linha'] !== '' && $input['nro_linha'] !== null) ? (int)$input['nro_linha'] : null;

    if (empty($placa)) respondJson(['success' => false, 'message' => 'Placa não informada.']);

    $capTonSql = $capTon !== null ? $capTon : 'NULL';
    $capM3Sql  = $capM3  !== null ? $capM3  : 'NULL';
    $vlrTerSql = $vlrFreteCarreteiro !== null ? $vlrFreteCarreteiro : 'NULL';

    if ($seqCarreg <= 0) {
        $resSeq = @pg_query($conn,
            "SELECT seq_carregamento FROM {$tabela}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND data_finalizacao IS NULL
             LIMIT 1"
        );
        if ($resSeq && pg_num_rows($resSeq) > 0) {
            $seqCarreg = (int)pg_fetch_result($resSeq, 0, 0);
        }
    }
    if ($seqCarreg <= 0) {
        $seqCarreg = nextSeqCarregamento($conn, $seqName);
        if ($seqCarreg <= 0) respondJson(['success' => false, 'message' => 'Erro ao gerar seq_carregamento.']);
        @pg_query($conn,
            "UPDATE {$tabela}
             SET seq_carregamento = {$seqCarreg}
             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
               AND placa_provisoria = '" . pg_escape_string($conn, $placa) . "'
               AND data_finalizacao IS NULL"
        );
    }

    $nroLinhaSql = $nroLinha !== null ? $nroLinha : 'NULL';

    pg_query($conn, "
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

    $tpCarreg = resolverTpCarregamento($conn, $tabela, $tabelaCap, $unidade, $seqCarreg, $destinoLinha);
    pg_query($conn,
        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, cap_ton, cap_m3, vlr_frete_carreteiro, nro_linha, tp_carregamento)
         VALUES ('" . pg_escape_string($conn, $unidade) . "', " . ((int)$seqCarreg) . ", '" . pg_escape_string($conn, $placa) . "', {$capTonSql}, {$capM3Sql}, {$vlrTerSql}, {$nroLinhaSql}, '{$tpCarreg}')
         ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, cap_ton = EXCLUDED.cap_ton, cap_m3 = EXCLUDED.cap_m3, vlr_frete_carreteiro = EXCLUDED.vlr_frete_carreteiro, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha), tp_carregamento = COALESCE({$tabelaCap}.tp_carregamento, EXCLUDED.tp_carregamento)"
    );

    $placaNorm = strtoupper(trim($placa));
    $isPlacaReal = (bool)(
        preg_match('/^[A-Z]{3}[0-9]{4}$/', $placaNorm)
        || preg_match('/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/', $placaNorm)
    );
    if ($isPlacaReal) {
        $resVeic = @pg_query($conn,
            "UPDATE {$tabelaVeiculo}
             SET capacidade_ton = {$capTonSql},
                 capacidade_m3 = {$capM3Sql}
             WHERE UPPER(placa) = UPPER('" . pg_escape_string($conn, $placa) . "')"
        );
        if ($resVeic === false) {
            @pg_query($conn,
                "UPDATE {$tabelaVeiculo}
                 SET capacidade_ton = {$capTonSql},
                     capacidade_m3 = {$capM3Sql}
                 WHERE UPPER(placa) = UPPER('" . pg_escape_string($conn, $placa) . "')"
            );
        }
    }

    $atualizouLinha = false;
    if ($vlrMinFrete !== null && $destinoLinha !== '') {
        $vlrMinSql = $vlrMinFrete;
        $paradasNorm = $paradasLinha;
        $paradasNorm = preg_replace('/\s+/', ' ', trim($paradasNorm));
        $resLinha = @pg_query($conn,
            "UPDATE {$tabelaLinha}
             SET vlr_min_frete = {$vlrMinSql}
             WHERE sigla_emit = '" . pg_escape_string($conn, $unidade) . "'
               AND sigla_dest = '" . pg_escape_string($conn, $destinoLinha) . "'
               AND COALESCE(unidades, '') = '" . pg_escape_string($conn, $paradasNorm) . "'"
        );
        if ($resLinha && pg_affected_rows($resLinha) > 0) $atualizouLinha = true;
    }

    respondJson(['success' => true, 'atualizou_linha' => $atualizouLinha]);
}

// ─── Ação: excluir todos ──────────────────────────────────────────────────────
if ($acao === 'excluir_todos') {
    $res = pg_query($conn,
        "UPDATE {$tabela}
         SET data_finalizacao = CURRENT_DATE,
             hora_finalizacao = CURRENT_TIME,
             login_finalizacao = '" . pg_escape_string($conn, $login) . "'
         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
           AND data_finalizacao IS NULL"
    );
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao finalizar carregamentos.']);
    }
    respondJson(['success' => true, 'updated' => pg_affected_rows($res)]);
}

// ─── Ação: finalizar carregamento ─────────────────────────────────────────────
if ($acao === 'finalizar_carregamento') {
    $placa = strtoupper(trim((string)($input['placa'] ?? '')));
    if ($placa === '') {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $dtFinalizacao = null;
    try {
        $dtFinalizacao = _atualizarCtesAntesFinalizar($conn, $domain, $tabela, $tabelaCap, $seqName, $unidade, $login, $placa);
    } catch (Exception $e) {
    }

    $dtUse = null;
    if (is_array($dtFinalizacao) && ($dtFinalizacao['dt'] ?? null) instanceof DateTime) {
        $dtUse = $dtFinalizacao['dt'];
    } else {
        $dtUse = new DateTime();
    }
    $dataFin = $dtUse->format('Y-m-d');
    $horaFin = $dtUse->format('H:i:s');

    $res = sql(
        "UPDATE {$tabela}
         SET data_finalizacao = $1::date,
             hora_finalizacao = $2::time,
             login_finalizacao = $3
         WHERE unidade = $4
           AND placa_provisoria = $5
           AND data_finalizacao IS NULL",
        [$dataFin, $horaFin, $login, $unidade, $placa],
        $conn
    );

    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao finalizar carregamento.']);
    }

    $affected = pg_affected_rows($res);
    if ($affected <= 0) {
        respondJson(['success' => true, 'already' => true]);
    }

    respondJson(['success' => true, 'updated' => $affected]);
}

if ($acao === 'verificar_saidas_ssw') {
    $ddmmaaHoje = date('dmy');
    $ddmmaaOntem = date('dmy', strtotime('-1 day'));

    $url = "https://sistema.ssw.inf.br/bin/ssw0125?act=PER&t_sigla_origem=" . rawurlencode($unidade) .
        "&t_data_saida_ini=" . rawurlencode($ddmmaaOntem) .
        "&t_data_saida_fin=" . rawurlencode($ddmmaaHoje);

    $extractXml = function ($html) {
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
        if ($inicio === false) return null;

        $fim = strrpos($html, '</xml>');
        $tagFim = '</xml>';
        if ($fim === false) {
            $fim = strrpos($html, '</data>');
            $tagFim = '</data>';
        }
        if ($fim === false) return null;

        return substr($html, $inicio, ($fim + strlen($tagFim)) - $inicio);
    };

    $parseDt = function ($s) {
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
        $dt = DateTime::createFromFormat('d/m/y H:i:s', $s);
        if ($dt !== false) return $dt;
        $dt = DateTime::createFromFormat('d/m/Y H:i:s', $s);
        if ($dt !== false) return $dt;
        $dt = DateTime::createFromFormat('d/m/y H:i', $s);
        if ($dt !== false) return $dt;
        $dt = DateTime::createFromFormat('d/m/Y H:i', $s);
        if ($dt !== false) return $dt;
        return null;
    };

    $html = '';
    try {
        require_ssw();
        ssw_login($domain);
        $html = ssw_go($url);
    } catch (Exception $e) {
        respondJson(['success' => true, 'updated' => 0, 'message' => 'Falha ao consultar o SSW.']);
    }

    $xmlStr = $extractXml($html);
    if ($xmlStr === null) {
        respondJson(['success' => true, 'updated' => 0, 'message' => 'SSW: retorno sem XML.']);
    }

    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) {
        respondJson(['success' => true, 'updated' => 0, 'message' => 'SSW: XML inválido.']);
    }

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
            $dt = $parseDt($f11);
            if ($dt === null) continue;

            $f8Raw = trim((string)($r->f8 ?? ''));
            $f8Num = (int)preg_replace('/[^\d]/', '', $f8Raw);
            $f17 = trim((string)($r->f17 ?? ''));
            $seqMan = (string)preg_replace('/[^\d]/', '', $f17);

            if (!isset($placaParaInfo[$placa])) {
                $placaParaInfo[$placa] = [
                    'saida' => $dt,
                    'qtd' => 0,
                    'manifestos' => [],
                ];
            }
            if ($dt->getTimestamp() < $placaParaInfo[$placa]['saida']->getTimestamp()) {
                $placaParaInfo[$placa]['saida'] = $dt;
            }
            if ($f8Num > 0) $placaParaInfo[$placa]['qtd'] += $f8Num;
            if ($seqMan !== '') $placaParaInfo[$placa]['manifestos'][$seqMan] = true;
        }
    }

    if (count($placaParaInfo) === 0) {
        respondJson(['success' => true, 'updated' => 0]);
    }

    $resOpen = sql(
        "SELECT DISTINCT UPPER(c.placa_provisoria) AS placa
         FROM {$tabela} c
         LEFT JOIN {$tabelaCap} cap
                ON cap.unidade = c.unidade AND cap.seq_carregamento = c.seq_carregamento
         WHERE c.unidade = \$1
           AND c.data_finalizacao IS NULL
           AND COALESCE(cap.simulado, FALSE) = FALSE",
        [$unidade],
        $conn
    );
    $open = [];
    while ($resOpen && ($row = pg_fetch_assoc($resOpen))) {
        $p = strtoupper(trim((string)($row['placa'] ?? '')));
        if ($p !== '') $open[$p] = true;
    }

    $conjuntoPorPlaca = [];
    try {
        $resConj = sql(
            "SELECT
                cap.seq_carregamento AS seq1,
                cap.seq_carregamento_conjunto AS seq2,
                (SELECT placa_provisoria FROM {$tabela} c1 WHERE c1.unidade = cap.unidade AND c1.seq_carregamento = cap.seq_carregamento LIMIT 1) AS placa1,
                (SELECT placa_provisoria FROM {$tabela} c2 WHERE c2.unidade = cap.unidade AND c2.seq_carregamento = cap.seq_carregamento_conjunto LIMIT 1) AS placa2
             FROM {$tabelaCap} cap
             WHERE cap.unidade = \$1
               AND COALESCE(cap.seq_carregamento_conjunto, 0) > 0",
            [$unidade],
            $conn
        );
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

    $tblCte = "{$domain}_cte";
    $cteTableOk = false;
    try {
        $resReg = sql("SELECT to_regclass($1) AS reg", [$tblCte], $conn);
        $val = $resReg ? pg_fetch_result($resReg, 0, 0) : null;
        $cteTableOk = ($val !== null && $val !== '');
    } catch (Exception $e) {
        $cteTableOk = false;
    }

    $colCache = [];
    $cteCol = function(string $col) use (&$colCache, $conn, $tblCte): bool {
        $c = strtolower(trim($col));
        if ($c === '') return false;
        if (isset($colCache[$c])) return (bool)$colCache[$c];
        $res = null;
        try {
            $res = sql(
                "SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = lower($1)
                   AND column_name = $2
                 LIMIT 1",
                [strtolower($tblCte), $c],
                $conn
            );
        } catch (Exception $e) {}
        $ok = ($res && pg_num_rows($res) > 0);
        $colCache[$c] = $ok;
        return $ok;
    };

    $updated = 0;
    foreach ($placaParaInfo as $placa => $info) {
        if (!isset($open[$placa])) continue;
        $placasFinalizar = isset($conjuntoPorPlaca[$placa]) ? $conjuntoPorPlaca[$placa] : [$placa];
        $dt = $info['saida'];
        $data = $dt->format('Y-m-d');
        $hora = $dt->format('H:i:s');

        $qtdSsw = (int)($info['qtd'] ?? 0);
        $manifestos = isset($info['manifestos']) && is_array($info['manifestos']) ? array_keys($info['manifestos']) : [];

        $qtdPresto = 0;
        try {
            $filtroSerieRve = (strtoupper($domain) === 'RVE') ? " AND UPPER(COALESCE(ser_cte, '')) <> 'SAS'" : "";
            $resQtd = sql(
                "SELECT COUNT(*) AS qtd
                 FROM {$tabela}
                 WHERE unidade = $1
                   AND UPPER(placa_provisoria) = $2
                   AND nro_cte > 0
                   {$filtroSerieRve}",
                [$unidade, $placa],
                $conn
            );
            if ($resQtd && pg_num_rows($resQtd) > 0) $qtdPresto = (int)pg_fetch_result($resQtd, 0, 0);
        } catch (Exception $e) {}

        if (count($manifestos) > 0) {
            $toFloat = function ($v) {
                $s = trim((string)$v);
                if ($s === '') return 0.0;
                $s = preg_replace('/[^\d,\.\-]/', '', $s);
                if ($s === '' || $s === '-') return 0.0;
                $hasComma = (strpos($s, ',') !== false);
                $hasDot = (strpos($s, '.') !== false);
                if ($hasComma) {
                    $s = str_replace('.', '', $s);
                    $s = str_replace(',', '.', $s);
                } else if ($hasDot && preg_match('/^\-?\d{1,3}(\.\d{3})+$/', $s) && !preg_match('/^\-?0\.\d+$/', $s)) {
                    $s = str_replace('.', '', $s);
                }
                return (float)$s;
            };
            $parseDateBr = function ($v) {
                $s = trim((string)$v);
                if ($s === '') return null;
                $dt = DateTime::createFromFormat('d/m/y', $s);
                if ($dt !== false) return $dt->format('Y-m-d');
                $dt = DateTime::createFromFormat('d/m/Y', $s);
                if ($dt !== false) return $dt->format('Y-m-d');
                return null;
            };
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
                $xmlManStr = $extractXml($htmlMan);
                if ($xmlManStr === null) continue;
                $xmlMan = @simplexml_load_string($xmlManStr);
                if ($xmlMan === false) continue;
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
                            'data_emissao' => $parseDateBr((string)($rm->f2 ?? '')),
                            'data_prev_ent' => $parseDateBr((string)($rm->f12 ?? '')),
                            'vlr_merc' => $toFloat((string)($rm->f9 ?? '')),
                            'vlr_frete' => $toFloat((string)($rm->f10 ?? '')),
                            'peso' => $toFloat((string)($rm->f8 ?? '')),
                            'cubagem' => 0.0,
                            'qtde_vol' => (int)preg_replace('/[^\d]/', '', (string)($rm->f7 ?? '')),
                        ];
                    }
                }
            }

            if (count($pairs) > 0) {
                $seqCarreg = 0;
                $destinoCarreg = '';
                $unidadesCarreg = '';
                $setoresEntregaCarreg = '';
                $origemCriacao = '';
                $resCarreg = null;
                try {
                    $resCarreg = sql(
                        "SELECT seq_carregamento, destino, unidades, setores_entrega, origem_criacao
                         FROM {$tabela}
                         WHERE unidade = $1
                           AND UPPER(placa_provisoria) = $2
                           AND data_finalizacao IS NULL
                         LIMIT 1",
                        [$unidade, $placa],
                        $conn
                    );
                } catch (Exception $e) {}
                if ($resCarreg && pg_num_rows($resCarreg) > 0) {
                    $rowCar = pg_fetch_assoc($resCarreg);
                    $seqCarreg = (int)($rowCar['seq_carregamento'] ?? 0);
                    $destinoCarreg = (string)($rowCar['destino'] ?? '');
                    $unidadesCarreg = (string)($rowCar['unidades'] ?? '');
                    $setoresEntregaCarreg = (string)($rowCar['setores_entrega'] ?? '');
                    $origemCriacao = strtoupper(trim((string)($rowCar['origem_criacao'] ?? '')));
                }
                if ($origemCriacao === '') $origemCriacao = 'SSW';

                if ($seqCarreg <= 0) {
                    $seqCarreg = nextSeqCarregamento($conn, $seqName);
                    if ($seqCarreg > 0) {
                        @pg_query($conn,
                            "UPDATE {$tabela}
                             SET seq_carregamento = {$seqCarreg}
                             WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                               AND UPPER(placa_provisoria) = '" . pg_escape_string($conn, $placa) . "'
                               AND data_finalizacao IS NULL"
                        );
                        $tpCarregAuto = resolverTpCarregamento($conn, $tabela, $tabelaCap, $unidade, $seqCarreg, $destinoCarreg);
                        @pg_query($conn,
                            "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, nro_linha, tp_carregamento)
                             VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', NULL, '{$tpCarregAuto}')
                             ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha), tp_carregamento = COALESCE({$tabelaCap}.tp_carregamento, EXCLUDED.tp_carregamento)"
                        );
                    }
                }

                if ($seqCarreg > 0) {
                    $cteInfo = [];
                    if ($cteTableOk) {
                        $selDest = $cteCol('sigla_dest') ? "UPPER(BTRIM(cte.sigla_dest))" : "''";
                        $joinCidade = $cteCol('seq_cidade_dest') ? "LEFT JOIN cidade cid_dest ON cte.seq_cidade_dest = cid_dest.seq_cidade" : "";
                        $selCidade = $cteCol('seq_cidade_dest') ? "COALESCE(cid_dest.nome, '')" : "''";
                        $selRemet = $cteCol('nome_emit') ? "COALESCE(cte.nome_emit, '')" : "''";
                        $selDestinat = $cteCol('nome_dest') ? "COALESCE(cte.nome_dest, '')" : "''";
                        $selPagador = $cteCol('nome_pag') ? "COALESCE(cte.nome_pag, '')" : "''";
                        $selEmissao = $cteCol('data_emissao') ? "cte.data_emissao::date" : "NULL::date";
                        $selPrev = $cteCol('data_prev_ent') ? "cte.data_prev_ent::date" : "NULL::date";
                        $selMerc = $cteCol('vlr_merc') ? "COALESCE(cte.vlr_merc, 0)" : "0";
                        $selFrete = $cteCol('vlr_frete') ? "COALESCE(cte.vlr_frete, 0)" : "0";
                        $selPeso = $cteCol('peso_real') ? "COALESCE(cte.peso_real, 0)" : ($cteCol('peso_calc') ? "COALESCE(cte.peso_calc, 0)" : "0");
                        $selCub = $cteCol('cubagem') ? "COALESCE(cte.cubagem, 0)" : "0";
                        $selVol = $cteCol('qtde_vol') ? "COALESCE(cte.qtde_vol, 0)" : "0";

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
                                    {$selDestinat} AS destinatario,
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
                    }

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
                            'vlr_merc' => $toFloat($rowC['vlr_merc'] ?? ($cteXml[$k]['vlr_merc'] ?? 0)),
                            'vlr_frete' => $toFloat($rowC['vlr_frete'] ?? ($cteXml[$k]['vlr_frete'] ?? 0)),
                            'peso' => $toFloat($rowC['peso'] ?? ($cteXml[$k]['peso'] ?? 0)),
                            'cubagem' => $toFloat($rowC['cubagem'] ?? 0),
                            'qtde_vol' => (int)($rowC['qtde_vol'] ?? ($cteXml[$k]['qtde_vol'] ?? 0)),
                        ];
                    }

                    if (count($cteAll) > 0) {
                        pg_query($conn, 'BEGIN');
                        try {
                            $add = 0;
                            foreach ($cteAll as $rowC) {
                                $ser = strtoupper(trim((string)($rowC['ser_cte'] ?? '')));
                                $nro = (int)($rowC['nro_cte'] ?? 0);
                                if ($ser === '' || $nro <= 0) continue;
                                $check = pg_query($conn,
                                    "SELECT 1 FROM {$tabela}
                                     WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                                       AND UPPER(placa_provisoria) = '" . pg_escape_string($conn, $placa) . "'
                                       AND UPPER(BTRIM(ser_cte)) = '" . pg_escape_string($conn, $ser) . "'
                                       AND nro_cte = {$nro}
                                     LIMIT 1"
                                );
                                if ($check && pg_num_rows($check) > 0) {
                                    // Linha já existe: sincroniza valores do documento (_cte) quando o gravado for menor/zerado
                                    corrigirValoresDocCte(
                                        $conn, $tabela, pg_escape_string($conn, $unidade), $ser, $nro,
                                        $toFloat($rowC['vlr_merc'] ?? 0),
                                        $toFloat($rowC['vlr_frete'] ?? 0),
                                        $toFloat($rowC['peso'] ?? 0),
                                        $toFloat($rowC['cubagem'] ?? 0),
                                        (int)($rowC['qtde_vol'] ?? 0)
                                    );
                                    continue;
                                }

                                $destCte = strtoupper(trim((string)($rowC['destino_cte'] ?? '')));
                                $destCteEsc = pg_escape_string($conn, $destCte);
                                $emissaoVal = trim((string)($rowC['data_emissao'] ?? ''));
                                $prevVal = trim((string)($rowC['data_prev_ent'] ?? ''));
                                $emissaoSql = $emissaoVal !== '' ? ("'" . pg_escape_string($conn, $emissaoVal) . "'::date") : 'NULL';
                                $prevSql = $prevVal !== '' ? ("'" . pg_escape_string($conn, $prevVal) . "'::date") : 'NULL';
                                $vlrMerc = $toFloat($rowC['vlr_merc'] ?? 0);
                                $vlrFrete = $toFloat($rowC['vlr_frete'] ?? 0);
                                $peso = $toFloat($rowC['peso'] ?? 0);
                                $cub = $toFloat($rowC['cubagem'] ?? 0);
                                $vol = (int)($rowC['qtde_vol'] ?? 0);
                                $remetente = pg_escape_string($conn, (string)($rowC['remetente'] ?? ''));
                                $destinatario = pg_escape_string($conn, (string)($rowC['destinatario'] ?? ''));
                                $pagador = pg_escape_string($conn, (string)($rowC['pagador'] ?? ''));
                                $cidadeDest = pg_escape_string($conn, (string)($rowC['cidade_destino'] ?? ''));

                                $resIns = pg_query($conn,
                                    "INSERT INTO {$tabela}
                                     (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                                      ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                                      remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                                      vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                                      destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento,
                                      data_finalizacao, hora_finalizacao, login_finalizacao)
                                     VALUES
                                     ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placa) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
                                      '" . pg_escape_string($conn, $ser) . "', {$nro}, '{$destCteEsc}', {$emissaoSql}, {$prevSql},
                                      '{$remetente}', '{$destinatario}', '{$pagador}', '{$cidadeDest}',
                                      {$vlrMerc}, {$vlrFrete}, {$peso}, {$cub}, {$vol},
                                      '" . pg_escape_string($conn, strtoupper(trim((string)$destinoCarreg))) . "', '" . pg_escape_string($conn, strtoupper(trim((string)$unidadesCarreg))) . "', '" . pg_escape_string($conn, (string)$setoresEntregaCarreg) . "', NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "',
                                      '{$data}'::date, '{$hora}'::time, '" . pg_escape_string($conn, $login) . "')"
                                );
                                if (!$resIns) throw new Exception('insert');
                                $add += 1;
                            }

                            if ($add > 0) {
                                pg_query($conn,
                                    "DELETE FROM {$tabela}
                                     WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                                       AND UPPER(placa_provisoria) = '" . pg_escape_string($conn, $placa) . "'
                                       AND nro_cte = 0
                                       AND data_finalizacao IS NULL"
                                );
                            }
                            pg_query($conn, 'COMMIT');
                        } catch (Exception $e) {
                            pg_query($conn, 'ROLLBACK');
                        }
                    }
                }
            }
        }

        foreach ($placasFinalizar as $pf) {
            $pf = strtoupper(trim((string)$pf));
            if ($pf === '' || !isset($open[$pf])) continue;
            $resUpd = sql(
                "UPDATE {$tabela} t
                 SET data_finalizacao = \$1::date,
                     hora_finalizacao = \$2::time,
                     login_finalizacao = \$3
                 WHERE t.unidade = \$4
                   AND UPPER(t.placa_provisoria) = \$5
                   AND t.data_finalizacao IS NULL
                   AND COALESCE(
                       (SELECT cap.tp_carregamento
                          FROM {$tabelaCap} cap
                         WHERE cap.unidade = t.unidade
                           AND cap.seq_carregamento IS NOT DISTINCT FROM t.seq_carregamento
                         LIMIT 1),
                       (CASE WHEN EXISTS (
                           SELECT 1 FROM {$tabela} x
                           WHERE x.unidade = t.unidade
                             AND x.seq_carregamento IS NOT DISTINCT FROM t.seq_carregamento
                             AND TRIM(COALESCE(x.destino, '')) <> ''
                       ) THEN 'T' ELSE 'E' END)
                   ) = 'T'",
                [$data, $hora, $login, $unidade, $pf],
                $conn
            );
            if ($resUpd) $updated += (int)pg_affected_rows($resUpd);
        }
    }

    respondJson(['success' => true, 'updated' => $updated]);
}

if ($acao === 'atualizar_ctes_ssw') {
    $placaReq = strtoupper(trim((string)($input['placa'] ?? '')));
    if ($placaReq === '') {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $dateRefRaw = trim((string)($input['data_ref'] ?? $input['dataRef'] ?? $input['data_finalizacao'] ?? ''));
    $dtRef = null;
    if ($dateRefRaw !== '' && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateRefRaw, $m)) {
        $dtRef = DateTime::createFromFormat('Y-m-d', $m[1] . '-' . $m[2] . '-' . $m[3]);
    } elseif ($dateRefRaw !== '' && preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $dateRefRaw, $m)) {
        $dtRef = DateTime::createFromFormat('Y-m-d', $m[3] . '-' . $m[2] . '-' . $m[1]);
    }

    $resCarBase = null;
    try {
        $resCarBase = sql(
            "SELECT
                t.seq_carregamento,
                t.destino,
                t.unidades,
                t.setores_entrega,
                t.origem_criacao,
                t.data_finalizacao,
                t.hora_finalizacao,
                t.login_finalizacao,
                (
                    SELECT MIN((x.data_inclusao::timestamp + x.hora_inclusao::time))
                    FROM {$tabela} x
                    WHERE x.unidade = t.unidade
                      AND x.seq_carregamento IS NOT DISTINCT FROM t.seq_carregamento
                ) AS dt_inclusao
             FROM {$tabela} t
             WHERE t.unidade = $1
               AND UPPER(t.placa_provisoria) = $2
             ORDER BY t.data_inclusao DESC, t.hora_inclusao DESC
             LIMIT 1",
            [$unidade, $placaReq],
            $conn
        );
    } catch (Exception $e) {}

    if (!$resCarBase || pg_num_rows($resCarBase) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento não encontrado no Presto.']);
    }

    $rowBase = pg_fetch_assoc($resCarBase);
    $seqCarreg = (int)($rowBase['seq_carregamento'] ?? 0);
    $destinoCarreg = (string)($rowBase['destino'] ?? '');
    $unidadesCarreg = (string)($rowBase['unidades'] ?? '');
    $setoresEntregaCarreg = (string)($rowBase['setores_entrega'] ?? '');
    $origemCriacao = strtoupper(trim((string)($rowBase['origem_criacao'] ?? '')));
    if ($origemCriacao === '') $origemCriacao = 'SSW';

    $dtInclusao = null;
    $dtInclusaoRaw = trim((string)($rowBase['dt_inclusao'] ?? ''));
    if ($dtInclusaoRaw !== '') {
        try { $dtInclusao = new DateTime($dtInclusaoRaw); } catch (Exception $e) { $dtInclusao = null; }
    }

    $dataFinalDb = trim((string)($rowBase['data_finalizacao'] ?? ''));
    if ($dtRef === null && $dataFinalDb !== '' && preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $dataFinalDb, $m)) {
        $dtRef = DateTime::createFromFormat('Y-m-d', $m[1] . '-' . $m[2] . '-' . $m[3]);
    }
    if ($dtRef === null) $dtRef = new DateTime();

    $tpCarregamento = (trim((string)$setoresEntregaCarreg) !== '' || trim((string)$destinoCarreg) === '') ? 'E' : 'T';
    if ($tpCarregamento !== 'T') {
        respondJson(['success' => false, 'message' => 'Disponível apenas para Transferência.']);
    }

    $dtCriacao = $dtInclusao instanceof DateTime ? $dtInclusao : ($dtRef instanceof DateTime ? $dtRef : new DateTime());
    $dtIni = (clone $dtCriacao);
    $dtFin = (clone $dtCriacao)->modify('+2 days');
    $dtHoje = new DateTime();
    if ($dtFin->format('Y-m-d') > $dtHoje->format('Y-m-d')) $dtFin = $dtHoje;
    if ($dtIni->format('Y-m-d') > $dtFin->format('Y-m-d')) $dtIni = (clone $dtFin);
    $ddIni = $dtIni->format('dmy');
    $ddFin = $dtFin->format('dmy');

    $extractXml = function ($html) {
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
    };

    $parseDt = function ($s) {
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
        $dt = DateTime::createFromFormat('d/m/y H:i:s', $s);
        if ($dt !== false) return $dt;
        $dt = DateTime::createFromFormat('d/m/Y H:i:s', $s);
        if ($dt !== false) return $dt;
        $dt = DateTime::createFromFormat('d/m/y H:i', $s);
        if ($dt !== false) return $dt;
        $dt = DateTime::createFromFormat('d/m/Y H:i', $s);
        if ($dt !== false) return $dt;
        return null;
    };

    $url = "https://sistema.ssw.inf.br/bin/ssw0125?act=PER&t_sigla_origem=" . rawurlencode($unidade) .
        "&t_data_saida_ini=" . rawurlencode($ddIni) .
        "&t_data_saida_fin=" . rawurlencode($ddFin);

    $html = '';
    try {
        require_ssw();
        ssw_login($domain);
        $html = ssw_go($url);
    } catch (Exception $e) {
        respondJson(['success' => false, 'message' => 'Falha ao consultar o SSW.']);
    }

    $xmlStr = $extractXml($html);
    if ($xmlStr === null) {
        respondJson(['success' => false, 'message' => 'SSW: retorno sem XML.']);
    }

    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) {
        respondJson(['success' => false, 'message' => 'SSW: XML inválido.']);
    }

    $info = ['saida' => null, 'qtd' => 0, 'manifestos' => []];
    $rows = $xml->xpath('//r');
    if ($rows && count($rows) > 0) {
        $domainUpper = strtoupper((string)$domain);
        $cleanPlacaReq = preg_replace('/[^A-Z0-9]/', '', $placaReq);
        $keyReq = ($domainUpper === 'RVE') ? substr($cleanPlacaReq, -4) : $cleanPlacaReq;

        $regF3 = [];
        $regF2 = [];
        foreach ($rows as $r) {
            $f3 = strtoupper(trim((string)($r->f3 ?? '')));
            $f2 = strtoupper(trim((string)($r->f2 ?? '')));
            $f11 = trim((string)($r->f11 ?? ''));
            $dt = $f11 !== '' ? $parseDt($f11) : null;
            $f8Raw = trim((string)($r->f8 ?? ''));
            $f8Num = (int)preg_replace('/[^\d]/', '', $f8Raw);
            $f16 = strtoupper(trim((string)($r->f16 ?? '')));
            $f17 = trim((string)($r->f17 ?? ''));
            $mans = [];
            if ($f17 !== '' && stripos($f16, 'CANCELADO') === false && stripos($f17, 'CANCELADO') === false) {
                $mm = null;
                if (preg_match_all('/\d+/', $f17, $mm) && count(($mm[0] ?? [])) > 0) {
                    foreach (($mm[0] ?? []) as $sx) {
                        $sx = (string)$sx;
                        if ($sx !== '') $mans[$sx] = true;
                    }
                } else {
                    $sx = trim($f17);
                    if ($sx !== '') $mans[$sx] = true;
                }
            }

            $reg = [
                'dt' => $dt,
                'ts' => ($dt instanceof DateTime) ? $dt->getTimestamp() : 0,
                'status' => $f16,
                'qtd' => $f8Num,
                'manifestos' => $mans,
            ];

            if ($f3 !== '') {
                $cleanF3 = preg_replace('/[^A-Z0-9]/', '', $f3);
                $keyF3 = ($domainUpper === 'RVE') ? substr($cleanF3, -4) : $cleanF3;
                if ($keyF3 !== '' && $keyF3 === $keyReq) $regF3[] = $reg;
            } elseif ($f2 !== '') {
                $cleanF2 = preg_replace('/[^A-Z0-9]/', '', $f2);
                $keyF2 = ($domainUpper === 'RVE') ? substr($cleanF2, -4) : $cleanF2;
                if ($keyF2 !== '' && $keyF2 === $keyReq) $regF2[] = $reg;
            }
        }

        $cands = count($regF3) > 0 ? $regF3 : $regF2;
        if (count($cands) > 0) {
            $createdTs = ($dtInclusao instanceof DateTime) ? $dtInclusao->getTimestamp() : 0;
            $cutTs = $createdTs > 0 ? max(0, $createdTs - (5 * 60)) : 0;

            $groups = [];
            foreach ($cands as $x) {
                $ts = (int)($x['ts'] ?? 0);
                if ($ts <= 0) continue;
                if ($cutTs > 0 && $ts <= $cutTs) continue;
                if (!isset($groups[$ts])) $groups[$ts] = [];
                $groups[$ts][] = $x;
            }

            $selectedTs = 0;
            foreach (array_keys($groups) as $ts) {
                $ts = (int)$ts;
                if ($ts <= 0) continue;
                if ($selectedTs === 0 || $ts < $selectedTs) $selectedTs = $ts;
            }

            $use = $selectedTs > 0 ? ($groups[$selectedTs] ?? []) : $cands;

            $saidaBest = null;
            $qtdSum = 0;
            $mansAll = [];
            foreach ($use as $x) {
                $qtdSum += (int)($x['qtd'] ?? 0);
                $dt = $x['dt'] ?? null;
                if ($dt instanceof DateTime) {
                    if ($saidaBest === null || (int)($x['ts'] ?? 0) < (int)($saidaBest['ts'] ?? 0)) $saidaBest = $x;
                }
                $mans = $x['manifestos'] ?? [];
                if (is_array($mans)) {
                    foreach (array_keys($mans) as $sx) {
                        $sx = (string)$sx;
                        if ($sx !== '') $mansAll[$sx] = true;
                    }
                }
            }

            if ($saidaBest !== null) $info['saida'] = $saidaBest['dt'] ?? null;
            $info['qtd'] = $qtdSum;
            foreach (array_keys($mansAll) as $sx) $info['manifestos'][(string)$sx] = true;
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
               AND UPPER(placa_provisoria) = $2
               AND nro_cte > 0
               {$filtroSerieRve}",
            [$unidade, $placaReq],
            $conn
        );
        if ($resQtd && pg_num_rows($resQtd) > 0) $qtdPresto = (int)pg_fetch_result($resQtd, 0, 0);
    } catch (Exception $e) {}

    $tblCte = "{$domain}_cte";
    $cteTableOk = false;
    try {
        $resReg = sql("SELECT to_regclass($1) AS reg", [$tblCte], $conn);
        $val = $resReg ? pg_fetch_result($resReg, 0, 0) : null;
        $cteTableOk = ($val !== null && $val !== '');
    } catch (Exception $e) {
        $cteTableOk = false;
    }

    if (!$cteTableOk) {
        respondJson(['success' => false, 'message' => 'Tabela de CT-es não encontrada no domínio.']);
    }

    $dtFinal = null;
    if ($dataFinalDb !== '' && preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $dataFinalDb, $m)) {
        $dtFinal = DateTime::createFromFormat('Y-m-d', $m[1] . '-' . $m[2] . '-' . $m[3]);
    }
    if ($dtFinal === null) $dtFinal = $info['saida'] instanceof DateTime ? $info['saida'] : new DateTime();
    $dataFinal = $dtFinal->format('Y-m-d');
    $horaFinal = trim((string)($rowBase['hora_finalizacao'] ?? ''));
    if ($horaFinal === '') $horaFinal = $dtFinal->format('H:i:s');
    $loginFinal = trim((string)($rowBase['login_finalizacao'] ?? ''));
    if ($loginFinal === '') $loginFinal = $login;

    if ($info['saida'] instanceof DateTime) {
        try {
            $dtSsw = $info['saida'];
            $dataSsw = $dtSsw->format('Y-m-d');
            $horaSsw = $dtSsw->format('H:i:s');
            sql(
                "UPDATE {$tabela}
                 SET data_finalizacao = $1::date,
                     hora_finalizacao = $2::time,
                     login_finalizacao = $3
                 WHERE unidade = $4
                   AND UPPER(placa_provisoria) = $5
                   AND data_finalizacao IS NULL",
                [$dataSsw, $horaSsw, $login, $unidade, $placaReq],
                $conn
            );
        } catch (Exception $e) {}
    }

    $colCache = [];
    $cteCol = function(string $col) use (&$colCache, $conn, $tblCte): bool {
        $c = strtolower(trim($col));
        if ($c === '') return false;
        if (isset($colCache[$c])) return (bool)$colCache[$c];
        $res = null;
        try {
            $res = sql(
                "SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = lower($1)
                   AND column_name = $2
                 LIMIT 1",
                [strtolower($tblCte), $c],
                $conn
            );
        } catch (Exception $e) {}
        $ok = ($res && pg_num_rows($res) > 0);
        $colCache[$c] = $ok;
        return $ok;
    };

    $added = 0;
    $manifestosCount = count($manifestos);
    $manifestosXmlOk = 0;
    $pairsCount = 0;
    $cteFoundCount = 0;
    if ($qtdSsw > 0 && $qtdPresto !== $qtdSsw && count($manifestos) > 0) {
        $toFloat = function ($v) {
            $s = trim((string)$v);
            if ($s === '') return 0.0;
            $s = preg_replace('/[^\d,\.\-]/', '', $s);
            if ($s === '' || $s === '-') return 0.0;
            $hasComma = (strpos($s, ',') !== false);
            $hasDot = (strpos($s, '.') !== false);
            if ($hasComma) {
                $s = str_replace('.', '', $s);
                $s = str_replace(',', '.', $s);
            } else if ($hasDot && preg_match('/^\-?\d{1,3}(\.\d{3})+$/', $s) && !preg_match('/^\-?0\.\d+$/', $s)) {
                $s = str_replace('.', '', $s);
            }
            return (float)$s;
        };
        $parseDateBr = function ($v) {
            $s = trim((string)$v);
            if ($s === '') return null;
            $dt = DateTime::createFromFormat('d/m/y', $s);
            if ($dt !== false) return $dt->format('Y-m-d');
            $dt = DateTime::createFromFormat('d/m/Y', $s);
            if ($dt !== false) return $dt->format('Y-m-d');
            return null;
        };
        $pairs = [];
        $cteXml = [];
        foreach ($manifestos as $seqMan) {
            $seqMan = trim((string)$seqMan);
            if ($seqMan === '') continue;
            $urlMan = "https://sistema.ssw.inf.br/bin/ssw0125?act=CTRCS_MAN&seq_manifesto=" . rawurlencode($seqMan);
            $htmlMan = '';
            try { $htmlMan = ssw_go($urlMan); } catch (Exception $e) { $htmlMan = ''; }
            $xmlManStr = $extractXml($htmlMan);
            if ($xmlManStr === null) continue;
            $xmlMan = @simplexml_load_string($xmlManStr);
            if ($xmlMan === false) continue;
            $rowsMan = $xmlMan->xpath('//r');
            if (!$rowsMan || count($rowsMan) === 0) continue;
            $manifestosXmlOk += 1;
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
                        'data_emissao' => $parseDateBr((string)($rm->f2 ?? '')),
                        'data_prev_ent' => $parseDateBr((string)($rm->f12 ?? '')),
                        'vlr_merc' => $toFloat((string)($rm->f9 ?? '')),
                        'vlr_frete' => $toFloat((string)($rm->f10 ?? '')),
                        'peso' => $toFloat((string)($rm->f8 ?? '')),
                        'cubagem' => 0.0,
                        'qtde_vol' => (int)preg_replace('/[^\d]/', '', (string)($rm->f7 ?? '')),
                    ];
                }
            }
        }

        if (count($pairs) > 0) {
            $pairsCount = count($pairs);
            if ($seqCarreg <= 0) {
                $seqCarreg = nextSeqCarregamento($conn, $seqName);
                if ($seqCarreg > 0) {
                    @pg_query($conn,
                        "UPDATE {$tabela}
                         SET seq_carregamento = {$seqCarreg}
                         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                           AND UPPER(placa_provisoria) = '" . pg_escape_string($conn, $placaReq) . "'"
                    );
                    $tpCarregReq = resolverTpCarregamento($conn, $tabela, $tabelaCap, $unidade, $seqCarreg, $destinoCarreg);
                    @pg_query($conn,
                        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, nro_linha, tp_carregamento)
                         VALUES ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placaReq) . "', NULL, '{$tpCarregReq}')
                         ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria, nro_linha = COALESCE(EXCLUDED.nro_linha, {$tabelaCap}.nro_linha), tp_carregamento = COALESCE({$tabelaCap}.tp_carregamento, EXCLUDED.tp_carregamento)"
                    );
                }
            }

            if ($seqCarreg > 0) {
                $joinCidade = $cteCol('seq_cidade_dest') ? "LEFT JOIN cidade cid_dest ON cte.seq_cidade_dest = cid_dest.seq_cidade" : "";
                $selCidade = $cteCol('seq_cidade_dest') ? "COALESCE(cid_dest.nome, '')" : "''";
                $selDest = $cteCol('sigla_dest') ? "UPPER(BTRIM(cte.sigla_dest))" : "''";
                $selRemet = $cteCol('nome_emit') ? "COALESCE(cte.nome_emit, '')" : "''";
                $selDestinat = $cteCol('nome_dest') ? "COALESCE(cte.nome_dest, '')" : "''";
                $selPagador = $cteCol('nome_pag') ? "COALESCE(cte.nome_pag, '')" : "''";
                $selEmissao = $cteCol('data_emissao') ? "cte.data_emissao::date" : "NULL::date";
                $selPrev = $cteCol('data_prev_ent') ? "cte.data_prev_ent::date" : "NULL::date";
                $selMerc = $cteCol('vlr_merc') ? "COALESCE(cte.vlr_merc, 0)" : "0";
                $selFrete = $cteCol('vlr_frete') ? "COALESCE(cte.vlr_frete, 0)" : "0";
                $selPeso = $cteCol('peso_real') ? "COALESCE(cte.peso_real, 0)" : ($cteCol('peso_calc') ? "COALESCE(cte.peso_calc, 0)" : "0");
                $selCub = $cteCol('cubagem') ? "COALESCE(cte.cubagem, 0)" : "0";
                $selVol = $cteCol('qtde_vol') ? "COALESCE(cte.qtde_vol, 0)" : "0";

                $pairsArr = array_values($pairs);
                $cteInfo = [];
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
                            {$selDestinat} AS destinatario,
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
                        'vlr_merc' => $toFloat($rowC['vlr_merc'] ?? ($cteXml[$k]['vlr_merc'] ?? 0)),
                        'vlr_frete' => $toFloat($rowC['vlr_frete'] ?? ($cteXml[$k]['vlr_frete'] ?? 0)),
                        'peso' => $toFloat($rowC['peso'] ?? ($cteXml[$k]['peso'] ?? 0)),
                        'cubagem' => $toFloat($rowC['cubagem'] ?? 0),
                        'qtde_vol' => (int)($rowC['qtde_vol'] ?? ($cteXml[$k]['qtde_vol'] ?? 0)),
                    ];
                }

                $added = 0;
                $updated = 0;
                if (count($cteAll) > 0) {
                    pg_query($conn, 'BEGIN');
                    try {
                        foreach ($cteAll as $rowC) {
                            $ser = strtoupper(trim((string)($rowC['ser_cte'] ?? '')));
                            $nro = (int)($rowC['nro_cte'] ?? 0);
                            if ($ser === '' || $nro <= 0) continue;

                            $check = pg_query($conn,
                                "SELECT 1 FROM {$tabela}
                                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                                   AND seq_carregamento = {$seqCarreg}
                                   AND UPPER(BTRIM(ser_cte)) = '" . pg_escape_string($conn, $ser) . "'
                                   AND nro_cte = {$nro}
                                 LIMIT 1"
                            );
                            if ($check && pg_num_rows($check) > 0) {
                                corrigirValoresDocCte(
                                    $conn,
                                    $tabela,
                                    pg_escape_string($conn, $unidade),
                                    $ser,
                                    $nro,
                                    $toFloat($rowC['vlr_merc'] ?? 0),
                                    $toFloat($rowC['vlr_frete'] ?? 0),
                                    $toFloat($rowC['peso'] ?? 0),
                                    $toFloat($rowC['cubagem'] ?? 0),
                                    (int)($rowC['qtde_vol'] ?? 0)
                                );
                                continue;
                            }

                            $destCte = strtoupper(trim((string)($rowC['destino_cte'] ?? '')));
                            $destCteEsc = pg_escape_string($conn, $destCte);
                            $emissaoVal = trim((string)($rowC['data_emissao'] ?? ''));
                            $prevVal = trim((string)($rowC['data_prev_ent'] ?? ''));
                            $emissaoSql = $emissaoVal !== '' ? ("'" . pg_escape_string($conn, $emissaoVal) . "'::date") : 'NULL';
                            $prevSql = $prevVal !== '' ? ("'" . pg_escape_string($conn, $prevVal) . "'::date") : 'NULL';
                            $vlrMerc = $toFloat($rowC['vlr_merc'] ?? 0);
                            $vlrFrete = $toFloat($rowC['vlr_frete'] ?? 0);
                            $peso = $toFloat($rowC['peso'] ?? 0);
                            $cub = $toFloat($rowC['cubagem'] ?? 0);
                            $vol = (int)($rowC['qtde_vol'] ?? 0);
                            $remetente = pg_escape_string($conn, (string)($rowC['remetente'] ?? ''));
                            $destinatario = pg_escape_string($conn, (string)($rowC['destinatario'] ?? ''));
                            $pagador = pg_escape_string($conn, (string)($rowC['pagador'] ?? ''));
                            $cidadeDest = pg_escape_string($conn, (string)($rowC['cidade_destino'] ?? ''));

                            $resIns = pg_query($conn,
                                "INSERT INTO {$tabela}
                                 (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                                  ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                                  remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                                  vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                                  destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento,
                                  data_finalizacao, hora_finalizacao, login_finalizacao)
                                 VALUES
                                 ('" . pg_escape_string($conn, $unidade) . "', {$seqCarreg}, '" . pg_escape_string($conn, $placaReq) . "', '" . pg_escape_string($conn, $login) . "', CURRENT_DATE, CURRENT_TIME,
                                  '" . pg_escape_string($conn, $ser) . "', {$nro}, '{$destCteEsc}', {$emissaoSql}, {$prevSql},
                                  '{$remetente}', '{$destinatario}', '{$pagador}', '{$cidadeDest}',
                                  {$vlrMerc}, {$vlrFrete}, {$peso}, {$cub}, {$vol},
                                  '" . pg_escape_string($conn, strtoupper(trim((string)$destinoCarreg))) . "', '" . pg_escape_string($conn, strtoupper(trim((string)$unidadesCarreg))) . "', '" . pg_escape_string($conn, (string)$setoresEntregaCarreg) . "', NULL, '" . pg_escape_string($conn, $origemCriacao) . "', '" . pg_escape_string($conn, $unidade) . "',
                                  '{$dataFinal}'::date, '{$horaFinal}'::time, '" . pg_escape_string($conn, $loginFinal) . "')"
                            );
                            if (!$resIns) throw new Exception('insert');
                            $added += 1;
                        }

                        if ($added > 0) {
                            pg_query($conn,
                                "DELETE FROM {$tabela}
                                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                                   AND seq_carregamento = {$seqCarreg}
                                   AND nro_cte = 0"
                            );
                        }
                        pg_query($conn, 'COMMIT');
                    } catch (Exception $e) {
                        pg_query($conn, 'ROLLBACK');
                    }
                }
            }
        }
    }

    respondJson([
        'success' => true,
        'placa' => $placaReq,
        'qtd_ssw' => $qtdSsw,
        'qtd_presto' => $qtdPresto,
        'added' => $added ?? 0,
        'updated' => $updated ?? 0,
        'debug' => [
            'manifestos_count' => $manifestosCount,
            'manifestos_xml_ok' => $manifestosXmlOk,
            'pairs_count' => $pairsCount,
            'cte_found_count' => $cteFoundCount,
        ],
    ]);
}

if ($acao === 'atualizar_bipagens_entrega') {
    $extractXml = function ($html) {
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
        if ($inicio === false) return null;
        $fim = strrpos($html, '</xml>');
        if ($fim === false) return null;
        return substr($html, $inicio, ($fim + 6) - $inicio);
    };

    $domainUpper = strtoupper((string)$domain);
    $placasPrestoMap = [];
    try {
        $resPresto = sql(
            "SELECT DISTINCT UPPER(BTRIM(c.placa_provisoria)) AS placa
             FROM {$tabela} c
             LEFT JOIN {$tabelaCap} cap
                    ON cap.unidade = c.unidade AND cap.seq_carregamento = c.seq_carregamento
             WHERE c.unidade = \$1
               AND c.data_finalizacao IS NULL
               AND COALESCE(cap.simulado, FALSE) = FALSE
               AND (TRIM(COALESCE(c.destino, '')) = '' OR UPPER(COALESCE(cap.tp_carregamento, '')) = 'E')",
            [$unidade],
            $conn
        );
        while ($resPresto && ($row = pg_fetch_assoc($resPresto))) {
            $p = strtoupper(trim((string)($row['placa'] ?? '')));
            if ($p !== '') $placasPrestoMap[$p] = true;
        }
    } catch (Exception $e) {
        $placasPrestoMap = [];
    }
    if (count($placasPrestoMap) === 0) {
        respondJson(['success' => true, 'updated' => 0, 'placas' => [], 'placas_presto' => []]);
    }

    try {
        require_ssw();
        ssw_login($domain);
    } catch (Exception $e) {
        respondJson(['success' => false, 'message' => 'Falha ao autenticar no SSW.']);
    }

    $strTroca = '';
    try {
        $strTroca = ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($unidade) . '&f3=101');
    } catch (Exception $e) {
        $strTroca = '';
    }
    if (substr((string)$strTroca, 0, 5) === '<foc ') {
        respondJson(['success' => false, 'message' => 'Erro SSW (troca unidade): ' . (string)$strTroca]);
    }

    $xmlRaw = '';
    try {
        $xmlRaw = ssw_go('https://sistema.ssw.inf.br/bin/ssw0197?act=PREP_IMP&entrega_dificil=N&prioritario=N&tp_carregamento=&qtde=2');
    } catch (Exception $e) {
        $xmlRaw = '';
    }
    if (substr((string)$xmlRaw, 0, 5) === '<foc ') {
        respondJson(['success' => false, 'message' => 'Erro SSW (0197 PREP_IMP): ' . (string)$xmlRaw]);
    }

    $xmlStr = $extractXml($xmlRaw);
    if ($xmlStr === null) {
        respondJson(['success' => false, 'message' => 'Resposta inválida do SSW (0197 PREP_IMP).']);
    }
    $xml = @simplexml_load_string($xmlStr);
    if ($xml === false) {
        respondJson(['success' => false, 'message' => 'XML inválido do SSW (0197 PREP_IMP).']);
    }

    $rows = $xml->xpath('//r') ?: [];
    $placasMap = [];
    foreach ($rows as $r) {
        $p = strtoupper(trim((string)($r->f0 ?? '')));
        $p = preg_replace('/[^A-Z0-9]/', '', $p);
        if ($p === '') continue;
        $placasMap[$p] = true;
    }
    $placas = array_keys($placasMap);
    if (count($placas) === 0) {
        respondJson(['success' => true, 'updated' => 0, 'placas' => []]);
    }

    $mapPlacaRelParaDb = [];
    $placasConsulta = [];
    $placasConsultaMap = [];
    foreach ($placas as $pRel) {
        $pRel = strtoupper(trim((string)$pRel));
        if ($pRel === '') continue;
        $placaDb = $pRel;

        if ($domainUpper === 'RVE' && preg_match('/^[A-Z0-9]{3}[A-Z0-9]{4}$/', $pRel)) {
            $suf = substr($pRel, 3, 4);
            if ($suf !== '') {
                $candCap = '';
                try {
                    $resCap = sql(
                        "SELECT cap.placa_provisoria
                         FROM {$tabelaCap} cap
                         LEFT JOIN {$tabela} c
                                ON c.unidade = cap.unidade AND c.seq_carregamento = cap.seq_carregamento
                         WHERE cap.unidade = \$1
                           AND RIGHT(UPPER(BTRIM(cap.placa_provisoria)), 4) = \$2
                           AND COALESCE(cap.simulado, FALSE) = FALSE
                         GROUP BY cap.placa_provisoria, cap.seq_carregamento
                         HAVING BOOL_OR(c.data_finalizacao IS NULL) OR COUNT(c.seq_carregamento) = 0
                         ORDER BY COALESCE(BOOL_OR(c.data_finalizacao IS NULL), FALSE) DESC,
                                  cap.seq_carregamento DESC
                         LIMIT 1",
                        [$unidade, $suf],
                        $conn
                    );
                    if ($resCap && pg_num_rows($resCap) > 0) {
                        $candCap = strtoupper(trim((string)pg_fetch_result($resCap, 0, 0)));
                    }
                } catch (Exception $e) {
                    $candCap = '';
                }

                if ($candCap !== '') {
                    $placaDb = $candCap;
                } else {
                    $candVeic = '';
                    try {
                        $resVeic = sql(
                            "SELECT placa
                             FROM {$tabelaVeiculo}
                             WHERE RIGHT(UPPER(BTRIM(placa)), 4) = \$1
                               AND UPPER(BTRIM(COALESCE(tipo, ''))) <> 'CAVALO'
                             ORDER BY (CASE WHEN UPPER(BTRIM(COALESCE(tipo, ''))) IN ('CAMINHAO','CAMINHÃO','CAMINHONETE','TRUCK','CARRETA') THEN 0 ELSE 1 END),
                                      LENGTH(BTRIM(placa)) ASC,
                                      UPPER(BTRIM(placa)) ASC
                             LIMIT 1",
                            [$suf],
                            $conn
                        );
                        if ($resVeic && pg_num_rows($resVeic) > 0) {
                            $candVeic = strtoupper(trim((string)pg_fetch_result($resVeic, 0, 0)));
                        }
                    } catch (Exception $e) {
                        $candVeic = '';
                    }
                    if ($candVeic !== '') $placaDb = $candVeic;
                }
            }
        }

        $mapPlacaRelParaDb[$pRel] = $placaDb;
        if (isset($placasPrestoMap[$placaDb])) {
            $placasConsulta[] = $pRel;
            $placasConsultaMap[$pRel] = true;
        }
    }

    if (count($placasConsulta) === 0) {
        respondJson([
            'success' => true,
            'updated' => 0,
            'placas_presto' => array_keys($placasPrestoMap),
            'placas_ssw' => $placas,
            'placas' => [],
        ]);
    }

    try {
        foreach ($placasConsulta as $pRel) {
            $pRel = strtoupper(trim((string)$pRel));
            if ($pRel === '') continue;
            $pDb = strtoupper(trim((string)($mapPlacaRelParaDb[$pRel] ?? $pRel)));
            if ($pDb === '') continue;
            @pg_query($conn,
                "UPDATE {$tabela}
                 SET data_inicio_bipagem = COALESCE(data_inicio_bipagem, CURRENT_DATE),
                     hora_inicio_bipagem = COALESCE(hora_inicio_bipagem, CURRENT_TIME),
                     login_inicio_bipagem = COALESCE(NULLIF(login_inicio_bipagem, ''), '" . pg_escape_string($conn, $login) . "')
                 WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                   AND UPPER(placa_provisoria) = '" . pg_escape_string($conn, $pDb) . "'
                   AND data_finalizacao IS NULL"
            );
        }
    } catch (Exception $e) {}

    $act = 'SR_IMP|' . implode('|', $placasConsulta);
    $txt = '';
    try {
        $txt = ssw_go('https://sistema.ssw.inf.br/bin/ssw0197?act=' . $act);
    } catch (Exception $e) {
        $txt = '';
    }
    if (substr((string)$txt, 0, 5) === '<foc ') {
        respondJson(['success' => false, 'message' => 'Erro SSW (0197 SR_IMP): ' . (string)$txt]);
    }
    $txt = (string)$txt;
    if (trim($txt) === '') {
        respondJson(['success' => true, 'updated' => 0, 'placas' => $placas]);
    }

    $porPlaca = [];
    $placaAtual = '';
    $lines = preg_split("/\r\n|\n|\r/", $txt);
    if (!is_array($lines)) $lines = [];
    foreach ($lines as $line) {
        $line = rtrim((string)$line);
        if (preg_match('/^\s*PLACA\s+PROVISORIA:\s*(.+)\s*$/i', $line, $m)) {
            $placaAtual = strtoupper(trim((string)($m[1] ?? '')));
            $placaAtual = preg_replace('/[^A-Z0-9]/', '', $placaAtual);
            if ($placaAtual === '' || !isset($placasConsultaMap[$placaAtual])) {
                $placaAtual = '';
                continue;
            }
            if (!isset($porPlaca[$placaAtual])) $porPlaca[$placaAtual] = [];
            continue;
        }
        if ($placaAtual === '') continue;
        $lineTrim = ltrim($line);
        if ($lineTrim === '' || $lineTrim[0] === '-' || $lineTrim[0] === '*') continue;
        $parts = preg_split('/\s+/', trim($lineTrim));
        if (!is_array($parts) || count($parts) === 0) continue;
        $ctrc = strtoupper(trim((string)($parts[0] ?? '')));
        if ($ctrc === '' || strlen($ctrc) < 5) continue;
        $ctrcClean = preg_replace('/[^A-Z0-9]/', '', $ctrc);
        if (!preg_match('/^([A-Z]{3})(\d{6})/', $ctrcClean, $mC)) continue;
        $ser = strtoupper($mC[1]);
        $nro = (int)$mC[2];
        if ($nro <= 0) continue;
        $k = $ser . '|' . $nro;
        $porPlaca[$placaAtual][$k] = ['ser' => $ser, 'nro' => $nro];
    }

    $updated = 0;
    $placasNoRel = array_keys($porPlaca);
    if (count($porPlaca) > 0) {
        $tabelaEsc = $tabela;
        $tabelaCapEsc = $tabelaCap;
        pg_query($conn, 'BEGIN');
        try {
            foreach ($porPlaca as $placaRel => $pairs) {
                $placaRel = strtoupper(trim((string)$placaRel));
                if ($placaRel === '' || !is_array($pairs) || count($pairs) === 0) continue;
                $placaDb = (string)($mapPlacaRelParaDb[$placaRel] ?? $placaRel);
                $placaDb = strtoupper(trim($placaDb));
                if ($placaDb === '') continue;
                foreach ($pairs as $it) {
                    $ser = strtoupper(trim((string)($it['ser'] ?? '')));
                    $nro = (int)($it['nro'] ?? 0);
                    if ($ser === '' || $nro <= 0) continue;

                    $resUpd = pg_query($conn,
                        "UPDATE {$tabelaEsc}
                         SET bipado = TRUE
                         WHERE unidade = '" . pg_escape_string($conn, $unidade) . "'
                           AND UPPER(placa_provisoria) = '" . pg_escape_string($conn, $placaDb) . "'
                           AND UPPER(BTRIM(ser_cte)) = '" . pg_escape_string($conn, $ser) . "'
                           AND nro_cte = {$nro}
                           AND data_finalizacao IS NULL
                           AND COALESCE(bipado, FALSE) = FALSE
                           AND (
                               TRIM(COALESCE(destino, '')) = ''
                               OR EXISTS (
                                   SELECT 1
                                   FROM {$tabelaCapEsc} cap
                                   WHERE cap.unidade = {$tabelaEsc}.unidade
                                     AND cap.seq_carregamento = {$tabelaEsc}.seq_carregamento
                                     AND UPPER(COALESCE(cap.tp_carregamento, '')) = 'E'
                                   LIMIT 1
                               )
                           )"
                    );

                    if ($resUpd && pg_affected_rows($resUpd) > 0) $updated += (int)pg_affected_rows($resUpd);
                }
            }
            pg_query($conn, 'COMMIT');
        } catch (Exception $e) {
            pg_query($conn, 'ROLLBACK');
        }
    }

    respondJson([
        'success' => true,
        'placas' => $placasConsulta,
        'placas_presto' => array_keys($placasPrestoMap),
        'placas_ssw' => $placas,
        'placas_relatorio' => $placasNoRel,
        'updated' => $updated,
    ]);
}

// ─── Ação: criar carregamento conjunto (transferência) ─────────────────────────
if ($acao === 'conjuntar_transferencia') {
    $placaOrig = strtoupper(trim((string)($input['placa_origem'] ?? '')));
    $placaDest = strtoupper(trim((string)($input['placa_destino'] ?? '')));
    if ($placaOrig === '' || $placaDest === '' || $placaOrig === $placaDest) {
        respondJson(['success' => false, 'message' => 'Placas inválidas para conjunto.']);
    }

    $resDest = sql(
        "SELECT seq_carregamento, COALESCE(setores_entrega, '') AS setores_entrega, COALESCE(destino, '') AS destino
         FROM {$tabela}
         WHERE unidade = \$1
           AND UPPER(placa_provisoria) = UPPER(\$2)
           AND data_finalizacao IS NULL
         ORDER BY data_inclusao ASC, hora_inclusao ASC
         LIMIT 1",
        [$unidade, $placaDest],
        $conn
    );
    $resOrig = sql(
        "SELECT seq_carregamento, COALESCE(setores_entrega, '') AS setores_entrega, COALESCE(destino, '') AS destino
         FROM {$tabela}
         WHERE unidade = \$1
           AND UPPER(placa_provisoria) = UPPER(\$2)
           AND data_finalizacao IS NULL
         ORDER BY data_inclusao ASC, hora_inclusao ASC
         LIMIT 1",
        [$unidade, $placaOrig],
        $conn
    );
    if (!$resDest || pg_num_rows($resDest) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento de destino não encontrado (ou finalizado).']);
    }
    if (!$resOrig || pg_num_rows($resOrig) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento de origem não encontrado (ou finalizado).']);
    }

    $rowDest = pg_fetch_assoc($resDest);
    $rowOrig = pg_fetch_assoc($resOrig);
    $seqDest = (int)($rowDest['seq_carregamento'] ?? 0);
    $seqOrig = (int)($rowOrig['seq_carregamento'] ?? 0);
    if ($seqDest <= 0 || $seqOrig <= 0) {
        respondJson(['success' => false, 'message' => 'seq_carregamento inválido para conjunto.']);
    }

    $destinoDest = strtoupper(trim((string)($rowDest['destino'] ?? '')));
    $destinoOrig = strtoupper(trim((string)($rowOrig['destino'] ?? '')));
    $setDest = strtoupper(trim((string)($rowDest['setores_entrega'] ?? '')));
    $setOrig = strtoupper(trim((string)($rowOrig['setores_entrega'] ?? '')));
    $isEntregaDest = ($destinoDest === '' && $setDest !== '');
    $isEntregaOrig = ($destinoOrig === '' && $setOrig !== '');
    if ($isEntregaDest || $isEntregaOrig) {
        respondJson(['success' => false, 'message' => 'Conjunto permitido apenas entre carregamentos de transferência.']);
    }

    $resCheck = sql(
        "SELECT
            (SELECT COALESCE(seq_carregamento_conjunto, 0) FROM {$tabelaCap} WHERE unidade = \$1 AND seq_carregamento = \$2 LIMIT 1) AS dest_conj,
            (SELECT 1 FROM {$tabelaCap} WHERE unidade = \$1 AND seq_carregamento_conjunto = \$2 LIMIT 1) AS dest_eh_sec,
            (SELECT COALESCE(seq_carregamento_conjunto, 0) FROM {$tabelaCap} WHERE unidade = \$1 AND seq_carregamento = \$3 LIMIT 1) AS orig_conj,
            (SELECT 1 FROM {$tabelaCap} WHERE unidade = \$1 AND seq_carregamento_conjunto = \$3 LIMIT 1) AS orig_eh_sec",
        [$unidade, $seqDest, $seqOrig],
        $conn
    );
    $destConj = 0;
    $origConj = 0;
    $destEhSec = false;
    $origEhSec = false;
    if ($resCheck && pg_num_rows($resCheck) > 0) {
        $rc = pg_fetch_assoc($resCheck);
        $destConj = (int)($rc['dest_conj'] ?? 0);
        $origConj = (int)($rc['orig_conj'] ?? 0);
        $destEhSec = ($rc['dest_eh_sec'] ?? null) !== null;
        $origEhSec = ($rc['orig_eh_sec'] ?? null) !== null;
    }
    if ($destConj > 0 || $destEhSec || $origConj > 0 || $origEhSec) {
        respondJson(['success' => false, 'message' => 'Um dos carregamentos já faz parte de um conjunto.']);
    }

    pg_query($conn, 'BEGIN');
    try {
        $upd = sql(
            "UPDATE {$tabelaCap}
             SET seq_carregamento_conjunto = \$1
             WHERE unidade = \$2
               AND seq_carregamento = \$3",
            [$seqOrig, $unidade, $seqDest],
            $conn
        );
        $affected = $upd ? (int)pg_affected_rows($upd) : 0;
        if ($affected <= 0) {
            $ins = sql(
                "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, seq_carregamento_conjunto, simulado, tp_carregamento)
                 VALUES (\$1, \$2, \$3, FALSE, 'T')",
                [$unidade, $seqDest, $seqOrig],
                $conn
            );
            if (!$ins) throw new Exception('Erro ao inserir conjunto.');
        }
        pg_query($conn, 'COMMIT');
        respondJson(['success' => true, 'placa1' => $placaDest, 'placa2' => $placaOrig, 'seq1' => $seqDest, 'seq2' => $seqOrig]);
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao criar carregamento conjunto.']);
    }
}

// ─── Ação: fundir carregamentos de entrega (juntar setores em um único carregamento) ───
if ($acao === 'fundir_entrega') {
    $placaOrig = strtoupper(trim((string)($input['placa_origem'] ?? '')));
    $placaDest = strtoupper(trim((string)($input['placa_destino'] ?? '')));

    if ($placaOrig === '' || $placaDest === '' || $placaOrig === $placaDest) {
        respondJson(['success' => false, 'message' => 'Placas inválidas para fusão.']);
    }

    $resDest = sql(
        "SELECT seq_carregamento, COALESCE(setores_entrega, '') AS setores_entrega, COALESCE(destino, '') AS destino
         FROM {$tabela}
         WHERE unidade = \$1
           AND UPPER(placa_provisoria) = UPPER(\$2)
           AND data_finalizacao IS NULL
         ORDER BY data_inclusao ASC, hora_inclusao ASC
         LIMIT 1",
        [$unidade, $placaDest],
        $conn
    );
    $resOrig = sql(
        "SELECT seq_carregamento, COALESCE(setores_entrega, '') AS setores_entrega, COALESCE(destino, '') AS destino
         FROM {$tabela}
         WHERE unidade = \$1
           AND UPPER(placa_provisoria) = UPPER(\$2)
           AND data_finalizacao IS NULL
         ORDER BY data_inclusao ASC, hora_inclusao ASC
         LIMIT 1",
        [$unidade, $placaOrig],
        $conn
    );

    if (!$resDest || pg_num_rows($resDest) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento de destino não encontrado (ou finalizado).']);
    }
    if (!$resOrig || pg_num_rows($resOrig) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento de origem não encontrado (ou finalizado).']);
    }

    $rowDest = pg_fetch_assoc($resDest);
    $rowOrig = pg_fetch_assoc($resOrig);
    $seqDest = (int)($rowDest['seq_carregamento'] ?? 0);
    $seqOrig = (int)($rowOrig['seq_carregamento'] ?? 0);
    if ($seqDest <= 0 || $seqOrig <= 0) {
        respondJson(['success' => false, 'message' => 'seq_carregamento inválido para fusão.']);
    }

    $destinoDest = strtoupper(trim((string)($rowDest['destino'] ?? '')));
    $destinoOrig = strtoupper(trim((string)($rowOrig['destino'] ?? '')));
    $setDest = strtoupper(trim((string)($rowDest['setores_entrega'] ?? '')));
    $setOrig = strtoupper(trim((string)($rowOrig['setores_entrega'] ?? '')));

    $isEntregaDest = ($destinoDest === '' && $setDest !== '');
    $isEntregaOrig = ($destinoOrig === '' && $setOrig !== '');
    if (!$isEntregaDest || !$isEntregaOrig) {
        respondJson(['success' => false, 'message' => 'Fusão permitida apenas entre carregamentos de entrega.']);
    }

    $setores = array_values(array_unique(array_merge(parseCsvSiglas($setDest), parseCsvSiglas($setOrig))));
    $setoresCsv = implode(',', $setores);

    pg_query($conn, 'BEGIN');
    try {
        $moved = 0;

        @pg_query_params(
            $conn,
            "DELETE FROM {$tabela} o
             USING {$tabela} d
             WHERE o.unidade = \$1
               AND UPPER(o.placa_provisoria) = UPPER(\$2)
               AND o.data_finalizacao IS NULL
               AND o.nro_cte <> 0
               AND d.unidade = \$1
               AND UPPER(d.placa_provisoria) = UPPER(\$3)
               AND d.data_finalizacao IS NULL
               AND COALESCE(UPPER(o.ser_cte), '') = COALESCE(UPPER(d.ser_cte), '')
               AND o.nro_cte = d.nro_cte",
            [$unidade, $placaOrig, $placaDest]
        );

        $up = @pg_query_params(
            $conn,
            "UPDATE {$tabela}
             SET placa_provisoria = \$1,
                 seq_carregamento = \$2,
                 setores_entrega = \$3,
                 destino = '',
                 unidades = ''
             WHERE unidade = \$4
               AND UPPER(placa_provisoria) = UPPER(\$5)
               AND data_finalizacao IS NULL
               AND nro_cte <> 0",
            [$placaDest, $seqDest, $setoresCsv, $unidade, $placaOrig]
        );
        if ($up) $moved = pg_affected_rows($up);

        @pg_query_params(
            $conn,
            "DELETE FROM {$tabela}
             WHERE unidade = \$1
               AND UPPER(placa_provisoria) = UPPER(\$2)
               AND data_finalizacao IS NULL",
            [$unidade, $placaOrig]
        );

        @pg_query_params(
            $conn,
            "UPDATE {$tabela}
             SET setores_entrega = \$1,
                 destino = '',
                 unidades = ''
             WHERE unidade = \$2
               AND UPPER(placa_provisoria) = UPPER(\$3)
               AND data_finalizacao IS NULL",
            [$setoresCsv, $unidade, $placaDest]
        );

        @pg_query_params(
            $conn,
            "DELETE FROM {$tabelaCap}
             WHERE unidade = \$1
               AND seq_carregamento = \$2",
            [$unidade, $seqOrig]
        );

        pg_query($conn, 'COMMIT');
        respondJson(['success' => true, 'moved' => $moved, 'setores' => $setoresCsv]);
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao fundir carregamentos.']);
    }
}

if ($acao === 'separar_entrega_setores') {
    $placa = strtoupper(trim((string)($input['placa'] ?? '')));
    if ($placa === '') {
        respondJson(['success' => false, 'message' => 'Placa não informada.']);
    }

    $resBase = sql(
        "SELECT
            seq_carregamento,
            COALESCE(destino, '') AS destino,
            COALESCE(unidades, '') AS unidades,
            COALESCE(setores_entrega, '') AS setores_entrega,
            COALESCE(origem_ssw, '') AS origem_ssw,
            COALESCE(origem_criacao, '') AS origem_criacao,
            COALESCE(unidade_carregamento, '') AS unidade_carregamento,
            COALESCE(login_inclusao, '') AS login_inclusao,
            data_inclusao,
            hora_inclusao
         FROM {$tabela}
         WHERE unidade = \$1
           AND UPPER(placa_provisoria) = UPPER(\$2)
           AND data_finalizacao IS NULL
         ORDER BY data_inclusao ASC, hora_inclusao ASC
         LIMIT 1",
        [$unidade, $placa],
        $conn
    );
    if (!$resBase || pg_num_rows($resBase) === 0) {
        respondJson(['success' => false, 'message' => 'Carregamento não encontrado (ou finalizado).']);
    }
    $rowBase = pg_fetch_assoc($resBase);
    $seqBase = (int)($rowBase['seq_carregamento'] ?? 0);
    $destinoBase = strtoupper(trim((string)($rowBase['destino'] ?? '')));
    $setoresCsvBase = strtoupper(trim((string)($rowBase['setores_entrega'] ?? '')));
    if (!($destinoBase === '' && $setoresCsvBase !== '')) {
        respondJson(['success' => false, 'message' => 'Disponível apenas para carregamentos de entrega.']);
    }
    if ($seqBase <= 0) {
        respondJson(['success' => false, 'message' => 'seq_carregamento inválido.']);
    }

    $resSet = sql(
        "SELECT DISTINCT
            COALESCE(NULLIF(UPPER(BTRIM(setor_cte)), ''), UPPER(BTRIM(destino_cte)), '') AS setor
         FROM {$tabela}
         WHERE unidade = \$1
           AND seq_carregamento = \$2
           AND data_finalizacao IS NULL
           AND nro_cte <> 0",
        [$unidade, $seqBase],
        $conn
    );
    $setores = [];
    while ($resSet && ($r = pg_fetch_assoc($resSet))) {
        $s = strtoupper(trim((string)($r['setor'] ?? '')));
        $s = preg_replace('/[^A-Z0-9]/', '', $s);
        if ($s === '') continue;
        if (!in_array($s, $setores, true)) $setores[] = $s;
    }
    if (count($setores) <= 1) {
        respondJson(['success' => true, 'created' => 0, 'moved' => 0, 'setores' => $setores]);
    }
    sort($setores);

    $capCols = [];
    try {
        $resCols = sql(
            "SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = lower(\$1)",
            [$tabelaCap],
            $conn
        );
        while ($resCols && ($rc = pg_fetch_assoc($resCols))) {
            $c = strtolower(trim((string)($rc['column_name'] ?? '')));
            if ($c !== '') $capCols[$c] = true;
        }
    } catch (Exception $e) {
        $capCols = [];
    }
    $wantCols = [
        'unidade','seq_carregamento','placa_provisoria','cap_ton','cap_m3','vlr_min_frete','vlr_frete_carreteiro','custo_entrega',
        'simulado','nro_linha','seq_carregamento_conjunto','placa_definitiva','placa_carreta','cpf_motorista','ddd_motorista','fone_motorista',
        'qtde_pallets','conferente','ajudantes','doca','tp_carregamento'
    ];
    $useCols = [];
    foreach ($wantCols as $c) {
        if (isset($capCols[$c])) $useCols[] = $c;
    }

    $created = 0;
    $movedTotal = 0;

    pg_query($conn, 'BEGIN');
    try {
        $setorBase = (string)$setores[0];

        $updHeader = sql(
            "UPDATE {$tabela}
             SET setores_entrega = \$1, destino = '', unidades = ''
             WHERE unidade = \$2
               AND seq_carregamento = \$3
               AND data_finalizacao IS NULL
               AND nro_cte = 0",
            [$setorBase, $unidade, $seqBase],
            $conn
        );

        $updBase = sql(
            "UPDATE {$tabela}
             SET setores_entrega = \$1, destino = '', unidades = ''
             WHERE unidade = \$2
               AND seq_carregamento = \$3
               AND data_finalizacao IS NULL
               AND nro_cte <> 0
               AND COALESCE(NULLIF(UPPER(BTRIM(setor_cte)), ''), UPPER(BTRIM(destino_cte)), '') = \$4",
            [$setorBase, $unidade, $seqBase, $setorBase],
            $conn
        );

        for ($i = 1; $i < count($setores); $i += 1) {
            $setor = (string)$setores[$i];
            $seqNew = nextSeqCarregamento($conn, $seqName);
            if ($seqNew <= 0) throw new Exception('Erro ao gerar seq_carregamento.');

            $insHeader = sql(
                "INSERT INTO {$tabela}
                 (unidade, seq_carregamento, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao, nro_cte,
                  destino, unidades, setores_entrega, origem_ssw, origem_criacao, unidade_carregamento)
                 VALUES (\$1, \$2, \$3, \$4, \$5::date, \$6::time, 0, '', '', \$7, \$8, \$9, \$10)",
                [
                    $unidade,
                    $seqNew,
                    $placa,
                    (string)($rowBase['login_inclusao'] ?? $login),
                    (string)($rowBase['data_inclusao'] ?? date('Y-m-d')),
                    (string)($rowBase['hora_inclusao'] ?? date('H:i:s')),
                    $setor,
                    (string)($rowBase['origem_ssw'] ?? ''),
                    (string)($rowBase['origem_criacao'] ?? ''),
                    (string)($rowBase['unidade_carregamento'] ?? $unidade),
                ],
                $conn
            );

            if (count($useCols) > 0) {
                $colsInsert = implode(',', $useCols);
                $colsSelect = [];
                foreach ($useCols as $c) {
                    if ($c === 'seq_carregamento') $colsSelect[] = ((int)$seqNew) . " AS seq_carregamento";
                    elseif ($c === 'tp_carregamento') $colsSelect[] = "'E' AS tp_carregamento";
                    else $colsSelect[] = "cap.{$c}";
                }
                $colsSelectSql = implode(',', $colsSelect);
                $insCap = sql(
                    "INSERT INTO {$tabelaCap} ({$colsInsert})
                     SELECT {$colsSelectSql}
                     FROM {$tabelaCap} cap
                     WHERE cap.unidade = \$1
                       AND cap.seq_carregamento = \$2
                     LIMIT 1",
                    [$unidade, $seqBase],
                    $conn
                );
                $aff = $insCap ? (int)pg_affected_rows($insCap) : 0;
                if ($aff <= 0) {
                    @pg_query_params(
                        $conn,
                        "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, simulado, tp_carregamento)
                         VALUES (\$1, \$2, \$3, FALSE, 'E')
                         ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria",
                        [$unidade, $seqNew, $placa]
                    );
                }
            } else {
                @pg_query_params(
                    $conn,
                    "INSERT INTO {$tabelaCap} (unidade, seq_carregamento, placa_provisoria, simulado, tp_carregamento)
                     VALUES (\$1, \$2, \$3, FALSE, 'E')
                     ON CONFLICT (unidade, seq_carregamento) DO UPDATE SET placa_provisoria = EXCLUDED.placa_provisoria",
                    [$unidade, $seqNew, $placa]
                );
            }

            $up = sql(
                "UPDATE {$tabela}
                 SET seq_carregamento = \$1,
                     setores_entrega = \$2,
                     destino = '',
                     unidades = ''
                 WHERE unidade = \$3
                   AND seq_carregamento = \$4
                   AND data_finalizacao IS NULL
                   AND nro_cte <> 0
                   AND COALESCE(NULLIF(UPPER(BTRIM(setor_cte)), ''), UPPER(BTRIM(destino_cte)), '') = \$5",
                [$seqNew, $setor, $unidade, $seqBase, $setor],
                $conn
            );
            if ($up) $movedTotal += (int)pg_affected_rows($up);
            $created += 1;
        }

        pg_query($conn, 'COMMIT');
        respondJson(['success' => true, 'created' => $created, 'moved' => $movedTotal, 'setores' => $setores]);
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao separar carregamento por setores.']);
    }
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);
