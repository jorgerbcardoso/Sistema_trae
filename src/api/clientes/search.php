<?php
/**
 * API: Buscar Clientes
 * Busca clientes por nome/razão social
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
require_once __DIR__ . '/../middleware/auth.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('Método não permitido');
    }
    
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => $authResult['message']
        ]);
        exit();
    }

    $dominio = strtolower($authResult['domain']);
    $query = $_GET['q'] ?? '';
    
    if (strlen($query) < 2) {
        echo json_encode([
            'success' => true,
            'clientes' => []
        ]);
        exit;
    }
    
    // Conectar ao banco
    $conn = pg_connect("host=localhost port=5432 dbname=presto user=postgres password=Web@presto1234");
    
    if (!$conn) {
        throw new Exception('Erro ao conectar ao banco de dados');
    }
    
    pg_query($conn, "SET TIMEZONE TO 'America/Sao_Paulo'");
    
    $tableName = "{$dominio}_cliente";
    
    // Buscar clientes por nome/razão social
    $searchQuery = "
        SELECT 
            cod_cli as codigo,
            raz_cli as nome
        FROM {$tableName}
        WHERE UPPER(raz_cli) LIKE UPPER($1)
        ORDER BY raz_cli
        LIMIT 50
    ";
    
    $searchStmt = 'search_clientes_' . uniqid();
    $searchParam = '%' . $query . '%';
    
    pg_prepare($conn, $searchStmt, $searchQuery);
    $result = pg_execute($conn, $searchStmt, [$searchParam]);
    
    if (!$result) {
        pg_close($conn);
        throw new Exception('Erro ao buscar clientes: ' . pg_last_error($conn));
    }
    
    $clientes = [];
    while ($row = pg_fetch_assoc($result)) {
        $clientes[] = [
            'codigo' => (int)$row['codigo'],
            'nome' => trim($row['nome'])
        ];
    }
    
    pg_close($conn);
    
    echo json_encode([
        'success' => true,
        'clientes' => $clientes
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
