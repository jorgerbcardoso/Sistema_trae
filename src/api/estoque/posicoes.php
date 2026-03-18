<?php
/**
 * API ESTOQUE - POSIÇÕES DE ESTOQUE (CRUD COMPLETO)
 * Gerencia posições físicas no estoque (rua, altura, coluna)
 * 
 * REGRA: MTZ vê tudo, outras unidades veem apenas seus estoques
 */

// ✅ 1. PRIMEIRO: Carregar configurações
require_once '/var/www/html/sistema/api/config.php';

// ✅ 2. SEGUNDO: Carregar helper
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ 3. TERCEIRO: Setup CORS e OPTIONS
setupCORS();
handleOptionsRequest();

// ✅ 4. QUARTO: Verificar autenticação
requireAuth();

// ✅ 5. QUINTO: Obter dados do usuário
$currentUser = getCurrentUser();

$domain = $currentUser['domain'] ?? 'acv';
$login = $currentUser['username'] ?? 'SISTEMA';
$unidadeAtual = $currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '';

$prefix = $domain . '_';
$tblPosicao = $prefix . 'posicao';
$tblEstoque = $prefix . 'estoque';
$tblItem = $prefix . 'item';

// ✅ VERIFICAR SE É MTZ
$isMTZ = (strtoupper($unidadeAtual) === 'MTZ');

