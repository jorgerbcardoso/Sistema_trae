<?php
/**
 * API: Aprovação de Orçamento
 * Descrição: Gerencia a aprovação/rejeição de orçamentos
 * Métodos: GET (listar pendentes), PUT (aprovar), DELETE (rejeitar), POST (estornar aprovação)
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';
require_once '/var/www/html/sistema/api/services/EmailService.php'; // ✅ EmailService

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

if ($method === 'GET') {
    // Listar orçamentos pendentes
    listarOrcamentosPendentes($g_sql, $prefix);
} elseif ($method === 'PUT') {
    // Aprovar orçamento
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        aprovarOrcamento($g_sql, $prefix, $data, $username);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro interno: ' . $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    // Rejeitar orçamento
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        rejeitarOrcamento($g_sql, $prefix, $data, $username);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro interno: ' . $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    // Estornar aprovação do orçamento
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        estornarAprovacao($g_sql, $prefix, $data, $username);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro interno: ' . $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

/**
 * Listar orçamentos pendentes
 */
function listarOrcamentosPendentes($g_sql, $prefix) {
    $tabela_orcamento = $prefix . 'orcamento';
    
    // Verificar se orçamento existe e está pendente
    $query_check = "SELECT * FROM {$tabela_orcamento} WHERE status = 'PENDENTE'";
    $result_check = sql($g_sql, $query_check, false, array());
    
    if (pg_num_rows($result_check) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Nenhum orçamento pendente encontrado']);
        return;
    }
    
    $orcamentos = array();
    
    while ($orcamento = pg_fetch_assoc($result_check)) {
        $orcamentos[] = $orcamento;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Orçamentos pendentes listados com sucesso',
        'orcamentos' => $orcamentos
    ]);
}

/**
 * Aprovar orçamento e gerar pedidos
 */
