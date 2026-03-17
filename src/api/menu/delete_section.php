<?php
/**
 * ================================================================
 * API: EXCLUIR SEÇÃO DO MENU
 * ================================================================
 * Endpoint: /api/menu/delete_section.php
 * Método: POST
 * Body: { id }
 * ⚠️ A seção deve estar vazia (sem itens) para ser excluída
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

try {
    // ✅ PADRÃO OFICIAL: Usar global $g_sql
    global $g_sql;
    
    // Verificar se a seção existe
    $sqlCheck = "SELECT id, name FROM menu_sections WHERE id = $1";
    $resultCheck = sql($sqlCheck, [$data['id']], $g_sql);
    
    if (pg_num_rows($resultCheck) === 0) {
        msg('Seção não encontrada', 'error');
    }
    
    // Verificar se a seção tem itens
    $sqlCheckItems = "SELECT COUNT(*) as total FROM menu_items WHERE section_id = $1";
    $resultCheckItems = sql($sqlCheckItems, [$data['id']], $g_sql);
    $row = pg_fetch_assoc($resultCheckItems);
    
    if ($row['total'] > 0) {
        msg('Não é possível excluir seção com itens. Exclua os itens primeiro.', 'error');
    }
    
    // Excluir seção
    $sqlDelete = "DELETE FROM menu_sections WHERE id = $1";
    sql($sqlDelete, [$data['id']], $g_sql);
    
    echo json_encode([
        'success' => true,
        'message' => 'Seção excluída com sucesso'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    msg('Erro ao excluir seção: ' . $e->getMessage(), 'error');
}