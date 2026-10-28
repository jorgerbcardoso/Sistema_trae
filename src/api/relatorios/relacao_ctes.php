<?php
require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtolower(trim((string)($auth['domain'] ?? '')));

if ($domain === '' || !preg_match('/^[a-z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.'], 400);
}

$input = getRequestInput();
$filters = is_array($input['filters'] ?? null) ? $input['filters'] : [];

$page = (int)($input['page'] ?? 1);
$pageSize = (int)($input['pageSize'] ?? 100);
$page = $page < 1 ? 1 : $page;
$pageSize = $pageSize < 1 ? 100 : $pageSize;
$pageSize = $pageSize > 100 ? 100 : $pageSize;

$sortKey = strtolower(trim((string)($input['sortKey'] ?? 'data_emissao')));
$sortDir = strtolower(trim((string)($input['sortDir'] ?? 'desc'))) === 'asc' ? 'asc' : 'desc';

$allowedSort = [
    'data_emissao' => "NULLIF(cte.data_emissao::text, '')::timestamp",
    'data_prev_ent' => "NULLIF(cte.data_prev_ent::text, '')::timestamp",
    'data_entrega' => "NULLIF(cte.data_entrega::text, '')::timestamp",
    'ser_cte' => 'cte.ser_cte',
    'nro_cte' => 'cte.nro_cte',
    'sigla_emit' => 'cte.sigla_emit',
    'sigla_dest' => 'cte.sigla_dest',
    'nome_pag' => 'cte.nome_pag',
    'nome_emit' => 'cte.nome_emit',
    'nome_dest' => 'cte.nome_dest',
    'vlr_frete' => 'cte.vlr_frete',
    'vlr_merc' => 'cte.vlr_merc',
    'peso_real' => 'cte.peso_real',
    'cubagem' => 'cte.cubagem',
    'qtde_vol' => 'cte.qtde_vol',
];

$orderBy = $allowedSort[$sortKey] ?? 'cte.data_emissao';

$conn = connect();
$tblCte = "{$domain}_cte";
$tblLiq = "{$domain}_cte_liq";
$tblVc = "{$domain}_vendedor_cliente";

$where = [];
$params = [];
$p = 1;

$where[] = "COALESCE(cte.status, '') <> 'C'";

$addDateRange = function(string $col, $ini, $fim) use (&$where, &$params, &$p) {
    $ini = trim((string)$ini);
    $fim = trim((string)$fim);
    if ($ini !== '' && preg_match('/^\d{4}\-\d{2}\-\d{2}$/', $ini)) {
        $where[] = "{$col} >= $" . $p++;
        $params[] = $ini;
    }
    if ($fim !== '' && preg_match('/^\d{4}\-\d{2}\-\d{2}$/', $fim)) {
        $where[] = "{$col} <= $" . $p++;
        $params[] = $fim;
    }
};

$addInText = function(string $col, $arr, string $regex) use (&$where, &$params, &$p) {
    if (!is_array($arr) || count($arr) === 0) return;
    $vals = [];
    foreach ($arr as $it) {
        $v = strtoupper(trim((string)$it));
        if ($v === '') continue;
        if (!preg_match($regex, $v)) continue;
        $vals[$v] = true;
    }
    $vals = array_keys($vals);
    if (count($vals) === 0) return;
    $ph = [];
    foreach ($vals as $v) { $ph[] = '$' . $p++; $params[] = $v; }
    $where[] = "{$col} IN (" . implode(', ', $ph) . ")";
};

$addInRaw = function(string $col, $arr, callable $norm) use (&$where, &$params, &$p) {
    if (!is_array($arr) || count($arr) === 0) return;
    $vals = [];
    foreach ($arr as $it) {
        $v = $norm($it);
        if ($v === '') continue;
        $vals[$v] = true;
    }
    $vals = array_keys($vals);
    if (count($vals) === 0) return;
    $ph = [];
    foreach ($vals as $v) { $ph[] = '$' . $p++; $params[] = $v; }
    $where[] = "{$col} IN (" . implode(', ', $ph) . ")";
};

