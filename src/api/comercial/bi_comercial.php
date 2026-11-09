<?php
/**
 * ============================================
 * API: COMERCIAL - BI COMERCIAL
 * ============================================
 * Consolida indicadores comerciais cruzando os CT-es ([dominio]_cte) com a
 * carteira de clientes por vendedor ([dominio]_vendedor_cliente).
 *
 * O "dono" do negócio é o CNPJ PAGADOR do CT-e (cte.cnpj_pag), que é cruzado
 * com o CNPJ do vínculo vendedor x cliente.
 *
 * GET
 * - ini=YYYY-MM-DD   (início do período, padrão = 1º dia do mês atual)
 * - fim=YYYY-MM-DD   (fim do período,    padrão = último dia do mês atual)
 * - login=xxxx       (opcional: filtra por vendedor)
 * - tp_frete=C|F     (opcional: CIF / FOB)
 *
 * Estimativa de comissão:
 *   Aplica o percentual do período vigente (Conquista / Manutenção / Manutenção 2,
 *   conforme a data de emissão do CT-e) sobre o frete líquido. O frete líquido
 *   respeita os parâmetros globais da empresa ([dominio]_emp_param):
 *     - com_vend_desc_icms        → desconta vlr_icms
 *     - com_vend_desc_pis_cofins  → desconta vlr_pis_cofins
 *     - com_vend_apenas_liq       → só CT-es liquidados ([dominio]_cte_liq)
 *     - com_vend_apenas_entr      → só CT-es entregues (data_entrega não nula)
 * ============================================
 */

require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod('GET');

// Falhas de SQL deixam de virar HTTP 500 sem corpo: devolvemos JSON para o
// frontend exibir uma mensagem tratada em vez de quebrar a tela.
set_exception_handler(function ($e) {
    error_log('[bi_comercial] ' . $e->getMessage());
    respondJson([
        'success' => false,
        'message' => 'Não foi possível gerar os indicadores. Ajuste o período e tente novamente.',
        'detail'  => $e->getMessage(),
    ], 500);
});

$auth = authenticateAndGetUser();
$domain = strtolower(trim((string)($auth['domain'] ?? '')));
if ($domain === '' || !preg_match('/^[a-z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.'], 400);
}

$conn   = connect();
$tblCte = "{$domain}_cte";
$tblLiq = "{$domain}_cte_liq";
$tblCli = "{$domain}_cliente";
$tblVc  = "{$domain}_vendedor_cliente";
$tblVnd = "{$domain}_vendedor";
$tblEmp = "{$domain}_emp_param";

function biColunaExiste(string $tabela, string $coluna): bool {
    $r = sql(
        "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1",
        [$tabela, $coluna]
    );
    return $r && pg_num_rows($r) > 0;
}

// ============================================
// PERÍODO
// ============================================
$ini   = trim((string)($_GET['ini'] ?? ''));
$fim   = trim((string)($_GET['fim'] ?? ''));
$login = trim((string)($_GET['login'] ?? ''));
$tpFreteIn = strtoupper(trim((string)($_GET['tp_frete'] ?? '')));

$isDate = function (string $s): bool {
    return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $s);
};

if (!$isDate($ini) || !$isDate($fim)) {
    $ini = date('Y-m-01');
    $fim = date('Y-m-t');
}
if ($ini > $fim) {
    $tmp = $ini; $ini = $fim; $fim = $tmp;
}

$dias = (int)((strtotime($fim) - strtotime($ini)) / 86400) + 1;
$granularidade = $dias <= 62 ? 'dia' : 'mes';

// ============================================
// PARÂMETROS GLOBAIS DE COMISSÃO
// ============================================
$descIcms   = false;
$descPis    = false;
$apenasLiq  = false;
$apenasEntr = false;

if (!biColunaExiste($tblEmp, 'com_vend_desc_icms')) {
    // Tabela de parâmetros ainda sem as colunas novas: usa padrão (sem desconto).
    $resP = null;
} else {
    $resP = sql(
        "SELECT
            COALESCE(com_vend_desc_icms, FALSE)       AS d_icms,
            COALESCE(com_vend_desc_pis_cofins, FALSE) AS d_pis,
            COALESCE(com_vend_apenas_liq, FALSE)      AS a_liq,
            COALESCE(com_vend_apenas_entr, FALSE)     AS a_entr
         FROM {$tblEmp} LIMIT 1",
        []
    );
}
if ($resP && ($rp = pg_fetch_assoc($resP))) {
    $descIcms   = pgBoolToPHP($rp['d_icms']);
    $descPis    = pgBoolToPHP($rp['d_pis']);
    $apenasLiq  = pgBoolToPHP($rp['a_liq']);
    $apenasEntr = pgBoolToPHP($rp['a_entr']);
}

