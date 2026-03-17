<?php
/**
 * API: Listar Eventos de um Grupo
 * Lista todos os eventos vinculados a um grupo específico
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

try {
    // ✅ CORRIGIDO: Usar autenticação ao invés de parâmetro manual
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        msg('ERRO', $authResult['message']);
        exit();
    }

    $dominio = strtolower($authResult['domain']);
    
    // Obter parâmetros
    $grupo = $_GET['grupo'] ?? null;
    
    // Validações
    if ($grupo === null || $grupo === '') {
        throw new Exception('Grupo é obrigatório');
    }
    
    $g_sql = connect();
    
    // Nome da tabela baseado no domínio
    $tableEvento = $dominio . '_evento';
    
    // Buscar eventos do grupo
    $query = "SELECT evento, descricao, ordem, considerar, tipo, grupo 
              FROM $tableEvento 
              WHERE grupo = $1
              ORDER BY ordem, evento";
    
    $result = sql($g_sql, $query, false, [(int)$grupo]);
    
    $eventos = [];
    while ($row = pg_fetch_assoc($result)) {
        $eventos[] = [
            'evento' => (int)$row['evento'],
            'descricao' => trim($row['descricao']),
            'ordem' => (int)$row['ordem'],
            'considerar' => trim($row['considerar']),
            'tipo' => trim($row['tipo']),
            'grupo' => (int)$row['grupo']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'eventos' => $eventos,
        'total' => count($eventos)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}