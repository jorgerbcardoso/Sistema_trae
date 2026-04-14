<?php
/**
 * API: Gerar PDF de Ficha de Inventário
 * Descrição: Gera PDF da ficha de inventário usando HTML + wkhtmltopdf (padrão do sistema)
 * Métodos: GET
 * 
 * ✅ PADRÃO: HTML + wkhtmltopdf (como pedidos e orçamentos)
 * ✅ ATUALIZADO: 26/02/2026 14:30 - Migração completa para HTML
 */

require_once '/var/www/html/sistema/api/config.php';

// ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
$g_sql = connect();

// ✅ CORS
setupCORS();
handleOptionsRequest();

// ✅ AUTENTICAÇÃO
requireAuth();
$currentUser = getCurrentUser();

if (!$currentUser) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Usuário não encontrado',
        'message' => 'Sessão inválida'
    ]);
    exit;
}

$domain = strtolower($currentUser['domain']);
$unidadeAtual = strtoupper($currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '');
$prefix = $domain . '_';

// Obter seq_inventario via GET
$seqInventario = isset($_GET['seq_inventario']) ? (int)$_GET['seq_inventario'] : 0;

error_log("========================================");
error_log("🔥 [PDF-INVENTARIO] VERSÃO HTML + wkhtmltopdf ATIVA!");
error_log("🔥 [PDF-INVENTARIO] Atualizado em: 26/02/2026 14:30");
error_log("🔥 [PDF-INVENTARIO] Seq Inventário: " . $seqInventario);
error_log("========================================");

if (!$seqInventario) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Parâmetro seq_inventario é obrigatório']);
    exit;
}

try {
    // ============================================
    // BUSCAR DADOS DO INVENTÁRIO
    // ============================================
    $tblInventario = $prefix . 'inventario';
    $tblInventarioPosicao = $prefix . 'inventario_posicao';
    $tblPosicao = $prefix . 'posicao';
    $tblEstoque = $prefix . 'estoque';
    $tblItem = $prefix . 'item';
    
    $params = [$seqInventario];
    $paramIndex = 2;
    
    // ✅ REGRA DE UNIDADE: Se não for MTZ, filtrar pela unidade
    $whereUnidade = '';
    if ($unidadeAtual !== 'MTZ') {
        $whereUnidade = " AND e.unidade = $" . $paramIndex++;
        $params[] = $unidadeAtual;
    }
    
    $query = "
        SELECT 
            i.seq_inventario,
            i.nome_inventario,
            i.status,
            TO_CHAR(i.data_inclusao, 'DD/MM/YYYY') as data_inclusao,
            i.hora_inclusao,
            e.nro_estoque,
            e.descricao as estoque_descricao,
            e.unidade
        FROM $tblInventario i
        JOIN $tblEstoque e ON i.seq_estoque = e.seq_estoque
        WHERE i.seq_inventario = $1
        $whereUnidade
    ";
    
    $result = sql($g_sql, $query, false, $params);
    
    if (!$result || pg_num_rows($result) === 0) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Inventário não encontrado ou sem permissão']);
        exit;
    }
    
    $inventario = pg_fetch_assoc($result);
    
    // ============================================
    // BUSCAR POSIÇÕES DO INVENTÁRIO
    // ============================================
    $query = "
        SELECT 
            ip.seq_inventario_posicao,
            p.rua,
            p.altura,
            p.coluna,
            i.codigo as item_codigo,
            i.descricao as item_descricao,
            ip.saldo_sistema,
            ip.saldo_contado,
            ip.diferenca
        FROM $tblInventarioPosicao ip
        JOIN $tblPosicao p ON ip.seq_posicao = p.seq_posicao
        JOIN $tblItem i ON p.seq_item = i.seq_item
        WHERE ip.seq_inventario = $1
        ORDER BY p.rua, p.altura, p.coluna
    ";
    
    $result = sql($g_sql, $query, false, [$seqInventario]);
    
    $posicoes = [];
    while ($row = pg_fetch_assoc($result)) {
        $posicoes[] = $row;
    }
    
    // ============================================
    // GERAR PDF
    // ============================================
    $html = gerarHtmlPdfInventario($inventario, $posicoes, $domain, $g_sql);
    
    // ✅ CONVERTER HTML PARA PDF usando wkhtmltopdf (PADRÃO DO SISTEMA)
    $nroInventarioFormatado = str_pad($inventario['seq_inventario'], 6, '0', STR_PAD_LEFT);
    $filename = 'inventario_' . $inventario['unidade'] . $nroInventarioFormatado . '.pdf';
    $temp_html = '/tmp/' . uniqid() . '_inventario.html';
    $temp_pdf = '/tmp/' . $filename;
    
    // Salvar HTML temporário
    file_put_contents($temp_html, $html);
    error_log("📄 [PDF-INVENTARIO] HTML salvo em: " . $temp_html);
    
    // ✅ USAR HELPER CENTRALIZADO PARA ENCONTRAR WKHTMLTOPDF
    $wkhtmltopdf_path = getWkhtmltopdfPath();
    
    if (!$wkhtmltopdf_path) {
        error_log("❌ [PDF-INVENTARIO] wkhtmltopdf NÃO ENCONTRADO!");
        @unlink($temp_html);
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'wkhtmltopdf não encontrado no servidor']);
        exit;
    }
    
    error_log("✅ [PDF-INVENTARIO] wkhtmltopdf encontrado em: " . $wkhtmltopdf_path);
    
    // ✅ Gerar PDF (retrato, A4)
    $cmd = escapeshellcmd($wkhtmltopdf_path) . 
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
    
    error_log("🔧 [PDF-INVENTARIO] Executando comando: " . $cmd);
    
    exec($cmd, $output, $return_var);
    
    error_log("🔧 [PDF-INVENTARIO] Código de retorno: " . $return_var);
    error_log("🔧 [PDF-INVENTARIO] Output: " . implode("\n", $output));
    
    if ($return_var === 0 && file_exists($temp_pdf)) {
        $pdf_size = filesize($temp_pdf);
        error_log("✅ [PDF-INVENTARIO] PDF gerado com sucesso! Tamanho: " . $pdf_size . " bytes");
        
        // ✅ Retornar PDF para download
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . $pdf_size);
        
        // ✅ PADRÃO: Mensagem de sucesso via headers customizados
        header('X-Toast-Type: success');
        header('X-Toast-Message: PDF gerado com sucesso!');
        
        readfile($temp_pdf);
        
        // Limpar arquivos temporários
        @unlink($temp_html);
        @unlink($temp_pdf);
    } else {
        error_log("❌ [PDF-INVENTARIO] Falha ao gerar PDF!");
        @unlink($temp_html);
        @unlink($temp_pdf);
        
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Erro ao gerar PDF',
            'details' => implode("\n", $output)
        ]);
    }
    
} catch (Exception $e) {
    error_log("❌ [PDF-INVENTARIO] Erro: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Erro ao gerar PDF',
        'details' => $e->getMessage()
    ]);
}

