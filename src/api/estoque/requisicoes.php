<?php
/**
 * API: Requisições de Saída do Estoque
 * Autor: Sistema PRESTO
 * Data: 2026-03-01
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

header('Content-Type: application/json; charset=utf-8');

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

$domain = $currentUser['domain'] ?? 'acv';
$g_empresa = $domain;
$g_usuario = [
    'seq_usuario' => $currentUser['id'] ?? 0,
    'login' => $currentUser['username'] ?? 'SISTEMA'
];
$g_sql = getDBConnection($domain);

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Criar ou buscar posição automática PSO/1/1
 */
function obterPosicaoAutomatica($seq_estoque, $seq_item, $g_sql) {
    global $g_empresa;
    
    // Verificar se já existe posição PSO/1/1 para este item neste estoque
    $query = "
        SELECT seq_posicao, saldo
        FROM {$g_empresa}_posicao
        WHERE seq_estoque = $1
          AND seq_item = $2
          AND rua = 'PSO'
          AND altura = '1'
          AND coluna = '1'
          AND ativa = 'S'
        LIMIT 1
    ";
    
    $result = sql($query, [$seq_estoque, $seq_item], $g_sql);
    
    if (!$result) {
        throw new Exception('Erro ao buscar posição: ' . pg_last_error($g_sql));
    }
    
    // Converter resultado para array
    $rows = [];
    while ($row = pg_fetch_assoc($result)) {
        $rows[] = $row;
    }
    
    if (count($rows) > 0) {
        // Posição já existe
        return [
            'seq_posicao' => (int)$rows[0]['seq_posicao'],
            'saldo' => (float)$rows[0]['saldo']
        ];
    }
    
    // Posição não existe, criar nova
    $insertQuery = "
        INSERT INTO {$g_empresa}_posicao (
            seq_estoque,
            seq_item,
            rua,
            altura,
            coluna,
            saldo,
            ativa,
            data_inclusao,
            hora_inclusao,
            login_inclusao
        ) VALUES (
            $1, $2, 'PSO', '1', '1', 0, 'S', CURRENT_DATE, CURRENT_TIME, $3
        )
        RETURNING seq_posicao
    ";
    
    global $g_usuario;
    $login = strtolower($g_usuario['login']);
    
    $insertResult = sql($insertQuery, [$seq_estoque, $seq_item, $login], $g_sql);
    
    if (!$insertResult) {
        throw new Exception('Erro ao criar posição automática: ' . pg_last_error($g_sql));
    }
    
    $insertRow = pg_fetch_assoc($insertResult);
    
    if (!$insertRow) {
        throw new Exception('Erro ao obter dados da posição criada');
    }
    
    return [
        'seq_posicao' => (int)$insertRow['seq_posicao'],
        'saldo' => 0
    ];
}

/**
 * Atualizar saldo da posição (negativo para saída)
 */
function atualizarSaldoPosicao($seq_posicao, $quantidade, $g_sql) {
    global $g_empresa;
    
    $query = "
        UPDATE {$g_empresa}_posicao
        SET saldo = saldo - $1
        WHERE seq_posicao = $2
    ";
    
    sql($query, [$quantidade, $seq_posicao], $g_sql);
}

// ============================================================================
// ROTEAMENTO
// ============================================================================

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'POST':
            criarRequisicao();
            break;
            
        case 'GET':
            // ✅ VERIFICAR SE É CONSULTA DE DETALHES OU LISTAGEM
            if (isset($_GET['seq_requisicao'])) {
                buscarDetalhesRequisicao();
            } else {
                listarRequisicoes();
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => 'Método não permitido'
            ]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro no servidor: ' . $e->getMessage()
    ]);
}

