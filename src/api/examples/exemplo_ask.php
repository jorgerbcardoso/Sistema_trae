<?php
/**
 * ============================================
 * EXEMPLOS DE USO DA FUNÇÃO ask()
 * ============================================
 * 
 * Este arquivo demonstra como usar o sistema de perguntas interativas
 * para fazer perguntas ao usuário em qualquer momento da execução PHP.
 * 
 * A função ask() é EXTREMAMENTE SIMPLES de usar!
 */

require_once __DIR__ . '/../config.php';

// Configurar CORS e validar autenticação
setupCORS();
handleOptionsRequest();
requireAuth();

$user = getCurrentUser();

// ============================================
// EXEMPLO 1: Pergunta simples de texto
// ============================================
function exemplo1_texto_simples() {
    // Fazer uma pergunta simples
    $nome = ask("Qual o nome do cliente?");
    
    // Continuar execução normalmente com a resposta
    msg("Olá, $nome! Seu nome foi registrado com sucesso.", 'success');
}

// ============================================
// EXEMPLO 2: Confirmação (Sim/Não)
// ============================================
function exemplo2_confirmacao() {
    $confirma = ask("Tem certeza que deseja continuar com esta operação?", "confirm");
    
    if ($confirma) {
        msg("Operação confirmada! Processando...", 'success');
    } else {
        msg("Operação cancelada pelo usuário.", 'info');
    }
}

// ============================================
// EXEMPLO 3: Campo de texto longo (textarea)
// ============================================
function exemplo3_textarea() {
    $descricao = ask("Descreva o problema encontrado:", "textarea");
    
    // Salvar no banco, enviar email, etc.
    msg("Descrição recebida: $descricao", 'success');
}

// ============================================
// EXEMPLO 4: Número
// ============================================
function exemplo4_numero() {
    $quantidade = ask("Quantos registros deseja importar?", "number");
    
    msg("Você solicitou a importação de $quantidade registros.", 'info');
}

// ============================================
// EXEMPLO 5: Com valor padrão
// ============================================
function exemplo5_valor_padrao() {
    $email = ask("Qual seu email?", "text", null, "usuario@empresa.com");
    
    msg("Email cadastrado: $email", 'success');
}

// ============================================
// EXEMPLO 6: Múltiplas perguntas em sequência
// ============================================
function exemplo6_multiplas_sequenciais() {
    // Fazer várias perguntas em sequência
    $nome = ask("Qual o nome do cliente?");
    $email = ask("Qual o email do cliente?");
    $confirma = ask("Deseja realmente cadastrar este cliente?", "confirm");
    
    if ($confirma) {
        msg("Cliente $nome ($email) cadastrado com sucesso!", 'success');
    } else {
        msg("Cadastro cancelado.", 'info');
    }
}

// ============================================
// EXEMPLO 7: Múltiplas perguntas de uma vez (formulário)
// ============================================
function exemplo7_multiplas_simultaneas() {
    // Fazer várias perguntas de uma vez (mais eficiente)
    $respostas = askMultiple([
        [
            'id' => 'nome',
            'question' => 'Nome do cliente:',
            'type' => 'text',
            'defaultValue' => ''
        ],
        [
            'id' => 'email',
            'question' => 'Email do cliente:',
            'type' => 'text',
            'defaultValue' => ''
        ],
        [
            'id' => 'idade',
            'question' => 'Idade:',
            'type' => 'number',
            'defaultValue' => 18
        ],
        [
            'id' => 'ativo',
            'question' => 'Cliente ativo?',
            'type' => 'confirm',
            'defaultValue' => true
        ]
    ]);
    
    // Acessar respostas
    $nome = $respostas['nome'];
    $email = $respostas['email'];
    $idade = $respostas['idade'];
    $ativo = $respostas['ativo'];
    
    $status = $ativo ? 'ativo' : 'inativo';
    msg("Cliente $nome ($email, $idade anos) cadastrado como $status!", 'success');
}

// ============================================
// EXEMPLO 8: Uso em importação SSW
// ============================================
function exemplo8_importacao_ssw() {
    global $g_sql;
    
    // Perguntar se quer mesmo importar
    $confirma = ask("Deseja importar os grupos de eventos da SSW?", "confirm");
    
    if (!$confirma) {
        msg("Importação cancelada pelo usuário.", 'info');
        return;
    }
    
    // Perguntar se quer sobrescrever dados existentes
    $sobrescrever = ask("Sobrescrever grupos já existentes?", "confirm");
    
    // Executar importação
    try {
        $result = imp_ssw_gru($g_sql);
        
        if ($sobrescrever) {
            msg("Grupos importados com sucesso! Dados existentes foram sobrescritos.", 'success');
        } else {
            msg("Grupos importados com sucesso! Dados existentes foram mantidos.", 'success');
        }
    } catch (Exception $e) {
        msg("Erro na importação: " . $e->getMessage(), 'error');
    }
}

// ============================================
// EXEMPLO 9: Uso em processamento de lote
// ============================================
function exemplo9_processamento_lote() {
    global $g_sql;
    
    // Perguntar quantidade
    $quantidade = ask("Quantos registros deseja processar?", "number", null, 100);
    
    if ($quantidade <= 0) {
        msg("Quantidade inválida!", 'error');
        return;
    }
    
    // Perguntar descrição da operação
    $descricao = ask("Descreva o motivo deste processamento:", "textarea");
    
    // Confirmar
    $confirma = ask("Processar $quantidade registros? ($descricao)", "confirm");
    
    if ($confirma) {
        // Processar...
        msg("$quantidade registros processados com sucesso! Motivo: $descricao", 'success');
    } else {
        msg("Processamento cancelado.", 'info');
    }
}

// ============================================
// EXECUTAR EXEMPLO
// ============================================

// Descomente a linha abaixo para testar um dos exemplos:
// exemplo1_texto_simples();
// exemplo2_confirmacao();
// exemplo3_textarea();
// exemplo4_numero();
// exemplo5_valor_padrao();
// exemplo6_multiplas_sequenciais();
// exemplo7_multiplas_simultaneas();
// exemplo8_importacao_ssw();
// exemplo9_processamento_lote();

// Por padrão, executar exemplo de múltiplas perguntas
exemplo7_multiplas_simultaneas();