// ============================================
// EXPRESSÕES DE APOIO
// ============================================
$cnpjVc  = "regexp_replace(COALESCE(vc.cnpj::text, ''), '\\\\D', '', 'g')";
$cnpjPag = "regexp_replace(COALESCE(cte.cnpj_pag::text, ''), '\\\\D', '', 'g')";
$cnpjCli = "regexp_replace(COALESCE(c.cnpj::text, ''), '\\\\D', '', 'g')";

$percExpr = "
    CASE
        WHEN vc.data_ini_conquista IS NOT NULL
             AND cte.data_emissao >= vc.data_ini_conquista
             AND (vc.data_fin_conquista IS NULL OR cte.data_emissao <= vc.data_fin_conquista)
            THEN vc.perc_conquista
        WHEN vc.data_ini_manutencao IS NOT NULL
             AND cte.data_emissao >= vc.data_ini_manutencao
             AND (vc.data_fin_manutencao IS NULL OR cte.data_emissao <= vc.data_fin_manutencao)
            THEN vc.perc_manutencao
        WHEN vc.data_ini_manutencao2 IS NOT NULL
             AND cte.data_emissao >= vc.data_ini_manutencao2
             AND (vc.data_fin_manutencao2 IS NULL OR cte.data_emissao <= vc.data_fin_manutencao2)
            THEN vc.perc_manutencao2
        ELSE NULL
    END";

$baseFrete = "(COALESCE(cte.vlr_frete, 0)";
if ($descIcms) $baseFrete .= " - COALESCE(cte.vlr_icms, 0)";
if ($descPis)  $baseFrete .= " - COALESCE(cte.vlr_pis_cofins, 0)";
$baseFrete .= ")";

$elig = "TRUE";
if ($apenasLiq)  $elig .= " AND EXISTS (SELECT 1 FROM {$tblLiq} l WHERE l.seq_cte = cte.seq_cte)";
if ($apenasEntr) $elig .= " AND cte.data_entrega IS NOT NULL";

$comExpr = "(CASE WHEN ({$elig}) THEN {$baseFrete} * COALESCE({$percExpr}, 0) / 100.0 ELSE 0 END)";

$statusCol = biColunaExiste($tblVc, 'status') ? "COALESCE(vc.status, 'D')" : "'D'";

// ============================================
// WHERE + PARÂMETROS
// ============================================
$whereParts = [
    "cte.status <> 'C'",
    "NOT (UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'PRES SERVICO'
          AND UPPER(BTRIM(COALESCE(cte.ser_cte, ''))) = '999')",
];
$params = [];
$p = 1;

$whereParts[] = "cte.data_emissao >= \${$p}"; $params[] = $ini; $p++;
$whereParts[] = "cte.data_emissao <= \${$p}"; $params[] = $fim; $p++;

if ($tpFreteIn === 'C' || $tpFreteIn === 'F') {
    $whereParts[] = "cte.tp_frete = \${$p}"; $params[] = $tpFreteIn; $p++;
}
if ($login !== '' && $login !== '__todos__') {
    $whereParts[] = "LOWER(vc.login) = LOWER(\${$p})"; $params[] = $login; $p++;
}

$whereSql = implode("\n        AND ", $whereParts);

// ============================================
// COLUNAS OPCIONAIS DE ENTREGA / GEOLOCALIZAÇÃO NO _cte
// ============================================
$cteHasLat    = biColunaExiste($tblCte, 'latitude_entrega') && biColunaExiste($tblCte, 'longitude_entrega');
$cteHasEnd    = biColunaExiste($tblCte, 'cep_entrega') && biColunaExiste($tblCte, 'endereco_entrega') && biColunaExiste($tblCte, 'bairro_entrega');
$cteHasCidEnt = biColunaExiste($tblCte, 'seq_cidade_entr');

$selLat = $cteHasLat
    ? "COALESCE(NULLIF(cte.latitude_entrega, ''), c.latitude_entrega) AS latitude_entrega"
    : "c.latitude_entrega AS latitude_entrega";
$selLng = $cteHasLat
    ? "COALESCE(NULLIF(cte.longitude_entrega, ''), c.longitude_entrega) AS longitude_entrega"
    : "c.longitude_entrega AS longitude_entrega";
