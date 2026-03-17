<?php
/**
 * ============================================
 * CORRIGIR ITENS FALTANTES EM domain_menu_items
 * ============================================
 * 
 * Este script insere itens de menu que existem em menu_items
 * mas estão faltando em domain_menu_items para um domínio específico
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config.php';

try {
    global $g_sql;

    $targetDomain = 'DMN'; // Pode alterar conforme necessário

    // ========================================
    // 1. BUSCAR ITENS FALTANTES
    // ========================================
    $queryMissing = "
        SELECT mi.id, mi.code, mi.name, mi.section_id
        FROM menu_items mi
        WHERE mi.is_available = TRUE
          AND NOT EXISTS (
              SELECT 1 
              FROM domain_menu_items dmi 
              WHERE dmi.id = mi.id 
                AND dmi.domain = '$targetDomain'
          )
        ORDER BY mi.id
    ";

    $resultMissing = sql($g_sql, $queryMissing);
    $missingItems = [];
    while ($row = pg_fetch_assoc($resultMissing)) {
        $missingItems[] = $row;
    }

    // ========================================
    // 2. INSERIR ITENS FALTANTES
    // ========================================
    $inserted = 0;
    if (!empty($missingItems)) {
        sql($g_sql, 'BEGIN');
        
        foreach ($missingItems as $item) {
            $itemId = $item['id'];
            $insertQuery = "
                INSERT INTO domain_menu_items (domain, id)
                VALUES ('$targetDomain', $itemId)
                ON CONFLICT (domain, id) DO NOTHING
            ";
            sql($g_sql, $insertQuery);
            $inserted++;
        }
        
        sql($g_sql, 'COMMIT');
    }

    // ========================================
    // 3. VERIFICAR RESULTADO FINAL
    // ========================================
    $queryFinal = "
        SELECT COUNT(*) as total
        FROM domain_menu_items
        WHERE domain = '$targetDomain'
    ";
    $resultFinal = sql($g_sql, $queryFinal);
    $finalCount = pg_fetch_assoc($resultFinal);

    echo json_encode([
        'success' => true,
        'domain' => $targetDomain,
        'missing_items_found' => count($missingItems),
        'missing_items' => $missingItems,
        'items_inserted' => $inserted,
        'total_items_after' => (int)$finalCount['total']
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
}
