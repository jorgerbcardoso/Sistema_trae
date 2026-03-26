<?php
/**
 * API: Solicitações de Compra
 * Descrição: Gerencia solicitações de compra (listar, criar, buscar itens, solicitar aprovação, excluir)
 * Métodos: GET, POST, PUT, DELETE
 */

require_once __DIR__ . '/../config.php';

// CONFIGURAÇÃO INICIAL
handleOptionsRequest();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

// AUTENTICAÇÃO
$auth = authenticateAndGetUser();
$user = $auth['user'];
$domain = $auth['domain'];

// RECEBER PARÂMETROS
$method = $_SERVER['REQUEST_METHOD'];

// VALIDAR DOMÍNIO
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    msg('Domínio inválido', 'error');
}

// BANCO DE DADOS
$conn = connect();
$prefix = strtolower($domain) . '_';

// CRIAR TABELAS SE NÃO EXISTIREM
criarTabelasSolicitacaoCompra($conn, $prefix);

// ROTEAMENTO
if ($method === 'GET') {
    handleGet($conn, $prefix, $user, $domain);
} elseif ($method === 'POST') {
    handlePost($conn, $prefix, $user, $domain);
} elseif ($method === 'PUT') {
    handlePut($conn, $prefix, $user, $domain);
} elseif ($method === 'DELETE') {
    handleDelete($conn, $prefix, $user, $domain);
} else {
    http_response_code(405);
    respondJson(['success' => false, 'message' => 'Método não permitido']);
}

// ================================================================
// HANDLERS
// ================================================================

/**
 * GET: Listar solicitações ou buscar itens
 */
function handleGet($conn, $prefix, $user, $domain) {
    $action = $_GET['action'] ?? 'list';
    
    if ($action === 'itens') {
        $seq_solicitacao_compra = $_GET['seq_solicitacao_compra'] ?? null;
        
        if (!$seq_solicitacao_compra) {
            msg('Solicitação não informada', 'error');
        }
        
        buscarItensSolicitacao($conn, $prefix, $seq_solicitacao_compra);
    } else {
        // REMOVIDO MOCK AUTOMÁTICO PARA ESTA TELA PARA EVITAR BYPASS DE FILTROS
        listarSolicitacoes($conn, $prefix, $user);
    }
}

/**
 * POST: Criar nova solicitação
 */
