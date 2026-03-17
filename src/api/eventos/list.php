<?php
/**
 * API: Listar Eventos
 * Lista todos os eventos do domínio
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

try {
    // Obter domínio do header ou parâmetro
    $domain  = $_GET['domain'] ?? $_SERVER['HTTP_X_DOMAIN'] ?? null;
    $dominio = $domain;
    $g_sql   = connect();

    // Buscar eventos ordenados com grupo associado
    $query = "SELECT e.evento, e.descricao, e.ordem, e.considerar,
                     e.tipo, e.grupo, g.descricao as grupo_descricao
                FROM $dominio" . "_evento e
                LEFT OUTER JOIN $dominio" . "_grupo_evento g ON (e.grupo = g.grupo)
               ORDER BY e.descricao";

    $result = sql ($g_sql, $query);

    $eventos = [];

    while ($row = pg_fetch_assoc ($result))
      $eventos[] = ['evento' => (int)$row['evento'],
                 'descricao' => $row['descricao'],
                     'ordem' => (int)$row['ordem'],
                'considerar' => trim($row['considerar']),
                      'tipo' => trim($row['tipo']),
                 'seq_grupo' => $row['grupo'] ? (int)$row['grupo'] : null,
           'grupo_descricao' => $row['grupo_descricao'] ? trim($row['grupo_descricao']) : null];

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
