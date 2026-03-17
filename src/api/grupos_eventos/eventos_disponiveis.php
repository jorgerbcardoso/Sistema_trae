<?php
/**
 * API: Listar Eventos Disponíveis para Associação
 * Lista todos os eventos que não estão associados a nenhum grupo
 * ou que estão no grupo 0 (sem grupo)
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

    // Nome da tabela baseado no domínio
    $tableEvento = $dominio . '_evento';

    // Buscar eventos sem grupo (grupo = 0 ou NULL)
    $query = "SELECT evento, descricao, ordem, considerar, tipo, COALESCE(grupo, 0) as grupo 
              FROM $tableEvento 
              WHERE COALESCE(grupo, 0) = 0
              ORDER BY ordem, evento";

    $result = sql($g_sql, $query);

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