function aprovarOrcamento($g_sql, $prefix, $data, $username) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    
    if (!$seq_orcamento) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não informado']);
        return;
    }
    
    // ✅ VALIDAR PERMISSÃO DO USUÁRIO
    // Extrair domínio do prefix (remover underscore)
    $dominio = rtrim($prefix, '_');
    
    $query_user = "SELECT aprova_orcamento FROM users WHERE LOWER(domain) = LOWER($1) AND LOWER(username) = LOWER($2)";
    $result_user = sql($g_sql, $query_user, false, array($dominio, $username));
    
    if (pg_num_rows($result_user) === 0) {
        msg('Usuário não encontrado no sistema.', 'erro');
        return;
    }
    
    $user_data = pg_fetch_assoc($result_user);
    
    // Converter para boolean (PostgreSQL retorna 't' ou 'f' como string)
    $aprova_orcamento = ($user_data['aprova_orcamento'] === 't' || $user_data['aprova_orcamento'] === true);
    
    if (!$aprova_orcamento) {
        msg('Usuário sem permissão para aprovar orçamentos.', 'erro');
        return;
    }
    
    $tabela_orcamento = $prefix . 'orcamento';
    $tabela_cotacao = $prefix . 'orcamento_cotacao';
    $tabela_pedido = $prefix . 'pedido';
    $tabela_pedido_item = $prefix . 'pedido_item';
    $tabela_fornecedor = $prefix . 'fornecedor';  // ✅ Adicionado
    $tabela_item = $prefix . 'item';  // ✅ Adicionado
    
    // Verificar se orçamento existe e está pendente
    $query_check = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result_check = sql($g_sql, $query_check, false, array($seq_orcamento));
    
    if (pg_num_rows($result_check) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado']);
        return;
    }
    
    $orcamento = pg_fetch_assoc($result_check);
    
    if ($orcamento['status'] !== 'PENDENTE') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento já foi finalizado ou cancelado']);
        return;
    }
    
    // Buscar cotações selecionadas agrupadas por fornecedor
    $query_cotacoes = "SELECT 
                        c.seq_fornecedor,
                        c.seq_ordem_compra,
                        c.seq_item,
                        c.qtde_item,
                        c.vlr_fornecedor,
                        c.vlr_total
                      FROM {$tabela_cotacao} c
                      WHERE c.seq_orcamento = $1 AND c.selecionado = 'S'
                      ORDER BY c.seq_fornecedor";
    
    $result_cotacoes = sql($g_sql, $query_cotacoes, false, array($seq_orcamento));
    
    if (pg_num_rows($result_cotacoes) === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nenhuma cotação selecionada']);
        return;
    }
    
    // Agrupar cotações por fornecedor
    $cotacoesPorFornecedor = array();
    
    while ($cotacao = pg_fetch_assoc($result_cotacoes)) {
        $seq_fornecedor = $cotacao['seq_fornecedor'];
        
        if (!isset($cotacoesPorFornecedor[$seq_fornecedor])) {
            $cotacoesPorFornecedor[$seq_fornecedor] = array();
        }
        
        $cotacoesPorFornecedor[$seq_fornecedor][] = $cotacao;
    }
    
    $pedidos_gerados = array();
    
    // Gerar um pedido para cada fornecedor
    foreach ($cotacoesPorFornecedor as $seq_fornecedor => $cotacoes) {
        // Gerar número do pedido (numérico sequencial por unidade)
        $query_max = "SELECT COALESCE(MAX(nro_pedido::INTEGER), 0) + 1 AS proximo
                      FROM {$tabela_pedido}
                      WHERE unidade = $1";
        $result_max = sql($g_sql, $query_max, false, array($orcamento['unidade']));
        $row_max = pg_fetch_assoc($result_max);
        $nro_pedido = $row_max['proximo'];
        
        // Calcular valor total do pedido
        $vlr_total_pedido = 0;
        foreach ($cotacoes as $cot) {
            $vlr_total_pedido += floatval($cot['vlr_total']);
        }
        
        // Inserir pedido
        $query_pedido = "INSERT INTO {$tabela_pedido}
                         (unidade, nro_pedido, seq_orcamento, seq_fornecedor, status, observacao, vlr_total, nro_lancto, login_inclusao)
                         VALUES ($1, $2, $3, $4, 'P', '', $5, 0, $6)
                         RETURNING seq_pedido";
        
        $params_pedido = array(
            $orcamento['unidade'],
            $nro_pedido,
            $seq_orcamento,
            $seq_fornecedor,
            $vlr_total_pedido,
            $username
        );
        
        $result_pedido = sql($g_sql, $query_pedido, false, $params_pedido);
        $row_pedido = pg_fetch_assoc($result_pedido);
        $seq_pedido = $row_pedido['seq_pedido'];
        
        // Inserir itens do pedido
        foreach ($cotacoes as $cot) {
            // ✅ CRÍTICO: CALCULAR vlr_total no BACKEND (qtde * vlr_unitario)
            $qtde_item = floatval($cot['qtde_item']);
            $vlr_fornecedor = floatval($cot['vlr_fornecedor']);
            $vlr_total_item_calculado = $qtde_item * $vlr_fornecedor;
            
            $query_item = "INSERT INTO {$tabela_pedido_item}
                           (seq_pedido, seq_item, qtde_item, vlr_unitario, vlr_total)
                           VALUES ($1, $2, $3, $4, $5)";
            
            $params_item = array(
                $seq_pedido,
                $cot['seq_item'],
                $qtde_item,
                $vlr_fornecedor,
                $vlr_total_item_calculado  // ✅ USAR VALOR CALCULADO
            );
            
            sql($g_sql, $query_item, false, $params_item);
            
            // ✅ ATUALIZAR seq_pedido NA TABELA ordem_compra
            if (isset($cot['seq_ordem_compra']) && $cot['seq_ordem_compra'] > 0) {
                $query_update_oc = "UPDATE {$prefix}ordem_compra SET seq_pedido = $1 WHERE seq_ordem_compra = $2";
                sql($g_sql, $query_update_oc, false, array($seq_pedido, $cot['seq_ordem_compra']));
            }
            
            // ✅ ATUALIZAR VALOR UNITÁRIO DO ITEM NA TABELA item
            if ($cot['vlr_fornecedor'] > 0) {
                $query_update_item = "UPDATE {$tabela_item} SET vlr_item = $1 WHERE seq_item = $2";
                $result_update_item = sql($g_sql, $query_update_item, false, array($cot['vlr_fornecedor'], $cot['seq_item']));
                
                if (!$result_update_item) {
                    error_log("⚠️ Erro ao atualizar vlr_item para seq_item: " . $cot['seq_item']);
                } else {
                    error_log("✅ vlr_item atualizado para seq_item " . $cot['seq_item'] . ": " . $cot['vlr_fornecedor']);
                }
            }
        }
        
        // ✅ CRÍTICO: RECALCULAR vlr_total do PEDIDO após inserir todos os itens
        $query_recalcular_pedido = "
            UPDATE {$tabela_pedido}
            SET vlr_total = (
                SELECT COALESCE(SUM(vlr_total), 0)
                FROM {$tabela_pedido_item}
                WHERE seq_pedido = $1
            )
            WHERE seq_pedido = $1
        ";
        sql($g_sql, $query_recalcular_pedido, false, array($seq_pedido));
        
        // ✅ Buscar nome do fornecedor
        $query_fornecedor = "SELECT nome, email FROM {$tabela_fornecedor} WHERE seq_fornecedor = $1";
        $result_fornecedor = sql($g_sql, $query_fornecedor, false, array($seq_fornecedor));
        $fornecedor = pg_fetch_assoc($result_fornecedor);
        $fornecedor_nome = $fornecedor ? $fornecedor['nome'] : 'FORNECEDOR NÃO ENCONTRADO';
        $fornecedor_email = $fornecedor ? $fornecedor['email'] : '';
        
        // ✅ Formatar número do pedido (XXX0000000 - 7 dígitos)
        $nro_pedido_formatado = $orcamento['unidade'] . str_pad($nro_pedido, 7, '0', STR_PAD_LEFT);
        
        $pedidos_gerados[] = array(
            'seq_pedido' => $seq_pedido,
            'nro_pedido' => $nro_pedido,
            'nro_pedido_formatado' => $nro_pedido_formatado,  // ✅ Campo formatado
            'unidade' => $orcamento['unidade'],
            'seq_fornecedor' => $seq_fornecedor,
            'fornecedor_nome' => $fornecedor_nome,  // ✅ Nome do fornecedor
            'fornecedor_email' => $fornecedor_email,  // ✅ Email do fornecedor
            'vlr_total' => $vlr_total_pedido
        );
    }
    
    // Atualizar status do orçamento para APROVADO
    $query_update = "UPDATE {$tabela_orcamento}
                     SET status = 'APROVADO',
                         data_aprovacao = CURRENT_DATE,
                         hora_aprovacao = CURRENT_TIME,
                         login_aprovacao = $1
                     WHERE seq_orcamento = $2";
    
    sql($g_sql, $query_update, false, array($username, $seq_orcamento));
    
    // ✅ ENVIAR EMAIL PARA O CRIADOR DO ORÇAMENTO
    try {
        // Buscar email do usuário que criou o orçamento
        $login_criador = strtolower($orcamento['login_inclusao']); // ✅ username sempre em minúsculas
        
        $query_email = "SELECT email, full_name 
                        FROM users 
                        WHERE LOWER(username) = LOWER($1) 
                        AND LOWER(domain) = LOWER($2)";
        $result_email = sql($g_sql, $query_email, false, array($login_criador, $dominio));
        
        if (pg_num_rows($result_email) > 0) {
            $user_criador = pg_fetch_assoc($result_email);
            $email_criador = $user_criador['email'];
            $nome_criador = $user_criador['full_name'];
            
            if (!empty($email_criador)) {
                // Enviar email de notificação
                $emailService = new EmailService();
                $emailService->sendOrcamentoAprovado(
                    $email_criador, 
                    $nome_criador, 
                    $orcamento['nro_orcamento'],  // ✅ Número numérico (EmailService formata para 6 dígitos)
                    $orcamento['unidade'], 
                    $username,  // Nome do aprovador
                    $pedidos_gerados,
                    $dominio,
                    $username
                );
            }
        }
    } catch (Exception $e) {
        // ✅ Não interromper o fluxo se o email falhar
        // O orçamento já foi aprovado e os pedidos já foram gerados
        error_log("Erro ao enviar email de aprovação: " . $e->getMessage());
    }
    
    // ✅ RETORNAR JSON (sem msg)
    echo json_encode([
        'success' => true,
        'message' => 'Orçamento aprovado! ' . count($pedidos_gerados) . ' pedido(s) gerado(s) com sucesso!',
        'pedidos_gerados' => $pedidos_gerados
    ]);
}

