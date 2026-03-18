<?php
/**
 * API: Orçamentos Completos
 * Descrição: Gerencia orçamentos com ordens de compra, fornecedores e cotações
 * Métodos: GET (listar/detalhes), POST (criar), PUT (atualizar), DELETE (cancelar)
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
$user_unidade = $currentUser['unidade'];
$dominio = strtolower($currentUser['domain']);

// Obter unidade do header ou usar a do usuário
$headers = getallheaders();
$unidade_filtro = isset($headers['X-Unidade']) ? $headers['X-Unidade'] : $user_unidade;

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = $dominio . '_';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['action'])) {
                $action = $_GET['action'];

                if ($action === 'ordens-disponiveis') {
                    listarOrdensDisponiveis($g_sql, $dominio, $user_unidade);
                } elseif ($action === 'detalhes') {
                    obterDetalhesOrcamento($g_sql, $dominio, $_GET['seq_orcamento']);
                } elseif ($action === 'mapa') {
                    obterMapaCotacao($g_sql, $dominio, $_GET['seq_orcamento']);
                } elseif ($action === 'ordens-orcamento') {
                    obterOrdensOrcamento($g_sql, $dominio, $_GET['seq_orcamento']);
                } elseif ($action === 'fornecedores-orcamento') {
                    obterFornecedoresOrcamento($g_sql, $dominio, $_GET['seq_orcamento']);
                } elseif ($action === 'itens-cotacao') {
                    obterItensCotacao($g_sql, $dominio, $_GET['seq_orcamento'], $_GET['seq_fornecedor']);
                } elseif ($action === 'itens-coleta') {
                    // ✅ NOVO: Mesma lógica de itens-cotacao (coleta manual de preços)
                    obterItensCotacao($g_sql, $dominio, $_GET['seq_orcamento'], $_GET['seq_fornecedor']);
                } elseif ($action === 'cotacoes') {
                    obterCotacoes($g_sql, $dominio, $_GET['seq_orcamento']);
                } else {
                    listarOrcamentos($g_sql, $dominio, $user_unidade);
                }
            } else {
                listarOrcamentos($g_sql, $dominio, $user_unidade);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            
            // ✅ Verificar se é para salvar cotação (ColetaPrecos usa POST)
            if (isset($_GET['action']) && $_GET['action'] === 'salvar-cotacao') {
                salvarCotacao($g_sql, $dominio, $data, $username);
            } else {
                criarOrcamento($g_sql, $dominio, $data, $username, $user_unidade);
            }
            break;

        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);
            
            // Verificar se é para salvar cotação
            if (isset($data['action']) && $data['action'] === 'salvar-cotacao') {
                salvarCotacao($g_sql, $dominio, $data, $username);
            } elseif (isset($data['action']) && $data['action'] === 'salvar_escolhas_mapa') {
                salvarEscolhasMapa($g_sql, $dominio, $data);
            } else {
                atualizarOrcamento($g_sql, $dominio, $data, $username);
            }
            break;

        case 'DELETE':
            $data = json_decode(file_get_contents('php://input'), true);
            cancelarOrcamento($g_sql, $dominio, $data['seq_orcamento']);
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
 * Listar orçamentos
 */
function listarOrcamentos($g_sql, $dominio, $user_unidade) {
    $status = $_GET['status'] ?? 'TODOS';

    $tabela_orcamento = $dominio . '_orcamento';
    $tabela_orcamento_oc = $dominio . '_orcamento_ordem_compra';

    $query = "SELECT
                o.seq_orcamento,
                o.unidade,
                o.nro_orcamento,
                o.status,
                o.observacao,
                o.data_inclusao,
                o.hora_inclusao,
                o.login_inclusao,
                o.data_aprovacao,
                o.hora_aprovacao,
                o.login_aprovacao,
                (SELECT COUNT(*) FROM {$tabela_orcamento_oc} WHERE seq_orcamento = o.seq_orcamento) AS qtd_ordens
              FROM {$tabela_orcamento} o
              WHERE 1=1";

    $params = array();
    $param_count = 1;

    // Filtro por status
    if ($status !== 'TODOS') {
        $query .= " AND o.status = $" . $param_count;
        $params[] = $status;
        $param_count++;
    }

    // Filtro por unidade (MTZ vê tudo)
    if ($user_unidade !== 'MTZ') {
        $query .= " AND o.unidade = $" . $param_count;
        $params[] = $user_unidade;
        $param_count++;
    }

    $query .= " ORDER BY o.data_inclusao DESC, o.hora_inclusao DESC";

    $result = sql($g_sql, $query, false, $params);

    $orcamentos = array();
    while ($row = pg_fetch_assoc($result)) {
        $orcamentos[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $orcamentos
    ]);
}

/**
 * Listar ordens de compra disponíveis para orçamento
 * (Aprovadas com ORCAR = S)
 */
