<?php
/**
 * API: Enviar Pedidos por Email
 * Descrição: Envia pedidos gerados para os fornecedores por email com PDF
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
        enviarPedidosPorEmail($g_sql, $prefix, $data, $dominio);
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
 * Enviar pedidos por email
 */
function enviarPedidosPorEmail($g_sql, $prefix, $data, $dominio) {
    $pedidos = $data['pedidos'] ?? array();
    
    if (empty($pedidos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nenhum pedido informado']);
        return;
    }
    
    $tabela_pedidos = $prefix . 'pedidos';
    $tabela_fornecedores = $prefix . 'fornecedores';
    
    $enviados = 0;
    $erros = 0;
    $detalhes = array();
    
    foreach ($pedidos as $pedido_info) {
        $seq_pedido = $pedido_info['seq_pedido'] ?? null;
        
        if (!$seq_pedido) {
            $erros++;
            $detalhes[] = array(
                'pedido' => 'N/A',
                'status' => 'erro',
                'mensagem' => 'Pedido sem identificação'
            );
            continue;
        }
        
        // Buscar dados do pedido
        $query_pedido = "SELECT p.*, f.nome as fornecedor_nome, f.email as fornecedor_email
                         FROM {$tabela_pedidos} p
                         INNER JOIN {$tabela_fornecedores} f ON f.seq_fornecedor = p.seq_fornecedor
                         WHERE p.seq_pedido = $1";
        
        $result_pedido = sql($g_sql, $query_pedido, false, array($seq_pedido));
        
        if (pg_num_rows($result_pedido) === 0) {
            $erros++;
            $detalhes[] = array(
                'pedido' => $seq_pedido,
                'status' => 'erro',
                'mensagem' => 'Pedido não encontrado'
            );
            continue;
        }
        
        $pedido = pg_fetch_assoc($result_pedido);
        
        // Verificar se fornecedor tem email
        if (empty($pedido['fornecedor_email'])) {
            $erros++;
            $detalhes[] = array(
                'pedido' => $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT),
                'fornecedor' => $pedido['fornecedor_nome'],
                'status' => 'erro',
                'mensagem' => 'Fornecedor sem email cadastrado'
            );
            continue;
        }
        
        // Gerar PDF do pedido (simplificado - em produção usar biblioteca)
        $pdf_html = gerarHtmlPedido($g_sql, $prefix, $pedido);
        
        // ✅ ENVIAR EMAIL usando EmailService
        require_once __DIR__ . '/../services/EmailService.php';
        $emailService = new EmailService();
        
        // Converter HTML para PDF base64 (simplificado - idealmente usar TCPDF ou Dompdf)
        $pdf_content = base64_encode($pdf_html); // Em produção, usar biblioteca de PDF
        $pdf_filename = "Pedido_{$pedido['unidade']}" . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT) . ".pdf";
        
        $resultado_email = $emailService->sendPedidoFornecedor(
            $pedido['fornecedor_email'],
            $pedido['fornecedor_nome'],
            $pedido['nro_pedido'],
            $pedido['unidade'],
            $pdf_content,
            $pdf_filename
        );
        
        if ($resultado_email['success']) {
            $enviados++;
            $detalhes[] = array(
                'pedido' => $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT),
                'fornecedor' => $pedido['fornecedor_nome'],
                'email' => $pedido['fornecedor_email'],
                'status' => 'sucesso',
                'mensagem' => 'Email enviado com sucesso'
            );
        } else {
            $erros++;
            $detalhes[] = array(
                'pedido' => $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT),
                'fornecedor' => $pedido['fornecedor_nome'],
                'email' => $pedido['fornecedor_email'],
                'status' => 'erro',
                'mensagem' => $resultado_email['message']
            );
        }
    }
    
    echo json_encode([
        'success' => true,
        'enviados' => $enviados,
        'erros' => $erros,
        'total' => count($pedidos),
        'detalhes' => $detalhes,
        'toast' => array(
            'type' => $erros > 0 ? 'warning' : 'success',
            'message' => $enviados > 0 
                ? "Pedidos enviados: {$enviados} de " . count($pedidos) 
                : "Nenhum pedido foi enviado. Verifique os emails dos fornecedores."
        )
    ]);
}

/**
 * Gerar HTML do pedido para PDF
 */
