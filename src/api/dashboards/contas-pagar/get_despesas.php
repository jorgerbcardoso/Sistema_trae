<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../lib/ssw_loader.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$g_sql = connect();

$input = getRequestInput();

$summaryOnly = (bool)($input['summary_only'] ?? false);

$seqFornecedor = (int)($input['seq_fornecedor'] ?? 0);
$unidade = strtoupper(trim((string)($input['unidade'] ?? '')));
$grupoEvento = (string)($input['grupo_evento'] ?? '');
$evento = (string)($input['evento'] ?? '');
$competenciaRaw = trim((string)($input['competencia'] ?? ''));
$competenciaYm = trim((string)($input['competencia_ym'] ?? ''));

if (trim($grupoEvento) !== '' && trim($evento) !== '') {
    respondJson(['success' => false, 'message' => 'Selecione Grupo de Evento ou Evento (não é permitido informar os dois).']);
}

$emissaoInicio = trim((string)($input['periodo_emissao_inicio'] ?? ''));
$emissaoFim    = trim((string)($input['periodo_emissao_fim'] ?? ''));
$inclusaoInicio = trim((string)($input['periodo_inclusao_inicio'] ?? ''));
$inclusaoFim    = trim((string)($input['periodo_inclusao_fim'] ?? ''));
$programacaoInicio = trim((string)($input['periodo_programacao_inicio'] ?? ''));
$programacaoFim    = trim((string)($input['periodo_programacao_fim'] ?? ''));
$vencimentoInicio = trim((string)($input['periodo_vencimento_inicio'] ?? ''));
$vencimentoFim    = trim((string)($input['periodo_vencimento_fim'] ?? ''));

$parseIsoDate = static function(string $iso): ?int {
    $iso = trim($iso);
    if ($iso === '') return null;
    $ts = strtotime($iso);
    return $ts ? $ts : null;
};

$diffDaysInclusive = static function(int $startTs, int $endTs): int {
    $days = (int)floor(($endTs - $startTs) / 86400) + 1;
    return $days;
};

$validateRange = static function(string $label, string $ini, string $fim) use ($parseIsoDate, $diffDaysInclusive): void {
    $ini = trim($ini);
    $fim = trim($fim);
    if ($ini === '' && $fim === '') return;
    if ($ini === '' || $fim === '') {
        respondJson(['success' => false, 'message' => "Informe início e fim do período de {$label}."]);
    }
    $s = $parseIsoDate($ini);
    $e = $parseIsoDate($fim);
    if ($s === null || $e === null) {
        respondJson(['success' => false, 'message' => "Período de {$label} inválido."]);
    }
    if ($e < $s) {
        respondJson(['success' => false, 'message' => "Período de {$label} inválido (fim antes do início)."]);
    }
    $days = $diffDaysInclusive($s, $e);
    if ($days > 62) {
        respondJson(['success' => false, 'message' => "Período de {$label} deve ter no máximo 62 dias."]);
    }
};

$hasAnyOfThree =
    ($inclusaoInicio !== '' || $inclusaoFim !== '') ||
    ($programacaoInicio !== '' || $programacaoFim !== '') ||
    ($vencimentoInicio !== '' || $vencimentoFim !== '');

if (!$hasAnyOfThree) {
    respondJson(['success' => false, 'message' => 'Informe ao menos 1 dos períodos: inclusão, programação (pagamento) ou vencimento.']);
}

$validateRange('Inclusão', $inclusaoInicio, $inclusaoFim);
$validateRange('Programação (Pagamento)', $programacaoInicio, $programacaoFim);
$validateRange('Vencimento', $vencimentoInicio, $vencimentoFim);
$validateRange('Emissão da NF', $emissaoInicio, $emissaoFim);

$toDmy = static function(?string $iso): string {
    $iso = trim((string)$iso);
    if ($iso === '') return '';
    $ts = strtotime($iso);
    if (!$ts) return '';
    return date('dmy', $ts);
};

$normalizeDigits = static function(string $s): string {
    return preg_replace('/\D+/', '', $s);
};

$parseMoney = static function(string $s): float {
    $v = trim((string)$s);
    if ($v === '') return 0.0;
    $v = str_replace(['.', ' '], ['', ''], $v);
    $v = str_replace(',', '.', $v);
    $n = (float)$v;
    return is_finite($n) ? $n : 0.0;
};

