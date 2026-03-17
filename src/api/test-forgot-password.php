<?php
/**
 * Script de Teste: Esqueci minha senha (domínio ACV)
 */

header('Content-Type: application/json; charset=utf-8');

// Fazer requisição POST para o endpoint
$url = 'https://sistema.webpresto.com.br/sistema/api/auth/forgot-password.php';

$data = [
    'email' => 'teste@aceville.com.br' // ⚠️ AJUSTE COM UM EMAIL REAL DO DOMÍNIO ACV
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo json_encode([
    'http_code' => $http_code,
    'response' => json_decode($response, true),
    'raw_response' => $response
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
