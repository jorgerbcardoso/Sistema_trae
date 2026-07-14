<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE ENTREGAS - ANÁLISE DIÁRIA
 * ================================================================
 * Retorna dados DIÁRIOS para a seção de Análise Diária
 * Período: 15, 30 ou 45 dias (sempre incluindo HOJE e os próximos 5 dias)
 * Período independente do filtro de datas do dashboard
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/get_analise_diaria.php
 * Body: { periodo: 15|30|45 }
 * Response: JSON com dados diários
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
$periodo = $input['periodo'] ?? 15;

// ✅ FILTROS: Apenas unidades, pagador e destinatário
$unidadeDestino = $input['unidadeDestino'] ?? [];
$cnpjPagador = $input['cnpjPagador'] ?? null;
$cnpjDestinatario = $input['cnpjDestinatario'] ?? null;

// Validar período
if (!in_array($periodo, [15, 30, 45])) {
    msg('Período inválido. Use 15, 30 ou 45 dias.', 'error');
}

// ================================================================
// VERIFICAR SE DEVE USAR DADOS MOCKADOS
// ================================================================
if (shouldUseMockData($domain)) {
    $mockData = getMockAnaliseDiaria($periodo);
    respondJson([
        'success' => true,
        'data' => $mockData
    ]);
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
// QUERY PARA BUSCAR DADOS DIÁRIOS
// ================================================================
// ✅ Sempre inclui HOJE e os próximos 5 dias
// ✅ Retorna TODOS os dias do período (com ou sem CT-e)
// ✅ APLICA FILTROS: unidades, pagador, destinatário

// Construir condições de filtro
$params = [];
$paramIndex = 1;
$whereConditions = [
    "cte.status <> 'C'",
    "(cte.tp_documento IS NULL OR cte.tp_documento NOT ILIKE '%COMPLEMENTAR%')"
];

if (!empty($unidadeDestino) && is_array($unidadeDestino) && count($unidadeDestino) > 0) {
    $placeholders = [];
    foreach ($unidadeDestino as $sigla) {
        $placeholders[] = "$" . $paramIndex;
        $params[] = $sigla;
        $paramIndex++;
    }
    $whereConditions[] = "cte.sigla_dest IN (" . implode(',', $placeholders) . ")";
}

if ($cnpjPagador) {
    $whereConditions[] = "cte.cnpj_pag = $" . $paramIndex;
    $params[] = $cnpjPagador;
    $paramIndex++;
}

if ($cnpjDestinatario) {
    $whereConditions[] = "cte.cnpj_dest = $" . $paramIndex;
    $params[] = $cnpjDestinatario;
    $paramIndex++;
}

$whereClause = implode(' AND ', $whereConditions);
$diasAtras = (int)$periodo - 6; // Janela termina em hoje+5, então começa em hoje-(periodo-6)

$query = "
    WITH dias AS (
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '{$diasAtras} day',
            CURRENT_DATE + INTERVAL '5 day',
            '1 day'::interval
        )::date as dia
    ),
    entregas AS (
        SELECT 
            data_entrega::date as dia,
            COUNT(*) as total
        FROM {$domain}_cte cte
        WHERE data_entrega IS NOT NULL
        AND $whereClause
        GROUP BY data_entrega::date
    ),
    previstos AS (
        SELECT 
            (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN oc.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent::date END) END) as dia,
            COUNT(*) as total
        FROM {$domain}_cte cte
        LEFT JOIN {$domain}_ocorrencia oc ON oc.codigo::text = cte.ult_ocor::text
        WHERE (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN oc.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent::date END) END) IS NOT NULL
        AND $whereClause
        GROUP BY dia
    ),
    entregues AS (
        SELECT 
            (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN oc.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent::date END) END) as dia,
            COUNT(*) as total
        FROM {$domain}_cte cte
        LEFT JOIN {$domain}_ocorrencia oc ON oc.codigo::text = cte.ult_ocor::text
        WHERE (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN oc.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent::date END) END) IS NOT NULL
        AND data_entrega IS NOT NULL
        AND data_entrega <= (CASE WHEN COALESCE(cte.entrega_abonada, false) THEN CURRENT_DATE ELSE (CASE WHEN oc.tipo = 'C' THEN CURRENT_DATE ELSE cte.data_prev_ent END) END)
        AND $whereClause
        GROUP BY dia
    )
    SELECT
        dias.dia,
        COALESCE(entregas.total, 0) as entregas_dia,
        COALESCE(previstos.total, 0) as previstos_dia,
        COALESCE(entregues.total, 0) as entregues_dia
    FROM dias
    LEFT JOIN entregas ON entregas.dia = dias.dia
    LEFT JOIN previstos ON previstos.dia = dias.dia
    LEFT JOIN entregues ON entregues.dia = dias.dia
    ORDER BY dias.dia ASC
