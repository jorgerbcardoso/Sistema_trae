<?php
/**
 * API: Validar Token de Acesso ao Pedido
 * Descrição: Valida token de acesso direto enviado por email para aprovação de pedido
 * Métodos: POST
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
$prefix = $dominio . '_';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        validarTokenPedido($g_sql, $prefix, $data, $username, $dominio);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Erro interno: ' . $e->getMessage()
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

/**
 * Validar token de acesso ao pedido
 */
function validarTokenPedido($g_sql, $prefix, $data, $username, $dominio) {
    $token_acesso = $data['token_acesso'] ?? null;
    $seq_pedido = $data['seq_pedido'] ?? null;
    $domain = $data['domain'] ?? null;
    
    if (!$token_acesso) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Token não informado']);
        return;
    }
    
    if (!$seq_pedido) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Pedido não informado']);
        return;
    }
    
    if (!$domain) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Domínio não informado']);
        return;
    }
    
    // ✅ VERIFICAR SE DOMÍNIO DO TOKEN BATE COM DOMÍNIO DO USUÁRIO LOGADO
    if (strtoupper($domain) !== strtoupper($dominio)) {
        http_response_code(403);
        echo json_encode([
            'success' => false, 
            'message' => 'Você não tem permissão para acessar este pedido. Domínio incorreto.'
        ]);
        return;
    }
    
    $tabela_solicitacao = $prefix . 'pedido_solicitacao_aprovacao';
    
    // Verificar se token existe e está válido
    $query = "SELECT s.*, p.status AS pedido_status, p.nro_pedido, p.unidade
              FROM {$tabela_solicitacao} s
              INNER JOIN {$prefix}pedido p ON p.seq_pedido = s.seq_pedido
              WHERE s.token_acesso = $1 
              AND s.seq_pedido = $2
              AND s.status = 'PENDENTE'
              AND s.token_validade >= NOW()";
    
    $result = sql($query, [$token_acesso, $seq_pedido], $g_sql);
    
    if (pg_num_rows($result) === 0) {
        // Verificar se token existe mas expirou
        $query_expired = "SELECT token_validade FROM {$tabela_solicitacao} 
                          WHERE token_acesso = $1 AND seq_pedido = $2";
        $result_expired = sql($query_expired, [$token_acesso, $seq_pedido], $g_sql);
        
        if (pg_num_rows($result_expired) > 0) {
            $row = pg_fetch_assoc($result_expired);
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Este link de aprovação expirou em ' . date('d/m/Y H:i', strtotime($row['token_validade']))
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Link de aprovação inválido ou já foi utilizado'
            ]);
        }
        return;
    }
    
    $solicitacao = pg_fetch_assoc($result);
    
    // ✅ VERIFICAR SE USUÁRIO LOGADO É O APROVADOR DESIGNADO
    $query_aprovador = "SELECT id, username, full_name, aprova_orcamento 
                        FROM users 
                        WHERE id = $1 AND domain = $2";
    $result_aprovador = sql($query_aprovador, [$solicitacao['usuario_aprovador_id'], strtoupper($dominio)], $g_sql);
    
    if (pg_num_rows($result_aprovador) === 0) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Usuário aprovador não encontrado'
        ]);
        return;
    }
    
    $aprovador = pg_fetch_assoc($result_aprovador);
    
    // ✅ VERIFICAR SE USUÁRIO LOGADO É O APROVADOR
    if (strtolower($aprovador['username']) !== strtolower($username)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Você não tem permissão para aprovar este pedido. Este link foi enviado para ' . $aprovador['full_name']
        ]);
        return;
    }
    
    // ✅ VERIFICAR SE USUÁRIO TEM PERMISSÃO DE APROVAÇÃO
    if ($aprovador['aprova_orcamento'] !== 't') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Você não tem permissão para aprovar pedidos'
        ]);
        return;
    }
    
    // ✅ TOKEN VÁLIDO! Retornar sucesso
    $nro_pedido_formatado = $solicitacao['unidade'] . str_pad($solicitacao['nro_pedido'], 7, '0', STR_PAD_LEFT);
    
    echo json_encode([
        'success' => true,
        'message' => 'Token válido! Redirecionando para detalhes do pedido...',
        'data' => [
            'seq_pedido' => intval($seq_pedido),
            'nro_pedido_formatado' => $nro_pedido_formatado,
            'status' => $solicitacao['pedido_status']
        ]
    ]);
}
