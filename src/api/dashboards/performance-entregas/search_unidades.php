<?php
/**
 * ================================================================
 * API: BUSCAR UNIDADES
 * ================================================================
 * Busca unidades por nome ou sigla
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-entregas/search_unidades.php
 * Body: { search: "texto" }
 * Response: JSON com lista de unidades
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

// ================================================================
// AUTENTICAÇÃO
// ================================================================
$auth = authenticateAndGetUser();
$user = $auth['user'];
$domain = $auth['domain'];

// ================================================================
// RECEBER E PROCESSAR PARÂMETROS
// ================================================================
$input = getRequestInput();
$search = trim($input['search'] ?? '');

// ✅ AJUSTADO: Se busca for vazia, retornar TODAS as unidades (query leve)
// Se tiver menos de 2 caracteres mas não for vazio, retornar erro
if ($search !== '' && strlen($search) < 2) {
    respondJson([
        'success' => false,
        'message' => 'Digite pelo menos 2 caracteres para buscar'
    ]);
}

// ================================================================
// CONECTAR AO BANCO
// ================================================================
$g_sql = connect();

// ================================================================
// BUSCAR UNIDADES
// ================================================================
if ($search === '') {
    // ✅ Busca vazia: retornar TODAS as unidades
    $query = "
        SELECT 
            sigla,
            nome,
            cnpj
        FROM {$domain}_unidade
        ORDER BY sigla
    ";
    $result = sql($g_sql, $query, false, []);
} else {
    // ✅ Busca com termo: filtrar por sigla ou nome
    // ✅ Remover acentos do termo de busca (base não tem acentuação)
    $searchUnaccented = removeAccents($search);
    
    $query = "
        SELECT 
            sigla,
            nome,
            cnpj
        FROM {$domain}_unidade
        WHERE UPPER(sigla) LIKE UPPER($1)
           OR UPPER(nome) LIKE UPPER($2)
        ORDER BY sigla
    ";
    $searchPattern = '%' . $searchUnaccented . '%';
    $result = sql($g_sql, $query, false, [$searchPattern, $searchPattern]);
}

$unidades = [];
while ($row = pg_fetch_assoc($result)) {
    $unidades[] = [
        'sigla' => $row['sigla'],
        'nome' => $row['nome'],
        'cnpj' => $row['cnpj']
    ];
}

// ================================================================
// RESPOSTA JSON
// ================================================================
respondJson([
    'success' => true,
    'unidades' => $unidades,
    'count' => count($unidades)
]);