$parseDateBR = static function(string $s): ?int {
    $s = trim((string)$s);
    if ($s === '') return null;
    if (!preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $s, $m)) return null;
    $d = (int)$m[1];
    $mo = (int)$m[2];
    $y = (int)$m[3];
    if ($d < 1 || $d > 31 || $mo < 1 || $mo > 12) return null;
    $ts = mktime(0, 0, 0, $mo, $d, $y);
    return $ts ?: null;
};

$inRangeTs = static function(?int $ts, ?int $start, ?int $end): bool {
    if ($ts === null) return false;
    if ($start !== null && $ts < $start) return false;
    if ($end !== null && $ts > $end) return false;
    return true;
};

$startEmissaoTs = $emissaoInicio !== '' ? strtotime($emissaoInicio) ?: null : null;
$endEmissaoTs   = $emissaoFim !== '' ? strtotime($emissaoFim) ?: null : null;
$startInclusaoTs = $inclusaoInicio !== '' ? strtotime($inclusaoInicio) ?: null : null;
$endInclusaoTs   = $inclusaoFim !== '' ? strtotime($inclusaoFim) ?: null : null;
$startProgTs = $programacaoInicio !== '' ? strtotime($programacaoInicio) ?: null : null;
$endProgTs   = $programacaoFim !== '' ? strtotime($programacaoFim) ?: null : null;
$startVencTs = $vencimentoInicio !== '' ? strtotime($vencimentoInicio) ?: null : null;
$endVencTs   = $vencimentoFim !== '' ? strtotime($vencimentoFim) ?: null : null;

$cnpjFornecedor = '';
$descGrupoEvento = '';
$descEvento = '';
if ($seqFornecedor > 0) {
    $prefix = strtolower($domain);
    $res = sql(
        "SELECT cnpj FROM {$prefix}_fornecedor WHERE seq_fornecedor = $1",
        [$seqFornecedor],
        $g_sql
    );
    if ($res && pg_num_rows($res) > 0) {
        $row = pg_fetch_assoc($res);
        $cnpjFornecedor = $normalizeDigits((string)($row['cnpj'] ?? ''));
    }
}

$parseCompetencia = static function(string $ym, string $raw): array {
    $ym = trim($ym);
    $raw = trim($raw);

    $meses = [
        'jan' => '01', 'fev' => '02', 'mar' => '03', 'abr' => '04', 'mai' => '05', 'jun' => '06',
        'jul' => '07', 'ago' => '08', 'set' => '09', 'out' => '10', 'nov' => '11', 'dez' => '12',
    ];

    $mmyy = '';
    $label = '';

    if ($ym !== '' && preg_match('/^(\d{4})-(\d{2})$/', $ym, $m)) {
        $year = (int)$m[1];
        $month = (int)$m[2];
        if ($month >= 1 && $month <= 12) {
            $mmyy = str_pad((string)$month, 2, '0', STR_PAD_LEFT) . substr((string)$year, -2);
            $mmKey = array_search(str_pad((string)$month, 2, '0', STR_PAD_LEFT), $meses, true);
            if ($mmKey !== false) $label = $mmKey . '/' . substr((string)$year, -2);
        }
        return [$mmyy, $label];
    }

    if ($raw !== '' && preg_match('/^(\d{2})(\d{2})$/', $raw, $m)) {
        $mmyy = $m[1] . $m[2];
        $mmKey = array_search($m[1], $meses, true);
        if ($mmKey !== false) $label = $mmKey . '/' . $m[2];
        return [$mmyy, $label];
    }

    if ($raw !== '' && preg_match('/^([a-z]{3})\/(\d{2})$/i', $raw, $m)) {
        $mon = strtolower($m[1]);
        $yy = $m[2];
        if (isset($meses[$mon])) {
            $mmyy = $meses[$mon] . $yy;
            $label = $mon . '/' . $yy;
            return [$mmyy, $label];
        }
    }

    return ['', ''];
};

[$mesCompParam, $mesCompLabel] = $parseCompetencia($competenciaYm, $competenciaRaw);

