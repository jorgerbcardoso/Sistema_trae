<?php
/**
 * API de Gerenciamento de Setores
 * GET    /api/admin/setores.php - Listar setores
 * POST   /api/admin/setores.php - Criar novo setor
 * PUT    /api/admin/setores.php - Atualizar setor
 * DELETE /api/admin/setores.php - Excluir setor
 * 
 * Headers: Authorization: Bearer <token>
 * 
 * @author Sistema PRESTO
 * @date 2026-02-25
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Domain, X-Unidade');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

// ✅ Verificar autenticação
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

try {
    $currentUser = getCurrentUser();
    $domain = $currentUser['domain'];
    
    // ✅ Conectar ao banco
    $g_sql = connect();
    
    // Nome da tabela de setores com prefixo de domínio
    $tableSetores = strtolower($domain) . '_setores';
    
    switch ($method) {
        case 'GET':
            // ============================================
            // LISTAR SETORES
            // ============================================
            $query = "
                SELECT nro_setor, descricao, efetua_compras
                FROM $tableSetores
                ORDER BY nro_setor
            ";
            
            $result = sql($query, [], $g_sql);
            
            $setores = [];
            while ($row = pg_fetch_assoc($result)) {
                $setores[] = [
                    'nro_setor' => (int)$row['nro_setor'],
                    'descricao' => $row['descricao'],
                    'efetua_compras' => ($row['efetua_compras'] === 't' || $row['efetua_compras'] === true)
                ];
            }
            
            echo json_encode(['success' => true, 'setores' => $setores]);
            break;
            
        case 'POST':
            // ============================================
            // CRIAR NOVO SETOR
            // ============================================
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['descricao'])) {
                msg('Descrição é obrigatória', 'error', 400);
            }
            
            // Obter próximo número de setor
            $queryMax = "SELECT COALESCE(MAX(nro_setor), 0) + 1 as proximo FROM $tableSetores";
            $resultMax = sql($queryMax, [], $g_sql);
            $rowMax = pg_fetch_assoc($resultMax);
            $nroSetor = (int)$rowMax['proximo'];
            
            $descricao = strtoupper(trim($data['descricao']));
            $efetuaCompras = isset($data['efetua_compras']) ? (bool)$data['efetua_compras'] : false;
            
            // Verificar se descrição já existe
            $queryCheck = "SELECT nro_setor FROM $tableSetores WHERE UPPER(descricao) = $1";
            $resultCheck = sql($queryCheck, [$descricao], $g_sql);
            
            if (pg_num_rows($resultCheck) > 0) {
                msg('Já existe um setor com esta descrição', 'error', 409);
            }
            
            $query = "
                INSERT INTO $tableSetores (nro_setor, descricao, efetua_compras)
                VALUES ($1, $2, $3)
                RETURNING nro_setor, descricao, efetua_compras
            ";
            
            $result = sql($query, [$nroSetor, $descricao, $efetuaCompras ? 'true' : 'false'], $g_sql);
            $row = pg_fetch_assoc($result);
            
            msg('Setor criado com sucesso', 'success', 200, [
                'setor' => [
                    'nro_setor' => (int)$row['nro_setor'],
                    'descricao' => $row['descricao'],
                    'efetua_compras' => ($row['efetua_compras'] === 't' || $row['efetua_compras'] === true)
                ]
            ]);
            break;
            
        case 'PUT':
            // ============================================
            // ATUALIZAR SETOR
            // ============================================
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['nro_setor'])) {
                msg('Número do setor é obrigatório', 'error', 400);
            }
            
            if (empty($data['descricao'])) {
                msg('Descrição é obrigatória', 'error', 400);
            }
            
            // Verificar se é o setor GERAL (nro_setor = 1)
            if ((int)$data['nro_setor'] === 1) {
                msg('O setor GERAL não pode ser editado', 'error', 400);
            }
            
            $nroSetor = (int)$data['nro_setor'];
            $descricao = strtoupper(trim($data['descricao']));
            $efetuaCompras = isset($data['efetua_compras']) ? (bool)$data['efetua_compras'] : false;
            
            // Verificar se descrição já existe em outro setor
            $queryCheck = "SELECT nro_setor FROM $tableSetores WHERE UPPER(descricao) = $1 AND nro_setor != $2";
            $resultCheck = sql($queryCheck, [$descricao, $nroSetor], $g_sql);
            
            if (pg_num_rows($resultCheck) > 0) {
                msg('Já existe outro setor com esta descrição', 'error', 409);
            }
            
            $query = "
                UPDATE $tableSetores
                SET descricao = $1, efetua_compras = $2
                WHERE nro_setor = $3
                RETURNING nro_setor, descricao, efetua_compras
            ";
            
            $result = sql($query, [$descricao, $efetuaCompras ? 'true' : 'false', $nroSetor], $g_sql);
            
            if (pg_num_rows($result) === 0) {
                msg('Setor não encontrado', 'error', 404);
            }
            
            $row = pg_fetch_assoc($result);
            
            msg('Setor atualizado com sucesso', 'success', 200, [
                'setor' => [
                    'nro_setor' => (int)$row['nro_setor'],
                    'descricao' => $row['descricao'],
                    'efetua_compras' => ($row['efetua_compras'] === 't' || $row['efetua_compras'] === true)
                ]
            ]);
            break;
            
        case 'DELETE':
            // ============================================
            // EXCLUIR SETOR
            // ============================================
            $nroSetor = isset($_GET['nro_setor']) ? (int)$_GET['nro_setor'] : 0;
            
            if ($nroSetor === 0) {
                msg('Número do setor é obrigatório', 'error', 400);
            }
            
            // Verificar se é o setor GERAL (nro_setor = 1)
            if ($nroSetor === 1) {
                msg('O setor GERAL não pode ser excluído', 'error', 400);
            }
            
            // Verificar se há usuários vinculados
            $queryCheck = "SELECT COUNT(*) as total FROM users WHERE nro_setor = $1 AND domain = $2";
            $resultCheck = sql($queryCheck, [$nroSetor, $domain], $g_sql);
            $rowCheck = pg_fetch_assoc($resultCheck);
            
            if ((int)$rowCheck['total'] > 0) {
                msg('Não é possível excluir o setor. Existem ' . $rowCheck['total'] . ' usuário(s) vinculado(s) a este setor.', 'error', 400);
            }
            
            $query = "DELETE FROM $tableSetores WHERE nro_setor = $1";
            sql($query, [$nroSetor], $g_sql);
            
            msg('Setor excluído com sucesso', 'success', 200);
            break;
            
        default:
            msg('Método não permitido', 'error', 405);
            break;
    }
} catch (Exception $e) {
    error_log('[SETORES-API] Erro: ' . $e->getMessage());
    msg('Erro ao processar requisição: ' . $e->getMessage(), 'error', 500);
}