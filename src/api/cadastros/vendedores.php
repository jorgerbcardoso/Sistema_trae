<?php
/**
 * ============================================
 * API: Vendedores
 * ============================================
 * Gerenciamento de vendedores e suas carteiras de clientes
 * 
 * ROTAS:
 * - GET /              → Listar todos os vendedores
 * - GET /?action=clientes&login=X → Listar clientes de um vendedor
 * - POST /?action=update → Atualizar vendedor
 * ============================================
 */

require_once '/var/www/html/sistema/api/config.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

// ✅ AUTENTICAÇÃO OBRIGATÓRIA
requireAuth();
$currentUser = getCurrentUser();

$username = $currentUser['username'];
$dominio = strtolower($currentUser['domain']);
$prefix = $dominio . '_';

// ✅ CRIAR CONEXÃO GLOBAL
global $g_sql;
$g_sql = getDBConnection();

if (!$g_sql) {
    msg('Erro ao conectar ao banco de dados', 'error', 500);
}

// Definir tabelas com prefixo do domínio
$tbl_vendedor = $prefix . 'vendedor';
$tbl_vendedor_cliente = $prefix . 'vendedor_cliente';
$tbl_cliente = $prefix . 'cliente';

// ============================================
// ROTEAMENTO
// ============================================

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'clientes') {
                // Listar clientes de um vendedor específico
                listarClientesVendedor($g_sql, $tbl_vendedor_cliente, $tbl_cliente, $dominio);
            } else {
                // Listar todos os vendedores
                listarVendedores($g_sql, $tbl_vendedor, $tbl_vendedor_cliente, $dominio);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!$data) {
                msg('Dados inválidos', 'error', 400);
            }

            $postAction = $data['action'] ?? '';

            if ($postAction === 'update') {
                atualizarVendedor($g_sql, $tbl_vendedor, $data, $dominio);
            } else {
                msg('Ação não especificada', 'error', 400);
            }
            break;

        default:
            msg('Método não permitido', 'error', 405);
            break;
    }
} catch (Exception $e) {
    error_log("❌ ERRO em vendedores.php: " . $e->getMessage());
    error_log("   Arquivo: " . $e->getFile());
    error_log("   Linha: " . $e->getLine());
    msg('Erro interno do servidor', 'error', 500);
}

// ============================================
// FUNÇÕES
// ============================================

/**
 * Listar todos os vendedores com quantidade de clientes
 */
