<?php
/**
 * ================================================================
 * 🔒 BLOQUEIO DE AUTO-LOGIN INSEGURO
 * ================================================================
 * 
 * Este arquivo DEVE ser incluído no início de TODOS os endpoints
 * que não sejam de autenticação manual.
 * 
 * Ele IMPEDE que qualquer código faça auto-login usando apenas
 * um token da URL.
 * 
 * ================================================================
 */

// ❌ SE EXISTIR TOKEN NA URL E NÃO HÁ SESSÃO ATIVA → BLOQUEAR!
if (isset($_GET['token']) && !isset($_SESSION['user_id'])) {
    
    // Log de tentativa de acesso inseguro
    error_log("🚨 BLOQUEIO DE SEGURANÇA: Tentativa de auto-login com token na URL!");
    error_log("   → IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'desconhecido'));
    error_log("   → URL: " . ($_SERVER['REQUEST_URI'] ?? 'desconhecida'));
    error_log("   → Token: " . substr($_GET['token'], 0, 20) . "...");
    
    // ❌ BLOQUEAR ACESSO
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Acesso negado. Faça login para continuar.',
        'error' => 'SECURITY_BLOCK_AUTO_LOGIN'
    ]);
    exit;
}
