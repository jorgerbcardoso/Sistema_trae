<?php
/**
 * API: Aprovação de Ordens de Compra
 * Descrição: Gerencia aprovação, reprovação e estorno de ordens de compra
 * Métodos: GET (listar), PUT (aprovar/reprovar/estornar)
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

$username = $currentUser['username'];
$user_unidade = $currentUser['unidade_atual'] ?? $currentUser['unidade']; // ✅ USAR UNIDADE DO HEADER
$dominio = strtolower($currentUser['domain']);

// ✅ DEBUG: Logar dados do usuário
error_log("=== APROVAÇÃO ORDENS - DEBUG ===");
error_log("Username: " . $username);
error_log("Unidade cadastrada: " . ($currentUser['unidade'] ?? 'VAZIO'));
error_log("Unidade atual (header): " . ($currentUser['unidade_atual'] ?? 'VAZIO'));
error_log("Unidade efetiva (usada): " . $user_unidade);

// ✅ Tratar MTZ e ALL como unidades que veem tudo
$user_unidade_upper = strtoupper($user_unidade);
$isMtzOrAll = ($user_unidade_upper === 'MTZ' || $user_unidade_upper === 'ALL');

error_log("É MTZ/ALL (vê tudo)? " . ($isMtzOrAll ? 'SIM' : 'NÃO'));
error_log("================================");

// Validar domínio
if (empty($dominio)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Domínio não identificado']);
    exit;
}

// ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
$g_sql = connect();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            listarOrdens($g_sql, $dominio, $user_unidade, $isMtzOrAll);
            break;
            
        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);
            aprovarOuEstornar($g_sql, $dominio, $data, $username);
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
 * Listar ordens de compra para aprovação
 */
function listarOrdens($g_sql, $dominio, $user_unidade, $isMtzOrAll) {
    $status = $_GET['status'] ?? 'TODAS';
    $data_inicio = $_GET['data_inicio'] ?? null;
    $data_fim = $_GET['data_fim'] ?? null;
    $unidade_filtro = $_GET['unidade'] ?? null;
    $seq_centro_custo_filtro = $_GET['seq_centro_custo'] ?? null;
    $nro_setor_filtro = $_GET['nro_setor'] ?? null; // ✅ NOVO: Filtro de setor
    
    $tabela_ordem = $dominio . '_ordem_compra';
    $tabela_centro = $dominio . '_centro_custo';
    $tabela_item_ordem = $dominio . '_ordem_compra_item';
    $tabela_setores = $dominio . '_setores';
    
    // Base da query
    $query = "SELECT 
                oc.seq_ordem_compra,
                oc.unidade,
                oc.nro_ordem_compra,
                oc.seq_centro_custo,
                cc.nro_centro_custo,
                cc.descricao AS centro_custo_descricao,
                cc.unidade AS centro_custo_unidade,
                oc.nro_setor,
                s.descricao AS setor_descricao,
                oc.placa,
                oc.aprovada,
                oc.orcar,
                oc.observacao,
                oc.data_inclusao,
                oc.hora_inclusao,
                oc.login_inclusao,
                oc.data_aprovacao,
                oc.hora_aprovacao,
                oc.login_aprovacao,
                oc.motivo_reprovacao,
                (SELECT COUNT(*) FROM {$tabela_item_ordem} WHERE seq_ordem_compra = oc.seq_ordem_compra) AS qtd_itens
              FROM {$tabela_ordem} oc
              LEFT JOIN {$tabela_centro} cc ON oc.seq_centro_custo = cc.seq_centro_custo
              LEFT JOIN {$tabela_setores} s ON s.nro_setor = oc.nro_setor
              WHERE 1=1";
    
    $params = array();
    $param_count = 1;
    
    // Filtro por status
    if ($status === 'PENDENTES') {
        $query .= " AND oc.aprovada = 'N'";
    } elseif ($status === 'APROVADAS') {
        $query .= " AND oc.aprovada = 'S'";
    } elseif ($status === 'REPROVADAS') {
        $query .= " AND oc.aprovada = 'R'";
    }
    
    // Filtro por período
    if ($data_inicio) {
        $query .= " AND oc.data_inclusao >= $" . $param_count;
        $params[] = $data_inicio;
        $param_count++;
    }
    
    if ($data_fim) {
        $query .= " AND oc.data_inclusao <= $" . $param_count;
        $params[] = $data_fim;
        $param_count++;
    }
    
    // Filtro por unidade (do filtro ou permissão do usuário)
    if ($unidade_filtro && $unidade_filtro !== 'TODAS') {
        $query .= " AND cc.unidade = $" . $param_count;
        $params[] = $unidade_filtro;
        $param_count++;
    } elseif (!$isMtzOrAll) {
        // Se não é MTZ/ALL e não tem filtro, usar unidade do usuário
        $query .= " AND cc.unidade = $" . $param_count;
        $params[] = $user_unidade;
        $param_count++;
    }
    
    // Filtro por centro de custo
    if ($seq_centro_custo_filtro && $seq_centro_custo_filtro !== 'TODOS') {
        $query .= " AND oc.seq_centro_custo = $" . $param_count;
        $params[] = $seq_centro_custo_filtro;
        $param_count++;
    }
    
    // Filtro por setor
    if ($nro_setor_filtro && $nro_setor_filtro !== 'TODOS') {
        $query .= " AND oc.nro_setor = $" . $param_count;
        $params[] = $nro_setor_filtro;
        $param_count++;
    }
    
    $query .= " ORDER BY oc.data_inclusao DESC, oc.hora_inclusao DESC";
    
    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
    $result = sql($query, $params, $g_sql);
    
    $ordens = array();
    while ($row = pg_fetch_assoc($result)) {
        $ordens[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $ordens
    ]);
}