$digits = function($v): string {
    $s = preg_replace('/\D/', '', (string)$v);
    return is_string($s) ? $s : '';
};

$addDateRange("cte.data_emissao", $filters['emissaoIni'] ?? '', $filters['emissaoFim'] ?? '');
$addDateRange("cte.data_prev_ent", $filters['prevEntregaIni'] ?? '', $filters['prevEntregaFim'] ?? '');
$addDateRange("cte.data_entrega", $filters['entregaIni'] ?? '', $filters['entregaFim'] ?? '');

$addInText("cte.sigla_emit", $filters['unidadesOrigem'] ?? [], '/^[A-Z0-9]{2,5}$/');
$addInText("cte.sigla_dest", $filters['unidadesDestino'] ?? [], '/^[A-Z0-9]{2,5}$/');

$addInRaw("regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')", $filters['cnpjsPagadores'] ?? [], $digits);
$addInRaw("regexp_replace(COALESCE(cte.cnpj_emit::text, ''), '\\\\D', '', 'g')", $filters['cnpjsRemetentes'] ?? [], $digits);
$addInRaw("regexp_replace(COALESCE(cte.cnpj_dest::text, ''), '\\\\D', '', 'g')", $filters['cnpjsDestinatarios'] ?? [], $digits);

$codMerc = (string)($filters['codMercadoria'] ?? '');
if ($codMerc !== '' && preg_match('/^\d+$/', $codMerc)) {
    $where[] = "cte.cod_mercadoria = $" . $p++;
    $params[] = (int)$codMerc;
}

$tpDocIn = $filters['tpDocumento'] ?? '';
if (is_array($tpDocIn)) {
    $docs = [];
    foreach ($tpDocIn as $d) {
        $t = strtoupper(trim((string)$d));
        if ($t !== '' && $t !== 'TODOS') $docs[$t] = true;
    }
    $docs = array_keys($docs);
    if (count($docs) > 0) {
        $ph = [];
        foreach ($docs as $d) {
            $ph[] = '$' . $p++;
            $params[] = $d;
        }
        $where[] = "UPPER(COALESCE(cte.tp_documento, '')) IN (" . implode(',', $ph) . ")";
    }
} else {
    $tpDoc = strtoupper(trim((string)$tpDocIn));
    if ($tpDoc !== '' && $tpDoc !== 'TODOS') {
        $where[] = "UPPER(COALESCE(cte.tp_documento, '')) = $" . $p++;
        $params[] = $tpDoc;
    }
}

$tpFrete = strtoupper(trim((string)($filters['tpFrete'] ?? '')));
if ($tpFrete === 'C' || $tpFrete === 'F') {
    $where[] = "cte.tp_frete = $" . $p++;
    $params[] = $tpFrete;
}

$liq = strtoupper(trim((string)($filters['liquidacao'] ?? '')));
if ($liq === 'P') {
    $where[] = "NOT EXISTS (SELECT 1 FROM {$tblLiq} liq WHERE liq.seq_cte = cte.seq_cte)";
} elseif ($liq === 'L') {
    $where[] = "EXISTS (SELECT 1 FROM {$tblLiq} liq WHERE liq.seq_cte = cte.seq_cte)";
}

$ent = strtoupper(trim((string)($filters['entrega'] ?? '')));
if ($ent === 'P') {
    $where[] = "cte.data_entrega IS NULL";
} elseif ($ent === 'E') {
    $where[] = "cte.data_entrega IS NOT NULL";
}

$ser = strtoupper(trim((string)($filters['serCte'] ?? '')));
$nro = trim((string)($filters['nroCte'] ?? ''));
if ($ser !== '' && preg_match('/^[A-Z0-9]+$/', $ser) && $nro !== '' && preg_match('/^\d+$/', $nro)) {
    $where[] = "cte.ser_cte = $" . $p++;
    $params[] = $ser;
    $where[] = "cte.nro_cte = $" . $p++;
    $params[] = (int)$nro;
}

