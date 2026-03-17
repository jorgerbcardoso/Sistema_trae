<?php
/**
 * ================================================================
 * API: EXCLUIR ITEM DO MENU
 * ================================================================
 * Endpoint: /api/menu/delete_item.php
 * Método: POST
 * Body: { id }
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
    msg('ID do item é obrigatório', 'error');
}

try {
    // ✅ PADRÃO OFICIAL: Usar global $g_sql
    global $g_sql;
    
    // Verificar se o item existe
    $sqlCheck = "SELECT id, name, section_id, ordem FROM menu_items WHERE id = $1";
    $resultCheck = sql($sqlCheck, [$data['id']], $g_sql);
    
    if (pg_num_rows($resultCheck) === 0) {
        msg('Item não encontrado', 'error');
    }
    
    $item = pg_fetch_assoc($resultCheck);
    $sectionId = (int)$item['section_id'];
    $ordem = (int)$item['ordem'];
    
    // Excluir item
    $sqlDelete = "DELETE FROM menu_items WHERE id = $1";
    sql($sqlDelete, [$data['id']], $g_sql);
    
    // ✅ REORGANIZAR ORDENS (fechar o buraco deixado)
    $sqlReorganize = "
        UPDATE menu_items 
        SET ordem = ordem - 1 
        WHERE section_id = $1 
          AND ordem > $2
    ";
    sql($sqlReorganize, [$sectionId, $ordem], $g_sql);
    
    echo json_encode([
        'success' => true,
        'message' => 'Item excluído com sucesso'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    msg('Erro ao excluir item: ' . $e->getMessage(), 'error');
}