<?php
/**
 * ============================================
 * CONFIGURAÇÃO - SISTEMA PRESTO
 * ============================================
 */

// ✅ NÃO CARREGAR ssw.php automaticamente
// Será carregado apenas quando necessário via require_ssw()
// require_once '/var/www/html/lib/ssw.php'; // ❌ COMENTADO TEMPORARIAMENTE

// ============================================
// CONFIGURAÇÕES DO BANCO DE DADOS POSTGRESQL
// ============================================
define('DB_HOST', 'localhost');
define('DB_PORT', '5432');
define('DB_NAME', 'presto');
define('DB_USER', 'postgres');
define('DB_PASS', 'Web@presto1234');

// ============================================
// CONFIGURAÇÕES DE API
// ============================================
define('API_VERSION', '1.0');
define('API_TIMEZONE', 'America/Sao_Paulo');

// ============================================
// CONFIGURAÇÕES DE JWT/AUTENTICAÇÃO
// ============================================
// 🔒 SECRET FORTE: Gerado com base64_encode(random_bytes(64))
// ⚠️ NUNCA COMPARTILHE ESTE SECRET! NUNCA COMITE NO GIT!
// ⚠️ Em produção, mova para variáveis de ambiente (.env)
define('JWT_SECRET', 'aGp4N2RmOHNkZmhqc2RmODk3M2hqZGZoODdzZGZoanNkZjg5N3NoZGZqaHNkZjg5N3NoZGY4OTdzaGRmODk3c2hmODk3c2hkZjg5N3NoZGY4OTdzaGRmODk3c2hkZjg5N3NoZGY4OTdz');
define('JWT_EXPIRATION', 86400);

// ============================================
// CONFIGURAÇÕES DE SENHA
// ============================================
define('PASSWORD_HASH_ALGO', PASSWORD_BCRYPT);
define('PASSWORD_HASH_COST', 10);

// ============================================
// CONFIGURAR TIMEZONE
// ============================================
date_default_timezone_set(API_TIMEZONE);

ini_set('log_errors', 1);
ini_set('error_log', '/var/www/html/tmp/php_debug.log');

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Conectar ao PostgreSQL
 */
function getDBConnection() {
    $connectionString = sprintf(
        "host=%s port=%s dbname=%s user=%s password=%s",
        DB_HOST,
        DB_PORT,
        DB_NAME,
        DB_USER,
        DB_PASS
    );

    $conn = @pg_connect($connectionString);

    if (!$conn) {
        throw new Exception('Não foi possível conectar ao banco de dados');
    }

    return $conn;
}

/**
 * Alias para getDBConnection() - compatibilidade com código antigo
 */
function connect() {
    return getDBConnection();
}

/**
 * Fechar conexão PostgreSQL
 */
function closeDBConnection($conn) {
    if (is_resource($conn)) {
        pg_close($conn);
    }
}

/**
 * Converter booleano PostgreSQL para PHP
 */
function pgBoolToPHP($value) {
    if (is_bool($value)) {
        return $value;
    }

    if (is_string($value)) {
        return $value === 't' || $value === 'true' || $value === '1';
    }

    return (bool)$value;
}

/**
 * Verificar se banco está configurado
 */
function isDatabaseConfigured() {
    try {
        $conn = getDBConnection();
        pg_close($conn);
        return true;
    } catch (Exception $e) {
        return false;
    }
}

/**
 * Sanitizar texto genérico
 */
function sanitizeText($text) {
    return trim(htmlspecialchars($text, ENT_QUOTES, 'UTF-8'));
}

/**
 * Sanitizar credenciais (username, domain)
 */
function sanitizeCredential($credential) {
    return strtoupper(trim($credential));
}

/**
 * Validar email
 */
function isValidEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Remover acentos e caracteres especiais de uma string
 * Útil para buscas em bases de dados sem acentuação
 * @param string $text Texto com acentos
 * @return string Texto sem acentos
 */
