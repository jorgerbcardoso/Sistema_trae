<?php
/**
 * API: Listar Todos os Eventos com Informação de Grupo
 * Lista todos os eventos com informação do grupo associado
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
    $g_sql   = connect();

    // Nome das tabelas baseado no domínio
    $tableEvento = $dominio . '_evento';
    $tableGrupo = $dominio . '_grupo_evento';

    // Buscar eventos com informação do grupo (LEFT JOIN)
    $query = "SELECT 
                e.evento, 
                e.descricao, 
                e.ordem, 
                e.considerar, 
                e.tipo, 
                COALESCE(e.grupo, 0) as grupo,
                g.descricao as grupo_descricao
              FROM $tableEvento e
              LEFT JOIN $tableGrupo g ON e.grupo = g.grupo
              ORDER BY e.ordem, e.evento";

    $result = sql($g_sql, $query);

    $eventos = [];
    while ($row = pg_fetch_assoc($result)) {
        $eventos[] = [
            'evento' => (int)$row['evento'],
            'descricao' => trim($row['descricao']),
            'ordem' => (int)$row['ordem'],
            'considerar' => trim($row['considerar']),
            'tipo' => trim($row['tipo']),
            'grupo' => (int)$row['grupo'],
            'grupo_descricao' => $row['grupo_descricao'] ? trim($row['grupo_descricao']) : 'Sem Grupo'
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