// ============================================================================
// CRIAR NOVA REQUISIÇÃO DE SAÍDA
// ============================================================================
function criarRequisicao() {
    global $g_sql, $g_empresa, $g_usuario;
    
    // Decodificar JSON
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validar campos obrigatórios
    if (empty($input['seq_estoque'])) {
        msg('Estoque é obrigatório', 'erro');
        return;
    }
    
    if (empty($input['seq_cc'])) {
        msg('Centro de custo é obrigatório', 'erro');
        return;
    }
    
    if (empty($input['solicitante'])) {
        msg('Solicitante é obrigatório', 'erro');
        return;
    }
    
    if (empty($input['itens']) || !is_array($input['itens']) || count($input['itens']) === 0) {
        msg('Adicione pelo menos um item à requisição', 'erro');
        return;
    }
    
    $seq_estoque = (int)$input['seq_estoque'];
    $seq_cc = (int)$input['seq_cc'];
    $solicitante = mb_strtoupper(trim($input['solicitante']), 'UTF-8');
    $observacao = mb_strtoupper(trim($input['observacao'] ?? ''), 'UTF-8');
    $placa = !empty($input['placa']) ? mb_strtoupper(trim($input['placa']), 'UTF-8') : null; // ✅ NOVO
    $itens = $input['itens'];
    
    // DEBUG: Log dos valores recebidos
    error_log("DEBUG REQUISICAO - seq_estoque: $seq_estoque, seq_cc: $seq_cc, solicitante: $solicitante, observacao: $observacao, placa: " . ($placa ?? 'NULL'));
    error_log("DEBUG REQUISICAO - Input completo: " . json_encode($input));
    
    // Iniciar transação
    pg_query($g_sql, 'BEGIN');
    
    try {
        // ====================================================================
        // 1. CRIAR CABEÇALHO DA REQUISIÇÃO
        // ====================================================================
        $queryRequisicao = "
            INSERT INTO {$g_empresa}_requisicao (
                seq_estoque,
                seq_centro_custo,
                login,
                solicitante,
                observacao,
                placa,
                data_atendimento,
                hora_atendimento,
                login_atendimento
            ) VALUES (
                $1, $2, $3, $4, $5, $6, NOW()::date, NOW()::time, $3
            )
            RETURNING seq_requisicao
        ";
        
        // Login sempre em minúsculas
        $login = strtolower($g_usuario['login']);
        
        $resultRequisicao = sql(
            $queryRequisicao,
            [$seq_estoque, $seq_cc, $login, $solicitante, $observacao, $placa],
            $g_sql
        );
        
        if (!$resultRequisicao) {
            throw new Exception('Erro ao criar requisição: ' . pg_last_error($g_sql));
        }
        
        // Converter resultado para array
        $rowRequisicao = pg_fetch_assoc($resultRequisicao);
        
        if (!$rowRequisicao) {
            throw new Exception('Erro ao obter dados da requisição criada');
        }
        
        $seq_requisicao = (int)$rowRequisicao['seq_requisicao'];
        
        // ====================================================================
        // 2. PROCESSAR CADA ITEM
        // ====================================================================
        foreach ($itens as $item) {
            $seq_item = (int)$item['seq_item'];
            $quantidade = (float)$item['quantidade'];
            $seq_posicao = !empty($item['seq_posicao']) ? (int)$item['seq_posicao'] : null;
            
            // Validar quantidade
            if ($quantidade <= 0) {
                throw new Exception("Quantidade inválida para o item");
            }
            
            // ----------------------------------------------------------------
            // SE POSIÇÃO NÃO FOI INFORMADA: CRIAR AUTOMÁTICA
            // ----------------------------------------------------------------
            if ($seq_posicao === null) {
                $posicaoAuto = obterPosicaoAutomatica($seq_estoque, $seq_item, $g_sql);
                $seq_posicao = $posicaoAuto['seq_posicao'];
            } else {
                // ----------------------------------------------------------------
                // SE POSIÇÃO FOI INFORMADA: VALIDAR SALDO
                // ----------------------------------------------------------------
                $querySaldo = "
                    SELECT saldo
                    FROM {$g_empresa}_posicao
                    WHERE seq_posicao = $1
                ";
                
                $resultSaldo = sql($querySaldo, [$seq_posicao], $g_sql);
                
                if (!$resultSaldo) {
                    throw new Exception("Erro ao buscar saldo da posição: " . pg_last_error($g_sql));
                }
                
                $rowSaldo = pg_fetch_assoc($resultSaldo);
                
                if (!$rowSaldo) {
                    throw new Exception("Posição não encontrada");
                }
                
                $saldoAtual = (float)$rowSaldo['saldo'];
                
                if ($quantidade > $saldoAtual) {
                    throw new Exception("Quantidade excede o saldo disponível na posição");
                }
            }
            
            // ----------------------------------------------------------------
            // INSERIR ITEM DA REQUISIÇÃO
            // ----------------------------------------------------------------
            $queryItem = "
                INSERT INTO {$g_empresa}_requisicao_item (
                    seq_requisicao,
                    seq_item,
                    qtde_item,
                    seq_posicao
                ) VALUES (
                    $1, $2, $3, $4
                )
            ";
            
            sql($queryItem, [$seq_requisicao, $seq_item, $quantidade, $seq_posicao], $g_sql);
            
            // ----------------------------------------------------------------
            // ATUALIZAR SALDO DA POSIÇÃO (BAIXA)
            // ----------------------------------------------------------------
            atualizarSaldoPosicao($seq_posicao, $quantidade, $g_sql);
            
            // ----------------------------------------------------------------
            // BUSCAR VALOR UNITÁRIO DO ITEM
            // ----------------------------------------------------------------
            $queryValor = "
                SELECT vlr_item
                FROM {$g_empresa}_item
                WHERE seq_item = $1
            ";
            
            $resultValor = sql($queryValor, [$seq_item], $g_sql);
            
            if (!$resultValor) {
                throw new Exception("Erro ao buscar valor do item: " . pg_last_error($g_sql));
            }
            
            $rowValor = pg_fetch_assoc($resultValor);
            $vlr_unitario = $rowValor ? (float)$rowValor['vlr_item'] : 0;
            $vlr_total = $vlr_unitario * $quantidade;
            
            // ----------------------------------------------------------------
            // REGISTRAR MOVIMENTO DE ESTOQUE
            // ----------------------------------------------------------------
            $queryMovimento = "
                INSERT INTO {$g_empresa}_mvto_estoque (
                    data_mvto,
                    hora_mvto,
                    login,
                    mvto,
                    tipo,
                    seq_origem,
                    seq_posicao,
                    seq_item,
                    qtde_item,
                    vlr_unitario,
                    vlr_total,
                    observacao
                ) VALUES (
                    NOW()::date, NOW()::time, $1, 'S', 'R', $2, $3, $4, $5, $6, $7, $8
                )
            ";
            
            sql($queryMovimento, [
                $login,
                $seq_requisicao,
                $seq_posicao,
                $seq_item,
                $quantidade,
                $vlr_unitario,
                $vlr_total,
                $observacao
            ], $g_sql);
        }
        
        // Commit da transação
        pg_query($g_sql, 'COMMIT');
        
        // ✅ NÃO USAR msg() AQUI - Frontend gerencia a mensagem de sucesso via navigate state
        echo json_encode([
            'success' => true,
            'data' => [
                'seq_requisicao' => $seq_requisicao
            ]
        ]);
        
    } catch (Exception $e) {
        // Rollback em caso de erro
        pg_query($g_sql, 'ROLLBACK');
        msg($e->getMessage(), 'erro');
    }
}

