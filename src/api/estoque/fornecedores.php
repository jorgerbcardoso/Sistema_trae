<?php
/**
 * API ESTOQUE - FORNECEDORES
 * Gerencia busca de fornecedores para entradas de estoque
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
    
    if ($method !== 'GET') {
        msg('Método não permitido', 405);
    }
    
    // ===============================================
    // BUSCAR POR CNPJ (para importação de NFe)
    // ===============================================
    if (isset($_GET['cnpj']) && !empty($_GET['cnpj'])) {
        $cnpj = trim($_GET['cnpj']);
        
        error_log("🔍 Buscando fornecedor por CNPJ: " . $cnpj);
        
        $query = "SELECT * FROM $tblFornecedor WHERE cnpj = $1 AND ativo = 'S' LIMIT 1";
        $result = sql($query, [$cnpj], $g_sql);
        
        if (pg_num_rows($result) > 0) {
            $fornecedor = pg_fetch_assoc($result);
            error_log("✅ Fornecedor encontrado: " . $fornecedor['nome']);
            echo json_encode(['success' => true, 'data' => $fornecedor]);
        } else {
            error_log("❌ Fornecedor não encontrado com CNPJ: " . $cnpj);
            echo json_encode(['success' => false, 'data' => null, 'message' => 'Fornecedor não encontrado']);
        }
        exit;
    }
    
    // ===============================================
    // BUSCAR POR SEQ_FORNECEDOR
    // ===============================================
    if (isset($_GET['seq_fornecedor'])) {
        $seq = intval($_GET['seq_fornecedor']);
        
        error_log("🔍 Buscando fornecedor por seq_fornecedor: " . $seq);
        
        $query = "SELECT * FROM $tblFornecedor WHERE seq_fornecedor = $1";
        $result = sql($query, [$seq], $g_sql);
        
        if (pg_num_rows($result) > 0) {
            $fornecedor = pg_fetch_assoc($result);
            error_log("✅ Fornecedor encontrado: " . $fornecedor['nome']);
            echo json_encode(['success' => true, 'data' => $fornecedor]);
        } else {
            error_log("❌ Fornecedor não encontrado com seq_fornecedor: " . $seq);
            msg('Fornecedor não encontrado');
        }
        exit;
    }
    
    // ===============================================
    // LISTAR TODOS COM FILTROS
    // ===============================================
    $where = ['1=1'];
    $params = [];
    $paramCount = 1;
    
    // Filtro por ativo
    if (isset($_GET['ativo'])) {
        $where[] = "ativo = $" . $paramCount++;
        $params[] = $_GET['ativo'];
    } else {
        // Por padrão, só ativos
        $where[] = "ativo = $" . $paramCount++;
        $params[] = 'S';
    }
    
    // Filtro de busca (nome ou CNPJ)
    if (isset($_GET['search']) && !empty($_GET['search'])) {
        $search = strtoupper(trim($_GET['search']));
        $where[] = "(UPPER(nome) LIKE $" . $paramCount . " OR cnpj LIKE $" . $paramCount . ")";
        $params[] = "%$search%";
        $paramCount++;
        
        error_log("🔍 Buscando fornecedores com filtro: " . $search);
    }
    
    $whereClause = implode(' AND ', $where);
    $query = "SELECT * FROM $tblFornecedor WHERE $whereClause ORDER BY nome LIMIT 100";
    
    error_log("🔍 Query listar fornecedores: " . $query);
    error_log("🔍 Params: " . json_encode($params));
    
    $result = sql($query, $params, $g_sql);
    $fornecedores = [];
    
    while ($row = pg_fetch_assoc($result)) {
        $fornecedores[] = $row;
    }
    
    error_log("✅ Fornecedores encontrados: " . count($fornecedores));
    
    echo json_encode(['success' => true, 'data' => $fornecedores]);
    
} catch (Exception $e) {
    error_log("❌ Erro em /api/estoque/fornecedores.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
