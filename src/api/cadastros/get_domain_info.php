<?php
/**
 * ═══════════════════════════════════════════════════════════════════════
 * API: GET DOMAIN INFO
 * Endpoint: /api/cadastros/get_domain_info.php
 * Descrição: Retorna informações do domínio (logo_light, logo_dark, etc.)
 * Método: POST
 * ═══════════════════════════════════════════════════════════════════════
 */

require_once __DIR__ . '/../config/check_session.php';
require_once __DIR__ . '/../config/ssw_config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    // ✅ RECEBE o domínio do corpo da requisição
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    $domain = isset($data['domain']) ? trim($data['domain']) : $_SESSION['user']['domain'];
    
    if (empty($domain)) {
        msg('❌ Domínio não informado', 'error');
        exit;
    }

    // ✅ CONECTA ao banco
    $g_sql = connect();
    
    // ✅ BUSCA informações do domínio na tabela domains
    $query = "
        SELECT 
            domain,
            logo_light,
            logo_dark,
            primary_color,
            secondary_color
        FROM domains
        WHERE domain = $1
        LIMIT 1
    ";
    
    $result = sql($query, [$domain], $g_sql);
    
    if (!$result || pg_num_rows($result) === 0) {
        msg('❌ Domínio não encontrado', 'error');
        exit;
    }
    
    $domainInfo = pg_fetch_assoc($result);
    
    // ✅ RETORNA os dados
    echo json_encode([
        'success' => true,
        'data' => [
            'domain' => $domainInfo['domain'],
            'logo_light' => $domainInfo['logo_light'], // ✅ URL da logo clara
            'logo_dark' => $domainInfo['logo_dark'],   // ✅ URL da logo escura
            'primary_color' => $domainInfo['primary_color'],
            'secondary_color' => $domainInfo['secondary_color']
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
} catch (Exception $e) {
    error_log('❌ ERRO em get_domain_info.php: ' . $e->getMessage());
    msg('Erro ao buscar informações do domínio: ' . $e->getMessage(), 'error');
}
?>
