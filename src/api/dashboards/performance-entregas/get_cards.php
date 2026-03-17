<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE ENTREGAS - CARDS
 * ================================================================
 * Retorna dados dos CARDS de performance
 * APLICA TODOS OS FILTROS
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/get_cards.php
 * Body: { filters: {...} }
 * Response: JSON com dados dos cards
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

// ================================================================
// VERIFICAR SE DEVE USAR DADOS MOCKADOS
// ================================================================
if (shouldUseMockData($domain)) {
    $mockData = getMockCardsData($filters);
    respondJson([
        'success' => true,
        'data' => $mockData,
        'toast' => [
            'message' => 'Cards de performance carregados',
            'type' => 'success'
        ]
    ]);
    exit;
}

// ================================================================
// CONECTAR AO BANCO (apenas se não for mock)
// ================================================================
$conn = connect();

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
$checkResult = pg_query($conn, $checkTableQuery);
$tableExists = pg_fetch_result($checkResult, 0, 0);

if (!$tableExists) {
    respondJson([
        'success' => false,
        'message' => "Tabela {$domain}_cte não encontrada no banco de dados"
    ]);
}

// ================================================================
// CONSTRUIR QUERY COM TODOS OS FILTROS
// ================================================================
$params = [];
$paramIndex = 1;
$whereConditions = [];

// ✅ FILTRO OBRIGATÓRIO: Status diferente de 'C' (Cancelado)
$whereConditions[] = "cte.status <> 'C'";

// Filtro: Período de Emissão
if (!empty($filters['periodoEmissaoInicio'])) {
    $whereConditions[] = "cte.data_emissao >= $" . $paramIndex;
    $params[] = $filters['periodoEmissaoInicio'];
    $paramIndex++;
}
if (!empty($filters['periodoEmissaoFim'])) {
    $whereConditions[] = "cte.data_emissao <= $" . $paramIndex;
    $params[] = $filters['periodoEmissaoFim'];
    $paramIndex++;
}

// Filtro: Período de Previsão de Entrega
if (!empty($filters['periodoPrevisaoInicio'])) {
    $whereConditions[] = "cte.data_prev_ent >= $" . $paramIndex;
    $params[] = $filters['periodoPrevisaoInicio'];
    $paramIndex++;
}
if (!empty($filters['periodoPrevisaoFim'])) {
    $whereConditions[] = "cte.data_prev_ent <= $" . $paramIndex;
    $params[] = $filters['periodoPrevisaoFim'];
    $paramIndex++;
}

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
// QUERY PARA CALCULAR OS CARDS
// ================================================================
$query = "
    SELECT
        COUNT(*) as total_ctes,
        COUNT(CASE WHEN cte.data_entrega IS NOT NULL
              AND cte.data_entrega <= cte.data_prev_ent THEN 1 END) as entregues_no_prazo,
        COUNT(CASE WHEN cte.data_entrega IS NOT NULL
              AND cte.data_entrega > cte.data_prev_ent THEN 1 END) as entregues_com_atraso,
        COUNT(CASE WHEN cte.data_entrega IS NULL
              AND CURRENT_DATE > cte.data_prev_ent THEN 1 END) as pendentes_atrasados,
        COUNT(CASE WHEN cte.data_entrega IS NULL
              AND CURRENT_DATE <= cte.data_prev_ent THEN 1 END) as pendentes_no_prazo
    FROM {$domain}_cte cte
    $whereClause
";

// ================================================================
// EXECUTAR QUERY
// ================================================================
$stmt = pg_prepare($conn, "get_performance_cards", $query);

if (!$stmt) {
    msg('Erro ao preparar query: ' . pg_last_error($conn), 'error');
}

$result = pg_execute($conn, "get_performance_cards", $params);

if (!$result) {
    msg('Erro ao buscar dados dos cards: ' . pg_last_error($conn), 'error');
}

$row = pg_fetch_assoc($result);
pg_free_result($result);

// ================================================================
// PREPARAR RESPOSTA
// ================================================================
$totalCtes = (int)$row['total_ctes'];
$entreguesNoPrazo = (int)$row['entregues_no_prazo'];
$entreguesComAtraso = (int)$row['entregues_com_atraso'];
$pendentesAtrasados = (int)$row['pendentes_atrasados'];
$pendentesNoPrazo = (int)$row['pendentes_no_prazo'];

// ✅ CALCULAR PERCENTUAIS
$deliveryGroups = [
    [
        'status' => 'Entregues no Prazo',
        'count' => $entreguesNoPrazo,
        'percentage' => $totalCtes > 0 ? round(($entreguesNoPrazo / $totalCtes) * 100, 1) : 0,
        'color' => '#10b981'
    ],
    [
        'status' => 'Entregues com Atraso',
        'count' => $entreguesComAtraso,
        'percentage' => $totalCtes > 0 ? round(($entreguesComAtraso / $totalCtes) * 100, 1) : 0,
        'color' => '#f59e0b'
    ],
    [
        'status' => 'Pendentes no Prazo',
        'count' => $pendentesNoPrazo,
        'percentage' => $totalCtes > 0 ? round(($pendentesNoPrazo / $totalCtes) * 100, 1) : 0,
        'color' => '#3b82f6'
    ],
    [
        'status' => 'Pendentes Atrasados',
        'count' => $pendentesAtrasados,
        'percentage' => $totalCtes > 0 ? round(($pendentesAtrasados / $totalCtes) * 100, 1) : 0,
        'color' => '#ef4444'
    ]
];

respondJson([
    'success' => true,
    'data' => [
        'deliveryGroups' => $deliveryGroups
    ]
]);

// ================================================================
// FUNÇÃO MOCK: Retornar dados mockados dos CARDS
// ================================================================
function getMockCardsData($filters) {
    // Dados base mockados
    $entreguesNoPrazo = 156;
    $entreguesComAtraso = 23;
    $pendentesAtrasados = 8;
    $pendentesNoPrazo = 42;

    return [
        'deliveryGroups' => [
            [
                'status' => 'Entregues no Prazo',
                'count' => $entreguesNoPrazo,
                'color' => '#10b981'
            ],
            [
                'status' => 'Entregues com Atraso',
                'count' => $entreguesComAtraso,
                'color' => '#f59e0b'
            ],
            [
                'status' => 'Pendentes no Prazo',
                'count' => $pendentesNoPrazo,
                'color' => '#3b82f6'
            ],
            [
                'status' => 'Pendentes Atrasados',
                'count' => $pendentesAtrasados,
                'color' => '#ef4444'
            ]
        ]
    ];
}