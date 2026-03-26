<?php
/**
 * API: Importar Fornecedores do SSW
 * POST /api/compras/fornecedores/import.php
 */

// ⏱️ REMOVER TIMEOUT - Importação pode demorar
set_time_limit(0); // Sem limite de tempo
ini_set('max_execution_time', '0'); // Sem limite de tempo
ini_set('memory_limit', '512M'); // Aumentar memória se necessário

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

try {
    // ✅ Obter usuário autenticado
    $user = getCurrentUser();

    if (!$user) {
        returnError('Não autenticado', 401);
    }

    $domain = $user['domain'];
    $username = $user['username'];
    $dominio = $domain;

    // ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
    $prefix = strtolower($domain);

    // ✅ CRIAR CONEXÃO GLOBAL (ESSENCIAL PARA SSW)
    global $g_sql;
    $g_sql = connect();

    // ✅ SOLICITAR CONFIRMAÇÃO DO USUÁRIO
    // Parâmetros corretos: ask(pergunta, tipo, id_unico)
    $confirma = ask(
        'ATENÇÃO: Esta operação vai SOBRESCREVER todos os fornecedores. Deseja continuar?\n(esta operação pode levar alguns minutos)',
        'confirm',
        'confirma_import_fornecedores'
    );

    // ✅ Se usuário cancelou
    if (!$confirma) {
        respondJson([
            'success' => false,
            'message' => 'Operação cancelada pelo usuário'
        ]);
    }

    // ✅ CARREGAR BIBLIOTECA SSW VIA LOADER
    require_ssw();

    // ✅ IMPORTAR FORNECEDORES DO SSW
    imp_ssw_for();

    // ✅ Retornar sucesso no padrão do sistema
    respondJson([
        'success' => true,
        'message' => "Importação concluída com sucesso!"
    ]);

} catch (Exception $e) {
    error_log("Erro ao importar fornecedores: " . $e->getMessage());
    returnError('Erro ao importar fornecedores: ' . $e->getMessage(), 500);
}