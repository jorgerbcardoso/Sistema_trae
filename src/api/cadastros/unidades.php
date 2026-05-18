<?php
/**
 * ================================================================
 * API DE UNIDADES
 * ================================================================
 * Endpoint para gerenciar unidades do sistema
 * Inclui CRUD e importação via imp_ssw_uni()
 */

require_once __DIR__ . '/../config.php';

setupCORS();
handleOptionsRequest();

global $g_sql;
try {
    if (!isset($g_sql) || !$g_sql) {
        $g_sql = connect();
    }
} catch (Throwable $e) {
    msg('Erro ao conectar ao banco de dados', 'error', 500);
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
$tblUnidade = $dominio . '_unidade';

// ============================================
// ROTEAMENTO
// ============================================

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // ✅ LISTAR TODAS AS UNIDADES
            listarUnidades($g_sql, $tblUnidade, $dominio);
            break;
            
        case 'POST':
            // ✅ CRIAR NOVA UNIDADE
            criarUnidade($g_sql, $tblUnidade, $dominio);
            break;
            
        case 'PUT':
            // ✅ ATUALIZAR UNIDADE
            atualizarUnidade($g_sql, $tblUnidade, $dominio);
            break;
            
        case 'DELETE':
            // ✅ EXCLUIR UNIDADE
            excluirUnidade($g_sql, $tblUnidade, $dominio);
            break;
            
        default:
            msg('Método não permitido', 'error');
            http_response_code(405);
            break;
    }
} catch (Exception $e) {
    error_log("❌ Erro na API de unidades: " . $e->getMessage());
    msg('Erro ao processar requisição: ' . $e->getMessage(), 'error');
    http_response_code(500);
}

// ============================================
// FUNÇÃO: LISTAR UNIDADES
// ============================================

function listarUnidades($g_sql, $tblUnidade, $dominio) {
    error_log("📋 [unidades.php] Listando unidades da tabela: " . $tblUnidade);
    
    $query = "
        SELECT 
            sigla,
            nome,
            cnpj,
            latitude,
            longitude,
            unidades_compart
        FROM $tblUnidade
        ORDER BY sigla
    ";
    
    error_log("🔍 Query: " . $query);
    
    $result = sql($query, [], $g_sql);
    
    if ($result === false) {
        $error = pg_last_error($g_sql);
        error_log("❌ Erro SQL ao buscar unidades: " . $error);
        msg('Erro SQL ao buscar unidades: ' . $error, 'error');
        http_response_code(500);
        return;
    }
    
    $unidades = [];
    $count = 0;
    
    while ($row = pg_fetch_assoc($result)) {
        $unidades[] = [
            'sigla' => $row['sigla'],
            'nome' => $row['nome'] ?? '',
            'cnpj' => $row['cnpj'] ?? '',
            'latitude' => $row['latitude'] ?? '',
            'longitude' => $row['longitude'] ?? '',
            'unidades_compart' => $row['unidades_compart'] ?? ''
        ];
        $count++;
    }
    
    error_log("✅ Total de unidades encontradas: " . $count);
    
    echo json_encode([
        'success' => true,
        'data' => $unidades,
        'total' => $count
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    http_response_code(200);
}

// ============================================
// FUNÇÃO: CRIAR UNIDADE
// ============================================

function criarUnidade($g_sql, $tblUnidade, $dominio) {
    error_log("📝 [unidades.php] Criando nova unidade");
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input)) {
        msg('Dados inválidos', 'error');
        http_response_code(400);
        return;
    }
    
    $sigla = pg_escape_string($g_sql, strtoupper(trim($input['sigla'] ?? '')));
    $nome = pg_escape_string($g_sql, trim($input['nome'] ?? ''));
    $cnpj = pg_escape_string($g_sql, trim($input['cnpj'] ?? ''));
    $latitude = pg_escape_string($g_sql, trim($input['latitude'] ?? ''));
    $longitude = pg_escape_string($g_sql, trim($input['longitude'] ?? ''));
    $unidadesCompart = pg_escape_string($g_sql, $input['unidades_compart'] ?? '');
    
    if (empty($sigla)) {
        msg('Sigla é obrigatória', 'error');
        http_response_code(400);
        return;
    }
    
    if (empty($nome)) {
        msg('Nome é obrigatório', 'error');
        http_response_code(400);
        return;
    }
    
    $query = "
        INSERT INTO $tblUnidade (sigla, nome, cnpj, latitude, longitude, unidades_compart)
        VALUES ('$sigla', '$nome', '$cnpj', '$latitude', '$longitude', '$unidadesCompart')
    ";
    
    error_log("🔍 Query: " . $query);
    
    $result = pg_query($g_sql, $query);
    
    if (!$result) {
        $error = pg_last_error($g_sql);
        error_log("❌ Erro SQL ao inserir unidade: " . $error);
        msg('Erro ao criar unidade: ' . $error, 'error');
        http_response_code(500);
        return;
    }
    
    error_log("✅ Unidade criada com sucesso: " . $sigla);
    
    echo json_encode([
        'success' => true,
        'toast' => [
            'message' => 'Unidade criada com sucesso',
            'type' => 'success'
        ]
    ], JSON_UNESCAPED_UNICODE);
    
    http_response_code(200);
}

