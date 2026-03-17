<?php
/**
 * DIAGNÓSTICO COMPLETO DO SISTEMA DE EMAIL
 * Acesse: /sistema/api/diagnostico_email_completo.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

// NÃO REQUER AUTENTICAÇÃO - É UM DIAGNÓSTICO
$EMAIL_TESTE = 'admin@aceville.com.br'; // ⚠️ ALTERE ESTE EMAIL!

?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnóstico de Email - Sistema Presto</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { margin: 0; font-size: 32px; font-weight: 600; }
        .content { padding: 30px; }
        .test-section {
            margin-bottom: 30px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            background: #f9fafb;
        }
        .test-section h2 {
            margin: 0 0 15px 0;
            color: #1f2937;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .result {
            margin-top: 15px;
            padding: 15px;
            border-radius: 6px;
            line-height: 1.6;
        }
        .result.success {
            background: #d1fae5;
            color: #065f46;
            border-left: 4px solid #10b981;
        }
        .result.error {
            background: #fee2e2;
            color: #991b1b;
            border-left: 4px solid #ef4444;
        }
        .result.warning {
            background: #fef3c7;
            color: #92400e;
            border-left: 4px solid #f59e0b;
        }
        code {
            background: #1f2937;
            color: #f9fafb;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        pre {
            background: #1f2937;
            color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.4;
            max-height: 400px;
            overflow-y: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        table td {
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
        }
        table td:first-child {
            font-weight: 600;
            color: #4b5563;
            width: 200px;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin-top: 10px;
        }
        .footer {
            background: #f3f4f6;
            padding: 20px 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 DIAGNÓSTICO DE EMAIL</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema Presto - Análise Completa</p>
        </div>

        <div class="content">
            
            <?php
            echo '<div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">';
            echo '<strong>📝 Email de Teste Configurado:</strong> <code>' . htmlspecialchars($EMAIL_TESTE) . '</code><br>';
            echo '<small>Para alterar, edite o arquivo <code>/api/diagnostico_email_completo.php</code> linha 9</small>';
            echo '</div>';

            // =====================================================
            // TESTE 1: PHPMAILER
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>📦 Teste 1: PHPMailer Instalado</h2>';
            
            $phpmailer_files = [
                __DIR__ . '/phpmailer/PHPMailer.php',
                __DIR__ . '/phpmailer/SMTP.php',
                __DIR__ . '/phpmailer/Exception.php'
            ];
            
            $phpmailer_ok = true;
            foreach ($phpmailer_files as $file) {
                if (!file_exists($file)) {
                    $phpmailer_ok = false;
                    echo '<div class="result error">❌ <strong>Arquivo não encontrado:</strong> ' . basename($file) . '</div>';
                }
            }
            
            if ($phpmailer_ok) {
                echo '<div class="result success">✅ <strong>PHPMailer instalado corretamente!</strong></div>';
            }
            echo '</div>';

            // =====================================================
            // TESTE 2: EXTENSÕES PHP
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>🔧 Teste 2: Extensões PHP Necessárias</h2>';
            
            $required_extensions = [
                'openssl' => 'Necessário para conexões SMTP seguras (TLS/SSL)',
                'sockets' => 'Necessário para conexões de rede',
                'curl' => 'Necessário para downloads de imagens'
            ];
            
            foreach ($required_extensions as $ext => $desc) {
                if (extension_loaded($ext)) {
                    echo '<div class="result success">✅ <strong>' . $ext . '</strong>: Instalado<br><small>' . $desc . '</small></div>';
                } else {
                    echo '<div class="result error">❌ <strong>' . $ext . '</strong>: NÃO INSTALADO<br><small>' . $desc . '</small></div>';
                }
            }
            echo '</div>';

            // =====================================================
            // TESTE 3: CONECTIVIDADE SMTP
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>🌐 Teste 3: Conectividade SMTP</h2>';
            
            $smtp_tests = [
                ['name' => 'Zoho (SSL)', 'host' => 'smtppro.zoho.com', 'port' => 465],
                ['name' => 'Zoho (TLS)', 'host' => 'smtppro.zoho.com', 'port' => 587],
                ['name' => 'Gmail (TLS)', 'host' => 'smtp.gmail.com', 'port' => 587]
            ];
            
            foreach ($smtp_tests as $test) {
                echo "<div style='margin-bottom: 15px;'>";
                echo "<strong>{$test['name']}: {$test['host']}:{$test['port']}</strong><br>";
                
                $errno = 0;
                $errstr = '';
                $start = microtime(true);
                $fp = @fsockopen($test['host'], $test['port'], $errno, $errstr, 10);
                $end = microtime(true);
                $time = round(($end - $start) * 1000, 2);
                
                if ($fp) {
                    fclose($fp);
                    echo '<div class="result success">✅ Conexão OK! (tempo: ' . $time . 'ms)</div>';
                } else {
                    echo '<div class="result error">❌ <strong>FALHA!</strong><br>Erro #' . $errno . ': ' . $errstr . '<br><small>Firewall pode estar bloqueando a porta ' . $test['port'] . '</small></div>';
                }
                echo "</div>";
            }
            echo '</div>';

            // =====================================================
            // TESTE 4: ENVIO REAL (ZOHO)
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>📨 Teste 4: Envio Real de Email (Zoho)</h2>';
            
            if (strpos($EMAIL_TESTE, '@') === false) {
                echo '<div class="result warning">⚠️ <strong>Configure o email de teste!</strong><br>Edite <code>/api/diagnostico_email_completo.php</code> linha 9</div>';
            } else {
                try {
                    require_once __DIR__ . '/phpmailer/PHPMailer.php';
                    require_once __DIR__ . '/phpmailer/SMTP.php';
                    require_once __DIR__ . '/phpmailer/Exception.php';
                    
                    use PHPMailer\PHPMailer\PHPMailer;
                    use PHPMailer\PHPMailer\SMTP;
                    use PHPMailer\PHPMailer\Exception;
                    
                    $mail = new PHPMailer(true);
                    
                    // Capturar debug
                    $debug_output = '';
                    $mail->SMTPDebug = SMTP::DEBUG_SERVER;
                    $mail->Debugoutput = function($str, $level) use (&$debug_output) {
                        $debug_output .= htmlspecialchars($str) . "\n";
                    };
                    
                    // SMTP Zoho
                    $mail->isSMTP();
                    $mail->Host = 'smtppro.zoho.com';
                    $mail->SMTPAuth = true;
                    $mail->Username = 'contato@webpresto.com.br';
                    $mail->Password = 'Web@presto54321!';
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                    $mail->Port = 465;
                    $mail->Timeout = 30;
                    
                    $mail->setFrom('naoresponda@webpresto.com.br', 'Sistema Presto - Diagnostico');
                    $mail->addAddress($EMAIL_TESTE);
                    
                    $mail->isHTML(true);
                    $mail->CharSet = 'UTF-8';
                    $mail->Subject = '✅ Teste Diagnóstico - ' . date('Y-m-d H:i:s');
                    $mail->Body = '
                        <!DOCTYPE html>
                        <html>
                        <head><meta charset="UTF-8"></head>
                        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f3f4f6;">
                            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
                                <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px;">
                                    <h1 style="color: white; margin: 0;">✅ EMAIL FUNCIONANDO!</h1>
                                </div>
                                <h2 style="color: #1f2937; margin-top: 30px;">Teste bem-sucedido via Zoho SMTP</h2>
                                <p style="color: #6b7280;">Este email foi enviado pelo diagnóstico do Sistema Presto.</p>
                                <table style="width: 100%; margin-top: 20px;">
                                    <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Servidor:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">smtppro.zoho.com:465</td></tr>
                                    <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Data/Hora:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">' . date('d/m/Y H:i:s') . '</td></tr>
                                    <tr><td style="padding: 10px; font-weight: bold;">Remetente:</td><td style="padding: 10px;">naoresponda@webpresto.com.br</td></tr>
                                </table>
                            </div>
                        </body>
                        </html>
                    ';
                    
                    $start = microtime(true);
                    $result = $mail->send();
                    $end = microtime(true);
                    $time = round(($end - $start) * 1000, 2);
                    
                    echo '<div class="result success">';
                    echo "✅ <strong>EMAIL ENVIADO COM SUCESSO!</strong><br><br>";
                    echo "<strong>Para:</strong> {$EMAIL_TESTE}<br>";
                    echo "<strong>Tempo:</strong> {$time}ms<br><br>";
                    echo "<small>✉️ Verifique sua caixa de entrada (e spam) agora!</small>";
                    echo '</div>';
                    
                    if ($debug_output) {
                        echo '<details style="margin-top: 15px;"><summary style="cursor: pointer; font-weight: bold; color: #3b82f6;">📋 Ver Log SMTP Completo</summary>';
                        echo '<pre>' . $debug_output . '</pre></details>';
                    }
                    
                } catch (Exception $e) {
                    echo '<div class="result error">';
                    echo "❌ <strong>ERRO AO ENVIAR EMAIL!</strong><br><br>";
                    echo "<strong>Mensagem de Erro:</strong><br>";
                    echo htmlspecialchars($e->getMessage());
                    echo '</div>';
                    
                    if (isset($debug_output) && $debug_output) {
                        echo '<div style="margin-top: 15px;"><strong>Log SMTP:</strong><pre>' . $debug_output . '</pre></div>';
                    }
                }
            }
            echo '</div>';

            // =====================================================
            // TESTE 5: EMAILSERVICE DO SISTEMA
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>🔬 Teste 5: EmailService do Sistema</h2>';
            
            if (strpos($EMAIL_TESTE, '@') === false) {
                echo '<div class="result warning">⚠️ Configure o email primeiro</div>';
            } else {
                try {
                    require_once __DIR__ . '/services/EmailService.php';
                    
                    $emailService = new EmailService();
                    
                    $html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px;"><h1 style="color: #1e40af;">✅ Teste EmailService</h1><p>Este email foi enviado usando a classe <strong>EmailService</strong> do Sistema Presto.</p><p><strong>Data/Hora:</strong> ' . date('d/m/Y H:i:s') . '</p></div></body></html>';
                    
                    $start = microtime(true);
                    $result = $emailService->sendEmail(
                        $EMAIL_TESTE,
                        'Teste',
                        '✅ Teste EmailService - ' . date('H:i:s'),
                        $html,
                        'Teste EmailService',
                        [],
                        'SSW'
                    );
                    $end = microtime(true);
                    $time = round(($end - $start) * 1000, 2);
                    
                    if ($result['success']) {
                        echo '<div class="result success">';
                        echo "✅ <strong>EmailService funcionando!</strong><br><br>";
                        echo "<strong>Tempo:</strong> {$time}ms<br>";
                        echo "<strong>Resposta:</strong> " . htmlspecialchars($result['message']);
                        echo '</div>';
                    } else {
                        echo '<div class="result error">';
                        echo "❌ <strong>Erro no EmailService:</strong><br><br>";
                        echo htmlspecialchars($result['message']);
                        echo '</div>';
                    }
                    
                } catch (Exception $e) {
                    echo '<div class="result error">';
                    echo "❌ <strong>Exceção:</strong> " . htmlspecialchars($e->getMessage());
                    echo '</div>';
                }
            }
            echo '</div>';

            // =====================================================
            // TESTE 6: RECUPERAÇÃO DE SENHA
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>🔑 Teste 6: API de Recuperação de Senha</h2>';
            
            if (strpos($EMAIL_TESTE, '@') === false) {
                echo '<div class="result warning">⚠️ Configure o email primeiro</div>';
            } else {
                try {
                    // Simular chamada à API de forgot-password
                    $url = 'http://localhost' . dirname($_SERVER['PHP_SELF']) . '/auth/forgot-password.php';
                    
                    $data = json_encode([
                        'email' => $EMAIL_TESTE,
                        'domain' => 'SSW'
                    ]);
                    
                    $ch = curl_init($url);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
                    
                    $response = curl_exec($ch);
                    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $curl_error = curl_error($ch);
                    curl_close($ch);
                    
                    if ($curl_error) {
                        echo '<div class="result error">❌ <strong>Erro CURL:</strong> ' . htmlspecialchars($curl_error) . '</div>';
                    } else {
                        $json = json_decode($response, true);
                        
                        if ($http_code === 200 && isset($json['success']) && $json['success']) {
                            echo '<div class="result success">';
                            echo "✅ <strong>API de recuperação de senha OK!</strong><br><br>";
                            echo "<strong>HTTP Code:</strong> {$http_code}<br>";
                            echo "<strong>Resposta:</strong> " . htmlspecialchars($json['message'] ?? 'Sucesso');
                            echo '</div>';
                        } else {
                            echo '<div class="result error">';
                            echo "❌ <strong>Erro na API:</strong><br><br>";
                            echo "<strong>HTTP Code:</strong> {$http_code}<br>";
                            echo "<strong>Resposta:</strong> " . htmlspecialchars($response);
                            echo '</div>';
                        }
                    }
                    
                } catch (Exception $e) {
                    echo '<div class="result error">❌ <strong>Exceção:</strong> ' . htmlspecialchars($e->getMessage()) . '</div>';
                }
            }
            echo '</div>';

            // =====================================================
            // TESTE 7: INFORMAÇÕES DO SERVIDOR
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>💻 Informações do Servidor</h2>';
            
            echo '<table>';
            echo '<tr><td>Versão PHP</td><td>' . PHP_VERSION . '</td></tr>';
            echo '<tr><td>Sistema Operacional</td><td>' . PHP_OS . '</td></tr>';
            echo '<tr><td>Servidor Web</td><td>' . ($_SERVER['SERVER_SOFTWARE'] ?? 'N/A') . '</td></tr>';
            echo '<tr><td>OpenSSL</td><td>' . (extension_loaded('openssl') ? OPENSSL_VERSION_TEXT : 'Não instalado') . '</td></tr>';
            echo '<tr><td>SMTP Debug Level</td><td>SMTP::DEBUG_SERVER</td></tr>';
            echo '<tr><td>Data/Hora Servidor</td><td>' . date('d/m/Y H:i:s T') . '</td></tr>';
            echo '<tr><td>Timezone</td><td>' . date_default_timezone_get() . '</td></tr>';
            echo '<tr><td>allow_url_fopen</td><td>' . (ini_get('allow_url_fopen') ? 'Habilitado' : 'Desabilitado') . '</td></tr>';
            echo '</table>';
            
            echo '</div>';

            // =====================================================
            // LOGS RECENTES
            // =====================================================
            echo '<div class="test-section">';
            echo '<h2>📋 Logs do Servidor (últimas linhas)</h2>';
            
            $log_files = [
                '/var/log/php-fpm.log',
                '/var/log/php8.1-fpm.log',
                '/var/log/php7.4-fpm.log',
                '/var/log/nginx/error.log'
            ];
            
            $found_logs = false;
            foreach ($log_files as $log_file) {
                if (file_exists($log_file) && is_readable($log_file)) {
                    $found_logs = true;
                    echo "<strong>" . basename($log_file) . ":</strong>";
                    $lines = array_slice(file($log_file), -10);
                    echo '<pre>' . htmlspecialchars(implode('', $lines)) . '</pre>';
                }
            }
            
            if (!$found_logs) {
                echo '<div class="result warning">⚠️ Nenhum arquivo de log acessível. Execute com sudo se necessário.</div>';
            }
            
            echo '</div>';
            ?>

        </div>

        <div class="footer">
            <p><strong>Sistema Presto</strong> - Diagnóstico de Email Completo</p>
            <p>Execute este script sempre que houver problemas com envio de emails</p>
            <a href="?refresh=1" class="btn">🔄 Executar Novamente</a>
        </div>
    </div>
</body>
</html>
