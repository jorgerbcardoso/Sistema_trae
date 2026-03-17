<?php
/**
 * ================================================================
 * ARQUIVO DEBUG - PERFORMANCE DE COLETAS
 * ================================================================
 * Use este arquivo para testar e debugar problemas das APIs
 * Acesse: /api/dashboards/performance-coletas/debug.php
 * ================================================================
 */

// Forçar exibição de erros
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "<h1>🔍 DEBUG - Performance de Coletas</h1>";
echo "<hr>";

// ================================================================
// TESTE 1: Verificar se PHP está funcionando
// ================================================================
echo "<h2>✅ TESTE 1: PHP está funcionando</h2>";
echo "Versão do PHP: " . phpversion() . "<br>";
echo "Data/Hora: " . date('d/m/Y H:i:s') . "<br>";
echo "<hr>";

// ================================================================
// TESTE 2: Verificar se o arquivo ssw.php existe
// ================================================================
echo "<h2>TESTE 2: Verificar arquivo ssw.php</h2>";
$sswPath = '/var/www/html/lib/ssw.php';
if (file_exists($sswPath)) {
    echo "✅ Arquivo existe: $sswPath<br>";
    echo "Permissões: " . substr(sprintf('%o', fileperms($sswPath)), -4) . "<br>";
} else {
    echo "❌ Arquivo NÃO existe: $sswPath<br>";
}
echo "<hr>";

// ================================================================
// TESTE 3: Tentar fazer require do ssw.php
// ================================================================
echo "<h2>TESTE 3: Carregar ssw.php</h2>";
try {
    require_once $sswPath;
    echo "✅ ssw.php carregado com sucesso<br>";
    
    // Verificar se função existe
    if (function_exists('ssw_login')) {
        echo "✅ Função ssw_login() existe<br>";
    } else {
        echo "❌ Função ssw_login() NÃO existe<br>";
    }
    
    if (function_exists('ssw_go')) {
        echo "✅ Função ssw_go() existe<br>";
    } else {
        echo "❌ Função ssw_go() NÃO existe<br>";
    }
    
} catch (Exception $e) {
    echo "❌ Erro ao carregar ssw.php: " . $e->getMessage() . "<br>";
}
echo "<hr>";

// ================================================================
// TESTE 4: Verificar se lib.php carrega
// ================================================================
echo "<h2>TESTE 4: Carregar lib.php</h2>";
try {
    require_once __DIR__ . '/lib.php';
    echo "✅ lib.php carregado com sucesso<br>";
    
    // Verificar se funções existem
    $functions = [
        'createTempColetasTable',
        'buildUnidadeColetaFilter',
        'getColetasCountBySituacao',
        'getColetasAnaliseDiaria',
        'getColetasEvolucao',
        'getColetasComparativo',
        'getColetasForExport'
    ];
    
    foreach ($functions as $func) {
        if (function_exists($func)) {
            echo "✅ Função $func() existe<br>";
        } else {
            echo "❌ Função $func() NÃO existe<br>";
        }
    }
    
} catch (Exception $e) {
    echo "❌ Erro ao carregar lib.php: " . $e->getMessage() . "<br>";
    echo "Stack trace:<br><pre>" . $e->getTraceAsString() . "</pre>";
}
echo "<hr>";

// ================================================================
// TESTE 5: Verificar conexão com PostgreSQL
// ================================================================
echo "<h2>TESTE 5: Conexão PostgreSQL</h2>";
try {
    require_once __DIR__ . '/../../lib/includes.php';
    require_once __DIR__ . '/../../lib/token_validation.php';
    
    // Validar token (se necessário)
    // $decoded = validateToken();
    // $domain = $decoded->data->domain;
    
    // Por enquanto, usar domínio fixo para teste
    $domain = 'demo'; // ALTERE PARA SEU DOMÍNIO DE TESTE
    
    conectar_bd($domain);
    
    if ($g_sql) {
        echo "✅ Conexão com PostgreSQL estabelecida<br>";
        
        // Testar query simples
        $testQuery = "SELECT NOW() as agora";
        $result = pg_query($g_sql, $testQuery);
        
        if ($result) {
            $row = pg_fetch_assoc($result);
            echo "✅ Query de teste executada: " . $row['agora'] . "<br>";
        } else {
            echo "❌ Erro na query de teste: " . pg_last_error($g_sql) . "<br>";
        }
        
    } else {
        echo "❌ Erro ao conectar no PostgreSQL<br>";
    }
    
} catch (Exception $e) {
    echo "❌ Erro no teste PostgreSQL: " . $e->getMessage() . "<br>";
}
echo "<hr>";

// ================================================================
// TESTE 6: Testar createTempColetasTable
// ================================================================
echo "<h2>TESTE 6: Testar createTempColetasTable()</h2>";
if (isset($g_sql) && $g_sql) {
    try {
        $filters = [
            'periodoLancamentoInicio' => '2024-01-01',
            'periodoLancamentoFim' => '2024-12-31'
        ];
        
        echo "Chamando createTempColetasTable()...<br>";
        $result = createTempColetasTable($g_sql, $domain, $filters, 'cards');
        
        if ($result) {
            echo "✅ createTempColetasTable() executada com sucesso<br>";
            
            // Contar registros
            $countQuery = "SELECT COUNT(*) as total FROM tmp_coleta";
            $countResult = pg_query($g_sql, $countQuery);
            
            if ($countResult) {
                $countRow = pg_fetch_assoc($countResult);
                echo "Total de registros na tmp_coleta: " . $countRow['total'] . "<br>";
            }
        } else {
            echo "❌ createTempColetasTable() retornou false<br>";
        }
        
    } catch (Exception $e) {
        echo "❌ Erro ao testar createTempColetasTable(): " . $e->getMessage() . "<br>";
        echo "Stack trace:<br><pre>" . $e->getTraceAsString() . "</pre>";
    }
} else {
    echo "⚠️ Pulado (sem conexão PostgreSQL)<br>";
}
echo "<hr>";

echo "<h2>🎯 FIM DOS TESTES</h2>";
echo "<p>Se todos os testes passaram, o problema pode estar:</p>";
echo "<ul>";
echo "<li>Na validação do token JWT</li>";
echo "<li>Na lógica específica de cada endpoint</li>";
echo "<li>Na chamada ssw_login() ou ssw_go()</li>";
echo "<li>Em permissões de acesso aos arquivos</li>";
echo "</ul>";
?>
