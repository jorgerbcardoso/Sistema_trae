<?php
/**
 * API: Atualizar Linha
 * Atualiza uma linha existente no domínio
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método não permitido');
    }
    
    // Obter dados do POST
    $input = json_decode(file_get_contents('php://input'), true);
    
    $domain = $input['domain'] ?? $_SERVER['HTTP_X_DOMAIN'] ?? null;
    $nro_linha = $input['nro_linha'] ?? null;
    $nome = $input['nome'] ?? null;
    $sigla_emit = $input['sigla_emit'] ?? null;
    $sigla_dest = $input['sigla_dest'] ?? null;
    $unidades = $input['unidades'] ?? null;
    $km_ida = $input['km_ida'] ?? null;
    
    // Validações
    if (!$domain) {
        throw new Exception('Domínio não especificado');
    }
    
    if (!$nro_linha || $nro_linha <= 0) {
        throw new Exception('Número da linha é obrigatório');
    }
    
    if (!$nome || trim($nome) === '') {
        throw new Exception('Nome é obrigatório');
    }
    
    if (!$sigla_emit || trim($sigla_emit) === '') {
        throw new Exception('Unidade de origem é obrigatória');
    }
    
    if (!$sigla_dest || trim($sigla_dest) === '') {
        throw new Exception('Unidade de destino é obrigatória');
    }
    
    if ($km_ida === null || $km_ida === '' || $km_ida <= 0) {
        throw new Exception('Distância deve ser maior que zero');
    }
    
    // Validar domínio (apenas letras e números)
    if (!preg_match('/^[A-Z0-9]+$/i', $domain)) {
        throw new Exception('Domínio inválido');
    }
    
    $dominio = strtolower($domain);
    $g_sql = connect();
    
    // Nome da tabela baseado no domínio
    $tableName = $dominio . '_linha';
    
    // Verificar se a linha existe
    $checkQuery = "SELECT nro_linha FROM $tableName WHERE nro_linha = $nro_linha";
    $checkResult = sql($g_sql, $checkQuery);
    
    if (pg_num_rows($checkResult) === 0) {
        msg('Linha não encontrada');
        exit;
    }
    
    // Verificar se origem e destino são diferentes
    if (strtoupper($sigla_emit) === strtoupper($sigla_dest)) {
        msg('Unidade de origem e destino não podem ser iguais');
        exit;
    }
    
    // Validar se as unidades existem na base
    // ✅ Unidades intermediárias são OPCIONAIS
    $unidadesIntermediarias = array_filter(
        array_map('trim', array_map('strtoupper', explode(',', $unidades ?? ''))),
        function($u) { return $u !== ''; }
    );
    
    $todasUnidades = array_merge(
        [strtoupper($sigla_emit)],
        $unidadesIntermediarias,
        [strtoupper($sigla_dest)]
    );
    $todasUnidades = array_unique($todasUnidades);
    
    // Verificar se há repetição de unidades
    $totalEsperado = count($unidadesIntermediarias) + 2; // origem + intermediárias + destino
    if (count($todasUnidades) !== $totalEsperado) {
        msg('Não pode haver repetição de unidades na linha');
        exit;
    }
    
    foreach ($todasUnidades as $unidade) {
        $queryCheck = "SELECT COUNT(*) as total FROM {$dominio}_unidade WHERE sigla = $1";
        $resultCheck = sql($g_sql, $queryCheck, false, [$unidade]);
        $rowCheck = pg_fetch_assoc($resultCheck);
        
        if ($rowCheck['total'] == 0) {
            msg("Unidade $unidade não existe na base de dados");
            exit;
        }
    }
    
    // Atualizar linha
    $updateQuery = "UPDATE $tableName 
                    SET nome = $1, sigla_emit = $2, sigla_dest = $3, unidades = $4, km_ida = $5
                    WHERE nro_linha = $6
                    RETURNING nro_linha, nome, sigla_emit, sigla_dest, unidades, km_ida, km_volta";
    
    $updateResult = sql($g_sql, $updateQuery, false, [
        strtoupper($nome),
        strtoupper($sigla_emit),
        strtoupper($sigla_dest),
        strtoupper($unidades),
        (int)$km_ida,
        (int)$nro_linha
    ]);
    
    $updatedLinha = pg_fetch_assoc($updateResult);
    
    echo json_encode([
        'success' => true,
        'linha' => [
            'nro_linha' => (int)$updatedLinha['nro_linha'],
            'nome' => trim($updatedLinha['nome']),
            'sigla_emit' => trim($updatedLinha['sigla_emit']),
            'sigla_dest' => trim($updatedLinha['sigla_dest']),
            'unidades' => trim($updatedLinha['unidades']),
            'km_ida' => (int)$updatedLinha['km_ida'],
            'km_volta' => (int)$updatedLinha['km_volta']
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}