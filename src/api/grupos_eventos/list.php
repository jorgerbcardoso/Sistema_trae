<?php
/**
 * API: Listar Grupos de Eventos
 * Lista todos os grupos de eventos do domínio
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

    // Buscar grupos ordenados
    $query = "SELECT grupo, descricao
                FROM {$dominio}_grupo_evento
               ORDER BY grupo";

    $result = sql($g_sql, $query);

    $grupos = [];

    while ($row = pg_fetch_assoc($result))
      $grupos[] = [
          'grupo' => (int)$row['grupo'],
          'descricao' => trim($row['descricao'])
      ];

    echo json_encode([
        'success' => true,
        'grupos' => $grupos,
        'total' => count($grupos)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}