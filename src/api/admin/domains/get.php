<?php
/**
 * API: Obter Domínio
 * GET /presto/api/admin/domains/get.php?domain=XXX
 * 
 * Retorna informações detalhadas de um domínio
 * Apenas usuários do domínio XXX podem acessar
 */

require_once __DIR__ . '/../../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('GET');

try {
    // Obter usuário autenticado
    $user = getCurrentUser();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'NÃO AUTENTICADO'
        ]);
        exit();
    }

    $domain = $user['domain'];

    // Verificar se é super admin
    if ($domain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE VISUALIZAR DOMÍNIOS.'
        ]);
        exit();
    }

    // Receber parâmetro
    if (empty($_GET['domain'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'DOMÍNIO É OBRIGATÓRIO'
        ]);
        exit();
    }

    $targetDomain = strtoupper(trim($_GET['domain']));

    // Buscar domínio
    $query = "
        SELECT 
            domain,
            name,
            cnpj,
            phone,
            address,
            website,
            email,
            modalidade,
            favicon_url,
            controla_linhas,
            use_mock_data,
            aprova_pedidos_manuais,
            ssw_domain,
            ssw_username,
            ssw_password,
            ssw_cpf,
            logo_light,
            logo_dark,
            is_active,
            created_at,
            updated_at
        FROM domains
        WHERE domain = $1
    ";
    
    $result = sql($query, [$targetDomain]);
    $domainData = pg_fetch_assoc($result);

    if (!$domainData) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'DOMÍNIO NÃO ENCONTRADO'
        ]);
        exit();
    }

    // Converter valores booleanos do PostgreSQL para boolean do JSON
    $domainData['controla_linhas'] = pgBoolToPHP($domainData['controla_linhas']);
    $domainData['use_mock_data'] = pgBoolToPHP($domainData['use_mock_data']);
    $domainData['aprova_pedidos_manuais'] = pgBoolToPHP($domainData['aprova_pedidos_manuais']);
    $domainData['is_active'] = pgBoolToPHP($domainData['is_active']);

    echo json_encode([
        'success' => true,
        'domain' => $domainData
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao buscar domínio: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO BUSCAR DOMÍNIO',
        'error' => $e->getMessage()
    ]);
}