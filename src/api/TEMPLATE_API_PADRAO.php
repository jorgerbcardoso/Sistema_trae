<?php
/**
 * ================================================================
 * ⚠️ TEMPLATE PADRÃO ABSOLUTO PARA APIS PHP - SISTEMA PRESTO ⚠️
 * ================================================================
 * 
 * 🔴 REGRAS ABSOLUTAS (NÃO NEGOCIÁVEIS):
 * 
 * 1. TODO script PHP que usar msg() DEVE gerar toast no frontend
 * 2. SEMPRE usar apiFetch() no frontend (services), NUNCA fetch() direto
 * 3. NUNCA retornar mensagens em respondJson(['message' => '...'])
 * 4. SEMPRE usar msg() antes de respondJson() para erros
 * 5. NUNCA usar msg() para sucessos (só para erros)
 * 6. SEMPRE retornar HTTP 500 em caso de erro (segundo parâmetro do respondJson)
 * 
 * ================================================================
 * FORMATO PADRÃO DE RESPOSTA:
 * ================================================================
 * 
 * SUCESSO:
 * respondJson([
 *     'success' => true,
 *     'data' => $resultado
 * ]);
 * 
 * ERRO:
 * msg('Mensagem de erro clara pro usuário', 'error');
 * respondJson([
 *     'success' => false
 * ], 500);
 * 
 * ================================================================
 */

require_once __DIR__ . '/config.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST'); // ou 'GET', 'PUT', 'DELETE'

try {
    // ================================================================
    // AUTENTICAÇÃO
    // ================================================================
    $auth = authenticateAndGetUser();
    $user = $auth['user'];
    $domain = $auth['domain'];

    // ================================================================
    // RECEBER E PROCESSAR PARÂMETROS
    // ================================================================
    $input = getRequestInput();
    
    // Validar parâmetros obrigatórios
    if (!isset($input['campo_obrigatorio'])) {
        msg('Campo obrigatório não informado', 'error');
        respondJson(['success' => false], 400);
    }

    // ================================================================
    // CONECTAR AO BANCO
    // ================================================================
    $g_sql = connect();

    // ================================================================
    // LÓGICA DA API (CONSULTAS, INSERÇÕES, ETC)
    // ================================================================
    
    // Exemplo de consulta
    $query = "SELECT * FROM tabela WHERE campo = $1";
    $result = pg_query_params($g_sql, $query, [$input['campo_obrigatorio']]);
    
    if (!$result) {
        msg('Erro ao executar consulta no banco de dados', 'error');
        respondJson(['success' => false], 500);
    }
    
    $data = pg_fetch_all($result);

    // ================================================================
    // RESPOSTA DE SUCESSO
    // ================================================================
    respondJson([
        'success' => true,
        'data' => $data
    ]);

} catch (Exception $e) {
    // ================================================================
    // TRATAMENTO DE ERRO
    // ================================================================
    error_log('❌ [nome_do_arquivo.php] ERRO: ' . $e->getMessage());
    error_log('❌ Stack trace: ' . $e->getTraceAsString());
    
    // ✅ CORRETO: msg() + respondJson sem message
    msg('Descrição do erro para o usuário: ' . $e->getMessage(), 'error');
    respondJson([
        'success' => false
    ], 500);
    
    // ❌ ERRADO: Nunca faça isso!
    // respondJson([
    //     'success' => false,
    //     'message' => 'Erro...'
    // ]);
}

/**
 * ================================================================
 * CHECKLIST DE VALIDAÇÃO:
 * ================================================================
 * 
 * [ ] Usei msg() antes de respondJson() no catch?
 * [ ] Removi o campo 'message' do respondJson()?
 * [ ] Passei 500 como segundo parâmetro do respondJson()?
 * [ ] Testei se o toast aparece no frontend?
 * [ ] O service correspondente usa apiFetch() ao invés de fetch()?
 * 
 * ================================================================
 */
?>