function removeAccents($text) {
    $unwanted_array = [
        'Š'=>'S', 'š'=>'s', 'Ž'=>'Z', 'ž'=>'z', 'À'=>'A', 'Á'=>'A', 'Â'=>'A', 'Ã'=>'A', 'Ä'=>'A', 'Å'=>'A', 'Æ'=>'A', 'Ç'=>'C', 'È'=>'E', 'É'=>'E',
        'Ê'=>'E', 'Ë'=>'E', 'Ì'=>'I', 'Í'=>'I', 'Î'=>'I', 'Ï'=>'I', 'Ñ'=>'N', 'Ò'=>'O', 'Ó'=>'O', 'Ô'=>'O', 'Õ'=>'O', 'Ö'=>'O', 'Ø'=>'O', ''=>'U',
        'Ú'=>'U', 'Û'=>'U', 'Ü'=>'U', 'Ý'=>'Y', 'Þ'=>'B', 'ß'=>'Ss', 'à'=>'a', 'á'=>'a', 'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'a', 'ç'=>'c',
        'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e', 'ì'=>'i', 'í'=>'i', 'î'=>'i', 'ï'=>'i', 'ð'=>'o', 'ñ'=>'n', 'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o',
        'ö'=>'o', 'ø'=>'o', 'ù'=>'u', 'ú'=>'u', 'û'=>'u', 'ý'=>'y', 'þ'=>'b', 'ÿ'=>'y'
    ];
    return strtr($text, $unwanted_array);
}

/**
 * Gerar token JWT simplificado
 */
function generateToken() {
    return bin2hex(random_bytes(32));
}

/**
 * Gerar hash de senha (bcrypt)
 */
function hashPassword($password) {
    return password_hash($password, PASSWORD_HASH_ALGO, ['cost' => PASSWORD_HASH_COST]);
}

/**
 * Verificar senha
 */
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

/**
 * Retornar resposta JSON de sucesso
 */
function returnSuccess($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');

    // Sempre incluir "success": true na resposta
    if (!isset($data['success'])) {
        $data = array_merge(['success' => true], $data);
    }

    echo json_encode($data);
    exit;
}

/**
 * Retornar resposta JSON de erro
 */
function returnError($message, $statusCode = 400) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $message
    ]);
    exit;
}

/**
 * Exibir mensagem na tela (toast) e parar execução
 * Esta função envia uma mensagem que será exibida como toast no frontend
 * @param string|array $message Mensagem a ser exibida (string ou array com detalhes)
 * @param string $type Tipo da mensagem: 'info', 'success', 'warning', 'error' (padrão: 'info')
 * @param int $statusCode HTTP status code (padrão: 200)
 * @param array $extra_data Dados adicionais a serem retornados junto com a mensagem (opcional)
 */
function msg($message, $type = 'info', $statusCode = 200, $extra_data = []) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    
    // ✅ CORREÇÃO CRÍTICA: success = true quando tipo for 'success', false para 'error'
    $success = ($type === 'success');
    
    // Se message for um array, formatar para exibição detalhada
    if (is_array($message)) {
        // Formatar array de forma mais legível
        $formattedMessage = "🔍 DEBUG INFO:\n\n";
        $formattedMessage .= formatArrayForDisplay($message);
        
        $response = [
            'success' => $success,
            'toast' => [
                'message' => $formattedMessage,
                'type' => $type
            ],
            'debug' => $message // Incluir array original para debug no console
        ];
        
        // ✅ Adicionar dados extras se houver
        if (!empty($extra_data)) {
            $response['toast']['extra_data'] = $extra_data;
        }
        
        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        $response = [
            'success' => $success,
            'toast' => [
                'message' => $message,
                'type' => $type
            ]
        ];
        
        // ✅ Adicionar dados extras se houver (no nível raiz da resposta)
        if (!empty($extra_data)) {
            $response = array_merge($response, $extra_data);
        }
        
        echo json_encode($response);
    }
    
    exit;
}

/**
 * Formatar array para exibição legível
 * Converte arrays em formato de texto amigável
 * @param array $data Array a ser formatado
 * @param int $level Nível de indentação (uso interno)
 * @return string Array formatado
 */
function formatArrayForDisplay($data, $level = 0) {
    $indent = str_repeat('  ', $level);
    $output = '';
    
    foreach ($data as $key => $value) {
        if (is_array($value)) {
            $output .= "{$indent}📌 {$key}:\n";
            $output .= formatArrayForDisplay($value, $level + 1);
        } elseif (is_bool($value)) {
            $output .= "{$indent}• {$key}: " . ($value ? 'true' : 'false') . "\n";
        } elseif (is_null($value)) {
            $output .= "{$indent}• {$key}: NULL\n";
        } elseif (is_numeric($value)) {
            $output .= "{$indent}• {$key}: {$value}\n";
        } else {
            $output .= "{$indent}• {$key}: {$value}\n";
        }
    }
    
    return $output;
}