$selCep      = $cteHasEnd ? "COALESCE(cte.cep_entrega::text, '') AS cep_entrega" : "'' AS cep_entrega";
$selEndereco = $cteHasEnd ? "COALESCE(cte.endereco_entrega::text, '') AS endereco_entrega" : "'' AS endereco_entrega";
$selBairro   = $cteHasEnd ? "COALESCE(cte.bairro_entrega::text, '') AS bairro_entrega" : "'' AS bairro_entrega";
$joinEntr    = $cteHasCidEnt ? "LEFT JOIN cidade ce ON ce.seq_cidade = cte.seq_cidade_entr" : "";
$selCidade   = $cteHasCidEnt ? "COALESCE(NULLIF(ce.nome, ''), cid.nome, '')" : "COALESCE(cid.nome, '')";
$selUf       = $cteHasCidEnt ? "COALESCE(NULLIF(ce.uf, ''), cid.uf, '')" : "COALESCE(cid.uf, '')";

// ============================================
// AÇÃO: LISTA DE CT-es (drill-down dos indicadores)
// --------------------------------------------
// GET action=ctes
//   f=vendedor  v=<login>
//   f=cliente   v=<cnpj>
//   f=status    v=C|D|P|N|R
//   f=uf        v=SP
//   f=tp_frete  v=C|F
//   f=periodo   v=YYYY-MM | YYYY-MM-DD
//   f=geral
// ============================================
$action = strtolower(trim((string)($_GET['action'] ?? '')));
if ($action === 'ctes') {
    $filtro = strtolower(trim((string)($_GET['f'] ?? 'geral')));
    $valor  = trim((string)($_GET['v'] ?? ''));

    // Filtros base do drill-down. NÃO reutilizamos $whereParts porque ele
    // referencia o alias `vc` (vendedor_cliente), inexistente nesta consulta.
    $wParts = [
        "cte.status <> 'C'",
        "NOT (UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'PRES SERVICO'
              AND UPPER(BTRIM(COALESCE(cte.ser_cte, ''))) = '999')",
    ];
    $wParams = [];
    $pp      = 1;
    $wParts[] = "cte.data_emissao >= \${$pp}"; $wParams[] = $ini; $pp++;
    $wParts[] = "cte.data_emissao <= \${$pp}"; $wParams[] = $fim; $pp++;
    if ($tpFreteIn === 'C' || $tpFreteIn === 'F') {
        $wParts[] = "cte.tp_frete = \${$pp}"; $wParams[] = $tpFreteIn; $pp++;
    }
    if ($login !== '' && $login !== '__todos__') {
        $wParts[] = "EXISTS (SELECT 1 FROM {$tblVc} vcl
                            WHERE regexp_replace(COALESCE(vcl.cnpj::text, ''), '\\\\D', '', 'g') = {$cnpjPag}
                              AND LOWER(BTRIM(vcl.login)) = LOWER(\${$pp}))";
        $wParams[] = $login; $pp++;
    }

    $addFiltro = function (string $sqlTpl, $val) use (&$wParts, &$wParams, &$pp) {
        $wParts[]  = str_replace('{IDX}', '$' . $pp, $sqlTpl);
        $wParams[] = $val;
        $pp++;
    };

    switch ($filtro) {
        case 'vendedor':
            if ($valor !== '') {
                $addFiltro("EXISTS (SELECT 1 FROM {$tblVc} vcx
                                    WHERE regexp_replace(COALESCE(vcx.cnpj::text, ''), '\\\\D', '', 'g') = {$cnpjPag}
                                      AND LOWER(BTRIM(vcx.login)) = LOWER({IDX}))", $valor);
            }
            break;
        case 'cliente':
            if ($valor !== '') {
                $addFiltro("{$cnpjPag} = {IDX}", preg_replace('/\D/', '', $valor));
            }
            break;
        case 'status':
            if ($valor !== '') {
                $addFiltro("EXISTS (SELECT 1 FROM {$tblVc} vcs
                                    WHERE regexp_replace(COALESCE(vcs.cnpj::text, ''), '\\\\D', '', 'g') = {$cnpjPag}
                                      AND COALESCE(NULLIF(UPPER(BTRIM(vcs.status)), ''), 'D') = {IDX})", strtoupper($valor));
            }
            break;
        case 'uf':
            if ($valor !== '') {
                if ($cteHasCidEnt) {
                    $addFiltro("UPPER(BTRIM(COALESCE(ce.uf, ''))) = {IDX}", strtoupper($valor));
                } else {
                    // Fallback: UF da cidade do cliente pagador (quando seq_cidade_entr não existe).
                    $addFiltro("UPPER(BTRIM(COALESCE((
                                    SELECT ci.uf
                                    FROM {$tblCli} cc
                                    LEFT JOIN cidade ci ON ci.seq_cidade = cc.seq_cidade
                                    WHERE regexp_replace(COALESCE(cc.cnpj::text, ''), '\\\\D', '', 'g') = {$cnpjPag}
                                    LIMIT 1), ''))) = {IDX}", strtoupper($valor));
                }
            }
            break;
        case 'tp_frete':
            if ($valor !== '') {
                $addFiltro("UPPER(BTRIM(COALESCE(cte.tp_frete::text, ''))) = {IDX}", strtoupper($valor));
            }
            break;
        case 'periodo':
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor)) {
                $addFiltro("TO_CHAR(cte.data_emissao, 'YYYY-MM-DD') = {IDX}", $valor);
            } elseif (preg_match('/^\d{4}-\d{2}$/', $valor)) {
                $addFiltro("TO_CHAR(cte.data_emissao, 'YYYY-MM') = {IDX}", $valor);
            }
            break;
    }

    $wSql = implode("\n        AND ", $wParts);

    $qLista = "
        SELECT
            cte.seq_cte,
            cte.ser_cte,
            cte.nro_cte,
            cte.tp_documento,
            cte.tp_frete,
            cte.data_emissao,
            cte.data_chegada_unid,
            cte.data_prev_ent,
            cte.data_entrega,
            cte.sigla_emit,
            cte.sigla_dest,
            cte.unid_atual,
            cte.nome_pag,
            cte.nome_emit,
            cte.nome_dest,
            cte.cnpj_emit,
            cte.cnpj_dest,
            cte.cnpj_pag,
            COALESCE(cte.qtde_vol, 0) AS qtde_vol,
            COALESCE(cte.cubagem, 0)  AS cubagem,
            COALESCE(cte.peso_real, 0) AS peso_real,
            COALESCE(cte.peso_calc, 0) AS peso_calc,
            COALESCE(cte.vlr_frete, 0) AS vlr_frete,
            COALESCE(cte.vlr_merc, 0)  AS vlr_merc,
            cte.placa_coleta,
            cte.nfs,
            " . ($cteHasEnd ? "cte.cep_entrega, cte.endereco_entrega, cte.bairro_entrega" : "'' AS cep_entrega, '' AS endereco_entrega, '' AS bairro_entrega") . ",
            " . ($cteHasCidEnt ? "COALESCE(ce.nome, '') AS cidade_entrega, COALESCE(ce.uf, '') AS uf_entrega" : "'' AS cidade_entrega, '' AS uf_entrega") . ",
            COALESCE(ce_emit.nome, '') AS cidade_emit,
            COALESCE(ce_emit.uf, '')   AS uf_emit,
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
        FROM {$tblCte} cte
        LEFT JOIN {$tblCli} cli_emit
               ON regexp_replace(COALESCE(cli_emit.cnpj::text, ''), '\\\\D', '', 'g') =
                  regexp_replace(COALESCE(cte.cnpj_emit::text, ''), '\\\\D', '', 'g')
        LEFT JOIN cidade ce_emit ON ce_emit.seq_cidade = cli_emit.seq_cidade
        " . ($cteHasCidEnt ? "LEFT JOIN cidade ce ON ce.seq_cidade = cte.seq_cidade_entr" : "") . "
        WHERE {$wSql}
        ORDER BY cte.data_emissao DESC, cte.nro_cte DESC
        LIMIT 3000
    ";

    $r = sql($qLista, $wParams);
    $linhas = [];
    $tot = ['ctes' => 0, 'frete' => 0.0, 'merc' => 0.0, 'peso' => 0.0, 'volumes' => 0.0];
    if ($r) {
        while ($row = pg_fetch_assoc($r)) {
            $linhas[] = [
                'seq_cte'       => (int)($row['seq_cte'] ?? 0),
                'ser_cte'       => (string)($row['ser_cte'] ?? ''),
                'nro_cte'       => (int)($row['nro_cte'] ?? 0),
                'tp_documento'  => (string)($row['tp_documento'] ?? ''),
                'tp_frete'      => (string)($row['tp_frete'] ?? ''),
                'data_emissao'  => (string)($row['data_emissao'] ?? ''),
                'data_chegada_unid' => (string)($row['data_chegada_unid'] ?? ''),
                'data_prev_ent' => (string)($row['data_prev_ent'] ?? ''),
                'data_entrega'  => (string)($row['data_entrega'] ?? ''),
                'sigla_emit'    => (string)($row['sigla_emit'] ?? ''),
                'sigla_dest'    => (string)($row['sigla_dest'] ?? ''),
                'unid_atual'    => (string)($row['unid_atual'] ?? ''),
                'nome_pag'      => (string)($row['nome_pag'] ?? ''),
                'nome_emit'     => (string)($row['nome_emit'] ?? ''),
                'nome_dest'     => (string)($row['nome_dest'] ?? ''),
                'cnpj_emit'     => (string)($row['cnpj_emit'] ?? ''),
                'cnpj_dest'     => (string)($row['cnpj_dest'] ?? ''),
                'cnpj_pag'      => (string)($row['cnpj_pag'] ?? ''),
                'qtde_vol'      => (float)($row['qtde_vol'] ?? 0),
                'cubagem'       => (float)($row['cubagem'] ?? 0),
                'peso_real'     => (float)($row['peso_real'] ?? 0),
                'peso_calc'     => (float)($row['peso_calc'] ?? 0),
                'vlr_frete'     => (float)($row['vlr_frete'] ?? 0),
                'vlr_merc'      => (float)($row['vlr_merc'] ?? 0),
                'placa_coleta'  => (string)($row['placa_coleta'] ?? ''),
                'nfs'           => (string)($row['nfs'] ?? ''),
                'cep_entrega'   => (string)($row['cep_entrega'] ?? ''),
                'endereco_entrega' => (string)($row['endereco_entrega'] ?? ''),
                'bairro_entrega'   => (string)($row['bairro_entrega'] ?? ''),
                'cidade_entrega'   => (string)($row['cidade_entrega'] ?? ''),
                'uf_entrega'       => (string)($row['uf_entrega'] ?? ''),
                'cidade_emit'      => (string)($row['cidade_emit'] ?? ''),
                'uf_emit'          => (string)($row['uf_emit'] ?? ''),
                'custo_seguro'     => (float)($row['custo_seguro'] ?? 0),
                'custo_icms'       => (float)($row['custo_icms'] ?? 0),
                'custo_pis_cofins' => (float)($row['custo_pis_cofins'] ?? 0),
                'custo_gris'       => (float)($row['custo_gris'] ?? 0),
                'custo_pedagio'    => (float)($row['custo_pedagio'] ?? 0),
                'custo_expedicao'  => (float)($row['custo_expedicao'] ?? 0),
                'custo_transbordo' => (float)($row['custo_transbordo'] ?? 0),
                'custo_vendedor'   => (float)($row['custo_vendedor'] ?? 0),
                'custo_recepcao'   => (float)($row['custo_recepcao'] ?? 0),
                'custo_desp_div'   => (float)($row['custo_desp_div'] ?? 0),
                'custo_transferencia_real' => (float)($row['custo_transferencia_real'] ?? 0),
                'liquidado'        => pgBoolToPHP($row['liquidado'] ?? false),
            ];
            $tot['ctes']++;
            $tot['frete']   += (float)($row['vlr_frete'] ?? 0);
            $tot['merc']    += (float)($row['vlr_merc'] ?? 0);
            $tot['peso']    += (float)($row['peso_real'] ?? 0);
            $tot['volumes'] += (float)($row['qtde_vol'] ?? 0);
        }
    }

    respondJson([
        'success' => true,
        'filtro'  => $filtro,
        'valor'   => $valor,
        'total'   => $tot,
        'ctes'    => $linhas,
    ]);
}

