<?php
/**
 * API: INVENTÁRIOS DE ESTOQUE
 * Gerencia inventários gerais e parciais de posições
 */

require_once '/var/www/html/sistema/api/config.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

// ✅ CONECTAR AO BANCO
$g_sql = connect();

$method = $_SERVER['REQUEST_METHOD'];

// ✅ Support para Laravel-style method override
if ($method === 'POST' && isset($_POST['_method'])) {
    $method = strtoupper($_POST['_method']);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

// ✅ Method override no body JSON
if ($method === 'POST' && isset($input['_method'])) {
    $method = strtoupper($input['_method']);
}

$domain = $currentUser['domain'] ?? 'acv';
$login = $currentUser['username'] ?? 'SISTEMA';
$unidadeAtual = $currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '';

try {
    switch ($method) {
        // ============================================
        // GET: LISTAR INVENTÁRIOS
        // ============================================
        case 'GET':
            $where = ["1=1"];
            $params = [];
            $paramIndex = 1;

            // ✅ Filtrar por estoque
            if (!empty($_GET['seq_estoque'])) {
                $where[] = "i.seq_estoque = $" . $paramIndex++;
                $params[] = $_GET['seq_estoque'];
            }

            // ✅ Filtrar por status
            if (!empty($_GET['status'])) {
                $where[] = "i.status = $" . $paramIndex++;
                $params[] = $_GET['status'];
            }

            // ✅ Filtrar por período (data_inicio e data_fim)
            if (!empty($_GET['data_inicio'])) {
                $where[] = "i.data_inclusao >= $" . $paramIndex++;
                $params[] = $_GET['data_inicio'];
            }

            if (!empty($_GET['data_fim'])) {
                $where[] = "i.data_inclusao <= $" . $paramIndex++;
                $params[] = $_GET['data_fim'];
            }

            // ✅ REGRA DE UNIDADE: Se não for MTZ, filtrar pela unidade
            if (strtoupper($unidadeAtual) !== 'MTZ') {
                $where[] = "e.unidade = $" . $paramIndex++;
                $params[] = strtoupper($unidadeAtual);
            }

            $whereClause = implode(' AND ', $where);

            $query = "
                SELECT 
                    i.seq_inventario,
                    i.nome_inventario,
                    i.seq_estoque,
                    i.status,
                    i.data_inclusao,
                    i.hora_inclusao,
                    i.login_inclusao,
                    i.data_conclusao,
                    i.hora_conclusao,
                    i.login_conclusao,
                    e.nro_estoque,
                    e.descricao AS estoque_descricao,
                    e.unidade,
                    COUNT(ip.seq_inventario_posicao) AS qtd_posicoes,
                    SUM(CASE WHEN ip.saldo_contado IS NOT NULL AND ip.saldo_contado > 0 THEN 1 ELSE 0 END) AS qtd_contadas
                FROM {$domain}_inventario i
                INNER JOIN {$domain}_estoque e ON i.seq_estoque = e.seq_estoque
                LEFT JOIN {$domain}_inventario_posicao ip ON i.seq_inventario = ip.seq_inventario
                WHERE $whereClause
                GROUP BY i.seq_inventario, e.seq_estoque
                ORDER BY i.data_inclusao DESC, i.hora_inclusao DESC
            ";

            $result = sql($g_sql, $query, false, $params);
            $inventarios = [];

            while ($row = pg_fetch_assoc($result)) {
                $inventarios[] = $row;
            }

            echo json_encode(['success' => true, 'data' => $inventarios]);
            exit();
            break;

        // ============================================
        // GET: OBTER DETALHES DE UM INVENTÁRIO
        // ============================================
        case 'GET_DETALHES':
            $seqInventario = $input['seq_inventario'] ?? null;

            if (!$seqInventario) {
                msg('seq_inventario é obrigatório', 'error', 400);
            }

            // Buscar inventário com verificação de unidade
            $where = ["i.seq_inventario = $1"];
            $params = [$seqInventario];
            $paramIndex = 2;

            // ✅ REGRA DE UNIDADE: Se não for MTZ, filtrar pela unidade
            if (strtoupper($unidadeAtual) !== 'MTZ') {
                $where[] = "e.unidade = $" . $paramIndex++;
                $params[] = strtoupper($unidadeAtual);
            }

            $whereClause = implode(' AND ', $where);

            $query = "
                SELECT 
                    i.*,
                    e.nro_estoque,
                    e.descricao AS estoque_descricao,
                    e.unidade
                FROM {$domain}_inventario i
                INNER JOIN {$domain}_estoque e ON i.seq_estoque = e.seq_estoque
                WHERE $whereClause
            ";

            $result = sql($g_sql, $query, false, $params);
            $inventario = pg_fetch_assoc($result);

            if (!$inventario) {
                msg('Inventário não encontrado', 'error', 404);
            }

            // Buscar posições do inventário
            $query = "
                SELECT 
                    ip.*,
                    p.rua,
                    p.altura,
                    p.coluna,
                    p.seq_item,
                    it.codigo AS item_codigo,
                    it.descricao AS item_descricao,
                    it.vlr_item
                FROM {$domain}_inventario_posicao ip
                INNER JOIN {$domain}_posicao p ON ip.seq_posicao = p.seq_posicao
                LEFT JOIN {$domain}_item it ON p.seq_item = it.seq_item
                WHERE ip.seq_inventario = $1
                ORDER BY p.rua, p.altura, p.coluna
            ";

            $result = sql($g_sql, $query, false, [$seqInventario]);
            $posicoes = [];

            while ($row = pg_fetch_assoc($result)) {
                $posicoes[] = $row;
            }

            $inventario['posicoes'] = $posicoes;

            echo json_encode(['success' => true, 'data' => $inventario]);
            exit();
            break;

        // ============================================
        // POST: CRIAR NOVO INVENTÁRIO
        // ============================================
        case 'POST':
            $seqEstoque = $input['seq_estoque'] ?? null;
            $nomeInventario = strtoupper($input['nome_inventario'] ?? '');
            $filtros = $input['filtros'] ?? [];

            if (!$seqEstoque || !$nomeInventario) {
                msg('Estoque e nome do inventário são obrigatórios', 'error', 400);
            }

            // ✅ LOG: Verificar filtros recebidos
            error_log("🔍 [Inventario POST] Filtros recebidos: " . json_encode($filtros));

            // Iniciar transação
            sql($g_sql, "BEGIN", false, []);

            // Criar inventário
            $query = "
                INSERT INTO {$domain}_inventario (
                    nome_inventario, seq_estoque, status, login_inclusao
                ) VALUES ($1, $2, 'PENDENTE', $3)
                RETURNING seq_inventario
            ";

            $result = sql($g_sql, $query, false, [$nomeInventario, $seqEstoque, $login]);
            $row = pg_fetch_assoc($result);
            $seqInventario = $row['seq_inventario'];

            // Buscar posições com base nos filtros
            // ✅ IMPORTANTE: altura e coluna já vêm normalizadas do frontend (sem zeros à esquerda)
            $where = ["p.seq_estoque = $1", "p.ativa = 'S'"];
            $params = [$seqEstoque];
            $paramIndex = 2;

            if (!empty($filtros['rua'])) {
                $where[] = "p.rua = $" . $paramIndex++;
                $params[] = strtoupper($filtros['rua']);
            }

            if (!empty($filtros['altura'])) {
                // ✅ NORMALIZADO: altura já vem como string de número inteiro (ex: "1", não "01")
                $where[] = "p.altura = $" . $paramIndex++;
                $params[] = $filtros['altura']; // Já vem normalizado do frontend
            }

            if (!empty($filtros['coluna'])) {
                // ✅ NORMALIZADO: coluna já vem como string de número inteiro (ex: "1", não "01")
                $where[] = "p.coluna = $" . $paramIndex++;
                $params[] = $filtros['coluna']; // Já vem normalizado do frontend
            }

            $whereClause = implode(' AND ', $where);

            $query = "
                SELECT seq_posicao, saldo, rua, altura, coluna
                FROM {$domain}_posicao p
                WHERE $whereClause
                ORDER BY rua, altura, coluna
            ";

            // ✅ LOG: Ver query e params
            error_log("🔍 [Inventario POST] Query: " . $query);
            error_log("🔍 [Inventario POST] Params: " . json_encode($params));

            $result = sql($g_sql, $query, false, $params);

            $qtdPosicoes = 0;
            while ($posicao = pg_fetch_assoc($result)) {
                error_log("🔍 [Inventario POST] Posição encontrada: " . json_encode($posicao));
                
                $insertQuery = "
                    INSERT INTO {$domain}_inventario_posicao (
                        seq_inventario, seq_posicao, saldo_sistema, saldo_contado, diferenca
                    ) VALUES ($1, $2, $3, 0, 0)
                ";

                sql($g_sql, $insertQuery, false, [
                    $seqInventario,
                    $posicao['seq_posicao'],
                    $posicao['saldo']
                ]);

                $qtdPosicoes++;
            }

            if ($qtdPosicoes === 0) {
                // ✅ LOG: Nenhuma posição encontrada - listar todas as posições do estoque para debug
                error_log("⚠️ [Inventario POST] Nenhuma posição encontrada! Listando posições do estoque $seqEstoque:");
                $debugQuery = "SELECT seq_posicao, rua, altura, coluna FROM {$domain}_posicao WHERE seq_estoque = $1 AND ativa = 'S' LIMIT 10";
                $debugResult = sql($g_sql, $debugQuery, false, [$seqEstoque]);
                while ($debugRow = pg_fetch_assoc($debugResult)) {
                    error_log("   - Posição: " . json_encode($debugRow));
                }
                
                sql($g_sql, "ROLLBACK", false, []);
                msg('Nenhuma posição encontrada com os filtros informados', 'error', 400);
            }

            sql($g_sql, "COMMIT", false, []);

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'toast' => [
                    'message' => 'Inventário criado com sucesso',
                    'type' => 'success'
                ],
                'data' => [
                    'seq_inventario' => $seqInventario,
                    'qtd_posicoes' => $qtdPosicoes
                ]
            ]);
            exit();
            break;

        // ============================================
        // PUT: ATUALIZAR CONTAGENS DO INVENTÁRIO
        // ============================================
        case 'PUT':
            $seqInventario = $input['seq_inventario'] ?? null;
            $posicoes = $input['posicoes'] ?? [];

            if (!$seqInventario) {
                msg('seq_inventario é obrigatório', 'error', 400);
            }

            // Verificar se inventário está pendente e se pertence à unidade do usuário
            $where = ["i.seq_inventario = $1"];
            $params = [$seqInventario];
            $paramIndex = 2;

            // ✅ REGRA DE UNIDADE: Se não for MTZ, filtrar pela unidade
            if (strtoupper($unidadeAtual) !== 'MTZ') {
                $where[] = "e.unidade = $" . $paramIndex++;
                $params[] = strtoupper($unidadeAtual);
            }

            $whereClause = implode(' AND ', $where);

            $query = "
                SELECT i.status 
                FROM {$domain}_inventario i
                INNER JOIN {$domain}_estoque e ON i.seq_estoque = e.seq_estoque
                WHERE $whereClause
            ";

            $result = sql($g_sql, $query, false, $params);
            $inventario = pg_fetch_assoc($result);

            if (!$inventario) {
                msg('Inventário não encontrado ou não pertence à sua unidade', 'error', 404);
            }

            if ($inventario['status'] !== 'PENDENTE') {
                msg('Inventário já foi finalizado', 'error', 400);
            }

            sql($g_sql, "BEGIN", false, []);

            foreach ($posicoes as $posicao) {
                $seqInventarioPosicao = $posicao['seq_inventario_posicao'];
                $saldoContado = $posicao['saldo_contado'] ?? 0;

                // Buscar saldo do sistema
                $query = "SELECT saldo_sistema FROM {$domain}_inventario_posicao WHERE seq_inventario_posicao = $1";
                $result = sql($g_sql, $query, false, [$seqInventarioPosicao]);
                $row = pg_fetch_assoc($result);
                $saldoSistema = $row['saldo_sistema'];

                $diferenca = $saldoContado - $saldoSistema;

                // Atualizar posição
                $query = "
                    UPDATE {$domain}_inventario_posicao
                    SET saldo_contado = $1,
                        diferenca = $2,
                        data_contagem = CURRENT_DATE,
                        hora_contagem = CURRENT_TIME,
                        login_contagem = $3
                    WHERE seq_inventario_posicao = $4
                ";

                sql($g_sql, $query, false, [$saldoContado, $diferenca, $login, $seqInventarioPosicao]);
            }

            // Atualizar data de alteração do inventário
            $query = "
                UPDATE {$domain}_inventario
                SET data_alteracao = CURRENT_DATE,
                    hora_alteracao = CURRENT_TIME,
                    login_alteracao = $1
                WHERE seq_inventario = $2
            ";

            sql($g_sql, $query, false, [$login, $seqInventario]);

            sql($g_sql, "COMMIT", false, []);

            // ✅ CORRIGIDO: Retornar success: true ao invés de usar msg()
            echo json_encode([
                'success' => true,
                'toast' => [
                    'message' => 'Contagens atualizadas com sucesso',
                    'type' => 'success'
                ]
            ]);
            exit();
            break;

        // ============================================
        // FINALIZAR: FINALIZAR INVENTÁRIO
        // ============================================
        case 'FINALIZAR':
            $seqInventario = $input['seq_inventario'] ?? null;

            if (!$seqInventario) {
                msg('seq_inventario é obrigatório', 'error', 400);
            }

            // Verificar status e unidade
            $where = ["i.seq_inventario = $1"];
            $params = [$seqInventario];
            $paramIndex = 2;

            // ✅ REGRA DE UNIDADE: Se não for MTZ, filtrar pela unidade
            if (strtoupper($unidadeAtual) !== 'MTZ') {
                $where[] = "e.unidade = $" . $paramIndex++;
                $params[] = strtoupper($unidadeAtual);
            }

            $whereClause = implode(' AND ', $where);

            $query = "
                SELECT i.status 
                FROM {$domain}_inventario i
                INNER JOIN {$domain}_estoque e ON i.seq_estoque = e.seq_estoque
                WHERE $whereClause
            ";

            $result = sql($g_sql, $query, false, $params);
            $inventario = pg_fetch_assoc($result);

            if (!$inventario) {
                msg('Inventário não encontrado ou não pertence à sua unidade', 'error', 404);
            }

            if ($inventario['status'] !== 'PENDENTE') {
                msg('Inventário já foi finalizado', 'error', 400);
            }

            sql($g_sql, "BEGIN", false, []);

            // Buscar todas as posições com diferença
            $query = "
                SELECT 
                    ip.seq_posicao,
                    ip.diferenca,
                    p.seq_item,
                    it.vlr_item
                FROM {$domain}_inventario_posicao ip
                INNER JOIN {$domain}_posicao p ON ip.seq_posicao = p.seq_posicao
                LEFT JOIN {$domain}_item it ON p.seq_item = it.seq_item
                WHERE ip.seq_inventario = $1
                  AND ip.diferenca <> 0
            ";

            $result = sql($g_sql, $query, false, [$seqInventario]);

            while ($row = pg_fetch_assoc($result)) {
                $seqPosicao = $row['seq_posicao'];
                $diferenca = $row['diferenca'];
                $seqItem = $row['seq_item'];
                $vlrItem = $row['vlr_item'] ?? 0;

                $mvto = $diferenca > 0 ? 'E' : 'S'; // E=Entrada, S=Saída
                $qtdeItem = abs($diferenca);
                $vlrTotal = $qtdeItem * $vlrItem;

                // Inserir movimentação
                $query = "
                    INSERT INTO {$domain}_mvto_estoque (
                        login, mvto, tipo, seq_origem, seq_posicao, seq_item, 
                        qtde_item, vlr_unitario, vlr_total, observacao
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ";

                sql($g_sql, $query, false, [
                    $login,
                    $mvto,
                    'I', // Tipo Inventário
                    $seqInventario,
                    $seqPosicao,
                    $seqItem,
                    $qtdeItem,
                    $vlrItem,
                    $vlrTotal,
                    "AJUSTE DE INVENTÁRIO - " . ($mvto === 'E' ? 'ENTRADA' : 'SAÍDA')
                ]);

                // Atualizar saldo da posição
                $query = "
                    UPDATE {$domain}_posicao
                    SET saldo = saldo + $1
                    WHERE seq_posicao = $2
                ";

                sql($g_sql, $query, false, [$diferenca, $seqPosicao]);
            }

            // Atualizar status do inventário
            $query = "
                UPDATE {$domain}_inventario
                SET status = 'FINALIZADO',
                    data_conclusao = CURRENT_DATE,
                    hora_conclusao = CURRENT_TIME,
                    login_conclusao = $1
                WHERE seq_inventario = $2
            ";

            sql($g_sql, $query, false, [$login, $seqInventario]);

            sql($g_sql, "COMMIT", false, []);

            // ✅ CORRIGIDO: Retornar success: true ao invés de usar msg()
            echo json_encode([
                'success' => true,
                'toast' => [
                    'message' => 'Inventário finalizado com sucesso',
                    'type' => 'success'
                ]
            ]);
            exit();
            break;

        // ============================================
        // DELETE: CANCELAR INVENTÁRIO (apenas se PENDENTE)
        // ============================================
        case 'DELETE':
            $seqInventario = $input['seq_inventario'] ?? null;

            if (!$seqInventario) {
                msg('seq_inventario é obrigatório', 'error', 400);
            }

            // Verificar status e unidade
            $where = ["i.seq_inventario = $1"];
            $params = [$seqInventario];
            $paramIndex = 2;

            // ✅ REGRA DE UNIDADE: Se não for MTZ, filtrar pela unidade
            if (strtoupper($unidadeAtual) !== 'MTZ') {
                $where[] = "e.unidade = $" . $paramIndex++;
                $params[] = strtoupper($unidadeAtual);
            }

            $whereClause = implode(' AND ', $where);

            $query = "
                SELECT i.status 
                FROM {$domain}_inventario i
                INNER JOIN {$domain}_estoque e ON i.seq_estoque = e.seq_estoque
                WHERE $whereClause
            ";

            $result = sql($g_sql, $query, false, $params);
            $inventario = pg_fetch_assoc($result);

            if (!$inventario) {
                msg('Inventário não encontrado ou não pertence à sua unidade', 'error', 404);
            }

            if ($inventario['status'] !== 'PENDENTE') {
                msg('Apenas inventários pendentes podem ser cancelados', 'error', 400);
            }

            sql($g_sql, "BEGIN", false, []);

            // Deletar posições
            $query = "DELETE FROM {$domain}_inventario_posicao WHERE seq_inventario = $1";
            sql($g_sql, $query, false, [$seqInventario]);

            // Deletar inventário
            $query = "DELETE FROM {$domain}_inventario WHERE seq_inventario = $1";
            sql($g_sql, $query, false, [$seqInventario]);

            sql($g_sql, "COMMIT", false, []);

            msg('Inventário cancelado com sucesso', 'success', 200);
            break;

        default:
            msg('Método não suportado', 'error', 405);
    }
} catch (Exception $e) {
    if (pg_connection_status($g_sql) === PGSQL_CONNECTION_OK) {
        sql($g_sql, "ROLLBACK", false, []);
    }
    error_log("Erro em inventarios.php: " . $e->getMessage());
    msg('Erro no servidor: ' . $e->getMessage(), 'error', 500);
}