function listarOrdensDisponiveis($g_sql, $dominio, $user_unidade) {
    $tabela_ordem = $dominio . '_ordem_compra';
    $tabela_centro = $dominio . '_centro_custo';
    $tabela_item_ordem = $dominio . '_ordem_compra_item';
    $tabela_item = $dominio . '_item';
    $tabela_unidade_med = $dominio . '_unidade_medida';
    $tabela_setores = $dominio . '_setores';

    // Buscar ordens aprovadas com ORCAR = S
    $query = "SELECT DISTINCT
                oc.seq_ordem_compra,
                oc.nro_ordem_compra,
                oc.unidade,
                oc.observacao,
                oc.data_inclusao,
                oc.nro_setor,
                cc.nro_centro_custo,
                cc.descricao AS centro_custo_descricao,
                s.descricao AS setor_descricao
              FROM {$tabela_ordem} oc
              LEFT JOIN {$tabela_centro} cc ON oc.seq_centro_custo = cc.seq_centro_custo
              LEFT JOIN {$tabela_setores} s ON oc.nro_setor = s.nro_setor
              WHERE oc.aprovada = 'S' AND oc.orcar = 'S'";

    $params = array();
    $param_count = 1;

    // Filtro por unidade
    if ($user_unidade !== 'MTZ') {
        $query .= " AND cc.unidade = $" . $param_count;
        $params[] = $user_unidade;
        $param_count++;
    }

    // ✅ NOVO: Filtro por setor (passado via GET)
    if (isset($_GET['nro_setor']) && !empty($_GET['nro_setor'])) {
        $query .= " AND oc.nro_setor = $" . $param_count;
        $params[] = intval($_GET['nro_setor']);
        $param_count++;
    }

    $query .= " ORDER BY oc.data_inclusao DESC";

    $result = sql($g_sql, $query, false, $params);

    $ordens = array();
    while ($row = pg_fetch_assoc($result)) {
        // Buscar itens da ordem
        $query_itens = "SELECT
                          i.seq_item,
                          i.codigo,
                          i.descricao,
                          i.vlr_item,
                          um.sigla AS unidade_medida,
                          oci.qtde_item,
                          (i.vlr_item * oci.qtde_item) AS vlr_total
                        FROM {$tabela_item_ordem} oci
                        INNER JOIN {$tabela_item} i ON oci.seq_item = i.seq_item
                        LEFT JOIN {$tabela_unidade_med} um ON i.seq_unidade_medida = um.seq_unidade_medida
                        WHERE oci.seq_ordem_compra = $1";

        $result_itens = sql($g_sql, $query_itens, false, array($row['seq_ordem_compra']));

        $itens = array();
        $vlr_total_ordem = 0;

        while ($item = pg_fetch_assoc($result_itens)) {
            $itens[] = $item;
            $vlr_total_ordem += floatval($item['vlr_total']);
        }

        $row['itens'] = $itens;
        $row['vlr_total_ordem'] = $vlr_total_ordem;
        $ordens[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $ordens
    ]);
}

/**
 * Criar orçamento
 */
function criarOrcamento($g_sql, $dominio, $data, $username, $user_unidade) {
    $unidade = $data['unidade'] ?? $user_unidade;
    $observacao = isset($data['observacao']) ? strtoupper(trim($data['observacao'])) : '';
    $ordens_compra = $data['ordens_compra'] ?? array();
    $fornecedores = $data['fornecedores'] ?? array();

    if (empty($ordens_compra)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Selecione pelo menos uma ordem de compra']);
        return;
    }

    $tabela_orcamento = $dominio . '_orcamento';
    $tabela_orcamento_oc = $dominio . '_orcamento_ordem_compra';
    $tabela_orcamento_forn = $dominio . '_orcamento_fornecedor';

    // Gerar número do orçamento (numérico sequencial por unidade)
    $query_max = "SELECT COALESCE(MAX(nro_orcamento::INTEGER), 0) + 1 AS proximo
                  FROM {$tabela_orcamento}
                  WHERE unidade = $1";
    $result_max = sql($g_sql, $query_max, false, array($unidade));
    $row_max = pg_fetch_assoc($result_max);
    $nro_orcamento = $row_max['proximo'];

    // Inserir orçamento
    $query = "INSERT INTO {$tabela_orcamento}
              (unidade, nro_orcamento, status, observacao, login_inclusao)
              VALUES ($1, $2, 'PENDENTE', $3, $4)
              RETURNING seq_orcamento";

    $params = array($unidade, $nro_orcamento, $observacao, $username);
    $result = sql($g_sql, $query, false, $params);
    $row = pg_fetch_assoc($result);
    $seq_orcamento = $row['seq_orcamento'];

    // Inserir ordens de compra
    foreach ($ordens_compra as $seq_ordem_compra) {
        $query_oc = "INSERT INTO {$tabela_orcamento_oc} (seq_orcamento, seq_ordem_compra, seq_fornecedor)
                     VALUES ($1, $2, 0)";
        sql($g_sql, $query_oc, false, array($seq_orcamento, $seq_ordem_compra));
    }

    // Inserir fornecedores
    foreach ($fornecedores as $fornecedor) {
        $seq_fornecedor = $fornecedor['seq_fornecedor'];
        $email = $fornecedor['email'] ?? '';

        $query_forn = "INSERT INTO {$tabela_orcamento_forn}
                       (seq_orcamento, seq_fornecedor, email, status, codigo_acesso)
                       VALUES ($1, $2, $3, 'PENDENTE', '')";
        sql($g_sql, $query_forn, false, array($seq_orcamento, $seq_fornecedor, $email));
    }

    echo json_encode([
        'success' => true,
        'message' => 'Orçamento criado com sucesso',
        'seq_orcamento' => $seq_orcamento,
        'nro_orcamento' => $nro_orcamento
    ]);
}

