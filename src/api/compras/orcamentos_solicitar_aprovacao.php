<?php
/**
 * API: Solicitar Aprovação de Orçamento
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
        solicitarAprovacao($g_sql, $prefix, $data, $username, $dominio);
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
 * Solicitar aprovação de orçamento
 */
function solicitarAprovacao($g_sql, $prefix, $data, $username, $dominio) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    $usuario_aprovador_id = $data['usuario_aprovador_id'] ?? null;
    
    if (!$seq_orcamento) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não informado']);
        return;
    }
    
    if (!$usuario_aprovador_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Usuário aprovador não informado']);
        return;
    }
    
    $tabela_orcamento = $prefix . 'orcamento';
    $tabela_cotacao = $prefix . 'orcamento_cotacao';
    
    // Verificar se orçamento existe
    $query_orcamento = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result_orcamento = sql($g_sql, $query_orcamento, false, array($seq_orcamento));
    
    if (pg_num_rows($result_orcamento) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado']);
        return;
    }
    
    $orcamento = pg_fetch_assoc($result_orcamento);
    
    // Verificar se há itens selecionados
    $query_selecionados = "SELECT COUNT(*) as total FROM {$tabela_cotacao} 
                           WHERE seq_orcamento = $1 AND selecionado = 'S'";
    $result_selecionados = sql($g_sql, $query_selecionados, false, array($seq_orcamento));
    $row_selecionados = pg_fetch_assoc($result_selecionados);
    
    if ($row_selecionados['total'] == 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Não há itens selecionados no orçamento'
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
    if ($aprovador['aprova_orcamento'] !== 't') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Usuário selecionado não tem permissão para aprovar orçamentos'
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
    $tabela_solicitacao = $prefix . 'orcamento_solicitacao_aprovacao';
    
    // Criar tabela se não existir
    $query_create_table = "CREATE TABLE IF NOT EXISTS {$tabela_solicitacao} (
        seq_solicitacao SERIAL PRIMARY KEY,
        seq_orcamento INTEGER NOT NULL,
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
                     (seq_orcamento, usuario_solicitante, usuario_aprovador_id, token_acesso, token_validade)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING seq_solicitacao";
    
    $result_insert = sql($g_sql, $query_insert, false, array(
        $seq_orcamento,
        $username,
        $usuario_aprovador_id,
        $token_acesso,
        $validade
    ));
    
    $solicitacao = pg_fetch_assoc($result_insert);
    
    // ✅ GERAR LINK DE ACESSO DIRETO (incluir domínio)
    $link_acesso = "https://webpresto.com.br/sistema/?token={$token_acesso}&orcamento={$seq_orcamento}&domain=" . strtoupper($dominio);
    
    // ✅ ENVIAR EMAIL usando EmailService
    require_once __DIR__ . '/../services/EmailService.php';
    $emailService = new EmailService();
    
    // ✅ GERAR PDF DO MAPA INTERNAMENTE
    $pdf_content = null;
    $pdf_filename = null;
    
    try {
        error_log("🔧 [SOLICITACAO-APROVACAO] Iniciando geração de PDF para orçamento {$seq_orcamento}");
        $pdf_data = gerarPdfMapaInterno($g_sql, $prefix, $seq_orcamento, $dominio);
        if ($pdf_data) {
            $pdf_content = $pdf_data['content'];
            $pdf_filename = $pdf_data['filename'];
            error_log("✅ [SOLICITACAO-APROVACAO] PDF gerado com sucesso: " . $pdf_filename);
        } else {
            error_log("⚠️ [SOLICITACAO-APROVACAO] gerarPdfMapaInterno() retornou NULL - verificar wkhtmltopdf");
        }
    } catch (Exception $e) {
        error_log("❌ [SOLICITACAO-APROVACAO] Erro ao gerar PDF: " . $e->getMessage());
        error_log("❌ [SOLICITACAO-APROVACAO] Stack trace: " . $e->getTraceAsString());
        // Continuar sem o PDF
    }
    
    $resultado_email = $emailService->sendSolicitacaoAprovacaoOrcamento(
        $aprovador['email'],
        $aprovador['full_name'],
        $solicitante['full_name'] ?? $username,
        $orcamento['nro_orcamento'],
        $orcamento['unidade'],
        date('d/m/Y', strtotime($orcamento['data_inclusao'])),
        $token_acesso,
        $seq_orcamento,
        strtoupper($dominio),  // ✅ Adicionar parâmetro domain
        $username,  // ✅ Login do usuário
        $pdf_content,  // ✅ Conteúdo do PDF
        $pdf_filename  // ✅ Nome do arquivo
    );
    
    // ✅ LOG PARA DEBUG
    error_log("📧 [SOLICITACAO-APROVACAO] Email enviado para: " . $aprovador['email']);
    error_log("📧 [SOLICITACAO-APROVACAO] Resultado: " . ($resultado_email['success'] ? 'SUCESSO' : 'FALHA - ' . ($resultado_email['message'] ?? 'sem mensagem')));
    error_log("📧 [SOLICITACAO-APROVACAO] Link de acesso: " . $link_acesso);
    
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

// ✅ REMOVIDA A FUNÇÃO enviarEmailSolicitacaoAprovacao() - agora usa EmailService

/**
 * Gerar PDF do mapa de cotação internamente (para anexar no email)
 * Retorna ['content' => base64_string, 'filename' => string] ou null
 */
function gerarPdfMapaInterno($g_sql, $prefix, $seq_orcamento, $dominio) {
    $tabela_orcamento = $prefix . 'orcamento';
    $tabela_cotacao = $prefix . 'orcamento_cotacao';
    $tabela_orcamento_forn = $prefix . 'orcamento_fornecedor';
    $tabela_fornecedor = $prefix . 'fornecedor';
    $tabela_orcamento_oc = $prefix . 'orcamento_ordem_compra';
    $tabela_item_ordem = $prefix . 'ordem_compra_item';
    $tabela_item = $prefix . 'item';
    $tabela_unidade_med = $prefix . 'unidade_medida';
    
    // Buscar dados do orçamento
    $query_orcamento = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result_orcamento = sql($g_sql, $query_orcamento, false, array($seq_orcamento));
    
    if (pg_num_rows($result_orcamento) === 0) {
        return null;
    }
    
    $orcamento = pg_fetch_assoc($result_orcamento);
    
    // Buscar fornecedores do orçamento
    $query_fornecedores = "SELECT
                            of.seq_fornecedor,
                            f.nome
                           FROM {$tabela_orcamento_forn} of
                           INNER JOIN {$tabela_fornecedor} f ON of.seq_fornecedor = f.seq_fornecedor
                           WHERE of.seq_orcamento = $1
                           ORDER BY f.nome";
    $result_fornecedores = sql($g_sql, $query_fornecedores, false, array($seq_orcamento));
    
    $fornecedores = array();
    while ($forn = pg_fetch_assoc($result_fornecedores)) {
        $fornecedores[] = $forn;
    }
    
    // Buscar todos os itens das ordens vinculadas ao orçamento
    $query_itens = "SELECT DISTINCT
                      oci.seq_item,
                      oci.seq_ordem_compra,
                      i.codigo,
                      i.descricao,
                      um.sigla AS unidade_medida,
                      oci.qtde_item,
                      i.vlr_item AS vlr_estoque
                    FROM {$tabela_orcamento_oc} ooc
                    INNER JOIN {$tabela_item_ordem} oci ON ooc.seq_ordem_compra = oci.seq_ordem_compra
                    INNER JOIN {$tabela_item} i ON oci.seq_item = i.seq_item
                    LEFT JOIN {$tabela_unidade_med} um ON i.seq_unidade_medida = um.seq_unidade_medida
                    WHERE ooc.seq_orcamento = $1
                    ORDER BY i.codigo";
    
    $result_itens = sql($g_sql, $query_itens, false, array($seq_orcamento));
    
    // Buscar todas as cotações do orçamento
    $query_cot = "SELECT * FROM {$tabela_cotacao} WHERE seq_orcamento = $1";
    $result_cot = sql($g_sql, $query_cot, false, array($seq_orcamento));
    
    $cotacoes_map = array();
    while ($row = pg_fetch_assoc($result_cot)) {
        $chave = $row['seq_item'] . '_' . $row['seq_ordem_compra'] . '_' . $row['seq_fornecedor'];
        $cotacoes_map[$chave] = $row;
    }
    
    // Montar estrutura de itens com cotações
    $itens = array();
    while ($item = pg_fetch_assoc($result_itens)) {
        $item_obj = array(
            'seq_item' => (int)$item['seq_item'],
            'seq_ordem_compra' => (int)$item['seq_ordem_compra'],
            'codigo' => $item['codigo'],
            'descricao' => $item['descricao'],
            'unidade_medida' => $item['unidade_medida'],
            'qtde_item' => (float)$item['qtde_item'],
            'vlr_estoque' => (float)$item['vlr_estoque'],
            'cotacoes' => array()
        );

        // Adicionar cotação de cada fornecedor para este item
        foreach ($fornecedores as $forn) {
            $chave = $item['seq_item'] . '_' . $item['seq_ordem_compra'] . '_' . $forn['seq_fornecedor'];
            $cotacao = isset($cotacoes_map[$chave]) ? $cotacoes_map[$chave] : null;

            $item_obj['cotacoes'][] = array(
                'seq_fornecedor' => (int)$forn['seq_fornecedor'],
                'vlr_fornecedor' => $cotacao ? (float)$cotacao['vlr_fornecedor'] : null,
                'selecionado' => $cotacao ? $cotacao['selecionado'] : 'N'
            );
        }

        $itens[] = $item_obj;
    }
    
    // Gerar HTML do PDF
    $html = gerarHtmlPdfInterno($orcamento, $fornecedores, $itens, $dominio);
    
    error_log("📄 [PDF] HTML gerado com " . strlen($html) . " caracteres");
    
    // ✅ CONVERTER HTML PARA PDF usando wkhtmltopdf (se disponível)
    $filename = 'mapa_cotacao_' . $orcamento['unidade'] . str_pad($orcamento['nro_orcamento'], 7, '0', STR_PAD_LEFT) . '.pdf';
    $temp_html = '/tmp/' . uniqid() . '.html';
    $temp_pdf = '/tmp/' . $filename;
    
    // Salvar HTML temporário
    file_put_contents($temp_html, $html);
    error_log("📄 [PDF] HTML salvo em: " . $temp_html);
    
    // ✅ USAR HELPER CENTRALIZADO PARA ENCONTRAR WKHTMLTOPDF
    $wkhtmltopdf_path = getWkhtmltopdfPath();
    
    if (!$wkhtmltopdf_path) {
        error_log("❌ [PDF] wkhtmltopdf NÃO ENCONTRADO! Instale com: sudo apt-get install wkhtmltopdf");
        @unlink($temp_html);
        return null;
    }
    
    error_log("✅ [PDF] wkhtmltopdf encontrado em: " . $wkhtmltopdf_path);
    
    // ✅ Gerar PDF com imagens base64 embutidas (DPI padrão para arquivos menores)
    $cmd = escapeshellcmd($wkhtmltopdf_path) . 
           ' --enable-local-file-access' .
           ' --page-size A4' .
           ' --orientation Landscape' .
           ' --margin-top 10mm' .
           ' --margin-bottom 10mm' .
           ' --margin-left 10mm' .
           ' --margin-right 10mm' .
           ' ' . escapeshellarg($temp_html) . 
           ' ' . escapeshellarg($temp_pdf) . 
           ' 2>&1';
    
    error_log("🔧 [PDF] Executando comando: " . $cmd);
    
    exec($cmd, $output, $return_var);
    
    error_log("🔧 [PDF] Código de retorno: " . $return_var);
    error_log("🔧 [PDF] Output: " . implode("\n", $output));
    
    if ($return_var === 0 && file_exists($temp_pdf)) {
        $pdf_size = filesize($temp_pdf);
        error_log("✅ [PDF] PDF gerado com sucesso! Tamanho: " . $pdf_size . " bytes");
        
        $pdf_content = base64_encode(file_get_contents($temp_pdf));
        
        // Limpar arquivos temporários
        @unlink($temp_html);
        @unlink($temp_pdf);
        
        return array(
            'content' => $pdf_content,
            'filename' => $filename
        );
    } else {
        error_log("❌ [PDF] Falha ao gerar PDF! Arquivo existe: " . (file_exists($temp_pdf) ? 'SIM' : 'NÃO'));
        @unlink($temp_html);
        @unlink($temp_pdf);
        return null;
    }
}

/**
 * Gerar HTML do PDF (versão interna)
 * ✅ MESMO LAYOUT DA IMPRESSÃO DO MAPA!
 */
function gerarHtmlPdfInterno($orcamento, $fornecedores, $itens, $dominio) {
    global $g_sql;
    
    $nro_orcamento_completo = $orcamento['unidade'] . str_pad($orcamento['nro_orcamento'], 7, '0', STR_PAD_LEFT);
    $data_atual = date('d/m/Y');
    $hora_atual = date('H:i');
    
    // ✅ BUSCAR LOGO DO CLIENTE DA TABELA DOMAINS
    $query_domain = "SELECT name, logo_light FROM domains WHERE domain = $1";
    $result_domain = sql($g_sql, $query_domain, false, array(strtoupper($dominio)));
    $domain_data = pg_fetch_assoc($result_domain);
    
    $nome_empresa = $domain_data['name'] ?? 'Transportadora';
    $logo_cliente_url = $domain_data['logo_light'] ?? 'https://webpresto.com.br/images/logo_rel.png';
    
    // ✅ CARREGAR IMAGENS E CONVERTER PARA BASE64
    $logoPrestoBase64 = carregarImagemBase64('https://webpresto.com.br/images/logo_rel.png');
    $logoClienteBase64 = carregarImagemBase64($logo_cliente_url);
    
    // ✅ REGRA: Inverter logos (Empresa na esquerda, Presto na direita)
    // ✅ REGRA ACV: Para o domínio ACV, a logo da Presto não deve ser exibida.
    $is_aceville = (strtoupper($dominio) === 'ACV');
    
    // Cabeçalho Texto: [nome da empresa] by PRESTO (exceto ACV)
    $cabecalho_texto = $is_aceville ? $nome_empresa : $nome_empresa . ' by PRESTO';

    // Montar HTML do Cabeçalho baseado nas regras
    $html_header = '
    <table class="header-table" style="width: 100%; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #2563eb;">
        <tr>
            <td style="width: 50%;">
                <table style="border-collapse: collapse;">
                    <tr>
                        <td>' . ($logoClienteBase64 ? '<img src="data:image/png;base64,' . $logoClienteBase64 . '" class="logo" width="100" height="40" style="width: 100px; height: 40px; object-fit: contain;">' : '') . '</td>
                        <td style="padding-left: 15px;">
                            <h1 style="font-size: 18pt; font-weight: bold; margin: 0; color: #1e40af; text-transform: uppercase;">MAPA DE COTAÇÃO</h1>
                            <p style="font-size: 10pt; color: #6b7280; margin: 3px 0 0 0;">' . $cabecalho_texto . '</p>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; text-align: right;">
                ' . (!$is_aceville && $logoPrestoBase64 ? '<img src="data:image/png;base64,' . $logoPrestoBase64 . '" class="logo-presto" width="100" height="40" style="width: 100px; height: 40px; object-fit: contain;">' : '') . '
            </td>
        </tr>
    </table>';

    // Calcular totais
    $totalEstoque = 0;
    $totalSelecionado = 0;
    
    foreach ($itens as $item) {
        $totalEstoque += $item['vlr_estoque'] * $item['qtde_item'];
        
        foreach ($item['cotacoes'] as $cot) {
            if ($cot['selecionado'] === 'S' && $cot['vlr_fornecedor']) {
                $totalSelecionado += $cot['vlr_fornecedor'] * $item['qtde_item'];
            }
        }
    }
    
    $economia = $totalEstoque - $totalSelecionado;
    $percentual = $totalEstoque > 0 ? (($economia / $totalEstoque) * 100) : 0;
    
    // ✅ Construir HTML da tabela (igual ao TypeScript)
    $tabelaHTML = '';
    $index = 0;
    foreach ($itens as $item) {
        $linhaCotacoes = '';
        
        foreach ($fornecedores as $forn) {
            $cotacao = null;
            foreach ($item['cotacoes'] as $c) {
                if ($c['seq_fornecedor'] == $forn['seq_fornecedor']) {
                    $cotacao = $c;
                    break;
                }
            }
            
            $temValor = $cotacao && $cotacao['vlr_fornecedor'] > 0;
            $selecionado = $cotacao && $cotacao['selecionado'] === 'S';
            
            $bgColor = $selecionado ? '#d1fae5' : ($temValor ? '#fff' : '#f3f4f6');
            $fontWeight = $selecionado ? 'bold' : 'normal';
            $valor = $temValor ? 'R$ ' . number_format($cotacao['vlr_fornecedor'], 2, ',', '.') . ($selecionado ? ' ✓' : '') : '-';
            
            $linhaCotacoes .= "<td style=\"padding: 4px; border: 1px solid #d1d5db; text-align: center; background-color: {$bgColor}; font-weight: {$fontWeight};\">{$valor}</td>";
        }
        
        $rowBg = ($index % 2 === 0) ? '#fff' : '#f9fafb';
        $tabelaHTML .= "
            <tr style=\"background-color: {$rowBg};\">
                <td style=\"padding: 4px; border: 1px solid #d1d5db; font-weight: bold;\">{$item['codigo']}</td>
                <td style=\"padding: 4px; border: 1px solid #d1d5db; font-size: 7pt;\">{$item['descricao']}</td>
                <td style=\"padding: 4px; border: 1px solid #d1d5db; text-align: center;\">{$item['unidade_medida']}</td>
                <td style=\"padding: 4px; border: 1px solid #d1d5db; text-align: right;\">" . number_format($item['qtde_item'], 2, ',', '.') . "</td>
                <td style=\"padding: 4px; border: 1px solid #d1d5db; text-align: right; font-weight: bold;\">R$ " . number_format($item['vlr_estoque'], 2, ',', '.') . "</td>
                {$linhaCotacoes}
            </tr>
        ";
        $index++;
    }
    
    // ✅ Construir linha de totais por fornecedor
    $linhaTotais = '';
    foreach ($fornecedores as $forn) {
        $totalFornecedor = 0;
        foreach ($itens as $item) {
            foreach ($item['cotacoes'] as $cot) {
                if ($cot['seq_fornecedor'] == $forn['seq_fornecedor'] && $cot['vlr_fornecedor']) {
                    $totalFornecedor += $cot['vlr_fornecedor'] * $item['qtde_item'];
                }
            }
        }
        $linhaTotais .= "<td style=\"padding: 6px 4px; border: 1px solid #d1d5db; text-align: center; background-color: #e5e7eb;\">R$ " . number_format($totalFornecedor, 2, ',', '.') . "</td>";
    }
    
    // ✅ Construir cabeçalhos dos fornecedores
    $cabecalhosFornecedores = '';
    foreach ($fornecedores as $forn) {
        $cabecalhosFornecedores .= "<th style=\"padding: 6px 4px; border: 1px solid #1e40af; text-align: center; font-size: 7pt;\">{$forn['nome']}</th>";
    }
    
    // ✅ HTML EXATAMENTE IGUAL À IMPRESSÃO DO MAPA!
    $html = "
<!DOCTYPE html>
<html>
<head>
    <title>Mapa de Cotação {$nro_orcamento_completo}</title>
    <meta charset=\"UTF-8\">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: Arial, sans-serif; 
            padding: 10mm; 
            font-size: 11pt;
            color: #000;
            background: #fff;
        }
        .logo, .logo-presto {
            width: 100px;
            height: 40px;
            object-fit: contain;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            padding: 10px;
            background-color: #f3f4f6;
            border-radius: 6px;
        }
        table.itens-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            margin-bottom: 20px;
        }
        table.itens-table th {
            background-color: #2563eb;
            color: #fff;
            padding: 6px 4px;
            border: 1px solid #1e40af;
            font-weight: bold;
            text-align: left;
        }
        .resumo {
            margin-top: 20px;
            padding: 12px;
            background-color: #eff6ff;
            border-radius: 6px;
            border: 2px solid #2563eb;
        }
        .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 7pt;
        }
    </style>