function handlePost($conn, $prefix, $user, $domain) {
    $input = getRequestInput();
    
    $seq_centro_custo = $input['seq_centro_custo'] ?? null;
    $nro_setor = $input['nro_setor'] ?? null;
    $placa = !empty($input['placa']) ? strtoupper(trim($input['placa'])) : null; // ✅ NOVO - Placa do veículo (opcional)
    $observacao = $input['observacao'] ?? '';
    $itens = $input['itens'] ?? [];
    
    // Validações
    if (!$seq_centro_custo) {
        msg('Centro de custo não informado', 'error');
    }
    
    if (!$nro_setor) {
        msg('Setor não informado', 'error');
    }
    
    if (empty($itens)) {
        msg('Adicione pelo menos um item', 'error');
    }
    
    // Obter unidade do usuário
    $query_user = "SELECT unidade FROM users WHERE username = $1 AND domain = $2";
    $result_user = pg_query_params($conn, $query_user, [strtolower($user['username']), strtoupper($domain)]);
    
    if (!$result_user || pg_num_rows($result_user) === 0) {
        msg('Erro ao obter dados do usuário', 'error');
    }
    
    $user_data = pg_fetch_assoc($result_user);
    $unidade = $user_data['unidade'];
    
    // Iniciar transação
    pg_query($conn, "BEGIN");
    
    try {
        // Inserir solicitação
        $query_insert = "INSERT INTO {$prefix}solicitacao_compra 
            (unidade, data_inclusao, hora_inclusao, login_inclusao, seq_centro_custo, nro_setor, observacao, placa, status)
            VALUES ($1, CURRENT_DATE, CURRENT_TIME, $2, $3, $4, $5, $6, 'P')
            RETURNING seq_solicitacao_compra";
        
        $result = pg_query_params($conn, $query_insert, [
            $unidade,
            strtolower($user['username']),
            $seq_centro_custo,
            $nro_setor,
            strtoupper($observacao),
            $placa
        ]);
        
        if (!$result) {
            throw new Exception('Erro ao criar solicitação: ' . pg_last_error($conn));
        }
        
        $row = pg_fetch_assoc($result);
        $seq_solicitacao_compra = $row['seq_solicitacao_compra'];
        
        // Inserir itens
        foreach ($itens as $item) {
            $query_item = "INSERT INTO {$prefix}solicitacao_compra_item 
                (seq_solicitacao_compra, item, qtde_item)
                VALUES ($1, $2, $3)";
            
            $result_item = pg_query_params($conn, $query_item, [
                $seq_solicitacao_compra,
                strtoupper($item['item']),
                $item['qtde_item']
            ]);
            
            if (!$result_item) {
                throw new Exception('Erro ao inserir item: ' . pg_last_error($conn));
            }
        }
        
        pg_query($conn, "COMMIT");
        
        // ✅ BUSCAR A SOLICITAÇÃO RECÉM-CRIADA COM TODOS OS DADOS
        $query_solicitacao = "SELECT 
                s.*,
                cc.nro_centro_custo AS centro_custo_nro,
                cc.descricao AS centro_custo_descricao,
                cc.unidade AS centro_custo_unidade,
                st.descricao AS setor_descricao,
                (SELECT COUNT(*) FROM {$prefix}solicitacao_compra_item sci 
                 WHERE sci.seq_solicitacao_compra = s.seq_solicitacao_compra) AS qtd_itens
              FROM {$prefix}solicitacao_compra s
              LEFT JOIN {$prefix}centro_custo cc ON s.seq_centro_custo = cc.seq_centro_custo
              LEFT JOIN {$prefix}setores st ON s.nro_setor = st.nro_setor
              WHERE s.seq_solicitacao_compra = $1";
        
        $result_sol = pg_query_params($conn, $query_solicitacao, [$seq_solicitacao_compra]);
        
        if ($result_sol && pg_num_rows($result_sol) > 0) {
            $solicitacao_criada = pg_fetch_assoc($result_sol);
            msg('Solicitação de compra criada com sucesso!', 'success', 200, ['solicitacao' => $solicitacao_criada]);
        } else {
            msg('Solicitação de compra criada com sucesso!', 'success');
        }
        
    } catch (Exception $e) {
        pg_query($conn, "ROLLBACK");
        msg('Erro ao criar solicitação: ' . $e->getMessage(), 'error');
    }
}

/**
 * PUT: Ações diversas (solicitar aprovação, etc)
 */
function handlePut($conn, $prefix, $user, $domain) {
    $input = getRequestInput();
    $action = $input['action'] ?? null;
    
    if ($action === 'solicitar_aprovacao') {
        solicitarAprovacao($conn, $prefix, $user, $domain, $input);
    } else {
        msg('Ação não reconhecida', 'error');
    }
}

/**
 * DELETE: Excluir solicitação
 */
