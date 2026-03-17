<?php
/**
 * API: Converter Solicitações de Compra
 * Descrição: Lista solicitações para conversão e converte em ordem de compra
 * Métodos: GET, POST
 */

require_once __DIR__ . '/../config.php';

// CONFIGURAÇÃO INICIAL
handleOptionsRequest();

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

// MOCK
if (shouldUseMockData($domain)) {
    $mockData = getMockSolicitacoesConverter();
    respondJson(['success' => true, 'data' => $mockData]);
    exit;
}

// BANCO DE DADOS
$conn = connect();
$prefix = strtolower($domain) . '_';

// ROTEAMENTO
if ($method === 'GET') {
    handleGet($conn, $prefix, $user);
} elseif ($method === 'POST') {
    handlePost($conn, $prefix, $user, $domain);
} else {
    http_response_code(405);
    respondJson(['success' => false, 'message' => 'Método não permitido']);
}

// ================================================================
// HANDLERS
// ================================================================

/**
 * GET: Listar solicitações para conversão OU buscar uma específica
 */
function handleGet($conn, $prefix, $user) {
    $seq_solicitacao_compra = $_GET['seq_solicitacao_compra'] ?? null;
    
    if ($seq_solicitacao_compra) {
        // Buscar solicitação específica com itens
        buscarSolicitacaoDetalhes($conn, $prefix, $seq_solicitacao_compra);
    } else {
        // Listar todas as solicitações pendentes
        listarSolicitacoesParaConverter($conn, $prefix, $user);
    }
}

/**
 * POST: Converter solicitação em ordem de compra
 */
function handlePost($conn, $prefix, $user, $domain) {
    $input = getRequestInput();
    
    $seq_solicitacao_compra = $input['seq_solicitacao_compra'] ?? null;
    $itens = $input['itens'] ?? [];
    
    if (!$seq_solicitacao_compra) {
        msg('Solicitação não informada', 'error');
    }
    
    // Remover validação de itens vazios - pode ser vazio se todas quantidades = 0
    
    converterSolicitacao($conn, $prefix, $user, $domain, $seq_solicitacao_compra, $itens);
}

// ================================================================
// FUNÇÕES DE NEGÓCIO
// ================================================================

/**
 * Listar solicitações para converter (com filtros)
 */
