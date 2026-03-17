<?php
/**
 * TESTAR IMPORT EVENTOS - VER ERRO RAW
 */

// Capturar TUDO (output buffer)
ob_start();

// Forçar exibição de erros
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "========================================\n";
echo "🔥 TESTE IMPORT EVENTOS - RAW\n";
echo "========================================\n\n";

try {
    echo "1️⃣ Carregando config.php...\n";
    require_once __DIR__ . '/../config.php';
    echo "✅ Config carregado\n\n";
    
    echo "2️⃣ Carregando ssw_loader.php...\n";
    require_once __DIR__ . '/../lib/ssw_loader.php';
    echo "✅ SSW Loader carregado\n\n";
    
    echo "3️⃣ Tentando carregar SSW...\n";
    require_ssw();
    echo "✅ SSW carregado com sucesso\n\n";
    
    echo "4️⃣ Verificando função imp_ssw_eve...\n";
    if (!function_exists('imp_ssw_eve')) {
        throw new Exception("Função imp_ssw_eve não existe!");
    }
    echo "✅ Função imp_ssw_eve existe\n\n";
    
    echo "5️⃣ Testando conexão com banco...\n";
    if (!isDatabaseConfigured()) {
        throw new Exception("Banco de dados não configurado!");
    }
    $conn = getDBConnection();
    echo "✅ Conexão OK\n\n";
    
    echo "6️⃣ Definindo variável global \$dominio...\n";
    global $dominio;
    $dominio = 'DMN';
    echo "✅ \$dominio = $dominio\n\n";
    
    echo "7️⃣ CHAMANDO imp_ssw_eve()...\n";
    echo str_repeat("-", 80) . "\n";
    
    imp_ssw_eve();
    
    echo "\n" . str_repeat("-", 80) . "\n";
    echo "✅ SUCESSO!\n";
    
    closeDBConnection($conn);
    
} catch (Throwable $e) {
    echo "\n" . str_repeat("=", 80) . "\n";
    echo "❌ ERRO CAPTURADO:\n";
    echo str_repeat("=", 80) . "\n";
    echo "Tipo: " . get_class($e) . "\n";
    echo "Mensagem: " . $e->getMessage() . "\n";
    echo "Arquivo: " . $e->getFile() . "\n";
    echo "Linha: " . $e->getLine() . "\n\n";
    echo "Stack Trace:\n";
    echo $e->getTraceAsString() . "\n";
}

// Capturar todo o output
$output = ob_get_clean();

// Retornar como texto puro
header('Content-Type: text/plain; charset=UTF-8');
echo $output;
?>