$prefix = strtolower($domain);
$eventosNaoConsiderar = [];
$rEv = sql(
    "SELECT evento FROM {$prefix}_evento WHERE COALESCE(considerar, 'S') = 'N'",
    [],
    $g_sql
);
if ($rEv && pg_num_rows($rEv) > 0) {
    while ($rowEv = pg_fetch_assoc($rEv)) {
        $ev = preg_replace('/\D+/', '', (string)($rowEv['evento'] ?? ''));
        if ($ev !== '') $eventosNaoConsiderar[$ev] = true;
    }
}

$grupoEventoNum = (int)preg_replace('/\D+/', '', (string)$grupoEvento);
if ($grupoEventoNum > 0) {
    $r = sql(
        "SELECT descricao FROM {$prefix}_grupo_evento WHERE grupo = $1",
        [$grupoEventoNum],
        $g_sql
    );
    if ($r && pg_num_rows($r) > 0) {
        $row = pg_fetch_assoc($r);
        $descGrupoEvento = trim((string)($row['descricao'] ?? ''));
    }
}

$eventoNum = (int)preg_replace('/\D+/', '', (string)$evento);
if ($eventoNum > 0) {
    $r = sql(
        "SELECT descricao FROM {$prefix}_evento WHERE evento = $1",
        [$eventoNum],
        $g_sql
    );
    if ($r && pg_num_rows($r) > 0) {
        $row = pg_fetch_assoc($r);
        $descEvento = trim((string)($row['descricao'] ?? ''));
    }
}

try {
    require_ssw();
    ssw_login($domain);
    set_time_limit(180);
    ini_set('memory_limit', '512M');
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao inicializar integração de importação: ' . $e->getMessage()]);
}

$params = [
    'act' => $summaryOnly ? 'PES' : 'ARQ',
    'cod_emp_ctb' => '00',
    'sequencia' => '477',
    'sit_desp' => 'T',
    'sit_arq' => 'T',
    'dummy' => (string)round(microtime(true) * 1000),
];

if ($cnpjFornecedor !== '') {
    $params['cgc_fornecedor'] = $cnpjFornecedor;
}

if ($unidade !== '') {
    $params['unid_pgto'] = strtolower($unidade);
}

if ($grupoEventoNum > 0) {
    $params['gru_evento'] = (string)$grupoEventoNum;
    if ($descGrupoEvento !== '') {
        $params['evento_grupo'] = $descGrupoEvento;
    }
}

if ($eventoNum > 0) {
    $params['cod_evento'] = (string)$eventoNum;
    if ($descEvento !== '') {
        $params['evento'] = $descEvento;
    }
}

if ($mesCompParam !== '') {
    $params['mes_comp'] = $mesCompParam;
}

if ($inclusaoInicio !== '' || $inclusaoFim !== '') {
    $params['data_ini_inclusao_despesa'] = $toDmy($inclusaoInicio);
    $params['data_fin_inclusao_despesa'] = $toDmy($inclusaoFim);
}

if ($programacaoInicio !== '' || $programacaoFim !== '') {
    $params['data_ini_pagamento_parcela'] = $toDmy($programacaoInicio);
    $params['data_fin_pagamento_parcela'] = $toDmy($programacaoFim);
}

if ($vencimentoInicio !== '' || $vencimentoFim !== '') {
    $params['data_ini_vencimento_parcela'] = $toDmy($vencimentoInicio);
    $params['data_fin_vencimento_parcela'] = $toDmy($vencimentoFim);
}

if ($emissaoInicio !== '' || $emissaoFim !== '') {
    $params['data_ini_emissao_nota_fiscal'] = $toDmy($emissaoInicio);
    $params['data_fin_emissao_nota_fiscal'] = $toDmy($emissaoFim);
}

$qs = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
$url = "https://sistema.ssw.inf.br/bin/ssw0099?$qs";

$raw = ssw_go($url);
$strDec = urldecode((string)$raw);

if ($summaryOnly) {
    if (substr((string)$raw, 0, 5) === '<foc ') {
        respondJson(['success' => false, 'message' => 'Erro ao ler indicador do ano anterior (0099): ' . (string)$raw]);
    }
    if (!function_exists('get_label')) {
        respondJson(['success' => false, 'message' => 'Função get_label não disponível (ssw.php).']);
    }
    $vlrStr = (string)get_label($strDec, 'Total&nbsp;das&nbsp;despesas&nbsp;(R$):');
    $vlrStr = trim($vlrStr);
    if ($vlrStr === '') {
        respondJson(['success' => false, 'message' => 'Não foi possível localizar o total de despesas no relatório (PES).']);
    }
    $sumTotal = $parseMoney($vlrStr);
    respondJson([
        'success' => true,
        'rows' => [],
        'total' => 0,
        'summary' => [
            'count_total' => 0,
            'sum_total' => $sumTotal,
            'sum_liqu' => 0,
            'sum_canc' => 0,
        ],
        'message' => null,
    ]);
}

