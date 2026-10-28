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
$tblGc = "{$domain}_grupo_cliente";

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

$digits = function($v): string {
    $s = preg_replace('/\D/', '', (string)$v);
    return is_string($s) ? $s : '';
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

$addDateRange("cte.data_emissao", $filters['emissaoIni'] ?? '', $filters['emissaoFim'] ?? '');
$addDateRange("cte.data_prev_ent", $filters['prevEntregaIni'] ?? '', $filters['prevEntregaFim'] ?? '');
$addDateRange("cte.data_entrega", $filters['entregaIni'] ?? '', $filters['entregaFim'] ?? '');

$addInText("cte.sigla_emit", $filters['unidadesOrigem'] ?? [], '/^[A-Z0-9]{2,5}$/');
$addInText("cte.sigla_dest", $filters['unidadesDestino'] ?? [], '/^[A-Z0-9]{2,5}$/');

$addInRaw("regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')", $filters['cnpjsPagadores'] ?? [], $digits);
$addInRaw("regexp_replace(COALESCE(cte.cnpj_emit::text, ''), '\\\\D', '', 'g')", $filters['cnpjsRemetentes'] ?? [], $digits);
$addInRaw("regexp_replace(COALESCE(cte.cnpj_dest::text, ''), '\\\\D', '', 'g')", $filters['cnpjsDestinatarios'] ?? [], $digits);

$gruposPag = $filters['gruposPagadores'] ?? [];
if (is_array($gruposPag) && count($gruposPag) > 0) {
    $vals = [];
    foreach ($gruposPag as $it) {
        $v = $digits($it);
        if ($v === '' || strlen($v) !== 14) continue;
        $vals[$v] = true;
    }
    $vals = array_keys($vals);
    if (count($vals) > 0) {
        $ph = [];
        foreach ($vals as $v) { $ph[] = '$' . $p++; $params[] = $v; }
        $phSql = implode(', ', $ph);
        $where[] = "(
            regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g') IN ({$phSql})
            OR EXISTS (
                SELECT 1
                FROM {$tblGc} gc
                WHERE regexp_replace(COALESCE(gc.cnpj::text, ''), '\\\\D', '', 'g') = regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')
                  AND regexp_replace(COALESCE(gc.cnpj_principal::text, ''), '\\\\D', '', 'g') IN ({$phSql})
            )
        )";
    }
}

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

$sql = "
    WITH cte AS (
        SELECT DISTINCT ON (ser_cte, nro_cte)
            *
        FROM {$tblCte} cte
        {$whereSql}
        ORDER BY ser_cte, nro_cte, seq_cte DESC
    )
    SELECT
        cte.seq_cte,
        cte.ser_cte,
        cte.nro_cte,
        cte.tp_documento,
        cte.tp_frete,
        cte.data_emissao,
        cte.data_prev_ent,
        cte.data_entrega,
        cte.data_chegada_unid,
        cte.sigla_emit,
        cte.sigla_dest,
        cte.unid_atual,
        cte.nome_emit,
        cte.nome_pag,
        cte.nome_dest,
        cte.cnpj_emit,
        cte.cnpj_pag,
        cte.cnpj_dest,
        cte.cod_mercadoria,
        cte.qtde_vol,
        cte.cubagem,
        cte.peso_real,
        cte.peso_calc,
        cte.vlr_frete,
        cte.vlr_merc,
        cte.vlr_icms,
        cte.vlr_pis_cofins,
        cte.vlr_expedicao,
        cte.vlr_recepcao,
        cte.placa_coleta,
        cte.nfs,
        cte.cep_entrega,
        cte.endereco_entrega,
        cte.bairro_entrega,
        cte.loc_dif_ent,
        cte.custo_seguro,
        cte.custo_icms,
        cte.custo_pis_cofins,
        cte.custo_gris,
        cte.custo_pedagio,
        cte.custo_expedicao,
        cte.custo_transbordo,
        cte.custo_vendedor,
        cte.custo_recepcao,
        cte.custo_desp_div,
        cte.custo_transferencia_real,
        EXISTS (SELECT 1 FROM {$tblLiq} liq WHERE liq.seq_cte = cte.seq_cte) AS liquidado
    FROM cte
    ORDER BY {$orderBy} {$sortDir}, cte.seq_cte DESC
";

$res = sql($sql, $params, $conn);

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="relacao_ctes.csv"');
header('Pragma: no-cache');
header('Expires: 0');

$out = fopen('php://output', 'w');
if ($out === false) {
    respondJson(['success' => false, 'message' => 'Falha ao gerar arquivo.'], 500);
}

$fmtNumBr = function($v, int $decimals = 2): string {
    $s = trim((string)$v);
    if ($s === '') return '';
    $s = str_replace(',', '.', $s);
    if (!is_numeric($s)) return trim((string)$v);
    return number_format((float)$s, $decimals, ',', '.');
};

