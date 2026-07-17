<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

$input = getRequestInput();
$cardId  = (int)($input['cardId']  ?? 0);
$filters = $input['filters'] ?? [];
$modo = strtoupper(trim((string)($input['modo'] ?? 'CTE')));
if (!in_array($modo, ['CTE', 'AGENDA'])) {
    $modo = 'CTE';
}

$conn = connect();

$params = [];
$paramIndex = 1;
$whereConditions = [];

$whereConditions[] = "cte.status <> 'C'";

$whereConditions[] = "(cte.tp_documento IS NULL OR LTRIM(cte.tp_documento) NOT ILIKE 'COMPLEMENTAR%')";

if (!empty($filters['periodoEmissaoInicio'])) {
    $whereConditions[] = "cte.data_emissao >= $" . $paramIndex++;
    $params[] = $filters['periodoEmissaoInicio'];
}
if (!empty($filters['periodoEmissaoFim'])) {
    $whereConditions[] = "cte.data_emissao <= $" . $paramIndex++;
    $params[] = $filters['periodoEmissaoFim'];
}
if (!empty($filters['periodoPrevisaoInicio'])) {
    $whereConditions[] = "cte.data_prev_ent >= $" . $paramIndex++;
    $params[] = $filters['periodoPrevisaoInicio'];
}
if (!empty($filters['periodoPrevisaoFim'])) {
    $whereConditions[] = "cte.data_prev_ent <= $" . $paramIndex++;
    $params[] = $filters['periodoPrevisaoFim'];
}
if (!empty($filters['unidadeDestino']) && is_array($filters['unidadeDestino']) && count($filters['unidadeDestino']) > 0) {
    $placeholders = [];
    foreach ($filters['unidadeDestino'] as $sigla) {
        $placeholders[] = '$' . $paramIndex++;
        $params[] = $sigla;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $placeholders) . ')';
}
if (!empty($filters['cnpjPagador'])) {
    $whereConditions[] = "cte.cnpj_pag = $" . $paramIndex++;
    $params[] = $filters['cnpjPagador'];
}
if (!empty($filters['cnpjDestinatario'])) {
    $whereConditions[] = "cte.cnpj_dest = $" . $paramIndex++;
    $params[] = $filters['cnpjDestinatario'];
}

$defaultOcorAguardando = (strtoupper($domain) === 'RVE') ? 35 : 14;
$defaultOcorAgendamento = 15;

$ocorAguardando = $defaultOcorAguardando;
$ocorAgendamento = $defaultOcorAgendamento;

try {
    $resultEmpParam = sql("SELECT ocor_aguardando_agendamento, ocor_agendamento FROM {$domain}_emp_param LIMIT 1", [], $conn);
    $rowEmpParam = $resultEmpParam ? pg_fetch_assoc($resultEmpParam) : null;
    if ($rowEmpParam) {
        if ($rowEmpParam['ocor_aguardando_agendamento'] !== null && $rowEmpParam['ocor_aguardando_agendamento'] !== '') {
            $ocorAguardando = (int)$rowEmpParam['ocor_aguardando_agendamento'];
        }
        if ($rowEmpParam['ocor_agendamento'] !== null && $rowEmpParam['ocor_agendamento'] !== '') {
            $ocorAgendamento = (int)$rowEmpParam['ocor_agendamento'];
        }
    }
} catch (Exception $e) {
}