/**
 * Rejeitar orçamento
 */
function rejeitarOrcamento($g_sql, $prefix, $data, $username) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    
    if (!$seq_orcamento) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não informado']);
        return;
    }
    
    $tabela_orcamento = $prefix . 'orcamento';
    
    // Verificar se orçamento existe e está pendente
    $query_check = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result_check = sql($g_sql, $query_check, false, array($seq_orcamento));
    
    if (pg_num_rows($result_check) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado']);
        return;
    }
    
    $orcamento = pg_fetch_assoc($result_check);
    
    if ($orcamento['status'] !== 'PENDENTE') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento já foi finalizado ou cancelado']);
        return;
    }
    
    // Atualizar status do orçamento para REJEITADO
    $query_update = "UPDATE {$tabela_orcamento}
                     SET status = 'REJEITADO',
                         data_rejeicao = CURRENT_DATE,
                         hora_rejeicao = CURRENT_TIME,
                         login_rejeicao = $1
                     WHERE seq_orcamento = $2";
    
    sql($g_sql, $query_update, false, array($username, $seq_orcamento));
    
    // ✅ RETORNAR JSON (sem msg)
    echo json_encode([
        'success' => true,
        'message' => 'Orçamento rejeitado com sucesso!'
    ]);
}

/**
 * Estornar aprovação do orçamento
 */
