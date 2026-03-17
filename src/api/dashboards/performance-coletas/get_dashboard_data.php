<?php
/**
 * ================================================================
 * API UNIFICADA: DASHBOARD PERFORMANCE DE COLETAS
 * ================================================================
 * Endpoint único que cria DUAS VIEWs temporárias e retorna TODOS
 * os dados necessários para o dashboard:
 * 
 * VIEW 1 (tmp_coleta_filtrada): COM filtros do usuário
 * - Cards com contadores por situação
 * - Comparativo por unidades coletadoras
 * 
 * VIEW 2 (tmp_coleta_30dias): Últimos 30 dias
 * - Análise diária (últimos 30 dias)
 * - Evolução de performance (últimos 30 dias)
 *
 * ✅ LEITURA DIRETA DA BASE DE DADOS
 * As VIEWs são criadas a partir da tabela [dominio]_coleta,
 * que é populada diariamente via crontab pelo script imp_coleta.php
 *
 * VANTAGENS:
 * ✅ Separação clara entre dados filtrados e dados históricos
 * ✅ Cards e Comparativo usam apenas Query 1 (filtros do usuário)
 * ✅ Evolução e Análise Diária usam apenas Query 2 (30 dias)
 * ✅ Apenas 1 requisição HTTP do frontend
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/lib.php';

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
    
    // ================================================================
    // CONECTAR AO BANCO
    // ================================================================
    $g_sql = connect();

    // ================================================================
    // CRIAR DUAS TABELAS TEMPORÁRIAS
    // ================================================================
    // ✅ VIEW 1: Com filtros do usuário (para Cards + Comparativo)
    // ✅ VIEW 2: Últimos 30 dias (para Evolução + Análise Diária)
    createTempColetasTables($g_sql, $domain, $filters);

    // ================================================================
    // BUSCAR TODOS OS DADOS NECESSÁRIOS
    // ================================================================
    
    // 1️⃣ CARDS: Contadores por situação (usa VIEW 1 - filtrada)
    $cards = getColetasCountBySituacao($g_sql, 'tmp_coleta_filtrada');
    
    // 2️⃣ ANÁLISE DIÁRIA: Últimos 30 dias (usa VIEW 2 - 30 dias)
    $analiseDiaria = getColetasAnaliseDiaria($g_sql, 30, 'tmp_coleta_30dias');
    
    // 3️⃣ EVOLUÇÃO: Últimos 30 dias (usa VIEW 2 - 30 dias)
    $evolucao = getColetasEvolucao($g_sql, 30, 'tmp_coleta_30dias');
    
    // 4️⃣ COMPARATIVO: Por unidades coletadoras (usa VIEW 1 - filtrada)
    $comparativo = getColetasComparativo($g_sql, $domain);

    // ================================================================
    // RESPOSTA UNIFICADA
    // ================================================================
    respondJson([
        'success' => true,
        'data' => [
            'cards' => $cards,
            'analiseDiaria' => $analiseDiaria,
            'evolucao' => $evolucao,
            'comparativo' => $comparativo
        ]
    ]);

} catch (Exception $e) {
    msg($e->getMessage(), 'e');
    respondJson([
        'success' => false,
        'error' => $e->getMessage()
    ], 500);
}