<?php
/**
 * API: Desassociar Evento de Grupo
 * Remove a associação de um evento (define grupo = 0)
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
    
    $evento = $input['evento'] ?? null;
    
    // Validações
    if ($evento === null || $evento === '') {
        throw new Exception('Evento é obrigatório');
    }
    
    $g_sql = connect();
    
    // Nome da tabela baseado no domínio
    $tableEvento = $dominio . '_evento';
    
    // Verificar se o evento existe
    $checkEventoQuery = "SELECT COUNT(*) as count FROM $tableEvento WHERE evento = $1";
    $checkEventoResult = sql($g_sql, $checkEventoQuery, false, [(int)$evento]);
    $eventoExists = pg_fetch_result($checkEventoResult, 0, 0) > 0;
    
    if (!$eventoExists) {
        msg('Evento não encontrado');
        exit;
    }
    
    // Definir grupo = 0 (sem grupo)
    $updateQuery = "UPDATE $tableEvento 
                    SET grupo = 0 
                    WHERE evento = $1
                    RETURNING evento, descricao, grupo";
    
    $updateResult = sql($g_sql, $updateQuery, false, [(int)$evento]);
    
    $updatedEvento = pg_fetch_assoc($updateResult);
    
    msg('Evento desassociado do grupo com sucesso', 'success');
    
    echo json_encode([
        'success' => true,
        'evento' => [
            'evento' => (int)$updatedEvento['evento'],
            'descricao' => trim($updatedEvento['descricao']),
            'grupo' => (int)$updatedEvento['grupo']
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}