<?php
/**
 * ================================================================
 * API: CENTRAL DE AGENDAMENTO - CARDS (RELOGIOS)
 * ================================================================
 * Retorna dados dos 5 relógios de agendamento
 * APLICA TODOS OS FILTROS
 * Requer autenticação via token
 *
 * POST /api/dashboards/central-agendamento/get_cards.php
 * Body: { filters: {...} }
 * Response: JSON com dados dos relógios
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
// CONECTAR AO BANCO
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

// Montar WHERE clause
$whereClause = '';
if (!empty($whereConditions)) {
    $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
}

// ================================================================
// QUERY PARA CALCULAR O TOTAL DE CTES (COM FILTROS)
// ================================================================
$totalQuery = "
    SELECT COUNT(*) as total_ctes
    FROM {$domain}_cte cte
    $whereClause
";

$stmt = pg_prepare($conn, "get_total_ctes", $totalQuery);
if (!$stmt) {
    msg('Erro ao preparar query total: ' . pg_last_error($conn), 'error');
}

$result = pg_execute($conn, "get_total_ctes", $params);
if (!$result) {
    msg('Erro ao buscar total de CT-es: ' . pg_last_error($conn), 'error');
}

$row = pg_fetch_assoc($result);
$totalCtes = (int)$row['total_ctes'];
pg_free_result($result);

// ================================================================
// QUERY PARA OS 4 RELOGIOS
// ================================================================
$query = "
    SELECT
        -- Relógio 1: CT-es Agendáveis (cliente marcado com agenda=true E ult_ocor_agend IS NULL ou 0)
        COUNT(CASE WHEN c.cliente_agenda IS NOT NULL AND (cte.ult_ocor_agend IS NULL OR cte.ult_ocor_agend = 0) THEN 1 END) as agendaveis,

        -- Relógio 2: Aguardando Agendamento (ult_ocor_agend = 14)
        COUNT(CASE WHEN cte.ult_ocor_agend = 14 THEN 1 END) as aguardando_agendamento,

        -- Relógio 3: Agendados no Prazo (ult_ocor_agend = 15 E data_prev_ent >= CURRENT_DATE)
        COUNT(CASE WHEN cte.ult_ocor_agend = 15 AND cte.data_prev_ent >= CURRENT_DATE THEN 1 END) as agendados_no_prazo,

        -- Relógio 4: Agendamentos Perdidos (ult_ocor_agend = 15 E data_prev_ent < CURRENT_DATE)
        COUNT(CASE WHEN cte.ult_ocor_agend = 15 AND cte.data_prev_ent < CURRENT_DATE THEN 1 END) as agendamentos_perdidos
    FROM {$domain}_cte cte
    LEFT JOIN {$domain}_cliente c ON cte.cnpj_dest = c.cnpj
    $whereClause
";

$stmt = pg_prepare($conn, "get_relogios", $query);
if (!$stmt) {
    msg('Erro ao preparar query relógios: ' . pg_last_error($conn), 'error');
}

$result = pg_execute($conn, "get_relogios", $params);
if (!$result) {
    msg('Erro ao buscar dados dos relógios: ' . pg_last_error($conn), 'error');
}

$row = pg_fetch_assoc($result);
pg_free_result($result);

// ================================================================
// PREPARAR RESPOSTA COM OS 4 RELOGIOS
// ================================================================
$agendaveis = (int)$row['agendaveis'];
$aguardandoAgendamento = (int)$row['aguardando_agendamento'];
$agendadosNoPrazo = (int)$row['agendados_no_prazo'];
$agendamentosPerdidos = (int)$row['agendamentos_perdidos'];

// ✅ CALCULAR PERCENTUAIS (baseado no total de CT-es filtrados)
$totalFiltrado = $agendaveis + $aguardandoAgendamento + $agendadosNoPrazo + $agendamentosPerdidos;

$relógios = [
    [
        'id' => 1,
        'nome' => 'CT-es Agendáveis',
        'descricao' => 'CT-es com cliente marcado como agendável',
        'quantidade' => $agendaveis,
        'percentual' => $totalFiltrado > 0 ? round(($agendaveis / $totalFiltrado) * 100, 1) : 0,
        'cor' => '#10b981', // verde
        'icone' => 'CheckCircle'
    ],
    [
        'id' => 2,
        'nome' => 'Aguardando Agendamento',
        'descricao' => 'CT-es aguardando agendamento',
        'quantidade' => $aguardandoAgendamento,
        'percentual' => $totalFiltrado > 0 ? round(($aguardandoAgendamento / $totalFiltrado) * 100, 1) : 0,
        'cor' => '#3b82f6', // azul
        'icone' => 'Clock'
    ],
    [
        'id' => 3,
        'nome' => 'Agendados no Prazo',
        'descricao' => 'CT-es agendados com previsão até hoje',
        'quantidade' => $agendadosNoPrazo,
        'percentual' => $totalFiltrado > 0 ? round(($agendadosNoPrazo / $totalFiltrado) * 100, 1) : 0,
        'cor' => '#10b981', // verde
        'icone' => 'ClockCheck'
    ],
    [
        'id' => 4,
        'nome' => 'Agendamentos Perdidos',
        'descricao' => 'CT-es agendados com previsão atrasada',
        'quantidade' => $agendamentosPerdidos,
        'percentual' => $totalFiltrado > 0 ? round(($agendamentosPerdidos / $totalFiltrado) * 100, 1) : 0,
        'cor' => '#ef4444', // vermelho (pior cenário)
        'icone' => 'AlertCircle'
    ]
];

respondJson([
    'success' => true,
    'data' => [
        'relógios' => $relógios
    ]
]);
