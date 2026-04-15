<?php
/**
 * ================================================================
 * API: APROVAR PEDIDO MANUAL
 * ================================================================
 * 
 * Aprova um pedido que estava aguardando aprovação:
 * 1. Valida se pedido existe e está com status 'A' (Aguardando)
 * 2. Atualiza status para 'P' (APROVADO)
 * 3. Registra quem aprovou e quando
 * 4. Envia email para o usuário que cadastrou o pedido
 * 
 * @method POST
 * @body {
 *   "seq_pedido": 123
 * }
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

// ✅ Verificar se usuário tem permissão de aprovação
if (!$currentUser['aprova_orcamento']) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Você não tem permissão para aprovar pedidos.'
    ]);
    exit;
}

try {
    // ✅ Receber dados
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['seq_pedido'])) {
        throw new Exception('Pedido não informado');
    }
    
    $seq_pedido = (int)$input['seq_pedido'];
    $usuario_aprovador = $username;
    
    $tabela_pedido = $prefix . 'pedido';
    $tabela_fornecedor = $prefix . 'fornecedor';
    
    // ✅ 1. Buscar dados do pedido
    $query_pedido = "
        SELECT 
            p.seq_pedido,
            p.nro_pedido,
            p.unidade,
            p.status,
            p.vlr_total,
            p.login_inclusao,
            p.data_inclusao,
            f.nome as fornecedor_nome,
            u.email as email_solicitante,
            u.full_name as nome_solicitante
        FROM {$tabela_pedido} p
        LEFT JOIN {$tabela_fornecedor} f ON p.seq_fornecedor = f.seq_fornecedor
        LEFT JOIN users u ON LOWER(u.username) = LOWER(p.login_inclusao)
        WHERE p.seq_pedido = $1 
    ";
    
    $result_pedido = sql($g_sql, $query_pedido, false, array($seq_pedido));
    
    if (pg_num_rows($result_pedido) === 0) {
        throw new Exception('Pedido não encontrado');
    }
    
    $pedido = pg_fetch_assoc($result_pedido);
    
    // ✅ 2. Validar se pedido está aguardando aprovação
    if ($pedido['status'] !== 'A') {
        $status_map = [
            'P' => 'APROVADO',
            'E' => 'ENTREGUE',
            'C' => 'CANCELADO',
            'F' => 'FINALIZADO'
        ];
        $status_atual = $status_map[$pedido['status']] ?? 'Desconhecido';
        
        throw new Exception("Pedido não pode ser aprovado. Status atual: $status_atual");
    }
    
    // ✅ 3. Aprovar pedido (atualizar APENAS o status para 'P' - APROVADO)
    $query_aprovar = "
        UPDATE {$tabela_pedido} 
        SET status = 'P'
        WHERE seq_pedido = $1 
    ";
    
    sql($g_sql, $query_aprovar, false, array($seq_pedido));
    
    // ✅ 4. Enviar email para o solicitante (opcional)
    $email_enviado = false;
    if (!empty($pedido['email_solicitante'])) {
        try {
            require_once __DIR__ . '/../services/EmailService.php';
            $emailService = new EmailService();
            
            $nro_pedido_formatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
            $valor_formatado = 'R$ ' . number_format($pedido['vlr_total'], 2, ',', '.');
            
            $assunto = "Pedido Aprovado - $nro_pedido_formatado";
            
            $corpo = "
                <h2 style='color: #059669;'>✅ Pedido Aprovado</h2>
                <p>Olá <strong>{$pedido['nome_solicitante']}</strong>,</p>
                <p>Seu pedido foi aprovado e está pronto para envio ao fornecedor!</p>
                <div style='background-color: #f0fdf4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;'>
                    <p style='margin: 5px 0;'><strong>Pedido:</strong> {$nro_pedido_formatado}</p>
                    <p style='margin: 5px 0;'><strong>Fornecedor:</strong> {$pedido['fornecedor_nome']}</p>
                    <p style='margin: 5px 0;'><strong>Valor Total:</strong> {$valor_formatado}</p>
                    <p style='margin: 5px 0;'><strong>Data de Solicitação:</strong> " . date('d/m/Y', strtotime($pedido['data_inclusao'])) . "</p>
                    <p style='margin: 5px 0;'><strong>Aprovado por:</strong> {$usuario_aprovador}</p>
                    <p style='margin: 5px 0;'><strong>Status:</strong> <span style='color: #059669;'>APROVADO - Pronto para envio</span></p>
                </div>
                <p>O pedido agora pode ser enviado ao fornecedor através do sistema.</p>
                <p style='margin-top: 30px; font-size: 12px; color: #6b7280;'>
                    Este é um email automático. Por favor, não responda.
                </p>
            ";
            
            $emailService->sendEmail(
                $pedido['email_solicitante'],
                $pedido['nome_solicitante'],
                $assunto,
                $corpo
            );
            $email_enviado = true;
        } catch (Exception $e) {
            error_log("Erro ao enviar email de aprovação: " . $e->getMessage());
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Pedido aprovado com sucesso',
        'data' => [
            'seq_pedido' => $seq_pedido,
            'status_atual' => 'P',
            'email_enviado' => $email_enviado
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($g_sql) && is_resource($g_sql)) {
        pg_close($g_sql);
    }
}