// ============================================
// CTEs BASE
// ============================================
// Documento (1 linha por CT-e) — usado para volumes/fretes/geografia.
$baseDoc = "
    SELECT * FROM (
        SELECT DISTINCT ON (cte.seq_cte)
            cte.seq_cte,
            cte.data_emissao,
            cte.cnpj_pag::text AS cnpj_pag,
            COALESCE(NULLIF(cte.nome_pag, ''), 'SEM NOME') AS nome_pag,
            COALESCE(cte.sigla_emit, '') AS sigla_emit,
            COALESCE(cte.sigla_dest, '') AS sigla_dest,
            COALESCE(cte.tp_frete::text, '') AS tp_frete,
            {$statusCol} AS status_vc,
            COALESCE(c.nome, cte.nome_pag) AS cliente_nome,
            {$selCidade} AS cidade,
            {$selUf}   AS uf,
            {$selLat},
            {$selLng},
            {$selCep},
            {$selEndereco},
            {$selBairro},
            COALESCE(cte.vlr_frete, 0) AS vlr_frete,
            COALESCE(cte.vlr_merc, 0)  AS vlr_merc,
            COALESCE(cte.peso_real, 0) AS peso,
            COALESCE(cte.qtde_vol, 0)  AS volumes
        FROM {$tblCte} cte
        LEFT JOIN {$tblVc}  vc  ON {$cnpjVc}  = {$cnpjPag}
        LEFT JOIN {$tblCli} c   ON {$cnpjCli} = {$cnpjPag}
        LEFT JOIN cidade    cid ON cid.seq_cidade = c.seq_cidade
        {$joinEntr}
        WHERE {$whereSql}
        ORDER BY cte.seq_cte
    ) d";

