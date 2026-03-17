<?php
/**
 * Script de Debug: Verificar se arquivo de imagem existe
 */

header('Content-Type: application/json; charset=utf-8');

$image_path = '/images/logos_clientes/aceville-dark.png';

// Caminho absoluto do sistema
$root_path = $_SERVER['DOCUMENT_ROOT'];
$full_path = $root_path . $image_path;

$info = [
    'requested_path' => $image_path,
    'document_root' => $root_path,
    'full_path' => $full_path,
    'file_exists' => file_exists($full_path),
    'is_readable' => is_readable($full_path),
    'is_file' => is_file($full_path),
    'parent_dir_exists' => file_exists(dirname($full_path)),
    'parent_dir_readable' => is_readable(dirname($full_path)),
];

if (file_exists($full_path)) {
    $info['file_size'] = filesize($full_path);
    $info['file_permissions'] = substr(sprintf('%o', fileperms($full_path)), -4);
    $info['mime_type'] = mime_content_type($full_path);
}

// Listar arquivos no diretório
$dir_path = dirname($full_path);
if (file_exists($dir_path)) {
    $files = scandir($dir_path);
    $info['files_in_directory'] = array_values(array_filter($files, function($f) {
        return $f !== '.' && $f !== '..';
    }));
}

// Verificar se a URL é acessível via HTTP
$url = 'https://sistema.webpresto.com.br' . $image_path;
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_NOBODY, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$info['http_test'] = [
    'url' => $url,
    'http_code' => $http_code,
    'accessible' => $http_code === 200
];

echo json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
