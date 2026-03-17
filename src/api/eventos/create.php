<?php
/**
 * API: Criar Evento
 * Cria um novo evento no domínio
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

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método não permitido');
    }
    
    // Obter dados do POST
    $input = json_decode(file_get_contents('php://input'), true);
    
    $domain = $input['domain'] ?? null;
    $descricao = $input['descricao'] ?? null;
    $ordem = $input['ordem'] ?? null;
    $considerar = $input['considerar'] ?? 'S';
    $tipo = $input['tipo'] ?? 'N';
    
    // Validações
    if (!$domain) {
        throw new Exception('Domínio não especificado');
    }
    
    if (!$descricao || trim($descricao) === '') {
        throw new Exception('Descrição é obrigatória');
    }
    
    if ($ordem === null || $ordem === '') {
        throw new Exception('Ordem é obrigatória');
    }
    
    // Validar domínio (apenas letras e números)
    if (!preg_match('/^[A-Z0-9]+$/i', $domain)) {
        throw new Exception('Domínio inválido');
    }
    
    $domain = strtolower($domain);
    
    // Validar considerar (apenas S ou N)
    if (!in_array($considerar, ['S', 'N'])) {
        throw new Exception('Valor de "considerar" inválido. Use S ou N');
    }
    
    // Validar tipo (apenas N, I, D ou F)
    if (!in_array($tipo, ['N', 'I', 'D', 'F'])) {
        throw new Exception('Valor de "tipo" inválido. Use N, I, D ou F');
    }
    
    if (!isDatabaseConfigured()) {
        throw new Exception('Banco de dados não configurado');
    }
    
    $conn = getDBConnection();
    
    // Nome da tabela baseado no domínio
    $tableName = $domain . '_evento';
    $tableNameEscaped = pg_escape_identifier($conn, $tableName);
    
    // Verificar se a tabela existe, se não, criar
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
        // Criar tabela
        $createTableQuery = "CREATE TABLE " . $tableNameEscaped . " (
            evento INTEGER NOT NULL,
            descricao VARCHAR,
            ordem INTEGER,
            considerar CHAR(1) DEFAULT 'S',
            tipo CHAR(1) DEFAULT 'N',
            grupo INTEGER DEFAULT 0
        )";
        
        $createResult = pg_query($conn, $createTableQuery);
        
        if (!$createResult) {
            throw new Exception('Erro ao criar tabela: ' . pg_last_error($conn));
        }
    }
    
    // Obter próximo ID (máximo evento + 1)
    $maxIdQuery = "SELECT COALESCE(MAX(evento), 0) + 1 as next_id FROM " . $tableNameEscaped;
    $maxIdResult = pg_query($conn, $maxIdQuery);
    
    if (!$maxIdResult) {
        throw new Exception('Erro ao buscar próximo ID: ' . pg_last_error($conn));
    }
    
    $nextId = pg_fetch_result($maxIdResult, 0, 0);
    
    // Inserir evento
    $insertStmt = pg_prepare($conn, "insert_evento",
        "INSERT INTO " . $tableNameEscaped . " (evento, descricao, ordem, considerar, tipo, grupo) 
         VALUES ($1, $2, $3, $4, $5, 0)
         RETURNING evento, descricao, ordem, considerar, tipo, grupo");
    
    if (!$insertStmt) {
        throw new Exception('Erro ao preparar insert: ' . pg_last_error($conn));
    }
    
    $insertResult = pg_execute($conn, "insert_evento", [
        $nextId,
        $descricao,
        $ordem,
        $considerar,
        $tipo
    ]);
    
    if (!$insertResult) {
        throw new Exception('Erro ao inserir evento: ' . pg_last_error($conn));
    }
    
    $newEvento = pg_fetch_assoc($insertResult);
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'message' => 'Evento criado com sucesso!',
        'evento' => [
            'evento' => (int)$newEvento['evento'],
            'descricao' => $newEvento['descricao'],
            'ordem' => (int)$newEvento['ordem'],
            'considerar' => trim($newEvento['considerar']),
            'tipo' => trim($newEvento['tipo']),
            'grupo' => (int)$newEvento['grupo']
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}