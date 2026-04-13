<?php
/**
 * API: Enviar Pedido por Email ao Fornecedor
 * Envia PDF do pedido para o email do fornecedor
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/services/EmailService.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

// ✅ AUTENTICAÇÃO
requireAuth();
$currentUser = getCurrentUser();

$login = $currentUser['username'];
$prefix = strtolower($currentUser['domain']) . '_';
$dominio = strtolower($currentUser['domain']);

// ✅ TABELAS
$tblPedido = $prefix . 'pedido';
$tblPedidoItem = $prefix . 'pedido_item';
$tblFornecedor = $prefix . 'fornecedor';
$tblItem = $prefix . 'item';
$tblUnidadeMedida = $prefix . 'unidade_medida';
$tblOrcamento = $prefix . 'orcamento';

// ✅ CRIAR CONEXÃO
$g_sql = connect();

try {
    // Receber dados
    $input = json_decode(file_get_contents('php://input'), true);
    
    $seq_pedido = $input['seq_pedido'] ?? null;
    $email_fornecedor = trim($input['email_fornecedor'] ?? '');

    // Validações
    if (empty($seq_pedido)) {
        msg('Pedido não informado', 'error');
    }

    if (empty($email_fornecedor)) {
        msg('Email do fornecedor não informado', 'error');
    }

    if (!filter_var($email_fornecedor, FILTER_VALIDATE_EMAIL)) {
        msg('Email inválido', 'error');
    }

    // ============================================
    // BUSCAR INFORMAÇÕES DO PEDIDO
    // ============================================
    $query = "
        SELECT 
            p.seq_pedido,
            p.unidade,
            p.nro_pedido,
            p.data_inclusao,
            p.observacao,
            p.vlr_total,
            p.seq_orcamento,
            f.seq_fornecedor,
            f.nome as fornecedor_nome,
            f.cnpj as fornecedor_cnpj,
            f.endereco as fornecedor_endereco,
            f.bairro as fornecedor_bairro,
            f.telefone as fornecedor_telefone,
            f.email as fornecedor_email_atual,
            orc.nro_orcamento
        FROM $tblPedido p
        LEFT JOIN $tblFornecedor f ON f.seq_fornecedor = p.seq_fornecedor
        LEFT JOIN $tblOrcamento orc ON orc.seq_orcamento = p.seq_orcamento
        WHERE p.seq_pedido = $1
    ";
    
    $result = sql($query, [$seq_pedido], $g_sql);
    
    if (!$result) {
        msg('Erro ao buscar pedido: ' . pg_last_error($g_sql), 'error');
    }
    
    $pedido_info = pg_fetch_assoc($result);
    
    if (!$pedido_info) {
        msg('Pedido não encontrado', 'error');
    }

    // ✅ ATUALIZAR EMAIL DO FORNECEDOR SE DIFERENTE DO CADASTRADO
    $seq_fornecedor = $pedido_info['seq_fornecedor'];
    $email_atual_cadastrado = $pedido_info['fornecedor_email_atual'];
    
    if ($seq_fornecedor && $email_fornecedor !== $email_atual_cadastrado) {
        $query_update_email = "UPDATE $tblFornecedor SET email = $1 WHERE seq_fornecedor = $2";
        $result_update = sql($query_update_email, [$email_fornecedor, $seq_fornecedor], $g_sql);
        
        if ($result_update) {
            error_log("✅ Email do fornecedor atualizado de '{$email_atual_cadastrado}' para '{$email_fornecedor}'");
        }
    }

    // ============================================
    // GERAR PDF DO PEDIDO INTERNAMENTE
    // ============================================
    $nro_pedido_formatado = $pedido_info['unidade'] . str_pad($pedido_info['nro_pedido'], 7, '0', STR_PAD_LEFT);
    
    error_log("🔧 [ENVIAR-PEDIDO] Iniciando geração de PDF para pedido {$nro_pedido_formatado}");
    
    $pdf_data = gerarPdfPedidoInterno($g_sql, $prefix, $seq_pedido, $dominio);
    
    if (!$pdf_data) {
        msg('Erro ao gerar PDF do pedido', 'error');
    }
    
    $pdf_content = $pdf_data['content'];
    $pdf_filename = $pdf_data['filename'];
    
    error_log("✅ [ENVIAR-PEDIDO] PDF gerado com sucesso: {$pdf_filename}");

    // ============================================
    // ENVIAR EMAIL USANDO EmailService
    // ============================================
    $emailService = new EmailService();
    
    $emailResult = $emailService->sendPedidoFornecedor(
        $email_fornecedor,
        $pedido_info['fornecedor_nome'],
        $pedido_info['nro_pedido'],
        $pedido_info['unidade'],
        $pdf_content,
        $pdf_filename,
        $dominio,
        $login
    );

    if (!$emailResult['success']) {
        msg('Erro ao enviar email: ' . $emailResult['message'], 'error');
    }

    // ============================================
    // REGISTRAR LOG (OPCIONAL)
    // ============================================
    $tblLogs = $prefix . 'logs_sistema';
    
    // Verificar se a tabela existe
    $checkTable = sql("
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = '$tblLogs'
        )
    ", [], $g_sql);
    
    $tableExists = pg_fetch_result($checkTable, 0, 0) === 't';
    
    if ($tableExists) {
        $descricao = "Pedido {$nro_pedido_formatado} enviado para {$email_fornecedor}";
        $queryLog = "
            INSERT INTO $tblLogs 
            (tipo, descricao, usuario, data, hora)
            VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_TIME)
        ";
        sql($queryLog, ['PEDIDO_EMAIL', $descricao, $login], $g_sql);
    }

    // ============================================
    // RETORNAR SUCESSO
    // ============================================
    msg('Pedido enviado com sucesso!', 'success');

} catch (Exception $e) {
    error_log('Erro ao enviar pedido: ' . $e->getMessage());
    msg('Erro ao enviar pedido: ' . $e->getMessage(), 'error');
}

/**
 * Gerar PDF do pedido internamente (para anexar no email)
 * Retorna ['content' => base64_string, 'filename' => string] ou null
 * 
 * ✅ MESMA LÓGICA DO gerarPdfMapaInterno() da solicitação de aprovação
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
    
    error_log("📄 [PDF-PEDIDO] HTML gerado com " . strlen($html) . " caracteres");
    
    // ✅ CONVERTER HTML PARA PDF usando wkhtmltopdf
    $nro_pedido_formatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
    $filename = 'pedido_' . $nro_pedido_formatado . '.pdf';
    $temp_html = '/tmp/' . uniqid() . '.html';
    $temp_pdf = '/tmp/' . $filename;
    
    // Salvar HTML temporário
    file_put_contents($temp_html, $html);
    error_log("📄 [PDF-PEDIDO] HTML salvo em: " . $temp_html);
    
    // ✅ USAR HELPER CENTRALIZADO PARA ENCONTRAR WKHTMLTOPDF
    $wkhtmltopdf_path = getWkhtmltopdfPath();
    
    if (!$wkhtmltopdf_path) {
        error_log("❌ [PDF-PEDIDO] wkhtmltopdf NÃO ENCONTRADO em nenhum caminho conhecido!");
        @unlink($temp_html);
        return null;
    }
    
    error_log("✅ [PDF-PEDIDO] wkhtmltopdf encontrado em: " . $wkhtmltopdf_path);
    
    // ✅ TENTAR DIRETÓRIO ALTERNATIVO SE /tmp NÃO FOR GRAVÁVEL
    $temp_dir = '/tmp';
    if (!is_writable($temp_dir)) {
        $alt_temp = '/var/www/html/sistema/api/tmp';
        if (!file_exists($alt_temp)) {
            @mkdir($alt_temp, 0777, true);
        }
        
        if (is_writable($alt_temp)) {
            $temp_dir = $alt_temp;
            error_log("⚠️ [PDF-PEDIDO] /tmp não gravável, usando: " . $temp_dir);
        } else {
            error_log("❌ [PDF-PEDIDO] Nenhum diretório temporário gravável encontrado!");
            @unlink($temp_html);
            return null;
        }
    }

    $temp_html = $temp_dir . '/' . uniqid() . '.html';
    $temp_pdf = $temp_dir . '/' . $filename;
    
    // Salvar HTML temporário
    file_put_contents($temp_html, $html);
    error_log("📄 [PDF-PEDIDO] HTML salvo em: " . $temp_html);
    
    // ✅ Gerar PDF (retrato, A4)
    // Usar escapeshellarg para cada argumento individualmente em vez de escapeshellcmd no comando todo
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
    
    error_log("🔧 [PDF-PEDIDO] Executando comando: " . $cmd);
    
    $output = [];
    $return_var = -1;
    exec($cmd, $output, $return_var);
    
    error_log("🔧 [PDF-PEDIDO] Código de retorno: " . $return_var);
    if (!empty($output)) {
        error_log("🔧 [PDF-PEDIDO] Output: " . implode("\n", $output));
    }
    
    if ($return_var === 0 && file_exists($temp_pdf)) {
        $pdf_size = filesize($temp_pdf);
        error_log("✅ [PDF-PEDIDO] PDF gerado com sucesso! Tamanho: " . $pdf_size . " bytes");
        
        $pdf_content = base64_encode(file_get_contents($temp_pdf));
        
        // Limpar arquivos temporários
        @unlink($temp_html);
        @unlink($temp_pdf);
        
        return [
            'content' => $pdf_content,
            'filename' => $filename
        ];
    } else {
        error_log("❌ [PDF-PEDIDO] Falha ao gerar PDF! Return var: " . $return_var);
        if (!empty($output)) {
            error_log("❌ [PDF-PEDIDO] Output: " . implode("\n", $output));
        }
        @unlink($temp_html);
        @unlink($temp_pdf);
        return null;
    }
}

/**
 * Gerar HTML do PDF do Pedido
 * ✅ MESMO LAYOUT DA IMPRESSÃO DO PEDIDO NO FRONTEND!
 * ⚠️ ATENÇÃO: wkhtmltopdf (Debian) NÃO SUPORTA BEM FLEXBOX/GRID!
 * ✅ USAR TABELAS PARA LAYOUT PARA MÁXIMA COMPATIBILIDADE
 */
