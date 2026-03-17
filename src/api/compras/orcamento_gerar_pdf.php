<?php
/**
 * API: Gerar PDF do Mapa de Cotação
 * Descrição: Gera PDF do mapa de cotação para anexar em emails
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
        gerarPdfMapa($g_sql, $prefix, $data, $dominio);
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
 * Gerar PDF do mapa de cotação
 */
function gerarPdfMapa($g_sql, $prefix, $data, $dominio) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    
    if (!$seq_orcamento) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não informado']);
        return;
    }
    
    $tabela_orcamento = $prefix . 'orcamento';
    $tabela_cotacao = $prefix . 'orcamento_cotacao';
    $tabela_fornecedores = $prefix . 'orcamento_fornecedores';
    
    // Buscar dados do orçamento
    $query_orcamento = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result_orcamento = sql($g_sql, $query_orcamento, false, array($seq_orcamento));
    
    if (pg_num_rows($result_orcamento) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado']);
        return;
    }
    
    $orcamento = pg_fetch_assoc($result_orcamento);
    
    // Buscar fornecedores do orçamento
    $query_fornecedores = "SELECT f.seq_fornecedor, f.nome
                           FROM {$tabela_fornecedores} of
                           INNER JOIN " . $prefix . "fornecedores f ON f.seq_fornecedor = of.seq_fornecedor
                           WHERE of.seq_orcamento = $1
                           ORDER BY f.nome";
    $result_fornecedores = sql($g_sql, $query_fornecedores, false, array($seq_orcamento));
    
    $fornecedores = array();
    while ($forn = pg_fetch_assoc($result_fornecedores)) {
        $fornecedores[] = $forn;
    }
    
    // Buscar itens da cotação
    $query_cotacoes = "SELECT 
                        oc.seq_item,
                        oc.seq_ordem_compra,
                        oc.seq_fornecedor,
                        oc.vlr_fornecedor,
                        oc.selecionado,
                        i.codigo,
                        i.descricao,
                        i.unidade_medida,
                        oci.qtde_item,
                        oci.vlr_estoque
                       FROM {$tabela_cotacao} oc
                       INNER JOIN " . $prefix . "ordem_compra_item oci 
                           ON oci.seq_item = oc.seq_item AND oci.seq_ordem_compra = oc.seq_ordem_compra
                       INNER JOIN " . $prefix . "itens i ON i.seq_item = oc.seq_item
                       WHERE oc.seq_orcamento = $1
                       ORDER BY i.codigo, oc.seq_ordem_compra, oc.seq_fornecedor";
    
    $result_cotacoes = sql($g_sql, $query_cotacoes, false, array($seq_orcamento));
    
    // Agrupar itens
    $itens = array();
    while ($cotacao = pg_fetch_assoc($result_cotacoes)) {
        $key = $cotacao['codigo'];
        
        if (!isset($itens[$key])) {
            $itens[$key] = array(
                'seq_item' => $cotacao['seq_item'],
                'seq_ordem_compra' => $cotacao['seq_ordem_compra'],
                'codigo' => $cotacao['codigo'],
                'descricao' => $cotacao['descricao'],
                'unidade_medida' => $cotacao['unidade_medida'],
                'qtde_item' => $cotacao['qtde_item'],
                'vlr_estoque' => $cotacao['vlr_estoque'],
                'cotacoes' => array()
            );
        }
        
        $itens[$key]['cotacoes'][] = array(
            'seq_fornecedor' => $cotacao['seq_fornecedor'],
            'vlr_fornecedor' => $cotacao['vlr_fornecedor'],
            'selecionado' => $cotacao['selecionado']
        );
    }
    
    // Gerar HTML do PDF
    $html = gerarHtmlPdf($orcamento, $fornecedores, array_values($itens), $dominio);
    
    // Gerar PDF usando biblioteca TCPDF (se disponível) ou wkhtmltopdf
    // Para simplificar, vou retornar o HTML que pode ser convertido pelo frontend
    // Em produção, usar TCPDF ou DomPDF
    
    // Salvar HTML temporário
    $filename = 'orcamento_' . $orcamento['unidade'] . str_pad($orcamento['nro_orcamento'], 7, '0', STR_PAD_LEFT) . '.html';
    $tempPath = '/tmp/' . $filename;
    file_put_contents($tempPath, $html);
    
    echo json_encode([
        'success' => true,
        'html' => $html,
        'filename' => $filename,
        'temp_path' => $tempPath
    ]);
}