// ============================================================================
// BUSCAR DETALHES DE UMA REQUISIÇÃO
// ============================================================================
function buscarDetalhesRequisicao() {
    global $g_sql, $g_empresa;
    
    $seq_requisicao = isset($_GET['seq_requisicao']) ? (int)$_GET['seq_requisicao'] : null;
    
    if (!$seq_requisicao) {
        msg('Requisição não especificada', 'erro');
        return;
    }
    
    $query = "
        SELECT 
            r.seq_requisicao,
            r.seq_estoque,
            e.descricao as estoque_descricao,
            e.unidade as estoque_unidade,
            e.nro_estoque,
            r.seq_centro_custo,
            cc.descricao as cc_descricao,
            cc.unidade as cc_unidade,
            cc.nro_centro_custo,
            r.login,
            r.solicitante,
            r.observacao,
            r.data_atendimento,
            r.hora_atendimento,
            r.login_atendimento,
            r.placa,
            CASE 
                WHEN r.data_atendimento IS NULL THEN 'PENDENTE'
                ELSE 'ATENDIDA'
            END as status,
            COUNT(ri.seq_item) as qtd_itens
        FROM {$g_empresa}_requisicao r
        INNER JOIN {$g_empresa}_estoque e ON e.seq_estoque = r.seq_estoque
        INNER JOIN {$g_empresa}_centro_custo cc ON cc.seq_centro_custo = r.seq_centro_custo
        LEFT JOIN {$g_empresa}_requisicao_item ri ON ri.seq_requisicao = r.seq_requisicao
        WHERE r.seq_requisicao = $1
        GROUP BY r.seq_requisicao, e.descricao, e.unidade, e.nro_estoque, cc.descricao, cc.unidade, cc.nro_centro_custo
        ORDER BY r.seq_requisicao DESC
    ";
    
    $result = sql($query, [$seq_requisicao], $g_sql);
    
    if (!$result) {
        msg('Erro ao buscar requisição: ' . pg_last_error($g_sql), 'erro');
        return;
    }
    
    // ✅ CONVERTER RESOURCE PARA ARRAY
    $requisicao = pg_fetch_assoc($result);
    
    if (!$requisicao) {
        msg('Requisição não encontrada', 'erro');
        return;
    }
    
    // Buscar itens da requisição
    $queryItens = "
        SELECT 
            ri.seq_item,
            i.descricao as item_descricao,
            i.vlr_item,
            ri.qtde_item,
            p.rua,
            p.altura,
            p.coluna,
            p.saldo
        FROM {$g_empresa}_requisicao_item ri
        INNER JOIN {$g_empresa}_item i ON i.seq_item = ri.seq_item
        INNER JOIN {$g_empresa}_posicao p ON p.seq_posicao = ri.seq_posicao
        WHERE ri.seq_requisicao = $1
    ";
    
    $resultItens = sql($queryItens, [$seq_requisicao], $g_sql);
    
    if (!$resultItens) {
        msg('Erro ao buscar itens da requisição: ' . pg_last_error($g_sql), 'erro');
        return;
    }
    
    // ✅ CONVERTER RESOURCE PARA ARRAY
    $itens = [];
    while ($row = pg_fetch_assoc($resultItens)) {
        $itens[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'requisicao' => $requisicao,
            'itens' => $itens
        ]
    ]);
}

