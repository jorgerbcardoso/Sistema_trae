<?php
/**
 * ============================================
 * API: COMERCIAL - AÇÕES DE VENDA
 * ============================================
 * Tabela: [dominio]_acao_venda (codigo, descricao, status)
 *
 * GET (padrão) → lista as ações de venda + mapa de status
 *
 * POST (JSON)
 * - { action: 'criar',     descricao, status }
 * - { action: 'atualizar', codigo, descricao, status }
 * - { action: 'excluir',   codigo }
 *
 * Status (os mesmos do funil do vínculo vendedor x cliente):
 *   D = CADASTRADO | P = EM PROSPECÇÃO | N = EM NEGOCIAÇÃO
 *   C = CONQUISTA  | R = RECONQUISTA
 * ============================================
 */

set_time_limit(0);
ini_set('max_execution_time', '0');
ini_set('memory_limit', '512M');

require_once __DIR__ . '/../config.php';

setupCORS();
handleOptionsRequest();
requireAuth();

$currentUser = getCurrentUser();
$dominio = strtolower($currentUser['domain']);
$prefix  = $dominio . '_';

global $g_sql;
$g_sql = getDBConnection();

if (!$g_sql) {
    msg('Erro ao conectar ao banco de dados', 'error', 500);
}

$tblAcaoVenda = $prefix . 'acao_venda';

$STATUS = [
    'C' => 'CONQUISTA',
    'D' => 'CADASTRADO',
    'P' => 'EM PROSPECÇÃO',
    'N' => 'EM NEGOCIAÇÃO',
    'R' => 'RECONQUISTA',
];

// ============================================
// HELPERS
// ============================================

function avTabelaExiste(string $tabela): bool {
    $r = sql(
        "SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1",
        [$tabela]
    );
    return $r && pg_num_rows($r) > 0;
}

/**
 * Garante a existência da tabela de ações de venda (multi-domínio).
 */
function avGarantirTabela(string $tabela): void {
    if (avTabelaExiste($tabela)) {
        return;
    }
    sql("CREATE TABLE {$tabela} (
            codigo    SERIAL PRIMARY KEY,
            descricao VARCHAR(150),
            status    CHAR(1)
         )");
}

function avExisteCodigo(string $tabela, int $codigo): bool {
    $r = sql("SELECT 1 FROM {$tabela} WHERE codigo = $1 LIMIT 1", [$codigo]);
    return $r && pg_num_rows($r) > 0;
}

function avDescricaoDuplicada(string $tabela, string $descricao, ?int $ignorarCodigo = null): bool {
    $query  = "SELECT 1 FROM {$tabela} WHERE UPPER(BTRIM(descricao)) = UPPER($1)";
    $params = [$descricao];
    if ($ignorarCodigo !== null) {
        $query .= " AND codigo <> $2";
        $params[] = $ignorarCodigo;
    }
    $query .= " LIMIT 1";

    $r = sql($query, $params);
    return $r && pg_num_rows($r) > 0;
}

function avNormalizarDescricao($valor): string {
    $descricao = trim((string)$valor);
    if ($descricao === '') {
        msg('Informe a descrição da ação de venda', 'error', 400);
    }
    if (mb_strlen($descricao) > 150) {
        msg('A descrição deve ter no máximo 150 caracteres', 'error', 400);
    }
    return $descricao;
}

function avNormalizarStatus($valor, array $STATUS): string {
    $status = strtoupper(trim((string)$valor));
    if ($status === '' || !isset($STATUS[$status])) {
        msg('Selecione um status válido', 'error', 400);
    }
    return $status;
}

// ============================================
// AÇÕES
// ============================================

