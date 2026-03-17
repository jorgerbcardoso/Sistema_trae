<?php
/**
 * API: Listar Fornecedores
 * GET /api/compras/fornecedores/list.php?search=&cidade=&page=1&limit=200
 * 
 * Retorna lista de fornecedores com filtros e paginação (limite máximo: 200 registros)
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('GET');

try {
    // Obter usuário autenticado
    $user = getCurrentUser();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'NÃO AUTENTICADO'
        ]);
        exit();
    }

    $domain = $user['domain'];
    
    // ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
    $prefix = strtolower($domain);
    
    // Parâmetros de busca
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $cidadeFilter = isset($_GET['cidade']) ? trim($_GET['cidade']) : '';
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? min(200, max(1, (int)$_GET['limit'])) : 200;
    $offset = ($page - 1) * $limit;

    global $g_sql;

    // Query base
    $whereConditions = [];
    $params = [];
    $paramCount = 1;

    // Filtro por nome ou CNPJ
    if (!empty($search)) {
        $whereConditions[] = "(f.nome ILIKE $" . $paramCount . " OR f.cnpj ILIKE $" . $paramCount . ")";
        $params[] = "%$search%";
        $paramCount++;
    }

    // Filtro por cidade
    if (!empty($cidadeFilter)) {
        $whereConditions[] = "c.nome ILIKE $" . $paramCount;
        $params[] = "%$cidadeFilter%";
        $paramCount++;
    }

    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    // Buscar total de registros
    $countQuery = "
        SELECT COUNT(*) as total
        FROM {$prefix}_fornecedor f
        LEFT JOIN cidade c ON f.seq_cidade = c.seq_cidade
        $whereClause
    ";
    
    // ✅ USAR PADRÃO CORRETO: sql($query, $params, $conn)
    $countResult = sql($countQuery, $params, $g_sql);
    $totalRow = pg_fetch_assoc($countResult);
    $total = (int)$totalRow['total'];

    // Buscar registros com paginação
    $query = "
        SELECT 
            f.seq_fornecedor,
            f.cnpj,
            f.nome,
            f.endereco,
            f.bairro,
            f.seq_cidade,
            f.email,
            f.telefone,
            f.ativo,
            f.data_inclusao,
            f.hora_inclusao,
            f.login_inclusao,
            f.data_alteracao,
            f.hora_alteracao,
            f.login_alteracao,
            c.nome as cidade_nome,
            c.uf as cidade_uf
        FROM {$prefix}_fornecedor f
        LEFT JOIN cidade c ON f.seq_cidade = c.seq_cidade
        $whereClause
        ORDER BY f.nome
        LIMIT $" . $paramCount . " OFFSET $" . ($paramCount + 1) . "
    ";
    
    $params[] = $limit;
    $params[] = $offset;
    
    // ✅ USAR PADRÃO CORRETO: sql($query, $params, $conn)
    $result = sql($query, $params, $g_sql);
    
    $fornecedores = [];
    while ($row = pg_fetch_assoc($result)) {
        $fornecedores[] = [
            'seq_fornecedor' => (int)$row['seq_fornecedor'],
            'cnpj' => $row['cnpj'],
            'nome' => $row['nome'],
            'endereco' => $row['endereco'],
            'bairro' => $row['bairro'],
            'seq_cidade' => $row['seq_cidade'] ? (int)$row['seq_cidade'] : null,
            'cidade_nome' => $row['cidade_nome'],
            'cidade_uf' => $row['cidade_uf'],
            'email' => $row['email'],
            'telefone' => $row['telefone'],
            'ativo' => $row['ativo'],
            'data_inclusao' => $row['data_inclusao'],
            'hora_inclusao' => substr($row['hora_inclusao'], 0, 5),
            'login_inclusao' => $row['login_inclusao'],
            'data_alteracao' => $row['data_alteracao'],
            'hora_alteracao' => $row['hora_alteracao'] ? substr($row['hora_alteracao'], 0, 5) : null,
            'login_alteracao' => $row['login_alteracao']
        ];
    }

    echo json_encode([
        'success' => true,
        'fornecedores' => $fornecedores,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => ceil($total / $limit)
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao listar fornecedores: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO LISTAR FORNECEDORES',
        'error' => $e->getMessage()
    ]);
}