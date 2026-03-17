<?php
/**
 * API: Criar Grupo de Eventos
 * Cria um novo grupo de eventos no domínio
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
require_once __DIR__ . '/../middleware/auth.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método não permitido');
    }
    
    // ✅ CORRIGIDO: Usar autenticação ao invés de parâmetro manual
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        msg('ERRO', $authResult['message']);
        exit();
    }

    $dominio = strtolower($authResult['domain']);
    
    // Obter dados do POST
    $input = json_decode(file_get_contents('php://input'), true);
    
    $descricao = $input['descricao'] ?? null;
    
    // Validações
    if (!$descricao || trim($descricao) === '') {
        throw new Exception('Descrição é obrigatória');
    }
    
    $g_sql = connect();
    
    // Nome da tabela baseado no domínio
    $tableName = $dominio . '_grupo_evento';
    
    // Obter próximo ID (máximo grupo + 1)
    $maxIdQuery = "SELECT COALESCE(MAX(grupo), 0) + 1 as next_id FROM $tableName";
    $maxIdResult = sql($g_sql, $maxIdQuery);
    $nextId = pg_fetch_result($maxIdResult, 0, 0);
    
    // Inserir grupo
    $insertQuery = "INSERT INTO $tableName (grupo, descricao) 
                    VALUES ($1, $2)
                    RETURNING grupo, descricao";
    
    $insertResult = sql($g_sql, $insertQuery, false, [
        $nextId,
        strtoupper(trim($descricao))
    ]);
    
    $newGrupo = pg_fetch_assoc($insertResult);
    
    msg('Grupo de eventos criado com sucesso', 'success');
    
    echo json_encode([
        'success' => true,
        'grupo' => [
            'grupo' => (int)$newGrupo['grupo'],
            'descricao' => trim($newGrupo['descricao'])
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}