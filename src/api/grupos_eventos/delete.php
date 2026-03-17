<?php
/**
 * API: Excluir Grupo de Eventos
 * Exclui um grupo de eventos do domínio
 * Remove associações dos eventos vinculados (define grupo = 0)
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
    
    // Validações
    if ($grupo === null || $grupo === '') {
        throw new Exception('Grupo é obrigatório');
    }
    
    if ($grupo == 0) {
        msg('Não é possível excluir o grupo padrão (0)');
        exit;
    }
    
    $g_sql = connect();
    
    // Nome das tabelas baseado no domínio
    $tableGrupo = $dominio . '_grupo_evento';
    $tableEvento = $dominio . '_evento';
    
    // Verificar se o grupo existe
    $checkQuery = "SELECT COUNT(*) as count FROM $tableGrupo WHERE grupo = $1";
    $checkResult = sql($g_sql, $checkQuery, false, [(int)$grupo]);
    $exists = pg_fetch_result($checkResult, 0, 0) > 0;
    
    if (!$exists) {
        msg('Grupo não encontrado');
        exit;
    }
    
    // Remover associações dos eventos (definir grupo = 0)
    $updateEventosQuery = "UPDATE $tableEvento SET grupo = 0 WHERE grupo = $1";
    sql($g_sql, $updateEventosQuery, false, [(int)$grupo]);
    
    // Excluir grupo
    $deleteQuery = "DELETE FROM $tableGrupo WHERE grupo = $1";
    sql($g_sql, $deleteQuery, false, [(int)$grupo]);
    
    msg('Grupo de eventos excluído com sucesso', 'success');
    
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