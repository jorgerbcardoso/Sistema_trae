<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

$input  = getRequestInput();
$placa  = strtoupper(trim($input['placa'] ?? ''));

if (empty($placa)) {
    respondJson(['success' => false, 'message' => 'Placa não informada.']);
}
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? ''
));

$conn = connect();
$tabelaCarregamento = "{$domain}_carregamento";
$tabelaCte          = "{$domain}_cte";

// Detecta colunas disponíveis na tabela de CT-e
$cols = [];
try {
    $resCols = sql(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [strtolower($tabelaCte)],
        $conn
    );
    while ($resCols && ($r = pg_fetch_assoc($resCols))) {
        $cols[] = strtolower($r['column_name']);
    }
} catch (Exception $e) {}

$colPeso       = in_array('peso_real', $cols, true) ? 'peso_real' : (in_array('peso', $cols, true) ? 'peso' : null);
$colCubagem    = in_array('cubagem', $cols, true) ? 'cubagem' : (in_array('vlr_cubagem', $cols, true) ? 'vlr_cubagem' : null);
$colEmissao    = in_array('data_emissao', $cols, true) ? 'data_emissao' : null;
$colPrevEnt    = in_array('data_prev_ent', $cols, true) ? 'data_prev_ent' : null;
$colVlrFrete   = in_array('vlr_frete', $cols, true) ? 'vlr_frete' : null;
$colSiglaDest  = in_array('sigla_dest', $cols, true) ? 'sigla_dest' : null;
$colSerCte     = in_array('ser_cte', $cols, true) ? 'ser_cte' : null;
$colNroCte     = in_array('nro_cte', $cols, true) ? 'nro_cte' : null;
$colQtdeVol    = in_array('qtde_vol', $cols, true) ? 'qtde_vol' : null;

$selects = [];
if ($colSerCte)     $selects[] = "ct.{$colSerCte}     AS ser_cte";
if ($colNroCte)     $selects[] = "ct.{$colNroCte}     AS nro_cte";
if ($colEmissao)    $selects[] = "TO_CHAR(ct.{$colEmissao}, 'DD/MM/YYYY') AS data_emissao";
if ($colPrevEnt)    $selects[] = "TO_CHAR(ct.{$colPrevEnt}, 'DD/MM/YYYY') AS data_prev_ent";
if ($colSiglaDest)  $selects[] = "ct.{$colSiglaDest}  AS sigla_dest";
if ($colVlrFrete)   $selects[] = "COALESCE(ct.{$colVlrFrete}, 0) AS vlr_frete";
if ($colPeso)       $selects[] = "ct.{$colPeso}::text AS peso";
if ($colCubagem)    $selects[] = "ct.{$colCubagem}::text AS cubagem";
if ($colQtdeVol)    $selects[] = "ct.{$colQtdeVol}   AS qtde_vol";

if (empty($selects)) {
    respondJson(['success' => false, 'message' => 'Tabela de CT-es não possui colunas reconhecidas.']);
}

$sql = "
    SELECT
        c.seq_cte,
        " . implode(",\n        ", $selects) . "
    FROM {$tabelaCarregamento} c
    LEFT JOIN {$tabelaCte} ct ON ct.seq_cte = c.seq_cte
    WHERE c.unidade = $1
      AND UPPER(c.placa_provisoria) = $2
      AND c.seq_cte > 0
    ORDER BY c.data_inclusao ASC, c.hora_inclusao ASC
";

$res = sql($sql, [$unidade, $placa], $conn);

function parseNumeroCte($value) {
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

$ctes   = [];
$totFrete = 0.0;
$totPeso  = 0.0;
$totCub   = 0.0;
$totVol   = 0;

while ($res && ($row = pg_fetch_assoc($res))) {
    $serCte    = $row['ser_cte'] ?? '';
    $nroCte    = (int)($row['nro_cte'] ?? 0);
    $ctrc      = $nroCte > 0 ? ($serCte . str_pad($nroCte, 6, '0', STR_PAD_LEFT)) : ('#' . $row['seq_cte']);

    $vlrFrete  = parseNumeroCte($row['vlr_frete'] ?? 0);
    $pesoNum   = parseNumeroCte($row['peso'] ?? 0);
    $cubNum    = parseNumeroCte($row['cubagem'] ?? 0);
    $qtdeVol   = (int)($row['qtde_vol'] ?? 0);

    $totFrete += $vlrFrete;
    $totPeso  += $pesoNum;
    $totCub   += $cubNum;
    $totVol   += $qtdeVol;

    $ctes[] = [
        'seq_cte'       => (int)$row['seq_cte'],
        'ctrc'          => $ctrc,
        'data_emissao'  => $row['data_emissao'] ?? '',
        'data_prev_ent' => $row['data_prev_ent'] ?? '',
        'sigla_dest'    => strtoupper(trim($row['sigla_dest'] ?? '')),
        'vlr_frete'     => round($vlrFrete, 2),
        'peso'          => round($pesoNum, 2),
        'cubagem'       => round($cubNum, 3),
        'qtde_vol'      => $qtdeVol,
    ];
}

respondJson([
    'success' => true,
    'ctes'    => $ctes,
    'totais'  => [
        'vlr_frete' => round($totFrete, 2),
        'peso'      => round($totPeso, 2),
        'cubagem'   => round($totCub, 3),
        'qtde_vol'  => $totVol,
    ],
]);
