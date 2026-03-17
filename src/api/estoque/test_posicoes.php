<?php
/**
 * TESTE RÁPIDO - Verificar se API de Posições pode funcionar
 * Acesse: http://seu-dominio/api/estoque/test_posicoes.php
 */

// Habilitar exibição de erros
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>TESTE - API POSIÇÕES</h1>";

// 1. Testar carregamento do config
echo "<h2>1. Testando config.php...</h2>";
try {
    require_once '/var/www/html/sistema/api/config.php';
    echo "✅ config.php carregado com sucesso<br>";
    echo "DOMAIN_PREFIX: " . (defined('DOMAIN_PREFIX') ? DOMAIN_PREFIX : 'NÃO DEFINIDO') . "<br>";
} catch (Exception $e) {
    echo "❌ ERRO ao carregar config.php: " . $e->getMessage() . "<br>";
    die();
}

// 2. Testar carregamento do helper
echo "<h2>2. Testando helper...</h2>";
try {
    require_once '/var/www/html/sistema/api/estoque_compras_helper.php';
    echo "✅ Helper carregado com sucesso<br>";
    
    // Verificar funções
    if (function_exists('setupCORS')) echo "✅ Função setupCORS existe<br>";
    if (function_exists('handleOptionsRequest')) echo "✅ Função handleOptionsRequest existe<br>";
    if (function_exists('requireAuth')) echo "✅ Função requireAuth existe<br>";
    if (function_exists('getCurrentUser')) echo "✅ Função getCurrentUser existe<br>";
    
} catch (Exception $e) {
    echo "❌ ERRO ao carregar helper: " . $e->getMessage() . "<br>";
    die();
}

// 3. Testar conexão global
echo "<h2>3. Testando conexão global...</h2>";
global $g_sql;
if ($g_sql) {
    echo "✅ Conexão \$g_sql existe<br>";
    
    // Testar query simples
    try {
        $result = pg_query($g_sql, "SELECT version()");
        if ($result) {
            $row = pg_fetch_assoc($result);
            echo "✅ PostgreSQL conectado: " . $row['version'] . "<br>";
        }
    } catch (Exception $e) {
        echo "❌ ERRO ao testar PostgreSQL: " . $e->getMessage() . "<br>";
    }
} else {
    echo "❌ Conexão \$g_sql NÃO existe<br>";
}

// 4. Testar se tabelas existem
echo "<h2>4. Testando tabelas...</h2>";
$domain = defined('DOMAIN_PREFIX') ? DOMAIN_PREFIX : 'acv';
$tabelas = ['posicao', 'requisicao', 'requisicao_item', 'mvto_estoque', 'estoque', 'item'];

foreach ($tabelas as $tabela) {
    $nomeTabela = $domain . '_' . $tabela;
    try {
        $query = "SELECT COUNT(*) as total FROM $nomeTabela LIMIT 1";
        $result = pg_query($g_sql, $query);
        if ($result) {
            $row = pg_fetch_assoc($result);
            echo "✅ Tabela $nomeTabela existe (registros: " . $row['total'] . ")<br>";
        }
    } catch (Exception $e) {
        echo "❌ Tabela $nomeTabela NÃO existe ou erro: " . pg_last_error($g_sql) . "<br>";
    }
}

echo "<hr>";
echo "<h2>CONCLUSÃO</h2>";
echo "<p>Se alguma tabela não existe, execute:</p>";
echo "<pre>psql -U usuario -d banco -f /var/www/html/sistema/database/migrations/create_estoque_tables_complete.sql</pre>";
