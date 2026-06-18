<?php
/**
 * API: Listar Linhas
 * Lista todas as linhas do domínio
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

    // Buscar linhas ordenadas por nome
    $query = "SELECT nro_linha, nome, sigla_emit, sigla_dest, unidades, km_ida, km_volta,
                     carrega_seg, carrega_ter, carrega_qua, carrega_qui, carrega_sex, carrega_sab, carrega_dom
                FROM $dominio" . "_linha
               ORDER BY nome";

    $result = sql($g_sql, $query);

    $linhas = [];

    while ($row = pg_fetch_assoc($result))
      $linhas[] = [
          'nro_linha' => (int)$row['nro_linha'],
                'nome' => trim($row['nome']),
          'sigla_emit' => trim($row['sigla_emit']),
          'sigla_dest' => trim($row['sigla_dest']),
           'unidades' => trim($row['unidades']),
              'km_ida' => (int)$row['km_ida'],
            'km_volta' => (int)$row['km_volta'],
          'carrega_seg' => ((string)($row['carrega_seg'] ?? '') === 't'),
          'carrega_ter' => ((string)($row['carrega_ter'] ?? '') === 't'),
          'carrega_qua' => ((string)($row['carrega_qua'] ?? '') === 't'),
          'carrega_qui' => ((string)($row['carrega_qui'] ?? '') === 't'),
          'carrega_sex' => ((string)($row['carrega_sex'] ?? '') === 't'),
          'carrega_sab' => ((string)($row['carrega_sab'] ?? '') === 't'),
          'carrega_dom' => ((string)($row['carrega_dom'] ?? '') === 't'),
      ];

    echo json_encode([
        'success' => true,
        'linhas' => $linhas,
        'total' => count($linhas)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
