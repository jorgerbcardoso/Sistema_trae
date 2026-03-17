<?php
/**
 * API: Associar Múltiplos Eventos a um Grupo
 * Associa vários eventos a um grupo específico de uma vez
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
    $eventos = $input['eventos'] ?? [];
    
    // Validações
    if ($grupo === null || $grupo === '') {
        throw new Exception('Grupo é obrigatório');
    }
    
    if (!is_array($eventos) || empty($eventos)) {
        throw new Exception('Lista de eventos é obrigatória');
    }
    
    $g_sql = connect();
    
    // Nome das tabelas baseado no domínio
    $tableGrupo = $dominio . '_grupo_evento';
    $tableEvento = $dominio . '_evento';
    
    // Verificar se o grupo existe (exceto grupo 0 que é o padrão)
    if ($grupo != 0) {
        $checkGrupoQuery = "SELECT COUNT(*) as count FROM $tableGrupo WHERE grupo = $1";
        $checkGrupoResult = sql($g_sql, $checkGrupoQuery, false, [(int)$grupo]);
        $grupoExists = pg_fetch_result($checkGrupoResult, 0, 0) > 0;
        
        if (!$grupoExists) {
            msg('Grupo não encontrado');
            exit;
        }
    }
    
    // Atualizar todos os eventos de uma vez
    $eventosIds = implode(',', array_map('intval', $eventos));
    $updateQuery = "UPDATE $tableEvento 
                    SET grupo = $1 
                    WHERE evento IN ($eventosIds)";
    
    sql($g_sql, $updateQuery, false, [(int)$grupo]);
    
    msg(count($eventos) . " evento(s) associado(s) ao grupo com sucesso", 'success');
    
    echo json_encode([
        'success' => true,
        'count' => count($eventos)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}