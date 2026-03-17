<?php
/**
 * ============================================
 * 📋 PADRÃO OFICIAL PARA APIS PHP - SISTEMA PRESTO
 * ============================================
 * 
 * Este arquivo serve como TEMPLATE e REFERÊNCIA para todas as APIs PHP.
 * Copie este modelo ao criar novas APIs.
 * 
 * ✅ REGRAS OBRIGATÓRIAS:
 * 1. NUNCA use sql() para conectar - ela é para executar queries
 * 2. SEMPRE use global $g_sql (conexão global do config.php)
 * 3. SEMPRE use sql($g_sql, $query, false, $params) para queries
 * 4. SEMPRE use verifyAuth() do middleware/auth.php
 * 5. SEMPRE use msg() para erros (do config.php)
 * 6. SEMPRE faça log com error_log() para debug
 * 7. SEMPRE valide entrada de dados (trim, strtoupper para strings salvas)
 * 8. SEMPRE retorne JSON com success true/false
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// ✅ SEMPRE tratar OPTIONS para CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ✅ SEMPRE incluir config.php e auth.php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

try {
    // ============================================
    // 1️⃣ AUTENTICAÇÃO (OBRIGATÓRIO)
    // ============================================
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        msg('ERRO', $authResult['message']);
        exit();
    }

    $userDomain = $authResult['domain'];
    $userId = $authResult['user']['user_id'] ?? 0;
    $username = $authResult['user']['username'] ?? '';
    $isAdmin = $authResult['is_admin'] ?? false;

    // ✅ Se admin necessário, verificar aqui
    if (!$isAdmin) {
        http_response_code(403);
        msg('ERRO', 'ACESSO NEGADO. APENAS ADMINS PODEM ACESSAR.');
        exit();
    }

    // ============================================
    // 2️⃣ RECEBER E VALIDAR PARÂMETROS
    // ============================================
    // GET
    $paramGet = isset($_GET['param']) ? trim($_GET['param']) : '';
    
    // POST/PUT/DELETE
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    $paramPost = isset($data['param']) ? trim($data['param']) : '';
    
    // ✅ Strings que vão para banco: SEMPRE MAIÚSCULAS
    $paramPost = strtoupper($paramPost);

    // ✅ SEMPRE validar parâmetros obrigatórios
    if (empty($paramPost)) {
        http_response_code(400);
        msg('ERRO', 'PARÂMETRO OBRIGATÓRIO NÃO INFORMADO');
        exit();
    }

    // ============================================
    // 3️⃣ USAR CONEXÃO GLOBAL $g_sql (OBRIGATÓRIO)
    // ============================================
    global $g_sql;

    // ============================================
    // 4️⃣ EXECUTAR QUERIES COM sql() (OBRIGATÓRIO)
    // ============================================
    
    // ✅ SELECT com parâmetros
    $query = "SELECT * FROM tabela WHERE coluna = $1 AND domain = $2";
    $result = sql($g_sql, $query, false, [$paramPost, $userDomain]);
    
    if (!$result) {
        throw new Exception('Erro ao buscar dados: ' . pg_last_error($g_sql));
    }
    
    $rows = [];
    while ($row = pg_fetch_assoc($result)) {
        $rows[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'created_at' => $row['created_at']
        ];
    }
    pg_free_result($result);

    // ✅ INSERT com parâmetros
    $queryInsert = "INSERT INTO tabela (coluna1, coluna2, domain) VALUES ($1, $2, $3) RETURNING id";
    $resultInsert = sql($g_sql, $queryInsert, false, [$paramPost, 'valor2', $userDomain]);
    
    if (!$resultInsert) {
        throw new Exception('Erro ao inserir: ' . pg_last_error($g_sql));
    }
    
    $row = pg_fetch_assoc($resultInsert);
    $newId = (int)$row['id'];
    pg_free_result($resultInsert);

    // ✅ UPDATE com parâmetros
    $queryUpdate = "UPDATE tabela SET coluna = $1 WHERE id = $2 AND domain = $3";
    $resultUpdate = sql($g_sql, $queryUpdate, false, [$paramPost, $newId, $userDomain]);
    
    if (!$resultUpdate) {
        throw new Exception('Erro ao atualizar: ' . pg_last_error($g_sql));
    }

    // ✅ DELETE com parâmetros
    $queryDelete = "DELETE FROM tabela WHERE id = $1 AND domain = $2";
    $resultDelete = sql($g_sql, $queryDelete, false, [$newId, $userDomain]);
    
    if (!$resultDelete) {
        throw new Exception('Erro ao deletar: ' . pg_last_error($g_sql));
    }

    // ============================================
    // 5️⃣ LOG PARA DEBUG (OBRIGATÓRIO)
    // ============================================
    error_log('✅ [NOME_API] Operação realizada: param=' . $paramPost . ', user=' . $username . ', domain=' . $userDomain);

    // ============================================
    // 6️⃣ RETORNAR JSON (OBRIGATÓRIO)
    // ============================================
    echo json_encode([
        'success' => true,
        'data' => $rows,
        'message' => 'OPERAÇÃO REALIZADA COM SUCESSO'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    // ============================================
    // 7️⃣ TRATAMENTO DE ERRO (OBRIGATÓRIO)
    // ============================================
    error_log('❌ [NOME_API] ERRO: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * ============================================
 * 📚 RESUMO DOS PADRÕES:
 * ============================================
 * 
 * ✅ CONEXÃO:
 *    global $g_sql;  // ← Usar sempre
 * 
 * ✅ QUERIES:
 *    sql($g_sql, $query, false, $params);  // ← Sempre assim
 * 
 * ✅ AUTENTICAÇÃO:
 *    $authResult = verifyAuth();  // ← Sempre no início
 * 
 * ✅ ERROS:
 *    msg('ERRO', 'Mensagem');  // ← Para erros de validação
 *    throw new Exception('...');  // ← Para erros de sistema
 * 
 * ✅ STRINGS:
 *    strtoupper(trim($value));  // ← Para valores salvos no banco
 * 
 * ✅ LOG:
 *    error_log('✅ [API] ...');  // ← Para debug
 * 
 * ============================================
 * ❌ NUNCA FAÇA:
 * ============================================
 * 
 * ❌ $conn = sql();  // ← ERRADO! sql() não é para conectar
 * ❌ $conn = connect();  // ← ERRADO! Use global $g_sql
 * ❌ pg_query($conn, ...);  // ← ERRADO! Use sql()
 * ❌ pg_prepare/pg_execute direto  // ← ERRADO! Use sql()
 * 
 * ============================================
 */
?>
