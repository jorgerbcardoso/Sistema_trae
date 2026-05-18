<?php
set_time_limit(0);
ini_set('max_execution_time', '0');
ini_set('memory_limit', '512M');

error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/html/tmp/import_unidades_errors.log');

error_log("========================================");
error_log("🔥 IMPORT_UNIDADES.PHP - INÍCIO - " . date('Y-m-d H:i:s'));
error_log("========================================");

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
requireAuth();

try {
    require_ssw();
    if (!function_exists('imp_ssw_uni')) {
        msg('Função imp_ssw_uni não encontrada na biblioteca SSW', 'error', 500);
    }
} catch (Throwable $e) {
    msg('Biblioteca SSW não disponível: ' . $e->getMessage(), 'error', 500);
}

$input = getRequestInput();

$domain = $input['domain'] ?? $_SERVER['HTTP_X_DOMAIN'] ?? null;

if (!$domain) {
    msg('DOMÍNIO NÃO ESPECIFICADO', 'error');
}

if (!preg_match('/^[A-Z0-9]{3}$/i', $domain)) {
    msg('DOMÍNIO INVÁLIDO', 'error');
}

$dominio = strtoupper($domain);

$confirma = ask("⚠️ Atenção! Os dados atuais serão reescritos. Confirma a operação?", "confirm", "confirm_import_unidades");

if (!$confirma) {
    msg('Importação cancelada pelo usuário.', 'info');
}

global $g_sql;
$g_sql = getDBConnection();

imp_ssw_uni();

msg('Unidades importadas com sucesso!', 'success');

