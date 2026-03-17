<?php
/**
 * VER LOGS EM TEMPO REAL
 */
header('Content-Type: text/plain; charset=UTF-8');

$logs = [
    '/var/www/html/tmp/import_eventos_errors.log',
    '/var/www/html/tmp/php_errors.log',
    '/var/www/html/tmp/php_debug.log',
];

foreach ($logs as $logFile) {
    echo "========================================\n";
    echo "LOG: $logFile\n";
    echo "========================================\n";
    
    if (file_exists($logFile)) {
        echo "Tamanho: " . filesize($logFile) . " bytes\n";
        echo "Última modificação: " . date('Y-m-d H:i:s', filemtime($logFile)) . "\n\n";
        
        if (filesize($logFile) > 0) {
            $lines = file($logFile);
            $last100 = array_slice($lines, -100);
            echo implode('', $last100);
        } else {
            echo "(vazio)\n";
        }
    } else {
        echo "❌ Arquivo não existe\n";
    }
    echo "\n\n";
}
?>
