<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE COLETAS - COMPARATIVO POR UNIDADES
 * ================================================================
 * Retorna comparativo de performance por unidades coletadoras
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-coletas/get_comparativo.php
 * Body: { filters: {...} }
 * Response: JSON com array de unidades e suas performances
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/lib.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

try {
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
    $filters = $input['filters'] ?? [];
    
    error_log('🔍 [get_comparativo.php] Filtros recebidos: ' . json_encode($filters));

    // ================================================================
    // CONECTAR AO BANCO
    // ================================================================
    $g_sql = connect();

    // ================================================================
    // CRIAR TABELA TEMPORÁRIA COM DADOS DO SSW
    // ================================================================
    createTempColetasTable($g_sql, $domain, $filters, 'comparativo');

    // ================================================================
    // BUSCAR COMPARATIVO DE UNIDADES
    // ================================================================
    $data = getColetasComparativo($g_sql, $domain);

    // ================================================================
    // RESPOSTA JSON
    // ================================================================
    respondJson([
        'success' => true,
        'data' => $data
    ]);

} catch (Exception $e) {
    error_log('❌ [get_comparativo.php] ERRO: ' . $e->getMessage());
    error_log('❌ Stack trace: ' . $e->getTraceAsString());
    
    msg('Erro ao buscar comparativo de unidades: ' . $e->getMessage(), 'error');
    respondJson([
        'success' => false
    ], 500);
}