// Vínculo (1 linha por CT-e x vendedor) — usado para comissão e ranking.
$baseVinc = "
    SELECT
        cte.seq_cte,
        cte.data_emissao,
        cte.cnpj_pag,
        LOWER(vc.login) AS login,
        COALESCE(v.nome, vc.login) AS vendedor_nome,
        COALESCE(cte.vlr_frete, 0) AS vlr_frete,
        {$comExpr} AS comissao
    FROM {$tblCte} cte
    INNER JOIN {$tblVc} vc ON {$cnpjVc} = {$cnpjPag}
    LEFT  JOIN {$tblVnd} v ON LOWER(v.login) = LOWER(vc.login)
    WHERE {$whereSql}";

// ============================================
// QUERIES
// ============================================
$out = [
    'success'  => true,
    'periodo'  => ['ini' => $ini, 'fim' => $fim, 'dias' => $dias, 'granularidade' => $granularidade],
    'parametros' => [
        'desc_icms'   => $descIcms,
        'desc_pis_cofins' => $descPis,
        'apenas_liq'  => $apenasLiq,
        'apenas_entr' => $apenasEntr,
    ],
];

// ---- KPIs (nível documento) ----
$q = "WITH docs AS ({$baseDoc})
      SELECT
        COUNT(*)::int AS total_ctes,
        COALESCE(SUM(vlr_frete), 0) AS total_frete,
        COALESCE(SUM(vlr_merc), 0)  AS total_merc,
        COALESCE(SUM(peso), 0)      AS total_peso,
        COALESCE(SUM(volumes), 0)   AS total_volumes,
        COUNT(DISTINCT cnpj_pag)::int AS clientes_ativos
      FROM docs";