$noLanc = [
    'N&atilde;o h&aacute; lan&ccedil;amento',
    'Não há lançamento',
    'NAO HA LANCAMENTO',
    'Não há lan&ccedil;amento',
];
foreach ($noLanc as $needle) {
    if (stripos($strDec, $needle) !== false) {
        respondJson(['success' => true, 'rows' => [], 'total' => 0, 'message' => 'Não há lançamentos para o recorte informado.']);
    }
}

$looksLikeCsv = static function(string $s): bool {
    if (stripos($s, 'NUMLANCTO') !== false && strpos($s, ';') !== false) return true;
    if (preg_match('/^\s*3;.*NUMLANCTO;/mi', $s)) return true;
    return false;
};

$extractActArq = static function(string $html): array {
    $act = function_exists('ssw_get_act') ? ssw_get_act($html) : '';
    $arq = function_exists('ssw_get_arq') ? ssw_get_arq($html) : '';
    if ((empty($act) || empty($arq)) && preg_match('/ssw0424\?([^"\']+)/i', $html, $m)) {
        parse_str(html_entity_decode($m[1]), $q);
        if (empty($act) && !empty($q['act'])) $act = (string)$q['act'];
        if (empty($arq) && !empty($q['filename'])) $arq = (string)$q['filename'];
    }
    return [trim((string)$act), trim((string)$arq)];
};

$downloadFrom1440 = static function(string $opcPrefix, string $unidadeFiltro = '') use ($domain, $summaryOnly): ?string {
    $unidadeFiltro = strtoupper(trim((string)$unidadeFiltro));
    $opcPrefix = preg_replace('/\D+/', '', (string)$opcPrefix);
    if ($opcPrefix === '') return null;

    $maxTries = 90;

    for ($try = 0; $try < $maxTries; $try++) {
        $str1440 = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');
        $posXml = strpos($str1440, '<xml');
        if ($posXml !== false) {
            $str1440 = substr($str1440, $posXml);
            $endXml = strpos($str1440, '</xml>');
            if ($endXml !== false) $str1440 = substr($str1440, 0, $endXml) . '</xml>';
        }

        $xml1440 = @simplexml_load_string($str1440);
        $nomeArq = null;
        $pathArq = null;

        if ($xml1440) {
            for ($i = 0; $i <= 140; $i++) {
                $seq = $xml1440->xpath('rs/r/f0')[$i];
                $opc = $xml1440->xpath('rs/r/f1')[$i];
                $usr = $xml1440->xpath('rs/r/f3')[$i];
                $f4  = $xml1440->xpath('rs/r/f4')[$i];
                $sit = $xml1440->xpath('rs/r/f6')[$i];
                $f8  = $xml1440->xpath('rs/r/f8')[$i];

                if ($seq === null) break;

                $usr = trim((string)$usr);
                if (!(($usr === 'presto') || ($usr === 'damasce1') || ($usr === 'claraj'))) continue;

                $unidF4 = strtoupper(trim((string)$f4));
                if ($unidadeFiltro !== '' && $unidF4 !== $unidadeFiltro) continue;

                $sitStr = (string)$sit;
                if ($sitStr !== 'Conclu&iacute;do' && $sitStr !== 'Concluído' && $sitStr !== 'Concluido') continue;

                $opcStr = (string)$opc;
                $opcDigits = preg_replace('/\D+/', '', (string)$opcStr);
                if ($opcDigits === '' || (int)$opcDigits !== (int)$opcPrefix) continue;

                $f8dec = html_entity_decode((string)$f8);
                if (preg_match("/ajaxEnvia\s*\(\s*'DOW(\d+)'\s*\)/", $f8dec, $mDow)) {
                    $htmlDow = ssw_go("https://sistema.ssw.inf.br/bin/ssw1440?act=DOW{$mDow[1]}");
                    if (preg_match('/value="([^"]+)"/', $htmlDow, $mVal)) {
                        $decoded = urldecode($mVal[1]);
                        if (preg_match("/abrir\s*\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*\d+\s*,\s*\d+\s*,\s*'([^']+)'/", $decoded, $mArq)) {
                            $nomeArq = $mArq[1];
                            $pathArq = $mArq[2];
                            break;
                        }
                    }
                }
            }
        }

        if ($nomeArq && $pathArq) {
            $file = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$nomeArq}&filename={$nomeArq}&path={$pathArq}&down=1&nw=1");
            if (!empty($file) && strlen((string)$file) >= 100) return $file;
        }

        $sleepUs = $try < 8 ? 450000 : ($try < 25 ? 1000000 : 1800000);
        usleep($sleepUs);
    }

    return null;
};