</head>
<body>
    {$html_header}

    <table class=\"info-table\">
        <tr>
            <td style=\"width: 33%;\">
                <strong style=\"font-size: 8pt; color: #6b7280;\">ORÇAMENTO:</strong>
                <p style=\"font-size: 10pt; font-weight: bold; margin: 2px 0 0 0;\">{$nro_orcamento_completo}</p>
            </td>
            <td style=\"width: 33%;\">
                <strong style=\"font-size: 8pt; color: #6b7280;\">STATUS:</strong>
                <p style=\"font-size: 10pt; font-weight: bold; margin: 2px 0 0 0;\">{$orcamento['status']}</p>
            </td>
            <td style=\"width: 33%;\">
                <strong style=\"font-size: 8pt; color: #6b7280;\">DATA:</strong>
                <p style=\"font-size: 10pt; font-weight: bold; margin: 2px 0 0 0;\">{$data_atual}</p>
            </td>
        </tr>
    </table>

    <table class=\"itens-table\">
        <thead>
            <tr>
                <th style=\"text-align: left;\">Código</th>
                <th style=\"text-align: left;\">Descrição</th>
                <th style=\"text-align: center;\">UN</th>
                <th style=\"text-align: right;\">Qtd.</th>
                <th style=\"text-align: right;\">Vlr. Estoque</th>
                {$cabecalhosFornecedores}
            </tr>
        </thead>
        <tbody>
            {$tabelaHTML}
        </tbody>
        <tfoot>
            <tr style=\"background-color: #e5e7eb; font-weight: bold;\">
                <td colspan=\"4\" style=\"padding: 6px 4px; border: 1px solid #d1d5db; text-align: right;\">TOTAIS POR FORNECEDOR:</td>
                <td style=\"padding: 6px 4px; border: 1px solid #d1d5db; text-align: right;\">R$ " . number_format($totalEstoque, 2, ',', '.') . "</td>
                {$linhaTotais}
            </tr>
        </tfoot>
    </table>

    <div class=\"resumo\">
        <table style=\"width: 100%; border-collapse: collapse;\">
            <tr>
                <td style=\"width: 25%;\">
                    <strong style=\"font-size: 9pt; color: #6b7280;\">TOTAL ESTIMADO:</strong>
                    <p style=\"font-size: 12pt; font-weight: bold; margin: 3px 0 0 0;\">R$ " . number_format($totalEstoque, 2, ',', '.') . "</p>
                </td>
                <td style=\"width: 25%;\">
                    <strong style=\"font-size: 9pt; color: #6b7280;\">TOTAL SELECIONADO:</strong>
                    <p style=\"font-size: 12pt; font-weight: bold; margin: 3px 0 0 0; color: #059669;\">R$ " . number_format($totalSelecionado, 2, ',', '.') . "</p>
                </td>
                <td style=\"width: 25%;\">
                    <strong style=\"font-size: 9pt; color: #6b7280;\">ECONOMIA:</strong>
                    <p style=\"font-size: 12pt; font-weight: bold; margin: 3px 0 0 0; color: #2563eb;\">R$ " . number_format($economia, 2, ',', '.') . "</p>
                </td>
                <td style=\"width: 25%;\">
                    <strong style=\"font-size: 9pt; color: #6b7280;\">PERCENTUAL:</strong>
                    <p style=\"font-size: 12pt; font-weight: bold; margin: 3px 0 0 0; color: #2563eb;\">" . number_format($percentual, 1, ',', '.') . "%</p>
                </td>
            </tr>
        </table>
    </div>

    <div class=\"footer\">
        <p>Sistema PRESTO - Gestão de Transportadoras | Gerado em " . date('d/m/Y H:i') . "</p>
    </div>
