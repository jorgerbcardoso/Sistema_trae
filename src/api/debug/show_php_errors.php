<?php
/**
 * 🔥 MOSTRAR TODOS OS ERROS PHP - FORÇADO
 */

// FORÇAR display de erros
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Configurar log de erros
ini_set('log_errors', 1);
ini_set('error_log', '/var/www/html/tmp/php_errors.log');

echo "<h1>🔍 CONFIGURAÇÃO DE ERROS PHP</h1>";
echo "<pre>";

echo "=====================================\n";
echo "CONFIGURAÇÕES ATUAIS:\n";
echo "=====================================\n";
echo "display_errors: " . ini_get('display_errors') . "\n";
echo "error_reporting: " . error_reporting() . "\n";
echo "log_errors: " . ini_get('log_errors') . "\n";
echo "error_log: " . ini_get('error_log') . "\n";

echo "\n=====================================\n";
echo "POSSÍVEIS LOCAIS DE LOGS:\n";
echo "=====================================\n";

$possibleLogs = [
    '/var/log/php-fpm/error.log',
    '/var/log/php-fpm/www-error.log',
    '/var/log/php/error.log',
    '/var/log/php7.4/error.log',
    '/var/log/php8.0/error.log',
    '/var/log/php8.1/error.log',
    '/var/log/php8.2/error.log',
    '/var/log/nginx/error.log',
    '/var/log/apache2/error.log',
    '/var/www/html/tmp/php_debug.log',
    '/var/www/html/tmp/php_errors.log',
    '/tmp/php_errors.log',
];

foreach ($possibleLogs as $log) {
    if (file_exists($log)) {
        $size = filesize($log);
        $readable = is_readable($log) ? '✅' : '❌';
        echo "$readable $log (tamanho: " . number_format($size) . " bytes)\n";
        
        if (is_readable($log) && $size > 0) {
            echo "   📋 ÚLTIMAS 20 LINHAS:\n";
            $lines = file($log);
            $lastLines = array_slice($lines, -20);
            foreach ($lastLines as $line) {
                echo "      " . trim($line) . "\n";
            }
            echo "\n";
        }
    }
}

echo "\n=====================================\n";
echo "TESTAR ERRO:\n";
echo "=====================================\n";

// Gerar erro de propósito
error_log("🔥 TESTE DE LOG - " . date('Y-m-d H:i:s'));

// Tentar carregar ssw.php e capturar erro
echo "\n🔍 Tentando carregar ssw.php...\n";
$sswPath = '/var/www/html/lib/ssw.php';

if (file_exists($sswPath)) {
    echo "✅ Arquivo existe: $sswPath\n";
    
    // Verificar sintaxe
    exec("php -l " . escapeshellarg($sswPath) . " 2>&1", $output, $return);
    if ($return !== 0) {
        echo "❌ ERRO DE SINTAXE:\n";
        echo implode("\n", $output) . "\n";
    } else {
        echo "✅ Sintaxe OK\n";
        
        // Tentar carregar
        try {
            echo "🔄 Carregando arquivo...\n";
            require_once $sswPath;
            echo "✅ Arquivo carregado com sucesso!\n";
            
            if (function_exists('imp_ssw_gru')) {
                echo "✅ Função imp_ssw_gru existe\n";
            } else {
                echo "❌ Função imp_ssw_gru NÃO existe\n";
            }
            
            if (function_exists('imp_ssw_eve')) {
                echo "✅ Função imp_ssw_eve existe\n";
            } else {
                echo "❌ Função imp_ssw_eve NÃO existe\n";
            }
            
        } catch (Throwable $e) {
            echo "❌ ERRO AO CARREGAR:\n";
            echo "   Tipo: " . get_class($e) . "\n";
            echo "   Mensagem: " . $e->getMessage() . "\n";
            echo "   Arquivo: " . $e->getFile() . "\n";
            echo "   Linha: " . $e->getLine() . "\n";
            echo "   Stack trace:\n";
            echo $e->getTraceAsString() . "\n";
        }
    }
} else {
    echo "❌ Arquivo NÃO existe: $sswPath\n";
}

echo "</pre>";
