<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../lib/ssw_loader.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtoupper((string)($auth['domain'] ?? ''));

if (!preg_match('/^[A-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();
$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    (string)($input['unidade']
    ?? $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? '')
));
$placaSim = strtoupper(trim((string)($input['placa_simulacao'] ?? '')));
$setores = $input['setores'] ?? null;

if ($unidade === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade inválida.']);
}
if ($placaSim === '' || !preg_match('/^[A-Z0-9]{6,10}$/', preg_replace('/[^A-Z0-9]/', '', $placaSim))) {
    respondJson(['success' => false, 'message' => 'Placa inválida.']);
}
if (!is_array($setores) || count($setores) === 0) {
    respondJson(['success' => false, 'message' => 'Setores não informados.']);
}

$normPlate = function(string $p): string {
    return preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($p)));
};
$toFloat = function($v): float {
    if ($v === null || $v === '') return 0.0;
    if (is_int($v) || is_float($v)) return (float)$v;
    $s = trim((string)$v);
    if ($s === '') return 0.0;
    $s = str_replace(['.', ' '], ['', ''], $s);
    $s = str_replace(',', '.', $s);
    $n = (float)$s;
    return is_finite($n) ? $n : 0.0;
};

$setorMap = [];
foreach ($setores as $it) {
    if (!is_array($it)) continue;
    $setor = strtoupper(trim((string)($it['setor'] ?? '')));
    if ($setor === '') continue;
    $ctes = (int)($it['ctes'] ?? 0);
    $clientes = (int)($it['clientes'] ?? 0);
    if ($ctes < 0) $ctes = 0;
    if ($clientes < 0) $clientes = 0;
    $setorMap[$setor] = ['ctes' => $ctes, 'clientes' => $clientes];
}
if (count($setorMap) === 0) {
    respondJson(['success' => false, 'message' => 'Setores inválidos.']);
}

$getCsv = function(string $domain, string $unidade): array {
    try {
        require_ssw();
        ssw_login($domain);
    } catch (Exception $e) {
        return ['ok' => false, 'message' => 'Falha ao autenticar.'];
    }

    try {
        ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($unidade) . '&f3=101');
    } catch (Exception $e) {
        return ['ok' => false, 'message' => 'Falha ao trocar unidade.'];
    }

    $html = '';
    try {
        $html = ssw_go('https://sistema.ssw.inf.br/bin/ssw0012?act=GERA_TABS&f5=R&t_para_raiz=N');
    } catch (Exception $e) {
        return ['ok' => false, 'message' => 'Falha ao gerar tabela.'];
    }

    $html = urldecode((string)$html);
    $matches = [];
    preg_match_all("/abrir\\(\\'([^\\']+\\.csv)\\'/i", $html, $matches);
    $files = isset($matches[1]) && is_array($matches[1]) ? $matches[1] : [];
    $files = array_values(array_filter(array_map('trim', $files)));
    if (count($files) === 0) {
        return ['ok' => false, 'message' => 'Retorno sem arquivos.'];
    }

    $chosen = '';
    foreach ($files as $f) {
        if (preg_match('/_eve\\.csv$/i', $f)) { $chosen = $f; break; }
    }
    if ($chosen === '') {
        $chosen = $files[count($files) >= 2 ? 1 : 0];
    }

    $chosen = basename($chosen);
    if (!preg_match('/^[A-Za-z0-9_\\-\\.]+\\.csv$/', $chosen)) {
        return ['ok' => false, 'message' => 'Nome de arquivo inválido.'];
    }

    $csv = '';
    try {
        $csv = ssw_go('https://sistema.ssw.inf.br/bin/ssw0422?act=' . urlencode($chosen) . '&filename=' . urlencode($chosen) . '&path=xml&down=1&nw=1');
    } catch (Exception $e) {
        $csv = '';
    }
    if (trim((string)$csv) === '') {
        try {
            $csv = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . urlencode($chosen) . '&filename=' . urlencode($chosen) . '&path=xml&down=1&nw=1');
        } catch (Exception $e) {
            $csv = '';
        }
    }
    if (trim((string)$csv) === '') {
        return ['ok' => false, 'message' => 'Falha ao baixar arquivo.'];
    }

    return ['ok' => true, 'file' => $chosen, 'csv' => (string)$csv];
};