$nroNf = trim((string)($filters['nroNf'] ?? ''));
if ($nroNf !== '') {
    $nfDigits = preg_replace('/\D/', '', $nroNf);
    if ($nfDigits !== '') {
        $where[] = "COALESCE(cte.nfs, '') ILIKE $" . $p++;
        $params[] = '%' . $nfDigits . '%';
    }
}

$dacte = preg_replace('/\D/', '', (string)($filters['dacte'] ?? ''));
if ($dacte !== '') {
    $where[] = "COALESCE(cte.chave_cte::text, '') ILIKE $" . $p++;
    $params[] = '%' . $dacte . '%';
}

$vendedorLogin = trim((string)($filters['vendedorLogin'] ?? ''));
if ($vendedorLogin !== '') {
    if ($vendedorLogin === '__sem_vendedor__') {
        $where[] = "NOT EXISTS (
            SELECT 1
            FROM {$tblVc} vc
            WHERE regexp_replace(COALESCE(vc.cnpj, ''), '\\\\D', '', 'g') = regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')
        )";
    } else {
        $where[] = "EXISTS (
            SELECT 1
            FROM {$tblVc} vc
            WHERE LOWER(BTRIM(vc.login)) = LOWER(BTRIM($" . $p++ . "))
              AND regexp_replace(COALESCE(vc.cnpj, ''), '\\\\D', '', 'g') = regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')
        )";
        $params[] = $vendedorLogin;
    }
}

$whereSql = count($where) > 0 ? ('WHERE ' . implode(' AND ', $where)) : '';

$cteLatest = "
    WITH cte AS (
        SELECT DISTINCT ON (ser_cte, nro_cte)
            seq_cte,
            ser_cte,
            nro_cte,
            tp_documento,
            tp_frete,
            cnpj_emit,
            cnpj_dest,
            cnpj_pag,
            sigla_emit,
            sigla_dest,
            cod_mercadoria,
            qtde_vol,
            cubagem,
            peso_real,
            peso_calc,
            vlr_frete,
            vlr_merc,
            vlr_icms,
            vlr_pis_cofins,
            vlr_expedicao,
            vlr_recepcao,
            status,
            data_emissao,
            data_prev_ent,
            data_entrega,
            data_chegada_unid,
            unid_atual,
            placa_coleta,
            nfs,
            nome_emit,
            nome_dest,
            nome_pag,
            cep_entrega,
            endereco_entrega,
            bairro_entrega,
            loc_dif_ent,
            custo_seguro,
            custo_icms,
            custo_pis_cofins,
            custo_gris,
            custo_pedagio,
            custo_expedicao,
            custo_transbordo,
            custo_vendedor,
            custo_recepcao,
            custo_desp_div,
            custo_transferencia_real
        FROM {$tblCte} cte
        {$whereSql}
        ORDER BY ser_cte, nro_cte, seq_cte DESC
    )
";

$countRes = sql($cteLatest . "SELECT COUNT(*)::int AS total FROM cte", $params, $conn);
$total = $countRes ? (int)pg_fetch_result($countRes, 0, 0) : 0;
$totalPages = $total > 0 ? (int)ceil($total / $pageSize) : 1;
$offset = ($page - 1) * $pageSize;
if ($offset < 0) $offset = 0;