$csv = null;
$queued = (strpos($strDec, 'Solicita &ccedil;&atilde;o enviada para processamento.') !== false);
if ($looksLikeCsv($strDec)) {
    $csv = $strDec;
} else {
    [$act, $arq] = $extractActArq($strDec);
    if (!$queued && !empty($act) && !empty($arq)) {
        $csv = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act}&filename={$arq}&path=&down=1&nw=1");
    } else if (preg_match("/ssw0432\\?([^'\\\"]+)/i", $strDec, $m)) {
        $url0432 = "https://sistema.ssw.inf.br/bin/ssw0432?" . $m[1];
        for ($i = 0; $i < 20; $i++) {
            $html0432 = ssw_go($url0432);
            $html0432 = urldecode((string)$html0432);
            if ($looksLikeCsv($html0432)) {
                $csv = $html0432;
                break;
            }
            [$act2, $arq2] = $extractActArq($html0432);
            if (!empty($act2) && !empty($arq2)) {
                $csv = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act2}&filename={$arq2}&path=&down=1&nw=1");
                break;
            }
            usleep(2000000);
        }
    }
}

if (empty($csv) || strlen((string)$csv) < 50) {
    $fromQueue = $downloadFrom1440('099', $unidade);
    if (empty($fromQueue) && $unidade !== '') $fromQueue = $downloadFrom1440('099', '');
    if (!empty($fromQueue)) $csv = $fromQueue;
}

if (empty($csv) || strlen((string)$csv) < 50) {
    respondJson(['success' => false, 'message' => 'Não foi possível obter o CSV do relatório (0099).']);
}

$csv = mb_convert_encoding((string)$csv, 'UTF-8', 'ISO-8859-1');
$csv = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$csv);
$csv = str_replace("\r\n", "\n", str_replace("\r", "\n", (string)$csv));
$lines = array_values(array_filter(explode("\n", (string)$csv), static fn($l) => trim((string)$l) !== ''));

$headerIdx = [];
foreach ($lines as $l) {
    $t = trim((string)$l);
    if (!preg_match('/^3;/', $t)) continue;
    $cols = str_getcsv($t, ';');
    if (!empty($cols)) {
        $cols[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$cols[0]);
    }
    for ($i = 0; $i < count($cols); $i++) {
        $key = strtoupper(trim((string)$cols[$i]));
        if ($key !== '') $headerIdx[$key] = $i;
    }
    break;
}

$get = static function(array $row, array $idx, string $key, int $fallbackIndex): string {
    $k = strtoupper($key);
    $i = isset($idx[$k]) ? (int)$idx[$k] : $fallbackIndex;
    return trim((string)($row[$i] ?? ''));
};

