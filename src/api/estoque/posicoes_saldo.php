<?php
/**
 * API ESTOQUE - POSIÇÕES COM SALDO
 * Retorna posições que têm saldo de um item específico em um estoque
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
$tblPosicao = $prefix . 'posicao';
$tblEstoque = $prefix . 'estoque';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
        exit;
    }
    
    // Parâmetros obrigatórios
    $seq_item = intval($_GET['seq_item'] ?? 0);
    $unidade = strtoupper(trim($_GET['unidade'] ?? ''));
    $nro_estoque = trim($_GET['nro_estoque'] ?? '');
    
    if ($seq_item <= 0 || empty($unidade) || empty($nro_estoque)) {
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
    
    // Buscar posições com saldo > 0 para este item neste estoque
    $query = "
        SELECT 
            p.seq_posicao,
            p.seq_estoque,
            p.rua,
            p.altura,
            p.coluna,
            p.saldo,
            (p.rua || ' - ALT ' || p.altura || ' - COL ' || p.coluna) as posicao_descricao
        FROM $tblPosicao p
        WHERE p.seq_estoque = $1
          AND p.seq_item = $2
          AND p.ativa = 'S'
          AND p.saldo > 0
        ORDER BY p.rua, p.altura, p.coluna
    ";
    
    $result = sql($conn, $query, false, [$seq_estoque, $seq_item]);
    $posicoes = [];
    
    while ($row = pg_fetch_assoc($result)) {
        $row['seq_posicao'] = intval($row['seq_posicao']);
        $row['seq_estoque'] = intval($row['seq_estoque']);
        $row['saldo'] = floatval($row['saldo']);
        $posicoes[] = $row;
    }
    
    echo json_encode(['success' => true, 'data' => $posicoes]);
    
} catch (Exception $e) {
    error_log("Erro em /api/estoque/posicoes_saldo.php: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
}