$r = sql($q, $params);
$k = $r ? pg_fetch_assoc($r) : null;
$totalCtes   = (int)($k['total_ctes'] ?? 0);
$totalFrete  = (float)($k['total_frete'] ?? 0);
$totalMerc   = (float)($k['total_merc'] ?? 0);
$totalPeso   = (float)($k['total_peso'] ?? 0);
$totalVol    = (float)($k['total_volumes'] ?? 0);
$clientesAtivos = (int)($k['clientes_ativos'] ?? 0);

// ---- Comissão estimada (nível vínculo) ----
$q = "WITH vincs AS ({$baseVinc})
      SELECT COALESCE(SUM(comissao), 0) AS comissao FROM vincs";
$r = sql($q, $params);
$comissaoTotal = $r ? (float)(pg_fetch_assoc($r)['comissao'] ?? 0) : 0.0;

// ---- Carteira (total de clientes vinculados) ----
$carteiraWhere = '';
$carteiraParams = [];
if ($login !== '' && $login !== '__todos__') {
    $carteiraWhere = "WHERE LOWER(login) = LOWER($1)";
    $carteiraParams = [$login];
}
$q = "SELECT COUNT(DISTINCT regexp_replace(COALESCE(cnpj::text, ''), '\\\\D', '', 'g'))::int AS total
      FROM {$tblVc} {$carteiraWhere}";
$r = sql($q, $carteiraParams);
$clientesCarteira = $r ? (int)(pg_fetch_assoc($r)['total'] ?? 0) : 0;

$out['kpis'] = [
    'total_frete'       => $totalFrete,
    'total_merc'        => $totalMerc,
    'total_ctes'        => $totalCtes,
    'total_peso'        => $totalPeso,
    'total_volumes'     => $totalVol,
    'ticket_medio'      => $totalCtes > 0 ? $totalFrete / $totalCtes : 0,
    'frete_por_kg'      => $totalPeso > 0 ? $totalFrete / $totalPeso : 0,
    'comissao'          => $comissaoTotal,
    'clientes_ativos'   => $clientesAtivos,
    'clientes_carteira' => $clientesCarteira,
];

// ---- Funil (contagem de clientes por status + frete por status) ----
$funilClientes = [];
$q = "SELECT COALESCE(status, 'D') AS s, COUNT(*)::int AS c FROM (
        SELECT DISTINCT ON (regexp_replace(COALESCE(cnpj::text, ''), '\\\\D', '', 'g'))
            COALESCE(status, 'D') AS status
        FROM {$tblVc} {$carteiraWhere}
        ORDER BY regexp_replace(COALESCE(cnpj::text, ''), '\\\\D', '', 'g')
      ) t GROUP BY s";
$r = sql($q, $carteiraParams);
if ($r) { while ($row = pg_fetch_assoc($r)) { $funilClientes[trim((string)$row['s'])] = (int)$row['c']; } }

$funilFrete = [];
$q = "WITH docs AS ({$baseDoc})
      SELECT status_vc AS s, COUNT(*)::int AS ctes, COALESCE(SUM(vlr_frete), 0) AS frete
      FROM docs GROUP BY status_vc";
