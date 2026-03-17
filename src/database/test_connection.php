<?php
/**
 * ============================================================================
 * TESTE DE CONEXÃO COM O SERVIDOR PRESTO
 * ============================================================================
 * 
 * Este script testa a conexão com o banco de dados PostgreSQL no servidor
 * remoto e verifica se as credenciais estão corretas.
 * 
 * USO:
 * 1. Abra este arquivo em seu navegador local
 * 2. Ou execute via CLI: php test_connection.php
 * 
 * ============================================================================
 */

// ============================================================================
// CONFIGURAÇÃO DO SERVIDOR
// ============================================================================

// Credenciais do servidor remoto (ajuste conforme necessário)
$DB_CONFIG = [
    'host' => 'webpresto.com.br',  // Seu servidor
    'port' => '5432',               // Porta padrão do PostgreSQL
    'database' => 'presto',         // Nome do banco
    'username' => 'postgres',       // Usuário (ajuste conforme suas credenciais)
    'password' => 'sua_senha_aqui', // ⚠️ AJUSTE AQUI
];

// ============================================================================
// CONFIGURAÇÃO DE EXIBIÇÃO
// ============================================================================

// Se executando via CLI
$IS_CLI = php_sapi_name() === 'cli';

if (!$IS_CLI) {
    header('Content-Type: text/html; charset=UTF-8');
    echo "<!DOCTYPE html>
<html lang='pt-BR'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Teste de Conexão - Sistema Presto</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 800px;
            width: 100%;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .content { padding: 30px; }
        .test-section {
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid #e5e7eb;
        }
        .test-section h2 {
            font-size: 18px;
            margin-bottom: 15px;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .status.success {
            background: #d1fae5;
            color: #065f46;
        }
        .status.error {
            background: #fee2e2;
            color: #991b1b;
        }
        .status.warning {
            background: #fef3c7;
            color: #92400e;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 12px;
            margin-top: 15px;
            font-size: 14px;
        }
        .info-label {
            font-weight: 600;
            color: #6b7280;
        }
        .info-value {
            color: #1f2937;
            font-family: 'Monaco', 'Courier New', monospace;
            background: #f9fafb;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .error-box {
            background: #fee2e2;
            border: 2px solid #fecaca;
            color: #991b1b;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            font-size: 14px;
        }
        .success-box {
            background: #d1fae5;
            border: 2px solid #a7f3d0;
            color: #065f46;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            font-size: 14px;
        }
        .code {
            background: #1f2937;
            color: #10b981;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre;
        }
        .footer {
            background: #f9fafb;
            padding: 20px 30px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>🔌 Teste de Conexão</h1>
            <p>Sistema Presto - Verificação de Conectividade com Servidor Remoto</p>
        </div>
        <div class='content'>";
}

// ============================================================================
// FUNÇÃO DE LOG
// ============================================================================

function logMessage($message, $type = 'info') {
    global $IS_CLI;
    
    if ($IS_CLI) {
        $prefix = match($type) {
            'success' => '✅',
            'error' => '❌',
            'warning' => '⚠️',
            default => 'ℹ️'
        };
        echo "$prefix $message\n";
    } else {
        $class = match($type) {
            'success' => 'success-box',
            'error' => 'error-box',
            default => 'info-box'
        };
        echo "<div class='$class'>$message</div>";
    }
}

// ============================================================================
// TESTE 1: Verificar extensão PostgreSQL
// ============================================================================

if (!$IS_CLI) echo "<div class='test-section'>";
if (!$IS_CLI) echo "<h2>📦 Teste 1: Extensão PostgreSQL</h2>";

if ($IS_CLI) echo "\n" . str_repeat('=', 70) . "\n";
if ($IS_CLI) echo "TESTE 1: Extensão PostgreSQL\n";
if ($IS_CLI) echo str_repeat('=', 70) . "\n";

if (!extension_loaded('pgsql')) {
    logMessage('❌ ERRO: Extensão pgsql não está instalada!', 'error');
    if ($IS_CLI) {
        echo "\nPara instalar no Ubuntu/Debian:\n";
        echo "sudo apt-get install php-pgsql\n";
        echo "sudo systemctl restart apache2\n\n";
    }
    if (!$IS_CLI) echo "</div></div></body></html>";
    exit(1);
} else {
    logMessage('✅ Extensão pgsql está instalada e carregada', 'success');
}

if (!$IS_CLI) echo "</div>";

// ============================================================================
// TESTE 2: Teste de conexão
// ============================================================================

if (!$IS_CLI) echo "<div class='test-section'>";
if (!$IS_CLI) echo "<h2>🔐 Teste 2: Conexão com o Servidor</h2>";

if ($IS_CLI) echo "\n" . str_repeat('=', 70) . "\n";
if ($IS_CLI) echo "TESTE 2: Conexão com o Servidor\n";
if ($IS_CLI) echo str_repeat('=', 70) . "\n";

// Montar string de conexão
$connString = sprintf(
    "host=%s port=%s dbname=%s user=%s password=%s",
    $DB_CONFIG['host'],
    $DB_CONFIG['port'],
    $DB_CONFIG['database'],
    $DB_CONFIG['username'],
    $DB_CONFIG['password']
);

if (!$IS_CLI) {
    echo "<div class='info-grid'>";
    echo "<div class='info-label'>Host:</div><div class='info-value'>{$DB_CONFIG['host']}</div>";
    echo "<div class='info-label'>Porta:</div><div class='info-value'>{$DB_CONFIG['port']}</div>";
    echo "<div class='info-label'>Banco:</div><div class='info-value'>{$DB_CONFIG['database']}</div>";
    echo "<div class='info-label'>Usuário:</div><div class='info-value'>{$DB_CONFIG['username']}</div>";
    echo "</div>";
}

if ($IS_CLI) {
    echo "Host: {$DB_CONFIG['host']}\n";
    echo "Porta: {$DB_CONFIG['port']}\n";
    echo "Banco: {$DB_CONFIG['database']}\n";
    echo "Usuário: {$DB_CONFIG['username']}\n\n";
}

// Tentar conectar
$startTime = microtime(true);
$conn = @pg_connect($connString);
$endTime = microtime(true);
$connectionTime = round(($endTime - $startTime) * 1000, 2);

if (!$conn) {
    $error = pg_last_error();
    logMessage("❌ FALHA NA CONEXÃO! ($connectionTime ms)", 'error');
    if (!$IS_CLI) {
        echo "<div class='error-box'>Erro: " . htmlspecialchars($error) . "</div>";
    } else {
        echo "Erro: $error\n";
    }
    
    if (!$IS_CLI) echo "</div></div></body></html>";
    exit(1);
} else {
    logMessage("✅ Conexão estabelecida com sucesso! ($connectionTime ms)", 'success');
}

if (!$IS_CLI) echo "</div>";

// ============================================================================
// TESTE 3: Verificar estrutura do banco
// ============================================================================

if (!$IS_CLI) echo "<div class='test-section'>";
if (!$IS_CLI) echo "<h2>🗄️  Teste 3: Estrutura do Banco</h2>";

if ($IS_CLI) echo "\n" . str_repeat('=', 70) . "\n";
if ($IS_CLI) echo "TESTE 3: Estrutura do Banco\n";
if ($IS_CLI) echo str_repeat('=', 70) . "\n";

// Verificar se as tabelas principais existem
$tables = ['domains', 'users', 'menu_items', 'permissions', 'user_permissions'];
$tablesExist = [];

foreach ($tables as $table) {
    $query = "SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '$table'
    )";
    
    $result = pg_query($conn, $query);
    $row = pg_fetch_row($result);
    $exists = $row[0] === 't';
    $tablesExist[$table] = $exists;
    
    $status = $exists ? '✅' : '❌';
    if ($IS_CLI) {
        echo "$status Tabela '$table': " . ($exists ? 'EXISTE' : 'NÃO EXISTE') . "\n";
    } else {
        $statusClass = $exists ? 'success' : 'error';
        $statusText = $exists ? 'EXISTE' : 'NÃO EXISTE';
        echo "<div style='margin: 8px 0;'>$status <strong>$table</strong>: <span class='status $statusClass'>$statusText</span></div>";
    }
}

$allTablesExist = !in_array(false, $tablesExist);

if (!$allTablesExist) {
    logMessage('⚠️  AVISO: Algumas tabelas não existem. Execute o schema.sql primeiro!', 'warning');
    if (!$IS_CLI) {
        echo "<div class='code'>psql -U postgres -d presto -f database/schema.sql</div>";
    }
}

if (!$IS_CLI) echo "</div>";

// ============================================================================
// TESTE 4: Consultar dados
// ============================================================================

if ($allTablesExist) {
    if (!$IS_CLI) echo "<div class='test-section'>";
    if (!$IS_CLI) echo "<h2>📊 Teste 4: Consulta de Dados</h2>";
    
    if ($IS_CLI) echo "\n" . str_repeat('=', 70) . "\n";
    if ($IS_CLI) echo "TESTE 4: Consulta de Dados\n";
    if ($IS_CLI) echo str_repeat('=', 70) . "\n";
    
    // Contar domínios
    $result = pg_query($conn, "SELECT COUNT(*) FROM domains");
    $row = pg_fetch_row($result);
    $domainCount = $row[0];
    
    // Contar usuários
    $result = pg_query($conn, "SELECT COUNT(*) FROM users");
    $row = pg_fetch_row($result);
    $userCount = $row[0];
    
    // Listar domínios
    $result = pg_query($conn, "SELECT domain, name, modalidade, is_active FROM domains ORDER BY domain");
    
    if ($IS_CLI) {
        echo "Total de Domínios: $domainCount\n";
        echo "Total de Usuários: $userCount\n\n";
        echo "Domínios cadastrados:\n";
        while ($domain = pg_fetch_assoc($result)) {
            $active = $domain['is_active'] === 't' ? '✅ ATIVO' : '❌ INATIVO';
            echo "  • {$domain['domain']} - {$domain['name']} ({$domain['modalidade']}) - $active\n";
        }
    } else {
        echo "<div class='info-grid'>";
        echo "<div class='info-label'>Total de Domínios:</div><div class='info-value'>$domainCount</div>";
        echo "<div class='info-label'>Total de Usuários:</div><div class='info-value'>$userCount</div>";
        echo "</div>";
        
        echo "<div style='margin-top: 20px;'><strong>Domínios cadastrados:</strong></div>";
        echo "<ul style='margin-top: 10px; margin-left: 20px;'>";
        while ($domain = pg_fetch_assoc($result)) {
            $active = $domain['is_active'] === 't' ? '✅ ATIVO' : '❌ INATIVO';
            echo "<li style='margin: 5px 0;'><strong>{$domain['domain']}</strong> - {$domain['name']} ({$domain['modalidade']}) - $active</li>";
        }
        echo "</ul>";
    }
    
    if (!$IS_CLI) echo "</div>";
}

// ============================================================================
// TESTE 5: Teste de API REST (simulação)
// ============================================================================

if (!$IS_CLI) echo "<div class='test-section'>";
if (!$IS_CLI) echo "<h2>🌐 Teste 5: API REST (Simulação)</h2>";

if ($IS_CLI) echo "\n" . str_repeat('=', 70) . "\n";
if ($IS_CLI) echo "TESTE 5: API REST (Simulação)\n";
if ($IS_CLI) echo str_repeat('=', 70) . "\n";

if ($allTablesExist) {
    // Simular consulta da API GET /api/domains
    $result = pg_query($conn, "
        SELECT 
            domain, 
            name, 
            client_name, 
            modalidade, 
            is_active,
            total_users,
            total_permissions
        FROM domains 
        WHERE is_active = true 
        ORDER BY domain
    ");
    
    $domains = [];
    while ($row = pg_fetch_assoc($result)) {
        // Converter booleanos PostgreSQL para PHP
        $row['is_active'] = $row['is_active'] === 't';
        $domains[] = $row;
    }
    
    $json = json_encode(['success' => true, 'data' => $domains], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    logMessage('✅ Simulação de API GET /api/domains executada com sucesso', 'success');
    
    if (!$IS_CLI) {
        echo "<div style='margin-top: 15px;'><strong>Exemplo de resposta JSON:</strong></div>";
        echo "<div class='code'>" . htmlspecialchars($json) . "</div>";
    } else {
        echo "\nExemplo de resposta JSON:\n";
        echo $json . "\n";
    }
} else {
    logMessage('⚠️  Tabelas não existem, não é possível simular API', 'warning');
}

if (!$IS_CLI) echo "</div>";

// ============================================================================
// RESUMO FINAL
// ============================================================================

if (!$IS_CLI) echo "<div class='test-section' style='background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-color: #10b981;'>";
if (!$IS_CLI) echo "<h2 style='color: #065f46;'>✅ Resumo dos Testes</h2>";

if ($IS_CLI) echo "\n" . str_repeat('=', 70) . "\n";
if ($IS_CLI) echo "RESUMO FINAL\n";
if ($IS_CLI) echo str_repeat('=', 70) . "\n";

$summary = [
    'Extensão PostgreSQL' => extension_loaded('pgsql'),
    'Conexão com Servidor' => isset($conn) && $conn !== false,
    'Estrutura do Banco' => $allTablesExist,
];

foreach ($summary as $test => $passed) {
    $status = $passed ? '✅ PASSOU' : '❌ FALHOU';
    if ($IS_CLI) {
        echo "$status $test\n";
    } else {
        $statusClass = $passed ? 'success' : 'error';
        echo "<div style='margin: 8px 0;'>$status <strong>$test</strong></div>";
    }
}

$allPassed = !in_array(false, $summary);

if ($allPassed) {
    if ($IS_CLI) {
        echo "\n✅ TODOS OS TESTES PASSARAM!\n";
        echo "Servidor está pronto para receber a aplicação.\n";
    } else {
        echo "<div class='success-box' style='margin-top: 20px; border-width: 3px;'>";
        echo "<strong style='font-size: 16px;'>🎉 TODOS OS TESTES PASSARAM!</strong><br>";
        echo "Servidor está pronto para receber a aplicação.";
        echo "</div>";
    }
} else {
    if ($IS_CLI) {
        echo "\n⚠️  ALGUNS TESTES FALHARAM!\n";
        echo "Verifique os erros acima e corrija antes de continuar.\n";
    } else {
        echo "<div class='error-box' style='margin-top: 20px; border-width: 3px;'>";
        echo "<strong style='font-size: 16px;'>⚠️  ALGUNS TESTES FALHARAM!</strong><br>";
        echo "Verifique os erros acima e corrija antes de continuar.";
        echo "</div>";
    }
}

if (!$IS_CLI) echo "</div>";

// ============================================================================
// PRÓXIMOS PASSOS
// ============================================================================

if (!$IS_CLI) {
    echo "<div class='footer'>";
    echo "<strong>📝 Próximos Passos:</strong><br>";
    if (!$allTablesExist) {
        echo "1. Execute o schema.sql no servidor: <code>psql -U postgres -d presto -f database/schema.sql</code><br>";
        echo "2. Execute este teste novamente para verificar<br>";
    } else {
        echo "1. Configure as APIs PHP no servidor<br>";
        echo "2. Atualize o arquivo de configuração da aplicação React<br>";
        echo "3. Teste as rotas da API usando o arquivo test_api.html";
    }
    echo "</div>";
    echo "</div></body></html>";
}

// Fechar conexão
if (isset($conn) && $conn) {
    pg_close($conn);
}

if ($IS_CLI) {
    echo "\n" . str_repeat('=', 70) . "\n";
    echo "Conexão fechada.\n";
    exit($allPassed ? 0 : 1);
}
