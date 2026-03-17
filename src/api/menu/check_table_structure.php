<?php
/**
 * ============================================
 * VERIFICAR ESTRUTURA DA TABELA domain_menu_items
 * ============================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config.php';

try {
    global $g_sql;

    // Buscar estrutura da tabela
    $query = "
        SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_name = 'domain_menu_items'
        ORDER BY ordinal_position
    ";

    $result = sql($g_sql, $query);
    $columns = [];
    while ($row = pg_fetch_assoc($result)) {
        $columns[] = $row;
    }

    // Buscar alguns registros de exemplo
    $queryData = "SELECT * FROM domain_menu_items LIMIT 10";
    $resultData = sql($g_sql, $queryData);
    $sampleData = [];
    while ($row = pg_fetch_assoc($resultData)) {
        $sampleData[] = $row;
    }

    // Contar total por domínio
    $queryCount = "
        SELECT domain, COUNT(*) as total
        FROM domain_menu_items
        GROUP BY domain
        ORDER BY domain
    ";
    $resultCount = sql($g_sql, $queryCount);
    $counts = [];
    while ($row = pg_fetch_assoc($resultCount)) {
        $counts[] = $row;
    }

    echo json_encode([
        'success' => true,
        'table_structure' => $columns,
        'sample_data' => $sampleData,
        'counts_by_domain' => $counts
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
