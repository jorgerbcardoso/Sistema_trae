<?php
/**
 * ================================================================
 * API: ATUALIZAR SEÇÃO DO MENU
 * ================================================================
 * Endpoint: /api/menu/update_section.php
 * Método: POST
 * Body: { id, code, name, description, icon, display_order, is_active }
 * ================================================================
 */

require_once '../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

// Receber dados JSON
$data = getRequestInput();

// Validações
if (empty($data['id'])) {
    msg('ID da seção é obrigatório', 'error');
}

if (empty($data['code'])) {
    msg('Código da seção é obrigatório', 'error');
}

if (empty($data['name'])) {
    msg('Nome da seção é obrigatório', 'error');
}

try {
    // ✅ PADRÃO OFICIAL: Usar global $g_sql
    global $g_sql;
    
    // Verificar se o código já existe em outra seção
    $sqlCheck = "SELECT id FROM menu_sections WHERE code = $1 AND id != $2";
    $resultCheck = sql($sqlCheck, [$data['code'], $data['id']], $g_sql);
    
    if (pg_num_rows($resultCheck) > 0) {
        msg('Código da seção já existe em outra seção', 'error');
    }
    
    // Atualizar seção
    $code = strtoupper($data['code']);
    $name = strtoupper($data['name']);
    $description = !empty($data['description']) ? strtoupper($data['description']) : null;
    $icon = $data['icon'] ?? 'Menu';
    $display_order = $data['display_order'] ?? 1;
    $is_active = phpBoolToPg($data['is_active'] ?? true);
    
    $sqlUpdate = "
        UPDATE menu_sections SET
            code = $1,
            name = $2,
            description = $3,
            icon = $4,
            display_order = $5,
            is_active = $6,
            updated_at = NOW()
        WHERE id = $7
    ";
    
    sql($sqlUpdate, [
        $code,
        $name,
        $description,
        $icon,
        $display_order,
        $is_active,
        $data['id']
    ], $g_sql);
    
    echo json_encode([
        'success' => true,
        'message' => 'Seção atualizada com sucesso'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    msg('Erro ao atualizar seção: ' . $e->getMessage(), 'error');
}