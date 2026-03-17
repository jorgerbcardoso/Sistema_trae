<?php
/**
 * ========================================
 * CONTROLE DE TRANSBORDO
 * ========================================
 *
 * Endpoint para buscar dados de transbordo
 * Acesso: Usuários autenticados
 *
 * Filtros disponíveis:
 * - mes (obrigatório)
 * - ano (obrigatório)
 * - unidadeTransbordo (opcional)
 * - unidadeOrigem (opcional)
 * - unidadeDestino (opcional)
 *
 * @return JSON com array de transbordos
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// ✅ SUPRIMIR EXIBIÇÃO DE ERROS (apenas logar, não exibir)
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// ✅ Capturar QUALQUER output indesejado
ob_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ✅ INCLUIR FUNÇÕES PRINCIPAIS
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

// ✅ VALIDAR AUTENTICAÇÃO
try {
  $userData = authenticate();
} catch (Exception $e) {
  msg ('Erro de autenticação: ' . $e->getMessage());
}

// ✅ RECEBER FILTROS
$input = json_decode(file_get_contents('php://input'), true);
$domain = strtoupper(trim($input['domain'] ?? ''));
$mes = (int) ($input['mes'] ?? 0);
$ano = (int) ($input['ano'] ?? 0);
$unidadeTransbordo = strtoupper(trim($input['unidadeTransbordo'] ?? ''));
$unidadeOrigem = strtoupper(trim($input['unidadeOrigem'] ?? ''));
$unidadeDestino = strtoupper(trim($input['unidadeDestino'] ?? ''));

// ✅ VALIDAÇÃO: Mês e ano são obrigatórios
if ($mes < 1 || $mes > 12)
  msg ('Mês de referência inválido. Informe um valor entre 1 e 12.');

if ($ano < 2020 || $ano > 2099)
  msg ('Ano de referência inválido.');

try {
    $dominio = $domain;
    
    // ✅ USAR global $g_sql
    global $g_sql;
    $g_sql = connect();

    // ✅ VALIDAR UNIDADES (se fornecidas)
    if (!empty($unidadeTransbordo)) {
        $result = sql($g_sql, "SELECT * FROM {$dominio}_unidade WHERE sigla = '$unidadeTransbordo'");
        if (pg_num_rows($result) == 0)
            msg("Unidade Transbordo $unidadeTransbordo inválida.");
    }

    if (!empty($unidadeOrigem)) {
        $result = sql($g_sql, "SELECT * FROM {$dominio}_unidade WHERE sigla = '$unidadeOrigem'");
        if (pg_num_rows($result) == 0)
            msg("Unidade Origem $unidadeOrigem inválida.");
    }

    if (!empty($unidadeDestino)) {
        $result = sql($g_sql, "SELECT * FROM {$dominio}_unidade WHERE sigla = '$unidadeDestino'");
        if (pg_num_rows($result) == 0)
            msg("Unidade Destino $unidadeDestino inválida.");
    }

    // ✅ MONTAR QUERY PRINCIPAL
    $whereConditions = [
        "mes = $mes",
        "ano = " . substr ($ano, 2, 2)
    ];

    if (!empty($unidadeTransbordo)) {
        $whereConditions[] = "unidade = '$unidadeTransbordo'";
    }

    if (!empty($unidadeOrigem)) {
        $whereConditions[] = "origem = '$unidadeOrigem'";
    }

    if (!empty($unidadeDestino)) {
        $whereConditions[] = "destino = '$unidadeDestino'";
    }

    $whereClause = implode(' AND ', $whereConditions);

    // ✅ EXECUTAR QUERY
    $query = "
        SELECT 
            unidade,
            origem,
            destino,
            qtde_cte,
            qtde_vol,
            peso_calc,
            part,
            frete_cif,
            frete_fob,
            frete_ter,
            frete_total,
            icms
        FROM {$dominio}_transbordo
        WHERE {$whereClause}
        ORDER BY unidade, origem, destino
    ";

    $result = sql($g_sql, $query);

    // ✅ ARRAY PARA ARMAZENAR OS TRANSBORDOS
    $transbordos = [];
    $id = 1;

    if ($result && pg_num_rows($result) > 0) {
        while ($row = pg_fetch_assoc($result)) {
            $transbordos[] = [
                'id' => $id++,
                'unidadeTransbordo' => trim($row['unidade']),
                'unidadeOrigem' => trim($row['origem']),
                'unidadeDestino' => trim($row['destino']),
                'qtdeCtes' => (int) $row['qtde_cte'],
                'qtdeVol' => (int) $row['qtde_vol'],
                'pesoCalc' => (float) $row['peso_calc'],
                'participacao' => (float) $row['part'],
                'freteCif' => (float) $row['frete_cif'],
                'freteFob' => (float) $row['frete_fob'],
                'freteTer' => (float) $row['frete_ter'],
                'freteTotal' => (float) $row['frete_total'],
                'icms' => (float) $row['icms']
            ];
        }
    }

    // ✅ Limpar buffer e retornar JSON limpo
    ob_end_clean();

    echo json_encode([
        'success' => true,
        'message' => count($transbordos) > 0 
            ? 'Dados carregados com sucesso' 
            : 'Nenhum registro encontrado',
        'data' => [
            'transbordos' => $transbordos
        ]
    ]);

} catch (Exception $e) {
    error_log('❌ [controle_transbordo.php] Erro: ' . $e->getMessage());

    // ✅ Limpar buffer antes de retornar erro
    ob_end_clean();

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar dados de transbordo: ' . $e->getMessage()
    ]);
}
