<?php
/**
 * FIX: Corrigir favicon_url de TODOS os domínios
 * Limpa favicon_url de domínios que não deveriam ter (deixa NULL/vazio)
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
    
    // Definir favicon_url correto para cada domínio
    $correctFavicons = [
        'XXX' => 'https://webpresto.com.br/favicon.png',
        'VCS' => 'https://webpresto.com.br/favicon.png',
        'ACV' => 'https://webpresto.com.br/images/logos_clientes/aceville_favicon.png',
        // Todos os outros domínios devem ter NULL ou '' (vazio)
    ];
    
    // 1. VERIFICAR estado atual de TODOS os domínios
    $query = "SELECT domain, name, favicon_url FROM domains WHERE is_active = TRUE ORDER BY domain";
    $result = pg_query($conn, $query);
    
    if (!$result) {
        throw new Exception('Erro ao buscar domínios: ' . pg_last_error($conn));
    }
    
    $domains = [];
    $needsFix = [];
    
    while ($row = pg_fetch_assoc($result)) {
        $domain = $row['domain'];
        $currentFavicon = $row['favicon_url'] ?? '';
        $expectedFavicon = $correctFavicons[$domain] ?? ''; // Padrão: vazio
        
        $domains[] = [
            'domain' => $domain,
            'name' => $row['name'],
            'current_favicon' => $currentFavicon,
            'expected_favicon' => $expectedFavicon,
            'needs_fix' => $currentFavicon !== $expectedFavicon
        ];
        
        if ($currentFavicon !== $expectedFavicon) {
            $needsFix[] = $domain;
        }
    }
    
    $response = [
        'domains' => $domains,
        'needs_fix' => $needsFix,
        'needs_fix_count' => count($needsFix)
    ];
    
    // 2. Se for GET, apenas mostrar dados
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $response['message'] = 'Use POST com action=fix para corrigir os favicons';
        echo json_encode($response, JSON_PRETTY_PRINT);
        closeDBConnection($conn);
        exit;
    }
    
    // 3. Se for POST com action=fix, CORRIGIR todos os favicons
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? 'preview';
        
        if ($action !== 'fix') {
            $response['message'] = 'Use action=fix para confirmar a correção';
            echo json_encode($response, JSON_PRETTY_PRINT);
            closeDBConnection($conn);
            exit;
        }
        
        // CORRIGIR todos os domínios
        $fixed = [];
        
        foreach ($domains as $domainData) {
            if (!$domainData['needs_fix']) {
                continue; // Já está correto
            }
            
            $domain = $domainData['domain'];
            $newFavicon = $domainData['expected_favicon'];
            
            $updateStmt = pg_prepare($conn, "update_favicon_" . $domain,
                "UPDATE domains 
                 SET favicon_url = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE domain = $2
                 RETURNING domain, favicon_url");
            
            if (!$updateStmt) {
                throw new Exception("Erro ao preparar update para $domain: " . pg_last_error($conn));
            }
            
            $updateResult = pg_execute($conn, "update_favicon_" . $domain, [$newFavicon, $domain]);
            
            if (!$updateResult) {
                throw new Exception("Erro ao atualizar $domain: " . pg_last_error($conn));
            }
            
            $updated = pg_fetch_assoc($updateResult);
            $fixed[] = [
                'domain' => $domain,
                'old_favicon' => $domainData['current_favicon'],
                'new_favicon' => $updated['favicon_url']
            ];
        }
        
        $response['action'] = 'fixed';
        $response['fixed'] = $fixed;
        $response['fixed_count'] = count($fixed);
        $response['message'] = "✅ {$response['fixed_count']} domínios corrigidos com sucesso!";
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