/**
 * Retornar resposta JSON genérica
 * Similar ao returnSuccess e returnError, mas com mais flexibilidade
 * @param array $data Dados da resposta (deve conter 'success' e qualquer outro campo)
 * @param int $statusCode HTTP status code (padrão: 200)
 */
function respondJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Converter booleano PHP para PostgreSQL
 */
function phpBoolToPg($value) {
    return $value ? 't' : 'f';
}

/**
 * Log de auditoria
 */
function logAction($conn, $userId, $action, $details = null) {
    try {
        $stmt = pg_prepare($conn, "log_action_" . rand(0, 999999),
            "INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent, created_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)");

        if ($stmt) {
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

            pg_execute($conn, "log_action_" . rand(0, 999999), [
                $userId,
                $action,
                $details,
                $ipAddress,
                $userAgent
            ]);
        }
    } catch (Exception $e) {
        // Não falhar se log de auditoria falhar
        error_log("Erro ao registrar log de auditoria: " . $e->getMessage());
    }
}

// ============================================
// FUNÇÕES DE AUTENTICAÇÃO E SESSÃO
// ============================================

/**
 * Polyfill para getallheaders() se não existir
 */
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

/**
 * Inicia sessão segura
 */
function initSecureSession() {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.cookie_httponly', 1);
        ini_set('session.use_only_cookies', 1);
        ini_set('session.cookie_secure', 0); // Mude para 1 se usar HTTPS
        ini_set('session.cookie_samesite', 'Lax');

        session_name('PRESTO_SESSION');
        session_set_cookie_params(28800); // 8 horas
        session_start();
    }
}

/**
 * Extrair token do header Authorization
 */
function getTokenFromHeader() {
    // Fallback para getallheaders() caso não exista (alguns servidores)
    if (!function_exists('getallheaders')) {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header = str_replace('_', '-', substr($key, 5));
                $headers[$header] = $value;
            }
        }
    } else {
        $headers = getallheaders();
    }

    // Tentar diferentes formas de obter o token
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

    // FALLBACK: Se não tiver Authorization header, tentar pegar do cookie
    if (empty($authHeader) && isset($_COOKIE['token'])) {
        return $_COOKIE['token'];
    }

    if (!preg_match('/Bearer\\s+(.*)$/i', $authHeader, $matches)) {
        return null;
    }

    $token = trim($matches[1]);

    // IMPORTANTE: Remover TODOS os espaços em branco (incluindo \r\n, \t, etc)
    $token = preg_replace('/\\s+/', '', $token);

    return $token;
}

/**
 * Verifica se usuário está autenticado (via token no banco)
 */
function isAuthenticated() {
    // ✅ SISTEMA SSW: Sempre retorna true (autenticação gerenciada pelo Apache/SSW)
    return true;
}

/**
 * Requer autenticação (middleware)
 */
function requireAuth() {
    // ✅ SISTEMA SSW: Não bloqueia acesso (autenticação gerenciada pelo Apache/SSW)
    return;
}

/**
 * Obtém usuário atual da sessão (via token no banco)
 */
