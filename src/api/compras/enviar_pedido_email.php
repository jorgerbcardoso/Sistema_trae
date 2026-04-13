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
/**
 * Gerar HTML do PDF do Pedido
 * ✅ RIGOROSAMENTE IGUAL AO LAYOUT DE IMPRESSÃO DO FRONTEND (PedidoForm.tsx)
 * ⚠️ wkhtmltopdf NÃO SUPORTA BEM FLEXBOX/GRID! USANDO TABELAS E FLOATS.
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
    $cabecalho_texto = $is_aceville ? 'PEDIDO DE COMPRA' : $nome_empresa . ' by PRESTO';

    // Montar HTML do Cabeçalho baseado nas regras
    $html_header = '
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
        .logo {
            max-width: 120px;
            max-height: 50px;
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