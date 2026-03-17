<?php
/**
 * API: Saldo de Item em Estoque
 * Descrição: Busca o saldo total de um item em todas as posições de uma unidade
 * Métodos: GET
 */

require_once __DIR__ . '/../config.php';

// CONFIGURAÇÃO INICIAL
handleOptionsRequest();
validateRequestMethod('GET');

// AUTENTICAÇÃO
$auth = authenticateAndGetUser();
$user = $auth['user'];
$domain = $auth['domain'];

// RECEBER PARÂMETROS
$seq_item = $_GET['seq_item'] ?? null;
$unidade = $_GET['unidade'] ?? null;

if (!$seq_item) {
    msg('Item não informado', 'error');
}

if (!$unidade) {
    msg('Unidade não informada', 'error');
}

// VALIDAR DOMÍNIO
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    msg('Domínio inválido', 'error');
}

// MOCK
if (shouldUseMockData($domain)) {
    $saldoMock = rand(50, 500);
    respondJson(['success' => true, 'saldo' => $saldoMock]);
    exit;
}

// BANCO DE DADOS
$conn = connect();
$prefix = strtolower($domain) . '_';

// Somar saldo de todas as posições de estoque da unidade
$query = "SELECT COALESCE(SUM(p.saldo), 0) AS saldo_total
          FROM {$prefix}posicao p
          INNER JOIN {$prefix}estoque e ON p.seq_estoque = e.seq_estoque
          WHERE p.seq_item = $1
          AND e.unidade = $2";

$result = pg_query_params($conn, $query, [$seq_item, $unidade]);

if (!$result) {
    msg('Erro ao buscar saldo: ' . pg_last_error($conn), 'error');
}

$row = pg_fetch_assoc($result);
$saldo = (float)$row['saldo_total'];

respondJson(['success' => true, 'saldo' => $saldo]);