switch ($cardId) {
    case 1:
        $whereConditions[] = "c.agenda = true";
        $whereConditions[] = "(cte.ult_ocor_agend IS NULL OR cte.ult_ocor_agend = 0)";
        $whereConditions[] = "cte.data_entrega IS NULL";
        break;
    case 2:
        $whereConditions[] = "cte.ult_ocor_agend = $ocorAguardando";
        $whereConditions[] = "cte.data_entrega IS NULL";
        break;
    case 3:
        $whereConditions[] = "cte.ult_ocor_agend = $ocorAgendamento";
        $whereConditions[] = "(CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= CURRENT_DATE";
        $whereConditions[] = "cte.data_entrega IS NULL";
        break;
    case 4:
        $whereConditions[] = "cte.ult_ocor_agend = $ocorAgendamento";
        $whereConditions[] = "cte.data_entrega IS NOT NULL";
        $whereConditions[] = "cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)";
        break;
    case 5:
        $whereConditions[] = "((cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) < CURRENT_DATE) OR (cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)))";
        $whereConditions[] = "cte.ult_ocor_agend = $ocorAgendamento";
        $whereConditions[] = "COALESCE(cte.entrega_abonada, false) = false";
        break;
    default:
        respondJson(['success' => false, 'message' => 'Card inválido']);
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

$ocorrenciaJoin = "
    LEFT JOIN (
        SELECT codigo::text as codigo, MAX(tipo) as tipo, MAX(descricao) as descricao
        FROM {$domain}_ocorrencia
        GROUP BY codigo::text
    ) ocor ON ocor.codigo = cte.ult_ocor::text
";

if ($modo === 'AGENDA') {
    $query = "
        WITH base AS (
            SELECT
                cte.ser_cte,
                cte.nro_cte,
                cte.data_emissao::date AS data_emissao_dt,
                cte.data_prev_ent::date AS data_prev_ent_dt,
                TO_CHAR(cte.data_emissao,  'DD/MM/YYYY') AS data_emissao,
                TO_CHAR(cte.data_prev_ent, 'DD/MM/YYYY') AS data_prev_ent,
                TO_CHAR(cte.data_prev_ent, 'YYYY-MM-DD') AS data_prev_ent_iso,
                cte.nome_pag,
                cte.nome_dest,
                cte.cnpj_dest,
                COALESCE(c.email, '') AS email_dest,
                COALESCE(cte.nfs, '') AS nfs,
                COALESCE(cte.cnpj_emit::text, '') AS cnpj_emit,
                COALESCE(cte.cep_entrega::text, '') AS cep_entrega,
                COALESCE(cte.endereco_entrega::text, '') AS endereco_entrega,
                COALESCE(cte.bairro_entrega::text, '') AS bairro_entrega,
                (COALESCE(cid_entr.nome, '') || '/' || COALESCE(cid_entr.uf, '')) AS cidade_uf_entrega,
                COALESCE(cte.vlr_frete, 0) AS vlr_frete,
                COALESCE(cte.vlr_merc, 0) AS vlr_merc,
                COALESCE(cte.peso_real, 0) AS peso_real,
                COALESCE(cte.cubagem, 0) AS cubagem,
                COALESCE(cte.qtde_vol, 0) AS qtde_vol,
                CASE
                    WHEN cte.ult_ocor IS NOT NULL AND cte.ult_ocor <> 0
                    THEN LPAD(cte.ult_ocor::text, 2, '0') || ' - ' || COALESCE(ocor.descricao, '')
                    ELSE ''
                END AS ult_ocor
            FROM {$domain}_cte cte
            LEFT JOIN {$domain}_cliente c ON cte.cnpj_dest = c.cnpj
            LEFT JOIN cidade cid_entr ON cte.seq_cidade_entr = cid_entr.seq_cidade
            {$ocorrenciaJoin}
            {$whereClause}
        )
        SELECT
            md5(COALESCE(cnpj_emit::text,'') || '|' || COALESCE(cep_entrega::text,'') || '|' || COALESCE(endereco_entrega::text,'')) AS agenda_id,
            MAX(cnpj_emit) AS cnpj_emit,
            MAX(cep_entrega) AS cep_entrega,
            MAX(endereco_entrega) AS endereco_entrega,
            MAX(bairro_entrega) AS bairro_entrega,
            MAX(nome_dest) AS nome_dest,
            MAX(cnpj_dest) AS cnpj_dest,
            MAX(email_dest) AS email_dest,
            (ARRAY_AGG(ser_cte ORDER BY data_emissao_dt DESC, nro_cte DESC))[1] AS ser_cte_principal,
            (ARRAY_AGG(nro_cte ORDER BY data_emissao_dt DESC, nro_cte DESC))[1] AS nro_cte_principal,
            (ARRAY_AGG(nfs ORDER BY data_emissao_dt DESC, nro_cte DESC))[1] AS nfs_principal,
            (ARRAY_AGG(data_emissao ORDER BY data_emissao_dt DESC, nro_cte DESC))[1] AS data_emissao_principal,
            (ARRAY_AGG(data_prev_ent ORDER BY data_prev_ent_dt ASC, data_emissao_dt DESC, nro_cte DESC))[1] AS data_prev_ent_principal,
            (ARRAY_AGG(data_prev_ent_iso ORDER BY data_prev_ent_dt ASC, data_emissao_dt DESC, nro_cte DESC))[1] AS data_prev_ent_iso_principal,
            (ARRAY_AGG(nome_pag ORDER BY data_emissao_dt DESC, nro_cte DESC))[1] AS nome_pag_principal,
            (ARRAY_AGG(ult_ocor ORDER BY data_emissao_dt DESC, nro_cte DESC))[1] AS ult_ocor_principal,
            COUNT(*) AS qtde_entregas,
            SUM(vlr_frete) AS total_vlr_frete,
            SUM(vlr_merc) AS total_vlr_merc,
            SUM(peso_real) AS total_peso_real,
            SUM(cubagem) AS total_cubagem,
            SUM(qtde_vol) AS total_qtde_vol,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'ser_cte', ser_cte,
                    'nro_cte', nro_cte,
                    'data_emissao', data_emissao,
                    'data_prev_ent', data_prev_ent,
                    'data_prev_ent_iso', data_prev_ent_iso,
                    'nome_pag', nome_pag,
                    'nome_dest', nome_dest,
                    'cnpj_dest', cnpj_dest,
                    'email_dest', email_dest,
                    'nfs', nfs,
                    'cidade_uf_entrega', cidade_uf_entrega,
                    'endereco_entrega', endereco_entrega,
                    'bairro_entrega', bairro_entrega,
                    'ult_ocor', ult_ocor,
                    'vlr_frete', vlr_frete,
                    'vlr_merc', vlr_merc,
                    'peso_real', peso_real,
                    'cubagem', cubagem,
                    'qtde_vol', qtde_vol
                )
                ORDER BY data_emissao_dt DESC, nro_cte DESC
            ) AS ctes
        FROM base
        GROUP BY agenda_id
        ORDER BY MAX(nome_dest), MAX(endereco_entrega), agenda_id
    ";
} else {
    $query = "
        SELECT
            cte.ser_cte,
            cte.nro_cte,
            TO_CHAR(cte.data_emissao,  'DD/MM/YYYY') AS data_emissao,
            TO_CHAR(cte.data_prev_ent, 'DD/MM/YYYY') AS data_prev_ent,
            TO_CHAR(cte.data_prev_ent, 'YYYY-MM-DD') AS data_prev_ent_iso,
            cte.nome_pag,
            cte.nome_dest,
            cte.cnpj_dest,
            COALESCE(c.email, '') AS email_dest,
            COALESCE(cte.nfs, '') AS nfs,
            COALESCE(cte.vlr_frete, 0) AS vlr_frete,
            COALESCE(cte.vlr_merc, 0) AS vlr_merc,
            COALESCE(cte.peso_real, 0) AS peso_real,
            COALESCE(cte.cubagem, 0) AS cubagem,
            COALESCE(cte.qtde_vol, 0) AS qtde_vol,
            CASE
                WHEN cte.ult_ocor IS NOT NULL AND cte.ult_ocor <> 0
                THEN LPAD(cte.ult_ocor::text, 2, '0') || ' - ' || COALESCE(ocor.descricao, '')
                ELSE ''
            END AS ult_ocor
        FROM {$domain}_cte cte
        LEFT JOIN {$domain}_cliente c ON cte.cnpj_dest = c.cnpj
        {$ocorrenciaJoin}
        {$whereClause}
        ORDER BY cte.cnpj_dest, cte.nome_dest, cte.data_emissao DESC
    ";
}

