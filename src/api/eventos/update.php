<?php
/**
 * API: Atualizar Evento
 * Atualiza um evento existente
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
        throw new Exception('Método não permitido');
    }
    
    // Obter dados do PUT
    $input = json_decode(file_get_contents('php://input'), true);
    
    $domain = $input['domain'] ?? null;
    $evento = $input['evento'] ?? null;
    $descricao = $input['descricao'] ?? null;
    $ordem = $input['ordem'] ?? null;
    $considerar = $input['considerar'] ?? null;
    $tipo = $input['tipo'] ?? 'N';
    
    // Validações
    if (!$domain) {
        throw new Exception('Domínio não especificado');
    }
    
    if ($evento === null) {
        throw new Exception('ID do evento não especificado');
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
    if ($considerar !== null && !in_array($considerar, ['S', 'N'])) {
        throw new Exception('Valor de "considerar" inválido. Use S ou N');
    }
    
    // Validar tipo (apenas N, I, D ou F)
    if ($tipo !== null && !in_array($tipo, ['N', 'I', 'D', 'F'])) {
        throw new Exception('Valor de "tipo" inválido. Use N, I, D ou F');
    }
    
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
    
    // Atualizar evento
    $updateStmt = pg_prepare($conn, "update_evento",
        "UPDATE " . $tableNameEscaped . " 
         SET descricao = $1, ordem = $2, considerar = $3, tipo = $4
         WHERE evento = $5
         RETURNING evento, descricao, ordem, considerar, tipo");
    
    if (!$updateStmt) {
        throw new Exception('Erro ao preparar update: ' . pg_last_error($conn));
    }
    
    $updateResult = pg_execute($conn, "update_evento", [
        $descricao,
        $ordem,
        $considerar ?? 'S',
        $tipo,
        $evento
    ]);
    
    if (!$updateResult) {
        throw new Exception('Erro ao atualizar evento: ' . pg_last_error($conn));
    }
    
    if (pg_num_rows($updateResult) === 0) {
        throw new Exception('Evento não encontrado');
    }
    
    $updatedEvento = pg_fetch_assoc($updateResult);
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'message' => 'Evento atualizado com sucesso!',
        'evento' => [
            'evento' => (int)$updatedEvento['evento'],
            'descricao' => $updatedEvento['descricao'],
            'ordem' => (int)$updatedEvento['ordem'],
            'considerar' => trim($updatedEvento['considerar']),
            'tipo' => trim($updatedEvento['tipo'])
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}