";

// Executar query com parâmetros
if (count($params) > 0) {
    $result = pg_query_params($g_sql, $query, $params);
} else {
    $result = pg_query($g_sql, $query);
}

if (!$result) {
    msg('Erro ao buscar dados de análise diária: ' . pg_last_error($g_sql), 'error');
}

$diasData = [];
while ($row = pg_fetch_assoc($result)) {
    $diasData[] = [
        'dia' => date('d', strtotime($row['dia'])),
        'mes' => date('m', strtotime($row['dia'])),
        'mesNome' => getMesNome(date('m', strtotime($row['dia']))),
        'diaSemana' => getDiaSemana(date('w', strtotime($row['dia']))),
        'data' => $row['dia'],
        'entregasDia' => (int)$row['entregas_dia'],
        'previstosDia' => (int)$row['previstos_dia'],
        'entreguesDia' => (int)$row['entregues_dia']
    ];
}

respondJson([
    'success' => true,
    'data' => [
        'diasData' => $diasData
    ]
]);

// ================================================================
// FUNÇÃO MOCK: Retornar dados mockados da ANÁLISE DIÁRIA
// ================================================================
function getMockAnaliseDiaria($periodo) {
    $diasData = [];
    $hoje = strtotime('today');
    $diasAtras = (int)$periodo - 6;
    $startTs = strtotime("-{$diasAtras} days", $hoje);
    $endTs = strtotime("+5 days", $hoje);

    for ($t = $startTs; $t <= $endTs; $t = strtotime('+1 day', $t)) {
        $diaNum = date('d', $t);
        $mesNum = date('m', $t);
        $diaSemana = date('w', $t);
        $dataCompleta = date('Y-m-d', $t);

        // Simular dados realistas
        $isFuturo = $t > $hoje;
        if ($isFuturo) {
            $entregasDia = 0;
            $previstosDia = ($diaSemana == 0) ? 0 : rand(5, 35);
            $entreguesDia = 0;
        } else {
            $entregasDia = ($diaSemana == 0) ? 0 : rand(15, 45); // Domingo = 0
            $previstosDia = ($diaSemana == 0) ? 0 : rand(10, 35);
            $entreguesDia = $previstosDia > 0 ? rand((int)($previstosDia * 0.7), $previstosDia) : 0;
        }

        $diasData[] = [
            'dia' => $diaNum,
            'mes' => $mesNum,
            'mesNome' => getMesNome($mesNum),
            'diaSemana' => getDiaSemana($diaSemana),
            'data' => $dataCompleta,
            'entregasDia' => $entregasDia,
            'previstosDia' => $previstosDia,
            'entreguesDia' => $entreguesDia
        ];
    }

    return [
        'diasData' => $diasData
    ];
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================
function getMesNome($mes) {
    $meses = [
        '01' => 'JAN', '02' => 'FEV', '03' => 'MAR', '04' => 'ABR',
        '05' => 'MAI', '06' => 'JUN', '07' => 'JUL', '08' => 'AGO',
        '09' => 'SET', '10' => 'OUT', '11' => 'NOV', '12' => 'DEZ'
    ];
    return $meses[$mes] ?? '';
}

function getDiaSemana($dia) {
    $dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    return $dias[$dia] ?? '';
}
