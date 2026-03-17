<?php
/**
 * TESTE DE LOGIN DO USUÁRIO ROSE
 * ================================
 * Script para debugar o login do usuário "rose" no domínio "VCS"
 */

require_once __DIR__ . '/config.php';

echo "=== TESTE DE LOGIN - USUÁRIO ROSE ===\n\n";

// Dados de teste
$domain = 'VCS';
$username = 'rose'; // strtolower já aplicado
$password = '12345';
$hashDoBanco = '$2y$10$RcbL2CF9i.0hQaCQpfTt6uHXqxzugWow.4Qq7TrQnxeOdGIdB8G/e';

echo "1. TESTE DA HASH\n";
echo "   Senha testada: '$password'\n";
echo "   Hash do banco: $hashDoBanco\n";

// Testar password_verify
$verificaHash = password_verify($password, $hashDoBanco);
echo "   password_verify('$password', hash): " . ($verificaHash ? "✅ TRUE (senha correta!)" : "❌ FALSE (senha incorreta!)") . "\n\n";

// Se a hash não bate, vamos gerar a hash correta para "12345"
if (!$verificaHash) {
    echo "   ⚠️ A hash NÃO corresponde à senha '$password'\n";
    echo "   Gerando hash correta para '$password':\n";
    $hashCorreta = password_hash($password, PASSWORD_BCRYPT);
    echo "   Hash correta: $hashCorreta\n\n";
    
    // Testar a hash gerada
    $verificaHashCorreta = password_verify($password, $hashCorreta);
    echo "   Verificação da hash gerada: " . ($verificaHashCorreta ? "✅ OK" : "❌ ERRO") . "\n\n";
}

// Conectar ao banco e verificar o usuário
echo "2. CONSULTA NO BANCO\n";

try {
    $conn = getDBConnection();
    
    // Verificar configuração do domínio
    echo "   2.1. Verificando domínio '$domain'...\n";
    $stmt = pg_prepare($conn, "check_domain", 
        "SELECT id, domain, name, use_mock_data, is_active 
         FROM domains 
         WHERE domain = $1");
    
    $result = pg_execute($conn, "check_domain", [$domain]);
    
    if (pg_num_rows($result) === 0) {
        echo "   ❌ Domínio '$domain' NÃO encontrado!\n\n";
    } else {
        $domainData = pg_fetch_assoc($result);
        echo "   ✅ Domínio encontrado:\n";
        echo "      - ID: " . $domainData['id'] . "\n";
        echo "      - Nome: " . $domainData['name'] . "\n";
        echo "      - use_mock_data: " . $domainData['use_mock_data'] . "\n";
        echo "      - is_active: " . $domainData['is_active'] . "\n\n";
        
        $useMockData = pgBoolToPHP($domainData['use_mock_data']);
        if ($useMockData) {
            echo "   ⚠️ ATENÇÃO: use_mock_data = TRUE\n";
            echo "   O sistema vai usar credenciais MOCK, não do banco!\n\n";
        }
    }
    pg_free_result($result);
    
    // Verificar usuário
    echo "   2.2. Verificando usuário '$username' no domínio '$domain'...\n";
    $stmt = pg_prepare($conn, "check_user",
        "SELECT id, username, password_hash, is_active, is_admin, email, full_name, domain
         FROM users 
         WHERE domain = $1 AND username = $2");
    
    $result = pg_execute($conn, "check_user", [$domain, $username]);
    
    if (pg_num_rows($result) === 0) {
        echo "   ❌ Usuário '$username' NÃO encontrado no domínio '$domain'!\n\n";
        
        // Verificar se existe em outro domínio
        echo "   2.3. Buscando usuário 'rose' em TODOS os domínios...\n";
        $resultAll = pg_query($conn, "SELECT domain, username, is_active FROM users WHERE username = 'rose'");
        if (pg_num_rows($resultAll) > 0) {
            echo "   Usuários 'rose' encontrados:\n";
            while ($row = pg_fetch_assoc($resultAll)) {
                echo "      - Domain: " . $row['domain'] . " | Active: " . $row['is_active'] . "\n";
            }
        } else {
            echo "   ❌ Nenhum usuário 'rose' encontrado em nenhum domínio!\n";
        }
        echo "\n";
        
    } else {
        $userData = pg_fetch_assoc($result);
        echo "   ✅ Usuário encontrado:\n";
        echo "      - ID: " . $userData['id'] . "\n";
        echo "      - Username: " . $userData['username'] . "\n";
        echo "      - Domain: " . $userData['domain'] . "\n";
        echo "      - Email: " . $userData['email'] . "\n";
        echo "      - Full Name: " . $userData['full_name'] . "\n";
        echo "      - is_active: " . $userData['is_active'] . "\n";
        echo "      - is_admin: " . $userData['is_admin'] . "\n";
        echo "      - password_hash: " . $userData['password_hash'] . "\n\n";
        
        // Verificar se está ativo
        if ($userData['is_active'] !== 't') {
            echo "   ❌ PROBLEMA: Usuário está INATIVO (is_active = " . $userData['is_active'] . ")\n\n";
        }
        
        // Verificar a senha
        echo "   2.4. Verificando senha...\n";
        $hashNoBanco = $userData['password_hash'];
        echo "      Hash no banco: $hashNoBanco\n";
        echo "      Senha testada: '$password'\n";
        
        $senhaCorreta = password_verify($password, $hashNoBanco);
        echo "      Resultado: " . ($senhaCorreta ? "✅ SENHA CORRETA!" : "❌ SENHA INCORRETA!") . "\n\n";
        
        if (!$senhaCorreta) {
            // Testar outras senhas comuns
            echo "   2.5. Testando senhas alternativas...\n";
            $senhasTeste = ['12345', '123456', 'rose', 'Rose', 'ROSE', 'rose123', 'Rose123'];
            foreach ($senhasTeste as $senhaTeste) {
                $verifica = password_verify($senhaTeste, $hashNoBanco);
                if ($verifica) {
                    echo "      ✅ SENHA ENCONTRADA: '$senhaTeste'\n";
                    break;
                }
            }
            echo "\n";
        }
    }
    pg_free_result($result);
    
    closeDBConnection($conn);
    
} catch (Exception $e) {
    echo "❌ ERRO: " . $e->getMessage() . "\n";
    echo "Arquivo: " . $e->getFile() . "\n";
    echo "Linha: " . $e->getLine() . "\n";
}

echo "\n=== FIM DO TESTE ===\n";
?>
