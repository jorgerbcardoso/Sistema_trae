<?php
/**
 * VALIDADOR DE SINTAXE PHP
 * Execute este arquivo via linha de comando para verificar erros no ssw.php
 */

echo "🔍 VALIDANDO SINTAXE DO ARQUIVO ssw.php\n";
echo "==========================================\n\n";

$file = '/var/www/html/lib/ssw.php';

if (!file_exists($file)) {
    echo "❌ ERRO: Arquivo não encontrado: $file\n";
    exit(1);
}

echo "📄 Arquivo: $file\n";
echo "📊 Tamanho: " . filesize($file) . " bytes\n\n";

// Verificar sintaxe usando php -l
echo "🔍 Verificando sintaxe...\n";
$output = [];
$return_var = 0;
exec("php -l " . escapeshellarg($file) . " 2>&1", $output, $return_var);

echo implode("\n", $output) . "\n\n";

if ($return_var !== 0) {
    echo "❌ ERRO DE SINTAXE ENCONTRADO!\n";
    echo "==========================================\n";
    
    // Tentar identificar a linha com erro
    foreach ($output as $line) {
        if (preg_match('/line (\d+)/', $line, $matches)) {
            $errorLine = (int)$matches[1];
            echo "🎯 Erro na linha $errorLine\n\n";
            
            // Ler o arquivo e mostrar contexto
            $lines = file($file);
            $start = max(0, $errorLine - 5);
            $end = min(count($lines), $errorLine + 5);
            
            echo "📋 CONTEXTO:\n";
            echo "-------------------------------------------\n";
            for ($i = $start; $i < $end; $i++) {
                $lineNum = $i + 1;
                $prefix = ($lineNum == $errorLine) ? ">>> " : "    ";
                printf("%s%4d: %s", $prefix, $lineNum, $lines[$i]);
            }
            echo "-------------------------------------------\n\n";
        }
    }
    
    exit(1);
} else {
    echo "✅ Sintaxe OK!\n\n";
    
    // Agora tentar carregar e verificar a função
    echo "🔍 Tentando carregar o arquivo...\n";
    try {
        require_once $file;
        echo "✅ Arquivo carregado com sucesso!\n\n";
        
        // Verificar se a função existe
        if (function_exists('imp_ssw_gru')) {
            echo "✅ Função imp_ssw_gru() encontrada!\n";
            
            // Obter informações da função
            $reflection = new ReflectionFunction('imp_ssw_gru');
            echo "📋 Parâmetros: " . $reflection->getNumberOfParameters() . "\n";
            echo "📍 Definida em: " . $reflection->getFileName() . ":" . $reflection->getStartLine() . "\n";
            
            $params = $reflection->getParameters();
            if (!empty($params)) {
                echo "📝 Assinatura:\n";
                foreach ($params as $param) {
                    $optional = $param->isOptional() ? ' (opcional)' : ' (obrigatório)';
                    $default = $param->isOptional() ? ' = ' . var_export($param->getDefaultValue(), true) : '';
                    echo "   - \$" . $param->getName() . $optional . $default . "\n";
                }
            }
        } else {
            echo "❌ Função imp_ssw_gru() NÃO encontrada no arquivo!\n";
        }
        
    } catch (ParseError $e) {
        echo "❌ ERRO DE PARSE:\n";
        echo "   Mensagem: " . $e->getMessage() . "\n";
        echo "   Arquivo: " . $e->getFile() . "\n";
        echo "   Linha: " . $e->getLine() . "\n";
        exit(1);
    } catch (Throwable $e) {
        echo "❌ ERRO AO CARREGAR:\n";
        echo "   Mensagem: " . $e->getMessage() . "\n";
        echo "   Arquivo: " . $e->getFile() . "\n";
        echo "   Linha: " . $e->getLine() . "\n";
        exit(1);
    }
}

echo "\n✅ VALIDAÇÃO COMPLETA!\n";
