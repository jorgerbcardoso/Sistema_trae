<?php
/**
 * ============================================
 * API - DASHBOARD DRE - REVENUE (RECEITAS)
 * ============================================
 * 
 * Retorna dados de receitas por unidade e ticket médio
 * - Cards: respeitam o período selecionado (startDate/endDate)
 * - Gráficos: sempre mostram os últimos 12 meses
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
    $period = isset($_GET['period']) ? trim((string)$_GET['period']) : 'month';
    $viewMode = isset($_GET['view_mode']) ? trim((string)$_GET['view_mode']) : 'GERAL';
    $startDate = isset($_GET['start_date']) ? trim((string)$_GET['start_date']) : date('Y-m-01');
    $endDate = isset($_GET['end_date']) ? trim((string)$_GET['end_date']) : date('Y-m-t');

    // Validar formato de datas
    if (!validateDate($startDate) || !validateDate($endDate)) {
        throw new Exception('Formato de data inválido');
    }

    // Validar período
    if (!in_array($period, ['month', 'quarter', 'year', 'custom'])) {
        throw new Exception('Período inválido');
    }

    // Verificar se deve usar mock
    $useMockData = shouldUseMockData($domain);

    if ($useMockData) {
        $data = getMockRevenueData($period, $viewMode, $startDate, $endDate);
    } else {
        $data = getRealRevenueData($domain, $period, $viewMode, $startDate, $endDate);
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
 * Retorna dados MOCK de receitas
 */
