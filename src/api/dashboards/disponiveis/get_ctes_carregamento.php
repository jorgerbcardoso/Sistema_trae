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
$tabela = "{$domain}_carregamento";

$sql = "
    SELECT
        nro_cte,
        ser_cte,
        destino_cte,
        TO_CHAR(data_emissao_cte, 'DD/MM/YYYY')  AS data_emissao,
        TO_CHAR(data_prev_ent_cte, 'DD/MM/YYYY') AS data_prev_ent,
        remetente_cte,
        destinatario_cte,
        pagador_cte,
        cidade_destino_cte,
        COALESCE(vlr_merc_cte, 0)   AS vlr_merc,
        COALESCE(vlr_frete_cte, 0)  AS vlr_frete,
        COALESCE(peso_cte, 0)       AS peso,
        COALESCE(cubagem_cte, 0)    AS cubagem,
        COALESCE(qtde_vol_cte, 0)   AS qtde_vol
    FROM {$tabela}
    WHERE unidade = \$1
      AND UPPER(placa_provisoria) = \$2
      AND nro_cte > 0
    ORDER BY data_inclusao ASC, hora_inclusao ASC
";

$res = sql($sql, [$unidade, $placa], $conn);

$ctes     = [];
$totFrete = 0.0;
$totPeso  = 0.0;
$totCub   = 0.0;
$totVol   = 0;

while ($res && ($row = pg_fetch_assoc($res))) {
    $serCte = $row['ser_cte'] ?? '';
    $nroCte = (int)($row['nro_cte'] ?? 0);
    $ctrc   = ($nroCte > 0 && $serCte !== '') ? ($serCte . str_pad($nroCte, 6, '0', STR_PAD_LEFT)) : ('#' . $nroCte);

    $vlrFrete = (float)($row['vlr_frete'] ?? 0);
    $pesoNum  = (float)($row['peso'] ?? 0);
    $cubNum   = (float)($row['cubagem'] ?? 0);
    $qtdeVol  = (int)($row['qtde_vol'] ?? 0);

    $totFrete += $vlrFrete;
    $totPeso  += $pesoNum;
    $totCub   += $cubNum;
    $totVol   += $qtdeVol;

    $ctes[] = [
        'seq_cte'       => $nroCte,   // compatibilidade com frontend
        'ctrc'          => $ctrc,
        'data_emissao'  => $row['data_emissao'] ?? '',
        'data_prev_ent' => $row['data_prev_ent'] ?? '',
        'sigla_dest'    => strtoupper(trim($row['destino_cte'] ?? '')),
        'nome_pag'      => $row['pagador_cte'] ?? '',
        'destinatario'  => $row['destinatario_cte'] ?? '',
        'remetente'     => $row['remetente_cte'] ?? '',
        'cidade'        => $row['cidade_destino_cte'] ?? '',
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
