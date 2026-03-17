<?php
/**
 * ============================================
 * API - DASHBOARD DRE - COSTS (DESPESAS)
 * ============================================
 *
 * Retorna dados de despesas por evento (tipo de despesa)
 * - Identifica os 4 maiores eventos por valor no período
 * - Cards: respeitam o período selecionado (startDate/endDate)
 * - Gráficos: sempre mostram os últimos 12 meses
 * - Eficiência de combustível e custo/km: dados mockados
 */

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Includes
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

try {
    // Autenticar
    $auth = authenticate();
    $domain = $auth['domain'];

    // Validar e sanitizar inputs
    $period = filter_var($_GET['period'] ?? 'month', FILTER_SANITIZE_STRING);
    $viewMode = filter_var($_GET['view_mode'] ?? 'GERAL', FILTER_SANITIZE_STRING);
    $startDate = filter_var($_GET['start_date'] ?? date('Y-m-01'), FILTER_SANITIZE_STRING);
    $endDate = filter_var($_GET['end_date'] ?? date('Y-m-t'), FILTER_SANITIZE_STRING);
    $groupBy = filter_var($_GET['group_by'] ?? 'EVENTOS', FILTER_SANITIZE_STRING); // ✅ NOVO: group_by

    // Validar formato de datas
    if (!validateDate($startDate) || !validateDate($endDate)) {
        throw new Exception('Formato de data inválido');
    }

    // Validar período
    if (!in_array($period, ['month', 'quarter', 'year', 'custom'])) {
        throw new Exception('Período inválido');
    }

    // ✅ NOVO: Validar groupBy
    if (!in_array($groupBy, ['EVENTOS', 'GRUPOS'])) {
        throw new Exception('GroupBy inválido');
    }

    $useMockData = shouldUseMockData($domain);

    if ($useMockData) {
        $data = getMockCostsData($period, $viewMode, $startDate, $endDate);
    } else {
        $data = getRealCostsData($domain, $period, $viewMode, $startDate, $endDate, $groupBy); // ✅ NOVO: Passar groupBy
    }

    echo json_encode([
        'success' => true,
        'data' => $data,
        'meta' => [
            'domain' => $domain,
            'generated_at' => date('Y-m-d H:i:s'),
            'is_mock' => $useMockData,
            'client_id' => $auth['client_id'],
            'view_mode' => $viewMode
        ]
    ], JSON_NUMERIC_CHECK);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ]);
}

/**
 * Valida formato de data YYYY-MM-DD
 */
function validateDate($date) {
    $d = DateTime::createFromFormat('Y-m-d', $date);
    return $d && $d->format('Y-m-d') === $date;
}

/**
 * Retorna dados MOCK de despesas
 */
