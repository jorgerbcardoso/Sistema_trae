<?php
/**
 * ================================================================
 * API: CRIAR NOVA SEÇÃO DO MENU
 * ================================================================
 * Endpoint: /api/menu/create_section.php
 * Método: POST
 * Body: { code, name, description, icon, display_order, is_active }
 * ================================================================
 */

require_once '../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

// Receber dados JSON
$data = getRequestInput();

// Validações
if (empty($data['code'])) {
    msg('Código da seção é obrigatório', 'error');
}

if (empty($data['name'])) {
    msg('Nome da seção é obrigatório', 'error');
}

try {
    // ✅ PADRÃO OFICIAL: Usar global $g_sql
    global $g_sql;
    
    // Verificar se o código já existe
    $sqlCheck = "SELECT id FROM menu_sections WHERE code = $1";
    $resultCheck = sql($sqlCheck, [$data['code']], $g_sql);
    
    if (pg_num_rows($resultCheck) > 0) {
        msg('Código da seção já existe', 'error');
    }
    
    // Inserir seção
    $code = strtoupper($data['code']);
    $name = strtoupper($data['name']);
    $description = !empty($data['description']) ? strtoupper($data['description']) : null;
    $icon = $data['icon'] ?? 'Menu';
    $display_order = $data['display_order'] ?? 1;
    $is_active = phpBoolToPg($data['is_active'] ?? true);
    
    $sqlInsert = "
        INSERT INTO menu_sections (
            code,
            name,
            description,
            icon,
            display_order,
            is_active
        ) VALUES (
            $1, $2, $3, $4, $5, $6
        ) RETURNING id
    ";
    
    $result = sql($sqlInsert, [
        $code,
        $name,
        $description,
        $icon,
        $display_order,
        $is_active
    ], $g_sql);
    
    $row = pg_fetch_assoc($result);
    $newId = $row['id'];
    
    echo json_encode([
        'success' => true,
        'message' => 'Seção criada com sucesso',
        'id' => (int)$newId
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    msg('Erro ao criar seção: ' . $e->getMessage(), 'error');
}