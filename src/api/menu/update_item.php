<?php
/**
 * ================================================================
 * API: ATUALIZAR ITEM DO MENU
 * ================================================================
 * Endpoint: /api/menu/update_item.php
 * Método: POST
 * Body: { id, section_id, code, name, description, icon, route_path, component_path, is_available, status, ordem }
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

if (empty($data['section_id'])) {
    msg('Seção é obrigatória', 'error');
}

if (empty($data['code'])) {
    msg('Código do item é obrigatório', 'error');
}

if (empty($data['name'])) {
    msg('Nome do item é obrigatório', 'error');
}

if (empty($data['route_path'])) {
    msg('Rota é obrigatória', 'error');
}

if (empty($data['component_path'])) {
    msg('Caminho do componente é obrigatório', 'error');
}

try {
    // ✅ PADRÃO OFICIAL: Usar global $g_sql
    global $g_sql;
    
    // ✅ LOG: Início da operação
    error_log("=== UPDATE ITEM MENU ===");
    error_log("Item ID: " . $data['id']);
    error_log("Nova Section ID: " . $data['section_id']);
    error_log("Nova Ordem: " . ($data['ordem'] ?? 'não informada'));
    
    // Verificar se a seção existe
    $sqlCheckSection = "SELECT id FROM menu_sections WHERE id = $1";
    $resultCheckSection = sql($sqlCheckSection, [$data['section_id']], $g_sql);
    
    if (pg_num_rows($resultCheckSection) === 0) {
        msg('Seção não encontrada', 'error');
    }
    
    // Verificar se o código já existe em outro item
    $sqlCheck = "SELECT id FROM menu_items WHERE code = $1 AND id != $2";
    $resultCheck = sql($sqlCheck, [$data['code'], $data['id']], $g_sql);
    
    if (pg_num_rows($resultCheck) > 0) {
        msg('Código do item já existe em outro item', 'error');
    }
    
    // ✅ BUSCAR A ORDEM ATUAL DO ITEM
    $sqlCurrentItem = "SELECT section_id, ordem FROM menu_items WHERE id = $1";
    $resultCurrentItem = sql($sqlCurrentItem, [$data['id']], $g_sql);
    $currentItem = pg_fetch_assoc($resultCurrentItem);
    
    if (!$currentItem) {
        msg('Item não encontrado', 'error');
    }
    
    $oldSectionId = (int)$currentItem['section_id'];
    $oldOrdem = (int)$currentItem['ordem'];
    $newSectionId = (int)$data['section_id'];
    $newOrdem = isset($data['ordem']) ? (int)$data['ordem'] : $oldOrdem;
    
    error_log("Antiga Section ID: $oldSectionId | Antiga Ordem: $oldOrdem");
    error_log("Nova Section ID: $newSectionId | Nova Ordem: $newOrdem");
    
    // ================================================================
    // ✅ REORGANIZAÇÃO AUTOMÁTICA DE ORDENS
    // ================================================================
    
    // Caso 1: Mudou de seção
    if ($oldSectionId != $newSectionId) {
        error_log("CASO 1: Mudou de seção");
        
        // 1A. Fechar buraco na seção antiga (diminuir ordem dos itens que estavam abaixo)
        $sqlReorganizeOld = "
            UPDATE menu_items 
            SET ordem = ordem - 1 
            WHERE section_id = $1 
              AND ordem > $2
              AND id != $3
        ";
        sql($sqlReorganizeOld, [$oldSectionId, $oldOrdem, $data['id']], $g_sql);
        error_log("Fechou buraco na seção antiga (section_id=$oldSectionId, ordem>$oldOrdem)");
        
        // 1B. Abrir espaço na seção nova (aumentar ordem dos itens >= nova posição)
        $sqlReorganizeNew = "
            UPDATE menu_items 
            SET ordem = ordem + 1 
            WHERE section_id = $1 
              AND ordem >= $2
              AND id != $3
        ";
        sql($sqlReorganizeNew, [$newSectionId, $newOrdem, $data['id']], $g_sql);
        error_log("Abriu espaço na seção nova (section_id=$newSectionId, ordem>=$newOrdem)");
    }
    // Caso 2: Mesma seção, mas ordem diferente
    else if ($oldOrdem != $newOrdem) {
        error_log("CASO 2: Mesma seção, ordem diferente");
        
        if ($newOrdem < $oldOrdem) {
            // 2A. Moveu PARA CIMA: deslocar itens entre nova e antiga posição PARA BAIXO
            error_log("Moveu PARA CIMA (de $oldOrdem para $newOrdem)");
            $sqlShift = "
                UPDATE menu_items 
                SET ordem = ordem + 1 
                WHERE section_id = $1 
                  AND ordem >= $2 
                  AND ordem < $3
                  AND id != $4
            ";
            sql($sqlShift, [$newSectionId, $newOrdem, $oldOrdem, $data['id']], $g_sql);
            error_log("Deslocou itens PARA BAIXO (ordem entre $newOrdem e $oldOrdem)");
        } else {
            // 2B. Moveu PARA BAIXO: deslocar itens entre antiga e nova posição PARA CIMA
            error_log("Moveu PARA BAIXO (de $oldOrdem para $newOrdem)");
            $sqlShift = "
                UPDATE menu_items 
                SET ordem = ordem - 1 
                WHERE section_id = $1 
                  AND ordem > $2 
                  AND ordem <= $3
                  AND id != $4
            ";
            sql($sqlShift, [$newSectionId, $oldOrdem, $newOrdem, $data['id']], $g_sql);
            error_log("Deslocou itens PARA CIMA (ordem entre $oldOrdem e $newOrdem)");
        }
    } else {
        error_log("CASO 3: Mesma seção e mesma ordem (sem reorganização)");
    }
    
    // ================================================================
    // ✅ ATUALIZAR O ITEM
    // ================================================================
    
    $code = strtolower($data['code']);
    $name = strtoupper($data['name']);
    $description = !empty($data['description']) ? strtoupper($data['description']) : null;
    $icon = $data['icon'] ?? 'FileText';
    $route_path = strtolower($data['route_path']);
    $component_path = $data['component_path'];
    $is_available = phpBoolToPg($data['is_available'] ?? true);
    $status = $data['status'] ?? 'development';
    
    $sqlUpdate = "
        UPDATE menu_items SET
            section_id = $1,
            code = $2,
            name = $3,
            description = $4,
            icon = $5,
            route_path = $6,
            component_path = $7,
            is_available = $8,
            status = $9,
            ordem = $10,
            updated_at = NOW()
        WHERE id = $11
    ";
    
    sql($sqlUpdate, [
        $newSectionId,
        $code,
        $name,
        $description,
        $icon,
        $route_path,
        $component_path,
        $is_available,
        $status,
        $newOrdem,
        $data['id']
    ], $g_sql);
    
    error_log("✅ Item atualizado com sucesso! ID: " . $data['id']);
    
    // ================================================================
    // ✅ VALIDAÇÃO FINAL: Garantir que não há ordens duplicadas
    // ================================================================
    
    $sqlCheckDuplicates = "
        SELECT ordem, COUNT(*) as total 
        FROM menu_items 
        WHERE section_id = $1 
        GROUP BY ordem 
        HAVING COUNT(*) > 1
    ";
    $resultDuplicates = sql($sqlCheckDuplicates, [$newSectionId], $g_sql);
    
    if (pg_num_rows($resultDuplicates) > 0) {
        error_log("⚠️ ATENÇÃO: Ordens duplicadas detectadas na seção $newSectionId!");
        while ($dup = pg_fetch_assoc($resultDuplicates)) {
            error_log("   Ordem {$dup['ordem']} tem {$dup['total']} itens");
        }
        
        // ✅ REORGANIZAR SEQUENCIALMENTE TODA A SEÇÃO
        $sqlReorganizeFull = "
            UPDATE menu_items mi
            SET ordem = subq.new_ordem
            FROM (
                SELECT id, ROW_NUMBER() OVER (ORDER BY ordem, id) as new_ordem
                FROM menu_items
                WHERE section_id = $1
            ) subq
            WHERE mi.id = subq.id
        ";
        sql($sqlReorganizeFull, [$newSectionId], $g_sql);
        error_log("✅ Seção reorganizada sequencialmente");
    }
    
    msg('Item atualizado com sucesso', 'success');
    
} catch (Exception $e) {
    error_log("❌ ERRO ao atualizar item: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    msg('Erro ao atualizar item: ' . $e->getMessage(), 'error');
}
