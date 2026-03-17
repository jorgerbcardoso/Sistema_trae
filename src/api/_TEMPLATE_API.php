<?php
/**
 * ================================================================
 * 📋 TEMPLATE PADRÃO - APIS DO SISTEMA PRESTO
 * ================================================================
 * 
 * ⚠️ REGRAS OBRIGATÓRIAS PARA TODAS AS APIs:
 * 
 * 1. ✅ USAR APENAS config.php (NUNCA database.php, auth.php, utils.php)
 * 2. ✅ USAR APENAS connect() para conexão PostgreSQL
 * 3. ✅ USAR APENAS sql() para queries (NUNCA pg_query, mysqli, etc)
 * 4. ✅ USAR msg() para mensagens que devem virar toast no frontend
 * 5. ✅ Headers CORS obrigatórios no início
 * 6. ✅ Tratar OPTIONS request
 * 7. ✅ Validar domínio com preg_match
 * 8. ✅ Usar prepared statements via sql()
 * 
 * ⚠️ IMPORTANTE: msg() SEMPRE GERA TOAST NO FRONTEND
 * - O sistema possui interceptação automática via apiFetch()
 * - msg() MATA O SCRIPT automaticamente
 * - NUNCA usar msg() em APIs de export DEPOIS de enviar headers
 * 
 * ================================================================
 * PADRÃO DE IMPORTS:
 * ================================================================
 * 
 * ✅ CORRETO:
 * require_once __DIR__ . '/../config.php';
 * 
 * ❌ ERRADO:
 * require_once __DIR__ . '/../config/database.php';
 * require_once __DIR__ . '/../config/auth.php';
 * require_once __DIR__ . '/../utils/functions.php';
 * 
 * ================================================================
 * PADRÃO DE CONEXÃO E QUERIES:
 * ================================================================
 * 
 * ✅ CORRETO:
 * $dominio = strtolower($domain);
 * $g_sql = connect();
 * $query = "SELECT * FROM {$dominio}_tabela WHERE campo = $1";
 * $result = sql($g_sql, $query, false, [$valor]);
 * 
 * ❌ ERRADO:
 * $conn = getDBConnection();
 * $conn = getDatabaseConnection();
 * $result = pg_query($conn, $query);
 * $result = mysqli_query($conn, $query);
 * 
 * ================================================================
 */

require_once __DIR__ . '/../config.php';

// ================================================================
// HEADERS CORS (OBRIGATÓRIO)
// ================================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
validateRequestMethod('POST'); // ou 'GET'

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

// Exemplo de parâmetros:
$periodo = $input['periodo'] ?? 7;
$filtros = $input['filters'] ?? [];
$unidadeDestino = $input['unidadeDestino'] ?? [];
$cnpjPagador = $input['cnpjPagador'] ?? null;

// ================================================================
// VALIDAÇÕES
// ================================================================
if (!in_array($periodo, [7, 15, 30])) {
    msg('Período inválido. Use 7, 15 ou 30 dias.', 'error');
    // ☝️ msg() com 'error' MATA O SCRIPT e EXIBE TOAST no frontend
}

// ================================================================
// VERIFICAR SE DEVE USAR DADOS MOCKADOS
// ================================================================
if (shouldUseMockData($domain)) {
    $mockData = getMockData($periodo);
    respondJson([
        'success' => true,
        'data' => $mockData
    ]);
    exit;
}

// ================================================================
// CONECTAR AO BANCO (apenas se não for mock)
// ================================================================
$conn = connect();

// ================================================================
// VALIDAR DOMÍNIO (segurança contra SQL injection)
// ================================================================
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    msg('Domínio inválido', 'error');
}

// ================================================================
// VERIFICAR SE A TABELA EXISTE
// ================================================================
$checkTableQuery = "SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = '{$domain}_cte'
)";
$checkResult = pg_query($conn, $checkTableQuery);
$tableExists = pg_fetch_result($checkResult, 0, 0);

if (!$tableExists) {
    msg("Tabela {$domain}_cte não encontrada no banco de dados", 'error');
}

// ================================================================
// CONSTRUIR QUERY COM PREPARED STATEMENTS
// ================================================================
$params = [];
$paramIndex = 1;
$whereConditions = ["status <> 'C'"]; // Status diferente de Cancelado

