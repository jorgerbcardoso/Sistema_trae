<?php
/**
 * API ESTOQUE - CRUD DE ESTOQUES
 * Gerencia cadastro de estoques
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

$domain = $currentUser['domain'] ?? 'acv';
$login = $currentUser['username'] ?? 'SISTEMA';
$unidadeAtual = $currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '';

$prefix = $domain . '_';
$tblEstoque = $prefix . 'estoque';

// ✅ VERIFICAR SE É MTZ
$isMTZ = (strtoupper($unidadeAtual) === 'MTZ');

// ✅ NOME DA TABELA DE POSIÇÕES
$tblPosicao = $prefix . 'posicao';
    
// ✅ CONECTAR AO BANCO
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            // LISTAR ou BUSCAR POR ID
            if (isset($_GET['seq_estoque'])) {
                $seq = intval($_GET['seq_estoque']);
                $result = sql($g_sql, "SELECT * FROM $tblEstoque WHERE seq_estoque = $1", false, [$seq]);
                
                if (!$result) {
                    msg('Erro ao consultar estoque');
                }
                
                if (pg_num_rows($result) > 0) {
                    echo json_encode(['success' => true, 'data' => pg_fetch_assoc($result)]);
                } else {
                    msg('Estoque não encontrado');
                }
            } else {
                // Listar todos (com filtros opcionais)
                $where = ['1=1'];
                $params = [];
                $paramCount = 1;
                
                // ✅ FILTRO POR UNIDADE
                // Se receber parâmetro GET 'unidade', usa ele (desde que seja permitido)
                // Senão, se não for MTZ, filtra pela unidade operacional do usuário
                if (isset($_GET['unidade']) && !empty($_GET['unidade'])) {
                    $unidadeFiltro = strtoupper($_GET['unidade']);
                    
                    // ✅ Validar: não-MTZ só pode filtrar pela própria unidade
                    if (!$isMTZ && $unidadeFiltro !== strtoupper($unidadeAtual)) {
                        msg('Você não tem permissão para visualizar estoques de outras unidades');
                    }
                    
                    $where[] = "e.unidade = $" . $paramCount++;
                    $params[] = $unidadeFiltro;
                } elseif (!$isMTZ && !empty($unidadeAtual)) {
                    // Se não passou filtro e não é MTZ, filtrar automaticamente
                    $where[] = "e.unidade = $" . $paramCount++;
                    $params[] = strtoupper($unidadeAtual);
                }
                
                if (isset($_GET['ativo'])) {
                    $where[] = "e.ativo = $" . $paramCount++;
                    $params[] = $_GET['ativo'];
                }
                
                $whereClause = implode(' AND ', $where);
                
                // ✅ QUERY COM CONTAGENS DE POSIÇÕES E ITENS
                $query = "
                    SELECT 
                        e.seq_estoque,
                        e.unidade,
                        e.nro_estoque,
                        e.descricao,
                        e.ativo,
                        e.data_inclusao,
                        e.hora_inclusao,
                        e.login_inclusao,
                        e.data_alteracao,
                        e.hora_alteracao,
                        e.login_alteracao,
                        COALESCE(COUNT(p.seq_posicao), 0) AS qtd_posicoes,
                        COALESCE(COUNT(DISTINCT p.seq_item), 0) AS qtd_itens
                    FROM $tblEstoque e
                    LEFT OUTER JOIN $tblPosicao p ON p.seq_estoque = e.seq_estoque
                    WHERE $whereClause
                    GROUP BY e.seq_estoque, e.unidade, e.nro_estoque, e.descricao, e.ativo, 
                             e.data_inclusao, e.hora_inclusao, e.login_inclusao,
                             e.data_alteracao, e.hora_alteracao, e.login_alteracao
                    ORDER BY e.nro_estoque
                ";
                
                $result = sql($g_sql, $query, false, $params);
                
                if (!$result) {
                    msg('Erro ao consultar estoques');
                }
                
                $estoques = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    $estoques[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $estoques]);
            }
            break;
            
        case 'POST':
            // CRIAR NOVO ESTOQUE
            $unidade = strtoupper(trim($input['unidade'] ?? ''));
            $nro_estoque = strtoupper(trim($input['nro_estoque'] ?? ''));
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($unidade) || empty($nro_estoque) || empty($descricao)) {
                msg('Campos obrigatórios não preenchidos');
            }
            
            // ✅ VALIDAR PERMISSÃO: usuários não-MTZ só podem criar estoques da sua unidade
            if (!$isMTZ && strtoupper($unidade) !== strtoupper($unidadeAtual)) {
                msg('Você não tem permissão para criar estoques de outras unidades');
            }
            
            // Verificar duplicidade
            $check = sql($g_sql, "SELECT seq_estoque FROM $tblEstoque WHERE unidade = $1 AND nro_estoque = $2", false, [$unidade, $nro_estoque]);
            if (pg_num_rows($check) > 0) {
                msg('Já existe um estoque com este número nesta unidade');
            }
            
            $query = "INSERT INTO $tblEstoque (unidade, nro_estoque, descricao, ativo, login_inclusao) 
                      VALUES ($1, $2, $3, $4, $5) RETURNING seq_estoque";
            
            $result = sql($g_sql, $query, false, [$unidade, $nro_estoque, $descricao, $ativo, $login]);
            $row = pg_fetch_assoc($result);
            
            echo json_encode(['success' => true, 'seq_estoque' => $row['seq_estoque']]);
            break;
            
        case 'PUT':
            // ATUALIZAR ESTOQUE
            $seq = intval($input['seq_estoque'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do estoque inválido');
            }
            
            // ✅ OBTER DADOS ATUAIS DO ESTOQUE
            $checkEstoque = sql($g_sql, "SELECT unidade FROM $tblEstoque WHERE seq_estoque = $1", false, [$seq]);
            if (pg_num_rows($checkEstoque) === 0) {
                msg('Estoque não encontrado');
            }
            $estoqueAtual = pg_fetch_assoc($checkEstoque);
            
            $unidade = strtoupper(trim($input['unidade'] ?? ''));
            $nro_estoque = strtoupper(trim($input['nro_estoque'] ?? ''));
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($unidade) || empty($nro_estoque) || empty($descricao)) {
                msg('Campos obrigatórios não preenchidos');
            }
            
            // ✅ REGRA: Se o usuário VÊ o estoque, pode EDITAR
            // Apenas impedir que não-MTZ altere a unidade do estoque
            if (!$isMTZ && strtoupper($unidade) !== strtoupper($estoqueAtual['unidade'])) {
                msg('Você não pode alterar a unidade do estoque');
            }
            
            // Verificar duplicidade (exceto o próprio registro)
            $check = sql($g_sql, "SELECT seq_estoque FROM $tblEstoque WHERE unidade = $1 AND nro_estoque = $2 AND seq_estoque != $3", 
                        false, [$unidade, $nro_estoque, $seq]);
            if (pg_num_rows($check) > 0) {
                msg('Já existe outro estoque com este número nesta unidade');
            }
            
            $query = "UPDATE $tblEstoque SET 
                      unidade = $1, nro_estoque = $2, descricao = $3, ativo = $4,
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $5
                      WHERE seq_estoque = $6";
            
            sql($g_sql, $query, false, [$unidade, $nro_estoque, $descricao, $ativo, $login, $seq]);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // INATIVAR (não deletar fisicamente)
            $seq = intval($input['seq_estoque'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do estoque inválido');
            }
            
            // ✅ REGRA: Se o usuário VÊ o estoque, pode INATIVAR
            // Não precisa validar permissão adicional aqui
            
            $query = "UPDATE $tblEstoque SET ativo = 'N', 
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $1
                      WHERE seq_estoque = $2";
            
            sql($g_sql, $query, false, [$login, $seq]);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            msg('Método não permitido', 405);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/estoques.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}