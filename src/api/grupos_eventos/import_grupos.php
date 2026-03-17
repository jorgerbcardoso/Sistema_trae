<?php
/**
 * API: Importar Grupos de Eventos Padrão
 * Importa grupos de eventos SSW para o domínio
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ✅ SUPRIMIR WARNINGS - Só mostrar erros fatais
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../lib/ssw_loader.php';

// Carregar biblioteca SSW
try {
    require_ssw();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Biblioteca SSW não disponível: ' . $e->getMessage()
    ]);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método não permitido');
    }
    
    // ✅ CORRIGIDO: Usar autenticação ao invés de parâmetro manual
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        msg('ERRO', $authResult['message']);
        exit();
    }

    $domain = $authResult['domain'];
    
    // Validações
    if (!$domain) {
        throw new Exception('Domínio não especificado');
    }
    
    // Validar domínio (apenas letras e números)
    if (!preg_match('/^[A-Z0-9]+$/i', $domain)) {
        throw new Exception('Domínio inválido');
    }
    
    // Atribuir domínio à global
    $dominio = strtoupper($domain);
    
    // Chamar função de importação SSW de grupos
    imp_ssw_gru();
    
    msg('Grupos importados com sucesso', 'success');
    
    echo json_encode([
        'success' => true,
        'message' => 'Grupos importados com sucesso'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}