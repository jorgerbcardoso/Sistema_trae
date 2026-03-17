<?php
/**
 * API COMPRAS - FORNECEDORES
 * Gerencia cadastro de fornecedores
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($currentUser['domain']);
$tblFornecedor = $prefix . '_fornecedor';

// ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            if (isset($_GET['seq_fornecedor'])) {
                $seq = intval($_GET['seq_fornecedor']);
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql("SELECT * FROM $tblFornecedor WHERE seq_fornecedor = $1", [$seq], $g_sql);
                
                if (pg_num_rows($result) > 0) {
                    echo json_encode(['success' => true, 'data' => pg_fetch_assoc($result)]);
                } else {
                    msg('Fornecedor não encontrado');
                }
            } else {
                $where = ['1=1'];
                $params = [];
                $paramCount = 1;
                
                if (isset($_GET['ativo'])) {
                    $where[] = "ativo = $" . $paramCount++;
                    $params[] = $_GET['ativo'];
                }
                
                if (isset($_GET['search']) && !empty($_GET['search'])) {
                    $search = strtoupper(trim($_GET['search']));
                    $where[] = "(UPPER(nome) LIKE $" . $paramCount . " OR cnpj LIKE $" . $paramCount . ")";
                    $params[] = "%$search%";
                    $paramCount++;
                }
                
                $whereClause = implode(' AND ', $where);
                $query = "SELECT * FROM $tblFornecedor WHERE $whereClause ORDER BY nome LIMIT 100";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql($query, $params, $g_sql);
                $fornecedores = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    $fornecedores[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $fornecedores]);
            }
            break;
            
        case 'POST':
            $cnpj = trim($input['cnpj'] ?? '');
            $nome = strtoupper(trim($input['nome'] ?? ''));
            $endereco = strtoupper(trim($input['endereco'] ?? ''));
            $bairro = strtoupper(trim($input['bairro'] ?? ''));
            $seq_cidade = !empty($input['seq_cidade']) ? intval($input['seq_cidade']) : null;
            $email = trim($input['email'] ?? '');
            $telefone = trim($input['telefone'] ?? '');
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($cnpj) || empty($nome)) {
                msg('CNPJ e nome são obrigatórios');
            }
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $check = sql("SELECT seq_fornecedor FROM $tblFornecedor WHERE cnpj = $1", [$cnpj], $g_sql);
            if (pg_num_rows($check) > 0) {
                msg('Já existe um fornecedor com este CNPJ');
            }
            
            $query = "INSERT INTO $tblFornecedor (cnpj, nome, endereco, bairro, seq_cidade, email, telefone, ativo, login_inclusao) 
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING seq_fornecedor";
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $result = sql($query, [
                $cnpj, $nome, $endereco, $bairro, $seq_cidade, $email, $telefone, $ativo, $currentUser['username']
            ], $g_sql);
            $row = pg_fetch_assoc($result);
            
            echo json_encode(['success' => true, 'seq_fornecedor' => $row['seq_fornecedor']]);
            break;
            
        case 'PUT':
            $seq = intval($input['seq_fornecedor'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do fornecedor inválido');
            }
            
            $cnpj = trim($input['cnpj'] ?? '');
            $nome = strtoupper(trim($input['nome'] ?? ''));
            $endereco = strtoupper(trim($input['endereco'] ?? ''));
            $bairro = strtoupper(trim($input['bairro'] ?? ''));
            $seq_cidade = !empty($input['seq_cidade']) ? intval($input['seq_cidade']) : null;
            $email = trim($input['email'] ?? '');
            $telefone = trim($input['telefone'] ?? '');
            $ativo = $input['ativo'] ?? 'S';
            
            if (empty($cnpj) || empty($nome)) {
                msg('CNPJ e nome são obrigatórios');
            }
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $check = sql("SELECT seq_fornecedor FROM $tblFornecedor WHERE cnpj = $1 AND seq_fornecedor != $2", 
                        [$cnpj, $seq], $g_sql);
            if (pg_num_rows($check) > 0) {
                msg('Já existe outro fornecedor com este CNPJ');
            }
            
            $query = "UPDATE $tblFornecedor SET 
                      cnpj = $1, nome = $2, endereco = $3, bairro = $4, seq_cidade = $5, email = $6, telefone = $7, ativo = $8,
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $9
                      WHERE seq_fornecedor = $10";
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            sql($query, [
                $cnpj, $nome, $endereco, $bairro, $seq_cidade, $email, $telefone, $ativo, $currentUser['username'], $seq
            ], $g_sql);
            
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            $seq = intval($input['seq_fornecedor'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID do fornecedor inválido');
            }
            
            $query = "UPDATE $tblFornecedor SET ativo = 'N', 
                      data_alteracao = CURRENT_DATE, hora_alteracao = CURRENT_TIME, login_alteracao = $1
                      WHERE seq_fornecedor = $2";
            
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            sql($query, [$currentUser['username'], $seq], $g_sql);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            msg('Método não permitido', 405);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/compras/fornecedores.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