function getCurrentUser() {
    // ✅ SISTEMA SSW: Pegar username e domain de cookies/headers e buscar dados no banco
    global $usuario, $dominio, $unid;
    
    // Definir valores padrão se não existirem
    if (!isset($usuario)) $usuario = 'PRESTO';
    if (!isset($dominio)) $dominio = 'DMN';
    if (!isset($unid)) $unid = 'MTZ';
    
    // ✅ PRIORIDADE 1: Ler HEADERS (X-Domain e X-Unidade enviados pelo frontend)
    $headers = getallheaders();
    $xDomain = $headers['X-Domain'] ?? $headers['x-domain'] ?? '';
    $xUnidade = $headers['X-Unidade'] ?? $headers['x-unidade'] ?? '';
    
    // ✅ PRIORIDADE 2: Tentar pegar de cookies (se o SSW usar cookies)
    $username = $_COOKIE['usuario'] ?? $usuario;
    $domain = !empty($xDomain) ? $xDomain : ($_COOKIE['dominio'] ?? $dominio);
    $unidade = !empty($xUnidade) ? $xUnidade : ($_COOKIE['unidade'] ?? $unid);
    
    // Normalizar
    $username = strtoupper($username);
    $domain = strtoupper($domain);
    $unidade = strtoupper($unidade);
    
    // ============================================
    // ✅ BUSCAR DADOS REAIS DO USUÁRIO NO BANCO
    // ============================================
    try {
        $conn = getDBConnection();
        
        // Buscar usuário pelo username e domain
        $stmt = pg_prepare($conn, "get_current_user", 
            "SELECT id, username, email, full_name, is_admin, domain, unidade, troca_unidade, nro_setor, unidades
             FROM users 
             WHERE UPPER(username) = $1 AND UPPER(domain) = $2 AND is_active = true
             LIMIT 1");
        
        if ($stmt) {
            $result = pg_execute($conn, "get_current_user", [$username, $domain]);
            
            if ($result && pg_num_rows($result) > 0) {
                $userData = pg_fetch_assoc($result);
                
                // Retornar dados REAIS do banco
                $currentUser = [
                    'id' => (int)$userData['id'],
                    'user_id' => (int)$userData['id'],
                    'username' => $userData['username'],
                    'email' => $userData['email'],
                    'full_name' => $userData['full_name'],
                    'is_admin' => pgBoolToPHP($userData['is_admin']), // ✅ REAL do banco
                    'domain' => $userData['domain'],
                    'client_id' => 1,
                    'client_name' => 'Cliente ' . $userData['domain'],
                    'unidade' => $userData['unidade'] ?? $unidade,
                    'troca_unidade' => pgBoolToPHP($userData['troca_unidade']),
                    'nro_setor' => $userData['nro_setor'] ? (int)$userData['nro_setor'] : null,
                    'unidades' => $userData['unidades'] ?? '',
                    'unidade_atual' => $unidade // ✅ CRÍTICO: Usa header X-Unidade
                ];
                
                closeDBConnection($conn);
                return $currentUser;
            }
        }
        
        closeDBConnection($conn);
        
    } catch (Exception $e) {
        error_log("[getCurrentUser] Erro ao buscar usuário: " . $e->getMessage());
    }
    
    // ============================================
    // ✅ FALLBACK: Se não encontrar no banco, retornar dados padrão
    // ============================================
    return [
        'id' => 1,
        'user_id' => 1,
        'username' => $username,
        'email' => strtolower($username) . '@' . strtolower($domain) . '.com.br',
        'full_name' => $username,
        'is_admin' => ($username === 'PRESTO' || $username === 'ADMIN'),
        'domain' => $domain,
        'client_id' => 1,
        'client_name' => 'Cliente ' . $domain,
        'unidade' => $unidade,
        'troca_unidade' => true,
        'unidade_atual' => $unidade
    ];
}

// ============================================
// FUNÇÃO SQL() - BIBLIOTECA SSW COMPATÍVEL
// ============================================

/**
 * Executar queries SQL no PostgreSQL
 * Compatível com a função sql() da biblioteca SSW
 * 
 * @param string $query Query SQL (use $1, $2, etc. para parâmetros)
 * @param array $params Parâmetros da query (opcional)
 * @param resource|null $conn Conexão existente (opcional, cria nova se null)
 * @return resource|false Resultado da query ou false em caso de erro
 */
function sql($query, $params = [], $conn = null) {
    $createdConnection = false;
    
    // ⚠️ IMPORTANTE: Detectar chamadas antigas do padrão SSW
    // Padrão antigo: sql($conn, $query, $prepare=false, $params=[])]
    // Padrão novo:   sql($query, $params=[], $conn=null)
    
    // Detectar se primeiro argumento é conexão (resource ou objeto PgSql\Connection no PHP 8+)
    $isConnection = is_resource($query) || (is_object($query) && get_class($query) === 'PgSql\\Connection');
    
    if ($isConnection) {
        // Padrão antigo detectado: sql($g_sql, $query, $prepare, $params)
        $oldConn = $query;
        $oldQuery = $params; // Segundo argumento era a query
        $oldPrepare = $conn; // Terceiro argumento (ignoramos)
        $oldParams = func_num_args() >= 4 ? func_get_arg(3) : [];
        
        // Reorganizar para padrão novo
        $query = $oldQuery;
        $params = is_array($oldParams) ? $oldParams : [];
        $conn = $oldConn;
    }
    
    // Se segundo argumento é conexão e não há terceiro, formato: sql($query, $conn)
    $isParamsConnection = is_resource($params) || (is_object($params) && get_class($params) === 'PgSql\\Connection');
    if ($isParamsConnection && $conn === null) {
        $conn = $params;
        $params = [];
    }
    
    // Garantir que $params seja sempre um array
    if (!is_array($params)) {
        $params = [];
    }
    
    // Garantir que $query seja string
    if (!is_string($query)) {
        error_log("SQL Error: Query não é string. Tipo recebido: " . gettype($query));
        return false;
    }
    
    try {
        // Se não foi passada uma conexão, criar uma nova
        if ($conn === null) {
            $conn = getDBConnection();
            $createdConnection = true;
        }
        
        // Preparar a query
        $stmtName = 'stmt_' . md5($query . microtime(true) . rand());
        $stmt = @pg_prepare($conn, $stmtName, $query);
        
        if (!$stmt) {
            $error = pg_last_error($conn);
            if ($createdConnection) {
                closeDBConnection($conn);
            }
            throw new Exception("Erro ao preparar query: " . $error);
        }
        
        // Executar a query
        $result = @pg_execute($conn, $stmtName, $params);
        
        if (!$result) {
            $error = pg_last_error($conn);
            if ($createdConnection) {
                closeDBConnection($conn);
            }
            throw new Exception("Erro ao executar query: " . $error);
        }
        
        // ✅ IMPORTANTE: Retornar o resultado PgSql\Result, NÃO converter para array
        // Isso permite que o código use pg_fetch_assoc(), pg_num_rows(), etc.
        // Se criamos a conexão aqui, NÃO fechar (quem chamou precisa fazer fetch)
        // Nota: Conexões criadas internamente serão fechadas pelo garbage collector
        
        return $result;
        
    } catch (Exception $e) {
        if ($createdConnection && $conn) {
            closeDBConnection($conn);
        }
        // Lançar erro para ser capturado pelo catch externo
        error_log("SQL Error: " . $e->getMessage());
        return false;
    }
}

// ============================================
// FUNÇÕES DE REQUEST E RESPONSE
// ============================================

/**
 * Configurar headers CORS
 * @param string $contentType Tipo de conteúdo (padrão: 'application/json')
 * @param array $additionalHeaders Headers adicionais
 */
function setupCORS($contentType = 'application/json', $additionalHeaders = []) {
    header("Content-Type: {$contentType}; charset=UTF-8");
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Domain, X-Unidade');

    // Headers adicionais (ex: Content-Disposition para downloads)
    foreach ($additionalHeaders as $header) {
        header($header);
    }
}

/**
 * Tratar requisição OPTIONS (CORS preflight)
 */
function handleOptionsRequest() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}

