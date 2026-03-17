<?php
/**
 * API: Listar Usuários Aprovadores
 * Descrição: Retorna lista de usuários com permissão para aprovar orçamentos
 * Métodos: GET
 */

require_once '/var/www/html/sistema/api/config.php';

// ✅ CRIAR CONEXÃO
$g_sql = connect();

// ✅ CORS
setupCORS();
handleOptionsRequest();

// ✅ AUTENTICAÇÃO
requireAuth();
$currentUser = getCurrentUser();

$username = $currentUser['username'];
$dominio = strtolower($currentUser['domain']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    listarUsuariosAprovadores($g_sql, $dominio);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

/**
 * Listar usuários aprovadores
 */
function listarUsuariosAprovadores($g_sql, $dominio) {
    // ✅ OBTER USUÁRIO LOGADO
    $currentUser = getCurrentUser();
    $currentUsername = strtolower($currentUser['username']);
    
    // Buscar usuários com aprova_orcamento = true e is_active = true
    $query = "SELECT 
                id,
                username,
                full_name,
                email
              FROM users
              WHERE domain = $1 
              AND aprova_orcamento = true 
              AND is_active = true
              ORDER BY full_name";
    
    $result = sql($g_sql, $query, false, array(strtoupper($dominio)));
    
    if (pg_num_rows($result) === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Nenhum usuário aprovador encontrado'
        ]);
        return;
    }
    
    $usuarios = array();
    
    while ($usuario = pg_fetch_assoc($result)) {
        $usernameAprovador = strtolower($usuario['username']);
        
        // ✅ REGRA: Usuário "presto" só aparece se o usuário logado também for "presto"
        if ($usernameAprovador === 'presto' && $currentUsername !== 'presto') {
            continue; // Pula este usuário
        }
        
        $usuarios[] = array(
            'id' => $usuario['id'],
            'username' => $usuario['username'],
            'full_name' => $usuario['full_name'],
            'email' => $usuario['email']
        );
    }
    
    // ✅ CORRIGIDO: Retornar com chave 'data' ao invés de 'usuarios'
    echo json_encode([
        'success' => true,
        'data' => $usuarios
    ]);
}