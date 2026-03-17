<?php
/**
 * ================================================================
 * API: APROVAR PEDIDO MANUAL
 * ================================================================
 * 
 * Aprova um pedido que estava aguardando aprovação:
 * 1. Valida se pedido existe e está com status 'A' (Aguardando)
 * 2. Atualiza status para 'P' (Pendente - pronto para envio)
 * 3. Registra quem aprovou e quando
 * 4. Envia email para o usuário que cadastrou o pedido
 * 
 * @method POST
 * @body {
 *   "seq_pedido": 123
 * }
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../services/EmailService.php';

header('Content-Type: application/json; charset=utf-8');

// ✅ Verificar autenticação
$auth = verificarAutenticacao();
if (!$auth['autenticado']) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Não autenticado',
        'toast' => [
            'type' => 'error',
            'message' => 'Sessão expirada. Faça login novamente.'
        ]
    ]);
    exit;
}

// ✅ Verificar se usuário tem permissão de aprovação
if (!$auth['usuario']['aprova_orcamento']) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Usuário não tem permissão para aprovar pedidos',
        'toast' => [
            'type' => 'error',
            'message' => 'Você não tem permissão para aprovar pedidos.'
        ]
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
    $domain = $auth['domain'];
    $usuario_aprovador = $auth['usuario']['username'];
    
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
            f.razao_social as fornecedor_nome,
            u.email as email_solicitante,
            u.full_name as nome_solicitante
        FROM ped_compras p
        LEFT JOIN ped_compras_fornecedor f ON p.seq_fornecedor = f.seq_fornecedor
        LEFT JOIN usuarios u ON LOWER(u.username) = LOWER(p.login_inclusao)
        WHERE p.seq_pedido = $1 
          AND p.dominio = $2
    ";
    
    $result_pedido = sql($query_pedido, [$seq_pedido, $domain], $g_sql);
    
    if (count($result_pedido) === 0) {
        throw new Exception('Pedido não encontrado');
    }
    
    $pedido = $result_pedido[0];
    
    // ✅ 2. Validar se pedido está aguardando aprovação
    if ($pedido['status'] !== 'A') {
        $status_map = [
            'P' => 'Pendente',
            'E' => 'Enviado',
            'C' => 'Cancelado',
            'R' => 'Recebido'
        ];
        $status_atual = $status_map[$pedido['status']] ?? 'Desconhecido';
        
        throw new Exception("Pedido não pode ser aprovado. Status atual: $status_atual");
    }
    
    // ✅ 3. Aprovar pedido (atualizar status para 'P' - Pendente)
    $query_aprovar = "
        UPDATE ped_compras 
        SET 
            status = 'P',
            login_aprovacao = $1,
            data_aprovacao = CURRENT_DATE,
            hora_aprovacao = TO_CHAR(CURRENT_TIMESTAMP, 'HH24:MI')
        WHERE seq_pedido = $2 
          AND dominio = $3
    ";
    
    sql($query_aprovar, [$usuario_aprovador, $seq_pedido, $domain], $g_sql);
    
    // ✅ 4. Enviar email para o solicitante
    if (!empty($pedido['email_solicitante'])) {
        try {
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
                    <p style='margin: 5px 0;'><strong>Status:</strong> <span style='color: #059669;'>PENDENTE - Pronto para envio</span></p>
                </div>
                
                <p>O pedido agora pode ser enviado ao fornecedor através do sistema.</p>
                
                <p style='margin-top: 30px; font-size: 12px; color: #6b7280;'>
                    Este é um email automático. Por favor, não responda.
                </p>
            ";
            
            $emailService->enviarEmail(
                $pedido['email_solicitante'],
                $assunto,
                $corpo,
                $pedido['nome_solicitante']
            );
            
            $email_enviado = true;
        } catch (Exception $e) {
            // Log erro mas não falha a aprovação
            error_log("Erro ao enviar email de aprovação: " . $e->getMessage());
            $email_enviado = false;
        }
    } else {
        $email_enviado = false;
    }
    
    // ✅ Resposta de sucesso
    echo json_encode([
        'success' => true,
        'message' => 'Pedido aprovado com sucesso',
        'toast' => [
            'type' => 'success',
            'message' => $email_enviado 
                ? 'Pedido aprovado! Email de notificação enviado ao solicitante.'
                : 'Pedido aprovado com sucesso!'
        ],
        'data' => [
            'seq_pedido' => $seq_pedido,
            'nro_pedido' => $pedido['nro_pedido'],
            'status_anterior' => 'A',
            'status_atual' => 'P',
            'aprovador' => $usuario_aprovador,
            'email_enviado' => $email_enviado
        ]
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'toast' => [
            'type' => 'error',
            'message' => $e->getMessage()
        ]
    ]);
}
