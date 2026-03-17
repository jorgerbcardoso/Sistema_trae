<?php
/**
 * ============================================
 * API: Importação de Vendedores do SSW
 * ============================================
 * Importa vendedores e suas carteiras de clientes
 * dos últimos 30 dias do SSW
 * ============================================
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

// ✅ AUTENTICAÇÃO OBRIGATÓRIA
requireAuth();
$currentUser = getCurrentUser();

$username = $currentUser['username'];
$dominio = strtolower($currentUser['domain']);
$prefix = $dominio . '_';

// ✅ CRIAR CONEXÃO GLOBAL
global $g_sql;
$g_sql = getDBConnection();

if (!$g_sql) {
    msg('Erro ao conectar ao banco de dados', 'error', 500);
}

// Apenas POST é permitido
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    msg('Método não permitido', 'error', 405);
}

try {
    // ✅ CAPTURAR ECHOS DA FUNÇÃO CLI (solução elegante)
    // A função imp_ssw_ven() foi originalmente feita para CLI
    // e possui vários "echo" para mostrar progresso
    // Precisamos capturar esses echos para não interferir no JSON
    ob_start();
    
    // ✅ SEMPRE chamar com parâmetros de data (últimos 30 dias até hoje)
    $dataInicio = strtotime('-30 days');
    $dataFim = strtotime('today');
    
    imp_ssw_ven($dataInicio, $dataFim);
    
    // ✅ LIMPAR BUFFER (descartar todos os echos da função)
    $output = ob_get_clean();
    
    // ✅ OPCIONAL: Logar output para debug (se necessário)
    if (!empty($output)) {
        error_log("📊 OUTPUT de imp_ssw_ven():\n" . $output);
    }
    
    // ✅ Retornar sucesso
    msg('Vendedores importados com sucesso!', 'success');
    
} catch (Exception $e) {
    // ✅ LIMPAR BUFFER em caso de erro também
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    error_log("❌ ERRO em importar_vendedores.php: " . $e->getMessage());
    error_log("   Arquivo: " . $e->getFile());
    error_log("   Linha: " . $e->getLine());
    msg('Erro ao importar vendedores do SSW', 'error', 500);
}
