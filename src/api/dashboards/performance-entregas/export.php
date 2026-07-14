<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE ENTREGAS - EXPORTAR CONHECIMENTOS CSV
 * ================================================================
 * Exporta conhecimentos filtrados para CSV
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/export.php
 * Body: { filters: {...}, statusEntrega?: string, dataPrevisao?: string, unidade?: string, coluna?: string }
 * Response: CSV file download
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

// ================================================================
// AUTENTICAÇÃO
// ================================================================
$auth = authenticateAndGetUser();
$user = $auth['user'];
$domain = $auth['domain'];

// ================================================================
// RECEBER E PROCESSAR PARÂMETROS
// ================================================================
$input = getRequestInput();
$statusEntrega = $input['statusEntrega'] ?? null; // 'entregue_no_prazo', 'entregue_em_atraso', 'pendente_no_prazo', 'pendente_em_atraso'
$dataPrevisao = $input['dataPrevisao'] ?? null; // Para filtrar por data de previsão específica (formato YYYY-MM-DD)
$unidade = $input['unidade'] ?? null; // Sigla da unidade (para comparativo)
$coluna = $input['coluna'] ?? null; // 'entregues_no_prazo', 'entregues_em_atraso', 'pendentes_no_prazo', 'pendentes_em_atraso'

// ✅ NOVO: Para Análise Diária (exportações por dia)
$tipo = $input['tipo'] ?? null; // 'entregas_dia', 'previstos_dia', 'entregues_dia'
$data = $input['data'] ?? null; // Data específica para análise diária (YYYY-MM-DD)

// ✅ FILTROS: aceitar tanto dentro de 'filters' quanto direto no $input
$periodoEmissaoInicio = $input['periodoEmissaoInicio'] ?? null;
$periodoEmissaoFim = $input['periodoEmissaoFim'] ?? null;
$periodoPrevisaoInicio = $input['periodoPrevisaoInicio'] ?? null;
$periodoPrevisaoFim = $input['periodoPrevisaoFim'] ?? null;
$unidadeDestino = $input['unidadeDestino'] ?? [];
$cnpjPagador = $input['cnpjPagador'] ?? null;
$cnpjDestinatario = $input['cnpjDestinatario'] ?? null;

// ================================================================
// VERIFICAR SE DEVE USAR DADOS MOCKADOS
// ================================================================
if (shouldUseMockData($domain)) {
    generateMockCSV($statusEntrega, $dataPrevisao, $unidade, $coluna);
    exit;
}

// ================================================================
// CONECTAR AO BANCO (apenas se não for mock)
// ================================================================
$g_sql = connect();

// ================================================================
// VALIDAR DOMÍNIO
// ================================================================
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson([
        'success' => false,
        'message' => 'Domínio inválido'
    ]);
}

// ================================================================
// VERIFICAR SE A TABELA EXISTE
// ================================================================
$checkTableQuery = "SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = '{$domain}_cte'
)";
$checkResult = pg_query($g_sql, $checkTableQuery);
$tableExists = pg_fetch_result($checkResult, 0, 0);

if (!$tableExists) {
    respondJson([
        'success' => false,
        'message' => "Tabela {$domain}_cte não encontrada no banco de dados"
    ]);
}

// ================================================================
// CONSTRUIR QUERY COM FILTROS
// ================================================================
$params = [];
$paramIndex = 1;
$whereConditions = [];

// ✅ FILTRO OBRIGATÓRIO: Status diferente de 'C' (Cancelado)
$whereConditions[] = "cte.status <> 'C'";

// ✅ FILTRO OBRIGATÓRIO: Ignorar documentos complementares
$whereConditions[] = "(cte.tp_documento IS NULL OR cte.tp_documento NOT ILIKE '%COMPLEMENTAR%')";

