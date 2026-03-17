<?php
/**
 * Teste de Logs via Requisição Web
 * Acesse: https://webpresto.com.br/sistema/api/test_log.php
 */

// Testar diferentes formas de log
error_log("=== TESTE WEB LOG - " . date('Y-m-d H:i:s') . " ===");
error_log("Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'N/A'));
error_log("Remote Addr: " . ($_SERVER['REMOTE_ADDR'] ?? 'N/A'));
error_log("User Agent: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'N/A'));
error_log("Script: " . __FILE__);

// Verificar configurações
$configs = [
    'error_log' => ini_get('error_log'),
    'log_errors' => ini_get('log_errors'),
    'display_errors' => ini_get('display_errors'),
    'error_reporting' => error_reporting()
];

error_log("Configurações PHP: " . json_encode($configs));

// Resposta HTML
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Teste de Logs PHP-FPM</title>
    <style>
        body {
            font-family: monospace;
            max-width: 1200px;
            margin: 50px auto;
            padding: 20px;
            background: #1e293b;
            color: #e2e8f0;
        }
        .success { color: #10b981; }
        .info { color: #3b82f6; }
        .warning { color: #f59e0b; }
        .box {
            background: #334155;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #3b82f6;
        }
        h1 { color: #10b981; }
        h2 { color: #3b82f6; margin-top: 30px; }
        code {
            background: #1e293b;
            padding: 2px 6px;
            border-radius: 4px;
            color: #fbbf24;
        }
        pre {
            background: #1e293b;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>✅ Teste de Logs PHP-FPM - Sistema PRESTO</h1>
    
    <div class="box">
        <h2>📊 Informações da Requisição</h2>
        <ul>
            <li><strong>Data/Hora:</strong> <?= date('Y-m-d H:i:s') ?></li>
            <li><strong>Método:</strong> <?= $_SERVER['REQUEST_METHOD'] ?? 'N/A' ?></li>
            <li><strong>IP:</strong> <?= $_SERVER['REMOTE_ADDR'] ?? 'N/A' ?></li>
            <li><strong>User Agent:</strong> <?= $_SERVER['HTTP_USER_AGENT'] ?? 'N/A' ?></li>
        </ul>
    </div>

    <div class="box">
        <h2>⚙️ Configurações do PHP</h2>
        <ul>
            <li><strong>PHP Version:</strong> <?= PHP_VERSION ?></li>
            <li><strong>SAPI:</strong> <?= PHP_SAPI ?></li>
            <li><strong>error_log:</strong> <code><?= ini_get('error_log') ?: 'NÃO CONFIGURADO' ?></code></li>
            <li><strong>log_errors:</strong> <?= ini_get('log_errors') ? 'ON' : 'OFF' ?></li>
            <li><strong>display_errors:</strong> <?= ini_get('display_errors') ? 'ON' : 'OFF' ?></li>
            <li><strong>error_reporting:</strong> <?= error_reporting() ?></li>
        </ul>
    </div>

    <div class="box">
        <h2>📝 Status do Arquivo de Log</h2>
        <?php
        $logFile = '/var/www/html/logs/php_errors.log';
        if (file_exists($logFile)) {
            $writable = is_writable($logFile);
            $size = filesize($logFile);
            $perms = substr(sprintf('%o', fileperms($logFile)), -4);
            echo "<ul>";
            echo "<li><strong>Arquivo:</strong> <code>$logFile</code></li>";
            echo "<li><strong>Existe:</strong> <span class='success'>✅ SIM</span></li>";
            echo "<li><strong>Tamanho:</strong> " . number_format($size) . " bytes</li>";
            echo "<li><strong>Permissões:</strong> <code>$perms</code></li>";
            echo "<li><strong>Gravável:</strong> " . ($writable ? "<span class='success'>✅ SIM</span>" : "<span class='warning'>⚠️ NÃO</span>") . "</li>";
            echo "</ul>";
            
            // Últimas 20 linhas
            echo "<h3>📄 Últimas 20 linhas do log:</h3>";
            $lines = file($logFile);
            $lastLines = array_slice($lines, -20);
            echo "<pre>" . htmlspecialchars(implode('', $lastLines)) . "</pre>";
        } else {
            echo "<p class='warning'>⚠️ Arquivo não existe: <code>$logFile</code></p>";
        }
        ?>
    </div>

    <div class="box">
        <h2>🧪 Comandos Úteis</h2>
        <pre>
# Ver logs em tempo real:
tail -f /var/www/html/logs/php_errors.log

# Ver últimas 50 linhas:
tail -50 /var/www/html/logs/php_errors.log

# Limpar arquivo de log:
sudo truncate -s 0 /var/www/html/logs/php_errors.log

# Ver configuração do PHP-FPM:
sudo cat /etc/php/8.2/fpm/php.ini | grep error_log

# Ver configuração do pool:
sudo cat /etc/php/8.2/fpm/pool.d/www.conf | grep -A5 "error_log"

# Reiniciar PHP-FPM:
sudo systemctl restart php8.2-fpm
        </pre>
    </div>

    <div class="box">
        <h2 class="success">✅ Próximo Passo</h2>
        <p>Se você vê esta mensagem, o PHP-FPM está funcionando!</p>
        <p>Agora verifique se os logs foram gravados em: <code>/var/www/html/logs/php_errors.log</code></p>
        <p><strong>Se os logs aparecerem acima, está tudo funcionando! 🎉</strong></p>
    </div>
</body>
</html>
