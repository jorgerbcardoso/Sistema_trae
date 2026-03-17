<?php
/**
 * ============================================
 * API - LOGOUT (VERSÃO TEMPORÁRIA COM MOCK)
 * ============================================
 * Endpoint: POST /api/auth/logout.php
 * 
 * ⚠️ TEMPORÁRIO: Apenas retorna sucesso
 */

require_once '../config.php';

// Apenas POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

try {
    // Obter token do header (opcional)
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    // ========================================
    // MOCK: Apenas retornar sucesso
    // Em produção, invalidar token no banco
    // ========================================
    
    echo json_encode([
        'success' => true,
        'message' => 'Logout realizado com sucesso'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
