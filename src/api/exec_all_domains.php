#!/usr/bin/env php
<?php
/**
 * ============================================================================
 * SCRIPT: EXECUTAR COMANDO SQL EM TODOS OS DOMÍNIOS
 * ============================================================================
 * 
 * Descrição:
 *   Este script executa um comando SQL em todos os domínios ativos
 *   cadastrados na tabela "domains", EXCETO o domínio XXX (sistema).
 * 
 * Uso:
 *   php /var/www/html/sistema/api/exec_all_domains.php 'COMANDO_SQL'
 * 
 * Sintaxe do Comando:
 *   Use o caractere $ antes do underscore no nome da tabela.
 *   O $ será substituído pelo prefixo do domínio (ex: acv, vcs, dmn)
 *   Exemplo: $_orcamento se torna acv_orcamento, vcs_orcamento, etc.
 * 
 * Importante:
 *   - O domínio XXX é SEMPRE excluído da execução
 *   - USE ASPAS SIMPLES ('...') para evitar que o shell interprete o $
 * 
 * Exemplos:
 *   php exec_all_domains.php 'UPDATE $_orcamento SET seq_orcamento = seq_orcamento'
 *   php exec_all_domains.php 'INSERT INTO $_unidade_medida (descricao, sigla, ativo) VALUES ("ROLO", "R", "S")'
 *   php exec_all_domains.php 'SELECT COUNT(*) FROM $_item WHERE ativo = "S"'
 * 
 * Autor: Sistema PRESTO
 * Data: 2026-03-08
 * ============================================================================
 */

// ============================================================================
// VERIFICAÇÕES INICIAIS
// ============================================================================

// Verificar se está sendo executado via CLI
if (php_sapi_name() !== 'cli') {
    die("❌ ERRO: Este script deve ser executado via linha de comando (CLI).\n");
}

// Verificar se o comando SQL foi passado
if ($argc < 2) {
    echo "\n";
    echo "════════════════════════════════════════════════════════════════════════════════\n";
    echo "  SCRIPT: EXECUTAR COMANDO SQL EM TODOS OS DOMÍNIOS\n";
    echo "════════════════════════════════════════════════════════════════════════════════\n";
    echo "\n";
    echo "USO:\n";
    echo "  php exec_all_domains.php \"COMANDO_SQL\"\n";
    echo "\n";
    echo "SINTAXE:\n";
    echo "  Use o caractere \$ antes do underscore no nome da tabela.\n";
    echo "  O \$ será substituído pelo prefixo do domínio (ex: acv, vcs, dmn)\n";
    echo "  Exemplo: \$_orcamento se torna acv_orcamento, vcs_orcamento, etc.\n";
    echo "\n";
    echo "IMPORTANTE:\n";
    echo "  - O domínio XXX é SEMPRE excluído da execução\n";
    echo "  - USE ASPAS SIMPLES ('...') para evitar que o shell interprete o \$\n";
    echo "\n";
    echo "EXEMPLOS:\n";
    echo "  php exec_all_domains.php 'UPDATE \$_orcamento SET seq_orcamento = seq_orcamento'\n";
    echo "  php exec_all_domains.php 'INSERT INTO \$_unidade_medida (descricao, sigla, ativo) VALUES (\"ROLO\", \"R\", \"S\")'\n";
    echo "  php exec_all_domains.php 'SELECT COUNT(*) FROM \$_item WHERE ativo = \"S\"'\n";
    echo "\n";
    echo "════════════════════════════════════════════════════════════════════════════════\n";
    echo "\n";
    exit(1);
}

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================

require_once __DIR__ . '/config.php';

$comandoOriginal = $argv[1];

// ============================================================================
// VALIDAÇÕES DO COMANDO
// ============================================================================

