<?php
/**
 * Script para gerar hash bcrypt da senha "presto123"
 * Execute: php database/gerar_hash_senha.php
 */

// Senha padrão do sistema
$senha = 'presto123';

// Gerar hash bcrypt com custo 10
$hash = password_hash($senha, PASSWORD_BCRYPT, ['cost' => 10]);

echo "========================================\n";
echo "GERADOR DE HASH BCRYPT\n";
echo "========================================\n";
echo "\n";
echo "Senha: {$senha}\n";
echo "Hash:  {$hash}\n";
echo "\n";

// Verificar se o hash está correto
if (password_verify($senha, $hash)) {
    echo "✅ VERIFICAÇÃO OK: O hash está correto!\n";
} else {
    echo "❌ ERRO: O hash não confere!\n";
}

echo "\n";
echo "========================================\n";
echo "COPIE O HASH ACIMA E USE NO SQL\n";
echo "========================================\n";
echo "\n";

// Testar também o hash ANTIGO (errado)
$hash_antigo = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
echo "Testando hash ANTIGO do schema.sql:\n";
if (password_verify($senha, $hash_antigo)) {
    echo "✅ Hash antigo funciona para '{$senha}'\n";
} else {
    echo "❌ Hash antigo NÃO funciona para '{$senha}'\n";
    
    // Descobrir qual senha o hash antigo representa
    $senhas_teste = ['password', 'presto', '123456', 'admin', 'presto123'];
    foreach ($senhas_teste as $teste) {
        if (password_verify($teste, $hash_antigo)) {
            echo "   ⚠️  Hash antigo é da senha: '{$teste}'\n";
            break;
        }
    }
}

echo "\n";
echo "========================================\n";
echo "COMANDO SQL PARA ATUALIZAR:\n";
echo "========================================\n";
echo "\n";
echo "UPDATE users SET password_hash = '{$hash}' WHERE password_hash = '{$hash_antigo}';\n";
echo "\n";
?>
