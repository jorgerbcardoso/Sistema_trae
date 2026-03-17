<?php
/**
 * MIGRAÇÃO DE DADOS: Atualizar status de pedidos de VARCHAR para CHAR(1)
 * 
 * Converte:
 * - 'PENDENTE' -> 'P'
 * - 'APROVADO', 'ENTREGUE', 'FINALIZADO' -> 'E'
 */

require_once '/var/www/html/sistema/api/config.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

$domain = $currentUser['domain'] ?? 'acv';
$login = $currentUser['username'] ?? 'SISTEMA';

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($domain) . '_';
$tblPedido = $prefix . 'pedido';

error_log("=== MIGRAÇÃO PEDIDO STATUS ===");
error_log("Domain: " . $domain);
error_log("Tabela: " . $tblPedido);

// ✅ Conectar ao banco
$g_sql = connect();

try {
    // 1️⃣ VERIFICAR STATUS ATUAIS ANTES DA MIGRAÇÃO
    $queryBefore = "
        SELECT 
            status,
            COUNT(*) as qtd
        FROM $tblPedido
        GROUP BY status
        ORDER BY status
    ";
    
    error_log("📊 ANTES DA MIGRAÇÃO:");
    $resultBefore = sql($queryBefore, [], $g_sql);
    $statusBefore = [];
    
    if ($resultBefore) {
        while ($row = pg_fetch_assoc($resultBefore)) {
            $statusBefore[] = $row;
            error_log("  Status: '{$row['status']}' -> Quantidade: {$row['qtd']}");
        }
    }
    
    // 2️⃣ EXECUTAR MIGRAÇÃO
    sql("BEGIN", [], $g_sql);
    
    $queryMigrate = "
        UPDATE $tblPedido
        SET status = CASE
            WHEN UPPER(status) IN ('PENDENTE', 'ABERTO', 'EM ANDAMENTO') THEN 'P'
            WHEN UPPER(status) IN ('APROVADO', 'ENTREGUE', 'FINALIZADO', 'CONCLUIDO', 'CONCLUÍDO') THEN 'E'
            ELSE 'P'
        END
        WHERE LENGTH(status) > 1
    ";
    
    $resultMigrate = sql($queryMigrate, [], $g_sql);
    
    if ($resultMigrate === false) {
        sql("ROLLBACK", [], $g_sql);
        throw new Exception('Erro ao executar migração: ' . pg_last_error($g_sql));
    }
    
    $rowsAffected = pg_affected_rows($resultMigrate);
    error_log("✅ Migração executada: {$rowsAffected} registros atualizados");
    
    sql("COMMIT", [], $g_sql);
    
    // 3️⃣ VERIFICAR STATUS DEPOIS DA MIGRAÇÃO
    $queryAfter = "
        SELECT 
            status,
            COUNT(*) as qtd
        FROM $tblPedido
        GROUP BY status
        ORDER BY status
    ";
    
    error_log("📊 DEPOIS DA MIGRAÇÃO:");
    $resultAfter = sql($queryAfter, [], $g_sql);
    $statusAfter = [];
    
    if ($resultAfter) {
        while ($row = pg_fetch_assoc($resultAfter)) {
            $statusAfter[] = $row;
            error_log("  Status: '{$row['status']}' -> Quantidade: {$row['qtd']}");
        }
    }
    
    error_log("================================");
    
    // ✅ Retornar sucesso
    echo json_encode([
        'success' => true,
        'message' => "Migração concluída com sucesso! {$rowsAffected} registro(s) atualizado(s).",
        'rows_affected' => $rowsAffected,
        'before' => $statusBefore,
        'after' => $statusAfter
    ]);
    
} catch (Exception $e) {
    error_log("❌ ERRO na migração: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro na migração: ' . $e->getMessage()
    ]);
} finally {
    // ✅ Fechar conexão
    if (isset($g_sql) && $g_sql && is_resource($g_sql)) {
        @pg_close($g_sql);
    }
}
