<?php
/**
 * CORRIGIR ssw.php - ADICIONAR global $dominio
 */
header('Content-Type: text/plain; charset=UTF-8');

echo "🔧 CORRIGINDO ssw.php...\n";
echo str_repeat("=", 80) . "\n\n";

$sswPath = '/var/www/html/lib/ssw.php';
$backupPath = '/var/www/html/lib/ssw.php.backup_' . date('Y-m-d_H-i-s');

if (!file_exists($sswPath)) {
    die("❌ ERRO: Arquivo não existe: $sswPath\n");
}

echo "1️⃣ Fazendo backup...\n";
if (!copy($sswPath, $backupPath)) {
    die("❌ ERRO: Não foi possível fazer backup!\n");
}
echo "✅ Backup criado: $backupPath\n\n";

echo "2️⃣ Lendo arquivo...\n";
$content = file_get_contents($sswPath);
if ($content === false) {
    die("❌ ERRO: Não foi possível ler o arquivo!\n");
}
echo "✅ Arquivo lido (" . strlen($content) . " bytes)\n\n";

echo "3️⃣ Procurando linha 7...\n";
$lines = explode("\n", $content);
echo "Total de linhas: " . count($lines) . "\n";
echo "Linha 7 ANTES: " . (isset($lines[6]) ? $lines[6] : '(não existe)') . "\n\n";

// Mostrar linhas 1-15 para contexto
echo "Linhas 1-15:\n";
echo str_repeat("-", 80) . "\n";
for ($i = 0; $i < 15 && $i < count($lines); $i++) {
    echo sprintf("%3d: %s\n", $i + 1, $lines[$i]);
}
echo str_repeat("-", 80) . "\n\n";

echo "4️⃣ Analisando funções...\n";

// Encontrar todas as funções que usam $dominio sem declarar global
$needsFix = false;
foreach ($lines as $lineNum => $line) {
    // Detectar início de função
    if (preg_match('/^function\s+(\w+)\s*\(/i', $line, $matches)) {
        $funcName = $matches[1];
        $funcStartLine = $lineNum;
        
        // Procurar dentro da função se usa $dominio
        $useDominio = false;
        $hasGlobalDominio = false;
        
        // Procurar até o fim da função (simplificado: próximas 50 linhas ou até encontrar "}")
        for ($i = $lineNum; $i < min($lineNum + 50, count($lines)); $i++) {
            if (preg_match('/^\s*global\s+.*\$dominio/i', $lines[$i])) {
                $hasGlobalDominio = true;
            }
            if (preg_match('/\$dominio/i', $lines[$i]) && !preg_match('/^\s*\/\//', $lines[$i])) {
                $useDominio = true;
            }
        }
        
        if ($useDominio && !$hasGlobalDominio) {
            echo "⚠️ Função '$funcName' (linha " . ($funcStartLine + 1) . ") usa \$dominio mas não declara global\n";
            $needsFix = true;
            
            // Adicionar global $dominio logo após a declaração da função
            $insertLine = $funcStartLine + 1;
            
            // Procurar a primeira linha não vazia após o "{"
            while ($insertLine < count($lines) && trim($lines[$insertLine]) === '') {
                $insertLine++;
            }
            
            // Se a linha já começa com "global", adicionar $dominio a ela
            if (preg_match('/^\s*global\s+/i', $lines[$insertLine])) {
                if (!preg_match('/\$dominio/', $lines[$insertLine])) {
                    $lines[$insertLine] = rtrim($lines[$insertLine], " ;\n") . ', $dominio;';
                    echo "   ✅ Adicionado \$dominio à declaração global existente na linha " . ($insertLine + 1) . "\n";
                }
            } else {
                // Inserir nova linha com "global $dominio;"
                array_splice($lines, $insertLine, 0, ['    global $dominio;']);
                echo "   ✅ Inserido 'global \$dominio;' na linha " . ($insertLine + 1) . "\n";
            }
        }
    }
}

if (!$needsFix) {
    echo "✅ Nenhuma correção necessária!\n";
    die();
}

echo "\n5️⃣ Salvando arquivo corrigido...\n";
$newContent = implode("\n", $lines);
if (file_put_contents($sswPath, $newContent) === false) {
    die("❌ ERRO: Não foi possível salvar o arquivo!\n");
}
echo "✅ Arquivo salvo\n\n";

echo "6️⃣ Verificando sintaxe...\n";
exec("php -l " . escapeshellarg($sswPath) . " 2>&1", $output, $return);
if ($return !== 0) {
    echo "❌ ERRO DE SINTAXE:\n";
    echo implode("\n", $output) . "\n\n";
    echo "Restaurando backup...\n";
    copy($backupPath, $sswPath);
    die("❌ Arquivo restaurado do backup\n");
}
echo "✅ Sintaxe OK\n\n";

echo str_repeat("=", 80) . "\n";
echo "✅ CORREÇÃO CONCLUÍDA COM SUCESSO!\n";
echo str_repeat("=", 80) . "\n";
echo "\nBackup salvo em: $backupPath\n";
echo "Você pode deletar o backup se tudo funcionar corretamente.\n";
?>
