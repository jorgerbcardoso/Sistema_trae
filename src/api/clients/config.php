<?php
/**
 * API de Configuração do Cliente (por Domínio)
 * GET /api/clients/config.php?domain=XXX
 * 
 * Headers: Authorization: Bearer <token>
 * Retorna: { "client": {...}, "config": {...} }
 */

require_once __DIR__ . '/../config.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Apenas GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    returnError('Método não permitido', 405);
}

try {
    // Pegar domínio da query string ou do usuário autenticado
    $domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : null;
    
    // Validar domínio
    if (empty($domain) || !preg_match('/^[A-Z]{3}$/', $domain)) {
        returnError('Domínio inválido. Deve ter 3 letras maiúsculas', 400);
    }
    
    $conn = getDBConnection();
    
    // ============================================
    // BUSCAR DOMÍNIO E SUAS CONFIGURAÇÕES
    // ============================================
    $stmt = pg_prepare($conn, "get_domain_config", 
        "SELECT 
            domain,
            name,
            client_name,
            website,
            email,
            phone,
            address,
            city,
            state,
            zipcode,
            modalidade,
            controla_linhas,
            favicon_url,
            logo_url,
            primary_color,
            secondary_color,
            theme,
            config,
            is_active
         FROM domains
         WHERE domain = $1");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . pg_last_error($conn));
    }
    
    $result = pg_execute($conn, "get_domain_config", [$domain]);
    
    if (!$result) {
        throw new Exception('Erro ao executar query: ' . pg_last_error($conn));
    }
    
    if (pg_num_rows($result) === 0) {
        returnError('Domínio não encontrado', 404);
    }
    
    $domainData = pg_fetch_assoc($result);
    
    // Verificar se está ativo
    if (!pgBoolToPHP($domainData['is_active'])) {
        returnError('Domínio inativo', 403);
    }
    
    // ============================================
    // PREPARAR RESPOSTA
    // ============================================
    
    // Decodificar config JSON (se existir)
    $customConfig = [];
    if (!empty($domainData['config'])) {
        $customConfig = json_decode($domainData['config'], true) ?? [];
    }
    
    // Config padrão
    $defaultConfig = [
        'theme' => [
            'primary_color' => $domainData['primary_color'] ?? '#1e40af',
            'secondary_color' => $domainData['secondary_color'] ?? '#64748b',
            'theme_mode' => 'dark', // FORÇAR TEMA ESCURO (CLARO DESATIVADO)
            'logo_light' => $domainData['logo_url'] ?? $domainData['favicon_url'],
            'logo_dark' => $domainData['logo_url'] ?? $domainData['favicon_url'],
            'favicon_url' => $domainData['favicon_url']
        ],
        'dashboards' => [
            [
                'id' => 'financeiro',
                'name' => 'Dashboard Financeiro',
                'icon' => 'TrendingUp',
                'enabled' => true,
                'order' => 1
            ],
            [
                'id' => 'operacional',
                'name' => 'Dashboard Operacional',
                'icon' => 'Package',
                'enabled' => false,
                'order' => 2
            ],
            [
                'id' => 'frotas',
                'name' => 'Gestão de Frotas',
                'icon' => 'Truck',
                'enabled' => false,
                'order' => 3
            ]
        ],
        'modules' => [
            'overview' => true,
            'revenue' => true,
            'costs' => true,
            'lines' => pgBoolToPHP($domainData['controla_linhas']),
            'profitability' => true
        ],
        'features' => [
            'dark_mode' => true,
            'print' => true,
            'export_pdf' => false,
            'export_excel' => false
        ],
        'business' => [
            'modalidade' => $domainData['modalidade'],
            'controla_linhas' => pgBoolToPHP($domainData['controla_linhas'])
        ]
    ];
    
    // Merge recursivo com config personalizado
    $finalConfig = array_replace_recursive($defaultConfig, $customConfig);
    
    // Dados do cliente
    $clientInfo = [
        'domain' => $domainData['domain'],
        'name' => $domainData['name'],
        'client_name' => $domainData['client_name'],
        'website' => $domainData['website'],
        'email' => $domainData['email'],
        'phone' => $domainData['phone'],
        'address' => $domainData['address'],
        'city' => $domainData['city'],
        'state' => $domainData['state'],
        'zipcode' => $domainData['zipcode'],
        'logo_url' => $domainData['logo_url'] ?? $domainData['favicon_url'],
        'favicon_url' => $domainData['favicon_url'],
        'modalidade' => $domainData['modalidade']
    ];
    
    closeDBConnection($conn);
    
    returnSuccess([
        'client' => $clientInfo,
        'config' => $finalConfig
    ]);
    
} catch (Exception $e) {
    error_log("[CLIENT-CONFIG] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao buscar configuração do domínio', 500);
}
