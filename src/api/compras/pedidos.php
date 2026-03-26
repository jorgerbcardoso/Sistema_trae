<?php
/**
 * API COMPRAS - CRUD DE PEDIDOS
 * Gerencia pedidos de compra gerados via orçamentos
 */

require_once '/var/www/html/sistema/api/config.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

$domain = $currentUser['domain'] ?? 'acv';
$login = $currentUser['username'] ?? 'SISTEMA';
$unidadeAtual = $currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '';

// ✅ DEBUG
error_log("=== PEDIDOS - DEBUG ===");
error_log("Domain: " . $domain);
error_log("Login: " . $login);
error_log("Unidade atual: " . $unidadeAtual);

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($domain) . '_';
$tblPedido = $prefix . 'pedido';
$tblPedidoItem = $prefix . 'pedido_item';
$tblOrcamento = $prefix . 'orcamento';
$tblOrcamentoOrdemCompra = $prefix . 'orcamento_ordem_compra';
$tblOrdemCompra = $prefix . 'ordem_compra';
$tblCentroCusto = $prefix . 'centro_custo';
$tblFornecedor = $prefix . 'fornecedor';
$tblItem = $prefix . 'item';

// ✅ VERIFICAR SE É MTZ OU ALL (ambos veem tudo)
$unidadeAtualUpper = strtoupper($unidadeAtual);
$isMTZ = ($unidadeAtualUpper === 'MTZ' || $unidadeAtualUpper === 'ALL');

error_log("É MTZ/ALL (vê tudo)? " . ($isMTZ ? 'SIM' : 'NÃO'));
error_log("=================================");

