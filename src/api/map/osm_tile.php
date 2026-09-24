<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Domain, X-Unidade');
header('Cache-Control: public, max-age=86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$z = isset($_GET['z']) ? (int)$_GET['z'] : -1;
$x = isset($_GET['x']) ? (int)$_GET['x'] : -1;
$y = isset($_GET['y']) ? (int)$_GET['y'] : -1;

if ($z < 0 || $z > 19 || $x < 0 || $y < 0) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Parâmetros inválidos.";
    exit;
}

$url = "https://tile.openstreetmap.org/{$z}/{$x}/{$y}.png";

$ctx = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 6,
        'header' => [
            "User-Agent: PrestoSistema/1.0\r\n",
            "Accept: image/png\r\n",
        ],
    ],
]);

$img = @file_get_contents($url, false, $ctx);
if ($img === false || $img === '') {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Falha ao obter tile.";
    exit;
}

header('Content-Type: image/png');
echo $img;
exit;