// ✅ FILTRO DE STATUS DE ENTREGA (dos cards ou da tabela)
if ($statusEntrega) {
    switch ($statusEntrega) {
        case 'entregue_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'entregue_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'pendente_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= CURRENT_DATE)";
            break;
        case 'pendente_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) < CURRENT_DATE)";
            break;
        case 'prazo_total':
            $whereConditions[] = "((cte.data_entrega IS NOT NULL AND cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)) OR (cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= CURRENT_DATE))";
            break;
        case 'atraso_total':
            $whereConditions[] = "((cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)) OR (cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) < CURRENT_DATE))";
            break;
    }
}

// ✅ FILTRO DE COLUNA (do comparativo de unidades)
if ($coluna) {
    switch ($coluna) {
        case 'total':
            // Não adiciona filtro, pega todos os CTRCs da unidade
            break;
        case 'entregues_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'entregues_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NOT NULL AND cte.data_entrega > (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END))";
            break;
        case 'pendentes_no_prazo':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= CURRENT_DATE)";
            break;
        case 'pendentes_em_atraso':
            $whereConditions[] = "(cte.data_entrega IS NULL AND (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) < CURRENT_DATE)";
            break;
    }
}

// ✅ FILTRO DE DATA DE PREVISÃO (do grfico de evolução)
if ($dataPrevisao) {
    $whereConditions[] = "cte.data_prev_ent::date = $" . $paramIndex;
    $params[] = $dataPrevisao;
    $paramIndex++;
}

// ✅ FILTRO DE UNIDADE (do comparativo)
if ($unidade) {
    $whereConditions[] = "cte.sigla_dest = $" . $paramIndex;
    $params[] = $unidade;
    $paramIndex++;
}

// ✅ NOVO: FILTROS ESPECÍFICOS DA ANÁLISE DIÁRIA
if ($tipo && $data) {
    switch ($tipo) {
        case 'entregas_dia':
            // Entregas do dia: data_entrega = data
            $whereConditions[] = "cte.data_entrega::date = $" . $paramIndex;
            $params[] = $data;
            $paramIndex++;
            break;
            
        case 'previstos_dia':
            // Previstos do dia: data_prev_ent = data
            $whereConditions[] = "cte.data_prev_ent::date = $" . $paramIndex;
            $params[] = $data;
            $paramIndex++;
            break;
            
        case 'entregues_dia':
            // Entregues no prazo do dia: data_prev_ent = data AND data_entrega <= data_prev_ent
            $whereConditions[] = "cte.data_prev_ent::date = $" . $paramIndex;
            $params[] = $data;
            $paramIndex++;
            $whereConditions[] = "cte.data_entrega IS NOT NULL";
            $whereConditions[] = "cte.data_entrega <= cte.data_prev_ent";
            break;
    }
}

// ✅ FILTROS DE PERÍODO: Aplicar APENAS se NÃO for clique do gráfico (dataPrevisao está vazio) E NÃO for análise diária
if (!$dataPrevisao && !$tipo) {
    // Filtro: Período de Emissão
    if ($periodoEmissaoInicio) {
        $whereConditions[] = "cte.data_emissao >= $" . $paramIndex;
        $params[] = $periodoEmissaoInicio;
        $paramIndex++;
    }
    if ($periodoEmissaoFim) {
        $whereConditions[] = "cte.data_emissao <= $" . $paramIndex;
        $params[] = $periodoEmissaoFim;
        $paramIndex++;
    }

    // Filtro: Período de Previsão de Entrega
    if ($periodoPrevisaoInicio) {
        $whereConditions[] = "(CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) >= $" . $paramIndex;
        $params[] = $periodoPrevisaoInicio;
        $paramIndex++;
    }
    if ($periodoPrevisaoFim) {
        $whereConditions[] = "(CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END) <= $" . $paramIndex;
        $params[] = $periodoPrevisaoFim;
        $paramIndex++;
    }
}

// Filtro: Unidade de Destino (apenas se não for do comparativo)
if (!$unidade && !empty($unidadeDestino) && is_array($unidadeDestino) && count($unidadeDestino) > 0) {
    $placeholders = [];
    foreach ($unidadeDestino as $sigla) {
        $placeholders[] = "$" . $paramIndex;
        $params[] = $sigla;
        $paramIndex++;
    }
    $whereConditions[] = "cte.sigla_dest IN (" . implode(',', $placeholders) . ")";
}

