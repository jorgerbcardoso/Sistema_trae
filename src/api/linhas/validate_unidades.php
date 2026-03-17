<?php
/**
 * API: Validar Unidades
 * Verifica se as unidades fornecidas existem na base de dados
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

// ================================================================
// FUNÇÃO DE DEBUG - Adiciona informações de debug ao retorno
// ================================================================
$debugInfo = [];
function addDebug($key, $value) {
    global $debugInfo;
    $debugInfo[$key] = $value;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método não permitido');
    }

    // Obter dados do POST
    $input = json_decode(file_get_contents('php://input'), true);

    // Obter domínio do body OU header
    $domain = $input['domain'] ?? $_SERVER['HTTP_X_DOMAIN'] ?? null;
    $siglas = $input['siglas'] ?? [];

    // Validações
    if (!$domain) {
        throw new Exception('Domínio não especificado');
    }

    if (!is_array($siglas) || count($siglas) === 0) {
        throw new Exception('Lista de siglas inválida');
    }

    // Validar domínio (apenas letras e números)
    if (!preg_match('/^[A-Z0-9]+$/i', $domain)) {
        throw new Exception('Domínio inválido');
    }

    $dominio = strtolower($domain);
    $g_sql = connect();

    // Limpar e normalizar siglas
    $siglas = array_map('strtoupper', array_map('trim', $siglas));
    $siglas = array_filter($siglas);
    $siglas = array_unique($siglas);

    if (count($siglas) === 0) {
        throw new Exception('Nenhuma sigla válida fornecida');
    }

    // Nome da tabela baseado no domínio
    $tableName = $dominio . '_unidade';

    // Validar cada unidade e coletar detalhes
    $totalEncontradas = 0;
    $detalhes = [];

    foreach ($siglas as $sigla) {
        $query = "SELECT COUNT(*) as total FROM $tableName WHERE sigla = $1";
        $result = sql($g_sql, $query, false, [$sigla]);
        $row = pg_fetch_assoc($result);
        $encontrada = (int)$row['total'] > 0;

        $totalEncontradas += $encontrada ? 1 : 0;
        $detalhes[] = [
            'sigla' => $sigla,
            'encontrada' => $encontrada
        ];
    }

    $valid = ($totalEncontradas === count($siglas));

    echo json_encode([
        'success' => true,
        'valid' => $valid,
        'total_fornecidas' => count($siglas),
        'total_encontradas' => $totalEncontradas,
        'detalhes' => $detalhes,
        'debug' => $debugInfo  // ✅ INCLUIR DEBUG NO RETORNO
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'valid' => false,
        'debug' => $debugInfo  // ✅ INCLUIR DEBUG MESMO EM ERRO
    ]);
}
