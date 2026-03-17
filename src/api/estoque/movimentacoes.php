<?php
/**
 * API ESTOQUE - MOVIMENTAÇÕES
 * Gerencia movimentações de estoque e relatórios
 * VERSÃO: 2.0 - 02/FEV/2026 - CORRIGIDO para usar sql()
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

// ✅ CONECTAR AO BANCO
$g_sql = connect();

try {
    requireAuth();
    $currentUser = getCurrentUser();
    
    // ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
    $prefix = strtolower($currentUser['domain']) . '_';
    $tblMvtoEstoque = $prefix . 'mvto_estoque';
    $tblPosicao = $prefix . 'posicao';
    $tblItem = $prefix . 'item';
    $tblEstoque = $prefix . 'estoque';
    $tblTipoItem = $prefix . 'tipo_item';
    
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Detectar se é relatório (POST com filtros) ou criação (POST com _method)
    $isRelatorio = ($method === 'GET') || 
                   ($method === 'POST' && !isset($input['_method']) && !isset($input['mvto']));
    
    if ($isRelatorio) {
        // ===============================================
        // RELATÓRIO DE MOVIMENTAÇÕES
        // ===============================================
        $filters = $method === 'GET' ? $_GET : ($input ?? []);
        
        $where = ['1=1'];
        $params = [];
        $paramCount = 1;
        
        // Filtro por unidade
        if (isset($filters['unidade']) && !empty($filters['unidade'])) {
            $where[] = "e.unidade = $" . $paramCount++;
            $params[] = $filters['unidade'];
        }
        
        // Filtro por estoque
        if (isset($filters['seq_estoque']) && !empty($filters['seq_estoque'])) {
            $where[] = "e.seq_estoque = $" . $paramCount++;
            $params[] = intval($filters['seq_estoque']);
        }
        
        // Filtro por data início
        if (isset($filters['data_inicio']) && !empty($filters['data_inicio'])) {
            $where[] = "m.data_mvto >= $" . $paramCount++;
            $params[] = $filters['data_inicio'];
        }
        
        // Filtro por data fim
        if (isset($filters['data_fim']) && !empty($filters['data_fim'])) {
            $where[] = "m.data_mvto <= $" . $paramCount++;
            $params[] = $filters['data_fim'];
        }
        
        // Filtro por tipo de movimentação
        if (isset($filters['tipo']) && !empty($filters['tipo'])) {
            $where[] = "m.tipo = $" . $paramCount++;
            $params[] = $filters['tipo'];
        }
        
        // Filtro por tipo de item
        if (isset($filters['seq_tipo_item']) && !empty($filters['seq_tipo_item'])) {
            $where[] = "i.seq_tipo_item = $" . $paramCount++;
            $params[] = intval($filters['seq_tipo_item']);
        }
        
        // Filtro por item específico
        if (isset($filters['seq_item']) && !empty($filters['seq_item'])) {
            $where[] = "m.seq_item = $" . $paramCount++;
            $params[] = intval($filters['seq_item']);
        }
        
        $whereClause = implode(' AND ', $where);
        
        $query = "SELECT 
                    m.seq_mvto_estoque,
                    m.mvto,
                    m.tipo,
                    m.seq_origem,
                    m.seq_posicao,
                    m.seq_item,
                    m.qtde_item,
                    m.vlr_unitario,
                    m.vlr_total,
                    m.observacao,
                    m.login,
                    TO_CHAR(m.data_mvto, 'DD/MM/YYYY') as data_mvto,
                    TO_CHAR(m.hora_mvto, 'HH24:MI:SS') as hora_mvto,
                    i.codigo as codigo_item,
                    i.descricao as descricao_item,
                    ti.descricao as tipo_item_descricao,
                    COALESCE(p.rua || '/' || p.altura || '/' || p.coluna, '-') as localizacao,
                    e.nro_estoque,
                    e.descricao as estoque_descricao,
                    e.unidade
                  FROM $tblMvtoEstoque m
                  INNER JOIN $tblItem i ON m.seq_item = i.seq_item
                  LEFT JOIN $tblTipoItem ti ON i.seq_tipo_item = ti.seq_tipo_item
                  LEFT JOIN $tblPosicao p ON m.seq_posicao = p.seq_posicao
                  LEFT JOIN $tblEstoque e ON p.seq_estoque = e.seq_estoque
                  WHERE $whereClause
                  ORDER BY m.data_mvto DESC, m.hora_mvto DESC
                  LIMIT 500";
        
        $result = sql($g_sql, $query, false, $params);
        
        if (!$result) {
            throw new Exception('Erro ao buscar movimentações: ' . pg_last_error($g_sql));
        }
        
        $movimentacoes = [];
        
        while ($row = pg_fetch_assoc($result)) {
            $movimentacoes[] = $row;
        }
        
        echo json_encode([
            'success' => true, 
            'data' => $movimentacoes,
            'total' => count($movimentacoes)
        ]);
        
    } else {
        // ===============================================
        // REGISTRAR MOVIMENTAÇÃO (ENTRADA OU SAÍDA MANUAL)
        // ===============================================
        $mvto = strtoupper(trim($input['mvto'] ?? '')); // E ou S
        $tipo = strtoupper(trim($input['tipo'] ?? ''));
        $seq_posicao = intval($input['seq_posicao'] ?? 0);
        $seq_item = intval($input['seq_item'] ?? 0);
        $qtde_item = floatval($input['qtde_item'] ?? 0);
        $vlr_unitario = floatval($input['vlr_unitario'] ?? 0);
        $observacao = trim($input['observacao'] ?? '');
        $seq_origem = !empty($input['seq_origem']) ? intval($input['seq_origem']) : null;
        
        if (!in_array($mvto, ['E', 'S'])) {
            msg('Tipo de movimentação inválido (E=Entrada ou S=Saída)');
        }
        
        if ($seq_posicao <= 0 || $seq_item <= 0 || $qtde_item <= 0) {
            msg('Dados da movimentação inválidos');
        }
        
        // Iniciar transação
        sql($g_sql, "BEGIN", false, []);
        
        try {
            // Verificar se a posição existe e pegar o saldo atual
            $checkPos = sql($g_sql, 
                "SELECT saldo, seq_item FROM $tblPosicao WHERE seq_posicao = $1 FOR UPDATE", 
                false, [$seq_posicao]
            );
            
            if (pg_num_rows($checkPos) == 0) {
                throw new Exception('Posição não encontrada');
            }
            
            $posicao = pg_fetch_assoc($checkPos);
            $saldoAtual = floatval($posicao['saldo']);
            
            // Calcular novo saldo
            if ($mvto == 'E') {
                $novoSaldo = $saldoAtual + $qtde_item;
            } else {
                $novoSaldo = $saldoAtual - $qtde_item;
                
                if ($novoSaldo < 0) {
                    throw new Exception('Saldo insuficiente na posição');
                }
            }
            
            // Atualizar saldo da posição
            sql($g_sql, 
                "UPDATE $tblPosicao SET saldo = $1, seq_item = $2 WHERE seq_posicao = $3", 
                false, [$novoSaldo, $seq_item, $seq_posicao]
            );
            
            // Registrar movimentação
            $vlr_total = $qtde_item * $vlr_unitario;
            
            $query = "INSERT INTO $tblMvtoEstoque (mvto, tipo, seq_origem, seq_posicao, seq_item, 
                                                 qtde_item, vlr_unitario, vlr_total, observacao, login) 
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING seq_mvto_estoque";
            
            $result = sql($g_sql, $query, false, [
                $mvto, $tipo, $seq_origem, $seq_posicao, $seq_item,
                $qtde_item, $vlr_unitario, $vlr_total, $observacao, $currentUser['username']
            ]);
            
            $row = pg_fetch_assoc($result);
            
            // Commit
            sql($g_sql, "COMMIT", false, []);
            
            echo json_encode([
                'success' => true, 
                'seq_mvto_estoque' => $row['seq_mvto_estoque'], 
                'novo_saldo' => $novoSaldo
            ]);
            
        } catch (Exception $e) {
            sql($g_sql, "ROLLBACK", false, []);
            throw $e;
        }
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/movimentacoes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}