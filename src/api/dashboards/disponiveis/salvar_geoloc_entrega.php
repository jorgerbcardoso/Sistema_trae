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
$ser = strtoupper(trim((string)($input['ser_cte'] ?? '')));
$nro = (int)($input['nro_cte'] ?? 0);
$lat = $input['latitude'] ?? null;
$lng = $input['longitude'] ?? null;

if ($ser === '' || $nro <= 0) {
    respondJson(['success' => false, 'message' => 'CT-e inválido.']);
}

$parseCoord = function($v) {
    if ($v === null) return null;
    if (is_int($v) || is_float($v)) return (float)$v;
    $s = trim((string)$v);
    if ($s === '') return null;
    $s = str_replace(',', '.', $s);
    if (!preg_match('/^-?\d+(\.\d+)?$/', $s)) return null;
    return (float)$s;
};

$latF = $parseCoord($lat);
$lngF = $parseCoord($lng);
if ($latF === null || $lngF === null) {
    respondJson(['success' => false, 'message' => 'Latitude/Longitude inválidas.']);
}

$lat = $latF;
$lng = $lngF;

if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    respondJson(['success' => false, 'message' => 'Latitude/Longitude fora do intervalo.']);
}

$conn = connect();
$tblCte = "{$domain}_cte";
$tblCliente = "{$domain}_cliente";

@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS latitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS longitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCliente} ADD COLUMN IF NOT EXISTS latitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCliente} ADD COLUMN IF NOT EXISTS longitude_entrega VARCHAR(32)");

try {
    $latComma = rtrim(rtrim(number_format($lat, 6, ',', ''), '0'), ',');
    $lngComma = rtrim(rtrim(number_format($lng, 6, ',', ''), '0'), ',');
    $res = null;
    try {
        $res = sql(
            "UPDATE {$tblCte}
             SET latitude_entrega = $1,
                 longitude_entrega = $2
             WHERE ser_cte = $3
               AND nro_cte = $4",
            [$latComma, $lngComma, $ser, $nro],
            $conn
        );
    } catch (Exception $e) {
        $latDot = rtrim(rtrim(number_format($lat, 6, '.', ''), '0'), '.');
        $lngDot = rtrim(rtrim(number_format($lng, 6, '.', ''), '0'), '.');
        $res = sql(
            "UPDATE {$tblCte}
             SET latitude_entrega = $1,
                 longitude_entrega = $2
             WHERE ser_cte = $3
               AND nro_cte = $4",
            [$latDot, $lngDot, $ser, $nro],
            $conn
        );
    }
    if (!$res || pg_affected_rows($res) <= 0) {
        respondJson(['success' => false, 'message' => 'CT-e não encontrado para atualizar geolocalização.']);
    }

    try {
        $resMeta = sql(
            "SELECT
                COALESCE(loc_ent_dif, '') AS loc_ent_dif,
                COALESCE(cnpj_emit, '') AS cnpj_emit
             FROM {$tblCte}
             WHERE ser_cte = $1
               AND nro_cte = $2
             LIMIT 1",
            [$ser, $nro],
            $conn
        );
        if ($resMeta && ($m = pg_fetch_assoc($resMeta))) {
            $locEntDif = strtoupper(trim((string)($m['loc_ent_dif'] ?? '')));
            $cnpjEmit = preg_replace('/\D+/', '', (string)($m['cnpj_emit'] ?? ''));
            if ($locEntDif === 'N' && $cnpjEmit !== '') {
                try {
                    sql(
                        "UPDATE {$tblCliente}
                         SET latitude_entrega = $1,
                             longitude_entrega = $2
                         WHERE cnpj = $3",
                        [$latComma, $lngComma, $cnpjEmit],
                        $conn
                    );
                } catch (Exception $e) {
                    $latDot = rtrim(rtrim(number_format($lat, 6, '.', ''), '0'), '.');
                    $lngDot = rtrim(rtrim(number_format($lng, 6, '.', ''), '0'), '.');
                    sql(
                        "UPDATE {$tblCliente}
                         SET latitude_entrega = $1,
                             longitude_entrega = $2
                         WHERE cnpj = $3",
                        [$latDot, $lngDot, $cnpjEmit],
                        $conn
                    );
                }
            }
        }
    } catch (Exception $e) {
    }
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao salvar geolocalização.']);
}

respondJson(['success' => true]);
