<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE ENTREGAS - EVOLUÇÃO
 * ================================================================
 * Retorna dados do GRÁFICO DE EVOLUÇÃO DA PERFORMANCE
 * APLICA TODOS OS FILTROS EXCETO PERÍODOS (emissão e previsão)
 * ⚠️ IMPORTANTE: Retorna dados conforme o período selecionado (7, 15 ou 30 dias)
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/get_evolucao.php
 * Body: { filters: {...}, periodo: 7|15|30 }
 * Response: JSON com dados do gráfico de evolução
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
$filters = $input['filters'] ?? [];
$periodo = $input['periodo'] ?? 30; // Padrão: 30 dias

// Validar período (aceita apenas 7, 15 ou 30)
if (!in_array($periodo, [7, 15, 30])) {
    $periodo = 30;
}

// ================================================================
// VERIFICAR SE DEVE USAR DADOS MOCKADOS
// ================================================================
if (shouldUseMockData($domain)) {
    $mockData = getMockEvolucaoData($filters, $periodo);
    respondJson([
        'success' => true,
        'data' => $mockData,
        'toast' => [
            'message' => 'Evolução de performance carregada',
            'type' => 'success'
        ]
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
// CONSTRUIR QUERY - IGNORAR FILTROS DE PERÍODO
// ================================================================
$params = [];
$paramIndex = 1;
$whereConditions = [];

// ✅ FILTRO OBRIGATÓRIO: Status diferente de 'C' (Cancelado)
$whereConditions[] = "cte.status <> 'C'";

// ❌ NÃO APLICAR: Período de Emissão
// ❌ NÃO APLICAR: Período de Previsão de Entrega

// Filtro: Unidade de Destino (✅ SUPORTA MÚLTIPLAS UNIDADES)
if (!empty($filters['unidadeDestino']) && is_array($filters['unidadeDestino']) && count($filters['unidadeDestino']) > 0) {
    $placeholders = [];
    foreach ($filters['unidadeDestino'] as $sigla) {
        $placeholders[] = '$' . $paramIndex;
        $params[] = $sigla;
        $paramIndex++;
    }
    $whereConditions[] = 'cte.sigla_dest IN (' . implode(', ', $placeholders) . ')';
}

// Filtro: CNPJ Pagador
if (!empty($filters['cnpjPagador'])) {
    $whereConditions[] = "cte.cnpj_pag = $" . $paramIndex;
    $params[] = $filters['cnpjPagador'];
    $paramIndex++;
}

// Filtro: CNPJ Destinatário
if (!empty($filters['cnpjDestinatario'])) {
    $whereConditions[] = "cte.cnpj_dest = $" . $paramIndex;
    $params[] = $filters['cnpjDestinatario'];
    $paramIndex++;
}

$whereClause = '';
if (count($whereConditions) > 0) {
    $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
}

// ================================================================
// QUERY PARA CALCULAR EVOLUÇÃO DIÁRIA (ÚLTIMOS 30 DIAS)
// ================================================================
// ✅ Retorna APENAS os dias que TÊM CT-e (linha conecta os pontos sem "nós" em zero)
// ✅ TERMINA SEMPRE EM ONTEM (dia anterior a hoje)
$query = "
    SELECT
        cte.data_prev_ent::date as dia,
        COUNT(*) as total,
        COUNT(CASE WHEN cte.data_entrega IS NOT NULL
              AND cte.data_entrega <= cte.data_prev_ent THEN 1 END) as entregues_no_prazo,
        ROUND(
            CAST(COUNT(CASE WHEN cte.data_entrega IS NOT NULL
                  AND cte.data_entrega <= cte.data_prev_ent THEN 1 END) AS DECIMAL) /
            NULLIF(COUNT(*), 0) * 100,
            1
        ) as percentual
    FROM {$domain}_cte cte
    " . ($whereClause ? $whereClause . ' AND ' : ' WHERE ') . "
        cte.data_prev_ent >= CURRENT_DATE - INTERVAL '$periodo days'
        AND cte.data_prev_ent < CURRENT_DATE
    GROUP BY cte.data_prev_ent::date
    HAVING COUNT(*) > 0
    ORDER BY dia ASC
";

$result = pg_query_params($g_sql, $query, $params);

if (!$result) {
    msg('Erro ao buscar dados de evolução: ' . pg_last_error($g_sql), 'error');
}

$performanceData = [];
while ($row = pg_fetch_assoc($result)) {
    // Formatar data como DD/MM
    $data = date('d/m', strtotime($row['dia']));

    $performanceData[] = [
        'data' => $data,
        'total' => (int)$row['total'],
        'onTime' => (int)$row['entregues_no_prazo'],
        'percentage' => (float)$row['percentual']
    ];
}

respondJson([
    'success' => true,
    'data' => [
        'performanceData' => $performanceData
    ]
]);

// ================================================================
// FUNÇÃO MOCK: Retornar dados mockados da EVOLUÇÃO
// ================================================================
function getMockEvolucaoData($filters, $periodo = 30) {
    $performanceData = [];
    $ontem = strtotime('-1 day'); // ✅ TERMINA EM ONTEM

    // ✅ Simula dias com CT-e (não todos os dias - só alguns têm entregas)
    // ✅ Loop de N dias até ONTEM (não hoje)
    for ($i = $periodo; $i >= 1; $i--) {
        $dia = strtotime("-$i days", $ontem);
        $diaSemana = date('w', $dia); // 0=domingo, 6=sábado
        
        // ✅ Pula domingos e alguns sábados (simula dias sem CT-e)
        if ($diaSemana === 0 || ($diaSemana === 6 && rand(0, 1) === 0)) {
            continue;
        }
        
        // ✅ Pula aleatoriamente alguns dias (20% de chance)
        if (rand(1, 100) <= 20) {
            continue;
        }
        
        $dataStr = date('d/m', $dia);

        // Gerar dados com oscilação realista
        $total = rand(15, 35); // 15-35 entregas/dia

        // Oscilação com padrão de fim de semana
        $basePercentage = 85;

        if ($diaSemana === 5 || $diaSemana === 6) {
            $basePercentage = 75; // Fim de semana
        }

        // Variação aleatória de -10 a +10
        $variation = (rand(-100, 100) / 10);
        $percentage = max(60, min(98, $basePercentage + $variation));

        $onTime = round(($total * $percentage) / 100);

        $performanceData[] = [
            'data' => $dataStr,
            'total' => $total,
            'onTime' => $onTime,
            'percentage' => round($percentage * 10) / 10
        ];
    }

    return [
        'performanceData' => $performanceData
    ];
}