function getMockCostsData($period, $viewMode, $startDate, $endDate) {
    // Dados CARGAS (12 meses) - usando nomes genéricos para os 4 eventos
    $costsByCategoryCargas = [
        ['month' => 'Jan/25', 'Combustível' => 145000, 'Manutenção' => 45000, 'Pessoal' => 95000, 'Tributos' => 35000, 'Demais' => 25000],
        ['month' => 'Fev/25', 'Combustível' => 152000, 'Manutenção' => 48000, 'Pessoal' => 98000, 'Tributos' => 37000, 'Demais' => 27000],
        ['month' => 'Mar/25', 'Combustível' => 163000, 'Manutenção' => 52000, 'Pessoal' => 105000, 'Tributos' => 40000, 'Demais' => 30000],
        ['month' => 'Abr/25', 'Combustível' => 156000, 'Manutenção' => 49500, 'Pessoal' => 101500, 'Tributos' => 38000, 'Demais' => 28000],
        ['month' => 'Mai/25', 'Combustível' => 168000, 'Manutenção' => 53000, 'Pessoal' => 108000, 'Tributos' => 41000, 'Demais' => 31000],
        ['month' => 'Jun/25', 'Combustível' => 175000, 'Manutenção' => 55000, 'Pessoal' => 112000, 'Tributos' => 43000, 'Demais' => 33000],
        ['month' => 'Jul/25', 'Combustível' => 181000, 'Manutenção' => 58000, 'Pessoal' => 116000, 'Tributos' => 45000, 'Demais' => 35000],
        ['month' => 'Ago/25', 'Combustível' => 177000, 'Manutenção' => 56000, 'Pessoal' => 114000, 'Tributos' => 43000, 'Demais' => 32000],
        ['month' => 'Set/25', 'Combustível' => 186000, 'Manutenção' => 59000, 'Pessoal' => 119000, 'Tributos' => 46000, 'Demais' => 36000],
        ['month' => 'Out/25', 'Combustível' => 193000, 'Manutenção' => 61000, 'Pessoal' => 123000, 'Tributos' => 48000, 'Demais' => 38000],
        ['month' => 'Nov/25', 'Combustível' => 198000, 'Manutenção' => 62000, 'Pessoal' => 126000, 'Tributos' => 49000, 'Demais' => 39000],
        ['month' => 'Dez/25', 'Combustível' => 205000, 'Manutenção' => 64000, 'Pessoal' => 130000, 'Tributos' => 51000, 'Demais' => 41000],
    ];

    // Dados PASSAGEIROS (12 meses)
    $costsByCategoryPassageiros = [
        ['month' => 'Jan/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Fev/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Mar/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Abr/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Mai/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Jun/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Jul/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Ago/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Set/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Out/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Nov/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
        ['month' => 'Dez/25', 'Combustível' => 0, 'Manutenção' => 0, 'Pessoal' => 0, 'Tributos' => 0, 'Demais' => 0],
    ];

    // Dados MOCKADOS de eficiência (mantidos conforme solicitado)
    $fuelEfficiencyCargas = [
        ['month' => 'Jan/25', 'kmPorLitro' => 3.2, 'custoKm' => 1.52],
        ['month' => 'Fev/25', 'kmPorLitro' => 3.25, 'custoKm' => 1.48],
        ['month' => 'Mar/25', 'kmPorLitro' => 3.18, 'custoKm' => 1.55],
        ['month' => 'Abr/25', 'kmPorLitro' => 3.22, 'custoKm' => 1.50],
        ['month' => 'Mai/25', 'kmPorLitro' => 3.28, 'custoKm' => 1.46],
        ['month' => 'Jun/25', 'kmPorLitro' => 3.30, 'custoKm' => 1.44],
        ['month' => 'Jul/25', 'kmPorLitro' => 3.26, 'custoKm' => 1.47],
        ['month' => 'Ago/25', 'kmPorLitro' => 3.24, 'custoKm' => 1.49],
        ['month' => 'Set/25', 'kmPorLitro' => 3.32, 'custoKm' => 1.42],
        ['month' => 'Out/25', 'kmPorLitro' => 3.35, 'custoKm' => 1.40],
        ['month' => 'Nov/25', 'kmPorLitro' => 3.38, 'custoKm' => 1.38],
        ['month' => 'Dez/25', 'kmPorLitro' => 3.40, 'custoKm' => 1.36],
    ];

    $fuelEfficiencyPassageiros = [
        ['month' => 'Jan/25', 'kmPorLitro' => 4.8, 'custoKm' => 0.98],
        ['month' => 'Fev/25', 'kmPorLitro' => 4.9, 'custoKm' => 0.96],
        ['month' => 'Mar/25', 'kmPorLitro' => 4.7, 'custoKm' => 1.00],
        ['month' => 'Abr/25', 'kmPorLitro' => 4.85, 'custoKm' => 0.97],
        ['month' => 'Mai/25', 'kmPorLitro' => 4.95, 'custoKm' => 0.95],
        ['month' => 'Jun/25', 'kmPorLitro' => 5.0, 'custoKm' => 0.93],
        ['month' => 'Jul/25', 'kmPorLitro' => 4.92, 'custoKm' => 0.95],
        ['month' => 'Ago/25', 'kmPorLitro' => 4.88, 'custoKm' => 0.97],
        ['month' => 'Set/25', 'kmPorLitro' => 5.05, 'custoKm' => 0.92],
        ['month' => 'Out/25', 'kmPorLitro' => 5.1, 'custoKm' => 0.90],
        ['month' => 'Nov/25', 'kmPorLitro' => 5.15, 'custoKm' => 0.88],
        ['month' => 'Dez/25', 'kmPorLitro' => 5.2, 'custoKm' => 0.86],
    ];

    // Calcular totais do período
    $startDateObj = new DateTime($startDate);
    $endDateObj = new DateTime($endDate);

    $categoryTotals = [];
    $totalPeriodo = 0;

    foreach ($costsByCategoryCargas as $monthData) {
        $monthStr = $monthData['month'];
        $monthMap = ['Jan' => 1, 'Fev' => 2, 'Mar' => 3, 'Abr' => 4, 'Mai' => 5, 'Jun' => 6,
                     'Jul' => 7, 'Ago' => 8, 'Set' => 9, 'Out' => 10, 'Nov' => 11, 'Dez' => 12];

        $parts = explode('/', $monthStr);
        $monthNum = $monthMap[$parts[0]] ?? 1;
        $yearNum = 2000 + intval($parts[1]);
        $monthDate = new DateTime("$yearNum-$monthNum-01");

        if ($monthDate >= $startDateObj && $monthDate <= $endDateObj) {
            foreach ($monthData as $key => $value) {
                if ($key !== 'month') {
                    if (!isset($categoryTotals[$key])) {
                        $categoryTotals[$key] = 0;
                    }
                    $categoryTotals[$key] += $value;
                    $totalPeriodo += $value;
                }
            }
        }
    }

    return [
        'period' => [
            'type' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'label' => formatPeriodLabel($period, $startDate, $endDate)
        ],
        'costsByCategoryCargas' => $costsByCategoryCargas,
        'costsByCategoryPassageiros' => $costsByCategoryPassageiros,
        'fuelEfficiencyCargas' => $fuelEfficiencyCargas,
        'fuelEfficiencyPassageiros' => $fuelEfficiencyPassageiros,
        'categoryTotals' => $categoryTotals,
        'totals' => ['total' => $totalPeriodo],
        // ✅ NOVO: Dados mockados de UNIDADES
        'unitCategoryTotals' => [
            'SPO' => 850000,
            'RJO' => 650000,
            'BHZ' => 450000,
            'CWB' => 350000,
            'Demais' => 250000
        ],
        'costsByUnitCargas' => [
            ['month' => 'Jan/25', 'SPO' => 68000, 'RJO' => 52000, 'BHZ' => 36000, 'CWB' => 28000, 'Demais' => 20000],
            ['month' => 'Fev/25', 'SPO' => 71000, 'RJO' => 54000, 'BHZ' => 38000, 'CWB' => 29000, 'Demais' => 21000],
            ['month' => 'Mar/25', 'SPO' => 76000, 'RJO' => 58000, 'BHZ' => 41000, 'CWB' => 32000, 'Demais' => 23000],
            ['month' => 'Abr/25', 'SPO' => 73000, 'RJO' => 56000, 'BHZ' => 39000, 'CWB' => 30000, 'Demais' => 22000],
            ['month' => 'Mai/25', 'SPO' => 78000, 'RJO' => 60000, 'BHZ' => 42000, 'CWB' => 33000, 'Demais' => 24000],
            ['month' => 'Jun/25', 'SPO' => 82000, 'RJO' => 63000, 'BHZ' => 44000, 'CWB' => 34000, 'Demais' => 25000],
            ['month' => 'Jul/25', 'SPO' => 85000, 'RJO' => 65000, 'BHZ' => 46000, 'CWB' => 36000, 'Demais' => 26000],
            ['month' => 'Ago/25', 'SPO' => 83000, 'RJO' => 64000, 'BHZ' => 45000, 'CWB' => 35000, 'Demais' => 25000],
            ['month' => 'Set/25', 'SPO' => 87000, 'RJO' => 67000, 'BHZ' => 47000, 'CWB' => 37000, 'Demais' => 27000],
            ['month' => 'Out/25', 'SPO' => 90000, 'RJO' => 69000, 'BHZ' => 49000, 'CWB' => 38000, 'Demais' => 28000],
            ['month' => 'Nov/25', 'SPO' => 93000, 'RJO' => 71000, 'BHZ' => 50000, 'CWB' => 39000, 'Demais' => 29000],
            ['month' => 'Dez/25', 'SPO' => 96000, 'RJO' => 74000, 'BHZ' => 52000, 'CWB' => 41000, 'Demais' => 30000],
        ],
        'costsByUnitPassageiros' => [
            ['month' => 'Jan/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Fev/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Mar/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Abr/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Mai/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Jun/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Jul/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Ago/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Set/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Out/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Nov/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
            ['month' => 'Dez/25', 'SPO' => 0, 'RJO' => 0, 'BHZ' => 0, 'CWB' => 0, 'Demais' => 0],
        ]
    ];
}

/**
 * Retorna dados REAIS de despesas do banco
 */
function getRealCostsData($dominio, $period, $viewMode, $startDate, $endDate, $groupBy)
{
    $g_sql = connect();

    // Validar domínio para evitar SQL injection
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $dominio)) {
        throw new Exception('Domínio inválido');
    }

    // ✅ NOVO: Decidir se agrupa por EVENTOS ou GRUPOS
    if ($groupBy === 'GRUPOS') {
        $data = getRealCostsDataByGroups($g_sql, $dominio, $period, $viewMode, $startDate, $endDate);
    } else {
        $data = getRealCostsDataByEvents($g_sql, $dominio, $period, $viewMode, $startDate, $endDate);
    }

    // ✅ SEMPRE buscar dados de UNIDADES (independente do groupBy)
    $unitsData = getRealCostsDataByUnits($g_sql, $dominio, $period, $viewMode, $startDate, $endDate);
    $data['unitCategoryTotals'] = $unitsData['unitCategoryTotals'];
    $data['costsByUnitCargas'] = $unitsData['costsByUnitCargas'];
    $data['costsByUnitPassageiros'] = $unitsData['costsByUnitPassageiros'];

    return $data;
}

