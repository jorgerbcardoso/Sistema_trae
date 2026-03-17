<?php
/**
 * API: Atualizar Grupo de Eventos
 * Atualiza um grupo de eventos existente no domínio
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
    
    $grupo = $input['grupo'] ?? null;
    $descricao = $input['descricao'] ?? null;
    
    // Validações
    if ($grupo === null || $grupo === '') {
        throw new Exception('Grupo é obrigatório');
    }
    
    if (!$descricao || trim($descricao) === '') {
        throw new Exception('Descrição é obrigatória');
    }
    
    $g_sql = connect();
    
    // Nome da tabela baseado no domínio
    $tableName = $dominio . '_grupo_evento';
    
    // Verificar se o grupo existe
    $checkQuery = "SELECT COUNT(*) as count FROM $tableName WHERE grupo = $1";
    $checkResult = sql($g_sql, $checkQuery, false, [(int)$grupo]);
    $exists = pg_fetch_result($checkResult, 0, 0) > 0;
    
    if (!$exists) {
        msg('Grupo não encontrado');
        exit;
    }
    
    // Atualizar grupo
    $updateQuery = "UPDATE $tableName 
                    SET descricao = $1 
                    WHERE grupo = $2
                    RETURNING grupo, descricao";
    
    $updateResult = sql($g_sql, $updateQuery, false, [
        strtoupper(trim($descricao)),
        (int)$grupo
    ]);
    
    $updatedGrupo = pg_fetch_assoc($updateResult);
    
    msg('Grupo de eventos atualizado com sucesso', 'success');
    
    echo json_encode([
        'success' => true,
        'grupo' => [
            'grupo' => (int)$updatedGrupo['grupo'],
            'descricao' => trim($updatedGrupo['descricao'])
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}