function listarVendedores($g_sql, $tbl_vendedor, $tbl_vendedor_cliente, $domain) {
    // ✅ Verificar se tabela existe
    $checkTable = "SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
    )";
    $resultCheck = sql($checkTable, [$tbl_vendedor], $g_sql);
    $tableExists = pg_fetch_result($resultCheck, 0, 0) === 't';
    
    if (!$tableExists) {
        // Tabela não existe - retornar array vazio
        echo json_encode([
            'success' => true,
            'vendedores' => []
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // ✅ Query com LEFT JOIN para contar clientes por vendedor
    $query = "
        SELECT 
            v.login AS codigo,
            v.nome,
            v.tele_vendas AS tele_venda,
            COALESCE(COUNT(DISTINCT vc.cnpj), 0)::integer AS qtd_clientes
        FROM {$tbl_vendedor} v
        LEFT JOIN {$tbl_vendedor_cliente} vc ON vc.login = v.login
        GROUP BY v.login, v.nome, v.tele_vendas
        ORDER BY v.nome
    ";

    $result = sql($query, [], $g_sql);

    if (!$result) {
        msg('Erro ao buscar vendedores', 'error', 500);
    }

    $vendedores = [];
    while ($row = pg_fetch_assoc($result)) {
        $vendedores[] = [
            'codigo' => strtolower($row['codigo']), // ✅ Login em minúsculas
            'nome' => $row['nome'],
            'tele_venda' => $row['tele_venda'] === true || $row['tele_venda'] === 't',
            'qtd_clientes' => (int)$row['qtd_clientes']
        ];
    }

    echo json_encode([
        'success' => true,
        'vendedores' => $vendedores
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Listar clientes de um vendedor específico
 */
function listarClientesVendedor($g_sql, $tbl_vendedor_cliente, $tbl_cliente, $domain) {
    $login = $_GET['login'] ?? '';
    $login = strtolower(trim($login));

    if (empty($login)) {
        msg('Login do vendedor não informado', 'error', 400);
    }

    // ✅ Query com JOINs para buscar clientes do vendedor
    $query = "
        SELECT 
            c.cnpj,
            c.nome,
            COALESCE(cid.nome, '') AS cidade,
            COALESCE(cid.uf, '') AS uf,
            c.data_ult_mvto
        FROM {$tbl_vendedor_cliente} vc
        INNER JOIN {$tbl_cliente} c ON c.cnpj = vc.cnpj
        LEFT JOIN cidade cid ON cid.seq_cidade = c.seq_cidade
        WHERE vc.login = $1
        ORDER BY c.nome
    ";

    $result = sql($query, [strtolower($login)], $g_sql);

    if (!$result) {
        msg('Erro ao buscar clientes', 'error', 500);
    }

    $clientes = [];
    while ($row = pg_fetch_assoc($result)) {
        $clientes[] = [
            'cnpj' => formatarCNPJ($row['cnpj']),
            'nome' => $row['nome'],
            'cidade' => $row['cidade'],
            'uf' => $row['uf'],
            'data_ult_mvto' => $row['data_ult_mvto'] // Formato YYYY-MM-DD
        ];
    }

    echo json_encode([
        'success' => true,
        'clientes' => $clientes
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Atualizar dados de um vendedor
 */
function atualizarVendedor($g_sql, $tbl_vendedor, $data, $domain) {
    // Validações
    if (empty($data['codigo'])) {
        msg('Login do vendedor não informado', 'error', 400);
    }

    if (empty($data['nome'])) {
        msg('Nome do vendedor é obrigatório', 'error', 400);
    }

    $login = strtolower(trim($data['codigo'])); // ✅ Login em minúsculas
    $nome = mb_strtoupper(trim($data['nome']), 'UTF-8'); // ✅ Nome em MAIÚSCULAS
    $tele_venda = isset($data['tele_venda']) && $data['tele_venda'] === true;

    // ✅ Verificar se o vendedor existe
    $query_check = "SELECT login FROM {$tbl_vendedor} WHERE login = $1";
    $result_check = sql($query_check, [$login], $g_sql);

    if (!$result_check || pg_num_rows($result_check) === 0) {
        msg('Vendedor não encontrado', 'error', 404);
    }

    // ✅ Atualizar vendedor
    $query = "
        UPDATE {$tbl_vendedor}
        SET 
            nome = $1,
            tele_vendas = $2
        WHERE login = $3
    ";

    $result = sql($query, [
        $nome,
        $tele_venda, // PostgreSQL aceita boolean diretamente
        $login
    ], $g_sql);

    if ($result) {
        msg('Vendedor atualizado com sucesso', 'success');
    } else {
        msg('Erro ao atualizar vendedor', 'error', 500);
    }
}

/**
 * Formatar CNPJ no padrão XX.XXX.XXX/XXXX-XX
 */
function formatarCNPJ($cnpj) {
    // Remove caracteres não numéricos
    $cnpj = preg_replace('/[^0-9]/', '', $cnpj);
    
    // Formata o CNPJ
    if (strlen($cnpj) === 14) {
        return substr($cnpj, 0, 2) . '.' .
               substr($cnpj, 2, 3) . '.' .
               substr($cnpj, 5, 3) . '/' .
               substr($cnpj, 8, 4) . '-' .
               substr($cnpj, 12, 2);
    }
    
    return $cnpj; // Retorna sem formatação se não tiver 14 dígitos
}