/**
 * ✅ NOVO: Retorna dados agrupados por GRUPOS DE EVENTOS
 */
function getRealCostsDataByGroups($g_sql, $dominio, $period, $viewMode, $startDate, $endDate)
{
    // 1. Buscar despesas total do período
    $query = "SELECT COALESCE(SUM(d.vlr_parcela), 0) as total
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    if (!$result) {
        throw new Exception('Erro ao buscar despesas: ' . pg_last_error($g_sql));
    }

    $row = pg_fetch_array($result);
    $despesasTotal = (float)$row['total'];

    // 2. ✅ NOVO: Encontrar os 4 maiores GRUPOS por valor no período
    $query = "SELECT
                COALESCE(ge.grupo, 0) as id_grupo,
                COALESCE(ge.descricao, 'DEMAIS') as nome_grupo,
                COALESCE(SUM(d.vlr_parcela), 0) as total_despesa
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              LEFT OUTER JOIN {$dominio}_grupo_evento ge ON e.grupo = ge.grupo
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY ge.grupo, ge.descricao
              ORDER BY total_despesa DESC
              LIMIT 4";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    if (!$result) {
        throw new Exception('Erro ao buscar grupos: ' . pg_last_error($g_sql));
    }

    // Array para guardar os 4 principais grupos
    $grupos = [
        1 => ['id' => null, 'nome' => 'Grupo 1'],
        2 => ['id' => null, 'nome' => 'Grupo 2'],
        3 => ['id' => null, 'nome' => 'Grupo 3'],
        4 => ['id' => null, 'nome' => 'Grupo 4']
    ];
    $i = 0;

    while ($row = pg_fetch_array($result)) {
        $i++;
        $idGrupo = (int)$row['id_grupo'];
        $nomeGrupo = !empty($row['nome_grupo']) ? $row['nome_grupo'] : "Grupo {$idGrupo}";
        
        // ✅ Eventos sem grupo (id_grupo = 0) não entram nos top 4, vão direto para "Demais"
        if ($idGrupo === 0) {
            continue;
        }
        
        $grupos[$i] = [
            'id' => $idGrupo,
            'nome' => ucwords(strtolower($nomeGrupo))
        ];
    }

    // Preencher grupos vazios
    for ($j = $i + 1; $j <= 4; $j++) {
        $grupos[$j] = ['id' => null, 'nome' => "Grupo $j"];
    }

    // 3. Gerar dados mensais dos últimos 12 meses
    $costsByCategoryCargas = [];
    $costsByCategoryPassageiros = [];
    $fuelEfficiencyCargas = [];
    $fuelEfficiencyPassageiros = [];

    for ($m = 11; $m >= 0; $m--) {
        $data_ini = date('Y-m-01', strtotime("-$m months"));
        $data_fin = date('Y-m-t',  strtotime("-$m months"));

        $monthLabel = formatMonthLabel($data_ini);

        // ✅ NOVO: Buscar despesas por GRUPO do mês
        $despesas = getMonthlyCostsByGroup($g_sql, $dominio, $data_ini, $data_fin, $grupos);

        $costsByCategoryCargas[] = [
            'month' => $monthLabel,
            $grupos[1]['nome'] => $despesas[$grupos[1]['nome']],
            $grupos[2]['nome'] => $despesas[$grupos[2]['nome']],
            $grupos[3]['nome'] => $despesas[$grupos[3]['nome']],
            $grupos[4]['nome'] => $despesas[$grupos[4]['nome']],
            'Demais' => $despesas['Demais']
        ];

        $costsByCategoryPassageiros[] = [
            'month' => $monthLabel,
            $grupos[1]['nome'] => 0,
            $grupos[2]['nome'] => 0,
            $grupos[3]['nome'] => 0,
            $grupos[4]['nome'] => 0,
            'Demais' => 0
        ];

        $fuelEfficiencyCargas[] = [
            'month' => $monthLabel,
            'kmPorLitro' => round(3.2 + (rand(-10, 20) / 100), 2),
            'custoKm' => round(1.45 + (rand(-10, 10) / 100), 2)
        ];

        $fuelEfficiencyPassageiros[] = [
            'month' => $monthLabel,
            'kmPorLitro' => 0,
            'custoKm' => 0
        ];
    }

    // 4. ✅ NOVO: Calcular categoryTotals do período por GRUPO
    $categoryTotals = getPeriodCostsByGroup($g_sql, $dominio, $startDate, $endDate, $grupos);

    return [
        'period' => [
            'type' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'label' => formatPeriodLabel($period, $startDate, $endDate)
        ],
        'costsByCategoryCargas' => $costsByCategoryCargas,
        'costsByCategoryPassageiros' => $costsByCategoryPassageiros,
        'fuelEfficiencyCargas' => $fuelEfficiencyCargas,
        'fuelEfficiencyPassageiros' => $fuelEfficiencyPassageiros,
        'categoryTotals' => $categoryTotals,
        'totals' => ['total' => $despesasTotal]
    ];
}

