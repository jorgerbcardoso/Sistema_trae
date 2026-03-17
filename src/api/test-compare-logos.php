<?php
/**
 * Script de Debug: Comparar logos de todos os domínios
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

try {
    $g_sql = connect();
    
    // Buscar todos os domínios e suas logos
    $query = "SELECT domain, name, logo_dark FROM domains WHERE logo_dark IS NOT NULL ORDER BY domain";
    $result = sql($query, [], $g_sql);
    
    $domains = [];
    $root_path = $_SERVER['DOCUMENT_ROOT'];
    
    if ($result && pg_num_rows($result) > 0) {
        while ($row = pg_fetch_assoc($result)) {
            $logo_dark = $row['logo_dark'];
            
            // Converter para caminho de arquivo
            $file_path = null;
            $url = null;
            
            if (strpos($logo_dark, 'http://') === 0 || strpos($logo_dark, 'https://') === 0) {
                // É uma URL completa
                $url = $logo_dark;
                // Extrair caminho do arquivo
                $parsed = parse_url($logo_dark);
                $file_path = $root_path . ($parsed['path'] ?? '');
            } else {
                // É um caminho relativo
                $file_path = $root_path . '/' . ltrim($logo_dark, '/');
                $url = 'https://sistema.webpresto.com.br/' . ltrim($logo_dark, '/');
            }
            
            // Verificar se arquivo existe
            $file_exists = file_exists($file_path);
            $is_readable = $file_exists ? is_readable($file_path) : false;
            $file_size = $file_exists ? filesize($file_path) : 0;
            
            // Testar URL via HTTP
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_NOBODY, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            $domains[] = [
                'domain' => $row['domain'],
                'name' => $row['name'],
                'logo_dark_db' => $logo_dark,
                'file_path' => $file_path,
                'url' => $url,
                'file_exists' => $file_exists,
                'is_readable' => $is_readable,
                'file_size' => $file_size,
                'http_code' => $http_code,
                'http_ok' => $http_code === 200,
                'status' => ($file_exists && $http_code === 200) ? '✅ OK' : '❌ PROBLEMA'
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'total' => count($domains),
        'domains' => $domains
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
