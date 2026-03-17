<?php
/**
 * API de Criação Facilitada de Item com Posição no Estoque
 * POST /api/estoque/create_item_with_position.php
 * 
 * Body: {
 *   "codigo": "...",
 *   "codigo_fabricante": "..." (opcional),
 *   "descricao": "...",
 *   "seq_tipo_item": 123 (opcional),
 *   "seq_unidade_medida": 456 (opcional),
 *   "vlr_item": 0.00,
 *   "estoque_minimo": 0.00,
 *   "estoque_maximo": 0.00,
 *   "seq_estoque": 789 (obrigatório) - Estoque onde será criada a posição
 * }
 * 
 * AÇÃO:
 * 1. Cria o item na tabela [dominio]_item
 * 2. Cria uma posição PSO/1/1 na tabela [dominio]_posicao para este item neste estoque
 * 
 * Retorna: { "success": true, "item": {...}, "posicao": {...} }
 */

require_once __DIR__ . '/../config.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Apenas POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    returnError('Método não permitido', 405);
}

// Requer autenticação
requireAuth();

try {
    $currentUser = getCurrentUser();
    $domain = $currentUser['domain'];
    
    // Ler dados do body
    $input = json_decode(file_get_contents('php://input'), true);
    
    $codigo = isset($input['codigo']) ? strtoupper(trim($input['codigo'])) : null;
    $codigoFabricante = isset($input['codigo_fabricante']) ? strtoupper(trim($input['codigo_fabricante'])) : null;
    $descricao = isset($input['descricao']) ? strtoupper(trim($input['descricao'])) : null;
    $seqTipoItem = isset($input['seq_tipo_item']) && !empty($input['seq_tipo_item']) ? (int)$input['seq_tipo_item'] : null;
    $seqUnidadeMedida = isset($input['seq_unidade_medida']) && !empty($input['seq_unidade_medida']) ? (int)$input['seq_unidade_medida'] : null;
    $vlrItem = isset($input['vlr_item']) ? (float)$input['vlr_item'] : 0.00;
    $estoqueMinimo = isset($input['estoque_minimo']) ? (float)$input['estoque_minimo'] : 0.00;
    $estoqueMaximo = isset($input['estoque_maximo']) ? (float)$input['estoque_maximo'] : 0.00;
    $seqEstoque = isset($input['seq_estoque']) ? (int)$input['seq_estoque'] : null;
    
    // ============================================
    // VALIDAÇÕES
    // ============================================
    
    if (empty($codigo)) {
        returnError('Código do item é obrigatório', 400);
    }
    
    if (empty($descricao)) {
        returnError('Descrição do item é obrigatória', 400);
    }
    
    if (empty($seqEstoque)) {
        returnError('Estoque é obrigatório', 400);
    }
    
    // ============================================
    // CONECTAR BANCO DE DADOS
    // ============================================
    
    $conn = getDBConnection();
    
    // Tabelas dinâmicas com prefixo do domínio
    $tableItem = $domain . '_item';
    $tablePosicao = $domain . '_posicao';
    $tableEstoque = $domain . '_estoque';
    
    // ============================================
    // VERIFICAR SE ESTOQUE EXISTE
    // ============================================
    
    $query = "SELECT seq_estoque, descricao, unidade FROM {$tableEstoque} WHERE seq_estoque = $1";
    $result = pg_query_params($conn, $query, [$seqEstoque]);
    
    if (!$result || pg_num_rows($result) === 0) {
        closeDBConnection($conn);
        returnError('Estoque não encontrado', 404);
    }
    
    $estoque = pg_fetch_assoc($result);
    
    // ============================================
    // VERIFICAR SE CÓDIGO JÁ EXISTE
    // ============================================
    
    $query = "SELECT seq_item FROM {$tableItem} WHERE codigo = $1";
    $result = pg_query_params($conn, $query, [$codigo]);
    
    if (pg_num_rows($result) > 0) {
        closeDBConnection($conn);
        returnError('Código já existe', 409);
    }
    
    // ============================================
    // CRIAR ITEM
    // ============================================
    
    $query = "INSERT INTO {$tableItem} (
        codigo,
        codigo_fabricante,
        descricao,
        seq_tipo_item,
        seq_unidade_medida,
        vlr_item,
        estoque_minimo,
        estoque_maximo,
        ativo,
        login_inclusao
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    ) RETURNING seq_item, codigo, codigo_fabricante, descricao, seq_tipo_item, seq_unidade_medida, vlr_item, estoque_minimo, estoque_maximo, ativo";
    
    $result = pg_query_params($conn, $query, [
        $codigo,
        $codigoFabricante,
        $descricao,
        $seqTipoItem,
        $seqUnidadeMedida,
        $vlrItem,
        $estoqueMinimo,
        $estoqueMaximo,
        'S', // ativo = S
        strtolower($currentUser['username']) // ✅ login_inclusao (SEMPRE em minúsculas)
    ]);
    
    if (!$result) {
        $error = pg_last_error($conn);
        closeDBConnection($conn);
        returnError('Erro ao criar item: ' . $error, 500);
    }
    
    $novoItem = pg_fetch_assoc($result);
    
    if (!$novoItem) {
        closeDBConnection($conn);
        returnError('Erro ao recuperar item criado', 500);
    }
    
    $seqItemCriado = (int)$novoItem['seq_item'];
    
    // ============================================
    // CRIAR POSIÇÃO NO ESTOQUE (PSO/1/1)
    // ============================================
    
    $rua = 'PSO';
    $altura = '1'; // VARCHAR na tabela
    $coluna = '1'; // VARCHAR na tabela
    
    // Verificar se já existe esta posição para este item neste estoque
    $query = "SELECT seq_posicao FROM {$tablePosicao} 
              WHERE seq_estoque = $1 AND seq_item = $2 AND rua = $3 AND altura = $4 AND coluna = $5";
    $result = pg_query_params($conn, $query, [$seqEstoque, $seqItemCriado, $rua, $altura, $coluna]);
    
    if (pg_num_rows($result) > 0) {
        // Posição já existe (improvável, mas vamos retornar ela)
        $posicao = pg_fetch_assoc($result);
        $seqPosicao = (int)$posicao['seq_posicao'];
    } else {
        // Criar nova posição
        $query = "INSERT INTO {$tablePosicao} (
            seq_estoque,
            seq_item,
            rua,
            altura,
            coluna,
            saldo,
            login_inclusao
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
        ) RETURNING seq_posicao, seq_estoque, seq_item, rua, altura, coluna, saldo";
        
        $result = pg_query_params($conn, $query, [
            $seqEstoque,
            $seqItemCriado,
            $rua,
            $altura,
            $coluna,
            0, // saldo inicial = 0
            strtolower($currentUser['username']) // ✅ login_inclusao (SEMPRE em minúsculas)
        ]);
        
        if (!$result) {
            $error = pg_last_error($conn);
            closeDBConnection($conn);
            returnError('Erro ao criar posição: ' . $error, 500);
        }
        
        $novaPosicao = pg_fetch_assoc($result);
        $seqPosicao = (int)$novaPosicao['seq_posicao'];
    }
    
    closeDBConnection($conn);
    
    // ============================================
    // RETORNAR SUCESSO
    // ============================================
    
    msg('Item criado com sucesso', 'success', 200, [
        'item' => [
            'seq_item' => $seqItemCriado,
            'codigo' => $novoItem['codigo'],
            'codigo_fabricante' => $novoItem['codigo_fabricante'],
            'descricao' => $novoItem['descricao'],
            'seq_tipo_item' => isset($novoItem['seq_tipo_item']) ? (int)$novoItem['seq_tipo_item'] : null,
            'seq_unidade_medida' => isset($novoItem['seq_unidade_medida']) ? (int)$novoItem['seq_unidade_medida'] : null,
            'vlr_item' => (float)$novoItem['vlr_item'],
            'estoque_minimo' => (float)$novoItem['estoque_minimo'],
            'estoque_maximo' => (float)$novoItem['estoque_maximo'],
            'ativo' => $novoItem['ativo']
        ],
        'posicao' => [
            'seq_posicao' => $seqPosicao,
            'seq_estoque' => $seqEstoque,
            'seq_item' => $seqItemCriado,
            'rua' => $rua,
            'altura' => $altura,
            'coluna' => $coluna,
            'estoque_descricao' => $estoque['descricao'],
            'estoque_unidade' => $estoque['unidade']
        ]
    ]);
    
} catch (Exception $e) {
    error_log("[CREATE-ITEM-POSITION] Erro: " . $e->getMessage());
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    returnError('Erro ao criar item: ' . $e->getMessage(), 500);
}