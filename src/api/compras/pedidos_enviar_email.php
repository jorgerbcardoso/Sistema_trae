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
    
    $tblPedido = $prefix . 'pedido';
    $tblFornecedor = $prefix . 'fornecedor';
    
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
                         FROM {$tblPedido} p
                         INNER JOIN {$tblFornecedor} f ON f.seq_fornecedor = p.seq_fornecedor
                         WHERE p.seq_pedido = $1";
        
        $result_pedido = sql($query_pedido, array($seq_pedido), $g_sql);
        
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
        
        // ✅ GERAR PDF DO PEDIDO USANDO wkhtmltopdf (via função interna robusta)
        $pdf_data = gerarPdfPedidoInterno($g_sql, $prefix, $seq_pedido, $dominio);
        
        if (!$pdf_data) {
            $erros++;
            $detalhes[] = array(
                'pedido' => $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT),
                'fornecedor' => $pedido['fornecedor_nome'],
                'status' => 'erro',
                'mensagem' => 'Erro ao gerar PDF do pedido'
            );
            continue;
        }
        
        $pdf_content = $pdf_data['content'];
        $pdf_filename = $pdf_data['filename'];
        
        // ✅ ENVIAR EMAIL usando EmailService
        require_once __DIR__ . '/../services/EmailService.php';
        $emailService = new EmailService();
        
        $resultado_email = $emailService->sendPedidoFornecedor(
            $pedido['fornecedor_email'],
            $pedido['fornecedor_nome'],
            $pedido['nro_pedido'],
            $pedido['unidade'],
            $pdf_content,
            $pdf_filename,
            $dominio,
            $username
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
 * Gerar PDF do pedido internamente (para anexar no email)
 * Retorna ['content' => base64_string, 'filename' => string] ou null
 */
function gerarPdfPedidoInterno($g_sql, $prefix, $seq_pedido, $dominio) {
    $tblPedido = $prefix . 'pedido';
    $tblPedidoItem = $prefix . 'pedido_item';
    $tblFornecedor = $prefix . 'fornecedor';
    $tblItem = $prefix . 'item';
    $tblUnidadeMedida = $prefix . 'unidade_medida';
    $tblOrcamento = $prefix . 'orcamento';
    
    // Buscar dados do pedido
    $query_pedido = "
        SELECT 
            p.*,
            f.nome as fornecedor_nome,
            f.cnpj as fornecedor_cnpj,
            f.endereco as fornecedor_endereco,
            f.bairro as fornecedor_bairro,
            f.telefone as fornecedor_telefone,
            orc.nro_orcamento
        FROM $tblPedido p
        LEFT JOIN $tblFornecedor f ON f.seq_fornecedor = p.seq_fornecedor
        LEFT JOIN $tblOrcamento orc ON orc.seq_orcamento = p.seq_orcamento
        WHERE p.seq_pedido = $1
    ";
    
    $result_pedido = sql($query_pedido, [$seq_pedido], $g_sql);
    
    if (pg_num_rows($result_pedido) === 0) {
        return null;
    }
    
    $pedido = pg_fetch_assoc($result_pedido);
    
    // Buscar itens do pedido
    $query_itens = "
        SELECT 
            pi.*,
            i.codigo,
            i.descricao,
            um.sigla AS unidade_medida
        FROM $tblPedidoItem pi
        INNER JOIN $tblItem i ON i.seq_item = pi.seq_item
        LEFT JOIN $tblUnidadeMedida um ON um.seq_unidade_medida = i.seq_unidade_medida
        WHERE pi.seq_pedido = $1
        ORDER BY i.codigo
    ";
    
    $result_itens = sql($query_itens, [$seq_pedido], $g_sql);
    
    $itens = [];
    while ($item = pg_fetch_assoc($result_itens)) {
        $itens[] = [
            'codigo' => $item['codigo'],
            'descricao' => $item['descricao'],
            'unidade_medida' => $item['unidade_medida'],
            'qtde_item' => floatval($item['qtde_item']),
            'vlr_unitario' => floatval($item['vlr_unitario']),
            'vlr_total' => floatval($item['vlr_total'])
        ];
    }
    
    // Gerar HTML do PDF
    $html = gerarHtmlPdfPedido($pedido, $itens, $dominio, $g_sql);
    
    // ✅ CONVERTER HTML PARA PDF usando wkhtmltopdf
    $nro_pedido_formatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
    $filename = 'pedido_' . $nro_pedido_formatado . '.pdf';
    $temp_html = '/tmp/' . uniqid() . '.html';
    $temp_pdf = '/tmp/' . $filename;
    
    // Salvar HTML temporário
    file_put_contents($temp_html, $html);
    
    // ✅ USAR HELPER CENTRALIZADO PARA ENCONTRAR WKHTMLTOPDF
    $wkhtmltopdf_path = getWkhtmltopdfPath();
    
    if (!$wkhtmltopdf_path) {
        @unlink($temp_html);
        return null;
    }
    
    error_log("✅ [PDF-PEDIDO-BATCH] wkhtmltopdf encontrado em: " . $wkhtmltopdf_path);

    // ✅ TENTAR DIRETÓRIO ALTERNATIVO SE /tmp NÃO FOR GRAVÁVEL
    $temp_dir = '/tmp';
    if (!is_writable($temp_dir)) {
        $alt_temp = '/var/www/html/sistema/api/tmp';
        if (!file_exists($alt_temp)) {
            @mkdir($alt_temp, 0777, true);
        }
        
        if (is_writable($alt_temp)) {
            $temp_dir = $alt_temp;
        } else {
            @unlink($temp_html);
            return null;
        }
    }

    $temp_html = $temp_dir . '/' . uniqid() . '.html';
    $temp_pdf = $temp_dir . '/' . $filename;
    
    // Salvar HTML temporário
    file_put_contents($temp_html, $html);
    
    // ✅ Gerar PDF (retrato, A4)
    $cmd = $wkhtmltopdf_path . 
           ' --enable-local-file-access' .
           ' --page-size A4' .
           ' --orientation Portrait' .
           ' --margin-top 10mm' .
           ' --margin-bottom 10mm' .
           ' --margin-left 10mm' .
           ' --margin-right 10mm' .
           ' ' . escapeshellarg($temp_html) . 
           ' ' . escapeshellarg($temp_pdf) . 
           ' 2>&1';
    
    exec($cmd, $output, $return_var);
    
    if ($return_var === 0 && file_exists($temp_pdf)) {
        $pdf_content = base64_encode(file_get_contents($temp_pdf));
        @unlink($temp_html);
        @unlink($temp_pdf);
        return [
            'content' => $pdf_content,
            'filename' => $filename
        ];
    } else {
        error_log("❌ [PDF-PEDIDO-BATCH] Falha ao gerar PDF! Return var: " . $return_var);
        if (!empty($output)) {
            error_log("❌ [PDF-PEDIDO-BATCH] Output: " . implode("\n", $output));
        }
        @unlink($temp_html);
        @unlink($temp_pdf);
        return null;
    }
}

/**
 * Gerar HTML do PDF do Pedido
 * ⚠️ ATENÇÃO: wkhtmltopdf (Debian) NÃO SUPORTA BEM FLEXBOX/GRID!
 * ✅ USAR TABELAS PARA LAYOUT PARA MÁXIMA COMPATIBILIDADE
 */
function gerarHtmlPdfPedido($pedido, $itens, $dominio, $g_sql) {
    $nro_pedido_formatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
    $data_pedido = date('d/m/Y', strtotime($pedido['data_inclusao']));
    $hora_pedido = date('H:i');
    
    // Buscar logo do cliente
    $query_domain = "SELECT logo_light FROM domains WHERE domain = $1";
    $result_domain = sql($query_domain, [strtoupper($dominio)], $g_sql);
    $domain_data = pg_fetch_assoc($result_domain);
    $logo_cliente_url = $domain_data['logo_light'] ?? null;
    
    // Carregar imagens
    $logoPrestoBase64 = carregarImagemBase64('https://webpresto.com.br/images/logo_rel.png');
    $logoClienteBase64 = $logo_cliente_url ? carregarImagemBase64($logo_cliente_url) : null;
    
    // Montar HTML dos itens
    $html_itens = '';
    $total_geral = 0;
    
    foreach ($itens as $item) {
        $subtotal = $item['qtde_item'] * $item['vlr_unitario'];
        $total_geral += $subtotal;
        
        $html_itens .= '
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">' . htmlspecialchars($item['codigo']) . '</td>
                <td style="padding: 8px; border: 1px solid #ddd;">' . htmlspecialchars($item['descricao']) . '</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">' . htmlspecialchars($item['unidade_medida'] ?? 'UN') . '</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">' . number_format($item['qtde_item'], 2, ',', '.') . '</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">R$ ' . number_format($item['vlr_unitario'], 2, ',', '.') . '</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ' . number_format($subtotal, 2, ',', '.') . '</td>
            </tr>';
    }
    
    $html = '
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #1f2937; padding: 20px; }
        .header { width: 100%; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #2563eb; }
        .header td { vertical-align: top; }
        .header-left img { max-width: 180px; max-height: 60px; }
        .header-right { text-align: right; }
        .header-right img { max-width: 120px; max-height: 50px; margin-bottom: 5px; }
        .title { text-align: center; margin: 20px 0; }
        .title h1 { font-size: 18pt; color: #2563eb; margin-bottom: 5px; }
        .title p { font-size: 14pt; font-weight: bold; }
        .info-section { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
        .info-section h2 { font-size: 12pt; color: #2563eb; margin-bottom: 10px; border-bottom: 2px solid #2563eb; padding-bottom: 5px; }
        .info-table { width: 100%; }
        .info-table td { width: 50%; padding: 5px; vertical-align: top; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background-color: #2563eb; color: white; padding: 10px 8px; text-align: left; font-size: 9pt; text-transform: uppercase; border: 1px solid #1e40af; }
        .items-table td { padding: 8px; border: 1px solid #e5e7eb; font-size: 9pt; }
        .total-row { background-color: #dbeafe !important; font-weight: bold; font-size: 11pt; }
        .total-row td { padding: 12px 8px; border: 2px solid #2563eb; }
        .footer { text-align: center; font-size: 8pt; color: #6b7280; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td class="header-left">' . ($logoPrestoBase64 ? '<img src="' . $logoPrestoBase64 . '">' : '<h2>Sistema Presto</h2>') . '</td>
            <td class="header-right">' . ($logoClienteBase64 ? '<img src="' . $logoClienteBase64 . '">' : '') . '<div style="font-size: 9pt; color: #6b7280;">' . $data_pedido . ' - ' . $hora_pedido . '</div></td>
        </tr>
    </table>
    <div class="title"><h1>PEDIDO DE COMPRA</h1><p>Nº ' . $nro_pedido_formatado . '</p></div>
    <div class="info-section">
        <h2>DADOS DO FORNECEDOR</h2>
        <table class="info-table">
            <tr>
                <td><strong>Fornecedor:</strong> ' . htmlspecialchars($pedido['fornecedor_nome']) . '</td>
                <td><strong>CNPJ:</strong> ' . htmlspecialchars($pedido['fornecedor_cnpj'] ?? '-') . '</td>
            </tr>
        </table>
    </div>
    <table class="items-table">
        <thead><tr><th>Código</th><th>Descrição</th><th style="text-align: center;">UN</th><th style="text-align: right;">Qtd</th><th style="text-align: right;">Vlr Unit.</th><th style="text-align: right;">Subtotal</th></tr></thead>
        <tbody>' . $html_itens . '</tbody>
        <tfoot><tr class="total-row"><td colspan="5" style="text-align: right;">TOTAL DO PEDIDO:</td><td style="text-align: right;">R$ ' . number_format($total_geral, 2, ',', '.') . '</td></tr></tfoot>
    </table>
    <div class="footer"><p><strong>Sistema Presto - Gestão de Transportadoras</strong></p></div>
</body>
</html>';
    return $html;
}

/**
 * Carregar imagem de URL e converter para base64
 */
function carregarImagemBase64($url) {
    try {
        $imageData = @file_get_contents($url);
        if ($imageData === false) return null;
        
        $mimeType = 'image/png';
        if (strpos($url, '.jpg') !== false || strpos($url, '.jpeg') !== false) {
            $mimeType = 'image/jpeg';
        } elseif (strpos($url, '.svg') !== false) {
            $mimeType = 'image/svg+xml';
        }
        
        return 'data:' . $mimeType . ';base64,' . base64_encode($imageData);
    } catch (Exception $e) { return null; }
}