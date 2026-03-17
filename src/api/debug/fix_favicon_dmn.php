<?php
/**
 * FIX: Corrigir favicon_url do domínio DMN
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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
    
    // 1. VERIFICAR estado atual do DMN
    $checkStmt = pg_prepare($conn, "check_dmn", 
        "SELECT domain, name, favicon_url FROM domains WHERE domain = $1");
    
    if (!$checkStmt) {
        throw new Exception('Erro ao preparar query: ' . pg_last_error($conn));
    }
    
    $checkResult = pg_execute($conn, "check_dmn", ['DMN']);
    
    if (!$checkResult) {
        throw new Exception('Erro ao verificar DMN: ' . pg_last_error($conn));
    }
    
    $currentData = pg_fetch_assoc($checkResult);
    
    $response = [
        'before' => $currentData,
        'action' => 'none'
    ];
    
    // 2. Se for GET, apenas mostrar dados
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $response['message'] = 'Use POST para corrigir o favicon';
        echo json_encode($response, JSON_PRETTY_PRINT);
        closeDBConnection($conn);
        exit;
    }
    
    // 3. Se for POST, CORRIGIR o favicon
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Definir o favicon correto do Presto (padrão)
        $correctFaviconUrl = 'https://webpresto.com.br/favicon.png';
        
        $updateStmt = pg_prepare($conn, "update_dmn_favicon",
            "UPDATE domains 
             SET favicon_url = $1, updated_at = CURRENT_TIMESTAMP
             WHERE domain = $2
             RETURNING domain, name, favicon_url");
        
        if (!$updateStmt) {
            throw new Exception('Erro ao preparar update: ' . pg_last_error($conn));
        }
        
        $updateResult = pg_execute($conn, "update_dmn_favicon", [$correctFaviconUrl, 'DMN']);
        
        if (!$updateResult) {
            throw new Exception('Erro ao atualizar DMN: ' . pg_last_error($conn));
        }
        
        $updatedData = pg_fetch_assoc($updateResult);
        
        $response['action'] = 'updated';
        $response['after'] = $updatedData;
        $response['message'] = '✅ Favicon do DMN corrigido com sucesso!';
    }
    
    closeDBConnection($conn);
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
