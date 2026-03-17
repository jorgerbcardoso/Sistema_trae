<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE ENTREGAS - COMPARATIVO DE UNIDADES
 * ================================================================
 * Retorna dados do COMPARATIVO DE UNIDADES
 * APLICA TODOS OS FILTROS EXCETO UNIDADES DE DESTINO
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/get_comparativo_unidades.php
 * Body: { filters: {...} }
 * Response: JSON com dados do comparativo de unidades
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
    $mockData = getMockComparativoData($filters);
    respondJson([
        'success' => true,
        'data' => $mockData,
        'toast' => [
            'message' => 'Comparativo de unidades carregado',
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
// CONSTRUIR QUERY - IGNORAR FILTRO DE UNIDADES DE DESTINO
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

// ❌ NÃO APLICAR: Unidade de Destino

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
// QUERY PARA CALCULAR PERFORMANCE POR UNIDADE
// ================================================================
// ✅ JOIN com tabela de unidades para obter SIGLA e NOME
// ✅ Calcula 4 grupos: Entregues no Prazo, Entregues em Atraso, Pendentes no Prazo, Pendentes em Atraso
$query = "
    SELECT
        cte.sigla_dest as sigla,
        COALESCE(u.nome, cte.sigla_dest) as nome,
        COUNT(*) as total,
        COUNT(CASE WHEN cte.data_entrega IS NOT NULL
              AND cte.data_entrega <= cte.data_prev_ent THEN 1 END) as entregues_no_prazo,
        COUNT(CASE WHEN cte.data_entrega IS NOT NULL
              AND cte.data_entrega > cte.data_prev_ent THEN 1 END) as entregues_em_atraso,
        COUNT(CASE WHEN cte.data_entrega IS NULL
              AND cte.data_prev_ent >= CURRENT_DATE THEN 1 END) as pendentes_no_prazo,
        COUNT(CASE WHEN cte.data_entrega IS NULL
              AND cte.data_prev_ent < CURRENT_DATE THEN 1 END) as pendentes_em_atraso,
        ROUND(
            CAST(COUNT(CASE WHEN cte.data_entrega IS NOT NULL
                  AND cte.data_entrega <= cte.data_prev_ent THEN 1 END) AS DECIMAL) /
            NULLIF(COUNT(*), 0) * 100,
            1
        ) as percentage
    FROM {$domain}_cte cte
    LEFT OUTER JOIN {$domain}_unidade u ON cte.sigla_dest = u.sigla
    $whereClause
    GROUP BY cte.sigla_dest, u.nome
    ORDER BY percentage DESC, total DESC
";

$result = pg_query_params($g_sql, $query, $params);

if (!$result) {
    msg('Erro ao buscar dados de comparativo: ' . pg_last_error($g_sql), 'error');
}

$unitPerformances = [];
while ($row = pg_fetch_assoc($result)) {
    $unitPerformances[] = [
        'sigla' => $row['sigla'],
        'unidade' => $row['nome'], // ✅ CORRIGIDO: 'nome' → 'unidade' (nome do campo esperado pelo frontend)
        'total' => (int)$row['total'],
        'entreguesNoPrazo' => (int)$row['entregues_no_prazo'],
        'entreguesEmAtraso' => (int)$row['entregues_em_atraso'],
        'pendentesNoPrazo' => (int)$row['pendentes_no_prazo'],
        'pendentesEmAtraso' => (int)$row['pendentes_em_atraso'],
        'performance' => (float)$row['percentage'] // ✅ CORRIGIDO: 'percentage' → 'performance' (nome do campo esperado pelo frontend)
    ];
}

respondJson([
    'success' => true,
    'data' => [
        'unitPerformances' => $unitPerformances // ✅ CORRIGIDO: 'unitPerformance' → 'unitPerformances' (plural)
    ]
]);

// ================================================================
// FUNÇÃO MOCK: Retornar dados mockados do COMPARATIVO DE UNIDADES
// ================================================================
function getMockComparativoData($filters) {
    // Dados mockados de performance por unidade com 4 grupos
    $unidades = [
        [
            'sigla' => 'SPO',
            'unidade' => 'SÃO PAULO', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 89,
            'entreguesNoPrazo' => 65,
            'entreguesEmAtraso' => 12,
            'pendentesNoPrazo' => 8,
            'pendentesEmAtraso' => 4,
            'performance' => 92.1 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ],
        [
            'sigla' => 'RJO',
            'unidade' => 'RIO DE JANEIRO', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 67,
            'entreguesNoPrazo' => 48,
            'entreguesEmAtraso' => 9,
            'pendentesNoPrazo' => 6,
            'pendentesEmAtraso' => 4,
            'performance' => 88.1 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ],
        [
            'sigla' => 'BHZ',
            'unidade' => 'BELO HORIZONTE', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 45,
            'entreguesNoPrazo' => 32,
            'entreguesEmAtraso' => 6,
            'pendentesNoPrazo' => 5,
            'pendentesEmAtraso' => 2,
            'performance' => 84.4 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ],
        [
            'sigla' => 'CWB',
            'unidade' => 'CURITIBA', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 34,
            'entreguesNoPrazo' => 24,
            'entreguesEmAtraso' => 4,
            'pendentesNoPrazo' => 4,
            'pendentesEmAtraso' => 2,
            'performance' => 82.4 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ],
        [
            'sigla' => 'POA',
            'unidade' => 'PORTO ALEGRE', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 28,
            'entreguesNoPrazo' => 19,
            'entreguesEmAtraso' => 4,
            'pendentesNoPrazo' => 3,
            'pendentesEmAtraso' => 2,
            'performance' => 78.6 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ],
        [
            'sigla' => 'SSA',
            'unidade' => 'SALVADOR', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 23,
            'entreguesNoPrazo' => 15,
            'entreguesEmAtraso' => 3,
            'pendentesNoPrazo' => 3,
            'pendentesEmAtraso' => 2,
            'performance' => 73.9 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ],
        [
            'sigla' => 'FOR',
            'unidade' => 'FORTALEZA', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 19,
            'entreguesNoPrazo' => 12,
            'entreguesEmAtraso' => 2,
            'pendentesNoPrazo' => 3,
            'pendentesEmAtraso' => 2,
            'performance' => 68.4 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ],
        [
            'sigla' => 'REC',
            'unidade' => 'RECIFE', // ✅ CORRIGIDO: 'nome' → 'unidade'
            'total' => 16,
            'entreguesNoPrazo' => 9,
            'entreguesEmAtraso' => 2,
            'pendentesNoPrazo' => 3,
            'pendentesEmAtraso' => 2,
            'performance' => 62.5 // ✅ CORRIGIDO: 'percentage' → 'performance'
        ]
    ];

    return [
        'unitPerformances' => $unidades // ✅ CORRIGIDO: 'unitPerformance' → 'unitPerformances' (plural)
    ];
}