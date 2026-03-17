<?php
/**
 * VER ÚLTIMAS LINHAS DOS LOGS (SEM ESTOURAR MEMÓRIA)
 */
header('Content-Type: text/plain; charset=UTF-8');

function tail_file($filepath, $lines = 50) {
    if (!file_exists($filepath)) {
        return "❌ Arquivo não existe: $filepath\n";
    }
    
    $output = "📋 $filepath\n";
    $output .= "   Tamanho: " . number_format(filesize($filepath)) . " bytes\n";
    $output .= "   Modificado: " . date('Y-m-d H:i:s', filemtime($filepath)) . "\n\n";
    
    // Usar tail do sistema (mais eficiente)
    $escaped = escapeshellarg($filepath);
    $result = shell_exec("tail -n $lines $escaped 2>&1");
    
    if ($result) {
        $output .= $result;
    } else {
        $output .= "(vazio ou sem permissão)\n";
    }
    
    return $output . "\n" . str_repeat("=", 80) . "\n\n";
}

echo "🔍 ÚLTIMAS LINHAS DOS LOGS - " . date('Y-m-d H:i:s') . "\n";
echo str_repeat("=", 80) . "\n\n";

$logs = [
    '/var/www/html/tmp/import_eventos_errors.log',
    '/var/www/html/tmp/import_grupos_errors.log',
    '/var/www/html/tmp/php_errors.log',
    '/var/www/html/tmp/php_debug.log',
    '/var/log/nginx/error.log',
    '/var/log/php-fpm/error.log',
    '/var/log/php-fpm/www-error.log',
];

foreach ($logs as $log) {
    echo tail_file($log, 30);
}
?>