// Verificar se o comando contém $ (pode ter sido interpretado pelo shell)
if (strpos($comandoOriginal, '$_') === false && 
    (stripos($comandoOriginal, 'UPDATE') !== false || 
     stripos($comandoOriginal, 'INSERT') !== false || 
     stripos($comandoOriginal, 'DELETE') !== false || 
     stripos($comandoOriginal, 'SELECT') !== false ||
     stripos($comandoOriginal, 'ALTER') !== false)) {
    
    // Verificar se parece haver tabelas incompletas (espaços duplos ou nomes estranhos)
    if (preg_match('/\s+_[a-z_]+\s/i', $comandoOriginal) || 
        preg_match('/FROM\s+_/i', $comandoOriginal) ||
        preg_match('/INTO\s+_/i', $comandoOriginal) ||
        preg_match('/UPDATE\s+_/i', $comandoOriginal)) {
        
        echo "\n";
        echo "❌ ERRO: O comando parece estar incompleto!\n";
        echo "\n";
        echo "O caractere \$ foi interpretado pelo shell antes de chegar ao script.\n";
        echo "\n";
        echo "SOLUÇÃO:\n";
        echo "  Use ASPAS SIMPLES ao invés de aspas duplas:\n";
        echo "\n";
        echo "  ✅ CORRETO:\n";
        echo "     php exec_all_domains.php 'UPDATE \$_orcamento SET ...'\n";
        echo "\n";
        echo "  ❌ ERRADO:\n";
        echo "     php exec_all_domains.php \"UPDATE \$_orcamento SET ...\"\n";
        echo "\n";
        echo "Comando recebido:\n";
        echo "  \"$comandoOriginal\"\n";
        echo "\n";
        exit(1);
    }
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Exibir mensagem formatada
 */
function exibirMensagem($tipo, $mensagem, $detalhes = '') {
    $cores = [
        'sucesso' => "\033[0;32m", // Verde
        'erro'    => "\033[0;31m", // Vermelho
        'info'    => "\033[0;36m", // Ciano
        'alerta'  => "\033[0;33m", // Amarelo
        'reset'   => "\033[0m"     // Reset
    ];
    
    $icones = [
        'sucesso' => '✅',
        'erro'    => '❌',
        'info'    => 'ℹ️ ',
        'alerta'  => '⚠️ '
    ];
    
    $cor = $cores[$tipo] ?? $cores['info'];
    $icone = $icones[$tipo] ?? '';
    
    echo $cor . $icone . ' ' . $mensagem . $cores['reset'];
    
    if ($detalhes) {
        echo "\n   " . $detalhes;
    }
    
    echo "\n";
}

/**
 * Desenhar linha separadora
 */
function desenharLinha($comprimento = 80) {
    echo str_repeat('─', $comprimento) . "\n";
}

/**
 * Desenhar cabeçalho
 */
function desenharCabecalho($titulo) {
    echo "\n";
    echo "════════════════════════════════════════════════════════════════════════════════\n";
    echo "  " . strtoupper($titulo) . "\n";
    echo "═══════════════════════════════════════════════════════════════════════════════\n";
    echo "\n";
}

// ============================================================================
// INÍCIO DA EXECUÇÃO
// ============================================================================

desenharCabecalho('EXECUTAR COMANDO SQL EM TODOS OS DOMÍNIOS');

exibirMensagem('info', 'Comando SQL Original:', $comandoOriginal);
echo "\n";

// ============================================================================
// CONECTAR AO BANCO DE DADOS
// ============================================================================

try {
    exibirMensagem('info', 'Conectando ao banco de dados...');
    $g_sql = connect();
    exibirMensagem('sucesso', 'Conexão estabelecida com sucesso!');
    echo "\n";
} catch (Exception $e) {
    exibirMensagem('erro', 'Falha ao conectar ao banco de dados:', $e->getMessage());
    exit(1);
}

// ============================================================================
// BUSCAR TODOS OS DOMÍNIOS ATIVOS
// ============================================================================

try {
    exibirMensagem('info', 'Buscando domínios ativos...');
    
    $queryDominios = "SELECT domain, name 
                      FROM domains 
                      WHERE is_active = TRUE 
                        AND domain != 'XXX'
                      ORDER BY domain";
    
    $resultDominios = sql($queryDominios, [], $g_sql);
    
    if (!$resultDominios) {
        $erro_pg = pg_last_error($g_sql);
        throw new Exception('Erro ao buscar domínios: ' . $erro_pg);
    }
    
    $dominios = [];
    while ($row = pg_fetch_assoc($resultDominios)) {
        $dominios[] = $row;
    }
    
    $totalDominios = count($dominios);
    
    if ($totalDominios === 0) {
        exibirMensagem('alerta', 'Nenhum domínio ativo encontrado!');
        exit(0);
    }
    
    exibirMensagem('sucesso', "Encontrados {$totalDominios} domínio(s) ativo(s) (excluindo XXX)");
    echo "\n";
    
} catch (Exception $e) {
    exibirMensagem('erro', 'Erro ao buscar domínios:', $e->getMessage());
    closeDBConnection($g_sql);
    exit(1);
}

// ============================================================================
// EXECUTAR COMANDO EM CADA DOMÍNIO
// ============================================================================

desenharLinha();
echo "\n";

$sucessos = 0;
$erros = 0;
$resultados = [];

foreach ($dominios as $dominio) {
    $domain = $dominio['domain'];
    $name = $dominio['name'];
    
    // Prefixo do domínio em minúsculas (SEM underscore, pois o comando já tem)
    $prefix = strtolower($domain);
    
    // Substituir $ pelo prefixo
    $comandoExecutar = str_replace('$', $prefix, $comandoOriginal);
    
    echo "┌─ DOMÍNIO: {$domain} - {$name}\n";
    echo "│  SQL: {$comandoExecutar}\n";
    
    try {
        // Executar comando
        $result = sql($comandoExecutar, [], $g_sql);
        
        if (!$result) {
            throw new Exception(pg_last_error($g_sql));
        }
        
        // Verificar se é SELECT (retorna dados)
        $isSelect = stripos(trim($comandoExecutar), 'SELECT') === 0;
        
        if ($isSelect) {
            $rows = [];
            while ($row = pg_fetch_assoc($result)) {
                $rows[] = $row;
            }
            $numRows = count($rows);
            
            echo "│  ✅ Sucesso! Retornou {$numRows} registro(s)\n";
            
            // Exibir primeiros registros (máximo 3)
            if ($numRows > 0) {
                $maxDisplay = min(3, $numRows);
                for ($i = 0; $i < $maxDisplay; $i++) {
                    echo "│     → " . json_encode($rows[$i], JSON_UNESCAPED_UNICODE) . "\n";
                }
                if ($numRows > 3) {
                    echo "│     → ... e mais " . ($numRows - 3) . " registro(s)\n";
                }
            }
            
            $resultados[$domain] = [
                'status' => 'sucesso',
                'tipo' => 'SELECT',
                'registros' => $numRows,
                'dados' => $rows
            ];
        } else {
            // INSERT, UPDATE, DELETE
            $affectedRows = pg_affected_rows($result);
            echo "│  ✅ Sucesso! {$affectedRows} registro(s) afetado(s)\n";
            
            $resultados[$domain] = [
                'status' => 'sucesso',
                'tipo' => 'DML',
                'registros_afetados' => $affectedRows
            ];
        }
        
        $sucessos++;
        
    } catch (Exception $e) {
        echo "│  ❌ Erro: " . $e->getMessage() . "\n";
        
        $resultados[$domain] = [
            'status' => 'erro',
            'mensagem' => $e->getMessage()
        ];
        
        $erros++;
    }
    
    echo "└─\n";
    echo "\n";
}

// ============================================================================
// RESUMO FINAL
// ============================================================================

desenharLinha();
echo "\n";
desenharCabecalho('RESUMO DA EXECUÇÃO');

echo "Total de Domínios:  {$totalDominios}\n";
echo "Sucessos:           \033[0;32m{$sucessos}\033[0m\n";
echo "Erros:              \033[0;31m{$erros}\033[0m\n";
echo "\n";

if ($erros > 0) {
    desenharLinha();
    echo "\n";
    exibirMensagem('alerta', 'DOMÍNIOS COM ERRO:');
    echo "\n";
    
    foreach ($resultados as $domain => $resultado) {
        if ($resultado['status'] === 'erro') {
            echo "  • {$domain}: {$resultado['mensagem']}\n";
        }
    }
    echo "\n";
}

desenharLinha();
echo "\n";

if ($erros === 0) {
    exibirMensagem('sucesso', 'Comando executado com sucesso em todos os domínios!');
} else {
    exibirMensagem('alerta', "Comando executado com {$erros} erro(s)");
}

echo "\n";

// ============================================================================
// FECHAR CONEXÃO
// ============================================================================

closeDBConnection($g_sql);

// ============================================================================
// CÓDIGO DE SAÍDA
// ============================================================================

exit($erros > 0 ? 1 : 0);