function avListar(string $tabela, array $STATUS): void {
    $result = sql("SELECT codigo, descricao, status FROM {$tabela} ORDER BY codigo");

    $acoes = [];
    while ($row = pg_fetch_assoc($result)) {
        $status = strtoupper(trim((string)$row['status']));
        $acoes[] = [
            'codigo'       => (int)$row['codigo'],
            'descricao'    => $row['descricao'] ?? '',
            'status'       => $status,
            'status_label' => $STATUS[$status] ?? '',
        ];
    }

    echo json_encode([
        'success' => true,
        'acoes'   => $acoes,
        'status'  => $STATUS,
    ], JSON_UNESCAPED_UNICODE);
}

function avCriar(string $tabela, array $data, array $STATUS): void {
    $descricao = avNormalizarDescricao($data['descricao'] ?? null);
    $status    = avNormalizarStatus($data['status'] ?? null, $STATUS);

    if (avDescricaoDuplicada($tabela, $descricao)) {
        msg('Já existe uma ação de venda com essa descrição', 'error', 409);
    }

    $result = sql(
        "INSERT INTO {$tabela} (descricao, status) VALUES ($1, $2) RETURNING codigo",
        [$descricao, $status]
    );
    $row = $result ? pg_fetch_assoc($result) : null;
    if (!$row) {
        msg('Erro ao cadastrar a ação de venda', 'error', 500);
    }

    msg('Ação de venda cadastrada com sucesso', 'success', 200, ['codigo' => (int)$row['codigo']]);
}

function avAtualizar(string $tabela, array $data, array $STATUS): void {
    $codigo = (int)($data['codigo'] ?? 0);
    if ($codigo <= 0) {
        msg('Ação de venda não informada', 'error', 400);
    }
    if (!avExisteCodigo($tabela, $codigo)) {
        msg('Ação de venda não encontrada', 'error', 404);
    }

    $descricao = avNormalizarDescricao($data['descricao'] ?? null);
    $status    = avNormalizarStatus($data['status'] ?? null, $STATUS);

    if (avDescricaoDuplicada($tabela, $descricao, $codigo)) {
        msg('Já existe uma ação de venda com essa descrição', 'error', 409);
    }

    $result = sql(
        "UPDATE {$tabela} SET descricao = $1, status = $2 WHERE codigo = $3",
        [$descricao, $status, $codigo]
    );
    if (!$result) {
        msg('Erro ao atualizar a ação de venda', 'error', 500);
    }

    msg('Ação de venda atualizada com sucesso', 'success');
}

function avExcluir(string $tabela, array $data): void {
    $codigo = (int)($data['codigo'] ?? 0);
    if ($codigo <= 0) {
        msg('Ação de venda não informada', 'error', 400);
    }
    if (!avExisteCodigo($tabela, $codigo)) {
        msg('Ação de venda não encontrada', 'error', 404);
    }

    $result = sql("DELETE FROM {$tabela} WHERE codigo = $1", [$codigo]);
    if (!$result) {
        msg('Erro ao excluir a ação de venda', 'error', 500);
    }

    msg('Ação de venda excluída com sucesso', 'success');
}

// ============================================
// ROTEAMENTO
// ============================================

$method = $_SERVER['REQUEST_METHOD'];

try {
    avGarantirTabela($tblAcaoVenda);

    if ($method === 'GET') {
        avListar($tblAcaoVenda, $STATUS);
        exit;
    }

    if ($method === 'POST') {
        $data = getRequestInput();
        $postAction = $data['action'] ?? '';

        if ($postAction === 'criar') {
            avCriar($tblAcaoVenda, $data, $STATUS);
        } elseif ($postAction === 'atualizar') {
            avAtualizar($tblAcaoVenda, $data, $STATUS);
        } elseif ($postAction === 'excluir') {
            avExcluir($tblAcaoVenda, $data);
        } else {
            msg('Ação não especificada', 'error', 400);
        }
        exit;
    }

    msg('Método não permitido', 'error', 405);

} catch (Throwable $e) {
    error_log("❌ ERRO em comercial/acoes_venda.php: " . $e->getMessage()
        . " | " . $e->getFile() . ":" . $e->getLine());
    msg('Erro interno do servidor', 'error', 500);
}