function gerarHtmlPedido($g_sql, $prefix, $pedido) {
    $nro_pedido = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
    $data_pedido = date('d/m/Y', strtotime($pedido['data_pedido']));
    
    // Buscar itens do pedido
    $tabela_pedido_itens = $prefix . 'pedido_itens';
    $query_itens = "SELECT pi.*, i.codigo, i.descricao, i.unidade_medida
                    FROM {$tabela_pedido_itens} pi
                    INNER JOIN " . $prefix . "itens i ON i.seq_item = pi.seq_item
                    WHERE pi.seq_pedido = $1
                    ORDER BY i.codigo";
    
    $result_itens = sql($g_sql, $query_itens, false, array($pedido['seq_pedido']));
    
    $itens = array();
    $total = 0;
    
    while ($item = pg_fetch_assoc($result_itens)) {
        $subtotal = $item['vlr_unitario'] * $item['qtde_item'];
        $total += $subtotal;
        
        $itens[] = array(
            'codigo' => $item['codigo'],
            'descricao' => $item['descricao'],
            'unidade_medida' => $item['unidade_medida'],
            'qtde' => $item['qtde_item'],
            'vlr_unitario' => $item['vlr_unitario'],
            'subtotal' => $subtotal
        );
    }
    
    $html = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: Arial, sans-serif;
                font-size: 10pt;
                margin: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 3px solid #2563eb;
                padding-bottom: 15px;
            }
            .header h1 {
                margin: 5px 0;
                font-size: 18pt;
                color: #2563eb;
            }
            .info-box {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                padding: 10px;
                margin-bottom: 15px;
                border-radius: 5px;
            }
            .info-box p {
                margin: 3px 0;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }
            th, td {
                border: 1px solid #333;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #2563eb;
                color: white;
                font-weight: bold;
            }
            .text-right {
                text-align: right;
            }
            .text-center {
                text-align: center;
            }
            .total {
                background-color: #d4edda;
                font-weight: bold;
                font-size: 12pt;
            }
            .footer {
                text-align: center;
                font-size: 8pt;
                margin-top: 30px;
                color: #666;
                border-top: 1px solid #ccc;
                padding-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>PEDIDO DE COMPRA</h1>
            <p style="font-size: 14pt; font-weight: bold;">Nº ' . $nro_pedido . '</p>
        </div>
        
        <div class="info-box">
            <p><strong>FORNECEDOR:</strong> ' . $pedido['fornecedor_nome'] . '</p>
            <p><strong>DATA DO PEDIDO:</strong> ' . $data_pedido . '</p>
            <p><strong>UNIDADE:</strong> ' . $pedido['unidade'] . '</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 100px;">Código</th>
                    <th>Descrição</th>
                    <th style="width: 50px;">UN</th>
                    <th class="text-right" style="width: 70px;">Qtde</th>
                    <th class="text-right" style="width: 90px;">Vlr Unit.</th>
                    <th class="text-right" style="width: 100px;">Subtotal</th>
                </tr>
            </thead>
            <tbody>';
    
    foreach ($itens as $item) {
        $html .= '
                <tr>
                    <td>' . $item['codigo'] . '</td>
                    <td>' . $item['descricao'] . '</td>
                    <td class="text-center">' . $item['unidade_medida'] . '</td>
                    <td class="text-right">' . number_format($item['qtde'], 2, ',', '.') . '</td>
                    <td class="text-right">R$ ' . number_format($item['vlr_unitario'], 2, ',', '.') . '</td>
                    <td class="text-right">R$ ' . number_format($item['subtotal'], 2, ',', '.') . '</td>
                </tr>';
    }
    
    $html .= '
            </tbody>
            <tfoot>
                <tr class="total">
                    <td colspan="5" class="text-right"><strong>TOTAL DO PEDIDO:</strong></td>
                    <td class="text-right"><strong>R$ ' . number_format($total, 2, ',', '.') . '</strong></td>
                </tr>
            </tfoot>
        </table>
        
        <div class="footer">
            <p><strong>Sistema PRESTO - Gestão de Transportes</strong></p>
            <p>Este é um documento gerado eletronicamente | Gerado em ' . date('d/m/Y H:i') . '</p>
        </div>
    </body>
    </html>';
    
    return $html;
}