/**
 * Obter detalhes do orçamento
 */
function obterDetalhesOrcamento($g_sql, $dominio, $seq_orcamento) {
    $tabela_orcamento = $dominio . '_orcamento';

    $query = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result = sql($g_sql, $query, false, array($seq_orcamento));

    if (pg_num_rows($result) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado']);
        return;
    }

    $orcamento = pg_fetch_assoc($result);

    echo json_encode([
        'success' => true,
        'data' => $orcamento
    ]);
}

/**
 * Obter mapa de cotação do orçamento
 * Retorna: orçamento, fornecedores, itens com cotações completos
 */
function obterMapaCotacao($g_sql, $dominio, $seq_orcamento) {
    $tabela_orcamento = $dominio . '_orcamento';
    $tabela_orcamento_forn = $dominio . '_orcamento_fornecedor';
    $tabela_fornecedor = $dominio . '_fornecedor';
    $tabela_orcamento_oc = $dominio . '_orcamento_ordem_compra';
    $tabela_ordem = $dominio . '_ordem_compra';
    $tabela_item_ordem = $dominio . '_ordem_compra_item';
    $tabela_item = $dominio . '_item';
    $tabela_unidade_med = $dominio . '_unidade_medida';
    $tabela_cotacao = $dominio . '_orcamento_cotacao';

    // 1. Buscar dados do orçamento
    $query_orc = "SELECT * FROM {$tabela_orcamento} WHERE seq_orcamento = $1";
    $result_orc = sql($g_sql, $query_orc, false, array($seq_orcamento));
    
    if (pg_num_rows($result_orc) === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado']);
        return;
    }
    
    $orcamento = pg_fetch_assoc($result_orc);

    // 2. Buscar fornecedores do orçamento
    $query_forn = "SELECT
                    of.seq_fornecedor,
                    f.nome,
                    COALESCE(of.email, f.email) AS email,
                    of.status,
                    of.condicao_pgto,
                    of.data_prev_ent
                  FROM {$tabela_orcamento_forn} of
                  INNER JOIN {$tabela_fornecedor} f ON of.seq_fornecedor = f.seq_fornecedor
                  WHERE of.seq_orcamento = $1
                  ORDER BY f.nome";
    
    $result_forn = sql($g_sql, $query_forn, false, array($seq_orcamento));
    
    $fornecedores = array();
    while ($row = pg_fetch_assoc($result_forn)) {
        $fornecedores[] = $row;
    }

    // 3. Buscar todos os itens das ordens vinculadas ao orçamento
    $query_itens = "SELECT DISTINCT
                      oci.seq_item,
                      oci.seq_ordem_compra,
                      i.codigo,
                      i.descricao,
                      um.sigla AS unidade_medida,
                      oci.qtde_item,
                      i.vlr_item AS vlr_estoque
                    FROM {$tabela_orcamento_oc} ooc
                    INNER JOIN {$tabela_item_ordem} oci ON ooc.seq_ordem_compra = oci.seq_ordem_compra
                    INNER JOIN {$tabela_item} i ON oci.seq_item = i.seq_item
                    LEFT JOIN {$tabela_unidade_med} um ON i.seq_unidade_medida = um.seq_unidade_medida
                    WHERE ooc.seq_orcamento = $1
                    ORDER BY i.codigo";
    
    $result_itens = sql($g_sql, $query_itens, false, array($seq_orcamento));
    
    // 4. Buscar todas as cotações do orçamento
    $query_cot = "SELECT * FROM {$tabela_cotacao} WHERE seq_orcamento = $1";
    $result_cot = sql($g_sql, $query_cot, false, array($seq_orcamento));
    
    $cotacoes_map = array();
    while ($row = pg_fetch_assoc($result_cot)) {
        $chave = $row['seq_item'] . '_' . $row['seq_ordem_compra'] . '_' . $row['seq_fornecedor'];
        $cotacoes_map[$chave] = $row;
    }

    // 5. Montar estrutura de itens com cotações
    $itens_mapa = array();
    while ($item = pg_fetch_assoc($result_itens)) {
        $item_obj = array(
            'seq_item' => (int)$item['seq_item'],
            'seq_ordem_compra' => (int)$item['seq_ordem_compra'],
            'codigo' => $item['codigo'],
            'descricao' => $item['descricao'],
            'unidade_medida' => $item['unidade_medida'],
            'qtde_item' => (float)$item['qtde_item'],
            'vlr_estoque' => (float)$item['vlr_estoque'],
            'cotacoes' => array()
        );

        // Adicionar cotação de cada fornecedor para este item
        foreach ($fornecedores as $forn) {
            $chave = $item['seq_item'] . '_' . $item['seq_ordem_compra'] . '_' . $forn['seq_fornecedor'];
            $cotacao = isset($cotacoes_map[$chave]) ? $cotacoes_map[$chave] : null;

            $item_obj['cotacoes'][] = array(
                'seq_fornecedor' => (int)$forn['seq_fornecedor'],
                'fornecedor_nome' => $forn['nome'],
                'vlr_fornecedor' => $cotacao ? (float)$cotacao['vlr_fornecedor'] : null,
                'vlr_total' => $cotacao ? (float)$cotacao['vlr_total'] : null,
                'selecionado' => $cotacao ? $cotacao['selecionado'] : 'N',
                'seq_orcamento_cotacao' => $cotacao ? (int)$cotacao['seq_orcamento_cotacao'] : null
            );
        }

        $itens_mapa[] = $item_obj;
    }

    // 6. Buscar pedidos gerados pelo orçamento (se aprovado)
    $pedidos_gerados = array();
    if ($orcamento['status'] === 'APROVADO') {
        $tabela_pedido = $dominio . '_pedido';
        $tabela_fornecedor_full = $dominio . '_fornecedor';
        
        $query_pedidos = "SELECT 
                            p.seq_pedido,
                            p.unidade,
                            p.nro_pedido,
                            p.seq_fornecedor,
                            p.vlr_total,
                            f.nome AS fornecedor_nome,
                            f.email AS fornecedor_email
                          FROM {$tabela_pedido} p
                          LEFT JOIN {$tabela_fornecedor_full} f ON p.seq_fornecedor = f.seq_fornecedor
                          WHERE p.seq_orcamento = $1
                          ORDER BY p.seq_pedido";
        
        $result_pedidos = sql($g_sql, $query_pedidos, false, array($seq_orcamento));
        
        while ($ped = pg_fetch_assoc($result_pedidos)) {
            $pedidos_gerados[] = array(
                'seq_pedido' => (int)$ped['seq_pedido'],
                'unidade' => $ped['unidade'],
                'nro_pedido' => $ped['nro_pedido'],
                'nro_pedido_formatado' => $ped['unidade'] . str_pad($ped['nro_pedido'], 7, '0', STR_PAD_LEFT),
                'seq_fornecedor' => (int)$ped['seq_fornecedor'],
                'fornecedor_nome' => $ped['fornecedor_nome'],
                'fornecedor_email' => $ped['fornecedor_email'],
                'vlr_total' => (float)$ped['vlr_total']
            );
        }
    }

    // 7. Retornar tudo junto
    echo json_encode([
        'success' => true,
        'data' => array(
            'orcamento' => $orcamento,
            'fornecedores' => $fornecedores,
            'itens_mapa' => $itens_mapa,
            'pedidos_gerados' => $pedidos_gerados
        )
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Obter ordens de compra do orçamento
 */
function obterOrdensOrcamento($g_sql, $dominio, $seq_orcamento) {
    $tabela_orcamento_oc = $dominio . '_orcamento_ordem_compra';
    $tabela_ordem = $dominio . '_ordem_compra';
    $tabela_centro = $dominio . '_centro_custo';
    $tabela_item_ordem = $dominio . '_ordem_compra_item';
    $tabela_item = $dominio . '_item';
    $tabela_unidade_med = $dominio . '_unidade_medida';

    $query = "SELECT
                oc.seq_ordem_compra,
                oc.nro_ordem_compra,
                oc.unidade,
                oc.observacao,
                cc.nro_centro_custo,
                cc.descricao AS centro_custo_descricao
              FROM {$tabela_orcamento_oc} ooc
              INNER JOIN {$tabela_ordem} oc ON ooc.seq_ordem_compra = oc.seq_ordem_compra
              LEFT JOIN {$tabela_centro} cc ON oc.seq_centro_custo = cc.seq_centro_custo
              WHERE ooc.seq_orcamento = $1";

    $result = sql($g_sql, $query, false, array($seq_orcamento));

    $ordens = array();
    while ($row = pg_fetch_assoc($result)) {
        // Buscar itens da ordem
        $query_itens = "SELECT
                          i.seq_item,
                          i.codigo,
                          i.descricao,
                          i.vlr_item,
                          um.sigla AS unidade_medida,
                          oci.qtde_item,
                          (i.vlr_item * oci.qtde_item) AS vlr_total
                        FROM {$tabela_item_ordem} oci
                        INNER JOIN {$tabela_item} i ON oci.seq_item = i.seq_item
                        LEFT JOIN {$tabela_unidade_med} um ON i.seq_unidade_medida = um.seq_unidade_medida
                        WHERE oci.seq_ordem_compra = $1";

        $result_itens = sql($g_sql, $query_itens, false, array($row['seq_ordem_compra']));

        $itens = array();
        $vlr_total_ordem = 0;

        while ($item = pg_fetch_assoc($result_itens)) {
            $itens[] = $item;
            $vlr_total_ordem += floatval($item['vlr_total']);
        }

        $row['itens'] = $itens;
        $row['vlr_total_ordem'] = $vlr_total_ordem;
        $ordens[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $ordens
    ]);
}

/**
 * Obter fornecedores do orçamento
 */
function obterFornecedoresOrcamento($g_sql, $dominio, $seq_orcamento) {
    $tabela_orcamento_forn = $dominio . '_orcamento_fornecedor';
    $tabela_fornecedor = $dominio . '_fornecedor';

    $query = "SELECT
                of.seq_orcamento_fornecedor,
                of.seq_fornecedor,
                f.nome,
                f.cnpj,
                COALESCE(of.email, f.email) AS email_cotacao,
                of.status,
                of.data_solicitacao,
                of.data_retorno
              FROM {$tabela_orcamento_forn} of
              INNER JOIN {$tabela_fornecedor} f ON of.seq_fornecedor = f.seq_fornecedor
              WHERE of.seq_orcamento = $1";

    $result = sql($g_sql, $query, false, array($seq_orcamento));

    $fornecedores = array();
    while ($row = pg_fetch_assoc($result)) {
        $fornecedores[] = $row;
    }

    echo json_encode([
        'success' => true,
        'data' => $fornecedores
    ]);
}

/**
 * Obter itens de cotação do orçamento para um fornecedor específico
 * Retorna todos os itens das ordens vinculadas ao orçamento
 * com os valores já informados pelo fornecedor (se houver)
 * ✅ BASEADO NA QUERY DO cotacao_fornecedor.php QUE FUNCIONA
 */
function obterItensCotacao($g_sql, $dominio, $seq_orcamento, $seq_fornecedor) {
    $tabela_orcamento_oc = $dominio . '_orcamento_ordem_compra';
    $tabela_ordem = $dominio . '_ordem_compra';
    $tabela_item_ordem = $dominio . '_ordem_compra_item';
    $tabela_item = $dominio . '_item';
    $tabela_unidade_med = $dominio . '_unidade_medida';
    $tabela_cotacao = $dominio . '_orcamento_cotacao';
    $tabela_orcamento_fornecedor = $dominio . '_orcamento_fornecedor';
    $tabela_fornecedor = $dominio . '_fornecedor';
    $tabela_centro_custo = $dominio . '_centro_custo';

    // ✅ Buscar informações do fornecedor e orçamento
    $query_fornecedor = "SELECT 
                            of.condicao_pgto,
                            of.data_prev_ent,
                            f.nome as fornecedor_nome,
                            f.cnpj as fornecedor_cnpj,
                            o.nro_orcamento,
                            o.unidade,
                            o.observacao,
                            o.data_inclusao,
                            o.hora_inclusao,
                            o.login_inclusao
                         FROM {$tabela_orcamento_fornecedor} of
                         INNER JOIN {$tabela_fornecedor} f ON f.seq_fornecedor = of.seq_fornecedor
                         INNER JOIN {$dominio}_orcamento o ON o.seq_orcamento = of.seq_orcamento
                         WHERE of.seq_orcamento = $1 
                         AND of.seq_fornecedor = $2";
    
    $result_fornecedor = sql($g_sql, $query_fornecedor, false, array($seq_orcamento, $seq_fornecedor));
    $fornecedor_info = pg_fetch_assoc($result_fornecedor);

    // ✅ QUERY IDÊNTICA ao cotacao_fornecedor.php que funciona!
    $query = "SELECT 
                oci.seq_ordem_compra_item,
                oci.seq_item,
                i.codigo,
                i.descricao,
                i.vlr_item,
                um.sigla as unidade_medida,
                oci.qtde_item,
                oc.seq_ordem_compra,
                oc.nro_ordem_compra,
                oc.unidade as unidade_ordem,
                cc.nro_centro_custo,
                cc.descricao as centro_custo_descricao,
                cot.vlr_fornecedor,
                cot.link,
                cot.seq_orcamento_cotacao
              FROM {$tabela_orcamento_oc} oo
              INNER JOIN {$tabela_ordem} oc ON oc.seq_ordem_compra = oo.seq_ordem_compra
              INNER JOIN {$tabela_item_ordem} oci ON oci.seq_ordem_compra = oc.seq_ordem_compra
              INNER JOIN {$tabela_item} i ON i.seq_item = oci.seq_item
              LEFT JOIN {$tabela_unidade_med} um ON um.seq_unidade_medida = i.seq_unidade_medida
              LEFT JOIN {$tabela_centro_custo} cc ON cc.seq_centro_custo = oc.seq_centro_custo
              LEFT JOIN {$tabela_cotacao} cot 
                ON cot.seq_orcamento = oo.seq_orcamento 
                AND cot.seq_ordem_compra = oc.seq_ordem_compra
                AND cot.seq_item = oci.seq_item
                AND cot.seq_fornecedor = $2
              WHERE oo.seq_orcamento = $1
              ORDER BY oc.nro_ordem_compra, i.codigo";

    $result = sql($g_sql, $query, false, array($seq_orcamento, $seq_fornecedor));

    $itens = array();
    while ($row = pg_fetch_assoc($result)) {
        $itens[] = $row;
    }

    // Log para debug
    error_log("=== DEBUG obterItensCotacao ===");
    error_log("seq_orcamento: " . $seq_orcamento);
    error_log("seq_fornecedor: " . $seq_fornecedor);
    error_log("Total itens: " . count($itens));
    error_log("Fornecedor: " . json_encode($fornecedor_info, JSON_UNESCAPED_UNICODE));
    if (count($itens) > 0) {
        error_log("Primeiro item: " . json_encode($itens[0], JSON_UNESCAPED_UNICODE));
    }
    error_log("================================");

    echo json_encode([
        'success' => true,
        'data' => $itens,
        'fornecedor' => $fornecedor_info // ✅ Retornar dados do fornecedor
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Obter cotações do orçamento
 */
function obterCotacoes($g_sql, $dominio, $seq_orcamento) {
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
              WHERE c.seq_orcamento = $1";

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
 * Atualizar orçamento
 */
function atualizarOrcamento($g_sql, $dominio, $data, $username) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    $observacao = isset($data['observacao']) ? strtoupper(trim($data['observacao'])) : '';
    $ordens_compra = $data['ordens_compra'] ?? array();
    $fornecedores = $data['fornecedores'] ?? array();

    if (!$seq_orcamento) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não informado']);
        return;
    }

    $tabela_orcamento = $dominio . '_orcamento';
    $tabela_orcamento_oc = $dominio . '_orcamento_ordem_compra';
    $tabela_orcamento_forn = $dominio . '_orcamento_fornecedor';
    $tabela_cotacao = $dominio . '_orcamento_cotacao';

    // Atualizar observação
    $query = "UPDATE {$tabela_orcamento}
              SET observacao = $1
              WHERE seq_orcamento = $2";

    sql($g_sql, $query, false, array($observacao, $seq_orcamento));

    // ✅ Atualizar ordens de compra (deletar e reinserir)
    if (!empty($ordens_compra)) {
        // Deletar ordens antigas
        $query_del_oc = "DELETE FROM {$tabela_orcamento_oc} WHERE seq_orcamento = $1";
        sql($g_sql, $query_del_oc, false, array($seq_orcamento));

        // Inserir novas ordens
        foreach ($ordens_compra as $seq_ordem_compra) {
            $query_oc = "INSERT INTO {$tabela_orcamento_oc} (seq_orcamento, seq_ordem_compra, seq_fornecedor)
                         VALUES ($1, $2, 0)";
            sql($g_sql, $query_oc, false, array($seq_orcamento, $seq_ordem_compra));
        }
    }

    // ✅ Atualizar fornecedores (MANTER fornecedores com cotações, apenas adicionar novos ou atualizar email)
    if (!empty($fornecedores)) {
        // Buscar fornecedores existentes
        $query_forn_exist = "SELECT seq_fornecedor, email FROM {$tabela_orcamento_forn} WHERE seq_orcamento = $1";
        $result_forn_exist = sql($g_sql, $query_forn_exist, false, array($seq_orcamento));
        
        $fornecedores_existentes = array();
        while ($row = pg_fetch_assoc($result_forn_exist)) {
            $fornecedores_existentes[$row['seq_fornecedor']] = $row;
        }

        // Criar array de fornecedores enviados
        $fornecedores_enviados = array();
        foreach ($fornecedores as $fornecedor) {
            $fornecedores_enviados[$fornecedor['seq_fornecedor']] = $fornecedor;
        }

        // Remover fornecedores que não estão mais na lista (apenas se não tiverem cotações)
        foreach ($fornecedores_existentes as $seq_forn => $forn_exist) {
            if (!isset($fornecedores_enviados[$seq_forn])) {
                // Verificar se tem cotações
                $query_check_cot = "SELECT COUNT(*) as total FROM {$tabela_cotacao} 
                                    WHERE seq_orcamento = $1 AND seq_fornecedor = $2";
                $result_check = sql($g_sql, $query_check_cot, false, array($seq_orcamento, $seq_forn));
                $row_check = pg_fetch_assoc($result_check);
                
                if ($row_check['total'] == 0) {
                    // Pode deletar (não tem cotações)
                    $query_del = "DELETE FROM {$tabela_orcamento_forn} 
                                  WHERE seq_orcamento = $1 AND seq_fornecedor = $2";
                    sql($g_sql, $query_del, false, array($seq_orcamento, $seq_forn));
                }
            }
        }

        // Adicionar novos fornecedores ou atualizar email dos existentes
        foreach ($fornecedores as $fornecedor) {
            $seq_fornecedor = $fornecedor['seq_fornecedor'];
            $email = $fornecedor['email'] ?? '';

            if (isset($fornecedores_existentes[$seq_fornecedor])) {
                // Atualizar email se mudou
                if ($email !== $fornecedores_existentes[$seq_fornecedor]['email']) {
                    $query_upd = "UPDATE {$tabela_orcamento_forn} 
                                  SET email = $1 
                                  WHERE seq_orcamento = $2 AND seq_fornecedor = $3";
                    sql($g_sql, $query_upd, false, array($email, $seq_orcamento, $seq_fornecedor));
                }
            } else {
                // Inserir novo fornecedor
                $query_ins = "INSERT INTO {$tabela_orcamento_forn}
                              (seq_orcamento, seq_fornecedor, email, status, codigo_acesso)
                              VALUES ($1, $2, $3, 'PENDENTE', '')";
                sql($g_sql, $query_ins, false, array($seq_orcamento, $seq_fornecedor, $email));
            }
        }
    }

    echo json_encode(['success' => true, 'message' => 'Orçamento atualizado com sucesso']);
}

/**
 * Salvar cotação (preços do fornecedor)
 */
function salvarCotacao($g_sql, $dominio, $data, $username) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    $seq_fornecedor = $data['seq_fornecedor'] ?? null;
    $itens = $data['itens'] ?? array();
    $condicao_pgto = $data['condicao_pgto'] ?? null;  // ✅ NOVO
    $data_prev_ent = $data['data_prev_ent'] ?? null;  // ✅ NOVO

    if (!$seq_orcamento || !$seq_fornecedor || empty($itens)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos para salvar cotação']);
        return;
    }

    // ✅ NOVO: Validar campos obrigatórios
    if (!$condicao_pgto || trim($condicao_pgto) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Condição de pagamento é obrigatória']);
        return;
    }

    if (!$data_prev_ent || trim($data_prev_ent) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Previsão de entrega é obrigatória']);
        return;
    }

    $tabela_cotacao = $dominio . '_orcamento_cotacao';
    $tabela_item_ordem = $dominio . '_ordem_compra_item';
    $tabela_item = $dominio . '_item';
    $tabela_orcamento_fornecedor = $dominio . '_orcamento_fornecedor';  // ✅ NOVO

    // Deletar cotações existentes para este fornecedor neste orçamento
    $query_del = "DELETE FROM {$tabela_cotacao} 
                  WHERE seq_orcamento = $1 AND seq_fornecedor = $2";
    sql($g_sql, $query_del, false, array($seq_orcamento, $seq_fornecedor));

    // Log para debug
    error_log("=== DEBUG salvarCotacao ===");
    error_log("seq_orcamento: " . $seq_orcamento);
    error_log("seq_fornecedor: " . $seq_fornecedor);
    error_log("Total itens recebidos: " . count($itens));
    error_log("Itens: " . json_encode($itens, JSON_UNESCAPED_UNICODE));

    // Inserir novas cotações
    $contador_inseridos = 0;
    foreach ($itens as $item) {
        $seq_item = $item['seq_item'] ?? null;
        $seq_ordem_compra_item = $item['seq_ordem_compra_item'] ?? null;
        $vlr_fornecedor = $item['vlr_fornecedor'] ?? null;
        $link = trim($item['link'] ?? ''); // ✅ NOVO: campo link

        if ($seq_item && $seq_ordem_compra_item && $vlr_fornecedor !== null && $vlr_fornecedor > 0) {
            // Buscar dados do item da ordem de compra
            $query_item = "SELECT 
                            oci.seq_ordem_compra,
                            oci.qtde_item,
                            i.vlr_item as vlr_estoque
                          FROM {$tabela_item_ordem} oci
                          INNER JOIN {$tabela_item} i ON oci.seq_item = i.seq_item
                          WHERE oci.seq_ordem_compra_item = $1";
            $result_item = sql($g_sql, $query_item, false, array($seq_ordem_compra_item));
            $item_data = pg_fetch_assoc($result_item);

            if ($item_data) {
                $seq_ordem_compra = $item_data['seq_ordem_compra'];
                $qtde_item = $item_data['qtde_item'];
                $vlr_estoque = $item_data['vlr_estoque'] ?? 0;
                $vlr_total = $vlr_fornecedor * $qtde_item;

                // Inserir cotação
                $query_ins = "INSERT INTO {$tabela_cotacao}
                              (seq_orcamento, seq_fornecedor, seq_ordem_compra, seq_item, 
                               qtde_item, vlr_estoque, vlr_fornecedor, vlr_total, link)
                              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)";
                sql($g_sql, $query_ins, false, array(
                    $seq_orcamento, 
                    $seq_fornecedor, 
                    $seq_ordem_compra,
                    $seq_item, 
                    $qtde_item,
                    $vlr_estoque,
                    $vlr_fornecedor, 
                    $vlr_total,
                    $link // ✅ NOVO: adicionar link
                ));
                $contador_inseridos++;
            }
        }
    }

    // ✅ NOVO: Atualizar condição de pagamento e previsão de entrega no fornecedor do orçamento
    $query_upd_forn = "UPDATE {$tabela_orcamento_fornecedor}
                       SET condicao_pgto = $1,
                           data_prev_ent = $2
                       WHERE seq_orcamento = $3 AND seq_fornecedor = $4";
    sql($g_sql, $query_upd_forn, false, array($condicao_pgto, $data_prev_ent, $seq_orcamento, $seq_fornecedor));

    echo json_encode(['success' => true, 'message' => 'Cotação salva com sucesso', 'itens_inseridos' => $contador_inseridos]);
}

/**
 * Salvar escolhas do mapa de cotação
 * Atualiza a coluna selecionado na tabela de cotações
 */
function salvarEscolhasMapa($g_sql, $dominio, $data) {
    $seq_orcamento = $data['seq_orcamento'] ?? null;
    $selecoes = $data['selecoes'] ?? array();

    if (!$seq_orcamento) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Orçamento não informado']);
        return;
    }

    $tabela_cotacao = $dominio . '_orcamento_cotacao';

    // Log para debug
    error_log("=== DEBUG salvarEscolhasMapa ===");
    error_log("seq_orcamento: " . $seq_orcamento);
    error_log("Total seleções recebidas: " . count($selecoes));
    error_log("Seleções: " . json_encode($selecoes, JSON_UNESCAPED_UNICODE));

    // 1. Resetar TODAS as seleções do orçamento
    $query_reset = "UPDATE {$tabela_cotacao} 
                    SET selecionado = 'N'
                    WHERE seq_orcamento = $1";
    sql($g_sql, $query_reset, false, array($seq_orcamento));

    // 2. Marcar as novas seleções
    $contador_atualizados = 0;
    foreach ($selecoes as $selecao) {
        $seq_item = $selecao['seq_item'] ?? null;
        $seq_ordem_compra = $selecao['seq_ordem_compra'] ?? null;
        $seq_fornecedor = $selecao['seq_fornecedor'] ?? null;

        if ($seq_item && $seq_ordem_compra && $seq_fornecedor) {
            // Marcar cotação como selecionada
            $query_upd = "UPDATE {$tabela_cotacao}
                          SET selecionado = 'S'
                          WHERE seq_orcamento = $1 
                            AND seq_item = $2 
                            AND seq_ordem_compra = $3 
                            AND seq_fornecedor = $4";
            sql($g_sql, $query_upd, false, array($seq_orcamento, $seq_item, $seq_ordem_compra, $seq_fornecedor));
            $contador_atualizados++;
        }
    }

    error_log("Total de escolhas atualizadas: " . $contador_atualizados);
    error_log("================================");

    echo json_encode(['success' => true, 'message' => 'Escolhas do mapa salvas com sucesso', 'itens_atualizados' => $contador_atualizados]);
}

/**
 * Cancelar orçamento
 */
function cancelarOrcamento($g_sql, $dominio, $seq_orcamento) {
    $tabela_orcamento = $dominio . '_orcamento';

    $query = "UPDATE {$tabela_orcamento}
              SET status = 'CANCELADO'
              WHERE seq_orcamento = $1";

    sql($g_sql, $query, false, array($seq_orcamento));

    echo json_encode(['success' => true, 'message' => 'Orçamento cancelado com sucesso']);
}