function handleDelete($conn, $prefix, $user, $domain) {
    $input = getRequestInput();
    $seq_solicitacao_compra = $input['seq_solicitacao_compra'] ?? null;
    
    if (!$seq_solicitacao_compra) {
        msg('Solicitação não informada', 'error');
    }
    
    // Verificar se a solicitação pertence ao usuário
    $query_check = "SELECT * FROM {$prefix}solicitacao_compra 
                    WHERE seq_solicitacao_compra = $1 AND login_inclusao = $2";
    
    $result_check = pg_query_params($conn, $query_check, [$seq_solicitacao_compra, strtolower($user['username'])]);
    
    if (!$result_check || pg_num_rows($result_check) === 0) {
        msg('Solicitação não encontrada ou não pertence ao usuário', 'error');
    }
    
    // Iniciar transação
    pg_query($conn, "BEGIN");
    
    try {
        // Excluir itens
        $query_delete_items = "DELETE FROM {$prefix}solicitacao_compra_item 
                               WHERE seq_solicitacao_compra = $1";
        
        $result_delete_items = pg_query_params($conn, $query_delete_items, [$seq_solicitacao_compra]);
        
        if (!$result_delete_items) {
            throw new Exception('Erro ao excluir itens: ' . pg_last_error($conn));
        }
        
        // Excluir solicitação
        $query_delete_sol = "DELETE FROM {$prefix}solicitacao_compra 
                             WHERE seq_solicitacao_compra = $1";
        
        $result_delete_sol = pg_query_params($conn, $query_delete_sol, [$seq_solicitacao_compra]);
        
        if (!$result_delete_sol) {
            throw new Exception('Erro ao excluir solicitação: ' . pg_last_error($conn));
        }
        
        pg_query($conn, "COMMIT");
        
        msg('Solicitação de compra excluída com sucesso!', 'success');
        
    } catch (Exception $e) {
        pg_query($conn, "ROLLBACK");
        msg('Erro ao excluir solicitação: ' . $e->getMessage(), 'error');
    }
}

// ================================================================
// FUNÇÕES DE NEGÓCIO
// ================================================================

/**
 * Listar solicitações do usuário
 */
function listarSolicitacoes($conn, $prefix, $user) {
    // Parâmetros de filtro
    $unidade = $_GET['unidade'] ?? '';
    $data_inicio = $_GET['data_inicio'] ?? '';
    $data_fim = $_GET['data_fim'] ?? '';
    $nro_setor = $_GET['nro_setor'] ?? '';
    $status = $_GET['status'] ?? 'TODAS';
    
    $where = ["1=1"];
    $params = [];
    $param_count = 1;
    
    // Filtro de unidade
    if ($unidade !== '' && $unidade !== 'ALL') {
        $where[] = "TRIM(s.unidade) = $" . $param_count++;
        $params[] = strtoupper(trim($unidade));
    }
    
    // Filtro de data (Garantindo que sejam tratadas como DATE no PostgreSQL)
    if ($data_inicio !== '') {
        $where[] = "s.data_inclusao >= $" . $param_count++ . "::DATE";
        $params[] = $data_inicio;
    }
    if ($data_fim !== '') {
        $where[] = "s.data_inclusao <= $" . $param_count++ . "::DATE";
        $params[] = $data_fim;
    }
    
    // Filtro de setor
    if ($nro_setor !== '' && $nro_setor !== 'null' && $nro_setor !== 'undefined') {
        $where[] = "s.nro_setor = $" . $param_count++;
        $params[] = (int)$nro_setor;
    }
    
    // Filtro de status
    // PENDENTES = P, CONVERTIDAS = A
    if ($status === 'CONVERTIDAS') {
        $where[] = "TRIM(s.status) = 'A'";
    } elseif ($status === 'PENDENTES') {
        $where[] = "TRIM(s.status) = 'P'";
    }
    
    // ✅ NOVO: Filtro por usuário (Apenas na listagem padrão, não na tela de O.C.)
    $is_oc_view = ($_GET['source'] ?? '') === 'oc';
    if (!$is_oc_view) {
        $where[] = "s.login_inclusao = $" . $param_count++;
        $params[] = strtolower($user['username']);
    }
    
    $where_clause = implode(" AND ", $where);
    
    $query = "SELECT 
                s.*,
                cc.nro_centro_custo AS centro_custo_nro,
                cc.descricao AS centro_custo_descricao,
                cc.unidade AS centro_custo_unidade,
                st.descricao AS setor_descricao,
                (CASE 
                    WHEN oc.unidade IS NOT NULL THEN 
                        TRIM(oc.unidade) || LPAD(oc.nro_ordem_compra::text, 6, '0')
                    ELSE NULL 
                 END) AS nro_ordem_compra,
                (SELECT COUNT(*) FROM {$prefix}solicitacao_compra_item sci 
                 WHERE sci.seq_solicitacao_compra = s.seq_solicitacao_compra) AS qtd_itens
              FROM {$prefix}solicitacao_compra s
              LEFT JOIN {$prefix}centro_custo cc ON s.seq_centro_custo = cc.seq_centro_custo
              LEFT JOIN {$prefix}setores st ON s.nro_setor = st.nro_setor
              LEFT JOIN {$prefix}ordem_compra oc ON s.seq_ordem_compra = oc.seq_ordem_compra
              WHERE {$where_clause}
              ORDER BY s.data_inclusao DESC, s.hora_inclusao DESC";
    
    $result = pg_query_params($conn, $query, $params);
    
    if (!$result) {
        msg('Erro ao buscar solicitações: ' . pg_last_error($conn), 'error');
    }
    
    $solicitacoes = [];
    while ($row = pg_fetch_assoc($result)) {
        $solicitacoes[] = $row;
    }
    
    respondJson(['success' => true, 'data' => $solicitacoes]);
}