$r = sql($q, $params);
if ($r) { while ($row = pg_fetch_assoc($r)) { $funilFrete[trim((string)$row['s'])] = ['ctes' => (int)$row['ctes'], 'frete' => (float)$row['frete']]; } }

$statusLabels = [
    'D' => 'Cadastrado',
    'P' => 'Prospecção',
    'N' => 'Negociação',
    'C' => 'Conquista',
    'R' => 'Reconquista',
];
$funil = [];
foreach (['D', 'P', 'N', 'C', 'R'] as $st) {
    $funil[] = [
        'status'   => $st,
        'label'    => $statusLabels[$st],
        'clientes' => (int)($funilClientes[$st] ?? 0),
        'ctes'     => (int)($funilFrete[$st]['ctes'] ?? 0),
        'frete'    => (float)($funilFrete[$st]['frete'] ?? 0),
    ];
}
$out['funil'] = $funil;

// ---- Evolução (fretes no tempo + comissão) ----
$fmtPeriodo = $granularidade === 'dia' ? 'YYYY-MM-DD' : 'YYYY-MM';
$lblPeriodo = $granularidade === 'dia' ? 'DD/MM' : 'Mon/YY';

$q = "WITH docs AS ({$baseDoc})
      SELECT TO_CHAR(data_emissao, '{$fmtPeriodo}') AS periodo,
             TO_CHAR(data_emissao, '{$lblPeriodo}') AS label,
             COUNT(*)::int AS ctes,
             COALESCE(SUM(vlr_frete), 0) AS frete
      FROM docs GROUP BY periodo, label ORDER BY periodo";
$r = sql($q, $params);
$evolucao = [];
$evolIdx = [];
if ($r) {
    while ($row = pg_fetch_assoc($r)) {
        $idx = count($evolucao);
        $evolIdx[$row['periodo']] = $idx;
        $evolucao[] = [
            'periodo' => $row['periodo'],
            'label'   => $row['label'],
            'ctes'    => (int)$row['ctes'],
            'frete'   => (float)$row['frete'],
            'comissao' => 0.0,
        ];
    }
}

$q = "WITH vincs AS ({$baseVinc})
      SELECT TO_CHAR(data_emissao, '{$fmtPeriodo}') AS periodo,
             COALESCE(SUM(comissao), 0) AS comissao
      FROM vincs GROUP BY periodo";
$r = sql($q, $params);
if ($r) {
    while ($row = pg_fetch_assoc($r)) {
        $per = $row['periodo'];
        if (isset($evolIdx[$per])) {
            $evolucao[$evolIdx[$per]]['comissao'] = (float)$row['comissao'];
        }
    }
}
$out['evolucao'] = $evolucao;

// ---- Ranking de vendedores ----
$q = "WITH vincs AS ({$baseVinc})
      SELECT
        login,
        MAX(vendedor_nome) AS nome,
        COUNT(DISTINCT seq_cte)::int AS ctes,
        COUNT(DISTINCT cnpj_pag)::int AS clientes_ativos,
        COALESCE(SUM(vlr_frete), 0) AS frete,
        COALESCE(SUM(comissao), 0)  AS comissao
      FROM vincs
      WHERE login IS NOT NULL AND login <> ''
      GROUP BY login
      ORDER BY frete DESC";
$r = sql($q, $params);
$ranking = [];
$mapFreteTotalRanking = 0.0;
if ($r) {
    while ($row = pg_fetch_assoc($r)) {
        $frete = (float)$row['frete'];
        $mapFreteTotalRanking += $frete;
        $ranking[] = [
            'login'   => $row['login'],
            'nome'    => $row['nome'],
            'ctes'    => (int)$row['ctes'],
            'clientes_ativos' => (int)$row['clientes_ativos'],
            'frete'   => $frete,
            'comissao' => (float)$row['comissao'],
        ];
    }
}
foreach ($ranking as $i => $row) {
    $ranking[$i]['pct'] = $mapFreteTotalRanking > 0 ? ($row['frete'] / $mapFreteTotalRanking) * 100 : 0;
}
$out['ranking'] = $ranking;

// ---- Top clientes ----
$q = "WITH docs AS ({$baseDoc})
      SELECT
        cnpj_pag AS cnpj,
        COALESCE(MAX(cliente_nome), MAX(nome_pag), cnpj_pag) AS nome,
        COALESCE(MAX(cidade), '') AS cidade,
        COALESCE(MAX(uf), '')     AS uf,
        COUNT(*)::int AS ctes,
        COALESCE(SUM(vlr_frete), 0) AS frete,
        COALESCE(SUM(peso), 0) AS peso
      FROM docs
      GROUP BY cnpj_pag
      ORDER BY frete DESC
      LIMIT 50";