// ============================================================================
// LISTAR REQUISIÇÕES
// ============================================================================
function listarRequisicoes() {
    global $g_sql, $g_empresa;
    
    $seq_estoque = isset($_GET['seq_estoque']) ? (int)$_GET['seq_estoque'] : null;
    $status = isset($_GET['status']) ? trim($_GET['status']) : null;
    
    $where = ['1=1'];
    $params = [];
    $paramCount = 1;
    
    if ($seq_estoque) {
        $where[] = "r.seq_estoque = \${$paramCount}";
        $params[] = $seq_estoque;
        $paramCount++;
    }
    
    // Status baseado em data_atendimento
    if ($status) {
        if (strtoupper($status) === 'PENDENTE') {
            $where[] = "r.data_atendimento IS NULL";
        } elseif (strtoupper($status) === 'ATENDIDA') {
            $where[] = "r.data_atendimento IS NOT NULL";
        }
    }
    
    $whereClause = implode(' AND ', $where);
    
    $query = "
        SELECT 
            r.seq_requisicao,
            r.seq_estoque,
            e.descricao as estoque_descricao,
            e.unidade as estoque_unidade,
            e.nro_estoque,
            r.seq_centro_custo,
            cc.descricao as cc_descricao,
            cc.unidade as cc_unidade,
            cc.nro_centro_custo,
            r.login,
            r.solicitante,
            r.observacao,
            r.data_atendimento,
            r.hora_atendimento,
            r.login_atendimento,
            r.placa,
            CASE 
                WHEN r.data_atendimento IS NULL THEN 'PENDENTE'
                ELSE 'ATENDIDA'
            END as status,
            COUNT(ri.seq_item) as qtd_itens
        FROM {$g_empresa}_requisicao r
        INNER JOIN {$g_empresa}_estoque e ON e.seq_estoque = r.seq_estoque
        INNER JOIN {$g_empresa}_centro_custo cc ON cc.seq_centro_custo = r.seq_centro_custo
        LEFT JOIN {$g_empresa}_requisicao_item ri ON ri.seq_requisicao = r.seq_requisicao
        WHERE {$whereClause}
        GROUP BY r.seq_requisicao, e.descricao, e.unidade, e.nro_estoque, cc.descricao, cc.unidade, cc.nro_centro_custo
        ORDER BY r.seq_requisicao DESC
    ";
    
    $result = sql($query, $params, $g_sql);
    
    if (!$result) {
        msg('Erro ao buscar requisições: ' . pg_last_error($g_sql), 'erro');
        return;
    }
    
    // ✅ CONVERTER RESOURCE PARA ARRAY
    $requisicoes = [];
    while ($row = pg_fetch_assoc($result)) {
        $requisicoes[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'data' => $requisicoes
    ]);
}