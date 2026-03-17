<?php
/**
 * API: Excluir Linha
 * Exclui uma linha do domínio
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
    
    // Validações
    if (!$domain) {
        throw new Exception('Domínio não especificado');
    }
    
    if (!$nro_linha || $nro_linha <= 0) {
        throw new Exception('Número da linha é obrigatório');
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
    $checkQuery = "SELECT nro_linha, nome FROM $tableName WHERE nro_linha = $nro_linha";
    $checkResult = sql($g_sql, $checkQuery);
    
    if (pg_num_rows($checkResult) === 0) {
        msg('Linha não encontrada');
        exit;
    }
    
    // Excluir linha
    $deleteQuery = "DELETE FROM $tableName WHERE nro_linha = $nro_linha";
    sql($g_sql, $deleteQuery);
    
    echo json_encode([
        'success' => true
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}