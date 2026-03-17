<?php
/**
 * Script de Diagnóstico de Logs PHP
 * Executa: php /var/www/html/sistema/api/diagnostico_logs.php
 */

echo "=== DIAGNÓSTICO DE LOGS PHP ===\n\n";

// 1. Verificar configurações do PHP
echo "1. CONFIGURAÇÕES PHP:\n";
echo "   - error_log: " . ini_get('error_log') . "\n";
echo "   - log_errors: " . ini_get('log_errors') . "\n";
echo "   - display_errors: " . ini_get('display_errors') . "\n";
echo "   - error_reporting: " . error_reporting() . "\n\n";

// 2. Verificar diretório de logs
$logDir = '/var/www/html/logs';
$logFile = $logDir . '/php_errors.log';

echo "2. VERIFICAÇÃO DO DIRETÓRIO:\n";
echo "   - Diretório: $logDir\n";
echo "   - Existe: " . (is_dir($logDir) ? "SIM" : "NÃO") . "\n";

if (is_dir($logDir)) {
    echo "   - Permissões: " . substr(sprintf('%o', fileperms($logDir)), -4) . "\n";
    echo "   - Dono: " . posix_getpwuid(fileowner($logDir))['name'] . "\n";
    echo "   - Gravável: " . (is_writable($logDir) ? "SIM" : "NÃO") . "\n";
}

echo "\n3. VERIFICAÇÃO DO ARQUIVO:\n";
echo "   - Arquivo: $logFile\n";
echo "   - Existe: " . (file_exists($logFile) ? "SIM" : "NÃO") . "\n";

if (file_exists($logFile)) {
    echo "   - Permissões: " . substr(sprintf('%o', fileperms($logFile)), -4) . "\n";
    echo "   - Dono: " . posix_getpwuid(fileowner($logFile))['name'] . "\n";
    echo "   - Gravável: " . (is_writable($logFile) ? "SIM" : "NÃO") . "\n";
    echo "   - Tamanho: " . filesize($logFile) . " bytes\n";
}

// 4. Testar gravação
echo "\n4. TESTE DE GRAVAÇÃO:\n";
try {
    error_log("=== TESTE DE LOG - " . date('Y-m-d H:i:s') . " ===");
    echo "   - error_log() executado\n";
    
    // Verificar se foi gravado
    if (file_exists($logFile)) {
        $conteudo = file_get_contents($logFile);
        if (strpos($conteudo, 'TESTE DE LOG') !== false) {
            echo "   - ✅ LOG GRAVADO COM SUCESSO!\n";
        } else {
            echo "   - ❌ LOG NÃO FOI GRAVADO\n";
        }
    } else {
        echo "   - ❌ ARQUIVO DE LOG NÃO FOI CRIADO\n";
    }
} catch (Exception $e) {
    echo "   - ❌ ERRO: " . $e->getMessage() . "\n";
}

// 5. Informações do sistema
echo "\n5. INFORMAÇÕES DO SISTEMA:\n";
echo "   - PHP Version: " . PHP_VERSION . "\n";
echo "   - PHP SAPI: " . PHP_SAPI . "\n";
echo "   - Usuário PHP: " . get_current_user() . "\n";
echo "   - Process User: " . posix_getpwuid(posix_geteuid())['name'] . "\n";

// 6. Comandos para corrigir
echo "\n\n=== COMANDOS PARA CORRIGIR ===\n";
echo "\n# 1. Criar diretório e arquivo (se necessário):\n";
echo "sudo mkdir -p /var/www/html/logs\n";
echo "sudo touch /var/www/html/logs/php_errors.log\n\n";

echo "# 2. Dar permissões corretas:\n";
echo "sudo chown -R www-data:www-data /var/www/html/logs\n";
echo "sudo chmod -R 755 /var/www/html/logs\n";
echo "sudo chmod 644 /var/www/html/logs/php_errors.log\n\n";

echo "# 3. Reiniciar PHP-FPM:\n";
echo "sudo systemctl restart php8.2-fpm\n\n";

echo "# 4. Verificar se está funcionando:\n";
echo "php /var/www/html/sistema/api/diagnostico_logs.php\n\n";

echo "# 5. Ver logs em tempo real:\n";
echo "tail -f /var/www/html/logs/php_errors.log\n\n";

echo "=== FIM DO DIAGNÓSTICO ===\n";