// ✅ Conectar ao banco
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            if (isset($_GET['action']) && $_GET['action'] === 'ordens_disponiveis') {
                // BUSCAR ORDENS APROVADAS COM ORCAR = N DISPONÍVEIS PARA CONVERSÃO EM PEDIDO
                $where = ["oc.aprovada = 'S'", "oc.orcar = 'N'", "COALESCE(oc.seq_pedido, 0) = 0"];
                $params = [];
                $paramCount = 1;
                
                // ✅ FILTRO POR UNIDADE (apenas não-MTZ)
                if (!$isMTZ) {
                    $where[] = "oc.unidade = $" . $paramCount++;
                    $params[] = strtoupper($unidadeAtual);
                }
                
                $whereClause = implode(' AND ', $where);
                
                // ✅ Calcular valor total somando os itens de cada ordem
                $query = "
                    SELECT 
                        COUNT(DISTINCT oc.seq_ordem_compra) AS total,
                        COALESCE(SUM(oci.qtde_item * i.vlr_item), 0) AS valor_total
                    FROM $tblOrdemCompra oc
                    LEFT JOIN {$prefix}ordem_compra_item oci ON oci.seq_ordem_compra = oc.seq_ordem_compra
                    LEFT JOIN {$prefix}item i ON i.seq_item = oci.seq_item
                    WHERE $whereClause
                ";
                
                $result = sql($query, $params, $g_sql);
                $row = pg_fetch_assoc($result);
                
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'total' => (int)$row['total'],
                        'valor_total' => (float)$row['valor_total']
                    ]
                ]);
                exit;
                
            } elseif (isset($_GET['action']) && $_GET['action'] === 'totalizadores') {
                // TOTALIZADORES DE PEDIDOS
                $where = ["1=1"];
                $params = [];
                $paramCount = 1;
                
                // ✅ FILTRO POR UNIDADE (apenas não-MTZ)
                if (!$isMTZ) {
                    $where[] = "p.unidade = $" . $paramCount++;
                    $params[] = strtoupper($unidadeAtual);
                }
                
                $whereClause = implode(' AND ', $where);
                
                $query = "
                    SELECT 
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE p.status = 'A') AS aguardando,
                        COUNT(*) FILTER (WHERE p.status = 'P') AS aprovados,
                        COUNT(*) FILTER (WHERE p.status = 'E') AS entregues,
                        COALESCE(SUM(p.vlr_total), 0) AS valor_total
                    FROM $tblPedido p
                    WHERE $whereClause
                ";
                
                $result = sql($query, $params, $g_sql);
                $row = pg_fetch_assoc($result);
                
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'total' => (int)$row['total'],
                        'aguardando' => (int)$row['aguardando'],
                        'aprovados' => (int)$row['aprovados'],
                        'entregues' => (int)$row['entregues'],
                        'valor_total' => (float)$row['valor_total']
                    ]
                ]);
                
            } elseif (isset($_GET['seq_pedido'])) {
                // BUSCAR PEDIDO ESPECÍFICO
                $seq = intval($_GET['seq_pedido']);
                
                // ✅ Se action=itens, buscar apenas os itens do pedido
                if (isset($_GET['action']) && $_GET['action'] === 'itens') {
                    $query = "
                        SELECT 
                            pi.*,
                            i.codigo,
                            i.descricao,
                            um.sigla AS unidade_medida_sigla
                        FROM $tblPedidoItem pi
                        INNER JOIN {$prefix}item i ON i.seq_item = pi.seq_item
                        LEFT JOIN {$prefix}unidade_medida um ON um.seq_unidade_medida = i.seq_unidade_medida
                        WHERE pi.seq_pedido = $1
                        ORDER BY pi.seq_pedido_item
                    ";
                    
                    $result = sql($query, [$seq], $g_sql);
                    $itens = [];
                    
                    while ($row = pg_fetch_assoc($result)) {
                        $itens[] = $row;
                    }
                    
                    echo json_encode(['success' => true, 'data' => $itens]);
                    exit;
                }
                
                // ✅ Se action=detalhes, buscar pedido + itens + fornecedor
                if (isset($_GET['action']) && $_GET['action'] === 'detalhes') {
                    $seq = intval($_GET['seq_pedido'] ?? 0);
                    
                    if (!$seq) {
                        msg('Pedido não informado', 'error');
                    }
                    
                    // ✅ CRÍTICO: RECALCULAR vlr_total de TODOS OS ITENS antes de buscar
                    $queryRecalcular = "
                        UPDATE $tblPedidoItem
                        SET vlr_total = qtde_item * vlr_unitario
                        WHERE seq_pedido = $1
                    ";
                    sql($queryRecalcular, [$seq], $g_sql);
                    
                    // Buscar pedido
                    $query = "
                        SELECT 
                            p.*,
                            f.nome AS fornecedor_nome,
                            f.cnpj AS fornecedor_cnpj,
                            orc.nro_orcamento
                        FROM $tblPedido p
                        LEFT JOIN $tblFornecedor f ON f.seq_fornecedor = p.seq_fornecedor
                        LEFT JOIN $tblOrcamento orc ON orc.seq_orcamento = p.seq_orcamento
                        WHERE p.seq_pedido = $1
                    ";
                    
                    $result = sql($query, [$seq], $g_sql);
                    
                    if (pg_num_rows($result) === 0) {
                        echo json_encode(['success' => false, 'message' => 'Pedido não encontrado']);
                        exit;
                    }
                    
                    $pedido = pg_fetch_assoc($result);
                    
                    // ✅ Garantir que valores numéricos sejam float
                    $pedido['vlr_total'] = floatval($pedido['vlr_total']);
                    $pedido['seq_pedido'] = intval($pedido['seq_pedido']);
                    $pedido['seq_fornecedor'] = intval($pedido['seq_fornecedor']);
                    if ($pedido['seq_orcamento']) {
                        $pedido['seq_orcamento'] = intval($pedido['seq_orcamento']);
                    }
                    
                    // Buscar itens
                    $queryItens = "
                        SELECT 
                            pi.*,
                            i.codigo,
                            i.descricao,
                            um.sigla AS unidade_medida
                        FROM $tblPedidoItem pi
                        INNER JOIN $tblItem i ON i.seq_item = pi.seq_item
                        LEFT JOIN {$prefix}unidade_medida um ON um.seq_unidade_medida = i.seq_unidade_medida
                        WHERE pi.seq_pedido = $1
                        ORDER BY pi.seq_pedido_item
                    ";
                    
                    $resultItens = sql($queryItens, [$seq], $g_sql);
                    $itens = [];
                    $vlr_total_recalculado = 0; // ✅ RECALCULAR TOTAL
                    
                    while ($row = pg_fetch_assoc($resultItens)) {
                        // ✅ Garantir que valores numéricos sejam float
                        $row['qtde_item'] = floatval($row['qtde_item']);
                        $row['vlr_unitario'] = floatval($row['vlr_unitario']);
                        $row['vlr_total'] = floatval($row['vlr_total']);
                        
                        // ✅ SOMAR AO TOTAL RECALCULADO
                        $vlr_total_recalculado += $row['vlr_total'];
                        
                        $itens[] = $row;
                    }
                    
                    // ✅ ATUALIZAR VLR_TOTAL DO PEDIDO COM VALOR RECALCULADO DOS ITENS
                    $pedido['vlr_total'] = $vlr_total_recalculado;
                    
                    // Buscar fornecedor completo
                    $fornecedor = null;
                    if ($pedido['seq_fornecedor']) {
                        $queryFornecedor = "
                            SELECT 
                                f.*,
                                c.nome||' / '||c.uf AS cidade_nome
                            FROM $tblFornecedor f
                            LEFT JOIN cidade c ON c.seq_cidade = f.seq_cidade
                            WHERE f.seq_fornecedor = $1
                        ";
                        $resultFornecedor = sql($queryFornecedor, [$pedido['seq_fornecedor']], $g_sql);
                        
                        if (pg_num_rows($resultFornecedor) > 0) {
                            $fornecedor = pg_fetch_assoc($resultFornecedor);
                        }
                    }
                    
                    echo json_encode([
                        'success' => true, 
                        'data' => [
                            'pedido' => $pedido,
                            'itens' => $itens,
                            'fornecedor' => $fornecedor
                        ]
                    ]);
                    exit;
                }
                
                $query = "
                    SELECT 
                        p.*,
                        f.nome AS fornecedor_nome,
                        orc.nro_orcamento,
                        oc.seq_ordem_compra,
                        oc.nro_ordem_compra,
                        oc.orcar,
                        cc.unidade||TRIM(TO_CHAR(CAST(cc.nro_centro_custo AS INT), '000000')) AS centro_custo_nro,
                        cc.descricao AS centro_custo_descricao
                    FROM $tblPedido p
                    LEFT JOIN $tblFornecedor f ON f.seq_fornecedor = p.seq_fornecedor
                    LEFT JOIN $tblOrcamento orc ON orc.seq_orcamento = p.seq_orcamento
                    LEFT JOIN $tblOrcamentoOrdemCompra ooc ON ooc.seq_orcamento = orc.seq_orcamento
                    LEFT JOIN $tblOrdemCompra oc ON oc.seq_ordem_compra = ooc.seq_ordem_compra
                    LEFT JOIN $tblCentroCusto cc ON cc.seq_centro_custo = oc.seq_centro_custo
                    WHERE p.seq_pedido = $1
                ";
                
                $result = sql($query, [$seq], $g_sql);
                
                if (pg_num_rows($result) === 0) {
                    echo json_encode(['success' => false, 'message' => 'Pedido não encontrado']);
                    exit;
                }
                
                $pedido = pg_fetch_assoc($result);
                echo json_encode(['success' => true, 'data' => $pedido]);
                
            } else {
                // LISTAR TODOS OS PEDIDOS
                
                // ✅ CRÍTICO: RECALCULAR vlr_total de TODOS OS PEDIDOS antes de listar
                $queryRecalcularTodos = "
                    UPDATE $tblPedido p
                    SET vlr_total = (
                        SELECT COALESCE(SUM(pi.vlr_total), 0)
                        FROM $tblPedidoItem pi
                        WHERE pi.seq_pedido = p.seq_pedido
                    )
                ";
                sql($queryRecalcularTodos, [], $g_sql);
                
                // ✅ RECALCULAR vlr_total dos ITENS também
                $queryRecalcularItens = "
                    UPDATE $tblPedidoItem
                    SET vlr_total = qtde_item * vlr_unitario
                ";
                sql($queryRecalcularItens, [], $g_sql);
                
                // ✅ RECALCULAR NOVAMENTE OS PEDIDOS após corrigir itens
                sql($queryRecalcularTodos, [], $g_sql);
                
                $where = ["1=1"];
                $params = [];
                $paramCount = 1;
                
                // ✅ FILTRO POR UNIDADE (apenas não-MTZ)
                if (!$isMTZ) {
                    $where[] = "p.unidade = $" . $paramCount++;
                    $params[] = strtoupper($unidadeAtual);
                }
                
                // Filtro por status
                if (isset($_GET['status']) && !empty($_GET['status'])) {
                    $where[] = "p.status = $" . $paramCount++;
                    $params[] = strtoupper($_GET['status']);
                }
                
                $whereClause = implode(' AND ', $where);
                
                $query = "
                    SELECT 
                        p.*,
                        f.nome AS fornecedor_nome,
                        orc.nro_orcamento,
                        oc.seq_ordem_compra,
                        oc.nro_ordem_compra,
                        oc.orcar,
                        cc.unidade||TRIM(TO_CHAR(CAST(cc.nro_centro_custo AS INT), '000000')) AS centro_custo_nro,
                        cc.descricao AS centro_custo_descricao,
                        (SELECT COUNT(*) FROM $tblPedidoItem WHERE seq_pedido = p.seq_pedido) AS qtd_itens
                    FROM $tblPedido p
                    LEFT JOIN $tblFornecedor f ON f.seq_fornecedor = p.seq_fornecedor
                    LEFT JOIN $tblOrcamento orc ON orc.seq_orcamento = p.seq_orcamento
                    LEFT JOIN $tblOrcamentoOrdemCompra ooc ON ooc.seq_orcamento = orc.seq_orcamento
                    LEFT JOIN $tblOrdemCompra oc ON oc.seq_ordem_compra = ooc.seq_ordem_compra
                    LEFT JOIN $tblCentroCusto cc ON cc.seq_centro_custo = oc.seq_centro_custo
                    WHERE $whereClause
                    ORDER BY p.data_inclusao DESC, p.seq_pedido DESC
                ";
                
                $result = sql($query, $params, $g_sql);
                $pedidos = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    // ✅ Converter valores numéricos
                    $row['vlr_total'] = floatval($row['vlr_total']);
                    $row['seq_pedido'] = intval($row['seq_pedido']);
                    $row['seq_fornecedor'] = intval($row['seq_fornecedor']);
                    if ($row['seq_orcamento']) {
                        $row['seq_orcamento'] = intval($row['seq_orcamento']);
                    }
                    $row['qtd_itens'] = intval($row['qtd_itens']);
                    
                    // ✅ Formatar nro_pedido: XXX0000000
                    $row['nro_pedido_formatado'] = $row['unidade'] . str_pad($row['nro_pedido'], 7, '0', STR_PAD_LEFT);
                    
                    // ✅ Tipo de pedido
                    $row['tipo_pedido'] = ($row['seq_orcamento'] > 0) ? 'ORÇAMENTO' : 'MANUAL';
                    
                    $pedidos[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $pedidos]);
            }
            break;
            
        case 'POST':
            // CRIAR NOVO PEDIDO
            $seqOrcamento = $input['seq_orcamento'] ?? null;
            $seqFornecedor = $input['seq_fornecedor'] ?? null;
            $unidade = isset($input['unidade']) ? strtoupper($input['unidade']) : strtoupper($unidadeAtual);
            $observacao = isset($input['observacao']) ? strtoupper($input['observacao']) : '';
            $vlrTotal = $input['vlr_total'] ?? 0;
            $itens = $input['itens'] ?? [];
            $ordensCompra = $input['ordens_compra'] ?? []; // ✅ ORDENS DE COMPRA SELECIONADAS
            
            // ✅ PEDIDO MANUAL: seq_orcamento DEVE SER NULL (não 0)
            if ($seqOrcamento === 0 || $seqOrcamento === '0') {
                $seqOrcamento = null;
            }
            
            if (!$seqFornecedor) {
                msg('Fornecedor é obrigatório', 'error');
            }
            
            // ✅ VALIDAR ITENS (obrigatório para pedido manual)
            if (empty($itens) && $seqOrcamento === null) {
                msg('É necessário adicionar pelo menos um item', 'error');
            }
            
            // ✅ STATUS INICIAL: Sempre AGUARDANDO APROVAÇÃO (A) para pedidos manuais
            $statusInicial = 'A'; 
            $mensagemAdicional = ' O pedido ficará com status AGUARDANDO APROVAÇÃO até ser aprovado.';
            
            // Iniciar transação
            sql("BEGIN", [], $g_sql);
            
            try {
                // Gerar número do pedido (apenas número sequencial, sem prefixo)
                // ✅ Funciona com VARCHAR ou INTEGER, ignora valores não-numéricos antigos
                $query = "
                    SELECT COALESCE(
                        MAX(
                            CASE 
                                WHEN nro_pedido ~ '^[0-9]+$' THEN CAST(nro_pedido AS INTEGER)
                                ELSE 0
                            END
                        ), 
                        0
                    ) + 1 AS proximo 
                    FROM $tblPedido
                ";
                $result = sql($query, [], $g_sql);
                
                if (!$result) {
                    throw new Exception('Erro ao gerar número do pedido');
                }
                
                $row = pg_fetch_assoc($result);
                $nroPedido = intval($row['proximo']);
                
                // Inserir pedido
                $query = "
                    INSERT INTO $tblPedido (
                        unidade, nro_pedido, seq_orcamento, seq_fornecedor,
                        status, observacao, vlr_total, nro_lancto, login_inclusao
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, 0, $8
                    ) RETURNING seq_pedido
                ";
                
                $result = sql($query, [
                    $unidade,
                    $nroPedido,
                    $seqOrcamento, // Agora pode ser NULL
                    $seqFornecedor,
                    $statusInicial, // ✅ Status: 'A' (aguardando) ou 'P' (pendente)
                    $observacao,
                    $vlrTotal,
                    $login
                ], $g_sql);
                
                if (!$result) {
                    throw new Exception('Erro ao criar pedido');
                }
                
                $row = pg_fetch_assoc($result);
                $seqPedido = $row['seq_pedido'];
                
                // ✅ INSERIR ITENS DO PEDIDO (se houver)
                if (!empty($itens)) {
                    // ✅ DEBUG: Logar o array completo de itens recebidos
                    error_log("🔍 [PEDIDO MANUAL] ITENS RECEBIDOS: " . json_encode($itens));
                    error_log("🔍 [PEDIDO MANUAL] TOTAL DE ITENS: " . count($itens));
                    
                    $queryItem = "
                        INSERT INTO $tblPedidoItem (
                            seq_pedido, seq_item, qtde_item, vlr_unitario, vlr_total
                        ) VALUES (
                            $1, $2, $3, $4, $5
                        )
                    ";
                    
                    $itemIndex = 0; // ✅ DEBUG: Contador para rastrear posição
                    foreach ($itens as $item) {
                        $seqItem = intval($item['seq_item'] ?? 0);
                        $qtdeItem = floatval($item['qtde_item'] ?? 0);
                        $vlrUnitario = floatval($item['vlr_unitario'] ?? 0);
                        
                        // ✅ CRÍTICO: CALCULAR vlr_total no BACKEND (qtde * vlr_unitario)
                        $vlrTotalItem = $qtdeItem * $vlrUnitario;
                        
                        // ✅ DEBUG: Logar cada item individualmente
                        error_log("🔍 [ITEM $itemIndex] seq_item=$seqItem | qtde=$qtdeItem | vlr_unit=$vlrUnitario | vlr_total=$vlrTotalItem");
                        
                        if ($seqItem <= 0 || $qtdeItem <= 0) {
                            throw new Exception('Item ou quantidade inválidos');
                        }
                        
                        $resultItem = sql($queryItem, [
                            $seqPedido,
                            $seqItem,
                            $qtdeItem,
                            $vlrUnitario,
                            $vlrTotalItem
                        ], $g_sql);
                        
                        if (!$resultItem) {
                            throw new Exception('Erro ao inserir item do pedido');
                        }
                        
                        error_log("✅ [ITEM $itemIndex] INSERIDO NA TABELA pedido_item com seq_item=$seqItem");
                        
                        // ✅ ATUALIZAR VALOR UNITÁRIO DO ITEM NA TABELA item
                        if ($vlrUnitario > 0) {
                            $queryUpdateItem = "UPDATE $tblItem SET vlr_item = $1 WHERE seq_item = $2";
                            $resultUpdateItem = sql($queryUpdateItem, [$vlrUnitario, $seqItem], $g_sql);
                            
                            if (!$resultUpdateItem) {
                                error_log("⚠️ Erro ao atualizar vlr_item para seq_item: $seqItem");
                            } else {
                                error_log("✅ vlr_item atualizado para seq_item $seqItem: $vlrUnitario");
                            }
                        }
                        
                        $itemIndex++; // ✅ Incrementar contador
                    }
                }
                
                // ✅ ATUALIZAR seq_pedido DAS ORDENS DE COMPRA SELECIONADAS
                if (!empty($ordensCompra)) {
                    $queryUpdateOC = "UPDATE $tblOrdemCompra SET seq_pedido = $1 WHERE seq_ordem_compra = $2";
                    
                    foreach ($ordensCompra as $seqOrdemCompra) {
                        $resultUpdate = sql($queryUpdateOC, [$seqPedido, $seqOrdemCompra], $g_sql);
                        
                        if (!$resultUpdate) {
                            throw new Exception('Erro ao vincular ordem de compra ao pedido');
                        }
                    }
                }
                
                sql("COMMIT", [], $g_sql);
                
                // ✅ FORMATAR NÚMERO DO PEDIDO: XXX00000
                $nroPedidoFormatado = $unidade . str_pad($nroPedido, 7, '0', STR_PAD_LEFT);
                
                // ✅ RETORNAR seq_pedido para permitir envio de email logo após criação
                // ✅ msg() com dados adicionais
                msg('Pedido ' . $nroPedidoFormatado . ' criado com sucesso!' . $mensagemAdicional, 'success', 200, [
                    'seq_pedido' => intval($seqPedido),
                    'nro_pedido' => intval($nroPedido),
                    'nro_pedido_formatado' => $nroPedidoFormatado,
                    'status' => $statusInicial
                ]);
                
            } catch (Exception $e) {
                sql("ROLLBACK", [], $g_sql);
                error_log("Erro ao criar pedido: " . $e->getMessage());
                msg('Erro ao criar pedido: ' . $e->getMessage(), 'error');
            }
            break;
            
        case 'PUT':
            // ATUALIZAR PEDIDO
            $seqPedido = $input['seq_pedido'] ?? null;
            
            if (!$seqPedido) {
                echo json_encode(['success' => false, 'message' => 'ID do pedido não fornecido']);
                exit;
            }
            
            $fields = [];
            $params = [];
            $paramCount = 1;
            
            if (isset($input['status'])) {
                $fields[] = "status = $" . $paramCount++;
                $params[] = strtoupper($input['status']);
            }
            
            if (isset($input['observacao'])) {
                $fields[] = "observacao = $" . $paramCount++;
                $params[] = strtoupper($input['observacao']);
            }
            
            if (isset($input['ser_nf'])) {
                $fields[] = "ser_nf = $" . $paramCount++;
                $params[] = strtoupper($input['ser_nf']);
            }
            
            if (isset($input['nro_nf'])) {
                $fields[] = "nro_nf = $" . $paramCount++;
                $params[] = strtoupper($input['nro_nf']);
            }
            
            if (isset($input['chave_nfe'])) {
                $fields[] = "chave_nfe = $" . $paramCount++;
                $params[] = strtoupper($input['chave_nfe']);
            }
            
            if (empty($fields)) {
                echo json_encode(['success' => false, 'message' => 'Nenhum campo para atualizar']);
                exit;
            }
            
            // Se está finalizando, adicionar campos de finalização
            if (isset($input['status']) && $input['status'] === 'ENTREGUE') {
                $fields[] = "data_fin = CURRENT_DATE";
                $fields[] = "hora_fin = CURRENT_TIME";
                $fields[] = "login_fin = $" . $paramCount++;
                $params[] = $login;
            }
            
            $params[] = $seqPedido;
            
            $query = "UPDATE $tblPedido SET " . implode(', ', $fields) . " WHERE seq_pedido = $" . $paramCount;
            
            sql($query, $params, $g_sql);
            
            msg('Pedido atualizado com sucesso!', 'success');
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // VERIFICAR SE É ESTORNO DE PEDIDO GERADO POR ORÇAMENTO
            if (isset($_GET['action']) && $_GET['action'] === 'estornar') {
                estornarPedidoOrcamento($g_sql, $prefix, $tblPedido, $tblPedidoItem, $tblOrcamento, $login);
                exit;
            }
            
            // EXCLUIR PEDIDO
            $seqPedido = $_GET['seq_pedido'] ?? null;
            
            if (!$seqPedido) {
                echo json_encode(['success' => false, 'message' => 'ID do pedido não fornecido']);
                exit;
            }
            
            // ✅ VERIFICAR SE PEDIDO ESTÁ PENDENTE (apenas pendentes podem ser excluídos)
            $query = "SELECT status, seq_orcamento, unidade, nro_pedido FROM $tblPedido WHERE seq_pedido = $1";
            $result = sql($query, [$seqPedido], $g_sql);
            
            if (pg_num_rows($result) === 0) {
                msg('Pedido não encontrado', 'error');
            }
            
            $pedido = pg_fetch_assoc($result);
            
            // ✅ ATUALIZADO: Permite excluir pedidos com status 'A' (Aguardando) ou 'P' (Pendente)
            if ($pedido['status'] !== 'P' && $pedido['status'] !== 'A') {
                msg('Apenas pedidos PENDENTES ou AGUARDANDO APROVAÇÃO podem ser excluídos', 'error');
            }
            
            // ✅ VERIFICAR SE É PEDIDO MANUAL (seq_orcamento NULL ou 0)
            if ($pedido['seq_orcamento'] && $pedido['seq_orcamento'] != 0) {
                msg('Apenas pedidos MANUAIS podem ser cancelados. Para pedidos gerados por orçamento, utilize a opção de estorno.', 'error');
            }
            
            // ✅ INICIAR TRANSAÇÃO PARA REVERTER TUDO
            sql("BEGIN", [], $g_sql);
            
            try {
                // 1. ✅ REMOVER seq_pedido DAS ORDENS DE COMPRA (reverter vínculo)
                $queryUpdateOC = "UPDATE $tblOrdemCompra SET seq_pedido = NULL WHERE seq_pedido = $1";
                sql($queryUpdateOC, [$seqPedido], $g_sql);
                
                // 2. ✅ EXCLUIR ITENS DO PEDIDO
                $query = "DELETE FROM $tblPedidoItem WHERE seq_pedido = $1";
                sql($query, [$seqPedido], $g_sql);
                
                // 3. ✅ EXCLUIR PEDIDO
                $query = "DELETE FROM $tblPedido WHERE seq_pedido = $1";
                sql($query, [$seqPedido], $g_sql);
                
                sql("COMMIT", [], $g_sql);
                
                // ✅ FORMATAR NÚMERO DO PEDIDO PARA MENSAGEM
                $nroPedidoFormatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 6, '0', STR_PAD_LEFT);
                msg('Pedido ' . $nroPedidoFormatado . ' cancelado com sucesso! As ordens de compra voltaram a ficar disponíveis.', 'success');
                echo json_encode(['success' => true]);
                
            } catch (Exception $e) {
                sql("ROLLBACK", [], $g_sql);
                error_log("Erro ao excluir pedido: " . $e->getMessage());
                msg('Erro ao excluir pedido: ' . $e->getMessage(), 'error');
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
    
} catch (Exception $e) {
    error_log("❌ ERRO EM pedidos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro no servidor: ' . $e->getMessage()
    ]);
} finally {
    // ✅ Fechar conexão (SSW gerencia conexões automaticamente)
    if (isset($g_sql) && $g_sql && is_resource($g_sql)) {
        @pg_close($g_sql);
    }
}

