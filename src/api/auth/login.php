<?php
/**
 * ============================================
 * API - LOGIN COM DEBUG PASSO-A-PASSO
 * ============================================
 */

// Headers CORS - PRIMEIRA COISA
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Apenas POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

// PASSO 1: Carregar config
try {
    require_once __DIR__ . '/../config.php';
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'ERRO CONFIG: ' . $e->getMessage()]);
    exit;
}

// PASSO 2: Receber dados
try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $domain = strtoupper(trim($input['domain'] ?? ''));
    $username = strtolower(trim($input['username'] ?? ''));
    $password = trim($input['password'] ?? '');

    if (empty($domain) || empty($username) || empty($password)) {
        throw new Exception('Domínio, usuário e senha são obrigatórios');
    }
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ERRO DADOS: ' . $e->getMessage()]);
    exit;
}

// PASSO 3: Verificar banco
try {
    $hasDatabase = function_exists('isDatabaseConfigured') && isDatabaseConfigured();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'ERRO CHECK DB: ' . $e->getMessage()]);
    exit;
}

// PASSO 4: Processar login
try {
    if ($hasDatabase) {
        // Autenticação real
        $conn = null;
        try {
            $conn = getDBConnection();
            
            // Buscar domínio
            $stmt = pg_prepare($conn, "get_domain",
                "SELECT id, domain, name, use_mock_data, controla_linhas, modalidade, favicon_url, logo_light, logo_dark
                 FROM domains
                 WHERE UPPER(domain) = $1 AND is_active = TRUE");
            
            $result = pg_execute($conn, "get_domain", [$domain]);
            
            if (pg_num_rows($result) === 0) {
                throw new Exception('Domínio não encontrado');
            }
            
            $domainConfig = pg_fetch_assoc($result);
            pg_free_result($result);
            
            // Buscar usuário
            $stmt = pg_prepare($conn, "get_user",
                "SELECT id, username, password_hash, is_active, is_admin, email, full_name, unidade, troca_unidade, aprova_orcamento, nro_setor, unidades
                 FROM users
                 WHERE UPPER(domain) = $1 AND LOWER(username) = $2 AND is_active = TRUE");
            
            $result = pg_execute($conn, "get_user", [$domain, $username]);
            
            if (pg_num_rows($result) === 0) {
                sleep(1);
                throw new Exception('Credenciais inválidas');
            }
            
            $user = pg_fetch_assoc($result);
            pg_free_result($result);
            
            // Verificar senha
            if (!password_verify($password, $user['password_hash'])) {
                sleep(1);
                throw new Exception('Credenciais inválidas');
            }
            
            // Gerar token
            $token = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', time() + 86400);
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
            
            // Salvar sessão
            $stmt = pg_prepare($conn, "create_session",
                "INSERT INTO sessions (token, user_id, domain, expires_at, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5, $6)");
            
            pg_execute($conn, "create_session", [
                $token,
                $user['id'],
                $domain,
                $expiresAt,
                $ipAddress,
                $userAgent
            ]);
            
            // Atualizar last_login
            pg_query($conn, "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = " . (int)$user['id']);
            
            $responseData = [
                'token' => $token,
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'full_name' => $user['full_name'],
                    'client_id' => (int)$domainConfig['id'],
                    'client_name' => $domainConfig['name'],
                    'domain' => $domainConfig['domain'],
                    'is_admin' => $user['is_admin'] === 't' || $user['is_admin'] === true,
                    'is_presto' => strtolower($user['username']) === 'presto',
                    'unidade' => $user['unidade'] ?? '',
                    'troca_unidade' => $user['troca_unidade'] === 't' || $user['troca_unidade'] === true,
                    'aprova_orcamento' => $user['aprova_orcamento'] === 't' || $user['aprova_orcamento'] === true,
                    'nro_setor' => isset($user['nro_setor']) ? (int)$user['nro_setor'] : null,
                    'unidades' => $user['unidades'] ?? '', // ✅ NOVO - Unidades permitidas (CSV)
                    'unidade_atual' => $user['unidade'] ?? '', // Inicialmente, unidade_atual = unidade do cadastro
                    'use_mock_data' => $domainConfig['use_mock_data'] === 't' || $domainConfig['use_mock_data'] === true // ✅ ADICIONADO
                ],
                'client_config' => [
                    'modalidade' => $domainConfig['modalidade'] ?? 'CARGAS',
                    'controla_linhas' => $domainConfig['controla_linhas'] === 't' || $domainConfig['controla_linhas'] === true,
                    'favicon_url' => $domainConfig['favicon_url'] ?? '',
                    'theme' => [
                        'logo_light' => $domainConfig['logo_light'] ?? '',
                        'logo_dark' => $domainConfig['logo_dark'] ?? ''
                    ]
                ]
            ];
            
        } finally {
            if ($conn && function_exists('closeDBConnection')) {
                closeDBConnection($conn);
            }
        }
        
    } else {
        // Mock
        $validCredentials = [
            'XXX' => ['presto' => 'presto123', 'admin' => 'presto123'],
            'ACV' => ['presto' => 'presto123', 'admin' => 'presto123'],
            'VCS' => ['presto' => 'presto123', 'admin' => 'presto123', 'rose' => '12345'],
            'DMN' => ['presto' => 'presto123', 'admin' => 'presto123']
        ];

        if (!isset($validCredentials[$domain][$username]) ||
            $validCredentials[$domain][$username] !== $password) {
            sleep(1);
            throw new Exception('Credenciais inválidas');
        }

        $domainData = [
            'XXX' => ['name' => 'Sistema Presto', 'modalidade' => 'CARGAS', 'controla_linhas' => false],
            'ACV' => ['name' => 'Aceville Transportes', 'modalidade' => 'CARGAS', 'controla_linhas' => true],
            'VCS' => ['name' => 'VCS Transportes', 'modalidade' => 'MISTA', 'controla_linhas' => true],
            'DMN' => ['name' => 'DMN Transportes', 'modalidade' => 'CARGAS', 'controla_linhas' => false]
        ];

        $client = $domainData[$domain];
        $token = bin2hex(random_bytes(32));
        
        // ✅ DEFINIR UNIDADE BASEADA NO USUÁRIO
        $unidade = 'MTZ'; // Padrão para admin/presto
        if ($username === 'estoque') {
            $unidade = 'BHZ';
        } elseif ($username === 'compras') {
            $unidade = 'RJO';
        }

        $responseData = [
            'token' => $token,
            'user' => [
                'id' => rand(1, 1000),
                'username' => $username,
                'email' => $username . '@' . strtolower($domain) . '.com.br',
                'full_name' => strtoupper($username),
                'client_id' => rand(1, 100),
                'client_name' => $client['name'],
                'domain' => $domain,
                'is_admin' => $username === 'admin',
                'is_presto' => $username === 'presto',
                'unidade' => $unidade,
                'troca_unidade' => true,
                'aprova_orcamento' => ($username === 'admin' || $username === 'presto'), // ✅ Admin e Presto aprovam orçamentos
                'nro_setor' => 1, // ✅ ADICIONADO: Setor padrão para mock
                'unidade_atual' => $unidade
            ],
            'client_config' => [
                'modalidade' => $client['modalidade'],
                'controla_linhas' => $client['controla_linhas'],
                'favicon_url' => ''
            ]
        ];
    }
    
    echo json_encode([
        'success' => true,
        'token' => $responseData['token'],
        'user' => $responseData['user'],
        'client_config' => $responseData['client_config']
    ]);

} catch (Throwable $e) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getFile() . ':' . $e->getLine()
    ]);
}