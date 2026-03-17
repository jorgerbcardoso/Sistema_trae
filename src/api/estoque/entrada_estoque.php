<?php
/**
 * API ESTOQUE - ENTRADAS NO ESTOQUE
 * Gerencia entradas manuais e via pedidos de compra
 * 
 * TABELA BASE: [dominio]_mvto_estoque
 * - mvto = 'E' (Entrada)
 * - tipo = 'E' (Entrada Manual) ou 'P' (Entrada via Pedido)
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
error_log("=== ENTRADA_ESTOQUE - DEBUG ===");
error_log("Domain: " . $domain);
error_log("Login: " . $login);
error_log("Unidade atual: " . $unidadeAtual);

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($domain) . '_';
$tblMvtoEstoque = $prefix . 'mvto_estoque';
$tblEstoque = $prefix . 'estoque';
$tblPosicao = $prefix . 'posicao';
$tblPedido = $prefix . 'pedido';
$tblFornecedor = $prefix . 'fornecedor';
$tblItem = $prefix . 'item';
$tblUnidadeMedida = $prefix . 'unidade_medida';

// ✅ VERIFICAR SE É MTZ OU ALL (ambos veem tudo)
$unidadeAtualUpper = strtoupper($unidadeAtual);
$isMTZ = ($unidadeAtualUpper === 'MTZ' || $unidadeAtualUpper === 'ALL');

error_log("É MTZ/ALL (vê tudo)? " . ($isMTZ ? 'SIM' : 'NÃO'));
error_log("================================");

// ✅ Conectar ao banco
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $_GET['action'] ?? '';
    
    switch ($method) {
        case 'GET':
            if ($action === 'detalhes' && isset($_GET['seq_entrada'])) {
                // ===============================================
                // BUSCAR DETALHES DE UMA ENTRADA ESPECÍFICA
                // ===============================================
                $seqEntrada = intval($_GET['seq_entrada']);
                
                error_log("🔍 Buscando detalhes da entrada: seq_mvto_estoque = " . $seqEntrada);
                
                // BUSCAR DIRETAMENTE PELO seq_mvto_estoque
                $query = "
                    SELECT 
                        m.*,
                        pos.seq_estoque,
                        pos.rua,
                        pos.altura,
                        pos.coluna,
                        (COALESCE(pos.rua, '') || ' / ' || COALESCE(pos.altura, '') || ' / ' || COALESCE(pos.coluna, '')) AS posicao_descricao,
                        e.descricao AS estoque_descricao,
                        e.nro_estoque,
                        e.unidade,
                        i.codigo,
                        i.descricao AS item_descricao,
                        um.sigla AS unidade_medida,
                        ped.nro_pedido,
                        ped.nro_lancto,
                        ped.seq_fornecedor,
                        f.nome AS fornecedor_nome,
                        f.cnpj AS fornecedor_cnpj
                    FROM $tblMvtoEstoque m
                    LEFT JOIN $tblPosicao pos ON pos.seq_posicao = m.seq_posicao
                    LEFT JOIN $tblEstoque e ON e.seq_estoque = pos.seq_estoque
                    LEFT JOIN $tblItem i ON i.seq_item = m.seq_item
                    LEFT JOIN $tblUnidadeMedida um ON um.seq_unidade_medida = i.seq_unidade_medida
                    LEFT JOIN $tblPedido ped ON ped.seq_pedido = m.seq_origem AND m.tipo = 'P'
                    LEFT JOIN $tblFornecedor f ON f.seq_fornecedor = ped.seq_fornecedor
                    WHERE m.seq_mvto_estoque = $1
                      AND m.mvto = 'E'
                ";
                
                error_log("🔍 Query detalhes: " . $query);
                error_log("🔍 Parâmetro: " . $seqEntrada);
                
                $result = sql($query, [$seqEntrada], $g_sql);
                
                if ($result === false) {
                    error_log("❌ Erro na query detalhes: " . pg_last_error($g_sql));
                    msg('Erro ao buscar entrada', 'error');
                }
                
                $numRows = pg_num_rows($result);
                error_log("✅ Query detalhes retornou: " . $numRows . " registro(s)");
                
                if ($numRows === 0) {
                    error_log("❌ Entrada não encontrada!");
                    msg('Entrada não encontrada', 'error');
                }
                
                $row = pg_fetch_assoc($result);
                
                // Montar resposta
                $entrada = [
                    'seq_entrada' => $seqEntrada,
                    'unidade' => $row['unidade'],
                    'seq_estoque' => intval($row['seq_estoque']),
                    'estoque_descricao' => $row['estoque_descricao'],
                    'tipo_entrada' => ($row['tipo'] === 'P') ? 'PEDIDO' : 'MANUAL',
                    'tipo' => $row['tipo'],
                    'seq_pedido' => $row['seq_origem'],
                    'nro_pedido' => $row['nro_pedido'],
                    'nro_lancto' => $row['nro_lancto'], // ✅ NOVO: Número do lançamento SSW
                    'seq_fornecedor' => $row['seq_fornecedor'],
                    'fornecedor_nome' => $row['fornecedor_nome'],
                    'fornecedor_cnpj' => $row['fornecedor_cnpj'],
                    'ser_nf' => null,
                    'nro_nf' => null,
                    'chave_nfe' => null,
                    'observacao' => $row['observacao'],
                    'data_entrada' => $row['data_mvto'],
                    'hora_entrada' => $row['hora_mvto'],
                    'login_entrada' => $row['login'],
                    'itens' => [[
                        'seq_item' => intval($row['seq_item']),
                        'codigo' => $row['codigo'],
                        'descricao' => $row['item_descricao'],
                        'unidade_medida' => $row['unidade_medida'],
                        'qtde_pedida' => floatval($row['qtde_item']),
                        'qtde_recebida' => floatval($row['qtde_item']),
                        'seq_posicao' => intval($row['seq_posicao']),
                        'posicao_descricao' => $row['posicao_descricao'],
                        'vlr_unitario' => floatval($row['vlr_unitario']),
                        'vlr_total' => floatval($row['vlr_total'])
                    ]]
                ];
                
                error_log("✅ Entrada encontrada!");
                
                echo json_encode(['success' => true, 'data' => $entrada]);
                
            } elseif ($action === 'listar') {
                // ===============================================
                // LISTAR ENTRADAS (AGRUPADAS POR DATA/ORIGEM)
                // ===============================================
                $where = ["m.mvto = 'E'"]; // Apenas entradas
                $params = [];
                $paramCount = 1;
                
                // ✅ FILTRO POR UNIDADE (apenas não-MTZ)
                if (!$isMTZ) {
                    $where[] = "e.unidade = $" . $paramCount++;
                    $params[] = strtoupper($unidadeAtual);
                }
                
                // Filtro por tipo
                if (isset($_GET['tipo']) && !empty($_GET['tipo'])) {
                    $tipoFiltro = strtoupper($_GET['tipo']);
                    // Frontend envia: MANUAL ou PEDIDO
                    // Converter para: E ou P
                    $tipoBD = ($tipoFiltro === 'MANUAL') ? 'E' : 'P';
                    $where[] = "m.tipo = $" . $paramCount++;
                    $params[] = $tipoBD;
                }
                
                // Filtro por período
                if (isset($_GET['data_inicio']) && !empty($_GET['data_inicio'])) {
                    $where[] = "m.data_mvto >= $" . $paramCount++;
                    $params[] = $_GET['data_inicio'];
                }
                
                if (isset($_GET['data_fim']) && !empty($_GET['data_fim'])) {
                    $where[] = "m.data_mvto <= $" . $paramCount++;
                    $params[] = $_GET['data_fim'];
                }
                
                $whereClause = implode(' AND ', $where);
                
                // Query agrupada por data/tipo/origem
                $query = "
                    SELECT 
                        MIN(m.seq_mvto_estoque) AS seq_entrada,
                        MAX(e.unidade) AS unidade,
                        MAX(pos.seq_estoque) AS seq_estoque,
                        MAX(e.descricao) AS estoque_descricao,
                        CASE 
                            WHEN m.tipo = 'P' THEN 'PEDIDO'
                            ELSE 'MANUAL'
                        END AS tipo_entrada,
                        m.tipo,
                        m.seq_origem AS seq_pedido,
                        MAX(ped.nro_pedido) AS nro_pedido,
                        MAX(ped.seq_fornecedor) AS seq_fornecedor,
                        MAX(f.nome) AS fornecedor_nome,
                        NULL AS ser_nf,
                        NULL AS nro_nf,
                        NULL AS chave_nfe,
                        MAX(m.observacao) AS observacao,
                        m.data_mvto AS data_entrada,
                        MIN(m.hora_mvto) AS hora_entrada,
                        m.login AS login_entrada,
                        COUNT(DISTINCT m.seq_item) AS qtd_itens,
                        SUM(m.vlr_total) AS vlr_total
                    FROM $tblMvtoEstoque m
                    INNER JOIN $tblPosicao pos ON pos.seq_posicao = m.seq_posicao
                    INNER JOIN $tblEstoque e ON e.seq_estoque = pos.seq_estoque
                    LEFT JOIN $tblPedido ped ON ped.seq_pedido = m.seq_origem AND m.tipo = 'P'
                    LEFT JOIN $tblFornecedor f ON f.seq_fornecedor = ped.seq_fornecedor
                    WHERE $whereClause
                    GROUP BY 
                        m.tipo,
                        m.seq_origem,
                        m.data_mvto,
                        m.login
                    ORDER BY m.data_mvto DESC, MIN(m.hora_mvto) DESC
                ";
                
                $result = sql($query, $params, $g_sql);
                
                if ($result === false) {
                    $error = pg_last_error($g_sql);
                    error_log("ERRO ao listar entradas: " . $error);
                    msg('Erro ao listar entradas: ' . $error, 'error');
                }
                
                $entradas = [];
                while ($row = pg_fetch_assoc($result)) {
                    // ✅ Converter valores numéricos
                    $row['qtd_itens'] = intval($row['qtd_itens']);
                    $row['vlr_total'] = floatval($row['vlr_total']);
                    $row['seq_entrada'] = intval($row['seq_entrada']);
                    
                    $entradas[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $entradas]);
                
            } elseif ($action === 'buscar-pedidos' && isset($_GET['seq_fornecedor'])) {
                // ===============================================
                // BUSCAR PEDIDOS PENDENTES DE UM FORNECEDOR
                // ===============================================
                $seqFornecedor = intval($_GET['seq_fornecedor']);
                
                error_log("🔍 Buscando pedidos PENDENTES para fornecedor: " . $seqFornecedor);
                
                $query = "
                    SELECT 
                        p.seq_pedido,
                        p.unidade,
                        p.unidade || LPAD(p.nro_pedido::TEXT, 6, '0') AS nro_pedido,
                        p.data_inclusao,
                        p.hora_inclusao,
                        p.login_inclusao,
                        p.seq_fornecedor,
                        p.seq_orcamento,
                        f.nome AS fornecedor_nome,
                        f.cnpj AS fornecedor_cnpj,
                        p.vlr_total,
                        p.observacao,
                        p.status,
                        CASE 
                            WHEN p.seq_orcamento IS NULL THEN 'MANUAL'
                            ELSE 'ORÇAMENTO'
                        END AS tipo_pedido,
                        TO_CHAR(p.data_inclusao, 'DD/MM/YY') || ' ' || 
                        TO_CHAR(p.hora_inclusao, 'HH24:MI') || ' ' || 
                        p.login_inclusao AS inclusao_info,
                        (
                            SELECT COUNT(*) 
                            FROM {$prefix}pedido_item 
                            WHERE seq_pedido = p.seq_pedido
                        ) AS qtd_itens,
                        (
                            SELECT COALESCE(SUM(qtde_item), 0)
                            FROM {$prefix}pedido_item 
                            WHERE seq_pedido = p.seq_pedido
                        ) AS qtd_total_itens
                    FROM $tblPedido p
                    INNER JOIN $tblFornecedor f ON f.seq_fornecedor = p.seq_fornecedor
                    WHERE p.seq_fornecedor = $1
                      AND p.status = 'P'
                    ORDER BY p.data_inclusao DESC, p.hora_inclusao DESC
                ";
                
                error_log("📝 Query: " . $query);
                error_log("📝 Params: [" . $seqFornecedor . "]");
                
                $result = sql($query, [$seqFornecedor], $g_sql);
                
                if ($result === false) {
                    $error = pg_last_error($g_sql);
                    error_log("❌ Erro ao buscar pedidos: " . $error);
                    msg('Erro SQL ao buscar pedidos: ' . $error, 'error');
                }
                
                $pedidos = [];
                while ($row = pg_fetch_assoc($result)) {
                    $row['seq_pedido'] = intval($row['seq_pedido']);
                    $row['qtd_itens'] = intval($row['qtd_itens']);
                    $row['qtd_total_itens'] = floatval($row['qtd_total_itens']);
                    $row['vlr_total'] = floatval($row['vlr_total']);
                    $row['seq_orcamento'] = $row['seq_orcamento'] ? intval($row['seq_orcamento']) : null;
                    $pedidos[] = $row;
                }
                
                error_log("✅ Pedidos PENDENTES encontrados: " . count($pedidos));
                
                if (count($pedidos) === 0) {
                    error_log("⚠️ Nenhum pedido PENDENTE encontrado para fornecedor: " . $seqFornecedor);
                }
                
                echo json_encode(['success' => true, 'data' => $pedidos]);
                
            } elseif ($action === 'itens-pedido' && isset($_GET['seq_pedido'])) {
                // ===============================================
                // BUSCAR ITENS DE UM PEDIDO ESPECÍFICO
                // ===============================================
                $seqPedido = intval($_GET['seq_pedido']);
                
                error_log("🔍 Buscando itens do pedido: " . $seqPedido);
                
                $query = "
                    SELECT 
                        pi.seq_pedido_item,
                        pi.seq_pedido,
                        pi.seq_item,
                        i.codigo,
                        i.descricao,
                        um.sigla AS unidade_medida,
                        pi.qtde_item AS qtde_pedida,
                        pi.qtde_item AS qtde_recebida,
                        pi.vlr_unitario,
                        pi.vlr_total
                    FROM {$prefix}pedido_item pi
                    INNER JOIN $tblItem i ON i.seq_item = pi.seq_item
                    LEFT JOIN $tblUnidadeMedida um ON um.seq_unidade_medida = i.seq_unidade_medida
                    WHERE pi.seq_pedido = $1
                    ORDER BY pi.seq_pedido_item
                ";
                
                error_log("📝 Query: " . $query);
                error_log("📝 Params: [" . $seqPedido . "]");
                
                $result = sql($query, [$seqPedido], $g_sql);
                
                if ($result === false) {
                    $error = pg_last_error($g_sql);
                    error_log("❌ Erro ao buscar itens do pedido: " . $error);
                    msg('Erro SQL ao buscar itens do pedido: ' . $error, 'error');
                }
                
                $itens = [];
                while ($row = pg_fetch_assoc($result)) {
                    $itens[] = [
                        'seq_item' => intval($row['seq_item']),
                        'codigo' => $row['codigo'],
                        'descricao' => $row['descricao'],
                        'unidade_medida' => $row['unidade_medida'] ?? '',
                        'qtde_pedida' => floatval($row['qtde_pedida']),
                        'qtde_recebida' => floatval($row['qtde_recebida']),
                        'seq_posicao' => null,
                        'posicao_descricao' => '',
                        'vlr_unitario' => floatval($row['vlr_unitario']),
                        'vlr_total' => floatval($row['vlr_total']),
                        'divergente' => false
                    ];
                }
                
                error_log("✅ Itens do pedido encontrados: " . count($itens));
                
                echo json_encode(['success' => true, 'data' => $itens]);
                
            } elseif ($action === 'eventos') {
                // ===============================================
                // BUSCAR EVENTOS DISPONÍVEIS PARA LANÇAMENTO SSW
                // ===============================================
                error_log("📋 Buscando eventos da tabela: " . $prefix . "evento");
                
                $tblEvento = $prefix . 'evento';
                
                $query = "
                    SELECT 
                        evento,
                        descricao,
                        considerar,
                        tipo
                    FROM $tblEvento
                    ORDER BY evento
                ";
                
                error_log("🔍 Query de eventos: " . $query);
                
                $result = sql($query, [], $g_sql);
                
                if ($result === false) {
                    $error = pg_last_error($g_sql);
                    error_log("❌ Erro SQL ao buscar eventos: " . $error);
                    msg('Erro SQL ao buscar eventos: ' . $error, 'error');
                }
                
                $eventos = [];
                while ($row = pg_fetch_assoc($result)) {
                    $eventos[] = [
                        'evento' => $row['evento'],
                        'descricao' => $row['descricao'] ?? '',
                        'considerar' => $row['considerar'] ?? 'S',
                        'tipo' => $row['tipo'] ?? 'N'
                    ];
                }
                
                error_log("✅ Eventos encontrados: " . count($eventos));
                
                echo json_encode([
                    'success' => true,
                    'data' => $eventos,
                    'total' => count($eventos)
                ], JSON_UNESCAPED_UNICODE);
                
            } else {
                msg('Ação não especificada', 'error');
            }
            break;
            
        case 'POST':
            // ✅ VERIFICAR SE É ESTORNO
            $action = $input['action'] ?? '';
            
            if ($action === 'estornar') {
                // ===============================================
                // ESTORNAR ENTRADA (DESFAZER RIGOROSAMENTE)
                // ===============================================
                $seqEntrada = intval($input['seq_entrada'] ?? 0);
                
                if ($seqEntrada <= 0) {
                    msg('ID da entrada é obrigatório para estornar', 'error');
                }
                
                error_log("🔄 =========================================");
                error_log("🔄 INICIANDO ESTORNO DA ENTRADA");
                error_log("🔄 seq_mvto_estoque recebido: " . $seqEntrada);
                error_log("🔄 Tabela: " . $tblMvtoEstoque);
                error_log("🔄 =========================================");
                
                // Iniciar transação
                sql("BEGIN", [], $g_sql);
                error_log("✅ Transação iniciada");
                
                try {
                    // 1️⃣ BUSCAR A MOVIMENTAÇÃO PARA ESTORNAR
                    $queryMvto = "
                        SELECT 
                            m.*,
                            pos.seq_estoque
                        FROM $tblMvtoEstoque m
                        LEFT JOIN $tblPosicao pos ON pos.seq_posicao = m.seq_posicao
                        WHERE m.seq_mvto_estoque = $1
                          AND m.mvto = 'E'
                    ";
                    
                    error_log("1️⃣ Buscando movimentação...");
                    error_log("Query: " . $queryMvto);
                    error_log("Param seq_mvto_estoque: " . $seqEntrada);
                    
                    $resultMvto = sql($queryMvto, [$seqEntrada], $g_sql);
                    
                    if ($resultMvto === false) {
                        $erro = pg_last_error($g_sql);
                        error_log("❌ ERRO na query: " . $erro);
                        throw new Exception('Erro ao buscar entrada: ' . $erro);
                    }
                    
                    $numRows = pg_num_rows($resultMvto);
                    error_log("✅ Linhas encontradas: " . $numRows);
                    
                    if ($numRows === 0) {
                        error_log("❌ ENTRADA NÃO ENCONTRADA!");
                        throw new Exception('Entrada não encontrada');
                    }
                    
                    $mvto = pg_fetch_assoc($resultMvto);
                    $tipo = $mvto['tipo'];
                    $seqOrigem = $mvto['seq_origem'];
                    $dataMvto = $mvto['data_mvto'];
                    $loginMvto = $mvto['login'];
                    
                    error_log("✅ DADOS DA ENTRADA:");
                    error_log("   - Tipo: {$tipo}");
                    error_log("   - Seq Origem: " . ($seqOrigem ?: 'NULL'));
                    error_log("   - Data: {$dataMvto}");
                    error_log("   - Login: {$loginMvto}");
                    
                    // 2️⃣ BUSCAR TODOS OS ITENS DESTA ENTRADA (agrupados por tipo, seq_origem, data_mvto, login)
                    // Uma entrada pode ter múltiplos registros na tabela mvto_estoque (um por item)
                    $queryTodosItens = "
                        SELECT 
                            m.seq_mvto_estoque,
                            m.seq_posicao,
                            m.qtde_item,
                            m.seq_item
                        FROM $tblMvtoEstoque m
                        WHERE m.mvto = 'E'
                          AND m.tipo = $1
                          AND m.data_mvto = $2
                          AND m.login = $3
                          " . ($seqOrigem ? "AND m.seq_origem = $4" : "AND m.seq_origem IS NULL") . "
                    ";
                    
                    $paramsItens = [$tipo, $dataMvto, $loginMvto];
                    if ($seqOrigem) {
                        $paramsItens[] = $seqOrigem;
                    }
                    
                    error_log("2️⃣ Buscando TODOS os itens desta entrada...");
                    error_log("Query: " . $queryTodosItens);
                    error_log("Params: " . json_encode($paramsItens));
                    
                    $resultItens = sql($queryTodosItens, $paramsItens, $g_sql);
                    
                    if ($resultItens === false) {
                        $erro = pg_last_error($g_sql);
                        error_log("❌ ERRO ao buscar itens: " . $erro);
                        throw new Exception('Erro ao buscar itens da entrada: ' . $erro);
                    }
                    
                    $itens = [];
                    while ($row = pg_fetch_assoc($resultItens)) {
                        $itens[] = $row;
                    }
                    
                    $totalItens = count($itens);
                    error_log("✅ Total de itens encontrados: {$totalItens}");
                    
                    if ($totalItens === 0) {
                        throw new Exception('Nenhum item encontrado para esta entrada');
                    }
                    
                    // 3️⃣ VERIFICAR SALDO E REVERTER PARA CADA ITEM
                    foreach ($itens as $item) {
                        $seqPosicao = intval($item['seq_posicao']);
                        $qtdeItem = floatval($item['qtde_item']);
                        $seqMvtoEstoque = intval($item['seq_mvto_estoque']);
                        
                        error_log("📦 Processando item seq_mvto_estoque={$seqMvtoEstoque}, posição={$seqPosicao}, qtde={$qtdeItem}");
                        
                        // Verificar saldo
                        $querySaldo = "
                            SELECT saldo
                            FROM $tblPosicao
                            WHERE seq_posicao = $1
                        ";
                        
                        $resultSaldo = sql($querySaldo, [$seqPosicao], $g_sql);
                        $rowSaldo = pg_fetch_assoc($resultSaldo);
                        $saldoAtual = floatval($rowSaldo['saldo'] ?? 0);
                        
                        if ($saldoAtual < $qtdeItem) {
                            error_log("❌ SALDO INSUFICIENTE NA POSIÇÃO {$seqPosicao}!");
                            throw new Exception("Saldo insuficiente na posição {$seqPosicao} para estornar. Saldo atual: {$saldoAtual}, necessário: {$qtdeItem}");
                        }
                        
                        // Reverter saldo
                        $queryUpdatePos = "
                            UPDATE $tblPosicao 
                            SET saldo = saldo - $1 
                            WHERE seq_posicao = $2
                        ";
                        
                        $resultUpdate = sql($queryUpdatePos, [$qtdeItem, $seqPosicao], $g_sql);
                        
                        if ($resultUpdate === false) {
                            $erro = pg_last_error($g_sql);
                            error_log("❌ ERRO ao reverter saldo da posição {$seqPosicao}: " . $erro);
                            throw new Exception('Erro ao reverter saldo da posição: ' . $erro);
                        }
                        
                        error_log("   ✅ Saldo revertido: -{$qtdeItem}");
                    }
                    
                    error_log("✅ Todos os saldos revertidos com sucesso!");
                    
                    // 4️⃣ DELETAR TODAS AS MOVIMENTAÇÕES DESTA ENTRADA
                    $queryDelete = "
                        DELETE FROM $tblMvtoEstoque
                        WHERE mvto = 'E'
                          AND tipo = $1
                          AND data_mvto = $2
                          AND login = $3
                          " . ($seqOrigem ? "AND seq_origem = $4" : "AND seq_origem IS NULL") . "
                    ";
                    
                    $paramsDelete = [$tipo, $dataMvto, $loginMvto];
                    if ($seqOrigem) {
                        $paramsDelete[] = $seqOrigem;
                    }
                    
                    error_log("4️⃣ Deletando TODAS as movimentações...");
                    error_log("Query: " . $queryDelete);
                    error_log("Params: " . json_encode($paramsDelete));
                    
                    $resultDelete = sql($queryDelete, $paramsDelete, $g_sql);
                    
                    if ($resultDelete === false) {
                        $errorDelete = pg_last_error($g_sql);
                        error_log("❌ ERRO ao deletar movimentações: " . $errorDelete);
                        throw new Exception('Erro ao deletar movimentações: ' . $errorDelete);
                    }
                    
                    $rowsDeleted = pg_affected_rows($resultDelete);
                    error_log("✅ MOVIMENTAÇÕES DELETADAS: {$rowsDeleted} registro(s) removido(s)");
                    
                    if ($rowsDeleted !== $totalItens) {
                        error_log("⚠️ AVISO: Esperado deletar {$totalItens} itens, mas deletou {$rowsDeleted}");
                    }
                    
                    // 5️⃣ SE FOI ENTRADA VIA PEDIDO, REVERTER STATUS DO PEDIDO PARA 'P' (PENDENTE)
                    if ($tipo === 'P' && $seqOrigem) {
                        // Verificar se ainda existem outras entradas deste pedido
                        $queryCheckOutras = "
                            SELECT COUNT(*) as total
                            FROM $tblMvtoEstoque
                            WHERE seq_origem = $1
                              AND tipo = 'P'
                              AND mvto = 'E'
                        ";
                        
                        $resultCheck = sql($queryCheckOutras, [$seqOrigem], $g_sql);
                        $rowCheck = pg_fetch_assoc($resultCheck);
                        $totalOutras = intval($rowCheck['total'] ?? 0);
                        
                        // Se não tem mais entradas deste pedido, reverter status
                        if ($totalOutras === 0) {
                            $queryRevertePedido = "
                                UPDATE $tblPedido 
                                SET status = 'P',
                                    data_fin = NULL,
                                    hora_fin = NULL,
                                    login_fin = NULL
                                WHERE seq_pedido = $1
                            ";
                            
                            error_log("5️⃣ Revertendo status do pedido {$seqOrigem}...");
                            
                            $resultPedido = sql($queryRevertePedido, [$seqOrigem], $g_sql);
                            
                            if ($resultPedido === false) {
                                $erro = pg_last_error($g_sql);
                                error_log("❌ ERRO ao reverter status do pedido: " . $erro);
                                throw new Exception('Erro ao reverter status do pedido: ' . $erro);
                            }
                            
                            error_log("✅ Status do pedido {$seqOrigem} revertido para PENDENTE (P)");
                            
                            // 6️⃣ ESTORNAR LANÇAMENTO NO SSW (SE HOUVER)
                            error_log("6️⃣ Verificando se precisa estornar lançamento SSW...");
                            
                            // Buscar nro_lancto do pedido
                            $queryNroLancto = "
                                SELECT nro_lancto 
                                FROM $tblPedido 
                                WHERE seq_pedido = $1
                            ";
                            
                            $resultNroLancto = sql($queryNroLancto, [$seqOrigem], $g_sql);
                            
                            if ($resultNroLancto && pg_num_rows($resultNroLancto) > 0) {
                                $rowNroLancto = pg_fetch_assoc($resultNroLancto);
                                $nroLancto = trim($rowNroLancto['nro_lancto'] ?? '');
                                
                                error_log("📊 nro_lancto do pedido: " . ($nroLancto ?: 'NULL/VAZIO'));
                                
                                // Verificar se tem lançamento SSW (NOT NULL AND != 0)
                                if (!empty($nroLancto) && $nroLancto != '0') {
                                    error_log("✅ Pedido tem nro_lancto válido: {$nroLancto}");
                                    
                                    // Verificar se domínio tem SSW configurado
                                    $querySswDomain = "SELECT ssw_domain FROM domains WHERE domain = $1";
                                    $resultSswDomain = sql($querySswDomain, [strtoupper($domain)], $g_sql);
                                    
                                    if ($resultSswDomain && pg_num_rows($resultSswDomain) > 0) {
                                        $rowDomain = pg_fetch_assoc($resultSswDomain);
                                        $sswDomain = trim($rowDomain['ssw_domain'] ?? '');
                                        
                                        error_log("🔍 SSW Domain configurado: " . ($sswDomain ?: 'NULL/VAZIO'));
                                        
                                        if (!empty($sswDomain) && $sswDomain != '0') {
                                            error_log("🚀 Iniciando exclusão do lançamento SSW {$nroLancto}...");
                                            
                                            // Incluir biblioteca SSW
                                            require_once '/var/www/html/lib/ssw.php';
                                            
                                            // Fazer login no SSW
                                            ssw_login($sswDomain);
                                            error_log("✅ Login SSW executado");
                                            
                                            // Chamar função de exclusão
                                            try {
                                                exclui_despesa_ssw($nroLancto);
                                                error_log("✅ Lançamento SSW {$nroLancto} excluído com sucesso!");
                                                
                                                // Limpar nro_lancto do pedido
                                                $queryLimparLancto = "
                                                    UPDATE $tblPedido 
                                                    SET nro_lancto = NULL 
                                                    WHERE seq_pedido = $1
                                                ";
                                                sql($queryLimparLancto, [$seqOrigem], $g_sql);
                                                error_log("✅ nro_lancto limpo do pedido");
                                                
                                            } catch (Exception $e) {
                                                error_log("❌ ERRO ao excluir lançamento SSW: " . $e->getMessage());
                                                throw new Exception('Erro ao excluir lançamento SSW: ' . $e->getMessage());
                                            }
                                        } else {
                                            error_log("ℹ️ Domínio não tem SSW configurado - não será estornado");
                                        }
                                    } else {
                                        error_log("⚠️ Domínio não encontrado na tabela domains");
                                    }
                                } else {
                                    error_log("ℹ️ Pedido não tem lançamento SSW (nro_lancto vazio ou 0)");
                                }
                            }
                        } else {
                            error_log("⚠️ Pedido {$seqOrigem} ainda tem {$totalOutras} entrada(s). Status não foi revertido.");
                        }
                    }
                    
                    // ✅ COMMIT
                    sql("COMMIT", [], $g_sql);
                    
                    error_log("✅ ESTORNO CONCLUÍDO COM SUCESSO!");
                    
                    // ✅ Usar msg() para seguir padrão
                    msg('Entrada estornada com sucesso!', 'success');
                    
                } catch (Exception $e) {
                    sql("ROLLBACK", [], $g_sql);
                    error_log("❌ Erro ao estornar entrada: " . $e->getMessage());
                    msg('Erro ao estornar entrada: ' . $e->getMessage(), 'error');
                }
                
                break;
            }
            
            // ===============================================
            // CRIAR NOVA ENTRADA (MÚLTIPLOS ITENS)
            // ===============================================
            $tipoEntrada = strtoupper($input['tipo_entrada'] ?? 'MANUAL');
            
            // Converter: MANUAL -> E, PEDIDO -> P
            $tipo = ($tipoEntrada === 'PEDIDO') ? 'P' : 'E';
            
            $seqEstoque = intval($input['seq_estoque'] ?? 0);
            $seqOrigem = isset($input['seq_pedido']) ? intval($input['seq_pedido']) : null;
            $seqFornecedor = isset($input['seq_fornecedor']) ? intval($input['seq_fornecedor']) : null;
            $serNf = isset($input['ser_nf']) ? strtoupper(trim($input['ser_nf'])) : null;
            $nroNf = isset($input['nro_nf']) ? strtoupper(trim($input['nro_nf'])) : null;
            $chaveNfe = isset($input['chave_nfe']) ? strtoupper(trim($input['chave_nfe'])) : null;
            $observacao = isset($input['observacao']) ? strtoupper(trim($input['observacao'])) : null;
            $itens = $input['itens'] ?? [];
            
            // Validações básicas
            if ($seqEstoque <= 0) {
                msg('Estoque é obrigatório', 'error');
            }
            
            if (empty($itens) || !is_array($itens)) {
                msg('Nenhum item informado', 'error');
            }
            
            // Validar cada item
            foreach ($itens as $index => $item) {
                $seqPosicao = intval($item['seq_posicao'] ?? 0);
                $seqItem = intval($item['seq_item'] ?? 0);
                $qtdeRecebida = floatval($item['qtde_recebida'] ?? 0);
                
                if ($seqPosicao <= 0) {
                    msg("Item " . ($index + 1) . ": Posição é obrigatória", 'error');
                }
                
                if ($seqItem <= 0) {
                    msg("Item " . ($index + 1) . ": Item é obrigatório", 'error');
                }
                
                if ($qtdeRecebida <= 0) {
                    msg("Item " . ($index + 1) . ": Quantidade deve ser maior que zero", 'error');
                }
            }
            
            // Iniciar transação
            sql("BEGIN", [], $g_sql);
            
            try {
                $totalMovimentacoes = 0;
                $vlrTotalNota = 0; // Para o SSW
                $nroLanctoSsw = null; // ✅ Armazenar número do lançamento SSW
                
                // Processar cada item
                foreach ($itens as $item) {
                    $seqPosicao = intval($item['seq_posicao']);
                    $seqItem = intval($item['seq_item']);
                    $qtdeRecebida = floatval($item['qtde_recebida']);
                    $vlrUnitario = floatval($item['vlr_unitario'] ?? 0);
                    $vlrTotal = $qtdeRecebida * $vlrUnitario;
                    $vlrTotalNota += $vlrTotal;
                    
                    // Inserir movimentação
                    $query = "
                        INSERT INTO $tblMvtoEstoque (
                            mvto, tipo, seq_origem, seq_posicao, seq_item,
                            qtde_item, vlr_unitario, vlr_total, observacao, login,
                            data_mvto, hora_mvto
                        ) VALUES (
                            'E', $1, $2, $3, $4, $5, $6, $7, $8, $9,
                            CURRENT_DATE, CURRENT_TIME
                        ) RETURNING seq_mvto_estoque
                    ";
                    
                    error_log("Inserindo movimentação...");
                    error_log("Query: " . $query);
                    error_log("Params: " . json_encode([
                        $tipo,
                        $seqOrigem,
                        $seqPosicao,
                        $seqItem,
                        $qtdeRecebida,
                        $vlrUnitario,
                        $vlrTotal,
                        $observacao,
                        $login
                    ]));
                    
                    $result = sql($query, [
                        $tipo,
                        $seqOrigem,
                        $seqPosicao,
                        $seqItem,
                        $qtdeRecebida,
                        $vlrUnitario,
                        $vlrTotal,
                        $observacao,
                        $login
                    ], $g_sql);
                    
                    if ($result === false) {
                        $erro = pg_last_error($g_sql);
                        error_log("❌ ERRO ao criar entrada para o item: " . $erro);
                        throw new Exception('Erro ao criar entrada para o item: ' . $erro);
                    }
                    
                    // ✅ ATUALIZAR SALDO DA POSIÇÃO
                    $queryUpdatePos = "
                        UPDATE $tblPosicao 
                        SET saldo = saldo + $1 
                        WHERE seq_posicao = $2
                    ";
                    sql($queryUpdatePos, [$qtdeRecebida, $seqPosicao], $g_sql);
                    
                    $totalMovimentacoes++;
                }
                
                // ✅ SE VIA PEDIDO, ATUALIZAR STATUS DO PEDIDO PARA 'ENTREGUE'
                if ($tipo === 'P' && $seqOrigem) {
                    $queryUpdatePedido = "
                        UPDATE $tblPedido 
                        SET status = 'E',
                            data_fin = CURRENT_DATE,
                            hora_fin = CURRENT_TIME,
                            login_fin = $1
                        WHERE seq_pedido = $2
                    ";
                    sql($queryUpdatePedido, [$login, $seqOrigem], $g_sql);
                    
                    // ✅ VERIFICAR SE DEVE LANÇAR NO SSW (APENAS PARA PEDIDOS)
                    $querySswDomain = "SELECT ssw_domain FROM domains WHERE domain = $1";
                    $resultSswDomain = sql($querySswDomain, [strtoupper($domain)], $g_sql);
                    
                    if ($resultSswDomain && pg_num_rows($resultSswDomain) > 0) {
                        $rowDomain = pg_fetch_assoc($resultSswDomain);
                        $sswDomain = trim($rowDomain['ssw_domain'] ?? '');
                        
                        error_log("🔍 SSW Domain: " . ($sswDomain ?: 'NULL/VAZIO'));
                        
                        // ✅ SE TEM SSW_DOMAIN CONFIGURADO, PERGUNTAR AO USUÁRIO
                        if (!empty($sswDomain)) {
                            error_log("💬 Perguntando ao usuário sobre lançamento no SSW...");
                            
                            $resposta = ask(
                                'Deseja fazer o lançamento no contas a pagar do SSW?',
                                'confirm',
                                'lancar_ssw',
                                false
                            );
                            
                            error_log("✅ Resposta do usuário: " . var_export($resposta, true));
                            
                            // ✅ VERIFICAR SE O USUÁRIO CANCELOU (null, vazio, ou não é boolean)
                            if ($resposta === null || $resposta === '' || !is_bool($resposta)) {
                                error_log("❌ USUÁRIO CANCELOU o dialog de confirmação SSW");
                                sql("ROLLBACK", [], $g_sql);
                                msg('Operação cancelada pelo usuário', 'info');
                            }
                            
                            // ✅ SE USUÁRIO ESCOLHEU NÃO - Apenas seguir sem lançar no SSW
                            if ($resposta === false) {
                                error_log("ℹ️ Usuário escolheu NÃO lançar no SSW - seguindo sem integração");
                                // Não faz nada, apenas continua o fluxo normal
                            }
                            
                            // ✅ SE USUÁRIO ESCOLHEU SIM
                            if ($resposta === true) {
                                error_log("🚀 Iniciando lançamento no SSW...");
                                
                                // ✅ INCLUIR BIBLIOTECA SSW
                                require_once '/var/www/html/lib/ssw.php';
                                error_log("✅ Biblioteca SSW incluída");
                                
                                // ✅ FAZER LOGIN NO SSW (função não retorna nada, apenas loga)
                                ssw_login($sswDomain);
                                error_log("✅ Login SSW executado");
                                
                                // ✅ BUSCAR EVENTOS DISPONÍVEIS (tabela [dominio]_evento)
                                $tblEvento = $prefix . 'evento';
                                error_log("📋 Tabela de eventos: " . $tblEvento);
                                
                                $queryEventos = "
                                    SELECT evento, descricao 
                                    FROM $tblEvento 
                                    ORDER BY evento
                                ";
                                
                                error_log("🔍 Query de eventos: " . $queryEventos);
                                
                                $resultEventos = sql($queryEventos, [], $g_sql);
                                
                                error_log("🔍 Resultado da query de eventos: " . ($resultEventos ? 'SUCESSO' : 'FALHA'));
                                
                                if ($resultEventos) {
                                    $numEventos = pg_num_rows($resultEventos);
                                    error_log("📊 Número de eventos encontrados: " . $numEventos);
                                } else {
                                    $erro = pg_last_error($g_sql);
                                    error_log("❌ Erro SQL ao buscar eventos: " . $erro);
                                }
                                
                                if (!$resultEventos || pg_num_rows($resultEventos) === 0) {
                                    sql("ROLLBACK", [], $g_sql);
                                    msg('Nenhum evento cadastrado para lançamento no SSW. Verifique a tabela ' . $tblEvento, 'error');
                                }
                                
                                // Montar opções de eventos para o usuário
                                $opcoesEventos = [];
                                while ($rowEvento = pg_fetch_assoc($resultEventos)) {
                                    $opcoesEventos[] = [
                                        'value' => $rowEvento['evento'],
                                        'label' => $rowEvento['evento'] . ' - ' . ($rowEvento['descricao'] ?? '')
                                    ];
                                    error_log("  📌 Evento: " . $rowEvento['evento'] . " - " . ($rowEvento['descricao'] ?? ''));
                                }
                                
                                error_log("📋 Total de opções montadas: " . count($opcoesEventos));
                                
                                // ✅ PERGUNTAR AO USUÁRIO QUAL EVENTO USAR
                                $eventoSelecionado = ask(
                                    'Selecione o evento (tipo de despesa) para o lançamento no SSW:',
                                    'evento',
                                    'evento_ssw'
                                );
                                
                                error_log("✅ Evento selecionado: " . $eventoSelecionado);
                                
                                if (empty($eventoSelecionado)) {
                                    sql("ROLLBACK", [], $g_sql);
                                    msg('Evento é obrigatório para lançamento no SSW', 'error');
                                }
                                
                                // ✅ PERGUNTAR CÓDIGO DE BARRAS DO BOLETO (OPCIONAL)
                                $codBarBoleto = ask(
                                    'Código de barras do boleto (opcional - deixe em branco se não tiver):',
                                    'text',
                                    'cod_bar_boleto',
                                    ''
                                );
                                
                                error_log("✅ Código de barras informado: " . ($codBarBoleto ?: 'VAZIO'));
                                
                                // ✅ BUSCAR DADOS DO FORNECEDOR E PEDIDO
                                $queryPedidoCompleto = "
                                    SELECT 
                                        p.*,
                                        f.cnpj AS fornecedor_cnpj
                                    FROM $tblPedido p
                                    INNER JOIN $tblFornecedor f ON f.seq_fornecedor = p.seq_fornecedor
                                    WHERE p.seq_pedido = $1
                                ";
                                
                                $resultPedido = sql($queryPedidoCompleto, [$seqOrigem], $g_sql);
                                
                                if (!$resultPedido || pg_num_rows($resultPedido) === 0) {
                                    // ⚠️ ERRO AO BUSCAR PEDIDO - INTERROMPE TODA A TRANSAÇÃO
                                    sql("ROLLBACK", [], $g_sql);
                                    msg('Pedido não encontrado para lançamento SSW', 'error');
                                }
                                
                                $dadosPedido = pg_fetch_assoc($resultPedido);
                                
                                // ✅ MONTAR STRING DE PARÂMETROS PARA SSW (formato: campo1|campo2|campo3@item1|item2)
                                // Estrutura da nota (primeiro bloco antes do @)
                                $cnpjFornecedor = $dadosPedido['fornecedor_cnpj'] ?? '';
                                $evento = $eventoSelecionado;
                                $serNfLancamento = $serNf ?? '';
                                $nroNfLancamento = $nroNf ?? '';
                                
                                // ✅ MODELO NF: 55 se tem chave_nfe, 01 se não tem
                                $modeloNf = (!empty($chaveNfe)) ? '55' : '01';
                                
                                $cfopSaida = ''; // Sempre vazio
                                
                                // ✅ CFOP = 0 (a função lanca_ssw_475 buscará internamente)
                                $cfopEntrada = 0;
                                
                                // ✅ DATAS NO FORMATO dmy (ex: 130225 para 13/02/2025)
                                $dataEmissao = date('dmy'); // Hoje
                                $dataEntrada = date('dmy'); // Hoje
                                
                                // ✅ VALORES: vlr_nf mantém formato americano (1234.56)
                                $vlrNf = number_format($vlrTotalNota, 2, '.', '');
                                
                                $historico = 'COMPRA REF PEDIDO ' . ($dadosPedido['nro_pedido'] ?? '');
                                
                                // ✅ vlr_parcela: formato brasileiro (1.234,56)
                                $vlrParcela = number_format($vlrTotalNota, 2, ',', '.');
                                
                                // ✅ data_vcto: +30 dias no formato dmy
                                $dataVcto = date('dmy', strtotime('+30 days'));
                                
                                // ✅ data_pgto: IGUAL a data_vcto (não vazio!)
                                $dataPgto = $dataVcto;
                                
                                // ✅ chave_nfe informada pelo usuário (posição 14)
                                $chaveNfeLancamento = $chaveNfe ?? '';
                                
                                $unid = strtoupper($unidadeAtual);
                                
                                // ✅ MÊS COMPETÊNCIA: formato "my" (ex: "0225" para fevereiro/2025)
                                $mesCompetencia = date('my');
                                
                                // Montar string da nota
                                $stringNota = implode('|', [
                                    $cnpjFornecedor,
                                    $evento,
                                    $serNfLancamento,
                                    $nroNfLancamento,
                                    $modeloNf,
                                    $cfopSaida,
                                    $cfopEntrada,
                                    $dataEmissao,
                                    $dataEntrada,
                                    $vlrNf,
                                    $historico,
                                    $vlrParcela,
                                    $dataVcto,
                                    $dataPgto,
                                    $chaveNfeLancamento,
                                    $unid,
                                    $mesCompetencia,
                                    $codBarBoleto
                                ]);
                                
                                // String completa (nota + @ + itens - por enquanto sem itens)
                                $stringCompleta = $stringNota;
                                
                                error_log("📝 String SSW montada: " . $stringCompleta);
                                
                                // ✅ CHAMAR FUNÇÃO DE LANÇAMENTO SSW
                                // ⚠️ IMPORTANTE: Se houver erro, a função lanca_ssw_475 chamará msg() 
                                //    que fará exit() e interromperá TODO o script (com ROLLBACK automático)
                                $resultadoSsw = lanca_ssw_475($stringCompleta);
                                
                                error_log("✅ Lançamento SSW realizado com sucesso!");
                                error_log("📊 Nro Lançamento SSW: " . $resultadoSsw);
                                
                                // ✅ SALVAR NRO_LANCTO NO PEDIDO (VÍNCULO PRESTO ↔ SSW)
                                $queryUpdateNroLancto = "
                                    UPDATE $tblPedido 
                                    SET nro_lancto = $1
                                    WHERE seq_pedido = $2
                                ";
                                
                                $resultUpdate = sql($queryUpdateNroLancto, [$resultadoSsw, $seqOrigem], $g_sql);
                                
                                if ($resultUpdate === false) {
                                    $erro = pg_last_error($g_sql);
                                    error_log("❌ ERRO ao salvar nro_lancto no pedido: " . $erro);
                                    // ⚠️ ROLLBACK automático pela exception
                                    throw new Exception('Erro ao salvar nro_lancto no pedido: ' . $erro);
                                }
                                
                                error_log("✅ nro_lancto {$resultadoSsw} salvo no pedido {$seqOrigem}");
                                
                                // ✅ Armazenar número do lançamento SSW
                                $nroLanctoSsw = $resultadoSsw;
                            }
                        }
                    }
                }
                
                sql("COMMIT", [], $g_sql);
                
                // ✅ MONTAR MENSAGEM DE SUCESSO COM NRO DO LANÇAMENTO SSW (SE HOUVER)
                $mensagemSucesso = "Entrada registrada com sucesso! {$totalMovimentacoes} item(ns) recebido(s).";
                if ($nroLanctoSsw !== null) {
                    $nroLanctoFormatado = str_pad($nroLanctoSsw, 6, '0', STR_PAD_LEFT);
                    $mensagemSucesso .= " Anote o número do lançamento: " . $nroLanctoFormatado;
                }
                
                // ✅ msg() já faz echo e exit, então NÃO precisa echo json_encode após
                msg($mensagemSucesso, 'success');
                
            } catch (Exception $e) {
                sql("ROLLBACK", [], $g_sql);
                error_log("Erro ao criar entrada: " . $e->getMessage());
                msg('Erro ao criar entrada: ' . $e->getMessage(), 'error');
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
    
} catch (Exception $e) {
    error_log("❌ ERRO EM entrada_estoque.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro no servidor: ' . $e->getMessage()
    ]);
} finally {
    // ✅ Fechar conexão
    if (isset($g_sql) && $g_sql && is_resource($g_sql)) {
        @pg_close($g_sql);
    }
}