</body>
</html>";
        <tbody>
            {$tabelaHTML}
        </tbody>
        <tfoot>
            <tr style=\"background-color: #f3f4f6; font-weight: bold;\">
                <td colspan=\"5\" style=\"padding: 6px 4px; border: 1px solid #d1d5db; text-align: right;\">TOTAIS:</td>
                {$linhaTotais}
            </tr>
        </tfoot>
    </table>

    <div class=\"resumo\">
        <div class=\"resumo-grid\">
            <div>
                <strong>Valor Estoque:</strong>
                <p>R$ " . number_format($totalEstoque, 2, ',', '.') . "</p>
            </div>
            <div>
                <strong>Valor Selecionado:</strong>
                <p style=\"color: #2563eb;\">R$ " . number_format($totalSelecionado, 2, ',', '.') . "</p>
            </div>
            <div>
                <strong>Economia:</strong>
                <p style=\"color: " . ($economia >= 0 ? '#059669' : '#dc2626') . ";\">" . ($economia >= 0 ? '+' : '') . "R$ " . number_format($economia, 2, ',', '.') . "</p>
            </div>
            <div>
                <strong>Percentual:</strong>
                <p style=\"color: " . ($percentual >= 0 ? '#059669' : '#dc2626') . ";\">" . ($percentual >= 0 ? '+' : '') . number_format($percentual, 1, ',', '.') . "%</p>
            </div>
        </div>
    </div>

    <div class=\"footer\">
        <p>Impresso em {$data_atual} às {$hora_atual} - Sistema PRESTO</p>
    </div>
</body>
</html>
    ";
    
    return $html;
}

/**
 * Carregar imagem de URL e converter para base64
 */
function carregarImagemBase64($url) {
    error_log("🖼️ [PDF] Tentando carregar imagem: " . $url);
    
    // Desabilitar warnings do file_get_contents
    $imageData = @file_get_contents($url);
    
    if ($imageData === false || empty($imageData)) {
        error_log("❌ [PDF] Falha ao carregar imagem: " . $url);
        return null;
    }
    
    $base64 = base64_encode($imageData);
    error_log("✅ [PDF] Imagem carregada com sucesso! Tamanho: " . strlen($imageData) . " bytes");
    
    return $base64;
}