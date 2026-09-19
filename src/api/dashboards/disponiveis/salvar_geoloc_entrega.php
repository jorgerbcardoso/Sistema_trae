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

@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS latitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS longitude_entrega VARCHAR(32)");

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
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao salvar geolocalização.']);
}

respondJson(['success' => true]);
