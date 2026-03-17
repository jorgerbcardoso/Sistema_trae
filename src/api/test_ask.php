<?php
/**
 * ============================================
 * TESTE RÁPIDO - Sistema de Perguntas
 * ============================================
 * 
 * Teste simples para validar o sistema de perguntas interativas
 * 
 * Acesse via: https://webpresto.com.br/sistema/api/test_ask.php
 */

require_once __DIR__ . '/config.php';

// Configurar CORS
setupCORS();
handleOptionsRequest();

// Validar autenticação
requireAuth();
$user = getCurrentUser();

// ============================================
// TESTE: Formulário Completo
// ============================================

// Fazer múltiplas perguntas de uma vez
$respostas = askMultiple([
    [
        'id' => 'nome_empresa',
        'question' => 'Nome da Empresa:',
        'type' => 'text',
        'defaultValue' => 'Empresa Teste LTDA'
    ],
    [
        'id' => 'cnpj',
        'question' => 'CNPJ:',
        'type' => 'text',
        'defaultValue' => '00.000.000/0001-00'
    ],
    [
        'id' => 'num_funcionarios',
        'question' => 'Número de Funcionários:',
        'type' => 'number',
        'defaultValue' => 10
    ],
    [
        'id' => 'observacoes',
        'question' => 'Observações:',
        'type' => 'textarea',
        'defaultValue' => 'Digite aqui observações sobre a empresa...'
    ],
    [
        'id' => 'empresa_ativa',
        'question' => 'Empresa está ativa?',
        'type' => 'confirm',
        'defaultValue' => true
    ]
]);

// Processar respostas
$nome = $respostas['nome_empresa'];
$cnpj = $respostas['cnpj'];
$funcionarios = $respostas['num_funcionarios'];
$obs = $respostas['observacoes'];
$ativa = $respostas['empresa_ativa'];

$status = $ativa ? 'ATIVA' : 'INATIVA';

// Montar mensagem de sucesso
$mensagem = "📊 Dados Recebidos:\n\n";
$mensagem .= "🏢 Empresa: $nome\n";
$mensagem .= "📝 CNPJ: $cnpj\n";
$mensagem .= "👥 Funcionários: $funcionarios\n";
$mensagem .= "📋 Observações: $obs\n";
$mensagem .= "✅ Status: $status\n\n";
$mensagem .= "Todos os dados foram coletados com sucesso através do sistema de perguntas interativas!";

returnSuccess([
    'message' => $mensagem,
    'dados' => $respostas,
    'usuario' => $user['username']
]);