/**
 * Validar método HTTP da requisição
 * @param string|array $allowedMethods Métodos permitidos ('POST', 'GET', ou ['POST', 'GET'])
 */
function validateRequestMethod($allowedMethods) {
    if (!is_array($allowedMethods)) {
        $allowedMethods = [$allowedMethods];
    }

    if (!in_array($_SERVER['REQUEST_METHOD'], $allowedMethods)) {
        returnError('Método não permitido', 405);
    }
}

/**
 * Obter input JSON da requisição
 * @return array Input decodificado
 */
function getRequestInput() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

/**
 * Autenticar requisição e retornar usuário
 * Wrapper simplificado que integra com o middleware/auth.php
 * @return array ['user' => [...], 'domain' => '...']
 */
function authenticateAndGetUser() {
    require_once __DIR__ . '/middleware/auth.php';

    $authResult = authenticateRequest();
    if (!$authResult['success']) {
        returnError($authResult['message'], 401);
    }

    return [
        'user' => $authResult['user'],
        'domain' => $authResult['user']['domain']
    ];
}

/**
 * Verificar se usuário é super admin (presto)
 * @param array $user Dados do usuário
 * @param string $message Mensagem a exibir se não for super admin (opcional)
 */
function requireSuperAdmin($user, $message = 'Funcionalidade em desenvolvimento.') {
    if (strtolower($user['username']) !== 'presto') {
        msg($message, 'info');
    }
}

// ============================================
// FUNÇÕES DE TRATAMENTO DE PERÍODOS
// ============================================

/**
 * Processar período da requisição
 * Converte o período recebido do frontend em um objeto padronizado
 *
 * Suporta DOIS formatos:
 *
 * FORMATO 1 (antigo): ['year' => 2024, 'month' => 3] ou ['year' => 2024]
 * FORMATO 2 (novo): ['type' => 'custom', 'startDate' => '2025-01-01', 'endDate' => '2025-12-31']
 *
 * @param array $period Período do frontend
 * @return array ['year' => int, 'month' => int|null, 'startDate' => string|null, 'endDate' => string|null, 'type' => string, 'year_str' => '2024', 'month_str' => '03', 'period_str' => '2024_03' ou '2024']
 */
