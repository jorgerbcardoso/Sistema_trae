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
$seqCar = (int)($input['seq_carregamento'] ?? 0);

if ($seqCar <= 0) {
    respondJson(['success' => false, 'message' => 'seq_carregamento inválido.']);
}

$conn = connect();
$tblCar = "{$domain}_carregamento";
$tblCte = "{$domain}_cte";

@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS latitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS longitude_entrega VARCHAR(32)");

try {
    $res = sql(
        "UPDATE {$tblCte} cte
            SET latitude_entrega = NULL,
                longitude_entrega = NULL
           FROM {$tblCar} car
          WHERE car.seq_carregamento = $1
            AND car.data_finalizacao IS NULL
            AND (car.nro_cte::text ~ '^[0-9]+$' AND (car.nro_cte::text)::int > 0)
            AND car.ser_cte = cte.ser_cte
            AND car.nro_cte = cte.nro_cte",
        [$seqCar],
        $conn
    );

    $limpos = $res ? pg_affected_rows($res) : 0;
    respondJson(['success' => true, 'limpos' => $limpos]);
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao limpar geolocalizações.']);
}
