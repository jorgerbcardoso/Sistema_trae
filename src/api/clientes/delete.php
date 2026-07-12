<?php
require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
http_response_code(403);
respondJson(['success' => false, 'message' => 'Exclusão de clientes não é permitida.']);
