<?php
/**
 * API ESTOQUE - CRUD DE ITENS
 * Gerencia cadastro de itens de estoque
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
$tblItem = $prefix . 'item';
$tblTipoItem = $prefix . 'tipo_item';
$tblUnidadeMedida = $prefix . 'unidade_medida';

// ✅ Conectar ao banco
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            // LISTAR ou BUSCAR POR ID
            if (isset($_GET['seq_item'])) {
                $seq = intval($_GET['seq_item']);
                
                $query = "SELECT i.*, 
                                 t.descricao as tipo_descricao,
                                 u.sigla as unidade_medida_sigla
                          FROM $tblItem i
                          LEFT JOIN $tblTipoItem t ON i.seq_tipo_item = t.seq_tipo_item
                          LEFT JOIN $tblUnidadeMedida u ON i.seq_unidade_medida = u.seq_unidade_medida
                          WHERE i.seq_item = $1";
                
                $result = sql($g_sql, $query, false, [$seq]);
                
                if (!$result) {
                    msg('Erro ao consultar item');
                }
                
                if (pg_num_rows($result) > 0) {
                    $item = pg_fetch_assoc($result);
                    
                    // Converter tipos numéricos
                    $item['seq_item'] = intval($item['seq_item']);
                    $item['seq_tipo_item'] = $item['seq_tipo_item'] ? intval($item['seq_tipo_item']) : null;
                    $item['seq_unidade_medida'] = $item['seq_unidade_medida'] ? intval($item['seq_unidade_medida']) : null;
                    $item['vlr_item'] = floatval($item['vlr_item'] ?? 0);
                    $item['estoque_minimo'] = floatval($item['estoque_minimo'] ?? 0);
                    $item['estoque_maximo'] = floatval($item['estoque_maximo'] ?? 0);
                    
                    echo json_encode(['success' => true, 'data' => $item]);
                } else {
                    msg('Item não encontrado');
                }
            } else {
                // Listar itens
                $where = ['1=1'];
                $params = [];
                $paramCount = 1;
                
                if (isset($_GET['ativo'])) {
                    $where[] = "i.ativo = $" . $paramCount++;
                    $params[] = $_GET['ativo'];
                }
                
                if (isset($_GET['seq_tipo_item']) && !empty($_GET['seq_tipo_item'])) {
                    $where[] = "i.seq_tipo_item = $" . $paramCount++;
                    $params[] = intval($_GET['seq_tipo_item']);
                }
                
                if (isset($_GET['search']) && !empty($_GET['search'])) {
                    $search = strtoupper(trim($_GET['search']));
                    $where[] = "(UPPER(i.codigo) LIKE $" . $paramCount . " OR UPPER(i.descricao) LIKE $" . $paramCount . ")";
                    $params[] = "%$search%";
                    $paramCount++;
                }
                
                $whereClause = implode(' AND ', $where);
                $query = "SELECT i.*, 
                                 t.descricao as tipo_descricao,
                                 u.sigla as unidade_medida_sigla
                          FROM $tblItem i
                          LEFT JOIN $tblTipoItem t ON i.seq_tipo_item = t.seq_tipo_item
                          LEFT JOIN $tblUnidadeMedida u ON i.seq_unidade_medida = u.seq_unidade_medida
                          WHERE $whereClause
                          ORDER BY i.codigo
                          LIMIT 1000";
                
                $result = sql($g_sql, $query, false, $params);
                
                if (!$result) {
                    msg('Erro ao consultar itens');
                }
                
                $itens = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    // Converter tipos numéricos
                    $row['seq_item'] = intval($row['seq_item']);
                    $row['seq_tipo_item'] = $row['seq_tipo_item'] ? intval($row['seq_tipo_item']) : null;
                    $row['seq_unidade_medida'] = $row['seq_unidade_medida'] ? intval($row['seq_unidade_medida']) : null;
                    $row['vlr_item'] = floatval($row['vlr_item'] ?? 0);
                    $row['estoque_minimo'] = floatval($row['estoque_minimo'] ?? 0);
                    $row['estoque_maximo'] = floatval($row['estoque_maximo'] ?? 0);
                    $itens[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $itens]);
            }
            break;
            
        case 'POST':
            // CRIAR NOVO ITEM
            $codigo = strtoupper(trim($input['codigo'] ?? ''));
            $codigo_fabricante = strtoupper(trim($input['codigo_fabricante'] ?? ''));
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $seq_tipo_item = !empty($input['seq_tipo_item']) ? intval($input['seq_tipo_item']) : null;
            $seq_unidade_medida = !empty($input['seq_unidade_medida']) ? intval($input['seq_unidade_medida']) : null;
            $vlr_item = floatval($input['vlr_item'] ?? 0);
            $estoque_minimo = floatval($input['estoque_minimo'] ?? 0);
            $estoque_maximo = floatval($input['estoque_maximo'] ?? 0);
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($codigo) || empty($descricao)) {
                msg('Código e descrição são obrigatórios');
            }
            
            // Verificar duplicidade
            $check = sql($g_sql, "SELECT seq_item FROM $tblItem WHERE codigo = $1", false, [$codigo]);
            if (pg_num_rows($check) > 0) {
                msg('Já existe um item com este código');
            }
            
            $query = "INSERT INTO $tblItem (
                        codigo, codigo_fabricante, descricao, seq_tipo_item, seq_unidade_medida,
                        vlr_item, estoque_minimo, estoque_maximo, ativo, login_inclusao
                      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                      RETURNING seq_item";
            
            $result = sql($g_sql, $query, false, [
                $codigo, $codigo_fabricante, $descricao, $seq_tipo_item, $seq_unidade_medida,
                $vlr_item, $estoque_minimo, $estoque_maximo, $ativo, $login
            ]);
            
            $row = pg_fetch_assoc($result);
            echo json_encode(['success' => true, 'seq_item' => intval($row['seq_item'])]);
            break;
            
        case 'PUT':
            // ATUALIZAR ITEM
            $seq = intval($input['seq_item'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do item inválido');
            }
            
            $codigo = strtoupper(trim($input['codigo'] ?? ''));
            $codigo_fabricante = strtoupper(trim($input['codigo_fabricante'] ?? ''));
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $seq_tipo_item = !empty($input['seq_tipo_item']) ? intval($input['seq_tipo_item']) : null;
            $seq_unidade_medida = !empty($input['seq_unidade_medida']) ? intval($input['seq_unidade_medida']) : null;
            $vlr_item = floatval($input['vlr_item'] ?? 0);
            $estoque_minimo = floatval($input['estoque_minimo'] ?? 0);
            $estoque_maximo = floatval($input['estoque_maximo'] ?? 0);
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($codigo) || empty($descricao)) {
                msg('Código e descrição são obrigatórios');
            }
            
            // Verificar duplicidade
            $check = sql($g_sql, "SELECT seq_item FROM $tblItem WHERE codigo = $1 AND seq_item != $2", false, [$codigo, $seq]);
            if (pg_num_rows($check) > 0) {
                msg('Já existe outro item com este código');
            }
            
            $query = "UPDATE $tblItem SET 
                      codigo = $1, codigo_fabricante = $2, descricao = $3, 
                      seq_tipo_item = $4, seq_unidade_medida = $5,
                      vlr_item = $6, estoque_minimo = $7, estoque_maximo = $8, ativo = $9,
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, 
                      login_alteracao = $10
                      WHERE seq_item = $11";
            
            sql($g_sql, $query, false, [
                $codigo, $codigo_fabricante, $descricao, $seq_tipo_item, $seq_unidade_medida,
                $vlr_item, $estoque_minimo, $estoque_maximo, $ativo, $login, $seq
            ]);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // INATIVAR ITEM
            $seq = intval($input['seq_item'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do item inválido');
            }
            
            $query = "UPDATE $tblItem SET ativo = 'N', 
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, 
                      login_alteracao = $1
                      WHERE seq_item = $2";
            
            sql($g_sql, $query, false, [$login, $seq]);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/itens.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
}