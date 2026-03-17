<?php
/**
 * API ESTOQUE - ITENS COM SALDO EM UM ESTOQUE
 * Retorna apenas itens que têm saldo (soma de todas as posições) no estoque
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

$domain = $currentUser['domain'] ?? 'acv';
$unidadeAtual = $currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '';

// ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
$conn = connect();

$prefix = $domain . '_';
$tblItem = $prefix . 'item';
$tblPosicao = $prefix . 'posicao';
$tblEstoque = $prefix . 'estoque';
$tblUnidadeMedida = $prefix . 'unidade_medida';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
        exit;
    }
    
    // Parâmetros
    $unidade = strtoupper(trim($_GET['unidade'] ?? ''));
    $nro_estoque = trim($_GET['nro_estoque'] ?? '');
    $apenas_com_saldo = isset($_GET['apenas_com_saldo']) && $_GET['apenas_com_saldo'] === 'S';
    
    if (empty($unidade) || empty($nro_estoque)) {
        msg('Parâmetros inválidos');
    }
    
    // ✅ REGRA DE UNIDADE: Se não for MTZ, só pode ver sua própria unidade
    if (strtoupper($unidadeAtual) !== 'MTZ' && strtoupper($unidade) !== strtoupper($unidadeAtual)) {
        msg('Acesso negado a esta unidade');
    }
    
    // Buscar seq_estoque
    $estoqueQuery = "SELECT seq_estoque FROM $tblEstoque WHERE unidade = $1 AND nro_estoque = $2";
    $estoqueResult = sql($conn, $estoqueQuery, false, [$unidade, $nro_estoque]);
    
    if (pg_num_rows($estoqueResult) === 0) {
        msg('Estoque não encontrado');
    }
    
    $estoqueRow = pg_fetch_assoc($estoqueResult);
    $seq_estoque = intval($estoqueRow['seq_estoque']);
    
    // Buscar itens com saldo neste estoque (somando saldo de todas as posições)
    $query = "
        SELECT 
            i.seq_item,
            i.codigo,
            i.descricao,
            COALESCE(SUM(p.saldo), 0) as saldo_total,
            COALESCE(u.sigla, 'UN') as unidade_medida_sigla
        FROM $tblItem i
        LEFT JOIN $tblPosicao p ON 
            p.seq_item = i.seq_item AND
            p.seq_estoque = $1
        LEFT JOIN $tblUnidadeMedida u ON i.seq_unidade_medida = u.seq_unidade_medida
        WHERE i.ativo = 'S'
        GROUP BY i.seq_item, i.codigo, i.descricao, u.sigla
    ";
    
    if ($apenas_com_saldo) {
        $query .= " HAVING COALESCE(SUM(p.saldo), 0) > 0";
    }
    
    $query .= " ORDER BY i.codigo";
    
    $result = sql($conn, $query, false, [$seq_estoque]);
    $itens = [];
    
    while ($row = pg_fetch_assoc($result)) {
        $row['seq_item'] = intval($row['seq_item']);
        $row['saldo_total'] = floatval($row['saldo_total']);
        $itens[] = $row;
    }
    
    echo json_encode(['success' => true, 'data' => $itens]);
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/itens_estoque.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
}