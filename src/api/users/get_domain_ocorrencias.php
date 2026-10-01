<?php
/**
 * ============================================================================
 * API: GET OCORRÊNCIAS DO DOMÍNIO
 * ============================================================================
 * Retorna todas as ocorrências cadastradas no domínio (tabela [dominio]_ocorrencia)
 * com de-para do campo tipo para rótulo amigável.
 *
 * ROTA: GET /sistema/api/users/get_domain_ocorrencias.php?domain=DMN
 * MÉTODO: GET
 *
 * RETORNO:
 * {
 *   "success": true,
 *   "ocorrencias": [ {"codigo": int, "descricao": string, "tipo": string, "tipo_label": string} ]
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

if ($domain !== $currentUser['domain'] && !$currentUser['is_admin']) {
    returnError('Acesso negado a este domínio', 403);
}

// ============================================================================
// DE-PARA TIPO
// ============================================================================
$TIPO_LABEL = [
    'B' => 'Baixa',
    'P' => 'Pendência Transportadora',
    'C' => 'Pendência Cliente',
    'S' => 'Solução',
    'I' => 'Informativa',
    'E' => 'Entrega',
    'R' => 'Pré-entrega'
];

// ============================================================================
// BUSCAR OCORRÊNCIAS DO DOMÍNIO
// ============================================================================
try {
    $conn = getDBConnection();

    $tableName = strtolower($domain) . '_ocorrencia';

    // Verificar se a tabela existe (caso domínio muito novo)
    $checkTable = sql(
        "SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = $1
        ) AS ex",
        [$tableName],
        $conn
    );
    $rowEx = $checkTable ? pg_fetch_assoc($checkTable) : null;
    if (!$rowEx || !($rowEx['ex'] === 't' || $rowEx['ex'] === true || $rowEx['ex'] === 1)) {
        closeDBConnection($conn);
        returnSuccess(['ocorrencias' => [], 'count' => 0]);
    }

    $query = "SELECT codigo, descricao, tipo FROM {$tableName} ORDER BY COALESCE(tipo, 'Z') ASC, descricao ASC, codigo ASC";

    $result = sql($query, [], $conn);

    if (!$result) {
        throw new Exception('Erro ao buscar ocorrências: ' . pg_last_error($conn));
    }

    $ocorrencias = [];
    while ($row = pg_fetch_assoc($result)) {
        $tipoRaw = (string)($row['tipo'] ?? '');
        $tipoLabel = $TIPO_LABEL[$tipoRaw] ?? ($tipoRaw !== '' ? $tipoRaw : 'Sem tipo');
        $ocorrencias[] = [
            'codigo'     => (int)$row['codigo'],
            'descricao'  => (string)($row['descricao'] ?? ''),
            'tipo'       => $tipoRaw,
            'tipo_label' => $tipoLabel
        ];
    }

    closeDBConnection($conn);

    returnSuccess([
        'ocorrencias' => $ocorrencias,
        'count'       => count($ocorrencias),
        'tipos_map'   => $TIPO_LABEL
    ]);

} catch (Exception $e) {
    error_log('[get_domain_ocorrencias] Erro: ' . $e->getMessage());
    returnError('Erro ao buscar ocorrências: ' . $e->getMessage(), 500);
}
