<?php
/**
 * API ESTOQUE - CRUD DE TIPOS DE ITEM
 * Gerencia cadastro de tipos de item
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();
    
// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($currentUser['domain']) . '_';
$tblTipoItem = $prefix . 'tipo_item';
    
// ✅ CONECTAR AO BANCO
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            if (isset($_GET['seq_tipo_item'])) {
                $seq = intval($_GET['seq_tipo_item']);
                $result = sql($g_sql, "SELECT * FROM $tblTipoItem WHERE seq_tipo_item = $1", false, [$seq]);
                
                if (pg_num_rows($result) > 0) {
                    echo json_encode(['success' => true, 'data' => pg_fetch_assoc($result)]);
                } else {
                    msg('Tipo de item não encontrado');
                }
            } else {
                $where = isset($_GET['ativo']) ? "ativo = '" . $_GET['ativo'] . "'" : "1=1";
                $query = "SELECT * FROM $tblTipoItem WHERE $where ORDER BY descricao";
                
                $result = sql($g_sql, $query, false, []);
                $tipos = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    $tipos[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $tipos]);
            }
            break;
            
        case 'POST':
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($descricao)) {
                msg('Descrição é obrigatória');
            }
            
            $check = sql($g_sql, "SELECT seq_tipo_item FROM $tblTipoItem WHERE descricao = $1", false, [$descricao]);
            if (pg_num_rows($check) > 0) {
                msg('Já existe um tipo de item com esta descrição');
            }
            
            $query = "INSERT INTO $tblTipoItem (descricao, ativo, login_inclusao) 
                      VALUES ($1, $2, $3) RETURNING seq_tipo_item";
            
            $result = sql($g_sql, $query, false, [$descricao, $ativo, $currentUser['username']]);
            $row = pg_fetch_assoc($result);
            
            echo json_encode(['success' => true, 'seq_tipo_item' => $row['seq_tipo_item']]);
            break;
            
        case 'PUT':
            $seq = intval($input['seq_tipo_item'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do tipo de item inválido');
            }
            
            $descricao = strtoupper(trim($input['descricao'] ?? ''));
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($descricao)) {
                msg('Descrição é obrigatória');
            }
            
            $check = sql($g_sql, "SELECT seq_tipo_item FROM $tblTipoItem WHERE descricao = $1 AND seq_tipo_item != $2", 
                        false, [$descricao, $seq]);
            if (pg_num_rows($check) > 0) {
                msg('Já existe outro tipo de item com esta descrição');
            }
            
            $query = "UPDATE $tblTipoItem SET 
                      descricao = $1, ativo = $2,
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $3
                      WHERE seq_tipo_item = $4";
            
            sql($g_sql, $query, false, [$descricao, $ativo, $currentUser['username'], $seq]);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            $seq = intval($input['seq_tipo_item'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do tipo de item inválido');
            }
            
            $query = "UPDATE $tblTipoItem SET ativo = 'N', 
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $1
                      WHERE seq_tipo_item = $2";
            
            sql($g_sql, $query, false, [$currentUser['username'], $seq]);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            msg('Método não permitido', 405);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/tipos_item.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}