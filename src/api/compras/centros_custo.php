<?php
/**
 * API COMPRAS - CRUD DE CENTROS DE CUSTO
 * Gerencia cadastro de centros de custo
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

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($domain) . '_';
$tblCentroCusto = $prefix . 'centro_custo';

// ✅ VERIFICAR SE É MTZ
$isMTZ = (strtoupper($unidadeAtual) === 'MTZ');

// ✅ Conectar ao banco
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            // LISTAR ou BUSCAR POR ID
            if (isset($_GET['seq_centro_custo'])) {
                $seq = intval($_GET['seq_centro_custo']);
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql("SELECT * FROM $tblCentroCusto WHERE seq_centro_custo = $1", [$seq], $g_sql);
                
                if (pg_num_rows($result) > 0) {
                    echo json_encode(['success' => true, 'data' => pg_fetch_assoc($result)]);
                } else {
                    msg('CENTRO DE CUSTO NÃO ENCONTRADO', 'error', 404);
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
                        msg('VOCÊ NÃO TEM PERMISSÃO PARA VISUALIZAR CENTROS DE CUSTO DE OUTRAS UNIDADES', 'error', 403);
                    }
                    
                    $where[] = "unidade = $" . $paramCount++;
                    $params[] = $unidadeFiltro;
                } elseif (!$isMTZ && !empty($unidadeAtual)) {
                    // Se não passou filtro e não é MTZ, filtrar automaticamente
                    $where[] = "unidade = $" . $paramCount++;
                    $params[] = strtoupper($unidadeAtual);
                }
                
                if (isset($_GET['ativo'])) {
                    $where[] = "ativo = $" . $paramCount++;
                    $params[] = $_GET['ativo'];
                }
                
                $whereClause = implode(' AND ', $where);
                
                $query = "
                    SELECT 
                        seq_centro_custo,
                        unidade,
                        nro_centro_custo,
                        descricao,
                        ativo,
                        data_inclusao,
                        hora_inclusao,
                        login_inclusao,
                        data_alteracao,
                        hora_alteracao,
                        login_alteracao
                    FROM $tblCentroCusto
                    WHERE $whereClause
                    ORDER BY nro_centro_custo
                ";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql($query, $params, $g_sql);
                $centrosCusto = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    $centrosCusto[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $centrosCusto]);
            }
            break;
            
        case 'POST':
            // CRIAR NOVO CENTRO DE CUSTO
            $unidade = strtoupper(trim($input['unidade'] ?? ''));
            $nro_centro_custo = strtoupper(trim($input['nro_centro_custo'] ?? ''));
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($unidade) || empty($nro_centro_custo) || empty($descricao)) {
                msg('CAMPOS OBRIGATÓRIOS NÃO PREENCHIDOS', 'error', 400);
            }
            
            // ✅ VALIDAR PERMISSÃO: usuários não-MTZ só podem criar centros de custo da sua unidade
            if (!$isMTZ && strtoupper($unidade) !== strtoupper($unidadeAtual)) {
                msg('VOCÊ NÃO TEM PERMISSÃO PARA CRIAR CENTROS DE CUSTO DE OUTRAS UNIDADES', 'error', 403);
            }
            
            // Verificar duplicidade
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $check = sql("SELECT seq_centro_custo FROM $tblCentroCusto WHERE unidade = $1 AND nro_centro_custo = $2", [$unidade, $nro_centro_custo], $g_sql);
            if (pg_num_rows($check) > 0) {
                msg('JÁ EXISTE UM CENTRO DE CUSTO COM ESTE NÚMERO NESTA UNIDADE', 'error', 409);
            }
            
            $query = "INSERT INTO $tblCentroCusto (unidade, nro_centro_custo, descricao, ativo, login_inclusao) 
                      VALUES ($1, $2, $3, $4, $5) RETURNING seq_centro_custo";
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $result = sql($query, [$unidade, $nro_centro_custo, $descricao, $ativo, $login], $g_sql);
            $row = pg_fetch_assoc($result);
            
            echo json_encode(['success' => true, 'seq_centro_custo' => $row['seq_centro_custo']]);
            break;
            
        case 'PUT':
            // ATUALIZAR CENTRO DE CUSTO
            $seq = intval($input['seq_centro_custo'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID DO CENTRO DE CUSTO INVÁLIDO', 'error', 400);
            }
            
            // ✅ OBTER DADOS ATUAIS DO CENTRO DE CUSTO
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $checkCentroCusto = sql("SELECT unidade FROM $tblCentroCusto WHERE seq_centro_custo = $1", [$seq], $g_sql);
            if (pg_num_rows($checkCentroCusto) === 0) {
                msg('CENTRO DE CUSTO NÃO ENCONTRADO', 'error', 404);
            }
            $centroCustoAtual = pg_fetch_assoc($checkCentroCusto);
            
            $unidade = strtoupper(trim($input['unidade'] ?? ''));
            $nro_centro_custo = strtoupper(trim($input['nro_centro_custo'] ?? ''));
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($unidade) || empty($nro_centro_custo) || empty($descricao)) {
                msg('CAMPOS OBRIGATÓRIOS NÃO PREENCHIDOS', 'error', 400);
            }
            
            // ✅ REGRA: Se o usuário VÊ o centro de custo, pode EDITAR
            // Apenas impedir que não-MTZ altere a unidade do centro de custo
            if (!$isMTZ && strtoupper($unidade) !== strtoupper($centroCustoAtual['unidade'])) {
                msg('VOCÊ NÃO PODE ALTERAR A UNIDADE DO CENTRO DE CUSTO', 'error', 403);
            }
            
            // Verificar duplicidade (exceto o próprio registro)
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $check = sql("SELECT seq_centro_custo FROM $tblCentroCusto WHERE unidade = $1 AND nro_centro_custo = $2 AND seq_centro_custo != $3", 
                        [$unidade, $nro_centro_custo, $seq], $g_sql);
            if (pg_num_rows($check) > 0) {
                msg('JÁ EXISTE OUTRO CENTRO DE CUSTO COM ESTE NÚMERO NESTA UNIDADE', 'error', 409);
            }
            
            $query = "UPDATE $tblCentroCusto SET 
                      unidade = $1, nro_centro_custo = $2, descricao = $3, ativo = $4,
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $5
                      WHERE seq_centro_custo = $6";
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            sql($query, [$unidade, $nro_centro_custo, $descricao, $ativo, $login, $seq], $g_sql);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // INATIVAR (não deletar fisicamente)
            $seq = intval($input['seq_centro_custo'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID DO CENTRO DE CUSTO INVÁLIDO', 'error', 400);
            }
            
            // ✅ REGRA: Se o usuário VÊ o centro de custo, pode INATIVAR
            // Não precisa validar permissão adicional aqui
            
            $query = "UPDATE $tblCentroCusto SET ativo = 'N', 
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $1
                      WHERE seq_centro_custo = $2";
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            sql($query, [$login, $seq], $g_sql);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            msg('MÉTODO NÃO PERMITIDO', 'error', 405);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/compras/centros_custo.php: " . $e->getMessage());
    msg('ERRO AO PROCESSAR REQUISIÇÃO: ' . $e->getMessage(), 'error', 500);
}
