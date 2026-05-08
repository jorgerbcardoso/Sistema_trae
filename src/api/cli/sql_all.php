<?php
/**
 * CLI Script - Executa SQL em todos os domínios
 * Uso: php sql_all.php "comando SQL com % como placeholder do domínio"
 *
 * Exemplo: php sql_all.php "UPDATE %_cte SET status = 'X' WHERE id = 1"
 */

if ($argc < 2) {
    fwrite(STDERR, "Uso: php " . $argv[0] . " \"comando SQL\"\n");
    fwrite(STDERR, "Exemplo: php " . $argv[0] . " \"UPDATE %_cte SET status = 'X' WHERE id = 1\"\n");
    exit(1);
}

$command = $argv[1];

// Carregar config
require_once __DIR__ . '/../../config.php';

// Conectar ao PostgreSQL
$g_sql = connect();

// Buscar todos os domínios (exceto XXX)
$query = "SELECT domain FROM domains WHERE domain != 'XXX' ORDER BY domain";
$result = sql($query, [], $g_sql);

$dominios = [];
while ($row = pg_fetch_assoc($result)) {
    $dominios[] = $row['domain'];
}

echo "Domínios encontrados: " . count($dominios) . "\n\n";

$successCount = 0;
$errorCount = 0;

foreach ($dominios as $domain) {
    echo "Processando domínio: $domain ... ";
    
    // Substituir % pelo domínio
    $sql = str_replace('%', $domain, $command);
    
    // Executar o comando
    $result = sql($sql, [], $g_sql);
    
    if ($result === false) {
        $error = pg_last_error($g_sql);
        echo "ERRO: $error\n";
        echo "Comando SQL: $sql\n";
        $errorCount++;
    } else {
        $affected = pg_affected_rows($result);
        echo "OK (linhas afetadas: $affected)\n";
        $successCount++;
    }
}

echo "\n========================================\n";
echo "Total de domínios processados: " . count($dominios) . "\n";
echo "Sucessos: $successCount\n";
echo "Erros: $errorCount\n";
