<?php
/**
 * ============================================
 * API - DASHBOARD DRE - OVERVIEW
 * ============================================
 */

// LOG INICIAL - PRIMEIRO LOG DO ARQUIVO
file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - OVERVIEW.PHP INICIADO\n", FILE_APPEND);

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - Headers definidos\n", FILE_APPEND);

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verificar se arquivos existem ANTES de incluir
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

try {
    // Autenticar
    file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - Antes de authenticate()\n", FILE_APPEND);


    $auth = authenticate();

    file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - Depois de authenticate(). Domain: " . $auth['domain'] . "\n", FILE_APPEND);

    $domain = $auth['domain'];

    $period = $_GET['period'] ?? 'month';
    $startDate = $_GET['start_date'] ?? date('Y-m-01');
    $endDate = $_GET['end_date'] ?? date('Y-m-t');

    file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - Verificando shouldUseMockData($domain)\n", FILE_APPEND);

    // Verificar se deve usar mock
    $useMockData = shouldUseMockData($domain);

    file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - useMockData: " . ($useMockData ? 'TRUE' : 'FALSE') . "\n", FILE_APPEND);

    if ($useMockData) {
        $data = getMockOverviewData($period, $startDate, $endDate);
    } else {
        $data = getRealOverviewData($auth['domain'], $period, $startDate, $endDate);
    }

    file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - Dados obtidos, retornando JSON\n", FILE_APPEND);

    echo json_encode([
        'success' => true,
        'data' => $data,
        'meta' => [
            'domain' => $domain,
            'generated_at' => date('Y-m-d H:i:s'),
            'is_mock' => $useMockData,
            'client_id' => $auth['client_id']
        ]
    ]);
} catch (Exception $e) {
    file_put_contents('/tmp/overview-debug.log', date('Y-m-d H:i:s') . " - ERRO: " . $e->getMessage() . "\n", FILE_APPEND);

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
}