// Filtro: CNPJ Pagador
if ($cnpjPagador) {
    $whereConditions[] = "cte.cnpj_pag = $" . $paramIndex;
    $params[] = $cnpjPagador;
    $paramIndex++;
}

// Filtro: CNPJ Destinatário
if ($cnpjDestinatario) {
    $whereConditions[] = "cte.cnpj_dest = $" . $paramIndex;
    $params[] = $cnpjDestinatario;
    $paramIndex++;
}

$whereClause = '';
if (count($whereConditions) > 0) {
    $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
}

$usarPrevisaoReal = (bool)($tipo || $dataPrevisao);
$exprDataPrev = $usarPrevisaoReal
    ? "cte.data_prev_ent"
    : "(CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE cte.data_prev_ent END)";
$exprPrazoComp = $usarPrevisaoReal
    ? "cte.data_prev_ent"
    : "(CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN ocor.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)";

// ================================================================
// QUERY PARA BUSCAR CONHECIMENTOS
// ================================================================
$query = "SELECT cte.ser_cte,
                 cte.nro_cte,
                 COALESCE(cte.nfs::text, '') AS nfs,
                 to_char (cte.data_emissao, 'DD/MM/YY') AS data_emissao,
                 cte.nome_emit,
                 cte.nome_dest,
                 cte.nome_pag,
                 cte.sigla_emit,
                 cte.sigla_dest,
                 cte.vlr_frete,
                 cte.peso_real,
                 to_char(($exprDataPrev), 'DD/MM/YY') AS data_prev_ent,
                 CASE WHEN cte.data_entrega IS NULL THEN '' ELSE to_char (cte.data_entrega, 'DD/MM/YY') END AS data_entrega,
                 CASE WHEN cte.data_entrega IS NULL THEN current_date - ($exprPrazoComp) ELSE cte.data_entrega - ($exprPrazoComp) END AS atraso,
                 CASE
                     WHEN cte.ult_ocor IS NULL OR cte.ult_ocor::text = '' THEN ''
                     WHEN ocor.descricao IS NULL OR ocor.descricao = '' THEN cte.ult_ocor::text
                     ELSE cte.ult_ocor::text || ' - ' || ocor.descricao
                 END AS ultima_ocorrencia,
                 CASE WHEN cte.data_ult_ocor IS NULL THEN '' ELSE to_char (cte.data_ult_ocor, 'DD/MM/YY') END AS data_ult_ocor
            FROM $domain" . "_cte cte
            LEFT JOIN (
                SELECT codigo::text as codigo, MAX(tipo) as tipo, MAX(descricao) as descricao
                FROM $domain" . "_ocorrencia
                GROUP BY codigo::text
            ) ocor ON ocor.codigo = cte.ult_ocor::text
            $whereClause
           ORDER BY 1, 2";

// ✅ EXECUTAR QUERY E VERIFICAR ERRO **ANTES** DE ENVIAR HEADERS CSV
if (count($params) > 0) {
    $result = pg_query_params($g_sql, $query, $params);
} else {
    $result = pg_query($g_sql, $query);
}

// ⚠️ IMPORTANTE: Verificar erro ANTES de enviar headers
if (!$result) {
    msg('Erro ao buscar conhecimentos: ' . pg_last_error($g_sql), 'error');
}

// ✅ Verificar se há resultados
$rowCount = pg_num_rows($result);
if ($rowCount === 0) {
    msg('Nenhum conhecimento encontrado com os filtros aplicados', 'warning');
}

// ================================================================
// GERAR CSV (só chega aqui se não houver erros)
// ================================================================
$filename = 'perf_entr_' . date('Y-m-d_His') . '.csv';

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

// BOM para UTF-8
echo "\xEF\xBB\xBF";