/**
 * Gerar HTML do PDF
 */
function gerarHtmlPdf($orcamento, $fornecedores, $itens, $dominio) {
    $nro_orcamento = $orcamento['unidade'] . str_pad($orcamento['nro_orcamento'], 7, '0', STR_PAD_LEFT);
    $data_inclusao = date('d/m/Y', strtotime($orcamento['data_inclusao']));
    
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
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
            }
            .header h1 {
                margin: 5px 0;
                font-size: 16pt;
            }
            .info {
                margin-bottom: 15px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }
            th, td {
                border: 1px solid #333;
                padding: 5px;
                text-align: left;
            }
            th {
                background-color: #f0f0f0;
                font-weight: bold;
            }
            .text-right {
                text-align: right;
            }
            .text-center {
                text-align: center;
            }
            .total {
                background-color: #e8f4f8;
                font-weight: bold;
            }
            .footer {
                text-align: center;
                font-size: 8pt;
                margin-top: 20px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>MAPA DE COTAÇÃO</h1>
            <p><strong>Orçamento:</strong> ' . $nro_orcamento . ' | <strong>Data:</strong> ' . $data_inclusao . '</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 80px;">Código</th>
                    <th>Descrição</th>
                    <th style="width: 50px;">UN</th>
                    <th class="text-right" style="width: 60px;">Qtde</th>
                    <th class="text-right" style="width: 80px;">Vlr Est.</th>';
    
    foreach ($fornecedores as $forn) {
        $html .= '<th class="text-right" style="width: 80px;">' . substr($forn['nome'], 0, 15) . '</th>';
    }
    
    $html .= '
                </tr>
            </thead>
            <tbody>';
    
    foreach ($itens as $item) {
        $html .= '
                <tr>
                    <td>' . $item['codigo'] . '</td>
                    <td>' . substr($item['descricao'], 0, 50) . '</td>
                    <td class="text-center">' . $item['unidade_medida'] . '</td>
                    <td class="text-right">' . number_format($item['qtde_item'], 2, ',', '.') . '</td>
                    <td class="text-right">R$ ' . number_format($item['vlr_estoque'], 2, ',', '.') . '</td>';
        
        foreach ($fornecedores as $forn) {
            $cotacao = null;
            foreach ($item['cotacoes'] as $cot) {
                if ($cot['seq_fornecedor'] == $forn['seq_fornecedor']) {
                    $cotacao = $cot;
                    break;
                }
            }
            
            if ($cotacao && $cotacao['vlr_fornecedor']) {
                $style = $cotacao['selecionado'] === 'S' ? 'background-color: #d4edda; font-weight: bold;' : '';
                $html .= '<td class="text-right" style="' . $style . '">R$ ' . number_format($cotacao['vlr_fornecedor'], 2, ',', '.') . '</td>';
            } else {
                $html .= '<td class="text-center" style="color: #999;">-</td>';
            }
        }
        
        $html .= '
                </tr>';
    }
    
    $html .= '
            </tbody>
            <tfoot>
                <tr class="total">
                    <td colspan="4" class="text-right"><strong>TOTAIS:</strong></td>
                    <td class="text-right"><strong>R$ ' . number_format($totalEstoque, 2, ',', '.') . '</strong></td>
                    <td colspan="' . count($fornecedores) . '" class="text-right">
                        <strong>Selecionado: R$ ' . number_format($totalSelecionado, 2, ',', '.') . '</strong> | 
                        <strong>Economia: R$ ' . number_format($economia, 2, ',', '.') . ' (' . number_format($percentual, 1, ',', '.') . '%)</strong>
                    </td>
                </tr>
            </tfoot>
        </table>
        
        <div class="footer">
            <p>Sistema PRESTO - Gestão de Transportes | Gerado em ' . date('d/m/Y H:i') . '</p>
        </div>
    </body>
    </html>';
    
    return $html;
}
