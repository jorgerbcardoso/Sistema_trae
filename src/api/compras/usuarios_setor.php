<?php
/**
 * API: Usuários por Setor
 * Descrição: Busca usuários de um setor específico
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
$nro_setor = $_GET['nro_setor'] ?? null;

if (!$nro_setor) {
    msg('Setor não informado', 'error');
}

// VALIDAR DOMÍNIO
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    msg('Domínio inválido', 'error');
}

// MOCK
if (shouldUseMockData($domain)) {
    $mockData = [
        [
            'id' => 1,
            'username' => 'joao',
            'full_name' => 'JOÃO DA SILVA',
            'email' => 'joao@empresa.com'
        ],
        [
            'id' => 2,
            'username' => 'maria',
            'full_name' => 'MARIA SANTOS',
            'email' => 'maria@empresa.com'
        ],
    ];
    respondJson(['success' => true, 'data' => $mockData]);
    exit;
}

// BANCO DE DADOS
$conn = connect();

// Buscar usuários do setor
$query = "SELECT id, username, full_name, email
          FROM users
          WHERE domain = $1 
          AND nro_setor = $2
          AND is_active = true
          ORDER BY full_name";

$result = pg_query_params($conn, $query, [strtoupper($domain), $nro_setor]);

if (!$result) {
    msg('Erro ao buscar usuários: ' . pg_last_error($conn), 'error');
}

$usuarios = [];
while ($row = pg_fetch_assoc($result)) {
    $usuarios[] = $row;
}

respondJson(['success' => true, 'data' => $usuarios]);