/**
 * ✅ RENOMEADO: Retorna dados agrupados por EVENTOS (lógica original)
 */
function getRealCostsDataByEvents($g_sql, $dominio, $period, $viewMode, $startDate, $endDate)
{
    // 1. Buscar despesas total do período
    $query = "SELECT COALESCE(SUM(d.vlr_parcela), 0) as total
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    if (!$result) {
        throw new Exception('Erro ao buscar despesas: ' . pg_last_error($g_sql));
    }

    $row = pg_fetch_array($result);
    $despesasTotal = (float)$row['total'];

    // 2. Encontrar os 4 maiores eventos por valor no período
    $query = "SELECT
                d.evento,
                e.descricao as nome_evento,
                COALESCE(SUM(d.vlr_parcela), 0) as total_despesa
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY d.evento, e.descricao
              ORDER BY total_despesa DESC
              LIMIT 4";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    if (!$result) {
        throw new Exception('Erro ao buscar eventos: ' . pg_last_error($g_sql));
    }

    // ✅ MUDANÇA: Array agora guarda ID e NOME do evento
    $eventos = [
        1 => ['id' => null, 'nome' => 'Tipo 1'],
        2 => ['id' => null, 'nome' => 'Tipo 2'],
        3 => ['id' => null, 'nome' => 'Tipo 3'],
        4 => ['id' => null, 'nome' => 'Tipo 4']
    ];
    $i = 0;

    while ($row = pg_fetch_array($result)) {
        $i++;
        // Usar o nome do evento da tabela evento, ou fallback para o código
        // ✅ CAPITALIZAR: Primeira letra de cada palavra maiúscula
        $nomeEvento = !empty($row['nome_evento']) ? $row['nome_evento'] : "Evento {$row['evento']}";
        $eventos[$i] = [
            'id' => (int)$row['evento'], // ✅ Salvar o ID (integer) do evento
            'nome' => ucwords(strtolower($nomeEvento)) // ✅ Salvar o NOME para exibição
        ];
    }

    // Se não encontrou 4 eventos, preencher com valores padrão
    for ($j = $i + 1; $j <= 4; $j++) {
        $eventos[$j] = ['id' => null, 'nome' => "Tipo $j"];
    }

    // 3. Gerar dados mensais dos últimos 12 meses
    $costsByCategoryCargas = [];
    $costsByCategoryPassageiros = [];
    $fuelEfficiencyCargas = [];
    $fuelEfficiencyPassageiros = [];

    for ($m = 11; $m >= 0; $m--) {
        $data_ini = date('Y-m-01', strtotime("-$m months"));
        $data_fin = date('Y-m-t',  strtotime("-$m months"));

        $monthLabel = formatMonthLabel($data_ini);

        // Buscar despesas por evento do mês (query otimizada)
        $despesas = getMonthlyCostsByEvent($g_sql, $dominio, $data_ini, $data_fin, $eventos);

        $costsByCategoryCargas[] = [
            'month' => $monthLabel,
            $eventos[1]['nome'] => $despesas[$eventos[1]['nome']],
            $eventos[2]['nome'] => $despesas[$eventos[2]['nome']],
            $eventos[3]['nome'] => $despesas[$eventos[3]['nome']],
            $eventos[4]['nome'] => $despesas[$eventos[4]['nome']],
            'Demais' => $despesas['Demais']
        ];

        $costsByCategoryPassageiros[] = [
            'month' => $monthLabel,
            $eventos[1]['nome'] => 0,
            $eventos[2]['nome'] => 0,
            $eventos[3]['nome'] => 0,
            $eventos[4]['nome'] => 0,
            'Demais' => 0
        ];

        // Dados MOCKADOS de eficiência (conforme solicitado)
        $fuelEfficiencyCargas[] = [
            'month' => $monthLabel,
            'kmPorLitro' => round(3.2 + (rand(-10, 20) / 100), 2),
            'custoKm' => round(1.45 + (rand(-10, 10) / 100), 2)
        ];

        $fuelEfficiencyPassageiros[] = [
            'month' => $monthLabel,
            'kmPorLitro' => 0,
            'custoKm' => 0
        ];
    }

    // 4. Calcular categoryTotals do período selecionado (para cards)
    $categoryTotals = getPeriodCostsByEvent($g_sql, $dominio, $startDate, $endDate, $eventos);

    return [
        'period' => [
            'type' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'label' => formatPeriodLabel($period, $startDate, $endDate)
        ],
        'costsByCategoryCargas' => $costsByCategoryCargas,
        'costsByCategoryPassageiros' => $costsByCategoryPassageiros,
        'fuelEfficiencyCargas' => $fuelEfficiencyCargas,
        'fuelEfficiencyPassageiros' => $fuelEfficiencyPassageiros,
        'categoryTotals' => $categoryTotals,
        'totals' => ['total' => $despesasTotal]
    ];
}

