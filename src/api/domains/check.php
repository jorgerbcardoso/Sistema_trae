<?php
/**
 * API PÚBLICA: Verificar Domínio
 * GET /sistema/api/domains/check.php?domain=XXX
 * 
 * Verifica se um domínio existe e está ativo
 * Esta API é PÚBLICA (não requer autenticação)
 * Usada para validar domínios no processo de login
 */

// Log de debug
error_log("=== CHECK DOMAIN API CHAMADA ===");
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
error_log("QUERY_STRING: " . $_SERVER['QUERY_STRING']);
error_log("GET params: " . print_r($_GET, true));

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../Database.php';

try {
    // Obter domínio da query string
    $domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : '';
    
    error_log("Domínio recebido: " . $domain);
    
    if (empty($domain)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'DOMÍNIO É OBRIGATÓRIO'
        ]);
        exit();
    }
    
    // Conectar ao banco
    $database = new Database();
    $db = $database->getConnection();
    
    error_log("Conectado ao banco, buscando domínio: " . $domain);
    
    // Buscar domínio (apenas informações básicas)
    $query = "
        SELECT 
            domain,
            name,
            modalidade,
            favicon_url,
            controla_linhas,
            use_mock_data,
            is_active
        FROM domains 
        WHERE domain = $1
    ";
    
    $result = pg_query_params($db, $query, [$domain]);
    
    if (!$result) {
        error_log("ERRO na query: " . pg_last_error($db));
        throw new Exception('Erro ao buscar domínio');
    }
    
    $domainData = pg_fetch_assoc($result);
    
    error_log("Resultado da query: " . print_r($domainData, true));
    
    if (!$domainData) {
        error_log("Domínio não encontrado no banco: " . $domain);
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'exists' => false,
            'message' => 'DOMÍNIO NÃO ENCONTRADO'
        ]);
        exit();
    }
    
    // Retornar informações básicas
    $response = [
        'success' => true,
        'exists' => true,
        'domain' => [
            'domain' => $domainData['domain'],
            'name' => $domainData['name'],
            'modalidade' => $domainData['modalidade'],
            'favicon_url' => $domainData['favicon_url'],
            'controla_linhas' => $domainData['controla_linhas'] === 't',
            'use_mock_data' => $domainData['use_mock_data'] === 't',
            'is_active' => $domainData['is_active'] === 't'
        ]
    ];
    
    error_log("Retornando resposta: " . json_encode($response));
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("ERRO CRÍTICO ao verificar domínio: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'exists' => false,
        'message' => 'ERRO AO VERIFICAR DOMÍNIO',
        'error' => $e->getMessage()
    ]);
}