function processPeriod($period) {
    if (empty($period)) {
        returnError('Período inválido', 400);
    }

    // ============================================
    // FORMATO NOVO: type="custom" com startDate e endDate
    // ============================================
    if (isset($period['type']) && $period['type'] === 'custom') {
        if (!isset($period['startDate']) || !isset($period['endDate'])) {
            returnError('Período customizado requer startDate e endDate', 400);
        }

        $startDate = $period['startDate'];
        $endDate = $period['endDate'];

        // Validar formato das datas (YYYY-MM-DD)
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            returnError('Formato de data inválido. Use YYYY-MM-DD', 400);
        }

        // Extrair year e month do startDate para compatibilidade
        $startParts = explode('-', $startDate);
        $year = (int)$startParts[0];
        $month = null; // Null para períodos customizados (pode abranger múltiplos meses)

        // Validar ano
        if ($year < 2000 || $year > 2100) {
            returnError('Ano inválido', 400);
        }

        return [
            'type' => 'custom',
            'startDate' => $startDate,
            'endDate' => $endDate,
            'year' => $year,
            'month' => $month,
            'year_str' => sprintf('%04d', $year),
            'month_str' => null,
            'period_str' => sprintf('%s_to_%s', str_replace('-', '', $startDate), str_replace('-', '', $endDate)),
            'is_monthly' => false,
            'is_yearly' => false,
            'is_custom' => true
        ];
    }

    // ============================================
    // FORMATO ANTIGO: year + month (opcional)
    // ============================================
    if (!isset($period['year'])) {
        returnError('Período inválido: year é obrigatório', 400);
    }

    $year = (int)$period['year'];
    $month = isset($period['month']) ? (int)$period['month'] : null;

    // Validar ano (entre 2000 e 2100)
    if ($year < 2000 || $year > 2100) {
        returnError('Ano inválido', 400);
    }

    // Validar mês se fornecido
    if ($month !== null && ($month < 1 || $month > 12)) {
        returnError('Mês inválido', 400);
    }

    // Calcular startDate e endDate para compatibilidade
    $startDate = null;
    $endDate = null;
    if ($month !== null) {
        // Período mensal
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $lastDay = date('t', strtotime($startDate)); // último dia do mês
        $endDate = sprintf('%04d-%02d-%02d', $year, $month, $lastDay);
    } else {
        // Período anual
        $startDate = sprintf('%04d-01-01', $year);
        $endDate = sprintf('%04d-12-31', $year);
    }

    return [
        'type' => $month !== null ? 'monthly' : 'yearly',
        'startDate' => $startDate,
        'endDate' => $endDate,
        'year' => $year,
        'month' => $month,
        'year_str' => sprintf('%04d', $year),
        'month_str' => $month ? sprintf('%02d', $month) : null,
        'period_str' => $month ? sprintf('%04d_%02d', $year, $month) : sprintf('%04d', $year),
        'is_monthly' => $month !== null,
        'is_yearly' => $month === null,
        'is_custom' => false
    ];
}

/**
 * Adicionar filtro de período à query SQL
 * Adiciona cláusulas WHERE para filtrar por ano e/ou mês OU por startDate/endDate
 *
 * @param string $sql Query SQL atual
 * @param array $params Parâmetros atuais da query
 * @param array $period Período processado (de processPeriod())
 * @param string $dateColumn Nome da coluna de data (padrão: 'data_competencia')
 * @return array ['sql' => string, 'params' => array]
 */
function addPeriodFilter($sql, $params, $period, $dateColumn = 'data_competencia') {
    $paramIndex = count($params) + 1;

    // Se for período customizado, usar startDate e endDate
    if (isset($period['is_custom']) && $period['is_custom']) {
        $sql .= " AND {$dateColumn} >= \${$paramIndex}";
        $params[] = $period['startDate'];
        $paramIndex++;

        $sql .= " AND {$dateColumn} <= \${$paramIndex}";
        $params[] = $period['endDate'];

        return ['sql' => $sql, 'params' => $params];
    }

    // Período antigo: filtro por ano e mês
    $sql .= " AND EXTRACT(YEAR FROM {$dateColumn}) = \${$paramIndex}";
    $params[] = $period['year'];
    $paramIndex++;

    // Filtro de mês (se fornecido)
    if ($period['month'] !== null) {
        $sql .= " AND EXTRACT(MONTH FROM {$dateColumn}) = \${$paramIndex}";
        $params[] = $period['month'];
    }

    return ['sql' => $sql, 'params' => $params];
}

