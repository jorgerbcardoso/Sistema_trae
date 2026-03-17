<?php
/**
 * ================================================================
 * API de Solicitação de Cotação para Fornecedores
 * ================================================================
 * POST /api/compras/solicitar_cotacao.php
 * 
 * Envia email com código de acesso para fornecedor preencher valores
 * 
 * ✅ SEGUE PADRÃO: _TEMPLATE_API.php
 * ================================================================
 */

require_once __DIR__ . '/../config.php';

// ================================================================
// HEADERS CORS (OBRIGATÓRIO)
// ================================================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ================================================================
// AUTENTICAÇÃO
// ================================================================
validateRequestMethod('POST');

// ✅ CORREÇÃO: Usar getCurrentUser() ao invés de authenticateAndGetUser()
requireAuth();
$currentUser = getCurrentUser();

$username = $currentUser['username'];
$user_unidade = $currentUser['unidade'];
$domain = $currentUser['domain'];
$dominio = strtolower($domain);

// ================================================================
// VALIDAR DADOS
// ================================================================
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['seq_orcamento']) || !isset($input['seq_fornecedor']) || !isset($input['email'])) {
    msg('Dados incompletos. Informe seq_orcamento, seq_fornecedor e email', 'error');
}

$seq_orcamento = (int) $input['seq_orcamento'];
$seq_fornecedor = (int) $input['seq_fornecedor'];
$email = trim($input['email']);

// Validar email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    msg('Email inválido', 'error');
}

// ================================================================
// CONECTAR AO BANCO
// ================================================================
$g_sql = connect();

// ================================================================
// VERIFICAR ORÇAMENTO
// ================================================================
error_log("=== DEBUG SOLICITAR COTACAO ===");
error_log("seq_orcamento: " . $seq_orcamento);
error_log("user_unidade: " . $user_unidade);
error_log("dominio: " . $dominio);

$query = "SELECT nro_orcamento, status
          FROM {$dominio}_orcamento 
          WHERE seq_orcamento = $1
          AND unidade = $2";

error_log("Query: " . $query);

$result = sql($g_sql, $query, false, [$seq_orcamento, $user_unidade]);

error_log("pg_num_rows: " . pg_num_rows($result));

if (pg_num_rows($result) === 0) {
    error_log("❌ Orçamento não encontrado - seq: {$seq_orcamento}, unidade: {$user_unidade}");
    msg('Orçamento não encontrado', 'error');
}

$orcamento = pg_fetch_assoc($result);
error_log("✅ Orçamento encontrado: " . json_encode($orcamento));

if ($orcamento['status'] !== 'PENDENTE') {
    msg('Apenas orçamentos PENDENTES podem solicitar cotação', 'error');
}

// ================================================================
// VERIFICAR FORNECEDOR VINCULADO
// ================================================================
$query = "SELECT seq_orcamento_fornecedor 
          FROM {$dominio}_orcamento_fornecedor 
          WHERE seq_orcamento = $1 
          AND seq_fornecedor = $2";

$result = sql($g_sql, $query, false, [$seq_orcamento, $seq_fornecedor]);

if (pg_num_rows($result) === 0) {
    msg('Fornecedor não está vinculado a este orçamento', 'error');
}

$fornecedor_orcamento = pg_fetch_assoc($result);
$seq_orcamento_fornecedor = $fornecedor_orcamento['seq_orcamento_fornecedor'];

// ================================================================
// GERAR CÓDIGO DE ACESSO (FORMATO: DOMINIO-CODIGO)
// ================================================================
$codigo_base = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
$codigo_acesso = strtoupper($domain) . '-' . $codigo_base;

// ================================================================
// ATUALIZAR EMAIL E CÓDIGO + ATUALIZAR EMAIL DO FORNECEDOR
// ================================================================

// 1. Atualizar email e código na tabela orcamento_fornecedor
$query = "UPDATE {$dominio}_orcamento_fornecedor 
          SET email = $1,
              codigo_acesso = $2,
              data_solicitacao = CURRENT_DATE,
              hora_solicitacao = CURRENT_TIME,
              status = 'ENVIADO'
          WHERE seq_orcamento_fornecedor = $3";

sql($g_sql, $query, false, [$email, $codigo_acesso, $seq_orcamento_fornecedor]);

// 2. Buscar CNPJ do fornecedor e atualizar email na tabela fornecedor
$query = "SELECT cnpj FROM {$dominio}_fornecedor WHERE seq_fornecedor = $1";
$result = sql($g_sql, $query, false, [$seq_fornecedor]);
$fornecedor_data = pg_fetch_assoc($result);

if ($fornecedor_data) {
    $cnpj_fornecedor = $fornecedor_data['cnpj'];
    
    // Atualizar email do fornecedor na tabela principal
    $query = "UPDATE {$dominio}_fornecedor 
              SET email = $1 
              WHERE cnpj = $2";
    sql($g_sql, $query, false, [$email, $cnpj_fornecedor]);
}

// ================================================================
// BUSCAR NOME DO FORNECEDOR
// ================================================================
$query = "SELECT nome FROM {$dominio}_fornecedor WHERE seq_fornecedor = $1";
$result = sql($g_sql, $query, false, [$seq_fornecedor]);
$fornecedor_data = pg_fetch_assoc($result);
$nome_fornecedor = $fornecedor_data['nome'];

// ================================================================
// ENVIAR EMAIL (VIA EmailService.php)
// ================================================================
require_once __DIR__ . '/../services/EmailService.php';

try {
    $emailService = new EmailService();
    $emailResult = $emailService->sendCotacaoEmail(
        $email,
        $nome_fornecedor,
        $orcamento['nro_orcamento'],
        $codigo_acesso,
        strtoupper($domain),
        $username
    );
    
    if (!$emailResult['success']) {
        error_log("[SOLICITAR-COTACAO] Erro ao enviar email: " . $emailResult['message']);
        msg('Erro ao enviar email: ' . $emailResult['message'], 'error');
    }
} catch (Exception $e) {
    error_log("[SOLICITAR-COTACAO] Exception ao enviar email: " . $e->getMessage());
    msg('Erro ao enviar email: ' . $e->getMessage(), 'error');
}

// ================================================================
// LOG DE SUCESSO
// ================================================================
error_log("[SOLICITAR-COTACAO] Email enviado para {$email} - Orçamento: {$orcamento['nro_orcamento']} - Código: {$codigo_acesso}");

// ================================================================
// RETORNAR SUCESSO
// ================================================================
echo json_encode([
    'success' => true,
    'message' => "Email de cotação enviado com sucesso para {$nome_fornecedor}!",
    'data' => [
        'nro_orcamento' => $orcamento['nro_orcamento'],
        'email' => $email,
        'codigo_gerado' => $codigo_acesso
    ]
], JSON_UNESCAPED_UNICODE);