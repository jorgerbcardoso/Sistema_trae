<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE ENTREGAS - ANÁLISE DIÁRIA
 * ================================================================
 * Retorna dados DIÁRIOS para a seção de Análise Diária
 * Período: 7, 15 ou 30 dias (sempre terminando em ONTEM)
 * IGNORA todos os filtros do dashboard (período independente)
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/get_analise_diaria.php
 * Body: { periodo: 7|15|30 }
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
$periodo = $input['periodo'] ?? 7;

// ✅ FILTROS: Apenas unidades, pagador e destinatário
$unidadeDestino = $input['unidadeDestino'] ?? [];
$cnpjPagador = $input['cnpjPagador'] ?? null;
$cnpjDestinatario = $input['cnpjDestinatario'] ?? null;

// Validar período
if (!in_array($periodo, [7, 15, 30])) {
    msg('Período inválido. Use 7, 15 ou 30 dias.', 'error');
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
// ✅ TERMINA EM ONTEM (exclui hoje)
// ✅ Retorna TODOS os dias do período (com ou sem CT-e)
// ✅ APLICA FILTROS: unidades, pagador, destinatário

// Construir condições de filtro
$params = [];
$paramIndex = 1;
$whereConditions = ["cte.status <> 'C'"];

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

$query = "
    WITH dias AS (
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '$periodo days',
            CURRENT_DATE - INTERVAL '1 day',
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
            data_prev_ent::date as dia,
            COUNT(*) as total
        FROM {$domain}_cte cte
        WHERE data_prev_ent IS NOT NULL
        AND $whereClause
        GROUP BY data_prev_ent::date
    ),
    entregues AS (
        SELECT 
            data_prev_ent::date as dia,
            COUNT(*) as total
        FROM {$domain}_cte cte
        WHERE data_prev_ent IS NOT NULL
        AND data_entrega IS NOT NULL
        AND data_entrega <= data_prev_ent
        AND $whereClause
        GROUP BY data_prev_ent::date
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
    // Como usamos os mesmos parâmetros 3 vezes, precisamos triplicá-los
    $allParams = array_merge($params, $params, $params);
    $result = pg_query_params($g_sql, $query, $allParams);
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
    $ontem = strtotime('-1 day');

    for ($i = $periodo; $i >= 1; $i--) {
        $diaTimestamp = strtotime("-$i days", $ontem);
        $diaNum = date('d', $diaTimestamp);
        $mesNum = date('m', $diaTimestamp);
        $diaSemana = date('w', $diaTimestamp);
        $dataCompleta = date('Y-m-d', $diaTimestamp);

        // Simular dados realistas
        $entregasDia = ($diaSemana == 0) ? 0 : rand(15, 45); // Domingo = 0
        $previstosDia = ($diaSemana == 0) ? 0 : rand(10, 35);
        $entreguesDia = $previstosDia > 0 ? rand((int)($previstosDia * 0.7), $previstosDia) : 0;

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