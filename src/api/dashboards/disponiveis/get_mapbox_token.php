<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

authenticateAndGetUser();

$token = (string)(getenv('MAPBOX_TOKEN') ?: getenv('MAPBOX_PUBLIC_TOKEN') ?: '');
$token = trim($token);

respondJson([
    'success' => true,
    'token' => $token,
]);

