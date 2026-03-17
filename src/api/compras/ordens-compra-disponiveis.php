<?php
/**
 * API: Ordens de Compra Disponíveis (Aprovadas com ORÇAR=NÃO)
 * 
 * Retorna o total de ordens de compra que estão APROVADAS e foram aprovadas com ORÇAR = NÃO
 * 
 * Regra de Unidade:
 * - Se unidade do usuário = MTZ/ALL: traz TODAS as ordens
 * - Se unidade ≠ MTZ/ALL: traz apenas ordens DA UNIDADE do usuário
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($currentUser['domain']);
$tblOrdemCompra = $prefix . '_ordem_compra';

// ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
$g_sql = connect();

try {
    // Pegar unidade atual do usuário (do header)
    $unidadeAtual = $currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '';
    $unidadeAtualUpper = strtoupper($unidadeAtual);
    $isMtzOrAll = ($unidadeAtualUpper === 'MTZ' || $unidadeAtualUpper === 'ALL');
    
    // Query para buscar total de ordens de compra disponíveis
    // Condições:
    // 1. aprovada = 'S' (ordem aprovada)
    // 2. orcar = 'N' (não precisa orçar)
    // 3. Respeitar regra de unidade (MTZ/ALL vê todas, outras veem apenas da sua unidade)
    
    $where = ["aprovada = 'S'", "orcar = 'N'"];
    $params = [];
    $paramCount = 1;
    
    if (!$isMtzOrAll) {
        // Outras unidades veem apenas da sua unidade
        $where[] = "UPPER(unidade) = $" . $paramCount++;
        $params[] = strtoupper($unidadeAtual);
    }
    
    $whereClause = implode(' AND ', $where);
    
    $query = "
        SELECT COUNT(*) as total
        FROM $tblOrdemCompra
        WHERE $whereClause
    ";

    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
    $result = sql($query, $params, $g_sql);

    if ($result === false) {
        $error = pg_last_error($g_sql);
        error_log("ERRO na query ordens-compra-disponiveis: " . $error);
        throw new Exception("Erro ao buscar ordens de compra: " . $error);
    }

    $row = pg_fetch_assoc($result);
    $total = (int)($row['total'] ?? 0);
    
    echo json_encode([
        'success' => true,
        'total' => $total,
        'unidade' => $unidadeAtual,
        'filtro' => $isMtzOrAll ? 'TODAS' : $unidadeAtual
    ]);

} catch (Exception $e) {
    msg('Erro ao buscar ordens de compra disponíveis: ' . $e->getMessage(), 'error');
}