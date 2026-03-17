<?php
/**
 * ================================================================
 * API: BUSCAR UNIDADES (COM FILTRO DE PERMISSÃO)
 * ================================================================
 * Busca unidades respeitando a permissão do usuário:
 * - Usuário MTZ: vê todas as unidades
 * - Usuário não-MTZ: vê apenas sua própria unidade
 *
 * POST /api/estoque/search_unidades_filtradas.php
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
// 🔒 FILTRO DE PERMISSÃO
// ================================================================
$userUnidade = $user['unidade'] ?? '';
$isMTZ = ($userUnidade === 'MTZ');

// ================================================================
// BUSCAR UNIDADES
// ================================================================
if ($isMTZ) {
    // ✅ Usuário MTZ: vê TODAS as unidades
    if ($search === '') {
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
} else {
    // 🔒 Usuário não-MTZ: vê APENAS sua unidade
    $query = "
        SELECT 
            sigla,
            nome,
            cnpj
        FROM {$domain}_unidade
        WHERE sigla = $1
        ORDER BY sigla
    ";
    $result = sql($g_sql, $query, false, [$userUnidade]);
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
    'count' => count($unidades),
    'is_mtz' => $isMTZ
]);
