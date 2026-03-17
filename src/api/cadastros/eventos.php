<?php
/**
 * ================================================================
 * API DE EVENTOS
 * ================================================================
 * Endpoint para buscar eventos cadastrados no sistema
 * Utilizado principalmente para seleção de eventos em lançamentos
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

header('Content-Type: application/json; charset=utf-8');

// ✅ REGRA OFICIAL: Sempre usar global $g_sql
global $g_sql;

// ✅ CONECTAR AO BANCO
if (!isset($g_sql)) {
    msg('Erro ao conectar ao banco de dados', 'error');
    http_response_code(500);
    exit;
}

// ✅ OBTER DOMÍNIO DO HEADER OU PARÂMETRO
$domain = $_GET['domain'] ?? $_SERVER['HTTP_X_DOMAIN'] ?? null;
$dominio = $domain;

if (empty($dominio)) {
    msg('Domínio não informado', 'error');
    http_response_code(400);
    exit;
}

// ✅ DEFINIR TABELA COM PREFIXO DO DOMÍNIO
$tblEvento = $dominio . '_evento';

// ============================================
// ROTEAMENTO
// ============================================

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // ✅ LISTAR TODOS OS EVENTOS
            listarEventos($g_sql, $tblEvento, $dominio);
            break;

        default:
            msg('Método não permitido', 'error');
            http_response_code(405);
            break;
    }
} catch (Exception $e) {
    error_log("❌ Erro na API de eventos: " . $e->getMessage());
    msg('Erro ao processar requisição: ' . $e->getMessage(), 'error');
    http_response_code(500);
}

// ============================================
// FUNÇÃO: LISTAR EVENTOS
// ============================================

/**
 * Lista todos os eventos cadastrados no sistema
 * 
 * @param resource $g_sql Conexão PostgreSQL
 * @param string $tblEvento Nome da tabela de eventos
 * @param string $dominio Domínio do cliente
 */
function listarEventos($g_sql, $tblEvento, $dominio) {
    error_log("📋 [eventos.php] Listando eventos da tabela: " . $tblEvento);
    
    // ✅ QUERY PARA BUSCAR TODOS OS EVENTOS
    $query = "
        SELECT 
            evento,
            descricao,
            considerar,
            tipo
        FROM $tblEvento
        ORDER BY evento
    ";
    
    error_log("🔍 Query: " . $query);
    
    // ✅ EXECUTAR QUERY USANDO FUNÇÃO sql() OFICIAL
    $result = sql($query, [], $g_sql);
    
    // ✅ VERIFICAR ERRO SQL
    if ($result === false) {
        $error = pg_last_error($g_sql);
        error_log("❌ Erro SQL ao buscar eventos: " . $error);
        msg('Erro SQL ao buscar eventos: ' . $error, 'error');
        http_response_code(500);
        return;
    }
    
    // ✅ MONTAR ARRAY DE EVENTOS
    $eventos = [];
    $count = 0;
    
    while ($row = pg_fetch_assoc($result)) {
        $eventos[] = [
            'evento' => $row['evento'],
            'descricao' => $row['descricao'] ?? '',
            'considerar' => $row['considerar'] ?? 'S',
            'tipo' => $row['tipo'] ?? 'N'
        ];
        $count++;
    }
    
    error_log("✅ Total de eventos encontrados: " . $count);
    
    // ✅ RETORNAR RESPOSTA JSON
    echo json_encode([
        'success' => true,
        'data' => $eventos,
        'total' => $count
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    http_response_code(200);
}
