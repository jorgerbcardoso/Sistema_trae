<?php
/**
 * API: Excluir Lançamento Manual de Receita
 * Exclui um CT-e criado manualmente
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../middleware/auth.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        msg('Método não permitido', 'error');
    }
    
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => $authResult['message']
        ]);
        exit();
    }

    $dominio = strtolower($authResult['domain']);
    $input = json_decode(file_get_contents('php://input'), true);
    
    $nro_cte = $input['nro_cte'] ?? null;
    $ser_cte = $input['ser_cte'] ?? null;
    
    if (!$nro_cte || !$ser_cte) {
        msg('Número e série do CT-e são obrigatórios', 'error');
    }
    
    // Conectar ao banco
    $conn = getDBConnection();
    @pg_query($conn, "SET TIMEZONE TO 'America/Sao_Paulo'");
    
    $tableName = "{$dominio}_cte";
    
    // Verificar se o CT-e existe e é lançamento manual usando sql()
    $checkQuery = "
        SELECT COUNT(*) as count
        FROM {$tableName}
        WHERE nro_cte = $1 AND ser_cte = $2 AND tp_documento = 'MANUAL'
    ";
    
    $checkResult = sql($checkQuery, [$nro_cte, $ser_cte], $conn);
    
    if (!$checkResult) {
        closeDBConnection($conn);
        msg('Erro ao verificar lançamento: ' . pg_last_error($conn), 'error');
    }
    
    $exists = (int)pg_fetch_result($checkResult, 0, 0) > 0;
    
    if (!$exists) {
        closeDBConnection($conn);
        msg('Lançamento manual não encontrado', 'error');
    }
    
    // Deletar CT-e usando sql()
    $deleteQuery = "
        DELETE FROM {$tableName}
        WHERE nro_cte = $1 AND ser_cte = $2
    ";
    
    $deleteResult = sql($deleteQuery, [$nro_cte, $ser_cte], $conn);
    
    if (!$deleteResult) {
        closeDBConnection($conn);
        msg('Erro ao excluir lançamento: ' . pg_last_error($conn), 'error');
    }
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'message' => 'Lançamento manual excluído com sucesso'
    ]);
    
} catch (Exception $e) {
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    msg('Erro: ' . $e->getMessage(), 'error');
}
