<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();
$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $input['unidade']
    ?? $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? ''
));
$placa = strtoupper(trim((string)($input['placa'] ?? '')));
$ctes = $input['ctes'] ?? [];

if ($unidade === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade inválida.']);
}
if ($placa === '') {
    respondJson(['success' => false, 'message' => 'Placa inválida.']);
}
if (!is_array($ctes)) $ctes = [];

$lista = [];
$seen = [];
foreach ($ctes as $c) {
    if (!is_array($c)) continue;
    $ser = strtoupper(trim((string)($c['ser_cte'] ?? $c['ser'] ?? $c['serCte'] ?? '')));
    $nro = (int)($c['nro_cte'] ?? $c['nro'] ?? $c['nroCte'] ?? 0);
    if ($ser === '' || $nro <= 0) continue;
    $k = $ser . '|' . $nro;
    if (isset($seen[$k])) continue;
    $seen[$k] = true;
    $lista[] = ['ser' => $ser, 'nro' => $nro];
}

$conn = connect();
$tblCar = "{$domain}_carregamento";

@pg_query($conn, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS ordem INT");

try {
    @pg_query($conn, 'BEGIN');

    sql(
        "UPDATE {$tblCar}
         SET ordem = NULL
         WHERE unidade = $1
           AND UPPER(placa_provisoria) = UPPER($2)
           AND data_finalizacao IS NULL
           AND (nro_cte::text ~ '^[0-9]+$' AND (nro_cte::text)::int > 0)",
        [$unidade, $placa],
        $conn
    );

    $atualizados = 0;
    if (!empty($lista)) {
        $chunkSize = 400;
        for ($off = 0; $off < count($lista); $off += $chunkSize) {
            $chunk = array_slice($lista, $off, $chunkSize);
            $params = [$unidade, $placa];
            $vals = [];
            $p = 3;
            $ord = $off + 1;
            foreach ($chunk as $it) {
                $vals[] = '($' . $p . ', $' . ($p + 1) . ', $' . ($p + 2) . ')';
                $params[] = $it['ser'];
                $params[] = $it['nro'];
                $params[] = $ord;
                $p += 3;
                $ord += 1;
            }
            if (empty($vals)) continue;
            $q = "
                UPDATE {$tblCar} car
                   SET ordem = v.ordem
                  FROM (VALUES " . implode(', ', $vals) . ") AS v(ser_cte, nro_cte, ordem)
                 WHERE car.unidade = $1
                   AND UPPER(car.placa_provisoria) = UPPER($2)
                   AND car.data_finalizacao IS NULL
                   AND car.ser_cte = v.ser_cte
                   AND car.nro_cte = v.nro_cte
            ";
            $res = sql($q, $params, $conn);
            if ($res) $atualizados += pg_affected_rows($res);
        }
    }

    @pg_query($conn, 'COMMIT');
    respondJson(['success' => true, 'atualizados' => $atualizados]);
} catch (Exception $e) {
    @pg_query($conn, 'ROLLBACK');
    respondJson(['success' => false, 'message' => 'Erro ao salvar ordem do carregamento.']);
}

