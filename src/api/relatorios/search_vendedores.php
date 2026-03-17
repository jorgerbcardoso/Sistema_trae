<?php
/**
 * API: Buscar Vendedores
 * 
 * Busca vendedores da tabela [dominio]_vendedor por login/nome
 * Retorna: { success: true, vendedores: [...] }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

// ================================================================
// AUTENTICAÇÃO
// ================================================================
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

$token = $matches[1];
$userData = validateToken($token);

if (!$userData) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado']);
    exit;
}

// ================================================================
// CONEXÃO COM BANCO
// ================================================================
global $g_sql;

if (!$g_sql) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao conectar ao banco de dados']);
    exit;
}

// ================================================================
// OBTER PARÂMETROS
// ================================================================
$input = json_decode(file_get_contents('php://input'), true);
$search = $input['search'] ?? '';
$userDomain = $userData['domain'] ?? '';

// ================================================================
// BUSCAR VENDEDORES
// ================================================================
try {
    $tableName = $userDomain . '_vendedor';
    
    // Verificar se a tabela existe
    $checkTable = "SELECT to_regclass('public.$tableName')";
    $result = sql($g_sql, $checkTable, false, []);
    
    if (!$result || pg_num_rows($result) === 0 || pg_fetch_result($result, 0, 0) === null) {
        // Tabela não existe - retornar array vazio
        echo json_encode([
            'success' => true,
            'vendedores' => []
        ]);
        exit;
    }
    
    // Construir query
    if (empty($search)) {
        // Buscar todos os vendedores ativos
        $query = "
            SELECT 
                login,
                nome
            FROM $tableName
            WHERE ativo = true
            ORDER BY login
            LIMIT 100
        ";
        $params = [];
    } else {
        // Buscar com filtro
        $searchUpper = strtoupper($search);
        $query = "
            SELECT 
                login,
                nome
            FROM $tableName
            WHERE ativo = true
              AND (
                UPPER(login) LIKE $1
                OR UPPER(nome) LIKE $1
              )
            ORDER BY login
            LIMIT 100
        ";
        $params = ["%$searchUpper%"];
    }
    
    $result = sql($g_sql, $query, false, $params);
    
    if (!$result) {
        throw new Exception('Erro ao buscar vendedores');
    }
    
    $vendedores = [];
    while ($row = pg_fetch_assoc($result)) {
        $vendedores[] = [
            'login' => $row['login'],
            'nome' => $row['nome']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'vendedores' => $vendedores
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar vendedores: ' . $e->getMessage()
    ]);
}
