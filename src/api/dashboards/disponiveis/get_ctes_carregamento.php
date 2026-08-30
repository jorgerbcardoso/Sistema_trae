<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

$input  = getRequestInput();
$placa  = strtoupper(trim($input['placa'] ?? ''));
$seqCarreg = (int)($input['seq_carregamento'] ?? 0);

if ($seqCarreg <= 0 && empty($placa)) {
    respondJson(['success' => false, 'message' => 'Placa ou seq_carregamento não informado.']);
}
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

function tabelaExisteCtesCarreg($conn, string $tableName): bool {
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

function getTabelaUnidadesDominioCtesCarreg($conn, string $domain): string {
    $domain = trim((string)$domain);
    $t1 = $domain . '_unidade';
    $t2 = $domain . '_unidades';
    if (tabelaExisteCtesCarreg($conn, $t1)) return $t1;
    if (tabelaExisteCtesCarreg($conn, $t2)) return $t2;
    return $t1;
}

function parseListaUnidadesCompartCtesCarreg(string $csv): array {
    $csv = strtoupper(trim((string)$csv));
    if ($csv === '') return [];
    $parts = preg_split('/[,\s;]+/', $csv);
    if (!is_array($parts)) return [];
    $out = [];
    foreach ($parts as $p) {
        $u = strtoupper(trim((string)$p));
        if ($u === '') continue;
        if (!preg_match('/^[A-Z0-9]{2,5}$/', $u)) continue;
        $out[$u] = true;
    }
    return array_keys($out);
}

function buildMapaDestinoCompartilhadoCtesCarreg($conn, string $tblUnidade): array {
    $map = [];
    $tblUnidade = trim((string)$tblUnidade);
    if ($tblUnidade === '') return $map;
    $res = sql(
        "SELECT sigla, unidades_compart
         FROM {$tblUnidade}
         WHERE COALESCE(TRIM(unidades_compart), '') <> ''",
        [],
        $conn
    );
    while ($res && ($row = pg_fetch_assoc($res))) {
        $main = strtoupper(trim((string)($row['sigla'] ?? '')));
        if ($main === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $main)) continue;
        $lista = parseListaUnidadesCompartCtesCarreg((string)($row['unidades_compart'] ?? ''));
        foreach ($lista as $u) {
            if (!isset($map[$u])) $map[$u] = $main;
        }
    }
    return $map;
}

$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? ''
));

$conn = connect();
$tabela = "{$domain}_carregamento";
$tblUnidade = getTabelaUnidadesDominioCtesCarreg($conn, $domain);
$mapDestinoCompart = buildMapaDestinoCompartilhadoCtesCarreg($conn, $tblUnidade);

$whereSql = $seqCarreg > 0
    ? "unidade = \$1 AND seq_carregamento = \$2"
    : "unidade = \$1 AND UPPER(placa_provisoria) = \$2";
$params = $seqCarreg > 0 ? [$unidade, $seqCarreg] : [$unidade, $placa];

$sql = "
    SELECT
        nro_cte,
        ser_cte,
        COALESCE(NULLIF(unidade_carregamento, ''), unidade) AS unidade_carregamento,
        destino_cte,
        TO_CHAR(
            CASE
                WHEN data_emissao_cte IS NULL THEN NULL
                WHEN EXTRACT(YEAR FROM data_emissao_cte) = 1 THEN
                    data_emissao_cte + make_interval(
                        years => (
                            (CASE
                                WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 11 AND EXTRACT(MONTH FROM data_emissao_cte) <= 2
                                    THEN EXTRACT(YEAR FROM CURRENT_DATE)::int + 1
                                ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int
                             END) - 1
                        )
                    )
                ELSE data_emissao_cte
            END,
            'DD/MM/YYYY'
        ) AS data_emissao,
        TO_CHAR(
            CASE
                WHEN data_prev_ent_cte IS NULL THEN NULL
                WHEN EXTRACT(YEAR FROM data_prev_ent_cte) = 1 THEN
                    data_prev_ent_cte + make_interval(
                        years => (
                            (CASE
                                WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 11 AND EXTRACT(MONTH FROM data_prev_ent_cte) <= 2
                                    THEN EXTRACT(YEAR FROM CURRENT_DATE)::int + 1
                                ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int
                             END) - 1
                        )
                    )
                ELSE data_prev_ent_cte
            END,
            'DD/MM/YYYY'
        ) AS data_prev_ent,
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
    WHERE {$whereSql}
      AND nro_cte > 0
    ORDER BY data_inclusao ASC, hora_inclusao ASC
";

$res = sql($sql, $params, $conn);

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

    $destOrig = strtoupper(trim($row['destino_cte'] ?? ''));
    $destMain = $destOrig !== '' ? (string)($mapDestinoCompart[$destOrig] ?? $destOrig) : '';
    $destMain = strtoupper(trim((string)$destMain));
    $destDisplay = ($destMain !== '' && $destOrig !== '' && $destMain !== $destOrig) ? ($destMain . ' (' . $destOrig . ')') : $destOrig;

    $totFrete += $vlrFrete;
    $totPeso  += $pesoNum;
    $totCub   += $cubNum;
    $totVol   += $qtdeVol;

    $ctes[] = [
        'seq_cte'       => $nroCte,   // compatibilidade com frontend
        'ctrc'          => $ctrc,
        'unidade_carregamento' => strtoupper(trim($row['unidade_carregamento'] ?? '')),
        'data_emissao'  => $row['data_emissao'] ?? '',
        'data_prev_ent' => $row['data_prev_ent'] ?? '',
        'sigla_dest'    => $destOrig,
        'sigla_dest_principal' => $destMain,
        'sigla_dest_display' => $destDisplay,
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
