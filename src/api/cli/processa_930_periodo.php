<?php
/**
 * CLI Script - Processa relatório 930 para um período
 * Chama processa_930.php para cada dia do período
 * 
 * Uso: php processa_930_periodo.php [data_ini] [data_fin]
 * Exemplo: php processa_930_periodo.php 250426 280426
 */

if ($argc < 3) {
    fwrite(STDERR, "Uso: php " . $argv[0] . " [data_ini] [data_fin]\n");
    fwrite(STDERR, "Exemplo: php " . $argv[0] . " 250426 280426\n");
    exit(1);
}

$data_ini = $argv[1];
$data_fin = $argv[2];

// Validar formato dmy
if (!preg_match('/^\d{6}$/', $data_ini) || !preg_match('/^\d{6}$/', $data_fin)) {
    fwrite(STDERR, "Erro: datas devem estar no formato dmy (ex: 250426)\n");
    fwrite(STDERR, "data_ini recebido: '$data_ini'\n");
    fwrite(STDERR, "data_fin recebido: '$data_fin'\n");
    exit(1);
}

// Converter para DateTime
$dt_ini_str = substr($data_ini, 0, 2) . '/' . substr($data_ini, 2, 2) . '/' . substr($data_ini, 4, 2);
$dt_fin_str = substr($data_fin, 0, 2) . '/' . substr($data_fin, 2, 2) . '/' . substr($data_fin, 4, 2);

$dt_ini = DateTime::createFromFormat('d/m/y', $dt_ini_str);
$dt_fin = DateTime::createFromFormat('d/m/y', $dt_fin_str);

if (!$dt_ini || !$dt_fin) {
    fwrite(STDERR, "Erro: formato de data inválido\n");
    fwrite(STDERR, "dt_ini_str: '$dt_ini_str'\n");
    fwrite(STDERR, "dt_fin_str: '$dt_fin_str'\n");
    exit(1);
}

if ($dt_ini > $dt_fin) {
    fwrite(STDERR, "Erro: data inicial maior que data final\n");
    exit(1);
}

echo "========================================\n";
echo "PROCESSANDO 930 PARA O PERÍODO\n";
echo "De: " . $dt_ini->format('d/m/Y') . " a " . $dt_fin->format('d/m/Y') . "\n";
echo "========================================\n\n";

$dt_atual = clone $dt_ini;
$dias = 0;

while ($dt_atual <= $dt_fin) {
    $data_dmy = $dt_atual->format('dmy');
    
    echo "Dia " . ($dias + 1) . ": " . $dt_atual->format('d/m/Y') . " (dmy: $data_dmy)\n";
    
    // Chamar processa_930.php com a data atual e imprimir saída em tempo real
    $descriptorspec = [
        0 => ["pipe", "r"],
        1 => ["pipe", "w"],
        2 => ["pipe", "w"]
    ];
    
    $process = proc_open("php processa_930.php $data_dmy $data_dmy", $descriptorspec, $pipes);
    
    if (is_resource($process)) {
        // Fechar stdin
        fclose($pipes[0]);
        
        // Imprimir stdout em tempo real
        while (!feof($pipes[1])) {
            echo fread($pipes[1], 4096);
            flush();
        }
        
        // Imprimir stderr em tempo real
        while (!feof($pipes[2])) {
            $stderr = fread($pipes[2], 4096);
            if ($stderr) {
                fwrite(STDERR, $stderr);
                flush();
            }
        }
        
        fclose($pipes[1]);
        fclose($pipes[2]);
        
        $return_var = proc_close($process);
    } else {
        $return_var = -1;
    }
    
    if ($return_var === 0) {
        echo "Sucesso no dia " . $dt_atual->format('d/m/Y') . "\n";
    } else {
        echo "ERRO no dia " . $dt_atual->format('d/m/Y') . "\n";
    }
    
    echo "\n";
    
    $dt_atual->modify('+1 day');
    $dias++;
}

echo "========================================\n";
echo "TOTAL: $dias dias processados\n";
echo "========================================\n";