$r = sql($q, $params);
$topClientes = [];
if ($r) {
    while ($row = pg_fetch_assoc($r)) {
        $topClientes[] = [
            'cnpj'   => $row['cnpj'],
            'nome'   => $row['nome'],
            'cidade' => $row['cidade'],
            'uf'     => $row['uf'],
            'ctes'   => (int)$row['ctes'],
            'frete'  => (float)$row['frete'],
            'peso'   => (float)$row['peso'],
        ];
    }
}
$out['top_clientes'] = $topClientes;

// ---- Distribuição por UF de entrega ----
$q = "WITH docs AS ({$baseDoc})
      SELECT COALESCE(NULLIF(uf, ''), '??') AS uf,
             COUNT(*)::int AS ctes,
             COALESCE(SUM(vlr_frete), 0) AS frete
      FROM docs GROUP BY uf ORDER BY frete DESC";
$r = sql($q, $params);
$porUf = [];
if ($r) {
    while ($row = pg_fetch_assoc($r)) {
        $porUf[] = ['uf' => $row['uf'], 'ctes' => (int)$row['ctes'], 'frete' => (float)$row['frete']];
    }
}
$out['por_uf'] = $porUf;

// ---- Distribuição por tipo de frete ----
$q = "WITH docs AS ({$baseDoc})
      SELECT COALESCE(NULLIF(UPPER(tp_frete), ''), '?') AS tp,
             COUNT(*)::int AS ctes,
             COALESCE(SUM(vlr_frete), 0) AS frete
      FROM docs GROUP BY tp ORDER BY frete DESC";
$r = sql($q, $params);
$porTp = [];
if ($r) {
    while ($row = pg_fetch_assoc($r)) {
        $tp = $row['tp'];
        $porTp[] = [
            'tp'    => $tp,
            'label' => $tp === 'C' ? 'CIF (C)' : ($tp === 'F' ? 'FOB (F)' : 'Outros'),
            'ctes'  => (int)$row['ctes'],
            'frete' => (float)$row['frete'],
        ];
    }
}
$out['por_tp_frete'] = $porTp;

// ---- Pontos do mapa (10 maiores clientes por frete) ----
// As coordenadas vêm do CT-e quando existirem; caso contrário, devolvemos o
// endereço de entrega para o front geocodificar via Mapbox (limitado a 10 pontos).
$q = "WITH docs AS ({$baseDoc}),
      top AS (
        SELECT cnpj_pag, COUNT(*)::int AS ctes, COALESCE(SUM(vlr_frete), 0) AS frete
        FROM docs
        GROUP BY cnpj_pag
        ORDER BY frete DESC
        LIMIT 10
      )
      SELECT
        t.cnpj_pag AS cnpj,
        t.ctes,
        t.frete,
        COALESCE(NULLIF(d.cliente_nome, ''), NULLIF(d.nome_pag, ''), t.cnpj_pag) AS nome,
        COALESCE(d.cidade, '')   AS cidade,
        COALESCE(d.uf, '')       AS uf,
        d.latitude_entrega  AS lat,
        d.longitude_entrega AS lng,
        COALESCE(d.cep_entrega, '')      AS cep,
        COALESCE(d.endereco_entrega, '') AS endereco,
        COALESCE(d.bairro_entrega, '')   AS bairro
      FROM top t
      JOIN LATERAL (
        SELECT * FROM docs dd
        WHERE dd.cnpj_pag = t.cnpj_pag
        ORDER BY dd.data_emissao DESC
        LIMIT 1
      ) d ON TRUE
      ORDER BY t.frete DESC";
$r = sql($q, $params);
$pontos = [];
if ($r) {
    while ($row = pg_fetch_assoc($r)) {
        $pontos[] = [
            'cnpj'     => $row['cnpj'],
            'nome'     => $row['nome'],
            'cidade'   => $row['cidade'],
            'uf'       => $row['uf'],
            'lat'      => biParseCoord($row['lat']),
            'lng'      => biParseCoord($row['lng']),
            'cep'      => $row['cep'],
            'endereco' => $row['endereco'],
            'bairro'   => $row['bairro'],
            'ctes'     => (int)$row['ctes'],
            'frete'    => (float)$row['frete'],
        ];
    }
}
$out['pontos_mapa'] = $pontos;

$out['gerado_em'] = date('c');

respondJson($out);

/**
 * Converte coordenadas em texto (aceitando vírgula decimal) para float.
 */
function biParseCoord($valor): ?float {
    if ($valor === null) return null;
    $s = trim((string)$valor);
    if ($s === '') return null;
    $s = str_replace(',', '.', $s);
    if (!is_numeric($s)) return null;
    $f = (float)$s;
    if (!is_finite($f)) return null;
    return $f;
}
