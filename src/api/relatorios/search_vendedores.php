<?php
require_once __DIR__ . '/../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtolower(trim($auth['domain'] ?? ''));

if ($domain === '' || !preg_match('/^[a-z0-9_]+$/', $domain)) {
    returnError('Domínio inválido', 400);
}

global $g_sql;
if (!$g_sql) {
    $g_sql = getDBConnection();
}

$input = getRequestInput();
$search = trim((string)($input['search'] ?? ''));

try {
    $tableName = $domain . '_vendedor';

    $check = sql("SELECT to_regclass($1)", ["public.$tableName"], $g_sql);
    $reg = $check ? pg_fetch_result($check, 0, 0) : null;

    if ($reg === null) {
        respondJson([
            'success' => true,
            'vendedores' => []
        ]);
    }

    if ($search === '') {
        $result = sql(
            "SELECT login, nome FROM {$tableName} ORDER BY login LIMIT 100",
            [],
            $g_sql
        );
    } else {
        $term = '%' . $search . '%';
        $result = sql(
            "SELECT login, nome
             FROM {$tableName}
             WHERE login ILIKE $1 OR nome ILIKE $1
             ORDER BY login
             LIMIT 100",
            [$term],
            $g_sql
        );
    }

    $vendedores = [];
    while ($row = pg_fetch_assoc($result)) {
        $vendedores[] = [
            'login' => $row['login'],
            'nome' => $row['nome']
        ];
    }

    respondJson([
        'success' => true,
        'vendedores' => $vendedores
    ]);
} catch (Throwable $e) {
    error_log('[search_vendedores] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    respondJson([
        'success' => false,
        'message' => 'Erro ao buscar vendedores'
    ], 500);
}
