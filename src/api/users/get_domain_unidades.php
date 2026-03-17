<?php
/**
 * ============================================================================
 * API: GET UNIDADES DO DOMÍNIO
 * ============================================================================
 * Retorna todas as unidades de um domínio específico
 * 
 * ROTA: GET /sistema/api/users/get_domain_unidades.php?domain=DMN
 * MÉTODO: GET
 * 
 * RETORNO:
 * {
 *   "success": true,
 *   "unidades": ["MTZ", "GUA", "SJC", ...]
 * }
 */

require_once __DIR__ . '/../config.php';

// ============================================================================
// HEADERS CORS
// ============================================================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Domain, X-Unidade');

// OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================================================
// VALIDAÇÃO - MÉTODO HTTP
// ============================================================================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    returnError('Método não permitido', 405);
}

// ============================================================================
// AUTENTICAÇÃO
// ============================================================================
requireAuth();

// ============================================================================
// OBTER USUÁRIO AUTENTICADO
// ============================================================================
$currentUser = getCurrentUser();

// ============================================================================
// VALIDAÇÃO - DOMÍNIO
// ============================================================================
$domain = isset($_GET['domain']) ? strtoupper(trim($_GET['domain'])) : $currentUser['domain'];

if (empty($domain)) {
    returnError('Domínio não especificado', 400);
}

// Verificar se o usuário pode acessar este domínio
if ($domain !== $currentUser['domain'] && !$currentUser['is_admin']) {
    returnError('Acesso negado a este domínio', 403);
}

// ============================================================================
// BUSCAR UNIDADES DO DOMÍNIO
// ============================================================================
try {
    // Conectar ao banco
    $conn = getDBConnection();
    
    // Nome da tabela de unidades (padrão: dmn_unidade para domínio DMN)
    $tableName = strtolower($domain) . '_unidade';
    
    // ✅ REGRA: Usar sql() da biblioteca SSW - Buscar sigla E nome
    $query = "SELECT sigla, nome FROM {$tableName} ORDER BY sigla ASC";
    
    $result = sql($query, [], $conn);
    
    if (!$result) {
        throw new Exception('Erro ao buscar unidades: ' . pg_last_error($conn));
    }
    
    $unidades = [];
    while ($row = pg_fetch_assoc($result)) {
        $unidades[] = [
            'sigla' => $row['sigla'],
            'nome' => $row['nome']
        ];
    }
    
    closeDBConnection($conn);
    
    // ✅ RETORNO
    returnSuccess([
        'unidades' => $unidades,
        'count' => count($unidades)
    ]);
    
} catch (Exception $e) {
    error_log('[get_domain_unidades] Erro: ' . $e->getMessage());
    returnError('Erro ao buscar unidades: ' . $e->getMessage(), 500);
}