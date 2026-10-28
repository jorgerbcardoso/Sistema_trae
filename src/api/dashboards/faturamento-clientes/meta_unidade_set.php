<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido']);
}

$input = getRequestInput();
$sigla = strtoupper(trim((string)($input['sigla'] ?? '')));
$metaRaw = $input['meta_mensal'] ?? $input['metaMensal'] ?? null;

if ($sigla === '') {
    respondJson(['success' => false, 'message' => 'Sigla não informada.']);
}

$meta = null;
if ($metaRaw === null || $metaRaw === '') {
    $meta = null;
} else {
    $meta = (float)$metaRaw;
    if (!is_finite($meta) || $meta < 0) $meta = 0.0;
}

$conn = connect();
$tblUni = "{$domain}_unidade";

$colExists = function ($tbl, $col) use ($conn) {
    $res = null;
    try {
        $res = sql(
            "SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = lower($1)
               AND column_name = $2
             LIMIT 1",
            [$tbl, $col],
            $conn
        );
    } catch (Exception $e) {}
    return ($res && pg_num_rows($res) > 0);
};

if (!$colExists($tblUni, 'meta_mensal')) {
    respondJson(['success' => false, 'message' => 'Tabela de unidades sem meta_mensal neste domínio.']);
}

$resU = sql(
    "UPDATE {$tblUni}
     SET meta_mensal = $1
     WHERE UPPER(BTRIM(sigla)) = UPPER(BTRIM($2))",
    [$meta, $sigla],
    $conn
);

if (!$resU) {
    respondJson(['success' => false, 'message' => 'Erro ao salvar meta: ' . pg_last_error($conn)]);
}

respondJson(['success' => true]);

