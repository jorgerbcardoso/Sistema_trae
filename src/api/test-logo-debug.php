<?php
/**
 * Script de Debug: Verificar logo_dark no banco de dados
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

try {
    $g_sql = connect();
    
    // Buscar todos os domínios e suas logos
    $query = "SELECT domain, name, logo_dark, logo_light FROM domains ORDER BY domain";
    $result = sql($query, [], $g_sql);
    
    $domains = [];
    
    if ($result && pg_num_rows($result) > 0) {
        while ($row = pg_fetch_assoc($result)) {
            $domains[] = [
                'domain' => $row['domain'],
                'name' => $row['name'],
                'logo_dark' => $row['logo_dark'],
                'logo_light' => $row['logo_light']
            ];
        }
    }
    
    // Buscar especificamente o domínio ACV
    $query_acv = "SELECT domain, name, logo_dark, logo_light FROM domains WHERE domain = $1";
    $result_acv = sql($query_acv, ['ACV'], $g_sql);
    
    $acv_data = null;
    if ($result_acv && pg_num_rows($result_acv) > 0) {
        $acv_data = pg_fetch_assoc($result_acv);
    }
    
    echo json_encode([
        'success' => true,
        'total_domains' => count($domains),
        'all_domains' => $domains,
        'acv_specific' => $acv_data,
        'acv_logo_exists' => !empty($acv_data['logo_dark']),
        'acv_logo_value' => $acv_data['logo_dark'] ?? null
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