$fmt2Keys = [
    'cubagem',
    'vlr_frete',
    'vlr_merc',
    'vlr_icms',
    'vlr_pis_cofins',
    'vlr_expedicao',
    'vlr_recepcao',
    'custo_seguro',
    'custo_icms',
    'custo_pis_cofins',
    'custo_gris',
    'custo_pedagio',
    'custo_expedicao',
    'custo_transbordo',
    'custo_vendedor',
    'custo_recepcao',
    'custo_desp_div',
    'custo_transferencia_real',
];

$columns = [
    ['k' => 'seq_cte', 'h' => 'Seq CT-e'],
    ['k' => 'ser_cte', 'h' => 'Série'],
    ['k' => 'nro_cte', 'h' => 'Número'],
    ['k' => 'tp_documento', 'h' => 'Tipo de Documento'],
    ['k' => 'tp_frete', 'h' => 'Tipo de Frete'],
    ['k' => 'data_emissao', 'h' => 'Emissão'],
    ['k' => 'data_prev_ent', 'h' => 'Previsão de Entrega'],
    ['k' => 'data_entrega', 'h' => 'Entrega'],
    ['k' => 'data_chegada_unid', 'h' => 'Chegada na Unidade'],
    ['k' => 'sigla_emit', 'h' => 'Unidade Origem'],
    ['k' => 'sigla_dest', 'h' => 'Unidade Destino'],
    ['k' => 'unid_atual', 'h' => 'Unidade Atual'],
    ['k' => 'nome_emit', 'h' => 'Remetente'],
    ['k' => 'nome_pag', 'h' => 'Pagador'],
    ['k' => 'nome_dest', 'h' => 'Destinatário'],
    ['k' => 'cnpj_emit', 'h' => 'CNPJ Remetente'],
    ['k' => 'cnpj_pag', 'h' => 'CNPJ Pagador'],
    ['k' => 'cnpj_dest', 'h' => 'CNPJ Destinatário'],
    ['k' => 'cod_mercadoria', 'h' => 'Código Mercadoria'],
    ['k' => 'qtde_vol', 'h' => 'Volumes'],
    ['k' => 'cubagem', 'h' => 'Cubagem'],
    ['k' => 'peso_real', 'h' => 'Peso Real'],
    ['k' => 'peso_calc', 'h' => 'Peso Calculado'],
    ['k' => 'vlr_frete', 'h' => 'Frete'],
    ['k' => 'vlr_merc', 'h' => 'Valor da Mercadoria'],
    ['k' => 'vlr_icms', 'h' => 'ICMS'],
    ['k' => 'vlr_pis_cofins', 'h' => 'PIS/COFINS'],
    ['k' => 'vlr_expedicao', 'h' => 'Expedição (Valor)'],
    ['k' => 'vlr_recepcao', 'h' => 'Recepção (Valor)'],
    ['k' => 'placa_coleta', 'h' => 'Placa de Coleta'],
    ['k' => 'nfs', 'h' => 'NFs'],
    ['k' => 'cep_entrega', 'h' => 'CEP de Entrega'],
    ['k' => 'endereco_entrega', 'h' => 'Endereço de Entrega'],
    ['k' => 'bairro_entrega', 'h' => 'Bairro de Entrega'],
    ['k' => 'loc_dif_ent', 'h' => 'Local Dif. Entrega'],
    ['k' => 'custo_seguro', 'h' => 'Custo Seguro'],
    ['k' => 'custo_icms', 'h' => 'Custo ICMS'],
    ['k' => 'custo_pis_cofins', 'h' => 'Custo PIS/COFINS'],
    ['k' => 'custo_gris', 'h' => 'Custo GRIS'],
    ['k' => 'custo_pedagio', 'h' => 'Custo Pedágio'],
    ['k' => 'custo_expedicao', 'h' => 'Custo Expedição'],
    ['k' => 'custo_transbordo', 'h' => 'Custo Transbordo'],
    ['k' => 'custo_vendedor', 'h' => 'Custo Vendedor'],
    ['k' => 'custo_recepcao', 'h' => 'Custo Recepção'],
    ['k' => 'custo_desp_div', 'h' => 'Custo Desp. Diversas'],
    ['k' => 'custo_transferencia_real', 'h' => 'Custo Transferência Real'],
    ['k' => 'liquidado', 'h' => 'Liquidado'],
];

fputcsv($out, array_map(fn($c) => $c['h'], $columns), ';');

while ($res && ($r = pg_fetch_assoc($res))) {
    $row = [];
    foreach ($columns as $c) {
        $k = $c['k'];
        if ($k === 'liquidado') {
            $row[] = pgBoolToPHP($r[$k] ?? false) ? 'S' : 'N';
            continue;
        }
        if ($k === 'tp_frete') {
            $v = strtoupper(trim((string)($r[$k] ?? '')));
            if ($v === 'C') $row[] = 'CIF';
            elseif ($v === 'F') $row[] = 'FOB';
            else $row[] = $r[$k] ?? '';
            continue;
        }
        if (in_array($k, $fmt2Keys, true)) {
            $row[] = $fmtNumBr($r[$k] ?? '', 2);
            continue;
        }
        $row[] = $r[$k] ?? '';
    }
    fputcsv($out, $row, ';');
}

fclose($out);
exit;
