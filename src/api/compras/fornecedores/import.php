<?php
/**
 * API: Importar Fornecedores do SSW
 * POST /api/compras/fornecedores/import.php
 */

// ⏱️ REMOVER TIMEOUT - Importação pode demorar
set_time_limit(0); // Sem limite de tempo
ini_set('max_execution_time', '0'); // Sem limite de tempo
ini_set('memory_limit', '512M'); // Aumentar memória se necessário

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

try {
    // Obter usuário autenticado
    $user = getCurrentUser();

    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'NÃO AUTENTICADO'
        ]);
        exit();
    }

    $domain = $user['domain'];
    $username = $user['username'];
    $dominio = $domain;

    // ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
    $prefix = strtolower($domain);

    // ✅ SOLICITAR CONFIRMAÇÃO DO USUÁRIO
    // Parâmetros corretos: ask(pergunta, tipo, id_unico)
    $confirma = ask(
        'ATENÇÃO: Esta operação vai SOBRESCREVER todos os fornecedores. Deseja continuar?
        (esta operação pode levar alguns minutos)',
        'confirm',
        'confirma_import_fornecedores'
    );

    // ✅ Se usuário cancelou
    if (!$confirma) {
        echo json_encode([
            'success' => false,
            'message' => 'Operação cancelada pelo usuário'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    global $g_sql;

    // ✅ IMPORTAR FORNECEDORES DO SSW
    imp_ssw_for();

    // ✅ NÃO usar msg() em sucesso - apenas retornar JSON
    echo json_encode([
        'success' => true,
        'imported' => 0,
        'updated' => 0,
        'errors' => '',
        'total_processed' => 0,
        'message' => "Importação concluída!"
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Erro ao importar fornecedores: " . $e->getMessage());
    http_response_code(500);
    msg('ERRO', $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}