/**
 * Adicionar filtro de modalidade à query SQL
 * Adiciona cláusula WHERE para filtrar por modalidade (se não for GERAL)
 *
 * @param string $sql Query SQL atual
 * @param array $params Parâmetros atuais da query
 * @param string $viewMode Modo de visualização ('GERAL', 'CARGAS', 'PASSAGEIROS')
 * @param string $modalidadeColumn Nome da coluna de modalidade (padrão: 'modalidade')
 * @return array ['sql' => string, 'params' => array]
 */
function addModalidadeFilter($sql, $params, $viewMode, $modalidadeColumn = 'modalidade') {
    if ($viewMode !== 'GERAL') {
        $paramIndex = count($params) + 1;
        $sql .= " AND {$modalidadeColumn} = \${$paramIndex}";
        $params[] = $viewMode;
    }

    return ['sql' => $sql, 'params' => $params];
}

// ============================================
// FUNÇÕES DE EXPORTAÇÃO CSV
// ============================================

/**
 * Inicializar exportação CSV
 * Configura headers e cria arquivo temporário
 *
 * @param string $filename Nome do arquivo para download
 * @return array ['fp' => resource, 'filename' => string] File pointer e caminho do arquivo temporário
 */
function initCSVExport($filename) {
    // Criar arquivo temporário único
    $tempFilename = '/tmp/export_' . time() . '_' . uniqid() . '.csv';
    $fp = fopen($tempFilename, 'w');

    if (!$fp) {
        returnError('Não foi possível criar arquivo temporário', 500);
    }

    // BOM para UTF-8 (importante para Excel abrir corretamente)
    fprintf($fp, chr(0xEF).chr(0xBB).chr(0xBF));

    // Configurar headers para download
    header("Content-Type: text/csv; charset=UTF-8");
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Expose-Headers: Content-Disposition');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Pragma: no-cache');
    header('Expires: 0');

    // Retornar AMBOS: file pointer e filename
    return ['fp' => $fp, 'filename' => $tempFilename];
}

/**
 * Escrever linha no CSV
 * @param array $csv Array retornado por initCSVExport() ['fp' => resource, 'filename' => string]
 * @param array $row Dados da linha
 * @param string $delimiter Delimitador (padrão: ';')
 */
function writeCSVRow($csv, $row, $delimiter = ';') {
    fputcsv($csv['fp'], $row, $delimiter);
}

/**
 * Finalizar exportação CSV
 * Fecha o arquivo, envia para o navegador e limpa
 * @param array $csv Array retornado por initCSVExport() ['fp' => resource, 'filename' => string]
 */
function finishCSVExport($csv) {
    // Fechar o file pointer
    fclose($csv['fp']);

    // Adicionar Content-Length (opcional mas recomendado)
    header('Content-Length: ' . filesize($csv['filename']));

    // Enviar o arquivo para o navegador
    readfile($csv['filename']);

    // Limpar arquivo temporário
    unlink($csv['filename']);

    exit();
}

 function fmtdec ($vlr, $cas) {return number_format ($vlr, $cas, ',', '.');}

// ============================================
// SISTEMA DE PERGUNTAS INTERATIVAS
// ============================================

/**
 * Fazer uma pergunta interativa ao usuário
 * 
 * @param string $question Pergunta a ser feita ao usuário
 * @param string $type Tipo de input: 'text', 'textarea', 'confirm', 'number', 'select' (padrão: 'text')
 * @param string $questionId ID único da pergunta para manter contexto (opcional, gerado automaticamente)
 * @param mixed $defaultValue Valor padrão para o input (opcional)
 * @param array $options Opções adicionais (ex: ['options' => [...]] para tipo 'select')
 * @return mixed Resposta do usuário (string para text/textarea, boolean para confirm, number para number)
 */