function getMockOverviewData($period, $startDate, $endDate) {
    // Dados mensais (para o gráfico de evolução) - 12 meses FIXOS
    $monthly = [
        ['month' => 'Jan/25', 'receita' => 750000, 'custos' => 480000, 'despesas' => 180000, 'lucro' => 90000],
        ['month' => 'Fev/25', 'receita' => 820000, 'custos' => 510000, 'despesas' => 165000, 'lucro' => 145000],
        ['month' => 'Mar/25', 'receita' => 850000, 'custos' => 520000, 'despesas' => 180000, 'lucro' => 150000],
        ['month' => 'Abr/25', 'receita' => 780000, 'custos' => 495000, 'despesas' => 145000, 'lucro' => 140000],
        ['month' => 'Mai/25', 'receita' => 900000, 'custos' => 550000, 'despesas' => 185000, 'lucro' => 165000],
        ['month' => 'Jun/25', 'receita' => 880000, 'custos' => 540000, 'despesas' => 180000, 'lucro' => 160000],
        ['month' => 'Jul/25', 'receita' => 920000, 'custos' => 560000, 'despesas' => 190000, 'lucro' => 170000],
        ['month' => 'Ago/25', 'receita' => 950000, 'custos' => 580000, 'despesas' => 195000, 'lucro' => 175000],
        ['month' => 'Set/25', 'receita' => 890000, 'custos' => 545000, 'despesas' => 183000, 'lucro' => 162000],
        ['month' => 'Out/25', 'receita' => 930000, 'custos' => 570000, 'despesas' => 192000, 'lucro' => 168000],
        ['month' => 'Nov/25', 'receita' => 970000, 'custos' => 590000, 'despesas' => 202000, 'lucro' => 178000],
        ['month' => 'Dez/25', 'receita' => 1000000, 'custos' => 600000, 'despesas' => 215000, 'lucro' => 185000]
    ];
    
    // ✅ CALCULAR TOTAIS DO PERÍODO SELECIONADO (filtrar por data)
    $startDateObj = new DateTime($startDate);
    $endDateObj = new DateTime($endDate);
    
    $receitaTotal = 0;
    $custosTotal = 0;
    $despesasTotal = 0;
    $lucroTotal = 0;
    $mesesContados = 0;
    
    $monthMap = ['Jan' => 1, 'Fev' => 2, 'Mar' => 3, 'Abr' => 4, 'Mai' => 5, 'Jun' => 6,
                 'Jul' => 7, 'Ago' => 8, 'Set' => 9, 'Out' => 10, 'Nov' => 11, 'Dez' => 12];
    
    foreach ($monthly as $monthData) {
        $monthStr = $monthData['month'];
        $parts = explode('/', $monthStr);
        $monthNum = $monthMap[$parts[0]] ?? 1;
        $yearNum = 2000 + intval($parts[1]);
        $monthDate = new DateTime("$yearNum-$monthNum-01");
        
        // ✅ Filtrar apenas meses dentro do período
        if ($monthDate >= $startDateObj && $monthDate <= $endDateObj) {
            $receitaTotal += $monthData['receita'];
            $custosTotal += $monthData['custos'];
            $despesasTotal += $monthData['despesas'];
            $lucroTotal += $monthData['lucro'];
            $mesesContados++;
        }
    }
    
    // Se não encontrou dados no período, usar o último mês
    if ($mesesContados == 0) {
        $lastMonth = end($monthly);
        $receitaTotal = $lastMonth['receita'];
        $custosTotal = $lastMonth['custos'];
        $despesasTotal = $lastMonth['despesas'];
        $lucroTotal = $lastMonth['lucro'];
    }
    
    // Calcular métricas
    $lucroBruto = $receitaTotal - $custosTotal;
    $lucroLiquido = $receitaTotal - $despesasTotal;
    $margemBruta = $receitaTotal > 0 ? ($lucroBruto / $receitaTotal) * 100 : 0;
    $margemLiquida = $receitaTotal > 0 ? ($lucroLiquido / $receitaTotal) * 100 : 0;
    $ebitda = $lucroLiquido + ($despesasTotal * 0.15); // Aproximação: EBITDA = Lucro Líquido + 15% das despesas
    $margemEbitda = $receitaTotal > 0 ? ($ebitda / $receitaTotal) * 100 : 0;
    
    // ✅ Dados MOCK separados por tipo
    $impostos = $despesasTotal * 0.25; // 25% das despesas = impostos
    $depreciacao = $despesasTotal * 0.15; // 15% das despesas = depreciação
    $despesasFinanceiras = $despesasTotal * 0.10; // 10% das despesas = desp. financeiras
    
    return [
        'period' => [
            'type' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'label' => formatPeriodLabel($period, $startDate, $endDate)
        ],
        'monthly' => $monthly, // Sempre retorna 12 meses para o gráfico
        'units' => [
            ['unidade' => 'Matriz SP', 'receita' => 450000, 'lucro' => 85000],
            ['unidade' => 'Filial RJ', 'receita' => 280000, 'lucro' => 42000],
            ['unidade' => 'Filial MG', 'receita' => 120000, 'lucro' => 23000]
        ],
        // ✅ TOTAIS DINÂMICOS - calculados baseado no período selecionado
        'receita_total' => $receitaTotal,
        'custos_total' => $custosTotal,
        'despesas_total' => $despesasTotal,
        'lucro_bruto' => $lucroBruto,
        'lucro_liquido' => $lucroLiquido,
        'margem_bruta' => round($margemBruta, 2),
        'margem_liquida' => round($margemLiquida, 2),
        'ebitda' => round($ebitda, 2),
        'margem_ebitda' => round($margemEbitda, 2),
        // ✅ NOVOS CAMPOS - Separação por tipo de evento (MOCK)
        'impostos' => round($impostos, 2),
        'depreciacao' => round($depreciacao, 2),
        'despesas_financeiras' => round($despesasFinanceiras, 2),
        'comparacao_mes_anterior' => [
            'receita' => 8.5,
            'custos' => 6.2,
            'lucro' => 12.3
        ],
        'alertas' => [
            [
                'tipo' => 'warning',
                'mensagem' => 'Custos de combustível aumentaram 15% em relação ao mês anterior'
            ],
            [
                'tipo' => 'info',
                'mensagem' => 'Receita de frete cresceu 8.5% no período'
            ]
        ],
        'kpis' => [
            'receita_por_viagem' => $receitaTotal > 0 ? round($receitaTotal / 200, 2) : 0,
            'custo_por_km' => 2.85,
            'ticket_medio' => $receitaTotal > 0 ? round($receitaTotal / 200, 2) : 0,
            'total_viagens' => 200
        ]
    ];
}

  function getRealOverviewData($dominio, $period, $startDate, $endDate)
  {
    $g_sql = connect();

    // Busca receita total e despesa total
    $query = "SELECT SUM (vlr_frete) FROM $dominio" . "_cte cte " .
             " WHERE status <> 'C' " .
               " AND data_emissao BETWEEN '$startDate' AND '$endDate'";

    $result = sql ($g_sql, $query);

    $row = pg_fetch_array ($result);
    $receitaTotal = (float)$row['sum'];

    // ✅ Buscar despesas separadas por TIPO de evento (N, I, D, F)
    // N = Normal (Custos Operacionais)
    // I = Impostos
    // D = Depreciação
    // F = Despesas Financeiras
    
    $query = "SELECT " .
             "  COALESCE(SUM(CASE WHEN COALESCE(e.tipo, 'N') = 'N' THEN d.vlr_parcela ELSE 0 END), 0) as despesas_normais, " .
             "  COALESCE(SUM(CASE WHEN COALESCE(e.tipo, 'N') = 'I' THEN d.vlr_parcela ELSE 0 END), 0) as impostos, " .
             "  COALESCE(SUM(CASE WHEN COALESCE(e.tipo, 'N') = 'D' THEN d.vlr_parcela ELSE 0 END), 0) as depreciacao, " .
             "  COALESCE(SUM(CASE WHEN COALESCE(e.tipo, 'N') = 'F' THEN d.vlr_parcela ELSE 0 END), 0) as despesas_financeiras " .
             "FROM $dominio" . "_despesa d " .
             "INNER JOIN $dominio" . "_evento e ON d.evento = e.evento " .
             "WHERE d.status <> 'C' " .
             "  AND e.considerar = 'S' " .
             "  AND d.data_vcto BETWEEN '$startDate' AND '$endDate'";

    $result = sql ($g_sql, $query);
    $row = pg_fetch_array ($result);
    
    $despesasNormais = (float)$row['despesas_normais'];
    $impostos = (float)$row['impostos'];
    $depreciacao = (float)$row['depreciacao'];
    $despesasFinanceiras = (float)$row['despesas_financeiras'];
    $despesasTotal = $despesasNormais + $impostos + $depreciacao + $despesasFinanceiras;

    // ✅ CÁLCULOS DRE:
    // Receita Operacional Bruta
    // (-) Custos Operacionais (apenas tipo N)
    // = Lucro Bruto / EBITDA
    // (-) Impostos (tipo I)
    // (-) Depreciação (tipo D)
    // (-) Despesas Financeiras (tipo F)
    // = Lucro Líquido
    
    $custosTotal   = $despesasNormais; // Apenas despesas tipo N
    $lucroBruto    = $receitaTotal - $custosTotal; // EBITDA
    $lucroLiquido  = $receitaTotal - $despesasTotal; // Lucro final
    $margemBruta   = $receitaTotal > 0 ? ($lucroBruto / $receitaTotal) * 100 : 0;
    $margemLiquida = $receitaTotal > 0 ? ($lucroLiquido / $receitaTotal) * 100 : 0;
    $alertas       = []; // Sem alertas por enquanto

    // Agora vamos buscar os valores mês a mês
    $monthly = [];

    // Gerar os últimos 12 meses (do mais antigo para o mais recente)
    for ($i = 11; $i >= 0; $i--)
    {
      // Calcular primeiro e último dia do mês
      $data_ini = date('Y-m-01', strtotime("-$i months"));
      $data_fin = date('Y-m-t',  strtotime("-$i months"));

      // Formatar label do mês (ex: "Jan/25")
      $monthLabel = date('M/y', strtotime($data_ini));
      $monthLabel = str_replace(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                                ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                                $monthLabel);

      // Buscar receitas e despesas do mês
      $query = "SELECT SUM (vlr_frete) FROM $dominio" . "_cte WHERE status <> 'C' AND data_emissao BETWEEN '$data_ini' AND '$data_fin'";
      $result = sql ($g_sql, $query);
      $row = pg_fetch_array ($result);
      $receitaMes = (float)$row['sum'];

      // ✅ JOIN com tabela de eventos + filtro considerar='S'
      $query = "SELECT SUM (d.vlr_parcela) " .
               "FROM $dominio" . "_despesa d " .
               "INNER JOIN $dominio" . "_evento e ON d.evento = e.evento " .
               "WHERE d.status <> 'C' " .
               "  AND e.considerar = 'S' " .
               "  AND d.data_vcto BETWEEN '$data_ini' AND '$data_fin'";
      $result = sql ($g_sql, $query);
      $row = pg_fetch_array ($result);
      $despesaMes = (float)$row['sum'];

      // Calcular lucro
      $lucroMes = $receitaMes - $despesaMes;

      // Adicionar ao array
      $monthly[] = ['month'    => $monthLabel,
                    'receita'  => $receitaMes,
                    'despesas' => $despesaMes,
                    'lucro'    => $lucroMes];
    }

    // Agora vamos buscar o resultado das 5 maiores unidades.
    $units = [];
    // Primeiro seleciona as 5 maiores
    $query = "SELECT SUM (vlr_frete), " .
                   " CASE WHEN tp_frete = 'C' THEN sigla_emit ELSE sigla_dest END AS unid " .
              " FROM $dominio" . "_cte " .
             " WHERE status <> 'C' " .
               " AND data_emissao BETWEEN '$startDate' AND '$endDate' " .
             " GROUP BY 2 ORDER BY 1 DESC LIMIT 5";

    $result = sql ($g_sql, $query);

    while ($row = pg_fetch_array ($result))
    {
      // ✅ JOIN com tabela de eventos + filtro considerar='S'
      $query = "SELECT SUM (d.vlr_parcela) " .
                " FROM $dominio" . "_despesa d " .
                "INNER JOIN $dominio" . "_evento e ON d.evento = e.evento " .
               " WHERE d.status <> 'C' " .
                 " AND e.considerar = 'S' " .
                 " AND d.data_vcto BETWEEN '$startDate' AND '$endDate' " .
                 " AND d.sigla_unidade = '" . $row['unid'] . "'";

      $result2 = sql ($g_sql, $query);
      $row2 = pg_fetch_array ($result2);

      $units[] = ['unidade' => $row['unid'], 'receita' => (float)$row['sum'], 'lucro' => (float)$row['sum'] - (float)$row2['sum']];
    }

    return ['period' => ['type'       => $period,
                         'start_date' => $startDate,
                         'end_date'   => $endDate,
                         'label'      => formatPeriodLabel($period, $startDate, $endDate)
                ],
                'monthly'                 => $monthly,
                'units'                   => $units,
                'receita_total'           => $receitaTotal,
                'custos_total'            => $custosTotal,
                'despesas_total'          => $despesasTotal,
                'lucro_bruto'             => $lucroBruto,
                'lucro_liquido'           => $lucroLiquido,
                'margem_bruta'            => round($margemBruta, 2),
                'margem_liquida'          => round($margemLiquida, 2),
                'ebitda'                  => $lucroBruto, // EBITDA = Lucro Bruto
                'margem_ebitda'           => round($margemBruta, 2),
                // ✅ NOVOS CAMPOS - Separação por tipo de evento
                'impostos'                => $impostos,
                'depreciacao'             => $depreciacao,
                'despesas_financeiras'    => $despesasFinanceiras,
                'comparacao_mes_anterior' => ['receita' => 0, 'custos' => 0, 'lucro' => 0],
                'alertas'                 => $alertas,
                'kpis'                    => ['receita_por_viagem' => 0,
                                              'custo_por_km'       => 0,
                                              'ticket_medio'       => 0,
                                              'total_viagens'      => 0
                ]
            ];
  }

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