// ✅ FILTRO: Unidades de Destino
if (!empty($unidadeDestino) && is_array($unidadeDestino)) {
    $placeholders = [];
    foreach ($unidadeDestino as $sigla) {
        $placeholders[] = "$" . $paramIndex;
        $params[] = $sigla;
        $paramIndex++;
    }
    $whereConditions[] = "sigla_dest IN (" . implode(',', $placeholders) . ")";
}

// ✅ FILTRO: CNPJ Pagador
if ($cnpjPagador) {
    $whereConditions[] = "cnpj_pag = $" . $paramIndex;
    $params[] = $cnpjPagador;
    $paramIndex++;
}

$whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

// ================================================================
// EXECUTAR QUERY
// ================================================================
$query = "
    SELECT 
        nro_cte,
        data_emissao,
        data_prev_ent,
        data_entrega
    FROM {$domain}_cte
    $whereClause
    ORDER BY data_emissao DESC
    LIMIT 100
";

// ✅ USAR pg_query_params para segurança (prepared statement)
if (count($params) > 0) {
    $result = pg_query_params($conn, $query, $params);
} else {
    $result = pg_query($conn, $query);
}

if (!$result) {
    msg('Erro ao buscar dados: ' . pg_last_error($conn), 'error');
}

// ================================================================
// PROCESSAR RESULTADOS
// ================================================================
$data = [];
while ($row = pg_fetch_assoc($result)) {
    $data[] = [
        'numero' => $row['nro_cte'],
        'dataEmissao' => $row['data_emissao'],
        'dataPrevisao' => $row['data_prev_ent'],
        'dataEntrega' => $row['data_entrega']
    ];
}

// ================================================================
// RETORNAR RESPOSTA JSON
// ================================================================
respondJson([
    'success' => true,
    'data' => $data,
    'total' => count($data)
]);

// ================================================================
// FUNÇÃO MOCK (OBRIGATÓRIA PARA TESTES)
// ================================================================
function getMockData($periodo) {
    $mockData = [];
    
    for ($i = 0; $i < 10; $i++) {
        $mockData[] = [
            'numero' => str_pad($i + 1, 6, '0', STR_PAD_LEFT),
            'dataEmissao' => date('Y-m-d', strtotime("-{$i} days")),
            'dataPrevisao' => date('Y-m-d', strtotime("-" . ($i - 2) . " days")),
            'dataEntrega' => date('Y-m-d', strtotime("-" . ($i - 1) . " days"))
        ];
    }
    
    return $mockData;
}

// ================================================================
// EXEMPLOS DE USO DO msg()
// ================================================================
/*

// ❌ ERRO (mata o script e exibe toast vermelho)
msg('CT-e não encontrado', 'error');

// ⚠️ WARNING (mata o script e exibe toast amarelo)
msg('Nenhum registro encontrado', 'warning');

// ℹ️ INFO (mata o script e exibe toast azul)
msg('Dados carregados com sucesso', 'info');

// ✅ SUCCESS (mata o script e exibe toast verde)
msg('Operação realizada com sucesso', 'success');

*/

// ================================================================
// EXEMPLO: API DE EXPORT (CSV/PDF/EXCEL)
// ================================================================
/*

⚠️ ATENÇÃO: APIs que retornam arquivos precisam verificar erros ANTES de enviar headers!

// ✅ CORRETO: Verificar ANTES dos headers
$result = pg_query_params($conn, $query, $params);

if (!$result) {
    msg('Erro ao buscar dados', 'error'); // ✅ Funciona (ainda não enviou headers)
}

if (pg_num_rows($result) === 0) {
    msg('Nenhum registro encontrado', 'warning'); // ✅ Funciona
}

// SÓ DEPOIS de validar: enviar headers
header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="export.csv"');
echo "dados...";

// ❌ ERRADO: msg() DEPOIS dos headers NÃO FUNCIONA!

*/

// ================================================================
// CHECKLIST DE VALIDAÇÃO
// ================================================================
/*

✅ Usa require_once __DIR__ . '/../config.php'
✅ Usa handleOptionsRequest()
✅ Usa validateRequestMethod('POST')
✅ Usa authenticateAndGetUser()
✅ Usa getRequestInput()
✅ Usa shouldUseMockData()
✅ Usa respondJson() para retornar dados
✅ Usa msg() para erros (nunca echo json_encode diretamente)
✅ Usa pg_query_params() para queries com parâmetros
✅ Valida domínio com preg_match()
✅ Verifica se tabela existe
✅ Tem função mock implementada
✅ Trata erros de query com msg()
✅ Usa prepared statements ($1, $2, etc)

*/