/**
 * Gerar HTML do PDF do Inventário
 * ✅ PADRÃO: Mesmo layout visual dos PDFs de pedidos!
 */
function gerarHtmlPdfInventario($inventario, $posicoes, $domain, $g_sql) {
    $nroInventarioFormatado = str_pad($inventario['seq_inventario'], 6, '0', STR_PAD_LEFT);
    $nroEstoqueFormatado = $inventario['unidade'] . str_pad($inventario['nro_estoque'], 6, '0', STR_PAD_LEFT);
    $statusTexto = $inventario['status'] === 'FINALIZADO' ? 'FINALIZADO' : 'PENDENTE';
    
    // ✅ BUSCAR LOGO DO CLIENTE DA TABELA DOMAINS
    $query_domain = "SELECT logo_light, name FROM domains WHERE domain = $1";
    $result_domain = sql($g_sql, $query_domain, false, [strtoupper($domain)]);
    $domain_data = pg_fetch_assoc($result_domain);
    $logo_cliente_url = $domain_data['logo_light'] ?? null;
    $nome_empresa = $domain_data['name'] ?? '';
    
    error_log("🔍 [PDF-INVENTARIO] Logo do cliente (domínio {$domain}): " . ($logo_cliente_url ?? 'não encontrada'));
    
    // ✅ CARREGAR IMAGENS E CONVERTER PARA BASE64 (para funcionar no PDF!)
    $logoPrestoBase64 = carregarImagemBase64('https://webpresto.com.br/images/logo_rel.png');
    $logoClienteBase64 = $logo_cliente_url ? carregarImagemBase64($logo_cliente_url) : null;
    
    // Calcular totais
    $totalSistema = 0;
    $totalContado = 0;
    
    foreach ($posicoes as $pos) {
        $totalSistema += floatval($pos['saldo_sistema']);
        $totalContado += floatval($pos['saldo_contado']);
    }
    
    $diferenca = $totalContado - $totalSistema;
    
    // Montar HTML das linhas
    $html_itens = '';
    
    foreach ($posicoes as $pos) {
        $saldoSistema = number_format($pos['saldo_sistema'], 2, ',', '.');
        $saldoContado = ($inventario['status'] === 'FINALIZADO' || $pos['saldo_contado'] > 0) 
            ? number_format($pos['saldo_contado'], 2, ',', '.') 
            : '';
        
        $html_itens .= '
            <tr>
                <td style="text-align: center;">' . htmlspecialchars($pos['rua']) . '</td>
                <td style="text-align: center;">' . htmlspecialchars($pos['altura']) . '</td>
                <td style="text-align: center;">' . htmlspecialchars($pos['coluna']) . '</td>
                <td>' . htmlspecialchars($pos['item_codigo']) . '</td>
                <td>' . htmlspecialchars(substr($pos['item_descricao'], 0, 50)) . '</td>
                <td style="text-align: right;">' . $saldoSistema . '</td>
                <td style="text-align: right; font-weight: bold;">' . $saldoContado . '</td>
            </tr>';
    }
    
    // ✅ REGRA: Inverter logos (Empresa na esquerda, Presto na direita)
    // ✅ REGRA ACV: Para o domínio ACV, a logo da Presto não deve ser exibida.
    $is_aceville = (strtoupper($dominio) === 'ACV');
    
    // Cabeçalho Texto: [nome da empresa] by PRESTO (exceto ACV)
    $cabecalho_texto = $is_aceville ? 'SISTEMA DE ESTOQUE' : $nome_empresa . ' by PRESTO';

    // Montar HTML do Cabeçalho baseado nas regras
    $html_header = '
    <table class="header">
        <tr>
            <td style="width: 50%;">
                <table>
                    <tr>
                        <td>' . ($logoClienteBase64 ? '<img src="' . $logoClienteBase64 . '" class="logo" width="150" height="60">' : '') . '</td>
                        <td class="header-info" style="padding-left: 15px;">
                            <h1 style="font-size: 16pt; color: #2563eb; margin-bottom: 3px; text-transform: uppercase;">INVENTÁRIO DE ESTOQUE</h1>
                            <p style="font-size: 10pt; color: #666;">' . $cabecalho_texto . '</p>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; text-align: right;">
                ' . (!$is_aceville && $logoPrestoBase64 ? '<img src="' . $logoPrestoBase64 . '" class="logo-presto" width="100" height="40">' : '') . '
            </td>
        </tr>
    </table>';

    // ✅ HTML COMPLETO DO PDF
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
            font-size: 10pt;
            line-height: 1.4;
            color: #1f2937;
            background: #fff;
        }
        .header {
            width: 100%;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #2563eb;
        }
        .logo {
            width: 150px;
            height: 60px;
            object-fit: contain;
        }
        .logo-presto {
            width: 100px;
            height: 40px;
            object-fit: contain;
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
            border-collapse: collapse;
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
        table.itens-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        table.itens-table th {
            background-color: #2563eb;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-size: 9pt;
            font-weight: 600;
            text-transform: uppercase;
            border: 1px solid #1e40af;
        }
        table.itens-table td {
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
        .signature-section {
            margin-top: 40px;
            text-align: center;
        }
        .signature-line {
            border-top: 2px solid #1f2937;
            width: 300px;
            margin: 40px auto 10px;
        }
        .signature-label {
            font-size: 10pt;
            color: #6b7280;
            font-weight: 600;
        }
    </style>
</head>
<body>
    ' . $html_header . '
    
    <div class="title">
        <h1>FICHA DE INVENTÁRIO</h1>
        <p>' . htmlspecialchars($inventario['nome_inventario']) . '</p>
    </div>
    
    <div class="info-section">
        <h2>DADOS DO INVENTÁRIO</h2>
        <table class="info-table">
            <tr>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Número</span>
                        <span class="info-value">' . $nroInventarioFormatado . '</span>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value" style="' . ($statusTexto === 'FINALIZADO' ? 'color: #059669; font-weight: bold;' : 'color: #d97706; font-weight: bold;') . '">' . $statusTexto . '</span>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Data de Criação</span>
                        <span class="info-value">' . htmlspecialchars($inventario['data_inclusao'] . ' ' . $inventario['hora_inclusao']) . '</span>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Empresa</span>
                        <span class="info-value">' . htmlspecialchars($nome_empresa) . '</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>
    
    <div class="info-section">
        <h2>DADOS DO ESTOQUE</h2>
        <table class="info-table">
            <tr>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Estoque</span>
                        <span class="info-value">' . htmlspecialchars($nroEstoqueFormatado) . '</span>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Descrição</span>
                        <span class="info-value">' . htmlspecialchars($inventario['estoque_descricao']) . '</span>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Unidade</span>
                        <span class="info-value">' . htmlspecialchars($inventario['unidade']) . '</span>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="info-item">
                        <span class="info-label">Total de Posições</span>
                        <span class="info-value">' . count($posicoes) . '</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>
    
    <table class="itens-table">
        <thead>
            <tr>
                <th style="width: 60px; text-align: center;">RUA</th>
                <th style="width: 60px; text-align: center;">ALTURA</th>
                <th style="width: 60px; text-align: center;">COLUNA</th>
                <th style="width: 100px;">CÓDIGO</th>
                <th>DESCRIÇÃO</th>
                <th style="width: 100px; text-align: right;">SALDO SISTEMA</th>
                <th style="width: 100px; text-align: right;">SALDO CONTADO</th>
            </tr>
        </thead>
        <tbody>' .
            $html_itens .
        '</tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="5" style="text-align: right;">TOTAL GERAL:</td>
                <td style="text-align: right;">' . number_format($totalSistema, 2, ',', '.') . '</td>
                <td style="text-align: right;">' . ($inventario['status'] === 'FINALIZADO' ? number_format($totalContado, 2, ',', '.') : '') . '</td>
            </tr>';
    
    if ($inventario['status'] === 'FINALIZADO' && $diferenca != 0) {
        $diferencaFormatada = number_format(abs($diferenca), 2, ',', '.');
        $diferencaTexto = $diferenca > 0 ? '+' . $diferencaFormatada : '-' . $diferencaFormatada;
        $diferencaCor = $diferenca > 0 ? '#059669' : '#dc2626';
        
        $html .= '
            <tr class="total-row">
                <td colspan="6" style="text-align: right;">DIFERENÇA (Contado - Sistema):</td>
                <td style="text-align: right; color: ' . $diferencaCor . ';">' . $diferencaTexto . '</td>
            </tr>';
    }
    
    $html .= '
        </tfoot>
    </table>';
    
    // ✅ Observação de instruções (se pendente)
    if ($inventario['status'] === 'PENDENTE') {
        $html .= '
    <div class="observacao">
        <h3>INSTRUÇÕES PARA CONTAGEM</h3>
        <p>1. Localize cada posição (RUA, ALTURA, COLUNA) no estoque físico<br>
        2. Conte fisicamente a quantidade de itens em cada posição<br>
        3. Anote o valor contado na coluna "SALDO CONTADO"<br>
        4. Após finalizar todas as contagens, lance os dados no sistema</p>
    </div>';
    }
    
    $html .= '
    <div class="signature-section">
        <div class="signature-line"></div>
        <div class="signature-label">Responsável pela Contagem</div>
    </div>
    
    <div class="footer">
        <p><strong>Sistema Presto - Gestão de Transportadoras</strong></p>
        <p>Este é um documento gerado eletronicamente | Gerado em ' . date('d/m/Y H:i') . '</p>
    </div>
</body>
</html>';
    
    return $html;
}

/**
 * Carregar imagem e converter para base64
 */
function carregarImagemBase64($url) {
    try {
        $imageContent = @file_get_contents($url);
        if ($imageContent !== false) {
            $imageType = 'image/png';
            
            // Detectar tipo de imagem pela URL
            if (strpos($url, '.jpg') !== false || strpos($url, '.jpeg') !== false) {
                $imageType = 'image/jpeg';
            } elseif (strpos($url, '.svg') !== false) {
                $imageType = 'image/svg+xml';
            }
            
            return 'data:' . $imageType . ';base64,' . base64_encode($imageContent);
        }
    } catch (Exception $e) {
        error_log("Erro ao carregar imagem: " . $e->getMessage());
    }
    
    return null;
}