/**
 * Busca despesas por evento em um mês (query otimizada)
 */
function getMonthlyCostsByEvent($g_sql, $dominio, $data_ini, $data_fin, $eventos) {
    $despesas = [
        $eventos[1]['nome'] => 0,
        $eventos[2]['nome'] => 0,
        $eventos[3]['nome'] => 0,
        $eventos[4]['nome'] => 0,
        'Demais' => 0
    ];

    // ✅ Query agora busca também o ID do evento (d.evento) e filtra considerar='S'
    $query = "SELECT
                d.evento as id_evento,
                e.descricao as nome_evento,
                COALESCE(SUM(d.vlr_parcela), 0) AS total_despesa
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY d.evento, e.descricao";

    $result = pg_query_params($g_sql, $query, [$data_ini, $data_fin]);

    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $idEvento = (int)$row['id_evento']; // ✅ Usar o ID (integer)
            $valor = (float)$row['total_despesa'];

            // ✅ MUDANÇA: Comparar pelo ID (integer) ao invés do nome (string)
            $encontrado = false;
            for ($i = 1; $i <= 4; $i++) {
                if ($eventos[$i]['id'] !== null && $idEvento === $eventos[$i]['id']) {
                    $despesas[$eventos[$i]['nome']] = $valor;
                    $encontrado = true;
                    break;
                }
            }

            // Se não for um dos 4 principais, adicionar em "Demais"
            if (!$encontrado) {
                $despesas['Demais'] += $valor;
            }
        }
    }

    return $despesas;
}