function listarSolicitacoesParaConverter($conn, $prefix, $user) {
    $unidade = $_GET['unidade'] ?? null;
    $data_inicio = $_GET['data_inicio'] ?? null;
    $data_fim = $_GET['data_fim'] ?? null;
    $seq_centro_custo = $_GET['seq_centro_custo'] ?? null;
    $nro_setor = $_GET['nro_setor'] ?? null;
    
    $whereConditions = ['1=1'];
    $params = [];
    $paramIndex = 1;
    
    // Filtro de unidade via centro de custo
    if ($unidade) {
        $whereConditions[] = "cc.unidade = $" . $paramIndex;
        $params[] = $unidade;
        $paramIndex++;
    }
    
    // Filtro de período
    if ($data_inicio) {
        $whereConditions[] = "s.data_inclusao >= $" . $paramIndex;
        $params[] = $data_inicio;
        $paramIndex++;
    }
    
    if ($data_fim) {
        $whereConditions[] = "s.data_inclusao <= $" . $paramIndex;
        $params[] = $data_fim;
        $paramIndex++;
    }
    
    // Filtro de centro de custo
    if ($seq_centro_custo) {
        $whereConditions[] = "s.seq_centro_custo = $" . $paramIndex;
        $params[] = $seq_centro_custo;
        $paramIndex++;
    }
    
    // Filtro de setor
    if ($nro_setor) {
        $whereConditions[] = "s.nro_setor = $" . $paramIndex;
        $params[] = $nro_setor;
        $paramIndex++;
    }
    
    $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
    
    $query = "SELECT 
                s.*,
                cc.nro_centro_custo AS centro_custo_nro,
                cc.descricao AS centro_custo_descricao,
                cc.unidade AS centro_custo_unidade,
                st.descricao AS setor_descricao,
                oc.nro_ordem_compra,
                (SELECT COUNT(*) FROM {$prefix}solicitacao_compra_item sci 
                 WHERE sci.seq_solicitacao_compra = s.seq_solicitacao_compra) AS qtd_itens
              FROM {$prefix}solicitacao_compra s
              LEFT JOIN {$prefix}centro_custo cc ON s.seq_centro_custo = cc.seq_centro_custo
              LEFT JOIN {$prefix}setores st ON s.nro_setor = st.nro_setor
              LEFT JOIN {$prefix}ordem_compra oc ON s.seq_ordem_compra = oc.seq_ordem_compra
              $whereClause
              ORDER BY s.seq_ordem_compra IS NULL DESC, s.data_inclusao DESC, s.hora_inclusao DESC";
    
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
 * Buscar detalhes de uma solicitação específica
 */
function buscarSolicitacaoDetalhes($conn, $prefix, $seq_solicitacao_compra) {
    // Buscar solicitação
    $query_sol = "SELECT s.*,
                    cc.nro_centro_custo AS centro_custo_nro,
                    cc.descricao AS centro_custo_descricao,
                    cc.unidade AS centro_custo_unidade,
                    st.descricao AS setor_descricao
                  FROM {$prefix}solicitacao_compra s
                  LEFT JOIN {$prefix}centro_custo cc ON s.seq_centro_custo = cc.seq_centro_custo
                  LEFT JOIN {$prefix}setores st ON s.nro_setor = st.nro_setor
                  WHERE s.seq_solicitacao_compra = $1";
    
    $result_sol = pg_query_params($conn, $query_sol, [$seq_solicitacao_compra]);
    
    if (!$result_sol || pg_num_rows($result_sol) === 0) {
        msg('Solicitação não encontrada', 'error');
    }
    
    $solicitacao = pg_fetch_assoc($result_sol);
    
    // Adicionar flag se já foi convertida/atendida (mas não parar a execução)
    // IMPORTANTE: trim() porque CHAR(1) pode vir com espaços em branco
    $status = isset($solicitacao['status']) ? trim($solicitacao['status']) : 'P';
    $ja_atendida = ($status === 'A');
    
    $solicitacao['ja_atendida'] = $ja_atendida;
    $solicitacao['status'] = $status; // Garantir que status também está sem espaços
    
    // Buscar itens (incluir qtde_a_comprar = 0 por padrão)
    $query_itens = "SELECT item, qtde_item, 0 as qtde_a_comprar
                    FROM {$prefix}solicitacao_compra_item 
                    WHERE seq_solicitacao_compra = $1
                    ORDER BY item";
    
    $result_itens = pg_query_params($conn, $query_itens, [$seq_solicitacao_compra]);
    
    $itens = [];
    while ($row = pg_fetch_assoc($result_itens)) {
        // Converter para inteiro
        $row['qtde_a_comprar'] = 0;
        $itens[] = $row;
    }
    
    respondJson([
        'success' => true,
        'solicitacao' => $solicitacao,
        'itens' => $itens
    ]);
}

/**
 * Converter solicitação em ordem de compra
 */
function converterSolicitacao($conn, $prefix, $user, $domain, $seq_solicitacao_compra, $itens) {
    // Buscar dados da solicitação
    $query_sol = "SELECT s.*, s.unidade, u.full_name, u.email 
                  FROM {$prefix}solicitacao_compra s
                  LEFT JOIN users u ON LOWER(s.login_inclusao) = LOWER(u.username) AND UPPER(u.domain) = UPPER($2)
                  WHERE s.seq_solicitacao_compra = $1";
    
    $result_sol = pg_query_params($conn, $query_sol, [$seq_solicitacao_compra, $domain]);
    
    if (!$result_sol || pg_num_rows($result_sol) === 0) {
        msg('Solicitação não encontrada', 'error');
    }
    
    $solicitacao = pg_fetch_assoc($result_sol);
    
    // ✅ DEBUG: Log completo dos dados da solicitação
    error_log("====== DEBUG APROVAÇÃO SOLICITAÇÃO ======");
    error_log("seq_solicitacao_compra: " . $seq_solicitacao_compra);
    error_log("login_inclusao: " . ($solicitacao['login_inclusao'] ?? 'NULL'));
    error_log("domain enviado: " . $domain);
    error_log("email encontrado: " . ($solicitacao['email'] ?? 'NULL'));
    error_log("full_name encontrado: " . ($solicitacao['full_name'] ?? 'NULL'));
    error_log("==========================================");
    
    // Verificar se já foi atendida
    // IMPORTANTE: trim() porque CHAR(1) pode vir com espaços em branco
    if (trim($solicitacao['status']) === 'A') {
        msg('Esta solicitação já foi atendida', 'error');
    }
    
    // Filtrar itens com quantidade > 0
    $itens_comprar = array_filter($itens, function($item) {
        return isset($item['qtde_item']) && $item['qtde_item'] > 0;
    });
    
    // Iniciar transação
    pg_query($conn, "BEGIN");
    
    try {
        $seq_ordem_compra = null;
        $nro_ordem_compra = null;
        
        // Criar ordem de compra APENAS se houver itens para comprar
        if (count($itens_comprar) > 0) {
            // ✅ GERAR NÚMERO DA ORDEM DE COMPRA AUTOMATICAMENTE
            // Formato: Sequencial numérico único para todas as unidades (IGUAL à inclusão manual)
            $queryNumero = "
                SELECT COALESCE(MAX(
                    CASE 
                        WHEN nro_ordem_compra ~ '^[0-9]+$' THEN CAST(nro_ordem_compra AS INTEGER)
                        ELSE 0
                    END
                ), 0) + 1 AS proximo_numero
                FROM {$prefix}ordem_compra
                WHERE nro_ordem_compra IS NOT NULL
            ";
            $resultNumero = pg_query($conn, $queryNumero);
            
            if (!$resultNumero) {
                throw new Exception('Erro ao gerar número da ordem: ' . pg_last_error($conn));
            }
            
            $rowNumero = pg_fetch_assoc($resultNumero);
            $nro_ordem_compra = intval($rowNumero['proximo_numero']);
            
            // ✅ GARANTIR que o número não seja 0 ou NULL
            if ($nro_ordem_compra <= 0) {
                $nro_ordem_compra = 1;
            }
            
            // ✅ INCLUIR PLACA E NRO_ORDEM_COMPRA NA ORDEM DE COMPRA
            $query_oc = "INSERT INTO {$prefix}ordem_compra 
                (unidade, nro_ordem_compra, data_inclusao, hora_inclusao, login_inclusao, seq_centro_custo, nro_setor, placa, observacao, aprovada, orcar)
                VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, $4, $5, $6, $7, 'N', 'N')
                RETURNING seq_ordem_compra";
            
            // Formatar número da solicitação sem "#" no formato AAA000000
            $nro_solicitacao_formatado = $solicitacao['unidade'] . str_pad($seq_solicitacao_compra, 6, '0', STR_PAD_LEFT);
            $observacao_oc = 'CONVERTIDA DA SOLICITAÇÃO ' . $nro_solicitacao_formatado;
            if ($solicitacao['observacao']) {
                $observacao_oc .= ' - ' . $solicitacao['observacao'];
            }
            
            // ✅ ADICIONAR NRO_ORDEM_COMPRA E PLACA NOS PARÂMETROS
            $result_oc = pg_query_params($conn, $query_oc, [
                $solicitacao['unidade'],
                (string)$nro_ordem_compra, // ✅ Número gerado
                strtolower($user['username']),
                $solicitacao['seq_centro_custo'],
                $solicitacao['nro_setor'],
                $solicitacao['placa'], // ✅ TRANSFERIR PLACA DA SOLICITAÇÃO
                $observacao_oc
            ]);
            
            if (!$result_oc) {
                throw new Exception('Erro ao criar ordem de compra: ' . pg_last_error($conn));
            }
            
            $ordem = pg_fetch_assoc($result_oc);
            $seq_ordem_compra = $ordem['seq_ordem_compra'];
            
            // Inserir itens na ordem de compra
            foreach ($itens_comprar as $item) {
                $query_item = "INSERT INTO {$prefix}ordem_compra_item 
                    (seq_ordem_compra, seq_item, qtde_item)
                    VALUES ($1, $2, $3)";
                
                $result_item = pg_query_params($conn, $query_item, [
                    $seq_ordem_compra,
                    $item['seq_item'],
                    $item['qtde_item']
                ]);
                
                if (!$result_item) {
                    throw new Exception('Erro ao inserir item: ' . pg_last_error($conn));
                }
            }
        }
        
        // Atualizar solicitação: status = 'A' (atendida) sempre, e seq_ordem_compra se houver
        $query_update = "UPDATE {$prefix}solicitacao_compra 
                         SET status = 'A', seq_ordem_compra = $1
                         WHERE seq_solicitacao_compra = $2";
        
        $result_update = pg_query_params($conn, $query_update, [$seq_ordem_compra, $seq_solicitacao_compra]);
        
        if (!$result_update) {
            throw new Exception('Erro ao atualizar solicitação: ' . pg_last_error($conn));
        }
        
        pg_query($conn, "COMMIT");
        
        // ✅ CORREÇÃO CRÍTICA: SEMPRE enviar email quando aprovar/converter solicitação
        // Buscar email do usuário SE não foi encontrado no JOIN anterior
        if (!$solicitacao['email']) {
            error_log("⚠️ Email não encontrado no JOIN - Tentando buscar diretamente...");
            
            $query_email = "SELECT email, full_name FROM users 
                           WHERE LOWER(username) = LOWER($1) AND UPPER(domain) = UPPER($2)";
            $result_email = pg_query_params($conn, $query_email, [$solicitacao['login_inclusao'], $domain]);
            
            if ($result_email && pg_num_rows($result_email) > 0) {
                $user_data = pg_fetch_assoc($result_email);
                $solicitacao['email'] = $user_data['email'];
                $solicitacao['full_name'] = $user_data['full_name'];
                error_log("✅ Email encontrado na busca direta: " . $solicitacao['email']);
            } else {
                error_log("❌ Email NÃO encontrado na busca direta - Usuário: " . $solicitacao['login_inclusao'] . " / Domain: " . $domain);
            }
        }
        
        // Debug: Log dos dados para envio de email
        error_log("====== DEBUG ENVIO EMAIL APROVAÇÃO ======");
        error_log("seq_solicitacao_compra: " . $seq_solicitacao_compra);
        error_log("seq_ordem_compra: " . ($seq_ordem_compra ?: 'NULL (sem itens para comprar)'));
        error_log("nro_ordem_compra: " . ($nro_ordem_compra ?: 'NULL'));
        error_log("login_inclusao: " . ($solicitacao['login_inclusao'] ?? 'NULL'));
        error_log("email destinatario: " . ($solicitacao['email'] ?: 'NULL'));
        error_log("full_name: " . ($solicitacao['full_name'] ?: 'NULL'));
        error_log("domain: " . $domain);
        error_log("========================================");
        
        // ✅ ENVIAR EMAIL SEMPRE que houver email do usuário (independente de ter OC ou não)
        if ($solicitacao['email']) {
            error_log("📧 Enviando email de aprovação para: " . $solicitacao['email']);
            
            require_once __DIR__ . '/../services/EmailService.php';
            $emailService = new EmailService();
            
            // Se criou OC, envia email de "convertida"
            // Se não criou OC, envia email de "aprovada sem itens"
            if ($seq_ordem_compra) {
                $resultado_email = $emailService->sendSolicitacaoConvertida(
                    $solicitacao['email'],
                    $solicitacao['full_name'] ?: $solicitacao['login_inclusao'],
                    $seq_solicitacao_compra,
                    $solicitacao['unidade'],
                    $nro_ordem_compra,
                    $domain,
                    $user['username']
                );
            } else {
                // Criar método alternativo para solicitação aprovada sem OC
                $resultado_email = $emailService->sendSolicitacaoAprovadaSemItens(
                    $solicitacao['email'],
                    $solicitacao['full_name'] ?: $solicitacao['login_inclusao'],
                    $seq_solicitacao_compra,
                    $solicitacao['unidade'],
                    $domain,
                    $user['username']
                );
            }
            
            error_log("✅ Resultado envio email: " . json_encode($resultado_email));
        } else {
            error_log("❌ EMAIL NÃO ENVIADO - Email do criador não encontrado!");
            error_log("   Usuário: " . ($solicitacao['login_inclusao'] ?? 'NULL'));
            error_log("   Domain: " . $domain);
            error_log("   ⚠️ AÇÃO NECESSÁRIA: Cadastrar email do usuário na tabela users");
        }
        
        // Mensagem de sucesso
        if ($seq_ordem_compra) {
            // ✅ RETORNAR seq_ordem_compra e nro_ordem_compra para o frontend (fluxo rápido)
            msg('Solicitação convertida em Ordem de Compra ' . $nro_ordem_compra . ' com sucesso!', 'success', 200, [
                'data' => [
                    'seq_ordem_compra' => $seq_ordem_compra,
                    'nro_ordem_compra' => $nro_ordem_compra
                ]
            ]);
        } else {
            msg('Solicitação marcada como atendida (nenhum item para comprar)', 'success');
        }
        
    } catch (Exception $e) {
        pg_query($conn, "ROLLBACK");
        msg('Erro ao converter solicitação: ' . $e->getMessage(), 'error');
    }
}

// ================================================================
// MOCK
// ================================================================

function getMockSolicitacoesConverter() {
    return [
        [
            'seq_solicitacao_compra' => 1,
            'unidade' => 'MTZ',
            'data_inclusao' => '2026-02-28',
            'hora_inclusao' => '10:30:00',
            'login_inclusao' => 'joao',
            'seq_centro_custo' => 1,
            'centro_custo_nro' => '1',
            'centro_custo_descricao' => 'ADMINISTRATIVO',
            'centro_custo_unidade' => 'MTZ',
            'nro_setor' => 1,
            'setor_descricao' => 'COMPRAS',
            'observacao' => 'MATERIAL DE ESCRITÓRIO URGENTE',
            'qtd_itens' => 3,
        ],
    ];
}