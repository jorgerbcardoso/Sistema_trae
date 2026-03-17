<?php
/**
 * API: Deletar Evento
 * Remove um evento do domínio
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: DELETE, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
        throw new Exception('Método não permitido');
    }
    
    // Obter dados do DELETE
    $input = json_decode(file_get_contents('php://input'), true);
    
    $domain = $input['domain'] ?? $_GET['domain'] ?? null;
    $evento = $input['evento'] ?? $_GET['evento'] ?? null;
    
    // Validações
    if (!$domain) {
        throw new Exception('Domínio não especificado');
    }
    
    if ($evento === null) {
        throw new Exception('ID do evento não especificado');
    }
    
    // Validar domínio (apenas letras e números)
    if (!preg_match('/^[A-Z0-9]+$/i', $domain)) {
        throw new Exception('Domínio inválido');
    }
    
    $domain = strtolower($domain);
    
    if (!isDatabaseConfigured()) {
        throw new Exception('Banco de dados não configurado');
    }
    
    $conn = getDBConnection();
    
    // Nome da tabela baseado no domínio
    $tableName = $domain . '_evento';
    $tableNameEscaped = pg_escape_identifier($conn, $tableName);
    
    // Verificar se a tabela existe
    $checkTableStmt = pg_prepare($conn, "check_table",
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        )");
    
    if (!$checkTableStmt) {
        throw new Exception('Erro ao preparar query de verificação: ' . pg_last_error($conn));
    }
    
    $checkResult = pg_execute($conn, "check_table", [$tableName]);
    
    if (!$checkResult) {
        throw new Exception('Erro ao verificar tabela: ' . pg_last_error($conn));
    }
    
    $tableExists = pg_fetch_result($checkResult, 0, 0) === 't';
    
    if (!$tableExists) {
        throw new Exception('Tabela de eventos não encontrada para o domínio ' . strtoupper($domain));
    }
    
    // Deletar evento
    $deleteStmt = pg_prepare($conn, "delete_evento",
        "DELETE FROM " . $tableNameEscaped . " 
         WHERE evento = $1
         RETURNING evento");
    
    if (!$deleteStmt) {
        throw new Exception('Erro ao preparar delete: ' . pg_last_error($conn));
    }
    
    $deleteResult = pg_execute($conn, "delete_evento", [$evento]);
    
    if (!$deleteResult) {
        throw new Exception('Erro ao deletar evento: ' . pg_last_error($conn));
    }
    
    if (pg_num_rows($deleteResult) === 0) {
        throw new Exception('Evento não encontrado');
    }
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'message' => 'Evento deletado com sucesso!'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
