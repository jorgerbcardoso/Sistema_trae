<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE ENTREGAS
 * ================================================================
 * Retorna dados de performance de entregas baseado em filtros
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/get_data.php
 * Body: { filters: {...} }
 * Response: JSON com dados de performance
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

try {
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
    // CONSTRUIR QUERY BASE COM FILTROS
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

    $whereClause = count($whereConditions) > 0 
        ? "WHERE " . implode(" AND ", $whereConditions)
        : "";

    // ================================================================
    // CALCULAR TOTAIS DOS 4 CARDS
    // ================================================================
    try {
        $query = "
            SELECT 
                COUNT(*) FILTER (WHERE data_entrega IS NOT NULL AND data_entrega <= data_prev_ent) AS entregues_no_prazo,
                COUNT(*) FILTER (WHERE data_entrega IS NOT NULL AND data_entrega > data_prev_ent) AS entregues_atraso,
                COUNT(*) FILTER (WHERE data_entrega IS NULL AND data_prev_ent >= CURRENT_DATE) AS pendentes_no_prazo,
                COUNT(*) FILTER (WHERE data_entrega IS NULL AND data_prev_ent < CURRENT_DATE) AS pendentes_atraso,
                COUNT(*) AS total
            FROM {$domain}_cte cte
            $whereClause
        ";

        $result = sql($g_sql, $query, false, $params);
        
        if (!$result) {
            throw new Exception('Erro ao executar query de totais: ' . pg_last_error($g_sql));
        }
        
        $totals = pg_fetch_assoc($result);
        
        if (!$totals) {
            throw new Exception('Nenhum resultado retornado da query de totais');
        }
    } catch (Exception $e) {
        respondJson([
            'success' => false,
            'message' => 'Erro ao buscar totais: ' . $e->getMessage(),
            'debug' => [
                'query' => $query ?? null,
                'params' => $params,
                'filters' => $filters
            ]
        ]);
    }

    // Calcular percentuais
    $total = (int)$totals['total'];
    $entreguesNoPrazo = (int)$totals['entregues_no_prazo'];
    $entreguesAtraso = (int)$totals['entregues_atraso'];
    $pendentesNoPrazo = (int)$totals['pendentes_no_prazo'];
    $pendentesAtraso = (int)$totals['pendentes_atraso'];

    $deliveryGroups = [
        [
            'label' => 'Entregues no Prazo',
            'count' => $entreguesNoPrazo,
            'percentage' => $total > 0 ? round(($entreguesNoPrazo / $total) * 100, 1) : 0,
            'color' => '#10b981',
            'bgColor' => 'bg-green-50 dark:bg-green-950',
            'chartColor' => '#10b981',
            'emptyColor' => '#d1fae5',
            'emptyColorDark' => '#064e3b'
        ],
        [
            'label' => 'Entregues em Atraso',
            'count' => $entreguesAtraso,
            'percentage' => $total > 0 ? round(($entreguesAtraso / $total) * 100, 1) : 0,
            'color' => '#f59e0b', // ✅ TROCADO: era vermelho, agora é âmbar
            'bgColor' => 'bg-amber-50 dark:bg-amber-950',
            'chartColor' => '#f59e0b',
            'emptyColor' => '#fef3c7',
            'emptyColorDark' => '#78350f'
        ],
        [
            'label' => 'Pendentes no Prazo',
            'count' => $pendentesNoPrazo,
            'percentage' => $total > 0 ? round(($pendentesNoPrazo / $total) * 100, 1) : 0,
            'color' => '#3b82f6',
            'bgColor' => 'bg-blue-50 dark:bg-blue-950',
            'chartColor' => '#3b82f6',
            'emptyColor' => '#dbeafe',
            'emptyColorDark' => '#1e3a8a'
        ],
        [
            'label' => 'Pendentes em Atraso',
            'count' => $pendentesAtraso,
            'percentage' => $total > 0 ? round(($pendentesAtraso / $total) * 100, 1) : 0,
            'color' => '#ef4444', // ✅ TROCADO: era âmbar, agora é vermelho
            'bgColor' => 'bg-red-50 dark:bg-red-950',
            'chartColor' => '#ef4444',
            'emptyColor' => '#fee2e2',
            'emptyColorDark' => '#7f1d1d'
        ]
    ];

    // ================================================================
    // COMPARATIVO POR UNIDADE ENTREGADORA
    // ================================================================
    $queryUnidades = "
        SELECT 
            u.sigla,
            u.nome AS unidade,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE cte.data_entrega IS NOT NULL AND cte.data_entrega <= cte.data_prev_ent) AS entregues_no_prazo,
            COUNT(*) FILTER (WHERE cte.data_entrega IS NOT NULL AND cte.data_entrega > cte.data_prev_ent) AS entregues_atraso,
            COUNT(*) FILTER (WHERE cte.data_entrega IS NULL AND cte.data_prev_ent >= CURRENT_DATE) AS pendentes_no_prazo,
            COUNT(*) FILTER (WHERE cte.data_entrega IS NULL AND cte.data_prev_ent < CURRENT_DATE) AS pendentes_atraso
        FROM {$domain}_cte cte
        LEFT JOIN {$domain}_unidade u ON cte.sigla_dest = u.sigla
        $whereClause
        GROUP BY u.sigla, u.nome
        ORDER BY total DESC
    ";

    $resultUnidades = sql($g_sql, $queryUnidades, false, $params);
    $unitPerformance = [];

    while ($row = pg_fetch_assoc($resultUnidades)) {
        $totalUnit = (int)$row['total'];
        $entreguesNoPrazoUnit = (int)$row['entregues_no_prazo'];
        
        $unitPerformance[] = [
            'unidade' => $row['unidade'] ?? $row['sigla'],
            'sigla' => $row['sigla'],
            'total' => $totalUnit,
            'entreguesNoPrazo' => $entreguesNoPrazoUnit,
            'entreguesAtraso' => (int)$row['entregues_atraso'],
            'pendentesNoPrazo' => (int)$row['pendentes_no_prazo'],
            'pendentesAtraso' => (int)$row['pendentes_atraso'],
            'performance' => $totalUnit > 0 ? round(($entreguesNoPrazoUnit / $totalUnit) * 100, 1) : 0
        ];
    }

    // ================================================================
    // EVOLUÇÃO DA PERFORMANCE (ÚLTIMOS 30 DIAS)
    // ================================================================
    $queryEvolucao = "
        SELECT 
            cte.data_prev_ent::DATE AS date,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE cte.data_entrega IS NOT NULL AND cte.data_entrega <= cte.data_prev_ent) AS entregues_no_prazo
        FROM {$domain}_cte cte
        WHERE cte.data_prev_ent >= CURRENT_DATE - INTERVAL '30 days'
          AND cte.data_prev_ent <= CURRENT_DATE
        " . (count($whereConditions) > 0 ? " AND " . implode(" AND ", $whereConditions) : "") . "
        GROUP BY cte.data_prev_ent::DATE
        ORDER BY cte.data_prev_ent::DATE
    ";

    $resultEvolucao = sql($g_sql, $queryEvolucao, false, $params);
    $performanceData = [];

    while ($row = pg_fetch_assoc($resultEvolucao)) {
        $totalDay = (int)$row['total'];
        $entreguesNoPrazoDay = (int)$row['entregues_no_prazo'];
        
        // Formatar data para exibição (DD/MM)
        $date = new DateTime($row['date']);
        
        $performanceData[] = [
            'date' => $date->format('d/m'),
            'fullDate' => $date->format('Y-m-d'),
            'performance' => $totalDay > 0 ? round(($entreguesNoPrazoDay / $totalDay) * 100, 1) : 0,
            'total' => $totalDay,
            'entreguesNoPrazo' => $entreguesNoPrazoDay
        ];
    }

    // ================================================================
    // RESPOSTA JSON
    // ================================================================
    respondJson([
        'success' => true,
        'data' => [
            'deliveryGroups' => $deliveryGroups,
            'unitPerformance' => $unitPerformance,
            'performanceData' => $performanceData,
            'totals' => [
                'total' => $total,
                'entreguesNoPrazo' => $entreguesNoPrazo,
                'entreguesAtraso' => $entreguesAtraso,
                'pendentesNoPrazo' => $pendentesNoPrazo,
                'pendentesAtraso' => $pendentesAtraso
            ]
        ]
    ]);
} catch (Exception $e) {
    respondJson([
        'success' => false,
        'message' => 'Erro ao processar a requisição: ' . $e->getMessage(),
        'debug' => [
            'filters' => $filters
        ]
    ]);
}