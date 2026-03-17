<?php
/**
 * ================================================================
 * API - VALIDAR TOKEN DE APROVAÇÃO
 * ================================================================
 * Valida se o token de aprovação de orçamento é válido e se o
 * usuário logado tem permissão para aprovar
 *
 * FLUXO DE SEGURANÇA:
 * 1. Verifica se usuário está autenticado (via token de sessão)
 * 2. Valida se token de aprovação existe e não expirou
 * 3. Valida se usuário logado é o aprovador correto
 * 4. Valida se solicitação ainda está PENDENTE
 *
 * Métodos: POST
 */

require_once __DIR__ . '/../config.php';

// ✅ CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

try {
    // ✅ VERIFICAR AUTENTICAÇÃO
    $session_token = getTokenFromHeader();
    
    if (!$session_token) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Usuário não autenticado. Faça login primeiro.'
        ]);
        exit;
    }

    // Conectar ao banco
    $conn = getDBConnection();

    // Buscar usuário da sessão
    $query_session = "SELECT user_id, domain FROM sessions 
                      WHERE token = $1 
                      AND expires_at > NOW()
                      LIMIT 1";
    
    $result_session = pg_query_params($conn, $query_session, array($session_token));
    
    if (!$result_session || pg_num_rows($result_session) === 0) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Sessão inválida ou expirada. Faça login novamente.'
        ]);
        closeDBConnection($conn);
        exit;
    }

    $session = pg_fetch_assoc($result_session);
    $user_id = (int)$session['user_id'];
    $user_domain = $session['domain'];

    // ✅ RECEBER DADOS DA REQUEST
    $data = json_decode(file_get_contents('php://input'), true);

    $token_acesso = $data['token_acesso'] ?? null;
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    $domain = $data['domain'] ?? null;
    
    error_log("🔍 [VALIDAR-TOKEN] Recebido - Token: " . ($token_acesso ? substr($token_acesso, 0, 10) . '...' : 'null'));
    error_log("🔍 [VALIDAR-TOKEN] Recebido - Orcamento: " . $seq_orcamento);
    error_log("🔍 [VALIDAR-TOKEN] Recebido - Domain: " . $domain);
    error_log("🔍 [VALIDAR-TOKEN] User ID: " . $user_id . " - Domain: " . $user_domain);

    if (!$token_acesso || !$seq_orcamento || !$domain) {
        error_log("❌ [VALIDAR-TOKEN] Parâmetros incompletos!");
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Parâmetros incompletos'
        ]);
        closeDBConnection($conn);
        exit;
    }

    // ✅ VALIDAR SE O DOMÍNIO DO USUÁRIO BATE COM O DOMÍNIO DA SOLICITAÇÃO
    if (strtoupper($user_domain) !== strtoupper($domain)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Você não tem permissão para acessar este orçamento (domínio diferente)'
        ]);
        closeDBConnection($conn);
        exit;
    }

    // ✅ BUSCAR SOLICITAÇÃO DE APROVAÇÃO
    $tabela_solicitacao = strtolower($domain) . '_orcamento_solicitacao_aprovacao';

    $query_solicitacao = "SELECT 
                            seq_solicitacao,
                            seq_orcamento,
                            usuario_aprovador_id,
                            token_acesso,
                            token_validade,
                            status,
                            data_solicitacao,
                            hora_solicitacao
                          FROM {$tabela_solicitacao}
                          WHERE token_acesso = $1
                          AND seq_orcamento = $2";

    $result_solicitacao = pg_query_params($conn, $query_solicitacao, array(
        $token_acesso,
        $seq_orcamento
    ));

    if (!$result_solicitacao || pg_num_rows($result_solicitacao) === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Solicitação de aprovação não encontrada'
        ]);
        closeDBConnection($conn);
        exit;
    }

    $solicitacao = pg_fetch_assoc($result_solicitacao);

    // ✅ VALIDAR SE TOKEN NÃO EXPIROU
    $token_validade = strtotime($solicitacao['token_validade']);
    $now = time();

    if ($now > $token_validade) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Este link de aprovação expirou. Solicite um novo link.'
        ]);
        closeDBConnection($conn);
        exit;
    }

    // ✅ VALIDAR SE SOLICITAÇÃO ESTÁ PENDENTE
    if ($solicitacao['status'] !== 'PENDENTE') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Esta solicitação já foi processada (status: ' . $solicitacao['status'] . ')'
        ]);
        closeDBConnection($conn);
        exit;
    }

    // ✅ VALIDAR SE USUÁRIO LOGADO É O APROVADOR CORRETO
    if ((int)$solicitacao['usuario_aprovador_id'] !== $user_id) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Você não é o aprovador designado para este orçamento'
        ]);
        closeDBConnection($conn);
        exit;
    }

    // ✅ BUSCAR DADOS DO USUÁRIO PARA VALIDAR PERMISSÃO
    $query_user = "SELECT aprova_orcamento FROM users WHERE id = $1 AND domain = $2";
    $result_user = pg_query_params($conn, $query_user, array($user_id, $domain));
    
    if ($result_user && pg_num_rows($result_user) > 0) {
        $user_data = pg_fetch_assoc($result_user);
        
        if ($user_data['aprova_orcamento'] !== 't') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Você não tem permissão para aprovar orçamentos'
            ]);
            closeDBConnection($conn);
            exit;
        }
    }

    // ✅ TUDO OK - TOKEN VÁLIDO E USUÁRIO AUTORIZADO
    echo json_encode([
        'success' => true,
        'message' => 'Token válido e usuário autorizado',
        'data' => [
            'seq_orcamento' => (int)$solicitacao['seq_orcamento'],
            'solicitado_em' => $solicitacao['data_solicitacao'] . ' ' . $solicitacao['hora_solicitacao'],
            'expira_em' => $solicitacao['token_validade']
        ]
    ]);

    closeDBConnection($conn);

} catch (Exception $e) {
    error_log("[VALIDAR-TOKEN-APROVACAO] Erro: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao validar token de aprovação: ' . $e->getMessage()
    ]);
    if (isset($conn)) {
        closeDBConnection($conn);
    }
}
?>