$listSql = $cteLatest . "
    SELECT
        cte.seq_cte,
        cte.ser_cte,
        cte.nro_cte,
        cte.data_emissao,
        cte.data_chegada_unid,
        cte.data_prev_ent,
        cte.data_entrega,
        cte.sigla_emit,
        cte.sigla_dest,
        cte.unid_atual,
        cte.tp_documento,
        cte.tp_frete,
        cte.nome_pag,
        cte.nome_emit,
        cte.nome_dest,
        cte.cod_mercadoria,
        COALESCE(cte.qtde_vol, 0) AS qtde_vol,
        COALESCE(cte.cubagem, 0) AS cubagem,
        COALESCE(cte.peso_real, 0) AS peso_real,
        COALESCE(cte.peso_calc, 0) AS peso_calc,
        COALESCE(cte.vlr_frete, 0) AS vlr_frete,
        COALESCE(cte.vlr_merc, 0) AS vlr_merc,
        cte.placa_coleta,
        cte.nfs,
        cte.cep_entrega,
        cte.endereco_entrega,
        cte.bairro_entrega,
        COALESCE(cte.custo_seguro, 0) AS custo_seguro,
        COALESCE(cte.custo_icms, 0) AS custo_icms,
        COALESCE(cte.custo_pis_cofins, 0) AS custo_pis_cofins,
        COALESCE(cte.custo_gris, 0) AS custo_gris,
        COALESCE(cte.custo_pedagio, 0) AS custo_pedagio,
        COALESCE(cte.custo_expedicao, 0) AS custo_expedicao,
        COALESCE(cte.custo_transbordo, 0) AS custo_transbordo,
        COALESCE(cte.custo_vendedor, 0) AS custo_vendedor,
        COALESCE(cte.custo_recepcao, 0) AS custo_recepcao,
        COALESCE(cte.custo_desp_div, 0) AS custo_desp_div,
        COALESCE(cte.custo_transferencia_real, 0) AS custo_transferencia_real,
        EXISTS (SELECT 1 FROM {$tblLiq} liq WHERE liq.seq_cte = cte.seq_cte) AS liquidado
    FROM cte
    ORDER BY {$orderBy} {$sortDir}, cte.seq_cte DESC
    LIMIT {$pageSize} OFFSET {$offset}
";

$listRes = sql($listSql, $params, $conn);
$rows = [];
while ($listRes && ($r = pg_fetch_assoc($listRes))) {
    $rows[] = [
        'seq_cte' => (int)($r['seq_cte'] ?? 0),
        'ser_cte' => (string)($r['ser_cte'] ?? ''),
        'nro_cte' => (int)($r['nro_cte'] ?? 0),
        'data_emissao' => (string)($r['data_emissao'] ?? ''),
        'data_chegada_unid' => (string)($r['data_chegada_unid'] ?? ''),
        'data_prev_ent' => (string)($r['data_prev_ent'] ?? ''),
        'data_entrega' => (string)($r['data_entrega'] ?? ''),
        'sigla_emit' => (string)($r['sigla_emit'] ?? ''),
        'sigla_dest' => (string)($r['sigla_dest'] ?? ''),
        'unid_atual' => (string)($r['unid_atual'] ?? ''),
        'tp_documento' => (string)($r['tp_documento'] ?? ''),
        'tp_frete' => (string)($r['tp_frete'] ?? ''),
        'nome_pag' => (string)($r['nome_pag'] ?? ''),
        'nome_emit' => (string)($r['nome_emit'] ?? ''),
        'nome_dest' => (string)($r['nome_dest'] ?? ''),
        'cod_mercadoria' => isset($r['cod_mercadoria']) ? (int)$r['cod_mercadoria'] : null,
        'qtde_vol' => (int)($r['qtde_vol'] ?? 0),
        'cubagem' => (float)($r['cubagem'] ?? 0),
        'peso_real' => (float)($r['peso_real'] ?? 0),
        'peso_calc' => (float)($r['peso_calc'] ?? 0),
        'vlr_frete' => (float)($r['vlr_frete'] ?? 0),
        'vlr_merc' => (float)($r['vlr_merc'] ?? 0),
        'placa_coleta' => (string)($r['placa_coleta'] ?? ''),
        'nfs' => (string)($r['nfs'] ?? ''),
        'cep_entrega' => (string)($r['cep_entrega'] ?? ''),
        'endereco_entrega' => (string)($r['endereco_entrega'] ?? ''),
        'bairro_entrega' => (string)($r['bairro_entrega'] ?? ''),
        'custo_seguro' => (float)($r['custo_seguro'] ?? 0),
        'custo_icms' => (float)($r['custo_icms'] ?? 0),
        'custo_pis_cofins' => (float)($r['custo_pis_cofins'] ?? 0),
        'custo_gris' => (float)($r['custo_gris'] ?? 0),
        'custo_pedagio' => (float)($r['custo_pedagio'] ?? 0),
        'custo_expedicao' => (float)($r['custo_expedicao'] ?? 0),
        'custo_transbordo' => (float)($r['custo_transbordo'] ?? 0),
        'custo_vendedor' => (float)($r['custo_vendedor'] ?? 0),
        'custo_recepcao' => (float)($r['custo_recepcao'] ?? 0),
        'custo_desp_div' => (float)($r['custo_desp_div'] ?? 0),
        'custo_transferencia_real' => (float)($r['custo_transferencia_real'] ?? 0),
        'liquidado' => pgBoolToPHP($r['liquidado'] ?? false),
    ];
}