$respCsv = $getCsv($domain, $unidade);
if (!$respCsv['ok']) {
    respondJson(['success' => false, 'message' => (string)($respCsv['message'] ?? 'Falha ao gerar tabela.')]);
}

$csvText = (string)($respCsv['csv'] ?? '');
$lines = preg_split("/\\r\\n|\\n|\\r/", $csvText);
$rows = [];
foreach ($lines as $ln) {
    $ln = trim((string)$ln);
    if ($ln === '') continue;
    $cols = str_getcsv($ln, ';');
    if (!is_array($cols) || count($cols) < 18) continue;
    $rows[] = $cols;
}
if (count($rows) <= 1) {
    respondJson(['success' => false, 'message' => 'Arquivo inválido.']);
}

$placaNorm = $normPlate($placaSim);
$unidadeN = strtoupper($unidade);

$idxUnid = 0;
$idxPlaca = 1;
$idxSetor = 6;
$idxEC = 8;
$idxApos = 15;
$idxDiaria = 17;
$idxCliente = 2;

$tbl = [];
for ($i = 1; $i < count($rows); $i++) {
    $r = $rows[$i];
    $u = strtoupper(trim((string)($r[$idxUnid] ?? '')));
    if ($u === '' || $u !== $unidadeN) continue;
    $p = $normPlate((string)($r[$idxPlaca] ?? ''));
    if ($p === '' || $p !== $placaNorm) continue;
    $set = strtoupper(trim((string)($r[$idxSetor] ?? '')));
    if ($set === '') continue;
    $ec = strtoupper(trim((string)($r[$idxEC] ?? '')));
    $val = $toFloat($r[$idxApos] ?? 0);
    $diaria = $toFloat($r[$idxDiaria] ?? 0);
    $cliente = trim((string)($r[$idxCliente] ?? ''));
    if (!isset($tbl[$set])) $tbl[$set] = [];
    $tbl[$set][] = ['ec' => $ec, 'val' => $val, 'diaria' => $diaria, 'cliente' => $cliente];
}

if (count($tbl) === 0) {
    respondJson(['success' => false, 'message' => 'Placa não encontrada na tabela.']);
}

$pickRow = function(array $rows) {
    $best = null;
    foreach ($rows as $r) {
        $cli = trim((string)($r['cliente'] ?? ''));
        if ($cli === '') { $best = $r; break; }
        if ($best === null) $best = $r;
    }
    return $best;
};

$parcelaSetores = 0.0;
$diariaMax = 0.0;
$detalhes = [];

foreach ($setorMap as $setor => $info) {
    $ctes = (int)($info['ctes'] ?? 0);
    $clientes = (int)($info['clientes'] ?? 0);
    if ($ctes <= 0 && $clientes <= 0) continue;

    $rowsSet = $tbl[$setor] ?? null;
    if (!$rowsSet) $rowsSet = $tbl['999'] ?? null;
    if (!$rowsSet) continue;
    $row = $pickRow($rowsSet);
    if (!$row) continue;

    $ec = strtoupper(trim((string)($row['ec'] ?? '')));
    $unit = (float)($row['val'] ?? 0);
    $diaria = (float)($row['diaria'] ?? 0);
    $mult = ($ec === 'C') ? $clientes : $ctes;
    if ($mult < 0) $mult = 0;
    $custo = $unit * $mult;
    $parcelaSetores += $custo;
    if ($mult > 0 && $diaria > $diariaMax) $diariaMax = $diaria;

    $detalhes[] = [
        'setor' => $setor,
        'ec' => ($ec === 'C' ? 'C' : 'E'),
        'ctes' => $ctes,
        'clientes' => $clientes,
        'mult' => $mult,
        'unit' => $unit,
        'custo' => $custo,
        'diaria' => $diaria,
        'fallback_999' => !isset($tbl[$setor]) ? true : false,
    ];
}

$total = $parcelaSetores + $diariaMax;

respondJson([
    'success' => true,
    'placa' => $placaSim,
    'unidade' => $unidade,
    'arquivo' => (string)($respCsv['file'] ?? ''),
    'parcela_setores' => $parcelaSetores,
    'diaria' => $diariaMax,
    'total' => $total,
    'detalhes' => $detalhes,
]);