/**
 * ✅ NOVO: Busca despesas por GRUPO em um mês
 */
function getMonthlyCostsByGroup($g_sql, $dominio, $data_ini, $data_fin, $grupos) {
    $despesas = [
        $grupos[1]['nome'] => 0,
        $grupos[2]['nome'] => 0,
        $grupos[3]['nome'] => 0,
        $grupos[4]['nome'] => 0,
        'Demais' => 0
    ];

    // ✅ Query busca despesas por grupo e considera eventos com grupo = 0 como "Demais"
    $query = "SELECT
                COALESCE(ge.grupo, 0) as id_grupo,
                COALESCE(ge.descricao, 'DEMAIS') as nome_grupo,
                COALESCE(SUM(d.vlr_parcela), 0) AS total_despesa
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              LEFT OUTER JOIN {$dominio}_grupo_evento ge ON e.grupo = ge.grupo
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY ge.grupo, ge.descricao";

    $result = pg_query_params($g_sql, $query, [$data_ini, $data_fin]);

    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $idGrupo = (int)$row['id_grupo']; // ✅ Usar o ID (integer)
            $valor = (float)$row['total_despesa'];

            // ✅ MUDANÇA: Comparar pelo ID (integer) ao invés do nome (string)
            $encontrado = false;
            for ($i = 1; $i <= 4; $i++) {
                if ($grupos[$i]['id'] !== null && $idGrupo === $grupos[$i]['id']) {
                    $despesas[$grupos[$i]['nome']] = $valor;
                    $encontrado = true;
                    break;
                }
            }

            // Se não for um dos 4 principais, adicionar em "Demais"
            if (!$encontrado) {
                $despesas['Demais'] += $valor;
            }
        }
    }

    return $despesas;
}

/**
 * Busca totais do período por evento (para cards)
 */
function getPeriodCostsByEvent($g_sql, $dominio, $startDate, $endDate, $eventos) {
    $categoryTotals = [];

    // ✅ Query agora busca também o ID do evento (d.evento) e filtra considerar='S'
    $query = "SELECT
                d.evento as id_evento,
                e.descricao as nome_evento,
                COALESCE(SUM(d.vlr_parcela), 0) AS total
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY d.evento, e.descricao";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);

    $totalDemais = 0;

    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $idEvento = (int)$row['id_evento']; // ✅ Usar o ID (integer)
            $total = (float)$row['total'];

            // ✅ MUDANÇA: Comparar pelo ID (integer) ao invés do nome (string)
            $encontrado = false;
            for ($i = 1; $i <= 4; $i++) {
                if ($eventos[$i]['id'] !== null && $idEvento === $eventos[$i]['id']) {
                    $categoryTotals[$eventos[$i]['nome']] = $total;
                    $encontrado = true;
                    break;
                }
            }

            // Se não for um dos 4 principais, somar em "Demais"
            if (!$encontrado) {
                $totalDemais += $total;
            }
        }
    }

    // Garantir que todos os eventos existam no array
    for ($i = 1; $i <= 4; $i++) {
        if (!isset($categoryTotals[$eventos[$i]['nome']])) {
            $categoryTotals[$eventos[$i]['nome']] = 0;
        }
    }
    $categoryTotals['Demais'] = $totalDemais;

    return $categoryTotals;
}

