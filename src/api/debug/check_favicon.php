<?php
/**
 * DEBUG: Verificar favicon_url dos domínios no banco
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

try {
    if (!isDatabaseConfigured()) {
        echo json_encode([
            'error' => 'Banco de dados não configurado'
        ]);
        exit;
    }

    $conn = getDBConnection();
    
    // Buscar TODOS os domínios com favicon_url
    $query = "SELECT domain, name, favicon_url, is_active 
              FROM domains 
              ORDER BY domain";
    
    $result = pg_query($conn, $query);
    
    if (!$result) {
        throw new Exception('Erro ao buscar domínios: ' . pg_last_error($conn));
    }
    
    $domains = [];
    while ($row = pg_fetch_assoc($result)) {
        $domains[] = [
            'domain' => $row['domain'],
            'name' => $row['name'],
            'favicon_url' => $row['favicon_url'] ?? '(NULL)',
            'is_active' => $row['is_active'] === 't'
        ];
    }
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'domains' => $domains,
        'count' => count($domains)
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