function ask($question, $type = 'text', $questionId = null, $defaultValue = null, $options = []) {
    // Gerar ID único da pergunta se não fornecido
    if ($questionId === null) {
        $questionId = 'q_' . md5($question . microtime(true));
    }
    
    // Verificar se já existe resposta para esta pergunta
    $input = getRequestInput();
    
    // ✅ VERIFICAR SE O USUÁRIO CANCELOU (enviou _answers vazio)
    if (isset($input['_answers']) && empty($input['_answers'])) {
        error_log("❌ [ask()] Usuário cancelou o dialog - _answers está vazio");
        return null; // Retornar null para indicar cancelamento
    }
    
    if (isset($input['_answers']) && isset($input['_answers'][$questionId])) {
        $answer = $input['_answers'][$questionId];
        
        // Converter tipos
        if ($type === 'confirm') {
            return filter_var($answer, FILTER_VALIDATE_BOOLEAN);
        } elseif ($type === 'number') {
            return is_numeric($answer) ? (float)$answer : 0;
        } else {
            return $answer;
        }
    }
    
    // Montar objeto da pergunta
    $questionData = [
        'id' => $questionId,
        'text' => $question,
        'type' => $type,
        'defaultValue' => $defaultValue
    ];
    
    // Adicionar opções se existirem (para tipo 'select')
    if (!empty($options)) {
        $questionData = array_merge($questionData, $options);
    }
    
    // Se não existe resposta, enviar pergunta ao frontend
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'needsInput' => true,
        'question' => $questionData,
        // Preservar o contexto da requisição original para reenviar
        'originalRequest' => [
            'method' => $_SERVER['REQUEST_METHOD'],
            'url' => $_SERVER['REQUEST_URI'],
            'body' => $input
        ]
    ]);
    exit;
}

/**
 * Fazer múltiplas perguntas de uma vez
 * 
 * USO:
 * $respostas = askMultiple([
 *     ['id' => 'nome', 'question' => 'Nome:', 'type' => 'text'],
 *     ['id' => 'idade', 'question' => 'Idade:', 'type' => 'number'],
 *     ['id' => 'confirma', 'question' => 'Confirma?', 'type' => 'confirm']
 * ]);
 * 
 * @param array $questions Array de perguntas com estrutura: ['id' => string, 'question' => string, 'type' => string, 'defaultValue' => mixed]
 * @return array Respostas indexadas por ID
 */
function askMultiple($questions) {
    $input = getRequestInput();
    $allAnswered = true;
    $answers = [];
    
    // Verificar se todas as perguntas foram respondidas
    foreach ($questions as $q) {
        $questionId = $q['id'];
        
        if (isset($input['_answers']) && isset($input['_answers'][$questionId])) {
            $answer = $input['_answers'][$questionId];
            
            // Converter tipos
            $type = $q['type'] ?? 'text';
            if ($type === 'confirm') {
                $answers[$questionId] = filter_var($answer, FILTER_VALIDATE_BOOLEAN);
            } elseif ($type === 'number') {
                $answers[$questionId] = is_numeric($answer) ? (float)$answer : 0;
            } else {
                $answers[$questionId] = $answer;
            }
        } else {
            $allAnswered = false;
            break;
        }
    }
    
    // Se todas foram respondidas, retornar respostas
    if ($allAnswered) {
        return $answers;
    }
    
    // Caso contrário, enviar todas as perguntas de uma vez
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'needsInput' => true,
        'questions' => $questions, // Múltiplas perguntas
        'originalRequest' => [
            'method' => $_SERVER['REQUEST_METHOD'],
            'url' => $_SERVER['REQUEST_URI'],
            'body' => $input
        ]
    ]);
    exit;
}

            // Conversao de data no formato DDMMYY
  function strtodate ($str, $limit = 54)
  {
    $ano = substr ($str, 4, 2);

    if (((int) $ano) > $limit)
      $ano = '19' . $ano;
    else
      $ano = '20' . $ano;

    $dia = substr ($str, 0, 2);
    $mes = substr ($str, 2, 2);

    $data = "$ano-$mes-$dia";

    return strtotime ($data);
//    return strtotime (substr ($str, 2, 2) . '/' .
//                      substr ($str, 0, 2) . '/' . $ano);
  }

 function strtofloat ($str) {
    $str = str_replace (".","", $str);
    $str = str_replace (",",".",$str);
    return floatval ($str);
  }

  function util ($data)
  {
    global $g_sis;
    global $g_sql;

    if (date('N',$data) == 6) return false;
    if (date('N',$data) == 7) return false;

    return true;
  }