function getMockRevenueData($period, $viewMode, $startDate, $endDate) {
    // Dados CARGAS (12 meses)
    $revenueByUnitCargas = [
        ['month' => 'Jan/25', 'SAO' => 180000, 'RIO' => 160000, 'BHZ' => 70000, 'Demais' => 40000],
        ['month' => 'Fev/25', 'SAO' => 192000, 'RIO' => 168000, 'BHZ' => 78000, 'Demais' => 42000],
        ['month' => 'Mar/25', 'SAO' => 208000, 'RIO' => 182000, 'BHZ' => 86000, 'Demais' => 44000],
        ['month' => 'Abr/25', 'SAO' => 198000, 'RIO' => 173500, 'BHZ' => 82000, 'Demais' => 41500],
        ['month' => 'Mai/25', 'SAO' => 212000, 'RIO' => 185000, 'BHZ' => 90000, 'Demais' => 43000],
        ['month' => 'Jun/25', 'SAO' => 224000, 'RIO' => 196000, 'BHZ' => 94000, 'Demais' => 46000],
        ['month' => 'Jul/25', 'SAO' => 232000, 'RIO' => 203000, 'BHZ' => 99000, 'Demais' => 46000],
        ['month' => 'Ago/25', 'SAO' => 220000, 'RIO' => 192500, 'BHZ' => 95000, 'Demais' => 42500],
        ['month' => 'Set/25', 'SAO' => 236000, 'RIO' => 206500, 'BHZ' => 101000, 'Demais' => 46500],
        ['month' => 'Out/25', 'SAO' => 248000, 'RIO' => 217000, 'BHZ' => 105000, 'Demais' => 50000],
        ['month' => 'Nov/25', 'SAO' => 255000, 'RIO' => 223000, 'BHZ' => 108000, 'Demais' => 52000],
        ['month' => 'Dez/25', 'SAO' => 265000, 'RIO' => 232000, 'BHZ' => 112000, 'Demais' => 54000],
    ];

    // Dados PASSAGEIROS (12 meses)
    $revenueByUnitPassageiros = [
        ['month' => 'Jan/25', 'SAO' => 54000, 'RIO' => 48000, 'BHZ' => 21000, 'Demais' => 12000],
        ['month' => 'Fev/25', 'SAO' => 57600, 'RIO' => 50400, 'BHZ' => 23400, 'Demais' => 12600],
        ['month' => 'Mar/25', 'SAO' => 62400, 'RIO' => 54600, 'BHZ' => 25800, 'Demais' => 13200],
        ['month' => 'Abr/25', 'SAO' => 59400, 'RIO' => 52050, 'BHZ' => 24600, 'Demais' => 12450],
        ['month' => 'Mai/25', 'SAO' => 63600, 'RIO' => 55500, 'BHZ' => 27000, 'Demais' => 12900],
        ['month' => 'Jun/25', 'SAO' => 67200, 'RIO' => 58800, 'BHZ' => 28200, 'Demais' => 13800],
        ['month' => 'Jul/25', 'SAO' => 69600, 'RIO' => 60900, 'BHZ' => 29700, 'Demais' => 13800],
        ['month' => 'Ago/25', 'SAO' => 66000, 'RIO' => 57750, 'BHZ' => 28500, 'Demais' => 12750],
        ['month' => 'Set/25', 'SAO' => 70800, 'RIO' => 61950, 'BHZ' => 30300, 'Demais' => 13950],
        ['month' => 'Out/25', 'SAO' => 74400, 'RIO' => 65100, 'BHZ' => 31500, 'Demais' => 15000],
        ['month' => 'Nov/25', 'SAO' => 76500, 'RIO' => 66900, 'BHZ' => 32400, 'Demais' => 15600],
        ['month' => 'Dez/25', 'SAO' => 79500, 'RIO' => 69600, 'BHZ' => 33600, 'Demais' => 16200],
    ];

    $ticketMedioByUnitCargas = [
        ['month' => 'Jan/25', 'SAO' => 2850, 'RIO' => 2650, 'BHZ' => 2200, 'Demais' => 1880],
        ['month' => 'Fev/25', 'SAO' => 2900, 'RIO' => 2700, 'BHZ' => 2250, 'Demais' => 1930],
        ['month' => 'Mar/25', 'SAO' => 2950, 'RIO' => 2750, 'BHZ' => 2300, 'Demais' => 1980],
        ['month' => 'Abr/25', 'SAO' => 2880, 'RIO' => 2680, 'BHZ' => 2220, 'Demais' => 1900],
        ['month' => 'Mai/25', 'SAO' => 2920, 'RIO' => 2720, 'BHZ' => 2260, 'Demais' => 1940],
        ['month' => 'Jun/25', 'SAO' => 2980, 'RIO' => 2780, 'BHZ' => 2320, 'Demais' => 2000],
        ['month' => 'Jul/25', 'SAO' => 3020, 'RIO' => 2820, 'BHZ' => 2360, 'Demais' => 2040],
        ['month' => 'Ago/25', 'SAO' => 2950, 'RIO' => 2750, 'BHZ' => 2290, 'Demais' => 1970],
        ['month' => 'Set/25', 'SAO' => 3050, 'RIO' => 2850, 'BHZ' => 2390, 'Demais' => 2070],
        ['month' => 'Out/25', 'SAO' => 3100, 'RIO' => 2900, 'BHZ' => 2440, 'Demais' => 2120],
        ['month' => 'Nov/25', 'SAO' => 3150, 'RIO' => 2950, 'BHZ' => 2480, 'Demais' => 2160],
        ['month' => 'Dez/25', 'SAO' => 3200, 'RIO' => 3000, 'BHZ' => 2520, 'Demais' => 2200],
    ];

    $ticketMedioByUnitPassageiros = [
        ['month' => 'Jan/25', 'SAO' => 85, 'RIO' => 80, 'BHZ' => 68, 'Demais' => 58],
        ['month' => 'Fev/25', 'SAO' => 87, 'RIO' => 81, 'BHZ' => 70, 'Demais' => 60],
        ['month' => 'Mar/25', 'SAO' => 89, 'RIO' => 83, 'BHZ' => 72, 'Demais' => 62],
        ['month' => 'Abr/25', 'SAO' => 86, 'RIO' => 81, 'BHZ' => 69, 'Demais' => 59],
        ['month' => 'Mai/25', 'SAO' => 88, 'RIO' => 82, 'BHZ' => 71, 'Demais' => 60],
        ['month' => 'Jun/25', 'SAO' => 90, 'RIO' => 84, 'BHZ' => 73, 'Demais' => 62],
        ['month' => 'Jul/25', 'SAO' => 92, 'RIO' => 86, 'BHZ' => 75, 'Demais' => 64],
        ['month' => 'Ago/25', 'SAO' => 89, 'RIO' => 83, 'BHZ' => 72, 'Demais' => 61],
        ['month' => 'Set/25', 'SAO' => 93, 'RIO' => 87, 'BHZ' => 76, 'Demais' => 65],
        ['month' => 'Out/25', 'SAO' => 95, 'RIO' => 89, 'BHZ' => 78, 'Demais' => 67],
        ['month' => 'Nov/25', 'SAO' => 96, 'RIO' => 90, 'BHZ' => 79, 'Demais' => 68],
        ['month' => 'Dez/25', 'SAO' => 98, 'RIO' => 92, 'BHZ' => 81, 'Demais' => 70],
    ];

    // Calcular totais do período
    $startDateObj = new DateTime($startDate);
    $endDateObj = new DateTime($endDate);
    
    // ✅ GARANTIR que todas as unidades estejam no unitTotals (inicializar com 0)
    $unitTotals = [
        'SAO' => 0,
        'RIO' => 0,
        'BHZ' => 0,
        'Demais' => 0
    ];
    $totalPeriodo = 0;
    
    foreach ($revenueByUnitCargas as $monthData) {
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
                    if (!isset($unitTotals[$key])) {
                        $unitTotals[$key] = 0;
                    }
                    $unitTotals[$key] += $value;
                    $totalPeriodo += $value;
                }
            }
        }
    }
    
    // ✅ Se não encontrou dados no período (totais zerados), usar valores default do mês atual
    if ($totalPeriodo == 0) {
        $lastMonth = end($revenueByUnitCargas);
        foreach ($lastMonth as $key => $value) {
            if ($key !== 'month') {
                $unitTotals[$key] = $value;
                $totalPeriodo += $value;
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
        'revenueByUnitCargas' => $revenueByUnitCargas,
        'revenueByUnitPassageiros' => $revenueByUnitPassageiros,
        'ticketMedioByUnitCargas' => $ticketMedioByUnitCargas,
        'ticketMedioByUnitPassageiros' => $ticketMedioByUnitPassageiros,
        'unitTotals' => $unitTotals,
        'total' => $totalPeriodo
    ];
}

/**
 * Retorna dados REAIS de receitas do banco
 */
function getRealRevenueData($dominio, $period, $viewMode, $startDate, $endDate)
{
    $g_sql = getDBConnection();

    // Validar domínio para evitar SQL injection
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $dominio)) {
        throw new Exception('Domínio inválido');
    }

    // 1. Buscar receita total do período
    $query = "SELECT COALESCE(SUM(vlr_frete), 0) as total 
              FROM {$dominio}_cte 
              WHERE status <> 'C' 
                AND data_emissao BETWEEN $1 AND $2";
    
    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    if (!$result) {
        throw new Exception('Erro ao buscar receita total: ' . pg_last_error($g_sql));
    }
    
    $row = pg_fetch_array($result);
    $receitaTotal = (float)$row['total'];

    // 2. Encontrar as 3 maiores unidades em faturamento
    $query = "SELECT COALESCE(SUM(vlr_frete), 0) as total_frete,
                     CASE WHEN tp_frete = 'C' THEN sigla_emit ELSE sigla_dest END AS unid
              FROM {$dominio}_cte
              WHERE status <> 'C'
                AND data_emissao BETWEEN $1 AND $2
              GROUP BY 2
              ORDER BY 1 DESC
              LIMIT 3";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    if (!$result) {
        throw new Exception('Erro ao buscar unidades: ' . pg_last_error($g_sql));
    }

    $unids = [1 => '', 2 => '', 3 => ''];
    $i = 0;

    while ($row = pg_fetch_array($result)) {
        $i++;
        $unids[$i] = $row['unid'];
    }
    
    // Se não encontrou 3 unidades, preencher com valores vazios
    for ($j = $i + 1; $j <= 3; $j++) {
        $unids[$j] = "UNID$j";
    }

    // 3. Gerar dados mensais dos últimos 12 meses
    $revenueByUnitCargas = [];
    $revenueByUnitPassageiros = [];
    $ticketMedioByUnitCargas = [];
    $ticketMedioByUnitPassageiros = [];

    for ($m = 11; $m >= 0; $m--) {
        $data_ini = date('Y-m-01', strtotime("-$m months"));
        $data_fin = date('Y-m-t',  strtotime("-$m months"));

        $monthLabel = formatMonthLabel($data_ini);

        // Query otimizada: buscar dados de todas as 3 unidades + demais em uma única query
        $receitas = getMonthlyRevenueByUnits($g_sql, $dominio, $data_ini, $data_fin, $unids);

        $revenueByUnitCargas[] = [
            'month' => $monthLabel,
            $unids[1] => $receitas[$unids[1]]['receita'],
            $unids[2] => $receitas[$unids[2]]['receita'],
            $unids[3] => $receitas[$unids[3]]['receita'],
            'Demais' => $receitas['Demais']['receita']
        ];

        $revenueByUnitPassageiros[] = [
            'month' => $monthLabel,
            $unids[1] => 0,
            $unids[2] => 0,
            $unids[3] => 0,
            'Demais' => 0
        ];

        $ticketMedioByUnitCargas[] = [
            'month' => $monthLabel,
            $unids[1] => $receitas[$unids[1]]['ticket'],
            $unids[2] => $receitas[$unids[2]]['ticket'],
            $unids[3] => $receitas[$unids[3]]['ticket'],
            'Demais' => $receitas['Demais']['ticket']
        ];

        $ticketMedioByUnitPassageiros[] = [
            'month' => $monthLabel,
            $unids[1] => 0,
            $unids[2] => 0,
            $unids[3] => 0,
            'Demais' => 0
        ];
    }

    // 4. Calcular unitTotals do período selecionado (para cards)
    $unitTotals = getPeriodTotalsByUnits($g_sql, $dominio, $startDate, $endDate, $unids);

    return [
        'period' => [
            'type' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'label' => formatPeriodLabel($period, $startDate, $endDate)
        ],
        'revenueByUnitCargas' => $revenueByUnitCargas,
        'revenueByUnitPassageiros' => $revenueByUnitPassageiros,
        'ticketMedioByUnitCargas' => $ticketMedioByUnitCargas,
        'ticketMedioByUnitPassageiros' => $ticketMedioByUnitPassageiros,
        'unitTotals' => $unitTotals,
        'total' => $receitaTotal
    ];
}

