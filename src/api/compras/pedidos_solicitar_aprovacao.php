<?php
/**
 * API: Solicitar Aprovação de Pedido Manual
 * Descrição: Registra solicitação de aprovação e envia email para o aprovador
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
        solicitarAprovacaoPedido($g_sql, $prefix, $data, $username, $dominio);
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
 * Solicitar aprovação de pedido
 */
function solicitarAprovacaoPedido($g_sql, $prefix, $data, $username, $dominio) {
    $seq_pedido = $data['seq_pedido'] ?? null;
    $usuario_aprovador_id = $data['usuario_aprovador_id'] ?? null;
    
    if (!$seq_pedido) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Pedido não informado']);
        return;
    }
    
    if (!$usuario_aprovador_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Usuário aprovador não informado']);
        return;
    }
    
    $tabela_pedido = $prefix . 'pedido';
    
    // Verificar se pedido existe e está com status 'A' (aguardando aprovação)
    $query_pedido = "SELECT p.*, f.nome AS fornecedor_nome, f.email AS fornecedor_email
                     FROM {$tabela_pedido} p
                     LEFT JOIN {$prefix}fornecedor f ON f.seq_fornecedor = p.seq_fornecedor
                     WHERE p.seq_pedido = $1";
    $result_pedido = sql($g_sql, $query_pedido, false, array($seq_pedido));
    
    if (pg_num_rows($result_pedido) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Pedido não encontrado']);
        return;
    }
    
    $pedido = pg_fetch_assoc($result_pedido);
    
    // Verificar se pedido está aguardando aprovação
    if ($pedido['status'] !== 'A') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Apenas pedidos com status AGUARDANDO APROVAÇÃO podem ter aprovação solicitada'
        ]);
        return;
    }
    
    // Buscar dados do usuário aprovador
    $query_aprovador = "SELECT id, username, full_name, email, aprova_orcamento
                        FROM users
                        WHERE id = $1 AND domain = $2";
    $result_aprovador = sql($g_sql, $query_aprovador, false, array($usuario_aprovador_id, strtoupper($dominio)));
    
    if (pg_num_rows($result_aprovador) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Usuário aprovador não encontrado']);
        return;
    }
    
    $aprovador = pg_fetch_assoc($result_aprovador);
    
    // Verificar se usuário tem permissão de aprovação
    if (!pgBoolToPHP($aprovador['aprova_orcamento'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Usuário selecionado não tem permissão para aprovar pedidos'
        ]);
        return;
    }
    
    // Buscar dados do solicitante
    $query_solicitante = "SELECT full_name, email FROM users WHERE username = $1 AND domain = $2";
    $result_solicitante = sql($g_sql, $query_solicitante, false, array($username, strtoupper($dominio)));
    $solicitante = pg_fetch_assoc($result_solicitante);
    
    // ✅ GERAR TOKEN DE ACESSO DIRETO (válido por 7 dias)
    $token_acesso = bin2hex(random_bytes(32));
    $validade = date('Y-m-d H:i:s', strtotime('+7 days'));
    
    // ✅ REGISTRAR SOLICITAÇÃO
    $tabela_solicitacao = $prefix . 'pedido_solicitacao_aprovacao';
    
    // Criar tabela se não existir
    $query_create_table = "CREATE TABLE IF NOT EXISTS {$tabela_solicitacao} (
        seq_solicitacao SERIAL PRIMARY KEY,
        seq_pedido INTEGER NOT NULL,
        usuario_solicitante VARCHAR(50) NOT NULL,
        usuario_aprovador_id INTEGER NOT NULL,
        data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
        hora_solicitacao TIME NOT NULL DEFAULT CURRENT_TIME,
        token_acesso VARCHAR(100) UNIQUE NOT NULL,
        token_validade TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDENTE',
        data_resposta DATE,
        hora_resposta TIME
    )";
    sql($g_sql, $query_create_table, false, array());
    
    $query_insert = "INSERT INTO {$tabela_solicitacao} 
                     (seq_pedido, usuario_solicitante, usuario_aprovador_id, token_acesso, token_validade)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING seq_solicitacao";
    
    $result_insert = sql($g_sql, $query_insert, false, array(
        $seq_pedido,
        $username,
        $usuario_aprovador_id,
        $token_acesso,
        $validade
    ));
    
    $solicitacao = pg_fetch_assoc($result_insert);
    
    // ✅ ENVIAR EMAIL usando EmailService
    require_once __DIR__ . '/../services/EmailService.php';
    $emailService = new EmailService();
    
    // Formatar número do pedido
    $nro_pedido_formatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
    
    $resultado_email = $emailService->sendSolicitacaoAprovacaoPedido(
        $aprovador['email'],
        $aprovador['full_name'],
        $solicitante['full_name'] ?? $username,
        $nro_pedido_formatado,
        $pedido['unidade'],
        date('d/m/Y', strtotime($pedido['data_inclusao'])),
        floatval($pedido['vlr_total']),
        $pedido['fornecedor_nome'],
        $token_acesso,
        $seq_pedido,
        strtoupper($dominio),
        $username
    );
    
    // ✅ LOG PARA DEBUG
    error_log("📧 [SOLICITACAO-APROVACAO-PEDIDO] Email enviado para: " . $aprovador['email']);
    error_log("📧 [SOLICITACAO-APROVACAO-PEDIDO] Resultado: " . ($resultado_email['success'] ? 'SUCESSO' : 'FALHA - ' . ($resultado_email['message'] ?? 'sem mensagem')));
    
    if (!$resultado_email['success']) {
        // Email falhou mas solicitação foi registrada
        echo json_encode([
            'success' => true,
            'warning' => true,
            'message' => 'Solicitação registrada, mas houve erro ao enviar email: ' . $resultado_email['message'],
            'toast' => array(
                'type' => 'warning',
                'message' => 'Solicitação registrada! Porém, o email não pôde ser enviado. Entre em contato manualmente com o aprovador.'
            )
        ]);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Solicitação de aprovação enviada com sucesso!',
        'toast' => array(
            'type' => 'success',
            'message' => "Email enviado para {$aprovador['full_name']} ({$aprovador['email']})"
        )
    ]);
}
