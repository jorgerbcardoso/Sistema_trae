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
$seqCarInput = (int)($input['seq_carregamento'] ?? 0);
$ctes = $input['ctes'] ?? [];

if ($seqCarInput <= 0) {
    respondJson(['success' => false, 'message' => 'seq_carregamento inválido.']);
}
if (!is_array($ctes)) $ctes = [];

$lista = [];
$seen = [];
foreach ($ctes as $c) {
    if (!is_array($c)) continue;
    $ser = strtoupper(trim((string)($c['ser_cte'] ?? $c['ser'] ?? $c['serCte'] ?? '')));
    $nro = (int)($c['nro_cte'] ?? $c['nro'] ?? $c['nroCte'] ?? 0);
    $ordem = (int)($c['ordem'] ?? 0);
    if ($ser === '' || $nro <= 0) continue;
    $k = $ser . '|' . $nro;
    if (isset($seen[$k])) continue;
    $seen[$k] = true;
    $lista[] = ['ser' => $ser, 'nro' => $nro, 'ordem' => $ordem];
}

$conn = connect();
$tblCar = "{$domain}_carregamento";

@pg_query($conn, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS ordem INT");

try {
    $seqCar = $seqCarInput;

    @pg_query($conn, 'BEGIN');

    sql(
        "UPDATE {$tblCar}
         SET ordem = NULL
         WHERE seq_carregamento = $1
           AND data_finalizacao IS NULL
           AND (nro_cte::text ~ '^[0-9]+$' AND (nro_cte::text)::int > 0)",
        [$seqCar],
        $conn
    );

    $atualizados = 0;
    if (!empty($lista)) {
        $chunkSize = 400;
        for ($off = 0; $off < count($lista); $off += $chunkSize) {
            $chunk = array_slice($lista, $off, $chunkSize);
            $vals = [];
            $params = [$seqCar];
            $p = 2;
            $ordSeq = $off + 1;
            foreach ($chunk as $it) {
                $vals[] = '($' . $p . '::varchar, $' . ($p + 1) . '::int, $' . ($p + 2) . '::int)';
                $params[] = $it['ser'];
                $params[] = $it['nro'];
                $params[] = ((int)($it['ordem'] ?? 0)) > 0 ? (int)$it['ordem'] : $ordSeq;
                $p += 3;
                $ordSeq += 1;
            }
            if (empty($vals)) continue;
            $q = "
                UPDATE {$tblCar} car
                   SET ordem = v.ordem
                  FROM (VALUES " . implode(', ', $vals) . ") AS v(ser_cte, nro_cte, ordem)
                 WHERE car.seq_carregamento = $1
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
