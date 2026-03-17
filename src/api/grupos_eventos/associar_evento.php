<?php
/**
 * API: Associar Evento a Grupo
 * Associa um evento a um grupo específico
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
    $evento = $input['evento'] ?? null;
    
    // Validações
    if ($grupo === null || $grupo === '') {
        throw new Exception('Grupo é obrigatório');
    }
    
    if ($evento === null || $evento === '') {
        throw new Exception('Evento é obrigatório');
    }
    
    // Validar domínio (apenas letras e números)
    if (!preg_match('/^[A-Z0-9]+$/i', $dominio)) {
        throw new Exception('Domínio inválido');
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
    
    // Verificar se o evento existe
    $checkEventoQuery = "SELECT COUNT(*) as count FROM $tableEvento WHERE evento = $1";
    $checkEventoResult = sql($g_sql, $checkEventoQuery, false, [(int)$evento]);
    $eventoExists = pg_fetch_result($checkEventoResult, 0, 0) > 0;
    
    if (!$eventoExists) {
        msg('Evento não encontrado');
        exit;
    }
    
    // Atualizar grupo do evento
    $updateQuery = "UPDATE $tableEvento 
                    SET grupo = $1 
                    WHERE evento = $2
                    RETURNING evento, descricao, grupo";
    
    $updateResult = sql($g_sql, $updateQuery, false, [(int)$grupo, (int)$evento]);
    
    $updatedEvento = pg_fetch_assoc($updateResult);
    
    msg('Evento associado ao grupo com sucesso', 'success');
    
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