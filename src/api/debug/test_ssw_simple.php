<?php
/**
 * TESTAR SSW - VERSÃO SIMPLES
 */
header('Content-Type: text/plain; charset=UTF-8');

echo "🔍 TESTE SSW - " . date('Y-m-d H:i:s') . "\n";
echo str_repeat("=", 80) . "\n\n";

$sswPath = '/var/www/html/lib/ssw.php';

echo "1️⃣ Verificando se arquivo existe...\n";
if (!file_exists($sswPath)) {
    die("❌ ERRO: Arquivo não existe: $sswPath\n");
}
echo "✅ Arquivo existe\n\n";

echo "2️⃣ Verificando sintaxe PHP...\n";
exec("php -l " . escapeshellarg($sswPath) . " 2>&1", $output, $return);

if ($return !== 0) {
    echo "❌ ERRO DE SINTAXE ENCONTRADO:\n";
    echo str_repeat("-", 80) . "\n";
    echo implode("\n", $output) . "\n";
    echo str_repeat("-", 80) . "\n";
    die("\n❌ Corrija o erro de sintaxe antes de continuar!\n");
}
echo "✅ Sintaxe OK\n\n";

echo "3️⃣ Tentando carregar arquivo...\n";
try {
    require_once $sswPath;
    echo "✅ Arquivo carregado com sucesso!\n\n";
} catch (Throwable $e) {
    echo "❌ ERRO AO CARREGAR:\n";
    echo "   Classe: " . get_class($e) . "\n";
    echo "   Mensagem: " . $e->getMessage() . "\n";
    echo "   Arquivo: " . $e->getFile() . "\n";
    echo "   Linha: " . $e->getLine() . "\n\n";
    echo "Stack Trace:\n";
    echo $e->getTraceAsString() . "\n";
    die();
}

echo "4️⃣ Verificando funções...\n";
$functions = ['imp_ssw_gru', 'imp_ssw_eve'];
foreach ($functions as $func) {
    if (function_exists($func)) {
        echo "✅ $func existe\n";
    } else {
        echo "❌ $func NÃO existe\n";
    }
}

echo "\n✅ TODOS OS TESTES PASSARAM!\n";
?>
