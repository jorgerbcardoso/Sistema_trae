<?php
/**
 * DEEP VALIDATOR - Analisa ssw.php linha por linha
 */

echo "🔍 DEEP VALIDATION - ssw.php\n";
echo "==========================================\n\n";

$file = '/var/www/html/lib/ssw.php';

if (!file_exists($file)) {
    echo "❌ Arquivo não encontrado: $file\n";
    exit(1);
}

$lines = file($file);
$totalLines = count($lines);

echo "📄 Arquivo: $file\n";
echo "📊 Total de linhas: $totalLines\n\n";

// ============================================
// 1. VERIFICAR SINTAXE COMPLETA
// ============================================
echo "🔍 TESTE 1: Verificação de sintaxe completa\n";
echo "-------------------------------------------\n";
$output = [];
exec("php -l " . escapeshellarg($file) . " 2>&1", $output, $returnVar);
echo implode("\n", $output) . "\n\n";

if ($returnVar === 0) {
    echo "✅ Sintaxe OK!\n\n";
} else {
    echo "❌ ERRO DE SINTAXE DETECTADO\n\n";
    
    // Tentar extrair informações do erro
    foreach ($output as $line) {
        if (preg_match('/line (\d+)/', $line, $matches)) {
            $errorLine = (int)$matches[1];
            echo "🎯 LINHA COM ERRO: $errorLine\n\n";
            
            $start = max(0, $errorLine - 10);
            $end = min($totalLines, $errorLine + 10);
            
            echo "📋 CONTEXTO (10 linhas antes e depois):\n";
            echo "-------------------------------------------\n";
            for ($i = $start; $i < $end; $i++) {
                $lineNum = $i + 1;
                $prefix = ($lineNum == $errorLine) ? ">>> " : "    ";
                printf("%s%4d: %s", $prefix, $lineNum, $lines[$i]);
            }
            echo "-------------------------------------------\n\n";
        }
    }
}

// ============================================
// 2. VERIFICAR CHAVES E PARÊNTESES
// ============================================
echo "🔍 TESTE 2: Verificando balanceamento de chaves/parênteses\n";
echo "-------------------------------------------\n";

$braceStack = [];
$parenStack = [];
$bracketStack = [];
$errors = [];

foreach ($lines as $lineNum => $line) {
    $actualLineNum = $lineNum + 1;
    
    // Remover strings e comentários para não contar chaves dentro deles
    $cleanLine = preg_replace('/\/\/.*$/', '', $line); // Remove comentários //
    $cleanLine = preg_replace('/\/\*.*?\*\//', '', $cleanLine); // Remove /* */
    $cleanLine = preg_replace('/"(?:[^"\\\\]|\\\\.)*"/', '""', $cleanLine); // Remove strings ""
    $cleanLine = preg_replace("/'(?:[^'\\\\]|\\\\.)*'/", "''", $cleanLine); // Remove strings ''
    
    // Contar chaves
    for ($i = 0; $i < strlen($cleanLine); $i++) {
        $char = $cleanLine[$i];
        
        switch ($char) {
            case '{':
                $braceStack[] = $actualLineNum;
                break;
            case '}':
                if (empty($braceStack)) {
                    $errors[] = "Linha $actualLineNum: '}' fechando sem '{' correspondente";
                } else {
                    array_pop($braceStack);
                }
                break;
            case '(':
                $parenStack[] = $actualLineNum;
                break;
            case ')':
                if (empty($parenStack)) {
                    $errors[] = "Linha $actualLineNum: ')' fechando sem '(' correspondente";
                } else {
                    array_pop($parenStack);
                }
                break;
            case '[':
                $bracketStack[] = $actualLineNum;
                break;
            case ']':
                if (empty($bracketStack)) {
                    $errors[] = "Linha $actualLineNum: ']' fechando sem '[' correspondente";
                } else {
                    array_pop($bracketStack);
                }
                break;
        }
    }
}

// Verificar se sobrou algo aberto
if (!empty($braceStack)) {
    foreach ($braceStack as $openLine) {
        $errors[] = "Linha $openLine: '{' aberta mas não fechada";
    }
}
if (!empty($parenStack)) {
    foreach ($parenStack as $openLine) {
        $errors[] = "Linha $openLine: '(' aberto mas não fechado";
    }
}
if (!empty($bracketStack)) {
    foreach ($bracketStack as $openLine) {
        $errors[] = "Linha $openLine: '[' aberto mas não fechado";
    }
}

if (empty($errors)) {
    echo "✅ Chaves, parênteses e colchetes balanceados corretamente\n\n";
} else {
    echo "❌ ERROS DE BALANCEAMENTO:\n";
    foreach ($errors as $error) {
        echo "   $error\n";
    }
    echo "\n";
}

// ============================================
// 3. PROCURAR FUNÇÃO imp_ssw_gru
// ============================================
echo "🔍 TESTE 3: Localizando função imp_ssw_gru\n";
echo "-------------------------------------------\n";

$functionStart = null;
$functionEnd = null;
$braceCount = 0;
$insideFunction = false;

