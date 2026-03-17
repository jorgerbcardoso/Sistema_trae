<?php
/**
 * ================================================================
 * API: CRIAR NOVO ITEM DO MENU
 * ================================================================
 * Endpoint: /api/menu/create_item.php
 * Método: POST
 * Body: { section_id, code, name, description, icon, route_path, component_path, is_available, status, ordem }
 * ================================================================
 */

require_once '../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

// Receber dados JSON
$data = getRequestInput();

// Validações
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
    
    error_log("=== CREATE ITEM MENU ===");
    error_log("Section ID: " . $data['section_id']);
    error_log("Code: " . $data['code']);
    error_log("Ordem solicitada: " . ($data['ordem'] ?? 'auto'));
    
    // Verificar se a seção existe
    $sqlCheckSection = "SELECT id FROM menu_sections WHERE id = $1";
    $resultCheckSection = sql($sqlCheckSection, [$data['section_id']], $g_sql);
    
    if (pg_num_rows($resultCheckSection) === 0) {
        msg('Seção não encontrada', 'error');
    }
    
    // Verificar se o código já existe
    $sqlCheck = "SELECT id FROM menu_items WHERE code = $1";
    $resultCheck = sql($sqlCheck, [$data['code']], $g_sql);
    
    if (pg_num_rows($resultCheck) > 0) {
        msg('Código do item já existe', 'error');
    }
    
    // ================================================================
    // ✅ DEFINIR ORDEM
    // ================================================================
    
    $newOrdem = 999;
    
    if (isset($data['ordem']) && is_numeric($data['ordem'])) {
        // Ordem específica informada
        $newOrdem = (int)$data['ordem'];
        
        // Abrir espaço: deslocar itens >= nova posição
        $sqlShift = "
            UPDATE menu_items 
            SET ordem = ordem + 1 
            WHERE section_id = $1 
              AND ordem >= $2
        ";
        sql($sqlShift, [$data['section_id'], $newOrdem], $g_sql);
        error_log("Abriu espaço na ordem $newOrdem (deslocou itens >= $newOrdem)");
    } else {
        // Buscar próxima ordem disponível (maior + 1)
        $sqlMaxOrdem = "
            SELECT COALESCE(MAX(ordem), 0) + 1 as next_ordem 
            FROM menu_items 
            WHERE section_id = $1
        ";
        $resultMaxOrdem = sql($sqlMaxOrdem, [$data['section_id']], $g_sql);
        $rowMaxOrdem = pg_fetch_assoc($resultMaxOrdem);
        $newOrdem = (int)$rowMaxOrdem['next_ordem'];
        error_log("Ordem automática calculada: $newOrdem");
    }
    
    // ================================================================
    // ✅ INSERIR ITEM
    // ================================================================
    
    $code = strtolower($data['code']);
    $name = strtoupper($data['name']);
    $description = !empty($data['description']) ? strtoupper($data['description']) : null;
    $icon = $data['icon'] ?? 'FileText';
    $route_path = strtolower($data['route_path']);
    $component_path = $data['component_path'];
    $is_available = phpBoolToPg($data['is_available'] ?? true);
    $status = $data['status'] ?? 'development';
    
    $sqlInsert = "
        INSERT INTO menu_items (
            section_id,
            code,
            name,
            description,
            icon,
            route_path,
            component_path,
            is_available,
            status,
            ordem
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING id
    ";
    
    $result = sql($sqlInsert, [
        $data['section_id'],
        $code,
        $name,
        $description,
        $icon,
        $route_path,
        $component_path,
        $is_available,
        $status,
        $newOrdem
    ], $g_sql);
    
    $row = pg_fetch_assoc($result);
    $newId = $row['id'];
    
    error_log("✅ Item criado com sucesso! ID: $newId | Ordem: $newOrdem");
    
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
    $resultDuplicates = sql($sqlCheckDuplicates, [$data['section_id']], $g_sql);
    
    if (pg_num_rows($resultDuplicates) > 0) {
        error_log("⚠️ ATENÇÃO: Ordens duplicadas detectadas na seção {$data['section_id']}!");
        
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
        sql($sqlReorganizeFull, [$data['section_id']], $g_sql);
        error_log("✅ Seção reorganizada sequencialmente");
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Item criado com sucesso',
        'id' => (int)$newId
    ]);
    
} catch (Exception $e) {
    error_log("❌ ERRO ao criar item: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    msg('Erro ao criar item: ' . $e->getMessage(), 'error');
}