/**
 * ✅ NOVO: Busca totais do período por GRUPO
 */
function getPeriodCostsByGroup($g_sql, $dominio, $startDate, $endDate, $grupos) {
    $categoryTotals = [];

    // ✅ Query busca despesas por grupo e considera eventos com grupo = 0 como "Demais"
    $query = "SELECT
                COALESCE(ge.grupo, 0) as id_grupo,
                COALESCE(ge.descricao, 'DEMAIS') as nome_grupo,
                COALESCE(SUM(d.vlr_parcela), 0) AS total
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              LEFT OUTER JOIN {$dominio}_grupo_evento ge ON e.grupo = ge.grupo
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY ge.grupo, ge.descricao";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);

    $totalDemais = 0;

    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $idGrupo = (int)$row['id_grupo']; // ✅ Usar o ID (integer)
            $total = (float)$row['total'];

            // ✅ MUDANÇA: Comparar pelo ID (integer) ao invés do nome (string)
            $encontrado = false;
            for ($i = 1; $i <= 4; $i++) {
                if ($grupos[$i]['id'] !== null && $idGrupo === $grupos[$i]['id']) {
                    $categoryTotals[$grupos[$i]['nome']] = $total;
                    $encontrado = true;
                    break;
                }
            }

            // Se não for um dos 4 principais, somar em "Demais"
            if (!$encontrado) {
                $totalDemais += $total;
            }
        }
    }

    // Garantir que todos os grupos existam no array
    for ($i = 1; $i <= 4; $i++) {
        if (!isset($categoryTotals[$grupos[$i]['nome']])) {
            $categoryTotals[$grupos[$i]['nome']] = 0;
        }
    }
    $categoryTotals['Demais'] = $totalDemais;

    return $categoryTotals;
}

/**
 * ✅ NOVO: Busca dados de despesas por UNIDADE
 */
function getRealCostsDataByUnits($g_sql, $dominio, $period, $viewMode, $startDate, $endDate)
{
    // 1. ✅ NOVO: Encontrar as 4 maiores UNIDADES por valor no período
    $query = "SELECT
                COALESCE(d.sigla_unidade, 'SEM UNIDADE') as sigla_unidade,
                COALESCE(SUM(d.vlr_parcela), 0) as total_despesa
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY d.sigla_unidade
              ORDER BY total_despesa DESC
              LIMIT 4";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    if (!$result) {
        throw new Exception('Erro ao buscar unidades: ' . pg_last_error($g_sql));
    }

    // Array para guardar as 4 principais unidades
    $unidades = [
        1 => ['nome' => 'Unidade 1'],
        2 => ['nome' => 'Unidade 2'],
        3 => ['nome' => 'Unidade 3'],
        4 => ['nome' => 'Unidade 4']
    ];
    $i = 0;

    while ($row = pg_fetch_array($result)) {
        $i++;
        $siglaUnidade = trim($row['sigla_unidade']);
        
        // ✅ Despesas sem unidade não entram nos top 4, vão direto para "Demais"
        if (empty($siglaUnidade) || $siglaUnidade === 'SEM UNIDADE') {
            continue;
        }
        
        $unidades[$i] = [
            'nome' => strtoupper($siglaUnidade) // ✅ Usar a sigla em maiúsculas
        ];
    }

    // Preencher unidades vazias
    for ($j = $i + 1; $j <= 4; $j++) {
        $unidades[$j] = ['nome' => "Unidade $j"];
    }

    // 2. Gerar dados mensais dos últimos 12 meses
    $costsByUnitCargas = [];
    $costsByUnitPassageiros = [];

    for ($m = 11; $m >= 0; $m--) {
        $data_ini = date('Y-m-01', strtotime("-$m months"));
        $data_fin = date('Y-m-t',  strtotime("-$m months"));

        $monthLabel = formatMonthLabel($data_ini);

        // Buscar despesas por unidade do mês
        $despesas = getMonthlyCostsByUnit($g_sql, $dominio, $data_ini, $data_fin, $unidades);

        $costsByUnitCargas[] = [
            'month' => $monthLabel,
            $unidades[1]['nome'] => $despesas[$unidades[1]['nome']],
            $unidades[2]['nome'] => $despesas[$unidades[2]['nome']],
            $unidades[3]['nome'] => $despesas[$unidades[3]['nome']],
            $unidades[4]['nome'] => $despesas[$unidades[4]['nome']],
            'Demais' => $despesas['Demais']
        ];

        $costsByUnitPassageiros[] = [
            'month' => $monthLabel,
            $unidades[1]['nome'] => 0,
            $unidades[2]['nome'] => 0,
            $unidades[3]['nome'] => 0,
            $unidades[4]['nome'] => 0,
            'Demais' => 0
        ];
    }

    // 3. Calcular categoryTotals do período selecionado (para cards)
    $unitCategoryTotals = getPeriodCostsByUnit($g_sql, $dominio, $startDate, $endDate, $unidades);

    return [
        'costsByUnitCargas' => $costsByUnitCargas,
        'costsByUnitPassageiros' => $costsByUnitPassageiros,
        'unitCategoryTotals' => $unitCategoryTotals
    ];
}

