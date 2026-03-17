<?php
/**
 * API: Buscar Cidades
 * GET /api/shared/cidades.php?search=SAO&uf=SP
 * 
 * Retorna lista de cidades para autocomplete
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

    // Parâmetros de busca
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $uf = isset($_GET['uf']) ? strtoupper(trim($_GET['uf'])) : '';
    $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 50;

    global $g_sql;

    // Query base
    $whereConditions = [];
    $params = [];
    $paramCount = 1;

    // Filtro por nome
    if (!empty($search)) {
        $whereConditions[] = "nome ILIKE $" . $paramCount;
        $params[] = "%$search%";
        $paramCount++;
    }

    // Filtro por UF
    if (!empty($uf)) {
        $whereConditions[] = "uf = $" . $paramCount;
        $params[] = $uf;
        $paramCount++;
    }

    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    // Buscar cidades
    $query = "
        SELECT 
            seq_cidade,
            nome,
            uf,
            codigo_ibge
        FROM cidade
        $whereClause
        ORDER BY nome
        LIMIT $" . $paramCount . "
    ";
    
    $params[] = $limit;
    
    // ✅ PADRÃO CORRETO: sql($query, $params, $conn)
    $result = sql($query, $params, $g_sql);
    
    $cidades = [];
    while ($row = pg_fetch_assoc($result)) {
        $cidades[] = [
            'seq_cidade' => (int)$row['seq_cidade'],
            'nome' => $row['nome'],
            'uf' => $row['uf'],
            'codigo_ibge' => (int)$row['codigo_ibge'],
            'label' => $row['nome'] . ' - ' . $row['uf']
        ];
    }

    echo json_encode([
        'success' => true,
        'cidades' => $cidades,
        'total' => count($cidades)
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao buscar cidades: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO BUSCAR CIDADES',
        'error' => $e->getMessage()
    ]);
}