$result = pg_query_params($conn, $query, $params);

if (!$result) {
    respondJson(['success' => false, 'message' => 'Erro na query: ' . pg_last_error($conn)]);
}

if ($modo === 'AGENDA') {
    $agendas = [];
    while ($row = pg_fetch_assoc($result)) {
        $agendas[] = [
            'agenda_id' => $row['agenda_id'],
            'cnpj_emit' => $row['cnpj_emit'],
            'cep_entrega' => $row['cep_entrega'],
            'endereco_entrega' => $row['endereco_entrega'],
            'bairro_entrega' => $row['bairro_entrega'],
            'ser_cte' => $row['ser_cte_principal'],
            'nro_cte' => $row['nro_cte_principal'],
            'nfs' => $row['nfs_principal'],
            'data_emissao' => $row['data_emissao_principal'],
            'data_prev_ent' => $row['data_prev_ent_principal'],
            'data_prev_ent_iso' => $row['data_prev_ent_iso_principal'],
            'nome_pag' => $row['nome_pag_principal'],
            'nome_dest' => $row['nome_dest'],
            'cnpj_dest' => $row['cnpj_dest'],
            'email_dest' => $row['email_dest'],
            'ult_ocor' => $row['ult_ocor_principal'],
            'qtde_entregas' => (int)($row['qtde_entregas'] ?? 0),
            'total_vlr_frete' => (float)($row['total_vlr_frete'] ?? 0),
            'total_vlr_merc' => (float)($row['total_vlr_merc'] ?? 0),
            'total_peso_real' => (float)($row['total_peso_real'] ?? 0),
            'total_cubagem' => (float)($row['total_cubagem'] ?? 0),
            'total_qtde_vol' => (int)($row['total_qtde_vol'] ?? 0),
            'ctes' => $row['ctes'] ? json_decode($row['ctes'], true) : [],
        ];
    }

    respondJson([
        'success' => true,
        'data' => [
            'agendas' => $agendas,
            'total' => count($agendas),
        ],
    ]);
} else {
    $ctes = [];
    while ($row = pg_fetch_assoc($result)) {
        $ctes[] = [
            'ser_cte'      => $row['ser_cte'],
            'nro_cte'      => $row['nro_cte'],
            'data_emissao' => $row['data_emissao'],
            'data_prev_ent'=> $row['data_prev_ent'],
            'nome_pag'     => $row['nome_pag'],
            'nome_dest'    => $row['nome_dest'],
            'cnpj_dest'         => $row['cnpj_dest'],
            'email_dest'        => $row['email_dest'],
            'data_prev_ent_iso' => $row['data_prev_ent_iso'],
            'nfs'               => $row['nfs'],
            'ult_ocor'          => $row['ult_ocor'],
            'vlr_frete'         => $row['vlr_frete'],
            'vlr_merc'          => $row['vlr_merc'],
            'peso_real'         => $row['peso_real'],
            'cubagem'           => $row['cubagem'],
            'qtde_vol'          => $row['qtde_vol'],
        ];
    }

    respondJson([
        'success' => true,
        'data' => [
            'ctes'  => $ctes,
            'total' => count($ctes),
        ],
    ]);
}