function estornarAprovacao($g_sql, $prefix, $data, $username) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    
    if (!$seq_orcamento) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não informado']);
        return;
    }
    
    $tabela_orcamento = $prefix . 'orcamento';
    $tabela_pedido = $prefix . 'pedido';
    $tabela_pedido_item = $prefix . 'pedido_item';
    
    // Verificar se orçamento existe e está aprovado
    $query_check = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result_check = sql($g_sql, $query_check, false, array($seq_orcamento));
    
    if (pg_num_rows($result_check) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado']);
        return;
    }
    
    $orcamento = pg_fetch_assoc($result_check);
    
    if ($orcamento['status'] !== 'APROVADO') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não está aprovado']);
        return;
    }
    
    // Buscar pedidos gerados pelo orçamento
    $query_pedidos = "SELECT * FROM {$tabela_pedido} WHERE seq_orcamento = $1";
    $result_pedidos = sql($g_sql, $query_pedidos, false, array($seq_orcamento));
    
    if (pg_num_rows($result_pedidos) === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nenhum pedido gerado para este orçamento']);
        return;
    }
    
    // ✅ CRÍTICO: Verificar se algum pedido está ENTREGUE
    $pedidos = array();
    while ($pedido = pg_fetch_assoc($result_pedidos)) {
        if ($pedido['status'] === 'E') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Não é possível estornar! O pedido ' . $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT) . ' está ENTREGUE.'
            ]);
            return;
        }
        $pedidos[] = $pedido;
    }
    
    // Excluir itens dos pedidos
    foreach ($pedidos as $pedido) {
        // ✅ LIMPAR seq_pedido NA TABELA ordem_compra ANTES DE EXCLUIR O PEDIDO
        $query_limpar_oc = "UPDATE {$prefix}ordem_compra SET seq_pedido = NULL WHERE seq_pedido = $1";
        sql($g_sql, $query_limpar_oc, false, array($pedido['seq_pedido']));
        
        $query_delete_items = "DELETE FROM {$tabela_pedido_item} WHERE seq_pedido = $1";
        sql($g_sql, $query_delete_items, false, array($pedido['seq_pedido']));
    }
    
    // Excluir pedidos
    $query_delete_pedidos = "DELETE FROM {$tabela_pedido} WHERE seq_orcamento = $1";
    sql($g_sql, $query_delete_pedidos, false, array($seq_orcamento));
    
    // Atualizar status do orçamento para PENDENTE
    $query_update = "UPDATE {$tabela_orcamento}
                     SET status = 'PENDENTE',
                         data_aprovacao = NULL,
                         hora_aprovacao = NULL,
                         login_aprovacao = NULL
                     WHERE seq_orcamento = $1";
    
    sql($g_sql, $query_update, false, array($seq_orcamento));
    
    // ✅ RETORNAR JSON (sem msg)
    echo json_encode([
        'success' => true,
        'message' => 'Aprovação do orçamento estornada com sucesso!'
    ]);
}