$rows = [];
$sumTotal = 0.0;
$sumLiqu = 0.0;
$sumCanc = 0.0;
$countTotal = 0;
foreach ($lines as $l) {
    $t = trim((string)$l);
    if (!preg_match('/^5;/', $t)) continue;
    $arr = str_getcsv($t, ';');
    if (count($arr) < 10) continue;

    $nroLancto = $get($arr, $headerIdx, 'NUMLANCTO', 2);
    $parcela   = $get($arr, $headerIdx, 'PARCELA', 3);
    $codEvento = $get($arr, $headerIdx, 'EVENTO', 4);
    $codEventoDigits = preg_replace('/\D+/', '', (string)$codEvento);
    $descEvento = $get($arr, $headerIdx, 'DESCR EVENTO', 5);
    $historico = $get($arr, $headerIdx, 'HISTORICO DA DESPESA', 6);
    $cnpj = $normalizeDigits($get($arr, $headerIdx, 'CNPJ FORNECEDOR', 7));
    $nomeFornecedor = $get($arr, $headerIdx, 'NOME FORNECEDOR', 8);
    $valorParcela = $get($arr, $headerIdx, 'VLR PARCELA', 23);
    $dataInclusao = $get($arr, $headerIdx, 'INCLUSAO', 27);
    $dataVenc = $get($arr, $headerIdx, 'VENCIMEN', 29);
    $dataEmissao = $get($arr, $headerIdx, 'EMISSAO', 30);
    $dataPgto = $get($arr, $headerIdx, 'DATA PGTO', 31);
    $uni = strtoupper($get($arr, $headerIdx, 'UNI', 34));
    $sitDes = strtoupper($get($arr, $headerIdx, 'SIT DES', 35));
    $grupoRaw = $get($arr, $headerIdx, 'GRUPO EVENTO', 41);
    $mesCompetencia = $get($arr, $headerIdx, 'MES COMPETENCIA', 42);

    if ($codEventoDigits !== '' && isset($eventosNaoConsiderar[$codEventoDigits])) continue;
    if ($cnpjFornecedor !== '' && $cnpj !== '' && $cnpj !== $cnpjFornecedor) continue;
    if ($unidade !== '' && $uni !== $unidade) continue;
    if ($evento !== '' && preg_replace('/\D+/', '', $codEvento) !== preg_replace('/\D+/', '', (string)$evento)) continue;

    if ($grupoEvento !== '') {
        $grupoNum = '';
        if (preg_match('/^\s*(\d+)/', (string)$grupoRaw, $mG)) $grupoNum = $mG[1];
        if ($grupoNum === '' || (int)$grupoNum !== (int)$grupoEvento) continue;
    }

    if ($mesCompLabel !== '') {
        if (strtolower($mesCompetencia) !== strtolower($mesCompLabel)) continue;
    }

    if ($startInclusaoTs !== null || $endInclusaoTs !== null) {
        $ts = $parseDateBR($dataInclusao);
        if (!$inRangeTs($ts, $startInclusaoTs, $endInclusaoTs)) continue;
    }
    if ($startVencTs !== null || $endVencTs !== null) {
        $ts = $parseDateBR($dataVenc);
        if (!$inRangeTs($ts, $startVencTs, $endVencTs)) continue;
    }
    if ($startEmissaoTs !== null || $endEmissaoTs !== null) {
        $ts = $parseDateBR($dataEmissao);
        if (!$inRangeTs($ts, $startEmissaoTs, $endEmissaoTs)) continue;
    }
    if ($startProgTs !== null || $endProgTs !== null) {
        $ts = $parseDateBR($dataPgto);
        if (!$inRangeTs($ts, $startProgTs, $endProgTs)) continue;
    }

    $vlr = $parseMoney($valorParcela);
    $sumTotal += $vlr;
    $countTotal += 1;
    if ($sitDes === 'LIQU') $sumLiqu += $vlr;
    if ($sitDes === 'CANC') $sumCanc += $vlr;

    if (!$summaryOnly) {
        $rows[] = [
            'nro_lancto' => (int)$nroLancto,
            'parcela' => (int)$parcela,
            'evento' => (int)$codEvento,
            'evento_descricao' => $descEvento,
            'historico' => $historico,
            'fornecedor_cnpj' => $cnpj,
            'fornecedor_nome' => $nomeFornecedor,
            'vlr_parcela' => $valorParcela,
            'data_inclusao' => $dataInclusao,
            'data_vencimento' => $dataVenc,
            'data_emissao_nf' => $dataEmissao,
            'data_programacao_pgto' => $dataPgto,
            'unidade' => $uni,
            'sit_des' => $sitDes,
            'grupo_evento' => $grupoRaw,
            'mes_competencia' => $mesCompetencia,
        ];
    }
}

respondJson([
    'success' => true,
    'rows' => $summaryOnly ? [] : $rows,
    'total' => $summaryOnly ? $countTotal : count($rows),
    'summary' => [
        'count_total' => $countTotal,
        'sum_total' => $sumTotal,
        'sum_liqu' => $sumLiqu,
        'sum_canc' => $sumCanc,
    ],
    'message' => $countTotal === 0 ? 'Nenhum registro retornado para o recorte informado.' : null,
]);