foreach ($lines as $lineNum => $line) {
    $actualLineNum = $lineNum + 1;
    
    // Procurar início da função
    if (preg_match('/function\s+imp_ssw_gru\s*\(/', $line)) {
        $functionStart = $actualLineNum;
        $insideFunction = true;
        echo "✅ Função encontrada na linha $actualLineNum\n";
        echo "   Conteúdo: " . trim($line) . "\n\n";
    }
    
    // Se estamos dentro da função, contar chaves
    if ($insideFunction) {
        // Remover strings e comentários
        $cleanLine = preg_replace('/\/\/.*$/', '', $line);
        $cleanLine = preg_replace('/\/\*.*?\*\//', '', $cleanLine);
        $cleanLine = preg_replace('/"(?:[^"\\\\]|\\\\.)*"/', '""', $cleanLine);
        $cleanLine = preg_replace("/'(?:[^'\\\\]|\\\\.)*'/", "''", $cleanLine);
        
        for ($i = 0; $i < strlen($cleanLine); $i++) {
            if ($cleanLine[$i] === '{') $braceCount++;
            if ($cleanLine[$i] === '}') $braceCount--;
            
            // Se chegou a 0, acabou a função
            if ($braceCount === 0 && $functionStart !== null) {
                $functionEnd = $actualLineNum;
                $insideFunction = false;
                break;
            }
        }
    }
}

if ($functionStart !== null) {
    if ($functionEnd !== null) {
        echo "📍 Função vai da linha $functionStart até linha $functionEnd\n";
        echo "📏 Total de linhas: " . ($functionEnd - $functionStart + 1) . "\n\n";
        
        // Mostrar a função completa (ou primeiras 50 linhas se for muito grande)
        $funcLength = $functionEnd - $functionStart + 1;
        if ($funcLength <= 100) {
            echo "📋 FUNÇÃO COMPLETA:\n";
            echo "-------------------------------------------\n";
            for ($i = $functionStart - 1; $i < $functionEnd; $i++) {
                printf("%4d: %s", $i + 1, $lines[$i]);
            }
            echo "-------------------------------------------\n\n";
        } else {
            echo "📋 PRIMEIRAS 50 LINHAS DA FUNÇÃO:\n";
            echo "-------------------------------------------\n";
            for ($i = $functionStart - 1; $i < $functionStart + 49; $i++) {
                printf("%4d: %s", $i + 1, $lines[$i]);
            }
            echo "-------------------------------------------\n";
            echo "... (função muito longa, mostrando apenas primeiras 50 linhas)\n\n";
        }
    } else {
        echo "❌ ERRO: Função iniciada na linha $functionStart mas NÃO TEM FECHAMENTO!\n";
        echo "   A função não tem '}' correspondente\n\n";
    }
} else {
    echo "❌ Função imp_ssw_gru NÃO ENCONTRADA no arquivo\n\n";
}

// ============================================
// 4. VALIDAÇÃO LINHA POR LINHA (últimas 100 linhas)
// ============================================
echo "🔍 TESTE 4: Validação linha por linha (últimas 100 linhas)\n";
echo "-------------------------------------------\n";
echo "Criando arquivo temporário para testar cada linha...\n\n";

$tempDir = '/tmp/ssw_validation_' . time();
mkdir($tempDir, 0777, true);

$start = max(0, $totalLines - 100);
$firstError = null;

for ($i = $start; $i < $totalLines; $i++) {
    $actualLineNum = $i + 1;
    
    // Criar arquivo temporário com as linhas até esta
    $tempFile = $tempDir . '/test_' . $actualLineNum . '.php';
    $tempContent = "<?php\n" . implode('', array_slice($lines, 0, $i + 1));
    file_put_contents($tempFile, $tempContent);
    
    // Testar sintaxe
    exec("php -l " . escapeshellarg($tempFile) . " 2>&1", $testOutput, $testReturn);
    
    if ($testReturn !== 0 && $firstError === null) {
        $firstError = $actualLineNum;
        echo "❌ PRIMEIRA LINHA COM ERRO: $actualLineNum\n";
        echo "   Conteúdo: " . trim($lines[$i]) . "\n";
        echo "   Erro: " . implode("\n         ", $testOutput) . "\n\n";
        
        // Mostrar contexto
        $contextStart = max(0, $i - 5);
        $contextEnd = min($totalLines, $i + 5);
        echo "📋 CONTEXTO:\n";
        for ($j = $contextStart; $j < $contextEnd; $j++) {
            $lineNum = $j + 1;
            $prefix = ($lineNum == $actualLineNum) ? ">>> " : "    ";
            printf("%s%4d: %s", $prefix, $lineNum, $lines[$j]);
        }
        break;
    }
    
    unlink($tempFile);
}

// Limpar diretório temporário
if (is_dir($tempDir)) {
    array_map('unlink', glob("$tempDir/*"));
    rmdir($tempDir);
}

if ($firstError === null) {
    echo "✅ Todas as linhas passaram na validação individual\n\n";
}

echo "\n✅ VALIDAÇÃO PROFUNDA COMPLETA!\n";
