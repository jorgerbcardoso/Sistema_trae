<?php
require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$cnpjIn = (string)($_POST['cnpj'] ?? '');
$digits = preg_replace('/\D/', '', $cnpjIn);
$cnpj = str_pad($digits, 14, '0', STR_PAD_LEFT);

if ($cnpj === '' || strlen($cnpj) !== 14) {
    respondJson(['success' => false, 'message' => 'CNPJ inválido.']);
}

if (!isset($_FILES['logo'])) {
    respondJson(['success' => false, 'message' => 'Arquivo não enviado.']);
}

$file = $_FILES['logo'];
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    respondJson(['success' => false, 'message' => 'Falha no upload do arquivo.']);
}

$tmp = (string)($file['tmp_name'] ?? '');
$size = (int)($file['size'] ?? 0);
if ($tmp === '' || $size <= 0) {
    respondJson(['success' => false, 'message' => 'Arquivo inválido.']);
}

if ($size > 5 * 1024 * 1024) {
    respondJson(['success' => false, 'message' => 'Arquivo muito grande (máx. 5MB).']);
}

$mime = '';
if (function_exists('mime_content_type')) {
    $mime = (string)@mime_content_type($tmp);
}

$ext = null;
if ($mime === 'image/png') $ext = 'png';
if ($mime === 'image/jpeg') $ext = 'jpg';

if ($ext === null) {
    $name = strtolower((string)($file['name'] ?? ''));
    if (preg_match('/\.png$/', $name)) $ext = 'png';
    elseif (preg_match('/\.(jpg|jpeg)$/', $name)) $ext = 'jpg';
}

if ($ext === null) {
    respondJson(['success' => false, 'message' => 'Formato inválido. Aceito apenas .png ou .jpg.']);
}

$info = @getimagesize($tmp);
if (!$info || !is_array($info)) {
    respondJson(['success' => false, 'message' => 'Imagem inválida.']);
}

$width = (int)($info[0] ?? 0);
$height = (int)($info[1] ?? 0);

$root = @realpath(__DIR__ . '/../../..');
$dirRel = '/sistema/logos_clientes';
$dirAbs = $root ? (rtrim($root, '/') . '/logos_clientes') : null;
if (!$dirAbs) {
    respondJson(['success' => false, 'message' => 'Não foi possível localizar o diretório do sistema.']);
}

if (!@is_dir($dirAbs)) {
    if (!@mkdir($dirAbs, 0755, true)) {
        respondJson(['success' => false, 'message' => 'Não foi possível criar o diretório de logos.']);
    }
}

$base = strtoupper($domain) . $cnpj;
$dest = $dirAbs . '/' . $base . '.' . $ext;

@unlink($dirAbs . '/' . $base . '.png');
@unlink($dirAbs . '/' . $base . '.jpg');

if (!@move_uploaded_file($tmp, $dest)) {
    respondJson(['success' => false, 'message' => 'Não foi possível salvar a imagem.']);
}

$warning = null;
if ($width > 0 && $height > 0) {
    if ($width < 200 || $height < 150) {
        $warning = "A logo está menor que o recomendado (mínimo 200x150px). Atual: {$width}x{$height}px.";
    }
}

$url = $dirRel . '/' . $base . '.' . $ext;
respondJson([
    'success' => true,
    'url' => $url,
    'ext' => $ext,
    'width' => $width,
    'height' => $height,
    'warning' => $warning,
]);