// ============================================
// FUNÇÃO: ATUALIZAR UNIDADE
// ============================================

function atualizarUnidade($g_sql, $tblUnidade, $dominio) {
    error_log("📝 [unidades.php] Atualizando unidade");
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input)) {
        msg('Dados inválidos', 'error');
        http_response_code(400);
        return;
    }
    
    $sigla = pg_escape_string($g_sql, strtoupper(trim($input['sigla'] ?? '')));
    $nome = pg_escape_string($g_sql, trim($input['nome'] ?? ''));
    $cnpj = pg_escape_string($g_sql, trim($input['cnpj'] ?? ''));
    $latitude = pg_escape_string($g_sql, trim($input['latitude'] ?? ''));
    $longitude = pg_escape_string($g_sql, trim($input['longitude'] ?? ''));
    $unidadesCompart = pg_escape_string($g_sql, $input['unidades_compart'] ?? '');
    
    if (empty($sigla)) {
        msg('Sigla é obrigatória', 'error');
        http_response_code(400);
        return;
    }
    
    if (empty($nome)) {
        msg('Nome é obrigatório', 'error');
        http_response_code(400);
        return;
    }
    
    $query = "
        UPDATE $tblUnidade
        SET 
            nome = '$nome',
            cnpj = '$cnpj',
            latitude = '$latitude',
            longitude = '$longitude',
            unidades_compart = '$unidadesCompart'
        WHERE sigla = '$sigla'
    ";
    
    error_log("🔍 Query: " . $query);
    
    $result = pg_query($g_sql, $query);
    
    if (!$result) {
        $error = pg_last_error($g_sql);
        error_log("❌ Erro SQL ao atualizar unidade: " . $error);
        msg('Erro ao atualizar unidade: ' . $error, 'error');
        http_response_code(500);
        return;
    }
    
    error_log("✅ Unidade atualizada com sucesso: " . $sigla);
    
    echo json_encode([
        'success' => true,
        'toast' => [
            'message' => 'Unidade atualizada com sucesso',
            'type' => 'success'
        ]
    ], JSON_UNESCAPED_UNICODE);
    
    http_response_code(200);
}

// ============================================
// FUNÇÃO: EXCLUIR UNIDADE
// ============================================

function excluirUnidade($g_sql, $tblUnidade, $dominio) {
    error_log("🗑️ [unidades.php] Excluindo unidade");
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input) || empty($input['sigla'])) {
        msg('Sigla é obrigatória', 'error');
        http_response_code(400);
        return;
    }
    
    $sigla = pg_escape_string($g_sql, strtoupper(trim($input['sigla'])));
    
    $query = "DELETE FROM $tblUnidade WHERE sigla = '$sigla'";
    
    error_log("🔍 Query: " . $query);
    
    $result = pg_query($g_sql, $query);
    
    if (!$result) {
        $error = pg_last_error($g_sql);
        error_log("❌ Erro SQL ao excluir unidade: " . $error);
        msg('Erro ao excluir unidade: ' . $error, 'error');
        http_response_code(500);
        return;
    }
    
    error_log("✅ Unidade excluída com sucesso: " . $sigla);
    
    echo json_encode([
        'success' => true,
        'toast' => [
            'message' => 'Unidade excluída com sucesso',
            'type' => 'success'
        ]
    ], JSON_UNESCAPED_UNICODE);
    
    http_response_code(200);
}
