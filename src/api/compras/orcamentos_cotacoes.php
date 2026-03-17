<?php
/**
 * API: Cotações de Orçamento
 * Descrição: Gerencia a coleta de preços dos fornecedores
 * Métodos: GET (listar), POST (salvar cotações), PUT (atualizar), DELETE (excluir)
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
$g_sql = connect();

// ✅ CORS
setupCORS();
handleOptionsRequest();

// ✅ AUTENTICAÇÃO PADRÃO SSW
requireAuth();
$currentUser = getCurrentUser();

$username = $currentUser['username'];
$dominio = strtolower($currentUser['domain']);

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = $dominio . '_';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['action']) && $_GET['action'] === 'itens-fornecedor') {
                listarItensParaCotacao($g_sql, $dominio, $_GET['seq_orcamento'], $_GET['seq_fornecedor']);
            } else {
                listarCotacoes($g_sql, $dominio, $_GET['seq_orcamento']);
            }
            break;
            
        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            salvarCotacoes($g_sql, $dominio, $data);
            break;
            
        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);
            atualizarSelecao($g_sql, $dominio, $data);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro interno: ' . $e->getMessage()]);
}

/**
 * Listar itens para cotação de um fornecedor específico
 */
function listarItensParaCotacao($g_sql, $dominio, $seq_orcamento, $seq_fornecedor) {
    $tabela_orcamento_oc = $dominio . '_orcamento_ordem_compra';
    $tabela_ordem_item = $dominio . '_ordem_compra_item';
    $tabela_item = $dominio . '_item';
    $tabela_unidade_med = $dominio . '_unidade_medida';
    $tabela_cotacao = $dominio . '_orcamento_cotacao';
    
    // Buscar todos os itens das ordens de compra do orçamento
    $query = "SELECT DISTINCT
                i.seq_item,
                i.codigo,
                i.descricao,
                i.vlr_item AS vlr_estoque,
                um.sigla AS unidade_medida,
                oci.qtde_item,
                oci.seq_ordem_compra,
                c.vlr_fornecedor,
                c.vlr_total,
                c.prazo_entrega,
                c.observacao AS obs_cotacao,
                c.seq_orcamento_cotacao
              FROM {$tabela_orcamento_oc} ooc
              INNER JOIN {$tabela_ordem_item} oci ON ooc.seq_ordem_compra = oci.seq_ordem_compra
              INNER JOIN {$tabela_item} i ON oci.seq_item = i.seq_item
              LEFT JOIN {$tabela_unidade_med} um ON i.seq_unidade_medida = um.seq_unidade_medida
              LEFT JOIN {$tabela_cotacao} c ON c.seq_orcamento = ooc.seq_orcamento 
                  AND c.seq_fornecedor = $2 
                  AND c.seq_item = i.seq_item
                  AND c.seq_ordem_compra = oci.seq_ordem_compra
              WHERE ooc.seq_orcamento = $1
              ORDER BY i.codigo";
    
    $result = sql($g_sql, $query, false, array($seq_orcamento, $seq_fornecedor));
    
    $itens = array();
    while ($row = pg_fetch_assoc($result)) {
        $itens[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $itens
    ]);
}

/**
 * Listar todas as cotações de um orçamento
 */
function listarCotacoes($g_sql, $dominio, $seq_orcamento) {
    $tabela_cotacao = $dominio . '_orcamento_cotacao';
    $tabela_fornecedor = $dominio . '_fornecedor';
    $tabela_item = $dominio . '_item';
    
    $query = "SELECT 
                c.*,
                f.nome AS fornecedor_nome,
                i.codigo AS item_codigo,
                i.descricao AS item_descricao
              FROM {$tabela_cotacao} c
              INNER JOIN {$tabela_fornecedor} f ON c.seq_fornecedor = f.seq_fornecedor
              INNER JOIN {$tabela_item} i ON c.seq_item = i.seq_item
              WHERE c.seq_orcamento = $1
              ORDER BY c.seq_fornecedor, i.codigo";
    
    $result = sql($g_sql, $query, false, array($seq_orcamento));
    
    $cotacoes = array();
    while ($row = pg_fetch_assoc($result)) {
        $cotacoes[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $cotacoes
    ]);
}

/**
 * Salvar cotações de um fornecedor
 */