// Cabeçalho
$headers = [
    'Série CTRC',
    'Número CTRC',
    'NFs',
    'Emissão',
    'Remetente',
    'Destinatário',
    'Pagador',
    'Origem',
    'Destino',
    'Valor do Frete (R$)',
    'Peso Real (Kg)',
    'Previsão de Entrega',
    'Entrega',
    'Atraso',
    'Última Ocorrência',
    'Data Última Ocorrência'
];

echo implode(';', $headers) . "\n";

// Dados
while ($row = pg_fetch_assoc($result)) {
    $line = [$row['ser_cte'],
             $row['nro_cte'],
             $row['nfs'],
             $row['data_emissao'],
             $row['nome_emit'],
             $row['nome_dest'],
             $row['nome_pag'],
             $row['sigla_emit'],
             $row['sigla_dest'],
             fmtdec (floatval ($row['vlr_frete']), 2),
             fmtdec (floatval ($row['peso_real']), 2),
             $row['data_prev_ent'],
             $row['data_entrega'],
             $row['atraso'],
             $row['ultima_ocorrencia'],
             $row['data_ult_ocor']
    ];

    echo implode(';', array_map(function($value) {
        return '"' . str_replace('"', '""', $value) . '"';
    }, $line)) . "\n";
}

exit;

// ================================================================
// FUNÇÃO MOCK: Gerar CSV mockado
// ================================================================
function generateMockCSV($statusEntrega, $dataPrevisao, $unidade, $coluna) {
    $filename = 'conhecimentos_mock_' . date('Y-m-d_His') . '.csv';

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Pragma: no-cache');
    header('Expires: 0');

    // BOM para UTF-8
    echo "\xEF\xBB\xBF";

    // Cabeçalho
    $headers = ['Série CTRC',
                'Número CTRC',
                'NFs',
                'Emissão',
                'Remetente',
                'Destinatário',
                'Pagador',
                'Origem',
                'Destino',
                'Valor do Frete (R$)',
                'Peso Real (Kg)',
                'Previsão de Entrega',
                'Entrega',
                'Atraso',
                'Última Ocorrência',
                'Data Última Ocorrência'];

    echo implode(';', $headers) . "\n";

    // Gerar 10 linhas mockadas
    for ($i = 1; $i <= 10; $i++) {
        $numero = str_pad($i, 6, '0', STR_PAD_LEFT);
        $dataEmissao = date('d/m/Y', strtotime("-" . rand(1, 30) . " days"));
        $dataPrev = date('d/m/Y', strtotime("-" . rand(0, 15) . " days"));

        // Determinar status baseado no filtro
        $status = 'ENTREGUE NO PRAZO';
        $dataEntrega = date('d/m/Y', strtotime("-" . rand(0, 10) . " days"));

        if ($statusEntrega === 'entregue_em_atraso' || $coluna === 'entregues_em_atraso') {
            $status = 'ENTREGUE EM ATRASO';
        } elseif ($statusEntrega === 'pendente_no_prazo' || $coluna === 'pendentes_no_prazo') {
            $status = 'PENDENTE NO PRAZO';
            $dataEntrega = '';
        } elseif ($statusEntrega === 'pendente_em_atraso' || $coluna === 'pendentes_em_atraso') {
            $status = 'PENDENTE EM ATRASO';
            $dataEntrega = '';
        }

        $line = [
            'SPO',
            $numero,
            'NF' . str_pad((string)rand(1, 999999), 6, '0', STR_PAD_LEFT),
            $dataEmissao,
            'EMPRESA REMETENTE LTDA',
            'EMPRESA DESTINATARIA LTDA',
            'EMPRESA PAGADORA LTDA',
            'SPO',
            'RIO',
            number_format(rand(100, 5000), 2, ',', '.'),
            number_format(rand(100, 5000), 2, ',', '.'),
            $dataPrev,
            $dataEntrega,
            0,
            '01 - ENTREGA REALIZADA.',
            $dataEntrega ?: ''
        ];

        echo implode(';', array_map(function($value) {
            return '"' . str_replace('"', '""', $value) . '"';
        }, $line)) . "\n";
    }

    exit;
}