/**
 * Buscar itens de uma solicitação
 */
function buscarItensSolicitacao($conn, $prefix, $seq_solicitacao_compra) {
    $query = "SELECT item, qtde_item
              FROM {$prefix}solicitacao_compra_item
              WHERE seq_solicitacao_compra = $1
              ORDER BY item";
    
    $result = pg_query_params($conn, $query, [$seq_solicitacao_compra]);
    
    if (!$result) {
        msg('Erro ao buscar itens: ' . pg_last_error($conn), 'error');
    }
    
    $itens = [];
    while ($row = pg_fetch_assoc($result)) {
        $itens[] = $row;
    }
    
    respondJson(['success' => true, 'data' => $itens]);
}

/**
 * Solicitar aprovação por email
 */
function solicitarAprovacao($conn, $prefix, $user, $domain, $input) {
    $seq_solicitacao_compra = $input['seq_solicitacao_compra'] ?? null;
    $usuarios_ids = $input['usuarios_ids'] ?? [];
    
    if (!$seq_solicitacao_compra) {
        msg('Solicitação não informada', 'error');
    }
    
    if (empty($usuarios_ids)) {
        msg('Selecione pelo menos um usuário', 'error');
    }
    
    // Buscar dados da solicitação
    $query_sol = "SELECT s.*, cc.descricao AS centro_custo_descricao, st.descricao AS setor_descricao
                  FROM {$prefix}solicitacao_compra s
                  LEFT JOIN {$prefix}centro_custo cc ON s.seq_centro_custo = cc.seq_centro_custo
                  LEFT JOIN {$prefix}setores st ON s.nro_setor = st.nro_setor
                  WHERE s.seq_solicitacao_compra = $1";
    
    $result_sol = pg_query_params($conn, $query_sol, [$seq_solicitacao_compra]);
    
    if (!$result_sol || pg_num_rows($result_sol) === 0) {
        msg('Solicitação não encontrada', 'error');
    }
    
    $solicitacao = pg_fetch_assoc($result_sol);
    
    // Buscar itens
    $query_itens = "SELECT item, qtde_item FROM {$prefix}solicitacao_compra_item 
                    WHERE seq_solicitacao_compra = $1";
    $result_itens = pg_query_params($conn, $query_itens, [$seq_solicitacao_compra]);
    
    $itens = [];
    while ($row = pg_fetch_assoc($result_itens)) {
        $itens[] = $row;
    }
    
    // Enviar email para cada usuário selecionado
    require_once __DIR__ . '/../services/EmailService.php';
    $emailService = new EmailService();
    
    $enviados = 0;
    $erros = 0;
    
    foreach ($usuarios_ids as $usuario_id) {
        // Buscar dados do usuário
        $query_user = "SELECT full_name, email FROM users WHERE id = $1 AND domain = $2";
        $result_user = pg_query_params($conn, $query_user, [$usuario_id, strtoupper($domain)]);
        
        if ($result_user && pg_num_rows($result_user) > 0) {
            $usuario = pg_fetch_assoc($result_user);
            
            $resultado = $emailService->sendSolicitacaoCompra(
                $usuario['email'],
                $usuario['full_name'],
                $seq_solicitacao_compra,
                $solicitacao['unidade'],
                $solicitacao['setor_descricao'],
                $solicitacao['centro_custo_descricao'],
                $itens,
                $domain,
                $user['username']
            );
            
            if ($resultado['success']) {
                $enviados++;
            } else {
                $erros++;
                error_log("❌ Erro ao enviar email para {$usuario['email']}: " . $resultado['message']);
            }
        }
    }
    
    if ($enviados > 0) {
        msg("Email enviado para {$enviados} usuário(s)!", 'success');
    } else {
        msg('Erro ao enviar emails', 'error');
    }
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

/**
 * Criar tabelas se não existirem
 */
function criarTabelasSolicitacaoCompra($conn, $prefix) {
    // Tabela principal
    $query1 = "CREATE TABLE IF NOT EXISTS {$prefix}solicitacao_compra (
        seq_solicitacao_compra SERIAL PRIMARY KEY,
        unidade VARCHAR(10) NOT NULL,
        data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
        hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
        login_inclusao VARCHAR(50) NOT NULL,
        seq_centro_custo INTEGER NOT NULL,
        nro_setor INTEGER,
        observacao TEXT,
        status CHAR(1) DEFAULT 'P',
        seq_ordem_compra INTEGER,
        placa VARCHAR(10) -- ✅ NOVO - Placa do veículo (opcional)
    )";
    
    pg_query($conn, $query1);
    
    // Verificar se a coluna status existe, se não, adicionar
    $query_check_status = "SELECT column_name FROM information_schema.columns 
                          WHERE table_name = '{$prefix}solicitacao_compra' 
                          AND column_name = 'status'";
    
    $result_check = pg_query($conn, $query_check_status);
    
    if (pg_num_rows($result_check) === 0) {
        $query_add_status = "ALTER TABLE {$prefix}solicitacao_compra 
                            ADD COLUMN status CHAR(1) DEFAULT 'P'";
        pg_query($conn, $query_add_status);
    }
    
    // Tabela de itens
    $query2 = "CREATE TABLE IF NOT EXISTS {$prefix}solicitacao_compra_item (
        seq_solicitacao_compra INTEGER NOT NULL,
        item VARCHAR(255) NOT NULL,
        qtde_item INTEGER NOT NULL,
        PRIMARY KEY (seq_solicitacao_compra, item)
    )";
    
    pg_query($conn, $query2);
}

