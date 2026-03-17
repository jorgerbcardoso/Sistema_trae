<?php
/**
 * API ESTOQUE - UNIDADES DE MEDIDA
 * Retorna lista de unidades de medida
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();
    
// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($currentUser['domain']) . '_';
$tblUnidadeMedida = $prefix . 'unidade_medida';
    
// ✅ CONECTAR AO BANCO
$g_sql = connect();

try {
    $where = isset($_GET['ativo']) ? "ativo = '" . $_GET['ativo'] . "'" : "1=1";
    $query = "SELECT * FROM $tblUnidadeMedida WHERE $where ORDER BY descricao";
    
    $result = sql($g_sql, $query, false, []);
    $unidades = [];
    
    while ($row = pg_fetch_assoc($result)) {
        $unidades[] = $row;
    }
    
    echo json_encode(['success' => true, 'data' => $unidades]);
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/unidades_medida.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}