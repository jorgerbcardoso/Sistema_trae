<?php
/**
 * ================================================================
 * API: BUSCAR UNIDADES (SEM FILTRO DE PERMISSÃO)
 * ================================================================
 * Busca TODAS as unidades do domínio
 * NÃO aplica regra MTZ - retorna todas as unidades sempre
 * 
 * Usado em:
 * - Menu principal (troca de unidade)
 * - Cadastros gerais
 * - Qualquer lugar que precise listar TODAS as unidades
 *
 * POST /api/search_unidades.php
 * Body: { search: "texto" }
 * Response: JSON com lista de unidades
 * ================================================================
 */

require_once '/var/www/html/sistema/api/config.php';

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

// ================================================================
// CONECTAR AO BANCO
// ================================================================
global $g_sql;
$g_sql = connect();

// ================================================================
// BUSCAR UNIDADES (TODAS - SEM FILTRO MTZ)
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
    $result = pg_query($g_sql, $query);
} else {
    // ✅ Busca com termo: filtrar por sigla ou nome
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
    $result = pg_query_params($g_sql, $query, [$searchPattern, $searchPattern]);
}

if (!$result) {
    respondJson([
        'success' => false,
        'message' => 'Erro ao buscar unidades: ' . pg_last_error($g_sql)
    ]);
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