/**
 * Busca receita e ticket médio por unidade em um mês (query otimizada)
 */
function getMonthlyRevenueByUnits($g_sql, $dominio, $data_ini, $data_fin, $unids) {
    $receitas = [
        $unids[1] => ['receita' => 0, 'ticket' => 0, 'count' => 0],
        $unids[2] => ['receita' => 0, 'ticket' => 0, 'count' => 0],
        $unids[3] => ['receita' => 0, 'ticket' => 0, 'count' => 0],
        'Demais' => ['receita' => 0, 'ticket' => 0, 'count' => 0]
    ];

    // Query única que retorna dados de todas as unidades (com COUNT)
    $query = "SELECT 
                CASE WHEN tp_frete = 'C' THEN sigla_emit ELSE sigla_dest END AS unid,
                COALESCE(SUM(vlr_frete), 0) AS total_receita,
                COALESCE(AVG(vlr_frete), 0) AS ticket_medio,
                COUNT(*) AS total_ctes
              FROM {$dominio}_cte
              WHERE status <> 'C'
                AND data_emissao BETWEEN $1 AND $2
              GROUP BY 1";

    $result = pg_query_params($g_sql, $query, [$data_ini, $data_fin]);
    
    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $unid = $row['unid'];
            $receita = (float)$row['total_receita'];
            $ticket = (float)$row['ticket_medio'];
            $count = (int)$row['total_ctes'];

            if ($unid === $unids[1] || $unid === $unids[2] || $unid === $unids[3]) {
                $receitas[$unid] = ['receita' => $receita, 'ticket' => $ticket, 'count' => $count];
            } else {
                // Para "Demais", somar receita e quantidade para calcular ticket médio ponderado depois
                $receitas['Demais']['receita'] += $receita;
                $receitas['Demais']['count'] += $count;
            }
        }
        
        // Calcular ticket médio de "Demais" como média ponderada (receita total / quantidade de CTes)
        if ($receitas['Demais']['count'] > 0) {
            $receitas['Demais']['ticket'] = $receitas['Demais']['receita'] / $receitas['Demais']['count'];
        }
    }

    return $receitas;
}

