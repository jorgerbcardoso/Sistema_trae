<?php
/**
 * API COMPRAS - ORÇAMENTOS
 * Gerencia orçamentos, coleta de preços e aprovação
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();
    
// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($currentUser['domain']);
$tblOrcamento = $prefix . '_orcamento';
$tblOrcamentoItem = $prefix . '_orcamento_item';
$tblOrcamentoFornecedor = $prefix . '_orcamento_fornecedor';
$tblOrcamentoCotacao = $prefix . '_orcamento_cotacao';
$tblOrcamentoOrdemCompra = $prefix . '_orcamento_ordem_compra';
$tblOrdemCompra = $prefix . '_ordem_compra';
$tblOrdemCompraItem = $prefix . '_ordem_compra_item';
$tblFornecedor = $prefix . '_fornecedor';
$tblItem = $prefix . '_item';
$tblUnidadeMedida = $prefix . '_unidade_medida';

// ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            if (isset($_GET['seq_orcamento'])) {
                // Buscar orçamento específico com ordens e fornecedores
                $seq = intval($_GET['seq_orcamento']);
                
                $query = "SELECT * FROM $tblOrcamento WHERE seq_orcamento = $1";
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql($query, [$seq], $g_sql);
                
                if (pg_num_rows($result) > 0) {
                    $orcamento = pg_fetch_assoc($result);
                    
                    // Buscar ordens de compra do orçamento
                    $queryOrdens = "SELECT oo.*, o.nro_ordem_compra, o.observacao as ordem_obs
                                   FROM $tblOrcamentoOrdemCompra oo
                                   INNER JOIN $tblOrdemCompra o ON oo.seq_ordem_compra = o.seq_ordem_compra
                                   WHERE oo.seq_orcamento = $1";
                    
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    $resultOrdens = sql($queryOrdens, [$seq], $g_sql);
                    $ordens = [];
                    
                    while ($ordem = pg_fetch_assoc($resultOrdens)) {
                        // Buscar itens da ordem
                        $queryItens = "SELECT oi.*, i.codigo, i.descricao as item_descricao, u.sigla as unidade_medida
                                      FROM $tblOrdemCompraItem oi
                                      INNER JOIN $tblItem i ON oi.seq_item = i.seq_item
                                      LEFT JOIN $tblUnidadeMedida u ON i.seq_unidade_medida = u.seq_unidade_medida
                                      WHERE oi.seq_ordem_compra = $1";
                        
                        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                        $resultItens = sql($queryItens, [$ordem['seq_ordem_compra']], $g_sql);
                        $itens = [];
                        
                        while ($item = pg_fetch_assoc($resultItens)) {
                            $itens[] = $item;
                        }
                        
                        $ordem['itens'] = $itens;
                        $ordens[] = $ordem;
                    }
                    
                    $orcamento['ordens'] = $ordens;
                    
                    // Buscar fornecedores do orçamento
                    $queryForn = "SELECT of.*, f.nome as fornecedor_nome, f.cnpj, f.email as fornecedor_email
                                 FROM $tblOrcamentoFornecedor of
                                 INNER JOIN $tblFornecedor f ON of.seq_fornecedor = f.seq_fornecedor
                                 WHERE of.seq_orcamento = $1";
                    
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    $resultForn = sql($queryForn, [$seq], $g_sql);
                    $fornecedores = [];
                    
                    while ($forn = pg_fetch_assoc($resultForn)) {
                        $fornecedores[] = $forn;
                    }
                    
                    $orcamento['fornecedores'] = $fornecedores;
                    
                    // Buscar cotações
                    $queryCot = "SELECT oc.*, f.nome as fornecedor_nome, i.codigo, i.descricao as item_descricao
                                FROM $tblOrcamentoCotacao oc
                                INNER JOIN $tblFornecedor f ON oc.seq_fornecedor = f.seq_fornecedor
                                INNER JOIN $tblItem i ON oc.seq_item = i.seq_item
                                WHERE oc.seq_orcamento = $1
                                ORDER BY oc.seq_item, oc.vlr_fornecedor";
                    
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    $resultCot = sql($queryCot, [$seq], $g_sql);
                    $cotacoes = [];
                    
                    while ($cot = pg_fetch_assoc($resultCot)) {
                        $cotacoes[] = $cot;
                    }
                    
                    $orcamento['cotacoes'] = $cotacoes;
                    
                    echo json_encode(['success' => true, 'data' => $orcamento]);
                } else {
                    msg('Orçamento não encontrado');
                }
            } else {
                // Listar orçamentos
                $where = ['1=1'];
                $params = [];
                $paramCount = 1;
                
                if (isset($_GET['unidade']) && !empty($_GET['unidade'])) {
                    $where[] = "unidade = $" . $paramCount++;
                    $params[] = $_GET['unidade'];
                }
                
                if (isset($_GET['status']) && !empty($_GET['status'])) {
                    $where[] = "status = $" . $paramCount++;
                    $params[] = $_GET['status'];
                }
                
                $whereClause = implode(' AND ', $where);
                
                $query = "SELECT * FROM $tblOrcamento 
                          WHERE $whereClause
                          ORDER BY data_inclusao DESC, hora_inclusao DESC
                          LIMIT 100";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql($query, $params, $g_sql);
                $orcamentos = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    // Contar ordens
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    $countOrdens = sql("SELECT COUNT(*) as total FROM $tblOrcamentoOrdemCompra WHERE seq_orcamento = $1", 
                                      [$row['seq_orcamento']], $g_sql);
                    $row['total_ordens'] = pg_fetch_assoc($countOrdens)['total'];
                    
                    // Contar fornecedores
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    $countForn = sql("SELECT COUNT(*) as total FROM $tblOrcamentoFornecedor WHERE seq_orcamento = $1", 
                                    [$row['seq_orcamento']], $g_sql);
                    $row['total_fornecedores'] = pg_fetch_assoc($countForn)['total'];
                    
                    $orcamentos[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $orcamentos]);
            }
            break;
            
        case 'POST':
            $acao = strtoupper(trim($input['acao'] ?? 'CRIAR'));
            
            if ($acao == 'CRIAR') {
                // CRIAR NOVO ORÇAMENTO
                $unidade = strtoupper(trim($input['unidade'] ?? ''));
                $observacao = trim($input['observacao'] ?? '');
                $ordens = $input['ordens'] ?? []; // Array de seq_ordem_compra
                $fornecedores = $input['fornecedores'] ?? []; // Array de seq_fornecedor
                
                if (empty($unidade)) {
                    msg('Unidade é obrigatória');
                }
                
                if (empty($ordens)) {
                    msg('Selecione pelo menos uma ordem de compra');
                }
                
                if (empty($fornecedores)) {
                    msg('Selecione pelo menos um fornecedor');
                }
                
                // Iniciar transação
                sql("BEGIN", [], $g_sql);
                
                try {
                    // Gerar número do orçamento
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    $resultSeq = sql("SELECT COALESCE(MAX(CAST(SUBSTRING(nro_orcamento FROM 1) AS INTEGER)), 0) + 1 as proximo 
                                              FROM $tblOrcamento WHERE unidade = $1", [$unidade], $g_sql);
                    $nro_orcamento = str_pad(pg_fetch_assoc($resultSeq)['proximo'], 6, '0', STR_PAD_LEFT);
                    
                    // Criar orçamento
                    $query = "INSERT INTO $tblOrcamento (unidade, nro_orcamento, observacao, login_inclusao) 
                              VALUES ($1, $2, $3, $4) RETURNING seq_orcamento";
                    
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    $result = sql($query, [$unidade, $nro_orcamento, $observacao, $currentUser['username']], $g_sql);
                    $seq_orcamento = pg_fetch_assoc($result)['seq_orcamento'];
                    
                    // Vincular ordens de compra
                    foreach ($ordens as $seq_ordem_compra) {
                        $queryOrdem = "INSERT INTO $tblOrcamentoOrdemCompra (seq_orcamento, seq_ordem_compra) 
                                      VALUES ($1, $2)";
                        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                        sql($queryOrdem, [$seq_orcamento, intval($seq_ordem_compra)], $g_sql);
                    }
                    
                    // Vincular fornecedores
                    foreach ($fornecedores as $forn) {
                        $seq_fornecedor = intval($forn['seq_fornecedor'] ?? $forn);
                        $email = trim($forn['email'] ?? '');
                        
                        $queryForn = "INSERT INTO $tblOrcamentoFornecedor (seq_orcamento, seq_fornecedor, email, status) 
                                     VALUES ($1, $2, $3, 'PENDENTE')";
                        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                        sql($queryForn, [$seq_orcamento, $seq_fornecedor, $email], $g_sql);
                    }
                    
                    sql("COMMIT", [], $g_sql);
                    
                    echo json_encode(['success' => true, 'seq_orcamento' => $seq_orcamento, 'nro_orcamento' => $nro_orcamento]);
                    
                } catch (Exception $e) {
                    sql("ROLLBACK", [], $g_sql);
                    throw $e;
                }
                
            } elseif ($acao == 'REGISTRAR_COTACAO') {
                // REGISTRAR COTAÇÃO DE FORNECEDOR
                $seq_orcamento = intval($input['seq_orcamento'] ?? 0);
                $seq_fornecedor = intval($input['seq_fornecedor'] ?? 0);
                $cotacoes = $input['cotacoes'] ?? []; // Array com seq_item, seq_ordem_compra, qtde_item, vlr_fornecedor, prazo_entrega
                
                if ($seq_orcamento <= 0 || $seq_fornecedor <= 0 || empty($cotacoes)) {
                    msg('Dados inválidos');
                }
                
                // Iniciar transação
                sql("BEGIN", [], $g_sql);
                
                try {
                    // Limpar cotações anteriores deste fornecedor
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql("DELETE FROM $tblOrcamentoCotacao WHERE seq_orcamento = $1 AND seq_fornecedor = $2", 
                        [$seq_orcamento, $seq_fornecedor], $g_sql);
                    
                    // Inserir novas cotações
                    foreach ($cotacoes as $cot) {
                        $seq_ordem_compra = intval($cot['seq_ordem_compra']);
                        $seq_item = intval($cot['seq_item']);
                        $qtde_item = floatval($cot['qtde_item']);
                        $vlr_estoque = floatval($cot['vlr_estoque'] ?? 0);
                        $vlr_fornecedor = floatval($cot['vlr_fornecedor'] ?? 0);
                        $prazo_entrega = intval($cot['prazo_entrega'] ?? 0);
                        $obs = trim($cot['observacao'] ?? '');
                        $link = trim($cot['link'] ?? ''); // ✅ NOVO: campo link
                        
                        $vlr_total = $qtde_item * $vlr_fornecedor;
                        
                        $queryCot = "INSERT INTO $tblOrcamentoCotacao 
                                    (seq_orcamento, seq_fornecedor, seq_ordem_compra, seq_item, qtde_item, 
                                     vlr_estoque, vlr_fornecedor, vlr_total, prazo_entrega, observacao, link) 
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)";
                        
                        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                        sql($queryCot, [
                            $seq_orcamento, $seq_fornecedor, $seq_ordem_compra, $seq_item, $qtde_item,
                            $vlr_estoque, $vlr_fornecedor, $vlr_total, $prazo_entrega, $obs, $link
                        ], $g_sql);
                    }
                    
                    // Atualizar status do fornecedor
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql("UPDATE $tblOrcamentoFornecedor SET 
                                status = 'COTADO',
                                data_retorno = CURRENT_DATE,
                                hora_retorno = CURRENT_TIME
                                WHERE seq_orcamento = $1 AND seq_fornecedor = $2", 
                        [$seq_orcamento, $seq_fornecedor], $g_sql);
                    
                    sql("COMMIT", [], $g_sql);
                    
                    echo json_encode(['success' => true]);
                    
                } catch (Exception $e) {
                    sql("ROLLBACK", [], $g_sql);
                    throw $e;
                }
                
            } elseif ($acao == 'APROVAR') {
                // APROVAR ORÇAMENTO E GERAR PEDIDO
                $seq_orcamento = intval($input['seq_orcamento'] ?? 0);
                $cotacoes_selecionadas = $input['cotacoes_selecionadas'] ?? []; // Array de seq_orcamento_cotacao
                
                if ($seq_orcamento <= 0 || empty($cotacoes_selecionadas)) {
                    msg('Selecione as cotações a aprovar');
                }
                
                // Iniciar transação
                sql("BEGIN", [], $g_sql);
                
                try {
                    // Marcar cotações como selecionadas
                    foreach ($cotacoes_selecionadas as $seq_cot) {
                        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                        sql("UPDATE $tblOrcamentoCotacao SET selecionado = 'S' WHERE seq_orcamento_cotacao = $1", 
                            [intval($seq_cot)], $g_sql);
                    }
                    
                    // Marcar orçamento como finalizado
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql("UPDATE $tblOrcamento SET 
                                status = 'FINALIZADO',
                                data_aprovacao = CURRENT_DATE,
                                hora_aprovacao = CURRENT_TIME,
                                login_aprovacao = $1
                                WHERE seq_orcamento = $2", 
                        [$currentUser['username'], $seq_orcamento], $g_sql);
                    
                    sql("COMMIT", [], $g_sql);
                    
                    echo json_encode(['success' => true, 'message' => 'Orçamento aprovado. Pedidos serão gerados automaticamente.']);
                    
                } catch (Exception $e) {
                    sql("ROLLBACK", [], $g_sql);
                    throw $e;
                }
            } else {
                msg('Ação inválida');
            }
            break;
            
        case 'DELETE':
            // CANCELAR ORÇAMENTO
            $seq = intval($input['seq_orcamento'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do orçamento inválido');
            }
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            sql("UPDATE $tblOrcamento SET status = 'CANCELADO' WHERE seq_orcamento = $1", [$seq], $g_sql);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            msg('Método não permitido', 405);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/compras/orcamentos.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}