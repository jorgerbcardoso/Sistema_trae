<?php
/**
 * DIAGNÓSTICO DO SISTEMA DE GERAÇÃO DE PDF
 * Acesse: /sistema/api/diagnostico_pdf.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';

?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnóstico de PDF - Sistema Presto</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 20px; background: #f4f4f9; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        h2 { color: #1e40af; margin-top: 30px; }
        .section { margin-bottom: 20px; padding: 15px; border-radius: 6px; border: 1px solid #ddd; }
        .success { border-left: 5px solid #10b981; background: #f0fdf4; }
        .error { border-left: 5px solid #ef4444; background: #fef2f2; }
        .warning { border-left: 5px solid #f59e0b; background: #fffbeb; }
        code { background: #eee; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
        pre { background: #1f2937; color: white; padding: 15px; border-radius: 6px; overflow: auto; }
    </style>
</head>
<body>
<div class="container">
    <h1>Diagnóstico de Geração de PDF</h1>

    <div class="section">
        <h2>1. Informações do Sistema</h2>
        <p>Sistema Operacional: <code><?php echo PHP_OS; ?></code></p>
        <p>Versão PHP: <code><?php echo PHP_VERSION; ?></code></p>
        <p>Usuário PHP (Server): <code><?php echo get_current_user(); ?></code></p>
    </div>

    <div class="section">
        <h2>2. Localização do wkhtmltopdf</h2>
        <?php
        $path = getWkhtmltopdfPath();
        if ($path) {
            echo "<p class='success'>✅ Executável encontrado em: <code>$path</code></p>";
            
            // Tentar obter versão
            $output = [];
            $return_var = -1;
            exec("$path --version 2>&1", $output, $return_var);
            
            if ($return_var === 0) {
                echo "<p class='success'>✅ Versão: <code>" . implode("", $output) . "</code></p>";
            } else {
                echo "<p class='error'>❌ Erro ao executar <code>--version</code>. Código: $return_var</p>";
                echo "<pre>" . implode("\n", $output) . "</pre>";
            }
        } else {
            echo "<p class='error'>❌ wkhtmltopdf NÃO ENCONTRADO em nenhum caminho conhecido.</p>";
            echo "<p>Caminhos testados:</p>";
            echo "<ul>
                <li><code>which wkhtmltopdf</code></li>
                <li>/usr/local/bin/wkhtmltopdf</li>
                <li>/usr/bin/wkhtmltopdf</li>
                <li>/bin/wkhtmltopdf</li>
                <li>/usr/sbin/wkhtmltopdf</li>
                <li>/sbin/wkhtmltopdf</li>
                <li>/var/www/html/bin/wkhtmltopdf</li>
            </ul>";
            echo "<p class='warning'>⚠️ <strong>Sugestão:</strong> Se você estiver no Debian/Ubuntu, execute: <code>sudo apt-get update && sudo apt-get install -y wkhtmltopdf</code></p>";
        }
        ?>
    </div>

    <div class="section">
        <h2>3. Permissões de Diretórios Temporários</h2>
        <?php
        $dirs = [
            '/tmp' => 'Diretório padrão do Linux',
            __DIR__ . '/tmp' => 'Diretório local da API',
            '/var/www/html/sistema/api/tmp' => 'Diretório absoluto sugerido'
        ];

        foreach ($dirs as $dir => $desc) {
            echo "<p><strong>$dir</strong> ($desc): ";
            if (file_exists($dir)) {
                if (is_writable($dir)) {
                    echo "<span class='success'>✅ Gravável</span>";
                } else {
                    echo "<span class='error'>❌ Não gravável</span>";
                }
            } else {
                echo "<span class='warning'>⚠️ Não existe</span>";
                if (@mkdir($dir, 0777, true)) {
                    echo " - <span class='success'>Criado com sucesso</span>";
                } else {
                    echo " - <span class='error'>Falha ao criar</span>";
                }
            }
            echo "</p>";
        }
        ?>
    </div>

    <div class="section">
        <h2>4. Teste de Geração de PDF</h2>
        <?php
        if ($path) {
            $temp_dir = is_writable('/tmp') ? '/tmp' : __DIR__ . '/tmp';
            $test_html = $temp_dir . '/test_' . uniqid() . '.html';
            $test_pdf = $temp_dir . '/test_' . uniqid() . '.pdf';
            
            $html = "<html><body><h1>Teste de PDF</h1><p>Gerado em: " . date('d/m/Y H:i:s') . "</p></body></html>";
            file_put_contents($test_html, $html);
            
            $cmd = "$path --enable-local-file-access --page-size A4 $test_html $test_pdf 2>&1";
            echo "<p>Executando: <code>$cmd</code></p>";
            
            $output = [];
            $return_var = -1;
            exec($cmd, $output, $return_var);
            
            if ($return_var === 0 && file_exists($test_pdf)) {
                echo "<p class='success'>✅ PDF de teste gerado com sucesso! (" . filesize($test_pdf) . " bytes)</p>";
                @unlink($test_html);
                @unlink($test_pdf);
            } else {
                echo "<p class='error'>❌ Falha ao gerar PDF de teste. Código: $return_var</p>";
                echo "<pre>" . implode("\n", $output) . "</pre>";
            }
        } else {
            echo "<p class='warning'>⚠️ Teste de geração ignorado pois o executável não foi encontrado.</p>";
        }
        ?>
    </div>
</div>
</body>
</html>