/**
 * ESTORNAR PEDIDO GERADO POR ORÇAMENTO
 * - Deleta o pedido e seus itens
 * - Volta o orçamento para status PENDENTE
 */
function estornarPedidoOrcamento($g_sql, $prefix, $tblPedido, $tblPedidoItem, $tblOrcamento, $login) {
    $seqPedido = $_GET['seq_pedido'] ?? null;
    
    if (!$seqPedido) {
        msg('ID do pedido não fornecido', 'error');
    }
    
    // Buscar pedido
    $query = "SELECT seq_pedido, seq_orcamento, status, unidade, nro_pedido FROM $tblPedido WHERE seq_pedido = $1";
    $result = sql($query, [$seqPedido], $g_sql);
    
    if (pg_num_rows($result) === 0) {
        msg('Pedido não encontrado', 'error');
    }
    
    $pedido = pg_fetch_assoc($result);
    
    // Verificar se tem orçamento vinculado
    if (!$pedido['seq_orcamento'] || $pedido['seq_orcamento'] == 0) {
        msg('Este pedido não foi gerado por orçamento', 'error');
    }
    
    // Verificar se pedido NÃO está entregue (apenas P podem ser estornados)
    if ($pedido['status'] === 'E') {
        msg('Pedido já foi entregue. Não é possível estornar.', 'error');
    }
    
    // Iniciar transação
    sql("BEGIN", [], $g_sql);
    
    try {
        // 1. Deletar itens do pedido
        $queryDelItens = "DELETE FROM $tblPedidoItem WHERE seq_pedido = $1";
        sql($queryDelItens, [$seqPedido], $g_sql);
        
        // 2. Deletar pedido
        $queryDelPedido = "DELETE FROM $tblPedido WHERE seq_pedido = $1";
        sql($queryDelPedido, [$seqPedido], $g_sql);
        
        // 3. Verificar se há outros pedidos vinculados ao orçamento
        $queryCheckPedidos = "SELECT COUNT(*) as total FROM $tblPedido WHERE seq_orcamento = $1";
        $resultCheck = sql($queryCheckPedidos, [$pedido['seq_orcamento']], $g_sql);
        $rowCheck = pg_fetch_assoc($resultCheck);
        
        // 4. Se não há mais pedidos, voltar orçamento para PENDENTE
        if ($rowCheck['total'] == 0) {
            $queryUpdateOrc = "UPDATE $tblOrcamento 
                               SET status = 'PENDENTE',
                                   data_aprovacao = NULL,
                                   hora_aprovacao = NULL,
                                   login_aprovacao = NULL
                               WHERE seq_orcamento = $1";
            sql($queryUpdateOrc, [$pedido['seq_orcamento']], $g_sql);
        }
        
        sql("COMMIT", [], $g_sql);
        
        $nroPedidoFormatado = $pedido['unidade'] . str_pad($pedido['nro_pedido'], 7, '0', STR_PAD_LEFT);
        msg('Pedido ' . $nroPedidoFormatado . ' estornado com sucesso!', 'success');
        echo json_encode(['success' => true]);
        
    } catch (Exception $e) {
        sql("ROLLBACK", [], $g_sql);
        error_log("Erro ao estornar pedido: " . $e->getMessage());
        msg('Erro ao estornar pedido: ' . $e->getMessage(), 'error');
    }
}