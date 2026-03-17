<?php
/**
 * ================================================================
 * SCRIPT: CORRIGIR ORDENS DUPLICADAS NO MENU
 * ================================================================
 * Endpoint: /api/menu/fix_ordem_duplicates.php
 * Método: GET
 * Descrição: Reorganiza todas as seções garantindo ordens sequenciais
 * ================================================================
 */

require_once '../config.php';

setupCORS();
handleOptionsRequest();

header('Content-Type: application/json; charset=utf-8');

try {
    global $g_sql;
    
    echo json_encode([
        'success' => false,
        'message' => 'Este script foi desabilitado por segurança. Execute manualmente via SQL:'
    ]) . "\n\n";
    
    echo "-- Script SQL para reorganizar ordens:\n\n";
    echo "UPDATE menu_items mi\n";
    echo "SET ordem = subq.new_ordem\n";
    echo "FROM (\n";
    echo "  SELECT \n";
    echo "    id,\n";
    echo "    ROW_NUMBER() OVER (PARTITION BY section_id ORDER BY ordem, id) as new_ordem\n";
    echo "  FROM menu_items\n";
    echo ") subq\n";
    echo "WHERE mi.id = subq.id;\n\n";
    echo "-- Verificar resultado:\n";
    echo "SELECT \n";
    echo "  ms.name as secao,\n";
    echo "  mi.name as item,\n";
    echo "  mi.ordem\n";
    echo "FROM menu_items mi\n";
    echo "JOIN menu_sections ms ON mi.section_id = ms.id\n";
    echo "ORDER BY ms.display_order, mi.ordem;\n";
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro: ' . $e->getMessage()
    ]);
}