/**
 * Mock de dados
 */
function getMockSolicitacoes() {
    return [
        [
            'seq_solicitacao_compra' => 1,
            'unidade' => 'MTZ',
            'data_inclusao' => '2026-02-28',
            'hora_inclusao' => '10:30:00',
            'login_inclusao' => 'admin',
            'seq_centro_custo' => 1,
            'centro_custo_nro' => '1',
            'centro_custo_descricao' => 'ADMINISTRATIVO',
            'centro_custo_unidade' => 'MTZ',
            'nro_setor' => 1,
            'setor_descricao' => 'COMPRAS',
            'observacao' => 'MATERIAL DE ESCRITÓRIO URGENTE',
            'status' => 'P',
            'qtd_itens' => 3,
        ],
        [
            'seq_solicitacao_compra' => 2,
            'unidade' => 'MTZ',
            'data_inclusao' => '2026-03-01',
            'hora_inclusao' => '14:15:00',
            'login_inclusao' => 'admin',
            'seq_centro_custo' => 2,
            'centro_custo_nro' => '2',
            'centro_custo_descricao' => 'MANUTENÇÃO',
            'centro_custo_unidade' => 'MTZ',
            'nro_setor' => 2,
            'setor_descricao' => 'MANUTENÇÃO',
            'observacao' => 'PEÇAS PARA FROTA',
            'status' => 'A',
            'seq_ordem_compra' => 123,
            'nro_ordem_compra' => 'MTZ000123',
            'qtd_itens' => 5,
        ],
    ];
}