/**
 * Aprovar ou estornar aprovação de ordem de compra
 */
function aprovarOuEstornar($g_sql, $dominio, $data, $username) {
    $seq_ordem_compra = $data['seq_ordem_compra'] ?? null;
    $seq_ordens_compra = $data['seq_ordens_compra'] ?? null; // Array de IDs para aprovação em lote
    $acao = $data['acao'] ?? null; // 'aprovar', 'estornar' ou 'reprovar'
    $orcar = $data['orcar'] ?? 'N'; // Só usado na aprovação
    $motivo_reprovacao = $data['motivo_reprovacao'] ?? null; // Só usado na reprovação
    
    if ((!$seq_ordem_compra && !$seq_ordens_compra) || !$acao) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos']);
        return;
    }
    
    // ✅ Validar motivo de reprovação se ação for reprovar
    if ($acao === 'reprovar' && empty($motivo_reprovacao)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Motivo da reprovação é obrigatório']);
        return;
    }
    
    $tabela_ordem = $dominio . '_ordem_compra';
    
    // Se for array, processar em lote
    if ($seq_ordens_compra && is_array($seq_ordens_compra)) {
        $total = count($seq_ordens_compra);
        $sucesso = 0;
        $erros = 0;
        
        foreach ($seq_ordens_compra as $seq_oc) {
            try {
                if ($acao === 'aprovar') {
                    $query = "UPDATE {$tabela_ordem} 
                              SET aprovada = 'S',
                                  orcar = $1,
                                  data_aprovacao = CURRENT_DATE,
                                  hora_aprovacao = CURRENT_TIME,
                                  login_aprovacao = $2,
                                  motivo_reprovacao = NULL
                              WHERE seq_ordem_compra = $3";
                    
                    $params = array($orcar, $username, $seq_oc);
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql($query, $params, $g_sql);
                    $sucesso++;
                    
                } elseif ($acao === 'estornar') {
                    $query = "UPDATE {$tabela_ordem} 
                              SET aprovada = 'N',
                                  orcar = 'N',
                                  data_aprovacao = NULL,
                                  hora_aprovacao = NULL,
                                  login_aprovacao = NULL
                              WHERE seq_ordem_compra = $1";
                    
                    $params = array($seq_oc);
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql($query, $params, $g_sql);
                    $sucesso++;
                } elseif ($acao === 'reprovar') {
                    // ✅ REPROVAÇÃO: Atualizar status para 'R' e concatenar motivo na observação
                    $motivo_formatado = strtoupper($motivo_reprovacao);
                    $data_formatada = date('d/m/Y');
                    $texto_concatenar = " | REPROVADA EM {$data_formatada}: {$motivo_formatado}";
                    
                    $query = "UPDATE {$tabela_ordem} 
                              SET aprovada = 'R',
                                  orcar = 'N',
                                  data_aprovacao = NULL,
                                  hora_aprovacao = NULL,
                                  login_aprovacao = NULL,
                                  motivo_reprovacao = $1,
                                  observacao = COALESCE(observacao, '') || $2
                              WHERE seq_ordem_compra = $3";
                    
                    $params = array($motivo_formatado, $texto_concatenar, $seq_oc);
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql($query, $params, $g_sql);
                    $sucesso++;
                }
            } catch (Exception $e) {
                $erros++;
            }
        }
        
        // Montar mensagem de sucesso
        $mensagem = ($acao === 'aprovar') 
            ? "$sucesso ordem(ns) de compra aprovada(s) com sucesso!"
            : "$sucesso aprovação(ões) estornada(s) com sucesso!";
        
        if ($erros > 0) {
            $mensagem .= " ($erros erro(s) encontrado(s))";
        }
        
        echo json_encode([
            'success' => true, 
            'message' => $mensagem,
            'total' => $total,
            'sucesso' => $sucesso,
            'erros' => $erros
        ]);
        return;
    }
    
    // Processamento individual (legado)
    if ($acao === 'aprovar') {
        // Aprovar ordem
        $query = "UPDATE {$tabela_ordem} 
                  SET aprovada = 'S',
                      orcar = $1,
                      data_aprovacao = CURRENT_DATE,
                      hora_aprovacao = CURRENT_TIME,
                      login_aprovacao = $2,
                      motivo_reprovacao = NULL
                  WHERE seq_ordem_compra = $3";
        
        $params = array($orcar, $username, $seq_ordem_compra);
        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
        sql($query, $params, $g_sql);
        
        echo json_encode(['success' => true, 'message' => 'Ordem de compra aprovada com sucesso']);
        
    } elseif ($acao === 'estornar') {
        // Estornar aprovação
        $query = "UPDATE {$tabela_ordem} 
                  SET aprovada = 'N',
                      orcar = 'N',
                      data_aprovacao = NULL,
                      hora_aprovacao = NULL,
                      login_aprovacao = NULL
                  WHERE seq_ordem_compra = $1";
        
        $params = array($seq_ordem_compra);
        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
        sql($query, $params, $g_sql);
        
        echo json_encode(['success' => true, 'message' => 'Aprovação estornada com sucesso']);
        
    } elseif ($acao === 'reprovar') {
        // ✅ REPROVAÇÃO: Atualizar status para 'R' e concatenar motivo na observação
        $motivo_formatado = strtoupper($motivo_reprovacao);
        $data_formatada = date('d/m/Y');
        $texto_concatenar = " | REPROVADA EM {$data_formatada}: {$motivo_formatado}";
        
        $query = "UPDATE {$tabela_ordem} 
                  SET aprovada = 'R',
                      orcar = 'N',
                      data_aprovacao = NULL,
                      hora_aprovacao = NULL,
                      login_aprovacao = NULL,
                      motivo_reprovacao = $1,
                      observacao = COALESCE(observacao, '') || $2
                  WHERE seq_ordem_compra = $3";
        
        $params = array($motivo_formatado, $texto_concatenar, $seq_ordem_compra);
        // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
        sql($query, $params, $g_sql);
        
        echo json_encode(['success' => true, 'message' => 'Ordem de compra reprovada com sucesso']);
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Ação inválida']);
    }
}