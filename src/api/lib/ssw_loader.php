<?php
/**
 * ============================================
 * CARREGADOR CONDICIONAL DO ssw.php
 * ============================================
 * Use esta função para carregar ssw.php apenas quando necessário
 */

/**
 * Carregar biblioteca SSW
 * Carrega o arquivo ssw.php apenas quando necessário
 * @throws Exception se arquivo não existir ou tiver erro de sintaxe
 */
function require_ssw() {
    global $g_sql;

    static $loaded = false;

    if ($loaded) {
        return; // Já foi carregado
    }

    // Garante que $g_sql existe ANTES de carregar SSW
    if (!isset($g_sql) || !$g_sql) {
        $g_sql = getDBConnection();
        if (!$g_sql) {
            throw new Exception("Não foi possível criar conexão para o SSW");
        }
    }

    $sswPath = '/var/www/html/lib/ssw.php';

    if (!file_exists($sswPath)) {
        throw new Exception("Arquivo ssw.php não encontrado em: $sswPath");
    }

    if (!is_dir('/tmp/ssw_sessions')) {
        @mkdir('/tmp/ssw_sessions', 0750, true);
    }

    require_once $sswPath;

    $loaded = true;
}

/**
 * Verificar se funções SSW estão disponíveis
 * @return bool
 */
function ssw_available() {
    return function_exists('imp_ssw_gru');
}