function gerarHtmlPdfPedido($pedido, $itens, $dominio, $g_sql) {
    $nro_pedido_formatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
    $data_pedido = date('d/m/Y', strtotime($pedido['data_inclusao']));
    $hora_pedido = date('H:i');
    
    // ✅ BUSCAR LOGO DO CLIENTE DA TABELA DOMAINS
    $query_domain = "SELECT logo_light FROM domains WHERE domain = $1";
    $result_domain = sql($query_domain, [strtoupper($dominio)], $g_sql);
    $domain_data = pg_fetch_assoc($result_domain);
    $logo_cliente_url = $domain_data['logo_light'] ?? null;
    
    error_log("🔍 [PDF-PEDIDO] Logo do cliente (domínio {$dominio}): " . ($logo_cliente_url ?? 'não encontrada'));
    
    // ✅ CARREGAR IMAGENS E CONVERTER PARA BASE64 (para funcionar no PDF!)
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
    
    // ✅ HTML COMPLETO DO PDF (seguindo padrão do sistema)
    $html = '
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido ' . $nro_pedido_formatado . '</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #1f2937;
            padding: 20px;
        }
        
        .header {
            width: 100%;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #2563eb;
        }
        
        .header td {
            vertical-align: top;
        }
        
        .header-left img {
            max-width: 180px;
            max-height: 60px;
        }
        
        .header-right {
            text-align: right;
        }
        
        .header-right img {
            max-width: 120px;
            max-height: 50px;
            margin-bottom: 5px;
        }
        
        .title {
            text-align: center;
            margin: 20px 0;
        }
        
        .title h1 {
            font-size: 18pt;
            color: #2563eb;
            margin-bottom: 5px;
        }
        
        .title p {
            font-size: 14pt;
            font-weight: bold;
            color: #1f2937;
        }
        
        .info-section {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .info-section h2 {
            font-size: 12pt;
            color: #2563eb;
            margin-bottom: 10px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 5px;
        }
        
        .info-table {
            width: 100%;
        }
        
        .info-table td {
            width: 50%;
            padding: 5px;
            vertical-align: top;
        }
        
        .info-item {
            margin-bottom: 8px;
        }
        
        .info-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 9pt;
            display: block;
            margin-bottom: 2px;
        }
        
        .info-value {
            color: #1f2937;
            font-size: 10pt;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .items-table th {
            background-color: #2563eb;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-size: 9pt;
            font-weight: 600;
            text-transform: uppercase;
            border: 1px solid #1e40af;
        }
        
        .items-table td {
            padding: 8px;
            border: 1px solid #e5e7eb;
            font-size: 9pt;
        }
        
        tbody tr:nth-child(even) {
            background-color: #f9fafb;
        }
        
        .total-row {
            background-color: #dbeafe !important;
            font-weight: bold;
            font-size: 11pt;
        }
        
        .total-row td {
            padding: 12px 8px;
            border: 2px solid #2563eb;
        }
        
        .observacao {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        
        .observacao h3 {
            font-size: 10pt;
            color: #92400e;
            margin-bottom: 5px;
        }
        
        .observacao p {
            font-size: 9pt;
            color: #78350f;
        }
        
        .footer {
            text-align: center;
            font-size: 8pt;
            color: #6b7280;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td class="header-left">
                ' . ($logoPrestoBase64 ? '<img src="' . $logoPrestoBase64 . '" alt="Sistema Presto">' : '<h2>Sistema Presto</h2>') . '
            </td>
            <td class="header-right">
                ' . ($logoClienteBase64 ? '<img src="' . $logoClienteBase64 . '" alt="Logo Empresa">' : '') . '
                <div style="font-size: 9pt; color: #6b7280;">
                    <div>' . $data_pedido . ' - ' . $hora_pedido . '</div>
                </div>
            </td>
        </tr>
    </table>
    
    <div class="title">
        <h1>PEDIDO DE COMPRA</h1>
        <p>Nº ' . $nro_pedido_formatado . '</p>
    </div>
    
    <div class="info-section">
        <h2>DADOS DO FORNECEDOR</h2>
        <table class="info-table">
            <tr>
                <td>
                    <div class="info-item">
                        <span class="info-label">Fornecedor</span>
                        <span class="info-value">' . htmlspecialchars($pedido['fornecedor_nome']) . '</span>
                    </div>
                </td>
                <td>
                    <div class="info-item">
                        <span class="info-label">CNPJ</span>
                        <span class="info-value">' . htmlspecialchars($pedido['fornecedor_cnpj'] ?? '-') . '</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>
    
    <div class="info-section">
        <h2>DADOS DO PEDIDO</h2>
        <table class="info-table">
            <tr>
                <td>
                    <div class="info-item">
                        <span class="info-label">Data do Pedido</span>
                        <span class="info-value">' . $data_pedido . '</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Unidade</span>
                        <span class="info-value">' . htmlspecialchars($pedido['unidade']) . '</span>
                    </div>
                </td>
                <td>' .
                    ($pedido['nro_orcamento'] ? '
                    <div class="info-item">
                        <span class="info-label">Orçamento Origem</span>
                        <span class="info-value">' . $pedido['unidade'] . str_pad($pedido['nro_orcamento'], 7, '0', STR_PAD_LEFT) . '</span>
                    </div>' : '') . '
                </td>
            </tr>
        </table>
    </div>
    
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 100px;">Código</th>
                <th>Descrição</th>
                <th style="width: 50px; text-align: center;">UN</th>
                <th style="width: 80px; text-align: right;">Quantidade</th>
                <th style="width: 100px; text-align: right;">Vlr. Unitário</th>
                <th style="width: 100px; text-align: right;">Subtotal</th>
            </tr>
        </thead>
        <tbody>' .
            $html_itens .
        '</tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="5" style="text-align: right;">TOTAL DO PEDIDO:</td>
                <td style="text-align: right;">R$ ' . number_format($total_geral, 2, ',', '.') . '</td>
            </tr>
        </tfoot>
    </table>' .
    
    ($pedido['observacao'] ? '
    <div class="observacao">
        <h3>OBSERVAÇÕES</h3>
        <p>' . nl2br(htmlspecialchars($pedido['observacao'])) . '</p>
    </div>' : '') .
    
    '<div class="footer">
        <p><strong>Sistema Presto - Gestão de Transportadoras</strong></p>
        <p>Este é um documento gerado eletronicamente | Gerado em ' . date('d/m/Y H:i') . '</p>
    </div>
</body>
</html>';
    
    return $html;
}

/**
 * Carregar imagem de URL e converter para base64 (para PDF)
 */
function carregarImagemBase64($url) {
    try {
        $imageData = @file_get_contents($url);
        if ($imageData === false) {
            error_log("⚠️ [PDF] Não foi possível carregar imagem: {$url}");
            return null;
        }
        
        $mimeType = 'image/png';
        if (strpos($url, '.jpg') !== false || strpos($url, '.jpeg') !== false) {
            $mimeType = 'image/jpeg';
        } elseif (strpos($url, '.svg') !== false) {
            $mimeType = 'image/svg+xml';
        }
        
        return 'data:' . $mimeType . ';base64,' . base64_encode($imageData);
    } catch (Exception $e) {
        error_log("❌ [PDF] Erro ao carregar imagem {$url}: " . $e->getMessage());
        return null;
    }
}