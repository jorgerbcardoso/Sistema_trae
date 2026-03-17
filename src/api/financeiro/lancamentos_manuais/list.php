<?php
/**
 * API: Listar Lançamentos Manuais de Receitas
 * Lista os CT-es criados manualmente dentro do período informado
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../middleware/auth.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        msg('Método não permitido', 'error');
    }
    
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => $authResult['message']
        ]);
        exit();
    }

    $dominio = strtolower($authResult['domain']);
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        msg('JSON inválido: ' . json_last_error_msg(), 'error');
    }
    
    // Filtros
    $startDate = $input['startDate'] ?? null;
    $endDate = $input['endDate'] ?? null;
    $page = isset($input['page']) ? (int)$input['page'] : 1;
    $limit = 50;
    $offset = ($page - 1) * $limit;
    
    if (!$startDate || !$endDate) {
        msg('Período é obrigatório', 'error');
    }
    
    // Conectar ao banco usando getDBConnection do config.php
    $conn = getDBConnection();
    @pg_query($conn, "SET TIMEZONE TO 'America/Sao_Paulo'");
    
    $tableName = "{$dominio}_cte";
    
    // Query principal usando sql()
    $query = "
        SELECT 
            nro_cte,
            ser_cte,
            data_emissao,
            sigla_emit,
            cnpj_pag,
            nome_pag,
            peso_real,
            vlr_merc,
            vlr_frete,
            vlr_icms,
            data_inclusao,
            hora_inclusao,
            login_inclusao,
            (ser_cte || TRIM(TO_CHAR(nro_cte, '000000'))) as cte_formatado
        FROM {$tableName}
        WHERE data_emissao BETWEEN $1 AND $2
          AND tp_documento = 'MANUAL'
        ORDER BY data_emissao DESC, nro_cte DESC
        LIMIT $3 OFFSET $4
    ";
    
    $result = sql($query, [$startDate, $endDate, $limit, $offset], $conn);
    
    if (!$result) {
        closeDBConnection($conn);
        msg('Erro ao buscar lançamentos: ' . pg_last_error($conn), 'error');
    }
    
    $lancamentos = [];
    while ($row = pg_fetch_assoc($result)) {
        $lancamentos[] = [
            'nro_cte' => (int)$row['nro_cte'],
            'ser_cte' => trim($row['ser_cte']),
            'cte' => trim($row['cte_formatado']),
            'data_emissao' => $row['data_emissao'],
            'sigla_emit' => trim($row['sigla_emit']),
            'cnpj_pag' => trim($row['cnpj_pag']),
            'nome_pag' => trim($row['nome_pag']),
            'peso_real' => (float)$row['peso_real'],
            'vlr_merc' => (float)$row['vlr_merc'],
            'vlr_frete' => (float)$row['vlr_frete'],
            'vlr_icms' => (float)$row['vlr_icms'],
            'data_inclusao' => $row['data_inclusao'],
            'hora_inclusao' => $row['hora_inclusao'],
            'login_inclusao' => $row['login_inclusao']
        ];
    }
    
    // Contar total usando sql()
    $countQuery = "
        SELECT COUNT(*) as total
        FROM {$tableName}
        WHERE data_emissao BETWEEN $1 AND $2
          AND tp_documento = 'MANUAL'
    ";
    
    $countResult = sql($countQuery, [$startDate, $endDate], $conn);
    $totalRecords = $countResult ? (int)pg_fetch_result($countResult, 0, 0) : 0;
    
    // Calcular totais usando sql()
    $totalQuery = "
        SELECT 
            COALESCE(SUM(peso_real), 0) as total_peso,
            COALESCE(SUM(vlr_merc), 0) as total_vlr_merc,
            COALESCE(SUM(vlr_frete), 0) as total_vlr_frete,
            COALESCE(SUM(vlr_icms), 0) as total_vlr_icms
        FROM {$tableName}
        WHERE data_emissao BETWEEN $1 AND $2
          AND tp_documento = 'MANUAL'
    ";
    
    $totalResult = sql($totalQuery, [$startDate, $endDate], $conn);
    $totals = $totalResult ? pg_fetch_assoc($totalResult) : [
        'total_peso' => 0,
        'total_vlr_merc' => 0,
        'total_vlr_frete' => 0,
        'total_vlr_icms' => 0
    ];
    
    closeDBConnection($conn);
    
    echo json_encode([
        'success' => true,
        'lancamentos' => $lancamentos,
        'pagination' => [
            'total' => $totalRecords,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => ceil($totalRecords / $limit)
        ],
        'totals' => [
            'peso_real' => (float)$totals['total_peso'],
            'vlr_merc' => (float)$totals['total_vlr_merc'],
            'vlr_frete' => (float)$totals['total_vlr_frete'],
            'vlr_icms' => (float)$totals['total_vlr_icms']
        ]
    ]);
    
} catch (Exception $e) {
    if (isset($conn)) {
        closeDBConnection($conn);
    }
    msg('Erro: ' . $e->getMessage(), 'error');
}