/**
 * ✅ NOVO: Busca despesas por UNIDADE em um mês
 */
function getMonthlyCostsByUnit($g_sql, $dominio, $data_ini, $data_fin, $unidades) {
    $despesas = [
        $unidades[1]['nome'] => 0,
        $unidades[2]['nome'] => 0,
        $unidades[3]['nome'] => 0,
        $unidades[4]['nome'] => 0,
        'Demais' => 0
    ];

    // ✅ Query busca despesas por unidade
    $query = "SELECT
                COALESCE(d.sigla_unidade, 'SEM UNIDADE') as sigla_unidade,
                COALESCE(SUM(d.vlr_parcela), 0) AS total_despesa
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY d.sigla_unidade";

    $result = pg_query_params($g_sql, $query, [$data_ini, $data_fin]);

    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $siglaUnidade = strtoupper(trim($row['sigla_unidade']));
            $valor = (float)$row['total_despesa'];

            // Comparar pelo nome da unidade (sigla)
            $encontrado = false;
            for ($i = 1; $i <= 4; $i++) {
                if ($unidades[$i]['nome'] === $siglaUnidade) {
                    $despesas[$unidades[$i]['nome']] = $valor;
                    $encontrado = true;
                    break;
                }
            }

            // Se não for uma das 4 principais ou se for vazio, adicionar em "Demais"
            if (!$encontrado || empty($siglaUnidade) || $siglaUnidade === 'SEM UNIDADE') {
                $despesas['Demais'] += $valor;
            }
        }
    }

    return $despesas;
}

/**
 * ✅ NOVO: Busca totais do período por UNIDADE
 */
function getPeriodCostsByUnit($g_sql, $dominio, $startDate, $endDate, $unidades) {
    $categoryTotals = [];

    // ✅ Query busca despesas por unidade
    $query = "SELECT
                COALESCE(d.sigla_unidade, 'SEM UNIDADE') as sigla_unidade,
                COALESCE(SUM(d.vlr_parcela), 0) AS total
              FROM {$dominio}_despesa d
              INNER JOIN {$dominio}_evento e ON d.evento = e.evento
              WHERE d.status <> 'C'
                AND e.considerar = 'S'
                AND d.data_vcto BETWEEN $1 AND $2
              GROUP BY d.sigla_unidade";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);

    $totalDemais = 0;

    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $siglaUnidade = strtoupper(trim($row['sigla_unidade']));
            $total = (float)$row['total'];

            // Comparar pelo nome da unidade (sigla)
            $encontrado = false;
            for ($i = 1; $i <= 4; $i++) {
                if ($unidades[$i]['nome'] === $siglaUnidade) {
                    $categoryTotals[$unidades[$i]['nome']] = $total;
                    $encontrado = true;
                    break;
                }
            }

            // Se não for uma das 4 principais ou se for vazio, somar em "Demais"
            if (!$encontrado || empty($siglaUnidade) || $siglaUnidade === 'SEM UNIDADE') {
                $totalDemais += $total;
            }
        }
    }

    // Garantir que todas as unidades existam no array
    for ($i = 1; $i <= 4; $i++) {
        if (!isset($categoryTotals[$unidades[$i]['nome']])) {
            $categoryTotals[$unidades[$i]['nome']] = 0;
        }
    }
    $categoryTotals['Demais'] = $totalDemais;

    return $categoryTotals;
}

/**
 * Formata mês/ano em português
 */
function formatMonthLabel($date) {
    $monthLabel = date('M/y', strtotime($date));
    return str_replace(
        ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        $monthLabel
    );
}

/**
 * Formata label do período
 */
function formatPeriodLabel($period, $startDate, $endDate) {
    switch ($period) {
        case 'month':
            return date('F Y', strtotime($startDate));
        case 'quarter':
            return 'Q' . ceil(date('n', strtotime($startDate)) / 3) . ' ' . date('Y', strtotime($startDate));
        case 'year':
            return date('Y', strtotime($startDate));
        case 'custom':
            return date('d/m/Y', strtotime($startDate)) . ' - ' . date('d/m/Y', strtotime($endDate));
        default:
            return date('F Y', strtotime($startDate));
    }
}