$donutUnid = [];
$donutCli = [];
$serie = [];
$serieUnid = [];

$totalFrete = 0.0;
$totalMerc = 0.0;
$totalPeso = 0.0;
$totalCubagem = 0.0;
$totalVol = 0;
$totRes = sql($cteLatest . "
    SELECT
        COALESCE(SUM(cte.vlr_frete), 0)::numeric AS total_frete,
        COALESCE(SUM(cte.vlr_merc), 0)::numeric AS total_merc,
        COALESCE(SUM(cte.peso_real), 0)::numeric AS total_peso_real,
        COALESCE(SUM(cte.cubagem), 0)::numeric AS total_cubagem,
        COALESCE(SUM(cte.qtde_vol), 0)::numeric AS total_vol
    FROM cte
", $params, $conn);
if ($totRes && ($r = pg_fetch_assoc($totRes))) {
    $totalFrete = (float)($r['total_frete'] ?? 0);
    $totalMerc = (float)($r['total_merc'] ?? 0);
    $totalPeso = (float)($r['total_peso_real'] ?? 0);
    $totalCubagem = (float)($r['total_cubagem'] ?? 0);
    $totalVol = (int)($r['total_vol'] ?? 0);
}

$donutUnidRes = sql($cteLatest . "
    SELECT
        COALESCE(NULLIF(UPPER(BTRIM(cte.sigla_emit)), ''), '—') AS label,
        COALESCE(SUM(cte.vlr_frete), 0)::numeric AS total
    FROM cte
    GROUP BY 1
    ORDER BY total DESC, label ASC
    LIMIT 5
", $params, $conn);

$sumTop = 0.0;
$topUnids = [];
while ($donutUnidRes && ($r = pg_fetch_assoc($donutUnidRes))) {
    $v = (float)($r['total'] ?? 0);
    $sumTop += $v;
    $label = (string)($r['label'] ?? '—');
    $donutUnid[] = ['name' => $label, 'value' => $v];
    $topUnids[] = $label;
}
if ($totalFrete > $sumTop) {
    $donutUnid[] = ['name' => 'DEMAIS', 'value' => ($totalFrete - $sumTop)];
}

$donutCliRes = sql($cteLatest . "
    SELECT
        COALESCE(NULLIF(BTRIM(cte.nome_pag), ''), '—') AS label,
        COALESCE(SUM(cte.vlr_frete), 0)::numeric AS total
    FROM cte
    GROUP BY 1
    ORDER BY total DESC, label ASC
    LIMIT 5
", $params, $conn);

$sumTop = 0.0;
while ($donutCliRes && ($r = pg_fetch_assoc($donutCliRes))) {
    $v = (float)($r['total'] ?? 0);
    $sumTop += $v;
    $donutCli[] = ['name' => (string)($r['label'] ?? '—'), 'value' => $v];
}
if ($totalFrete > $sumTop) {
    $donutCli[] = ['name' => 'DEMAIS', 'value' => ($totalFrete - $sumTop)];
}

$serieRes = sql($cteLatest . "
    SELECT
        cte.data_emissao AS dia,
        COUNT(*)::int AS qtde_ctes,
        COALESCE(SUM(cte.vlr_frete), 0)::numeric AS vlr_frete,
        COALESCE(SUM(cte.vlr_merc), 0)::numeric AS vlr_merc,
        COALESCE(SUM(
            COALESCE(cte.custo_seguro, 0)
          + COALESCE(cte.custo_icms, 0)
          + COALESCE(cte.custo_pis_cofins, 0)
          + COALESCE(cte.custo_gris, 0)
          + COALESCE(cte.custo_pedagio, 0)
          + COALESCE(cte.custo_expedicao, 0)
          + COALESCE(cte.custo_transbordo, 0)
          + COALESCE(cte.custo_vendedor, 0)
          + COALESCE(cte.custo_recepcao, 0)
          + COALESCE(cte.custo_desp_div, 0)
          + COALESCE(cte.custo_transferencia_real, 0)
        ), 0)::numeric AS vlr_custo
    FROM cte
    GROUP BY 1
    ORDER BY 1
", $params, $conn);

while ($serieRes && ($r = pg_fetch_assoc($serieRes))) {
    $serie[] = [
        'dia' => (string)($r['dia'] ?? ''),
        'qtde_ctes' => (int)($r['qtde_ctes'] ?? 0),
        'vlr_frete' => (float)($r['vlr_frete'] ?? 0),
        'vlr_merc' => (float)($r['vlr_merc'] ?? 0),
        'vlr_custo' => (float)($r['vlr_custo'] ?? 0),
    ];
}

$inTopUnids = '';
if (is_array($topUnids) && count($topUnids) > 0) {
    $quoted = [];
    foreach ($topUnids as $u) {
        $quoted[] = pg_escape_literal($conn, (string)$u);
    }
    $inTopUnids = implode(',', $quoted);
}

$serieUnidRes = sql($cteLatest . "
    SELECT
        cte.data_emissao AS dia,
        CASE
            WHEN " . ($inTopUnids !== '' ? "COALESCE(NULLIF(UPPER(BTRIM(cte.sigla_emit)), ''), '—') IN ($inTopUnids)" : "false") . "
            THEN COALESCE(NULLIF(UPPER(BTRIM(cte.sigla_emit)), ''), '—')
            ELSE 'DEMAIS'
        END AS unid,
        COALESCE(SUM(cte.vlr_frete), 0)::numeric AS vlr_frete
    FROM cte
    GROUP BY 1, 2
    ORDER BY 1, 2
", $params, $conn);

while ($serieUnidRes && ($r = pg_fetch_assoc($serieUnidRes))) {
    $serieUnid[] = [
        'dia' => (string)($r['dia'] ?? ''),
        'unid' => (string)($r['unid'] ?? ''),
        'vlr_frete' => (float)($r['vlr_frete'] ?? 0),
    ];
}

respondJson([
    'success' => true,
    'page' => $page,
    'pageSize' => $pageSize,
    'total' => $total,
    'totalPages' => $totalPages,
    'total_frete' => $totalFrete,
    'total_merc' => $totalMerc,
    'total_peso_real' => $totalPeso,
    'total_cubagem' => $totalCubagem,
    'total_vol' => $totalVol,
    'sortKey' => $sortKey,
    'sortDir' => $sortDir,
    'rows' => $rows,
    'donuts' => [
        'unidades' => $donutUnid,
        'clientes' => $donutCli,
    ],
    'serie' => $serie,
    'serie_unidades' => $serieUnid,
]);
