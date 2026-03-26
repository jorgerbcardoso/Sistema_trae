<?php
/**
 * ============================================
 * API - VERIFICAR TOKEN
 * ============================================
 * 
 * Endpoint para verificar se um token ainda é válido
 * Retorna dados do usuário e configurações do cliente
 */

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

try {
    // Buscar token do header
    $token = getTokenFromHeader();
    
    if (!$token) {
        throw new Exception('Token não fornecido');
    }
    
    // Verificar se banco está configurado
    if (!isDatabaseConfigured()) {
        throw new Exception('Banco de dados não configurado');
    }
    
    $conn = getDBConnection();
    
    try {
        // Buscar sessão ativa
        $stmt = pg_prepare($conn, "verify_token",
            "SELECT s.user_id, s.domain, s.expires_at, s.last_activity,
                    u.username, u.email, u.full_name, u.is_admin, u.unidade, u.troca_unidade, u.nro_setor, u.unidades,
                    d.id as domain_id, d.name as domain_name, d.modalidade, d.controla_linhas, d.favicon_url
             FROM sessions s
             INNER JOIN users u ON s.user_id = u.id
             INNER JOIN domains d ON s.domain = d.domain
             WHERE s.token = $1 
               AND s.expires_at > CURRENT_TIMESTAMP
               AND u.is_active = TRUE
               AND d.is_active = TRUE
             LIMIT 1");
        
        if (!$stmt) {
            throw new Exception('Erro ao preparar query: ' . pg_last_error($conn));
        }
        
        $result = pg_execute($conn, "verify_token", [$token]);
        
        if (!$result) {
            throw new Exception('Erro ao executar query: ' . pg_last_error($conn));
        }
        
        if (pg_num_rows($result) === 0) {
            pg_free_result($result);
            throw new Exception('Token inválido ou expirado');
        }
        
        $data = pg_fetch_assoc($result);
        pg_free_result($result);
        
        // ✅ VERIFICAR INATIVIDADE (2 HORAS = 7200 SEGUNDOS)
        $lastActivity = strtotime($data['last_activity']);
        $now = time();
        $inactivitySeconds = $now - $lastActivity;
        $maxInactivitySeconds = 2 * 60 * 60; // 2 horas
        
        if ($inactivitySeconds > $maxInactivitySeconds) {
            // Sessão expirada por inatividade - deletar
            pg_query($conn, "DELETE FROM sessions WHERE token = '" . pg_escape_string($conn, $token) . "'");
            throw new Exception('Sessão expirada por inatividade');
        }
        
        // Atualizar last_activity da sessão
        pg_query($conn, "UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE token = '" . pg_escape_string($conn, $token) . "'");
        
        // Retornar dados do usuário e configurações
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'id' => (int)$data['user_id'],
                'username' => $data['username'],
                'email' => $data['email'],
                'full_name' => $data['full_name'],
                'domain' => $data['domain'],
                'client_id' => (int)$data['domain_id'],
                'client_name' => $data['domain_name'],
                'is_admin' => pgBoolToPHP($data['is_admin']),
                'unidade' => $data['unidade'] ?? 'MTZ',
                'troca_unidade' => pgBoolToPHP($data['troca_unidade'] ?? false),
                'nro_setor' => $data['nro_setor'] ? (int)$data['nro_setor'] : null,
                'unidades' => $data['unidades'] ?? '',
                'is_presto' => strtolower($data['username']) === 'presto'
            ],
            'client_config' => [
                'modalidade' => $data['modalidade'] ?? 'CARGAS',
                'controla_linhas' => pgBoolToPHP($data['controla_linhas'] ?? false),
                'favicon_url' => $data['favicon_url'] ?? ''  // ✨ NOVO: Favicon do cliente do banco
            ]
        ]);
        
    } finally {
        closeDBConnection($conn);
    }
    
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        'authenticated' => false,
        'error' => $e->getMessage()
    ]);
}
?>