function salvarCotacoes($g_sql, $dominio, $data) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    $seq_fornecedor = $data['seq_fornecedor'] ?? null;
    $cotacoes = $data['cotacoes'] ?? array();
    
    if (!$seq_orcamento || !$seq_fornecedor || empty($cotacoes)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos']);
        return;
    }
    
    $tabela_cotacao = $dominio . '_orcamento_cotacao';
    $tabela_orcamento_forn = $dominio . '_orcamento_fornecedor';
    
    // Processar cada cotação
    foreach ($cotacoes as $cotacao) {
        $seq_ordem_compra = $cotacao['seq_ordem_compra'];
        $seq_item = $cotacao['seq_item'];
        $qtde_item = $cotacao['qtde_item'];
        $vlr_estoque = $cotacao['vlr_estoque'] ?? 0;
        $vlr_fornecedor = $cotacao['vlr_fornecedor'] ?? null;
        $prazo_entrega = $cotacao['prazo_entrega'] ?? null;
        $observacao = isset($cotacao['observacao']) ? strtoupper(trim($cotacao['observacao'])) : '';
        
        // Se não informou valor, não salvar (fornecedor não tem o item)
        if ($vlr_fornecedor === null || $vlr_fornecedor <= 0) {
            continue;
        }
        
        $vlr_total = $vlr_fornecedor * $qtde_item;
        
        // Verificar se já existe
        $query_check = "SELECT seq_orcamento_cotacao 
                        FROM {$tabela_cotacao}
                        WHERE seq_orcamento = $1 
                          AND seq_fornecedor = $2 
                          AND seq_ordem_compra = $3
                          AND seq_item = $4";
        
        $result_check = sql($g_sql, $query_check, false, array(
            $seq_orcamento,
            $seq_fornecedor,
            $seq_ordem_compra,
            $seq_item
        ));
        
        if (pg_num_rows($result_check) > 0) {
            // Atualizar
            $row = pg_fetch_assoc($result_check);
            $seq_orcamento_cotacao = $row['seq_orcamento_cotacao'];
            
            $query = "UPDATE {$tabela_cotacao}
                      SET qtde_item = $1,
                          vlr_estoque = $2,
                          vlr_fornecedor = $3,
                          vlr_total = $4,
                          prazo_entrega = $5,
                          observacao = $6
                      WHERE seq_orcamento_cotacao = $7";
            
            sql($g_sql, $query, false, array(
                $qtde_item,
                $vlr_estoque,
                $vlr_fornecedor,
                $vlr_total,
                $prazo_entrega,
                $observacao,
                $seq_orcamento_cotacao
            ));
        } else {
            // Inserir
            $query = "INSERT INTO {$tabela_cotacao}
                      (seq_orcamento, seq_fornecedor, seq_ordem_compra, seq_item, 
                       qtde_item, vlr_estoque, vlr_fornecedor, vlr_total, 
                       prazo_entrega, observacao, selecionado)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'N')";
            
            sql($g_sql, $query, false, array(
                $seq_orcamento,
                $seq_fornecedor,
                $seq_ordem_compra,
                $seq_item,
                $qtde_item,
                $vlr_estoque,
                $vlr_fornecedor,
                $vlr_total,
                $prazo_entrega,
                $observacao
            ));
        }
    }
    
    // Atualizar status do fornecedor para CONCLUIDO se informou preços
    $query_update_forn = "UPDATE {$tabela_orcamento_forn}
                          SET status = 'CONCLUIDO',
                              data_retorno = CURRENT_DATE,
                              hora_retorno = CURRENT_TIME
                          WHERE seq_orcamento = $1 AND seq_fornecedor = $2";
    
    sql($g_sql, $query_update_forn, false, array($seq_orcamento, $seq_fornecedor));
    
    msg('S', 'Cotação salva com sucesso!');
    echo json_encode([
        'success' => true,
        'message' => 'Cotação salva com sucesso'
    ]);
}

/**
 * Atualizar seleção de cotações (campo selecionado no mapa)
 */
function atualizarSelecao($g_sql, $dominio, $data) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    $selecoes = $data['selecoes'] ?? array();
    
    if (!$seq_orcamento || empty($selecoes)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos']);
        return;
    }
    
    $tabela_cotacao = $dominio . '_orcamento_cotacao';
    
    // Primeiro, desmarcar todas as cotações do orçamento
    $query_desmarcar = "UPDATE {$tabela_cotacao}
                        SET selecionado = 'N'
                        WHERE seq_orcamento = $1";
    
    sql($g_sql, $query_desmarcar, false, array($seq_orcamento));
    
    // Marcar as cotações selecionadas
    foreach ($selecoes as $selecao) {
        $seq_orcamento_cotacao = $selecao['seq_orcamento_cotacao'];
        
        $query = "UPDATE {$tabela_cotacao}
                  SET selecionado = 'S'
                  WHERE seq_orcamento_cotacao = $1";
        
        sql($g_sql, $query, false, array($seq_orcamento_cotacao));
    }
    
    msg('S', 'Seleções salvas com sucesso!');
    echo json_encode([
        'success' => true,
        'message' => 'Seleções salvas com sucesso'
    ]);
}