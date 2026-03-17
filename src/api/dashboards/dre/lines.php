<?php
/**
 * ============================================
 * API - DASHBOARD DRE - LINHAS
 * ============================================
 */

require_once '../../config.php';
require_once '../../middleware/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

try {
    $auth = authenticate();
    $domain = $auth['domain'];
    
    $period = $_GET['period'] ?? 'month';
    $startDate = $_GET['start_date'] ?? date('Y-m-01');
    $endDate = $_GET['end_date'] ?? date('Y-m-t');
    
    $controlaLinhas = shouldControlLines($domain);
    $useMockData = shouldUseMockData($domain);
    
    if ($useMockData) {
        $data = getMockLinesData($controlaLinhas, $period, $startDate, $endDate);
    } else {
        $data = getRealLinesData($auth['client_id'], $controlaLinhas, $period, $startDate, $endDate);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $data,
        'meta' => [
            'domain' => $domain,
            'controla_linhas' => $controlaLinhas,
            'period' => [
                'type' => $period,
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'generated_at' => date('Y-m-d H:i:s'),
            'is_mock' => $useMockData
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getMockLinesData($controlaLinhas, $period, $startDate, $endDate) {
    return [
        'controla_linhas' => $controlaLinhas,
        'total_linhas' => 8,
        'linhas_ativas' => 8,
        'total_viagens' => 200,
        'resumo' => [
            'receita_total' => 850000.00,
            'custos_total' => 520000.00,
            'lucro_total' => 330000.00,
            'margem_media' => 38.82
        ],
        'por_linha' => [
            [
                'codigo' => 'L001',
                'nome' => 'São Paulo - Rio de Janeiro',
                'tipo' => 'Expressa',
                'receita' => 250000.00,
                'custos' => 140000.00,
                'lucro' => 110000.00,
                'margem' => 44.00,
                'viagens' => 60,
                'km_total' => 27000,
                'ocupacao_media' => 87.5,
                'status' => 'ativa'
            ],
            [
                'codigo' => 'L002',
                'nome' => 'São Paulo - Belo Horizonte',
                'tipo' => 'Semi-Expressa',
                'receita' => 180000.00,
                'custos' => 110000.00,
                'lucro' => 70000.00,
                'margem' => 38.89,
                'viagens' => 45,
                'km_total' => 27000,
                'ocupacao_media' => 82.3,
                'status' => 'ativa'
            ],
            [
                'codigo' => 'L003',
                'nome' => 'Rio de Janeiro - Vitória',
                'tipo' => 'Convencional',
                'receita' => 120000.00,
                'custos' => 75000.00,
                'lucro' => 45000.00,
                'margem' => 37.50,
                'viagens' => 30,
                'km_total' => 15000,
                'ocupacao_media' => 75.8,
                'status' => 'ativa'
            ],
            [
                'codigo' => 'L004',
                'nome' => 'São Paulo - Curitiba',
                'tipo' => 'Expressa',
                'receita' => 150000.00,
                'custos' => 90000.00,
                'lucro' => 60000.00,
                'margem' => 40.00,
                'viagens' => 40,
                'km_total' => 16000,
                'ocupacao_media' => 85.2,
                'status' => 'ativa'
            ]
        ],
        'comparacao' => [
            'mes_anterior' => [
                'receita' => 780000.00,
                'lucro' => 290000.00
            ]
        ],
        'alertas' => [
            [
                'tipo' => 'info',
                'mensagem' => 'Linha L001 (SP-RJ) é a mais lucrativa do período'
            ],
            [
                'tipo' => 'warning',
                'mensagem' => 'Linha L003 com ocupação abaixo da meta (75.8%)'
            ]
        ]
    ];
}

function getRealLinesData($clientId, $controlaLinhas, $period, $startDate, $endDate) {
    try {
        if (!$controlaLinhas) {
            return [
                'controla_linhas' => false,
                'total_linhas' => 0,
                'linhas_ativas' => 0,
                'total_viagens' => 0,
                'resumo' => [
                    'receita_total' => 0,
                    'custos_total' => 0,
                    'lucro_total' => 0,
                    'margem_media' => 0
                ],
                'por_linha' => [],
                'comparacao' => ['mes_anterior' => ['receita' => 0, 'lucro' => 0]],
                'alertas' => [
                    ['tipo' => 'info', 'mensagem' => 'Esta empresa não utiliza controle de linhas']
                ]
            ];
        }
        
        $conn = getDBConnection();
        
        try {
            $stmt = pg_prepare($conn, "get_linhas",
                "SELECT 
                    l.codigo,
                    l.nome,
                    l.tipo,
                    COALESCE(SUM(v.receita), 0) as receita,
                    COALESCE(SUM(v.custos), 0) as custos,
                    COUNT(v.id) as viagens,
                    l.status
                 FROM linhas l
                 LEFT JOIN viagens v ON v.linha_id = l.id 
                   AND v.client_id = $1
                   AND v.data BETWEEN $2 AND $3
                 WHERE l.client_id = $1
                 GROUP BY l.id, l.codigo, l.nome, l.tipo, l.status
                 ORDER BY receita DESC");
            
            $result = pg_execute($conn, "get_linhas", [$clientId, $startDate, $endDate]);
            
            $linhas = [];
            $totalReceita = 0;
            $totalCustos = 0;
            $totalViagens = 0;
            
            while ($row = pg_fetch_assoc($result)) {
                $receita = (float)$row['receita'];
                $custos = (float)$row['custos'];
                $lucro = $receita - $custos;
                $margem = $receita > 0 ? ($lucro / $receita) * 100 : 0;
                
                $linhas[] = [
                    'codigo' => $row['codigo'],
                    'nome' => $row['nome'],
                    'tipo' => $row['tipo'],
                    'receita' => $receita,
                    'custos' => $custos,
                    'lucro' => $lucro,
                    'margem' => round($margem, 2),
                    'viagens' => (int)$row['viagens'],
                    'status' => $row['status']
                ];
                
                $totalReceita += $receita;
                $totalCustos += $custos;
                $totalViagens += (int)$row['viagens'];
            }
            
            pg_free_result($result);
            
            $totalLucro = $totalReceita - $totalCustos;
            $margemMedia = $totalReceita > 0 ? ($totalLucro / $totalReceita) * 100 : 0;
            
            return [
                'controla_linhas' => true,
                'total_linhas' => count($linhas),
                'linhas_ativas' => count(array_filter($linhas, fn($l) => $l['status'] === 'ativa')),
                'total_viagens' => $totalViagens,
                'resumo' => [
                    'receita_total' => $totalReceita,
                    'custos_total' => $totalCustos,
                    'lucro_total' => $totalLucro,
                    'margem_media' => round($margemMedia, 2)
                ],
                'por_linha' => $linhas,
                'comparacao' => ['mes_anterior' => ['receita' => 0, 'lucro' => 0]],
                'alertas' => []
            ];
            
        } finally {
            closeDBConnection($conn);
        }
        
    } catch (Exception $e) {
        return [
            'controla_linhas' => $controlaLinhas,
            'total_linhas' => 0,
            'linhas_ativas' => 0,
            'total_viagens' => 0,
            'resumo' => [
                'receita_total' => 0,
                'custos_total' => 0,
                'lucro_total' => 0,
                'margem_media' => 0
            ],
            'por_linha' => [],
            'comparacao' => ['mes_anterior' => ['receita' => 0, 'lucro' => 0]],
            'alertas' => [
                ['tipo' => 'warning', 'mensagem' => '⚠️ Tabelas do banco ainda não foram criadas']
            ]
        ];
    }
}