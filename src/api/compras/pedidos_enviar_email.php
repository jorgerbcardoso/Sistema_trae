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
    $nro_pedido_formatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 6, '0', STR_PAD_LEFT);
    $data_pedido = date('d/m/Y', strtotime($pedido['data_inclusao']));
    $hora_pedido = $pedido['hora_inclusao'] ?? date('H:i');
    $is_pedido_orcado = ($pedido['seq_orcamento'] > 0);
    $usuario = strtolower($pedido['login_inclusao'] ?? '');
    
    // Buscar dados do domínio (logo e nome)
    $query_domain = "SELECT name, logo_light FROM domains WHERE domain = $1";
    $result_domain = sql($query_domain, [strtoupper($dominio)], $g_sql);
    $domain_data = pg_fetch_assoc($result_domain);
    
    $nome_empresa = $domain_data['name'] ?? 'Transportadora';
    $logo_cliente_url = $domain_data['logo_light'] ?? 'https://webpresto.com.br/images/logo_rel.png';
    
    // Carregar imagens em Base64
    $logoPrestoBase64 = carregarImagemBase64('https://webpresto.com.br/images/logo_rel.png');
    $logoClienteBase64 = carregarImagemBase64($logo_cliente_url);
    
    // ✅ REGRA: Inverter logos (Empresa na esquerda, Presto na direita)
    // ✅ REGRA ACV: Para o domínio ACV, a logo da Presto não deve ser exibida.
    $is_aceville = (strtoupper($dominio) === 'ACV');
    
    // Cabeçalho Texto: [nome da empresa] by PRESTO (exceto ACV)
    $cabecalho_texto = $is_aceville ? 'ACEVILLE TRANSPORTES' : $nome_empresa . ' by PRESTO';

    // Configuração de Status (Simplificada para o PDF)
    $status_label = 'AGUARDANDO APROVAÇÃO';
    $status_class = 'status-aguardando';
    if ($pedido['status'] === 'P') {
        $status_label = 'APROVADO';
        $status_class = 'status-aprovado';
    } elseif ($pedido['status'] === 'E') {
        $status_label = 'ENTREGUE';
        $status_class = 'status-entregue';
    } elseif ($pedido['status'] === 'F') {
        $status_label = 'FINALIZADO';
        $status_class = 'status-finalizado';
    }

    // Montar HTML dos itens
    $html_itens = '';
    $total_geral = 0;
    foreach ($itens as $item) {
        $subtotal = $item['qtde_item'] * $item['vlr_unitario'];
        $total_geral += $subtotal;
        $html_itens .= '
            <tr>
                <td>' . htmlspecialchars($item['codigo']) . '</td>
                <td>' . htmlspecialchars($item['descricao']) . '</td>
                <td style="text-align: center;">' . htmlspecialchars($item['unidade_medida'] ?? 'UN') . '</td>
                <td style="text-align: right;">' . number_format($item['qtde_item'], 2, ',', '.') . '</td>
                <td style="text-align: right;">' . number_format($item['vlr_unitario'], 2, ',', '.') . '</td>
                <td style="text-align: right;"><strong>' . number_format($subtotal, 2, ',', '.') . '</strong></td>
            </tr>';
    }

    // Cabeçalho HTML
    $html_header = '
    <table class="header">
        <tr>
            <td style="width: 50%;">
                <table>
                    <tr>
                        <td>' . ($logoClienteBase64 ? '<img src="' . $logoClienteBase64 . '" class="logo" width="100" height="40">' : '') . '</td>
                        <td class="header-info" style="padding-left: 15px;">
                            <h1>PEDIDO DE COMPRA</h1>
                            <p>' . $cabecalho_texto . '</p>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; text-align: right;">
                ' . (!$is_aceville && $logoPrestoBase64 ? '<img src="' . $logoPrestoBase64 . '" class="logo-presto" width="100" height="40">' : '') . '
            </td>
        </tr>
    </table>';

    $html = '
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: Arial, sans-serif; 
            padding: 10mm; 
            font-size: 11pt;
            color: #000;
            background: #fff;
        }
        .header {
            width: 100%;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #2563eb;
        }
        .logo, .logo-presto {
            width: 100px;
            height: 40px;
            object-fit: contain;
        }
        .header-info h1 {
            font-size: 16pt;
            color: #2563eb;
            margin-bottom: 3px;
            text-transform: uppercase;
        }
        .header-info p {
            font-size: 10pt;
            color: #666;
        }
        .pedido-numero {
            font-size: 20pt;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 5px;
        }
        .pedido-tipo {
            display: inline-block;
            padding: 4px 12px;
            background: #dbeafe;
            color: #1e40af;
            border-radius: 12px;
            font-size: 9pt;
            font-weight: bold;
            text-transform: uppercase;
        }
        .section {
            margin-bottom: 20px;
            width: 100%;
        }
        .section-title {
            font-size: 11pt;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid #e5e7eb;
            text-transform: uppercase;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
        }
        .info-label {
            font-size: 8pt;
            color: #6b7280;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .info-value {
            font-size: 10pt;
            color: #000;
        }
        .fornecedor-box {
            background: #f9fafb;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        .fornecedor-nome {
            font-size: 11pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
        }
        .fornecedor-info {
            font-size: 9pt;
            color: #4b5563;
            line-height: 1.4;
        }
        table.itens-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 9pt;
        }
        table.itens-table th {
            background-color: #1e40af;
            color: white;
            font-weight: bold;
            padding: 8px 6px;
            text-align: left;
            font-size: 9pt;
        }
        table.itens-table td {
            border: 1px solid #e5e7eb;
            padding: 6px;
        }
        table.itens-table tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .total-section {
            margin-top: 15px;
            background: #eff6ff;
            padding: 12px 15px;
            border-radius: 6px;
            border: 2px solid #2563eb;
            width: 100%;
        }
        .total-label {
            font-size: 12pt;
            font-weight: bold;
            color: #1e40af;
        }
        .total-value {
            font-size: 18pt;
            font-weight: bold;
            color: #2563eb;
            float: right;
        }
        .observacoes {
            background: #fffbeb;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid #fcd34d;
            font-size: 9pt;
            line-height: 1.5;
            color: #000;
        }
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 8pt;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 9pt;
            text-transform: uppercase;
        }
        .status-aguardando { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
        .status-aprovado { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .status-entregue { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
        .status-finalizado { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    </style>
</head>
<body>
    ' . $html_header . '
    
    <div class="section">
        <div class="pedido-numero">' . $nro_pedido_formatado . '</div>
        <span class="pedido-tipo">' . ($is_pedido_orcado ? 'VIA ORÇAMENTO' : 'MANUAL') . '</span>
        <span class="status-badge ' . $status_class . '">' . $status_label . '</span>
    </div>

    <div class="section">
        <div class="section-title">Informações do Pedido</div>
        <table class="info-table">
            <tr>
                <td style="width: 33%;">
                    <div class="info-label">Unidade</div>
                    <div class="info-value">' . htmlspecialchars($pedido['unidade']) . '</div>
                </td>
                <td style="width: 33%;">
                    <div class="info-label">Data de Inclusão</div>
                    <div class="info-value">' . $data_pedido . ' às ' . $hora_pedido . '</div>
                </td>
                <td style="width: 33%;">
                    <div class="info-label">Usuário</div>
                    <div class="info-value">' . $usuario . '</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Fornecedor</div>
        <div class="fornecedor-box">
            <div class="fornecedor-nome">' . htmlspecialchars($pedido['fornecedor_nome']) . '</div>
            <div class="fornecedor-info">
                <strong>CNPJ:</strong> ' . htmlspecialchars($pedido['fornecedor_cnpj'] ?? 'N/A') . '
                ' . ($pedido['fornecedor_telefone'] ? ' | <strong>Telefone:</strong> ' . htmlspecialchars($pedido['fornecedor_telefone']) : '') . '
                ' . ($pedido['fornecedor_email'] ? ' | <strong>E-mail:</strong> ' . htmlspecialchars($pedido['fornecedor_email']) : '') . '
                ' . ($pedido['fornecedor_cidade'] ? ' | <strong>Cidade:</strong> ' . htmlspecialchars($pedido['fornecedor_cidade']) : '') . '
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Itens do Pedido</div>
        <table class="itens-table">
            <thead>
                <tr>
                    <th style="width: 12%;">Código</th>
                    <th style="width: 38%;">Descrição</th>
                    <th style="width: 8%; text-align: center;">Unid.</th>
                    <th style="width: 12%; text-align: right;">Quantidade</th>
                    <th style="width: 15%; text-align: right;">Vlr. Unit. (R$)</th>
                    <th style="width: 15%; text-align: right;">Vlr. Total (R$)</th>
                </tr>
            </thead>
            <tbody>
                ' . $html_itens . '
            </tbody>
        </table>
    </div>

    ' . ($pedido['observacao'] ? '
    <div class="section">
        <div class="section-title">Observações</div>
        <div class="observacoes">' . nl2br(htmlspecialchars($pedido['observacao'])) . '</div>
    </div>' : '') . '

    <div class="total-section">
        <span class="total-label">VALOR TOTAL DO PEDIDO</span>
        <span class="total-value">R$ ' . number_format($total_geral, 2, ',', '.') . '</span>
        <div style="clear: both;"></div>
    </div>

    <div class="footer">
        <p>Sistema PRESTO - Gestão de Transportadoras | www.webpresto.com.br</p>
        <p>Gerado em ' . date('d/m/Y') . ' às ' . date('H:i:s') . '</p>
    </div>
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