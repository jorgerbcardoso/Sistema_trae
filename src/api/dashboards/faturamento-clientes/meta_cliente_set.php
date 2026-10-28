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
$cnpj = trim((string)($input['cnpj'] ?? ''));
$metaRaw = $input['meta_mensal'] ?? $input['metaMensal'] ?? null;

if ($cnpj === '') {
    respondJson(['success' => false, 'message' => 'CNPJ não informado.']);
}

$meta = null;
if ($metaRaw === null || $metaRaw === '') {
    $meta = null;
} else {
    $meta = (float)$metaRaw;
    if (!is_finite($meta) || $meta < 0) $meta = 0.0;
}

$conn = connect();
$tblCli = "{$domain}_cliente";
$tblGc = "{$domain}_grupo_cliente";

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

if (!$colExists($tblCli, 'meta_mensal')) {
    respondJson(['success' => false, 'message' => 'Tabela de clientes sem meta_mensal neste domínio.']);
}

try {
    $resGrp = sql(
        "SELECT cnpj_principal
         FROM {$tblGc}
         WHERE cnpj = $1
         LIMIT 1",
        [$cnpj],
        $conn
    );
    if ($resGrp && pg_num_rows($resGrp) > 0) {
        $principal = trim((string)pg_fetch_result($resGrp, 0, 0));
        if ($principal !== '' && $principal !== $cnpj) {
            respondJson(['success' => false, 'message' => 'Este cliente pertence a um grupo. Defina a meta no CNPJ principal do grupo.']);
        }
    }
} catch (Exception $e) {}

$resU = sql(
    "UPDATE {$tblCli}
     SET meta_mensal = $1
     WHERE cnpj = $2",
    [$meta, $cnpj],
    $conn
);

if (!$resU) {
    respondJson(['success' => false, 'message' => 'Erro ao salvar meta: ' . pg_last_error($conn)]);
}

respondJson(['success' => true]);

