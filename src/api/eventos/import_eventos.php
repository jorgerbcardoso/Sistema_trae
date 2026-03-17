<?php
/**
 * API: Importar Eventos Padrão
 * Importa eventos SSW para o domínio
 */

// ⏱️ REMOVER TIMEOUT - Importação pode demorar
set_time_limit(0); // Sem limite de tempo
ini_set('max_execution_time', '0'); // Sem limite de tempo
ini_set('memory_limit', '512M'); // Aumentar memória se necessário

// ✅ SUPRIMIR WARNINGS - Só mostrar erros fatais
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/html/tmp/import_eventos_errors.log');

// Log de início
error_log("========================================");
error_log("🔥 IMPORT_EVENTOS.PHP - INÍCIO - " . date('Y-m-d H:i:s'));
error_log("========================================");

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
requireAuth();

error_log("✅ Autenticação OK");

// Carregar biblioteca SSW
try {
    error_log("🔄 Tentando carregar SSW...");
    require_ssw();
    error_log("✅ SSW carregado com sucesso");
    
    // Verificar se função existe
    if (!function_exists('imp_ssw_eve')) {
        error_log("❌ Função imp_ssw_eve NÃO EXISTE!");
        msg('Função imp_ssw_eve não encontrada na biblioteca SSW', 'error', 500);
    }
    error_log("✅ Função imp_ssw_eve existe");
    
} catch (Throwable $e) {
    $errorMsg = sprintf(
        "❌ ERRO AO CARREGAR SSW:\n   Tipo: %s\n   Mensagem: %s\n   Arquivo: %s\n   Linha: %s",
        get_class($e),
        $e->getMessage(),
        $e->getFile(),
        $e->getLine()
    );
    error_log($errorMsg);
    
    msg('Biblioteca SSW não disponível: ' . $e->getMessage(), 'error', 500);
}

// Obter dados do corpo da requisição
$input = getRequestInput();

// Obter domínio
$domain = $input['domain'] ?? $_SERVER['HTTP_X_DOMAIN'] ?? null;

if (!$domain) {
    msg('DOMÍNIO NÃO ESPECIFICADO', 'error');
}

// Validar domínio
if (!preg_match('/^[A-Z0-9]{3}$/i', $domain)) {
    msg('DOMÍNIO INVÁLIDO', 'error');
}

// Atribuir domínio à global
$dominio = strtoupper($domain);

// Conectar ao banco
if (!isDatabaseConfigured()) {
    msg('BANCO DE DADOS NÃO CONFIGURADO', 'error');
}

$conn = getDBConnection();

// ⚠️ PERGUNTA DE CONFIRMAÇÃO
$confirma = ask("⚠️ Atenção! Os dados atuais serão reescritos. Confirma a operação?", "confirm", "confirm_import_eventos");

if (!$confirma) {
    closeDBConnection($conn);
    msg('Importação cancelada pelo usuário.', 'info');
}

// Chamar função de importação SSW
imp_ssw_eve();

closeDBConnection($conn);

msg('Eventos importados com sucesso!', 'success');
?>