// ✅ CONECTAR AO BANCO
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    // ✅ SUPORTE A METHOD OVERRIDE (Laravel-style)
    if ($method === 'POST' && isset($input['_method'])) {
        $method = strtoupper($input['_method']);
    }
    
    switch ($method) {
        case 'GET':
            if (isset($_GET['seq_posicao'])) {
                // Buscar posição específica
                $seq = intval($_GET['seq_posicao']);
                
                $query = "SELECT p.*, e.descricao as estoque_descricao, e.nro_estoque, e.unidade,
                                 i.codigo as item_codigo, i.descricao as item_descricao
                          FROM $tblPosicao p
                          INNER JOIN $tblEstoque e ON p.seq_estoque = e.seq_estoque
                          LEFT JOIN $tblItem i ON p.seq_item = i.seq_item
                          WHERE p.seq_posicao = $1";
                
                // ✅ Se não for MTZ, filtrar por unidade
                if (!$isMTZ && !empty($unidadeAtual)) {
                    $query .= " AND e.unidade = '" . strtoupper($unidadeAtual) . "'";
                }
                
                $result = sql($g_sql, $query, false, [$seq]);
                
                if (!$result) {
                    msg('Erro ao consultar posição');
                }
                
                if (pg_num_rows($result) > 0) {
                    $row = pg_fetch_assoc($result);
                    // ✅ CONVERTER TIPOS NUMÉRICOS
                    $row['seq_posicao'] = intval($row['seq_posicao']);
                    $row['seq_estoque'] = intval($row['seq_estoque']);
                    $row['seq_item'] = $row['seq_item'] ? intval($row['seq_item']) : null;
                    $row['saldo'] = floatval($row['saldo'] ?? 0);
                    echo json_encode(['success' => true, 'data' => $row]);
                } else {
                    msg('Posição não encontrada');
                }
            } else {
                // Listar posições (ATIVAS E INATIVAS)
                $where = ['1=1'];
                $params = [];
                $paramCount = 1;
                
                // ✅ REGRA: Se não for MTZ, filtrar por unidade
                if (!$isMTZ && !empty($unidadeAtual)) {
                    $where[] = "e.unidade = '" . strtoupper($unidadeAtual) . "'";
                }
                
                if (isset($_GET['seq_estoque']) && !empty($_GET['seq_estoque'])) {
                    $where[] = "p.seq_estoque = $" . $paramCount++;
                    $params[] = intval($_GET['seq_estoque']);
                }
                
                if (isset($_GET['rua']) && !empty($_GET['rua'])) {
                    $where[] = "UPPER(p.rua) = $" . $paramCount++;
                    $params[] = strtoupper(trim($_GET['rua']));
                }
                
                if (isset($_GET['altura']) && !empty($_GET['altura'])) {
                    $where[] = "UPPER(p.altura) = $" . $paramCount++;
                    $params[] = strtoupper(trim($_GET['altura']));
                }
                
                if (isset($_GET['seq_item']) && !empty($_GET['seq_item'])) {
                    // ✅ BUSCAR POSIÇÕES QUE JÁ TÊM O ITEM OU POSIÇÕES VAZIAS (seq_item IS NULL)
                    $where[] = "(p.seq_item = $" . $paramCount . " OR p.seq_item IS NULL)";
                    $params[] = intval($_GET['seq_item']);
                    $paramCount++;
                }
                
                if (isset($_GET['seq_tipo_item']) && !empty($_GET['seq_tipo_item'])) {
                    $where[] = "i.seq_tipo_item = $" . $paramCount++;
                    $params[] = intval($_GET['seq_tipo_item']);
                }
                
                if (isset($_GET['search']) && !empty($_GET['search'])) {
                    $search = strtoupper(trim($_GET['search']));
                    $where[] = "(UPPER(p.rua) LIKE $" . $paramCount . " OR UPPER(e.descricao) LIKE $" . $paramCount . ")";
                    $params[] = "%$search%";
                    $paramCount++;
                }
                
                // ✅ Filtrar apenas posições ativas (se especificado)
                if (isset($_GET['ativa'])) {
                    $where[] = "p.ativa = $" . $paramCount++;
                    $params[] = strtoupper($_GET['ativa']);
                }
                
                $whereClause = implode(' AND ', $where);
                $query = "SELECT p.*, e.descricao as estoque_descricao, e.nro_estoque, e.unidade,
                                 i.codigo as item_codigo, i.descricao as item_descricao
                          FROM $tblPosicao p
                          INNER JOIN $tblEstoque e ON p.seq_estoque = e.seq_estoque
                          LEFT JOIN $tblItem i ON p.seq_item = i.seq_item
                          WHERE $whereClause
                          ORDER BY e.nro_estoque, p.rua, p.altura, p.coluna
                          LIMIT 500";
                
                $result = sql($g_sql, $query, false, $params);
                
                if (!$result) {
                    msg('Erro ao consultar posições');
                }
                
                $posicoes = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    // ✅ CONVERTER TIPOS NUMÉRICOS
                    $row['seq_posicao'] = intval($row['seq_posicao']);
                    $row['seq_estoque'] = intval($row['seq_estoque']);
                    $row['seq_item'] = $row['seq_item'] ? intval($row['seq_item']) : null;
                    $row['saldo'] = floatval($row['saldo'] ?? 0);
                    $posicoes[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $posicoes]);
            }
            break;
            
        case 'POST':
            // CRIAR NOVA POSIÇÃO
            $seq_estoque = intval($input['seq_estoque'] ?? 0);
            $rua = strtoupper(trim($input['rua'] ?? ''));
            $altura = strtoupper(trim($input['altura'] ?? ''));
            $coluna = strtoupper(trim($input['coluna'] ?? ''));
            $seq_item = !empty($input['seq_item']) ? intval($input['seq_item']) : null;
            $saldo = floatval($input['saldo'] ?? 0);
            
            if ($seq_estoque <= 0 || empty($rua) || empty($altura) || empty($coluna)) {
                msg('Estoque, rua, altura e coluna são obrigatórios');
                exit;
            }
            
            if ($seq_item === null || $seq_item <= 0) {
                msg('Item é obrigatório');
                exit;
            }
            
            // ✅ Verificar duplicidade: MESMA LOCALIZAÇÃO + MESMO ITEM
            $checkDuplicata = sql($g_sql, "SELECT seq_posicao FROM $tblPosicao WHERE seq_estoque = $1 AND rua = $2 AND altura = $3 AND coluna = $4 AND seq_item = $5 AND ativa = 'S'", 
                        false, [$seq_estoque, $rua, $altura, $coluna, $seq_item]);
            if (pg_num_rows($checkDuplicata) > 0) {
                msg('Já existe uma posição ATIVA para este ITEM nesta localização (ESTOQUE/RUA/ALTURA/COLUNA)');
                exit;
            }
            
            $query = "INSERT INTO $tblPosicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) 
                      VALUES ($1, $2, $3, $4, $5, $6, 'S', $7) RETURNING seq_posicao";
            
            $result = sql($g_sql, $query, false, [
                $seq_estoque, $rua, $altura, $coluna, $seq_item, $saldo, $login
            ]);
            $row = pg_fetch_assoc($result);
            
            echo json_encode(['success' => true, 'seq_posicao' => $row['seq_posicao']]);
            break;
            
        case 'PUT':
            // ATUALIZAR POSIÇÃO
            $seq = intval($input['seq_posicao'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID da posição inválido');
                exit;
            }
            
            // ✅ VERIFICAR SE POSIÇÃO PERTENCE À UNIDADE DO USUÁRIO
            if (!$isMTZ && !empty($unidadeAtual)) {
                $checkUnit = sql($g_sql, 
                    "SELECT e.unidade FROM $tblPosicao p 
                     INNER JOIN $tblEstoque e ON p.seq_estoque = e.seq_estoque 
                     WHERE p.seq_posicao = $1", 
                    false, [$seq]);
                if (pg_num_rows($checkUnit) === 0) {
                    msg('Posição não encontrada');
                    exit;
                }
                $posicaoData = pg_fetch_assoc($checkUnit);
                if ($posicaoData['unidade'] !== strtoupper($unidadeAtual)) {
                    msg('Você não tem permissão para editar esta posição');
                    exit;
                }
            }
            
            $seq_estoque = intval($input['seq_estoque'] ?? 0);
            $rua = strtoupper(trim($input['rua'] ?? ''));
            $altura = strtoupper(trim($input['altura'] ?? ''));
            $coluna = strtoupper(trim($input['coluna'] ?? ''));
            $seq_item = !empty($input['seq_item']) ? intval($input['seq_item']) : null;
            $saldo = floatval($input['saldo'] ?? 0);
            
            if ($seq_estoque <= 0 || empty($rua) || empty($altura) || empty($coluna)) {
                msg('Estoque, rua, altura e coluna são obrigatórios');
                exit;
            }
            
            // ✅ Verificar duplicidade: MESMA LOCALIZAÇÃO + MESMO ITEM (exceto a posição atual)
            if ($seq_item !== null && $seq_item > 0) {
                $check = sql($g_sql, "SELECT seq_posicao FROM $tblPosicao WHERE seq_estoque = $1 AND rua = $2 AND altura = $3 AND coluna = $4 AND seq_item = $5 AND ativa = 'S' AND seq_posicao != $6", 
                            false, [$seq_estoque, $rua, $altura, $coluna, $seq_item, $seq]);
                if (pg_num_rows($check) > 0) {
                    msg('Já existe outra posição ativa para este ITEM nesta localização (ESTOQUE/RUA/ALTURA/COLUNA)');
                    exit;
                }
            }
            
            $query = "UPDATE $tblPosicao SET 
                      seq_estoque = $1, rua = $2, altura = $3, coluna = $4, seq_item = $5, saldo = $6,
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $7
                      WHERE seq_posicao = $8";
            
            sql($g_sql, $query, false, [
                $seq_estoque, $rua, $altura, $coluna, $seq_item, $saldo, $login, $seq
            ]);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // INATIVAR POSIÇÃO (não mais deletar)
            $seq = intval($_GET['seq_posicao'] ?? $input['seq_posicao'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID da posição inválido');
                exit;
            }
            
            // ✅ VERIFICAR SE POSIÇÃO PERTENCE À UNIDADE DO USUÁRIO
            if (!$isMTZ && !empty($unidadeAtual)) {
                $checkUnit = sql($g_sql, 
                    "SELECT e.unidade FROM $tblPosicao p 
                     INNER JOIN $tblEstoque e ON p.seq_estoque = e.seq_estoque 
                     WHERE p.seq_posicao = $1", 
                    false, [$seq]);
                if (pg_num_rows($checkUnit) === 0) {
                    msg('Posição não encontrada');
                    exit;
                }
                $posicaoData = pg_fetch_assoc($checkUnit);
                if ($posicaoData['unidade'] !== strtoupper($unidadeAtual)) {
                    msg('Você não tem permissão para inativar esta posição');
                    exit;
                }
            }
            
            // INATIVAR em vez de deletar
            $query = "UPDATE $tblPosicao SET 
                      ativa = 'N',
                      data_alteracao = CURRENT_DATE, 
                      hora_alteracao = CURRENT_TIME, 
                      login_alteracao = $1
                      WHERE seq_posicao = $2";
            
            sql($g_sql, $query, false, [$login, $seq]);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'PATCH':
            // REATIVAR POSIÇÃO
            $seq = intval($input['seq_posicao'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID da posição inválido');
                exit;
            }
            
            // ✅ VERIFICAR SE POSIÇÃO PERTENCE À UNIDADE DO USUÁRIO
            if (!$isMTZ && !empty($unidadeAtual)) {
                $checkUnit = sql($g_sql, 
                    "SELECT e.unidade, p.seq_estoque, p.rua, p.altura, p.coluna FROM $tblPosicao p 
                     INNER JOIN $tblEstoque e ON p.seq_estoque = e.seq_estoque 
                     WHERE p.seq_posicao = $1", 
                    false, [$seq]);
                if (pg_num_rows($checkUnit) === 0) {
                    msg('Posição não encontrada');
                    exit;
                }
                $posicaoData = pg_fetch_assoc($checkUnit);
                if ($posicaoData['unidade'] !== strtoupper($unidadeAtual)) {
                    msg('Você não tem permissão para reativar esta posição');
                    exit;
                }
            } else {
                // MTZ - buscar dados da posição
                $check = sql($g_sql, "SELECT seq_estoque, rua, altura, coluna FROM $tblPosicao WHERE seq_posicao = $1", false, [$seq]);
                if (pg_num_rows($check) === 0) {
                    msg('Posição não encontrada');
                    exit;
                }
                $posicaoData = pg_fetch_assoc($check);
            }
            
            // Verificar se já existe outra posição ativa com mesma localização
            $checkConflict = sql($g_sql, 
                "SELECT seq_posicao FROM $tblPosicao 
                 WHERE seq_estoque = $1 AND rua = $2 AND altura = $3 AND coluna = $4 
                 AND ativa = 'S' AND seq_posicao != $5", 
                false, [
                    $posicaoData['seq_estoque'], 
                    $posicaoData['rua'], 
                    $posicaoData['altura'], 
                    $posicaoData['coluna'],
                    $seq
                ]);
            
            if (pg_num_rows($checkConflict) > 0) {
                msg('Não é possível reativar: já existe uma posição ativa com esta localização');
                exit;
            }
            
            // REATIVAR
            $query = "UPDATE $tblPosicao SET 
                      ativa = 'S',
                      data_alteracao = CURRENT_DATE, 
                      hora_alteracao = CURRENT_TIME, 
                      login_alteracao = $1
                      WHERE seq_posicao = $2";
            
            sql($g_sql, $query, false, [$login, $seq]);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            msg('Método não permitido', 405);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/posicoes.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}