/**
 * Busca totais do período por unidade (para cards)
 */
function getPeriodTotalsByUnits($g_sql, $dominio, $startDate, $endDate, $unids) {
    $unitTotals = [];

    // Query única que retorna totais de todas as unidades
    $query = "SELECT 
                CASE WHEN tp_frete = 'C' THEN sigla_emit ELSE sigla_dest END AS unid,
                COALESCE(SUM(vlr_frete), 0) AS total
              FROM {$dominio}_cte
              WHERE status <> 'C'
                AND data_emissao BETWEEN $1 AND $2
              GROUP BY 1";

    $result = pg_query_params($g_sql, $query, [$startDate, $endDate]);
    
    $totalDemais = 0;
    
    if ($result) {
        while ($row = pg_fetch_array($result)) {
            $unid = $row['unid'];
            $total = (float)$row['total'];

            if ($unid === $unids[1]) {
                $unitTotals[$unids[1]] = $total;
            } elseif ($unid === $unids[2]) {
                $unitTotals[$unids[2]] = $total;
            } elseif ($unid === $unids[3]) {
                $unitTotals[$unids[3]] = $total;
            } else {
                $totalDemais += $total;
            }
        }
    }

    // Garantir que todas as unidades existam no array
    if (!isset($unitTotals[$unids[1]])) $unitTotals[$unids[1]] = 0;
    if (!isset($unitTotals[$unids[2]])) $unitTotals[$unids[2]] = 0;
    if (!isset($unitTotals[$unids[3]])) $unitTotals[$unids[3]] = 0;
    $unitTotals['Demais'] = $totalDemais;

    return $unitTotals;
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